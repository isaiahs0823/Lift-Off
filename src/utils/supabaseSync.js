// ---------------- SUPABASE SYNC (hybrid, local-first) ----------------
// localStorage stays the source of truth for the running app — this module only ever pushes a
// copy of local state up, and pulls remote rows down to FILL IN gaps (never to overwrite local
// data). Nothing here can make the app non-functional signed-out: every exported function is a
// no-op when `supabaseEnabled` is false or no user is signed in.
//
// Scope (first pass, per the "move all workout data" request): the 14 list-type workout
// collections + one singleton profile row. Nutrition and Coach-memory data are an intentional
// second pass — see supabase_schema.sql.
//
// Known limitation of this pass: deletions aren't synced. Deleting something locally doesn't
// remove it from Supabase, and a row deleted directly in Supabase won't be removed locally. A
// real delete-sync (tombstones, or a "deleted_at" column) is future work, not built here.
import { supabase, supabaseEnabled } from "../lib/supabaseClient.js";

const DROP_UNDEFINED = (obj) => JSON.parse(JSON.stringify(obj));

// Each entry maps a local top-level state collection to its Supabase table, with explicit
// row<->local converters (not a generic camelCase transform — a couple of tables carry
// different field sets than their local counterpart).
const COLLECTIONS = [
  {
    key: "workoutSessions",
    table: "workout_sessions",
    toRow: (s, userId) => ({
      id: s.id,
      user_id: userId,
      plan_name: s.planName ?? null,
      source: s.source ?? null,
      source_program_id: s.sourceProgramId ?? null,
      source_program_name: s.sourceProgramName ?? null,
      source_day_label: s.sourceDayLabel ?? null,
      started_at: s.startedAt ?? null,
      finished_at: s.finishedAt,
      duration_sec: s.durationSec ?? null,
      exercise_count: s.exerciseCount ?? null,
      working_sets: s.workingSets ?? null,
      total_reps: s.totalReps ?? null,
      total_volume: s.totalVolume ?? null,
      avg_rir: s.avgRir ?? null,
      is_volume_pr: !!s.isVolumePR,
      perf_delta_pct: s.perfDeltaPct ?? null,
      rating: s.rating ?? null,
      main_muscles: s.mainMuscles ?? null,
      best_lift: s.bestLift ?? null,
      prs: s.prs ?? [],
      entries: s.entries ?? [],
      session_context: s.sessionContext ?? null,
      coach_message: s.coachMessage ?? null,
      note: s.note ?? null,
    }),
    fromRow: (r) => ({
      id: r.id,
      planName: r.plan_name,
      source: r.source,
      sourceProgramId: r.source_program_id,
      sourceProgramName: r.source_program_name,
      sourceDayLabel: r.source_day_label,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      durationSec: r.duration_sec,
      exerciseCount: r.exercise_count,
      workingSets: r.working_sets,
      totalReps: r.total_reps,
      totalVolume: r.total_volume,
      avgRir: r.avg_rir,
      isVolumePR: r.is_volume_pr,
      perfDeltaPct: r.perf_delta_pct,
      rating: r.rating,
      mainMuscles: r.main_muscles,
      bestLift: r.best_lift,
      prs: r.prs,
      entries: r.entries,
      sessionContext: r.session_context,
      coachMessage: r.coach_message,
      note: r.note,
    }),
  },
  {
    key: "logs",
    table: "exercise_logs",
    toRow: (l, userId) => ({
      id: l.id,
      user_id: userId,
      ex_id: l.exId,
      date: l.date,
      sets: l.sets ?? [],
      target_reps: l.targetReps ?? null,
      equipment_profile_id: l.equipmentProfileId ?? null,
      equipment_context: l.equipmentContext ?? null,
      joint_note: l.jointNote ?? null,
    }),
    fromRow: (r) => ({
      id: r.id,
      exId: r.ex_id,
      date: r.date,
      sets: r.sets,
      targetReps: r.target_reps,
      ...(r.equipment_profile_id ? { equipmentProfileId: r.equipment_profile_id } : {}),
      ...(r.equipment_context ? { equipmentContext: r.equipment_context } : {}),
      ...(r.joint_note ? { jointNote: r.joint_note } : {}),
    }),
  },
  {
    key: "cardioLogs",
    table: "cardio_logs",
    toRow: (c, userId) => ({
      id: c.id,
      user_id: userId,
      ex_id: c.exId,
      date: c.date,
      distance: c.distance ?? null,
      distance_unit: c.distanceUnit ?? null,
      duration: c.duration ?? null,
      load: c.load ?? null,
      notes: c.notes ?? null,
    }),
    fromRow: (r) => ({
      id: r.id,
      exId: r.ex_id,
      date: r.date,
      distance: r.distance,
      distanceUnit: r.distance_unit,
      duration: r.duration,
      load: r.load,
      notes: r.notes,
    }),
  },
  {
    key: "customPrograms",
    table: "custom_programs",
    toRow: (p, userId) => ({ id: p.id, user_id: userId, name: p.name, tagline: p.tagline ?? null, days: p.days ?? [] }),
    fromRow: (r) => ({ id: r.id, name: r.name, tagline: r.tagline, days: r.days }),
  },
  {
    key: "customPlans",
    table: "custom_plans",
    toRow: (p, userId) => ({ id: p.id, user_id: userId, name: p.name, exercises: p.exercises ?? [], is_custom: p.isCustom !== false }),
    fromRow: (r) => ({ id: r.id, name: r.name, exercises: r.exercises, isCustom: r.is_custom }),
  },
  {
    key: "customExercises",
    table: "custom_exercises",
    toRow: (e, userId) => ({
      id: e.id,
      user_id: userId,
      name: e.name,
      type: e.type ?? null,
      muscle: e.muscle ?? null,
      secondary_muscles: e.secondaryMuscles ?? null,
      equipment: e.equipment ?? null,
      movement_category: e.movementCategory ?? null,
      brand: e.brand ?? null,
      notes: e.notes ?? null,
      archived: !!e.archived,
    }),
    fromRow: (r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      muscle: r.muscle,
      secondaryMuscles: r.secondary_muscles,
      equipment: r.equipment,
      movementCategory: r.movement_category,
      brand: r.brand,
      notes: r.notes,
      archived: r.archived,
      custom: true,
    }),
  },
  {
    key: "equipmentProfiles",
    table: "equipment_profiles",
    toRow: (p, userId) => ({
      id: p.id,
      user_id: userId,
      exercise_id: p.exerciseId,
      label: p.label,
      gym_label: p.gymLabel ?? null,
      is_default: !!p.isDefault,
    }),
    fromRow: (r) => ({ id: r.id, exerciseId: r.exercise_id, label: r.label, gymLabel: r.gym_label, isDefault: r.is_default }),
  },
  {
    key: "bodyweightLogs",
    table: "bodyweight_logs",
    toRow: (b, userId) => ({
      id: b.id,
      user_id: userId,
      date: b.date,
      weight: b.weight ?? null,
      waist: b.waist ?? null,
      body_fat: b.bodyFat ?? null,
      notes: b.notes ?? null,
    }),
    fromRow: (r) => ({ id: r.id, date: r.date, weight: r.weight, waist: r.waist, bodyFat: r.body_fat, notes: r.notes }),
  },
  {
    key: "readinessLogs",
    table: "readiness_logs",
    toRow: (r, userId) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      sleep_quality: r.sleepQuality ?? null,
      sleep_hours: r.sleepHours ?? null,
      soreness: r.soreness ?? null,
      stress: r.stress ?? null,
      motivation: r.motivation ?? null,
      energy: r.energy ?? null,
      resting_hr: r.restingHR ?? null,
      notes: r.notes ?? null,
    }),
    fromRow: (r) => ({
      id: r.id,
      date: r.date,
      sleepQuality: r.sleep_quality,
      sleepHours: r.sleep_hours,
      soreness: r.soreness,
      stress: r.stress,
      motivation: r.motivation,
      energy: r.energy,
      restingHR: r.resting_hr,
      notes: r.notes,
    }),
  },
  {
    key: "goals",
    table: "goals",
    toRow: (g, userId) => ({
      id: g.id,
      user_id: userId,
      title: g.title,
      type: g.type ?? null,
      start_value: g.startValue ?? null,
      current_value: g.currentValue ?? null,
      target_value: g.targetValue ?? null,
      target_date: g.targetDate ?? null,
      units: g.units ?? null,
      priority: g.priority ?? null,
      notes: g.notes ?? null,
      status: g.status || "active",
      linked_ex_id: g.linkedExId ?? null,
      metric: g.metric ?? null,
      history: g.history ?? [],
    }),
    fromRow: (r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      startValue: r.start_value,
      currentValue: r.current_value,
      targetValue: r.target_value,
      targetDate: r.target_date,
      units: r.units,
      priority: r.priority,
      notes: r.notes,
      status: r.status,
      linkedExId: r.linked_ex_id,
      metric: r.metric,
      history: r.history,
    }),
  },
  {
    key: "completedPrograms",
    table: "completed_programs",
    toRow: (c, userId) => ({
      id: c.id,
      user_id: userId,
      program_id: c.programId ?? null,
      program_source: c.programSource ?? null,
      program_name: c.programName ?? null,
      weeks: c.weeks ?? null,
      start_date: c.startDate ?? null,
      end_date: c.endDate ?? null,
    }),
    fromRow: (r) => ({
      id: r.id,
      programId: r.program_id,
      programSource: r.program_source,
      programName: r.program_name,
      weeks: r.weeks,
      startDate: r.start_date,
      endDate: r.end_date,
    }),
  },
  {
    key: "recoverySessions",
    table: "recovery_sessions",
    toRow: (s, userId) => ({
      id: s.id,
      user_id: userId,
      routine_id: s.routineId ?? null,
      routine_name: s.routineName ?? null,
      plan_name: s.planName ?? null,
      finished_at: s.finishedAt,
      total_movements: s.totalMovements ?? null,
      movements_completed: s.movementsCompleted ?? null,
      completion_pct: s.completionPct ?? null,
      duration_sec: s.durationSec ?? null,
      manual: !!s.manual,
      source_program_id: s.sourceProgramId ?? null,
      source_program_name: s.sourceProgramName ?? null,
      source_day_label: s.sourceDayLabel ?? null,
    }),
    fromRow: (r) => ({
      id: r.id,
      routineId: r.routine_id,
      routineName: r.routine_name,
      planName: r.plan_name,
      finishedAt: r.finished_at,
      totalMovements: r.total_movements,
      movementsCompleted: r.movements_completed,
      completionPct: r.completion_pct,
      durationSec: r.duration_sec,
      manual: r.manual,
      sourceProgramId: r.source_program_id,
      sourceProgramName: r.source_program_name,
      sourceDayLabel: r.source_day_label,
    }),
  },
  {
    key: "recoveryLogs",
    table: "recovery_logs",
    toRow: (r, userId) => ({ id: r.id, user_id: userId, date: r.date, activity: r.activity ?? null, notes: r.notes ?? null }),
    fromRow: (r) => ({ id: r.id, date: r.date, activity: r.activity, notes: r.notes }),
  },
  {
    // Whole snapshot round-trips through the jsonb `data` column — see
    // supabase_schema_athlete_rating.sql for why this one isn't column-normalized.
    key: "athleteRatingSnapshots",
    table: "athlete_rating_snapshots",
    toRow: (s, userId) => ({ id: s.id, user_id: userId, computed_at: s.computedAt, ovr: s.ovr ?? null, rank_label: s.rank?.label ?? null, data: s }),
    fromRow: (r) => r.data,
  },
];

