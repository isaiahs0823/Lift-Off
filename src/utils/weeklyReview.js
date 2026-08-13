// ---------------- WEEKLY REVIEW DATA ----------------
// Structured facts for a 7-day review — sessions completed/missed, average readiness,
// bodyweight trend, strength trend, PRs, conditioning, goal progress, and the single
// weakest adherence category. Plain numbers only, no generated commentary: turning this
// into an actual "coach" voice is Phase 4's job (src/services/coachService, not built yet).
// Keeping that boundary means this data is trivially testable and reusable by whatever
// eventually generates the narrative.

import { weeklyRateOfChange } from "./bodyweightMath.js";
import { computeAdherence } from "./adherence.js";
import { computeReadinessScore } from "./readiness.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function inWindow(dateStr, days) {
  return new Date(dateStr).getTime() >= Date.now() - days * MS_PER_DAY;
}
function isWarmup(s) {
  return s.setType === "warmup";
}
function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}
function bestE1RM(logs) {
  const sets = logs.flatMap((l) => l.sets.filter((s) => !isWarmup(s)));
  if (!sets.length) return null;
  return Math.max(...sets.map((s) => estimateOneRM(s.weight, s.reps)));
}

// "improving" | "stable" | "declining" | "insufficient_data" — compares each exercise's best
// estimated 1RM this week against the week before, for exercises trained in both windows.
// A >1% gain counts as improved, a >2% drop as declined (small dead zone so measurement
// noise around the same working weight doesn't read as a trend either direction).
function computeStrengthTrend(logs, days) {
  const now = Date.now();
  const thisWeek = logs.filter((l) => new Date(l.date).getTime() >= now - days * MS_PER_DAY);
  const priorWeek = logs.filter((l) => {
    const t = new Date(l.date).getTime();
    return t < now - days * MS_PER_DAY && t >= now - 2 * days * MS_PER_DAY;
  });
  const exIds = [...new Set(thisWeek.map((l) => l.exId))].filter((id) => priorWeek.some((l) => l.exId === id));
  if (exIds.length === 0) return "insufficient_data";

  let improved = 0;
  let declined = 0;
  exIds.forEach((id) => {
    const cur = bestE1RM(thisWeek.filter((l) => l.exId === id));
    const prev = bestE1RM(priorWeek.filter((l) => l.exId === id));
    if (cur == null || prev == null) return;
    if (cur > prev * 1.01) improved++;
    else if (cur < prev * 0.98) declined++;
  });
  if (improved === 0 && declined === 0) return "stable";
  return improved > declined ? "improving" : declined > improved ? "declining" : "stable";
}

export function computeWeeklyReview(state, days = 7) {
  const sessions = (state.workoutSessions || []).filter((s) => inWindow(s.finishedAt, days));
  const sessionsCompleted = sessions.length;

  const consistencyGoal = (state.goals || []).find((g) => g.type === "consistency" && g.status === "active");
  const plannedSessions = consistencyGoal ? Math.round((consistencyGoal.targetValue * days) / 7) : null;
  const sessionsMissed = plannedSessions != null ? Math.max(0, plannedSessions - sessionsCompleted) : null;

  const readinessScores = (state.readinessLogs || [])
    .filter((r) => inWindow(r.date, days))
    .map((r) => computeReadinessScore(r))
    .filter((v) => v != null);
  const avgReadiness = readinessScores.length ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length) : null;

  const weightTrend = weeklyRateOfChange(state.bodyweightLogs || [], "weight");
  const strengthTrend = computeStrengthTrend(state.logs || [], days);
  const prCount = sessions.reduce((sum, s) => sum + (s.prs?.length || 0), 0);

  const cardioGoal = (state.goals || []).find((g) => g.type === "cardio_frequency" && g.status === "active");
  const cardioCompleted = new Set((state.cardioLogs || []).filter((c) => inWindow(c.date, days)).map((c) => c.date.slice(0, 10))).size;
  const cardioTarget = cardioGoal ? Math.round((cardioGoal.targetValue * days) / 7) : null;

  const adherence = computeAdherence(state, days);
  const activeGoals = (state.goals || []).filter((g) => g.status === "active").map((g) => ({ id: g.id, title: g.title }));

  // Best PR of the week by raw magnitude of improvement — a simple, explainable tiebreaker,
  // not a claim that one PR type matters more than another in general.
  const allPRs = sessions.flatMap((s) => (s.prs || []).map((p) => ({ ...p, planName: s.planName })));
  const biggestWin =
    allPRs.length > 0
      ? allPRs.reduce((best, p) => {
          const mag = (p.value ?? p.weight ?? 0) - (p.prev ?? 0);
          const bestMag = (best.value ?? best.weight ?? 0) - (best.prev ?? 0);
          return mag > bestMag ? p : best;
        }, allPRs[0])
      : null;

  const categories = [
    { key: "strength", label: "Strength", pct: adherence.strengthPct },
    ...(adherence.cardioPct != null ? [{ key: "cardio", label: "Conditioning", pct: adherence.cardioPct }] : []),
    { key: "checkins", label: "Check-ins", pct: adherence.checkinPct },
  ];
  const weakestArea = categories.reduce((worst, c) => (c.pct < worst.pct ? c : worst), categories[0]);

  return {
    sessionsCompleted,
    plannedSessions,
    sessionsMissed,
    avgReadiness,
    weightTrend,
    strengthTrend,
    prCount,
    cardioCompleted,
    cardioTarget,
    adherence,
    activeGoals,
    biggestWin,
    weakestArea,
  };
}
