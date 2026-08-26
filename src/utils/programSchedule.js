// ---------------- PROGRAM SCHEDULE ----------------
// Resolves state.currentProgram into the actual program/day data, or null if the program was
// deleted (custom program removed) or none is active. Pure function of state — no React,
// hence its own file rather than living in App.jsx (also used by the coach context engine).

import { findMostRecentSessionForPlan } from "./workoutHistory.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  if (ov.programId !== cp.programId || ov.source !== cp.source) return null;
  if (ov.date !== todayDateStr()) return null;
  return ov;
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
  return {
    isComplete: false,
    completedToday,
    nextDayLabel,
    programName: prog.name,
    dayLabel: day.label,
    dayIndex: effectiveDayIndex,
    totalDays: prog.days.length,
    weekNumber,
    totalWeeks,
    plan: { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
    programContext,
    isSwapped,
    plannedDayIndex: cp.dayIndex,
    plannedDayLabel: isSwapped ? prog.days[cp.dayIndex]?.label ?? null : null,
  };
}

// Everything the swap-workout selector needs to render every day of the currently active
// program: exercise count/estimated length, completion status (by exact plan-name match — the
// same rule the program detail screen's "Completed" row already uses), and which day is
// "planned" (the normal next-up pointer) vs "today" (planned, or an active override) right now.
// Returns null when there's no active program, or it only has one day (nothing meaningful to
// swap between).
export function programDaysOverview(state) {
  const active = activeProgramAndCP(state);
  if (!active) return null;
  const { cp, prog } = active;
  if (prog.days.length < 2) return null;

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
    days: prog.days.map((day, index) => {
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
