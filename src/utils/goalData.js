// ---------------- GOAL <-> APP STATE BRIDGE ----------------
// Where a goal's live currentValue and history actually come from. Kept separate from
// goalMath.js (pure number-crunching, no knowledge of the app's data shape) so that file
// stays trivially testable and this one is the only place that knows what a "log" or a
// "bodyweight entry" looks like.

function isWarmupSet(s) {
  return s.setType === "warmup";
}
function countedSets(sets) {
  return sets.filter((s) => !isWarmupSet(s));
}
function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}

// For weight/bodyfat goals: latest logged value (falls back to the goal's own stored
// currentValue if nothing's been logged yet). For a "lift" goal linked to an exercise: best
// heaviest-weight or best estimated-1RM ever logged for it, non-warm-up sets only.
export function resolveGoalCurrentValue(goal, state) {
  if (goal.type === "weight" || goal.type === "bodyfat") {
    const field = goal.type === "weight" ? "weight" : "bodyFat";
    const entries = (state.bodyweightLogs || []).filter((e) => e[field] != null).sort((a, b) => new Date(a.date) - new Date(b.date));
    return entries.length ? entries[entries.length - 1][field] : goal.currentValue;
  }
  if (goal.type === "lift" && goal.linkedExId) {
    const logs = (state.logs || []).filter((l) => l.exId === goal.linkedExId);
    const sets = logs.flatMap((l) => countedSets(l.sets));
    if (sets.length === 0) return goal.currentValue;
    if (goal.metric === "e1rm") {
      return Math.round(Math.max(...sets.map((s) => estimateOneRM(s.weight, s.reps))));
    }
    return Math.max(...sets.map((s) => s.weight));
  }
  return goal.currentValue;
}

// { date, value }[] used for pace/projection math. Weight/bodyfat and linked-lift goals
// derive this live from the underlying logs (never drifts out of sync); a manual goal keeps
// its own appended history (see recordManualGoalProgress below).
export function goalHistory(goal, state) {
  if (goal.type === "weight" || goal.type === "bodyfat") {
    const field = goal.type === "weight" ? "weight" : "bodyFat";
    return (state.bodyweightLogs || [])
      .filter((e) => e[field] != null)
      .map((e) => ({ date: e.date, value: e[field] }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  if (goal.type === "lift" && goal.linkedExId) {
    const logs = (state.logs || []).filter((l) => l.exId === goal.linkedExId).sort((a, b) => new Date(a.date) - new Date(b.date));
    return logs.map((l) => {
      const sets = countedSets(l.sets);
      const value =
        goal.metric === "e1rm"
          ? Math.max(0, ...sets.map((s) => estimateOneRM(s.weight, s.reps)))
          : Math.max(0, ...sets.map((s) => s.weight));
      return { date: l.date, value };
    });
  }
  return goal.history || [];
}

// Appends a manual progress point — only meaningful for goal types that don't already derive
// their history live from logs/bodyweight (run times, rep targets, custom goals, etc.).
export function withManualProgress(goal, value) {
  return {
    ...goal,
    currentValue: value,
    history: [...(goal.history || []), { date: new Date().toISOString(), value }],
  };
}
