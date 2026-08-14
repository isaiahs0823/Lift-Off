// ---------------- COACH CONTEXT ----------------
// Assembles the concise, structured payload the coach service reasons over — never the raw
// state tree. Matches the shape from the spec's context-structure section: userGoal,
// secondaryGoals, currentProgram, todayWorkout, readiness, recentWeightTrend, recentWorkouts,
// recentPRs, adherence, cardio, coachMemory.

import { resolveGoalCurrentValue, goalHistory } from "./goalData.js";
import { goalProgressPct, daysRemaining, goalStatus, currentPaceFromHistory, requiredPace } from "./goalMath.js";
import { computeAdherence } from "./adherence.js";
import { rollingAverage, weeklyRateOfChange } from "./bodyweightMath.js";
import { computeReadinessScore, readinessBand } from "./readiness.js";
import { resolveCurrentProgramDay } from "./programSchedule.js";
import { detectCoachMemory } from "./coachMemory.js";
import { hasSchedule, getTodaySchedule, getMissedEntry, computeScheduleAdherence, repeatedScheduleMiss } from "./weeklySchedule.js";
import { resolveProfile } from "./athleteProfile.js";
import { retrieveRelevantMemories } from "./coachMemoryStore.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function summarizeGoal(goal, state) {
  if (!goal) return null;
  const withCurrent = { ...goal, currentValue: resolveGoalCurrentValue(goal, state) };
  const history = goalHistory(withCurrent, state);
  return {
    title: withCurrent.title,
    type: withCurrent.type,
    startValue: withCurrent.startValue,
    currentValue: withCurrent.currentValue,
    targetValue: withCurrent.targetValue,
    targetDate: withCurrent.targetDate,
    units: withCurrent.units,
    progressPct: goalProgressPct(withCurrent),
    daysRemaining: daysRemaining(withCurrent),
    status: goalStatus(withCurrent, history),
    currentPace: currentPaceFromHistory(history),
    requiredPace: requiredPace(withCurrent),
  };
}

// queryText (optional): the user's typed question, if any — used only to bias relevantMemories
// toward what's actually being asked about (section 32). Everything else in the context is
// query-independent so ambient uses (Today snapshot, weekly review) can omit it.
export function buildCoachContext(state, exMap = {}, queryText = null) {
  const goals = state.goals || [];
  const activeGoals = goals.filter((g) => g.status === "active");
  const primary = activeGoals.find((g) => g.priority === "primary") || null;
  const secondary = activeGoals.filter((g) => g.priority !== "primary");

  const programDay = resolveCurrentProgramDay(state);
  const currentProgram = state.currentProgram
    ? {
        programName: programDay?.programName || null,
        dayLabel: programDay?.dayLabel || null,
        isComplete: programDay?.isComplete || false,
        weekNumber: programDay?.weekNumber ?? null,
        totalWeeks: programDay?.totalWeeks ?? null,
      }
    : null;

  const todayWorkout =
    programDay && !programDay.isComplete
      ? {
          planName: programDay.plan.name,
          exercises: programDay.plan.exercises.map((e) => ({ name: exMap[e.exId]?.name || e.exId, sets: e.sets, reps: e.reps })),
        }
      : null;

  const todayReadinessEntry = (state.readinessLogs || []).find((r) => r.date.slice(0, 10) === todayStr());
  const readinessScore = todayReadinessEntry ? computeReadinessScore(todayReadinessEntry) : null;
  const readiness = todayReadinessEntry
    ? { loggedToday: true, score: readinessScore, band: readinessBand(readinessScore) }
    : { loggedToday: false };

  const recentWeightTrend = {
    current: rollingAverage(state.bodyweightLogs || [], "weight", 7),
    weeklyRate: weeklyRateOfChange(state.bodyweightLogs || [], "weight"),
  };

  const sortedSessions = [...(state.workoutSessions || [])].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  const recentWorkouts = sortedSessions.slice(0, 5).map((s) => ({
    planName: s.planName,
    date: s.finishedAt,
    workingSets: s.workingSets,
    totalVolume: s.totalVolume,
    prCount: (s.prs || []).length,
    rating: s.rating,
  }));
  const recentPRs = sortedSessions
    .slice(0, 10)
    .flatMap((s) => (s.prs || []).map((p) => ({ ...p, exName: exMap[p.exId]?.name || p.exId, date: s.finishedAt })));

  const daysSinceLastSession = sortedSessions.length > 0 ? Math.round((Date.now() - new Date(sortedSessions[0].finishedAt).getTime()) / MS_PER_DAY) : null;

  const adherence = computeAdherence(state, 7);

  const cardioGoal = activeGoals.find((g) => g.type === "cardio_frequency");
  const cardio = {
    last7Days: (state.cardioLogs || []).filter((c) => new Date(c.date).getTime() >= Date.now() - 7 * MS_PER_DAY).length,
    target: cardioGoal ? cardioGoal.targetValue : null,
  };

  const schedule = hasSchedule(state)
    ? {
        today: getTodaySchedule(state),
        missed: getMissedEntry(state),
        weeklyAdherence: computeScheduleAdherence(state, 7),
        repeatedMiss: repeatedScheduleMiss(state, 30),
      }
    : null;

  const athleteProfile = resolveProfile(state);
  const memories = state.coachMemories || [];

  return {
    userGoal: summarizeGoal(primary, state),
    secondaryGoals: secondary.map((g) => summarizeGoal(g, state)),
    currentProgram,
    todayWorkout,
    readiness,
    recentWeightTrend,
    recentWorkouts,
    recentPRs,
    daysSinceLastSession,
    adherence,
    cardio,
    coachMemory: detectCoachMemory(state),
    schedule,
    athleteProfile,
    coachPreferences: { style: athleteProfile.coachingStyle, length: athleteProfile.responseLength },
    activeCommitments: (state.commitments || []).filter((c) => c.status === "active"),
    behavioralPatterns: memories.filter((m) => (m.category === "behavioralPatterns" || m.category === "trainingInsights") && m.status !== "outdated"),
    relevantMemories: retrieveRelevantMemories(memories, queryText, { limit: 3 }),
  };
}
