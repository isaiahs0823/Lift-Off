// ---------------- AI PROGRAM PROPOSAL — schema, validation, planned volume ----------------
// The strict, code-validated shape the Coach's `proposeProgram` tool must produce, and the pure
// functions that turn an accepted proposal into a REAL BRK program — the exact same
// { id, name, tagline, weeks, days: [{ label, exercises: [{ exId, sets, reps, group? }] }], isCustom }
// shape `copyProgramToCustom` in App.jsx already produces (see src/App.jsx:4238-4248), just with a
// few additional optional per-exercise fields (repMin/repMax/targetRir/restSeconds/notes/
// progressionMethod) that existing consumers (GuidedRunView, progression.js) simply ignore since
// they only ever read exId/sets/reps/group. Nothing about the existing program pipeline changes.
//
// The AI never gets to skip this: `proposeProgram`'s tool executor calls validateProgramProposal
// before the model's output is ever shown to the athlete as a card (section 30 of the program-
// builder spec — malformed AI output must never reach saved program data), and
// createProgramFromProposal only runs once the athlete actually taps Save.
import { PHYSIQUE_PHASES } from "./athleteProfile.js";

export const SCHEDULE_MODES = ["fixed", "rotation"];
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SETS_BOUNDS = [1, 8];
const REP_BOUNDS = [1, 30];
const RIR_BOUNDS = [0, 5];
// The only progression scheme actually implemented (src/utils/progression.js) — if the model
// proposes anything else, that's a validation problem, not a silently-ignored field.
const SUPPORTED_PROGRESSION_METHODS = ["double_progression"];
// Mirrors App.jsx's DEFAULT_REST_DEFAULTS (compound/isolation entries only — a program day never
// prescribes conditioning/superset rest at this layer). Used only as a duration-estimate fallback
// when a proposed exercise doesn't specify its own restSeconds.
const FALLBACK_REST_SECONDS = { compound: 150, isolation: 90 };
const SET_EXECUTION_SECONDS = 40; // rough time to actually perform one working set, for duration estimates only

function isInt(n) {
  return Number.isInteger(n);
}
function inRange(n, [lo, hi]) {
  return isInt(n) && n >= lo && n <= hi;
}

function matchExerciseByName(allExercises, nameQuery) {
  const q = (nameQuery || "").trim().toLowerCase();
  if (!q) return null;
  return allExercises.find((e) => e.name.toLowerCase() === q) || allExercises.find((e) => e.name.toLowerCase().includes(q)) || null;
}

// The single place that decides "does this proposed exercise already exist in BRK" — used by
// validation, planned-volume calculation, and program creation so they can never disagree.
function resolveProposalExercise(ex, { exMap, allExercises }) {
  if (ex?.exerciseId && exMap[ex.exerciseId]) return exMap[ex.exerciseId];
  return matchExerciseByName(allExercises, ex?.exerciseName);
}

