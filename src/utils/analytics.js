// ---------------- PERFORMANCE ANALYTICS ----------------
// Per-exercise and overall training analytics. Self-contained (doesn't import the PR-
// celebration logic from App.jsx) since this is a historical/backward-looking view rather
// than a live "did this set just break a record" check — the two ask related but different
// questions, and this file only needs read access to logs/sessions, not the save-time flow.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isWarmup(s) {
  return s.setType === "warmup";
}
function countedSets(sets) {
  return sets.filter((s) => !isWarmup(s));
}
function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}
function entryVolume(entry) {
  return countedSets(entry.sets).reduce((sum, s) => sum + s.weight * s.reps + (s.drops || []).reduce((d, dr) => d + dr.weight * dr.reps, 0), 0);
}

// ---------- Per-exercise ----------
export function computeExerciseAnalytics(exId, logs) {
  const exLogs = logs.filter((l) => l.exId === exId).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (exLogs.length === 0) return null;

  let bestSet = null;
  let bestE1RM = 0;
  const rirValues = [];
  const prHistory = [];
  let runningMaxWeight = 0;
  let runningMaxE1RM = 0;

  exLogs.forEach((l) => {
    const counted = countedSets(l.sets);
    counted.forEach((s) => {
      if (!bestSet || s.weight > bestSet.weight) bestSet = { weight: s.weight, reps: s.reps, date: l.date };
      const e1rm = estimateOneRM(s.weight, s.reps);
      if (e1rm > bestE1RM) bestE1RM = e1rm;
      if (s.rir != null) rirValues.push(s.rir);
      else if (s.rpe != null) rirValues.push(10 - s.rpe);
    });
    const sessionMaxWeight = Math.max(0, ...counted.map((s) => s.weight));
    const sessionMaxE1RM = Math.max(0, ...counted.map((s) => estimateOneRM(s.weight, s.reps)));
    if (sessionMaxWeight > runningMaxWeight && runningMaxWeight > 0) prHistory.push({ date: l.date, type: "weight", value: sessionMaxWeight });
    if (sessionMaxE1RM > runningMaxE1RM && runningMaxE1RM > 0) prHistory.push({ date: l.date, type: "e1rm", value: Math.round(sessionMaxE1RM) });
    runningMaxWeight = Math.max(runningMaxWeight, sessionMaxWeight);
    runningMaxE1RM = Math.max(runningMaxE1RM, sessionMaxE1RM);
  });

  // Volume trend: last 3 logged sessions vs. the 3 before that, by total counted volume.
  const volumes = exLogs.map(entryVolume);
  const recentAvg = volumes.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, volumes.length);
  const priorSlice = volumes.slice(-6, -3);
  const priorAvg = priorSlice.length ? priorSlice.reduce((a, b) => a + b, 0) / priorSlice.length : null;
  let volumeTrend = "insufficient_data";
  if (priorAvg != null) {
    if (recentAvg > priorAvg * 1.05) volumeTrend = "up";
    else if (recentAvg < priorAvg * 0.95) volumeTrend = "down";
    else volumeTrend = "flat";
  }

  const last = exLogs[exLogs.length - 1];
  const lastCounted = countedSets(last.sets);
  const recentWorkingWeight = lastCounted.length ? lastCounted[0].weight : null;

  const now = Date.now();
  const frequencyPerWeek = exLogs.filter((l) => now - new Date(l.date).getTime() <= 28 * MS_PER_DAY).length / 4;

  return {
    exId,
    bestSet,
    estimatedOneRM: Math.round(bestE1RM),
    volumeTrend,
    recentWorkingWeight,
    avgRir: rirValues.length ? Math.round((rirValues.reduce((a, b) => a + b, 0) / rirValues.length) * 10) / 10 : null,
    frequencyPerWeek: Math.round(frequencyPerWeek * 10) / 10,
    lastTrained: last.date,
    totalSessions: exLogs.length,
    prHistory: prHistory.slice(-10).reverse(),
  };
}

