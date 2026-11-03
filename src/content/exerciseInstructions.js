// Exercise demonstration/instruction architecture (Beginner Experience V2, Stage 2B).
//
// Keyed by the SAME stable `exId` every other part of the app already uses (programs, logs,
// exMap) — no new identifier scheme. Every entry's media fields are explicitly `null`: no video
// or image asset exists yet, and none is fabricated or AI-generated here. `instructions`/`cue`
// are plain-language, generic lifting-form text written for this prototype — NOT claimed to be
// professionally reviewed or founder-verified (see the disclaimer rendered by
// ExerciseInstructionPanel.jsx, which owns that wording so it can't be dropped by a future caller).
//
// Only the beginner default program's exercises (3-Day Full Body — see
// beginnerRecommendation.js) are populated here. This is deliberate, not an oversight: writing
// unverified form cues for the other ~150 exercises in the catalog is a separate, larger content
// project (per the brief: "do not block initial onboarding implementation while awaiting a
// complete video library"). Every exercise NOT listed here safely falls through
// ExerciseInstructionPanel's "no demo yet" state — never a broken UI, never fabricated content.
//
// To add real video later: set `video` to `{ src, poster }` for the relevant exId. Nothing else
// in the logger needs to change — GuidedRunView and ExerciseInstructionPanel already render
// whatever is present and fall back gracefully for whatever isn't.
export const EXERCISE_INSTRUCTIONS = {
  bench: {
    instructions: "Lie on the bench with your eyes under the bar. Grip slightly wider than shoulder width, unrack, and lower the bar to your mid-chest under control. Press back up to full arm extension.",
    cue: "Keep your feet flat on the floor and your shoulder blades pulled together and down.",
    video: null,
    image: null,
  },
  incline_bench: {
    instructions: "Same setup as a flat bench press, on a bench angled around 30-45°. Lower the bar to your upper chest and press back up.",
    cue: "A steeper angle shifts more work to your shoulders — keep the incline moderate, not vertical.",
    video: null,
    image: null,
  },
  chest_supported_row: {
    instructions: "Lie chest-down on the angled pad, grip the handles, and pull them toward your torso by driving your elbows back. Lower under control to a full stretch.",
    cue: "Let your chest stay pinned to the pad the whole set — if it lifts off, the weight is too heavy.",
    video: null,
    image: null,
  },
  barbell_row: {
    instructions: "Hinge at the hips with a flat back, holding the bar at arm's length. Pull the bar to your lower ribs, then lower it back under control.",
    cue: "Keep your back flat throughout — if it rounds, lighten the weight.",
    video: null,
    image: null,
  },
  squat: {
    instructions: "Bar across your upper back, feet about shoulder-width apart. Bend your hips and knees to lower down until your thighs are at least parallel to the floor, then stand back up.",
    cue: "Keep your chest up and knees tracking roughly over your toes throughout the movement.",
    video: null,
    image: null,
  },
  hack_squat: {
    instructions: "Set your shoulders and back against the machine's pads, feet shoulder-width on the platform. Lower under control until your thighs approach parallel, then press back up.",
    cue: "Keep your heels flat on the platform the whole rep.",
    video: null,
    image: null,
  },
  leg_press: {
    instructions: "Sit in the machine with your back against the pad and feet shoulder-width on the platform. Lower the platform until your knees reach about 90°, then press back to the start without locking your knees out hard.",
    cue: "Keep your lower back flat against the pad — don't let your hips round up off it at the bottom.",
    video: null,
    image: null,
  },
  leg_curl_seated: {
    instructions: "Sit in the machine with the back pad set so the leg pad sits just above your ankles. Curl your legs down/back against the pad, then return under control.",
    cue: "Move slowly on the way back up — don't let the weight stack drop.",
    video: null,
    image: null,
  },
  leg_extension: {
    instructions: "Sit in the machine with the pad resting just above your ankles. Extend your legs to straighten your knees, then lower under control.",
    cue: "Pause briefly at the top of each rep instead of kicking the weight up.",
    video: null,
    image: null,
  },
  rdl: {
    instructions: "Hold the bar at hip height. Push your hips back while keeping a slight knee bend and a flat back, lowering the bar along your legs until you feel a stretch in your hamstrings, then drive your hips forward to stand back up.",
    cue: "This is a hip-hinge, not a squat — your knees barely bend.",
    video: null,
    image: null,
  },
  ohp: {
    instructions: "Hold the bar at shoulder height, hands just outside shoulder width. Press it straight overhead until your arms are fully extended, then lower back to the start.",
    cue: "Brace your core and avoid leaning back excessively as you press.",
    video: null,
    image: null,
  },
  lat_pulldown: {
    instructions: "Sit with your thighs secured under the pads. Grip the bar wider than shoulder width and pull it down to your upper chest, then let it rise back under control.",
    cue: "Lead with your elbows, not your hands, and avoid leaning back to use momentum.",
    video: null,
    image: null,
  },
  cable_fly: {
    instructions: "Set both cable pulleys above shoulder height. With a slight bend in your elbows, bring your hands together in front of your chest in a wide arc, then return under control.",
    cue: "Keep the same slight elbow bend throughout — don't turn it into a press.",
    video: null,
    image: null,
  },
  rear_delt_fly: {
    instructions: "Hinge forward slightly with a dumbbell in each hand. Raise your arms out to the sides, squeezing your shoulder blades together, then lower under control.",
    cue: "Keep the movement slow and controlled — this is an easy one to swing with momentum.",
    video: null,
    image: null,
  },
  lat_raise: {
    instructions: "Stand holding a dumbbell in each hand at your sides. Raise your arms out to shoulder height, then lower under control.",
    cue: "A slight bend in the elbows and a brief pause at the top keeps the tension on your shoulders.",
    video: null,
    image: null,
  },
  barbell_curl: {
    instructions: "Stand holding a barbell with an underhand grip. Curl it up toward your shoulders, then lower under control.",
    cue: "Keep your elbows pinned at your sides — don't let them drift forward.",
    video: null,
    image: null,
  },
  hammer_curl: {
    instructions: "Stand holding a dumbbell in each hand with a neutral (palms-facing-in) grip. Curl up toward your shoulders, then lower under control.",
    cue: "Keep your wrists neutral the whole rep, no twisting.",
    video: null,
    image: null,
  },
  tricep_pushdown: {
    instructions: "Stand facing a cable machine with a bar or rope attachment at chest height. Push down until your arms are fully extended, then let it rise back under control.",
    cue: "Keep your elbows pinned at your sides — only your forearms should move.",
    video: null,
    image: null,
  },
  overhead_tricep_ext: {
    instructions: "Hold a dumbbell or rope attachment overhead with both hands. Lower it behind your head by bending your elbows, then extend back up.",
    cue: "Keep your elbows pointed forward and close to your head throughout.",
    video: null,
    image: null,
  },
  calf_raise_standing: {
    instructions: "Stand on the machine's platform with the balls of your feet on the edge. Rise up onto your toes as high as you can, then lower your heels below the platform for a full stretch.",
    cue: "Pause briefly at the top of each rep instead of bouncing.",
    video: null,
    image: null,
  },
  cable_crunch: {
    instructions: "Kneel facing a cable machine with a rope attachment overhead. Holding the rope by your head, crunch down by curling your torso toward your hips.",
    cue: "Move from your abs, not your hips — keep your hips mostly still.",
    video: null,
    image: null,
  },
};

export function getExerciseInstruction(exId) {
  return EXERCISE_INSTRUCTIONS[exId] || null;
}

export function hasInstructionContent(exId) {
  const entry = EXERCISE_INSTRUCTIONS[exId];
  return !!(entry && (entry.instructions || entry.cue || entry.video || entry.image));
}
