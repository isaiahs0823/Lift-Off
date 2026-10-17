// ---------------- PROGRAM ACTIVATION ----------------
// Pure state-patch logic behind "Start This Program" (UX audit Phase 1, item 1) and "End Current
// Program" (active-program-management fix) — split out of App.jsx's activateProgram/
// endCurrentProgram so both are unit-testable without rendering the app. The UI-only pieces (the
// window.confirm prompt, the Today success banner, navigating tabs) stay in App.jsx; this file
// only ever answers "what does state look like after this happens," which is the part a
// regression test actually needs to pin down.
import { resolveCurrentProgramDay } from "./programSchedule.js";
import { clearCurrentProgramSlots } from "./weeklySchedule.js";
import { renameProgram, forkProgramForEditing } from "./programBuilder.js";

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

// Renames the ACTIVE program in place, from wherever it's currently displayed (Program Timeline).
// A no-op (returns prevState unchanged) when nothing is active or the trimmed name is empty/
// unchanged.
//
// For an already-custom active program this is identical to the existing custom-program-detail
// rename (renameProgram only ever touches `.name` — id, days, exercises, history all untouched;
// `currentProgram.programName` is updated too since we're already producing a new object here, but
// nothing actually depends on it being fresh — every display still resolves the name live via
// activeProgramAndCP, same as before).
//
// For an active BUILT-IN program there is no field to rename — HERO_PROGRAMS/family templates are
// static source data, not user state. "Renaming" one therefore means forking a personal copy
// (forkProgramForEditing) the same way "Customize program" already does elsewhere — but unlike
// that flow, this one also reassigns currentProgram to the fork's id, carrying over dayIndex/
// totalDays/startDate/lastCompletedAt/lastCompletedDayIndex/selectedForDays byte-for-byte. This is
// deliberately NOT the same thing as switching programs (applyProgramActivation): a switch always
// restarts at day 0 because it's a genuinely different program; a rename is the same run, same
// progress, just a new name, so nothing about where the athlete actually is should move. No
// completedPrograms entry is written either — nothing has ended.
//
// Either branch leaves workoutSessions/logs/customExercises/weeklySchedule/completedPrograms
// completely untouched, and session-completion matching (programSchedule.js's
// sessionCompletesDay) keys off sourceProgramId+sourceDayLabel rather than the display name, so a
// rename can never zero out "sessions completed" or a day's checkmark for history logged under the
// old name.
export function applyActiveProgramRename(prevState, newName) {
  const cp = prevState.currentProgram;
  if (!cp) return prevState;
  const trimmed = (newName || "").trim();
  if (!trimmed) return prevState;

  if (cp.source === "custom") {
    const existing = (prevState.customPrograms || []).find((p) => p.id === cp.programId);
    if (!existing || existing.name === trimmed) return prevState;
    return {
      ...prevState,
      customPrograms: prevState.customPrograms.map((p) => (p.id === cp.programId ? renameProgram(p, trimmed) : p)),
      currentProgram: { ...cp, programName: trimmed },
    };
  }

  const template = (prevState.programs || []).find((p) => p.id === cp.programId);
  if (!template || template.name === trimmed) return prevState;
  const fork = renameProgram(forkProgramForEditing(template), trimmed);
  return {
    ...prevState,
    customPrograms: [...(prevState.customPrograms || []), fork],
    currentProgram: { ...cp, programId: fork.id, programName: trimmed, source: "custom" },
  };
}
