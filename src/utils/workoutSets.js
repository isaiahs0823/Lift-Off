// ---------------- SET TYPE / FORMATTING HELPERS ----------------
// Extracted from App.jsx so both the live Training Mode UI and the read-only Workout History
// Detail screen render sets identically — one formatting source, not two that can drift apart.
//
// "working" is the implicit default — a set with no setType at all (every set logged before
// this feature existed, plus any new set that's never had its chip tapped) is treated as a
// normal working set everywhere below.
//
// "top"/"backoff" are no longer offered as Set type picker options (see PROGRAM_ROLES below) —
// a program role is independent of technique, so a set can be a Top Set AND an AMRAP at once,
// which one mutually-exclusive setType value could never represent. They stay listed here only
// so existing records that still have setType "top"/"backoff" directly (saved before this
// change) keep reading correctly — see getSetDisplayDesignation.
export const SET_TYPES = [
  { value: "working", label: "Working", short: "WK" },
  { value: "warmup", label: "Warm-up", short: "W" },
  { value: "dropset", label: "Drop set", short: "DS" },
  { value: "failure", label: "Failure", short: "F" },
  { value: "amrap", label: "AMRAP", short: "AMRAP" },
  { value: "myoreps", label: "Myo-reps", short: "MYO" },
  { value: "myorepmatch", label: "Myo-rep match", short: "MYO-M" },
  { value: "restpause", label: "Rest-pause", short: "RP" },
];
// The program-role picker — independent of (and combinable with) the Set type/technique above.
export const PROGRAM_ROLES = [
  { value: "", label: "None" },
  { value: "top", label: "Top set", short: "TOP" },
  { value: "backoff", label: "Backoff", short: "BO" },
];

const LEGACY_SET_TYPE_LABELS = { top: "Top set", backoff: "Backoff" };
export const SET_TYPE_LABEL = {
  ...Object.fromEntries(SET_TYPES.map((t) => [t.value, t.label])),
  ...LEGACY_SET_TYPE_LABELS,
};

// Defensive normalization only — nothing in this app has ever persisted these raw short codes
// as setType (the stored value has always been the lowercase word), but a centralized helper
// that claims to handle "legacy shorthand" should actually handle it rather than assume.
const LEGACY_SHORTHAND = { wk: "working", w: "warmup", top: "top", bo: "backoff", ds: "dropset", f: "failure", amrap: "amrap" };
function normalizeSetType(raw) {
  if (!raw) return "working";
  const key = String(raw).toLowerCase();
  if (SET_TYPE_LABEL[key]) return key;
  if (LEGACY_SHORTHAND[key]) return LEGACY_SHORTHAND[key];
  return "working"; // unrecognized value — fail safe rather than show garbage
}

export function isWarmup(s) {
  return normalizeSetType(s?.setType) === "warmup";
}
// Warm-ups never distort PRs, volume, or progression math — this is the one filter every
// analytics/progression helper runs sets through first.
export function countedSets(sets) {
  return sets.filter((s) => !isWarmup(s));
}

// THE single source of truth for how a saved set's designation should read to a human —
// combines legacy single-value setType records (including "top"/"backoff" stored directly from
// before programRole existed) with the newer setType + programRole combination. Never silently
// drops information: a set with both a program role and a technique (a top set finished as an
// AMRAP) shows both, joined with " · ", rather than picking just one.
// Priority: Warm-up alone > role + technique > role alone > technique alone > Working.
export function getSetDisplayDesignation(set) {
  const type = normalizeSetType(set?.setType);
  if (type === "warmup") return "Warm-up";

  const legacyRole = type === "top" || type === "backoff" ? type : null;
  const role = set?.programRole || legacyRole;
  const technique = type !== "working" && !legacyRole ? type : null;

  const parts = [];
  if (role) parts.push(SET_TYPE_LABEL[role]);
  if (technique) parts.push(SET_TYPE_LABEL[technique]);
  return parts.length > 0 ? parts.join(" · ") : "Working";
}

// Whether a set carries a program role or technique worth calling out as an EXTRA badge in a
// display that already distinguishes warm-up vs. working some other way (a separate "Warm"
// marker, a grouped section) — false for a plain warm-up or plain working set either way, so
// callers don't double-label what's already shown.
export function hasNotableDesignation(set) {
  const type = normalizeSetType(set?.setType);
  const legacyRole = type === "top" || type === "backoff";
  return !!(set?.programRole || legacyRole || (type !== "working" && type !== "warmup" && !legacyRole));
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
