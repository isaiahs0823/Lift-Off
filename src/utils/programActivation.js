// ---------------- PROGRAM ACTIVATION ----------------
// Pure state-patch logic behind "Start This Program" (UX audit Phase 1, item 1) and "End Current
// Program" (active-program-management fix) — split out of App.jsx's activateProgram/
// endCurrentProgram so both are unit-testable without rendering the app. The UI-only pieces (the
// window.confirm prompt, the Today success banner, navigating tabs) stay in App.jsx; this file
// only ever answers "what does state look like after this happens," which is the part a
// regression test actually needs to pin down.
import { resolveCurrentProgramDay } from "./programSchedule.js";
import { clearCurrentProgramSlots } from "./weeklySchedule.js";

// Whether activating `program` would replace a DIFFERENT program as the active one — the signal
// App.jsx uses to decide whether to show the "this replaces X" confirmation at all. Activating the
// same program that's already active (e.g. re-tapping Start on it) is never a replacement.
export function isReplacingActiveProgram(state, program, source) {
  const prevCP = state.currentProgram;
  return !!(prevCP && (prevCP.programId !== program.id || prevCP.source !== source));
}

// Returns the new state after activating `program` as the athlete's current program. Always
// starts at day 0 (task: "navigate to Today... show the appropriate upcoming workout" — the first
// day is the only unambiguous "upcoming" for a program that wasn't already running). Deliberately
// touches ONLY currentProgram/programDayOverride/pendingFrequencyReview/hasSeenOnboarding — never
// customPrograms, workoutSessions, logs, weeklySchedule, or any other collection, so activating a
// program can never be the thing that loses or rewrites existing data (task: "protect existing
// user data"). Never sets activeRun — activating a program must not start a workout logging
// session (task's explicit "Important" callout).
export function applyProgramActivation(prevState, program, source) {
  return {
    ...prevState,
    currentProgram: {
      programId: program.id,
      programName: program.name,
      source,
      dayIndex: 0,
      totalDays: program.days.length,
      startDate: new Date().toISOString(),
      lastCompletedAt: null,
      lastCompletedDayIndex: null,
      selectedForDays: prevState.athleteProfile?.preferredDays ?? null,
    },
    // A swap-workout override belonging to whatever program was active before is meaningless once
    // a different program takes over — never left to silently reappear, see activeOverrideFor's
    // own programId/source match requirement in programSchedule.js (this clears it proactively
    // rather than relying on that check alone).
    programDayOverride: null,
    pendingFrequencyReview: null,
    hasSeenOnboarding: true,
  };
}

// Returns the new state after ending the active program WITHOUT marking it completed (active-
// program-management fix, items 2/3/5/9). A no-op (returns prevState unchanged) when nothing is
// active. Records a completedPrograms entry tagged status:"ended_early" — never "completed", so
// the program's identity, actual start date, and however many weeks it ran for stay on the
// record as real history (item 3), distinguishable at a glance from a program that ran its full
// assigned length. Touches ONLY currentProgram/programDayOverride/pendingFrequencyReview/
// weeklySchedule/completedPrograms — never workoutSessions, logs, customPrograms, or any other
// collection (item 9), so every session already logged against this program stays exactly as
// it is. weeklySchedule only has its `{kind:"currentProgram"}` slots touched (converted to rest
// via clearCurrentProgramSlots, since they'd otherwise keep being silently marked "missed" with no
// active program to resolve against — item 5); every other slot, and the schedule's mode, is
// left alone.
export function applyProgramEnd(prevState) {
  const cp = prevState.currentProgram;
  if (!cp) return prevState;
  const resolved = resolveCurrentProgramDay(prevState);
  const programName = resolved?.programName || cp.programName;
  const entry = {
    id: `completed_${Date.now()}`,
    programId: cp.programId,
    programSource: cp.source,
    programName,
    weeks: resolved?.totalWeeks ?? null,
    startDate: cp.startDate,
    endDate: new Date().toISOString(),
    status: "ended_early",
  };
  return {
    ...prevState,
    currentProgram: null,
    programDayOverride: null,
    pendingFrequencyReview: null,
    weeklySchedule: clearCurrentProgramSlots(prevState.weeklySchedule),
    completedPrograms: [entry, ...(prevState.completedPrograms || [])],
  };
}
