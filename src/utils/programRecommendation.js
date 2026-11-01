// ---------------- PROGRAM FREQUENCY RECOMMENDATION ----------------
// Pure, deterministic "planned training days/week -> best-fit weekly structure" logic. Reads
// athleteProfile.preferredDays (already an existing field — see AthleteProfileForm.jsx) and
// existing programs (state.programs = built-in HERO_PROGRAMS, state.customPrograms = user-made),
// filtering by each program's own days.length rather than assuming any specific split. Nothing
// here mutates program data or touches workout history — it only reads and recommends.
//
// Deliberately conservative outside 3 days: BRK ships concrete 3-day starter programs (Part 1),
// so 3 always has real options to recommend. For 2/4/5/6, only structure GUIDANCE is guaranteed
// (the "best-fit split" theory); concrete program matches are shown too whenever one happens to
// exist (a matching custom program, or future built-ins), but none are fabricated here. This is
// the "AVAILABLE DAYS -> BEST-FIT SPLIT" principle, not "force the same split into N days."

export const MIN_TRAINING_DAYS = 2;
export const MAX_STANDARD_TRAINING_DAYS = 6; // 7 is advanced/manual-only, see FREQUENCY_GUIDANCE[7]

// One entry per supported frequency: a short label, the recommended weekly structure (as an
// ordered list of day labels), and a one-line rationale. Purely descriptive — used to render
// guidance text when no concrete program matches a given day count yet.
export const FREQUENCY_GUIDANCE = {
  2: {
    label: "2 Days/Week",
    structure: ["Full Body A", "Full Body B"],
    note: "Every major muscle group hit both sessions, without overloading either one.",
  },
  3: {
    label: "3 Days/Week",
    structure: ["Full Body A", "Full Body B", "Full Body C"],
    note: "Full body or Upper/Lower/Full Body are the default recommendation; Push/Pull/Legs suits athletes who prefer that split style.",
  },
  4: {
    label: "4 Days/Week",
    structure: ["Upper", "Lower", "Upper", "Lower"],
    note: "Two upper/lower rotations — each muscle group trained twice per week.",
  },
  5: {
    label: "5 Days/Week",
    structure: ["Upper", "Lower", "Push", "Pull", "Legs"],
    note: "A blended upper/lower + push/pull/legs week for balanced, intelligently distributed volume.",
  },
  6: {
    label: "6 Days/Week",
    structure: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
    note: "Classic twice-through push/pull/legs — moderately higher weekly volume spread across more, shorter sessions, not doubled outright.",
  },
  7: {
    label: "7 Days/Week (advanced)",
    structure: null,
    note:
      "BRK doesn't recommend seven hard resistance-training sessions a week. Choose 5-6 primary training days, using any remaining day(s) for active recovery or rest.",
    warning: true,
  },
};

// Every program (built-in or custom) whose day count matches the requested frequency. Programs
// missing a `days` array are ignored rather than throwing, since customPrograms in particular can
// be edited/removed independently of this logic.
export function matchingPrograms(days, { programs = [], customPrograms = [] } = {}) {
  const inDays = (p) => Array.isArray(p.days) && p.days.length === days;
  return [
    ...programs.filter(inDays).map((p) => ({ ...p, source: "builtin" })),
    ...customPrograms.filter(inDays).map((p) => ({ ...p, source: "custom" })),
  ];
}

// For 3 days specifically, "3-Day Full Body" is BRK's default recommendation (matches the task's
// stated default: "Full Body or Upper/Lower/Full Body"). If `preferFamilyId` is given (the family
// of whatever program is currently active — see TemplatesTab's frequency-change review flow) and
// a same-family variant exists at this exact day count, that wins first: switching your planned
// days should offer to adapt YOUR program, not swap you onto an unrelated one. Otherwise the first
// built-in match wins over a custom one, falling back to the first match of any kind.
export function recommendedProgramId(days, matches, preferFamilyId = null) {
  if (matches.length === 0) return null;
  if (preferFamilyId) {
    const sameFamily = matches.find((p) => p.familyId === preferFamilyId);
    if (sameFamily) return sameFamily.id;
  }
  if (days === 3) {
    const fullBody = matches.find((p) => p.id === "prog_3day_full_body");
    if (fullBody) return fullBody.id;
  }
  const builtin = matches.find((p) => p.source === "builtin");
  return (builtin || matches[0]).id;
}

