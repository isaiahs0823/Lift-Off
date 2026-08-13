// ---------------- GOAL MATH ----------------
// Pure, dependency-free math for the Mission system: progress %, pace, and an
// ahead/on-track/behind classification. Kept simple and transparent on purpose — every
// number here traces back to two data points a user could reproduce by hand, no smoothing
// beyond the "compare trailing windows" trick also used by the bodyweight dashboard.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetween(fromISO, toISO) {
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / MS_PER_DAY);
}

// +1 for a goal that increases (bench 225 -> 315), -1 for one that decreases (228 -> 205 lb).
// Falls back to +1 for a zero-span goal (start === target) so downstream math never divides
// by/multiplies by 0 in a way that silently flips sign.
export function goalDirection(goal) {
  return Math.sign((goal.targetValue ?? 0) - (goal.startValue ?? 0)) || 1;
}

export function goalProgressPct(goal) {
  const span = goal.targetValue - goal.startValue;
  if (!span) return goal.currentValue === goal.targetValue ? 100 : 0;
  const pct = ((goal.currentValue - goal.startValue) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export function daysRemaining(goal) {
  if (!goal.targetDate) return null;
  return daysBetween(new Date().toISOString(), goal.targetDate);
}

// Current pace, in units/week, from a { date, value }[] history (any order). Uses whatever
// falls in the trailing `windowDays` (default 14); if that window is too sparse, falls back
// to the last two points on record so a brand-new goal still gets *a* pace rather than none.
export function currentPaceFromHistory(history, windowDays = 14) {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
  const cutoff = Date.now() - windowDays * MS_PER_DAY;
  const windowed = sorted.filter((h) => new Date(h.date).getTime() >= cutoff);
  const points = windowed.length >= 2 ? windowed : sorted.slice(-2);
  const first = points[0];
  const last = points[points.length - 1];
  const days = daysBetween(first.date, last.date);
  if (days <= 0) return null;
  return ((last.value - first.value) / days) * 7;
}

// Weekly pace still needed to hit the target by the target date, from today's value.
export function requiredPace(goal) {
  const rem = daysRemaining(goal);
  if (rem == null || rem <= 0) return null;
  return ((goal.targetValue - goal.currentValue) / rem) * 7;
}

// "ahead" | "on_track" | "behind" | "no_data" — direction-aware: for a *decreasing* goal,
// losing weight faster than required is "ahead" even though its pace number is more negative
// than the required one, not "behind."
export function goalStatus(goal, history) {
  const pace = currentPaceFromHistory(history);
  const required = requiredPace(goal);
  if (pace == null || required == null) return "no_data";
  const dir = goalDirection(goal);
  const paceSigned = pace * dir;
  const requiredSigned = required * dir;
  if (requiredSigned <= 0) return "on_track"; // already at/past the target value
  const ratio = paceSigned / requiredSigned;
  if (ratio >= 1.15) return "ahead";
  if (ratio >= 0.85) return "on_track";
  return "behind";
}

export const GOAL_STATUS_LABEL = {
  ahead: "AHEAD",
  on_track: "ON TRACK",
  behind: "BEHIND",
  no_data: "COLLECTING DATA",
};

// Projected date the goal is reached at the current pace, or null if pace is flat or moving
// the wrong direction (no honest projection to give in that case).
export function projectedCompletionDate(goal, history) {
  const pace = currentPaceFromHistory(history);
  if (!pace) return null;
  const dir = goalDirection(goal);
  if (Math.sign(pace) !== dir) return null;
  const remaining = goal.targetValue - goal.currentValue;
  if (Math.sign(remaining) !== 0 && Math.sign(remaining) !== dir) return null; // already past target
  const weeksNeeded = Math.abs(remaining / pace);
  if (!isFinite(weeksNeeded)) return null;
  return new Date(Date.now() + weeksNeeded * 7 * MS_PER_DAY).toISOString();
}
