// ---------------- COMPACT ATHLETE CONTEXT FOR CHAT ----------------
// Wraps the existing buildCoachContext() (coachContext.js) — reuses every calculation it
// already does rather than re-deriving any of it — and trims the result down to what's cheap
// enough to send with every single chat turn. The heavier arrays it already computes
// (recentWorkouts, recentPRs, muscleVolume/trend, full schedule) are deliberately left out
// here since they're available on demand via tools (getRecentWorkouts, getRecentPRs,
// getMuscleVolume) — sending them unconditionally on every turn is exactly the "dump every
// piece of app state into every request" spec section 8 warns against.
import { buildCoachContext } from "./coachContext.js";

export function buildCompactCoachContext(state, exMap, queryText) {
  const full = buildCoachContext(state, exMap, queryText);
  return {
    goal: full.userGoal ? { title: full.userGoal.title, status: full.userGoal.status, progressPct: full.userGoal.progressPct } : null,
    currentProgram: full.currentProgram,
    todayWorkout: full.todayWorkout ? { planName: full.todayWorkout.planName, exerciseCount: full.todayWorkout.exercises?.length ?? null } : null,
    readinessToday: full.readiness,
    daysSinceLastSession: full.daysSinceLastSession,
    weeklyAdherencePct: full.adherence?.overall ?? null,
    athleteProfile: {
      experience: full.athleteProfile?.experience,
      physiquePhase: full.athleteProfile?.physiquePhase,
      physiquePriorities: full.athleteProfile?.physiquePriorities,
      constraints: full.athleteProfile?.constraints,
      motivation: full.athleteProfile?.motivation,
      coachSpecialty: full.athleteProfile?.coachSpecialty,
    },
    activeCommitmentsCount: (full.activeCommitments || []).length,
    relevantMemories: (full.relevantMemories || []).map((m) => ({ text: m.text, source: m.source, confidence: m.confidence })),
    scheduleToday: full.schedule ? { type: full.schedule.today?.type ?? null, hasMissedDay: !!full.schedule.missed } : null,
  };
}