// Single entry point the UI calls: given a day count and the available programs, returns
// everything needed to render "Recommended" + "Other Options" plus fallback guidance text.
export function recommendationFor(days, { programs, customPrograms, preferFamilyId } = {}) {
  const guidance = FREQUENCY_GUIDANCE[days] || null;
  const matches = matchingPrograms(days, { programs, customPrograms });
  const recommendedId = recommendedProgramId(days, matches, preferFamilyId);
  return {
    days,
    guidance,
    matches,
    recommendedId,
    recommended: matches.find((p) => p.id === recommendedId) || null,
    others: matches.filter((p) => p.id !== recommendedId),
  };
}

// A program family's sibling variants, keyed by day count — e.g. { 2: {...}, 3: {...}, 5: {...} }
// — used by TemplatesTab's program-detail frequency switcher to preview a different weekly
// version of the same program identity without navigating away or applying anything.
export function familyVariants(familyId, programs = []) {
  if (!familyId) return {};
  const out = {};
  for (const p of programs) {
    if (p.familyId === familyId && Array.isArray(p.days)) out[p.trainingDays ?? p.days.length] = p;
  }
  return out;
}

// Collapses a program list down to one catalog entry per family (Titan/Athena/Shape today) plus
// every genuinely standalone program (Berserker, a custom program, anything with no familyId)
// unchanged — the fix for the catalog literally listing "Titan — 2-Day," "Titan — 3-Day," ...,
// "Titan — 6-Day" as five separate commercial products. This never changes what a family IS: the
// underlying flat program objects (and their ids) are exactly what expandProgramFamilies already
// produces; this only picks ONE of a family's sibling variants to stand in for the family on a
// catalog card. Opening that card still goes to the same program-detail view, which already has
// its own frequency switcher (see TemplatesTab's familyPreview) to reach any other sibling.
//
// Representative-picking order, most to least specific: (1) the family's variant matching
// `preferFamilyId`'s own currently-active day count, so an athlete already on a family sees their
// own version featured, not an arbitrary one; (2) a variant matching `preferredDays` (e.g. the
// athlete's saved training-frequency preference); (3) BRK's stated 3-day default (see
// recommendedProgramId's own same rule); (4) the lowest day count the family supports, so an
// unfamiliar athlete's first impression is the most approachable version, not the most demanding.
export function uniqueFamilyPrograms(programs = [], { preferFamilyId = null, preferredDays = null, activeDaysByFamily = {} } = {}) {
  const byFamily = new Map();
  const standalone = [];
  for (const p of programs) {
    if (!p.familyId) {
      standalone.push(p);
      continue;
    }
    if (!byFamily.has(p.familyId)) byFamily.set(p.familyId, []);
    byFamily.get(p.familyId).push(p);
  }
  const representatives = [];
  for (const [familyId, variants] of byFamily) {
    const byDays = (n) => variants.find((v) => v.trainingDays === n);
    const activeDays = familyId === preferFamilyId ? activeDaysByFamily[familyId] : null;
    const pick = (activeDays && byDays(activeDays)) || (preferredDays && byDays(preferredDays)) || byDays(3) || variants.slice().sort((a, b) => a.trainingDays - b.trainingDays)[0];
    representatives.push(pick);
  }
  return [...representatives, ...standalone];
}

// The full span of weekly frequencies a family supports (e.g. Titan: 2-6, Shape: 2-5) — for a
// catalog card's "2-6 Days/Week" range, since one representative variant's own trainingDays would
// otherwise misrepresent a family as single-frequency.
export function familyFrequencyRange(familyId, programs = []) {
  const days = programs.filter((p) => p.familyId === familyId).map((p) => p.trainingDays).filter((n) => Number.isFinite(n));
  if (days.length === 0) return null;
  return { min: Math.min(...days), max: Math.max(...days) };
}

// Approximate weekly volume for a preview screen — total working sets across every day in the
// program. Deliberately simple (a single number, not a full per-muscle breakdown) per the task's
// "keep scope controlled" instruction; src/utils/programProposal.js's plannedWeeklyVolumeByMuscle
// already covers the detailed per-muscle case for the AI program builder if that's ever needed.
export function totalWeeklySets(program) {
  if (!program?.days) return 0;
  return program.days.reduce((sum, day) => sum + (day.exercises || []).reduce((s, e) => s + (Number(e.sets) || 0), 0), 0);
}
