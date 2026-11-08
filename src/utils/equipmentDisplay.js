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
  [/\bmachine\b|pulldown|leg press|leg curl|leg extension|hack squat|pec deck|\bsled\b|assisted/i, "Machine"],
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

// BRK's exercise data model has no difficulty rating either (same audit as equipment above) —
// `type` ("compound" | "isolation") is the one real, non-fabricated categorization that exists.
// It isn't literally "difficulty," so this is surfaced to the athlete as "Movement type," never
// relabeled as a beginner/intermediate/advanced claim the data doesn't support.
export function getMovementTypeLabel(exercise) {
  if (exercise?.type === "compound") return "Compound";
  if (exercise?.type === "isolation") return "Isolation";
  return null;
}
