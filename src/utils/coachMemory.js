// ---------------- COACH MEMORY ----------------
// Factual pattern detection from actually-logged behavior only — nothing here is invented or
// inferred beyond what the data directly shows. Each detector requires a minimum sample size
// before it's willing to claim a pattern exists, and returns nothing rather than guess when
// the data's too thin.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);
}
function isWarmup(s) {
  return s.setType === "warmup";
}

// The spec's flagship example: does conditioning work consistently disappear right after a
// heavy lower-body session? Only claims the pattern once there are at least 3 leg sessions to
// judge from, and only when it holds for a clear majority of them.
function legDayConditioningSkip(state) {
  const legSessions = (state.workoutSessions || []).filter((s) => (s.mainMuscles || []).includes("Legs"));
  if (legSessions.length < 3) return null;
  const cardioDates = (state.cardioLogs || []).map((c) => c.date);
  let skipped = 0;
  legSessions.forEach((s) => {
    const hasFollowupCardio = cardioDates.some((cd) => {
      const gap = daysBetween(s.finishedAt, cd);
      return gap >= 0 && gap <= 2;
    });
    if (!hasFollowupCardio) skipped++;
  });
  const ratio = skipped / legSessions.length;
  if (ratio < 0.7) return null;
  return {
    key: "leg_day_conditioning_skip",
    text: `Conditioning has been missing after leg day in ${skipped} of your last ${legSessions.length} leg sessions.`,
  };
}

// Exercises where the last 3 sessions are all at the same top-set weight with target reps
// missed every time — a real plateau, not just one rough day.
function stallingExercises(state) {
  const byEx = {};
  (state.logs || []).forEach((l) => {
    (byEx[l.exId] ||= []).push(l);
  });
  const stalled = [];
  Object.entries(byEx).forEach(([exId, logs]) => {
    const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    if (sorted.length < 3) return;
    const topWeights = sorted.map((l) => {
      const counted = l.sets.filter((s) => !isWarmup(s));
      return (counted.length ? counted : l.sets)[0];
    });
    const sameWeight = topWeights.every((s) => s.weight === topWeights[0].weight);
    const allMissed = sorted.every((l, i) => {
      const counted = l.sets.filter((s) => !isWarmup(s));
      return !(counted.length ? counted : l.sets).every((s) => s.reps >= l.targetReps);
    });
    if (sameWeight && allMissed) stalled.push({ exId, weight: topWeights[0].weight });
  });
  return stalled;
}

// Weekly rate of change near zero for two consecutive trailing weeks — a real plateau, not
// this week's noise.
function bodyweightPlateau(state) {
  const entries = state.bodyweightLogs || [];
  const weekAgo = new Date(Date.now() - 7 * MS_PER_DAY);
  const avgWindow = (days, asOf) => {
    const end = asOf.getTime();
    const start = end - days * MS_PER_DAY;
    const w = entries.filter((e) => e.weight != null && new Date(e.date).getTime() >= start && new Date(e.date).getTime() <= end);
    if (!w.length) return null;
    return w.reduce((s, e) => s + e.weight, 0) / w.length;
  };
  const now = new Date();
  const thisWeekRate = (avgWindow(7, now) ?? null) - (avgWindow(7, weekAgo) ?? null);
  const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * MS_PER_DAY);
  const lastWeekRate = (avgWindow(7, weekAgo) ?? null) - (avgWindow(7, twoWeeksAgo) ?? null);
  if (Number.isNaN(thisWeekRate) || Number.isNaN(lastWeekRate)) return null;
  if (Math.abs(thisWeekRate) < 0.25 && Math.abs(lastWeekRate) < 0.25) {
    return { key: "bodyweight_plateau", text: "Bodyweight has been flat for two straight weeks." };
  }
  return null;
}

// Soreness rated 4-5 in a clear majority of the last 7 check-ins.
function recurringSoreness(state) {
  const recent = (state.readinessLogs || [])
    .filter((r) => new Date(r.date).getTime() >= Date.now() - 7 * MS_PER_DAY)
    .filter((r) => r.soreness != null);
  if (recent.length < 4) return null;
  const soreCount = recent.filter((r) => r.soreness >= 4).length;
  if (soreCount / recent.length < 0.6) return null;
  return { key: "recurring_soreness", text: `Soreness has been rated high in ${soreCount} of your last ${recent.length} check-ins.` };
}

// Returns a small list of { key, text } facts — never more than a handful, never speculative.
export function detectCoachMemory(state) {
  const memory = [];
  const legSkip = legDayConditioningSkip(state);
  if (legSkip) memory.push(legSkip);
  const plateau = bodyweightPlateau(state);
  if (plateau) memory.push(plateau);
  const soreness = recurringSoreness(state);
  if (soreness) memory.push(soreness);
  const stalled = stallingExercises(state);
  if (stalled.length > 0) {
    memory.push({
      key: "stalling_exercises",
      text: `${stalled.length} exercise${stalled.length > 1 ? "s have" : " has"} missed target reps at the same weight for 3 sessions straight.`,
      exIds: stalled.map((s) => s.exId),
    });
  }
  return memory;
}
