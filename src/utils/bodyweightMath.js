// ---------------- BODYWEIGHT MATH ----------------
// Rolling averages + trend classification for the physique dashboard. One rule threads
// through all of it: never react to a single day's number. Every headline stat here is a
// multi-day average or a multi-day rate of change, never today's entry compared to
// yesterday's.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function sortByDate(entries) {
  return [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Average of `field` across entries in the trailing `days` window ending at `asOf`.
export function rollingAverage(entries, field, days, asOf = new Date()) {
  const end = asOf.getTime();
  const start = end - days * MS_PER_DAY;
  const windowed = entries.filter((e) => {
    if (e[field] == null) return false;
    const t = new Date(e.date).getTime();
    return t >= start && t <= end;
  });
  if (windowed.length === 0) return null;
  const sum = windowed.reduce((s, e) => s + e[field], 0);
  return sum / windowed.length;
}

// Weekly rate of change for `field`: this week's 7-day average vs. the 7-day average from
// the week before that. Comparing two averages (not two single days) is what keeps a bad
// water-weight morning from swinging the number.
export function weeklyRateOfChange(entries, field) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const recentAvg = rollingAverage(entries, field, 7, now);
  const priorAvg = rollingAverage(entries, field, 7, weekAgo);
  if (recentAvg == null || priorAvg == null) return null;
  return recentAvg - priorAvg;
}

export function totalChange(entries, field) {
  const sorted = sortByDate(entries.filter((e) => e[field] != null));
  if (sorted.length < 2) return null;
  return sorted[sorted.length - 1][field] - sorted[0][field];
}

export function latestValue(entries, field) {
  const sorted = sortByDate(entries.filter((e) => e[field] != null));
  return sorted.length ? sorted[sorted.length - 1][field] : null;
}

// Classifies weekly rate of change against a target weekly pace (usually the required pace
// from a linked weight/bodyfat goal). Falls back to plain losing/gaining/maintaining bands
// when there's no goal to compare against.
export function paceClassification(weeklyRate, targetWeeklyRate) {
  if (weeklyRate == null) return "no_data";
  if (Math.abs(weeklyRate) < 0.15) return "stalled";
  if (targetWeeklyRate == null || targetWeeklyRate === 0) return weeklyRate < 0 ? "losing" : "gaining";
  const dir = Math.sign(targetWeeklyRate);
  if (Math.sign(weeklyRate) !== dir) return dir < 0 ? "gaining" : "losing"; // moving the wrong way entirely
  const ratio = Math.abs(weeklyRate) / Math.abs(targetWeeklyRate);
  if (ratio > 1.4) return "too_fast";
  if (ratio >= 0.7) return "on_pace";
  return "slow";
}

export const PACE_LABEL = {
  no_data: "Not enough data yet",
  stalled: "Stalled",
  losing: "Losing",
  gaining: "Gaining",
  too_fast: "Faster than target",
  on_pace: "On pace",
  slow: "Behind pace",
};
