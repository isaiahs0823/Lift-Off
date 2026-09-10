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

// Checks `weeks` trailing weekly windows and requires every one of them to show near-zero
// change — "flat for 3 weeks," not "flat this week." Returns false (not "flat") when there
// isn't enough history to back the claim, same never-react-to-one-data-point rule as the rest
// of this file. Used by nutrition's plan-vs-adherence reasoning (section 19/20 of the
// nutrition spec) as well as anywhere else a genuine bodyweight plateau needs checking.
export function isFlatTrend(entries, weeks = 3, thresholdPerWeek = 0.25) {
  const now = new Date();
  for (let i = 0; i < weeks; i++) {
    const asOf = new Date(now.getTime() - i * 7 * MS_PER_DAY);
    const priorAsOf = new Date(asOf.getTime() - 7 * MS_PER_DAY);
    const recentAvg = rollingAverage(entries, "weight", 7, asOf);
    const priorAvg = rollingAverage(entries, "weight", 7, priorAsOf);
    if (recentAvg == null || priorAvg == null) return false;
    if (Math.abs(recentAvg - priorAvg) >= thresholdPerWeek) return false;
  }
  return true;
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

// Sanity bounds for a bodyweight entry, in pounds — rejects obvious typos/impossible values
// (a stray extra digit, a negative sign) at every entry point without pretending to know a
// real physiological range.
export const BODYWEIGHT_MIN_LB = 50;
export const BODYWEIGHT_MAX_LB = 700;

export function isValidBodyweightLb(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= BODYWEIGHT_MIN_LB && value <= BODYWEIGHT_MAX_LB;
}

// One write path for "today's bodyweight entry," shared by every screen that can log
// bodyweight (Progress's Bodyweight tab, Nutrition's assessment) so there is exactly one rule
// for what "today's entry" means: update it in place if it already exists, otherwise create it.
// This is what keeps a same-day save from ever producing two rows for one day, regardless of
// which screen the save came from. `fields` only touches the keys it provides — an omitted key
// falls back to today's existing value (if any) so a partial save (e.g. just waist) never nulls
// out a value entered earlier today from another screen.
export function upsertBodyweightEntry(entries, fields = {}, { date = new Date() } = {}) {
  const dateStr = date.toISOString().slice(0, 10);
  const list = entries || [];
  const todayEntry = list.find((e) => e.date.slice(0, 10) === dateStr);
  const merged = {
    weight: fields.weight !== undefined ? fields.weight : todayEntry?.weight ?? null,
    waist: fields.waist !== undefined ? fields.waist : todayEntry?.waist ?? null,
    bodyFat: fields.bodyFat !== undefined ? fields.bodyFat : todayEntry?.bodyFat ?? null,
    notes: fields.notes !== undefined ? fields.notes : todayEntry?.notes || "",
  };
  if (todayEntry) {
    return list.map((e) => (e.id === todayEntry.id ? { ...e, ...merged } : e));
  }
  return [{ id: `bw_${Date.now()}`, date: date.toISOString(), ...merged }, ...list];
}