// Section 30 — every one of these must hold before a proposal is ever shown to the athlete.
// Returns an array of problem strings naming the exact day/exercise (empty array = valid).
export function validateProgramProposal(proposal, { exMap, allExercises }) {
  const problems = [];
  if (!proposal || typeof proposal !== "object") return ["Program proposal must be an object."];
  if (typeof proposal.name !== "string" || !proposal.name.trim()) problems.push("Program is missing a name.");
  if (!SCHEDULE_MODES.includes(proposal.scheduleMode)) problems.push(`Program scheduleMode must be one of: ${SCHEDULE_MODES.join(", ")}.`);
  if (proposal.phase != null && !PHYSIQUE_PHASES.includes(proposal.phase)) problems.push(`Program phase "${proposal.phase}" is not a recognized phase.`);
  if (!Array.isArray(proposal.days) || proposal.days.length === 0) {
    problems.push("Program must contain at least one training day.");
    return problems;
  }

  const validMuscles = new Set(allExercises.map((e) => e.muscle));
  const seenDayIds = new Set();

  proposal.days.forEach((day, di) => {
    const dayTag = `Day ${di + 1}${day?.label ? ` ("${day.label}")` : ""}`;
    if (!day || typeof day !== "object") {
      problems.push(`${dayTag} is not a valid object.`);
      return;
    }
    if (typeof day.id !== "string" || !day.id) problems.push(`${dayTag} is missing an id.`);
    else if (seenDayIds.has(day.id)) problems.push(`Duplicate day id: ${day.id}`);
    else seenDayIds.add(day.id);

    if (typeof day.label !== "string" || !day.label.trim()) problems.push(`${dayTag} is missing a label.`);
    if (proposal.scheduleMode === "fixed" && day.weekday != null && !WEEKDAYS.includes(day.weekday)) {
      problems.push(`${dayTag} has an invalid weekday: ${day.weekday}`);
    }
    if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
      problems.push(`${dayTag} has no exercises.`);
      return;
    }

    day.exercises.forEach((ex, ei) => {
      const exTag = `${dayTag}, exercise ${ei + 1}${ex?.exerciseName ? ` ("${ex.exerciseName}")` : ""}`;
      if (!ex || typeof ex !== "object") {
        problems.push(`${exTag} is not a valid object.`);
        return;
      }
      if (typeof ex.exerciseName !== "string" || !ex.exerciseName.trim()) problems.push(`${exTag} is missing an exercise name.`);

      const resolved = resolveProposalExercise(ex, { exMap, allExercises });
      if (!resolved) {
        // Section 11 — an exercise BRK doesn't have yet is fine, but only if the proposal supplies
        // enough to create it deliberately (muscle + type). It must never silently map to nothing.
        if (typeof ex.muscle !== "string" || !validMuscles.has(ex.muscle)) {
          problems.push(`${exTag} doesn't match an existing BRK exercise and is missing a valid muscle group to create one (must be one of: ${[...validMuscles].join(", ")}).`);
        }
        if (!["compound", "isolation"].includes(ex.exerciseType)) {
          problems.push(`${exTag} doesn't match an existing BRK exercise and is missing a valid exerciseType ("compound" or "isolation") to create one.`);
        }
      }

      if (!inRange(ex.sets, SETS_BOUNDS)) problems.push(`${exTag} has an invalid set count (must be ${SETS_BOUNDS[0]}-${SETS_BOUNDS[1]}).`);
      if (!inRange(ex.repMin, REP_BOUNDS) || !inRange(ex.repMax, REP_BOUNDS)) {
        problems.push(`${exTag} has an invalid rep range (must be ${REP_BOUNDS[0]}-${REP_BOUNDS[1]}).`);
      } else if (ex.repMin > ex.repMax) {
        problems.push(`${exTag} has repMin greater than repMax.`);
      }
      if (!inRange(ex.targetRir, RIR_BOUNDS)) problems.push(`${exTag} has an invalid target RIR (must be ${RIR_BOUNDS[0]}-${RIR_BOUNDS[1]}).`);
      if (ex.setType !== "working") {
        problems.push(`${exTag} has an unsupported setType "${ex.setType}" (program-level prescriptions must be "working" — warm-ups are added by the athlete in Training Mode, not prescribed by the program).`);
      }
      if (!SUPPORTED_PROGRESSION_METHODS.includes(ex.progressionMethod)) {
        problems.push(`${exTag} has an unsupported progressionMethod "${ex.progressionMethod}" (BRK currently only implements double_progression).`);
      }
      if (ex.restSeconds != null && (!Number.isFinite(ex.restSeconds) || ex.restSeconds < 0)) {
        problems.push(`${exTag} has an invalid restSeconds value.`);
      }
    });
  });

  try {
    plannedWeeklyVolumeByMuscle(proposal, { exMap, allExercises });
  } catch (e) {
    problems.push(`Weekly volume calculation failed: ${e.message}`);
  }

  return problems;
}

