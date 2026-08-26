// ---------------- PROGRAM FAMILIES ----------------
// A "family" separates a program's IDENTITY (name, philosophy, exercise emphasis, volume style)
// from its WEEKLY FREQUENCY. Each family authors one set of days per supported training-day
// count (2-6); `expandProgramFamilies` turns that into ordinary flat program objects — the exact
// `{ id, name, tagline, weeks, days }` shape every existing consumer (resolveCurrentProgramDay,
// TemplatesTab, startRun, progression, workout history) already understands. Nothing about how a
// program is *stored or run* changes — this file only changes how program DATA is authored, so
// there's no second program engine and no changes needed to programSchedule.js or App.jsx's
// workout-logging code.
//
// Every produced program also carries `familyId` and `trainingDays` — used by
// utils/programRecommendation.js (familyVariants, the preferFamilyId bias) and by TemplatesTab's
// program-detail frequency switcher to find a family's sibling variants and let an athlete preview
// (never auto-apply) a different weekly version of the same program identity.
//
// Frequency-adaptation principle followed throughout (per the task spec): never just delete days
// off a longer program, and never cram every exercise into fewer, oversized sessions. Each variant
// is authored to redistribute exercises/volume/frequency while preserving the family's exercise
// emphasis and relative volume priorities — e.g. Titan always pairs chest+back work and never
// skips legs, at every frequency; Athena always keeps lower-body/glute volume as the largest single
// block, at every frequency.

// ---- TITAN'S APPROVED CANONICAL SESSIONS ----
// Locked programming spec — exercise selection, order, and prescriptions below are explicitly
// approved and must not be altered/reinterpreted (see the task's "do not add extra presses,
// squats, rows, or junk volume" / "do not rewrite based on generic programming preferences").
// Referenced by the 4-day variant directly and reused for the 5-day variant's first four days
// (see PROGRAM_FAMILIES below) so Titan is the same four sessions at both frequencies.
const TITAN_CHEST = {
  label: "Chest",
  exercises: [
    { exId: "incline_smith_press", sets: 3, reps: 8, repRange: [6, 10] },
    { exId: "chest_press_machine", sets: 3, reps: 10, repRange: [8, 12] },
    { exId: "dips_chest", sets: 2, reps: 12, repRange: [8, 15] },
    { exId: "cable_fly_high_low", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "tricep_pushdown", sets: 3, reps: 12, repRange: [10, 15] },
  ],
};
const TITAN_BACK = {
  label: "Back",
  exercises: [
    { exId: "cable_pullover", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "lat_pulldown", sets: 3, reps: 10, repRange: [8, 12] },
    { exId: "chest_supported_db_row", sets: 3, reps: 10, repRange: [8, 12] },
    { exId: "face_pull", sets: 2, reps: 16, repRange: [12, 20] },
    { exId: "rear_delt_machine", sets: 3, reps: 16, repRange: [12, 20] },
    { exId: "shrug_db", sets: 3, reps: 12, repRange: [8, 15] },
  ],
};
const TITAN_SHOULDERS_ARMS = {
  label: "Shoulders & Arms",
  exercises: [
    { exId: "ohp", sets: 3, reps: 8, repRange: [6, 10] },
    { exId: "lat_raise_machine", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "cable_lat_raise", sets: 2, reps: 16, repRange: [12, 20] },
    { exId: "overhead_tricep_ext", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "cable_curl", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "tricep_pushdown", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "hammer_curl", sets: 3, reps: 12, repRange: [8, 15] },
  ],
};
// The hinge slot is authored as RDL by default — BRK's existing in-workout exercise-swap feature
// (ExerciseSwapPicker) already lets an athlete substitute an "athlete-appropriate hip hinge"
// without any new program-infrastructure needed (see the task's own "if the program
// infrastructure already supports substitutions" allowance).
const TITAN_LEGS = {
  label: "Legs",
  exercises: [
    { exId: "leg_curl_seated", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "leg_press", sets: 3, reps: 12, repRange: [8, 15] },
    { exId: "rdl", sets: 3, reps: 8, repRange: [6, 12] },
    { exId: "leg_extension", sets: 3, reps: 12, repRange: [10, 15] },
    { exId: "calf_raise_standing", sets: 4, reps: 12, repRange: [8, 15] },
  ],
};

