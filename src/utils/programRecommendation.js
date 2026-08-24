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
// stated default: "Full Body or Upper/Lower/Full Body"). Otherwise the first built-in match wins
// over a custom one (a user's own program is still shown, just not auto-labeled "Recommended"
// ahead of a vetted built-in), falling back to the first match of any kind.
export function recommendedProgramId(days, matches) {
  if (matches.length === 0) return null;
  if (days === 3) {
    const fullBody = matches.find((p) => p.id === "prog_3day_full_body");
    if (fullBody) return fullBody.id;
  }
  const builtin = matches.find((p) => p.source === "builtin");
  return (builtin || matches[0]).id;
}

// Single entry point the UI calls: given a day count and the available programs, returns
// everything needed to render "Recommended" + "Other Options" plus fallback guidance text.
export function recommendationFor(days, { programs, customPrograms } = {}) {
  const guidance = FREQUENCY_GUIDANCE[days] || null;
  const matches = matchingPrograms(days, { programs, customPrograms });
  const recommendedId = recommendedProgramId(days, matches);
  return {
    days,
    guidance,
    matches,
    recommendedId,
    recommended: matches.find((p) => p.id === recommendedId) || null,
    others: matches.filter((p) => p.id !== recommendedId),
  };
}

// Approximate weekly volume for a preview screen — total working sets across every day in the
// program. Deliberately simple (a single number, not a full per-muscle breakdown) per the task's
// "keep scope controlled" instruction; src/utils/programProposal.js's plannedWeeklyVolumeByMuscle
// already covers the detailed per-muscle case for the AI program builder if that's ever needed.
export function totalWeeklySets(program) {
  if (!program?.days) return 0;
  return program.days.reduce((sum, day) => sum + (day.exercises || []).reduce((s, e) => s + (Number(e.sets) || 0), 0), 0);
}
