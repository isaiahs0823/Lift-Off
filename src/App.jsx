import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  ArrowLeftRight,
  Flame,
  Dumbbell,
  ClipboardList,
  TrendingUp,
  X,
  Star,
  Search,
  Check,
  Timer,
  Settings,
  Download,
  Upload,
} from "lucide-react";

// B.R.E.A.K. logo (uploaded asset, embedded as data URI so the artifact stays self-contained)
const BREAK_LOGO =
  "data:image/jpeg;base64,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";

// ---------- Exercise library ----------
const EXERCISE_LIBRARY = [
  // Chest
  { id: "bench", name: "Barbell bench press", type: "compound", muscle: "Chest" },
  { id: "incline_bench", name: "Incline barbell bench press", type: "compound", muscle: "Chest" },
  { id: "decline_bench", name: "Decline barbell bench press", type: "compound", muscle: "Chest" },
  { id: "db_bench", name: "Flat dumbbell press", type: "compound", muscle: "Chest" },
  { id: "incline_db_press", name: "Incline dumbbell press", type: "compound", muscle: "Chest" },
  { id: "decline_db_press", name: "Decline dumbbell press", type: "compound", muscle: "Chest" },
  { id: "smith_bench", name: "Smith machine bench press", type: "compound", muscle: "Chest" },
  { id: "chest_press_machine", name: "Chest press machine", type: "compound", muscle: "Chest" },
  { id: "incline_chest_press_machine", name: "Incline chest press machine", type: "compound", muscle: "Chest" },
  { id: "pec_deck", name: "Pec deck / chest fly machine", type: "isolation", muscle: "Chest" },
  { id: "cable_fly", name: "Cable fly (mid)", type: "isolation", muscle: "Chest" },
  { id: "cable_fly_low_high", name: "Low-to-high cable fly", type: "isolation", muscle: "Chest" },
  { id: "cable_fly_high_low", name: "High-to-low cable fly", type: "isolation", muscle: "Chest" },
  { id: "db_fly", name: "Dumbbell fly", type: "isolation", muscle: "Chest" },
  { id: "dips_chest", name: "Chest dip", type: "compound", muscle: "Chest" },
  { id: "pushup", name: "Push-up", type: "compound", muscle: "Chest" },
  { id: "svend_press", name: "Svend press", type: "isolation", muscle: "Chest" },

  // Back
  { id: "deadlift", name: "Deadlift", type: "compound", muscle: "Back" },
  { id: "sumo_deadlift", name: "Sumo deadlift", type: "compound", muscle: "Back" },
  { id: "trap_bar_deadlift", name: "Trap bar deadlift", type: "compound", muscle: "Back" },
  { id: "rack_pull", name: "Rack pull", type: "compound", muscle: "Back" },
  { id: "pullup", name: "Weighted pull-up", type: "compound", muscle: "Back" },
  { id: "chinup", name: "Weighted chin-up", type: "compound", muscle: "Back" },
  { id: "assisted_pullup", name: "Assisted pull-up machine", type: "compound", muscle: "Back" },
  { id: "barbell_row", name: "Barbell row", type: "compound", muscle: "Back" },
  { id: "pendlay_row", name: "Pendlay row", type: "compound", muscle: "Back" },
  { id: "t_bar_row", name: "T-bar row", type: "compound", muscle: "Back" },
  { id: "chest_supported_row", name: "Chest-supported row machine", type: "compound", muscle: "Back" },
  { id: "single_arm_db_row", name: "Single-arm dumbbell row", type: "compound", muscle: "Back" },
  { id: "seal_row", name: "Seal row", type: "compound", muscle: "Back" },
  { id: "lat_pulldown", name: "Lat pulldown (wide grip)", type: "compound", muscle: "Back" },
  { id: "close_grip_pulldown", name: "Close-grip pulldown", type: "compound", muscle: "Back" },
  { id: "single_arm_pulldown", name: "Single-arm lat pulldown", type: "compound", muscle: "Back" },
  { id: "seated_row", name: "Seated cable row", type: "compound", muscle: "Back" },
  { id: "high_row_machine", name: "High row machine", type: "compound", muscle: "Back" },
  { id: "iso_row_machine", name: "Iso-lateral row machine", type: "compound", muscle: "Back" },
  { id: "straight_arm_pulldown", name: "Straight-arm pulldown", type: "isolation", muscle: "Back" },
  { id: "back_extension", name: "Back extension / hyperextension", type: "isolation", muscle: "Back" },
  { id: "good_morning", name: "Good morning", type: "compound", muscle: "Back" },
  { id: "shrug_barbell", name: "Barbell shrug", type: "isolation", muscle: "Back" },
  { id: "shrug_db", name: "Dumbbell shrug", type: "isolation", muscle: "Back" },
  { id: "shrug_machine", name: "Shrug machine", type: "isolation", muscle: "Back" },

  // Shoulders
  { id: "ohp", name: "Barbell overhead press", type: "compound", muscle: "Shoulders" },
  { id: "db_shoulder_press", name: "Dumbbell shoulder press", type: "compound", muscle: "Shoulders" },
  { id: "arnold_press", name: "Arnold press", type: "compound", muscle: "Shoulders" },
  { id: "seated_ohp_machine", name: "Shoulder press machine", type: "compound", muscle: "Shoulders" },
  { id: "smith_ohp", name: "Smith machine shoulder press", type: "compound", muscle: "Shoulders" },
  { id: "push_press", name: "Push press", type: "compound", muscle: "Shoulders" },
  { id: "lat_raise", name: "Dumbbell lateral raise", type: "isolation", muscle: "Shoulders" },
  { id: "cable_lat_raise", name: "Cable lateral raise", type: "isolation", muscle: "Shoulders" },
  { id: "lat_raise_machine", name: "Lateral raise machine", type: "isolation", muscle: "Shoulders" },
  { id: "front_raise", name: "Front raise", type: "isolation", muscle: "Shoulders" },
  { id: "rear_delt_fly", name: "Dumbbell rear delt fly", type: "isolation", muscle: "Shoulders" },
  { id: "cable_rear_delt_fly", name: "Cable rear delt fly", type: "isolation", muscle: "Shoulders" },
  { id: "rear_delt_machine", name: "Rear delt machine (reverse pec deck)", type: "isolation", muscle: "Shoulders" },
  { id: "face_pull", name: "Face pull", type: "isolation", muscle: "Shoulders" },
  { id: "upright_row", name: "Upright row", type: "isolation", muscle: "Shoulders" },

  // Legs — Quads/Glutes/Hams
  { id: "squat", name: "Back squat", type: "compound", muscle: "Legs" },
  { id: "front_squat", name: "Front squat", type: "compound", muscle: "Legs" },
  { id: "box_squat", name: "Box squat", type: "compound", muscle: "Legs" },
  { id: "smith_squat", name: "Smith machine squat", type: "compound", muscle: "Legs" },
  { id: "hack_squat", name: "Hack squat machine", type: "compound", muscle: "Legs" },
  { id: "goblet_squat", name: "Goblet squat", type: "compound", muscle: "Legs" },
  { id: "leg_press", name: "Leg press (45 degree)", type: "compound", muscle: "Legs" },
  { id: "vertical_leg_press", name: "Vertical leg press", type: "compound", muscle: "Legs" },
  { id: "pendulum_squat", name: "Pendulum squat machine", type: "compound", muscle: "Legs" },
  { id: "bulgarian_split_squat", name: "Bulgarian split squat", type: "compound", muscle: "Legs" },
  { id: "walking_lunge", name: "Walking lunge", type: "compound", muscle: "Legs" },
  { id: "reverse_lunge", name: "Reverse lunge", type: "compound", muscle: "Legs" },
  { id: "step_up", name: "Step-up", type: "compound", muscle: "Legs" },
  { id: "rdl", name: "Romanian deadlift", type: "compound", muscle: "Legs" },
  { id: "stiff_leg_deadlift", name: "Stiff-leg deadlift", type: "compound", muscle: "Legs" },
  { id: "hip_thrust", name: "Barbell hip thrust", type: "compound", muscle: "Legs" },
  { id: "glute_bridge", name: "Glute bridge", type: "compound", muscle: "Legs" },
  { id: "hip_thrust_machine", name: "Hip thrust machine", type: "compound", muscle: "Legs" },
  { id: "cable_pull_through", name: "Cable pull-through", type: "compound", muscle: "Legs" },
  { id: "leg_curl_seated", name: "Seated leg curl", type: "isolation", muscle: "Legs" },
  { id: "leg_curl_lying", name: "Lying leg curl", type: "isolation", muscle: "Legs" },
  { id: "nordic_curl", name: "Nordic hamstring curl", type: "isolation", muscle: "Legs" },
  { id: "leg_extension", name: "Leg extension", type: "isolation", muscle: "Legs" },
  { id: "hip_abduction_machine", name: "Hip abduction machine", type: "isolation", muscle: "Legs" },
  { id: "hip_adduction_machine", name: "Hip adduction machine", type: "isolation", muscle: "Legs" },
  { id: "glute_kickback_machine", name: "Glute kickback machine", type: "isolation", muscle: "Legs" },
  { id: "calf_raise_standing", name: "Standing calf raise", type: "isolation", muscle: "Legs" },
  { id: "calf_raise_seated", name: "Seated calf raise", type: "isolation", muscle: "Legs" },
  { id: "leg_press_calf_raise", name: "Leg press calf raise", type: "isolation", muscle: "Legs" },
  { id: "donkey_calf_raise", name: "Donkey calf raise", type: "isolation", muscle: "Legs" },

  // Arms — Biceps/Triceps/Forearms
  { id: "barbell_curl", name: "Barbell curl", type: "isolation", muscle: "Arms" },
  { id: "ez_bar_curl", name: "EZ-bar curl", type: "isolation", muscle: "Arms" },
  { id: "db_curl", name: "Dumbbell curl", type: "isolation", muscle: "Arms" },
  { id: "hammer_curl", name: "Hammer curl", type: "isolation", muscle: "Arms" },
  { id: "incline_db_curl", name: "Incline dumbbell curl", type: "isolation", muscle: "Arms" },
  { id: "preacher_curl", name: "Preacher curl (barbell/EZ)", type: "isolation", muscle: "Arms" },
  { id: "preacher_curl_machine", name: "Preacher curl machine", type: "isolation", muscle: "Arms" },
  { id: "cable_curl", name: "Cable curl", type: "isolation", muscle: "Arms" },
  { id: "concentration_curl", name: "Concentration curl", type: "isolation", muscle: "Arms" },
  { id: "spider_curl", name: "Spider curl", type: "isolation", muscle: "Arms" },
  { id: "bicep_curl_machine", name: "Bicep curl machine", type: "isolation", muscle: "Arms" },
  { id: "close_grip_bench", name: "Close-grip bench press", type: "compound", muscle: "Arms" },
  { id: "skullcrusher", name: "Skullcrusher (EZ-bar)", type: "isolation", muscle: "Arms" },
  { id: "tricep_pushdown", name: "Tricep pushdown (rope/bar)", type: "isolation", muscle: "Arms" },
  { id: "overhead_tricep_ext", name: "Overhead tricep extension", type: "isolation", muscle: "Arms" },
  { id: "db_kickback", name: "Dumbbell tricep kickback", type: "isolation", muscle: "Arms" },
  { id: "tricep_dip_machine", name: "Tricep dip machine", type: "compound", muscle: "Arms" },
  { id: "bench_dip", name: "Bench dip", type: "compound", muscle: "Arms" },
  { id: "jm_press", name: "JM press", type: "isolation", muscle: "Arms" },
  { id: "wrist_curl", name: "Wrist curl", type: "isolation", muscle: "Arms" },
  { id: "reverse_wrist_curl", name: "Reverse wrist curl", type: "isolation", muscle: "Arms" },
  { id: "farmers_carry", name: "Farmer's carry", type: "compound", muscle: "Arms" },

  // Core
  { id: "plank", name: "Weighted plank", type: "isolation", muscle: "Core" },
  { id: "hanging_leg_raise", name: "Hanging leg raise", type: "isolation", muscle: "Core" },
  { id: "hanging_knee_raise", name: "Hanging knee raise", type: "isolation", muscle: "Core" },
  { id: "ab_wheel", name: "Ab wheel rollout", type: "isolation", muscle: "Core" },
  { id: "cable_crunch", name: "Cable crunch", type: "isolation", muscle: "Core" },
  { id: "ab_machine_crunch", name: "Ab crunch machine", type: "isolation", muscle: "Core" },
  { id: "situp_weighted", name: "Weighted sit-up", type: "isolation", muscle: "Core" },
  { id: "decline_situp", name: "Decline sit-up", type: "isolation", muscle: "Core" },
  { id: "russian_twist", name: "Russian twist", type: "isolation", muscle: "Core" },
  { id: "wood_chop_cable", name: "Cable woodchop", type: "isolation", muscle: "Core" },
  { id: "side_plank", name: "Side plank", type: "isolation", muscle: "Core" },
  { id: "landmine_180", name: "Landmine 180", type: "isolation", muscle: "Core" },

  // Full body / Olympic
  { id: "power_clean", name: "Power clean", type: "compound", muscle: "Full body" },
  { id: "clean_and_jerk", name: "Clean and jerk", type: "compound", muscle: "Full body" },
  { id: "snatch", name: "Snatch", type: "compound", muscle: "Full body" },
  { id: "kb_swing", name: "Kettlebell swing", type: "compound", muscle: "Full body" },
  { id: "thruster", name: "Thruster", type: "compound", muscle: "Full body" },
  { id: "sled_push", name: "Sled push", type: "compound", muscle: "Full body" },
  { id: "battle_ropes", name: "Battle ropes", type: "isolation", muscle: "Full body" },

  // Conditioning — running, sled work, rucking
  { id: "run_easy", name: "Easy recovery run", type: "isolation", muscle: "Conditioning" },
  { id: "run_tempo", name: "Tempo run", type: "isolation", muscle: "Conditioning" },
  { id: "run_intervals", name: "Interval sprints", type: "isolation", muscle: "Conditioning" },
  { id: "hill_sprints", name: "Hill sprints", type: "isolation", muscle: "Conditioning" },
  { id: "stair_climb_intervals", name: "Stair climb intervals", type: "isolation", muscle: "Conditioning" },
  { id: "sled_drag_forward", name: "Sled drag - forward", type: "compound", muscle: "Conditioning" },
  { id: "sled_drag_backward", name: "Sled drag - backward", type: "compound", muscle: "Conditioning" },
  { id: "ruck_march", name: "Weighted ruck march", type: "compound", muscle: "Conditioning" },

  // Arsenal Strength line
  { id: "arsenal_incline_fly", name: "Arsenal Incline Fly", type: "isolation", muscle: "Chest" },
  { id: "arsenal_standing_chest_press", name: "Arsenal Standing Chest Press", type: "compound", muscle: "Chest" },
  { id: "arsenal_iso_incline_press", name: "Arsenal ISO Incline Press", type: "compound", muscle: "Chest" },
  { id: "arsenal_wide_chest_press_1", name: "Arsenal Wide Chest Press (1)", type: "compound", muscle: "Chest" },
  { id: "arsenal_converging_chest_press", name: "Arsenal Converging Chest Press", type: "compound", muscle: "Chest" },
  { id: "arsenal_pec_fly_rear_delt", name: "Arsenal Pec Fly / Rear Delt", type: "isolation", muscle: "Chest" },
  { id: "arsenal_wide_chest_press_2", name: "Arsenal Wide Chest Press (2)", type: "compound", muscle: "Chest" },
  { id: "arsenal_upright_decline_fly", name: "Arsenal Upright Decline Fly", type: "isolation", muscle: "Chest" },
  { id: "arsenal_lever_row", name: "Arsenal Lever Row", type: "compound", muscle: "Back" },
  { id: "arsenal_iso_multi_row", name: "Arsenal ISO Multi Row", type: "compound", muscle: "Back" },
  { id: "arsenal_vertical_row", name: "Arsenal Vertical Row", type: "compound", muscle: "Back" },
  { id: "arsenal_pulldown_high_row", name: "Arsenal Multi-Grip Pulldown / High Row", type: "compound", muscle: "Back" },
  { id: "arsenal_scorpion_high_row", name: "Arsenal Scorpion High Row", type: "compound", muscle: "Back" },
  { id: "arsenal_diverging_row", name: "Arsenal Diverging Row", type: "compound", muscle: "Back" },
  { id: "arsenal_seated_row", name: "Arsenal Seated Row", type: "compound", muscle: "Back" },
  { id: "arsenal_iso_shoulder_press", name: "Arsenal ISO Shoulder Press", type: "compound", muscle: "Shoulders" },
  { id: "arsenal_viking_press", name: "Arsenal Viking Press", type: "compound", muscle: "Shoulders" },
  { id: "arsenal_shoulder_press", name: "Arsenal Shoulder Press", type: "compound", muscle: "Shoulders" },
  { id: "arsenal_standing_lateral_raise", name: "Arsenal Standing Lateral Raise", type: "isolation", muscle: "Shoulders" },
  { id: "arsenal_linear_leg_press", name: "Arsenal Linear Leg Press", type: "compound", muscle: "Legs" },
  { id: "arsenal_linear_hack_squat", name: "Arsenal Linear Hack Squat", type: "compound", muscle: "Legs" },
  { id: "arsenal_leg_ext_curl_combo", name: "Arsenal Leg Extension / Seated Leg Curl Combo", type: "isolation", muscle: "Legs" },
  { id: "arsenal_belt_squat", name: "Arsenal Belt Squat", type: "compound", muscle: "Legs" },
  { id: "arsenal_power_squat", name: "Arsenal Power Squat", type: "compound", muscle: "Legs" },
  { id: "arsenal_glute_bridge", name: "Arsenal Glute Bridge", type: "compound", muscle: "Legs" },
  { id: "arsenal_ghd", name: "Arsenal GHD", type: "compound", muscle: "Legs" },
  { id: "arsenal_standing_calf_raise", name: "Arsenal Standing Calf Raise", type: "isolation", muscle: "Legs" },
  { id: "arsenal_donkey_calf_raise", name: "Arsenal Donkey Calf Raise", type: "isolation", muscle: "Legs" },
  { id: "arsenal_lying_leg_curl", name: "Arsenal Lying Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "arsenal_seated_leg_extension", name: "Arsenal Seated Leg Extension", type: "isolation", muscle: "Legs" },
  { id: "arsenal_seated_iso_bicep_curl_1", name: "Arsenal Seated ISO Bicep Curl (1)", type: "isolation", muscle: "Arms" },
  { id: "arsenal_seated_tricep_extension_1", name: "Arsenal Seated Tricep Extension (1)", type: "isolation", muscle: "Arms" },
  { id: "arsenal_tricep_kickback_dip", name: "Arsenal Tricep Kickback / Dip", type: "isolation", muscle: "Arms" },
  { id: "arsenal_seated_iso_bicep_curl_2", name: "Arsenal Seated ISO Bicep Curl (2)", type: "isolation", muscle: "Arms" },
  { id: "arsenal_seated_tricep_extension_2", name: "Arsenal Seated Tricep Extension (2)", type: "isolation", muscle: "Arms" },
];

const EX_MAP_INIT = Object.fromEntries(EXERCISE_LIBRARY.map((e) => [e.id, e]));
const MUSCLE_GROUPS = [...new Set(EXERCISE_LIBRARY.map((e) => e.muscle))];

// ---------- Default templates (RP-style split) ----------
const DEFAULT_TEMPLATES = [
  {
    id: "tpl_push",
    name: "Push",
    exercises: [
      { exId: "bench", sets: 4, reps: 8 },
      { exId: "ohp", sets: 3, reps: 10 },
      { exId: "incline_db_press", sets: 3, reps: 10 },
      { exId: "lat_raise", sets: 3, reps: 15 },
      { exId: "tricep_pushdown", sets: 3, reps: 12 },
    ],
  },
  {
    id: "tpl_pull",
    name: "Pull",
    exercises: [
      { exId: "deadlift", sets: 3, reps: 6 },
      { exId: "barbell_row", sets: 4, reps: 8 },
      { exId: "lat_pulldown", sets: 3, reps: 10 },
      { exId: "rear_delt_fly", sets: 3, reps: 15 },
      { exId: "barbell_curl", sets: 3, reps: 10 },
    ],
  },
  {
    id: "tpl_legs",
    name: "Legs",
    exercises: [
      { exId: "squat", sets: 4, reps: 8 },
      { exId: "rdl", sets: 3, reps: 10 },
      { exId: "leg_press", sets: 3, reps: 12 },
      { exId: "leg_curl_seated", sets: 3, reps: 12 },
      { exId: "calf_raise_standing", sets: 4, reps: 15 },
    ],
  },
  {
    id: "tpl_upper",
    name: "Upper",
    exercises: [
      { exId: "bench", sets: 3, reps: 8 },
      { exId: "barbell_row", sets: 3, reps: 8 },
      { exId: "ohp", sets: 3, reps: 10 },
      { exId: "lat_pulldown", sets: 3, reps: 10 },
      { exId: "hammer_curl", sets: 2, reps: 12 },
    ],
  },
  {
    id: "tpl_lower",
    name: "Lower",
    exercises: [
      { exId: "squat", sets: 4, reps: 6 },
      { exId: "leg_press", sets: 3, reps: 12 },
      { exId: "leg_extension", sets: 3, reps: 15 },
      { exId: "calf_raise_standing", sets: 4, reps: 15 },
      { exId: "hanging_leg_raise", sets: 3, reps: 12 },
    ],
  },
];

// ---------- Hero programs (multi-day, goal-specific splits) ----------
const HERO_PROGRAMS = [
  {
    id: "prog_superman",
    name: "Titan",
    tagline: "Classic hero V-taper — chest and back lead, legs never skipped",
    weeks: 12,
    days: [
      {
        label: "Day 1: Chest",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "incline_db_press", sets: 3, reps: 10 },
          { exId: "arsenal_wide_chest_press_1", sets: 3, reps: 10 },
          { exId: "cable_fly", sets: 3, reps: 12 },
          { exId: "dips_chest", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 2: Back",
        exercises: [
          { exId: "deadlift", sets: 3, reps: 6 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "lat_pulldown", sets: 3, reps: 10 },
          { exId: "arsenal_seated_row", sets: 3, reps: 12 },
          { exId: "straight_arm_pulldown", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 3: Legs",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "leg_curl_seated", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 4, reps: 15 },
        ],
      },
      {
        label: "Day 4: Shoulders & arms",
        exercises: [
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "lat_raise", sets: 3, reps: 15 },
          { exId: "barbell_curl", sets: 3, reps: 10 },
          { exId: "skullcrusher", sets: 3, reps: 10 },
          { exId: "rear_delt_fly", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Chest & back pump",
        exercises: [
          { exId: "incline_bench", sets: 3, reps: 10 },
          { exId: "t_bar_row", sets: 3, reps: 10 },
          { exId: "pec_deck", sets: 3, reps: 15 },
          { exId: "lat_pulldown", sets: 3, reps: 12 },
          { exId: "cable_fly", sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    id: "prog_batman",
    name: "Reaper",
    tagline: "Lean, athletic, low body fat — trained like a detective, not a bodybuilder",
    weeks: 10,
    days: [
      {
        label: "Day 1: Full body functional",
        exercises: [
          { exId: "pullup", sets: 4, reps: 8 },
          { exId: "pushup", sets: 4, reps: 15 },
          { exId: "goblet_squat", sets: 3, reps: 12 },
          { exId: "kb_swing", sets: 3, reps: 15 },
          { exId: "hanging_leg_raise", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 2: Pull & grip",
        exercises: [
          { exId: "chinup", sets: 4, reps: 8 },
          { exId: "single_arm_db_row", sets: 3, reps: 12 },
          { exId: "face_pull", sets: 3, reps: 15 },
          { exId: "battle_ropes", sets: 3, reps: 30 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Lower body & core",
        exercises: [
          { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
          { exId: "side_plank", sets: 3, reps: 30 },
        ],
      },
      {
        label: "Day 4: Push & conditioning",
        exercises: [
          { exId: "ohp", sets: 3, reps: 8 },
          { exId: "dips_chest", sets: 3, reps: 10 },
          { exId: "sled_push", sets: 3, reps: 1 },
          { exId: "russian_twist", sets: 3, reps: 20 },
        ],
      },
    ],
  },
  {
    id: "prog_punisher",
    name: "Berserker",
    tagline: "Raw brute strength — heavy compounds, low reps, no wasted volume",
    weeks: 8,
    days: [
      {
        label: "Day 1: Squat",
        exercises: [
          { exId: "squat", sets: 5, reps: 5 },
          { exId: "front_squat", sets: 3, reps: 5 },
          { exId: "leg_press", sets: 3, reps: 8 },
          { exId: "back_extension", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 2: Bench",
        exercises: [
          { exId: "bench", sets: 5, reps: 5 },
          { exId: "close_grip_bench", sets: 3, reps: 6 },
          { exId: "db_bench", sets: 3, reps: 8 },
          { exId: "tricep_pushdown", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 3: Deadlift",
        exercises: [
          { exId: "deadlift", sets: 5, reps: 3 },
          { exId: "rack_pull", sets: 3, reps: 5 },
          { exId: "barbell_row", sets: 4, reps: 6 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 4: Overhead & accessory",
        exercises: [
          { exId: "ohp", sets: 5, reps: 5 },
          { exId: "pullup", sets: 4, reps: 6 },
          { exId: "barbell_curl", sets: 3, reps: 8 },
          { exId: "skullcrusher", sets: 3, reps: 8 },
        ],
      },
      {
        label: "Day 5: Recovery run",
        exercises: [
          { exId: "run_easy", sets: 1, reps: 30 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 6: Tempo run + sled drag",
        exercises: [
          { exId: "run_tempo", sets: 1, reps: 20 },
          { exId: "sled_drag_forward", sets: 4, reps: 1 },
          { exId: "sled_drag_backward", sets: 4, reps: 1 },
        ],
      },
      {
        label: "Day 7: Interval sprints",
        exercises: [
          { exId: "run_intervals", sets: 8, reps: 1 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: "prog_thor",
    name: "Ragnar",
    tagline: "God-tier mass and power — huge shoulders, back, and grip",
    weeks: 10,
    days: [
      {
        label: "Day 1: Overhead power",
        exercises: [
          { exId: "ohp", sets: 5, reps: 5 },
          { exId: "push_press", sets: 3, reps: 5 },
          { exId: "arsenal_viking_press", sets: 3, reps: 8 },
          { exId: "lat_raise", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 2: Back & grip",
        exercises: [
          { exId: "deadlift", sets: 4, reps: 5 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "arsenal_lever_row", sets: 3, reps: 10 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 3: Legs & posterior chain",
        exercises: [
          { exId: "squat", sets: 4, reps: 6 },
          { exId: "rdl", sets: 3, reps: 8 },
          { exId: "hip_thrust", sets: 3, reps: 10 },
          { exId: "calf_raise_standing", sets: 4, reps: 15 },
        ],
      },
      {
        label: "Day 4: Strongman conditioning",
        exercises: [
          { exId: "sled_push", sets: 3, reps: 1 },
          { exId: "kb_swing", sets: 4, reps: 15 },
          { exId: "battle_ropes", sets: 3, reps: 30 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 5: Arms & traps",
        exercises: [
          { exId: "shrug_barbell", sets: 4, reps: 12 },
          { exId: "barbell_curl", sets: 3, reps: 10 },
          { exId: "skullcrusher", sets: 3, reps: 10 },
          { exId: "hammer_curl", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    id: "prog_firefighter",
    name: "Firefighter",
    tagline: "Job-ready functional strength — work capacity under load",
    weeks: 12,
    days: [
      {
        label: "Day 1: Upper push/pull",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "pullup", sets: 3, reps: 8 },
        ],
      },
      {
        label: "Day 2: Loaded carries & grip",
        exercises: [
          { exId: "farmers_carry", sets: 4, reps: 1 },
          { exId: "sled_push", sets: 3, reps: 1 },
          { exId: "deadlift", sets: 4, reps: 6 },
          { exId: "wrist_curl", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 3: Legs & work capacity",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Conditioning circuit",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "sled_drag_forward", sets: 4, reps: 1 },
          { exId: "hanging_leg_raise", sets: 3, reps: 12 },
          { exId: "push_press", sets: 3, reps: 8 },
        ],
      },
      {
        label: "Day 5: Full body functional",
        exercises: [
          { exId: "trap_bar_deadlift", sets: 4, reps: 6 },
          { exId: "single_arm_db_row", sets: 3, reps: 10 },
          { exId: "goblet_squat", sets: 3, reps: 12 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 6: Run & drag conditioning",
        exercises: [
          { exId: "run_intervals", sets: 6, reps: 1 },
          { exId: "sled_drag_backward", sets: 4, reps: 1 },
          { exId: "stair_climb_intervals", sets: 5, reps: 1 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
    ],
  },
  {
    id: "prog_hybrid",
    name: "Hybrid",
    tagline: "Strong and has an engine — lifting and conditioning, not one or the other",
    weeks: 10,
    days: [
      {
        label: "Day 1: Strength - upper",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "lat_pulldown", sets: 3, reps: 10 },
        ],
      },
      {
        label: "Day 2: Conditioning",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "sled_push", sets: 4, reps: 1 },
          { exId: "thruster", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Strength - lower",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Conditioning 2",
        exercises: [
          { exId: "thruster", sets: 4, reps: 12 },
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 3, reps: 30 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Strength - full body",
        exercises: [
          { exId: "deadlift", sets: 4, reps: 6 },
          { exId: "pullup", sets: 3, reps: 8 },
          { exId: "db_shoulder_press", sets: 3, reps: 10 },
          { exId: "db_curl", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 6: Mobility & recovery",
        exercises: [
          { exId: "goblet_squat", sets: 3, reps: 15 },
          { exId: "ab_wheel", sets: 3, reps: 12 },
          { exId: "face_pull", sets: 3, reps: 15 },
          { exId: "sled_push", sets: 3, reps: 1 },
        ],
      },
    ],
  },
  {
    id: "prog_military",
    name: "Military / First Responder",
    tagline: "Occupational readiness — pass the test, perform on the job",
    weeks: 8,
    days: [
      {
        label: "Day 1: PT test push/pull",
        exercises: [
          { exId: "pushup", sets: 5, reps: 20 },
          { exId: "pullup", sets: 5, reps: 10 },
          { exId: "situp_weighted", sets: 5, reps: 20 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 2: Load-bearing strength",
        exercises: [
          { exId: "farmers_carry", sets: 4, reps: 1 },
          { exId: "deadlift", sets: 4, reps: 6 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "back_extension", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Lower body functional",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "walking_lunge", sets: 3, reps: 12 },
          { exId: "leg_press", sets: 3, reps: 12 },
          { exId: "calf_raise_standing", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Conditioning intervals",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 20 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "sled_drag_forward", sets: 4, reps: 1 },
          { exId: "sled_drag_backward", sets: 4, reps: 1 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Upper body & core",
        exercises: [
          { exId: "bench", sets: 4, reps: 8 },
          { exId: "barbell_row", sets: 4, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "russian_twist", sets: 3, reps: 20 },
        ],
      },
      {
        label: "Day 6: Ruck & sled",
        exercises: [
          { exId: "ruck_march", sets: 1, reps: 1 },
          { exId: "sled_drag_forward", sets: 5, reps: 1 },
          { exId: "sled_push", sets: 4, reps: 1 },
          { exId: "farmers_carry", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 7: Run day",
        exercises: [
          { exId: "run_tempo", sets: 1, reps: 25 },
          { exId: "hill_sprints", sets: 6, reps: 1 },
          { exId: "stair_climb_intervals", sets: 5, reps: 1 },
        ],
      },
    ],
  },
];

function loadInitialState() {
  return {
    templates: DEFAULT_TEMPLATES,
    programs: HERO_PROGRAMS,
    customPlans: [],
    customPrograms: [], // { id, name, tagline, days: [{ label, exercises }] }
    customExercises: [], // { id, name, type, muscle }
    logs: [], // { id, exId, date, sets: [{weight, reps}], targetReps }
    cardioLogs: [], // { id, exId, date, distance, distanceUnit, duration, load, notes }
    currentProgram: null, // { programId, programName, source: "builtin" | "custom", dayIndex, totalDays }
  };
}

// Programs renamed after users may already have saved plan copies / a currentProgram
// referencing the old names — brings those forward so nothing's left pointing at a name
// that no longer exists anywhere in the app.
const RENAMED_PROGRAMS = { Superman: "Titan", Batman: "Reaper", Punisher: "Berserker", Thor: "Ragnar" };

function migrateProgramNames(state) {
  const customPlans = (state.customPlans || []).map((p) => {
    const sepIdx = p.name.indexOf(" — ");
    if (sepIdx === -1) return p;
    const prefix = p.name.slice(0, sepIdx);
    const rest = p.name.slice(sepIdx);
    return RENAMED_PROGRAMS[prefix] ? { ...p, name: RENAMED_PROGRAMS[prefix] + rest } : p;
  });

  const customPrograms = (state.customPrograms || []).map((p) =>
    RENAMED_PROGRAMS[p.name] ? { ...p, name: RENAMED_PROGRAMS[p.name] } : p
  );

  const currentProgram =
    state.currentProgram && RENAMED_PROGRAMS[state.currentProgram.programName]
      ? { ...state.currentProgram, programName: RENAMED_PROGRAMS[state.currentProgram.programName] }
      : state.currentProgram;

  return { ...state, customPlans, customPrograms, currentProgram };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Resolves state.currentProgram into the actual program/day data, or null if the
// program was deleted (custom program removed) or no program is active. When the
// program has a weeks field and enough real time has elapsed since startDate, returns
// an isComplete result instead of a day to run.
function resolveCurrentProgramDay(state) {
  const cp = state.currentProgram;
  if (!cp) return null;
  const list = cp.source === "custom" ? state.customPrograms || [] : state.programs || [];
  const prog = list.find((p) => p.id === cp.programId);
  if (!prog || !prog.days || !prog.days[cp.dayIndex]) return null;

  const totalWeeks = prog.weeks || null;
  let weekNumber = null;
  if (cp.startDate && totalWeeks) {
    const daysElapsed = Math.max(0, Math.floor((Date.now() - new Date(cp.startDate).getTime()) / MS_PER_DAY));
    weekNumber = Math.floor(daysElapsed / 7) + 1;
  }

  const programContext = {
    programId: prog.id,
    programName: prog.name,
    source: cp.source,
    dayIndex: cp.dayIndex,
    totalDays: prog.days.length,
  };

  if (weekNumber !== null && weekNumber > totalWeeks) {
    return { isComplete: true, programName: prog.name, totalWeeks, programContext };
  }

  const day = prog.days[cp.dayIndex];
  return {
    isComplete: false,
    programName: prog.name,
    dayLabel: day.label,
    dayIndex: cp.dayIndex,
    totalDays: prog.days.length,
    weekNumber,
    totalWeeks,
    plan: { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
    programContext,
  };
}

// ---------- Data export / import ----------
// Everything the user has actually created — not the built-in templates/programs, which
// ship with the app and always come from source, never from a backup file.
const BACKUP_DATA_KEYS = ["logs", "cardioLogs", "customExercises", "customPlans", "customPrograms", "currentProgram"];

function exportBackupFile(state) {
  const payload = {
    app: "BRK - Lift",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(BACKUP_DATA_KEYS.map((k) => [k, state[k] ?? (k === "currentProgram" ? null : [])])),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `brk-lift-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Returns { ok: true, data } or { ok: false, error }. Never throws.
function parseBackupFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed.data || parsed : null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "That file doesn't look like a BRK - Lift backup." };
  }
  const hasKnownKey = BACKUP_DATA_KEYS.some((k) => k in data);
  if (!hasKnownKey) {
    return { ok: false, error: "That file doesn't contain any recognizable BRK - Lift data." };
  }
  return { ok: true, data };
}

function increment(exType) {
  return exType === "compound" ? 5 : 2.5;
}

// Suggest next weight based on last performance (double progression)
function suggestNext(exId, logs, exMap) {
  const exLogs = logs.filter((l) => l.exId === exId).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (exLogs.length === 0)
    return { lastWeight: null, lastReps: null, suggestion: null, targetReps: null, reason: "No history yet — log a starting weight." };
  const last = exLogs[0];
  const topSet = last.sets[0];
  const allHitTarget = last.sets.every((s) => s.reps >= last.targetReps);
  const ex = exMap[exId];
  const inc = increment(ex ? ex.type : "isolation");
  let suggestion, reason;
  if (allHitTarget) {
    suggestion = topSet.weight + inc;
    reason = `Hit target reps last time (${last.targetReps}+) — add ${inc} lb.`;
  } else {
    suggestion = topSet.weight;
    reason = `Missed target reps last time — repeat ${topSet.weight} lb and push for ${last.targetReps}.`;
  }
  return { lastWeight: topSet.weight, lastReps: topSet.reps, suggestion, targetReps: last.targetReps, reason, date: last.date };
}

function usageCounts(logs) {
  const counts = {};
  logs.forEach((l) => {
    counts[l.exId] = (counts[l.exId] || 0) + 1;
  });
  return counts;
}

// ---------- Cardio helpers ----------
function formatPace(minutesPerUnit) {
  if (!minutesPerUnit || !isFinite(minutesPerUnit)) return null;
  const mins = Math.floor(minutesPerUnit);
  const secs = Math.round((minutesPerUnit - mins) * 60);
  const secsPadded = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mins}:${secsPadded}`;
}

function cardioPace(entry) {
  if (entry.distanceUnit !== "mi" || !entry.distance || !entry.duration) return null;
  return entry.duration / entry.distance;
}

function bestCardioStat(exId, cardioLogs) {
  const entries = cardioLogs.filter((l) => l.exId === exId);
  if (entries.length === 0) return null;
  const withPace = entries.map((e) => ({ ...e, pace: cardioPace(e) })).filter((e) => e.pace !== null);
  if (withPace.length > 0) {
    const best = withPace.reduce((a, b) => (b.pace < a.pace ? b : a));
    return { type: "pace", value: formatPace(best.pace), date: best.date };
  }
  const withDistance = entries.filter((e) => e.distance);
  if (withDistance.length > 0) {
    const best = withDistance.reduce((a, b) => (b.distance > a.distance ? b : a));
    return { type: "distance", value: `${best.distance} ${best.distanceUnit || ""}`.trim(), date: best.date };
  }
  return null;
}

const TABS = [
  { id: "log", label: "Log", icon: TrendingUp },
  { id: "cardio", label: "Runs", icon: Timer },
  { id: "templates", label: "Templates", icon: ClipboardList },
  { id: "build", label: "Build plan", icon: Dumbbell },
  { id: "catalog", label: "Catalog", icon: Search },
  { id: "top", label: "Top used", icon: Flame },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function LiftLog() {
  const [state, setState] = useState(loadInitialState());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("log");
  const [activeRun, setActiveRun] = useState(null);
  const [restBump, setRestBump] = useState(0);
  const bumpRestTimer = useCallback(() => setRestBump((t) => t + 1), []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("liftlog-data");
      if (raw) {
        const parsed = JSON.parse(raw);
        setState((s) => {
          const migrated = migrateProgramNames({ ...s, ...parsed });
          try {
            window.localStorage.setItem("liftlog-data", JSON.stringify(migrated));
          } catch (e) {
            // storage unavailable — migrated state still applies for this session
          }
          return migrated;
        });
      }
    } catch (e) {
      // no saved data yet, or storage unavailable
    } finally {
      setLoaded(true);
    }
  }, []);

  const persist = useCallback((next) => {
    try {
      window.localStorage.setItem("liftlog-data", JSON.stringify(next));
    } catch (e) {
      console.error("Storage error", e);
    }
  }, []);

  const updateState = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const allExercises = useMemo(
    () => [...EXERCISE_LIBRARY, ...(state.customExercises || [])],
    [state.customExercises]
  );
  const exMap = useMemo(
    () => ({ ...EX_MAP_INIT, ...Object.fromEntries((state.customExercises || []).map((e) => [e.id, e])) }),
    [state.customExercises]
  );

  const startRun = (plan, fromTab, programContext) => {
    setActiveRun({
      planName: plan.name,
      exercises: plan.exercises,
      sessionEntries: [],
      swaps: {},
      finished: false,
      returnTab: fromTab,
      programContext: programContext || null,
    });
    if (programContext) {
      updateState((prev) => {
        const isSameProgram =
          prev.currentProgram &&
          prev.currentProgram.programId === programContext.programId &&
          prev.currentProgram.source === programContext.source;
        const startDate = isSameProgram ? prev.currentProgram.startDate : new Date().toISOString();
        return { ...prev, currentProgram: { ...programContext, startDate } };
      });
    }
  };
  const recordRunEntry = (index, entry) => {
    setActiveRun((run) => ({ ...run, sessionEntries: [...run.sessionEntries, { exId: entry.exId, entry }] }));
  };
  const swapRunExercise = (index, newExId) => {
    setActiveRun((run) => ({ ...run, swaps: { ...(run.swaps || {}), [index]: newExId } }));
  };
  const finishRun = () => {
    setActiveRun((run) => ({ ...run, finished: true }));
    if (activeRun?.programContext) {
      const ctx = activeRun.programContext;
      updateState((prev) => ({
        ...prev,
        currentProgram: {
          ...ctx,
          dayIndex: (ctx.dayIndex + 1) % ctx.totalDays,
          startDate: prev.currentProgram?.startDate || new Date().toISOString(),
        },
      }));
    }
  };
  const exitRun = () => {
    setTab(activeRun?.returnTab || "templates");
    setActiveRun(null);
  };
  const restartCurrentProgram = () => {
    updateState((prev) =>
      prev.currentProgram
        ? { ...prev, currentProgram: { ...prev.currentProgram, dayIndex: 0, startDate: new Date().toISOString() } }
        : prev
    );
  };

  if (!loaded) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center bg-charcoal-deep text-neutral-400 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="w-full bg-charcoal-deep text-neutral-200 font-sans min-h-[600px]">
      <Header />
      <RestTimer bumpToken={restBump} />
      {!activeRun && (
        <div className="flex overflow-x-auto border-b border-red-900/40 bg-charcoal-panel sticky top-0 z-10">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs tracking-widest uppercase whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? "border-red-600 text-red-500"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-4 sm:p-6">
        {activeRun ? (
          <GuidedRunView
            run={activeRun}
            state={state}
            updateState={updateState}
            exMap={exMap}
            allExercises={allExercises}
            onSaved={recordRunEntry}
            onFinish={finishRun}
            onExit={exitRun}
            onSwap={swapRunExercise}
            onLoggedSet={bumpRestTimer}
          />
        ) : (
          <>
            {tab === "log" && (
              <LogTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "log", programContext)}
                onLoggedSet={bumpRestTimer}
                onRestartProgram={restartCurrentProgram}
                onGoToTemplates={() => setTab("templates")}
              />
            )}
            {tab === "cardio" && (
              <CardioTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onLoggedSet={bumpRestTimer}
              />
            )}
            {tab === "templates" && (
              <TemplatesTab
                state={state}
                updateState={updateState}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "templates", programContext)}
              />
            )}
            {tab === "build" && (
              <BuildPlanTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "build", programContext)}
              />
            )}
            {tab === "catalog" && <CatalogTab state={state} updateState={updateState} allExercises={allExercises} />}
            {tab === "top" && <TopUsedTab state={state} exMap={exMap} />}
            {tab === "settings" && <SettingsTab state={state} updateState={updateState} />}
          </>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="px-4 sm:px-6 pt-6 pb-4 border-b border-red-900/40 bg-gradient-to-b from-charcoal-panel to-charcoal-deep">
      <div className="flex items-center gap-3">
        <img
          src={BREAK_LOGO}
          alt="B.R.E.A.K. logo"
          className="w-11 h-11 rounded-full object-cover ring-1 ring-red-700/60"
        />
        <div>
          <div className="text-white font-bold tracking-wider text-sm leading-none">BRK - LIFT</div>
          <div className="text-[10px] text-neutral-500 tracking-widest uppercase mt-1">Keep the promises you make to yourself</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- SHARED SLIDE-IN DRILL-DOWN PANEL ----------------
// Full-width view that slides in from the right with a back arrow at the top, replacing
// an accordion-expand or a dead-end tap. Used for Templates/My plans drill-down and the
// exercise swap picker.
function SlideInPanel({ title, subtitle, onBack, children }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="overflow-hidden">
      <div className={`transform transition-transform duration-300 ease-out ${entered ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center gap-3 px-4 py-3 mb-4 border border-red-900/40 bg-charcoal-panel">
          <button onClick={onBack} className="text-neutral-400 hover:text-red-500 p-1 -ml-1 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{title}</div>
            {subtitle && <div className="text-xs text-neutral-500 mt-0.5 truncate">{subtitle}</div>}
          </div>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------- EXERCISE SWAP PICKER ----------------
// Filtered to the same muscle group as the exercise being swapped, with a search bar
// (same pattern as the catalog search elsewhere) to widen it if needed.
function ExerciseSwapPicker({ currentExId, allExercises, exMap, onBack, onSelect }) {
  const [query, setQuery] = useState("");
  const currentMuscle = exMap[currentExId]?.muscle;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? allExercises.filter((ex) => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q))
      : allExercises.filter((ex) => ex.muscle === currentMuscle);
    return pool.filter((ex) => ex.id !== currentExId);
  }, [query, allExercises, currentMuscle, currentExId]);

  return (
    <SlideInPanel
      title="Swap exercise"
      subtitle={currentMuscle ? `Same muscle group: ${currentMuscle} — this session only` : "This session only"}
      onBack={onBack}
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the catalog..."
        className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-xs focus:outline-none focus:border-red-700"
      />
      <div className="space-y-1.5">
        {results.map((ex) => (
          <button
            key={ex.id}
            onClick={() => onSelect(ex.id)}
            className="w-full text-left px-3 py-2 text-sm border border-neutral-900 text-neutral-300 hover:border-red-700 hover:text-white"
          >
            {ex.name}
            <span className="text-xs text-neutral-600 ml-2">{ex.muscle}</span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="text-xs text-neutral-600 py-4 text-center">No matches. Try a different search.</div>
        )}
      </div>
    </SlideInPanel>
  );
}

// ---------------- SHARED SINGLE-EXERCISE LOGGER ----------------
// Recommended panel + target reps + set rows + save + history, for a fixed exercise.
// Used standalone by the Log tab (with its own exercise picker wrapped around it) and
// by the guided plan runner (with a plan-driven step indicator wrapped around it).
function ExerciseLogger({ exId, title, state, updateState, exMap, allExercises, onSaved, onSwap, saveLabel = "Save session", showHistory = true }) {
  const [targetReps, setTargetReps] = useState(8);
  const [setsInput, setSetsInput] = useState([{ weight: "", reps: "" }]);
  const [swapOpen, setSwapOpen] = useState(false);

  const suggestion = useMemo(() => suggestNext(exId, state.logs, exMap), [exId, state.logs, exMap]);

  useEffect(() => {
    setTargetReps(suggestion.targetReps ?? 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exId]);

  const addSetRow = () => setSetsInput((s) => [...s, { weight: "", reps: "" }]);
  const removeSetRow = (idx) => setSetsInput((s) => s.filter((_, i) => i !== idx));
  const updateSetRow = (idx, field, val) =>
    setSetsInput((s) => s.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));

  const canSave = setsInput.some((s) => s.weight !== "" && s.reps !== "");

  const saveLog = () => {
    const sets = setsInput
      .filter((s) => s.weight !== "" && s.reps !== "")
      .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }));
    if (sets.length === 0) return;
    const entry = {
      id: `log_${Date.now()}`,
      exId,
      date: new Date().toISOString(),
      sets,
      targetReps: Number(targetReps) || sets[0].reps,
    };
    updateState((prev) => ({ ...prev, logs: [entry, ...prev.logs] }));
    setSetsInput([{ weight: "", reps: "" }]);
    onSaved?.(entry);
  };

  const recentForEx = state.logs
    .filter((l) => l.exId === exId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (swapOpen) {
    return (
      <ExerciseSwapPicker
        currentExId={exId}
        allExercises={allExercises}
        exMap={exMap}
        onBack={() => setSwapOpen(false)}
        onSelect={(newExId) => {
          setSwapOpen(false);
          onSwap(newExId);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-xl font-bold text-white truncate">{title}</div>
          {onSwap && (
            <button
              onClick={() => setSwapOpen(true)}
              className="shrink-0 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500 flex items-center gap-1"
            >
              <ArrowLeftRight size={12} /> Swap
            </button>
          )}
        </div>
      )}

      <div className="border border-red-900/40 bg-charcoal-panel p-4">
        <div className="text-[11px] uppercase tracking-widest text-red-600 mb-2">Recommended</div>
        {suggestion.suggestion !== null ? (
          <>
            <div className="text-4xl font-bold text-white">{suggestion.suggestion} lb x {suggestion.targetReps} reps</div>
            <div className="text-xs text-neutral-500 mt-1">{suggestion.reason}</div>
            <div className="text-sm text-neutral-600 mt-2">
              Last: {suggestion.lastWeight} lb x {suggestion.lastReps} reps
            </div>
          </>
        ) : (
          <div className="text-sm text-neutral-400">{suggestion.reason}</div>
        )}
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Target reps this session</label>
        <input
          type="number"
          value={targetReps}
          onChange={(e) => setTargetReps(e.target.value)}
          className="w-24 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Today's sets</label>
        <div className="space-y-2">
          {setsInput.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-neutral-600 w-5">{idx + 1}</span>
              <input
                type="number"
                placeholder="Weight"
                value={row.weight}
                onChange={(e) => updateSetRow(idx, "weight", e.target.value)}
                className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
              />
              <input
                type="number"
                placeholder="Reps"
                value={row.reps}
                onChange={(e) => updateSetRow(idx, "reps", e.target.value)}
                className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
              />
              {setsInput.length > 1 && (
                <button onClick={() => removeSetRow(idx)} className="text-neutral-600 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addSetRow}
          className="mt-2 flex items-center gap-1 text-xs text-neutral-500 hover:text-red-500"
        >
          <Plus size={12} /> Add set
        </button>
      </div>

      <button
        onClick={saveLog}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        {saveLabel}
      </button>

      {showHistory && recentForEx.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">History</div>
          <div className="space-y-1.5">
            {recentForEx.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-xs border-b border-neutral-900 py-2">
                <span className="text-neutral-500">{new Date(l.date).toLocaleDateString()}</span>
                <span className="text-sm text-neutral-300">
                  {l.sets.map((s) => `${s.weight}x${s.reps}`).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- LOG TAB ----------------
function LogTab({ state, updateState, allExercises, exMap, onStartRun, onLoggedSet, onRestartProgram, onGoToTemplates }) {
  const [selectedExId, setSelectedExId] = useState(allExercises[0].id);
  const [exFilter, setExFilter] = useState("");

  const filteredExercises = useMemo(() => {
    const q = exFilter.trim().toLowerCase();
    if (!q) return allExercises;
    return allExercises.filter((ex) => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q));
  }, [exFilter, allExercises]);

  const groupedByMuscle = useMemo(() => {
    const groups = {};
    filteredExercises.forEach((ex) => {
      if (!groups[ex.muscle]) groups[ex.muscle] = [];
      groups[ex.muscle].push(ex);
    });
    return groups;
  }, [filteredExercises]);

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);

  return (
    <div className="space-y-6">
      {currentProgramDay?.isComplete && (
        <div className="border border-red-900/40 bg-charcoal-panel px-4 py-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-red-600">Program complete</div>
            <div className="text-base text-white mt-0.5">
              {currentProgramDay.programName} — {currentProgramDay.totalWeeks} weeks done
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRestartProgram}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
            >
              Restart
            </button>
            <button
              onClick={onGoToTemplates}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-200 hover:border-neutral-600"
            >
              New program
            </button>
          </div>
        </div>
      )}

      {currentProgramDay && !currentProgramDay.isComplete && (
        <div className="border border-red-900/40 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-red-600">Current program</div>
            <div className="text-base text-white mt-0.5 truncate">
              {currentProgramDay.programName}
              {currentProgramDay.weekNumber !== null
                ? ` — Week ${currentProgramDay.weekNumber} of ${currentProgramDay.totalWeeks}, Day ${currentProgramDay.dayIndex + 1} of ${currentProgramDay.totalDays}`
                : ` — Day ${currentProgramDay.dayIndex + 1} of ${currentProgramDay.totalDays}`}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5 truncate">{currentProgramDay.dayLabel}</div>
          </div>
          <button
            onClick={() => onStartRun(currentProgramDay.plan, currentProgramDay.programContext)}
            className="shrink-0 ml-3 text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
          >
            <ChevronRight size={14} /> Start
          </button>
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Exercise</label>
        <input
          type="text"
          value={exFilter}
          onChange={(e) => setExFilter(e.target.value)}
          placeholder="Search the catalog..."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-xs mb-2 focus:outline-none focus:border-red-700"
        />
        <select
          value={selectedExId}
          onChange={(e) => setSelectedExId(e.target.value)}
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        >
          {Object.entries(groupedByMuscle).map(([muscle, exs]) => (
            <optgroup key={muscle} label={muscle}>
              {exs.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {filteredExercises.length === 0 && (
          <div className="text-xs text-neutral-600 mt-1.5">
            No match. Add it in the Catalog tab and it'll show up here.
          </div>
        )}
      </div>

      <ExerciseLogger
        exId={selectedExId}
        title={exMap[selectedExId]?.name}
        state={state}
        updateState={updateState}
        exMap={exMap}
        allExercises={allExercises}
        onSwap={setSelectedExId}
        onSaved={onLoggedSet}
      />
    </div>
  );
}

// ---------------- REST TIMER ----------------
// Sticky widget with fixed presets (1:00 / 1:30 / 2:00 / 3:00). Auto-(re)starts at the
// last-used duration whenever bumpToken changes (i.e. whenever a set gets logged).
const REST_PRESETS = [60, 90, 120, 180];

function formatRestTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Web Audio (not an <audio> element) so the beep mixes with whatever the user is already
// playing (Spotify/Apple Music/etc.) instead of pausing it, the way <audio>/<video> often do
// on mobile. A single AudioContext is reused and resumed on user gestures (autoplay policy
// requires that) so it's already unlocked by the time the countdown actually hits zero.
let sharedAudioCtx = null;
function unlockAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
  if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
}
function playRestCompleteBeep() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
  const ctx = sharedAudioCtx;
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;
  [0, 0.22, 0.44].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.015);
    gain.gain.linearRampToValueAtTime(0, now + offset + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.2);
  });
}

// Global rest timer widget — mounted once at the app shell so it survives tab switches.
// Idle state is a slim bar; the instant it's running (or just hit zero) it expands into a
// large, high-contrast readout meant to be legible from across a gym, with a vibration +
// flash + beep on completion.
function RestTimer({ bumpToken }) {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(null);
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  useEffect(() => {
    if (remaining !== 0) return;
    playRestCompleteBeep();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    setJustFinished(true);
    const id = setTimeout(() => setJustFinished(false), 2000);
    return () => clearTimeout(id);
  }, [remaining]);

  // Compares against the last-seen bumpToken (rather than a "have I ever run" flag) so
  // React StrictMode's double-invoke-on-commit in dev can't misfire this as a real bump.
  const lastBumpToken = useRef(bumpToken);
  useEffect(() => {
    if (bumpToken === lastBumpToken.current) return;
    lastBumpToken.current = bumpToken;
    unlockAudio();
    setRemaining(duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bumpToken]);

  const startPreset = (secs) => {
    unlockAudio();
    setDuration(secs);
    setRemaining(secs);
  };
  const addThirty = () => setRemaining((r) => (r === null ? 30 : r + 30));
  const skip = () => setRemaining(null);

  const isActive = remaining !== null;

  return (
    <div
      className={`border-b border-red-900/40 bg-charcoal-panel px-4 transition-colors ${
        justFinished ? "animate-rest-flash" : ""
      } ${isActive ? "py-5" : "py-2.5"}`}
    >
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-red-600 ${isActive ? "mb-3 justify-center" : "mb-2"}`}>
        <Timer size={12} /> Rest timer
      </div>

      {isActive ? (
        <div className="space-y-4">
          <div className="text-center">
            {remaining > 0 ? (
              <div className="text-7xl font-bold text-white tabular-nums leading-none">{formatRestTime(remaining)}</div>
            ) : (
              <div className="text-4xl font-bold text-red-500 leading-none">Rest complete</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addThirty}
              className="flex-1 py-3 text-sm uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-200 hover:border-neutral-600"
            >
              +30s
            </button>
            <button
              onClick={skip}
              className="flex-1 py-3 text-sm uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
            >
              Skip
            </button>
          </div>
        </div>
      ) : null}

      <div className={`flex items-center gap-2 ${isActive ? "mt-4" : ""}`}>
        {REST_PRESETS.map((secs) => (
          <button
            key={secs}
            onClick={() => startPreset(secs)}
            className={`flex-1 py-1.5 text-xs font-bold border ${
              isActive && duration === secs
                ? "bg-red-700 border-red-700 text-white"
                : "bg-charcoal-panel border-neutral-800 text-neutral-300 hover:border-neutral-600"
            }`}
          >
            {formatRestTime(secs)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- GUIDED PLAN RUNNER ----------------
// Shows every exercise in the plan on one page, each with its own logging card, so the
// whole session is visible at once. Saving a set writes to the same state.logs array the
// standalone Log tab uses and bumps the rest timer. A "Finish workout" button ends the
// session; it doesn't require every exercise to be logged.
function GuidedRunView({ run, state, updateState, exMap, allExercises, onSaved, onFinish, onExit, onSwap, onLoggedSet }) {
  if (run.finished) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">{run.planName}</div>
          <div className="text-xl font-bold text-white mt-1">Workout complete</div>
        </div>

        {run.sessionEntries.length > 0 ? (
          <div className="space-y-1.5">
            {run.sessionEntries.map(({ entry }, i) => (
              <div key={entry.id || i} className="border border-neutral-800 bg-charcoal-panel px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-base text-white">{exMap[entry.exId]?.name || entry.exId}</span>
                  <span className="text-xs text-neutral-500">Target {entry.targetReps}</span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {entry.sets.map((s) => `${s.weight}x${s.reps}`).join(", ")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-500">Nothing logged this session.</div>
        )}

        <button
          onClick={onExit}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
        >
          Back to plans
        </button>
      </div>
    );
  }

  const loggedCount = new Set(run.sessionEntries.map((se) => se.exId)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">{run.planName}</div>
          <div className="text-xs text-neutral-500 mt-1">
            {run.exercises.length} exercises · {loggedCount} logged this session
          </div>
        </div>
        <button onClick={onExit} className="text-xs text-neutral-600 hover:text-red-600">
          Exit
        </button>
      </div>

      <div className="space-y-8">
        {run.exercises.map((exSlot, idx) => {
          const currentExId = run.swaps?.[idx] ?? exSlot.exId;
          const isLogged = run.sessionEntries.some((se) => se.exId === currentExId);
          return (
            <div key={idx} className="border-t border-neutral-900 pt-6 first:border-t-0 first:pt-0">
              {isLogged && (
                <div className="flex items-center gap-1.5 text-xs text-green-500 mb-2">
                  <Check size={14} /> Logged this session
                </div>
              )}
              <ExerciseLogger
                key={currentExId}
                exId={currentExId}
                title={exMap[currentExId]?.name || currentExId}
                state={state}
                updateState={updateState}
                exMap={exMap}
                allExercises={allExercises}
                onSaved={(entry) => {
                  onSaved(idx, entry);
                  onLoggedSet?.();
                }}
                onSwap={(newExId) => onSwap(idx, newExId)}
                saveLabel="Log set"
                showHistory={false}
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={onFinish}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
      >
        Finish workout
      </button>
    </div>
  );
}

// ---------------- CARDIO TAB ----------------
function CardioTab({ state, updateState, allExercises, exMap, onLoggedSet }) {
  const conditioningExercises = useMemo(
    () => allExercises.filter((ex) => ex.muscle === "Conditioning"),
    [allExercises]
  );

  const [selectedExId, setSelectedExId] = useState(conditioningExercises[0]?.id || "");
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState("mi");
  const [duration, setDuration] = useState("");
  const [load, setLoad] = useState("");
  const [notes, setNotes] = useState("");

  if (conditioningExercises.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500 text-sm">
        No conditioning exercises in the catalog yet. Add one (muscle group: Conditioning) from the Catalog tab.
      </div>
    );
  }

  const currentExId = selectedExId || conditioningExercises[0].id;
  const currentEx = exMap[currentExId];

  const cardioLogs = state.cardioLogs || [];
  const recentForEx = cardioLogs
    .filter((l) => l.exId === currentExId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);
  const lastEntry = recentForEx[0];
  const best = bestCardioStat(currentExId, cardioLogs);

  const canSave = distance !== "" || duration !== "";

  const saveEntry = () => {
    if (!canSave) return;
    const entry = {
      id: `cardio_${Date.now()}`,
      exId: currentExId,
      date: new Date().toISOString(),
      distance: distance !== "" ? Number(distance) : null,
      distanceUnit,
      duration: duration !== "" ? Number(duration) : null,
      load: load !== "" ? Number(load) : null,
      notes: notes.trim(),
    };
    updateState((prev) => ({ ...prev, cardioLogs: [entry, ...(prev.cardioLogs || [])] }));
    onLoggedSet?.();
    setDistance("");
    setDuration("");
    setLoad("");
    setNotes("");
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Run / conditioning work</label>
        <select
          value={currentExId}
          onChange={(e) => setSelectedExId(e.target.value)}
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        >
          {conditioningExercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {(lastEntry || best) && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Where you stand</div>
          {best && (
            <div className="text-3xl font-bold text-white">
              Best {best.type === "pace" ? "pace" : "distance"}: {best.value}
              {best.type === "pace" ? " /mi" : ""}
            </div>
          )}
          {lastEntry && (
            <div className="text-sm text-neutral-500">
              Last: {new Date(lastEntry.date).toLocaleDateString()} —{" "}
              {lastEntry.distance ? `${lastEntry.distance} ${lastEntry.distanceUnit}` : ""}
              {lastEntry.distance && lastEntry.duration ? ", " : ""}
              {lastEntry.duration ? `${lastEntry.duration} min` : ""}
              {lastEntry.load ? `, ${lastEntry.load} lb load` : ""}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Distance</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0"
              className="flex-1 min-w-0 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
            />
            <select
              value={distanceUnit}
              onChange={(e) => setDistanceUnit(e.target.value)}
              className="bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
            >
              <option value="mi">mi</option>
              <option value="yd">yd</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="0"
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Load — sled/ruck only (lb)</label>
        <input
          type="number"
          value={load}
          onChange={(e) => setLoad(e.target.value)}
          placeholder="Optional"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How it felt, route, weather, etc."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <button
        onClick={saveEntry}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        Save session
      </button>

      {recentForEx.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">History</div>
          <div className="space-y-1.5">
            {recentForEx.map((l) => {
              const pace = cardioPace(l);
              return (
                <div key={l.id} className="text-xs border-b border-neutral-900 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">{new Date(l.date).toLocaleDateString()}</span>
                    <span className="text-sm text-neutral-300">
                      {l.distance ? `${l.distance} ${l.distanceUnit}` : ""}
                      {l.distance && l.duration ? " · " : ""}
                      {l.duration ? `${l.duration} min` : ""}
                      {pace ? ` · ${formatPace(pace)} /mi` : ""}
                      {l.load ? ` · ${l.load} lb` : ""}
                    </span>
                  </div>
                  {l.notes && <div className="text-neutral-600 mt-1">{l.notes}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- TEMPLATES TAB ----------------
function TemplatesTab({ state, updateState, exMap, onStartRun }) {
  const [detail, setDetail] = useState(null); // { kind: "program" | "template", id }

  const copyToCustom = (tpl) => {
    const newPlan = { ...tpl, id: `plan_${Date.now()}`, name: `${tpl.name} (copy)`, isCustom: true };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, newPlan] }));
  };

  const copyDayToCustom = (program, day) => {
    const newPlan = {
      id: `plan_${Date.now()}`,
      name: `${program.name} — ${day.label}`,
      exercises: day.exercises,
      isCustom: true,
    };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, newPlan] }));
  };

  const copyProgramToCustom = (program) => {
    const newProgram = {
      id: `program_${Date.now()}`,
      name: program.name,
      tagline: program.tagline,
      weeks: program.weeks,
      days: program.days,
      isCustom: true,
    };
    updateState((prev) => ({ ...prev, customPrograms: [...(prev.customPrograms || []), newProgram] }));
  };

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);
  const isCurrent = (progId) =>
    state.currentProgram?.source === "builtin" && state.currentProgram.programId === progId;
  const isComplete = (progId) => isCurrent(progId) && currentProgramDay?.isComplete;

  if (detail?.kind === "program") {
    const prog = (state.programs || []).find((p) => p.id === detail.id);
    if (!prog) return null;
    return (
      <SlideInPanel
        title={prog.name}
        subtitle={prog.weeks ? `${prog.tagline} · ${prog.weeks} weeks` : prog.tagline}
        onBack={() => setDetail(null)}
      >
        <button
          onClick={() => copyProgramToCustom(prog)}
          className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30 flex items-center justify-center gap-1.5"
        >
          <Plus size={12} /> Add to my program
        </button>
        {prog.days.map((day, di) => (
          <div key={di} className="border-t border-neutral-900 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-red-500 flex items-center gap-1.5">
                {day.label}
                {isCurrent(prog.id) && state.currentProgram.dayIndex === di && (
                  <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">Next up</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    onStartRun(
                      { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                      { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: di, totalDays: prog.days.length }
                    )
                  }
                  className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
                >
                  <ChevronRight size={11} /> Start workout
                </button>
                <button
                  onClick={() => copyDayToCustom(prog, day)}
                  className="text-[11px] text-neutral-500 hover:text-red-500 flex items-center gap-1"
                >
                  <Plus size={11} /> Copy to my plans
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              {day.exercises.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="text-sm">{exMap[e.exId]?.name || e.exId}</span>
                  <span className="text-neutral-600">
                    {e.sets} x {e.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </SlideInPanel>
    );
  }

  if (detail?.kind === "template") {
    const tpl = state.templates.find((t) => t.id === detail.id);
    if (!tpl) return null;
    return (
      <SlideInPanel title={tpl.name} onBack={() => setDetail(null)}>
        <div className="space-y-2">
          {tpl.exercises.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-neutral-400 py-1.5 border-t border-neutral-900">
              <span className="text-sm">{exMap[e.exId]?.name || e.exId}</span>
              <span className="text-neutral-600">
                {e.sets} x {e.reps}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(tpl)} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button onClick={() => copyToCustom(tpl)} className="text-xs text-neutral-500 hover:text-red-500 flex items-center gap-1">
            <Plus size={12} /> Copy to my plans
          </button>
        </div>
      </SlideInPanel>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Programs</div>
        <p className="text-xs text-neutral-500">
          Full multi-day splits built around a specific look and training identity. Copy any single day into your
          own plans.
        </p>
        <div className="space-y-2">
          {(state.programs || []).map((prog) => (
            <button
              key={prog.id}
              onClick={() => setDetail({ kind: "program", id: prog.id })}
              className="w-full flex items-center justify-between px-4 py-3 border border-red-900/40 bg-charcoal-panel text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-white truncate">{prog.name}</span>
                  {isComplete(prog.id) ? (
                    <span className="text-[9px] uppercase tracking-widest bg-neutral-700 text-white px-1.5 py-0.5 shrink-0">Complete</span>
                  ) : (
                    isCurrent(prog.id) && (
                      <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5 shrink-0">Current</span>
                    )
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  {prog.tagline}
                  {prog.weeks ? ` · ${prog.weeks} weeks` : ""}
                </div>
              </div>
              <ChevronRight size={16} className="text-neutral-600 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500">Single day templates</div>
        <p className="text-xs text-neutral-500">Standard split templates. Copy one into your own plans to customize it.</p>
        <div className="space-y-2">
          {state.templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setDetail({ kind: "template", id: tpl.id })}
              className="w-full flex items-center justify-between px-4 py-3 border border-neutral-800 bg-charcoal-panel text-left"
            >
              <span className="text-base font-medium text-white truncate">{tpl.name}</span>
              <ChevronRight size={16} className="text-neutral-600 shrink-0 ml-2" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- BUILD PLAN TAB ----------------
function BuildPlanTab({ state, updateState, allExercises, exMap, onStartRun }) {
  const [planName, setPlanName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [exFilter, setExFilter] = useState("");
  const [planSearch, setPlanSearch] = useState("");
  const [detail, setDetail] = useState(null); // { kind: "plan" | "program", id }

  const filteredExercises = useMemo(() => {
    const q = exFilter.trim().toLowerCase();
    if (!q) return allExercises;
    return allExercises.filter((ex) => ex.name.toLowerCase().includes(q) || ex.muscle.toLowerCase().includes(q));
  }, [exFilter, allExercises]);

  const addExercise = (exId) => {
    if (selectedExercises.some((e) => e.exId === exId)) return;
    setSelectedExercises((s) => [...s, { exId, sets: 3, reps: 10 }]);
  };
  const removeExercise = (exId) => setSelectedExercises((s) => s.filter((e) => e.exId !== exId));
  const updateExercise = (exId, field, val) =>
    setSelectedExercises((s) => s.map((e) => (e.exId === exId ? { ...e, [field]: Number(val) } : e)));

  const savePlan = () => {
    if (!planName.trim() || selectedExercises.length === 0) return;
    const plan = { id: `plan_${Date.now()}`, name: planName.trim(), exercises: selectedExercises, isCustom: true };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, plan] }));
    setPlanName("");
    setSelectedExercises([]);
  };

  const deletePlan = (id) => {
    updateState((prev) => ({ ...prev, customPlans: prev.customPlans.filter((p) => p.id !== id) }));
  };

  const deleteProgram = (id) => {
    updateState((prev) => ({ ...prev, customPrograms: (prev.customPrograms || []).filter((p) => p.id !== id) }));
  };

  const filteredPlans = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    if (!q) return state.customPlans;
    return state.customPlans.filter((p) => p.name.toLowerCase().includes(q));
  }, [planSearch, state.customPlans]);

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);
  const isCurrentCustom = (progId) => state.currentProgram?.source === "custom" && state.currentProgram.programId === progId;
  const isCompleteCustom = (progId) => isCurrentCustom(progId) && currentProgramDay?.isComplete;

  if (detail?.kind === "plan") {
    const p = state.customPlans.find((pl) => pl.id === detail.id);
    if (!p) return null;
    return (
      <SlideInPanel title={p.name} subtitle={`${p.exercises.length} exercises`} onBack={() => setDetail(null)}>
        <div className="space-y-1.5">
          {p.exercises.map((e, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-neutral-400 py-1.5 border-t border-neutral-900">
              <span className="text-sm">{exMap[e.exId]?.name || e.exId}</span>
              <span className="text-neutral-600">
                {e.sets} x {e.reps}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(p)} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button
            onClick={() => {
              deletePlan(p.id);
              setDetail(null);
            }}
            className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </SlideInPanel>
    );
  }

  if (detail?.kind === "program") {
    const prog = (state.customPrograms || []).find((pr) => pr.id === detail.id);
    if (!prog) return null;
    return (
      <SlideInPanel
        title={prog.name}
        subtitle={prog.weeks ? `${prog.days.length} days · ${prog.weeks} weeks` : `${prog.days.length} days`}
        onBack={() => setDetail(null)}
      >
        {prog.days.map((day, di) => (
          <div key={di} className="border-t border-neutral-900 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-red-500 flex items-center gap-1.5">
                {day.label}
                {isCurrentCustom(prog.id) && state.currentProgram.dayIndex === di && (
                  <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">Next up</span>
                )}
              </span>
              <button
                onClick={() =>
                  onStartRun(
                    { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                    { programId: prog.id, programName: prog.name, source: "custom", dayIndex: di, totalDays: prog.days.length }
                  )
                }
                className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
              >
                <ChevronRight size={11} /> Start workout
              </button>
            </div>
            <div className="space-y-1.5">
              {day.exercises.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="text-sm">{exMap[e.exId]?.name || e.exId}</span>
                  <span className="text-neutral-600">
                    {e.sets} x {e.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            deleteProgram(prog.id);
            setDetail(null);
          }}
          className="text-xs text-neutral-500 hover:text-red-600 flex items-center gap-1"
        >
          <Trash2 size={12} /> Delete program
        </button>
      </SlideInPanel>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Plan name</label>
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="e.g. Fat loss phase - upper focus"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Add exercises</label>
        <input
          type="text"
          value={exFilter}
          onChange={(e) => setExFilter(e.target.value)}
          placeholder="Search the catalog..."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-xs mb-2 focus:outline-none focus:border-red-700"
        />
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-neutral-900 p-2">
          {filteredExercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => addExercise(ex.id)}
              disabled={selectedExercises.some((e) => e.exId === ex.id)}
              className={`text-left text-xs px-2 py-1.5 border ${
                selectedExercises.some((e) => e.exId === ex.id)
                  ? "border-red-800 text-red-600 bg-red-950/30"
                  : "border-neutral-900 text-neutral-400 hover:border-neutral-700"
              }`}
            >
              {ex.name}
            </button>
          ))}
          {filteredExercises.length === 0 && (
            <div className="col-span-2 text-xs text-neutral-600 py-2 text-center">
              No match. Add it in the Catalog tab first.
            </div>
          )}
        </div>
      </div>

      {selectedExercises.length > 0 && (
        <div className="space-y-2">
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500">Plan exercises</label>
          {selectedExercises.map((e) => (
            <div key={e.exId} className="flex items-center gap-2 border border-neutral-900 px-3 py-2">
              <span className="flex-1 text-base text-neutral-200">{exMap[e.exId]?.name}</span>
              <input
                type="number"
                value={e.sets}
                onChange={(ev) => updateExercise(e.exId, "sets", ev.target.value)}
                className="w-14 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-1 text-xs"
              />
              <span className="text-neutral-600 text-xs">sets</span>
              <input
                type="number"
                value={e.reps}
                onChange={(ev) => updateExercise(e.exId, "reps", ev.target.value)}
                className="w-14 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-1 text-xs"
              />
              <span className="text-neutral-600 text-xs">reps</span>
              <button onClick={() => removeExercise(e.exId)} className="text-neutral-600 hover:text-red-600">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={savePlan}
        disabled={!planName.trim() || selectedExercises.length === 0}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          planName.trim() && selectedExercises.length > 0
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        Save plan
      </button>

      {state.customPlans.length > 0 && (
        <div className="pt-4 border-t border-neutral-900 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">My plans</div>
          <input
            type="text"
            value={planSearch}
            onChange={(e) => setPlanSearch(e.target.value)}
            placeholder="Search my plans..."
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-xs focus:outline-none focus:border-red-700"
          />
          {filteredPlans.length === 0 && (
            <div className="text-xs text-neutral-600 py-2 text-center">No plans match "{planSearch}".</div>
          )}
          {filteredPlans.map((p) => (
            <div key={p.id} className="border border-neutral-800 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
              <button onClick={() => setDetail({ kind: "plan", id: p.id })} className="flex-1 min-w-0 text-left">
                <div className="text-base text-white truncate">{p.name}</div>
                <div className="text-xs text-neutral-600">{p.exercises.length} exercises</div>
              </button>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <button
                  onClick={() => onStartRun(p)}
                  className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
                >
                  <ChevronRight size={12} /> Start workout
                </button>
                <button onClick={() => deletePlan(p.id)} className="text-neutral-600 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(state.customPrograms || []).length > 0 && (
        <div className="pt-4 border-t border-neutral-900 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">My programs</div>
          {state.customPrograms.map((prog) => (
            <div key={prog.id} className="border border-neutral-800 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
              <button onClick={() => setDetail({ kind: "program", id: prog.id })} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-base text-white truncate">{prog.name}</span>
                  {isCompleteCustom(prog.id) ? (
                    <span className="text-[9px] uppercase tracking-widest bg-neutral-700 text-white px-1.5 py-0.5 shrink-0">Complete</span>
                  ) : (
                    isCurrentCustom(prog.id) && (
                      <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5 shrink-0">Current</span>
                    )
                  )}
                </div>
                <div className="text-xs text-neutral-600">
                  {prog.days.length} days{prog.weeks ? ` · ${prog.weeks} weeks` : ""}
                </div>
              </button>
              <button onClick={() => deleteProgram(prog.id)} className="text-neutral-600 hover:text-red-600 shrink-0 ml-3">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- TOP USED TAB ----------------
function TopUsedTab({ state, exMap }) {
  const counts = usageCounts(state.logs);
  const ranked = Object.entries(counts)
    .map(([exId, count]) => ({ ex: exMap[exId], count }))
    .filter((r) => r.ex)
    .sort((a, b) => b.count - a.count);

  if (ranked.length === 0) {
    return (
      <div className="text-center py-16 text-neutral-500 text-sm">
        No sessions logged yet. Log a workout and this tab tracks what you actually train most.
      </div>
    );
  }

  const max = ranked[0].count;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">Ranked by how often you've logged each lift.</p>
      {ranked.map((r, i) => (
        <div key={r.ex.id} className="border border-neutral-800 bg-charcoal-panel px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {i === 0 && <Star size={12} className="text-red-600" />}
              <span className="text-base text-white">{r.ex.name}</span>
            </div>
            <span className="text-xs text-neutral-500">{r.count}x</span>
          </div>
          <div className="h-1 bg-neutral-900">
            <div className="h-1 bg-red-700" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- CATALOG TAB ----------------
function CatalogTab({ state, updateState, allExercises }) {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("All");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState(MUSCLE_GROUPS[0]);
  const [newType, setNewType] = useState("isolation");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allExercises.filter((ex) => {
      const matchesQuery = !q || ex.name.toLowerCase().includes(q);
      const matchesMuscle = muscleFilter === "All" || ex.muscle === muscleFilter;
      return matchesQuery && matchesMuscle;
    });
  }, [query, muscleFilter, allExercises]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((ex) => {
      if (!groups[ex.muscle]) groups[ex.muscle] = [];
      groups[ex.muscle].push(ex);
    });
    return groups;
  }, [filtered]);

  const addCustomExercise = () => {
    if (!newName.trim()) return;
    const id = `custom_${newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
    const exercise = { id, name: newName.trim(), muscle: newMuscle, type: newType, custom: true };
    updateState((prev) => ({ ...prev, customExercises: [...(prev.customExercises || []), exercise] }));
    setNewName("");
    setShowAddForm(false);
  };

  const removeCustomExercise = (id) => {
    updateState((prev) => ({ ...prev, customExercises: (prev.customExercises || []).filter((e) => e.id !== id) }));
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Every movement and machine in the library. Can't find something you use — add it once and it shows up
        everywhere you pick an exercise.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
        <select
          value={muscleFilter}
          onChange={(e) => setMuscleFilter(e.target.value)}
          className="bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
        >
          <option value="All">All</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30 flex items-center justify-center gap-1.5"
        >
          <Plus size={14} /> Add missing exercise
        </button>
      ) : (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Add exercise</div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Plate-loaded chest press machine"
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          />
          <div className="flex gap-2">
            <select
              value={newMuscle}
              onChange={(e) => setNewMuscle(e.target.value)}
              className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-xs focus:outline-none focus:border-red-700"
            >
              <option value="compound">Compound</option>
              <option value="isolation">Isolation</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addCustomExercise}
              disabled={!newName.trim()}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border flex items-center justify-center gap-1.5 ${
                newName.trim()
                  ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
                  : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
              }`}
            >
              <Check size={14} /> Save
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewName("");
              }}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([muscle, exs]) => (
          <div key={muscle}>
            <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">{muscle}</div>
            <div className="space-y-1.5">
              {exs.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between text-sm border border-neutral-900 bg-charcoal-panel px-3 py-2"
                >
                  <span className="text-base text-neutral-200">{ex.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-600">{ex.type}</span>
                    {ex.custom && (
                      <button onClick={() => removeCustomExercise(ex.id)} className="text-neutral-600 hover:text-red-600">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-neutral-600 text-sm">No matches — add it above.</div>
        )}
      </div>
    </div>
  );
}

// ---------------- SETTINGS TAB ----------------
// The only backup mechanism available, since everything lives in localStorage with no
// server. Export/import cover every piece of user-created data — logs, cardio logs,
// custom exercises, custom plans and programs, and which program is currently active —
// not just workout logs.
function SettingsTab({ state, updateState }) {
  const fileInputRef = useRef(null);
  const [importMessage, setImportMessage] = useState(null); // { type: "error" | "success", text }

  const handleExport = () => {
    exportBackupFile(state);
    setImportMessage({ type: "success", text: "Backup downloaded." });
  };

  const handleImportClick = () => {
    setImportMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = parseBackupFile(String(reader.result));
      if (!result.ok) {
        setImportMessage({ type: "error", text: result.error });
        return;
      }
      const confirmed = window.confirm(
        "Importing this backup will overwrite all current data on this device — logs, cardio logs, custom exercises, custom plans and programs, and your active program. This can't be undone. Continue?"
      );
      if (!confirmed) return;

      updateState((prev) => {
        const next = { ...prev };
        BACKUP_DATA_KEYS.forEach((key) => {
          if (key in result.data) next[key] = result.data[key];
        });
        return next;
      });
      setImportMessage({ type: "success", text: "Backup restored." });
    };
    reader.onerror = () => setImportMessage({ type: "error", text: "Couldn't read that file." });
    reader.readAsText(file);
  };

  const counts = {
    logs: (state.logs || []).length,
    cardioLogs: (state.cardioLogs || []).length,
    customExercises: (state.customExercises || []).length,
    customPlans: (state.customPlans || []).length,
    customPrograms: (state.customPrograms || []).length,
  };

  return (
    <div className="space-y-6">
      <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Data backup</div>
          <p className="text-xs text-neutral-500 mt-1">
            Everything is stored on this device only — there's no account or server. Export a backup before
            switching phones or clearing browser data, and import it to restore.
          </p>
        </div>

        <div className="text-xs text-neutral-400 space-y-1">
          <div>{counts.logs} lift logs</div>
          <div>{counts.cardioLogs} run / conditioning logs</div>
          <div>{counts.customExercises} custom exercises</div>
          <div>{counts.customPlans} custom plans</div>
          <div>{counts.customPrograms} custom programs</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleExport}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> Export data
          </button>
          <button
            onClick={handleImportClick}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-200 hover:border-neutral-600 flex items-center justify-center gap-1.5"
          >
            <Upload size={14} /> Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {importMessage && (
          <div className={`text-xs ${importMessage.type === "error" ? "text-red-500" : "text-green-500"}`}>
            {importMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}