// ---------- Overall ----------
// Classifies each trained exercise's trend the same way computeExerciseAnalytics does for
// volume, but off estimated 1RM specifically (a cleaner "getting stronger" signal than
// volume, which can rise just from doing more sets at the same weight).
function exerciseE1RMTrend(exId, logs) {
  const exLogs = logs.filter((l) => l.exId === exId).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (exLogs.length < 4) return null;
  const bestE1RMFor = (l) => {
    const counted = countedSets(l.sets);
    return counted.length ? Math.max(...counted.map((s) => estimateOneRM(s.weight, s.reps))) : 0;
  };
  const values = exLogs.map(bestE1RMFor);
  const recentAvg = values.slice(-2).reduce((a, b) => a + b, 0) / 2;
  const priorAvg = values.slice(-4, -2).reduce((a, b) => a + b, 0) / 2;
  if (priorAvg === 0) return null;
  const pctChange = ((recentAvg - priorAvg) / priorAvg) * 100;
  return { exId, pctChange: Math.round(pctChange * 10) / 10 };
}

export function computeOverallAnalytics(state, exMap = {}) {
  const logs = state.logs || [];
  const exIds = [...new Set(logs.map((l) => l.exId))];

  const trends = exIds.map((id) => exerciseE1RMTrend(id, logs)).filter(Boolean);
  const improving = trends
    .filter((t) => t.pctChange > 3)
    .sort((a, b) => b.pctChange - a.pctChange)
    .slice(0, 5)
    .map((t) => ({ ...t, name: exMap[t.exId]?.name || t.exId }));
  const declining = trends
    .filter((t) => t.pctChange < -3)
    .sort((a, b) => a.pctChange - b.pctChange)
    .slice(0, 5)
    .map((t) => ({ ...t, name: exMap[t.exId]?.name || t.exId }));

  // "Stalled": exercise trained recently that missed target reps in each of its last 3
  // sessions at the same top weight — same definition coachMemory uses for stalling, kept
  // here too so the analytics view and the coach never disagree with each other.
  const stalled = exIds
    .filter((exId) => {
      const exLogs = logs.filter((l) => l.exId === exId).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
      if (exLogs.length < 3) return false;
      const topWeights = exLogs.map((l) => (countedSets(l.sets)[0] || l.sets[0]));
      const sameWeight = topWeights.every((s) => s && s.weight === topWeights[0].weight);
      const allMissed = exLogs.every((l) => !(countedSets(l.sets).length ? countedSets(l.sets) : l.sets).every((s) => s.reps >= l.targetReps));
      return sameWeight && allMissed;
    })
    .map((exId) => ({ exId, name: exMap[exId]?.name || exId }));

  const muscleFrequency = {};
  logs.forEach((l) => {
    const muscle = exMap[l.exId]?.muscle;
    if (muscle) muscleFrequency[muscle] = (muscleFrequency[muscle] || 0) + 1;
  });

  const sessions = state.workoutSessions || [];
  const now = Date.now();
  const last4Weeks = [0, 1, 2, 3].map((weeksAgo) => {
    const end = now - weeksAgo * 7 * MS_PER_DAY;
    const start = end - 7 * MS_PER_DAY;
    const weekSessions = sessions.filter((s) => {
      const t = new Date(s.finishedAt).getTime();
      return t > start && t <= end;
    });
    return {
      weekLabel: weeksAgo === 0 ? "This week" : `${weeksAgo}w ago`,
      volume: weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
      sessions: weekSessions.length,
    };
  });
  const avgDurationSec = sessions.length ? sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0) / sessions.length : null;

  return {
    improving,
    declining,
    stalled,
    muscleFrequency: Object.entries(muscleFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([muscle, count]) => ({ muscle, count })),
    weeklyVolume: last4Weeks.reverse(),
    avgDurationMin: avgDurationSec != null ? Math.round(avgDurationSec / 60) : null,
  };
}
