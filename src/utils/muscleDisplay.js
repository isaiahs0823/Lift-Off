// Decides which region of MuscleBodyOutline's front/back figure to highlight for a given
// exercise. BRK's exercise data has exactly one reliable muscle field per exercise — the broad
// `muscle` category (Chest/Back/Shoulders/Arms/Legs/Core/Conditioning/Full body) — which is not
// granular enough on its own to distinguish biceps from triceps, or quads from hamstrings. Rather
// than inventing a second muscle taxonomy or fabricating precision BRK doesn't actually have,
// this refines the broad category using the exercise's own NAME (real, existing data — the same
// text already shown to the athlete) against a small set of well-known movement-pattern keywords.
// Any exercise whose name doesn't match a keyword still gets a correct, honest broad-category
// region — it just won't get the finer front/back distinction.
//
// Order matters: more specific patterns are checked first so e.g. "Leg curl" (hamstrings) is
// matched before the generic "curl" -> biceps rule, and "Wrist curl" (forearms) before that too.
// The first rule below exists purely to protect two known collisions further down this list:
// "Tricep kickback" would otherwise hit the glutes rule's bare "kickback" keyword, and "Bench
// dip" would otherwise hit the final rule's bare "bench" keyword and jump from Arms all the way
// to a Chest highlight — both real exercise names in BRK's catalog, not hypotheticals.
const NAME_RULES = [
  [/tricep.*kickback|triceps.*kickback|bench dip/i, "back", "triceps"],
  [/hamstring|leg curl|good morning|glute-?ham/i, "back", "hamstrings"],
  [/glute|hip thrust|glute bridge|kickback/i, "back", "glutes"],
  [/calf|calve/i, "back", "calves"],
  [/squat|leg press|leg extension|lunge|step-?up|quad/i, "front", "quads"],
  [/\brow\b|pulldown|pull-?up|chin-?up|\blat\b|deadlift|shrug|face pull|rear delt|reverse fly/i, "back", "back"],
  [/tricep|pushdown|pressdown|skull-?crusher|jm press/i, "back", "triceps"],
  // Negative lookbehind on "grip" excludes grip-*width* qualifiers hyphenated onto an unrelated
  // exercise ("Close-grip bench press", "Wide-Grip Push-Up") so those fall through to their real
  // movement pattern instead of a false forearms hit; "gripper" is listed separately since a
  // grip-strength device is a genuine forearm exercise "grip" alone wouldn't catch.
  [/forearm|wrist curl|wrist extension|gripper|(?<!-)\bgrip\b/i, "front", "forearms"],
  [/bicep|curl/i, "front", "biceps"],
  [/lateral raise|front raise|overhead press|shoulder press|arnold|military press/i, "front", "shoulders"],
  [/\bab\b|abs|crunch|\bcore\b|plank|russian twist|leg raise|sit-?up/i, "front", "abs"],
  [/bench|chest press|\bfly\b|\bpec\b|push-?up/i, "front", "chest"],
];

// Fallback when no name keyword matches — always correct relative to BRK's own broad category,
// just not as visually specific.
const BROAD_DEFAULTS = {
  Chest: ["front", "chest"],
  Back: ["back", "back"],
  Shoulders: ["front", "shoulders"],
  Arms: ["front", "biceps"],
  Legs: ["front", "quads"],
  Core: ["front", "abs"],
  Conditioning: ["front", "full"],
  "Full body": ["front", "full"],
};

// Returns { view: "front" | "back", zone: string }. `exercise` is whatever exMap[exId] holds —
// at minimum `muscle`, ideally also `name`. Never throws on missing/unexpected data.
export function getMuscleDisplay(exercise) {
  const name = exercise?.name;
  if (typeof name === "string") {
    for (const [pattern, view, zone] of NAME_RULES) {
      if (pattern.test(name)) return { view, zone };
    }
  }
  const broad = BROAD_DEFAULTS[exercise?.muscle];
  if (broad) return { view: broad[0], zone: broad[1] };
  return { view: "front", zone: "full" };
}