// Planned weekly working-set volume by muscle group — the proposal-side counterpart to
// muscleVolume.js's muscleVolumeInRange/weeklyMuscleVolume, which only ever look at completed
// logs and have nothing to say about a program that hasn't been run yet. Simplification: every
// day in proposal.days[] is assumed to occur exactly once per week (true for a standard
// fixed-weekday split, and the standard bodybuilding-programming assumption for a rotation split
// whose cycle repeats roughly weekly) — there is no per-day repeat-count field in this schema.
// Falls back to a proposed exercise's own `muscle` hint when it doesn't resolve to an existing
// BRK exercise yet (i.e. it's still pending creation), so volume can be reasoned about before the
// athlete has accepted anything.
export function plannedWeeklyVolumeByMuscle(proposal, { exMap, allExercises }) {
  const counts = {};
  for (const day of proposal.days || []) {
    for (const ex of day.exercises || []) {
      const resolved = resolveProposalExercise(ex, { exMap, allExercises });
      const muscle = resolved?.muscle || ex.muscle;
      if (!muscle) continue;
      counts[muscle] = (counts[muscle] || 0) + (Number(ex.sets) || 0);
    }
  }
  return counts;
}

// Rough session-length estimate (section 9 — a program must fit the athlete's stated session
// duration). Not a scheduler, just a guardrail so an obviously-too-long day can be flagged before
// the athlete ever sees it.
export function estimateDayDurationMin(day, { exMap, allExercises }, restDefaults = FALLBACK_REST_SECONDS) {
  let totalSeconds = 0;
  for (const ex of day.exercises || []) {
    const resolved = resolveProposalExercise(ex, { exMap, allExercises });
    const restSeconds = ex.restSeconds ?? restDefaults[resolved?.type] ?? FALLBACK_REST_SECONDS.isolation;
    const sets = Number(ex.sets) || 0;
    totalSeconds += sets * (SET_EXECUTION_SECONDS + restSeconds);
  }
  return Math.round(totalSeconds / 60);
}

// Turns an accepted proposal into the exact shape state.customPrograms already expects (see
// copyProgramToCustom, src/App.jsx:4238-4248) plus any brand-new custom exercises it needed to
// create along the way. Pure — takes no `state`/`updateState`, mirrors createCommitment
// (src/utils/commitments.js:79-98). Caller is responsible for actually pushing the results into
// state; this function never mutates anything itself. Assumes the proposal has already passed
// validateProgramProposal — call sites must not skip that step.
export function createProgramFromProposal(proposal, { exMap, allExercises }) {
  const newCustomExercises = [];
  const nameToId = new Map(); // dedupes newly-created custom exercises within this one program by name (section 11 — never silently create duplicates)

  function resolveOrCreate(ex) {
    const resolved = resolveProposalExercise(ex, { exMap, allExercises });
    if (resolved) return resolved.id;
    const key = ex.exerciseName.trim().toLowerCase();
    if (nameToId.has(key)) return nameToId.get(key);
    const id = `custom_${key.replace(/[^a-z0-9]+/g, "_")}_${Date.now()}_${newCustomExercises.length}`;
    newCustomExercises.push({ id, name: ex.exerciseName.trim(), muscle: ex.muscle, type: ex.exerciseType, custom: true });
    nameToId.set(key, id);
    return id;
  }

  const days = proposal.days.map((day, di) => {
    const sortedExercises = [...day.exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return {
      id: day.id || `day_${di + 1}`,
      label: day.label,
      weekday: proposal.scheduleMode === "fixed" ? day.weekday || null : null,
      focusMuscles: Array.isArray(day.focusMuscles) ? day.focusMuscles : [],
      estimatedDuration: day.estimatedDuration ?? estimateDayDurationMin(day, { exMap, allExercises }),
      exercises: sortedExercises.map((ex, ei) => ({
        exId: resolveOrCreate(ex),
        sets: ex.sets,
        reps: ex.repMax, // backward-compat single target — GuidedRunView/progression.js only ever read this field
        repMin: ex.repMin,
        repMax: ex.repMax,
        targetRir: ex.targetRir,
        restSeconds: ex.restSeconds ?? null,
        notes: ex.notes ?? null,
        setType: "working",
        progressionMethod: ex.progressionMethod,
        order: ex.order ?? ei,
        group: ex.group ?? null,
      })),
    };
  });

  const program = {
    id: `program_${Date.now()}`,
    name: proposal.name.trim(),
    tagline: proposal.tagline || "",
    goal: proposal.goal || null,
    phase: proposal.phase || null,
    scheduleMode: proposal.scheduleMode,
    weeks: proposal.weeks ?? null,
    days,
    isCustom: true,
    generatedByCoach: true,
    createdAt: new Date().toISOString(),
  };

  return { program, newCustomExercises };
}
