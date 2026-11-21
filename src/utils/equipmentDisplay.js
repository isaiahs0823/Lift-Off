// Honest equipment label for Exercise Discovery's beginner-friendly cards. Same principle as
// muscleDisplay.js and equipmentProfiles.js's isMachineBasedExercise: BRK's exercise data has no
// `equipment` field (confirmed — see beginnerRecommendation.js's own "no equipment key exists on
// any program or exercise" audit note), so this is never invented data. It reads the one real,
// already-shown signal that actually exists — the exercise's own name — against a small set of
// well-known equipment-word keywords, same movement-pattern-keyword approach muscleDisplay.js
// already uses for muscle refinement. An exercise whose name doesn't match any keyword gets the
// honest "Equipment not specified" fallback rather than a fabricated guess.
//
// Order matters: "Smith machine bench press" must hit "Smith Machine" before the later generic
// "machine" rule, and "Dumbbell" must be checked before "bodyweight" keywords that could
// otherwise false-match on an unrelated word.
const EQUIPMENT_RULES = [
  [/smith machine/i, "Smith Machine"],
  [/\bcable\b/i, "Cable"],
  // belt squat/T-bar row/pendulum (squat) are brand-agnostic leverage-machine TYPES — the same
  // equipment under any manufacturer's name — not a guess tied to one brand.
  [/\bmachine\b|pulldown|leg press|leg curl|leg extension|hack squat|pec deck|\bsled\b|assisted|belt squat|t-bar row|pendulum/i, "Machine"],
  [/\bbarbell\b|\btrap bar\b/i, "Barbell"],
  [/\bdumbbell\b|\bdb\b/i, "Dumbbell"],
  [/kettlebell/i, "Kettlebell"],
  [/\bband\b|resistance band/i, "Resistance Band"],
  [/push-?up|pull-?up|chin-?up|\bdip\b|plank|sit-?up|crunch|mountain climber|burpee/i, "Bodyweight"],
];

// Returns a short label string, or null when nothing in the exercise's name matches a known
// equipment keyword — callers show the honest "Equipment not specified" fallback for null,
// never a guess.
export function getEquipmentLabel(exercise) {
  const name = exercise?.name;
  if (typeof name !== "string") return null;
  for (const [pattern, label] of EQUIPMENT_RULES) {
    if (pattern.test(name)) return label;
  }
  return null;
}

// Quality Sprint 01, Phase 3 — the Plate Calculator (builds a load from standard barbell plate
// pairs) was offered unconditionally on every exercise, including dumbbell, cable, kettlebell,
// band, and bodyweight movements where there is no bar to load plates onto — a confusing, honestly
// wrong control for most of the catalog. Reuses the exact same honest, name-keyword approach as
// getEquipmentLabel above (never a separate/fabricated data source): true only for equipment that
// is unambiguously plate-loaded by convention. "Machine" is deliberately split rather than treated
// as one bucket — leg press/hack squat/belt squat/T-bar row/pendulum-squat machines ARE
// plate-loaded, but the far more common lat pulldown/leg curl/leg extension/pec deck/assisted-
// pullup machines are pin-stack, not plates, so lumping all "Machine" exercises in would be just
// as wrong as not gating at all.
const PLATE_LOADED_MACHINE_RULE = /leg press|hack squat|belt squat|t-bar row|pendulum/i;

// Quality Sprint 01, final pass — the Hammer Strength line needed its own rule: its equipment
// family lives in the exercise name itself (see the "Hammer Strength line" catalog comment in
// App.jsx), and none of those family words ("Iso-Lateral", "Select", "MTS", "Plate-Loaded",
// "Ground Base") trip any of the generic rules above, so every Hammer Strength exercise
// previously fell through to "not specified" — including the explicitly-named Plate-Loaded ones.
// Per that same catalog comment: "Select" = selectorized (pin-stack); "MTS" = "selectorized
// iso-lateral" (also pin-stack, despite the iso-lateral motion); "Assisted" = weight-assisted
// (the opposite mechanic — never plate-loaded resistance). Every other Hammer Strength exercise
// (plain "Iso-Lateral", explicit "Plate"/"Plate-Loaded", "Ground Base", "T-Bar Row", "Linear Leg
// Press", "Hack Squat", "Pendulum-X Squat", "Belt Squat", the Chest/Back combo units) is
// genuinely plate-loaded. Checked first and used INSTEAD of the generic rules below for any
// Hammer Strength exercise, so e.g. "Hammer Strength Select Seated Leg Press" is never wrongly
// picked up by the brand-agnostic "leg press" keyword — the brand's own sub-line marker wins.
const HAMMER_STRENGTH_NOT_PLATE_LOADED = /select|\bmts\b|assisted/i;
export function isPlateLoadedEquipment(exercise) {
  const name = exercise?.name || "";
  if (/hammer strength/i.test(name)) return !HAMMER_STRENGTH_NOT_PLATE_LOADED.test(name);
  const label = getEquipmentLabel(exercise);
  if (label === "Barbell" || label === "Smith Machine") return true;
  if (label === "Machine") return PLATE_LOADED_MACHINE_RULE.test(name);
  return false;
}

// Only a plain barbell or Smith machine loads plates the way the Plate Calculator's model
// assumes (a bar of a known, standard weight, with the exact same plates on both sides — "current
// load" there IS the resistance). A leverage machine (leg press, hack squat, belt squat, T-bar
// row, pendulum squat, any plate-loaded Hammer Strength machine) genuinely takes plates too, but
// may use a sled/carriage with its own unlisted base weight, or a mechanical leverage ratio where
// the resistance actually moved isn't 1:1 with the plates racked — the calculator still tracks
// what's loaded correctly, it just isn't an exact effective-resistance figure for these. Requires
// isPlateLoadedEquipment(exercise) already true; this only distinguishes exact vs. approximate
// within that set.
export function isExactPlateLoad(exercise) {
  const label = getEquipmentLabel(exercise);
  return label === "Barbell" || label === "Smith Machine";
}

// BRK's exercise data model has no difficulty rating either (same audit as equipment above) —
// `type` ("compound" | "isolation") is the one real, non-fabricated categorization that exists.
// It isn't literally "difficulty," so this is surfaced to the athlete as "Movement type," never
// relabeled as a beginner/intermediate/advanced claim the data doesn't support.
export function getMovementTypeLabel(exercise) {
  if (exercise?.type === "compound") return "Compound";
  if (exercise?.type === "isolation") return "Isolation";
  return null;
}
