// Exercise demonstration/instruction architecture. Keyed by the SAME stable `exId` every other
// part of the app already uses (programs, logs, exMap) — no new identifier scheme. Every entry's
// media fields are explicitly `null`: no video or image asset exists yet, and none is fabricated
// or AI-generated here. All text below is plain-language, generic lifting-form guidance written
// for this prototype — NOT claimed to be professionally reviewed or founder-verified (see the
// disclaimer rendered by ExerciseInstructionPanel.jsx, which owns that wording so it can't be
// dropped by a future caller).
//
// Structured four ways per exercise — Setup / Execution / Cues / Mistakes — matching what a
// beginner with little or no lifting experience actually needs to go from "I tapped this
// exercise" to "I can confidently attempt a set": how to get into position, what the rep itself
// looks like, what to focus on, and what commonly goes wrong. `setup` and `execution` are each a
// single paragraph; `execution` is split into numbered steps for the How To tab by
// instructionSteps() below, the same mechanical sentence-boundary split used before — it doesn't
// rewrite or add to the text, just presents it. `cues` and `mistakes` are short arrays, one idea
// per line, rendered as their own lists.
//
// Scope (task: "prioritize accurate information over catalog coverage" / "do not automatically
// generate hundreds of exercise instructions without a content quality review"): 41 of the
// catalog's 360+ exercises are covered here — the 21 originally written for the 3-Day Full Body
// beginner program, plus the ~20 next-most-frequent movements across every built-in program
// (by real exId frequency count, favoring genuinely beginner-approachable strength/bodyweight
// staples — deadlift, pull-up, push-up, goblet squat, plank, dumbbell presses and rows — over
// conditioning/odd-object work like sled drags or kettlebell swings, which are more intuitive to
// attempt without detailed form cues and were deliberately left for a later pass). Every exercise
// NOT listed here safely falls through ExerciseInstructionPanel's "no demo yet" state — never a
// broken UI, never fabricated content.
//
// To add real video later: set `video` to `{ src, poster }` for the relevant exId. Nothing else
// in the logger needs to change — the panel already renders whatever is present and falls back
// gracefully for whatever isn't.
export const EXERCISE_INSTRUCTIONS = {
  // ---------------- originally-reviewed Stage 2B content, reformatted into setup/execution ----
  // (same underlying text, split at its existing natural "get positioned" / "do the rep"
  // boundary — not rewritten or expanded. `mistakes` was not part of that original review, so it
  // is left empty here rather than inventing unreviewed claims on top of reviewed text; the panel
  // shows an honest "not documented yet" state for an empty mistakes list.)
  bench: {
    setup: "Lie on the bench with your eyes under the bar. Grip slightly wider than shoulder width and unrack the bar over your shoulders.",
    execution: "Lower the bar to your mid-chest under control. Press back up to full arm extension.",
    cues: ["Keep your feet flat on the floor and your shoulder blades pulled together and down."],
    mistakes: [],
    video: null,
    image: null,
  },
  incline_bench: {
    setup: "Set the bench to a moderate incline, around 30-45°. Grip the bar slightly wider than shoulder width and unrack it over your upper chest.",
    execution: "Lower the bar to your upper chest, then press back up to full arm extension.",
    cues: ["A steeper angle shifts more work to your shoulders — keep the incline moderate, not vertical."],
    mistakes: [],
    video: null,
    image: null,
  },
  chest_supported_row: {
    setup: "Lie chest-down on the angled pad and grip the handles with your arms extended.",
    execution: "Pull the handles toward your torso by driving your elbows back. Lower under control to a full stretch.",
    cues: ["Let your chest stay pinned to the pad the whole set — if it lifts off, the weight is too heavy."],
    mistakes: [],
    video: null,
    image: null,
  },
  barbell_row: {
    setup: "Hinge at the hips with a flat back, holding the bar at arm's length below your shoulders.",
    execution: "Pull the bar to your lower ribs, then lower it back under control to full arm extension.",
    cues: ["Keep your back flat throughout — if it rounds, lighten the weight."],
    mistakes: [],
    video: null,
    image: null,
  },
  squat: {
    setup: "Set the bar across your upper back and step out of the rack with your feet about shoulder-width apart.",
    execution: "Bend your hips and knees to lower down until your thighs are at least parallel to the floor, then stand back up.",
    cues: ["Keep your chest up and knees tracking roughly over your toes throughout the movement."],
    mistakes: [],
    video: null,
    image: null,
  },
  hack_squat: {
    setup: "Set your shoulders and back against the machine's pads with your feet shoulder-width on the platform.",
    execution: "Lower under control until your thighs approach parallel, then press back up.",
    cues: ["Keep your heels flat on the platform the whole rep."],
    mistakes: [],
    video: null,
    image: null,
  },
  leg_press: {
    setup: "Sit in the machine with your back against the pad and feet shoulder-width on the platform.",
    execution: "Lower the platform until your knees reach about 90°, then press back to the start without locking your knees out hard.",
    cues: ["Keep your lower back flat against the pad — don't let your hips round up off it at the bottom."],
    mistakes: [],
    video: null,
    image: null,
  },
  leg_curl_seated: {
    setup: "Sit in the machine with the back pad set so the leg pad sits just above your ankles.",
    execution: "Curl your legs down/back against the pad, then return under control.",
    cues: ["Move slowly on the way back up — don't let the weight stack drop."],
    mistakes: [],
    video: null,
    image: null,
  },
  leg_extension: {
    setup: "Sit in the machine with the pad resting just above your ankles.",
    execution: "Extend your legs to straighten your knees, then lower under control.",
    cues: ["Pause briefly at the top of each rep instead of kicking the weight up."],
    mistakes: [],
    video: null,
    image: null,
  },
  rdl: {
    setup: "Hold the bar at hip height with a flat back and a slight bend in your knees.",
    execution: "Push your hips back, lowering the bar along your legs until you feel a stretch in your hamstrings, then drive your hips forward to stand back up.",
    cues: ["This is a hip-hinge, not a squat — your knees barely bend."],
    mistakes: [],
    video: null,
    image: null,
  },
  ohp: {
    setup: "Hold the bar at shoulder height, hands just outside shoulder width.",
    execution: "Press it straight overhead until your arms are fully extended, then lower back to the start.",
    cues: ["Brace your core and avoid leaning back excessively as you press."],
    mistakes: [],
    video: null,
    image: null,
  },
  lat_pulldown: {
    setup: "Sit with your thighs secured under the pads and grip the bar wider than shoulder width.",
    execution: "Pull the bar down to your upper chest, then let it rise back under control.",
    cues: ["Lead with your elbows, not your hands, and avoid leaning back to use momentum."],
    mistakes: [],
    video: null,
    image: null,
  },
  cable_fly: {
    setup: "Set both cable pulleys above shoulder height and hold a handle in each hand with a slight bend in your elbows.",
    execution: "Bring your hands together in front of your chest in a wide arc, then return under control.",
    cues: ["Keep the same slight elbow bend throughout — don't turn it into a press."],
    mistakes: [],
    video: null,
    image: null,
  },
  rear_delt_fly: {
    setup: "Hinge forward slightly at the hips with a dumbbell in each hand hanging below your shoulders.",
    execution: "Raise your arms out to the sides, squeezing your shoulder blades together, then lower under control.",
    cues: ["Keep the movement slow and controlled — this is an easy one to swing with momentum."],
    mistakes: [],
    video: null,
    image: null,
  },
  lat_raise: {
    setup: "Stand holding a dumbbell in each hand at your sides.",
    execution: "Raise your arms out to shoulder height, then lower under control.",
    cues: ["A slight bend in the elbows and a brief pause at the top keeps the tension on your shoulders."],
    mistakes: [],
    video: null,
    image: null,
  },
  barbell_curl: {
    setup: "Stand holding a barbell with an underhand grip, arms extended.",
    execution: "Curl it up toward your shoulders, then lower under control.",
    cues: ["Keep your elbows pinned at your sides — don't let them drift forward."],
    mistakes: [],
    video: null,
    image: null,
  },
  hammer_curl: {
    setup: "Stand holding a dumbbell in each hand with a neutral (palms-facing-in) grip.",
    execution: "Curl up toward your shoulders, then lower under control.",
    cues: ["Keep your wrists neutral the whole rep, no twisting."],
    mistakes: [],
    video: null,
    image: null,
  },
  tricep_pushdown: {
    setup: "Stand facing a cable machine with a bar or rope attachment at chest height.",
    execution: "Push down until your arms are fully extended, then let it rise back under control.",
    cues: ["Keep your elbows pinned at your sides — only your forearms should move."],
    mistakes: [],
    video: null,
    image: null,
  },
  overhead_tricep_ext: {
    setup: "Hold a dumbbell or rope attachment overhead with both hands.",
    execution: "Lower it behind your head by bending your elbows, then extend back up.",
    cues: ["Keep your elbows pointed forward and close to your head throughout."],
    mistakes: [],
    video: null,
    image: null,
  },
  calf_raise_standing: {
    setup: "Stand on the machine's platform with the balls of your feet on the edge.",
    execution: "Rise up onto your toes as high as you can, then lower your heels below the platform for a full stretch.",
    cues: ["Pause briefly at the top of each rep instead of bouncing."],
    mistakes: [],
    video: null,
    image: null,
  },
  cable_crunch: {
    setup: "Kneel facing a cable machine with a rope attachment overhead, holding the rope by your head.",
    execution: "Crunch down by curling your torso toward your hips, then return under control.",
    cues: ["Move from your abs, not your hips — keep your hips mostly still."],
    mistakes: [],
    video: null,
    image: null,
  },

  // ---------------- new coverage: next-most-frequent movements across the catalog ----------
  deadlift: {
    setup: "Stand with the bar over your mid-foot, feet hip-width apart. Bend down and grip the bar just outside your legs with your back flat and chest up.",
    execution: "Stand up by driving through your legs and extending your hips, keeping the bar close to your shins and thighs the whole way up. Reverse the motion to lower it back down.",
    cues: [
      "Keep the bar brushing your legs on the way up — a bar that drifts forward makes the lift much harder.",
      "Think 'push the floor away' with your legs rather than 'pull the bar up' with your back.",
    ],
    mistakes: [
      "Letting your lower back round under load — stop the set and lighten the weight if this happens.",
      "Starting with your hips too low, turning the pull into a squat instead of a hinge.",
    ],
    video: null,
    image: null,
  },
  pullup: {
    setup: "Hang from the bar with an overhand grip, slightly wider than shoulder width, arms fully extended.",
    execution: "Pull yourself up until your chin clears the bar, then lower back down under control to a full hang.",
    cues: [
      "Initiate the pull by driving your elbows down toward your hips, not by yanking with your arms.",
      "A full hang at the bottom of every rep gets you more out of each one than a half-rep.",
    ],
    mistakes: [
      "Kipping or swinging your legs to generate momentum instead of pulling with your back and arms.",
      "Stopping short of a full hang at the bottom, which shortchanges the rep.",
    ],
    video: null,
    image: null,
  },
  chinup: {
    setup: "Hang from the bar with an underhand (palms facing you) grip, about shoulder width, arms fully extended.",
    execution: "Pull yourself up until your chin clears the bar, then lower back down under control to a full hang.",
    cues: ["The underhand grip brings your biceps in more than a pull-up — still focus on pulling with your back first."],
    mistakes: ["Using only your arms to pull instead of engaging your back — think 'elbows down,' not 'hands toward you.'"],
    video: null,
    image: null,
  },
  pushup: {
    setup: "Start in a plank position with your hands slightly wider than shoulder width, body in a straight line from head to heels.",
    execution: "Lower your chest toward the floor by bending your elbows, then press back up to full arm extension.",
    cues: [
      "Keep your core braced so your hips don't sag or pike up — your body should move as one straight line.",
      "If a full push-up is too hard right now, do them from your knees instead — same form, shorter lever.",
    ],
    mistakes: [
      "Letting your hips sag toward the floor, which puts unnecessary stress on your lower back.",
      "Only lowering halfway instead of bringing your chest close to the floor.",
    ],
    video: null,
    image: null,
  },
  hip_thrust: {
    setup: "Sit on the floor with your upper back against a bench and a barbell across your hips. Plant your feet flat, knees bent.",
    execution: "Drive through your heels to raise your hips until your body forms a straight line from shoulders to knees, then lower back down under control.",
    cues: ["Squeeze your glutes hard at the top for a one-second pause before lowering."],
    mistakes: ["Overextending your lower back at the top instead of stopping at a straight hip-to-shoulder line."],
    video: null,
    image: null,
  },
  bulgarian_split_squat: {
    setup: "Stand a couple feet in front of a bench, rest the top of one foot on it behind you, and balance on your front leg.",
    execution: "Bend your front knee to lower your back knee toward the floor, then push through your front foot to stand back up.",
    cues: ["Keep most of your weight on your front leg — the back foot is just there for balance."],
    mistakes: ["Standing too close to the bench, which cramps the movement and shifts weight forward onto your toes."],
    video: null,
    image: null,
  },
  step_up: {
    setup: "Stand facing a box or bench at about knee height, one foot planted on top of it.",
    execution: "Drive through the foot on the box to stand all the way up on it, then step back down under control.",
    cues: ["Push through your whole foot, not just your toes, and avoid pushing off your back leg to help."],
    mistakes: ["Using the trailing leg to push off the ground instead of letting the working leg do the work."],
    video: null,
    image: null,
  },
  goblet_squat: {
    setup: "Hold a dumbbell vertically against your chest with both hands, feet about shoulder-width apart.",
    execution: "Bend your hips and knees to squat down until your thighs are at least parallel to the floor, then stand back up.",
    cues: ["A great first squat variation — holding the weight in front naturally helps keep your chest up."],
    mistakes: ["Letting your knees cave inward as you descend — keep them tracking over your toes."],
    video: null,
    image: null,
  },
  single_arm_db_row: {
    setup: "Place one knee and hand on a bench for support, back flat, holding a dumbbell in the other hand hanging straight down.",
    execution: "Pull the dumbbell up toward your hip by driving your elbow back, then lower it under control to a full stretch.",
    cues: ["Keep your torso still and roughly parallel to the floor — the pull should come from your back, not from twisting."],
    mistakes: ["Rotating your torso to help lift the weight instead of keeping it square to the floor."],
    video: null,
    image: null,
  },
  seated_row: {
    setup: "Sit at the machine with your feet on the footplate, knees slightly bent, and grip the handle with arms extended.",
    execution: "Pull the handle toward your torso by driving your elbows back, keeping your back upright, then extend back out under control.",
    cues: ["Avoid rocking your torso back and forth — let your arms and back do the pulling."],
    mistakes: ["Rounding your lower back at the start of the pull instead of sitting tall throughout."],
    video: null,
    image: null,
  },
  face_pull: {
    setup: "Set a cable or band at upper-chest to head height with a rope attachment. Grip one end in each hand, arms extended.",
    execution: "Pull the rope toward your face, flaring your elbows out wide and squeezing your shoulder blades together, then return under control.",
    cues: ["Aim the pull toward your eyebrows, and finish with your hands outside your ears — this is a shoulder-health staple, light weight is fine."],
    mistakes: ["Using too much weight, which turns it into a row instead of the intended rear-shoulder/upper-back movement."],
    video: null,
    image: null,
  },
  plank: {
    setup: "Get into a forearm-supported plank position, elbows under your shoulders, body in a straight line from head to heels. (This catalog entry is a weighted plank — a plate or light weight is placed on your upper back once the bodyweight version is comfortable.)",
    execution: "Hold the straight-line position for time, breathing normally, without letting your hips sag or pike up.",
    cues: ["Squeeze your glutes and brace your core as if about to be poked in the stomach — that tension is what holds the line."],
    mistakes: ["Letting your hips drop toward the floor as fatigue sets in, which is usually the first sign to end the set."],
    video: null,
    image: null,
  },
  db_shoulder_press: {
    setup: "Sit or stand holding a dumbbell in each hand at shoulder height, palms facing forward.",
    execution: "Press both dumbbells straight overhead until your arms are fully extended, then lower back to shoulder height under control.",
    cues: ["Keep your core braced and avoid excessive back arch as you press, especially standing."],
    mistakes: ["Pressing the dumbbells forward instead of straight up, which puts unnecessary strain on the shoulders."],
    video: null,
    image: null,
  },
  walking_lunge: {
    setup: "Stand tall holding dumbbells at your sides (or bodyweight to start).",
    execution: "Step forward into a lunge, bending both knees until your back knee nearly touches the floor, then push off your front foot to step into the next lunge.",
    cues: ["Keep your torso upright through each step rather than leaning forward over your front knee."],
    mistakes: ["Taking too short a step, which drives your front knee too far forward past your toes."],
    video: null,
    image: null,
  },
  db_bench: {
    setup: "Lie on a flat bench holding a dumbbell in each hand at chest level, palms facing forward.",
    execution: "Press both dumbbells straight up until your arms are fully extended, then lower them back to chest level under control.",
    cues: ["Dumbbells let your hands move slightly inward at the top — don't force them to stay shoulder-width."],
    mistakes: ["Letting the dumbbells drift too far apart or crash together at the top instead of a controlled, even path."],
    video: null,
    image: null,
  },
  db_curl: {
    setup: "Stand holding a dumbbell in each hand with an underhand grip, arms extended at your sides.",
    execution: "Curl one or both dumbbells up toward your shoulders, rotating your palms to face up if starting neutral, then lower under control.",
    cues: ["Keep your elbows pinned at your sides throughout — don't swing them forward to help."],
    mistakes: ["Using body momentum (leaning back, swinging) to heave the weight up instead of a controlled curl."],
    video: null,
    image: null,
  },
  skullcrusher: {
    setup: "Lie on a flat bench holding an EZ-bar with a close, overhand grip, arms extended straight up over your chest.",
    execution: "Bend only your elbows to lower the bar toward your forehead, then extend back up to the start.",
    cues: ["Keep your upper arms still and pointed straight up — only your forearms should move."],
    mistakes: ["Letting your elbows drift backward (toward your head) as the bar lowers, which turns it into a different movement and risks the bar path."],
    video: null,
    image: null,
  },
  russian_twist: {
    setup: "Sit on the floor with your knees bent, leaning back slightly so your torso is at roughly 45°. Hold a weight (or just your hands together) in front of your chest.",
    execution: "Rotate your torso to bring the weight to one side near the floor, then rotate through to the other side.",
    cues: ["Move slowly and under control — speed here usually means momentum is doing the work instead of your core."],
    mistakes: ["Rounding your lower back instead of rotating from your torso with a tall, braced spine."],
    video: null,
    image: null,
  },
  back_extension: {
    setup: "Position your hips on the pad of a back-extension bench, ankles secured, body bent forward at the hips.",
    execution: "Raise your torso up until your body forms a straight line, then lower back down under control to the starting bend.",
    cues: ["Think about hinging from your hips, not arching your lower back at the top."],
    mistakes: ["Hyperextending past a straight line at the top, which loads the lower back instead of the hamstrings/glutes."],
    video: null,
    image: null,
  },
  hanging_leg_raise: {
    setup: "Hang from a pull-up bar with your arms fully extended, legs straight (or knees bent to start, which is easier).",
    execution: "Raise your legs (or knees) up toward your chest by curling your hips under, then lower back down under control.",
    cues: ["Start with bent knees if straight-leg raises are too hard — same movement, shorter lever, nothing wrong with that."],
    mistakes: ["Swinging your whole body to generate momentum instead of lifting with your abs."],
    video: null,
    image: null,
  },
};

export function getExerciseInstruction(exId) {
  return EXERCISE_INSTRUCTIONS[exId] || null;
}

export function hasInstructionContent(exId) {
  const entry = EXERCISE_INSTRUCTIONS[exId];
  return !!(entry && (entry.setup || entry.execution || (entry.cues && entry.cues.length) || entry.video || entry.image));
}

// Splits a single paragraph (execution, or any other prose string) into discrete numbered steps
// for the How To tab's red-numbered-circle list. A mechanical sentence-boundary split, not a
// rewrite — it doesn't change or add to the underlying text, just its presentation. Falls back to
// the whole paragraph as one "step" if it doesn't split cleanly.
export function instructionSteps(text) {
  if (!text) return [];
  const steps = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return steps.length ? steps : [text];
}
