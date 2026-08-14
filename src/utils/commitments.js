// ---------------- COMMITMENTS ----------------
// "The user says they'll do something specific this week; the Coach checks later." Detection
// is deliberately narrow — one well-defined phrasing pattern, not general free-text parsing —
// because a false-positive commitment (putting words in the user's mouth) is worse than
// missing a real one (section 23: "do not turn casual statements into commitments
// automatically"). Only "conditioning" and "workout" commitments can be auto-graded against
// real logged data; anything else is left for the user to judge for themselves.

const TYPE_KEYWORDS = {
  conditioning: /conditioning|cardio|runs?|running|intervals?|sled/i,
  workout: /workouts?|sessions?|lifts?|lifting|training\s*days?/i,
};
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

// Matches "I'm doing/I will do/I'll complete <N> <thing> this/next week" — case-insensitive,
// N as a digit or spelled-out word up to seven. Returns null for anything else, including
// vaguer statements like "I should train more this week."
export function detectCommitment(text) {
  const m = (text || "").match(
    /\b(?:i'?m|i will|i'?ll)\s+(?:doing|do|complete|completing)\s+(\d+|one|two|three|four|five|six|seven)\s+([a-z\s]+?)\s+(this|next)\s+week\b/i
  );
  if (!m) return null;
  const numWord = m[1].toLowerCase();
  const target = NUMBER_WORDS[numWord] ?? parseInt(numWord, 10);
  if (!target || target < 1 || target > 14) return null;
  const rawType = m[2].trim();
  let type = "custom";
  if (TYPE_KEYWORDS.conditioning.test(rawType)) type = "conditioning";
  else if (TYPE_KEYWORDS.workout.test(rawType)) type = "workout";
  const period = m[3].toLowerCase() === "next" ? "next_week" : "this_week";
  return { text: `${target} ${rawType}`.trim(), type, target, period };
}

function weekRange(period) {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const start = period === "next_week" ? new Date(monday.getTime() + 7 * 86400000) : monday;
  const end = new Date(start.getTime() + 7 * 86400000 - 1);
  return { start, end };
}

export function createCommitment({ text, type, target, period }) {
  const { start, end } = weekRange(period);
  const now = new Date().toISOString();
  return {
    id: `commit_${Date.now()}`,
    text,
    type,
    target,
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    status: "active",
    createdAt: now,
    resolvedAt: null,
    outcome: null,
    actualCount: null,
  };
}

function countActuals(state, commitment) {
  const start = new Date(commitment.startDate).getTime();
  const end = new Date(commitment.endDate).getTime();
  const inRange = (dateStr) => {
    const t = new Date(dateStr).getTime();
    return t >= start && t <= end;
  };
  if (commitment.type === "conditioning") {
    return (state.cardioLogs || []).filter((c) => inRange(c.date)).length;
  }
  if (commitment.type === "workout") {
    return (state.workoutSessions || []).filter((s) => inRange(s.finishedAt)).length;
  }
  return null;
}

// Resolves every active commitment whose window has closed — returns the full updated
// commitments array plus the subset that just resolved this pass, so the caller can surface a
// coach message for each. "custom"-type commitments (couldn't be matched to a measurable
// activity) are left active indefinitely rather than guessed at.
export function resolveDueCommitments(state) {
  const commitments = state.commitments || [];
  const now = Date.now();
  const resolved = [];
  const next = commitments.map((c) => {
    if (c.status !== "active" || c.type === "custom" || new Date(c.endDate).getTime() > now) return c;
    const actualCount = countActuals(state, c);
    const outcome = actualCount >= c.target ? "completed" : "missed";
    const updated = { ...c, status: outcome, outcome, actualCount, resolvedAt: new Date().toISOString() };
    resolved.push(updated);
    return updated;
  });
  return { commitments: next, resolved };
}

export function commitmentOutcomeMessage(c) {
  if (c.outcome === "completed") {
    return `You said ${c.target}. You did ${c.actualCount}. That's execution.`;
  }
  return `You committed to ${c.text}. You completed ${c.actualCount}. What needs to change?`;
}