function requireUser() {
  return supabaseEnabled;
}

// Pushes every list collection present in `state`, plus the workout_profile singleton. Upserts
// by primary key, so re-pushing unchanged rows is a harmless no-op. Collections are pushed
// independently — one table failing (e.g. a transient network blip) doesn't block the rest.
export async function pushWorkoutDataToSupabase(state, userId) {
  if (!requireUser() || !userId) return { ok: false, errors: ["sync not available"] };
  const errors = [];

  await Promise.all(
    COLLECTIONS.map(async ({ key, table, toRow }) => {
      const items = state[key];
      if (!Array.isArray(items) || items.length === 0) return;
      const rows = items.map((item) => DROP_UNDEFINED(toRow(item, userId)));
      const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
      if (error) errors.push(`${table}: ${error.message}`);
    })
  );

  const profileRow = DROP_UNDEFINED({
    user_id: userId,
    current_program: state.currentProgram ?? null,
    weekly_schedule: state.weeklySchedule ?? null,
    schedule_log: state.scheduleLog ?? [],
    settings: state.settings ?? {},
    has_seen_onboarding: !!state.hasSeenOnboarding,
    updated_at: new Date().toISOString(),
  });
  const { error: profileError } = await supabase.from("workout_profile").upsert(profileRow, { onConflict: "user_id" });
  if (profileError) errors.push(`workout_profile: ${profileError.message}`);

  return { ok: errors.length === 0, errors };
}