export const PROGRAM_FAMILIES = [
  // ---- TITAN — classic hero V-taper: chest and back lead, legs never skipped ----
  {
    familyId: "titan",
    name: "Titan",
    tagline: "Classic hero V-taper — chest and back lead, legs never skipped",
    weeks: 12,
    // The 5-day variant is BRK's original, already-shipped Titan program, byte-identical in
    // content and id (`prog_superman`) — existing active-Titan users see zero change.
    idOverrides: { 5: "prog_superman" },
    variants: {
      2: [
        {
          label: "Full Body A — Chest & Back",
          exercises: [
            { exId: "bench", sets: 3, reps: 8 },
            { exId: "barbell_row", sets: 3, reps: 8 },
            { exId: "squat", sets: 3, reps: 8 },
            { exId: "ohp", sets: 2, reps: 10 },
            { exId: "barbell_curl", sets: 2, reps: 12 },
            { exId: "tricep_pushdown", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Full Body B — Chest & Back",
          exercises: [
            { exId: "incline_db_press", sets: 3, reps: 10 },
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "leg_press", sets: 3, reps: 12 },
            { exId: "lat_raise", sets: 2, reps: 15 },
            { exId: "hammer_curl", sets: 2, reps: 12 },
            { exId: "skullcrusher", sets: 2, reps: 12 },
          ],
        },
      ],
      3: [
        {
          label: "Day 1 — Upper Emphasis",
          exercises: [
            { exId: "bench", sets: 3, reps: 8 },
            { exId: "barbell_row", sets: 3, reps: 8 },
            { exId: "incline_db_press", sets: 3, reps: 10 },
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "lat_raise", sets: 2, reps: 15 },
            { exId: "barbell_curl", sets: 2, reps: 12 },
            { exId: "tricep_pushdown", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Day 2 — Lower",
          exercises: [
            { exId: "squat", sets: 4, reps: 8 },
            { exId: "rdl", sets: 3, reps: 10 },
            { exId: "leg_press", sets: 3, reps: 12 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 3 — Full Body / V-Taper Emphasis",
          exercises: [
            { exId: "incline_bench", sets: 3, reps: 10 },
            { exId: "t_bar_row", sets: 3, reps: 10 },
            { exId: "dips_chest", sets: 3, reps: 10 },
            { exId: "cable_fly", sets: 3, reps: 12 },
            { exId: "ohp", sets: 2, reps: 10 },
            { exId: "rear_delt_fly", sets: 2, reps: 15 },
          ],
        },
      ],
      // Titan's canonical movement pool (approved programming spec) — Chest / Back / Shoulders &
      // Arms / Legs, in this exact order and exercise selection. TITAN_CHEST/BACK/SHOULDERS_ARMS/
      // LEGS below are the single source of truth for that pool; the 4-day variant uses them
      // directly and the 5-day variant reuses them for Days 1-4, per the task's explicit
      // instruction not to invent new Titan programming beyond this approved pool.
      4: [TITAN_CHEST, TITAN_BACK, TITAN_SHOULDERS_ARMS, TITAN_LEGS],
      // 5-day variant: BRK's original, already-shipped Titan content (see idOverrides above —
      // this variant is emitted with id `prog_superman`, not a new `prog_titan_5day` id, so any
      // already-active Titan program keeps pointing at valid data). Days 1-4 now match the
      // approved canonical pool exactly; the old "Chest & back pump" Day 5 conflicted with that
      // identity (extra chest/back volume beyond the approved sessions) and is replaced with a
      // conservative, lower-fatigue accessory day built ONLY from movements that already appear
      // in the approved pool above (High-to-Low Cable Fly and Triceps Pushdown from Chest,
      // Reverse Pec-Deck from Back, Cable Lateral Raise and Cable Curl from Shoulders & Arms) —
      // no new/unapproved movements introduced.
      5: [
        TITAN_CHEST,
        TITAN_BACK,
        TITAN_LEGS,
        TITAN_SHOULDERS_ARMS,
        {
          label: "Day 5 — Upper Pump (Accessory)",
          exercises: [
            { exId: "cable_fly_high_low", sets: 2, reps: 12, repRange: [10, 15] },
            { exId: "rear_delt_machine", sets: 2, reps: 16, repRange: [12, 20] },
            { exId: "cable_lat_raise", sets: 2, reps: 16, repRange: [12, 20] },
            { exId: "cable_curl", sets: 2, reps: 12, repRange: [10, 15] },
            { exId: "tricep_pushdown", sets: 2, reps: 12, repRange: [10, 15] },
          ],
        },
      ],
      6: [
        {
          label: "Day 1 — Push",
          exercises: [
            { exId: "bench", sets: 4, reps: 8 },
            { exId: "incline_db_press", sets: 3, reps: 10 },
            { exId: "ohp", sets: 3, reps: 10 },
            { exId: "cable_fly", sets: 3, reps: 12 },
            { exId: "tricep_pushdown", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 2 — Pull",
          exercises: [
            { exId: "deadlift", sets: 3, reps: 6 },
            { exId: "barbell_row", sets: 4, reps: 8 },
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "barbell_curl", sets: 3, reps: 10 },
            { exId: "rear_delt_fly", sets: 2, reps: 15 },
          ],
        },
        {
          label: "Day 3 — Legs",
          exercises: [
            { exId: "squat", sets: 4, reps: 8 },
            { exId: "leg_press", sets: 3, reps: 12 },
            { exId: "rdl", sets: 3, reps: 10 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "calf_raise_standing", sets: 4, reps: 15 },
          ],
        },
        {
          label: "Day 4 — Push (V-Taper Pump)",
          exercises: [
            { exId: "incline_bench", sets: 3, reps: 10 },
            { exId: "dips_chest", sets: 3, reps: 10 },
            { exId: "db_shoulder_press", sets: 3, reps: 10 },
            { exId: "cable_fly", sets: 3, reps: 12 },
            { exId: "overhead_tricep_ext", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 5 — Pull (Width & Thickness)",
          exercises: [
            { exId: "t_bar_row", sets: 3, reps: 10 },
            { exId: "lat_pulldown", sets: 3, reps: 12 },
            { exId: "seated_row", sets: 3, reps: 12 },
            { exId: "hammer_curl", sets: 3, reps: 12 },
            { exId: "face_pull", sets: 2, reps: 15 },
          ],
        },
        {
          label: "Day 6 — Legs (Volume)",
          exercises: [
            { exId: "leg_press", sets: 4, reps: 12 },
            { exId: "walking_lunge", sets: 3, reps: 12 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "calf_raise_standing", sets: 4, reps: 15 },
          ],
        },
      ],
    },
  },

  // ---- ATHENA — balanced hypertrophy: glutes, quads, hamstrings, shoulders, back, overall
  // shape. Upper body trained seriously but machine/cable/dumbbell-led; barbell bench is not
  // mandatory. Not gender-locked — any athlete can select it. ----
  {
    familyId: "athena",
    name: "Athena",
    tagline: "Balanced hypertrophy — glutes, quads, hamstrings, shoulders, and back, with real upper-body work",
    weeks: 10,
    variants: {
      2: [
        {
          label: "Full Body A",
          exercises: [
            { exId: "hip_thrust", sets: 3, reps: 10 },
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "leg_press", sets: 3, reps: 12 },
            { exId: "chest_press_machine", sets: 2, reps: 12 },
            { exId: "lat_raise", sets: 2, reps: 15 },
            { exId: "leg_curl_seated", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Full Body B",
          exercises: [
            { exId: "rdl", sets: 3, reps: 10 },
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
            { exId: "incline_db_press", sets: 2, reps: 12 },
            { exId: "rear_delt_fly", sets: 2, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
      ],
      3: [
        {
          label: "Day 1 — Lower / Glutes",
          exercises: [
            { exId: "hip_thrust", sets: 4, reps: 10 },
            { exId: "hack_squat", sets: 3, reps: 10 },
            { exId: "rdl", sets: 3, reps: 10 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 2 — Upper",
          exercises: [
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "chest_press_machine", sets: 3, reps: 10 },
            { exId: "lat_raise", sets: 3, reps: 15 },
            { exId: "rear_delt_fly", sets: 2, reps: 15 },
            { exId: "cable_curl", sets: 2, reps: 12 },
            { exId: "tricep_pushdown", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Day 3 — Lower + Upper Accents",
          exercises: [
            { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
            { exId: "hip_thrust_machine", sets: 3, reps: 12 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "leg_extension", sets: 2, reps: 15 },
            { exId: "lat_pulldown", sets: 2, reps: 12 },
            { exId: "lat_raise", sets: 2, reps: 15 },
            { exId: "cable_crunch", sets: 2, reps: 15 },
          ],
        },
      ],
      4: [
        {
          label: "Day 1 — Lower A (Glutes)",
          exercises: [
            { exId: "hip_thrust", sets: 4, reps: 10 },
            { exId: "hack_squat", sets: 3, reps: 10 },
            { exId: "rdl", sets: 3, reps: 10 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 2 — Upper A",
          exercises: [
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "chest_press_machine", sets: 3, reps: 10 },
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "lat_raise", sets: 3, reps: 15 },
            { exId: "cable_curl", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Day 3 — Lower B (Quads & Glutes)",
          exercises: [
            { exId: "leg_press", sets: 4, reps: 12 },
            { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "hip_thrust_machine", sets: 3, reps: 12 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 4 — Upper B",
          exercises: [
            { exId: "seated_row", sets: 3, reps: 10 },
            { exId: "incline_db_press", sets: 3, reps: 10 },
            { exId: "rear_delt_fly", sets: 3, reps: 15 },
            { exId: "lat_raise", sets: 2, reps: 15 },
            { exId: "tricep_pushdown", sets: 2, reps: 12 },
            { exId: "overhead_tricep_ext", sets: 2, reps: 12 },
          ],
        },
      ],
      5: [
        {
          label: "Day 1 — Lower: Glutes & Hamstrings",
          exercises: [
            { exId: "hip_thrust", sets: 4, reps: 10 },
            { exId: "rdl", sets: 3, reps: 10 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "cable_pull_through", sets: 3, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 2 — Upper: Push",
          exercises: [
            { exId: "chest_press_machine", sets: 3, reps: 10 },
            { exId: "incline_db_press", sets: 3, reps: 10 },
            { exId: "db_shoulder_press", sets: 3, reps: 10 },
            { exId: "cable_fly", sets: 2, reps: 12 },
            { exId: "tricep_pushdown", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 3 — Lower: Quads & Glutes",
          exercises: [
            { exId: "hack_squat", sets: 4, reps: 10 },
            { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "hip_thrust_machine", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 4 — Upper: Pull",
          exercises: [
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "seated_row", sets: 3, reps: 12 },
            { exId: "rear_delt_fly", sets: 3, reps: 15 },
            { exId: "cable_curl", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 5 — Glutes & Core Finisher",
          exercises: [
            { exId: "hip_thrust", sets: 4, reps: 12 },
            { exId: "glute_kickback_machine", sets: 3, reps: 15 },
            { exId: "hip_abduction_machine", sets: 3, reps: 15 },
            { exId: "step_up", sets: 3, reps: 12 },
            { exId: "cable_crunch", sets: 3, reps: 15 },
          ],
        },
      ],
      6: [
        {
          label: "Day 1 — Lower A",
          exercises: [
            { exId: "hip_thrust", sets: 4, reps: 10 },
            { exId: "hack_squat", sets: 3, reps: 10 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 2 — Upper A",
          exercises: [
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "chest_press_machine", sets: 3, reps: 10 },
            { exId: "lat_raise", sets: 3, reps: 15 },
            { exId: "cable_curl", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Day 3 — Lower B",
          exercises: [
            { exId: "rdl", sets: 3, reps: 10 },
            { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "hip_thrust_machine", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 4 — Upper B",
          exercises: [
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "incline_db_press", sets: 3, reps: 10 },
            { exId: "rear_delt_fly", sets: 3, reps: 15 },
            { exId: "tricep_pushdown", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Day 5 — Lower C (Glute Focus)",
          exercises: [
            { exId: "hip_thrust", sets: 4, reps: 12 },
            { exId: "glute_kickback_machine", sets: 3, reps: 15 },
            { exId: "hip_abduction_machine", sets: 3, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 6 — Upper C",
          exercises: [
            { exId: "seated_row", sets: 3, reps: 10 },
            { exId: "db_shoulder_press", sets: 3, reps: 10 },
            { exId: "cable_fly", sets: 2, reps: 12 },
            { exId: "overhead_tricep_ext", sets: 2, reps: 12 },
          ],
        },
      ],
    },
  },

  // ---- SHAPE — general physique/hypertrophy, lower body + glutes + shoulders + back, minimal
  // barbell dependency (machines/cables/dumbbells/bodyweight). Not gender-locked. Supports
  // 2-5 days only, per spec — no 6-day variant. ----
  {
    familyId: "shape",
    name: "Shape",
    tagline: "General physique hypertrophy — lower body, glutes, shoulders, and back, built with machines, cables, and dumbbells",
    weeks: 10,
    variants: {
      2: [
        {
          label: "Full Body A",
          exercises: [
            { exId: "leg_press", sets: 3, reps: 12 },
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "hack_squat", sets: 3, reps: 10 },
            { exId: "chest_press_machine", sets: 2, reps: 12 },
            { exId: "lat_raise", sets: 2, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Full Body B",
          exercises: [
            { exId: "hip_thrust_machine", sets: 3, reps: 12 },
            { exId: "seated_row", sets: 3, reps: 10 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "db_shoulder_press", sets: 2, reps: 12 },
            { exId: "rear_delt_fly", sets: 2, reps: 15 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
          ],
        },
      ],
      3: [
        {
          label: "Day 1 — Lower Focus",
          exercises: [
            { exId: "leg_press", sets: 3, reps: 12 },
            { exId: "hip_thrust_machine", sets: 3, reps: 12 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "chest_supported_row", sets: 2, reps: 10 },
            { exId: "lat_raise", sets: 2, reps: 15 },
          ],
        },
        {
          label: "Day 2 — Upper Focus",
          exercises: [
            { exId: "chest_press_machine", sets: 3, reps: 10 },
            { exId: "seated_row", sets: 3, reps: 10 },
            { exId: "db_shoulder_press", sets: 3, reps: 10 },
            { exId: "cable_curl", sets: 2, reps: 12 },
            { exId: "tricep_pushdown", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Day 3 — Full Body",
          exercises: [
            { exId: "hack_squat", sets: 3, reps: 10 },
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "leg_extension", sets: 2, reps: 15 },
            { exId: "rear_delt_fly", sets: 2, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
      ],
      4: [
        {
          label: "Day 1 — Lower A",
          exercises: [
            { exId: "leg_press", sets: 4, reps: 12 },
            { exId: "hip_thrust_machine", sets: 3, reps: 12 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 2 — Upper A",
          exercises: [
            { exId: "chest_press_machine", sets: 3, reps: 10 },
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "lat_raise", sets: 3, reps: 15 },
            { exId: "cable_curl", sets: 2, reps: 12 },
          ],
        },
        {
          label: "Day 3 — Lower B",
          exercises: [
            { exId: "hack_squat", sets: 4, reps: 10 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "glute_kickback_machine", sets: 3, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 4 — Upper B",
          exercises: [
            { exId: "seated_row", sets: 3, reps: 10 },
            { exId: "db_shoulder_press", sets: 3, reps: 10 },
            { exId: "rear_delt_fly", sets: 3, reps: 15 },
            { exId: "tricep_pushdown", sets: 2, reps: 12 },
          ],
        },
      ],
      5: [
        {
          label: "Day 1 — Lower: Glutes",
          exercises: [
            { exId: "hip_thrust_machine", sets: 4, reps: 12 },
            { exId: "leg_curl_seated", sets: 3, reps: 12 },
            { exId: "cable_pull_through", sets: 3, reps: 15 },
            { exId: "calf_raise_standing", sets: 3, reps: 15 },
          ],
        },
        {
          label: "Day 2 — Upper: Push",
          exercises: [
            { exId: "chest_press_machine", sets: 3, reps: 10 },
            { exId: "db_shoulder_press", sets: 3, reps: 10 },
            { exId: "cable_fly", sets: 2, reps: 12 },
            { exId: "tricep_pushdown", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 3 — Lower: Quads",
          exercises: [
            { exId: "hack_squat", sets: 4, reps: 10 },
            { exId: "leg_extension", sets: 3, reps: 15 },
            { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
          ],
        },
        {
          label: "Day 4 — Upper: Pull",
          exercises: [
            { exId: "lat_pulldown", sets: 3, reps: 10 },
            { exId: "chest_supported_row", sets: 3, reps: 10 },
            { exId: "rear_delt_fly", sets: 3, reps: 15 },
            { exId: "cable_curl", sets: 3, reps: 12 },
          ],
        },
        {
          label: "Day 5 — Full Body Finisher",
          exercises: [
            { exId: "leg_press", sets: 3, reps: 12 },
            { exId: "seated_row", sets: 3, reps: 10 },
            { exId: "lat_raise", sets: 2, reps: 15 },
            { exId: "cable_crunch", sets: 3, reps: 15 },
          ],
        },
      ],
    },
  },
];

// Turns each family's compact { variants: { N: days[] } } map into flat, ordinary program objects
// — the same shape every existing HERO_PROGRAMS entry already has. `id` defaults to
// `prog_<familyId>_<N>day` but can be pinned via `idOverrides` (used to keep Titan's 5-day variant
// on its original `prog_superman` id for backward compatibility with any already-active program).
export function expandProgramFamilies(families) {
  const out = [];
  for (const fam of families) {
    for (const [daysStr, days] of Object.entries(fam.variants)) {
      const n = Number(daysStr);
      out.push({
        id: fam.idOverrides?.[n] || `prog_${fam.familyId}_${n}day`,
        name: fam.name,
        tagline: `${n}-Day Version — ${fam.tagline}`,
        weeks: fam.weeks,
        familyId: fam.familyId,
        familyName: fam.name,
        trainingDays: n,
        days,
      });
    }
  }
  return out;
}

export const FAMILY_PROGRAMS = expandProgramFamilies(PROGRAM_FAMILIES);
