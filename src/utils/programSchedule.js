// ---------------- PROGRAM SCHEDULE ----------------
// Resolves state.currentProgram into the actual program/day data, or null if the program was
// deleted (custom program removed) or none is active. Pure function of state — no React,
// hence its own file rather than living in App.jsx (also used by the coach context engine).
//
// resolveCurrentProgramDay's contract and behavior are UNCHANGED and must stay that way —
// coachContext.js, coachTools.js, weeklySchedule.js, and ScheduleEditor.jsx all read it directly
// and expect "the active program's own next/current day," including its pre-existing (own-
// program-day) swap-workout override support. resolveTodayWorkout below is the new, broader
// entry point Today/Train/the swap selector should use instead — it wraps this function rather
// than replacing it, adding support for a one-day override that points at a workout OUTSIDE the
// active program (or a fully standalone plan/template) without changing what this function
// reports for the active program itself.

import { findMostRecentSessionForPlan, findTodaysSessionForPlan } from "./workoutHistory.js";
import { recoveryRoutineById } from "../data/mobilityLibrary.js";
import { estimateRoutineMinutes } from "./mobilitySession.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// A program day is a recovery day when it carries `type: "recovery"` (see Berserker in App.jsx)
// instead of a lifting `exercises` array — every existing program day simply has no `type` field
// at all, so `isRecoveryProgramDay` is false for all of them and every function below behaves
// exactly as it did before recovery days existed.
function isRecoveryProgramDay(day) {
  return !!day && day.type === "recovery";
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

// Looks up the active program's data (built-in or custom) for state.currentProgram. Shared by
// resolveCurrentProgramDay and programDaysOverview so both agree on which program/day list is
// "the current one" — no separate lookup logic to drift out of sync.
export function activeProgramAndCP(state) {
  const cp = state.currentProgram;
  if (!cp) return null;
  const list = cp.source === "custom" ? state.customPrograms || [] : state.programs || [];
  const prog = list.find((p) => p.id === cp.programId);
  if (!prog || !Array.isArray(prog.days)) return null;
  return { cp, prog };
}

// A "swap workout" override is a ONE-DAY substitution of which program day counts as "today's"
// — it never touches cp.dayIndex (the program's normal progress pointer) or the program's own
// day data. It only applies when: it belongs to the currently active program (programId+source
// match — a stale override left over from a since-replaced program is otherwise inert and never
// read), and it's still dated today (once the calendar date moves on, an unused override simply
// stops applying — no cleanup pass required, see the task's "safely resolved by existing
// date/session logic"). finishRun clears it explicitly once its workout is actually completed;
// this date check is the fallback for an override that was set but never acted on.
export function activeOverrideFor(state, cp) {
  const ov = state.programDayOverride;
  if (!ov || !cp) return null;
  if (ov.sourceType !== "program" || ov.programId !== cp.programId || ov.source !== cp.source) return null;
  if (ov.date !== todayDateStr()) return null;
  return ov;
}

// Broader than activeOverrideFor — any override dated today, regardless of whether it belongs to
// the active program. Used by resolveTodayWorkout to detect an outside-program/standalone
// override; activeOverrideFor (above) stays scoped to "belongs to the active program" for
// resolveCurrentProgramDay's existing contract.
export function activeAnyOverride(state) {
  const ov = state.programDayOverride;
  if (!ov) return null;
  if (ov.date !== todayDateStr()) return null;
  return ov;
}

// The display/history plan name for an override — same "<program> — <day>" convention every
// program/plan start already uses, so history entries read identically either way. A standalone
// plan/template override has no dayLabel, so it's just its own name.
export function overridePlanName(ov) {
  if (!ov) return null;
  return ov.dayLabel ? `${ov.programName} — ${ov.dayLabel}` : ov.programName;
}

// Rough session length estimate shared by every screen that lists program days (Today, Train,
// the swap selector, My Plan) — same formula TodayTab already used locally, just promoted here
// so nothing has to duplicate it.
export function estimateWorkoutMinutes(exercises) {
  const totalSets = (exercises || []).reduce((sum, e) => sum + (Number(e.sets) || 0), 0);
  return Math.round(totalSets * 3.5);
}

// When the program has a weeks field and enough real time has elapsed since startDate,
// returns an isComplete result instead of a day to run.
export function resolveCurrentProgramDay(state) {
  const active = activeProgramAndCP(state);
  if (!active) return null;
  const { cp, prog } = active;

  // dayIndex advances the instant a workout finishes (see finishRun in App.jsx), so by itself
  // it always points at the *next* day to start. Without this, the Today card would jump
  // straight to tomorrow's workout the moment today's is logged, instead of staying on today's
  // day for the rest of the calendar day. lastCompletedAt/lastCompletedDayIndex record what was
  // actually finished and when, so the resolved day only moves forward once the real date does.
  const todayStr = todayDateStr();
  const completedToday = !!(cp.lastCompletedAt && cp.lastCompletedAt.slice(0, 10) === todayStr);
  const override = activeOverrideFor(state, cp);
  // A same-day completion is always authoritative over an override (in practice they're mutually
  // exclusive — finishRun clears the override the moment its workout completes — this ordering
  // is just a defensive guarantee, not something that should ever actually get exercised).
  const effectiveDayIndex =
    completedToday && cp.lastCompletedDayIndex != null ? cp.lastCompletedDayIndex : override ? override.dayIndex : cp.dayIndex;

  if (!prog.days[effectiveDayIndex]) return null;

  const totalWeeks = prog.weeks || null;
  let weekNumber = null;
  if (cp.startDate && totalWeeks) {
    const daysElapsed = Math.max(0, Math.floor((Date.now() - new Date(cp.startDate).getTime()) / MS_PER_DAY));
    weekNumber = Math.floor(daysElapsed / 7) + 1;
  }

  const programContext = {
    programId: prog.id,
    programName: prog.name,
    source: cp.source,
    dayIndex: effectiveDayIndex,
    totalDays: prog.days.length,
  };

  if (weekNumber !== null && weekNumber > totalWeeks) {
    return { isComplete: true, programName: prog.name, totalWeeks, programContext };
  }

  const day = prog.days[effectiveDayIndex];
  // Only relevant when completedToday — the actual next day up, for a small "Next lift"
  // pointer rather than making tomorrow's workout the dominant thing on today's card.
  const nextDayLabel = completedToday ? prog.days[cp.dayIndex]?.label ?? null : null;
  // isSwapped only reflects a still-live override (never true once something's completed today —
  // completedToday already takes priority above) — used by Today/Train to show "Swapped for
  // today" instead of the normal "Next: <day>" framing, alongside what was originally planned.
  const isSwapped = !completedToday && !!override && override.dayIndex !== cp.dayIndex;
  const shared = {
    completedToday,
    nextDayLabel,
    programName: prog.name,
    dayLabel: day.label,
    dayIndex: effectiveDayIndex,
    totalDays: prog.days.length,
    weekNumber,
    totalWeeks,
    programContext,
    isSwapped,
    plannedDayIndex: cp.dayIndex,
    plannedDayLabel: isSwapped ? prog.days[cp.dayIndex]?.label ?? null : null,
  };

  // A recovery-type program day (see Berserker in App.jsx) never had a lifting `exercises` list
  // to begin with — forcing one into `plan: { exercises }` would be lying about what the day
  // actually is (the task's explicit "do not force recovery movements into the lifting exercise
  // schema" rule). `programContext` is still populated above so completing it still advances
  // dayIndex exactly like a lifting day does — only what gets rendered/started differs.
  if (isRecoveryProgramDay(day)) {
    const routine = recoveryRoutineById(day.routineId);
    return {
      isComplete: false,
      ...shared,
      isRecoveryDay: true,
      routineId: day.routineId,
      routine,
      estMinutes: estimateRoutineMinutes(routine),
    };
  }

  return {
    isComplete: false,
    ...shared,
    isRecoveryDay: false,
    plan: { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
  };
}

// The broad "what is today's workout" entry point — Today, Train, and the swap selector should
// call this instead of resolveCurrentProgramDay directly. Wraps it: when the live override
// belongs to the active program, this is byte-identical to resolveCurrentProgramDay's own answer
// (existing behavior, unchanged). When the override points OUTSIDE the active program (another
// built-in/custom program's day, or a standalone plan/template), this resolves it entirely from
// the override's own snapshot — never re-reads the live program/plan — with programContext set
// to null so starting it can never advance or otherwise touch currentProgram. The active
// program's own pending day is still reported (plannedProgramName/plannedDayLabel) so the UI can
// make clear it's untouched and still waiting.
export function resolveTodayWorkout(state) {
  const cp = state.currentProgram;
  const ov = activeAnyOverride(state);
  const isOwnProgramDay = !!(ov && ov.sourceType === "program" && cp && ov.programId === cp.programId && ov.source === cp.source);
  const programDay = resolveCurrentProgramDay(state);

  if (ov && !isOwnProgramDay) {
    return {
      isComplete: false,
      completedToday: !!overrideCompletedTodaySession(state, ov),
      programName: ov.programName,
      dayLabel: ov.dayLabel,
      plan: {
        name: overridePlanName(ov),
        exercises: ov.exercises,
        source: ov.sourceType === "program" ? "program" : "custom",
        sourceProgramId: ov.programId ?? null,
        sourceProgramName: ov.programName,
        sourceDayLabel: ov.dayLabel ?? null,
      },
      programContext: null,
      isSwapped: true,
      isOutsideProgram: true,
      sourceType: ov.sourceType,
      totalDays: null,
      weekNumber: null,
      totalWeeks: null,
      plannedProgramName: programDay ? programDay.programName : null,
      plannedDayLabel: programDay ? programDay.dayLabel : null,
    };
  }

  if (!programDay) return null;
  return { ...programDay, isOutsideProgram: false, sourceType: "program" };
}

// Everything the swap-workout selector needs to render every day of the currently active
// program: exercise count/estimated length, completion status (by exact plan-name match — the
// same rule the program detail screen's "Completed" row already uses), and which day is
// "planned" (the normal next-up pointer) vs "today" (planned, or an active override) right now.
// Returns null when there's no active program, or it only has one day (nothing meaningful to
// swap between).
// Lifting-only day list — a "swap workout" is fundamentally "choose a different LIFTING
// workout"; recovery-type days (see Berserker) are filtered out here rather than rendered with
// exercises they don't have. This never affects dayIndex/completion sequencing (that still
// advances through every day, lifting or recovery, via cp.dayIndex/finishRun) — it only trims
// what this one browse list shows.
export function programDaysOverview(state) {
  const active = activeProgramAndCP(state);
  if (!active) return null;
  const { cp, prog } = active;
  const liftingDays = prog.days.map((day, index) => ({ day, index })).filter(({ day }) => !isRecoveryProgramDay(day));
  if (liftingDays.length < 2) return null;

  const programDay = resolveCurrentProgramDay(state);
  const plannedDayIndex = cp.dayIndex;
  const todayDayIndex = programDay ? programDay.dayIndex : plannedDayIndex;

  return {
    programId: prog.id,
    programName: prog.name,
    source: cp.source,
    weekNumber: programDay?.weekNumber ?? null,
    plannedDayIndex,
    todayDayIndex,
    days: liftingDays.map(({ day, index }) => {
      const planName = `${prog.name} — ${day.label}`;
      return {
        index,
        label: day.label,
        exercises: day.exercises,
        exerciseCount: day.exercises.length,
        estMinutes: estimateWorkoutMinutes(day.exercises),
        isPlanned: index === plannedDayIndex,
        isToday: index === todayDayIndex,
        completedSession: findMostRecentSessionForPlan(state.workoutSessions, planName),
      };
    }),
  };
}

// Built-in programs are authored as FAMILIES (see programFamilies.js) — the same identity
// (e.g. "Titan", "Athena") expanded into several same-name flat programs, one per supported
// weekly frequency (2-6 days). Browsing "All Programs" one variant at a time would show "Athena"
// as five separate near-duplicate tiles, which is exactly the "hundreds of days dumped on one
// screen" clutter the task explicitly warns against. So exactly one representative variant is
// kept per family — its 3-day version when the family offers one (that's the frequency these
// families are authored with the clearest day-by-day identity, e.g. Athena's "Day 1 — Lower /
// Glutes"), otherwise whichever variant is encountered first. Programs without a familyId
// (fixed-day built-ins, all custom programs) are never deduped — every one of them is kept.
function pickFamilyRepresentatives(programs) {
  const standalone = [];
  const byFamily = new Map();
  (programs || []).forEach((prog) => {
    if (!prog.familyId) {
      standalone.push(prog);
      return;
    }
    const existing = byFamily.get(prog.familyId);
    if (!existing || (prog.trainingDays === 3 && existing.trainingDays !== 3)) {
      byFamily.set(prog.familyId, prog);
    }
  });
  return [...standalone, ...byFamily.values()];
}

// Every selectable workout day across ALL built-in + user-created multi-day programs, plus
// BRK's built-in single-day templates (Push/Pull/Legs/Upper/Lower), flattened for the "All
// Programs" browse/search/filter view. groupId/groupName let the UI cluster rows by their
// parent program without needing to re-derive that itself.
export function allProgramWorkouts(state) {
  const rows = [];
  const addProgramList = (list, source) => {
    (list || []).forEach((prog) => {
      if (!Array.isArray(prog.days)) return;
      prog.days.forEach((day, index) => {
        if (isRecoveryProgramDay(day)) return; // browse/swap lists are lifting workouts only
        rows.push({
          sourceType: "program",
          programId: prog.id,
          source,
          dayIndex: index,
          groupId: prog.familyId || prog.id,
          groupName: prog.name,
          programName: prog.name,
          dayLabel: day.label,
          exercises: day.exercises,
          exerciseCount: day.exercises.length,
          estMinutes: estimateWorkoutMinutes(day.exercises),
          isCustomProgram: source === "custom",
        });
      });
    });
  };
  addProgramList(pickFamilyRepresentatives(state.programs), "builtin");
  addProgramList(state.customPrograms, "custom");
  (state.templates || []).forEach((tpl) => {
    rows.push({
      sourceType: "custom",
      planId: tpl.id,
      planSource: "builtin",
      groupId: "__templates__",
      groupName: "Single-Day Templates",
      programName: tpl.name,
      dayLabel: null,
      exercises: tpl.exercises,
      exerciseCount: tpl.exercises.length,
      estMinutes: estimateWorkoutMinutes(tpl.exercises),
      isCustomProgram: false,
    });
  });
  return rows;
}

// The user's own workouts: standalone saved plans (state.customPlans) plus every day of every
// user-created multi-day program (state.customPrograms) — kept as one flat list per the task's
// "My Workouts" grouping (distinct from "All Programs", which is BRK-provided content).
export function myWorkouts(state) {
  const plans = (state.customPlans || []).map((p) => ({
    sourceType: "custom",
    planId: p.id,
    planSource: "custom",
    groupId: null,
    groupName: null,
    programName: p.name,
    dayLabel: null,
    exercises: p.exercises,
    exerciseCount: p.exercises.length,
    estMinutes: estimateWorkoutMinutes(p.exercises),
  }));
  const programDays = [];
  (state.customPrograms || []).forEach((prog) => {
    (prog.days || []).forEach((day, index) => {
      if (isRecoveryProgramDay(day)) return;
      programDays.push({
        sourceType: "program",
        programId: prog.id,
        source: "custom",
        dayIndex: index,
        groupId: prog.id,
        groupName: prog.name,
        programName: prog.name,
        dayLabel: day.label,
        exercises: day.exercises,
        exerciseCount: day.exercises.length,
        estMinutes: estimateWorkoutMinutes(day.exercises),
      });
    });
  });
  return [...plans, ...programDays];
}

// Builds a fresh programDayOverride from a chosen workout row (from allProgramWorkouts,
// myWorkouts, or a current-program day out of programDaysOverview) — always snapshots the
// exercise list at selection time (see the task's "snapshot safety": a later edit to a plan, or
// a program being removed, must never retroactively change what a still-pending override shows
// or what history records once it's performed).
export function buildOverrideFromRow(row) {
  const base = { date: todayDateStr(), exercises: row.exercises, programName: row.programName, dayLabel: row.dayLabel ?? null };
  if (row.sourceType === "program") {
    return { ...base, sourceType: "program", programId: row.programId, source: row.source, dayIndex: row.dayIndex };
  }
  return { ...base, sourceType: "custom", planId: row.planId ?? null, planSource: row.planSource ?? "custom" };
}

// Whether a completed/pending override's actually-performed workout has already logged a
// session today — used for "outside program" overrides, whose completion is tracked by exact
// plan-name match (same rule every other "is this day done" check already uses) rather than by
// currentProgram's own lastCompletedAt (which must stay untouched for a workout that isn't part
// of the active program).
export function overrideCompletedTodaySession(state, ov) {
  if (!ov) return null;
  return findTodaysSessionForPlan(state.workoutSessions, overridePlanName(ov));
}

// Program-level adherence, split lifting vs. recovery — e.g. Berserker's "Strength Sessions 3/4,
// Recovery Sessions 2/3" (task section 31). Deliberately NOT the same thing as weeklySchedule.js's
// computeScheduleAdherence (that's calendar/weekday-based and independent of any one program) —
// this instead walks the active program's own day list once and asks, for each day's plan name,
// "was it completed within the trailing window" — since a program's days are a repeating
// sequence rather than pinned to specific weekdays, that is the honest reading of "this week" for
// this style of program. Recovery completions are read from state.recoverySessions, lifting from
// state.workoutSessions — the two counts are never combined into one number here, so the caller
// can show "Strength X/Y" and "Recovery X/Y" as the separate figures the task's example wants.
export function programWeekAdherence(state, windowDays = 7) {
  const active = activeProgramAndCP(state);
  if (!active) return null;
  const { prog } = active;
  const cutoffMs = Date.now() - windowDays * MS_PER_DAY;
  const lifting = { scheduled: 0, completed: 0 };
  const recovery = { scheduled: 0, completed: 0 };
  prog.days.forEach((day) => {
    const planName = `${prog.name} — ${day.label}`;
    const bucket = isRecoveryProgramDay(day) ? recovery : lifting;
    const sessions = isRecoveryProgramDay(day) ? state.recoverySessions : state.workoutSessions;
    bucket.scheduled += 1;
    const done = (sessions || []).some((s) => s.planName === planName && new Date(s.finishedAt).getTime() >= cutoffMs);
    if (done) bucket.completed += 1;
  });
  return {
    programName: prog.name,
    windowDays,
    lifting,
    recovery,
    totalScheduled: lifting.scheduled + recovery.scheduled,
    totalCompleted: lifting.completed + recovery.completed,
  };
}

// Program-total adherence — "PROGRAM 21/28 planned sessions completed" (Program Timeline task,
// section 7). Same session-matching rule as programWeekAdherence, just counted across the whole
// program run (cp.startDate onward) instead of a trailing window, and only meaningful when the
// program declares a fixed length (prog.weeks) — an open-ended custom program has no fixed
// denominator to complete against, so this returns totals of null in that case rather than a
// misleading fraction.
export function programTotalAdherence(state) {
  const active = activeProgramAndCP(state);
  if (!active) return null;
  const { cp, prog } = active;
  const startMs = cp.startDate ? new Date(cp.startDate).getTime() : Date.now();
  const totalWeeks = prog.weeks || null;
  const lifting = { scheduled: null, completed: 0 };
  const recovery = { scheduled: null, completed: 0 };
  let liftingPerCycle = 0;
  let recoveryPerCycle = 0;
  prog.days.forEach((day) => {
    const isRecovery = isRecoveryProgramDay(day);
    if (isRecovery) recoveryPerCycle += 1;
    else liftingPerCycle += 1;
    const planName = `${prog.name} — ${day.label}`;
    const bucket = isRecovery ? recovery : lifting;
    const sessions = isRecovery ? state.recoverySessions : state.workoutSessions;
    bucket.completed += (sessions || []).filter((s) => s.planName === planName && new Date(s.finishedAt).getTime() >= startMs).length;
  });
  if (totalWeeks) {
    lifting.scheduled = liftingPerCycle * totalWeeks;
    recovery.scheduled = recoveryPerCycle * totalWeeks;
    // A within-program day-swap can in principle complete the same day-label more than once in a
    // week — cap the displayed fraction at its own denominator so it never reads as "30 / 28".
    lifting.completed = Math.min(lifting.completed, lifting.scheduled);
    recovery.completed = Math.min(recovery.completed, recovery.scheduled);
  }
  const totalScheduled = totalWeeks ? lifting.scheduled + recovery.scheduled : null;
  const totalCompleted = lifting.completed + recovery.completed;
  return { programName: prog.name, totalWeeks, lifting, recovery, totalScheduled, totalCompleted: totalWeeks ? Math.min(totalCompleted, totalScheduled) : totalCompleted };
}

// ---------------- PROGRAM TIMELINE ----------------
// A read-only "program map," fully derived from data that already exists — never a new source of
// truth, never mutated, never able to overwrite a historical session (task: "Do not allow
// historical program structure to overwrite historical workout logs"). Weeks here are calendar
// weeks since cp.startDate — the exact same math resolveCurrentProgramDay's weekNumber already
// uses — so the timeline's "Week 3 of 10" always agrees with what Today/Train/program-detail
// already show, rather than inventing a second, competing notion of "week." Completion per
// day-slot is read directly from real session history (matched by exact plan name, the same
// convention used everywhere else in the app) within that calendar week's date range — so a day
// completed via an own-program swap still shows correctly wherever it actually happened, and an
// outside-program swap (programContext: null, see resolveTodayWorkout) never marks anything here
// complete, since it never wrote a session under one of this program's own plan names. Status is
// one of completed/current/swapped/missed/upcoming — "swapped" (backed by the additive
// programSwapLog, written only by SwapWorkoutSheet's commitRow) keeps a deliberately-rescheduled
// day from reading as neglect once its week concludes; see the per-day wasSwapped comment below.
export function resolveProgramTimeline(state) {
  const active = activeProgramAndCP(state);
  if (!active) return null;
  const { cp, prog } = active;
  const cycleLen = prog.days.length;
  if (cycleLen === 0) return null;

  const totalWeeks = prog.weeks || null;
  const startMs = cp.startDate ? new Date(cp.startDate).getTime() : Date.now();
  const elapsedWeeks = Math.floor(Math.max(0, Date.now() - startMs) / (MS_PER_DAY * 7)) + 1;
  const nowWeekNumber = totalWeeks ? Math.min(elapsedWeeks, totalWeeks) : elapsedWeeks;

  const liveDay = resolveCurrentProgramDay(state);
  const currentDayIndex = liveDay && !liveDay.isComplete ? liveDay.dayIndex : cp.dayIndex;
  const isProgramComplete = !!(liveDay && liveDay.isComplete);

  const weekCount = totalWeeks || nowWeekNumber;
  const weeks = [];
  for (let w = 1; w <= weekCount; w++) {
    const weekStartMs = startMs + (w - 1) * 7 * MS_PER_DAY;
    const weekEndMs = weekStartMs + 7 * MS_PER_DAY;
    const isCurrentWeek = w === nowWeekNumber && !isProgramComplete;
    const isPastWeek = w < nowWeekNumber || (isProgramComplete && w <= nowWeekNumber);
    const isDeloadWeek = !!prog.deloadWeeks?.includes(w);

    const days = prog.days.map((day, di) => {
      const isRecovery = isRecoveryProgramDay(day);
      const planName = `${prog.name} — ${day.label}`;
      const sessions = isRecovery ? state.recoverySessions : state.workoutSessions;
      const completedSession =
        (sessions || [])
          .filter((s) => s.planName === planName && new Date(s.finishedAt).getTime() >= weekStartMs && new Date(s.finishedAt).getTime() < weekEndMs)
          .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0] || null;

      // A deliberate swap (see programSwapLog, written only by SwapWorkoutSheet's commitRow)
      // displaced this exact day-slot within this exact week — so once its week concludes
      // without a completedSession, it should read as SWAPPED, not MISSED. Never claimed for the
      // still-open current week/day (that's "current," matching the live Today/Train "Swapped
      // for today" framing instead).
      const wasSwapped = (state.programSwapLog || []).some(
        (e) =>
          e.programId === prog.id &&
          e.source === cp.source &&
          e.dayIndex === di &&
          new Date(e.date).getTime() >= weekStartMs &&
          new Date(e.date).getTime() < weekEndMs
      );

      // "Missed" is only ever claimed for a week that's already concluded — a still-open current
      // week never gets told it "missed" something it may still get to (see the module comment).
      let status;
      if (completedSession) status = "completed";
      else if (isCurrentWeek && di === currentDayIndex) status = "current";
      else if (isPastWeek) status = wasSwapped ? "swapped" : "missed";
      else status = "upcoming";

      const routine = isRecovery ? recoveryRoutineById(day.routineId) : null;
      return {
        dayIndex: di,
        label: day.label,
        isRecovery,
        isDeload: isDeloadWeek,
        isSwapped: wasSwapped,
        exercises: isRecovery ? null : day.exercises,
        routineId: isRecovery ? day.routineId : null,
        routine,
        estMinutes: isRecovery ? estimateRoutineMinutes(routine) : estimateWorkoutMinutes(day.exercises),
        status,
        completedSession,
        planName,
      };
    });

    weeks.push({ weekNumber: w, isCurrentWeek, isPastWeek, isFutureWeek: w > nowWeekNumber, isDeloadWeek, days });
  }

  return {
    programId: prog.id,
    programName: prog.name,
    programFocus: prog.programFocus || null,
    source: cp.source,
    startDate: cp.startDate || null,
    projectedCompletionDate: totalWeeks ? new Date(startMs + totalWeeks * 7 * MS_PER_DAY).toISOString() : null,
    totalWeeks,
    currentWeekNumber: nowWeekNumber,
    currentDayIndex,
    totalDaysPerCycle: cycleLen,
    isComplete: isProgramComplete,
    weeks,
  };
}