// Fetches every row Supabase has for this user and returns it shaped like local state. Pulling
// never mutates anything itself — see mergeRemoteIntoLocal for how the caller applies it.
export async function pullWorkoutDataFromSupabase(userId) {
  if (!requireUser() || !userId) return { ok: false, errors: ["sync not available"], data: {} };
  const errors = [];
  const data = {};

  await Promise.all(
    COLLECTIONS.map(async ({ key, table, fromRow }) => {
      const { data: rows, error } = await supabase.from(table).select("*").eq("user_id", userId);
      if (error) {
        errors.push(`${table}: ${error.message}`);
        return;
      }
      data[key] = (rows || []).map(fromRow);
    })
  );

  const { data: profileRow, error: profileError } = await supabase
    .from("workout_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) errors.push(`workout_profile: ${profileError.message}`);
  if (profileRow) {
    data.workoutProfile = {
      currentProgram: profileRow.current_program,
      weeklySchedule: profileRow.weekly_schedule,
      scheduleLog: profileRow.schedule_log,
      settings: profileRow.settings,
      hasSeenOnboarding: profileRow.has_seen_onboarding,
    };
  }

  return { ok: errors.length === 0, errors, data };
}

// Local-first merge: an item already present locally (by id) is never touched — this only adds
// rows that exist remotely but not locally (the case that matters: signing in on a new/cleared
// device that already has account history). The singleton profile fields only adopt a remote
// value when the local one is still at its untouched default (null / empty array / false),
// so an in-progress local program or schedule is never clobbered by an older remote snapshot.
export function mergeRemoteIntoLocal(localState, remoteData) {
  let next = { ...localState };

  for (const { key } of COLLECTIONS) {
    const remoteItems = remoteData[key];
    if (!Array.isArray(remoteItems) || remoteItems.length === 0) continue;
    const localItems = Array.isArray(next[key]) ? next[key] : [];
    const localIds = new Set(localItems.map((i) => i.id));
    const toAdd = remoteItems.filter((i) => !localIds.has(i.id));
    if (toAdd.length > 0) next = { ...next, [key]: [...localItems, ...toAdd] };
  }

  const profile = remoteData.workoutProfile;
  if (profile) {
    next = {
      ...next,
      currentProgram: next.currentProgram ?? profile.currentProgram ?? null,
      weeklySchedule: next.weeklySchedule ?? profile.weeklySchedule ?? null,
      scheduleLog: next.scheduleLog && next.scheduleLog.length > 0 ? next.scheduleLog : profile.scheduleLog || next.scheduleLog,
      hasSeenOnboarding: next.hasSeenOnboarding || !!profile.hasSeenOnboarding,
    };
  }

  return next;
}
