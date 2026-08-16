// ---------------- SET TYPE / FORMATTING HELPERS ----------------
// Extracted from App.jsx so both the live Training Mode UI and the read-only Workout History
// Detail screen render sets identically — one formatting source, not two that can drift apart.
//
// "working" is the implicit default — a set with no setType at all (every set logged before
// this feature existed, plus any new set that's never had its chip tapped) is treated as a
// normal working set everywhere below.
export const SET_TYPES = [
  { value: "working", label: "Working", short: "WK" },
  { value: "warmup", label: "Warm-up", short: "W" },
  { value: "top", label: "Top set", short: "TOP" },
  { value: "backoff", label: "Back-off", short: "BO" },
  { value: "dropset", label: "Drop set", short: "DS" },
  { value: "failure", label: "Failure", short: "F" },
  { value: "amrap", label: "AMRAP", short: "AMRAP" },
];
export const SET_TYPE_LABEL = Object.fromEntries(SET_TYPES.map((t) => [t.value, t.label]));

export function isWarmup(s) {
  return s.setType === "warmup";
}
// Warm-ups never distort PRs, volume, or progression math — this is the one filter every
// analytics/progression helper runs sets through first.
export function countedSets(sets) {
  return sets.filter((s) => !isWarmup(s));
}

// A set is { weight, reps, drops?: [{ weight, reps }, ...], setType?, rir?, rpe? }. drops,
// setType, rir, rpe are only present when they carry a non-default value.
export function formatSetCompact(s) {
  const parts = [`${s.weight}x${s.reps}`, ...(s.drops || []).map((d) => `${d.weight}x${d.reps}`)];
  return parts.join(" → ");
}
export function rirRpeSuffix(s) {
  if (s.rir != null) return ` @${s.rir} RIR`;
  if (s.rpe != null) return ` @RPE ${s.rpe}`;
  return "";
}
export function formatSetVerbose(s) {
  const parts = [
    `${s.weight} lb x ${s.reps} reps${rirRpeSuffix(s)}`,
    ...(s.drops || []).map((d) => `${d.weight} lb x ${d.reps} reps`),
  ];
  return parts.join(" → ");
}
export function formatSetsVerbose(sets) {
  return sets.map(formatSetVerbose).join(", ");
}

export function formatSessionDuration(totalSeconds) {
  const mins = Math.round(totalSeconds / 60);
  return mins < 1 ? "<1 min" : `${mins} min`;
}
