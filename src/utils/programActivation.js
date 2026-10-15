// ---------------- PROGRAM ACTIVATION ----------------
// Pure state-patch logic behind "Start This Program" (UX audit Phase 1, item 1) — split out of
// App.jsx's activateProgram so it's unit-testable without rendering the app. The UI-only pieces
// (the window.confirm prompt, the Today success banner, navigating tabs) stay in App.jsx; this
// file only ever answers "what does state look like after this program is activated," which is
// the part a regression test actually needs to pin down.

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
