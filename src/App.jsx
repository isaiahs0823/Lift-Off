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
  Camera,
  Share2,
  Pause,
  Play,
  RotateCcw,
  Award,
  StickyNote,
  Target,
  Scale,
  MessageCircle,
  Copy,
  Home,
  MoreHorizontal,
  Pencil,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { SlideInPanel } from "./components/SlideInPanel.jsx";
import MissionTab from "./components/MissionTab.jsx";
import ProgressTab from "./components/ProgressTab.jsx";
import ReadinessCheckIn from "./components/ReadinessCheckIn.jsx";
import CoachTab from "./components/CoachTab.jsx";
import { buildCoachContext } from "./utils/coachContext.js";
import { generatePostWorkoutReview, generatePreWorkoutAdvice } from "./services/coachService.js";
import { computeReadinessScore, readinessBand } from "./utils/readiness.js";
import ShareCardButton from "./components/ShareCardButton.jsx";
import TodayTab from "./components/TodayTab.jsx";
import TrainTab from "./components/TrainTab.jsx";
import MoreTab from "./components/MoreTab.jsx";
import ScheduleEditor from "./components/ScheduleEditor.jsx";
import AthleteProfileForm from "./components/AthleteProfileForm.jsx";
import TrainingDaysSelector from "./components/TrainingDaysSelector.jsx";
import { recommendationFor, totalWeeklySets, FREQUENCY_GUIDANCE, familyVariants } from "./utils/programRecommendation.js";
import { FAMILY_PROGRAMS } from "./data/programFamilies.js";
import { recoveryRoutineById } from "./data/mobilityLibrary.js";
import { buildRecoverySessionSummary } from "./utils/mobilitySession.js";
import MobilityLibraryScreen from "./components/MobilityLibraryScreen.jsx";
import MobilityDetailScreen from "./components/MobilityDetailScreen.jsx";
import MobilitySessionRunner from "./components/MobilitySessionRunner.jsx";
import ProgramTimelineScreen from "./components/ProgramTimelineScreen.jsx";
import DevelopmentPrioritiesScreen from "./components/DevelopmentPrioritiesScreen.jsx";
import EquipmentProfileSheet, { AddEquipmentProfileForm } from "./components/EquipmentProfileSheet.jsx";
import {
  isMachineBasedExercise,
  profilesForExercise,
  defaultProfileFor,
  equipmentDisplayLabel,
  addEquipmentProfile,
  convertTemporaryLogToProfile,
  sameEquipmentBucket,
  TEMPORARY_EQUIPMENT_CONTEXT,
} from "./utils/equipmentProfiles.js";
import {
  SET_QUALITY_LEVELS,
  SET_QUALITY_LABEL,
  SET_QUALITY_GLYPH,
  PAIN_BODY_AREAS,
  sanitizeQuality,
  sanitizePainInfo,
  qualityAttentionLabel,
  painTrendForExercise,
  painTrendLabel,
  painSummaryLabel,
} from "./utils/workoutQuality.js";
import { buildWorkoutRecap } from "./utils/workoutRecap.js";
import SessionRecapView from "./components/SessionRecapView.jsx";
import SessionOptionsSheet from "./components/SessionOptionsSheet.jsx";
import CoachKnowledgeScreen from "./components/CoachKnowledgeScreen.jsx";
import CoachSettingsScreen from "./components/CoachSettingsScreen.jsx";
import CoachSpecialtySelect from "./components/CoachSpecialtySelect.jsx";
import DataWorkbookScreen from "./components/DataWorkbookScreen.jsx";
import IntervalTimerScreen from "./components/IntervalTimerScreen.jsx";
import PlateCalculatorPanel, { PlateCalculatorToggle } from "./components/PlateCalculatorPanel.jsx";
import MuscleBodyOutline from "./components/MuscleBodyOutline.jsx";
import ExerciseAnatomyRow from "./components/ExerciseAnatomyRow.jsx";
import { formatSetPrescription } from "./utils/exercisePrescription.js";
import QuickLoadAdjuster from "./components/QuickLoadAdjuster.jsx";
import { unlockAudio, playCompletionBeep, vibratePattern } from "./utils/timerAudio.js";
import NutritionHome from "./components/NutritionHome.jsx";
import FoodLogScreen from "./components/FoodLogScreen.jsx";
import MealPlanView from "./components/MealPlanView.jsx";
import NutritionCheckInScreen from "./components/NutritionCheckInScreen.jsx";
import ScanFoodChooser from "./components/ScanFoodChooser.jsx";
import BarcodeScannerScreen from "./components/BarcodeScannerScreen.jsx";
import NutritionLabelScannerScreen from "./components/NutritionLabelScannerScreen.jsx";
import AddFoodScreen from "./components/AddFoodScreen.jsx";
import FoodDetailScreen from "./components/FoodDetailScreen.jsx";
import { todayDateKey } from "./utils/nutrition.js";
import { SET_TYPES, isWarmup, countedSets, formatSetCompact, rirRpeSuffix, formatSetVerbose, formatSessionDuration } from "./utils/workoutSets.js";
import WorkoutHistoryDetail from "./components/WorkoutHistoryDetail.jsx";
import { findMostRecentSessionForPlan } from "./utils/workoutHistory.js";
import { buildPRShareCard } from "./utils/shareCard.js";
import WorkoutSharePreview from "./components/WorkoutSharePreview.jsx";
import { suggestNext, topSetOf } from "./utils/progression.js";
import { resolveCurrentProgramDay, programWeekAdherence } from "./utils/programSchedule.js";
import { ScreenHeader, SectionLabel, Card, HeroCard, PhotoHero, ButtonPrimary, ButtonSecondary, ButtonText, StatTile, Pill, ListRow, ProgressBar, LineChart, PeriodSelect } from "./components/ui/Kit.jsx";
import { featuredAndOtherPRs, sessionPRCount, prDeltaLabel, prHeroLabel, prPreviousLabel, PR_TYPE_LABEL } from "./utils/prSummary.js";
import CustomExerciseForm from "./components/CustomExerciseForm.jsx";
import { selectableExercises, matchesExerciseSearch, formatCustomLabel, isArchived } from "./utils/customExercises.js";
import StartWorkoutChoice from "./components/StartWorkoutChoice.jsx";
import RepeatRecentWorkoutPicker from "./components/RepeatRecentWorkoutPicker.jsx";
import BreakMeaningPage from "./components/BreakMeaningPage.jsx";

// B.R.E.A.K. logo (uploaded asset, embedded as data URI so the artifact stays self-contained).
// Exported so any screen that needs the official mark (e.g. BreakMeaningPage) reuses this exact
// asset instead of re-embedding or redrawing it.
export const BREAK_LOGO =
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
  // Titan's approved Chest day (see HERO_PROGRAMS / programFamilies.js) leads with this
  // specifically — no existing incline Smith-machine entry to point at, so it's added rather than
  // substituting a different movement (per the task's "add the safest semantic exercise entry
  // without breaking existing exercise IDs").
  { id: "incline_smith_press", name: "Incline Smith machine press", type: "compound", muscle: "Chest" },
  { id: "chest_press_machine", name: "Chest press machine", type: "compound", muscle: "Chest" },
  { id: "incline_chest_press_machine", name: "Incline chest press machine", type: "compound", muscle: "Chest" },
  { id: "pec_deck", name: "Pec deck / chest fly machine", type: "isolation", muscle: "Chest" },
  { id: "cable_fly", name: "Cable fly (mid)", type: "isolation", muscle: "Chest" },
  { id: "cable_fly_low_high", name: "Low-to-high cable fly", type: "isolation", muscle: "Chest" },
  { id: "cable_fly_high_low", name: "High-to-low cable fly", type: "isolation", muscle: "Chest" },
  { id: "db_fly", name: "Dumbbell fly", type: "isolation", muscle: "Chest" },
  { id: "dips_chest", name: "Chest dip", type: "compound", muscle: "Chest" },
  // Berserker's Bench day (see below) prescribes an externally-loaded dip as its own accessory,
  // distinct from the bodyweight "Chest dip" above — added rather than reusing that id so the
  // program's loading intent (added weight, not bodyweight-to-failure) stays honest.
  { id: "weighted_dip", name: "Weighted dip", type: "compound", muscle: "Chest" },
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
  // Titan's approved Back day (see HERO_PROGRAMS) calls for a two-arm chest-supported DUMBBELL
  // row specifically — distinct from the machine version above and from the single-arm dumbbell
  // row below. No existing entry covers it, so it's added per the task's "add the safest semantic
  // exercise entry without breaking existing exercise IDs."
  { id: "chest_supported_db_row", name: "Chest-supported dumbbell row", type: "compound", muscle: "Back" },
  { id: "single_arm_db_row", name: "Single-arm dumbbell row", type: "compound", muscle: "Back" },
  { id: "seal_row", name: "Seal row", type: "compound", muscle: "Back" },
  { id: "lat_pulldown", name: "Lat pulldown (wide grip)", type: "compound", muscle: "Back" },
  { id: "close_grip_pulldown", name: "Close-grip pulldown", type: "compound", muscle: "Back" },
  { id: "single_arm_pulldown", name: "Single-arm lat pulldown", type: "compound", muscle: "Back" },
  { id: "seated_row", name: "Seated cable row", type: "compound", muscle: "Back" },
  { id: "high_row_machine", name: "High row machine", type: "compound", muscle: "Back" },
  { id: "iso_row_machine", name: "Iso-lateral row machine", type: "compound", muscle: "Back" },
  { id: "straight_arm_pulldown", name: "Straight-arm pulldown", type: "isolation", muscle: "Back" },
  { id: "db_pullover", name: "Dumbbell pullover", type: "isolation", muscle: "Back" },
  { id: "barbell_pullover", name: "Barbell pullover", type: "isolation", muscle: "Back" },
  { id: "cable_pullover", name: "Cable pullover", type: "isolation", muscle: "Back" },
  { id: "machine_pullover", name: "Machine pullover", type: "isolation", muscle: "Back" },
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
  { id: "stairmaster", name: "StairMaster", type: "isolation", muscle: "Conditioning" },
  { id: "treadmill_walk", name: "Treadmill walk", type: "isolation", muscle: "Conditioning" },
  { id: "treadmill_incline_walk", name: "Treadmill incline walk", type: "isolation", muscle: "Conditioning" },
  { id: "treadmill_jog", name: "Treadmill jog", type: "isolation", muscle: "Conditioning" },
  { id: "elliptical", name: "Elliptical", type: "isolation", muscle: "Conditioning" },
  { id: "stationary_bike", name: "Stationary bike", type: "isolation", muscle: "Conditioning" },
  { id: "rowing_machine", name: "Rowing machine", type: "isolation", muscle: "Conditioning" },
  { id: "jump_rope", name: "Jump rope", type: "isolation", muscle: "Conditioning" },

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

  // Hammer Strength line — Plate-Loaded, Select (selectorized), MTS (selectorized iso-lateral),
  // and Ground Base equipment families. The equipment family lives in the exercise name itself
  // (e.g. "MTS", "Select", "Plate-Loaded") rather than a separate field, matching how the
  // Arsenal Strength line above encodes its own equipment distinctions — this schema has no
  // equipment/brand/secondary-muscle/alias field to add one to. Movements that share a single
  // physical machine but train genuinely different muscles (the Select Pectoral Fly / Rear
  // Deltoid combo unit, the Chest/Back combo unit) are still separate records here so each has
  // its own independent progression history, exactly as a distinct movement pattern would.
  { id: "hammer_strength_iso_bench_press", name: "Hammer Strength Iso-Lateral Bench Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_iso_horizontal_bench_press", name: "Hammer Strength Iso-Lateral Horizontal Bench Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_iso_incline_press", name: "Hammer Strength Iso-Lateral Incline Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_iso_super_incline_press", name: "Hammer Strength Iso-Lateral Super Incline Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_iso_decline_chest_press", name: "Hammer Strength Iso-Lateral Decline Chest Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_iso_wide_chest_press", name: "Hammer Strength Iso-Lateral Wide Chest Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_iso_chest_press", name: "Hammer Strength Iso-Lateral Chest Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_plate_super_fly", name: "Hammer Strength Plate-Loaded Super Fly", type: "isolation", muscle: "Chest" },
  { id: "hammer_strength_chest_back_chest_press", name: "Hammer Strength Chest/Back Chest Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_select_chest_press", name: "Hammer Strength Select Chest Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_select_pectoral_fly", name: "Hammer Strength Select Pectoral Fly", type: "isolation", muscle: "Chest" },
  { id: "hammer_strength_mts_chest_press", name: "Hammer Strength MTS Iso-Lateral Chest Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_mts_incline_press", name: "Hammer Strength MTS Iso-Lateral Incline Press", type: "compound", muscle: "Chest" },
  { id: "hammer_strength_mts_decline_press", name: "Hammer Strength MTS Iso-Lateral Decline Press", type: "compound", muscle: "Chest" },

  { id: "hammer_strength_iso_row", name: "Hammer Strength Iso-Lateral Row", type: "compound", muscle: "Back" },
  { id: "hammer_strength_iso_low_row", name: "Hammer Strength Iso-Lateral Low Row", type: "compound", muscle: "Back" },
  { id: "hammer_strength_iso_dy_row", name: "Hammer Strength Iso-Lateral D.Y. Row", type: "compound", muscle: "Back" },
  { id: "hammer_strength_t_bar_row", name: "Hammer Strength T-Bar Row", type: "compound", muscle: "Back" },
  { id: "hammer_strength_iso_wide_pulldown", name: "Hammer Strength Iso-Lateral Wide Pulldown", type: "compound", muscle: "Back" },
  { id: "hammer_strength_iso_front_lat_pulldown", name: "Hammer Strength Iso-Lateral Front Lat Pulldown", type: "compound", muscle: "Back" },
  { id: "hammer_strength_plate_pullover", name: "Hammer Strength Plate-Loaded Pullover", type: "isolation", muscle: "Back" },
  { id: "hammer_strength_chest_back_lat_pulldown", name: "Hammer Strength Chest/Back Lat Pulldown", type: "compound", muscle: "Back" },
  { id: "hammer_strength_select_lat_pulldown", name: "Hammer Strength Select Lat Pulldown", type: "compound", muscle: "Back" },
  { id: "hammer_strength_select_fixed_pulldown", name: "Hammer Strength Select Fixed Pulldown", type: "compound", muscle: "Back" },
  { id: "hammer_strength_select_seated_row", name: "Hammer Strength Select Seated Row", type: "compound", muscle: "Back" },
  { id: "hammer_strength_mts_row", name: "Hammer Strength MTS Iso-Lateral Row", type: "compound", muscle: "Back" },
  { id: "hammer_strength_mts_high_row", name: "Hammer Strength MTS Iso-Lateral High Row", type: "compound", muscle: "Back" },
  { id: "hammer_strength_mts_front_pulldown", name: "Hammer Strength MTS Iso-Lateral Front Pulldown", type: "compound", muscle: "Back" },
  { id: "hammer_strength_assisted_chin_up", name: "Hammer Strength Assisted Chin-Up", type: "compound", muscle: "Back" },

  { id: "hammer_strength_iso_shoulder_press", name: "Hammer Strength Iso-Lateral Shoulder Press", type: "compound", muscle: "Shoulders" },
  { id: "hammer_strength_select_shoulder_press", name: "Hammer Strength Select Shoulder Press", type: "compound", muscle: "Shoulders" },
  { id: "hammer_strength_select_lateral_raise", name: "Hammer Strength Select Lateral Raise", type: "isolation", muscle: "Shoulders" },
  { id: "hammer_strength_mts_shoulder_press", name: "Hammer Strength MTS Iso-Lateral Shoulder Press", type: "compound", muscle: "Shoulders" },
  // Same physical combo unit as hammer_strength_select_pectoral_fly above, but a genuinely
  // different movement pattern and muscle target — kept as an independent record on purpose so
  // its progression history is never mixed with the pec-fly movement (see section header note).
  { id: "hammer_strength_select_rear_deltoid", name: "Hammer Strength Select Rear Deltoid", type: "isolation", muscle: "Shoulders" },

  { id: "hammer_strength_plate_seated_biceps", name: "Hammer Strength Plate-Loaded Seated Biceps", type: "isolation", muscle: "Arms" },
  { id: "hammer_strength_select_biceps_curl", name: "Hammer Strength Select Biceps Curl", type: "isolation", muscle: "Arms" },
  { id: "hammer_strength_mts_biceps_curl", name: "Hammer Strength MTS Iso-Lateral Biceps Curl", type: "isolation", muscle: "Arms" },
  { id: "hammer_strength_plate_seated_dip", name: "Hammer Strength Plate-Loaded Seated Dip", type: "compound", muscle: "Arms" },
  { id: "hammer_strength_select_triceps_extension", name: "Hammer Strength Select Triceps Extension", type: "isolation", muscle: "Arms" },
  { id: "hammer_strength_mts_triceps_extension", name: "Hammer Strength MTS Iso-Lateral Triceps Extension", type: "isolation", muscle: "Arms" },
  { id: "hammer_strength_plate_gripper", name: "Hammer Strength Plate-Loaded Gripper", type: "isolation", muscle: "Arms" },
  { id: "hammer_strength_assisted_dip", name: "Hammer Strength Assisted Dip", type: "compound", muscle: "Arms" },

  { id: "hammer_strength_linear_leg_press", name: "Hammer Strength Linear Leg Press", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_hack_squat", name: "Hammer Strength Hack Squat", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_pendulum_x_squat", name: "Hammer Strength Pendulum-X Squat", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_belt_squat", name: "Hammer Strength Belt Squat", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_ground_base_multi_squat", name: "Hammer Strength Ground Base Multi-Squat", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_iso_leg_extension", name: "Hammer Strength Iso-Lateral Leg Extension", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_select_seated_leg_press", name: "Hammer Strength Select Seated Leg Press", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_select_leg_extension", name: "Hammer Strength Select Leg Extension", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_mts_leg_extension", name: "Hammer Strength MTS Leg Extension", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_iso_kneeling_leg_curl", name: "Hammer Strength Iso-Lateral Kneeling Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_select_leg_curl", name: "Hammer Strength Select Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_select_seated_leg_curl", name: "Hammer Strength Select Seated Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_mts_kneeling_leg_curl", name: "Hammer Strength MTS Kneeling Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_plate_glute_drive", name: "Hammer Strength Plate-Loaded Glute Drive", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_select_hip_and_glute", name: "Hammer Strength Select Hip and Glute", type: "compound", muscle: "Legs" },
  { id: "hammer_strength_select_hip_abduction", name: "Hammer Strength Select Hip Abduction", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_select_hip_adduction", name: "Hammer Strength Select Hip Adduction", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_plate_seated_calf_raise", name: "Hammer Strength Plate-Loaded Seated Calf Raise", type: "isolation", muscle: "Legs" },
  // Ankle dorsiflexion (tibialis anterior), not a calf (plantarflexion) movement — deliberately
  // not classified alongside the calf raises above despite living on adjacent equipment.
  { id: "hammer_strength_plate_tibia_dorsi_flexion", name: "Hammer Strength Plate-Loaded Tibia Dorsi Flexion", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_select_standing_calf", name: "Hammer Strength Select Standing Calf", type: "isolation", muscle: "Legs" },
  { id: "hammer_strength_select_horizontal_calf", name: "Hammer Strength Select Horizontal Calf", type: "isolation", muscle: "Legs" },

  { id: "hammer_strength_plate_ab_oblique_crunch", name: "Hammer Strength Plate-Loaded Abdominal Oblique Crunch", type: "isolation", muscle: "Core" },
  { id: "hammer_strength_select_abdominal_crunch", name: "Hammer Strength Select Abdominal Crunch", type: "isolation", muscle: "Core" },
  { id: "hammer_strength_select_back_extension", name: "Hammer Strength Select Back Extension", type: "isolation", muscle: "Core" },
  { id: "hammer_strength_mts_abdominal_crunch", name: "Hammer Strength MTS Abdominal Crunch", type: "isolation", muscle: "Core" },

  // Bodyweight / calisthenics line. Entries already covered by an existing exercise (e.g. plain
  // "Push-up", "Walking lunge", "Glute bridge", "Ab wheel rollout") are intentionally NOT
  // duplicated here — only genuinely new movements/variants/progressions are added. A few
  // requested names were themselves duplicates of each other (Australian Pull-Up is the same
  // movement as Inverted Row; Mountain Climber was listed under both Core and Full Body) and
  // were only added once. Existing "pullup"/"chinup"/"plank" ids are specifically the WEIGHTED
  // variants, so the plain bodyweight versions below use distinct ids and remain separate,
  // independently trackable exercises rather than being merged into those.
  { id: "straight_bar_dip", name: "Straight Bar Dip", type: "compound", muscle: "Chest" },
  { id: "ring_dip", name: "Ring Dip", type: "compound", muscle: "Chest" },
  { id: "incline_pushup", name: "Incline Push-Up", type: "compound", muscle: "Chest" },
  { id: "decline_pushup", name: "Decline Push-Up", type: "compound", muscle: "Chest" },
  { id: "diamond_pushup", name: "Diamond Push-Up", type: "compound", muscle: "Arms" },
  { id: "wide_grip_pushup", name: "Wide-Grip Push-Up", type: "compound", muscle: "Chest" },
  { id: "close_grip_pushup", name: "Close-Grip Push-Up", type: "compound", muscle: "Arms" },
  { id: "deficit_pushup", name: "Deficit Push-Up", type: "compound", muscle: "Chest" },
  { id: "ring_pushup", name: "Ring Push-Up", type: "compound", muscle: "Chest" },
  { id: "plyo_pushup", name: "Plyometric Push-Up", type: "compound", muscle: "Chest" },
  { id: "clap_pushup", name: "Clap Push-Up", type: "compound", muscle: "Chest" },
  { id: "hand_release_pushup", name: "Hand-Release Push-Up", type: "compound", muscle: "Chest" },

  { id: "bodyweight_pullup", name: "Pull-Up", type: "compound", muscle: "Back" },
  { id: "bodyweight_chinup", name: "Chin-Up", type: "compound", muscle: "Back" },
  { id: "neutral_grip_pullup", name: "Neutral-Grip Pull-Up", type: "compound", muscle: "Back" },
  { id: "wide_grip_pullup", name: "Wide-Grip Pull-Up", type: "compound", muscle: "Back" },
  { id: "close_grip_pullup", name: "Close-Grip Pull-Up", type: "compound", muscle: "Back" },
  { id: "commando_pullup", name: "Commando Pull-Up", type: "compound", muscle: "Back" },
  { id: "sternum_pullup", name: "Sternum Pull-Up", type: "compound", muscle: "Back" },
  { id: "chest_to_bar_pullup", name: "Chest-to-Bar Pull-Up", type: "compound", muscle: "Back" },
  { id: "inverted_row", name: "Inverted Row", type: "compound", muscle: "Back" },
  { id: "ring_row", name: "Ring Row", type: "compound", muscle: "Back" },
  { id: "feet_elevated_inverted_row", name: "Feet-Elevated Inverted Row", type: "compound", muscle: "Back" },
  { id: "scapular_pullup", name: "Scapular Pull-Up", type: "isolation", muscle: "Back" },

  { id: "pike_pushup", name: "Pike Push-Up", type: "compound", muscle: "Shoulders" },
  { id: "elevated_pike_pushup", name: "Elevated Pike Push-Up", type: "compound", muscle: "Shoulders" },
  { id: "handstand_pushup", name: "Handstand Push-Up", type: "compound", muscle: "Shoulders" },
  { id: "wall_handstand_pushup", name: "Wall Handstand Push-Up", type: "compound", muscle: "Shoulders" },
  { id: "handstand_hold", name: "Handstand Hold", type: "isolation", muscle: "Shoulders" },
  { id: "wall_handstand_hold", name: "Wall Handstand Hold", type: "isolation", muscle: "Shoulders" },

  { id: "bodyweight_squat", name: "Bodyweight Squat", type: "compound", muscle: "Legs" },
  { id: "tempo_bodyweight_squat", name: "Tempo Bodyweight Squat", type: "compound", muscle: "Legs" },
  { id: "pause_bodyweight_squat", name: "Pause Bodyweight Squat", type: "compound", muscle: "Legs" },
  { id: "bodyweight_split_squat", name: "Bodyweight Split Squat", type: "compound", muscle: "Legs" },
  { id: "forward_lunge", name: "Forward Lunge", type: "compound", muscle: "Legs" },
  { id: "lateral_lunge", name: "Lateral Lunge", type: "compound", muscle: "Legs" },
  { id: "curtsy_lunge", name: "Curtsy Lunge", type: "compound", muscle: "Legs" },
  { id: "reverse_step_up", name: "Reverse Step-Up", type: "compound", muscle: "Legs" },
  { id: "pistol_squat", name: "Pistol Squat", type: "compound", muscle: "Legs" },
  { id: "assisted_pistol_squat", name: "Assisted Pistol Squat", type: "compound", muscle: "Legs" },
  { id: "shrimp_squat", name: "Shrimp Squat", type: "compound", muscle: "Legs" },
  { id: "sissy_squat", name: "Sissy Squat", type: "isolation", muscle: "Legs" },
  { id: "assisted_sissy_squat", name: "Assisted Sissy Squat", type: "isolation", muscle: "Legs" },
  { id: "wall_sit", name: "Wall Sit", type: "isolation", muscle: "Legs" },
  { id: "jump_squat", name: "Jump Squat", type: "compound", muscle: "Legs" },
  { id: "box_jump", name: "Box Jump", type: "compound", muscle: "Legs" },
  { id: "broad_jump", name: "Broad Jump", type: "compound", muscle: "Legs" },
  { id: "split_squat_jump", name: "Split Squat Jump", type: "compound", muscle: "Legs" },
  { id: "lunge_jump", name: "Lunge Jump", type: "compound", muscle: "Legs" },

  { id: "single_leg_glute_bridge", name: "Single-Leg Glute Bridge", type: "compound", muscle: "Legs" },
  { id: "bodyweight_hip_thrust", name: "Hip Thrust — Bodyweight", type: "compound", muscle: "Legs" },
  { id: "single_leg_hip_thrust", name: "Single-Leg Hip Thrust — Bodyweight", type: "compound", muscle: "Legs" },
  { id: "assisted_nordic_curl", name: "Assisted Nordic Hamstring Curl", type: "isolation", muscle: "Legs" },
  { id: "sliding_leg_curl", name: "Sliding Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "bodyweight_leg_curl", name: "Bodyweight Leg Curl", type: "isolation", muscle: "Legs" },
  { id: "donkey_kick", name: "Donkey Kick", type: "isolation", muscle: "Legs" },
  { id: "fire_hydrant", name: "Fire Hydrant", type: "isolation", muscle: "Legs" },
  { id: "frog_pump", name: "Frog Pump", type: "isolation", muscle: "Legs" },

  { id: "single_leg_calf_raise", name: "Single-Leg Calf Raise — Bodyweight", type: "isolation", muscle: "Legs" },
  { id: "tibialis_raise", name: "Tibialis Raise — Bodyweight", type: "isolation", muscle: "Legs" },
  { id: "single_leg_tibialis_raise", name: "Single-Leg Tibialis Raise", type: "isolation", muscle: "Legs" },

  { id: "crunch", name: "Crunch", type: "isolation", muscle: "Core" },
  { id: "situp", name: "Sit-Up", type: "isolation", muscle: "Core" },
  { id: "reverse_crunch", name: "Reverse Crunch", type: "isolation", muscle: "Core" },
  { id: "leg_raise", name: "Leg Raise", type: "isolation", muscle: "Core" },
  { id: "lying_leg_raise", name: "Lying Leg Raise", type: "isolation", muscle: "Core" },
  { id: "captains_chair_knee_raise", name: "Captain's Chair Knee Raise", type: "isolation", muscle: "Core" },
  { id: "captains_chair_leg_raise", name: "Captain's Chair Leg Raise", type: "isolation", muscle: "Core" },
  { id: "v_up", name: "V-Up", type: "isolation", muscle: "Core" },
  { id: "toe_touch", name: "Toe Touch", type: "isolation", muscle: "Core" },
  { id: "dead_bug", name: "Dead Bug", type: "isolation", muscle: "Core" },
  { id: "bird_dog", name: "Bird Dog", type: "isolation", muscle: "Core" },
  { id: "plank_bodyweight", name: "Plank", type: "isolation", muscle: "Core" },
  { id: "reverse_plank", name: "Reverse Plank", type: "isolation", muscle: "Core" },
  { id: "rkc_plank", name: "RKC Plank", type: "isolation", muscle: "Core" },
  { id: "mountain_climber", name: "Mountain Climber", type: "compound", muscle: "Core" },
  { id: "cross_body_mountain_climber", name: "Cross-Body Mountain Climber", type: "compound", muscle: "Core" },
  { id: "bicycle_crunch", name: "Bicycle Crunch", type: "isolation", muscle: "Core" },
  { id: "kneeling_ab_wheel_rollout", name: "Kneeling Ab Wheel Rollout", type: "isolation", muscle: "Core" },
  { id: "standing_ab_wheel_rollout", name: "Standing Ab Wheel Rollout", type: "isolation", muscle: "Core" },
  { id: "dragon_flag", name: "Dragon Flag", type: "isolation", muscle: "Core" },
  { id: "dragon_flag_negative", name: "Dragon Flag Negative", type: "isolation", muscle: "Core" },
  { id: "hollow_body_hold", name: "Hollow Body Hold", type: "isolation", muscle: "Core" },
  { id: "hollow_body_rock", name: "Hollow Body Rock", type: "isolation", muscle: "Core" },

  { id: "burpee", name: "Burpee", type: "compound", muscle: "Full body" },
  { id: "burpee_pushup", name: "Burpee With Push-Up", type: "compound", muscle: "Full body" },
  { id: "burpee_box_jump", name: "Burpee Box Jump", type: "compound", muscle: "Full body" },
  { id: "bear_crawl", name: "Bear Crawl", type: "compound", muscle: "Full body" },
  { id: "crab_walk", name: "Crab Walk", type: "compound", muscle: "Full body" },
  { id: "inchworm", name: "Inchworm", type: "compound", muscle: "Full body" },
  { id: "high_knees", name: "High Knees", type: "compound", muscle: "Full body" },
  { id: "butt_kicks", name: "Butt Kicks", type: "compound", muscle: "Full body" },
  { id: "skater_jump", name: "Skater Jump", type: "compound", muscle: "Full body" },
  { id: "jumping_jack", name: "Jumping Jack", type: "compound", muscle: "Full body" },

  { id: "dead_hang", name: "Dead Hang", type: "isolation", muscle: "Back" },
  { id: "active_hang", name: "Active Hang", type: "isolation", muscle: "Back" },
  { id: "l_sit", name: "L-Sit", type: "isolation", muscle: "Core" },
  { id: "tuck_l_sit", name: "Tuck L-Sit", type: "isolation", muscle: "Core" },
  { id: "support_hold", name: "Support Hold", type: "isolation", muscle: "Arms" },
  { id: "dip_support_hold", name: "Dip Support Hold", type: "isolation", muscle: "Arms" },
  { id: "planche_lean", name: "Planche Lean", type: "isolation", muscle: "Chest" },
  { id: "front_lever_hold", name: "Front Lever Hold", type: "isolation", muscle: "Back" },
  { id: "front_lever_tuck", name: "Front Lever Tuck", type: "isolation", muscle: "Back" },
  { id: "back_lever_hold", name: "Back Lever Hold", type: "isolation", muscle: "Back" },
  { id: "back_lever_tuck", name: "Back Lever Tuck", type: "isolation", muscle: "Back" },
  { id: "muscle_up", name: "Muscle-Up", type: "compound", muscle: "Back" },
  { id: "bar_muscle_up", name: "Bar Muscle-Up", type: "compound", muscle: "Back" },
  { id: "ring_muscle_up", name: "Ring Muscle-Up", type: "compound", muscle: "Back" },
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
// Titan used to be a single hard-coded 5-day object here. It's now authored as a program FAMILY
// (src/data/programFamilies.js) with a 2/3/4/5/6-day variant, expanded into the same flat
// { id, name, tagline, weeks, days } shape every program in this array already has — the 5-day
// variant keeps Titan's original id (`prog_superman`) and exact original day content, so nothing
// changes for anyone already on Titan. See programFamilies.js for the adaptation rationale.
const HERO_PROGRAMS = [
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
    // Approved programming spec: 4 hard lifting days + 3 tracked recovery/mobility days — see
    // src/data/mobilityLibrary.js for the recovery routines referenced below and
    // programSchedule.js for how a `type: "recovery"` day resolves/advances. id kept unchanged
    // (prog_punisher, from the pre-rename "Punisher" era) so already-active Berserker athletes
    // keep pointing at valid data — only the day CONTENT changes, per the task's explicit
    // instruction to rebuild this program.
    id: "prog_punisher",
    name: "Berserker",
    tagline: "Raw brute strength — heavy compounds, low reps, no wasted volume",
    // Declared intended emphasis (task section 19) — informational display only, shown
    // alongside but never merged with an athlete's own Development Priorities.
    programFocus: ["Chest", "Back", "Quads"],
    weeks: 8,
    days: [
      {
        label: "Day 1: Squat Strength",
        exercises: [
          { exId: "squat", sets: 5, reps: 5 },
          { exId: "rdl", sets: 3, reps: 7, repRange: [6, 8] },
          { exId: "bulgarian_split_squat", sets: 3, reps: 9, repRange: [8, 10] },
          { exId: "leg_curl_seated", sets: 3, reps: 10, repRange: [8, 12] },
          { exId: "calf_raise_standing", sets: 3, reps: 12, repRange: [10, 15] },
        ],
      },
      { label: "Day 2: Lower Recovery + Mobility", type: "recovery", routineId: "lower_body_recovery" },
      {
        label: "Day 3: Bench Strength",
        exercises: [
          { exId: "bench", sets: 5, reps: 5 },
          { exId: "chest_supported_row", sets: 4, reps: 7, repRange: [6, 8] },
          { exId: "ohp", sets: 3, reps: 6, repRange: [5, 8] },
          { exId: "weighted_dip", sets: 3, reps: 8, repRange: [6, 10] },
          { exId: "tricep_pushdown", sets: 3, reps: 11, repRange: [10, 12] },
        ],
      },
      { label: "Day 4: Upper Recovery + Mobility", type: "recovery", routineId: "upper_body_recovery" },
      {
        label: "Day 5: Deadlift Strength",
        exercises: [
          { exId: "deadlift", sets: 5, reps: 4, repRange: [3, 5] },
          { exId: "pullup", sets: 4, reps: 6, repRange: [5, 8] },
          { exId: "barbell_row", sets: 3, reps: 7, repRange: [6, 8] },
          { exId: "farmers_carry", sets: 3, reps: 1 },
          { exId: "back_extension", sets: 3, reps: 10, repRange: [8, 12] },
        ],
      },
      {
        label: "Day 6: Overhead / Upper Strength",
        exercises: [
          { exId: "ohp", sets: 5, reps: 5 },
          { exId: "close_grip_bench", sets: 3, reps: 7, repRange: [6, 8] },
          { exId: "chinup", sets: 3, reps: 7, repRange: [6, 8] },
          { exId: "barbell_curl", sets: 3, reps: 9, repRange: [8, 10] },
          { exId: "skullcrusher", sets: 3, reps: 9, repRange: [8, 10] },
        ],
      },
      { label: "Day 7: Full Recovery + Mobility", type: "recovery", routineId: "full_body_recovery" },
    ],
  },
  {
    id: "prog_thor",
    name: "Ragnar",
    tagline: "God-tier mass and power — huge shoulders, back, and grip",
    // Declared intended emphasis (task section 19's own literal example) — informational
    // display only, shown alongside but never merged with an athlete's own Development
    // Priorities (setting Calves as a personal #1 priority must never rewrite this array).
    programFocus: ["Shoulders", "Back", "Traps", "Grip"],
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
    // Declared intended emphasis (task section 19) — informational display only, shown
    // alongside but never merged with an athlete's own Development Priorities.
    programFocus: ["Back", "Quads", "Shoulders"],
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
  {
    id: "prog_valkyrie",
    name: "Valkyrie",
    tagline: "Glutes, hips, and hamstrings lead every week — lower body hypertrophy with just enough upper body to stay balanced",
    weeks: 10,
    days: [
      {
        label: "Day 1: Glutes & hamstrings",
        exercises: [
          { exId: "rdl", sets: 4, reps: 8 },
          { exId: "hip_thrust", sets: 4, reps: 10 },
          { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
          { exId: "leg_curl_seated", sets: 3, reps: 12 },
          { exId: "cable_pull_through", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 2: Upper body push/pull",
        exercises: [
          { exId: "db_bench", sets: 3, reps: 10 },
          { exId: "seated_row", sets: 3, reps: 10 },
          { exId: "db_shoulder_press", sets: 3, reps: 12 },
          { exId: "lat_pulldown", sets: 3, reps: 12 },
          { exId: "tricep_pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        label: "Day 3: Glutes & quads",
        exercises: [
          { exId: "squat", sets: 4, reps: 8 },
          { exId: "walking_lunge", sets: 3, reps: 12 },
          { exId: "hip_thrust_machine", sets: 3, reps: 12 },
          { exId: "leg_extension", sets: 3, reps: 15 },
          { exId: "hip_abduction_machine", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Shoulders & arms",
        exercises: [
          { exId: "lat_raise", sets: 3, reps: 15 },
          { exId: "hammer_curl", sets: 3, reps: 12 },
          { exId: "overhead_tricep_ext", sets: 3, reps: 12 },
          { exId: "rear_delt_fly", sets: 3, reps: 15 },
          { exId: "face_pull", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 5: Glute burnout & core",
        exercises: [
          { exId: "hip_thrust", sets: 4, reps: 12 },
          { exId: "glute_kickback_machine", sets: 3, reps: 15 },
          { exId: "hip_adduction_machine", sets: 3, reps: 15 },
          { exId: "step_up", sets: 3, reps: 12 },
          { exId: "hanging_leg_raise", sets: 3, reps: 15 },
        ],
      },
    ],
  },
  {
    id: "prog_huntress",
    name: "Huntress",
    tagline: "Full-body strength with a lean, athletic finish — higher reps, real conditioning, no wasted days",
    weeks: 8,
    days: [
      {
        label: "Day 1: Full body strength A",
        exercises: [
          { exId: "squat", sets: 3, reps: 10 },
          { exId: "db_bench", sets: 3, reps: 10 },
          { exId: "seated_row", sets: 3, reps: 10 },
          { exId: "rdl", sets: 3, reps: 10 },
          { exId: "plank", sets: 3, reps: 1 },
        ],
      },
      {
        label: "Day 2: Conditioning & core",
        exercises: [
          { exId: "kb_swing", sets: 4, reps: 15 },
          { exId: "battle_ropes", sets: 4, reps: 30 },
          { exId: "hanging_leg_raise", sets: 3, reps: 12 },
          { exId: "russian_twist", sets: 3, reps: 20 },
        ],
      },
      {
        label: "Day 3: Full body strength B",
        exercises: [
          { exId: "deadlift", sets: 3, reps: 8 },
          { exId: "ohp", sets: 3, reps: 10 },
          { exId: "lat_pulldown", sets: 3, reps: 10 },
          { exId: "walking_lunge", sets: 3, reps: 12 },
          { exId: "cable_crunch", sets: 3, reps: 15 },
        ],
      },
      {
        label: "Day 4: Glutes & arms finisher",
        exercises: [
          { exId: "hip_thrust", sets: 4, reps: 12 },
          { exId: "leg_curl_seated", sets: 3, reps: 12 },
          { exId: "db_curl", sets: 3, reps: 12 },
          { exId: "tricep_pushdown", sets: 3, reps: 12 },
          { exId: "lat_raise", sets: 3, reps: 15 },
        ],
      },
    ],
  },
  // ---- 3-day starter programs ----
  // Beginner/intermediate-friendly, frequency-driven (not identity-driven like the hero
  // programs above): these are what programRecommendation.js recommends when an athlete says
  // they can train 3 days/week. `repRange`/`rir` are optional display-only metadata (read by
  // TemplatesTab's program preview) layered on top of the existing `sets`/`reps` fields every
  // other program/template already uses — `reps` itself stays a plain representative number so
  // every existing consumer (progression, TemplatesTab list rows, custom-plan/program copies)
  // keeps working unmodified.
  {
    id: "prog_3day_full_body",
    name: "3-Day Full Body",
    tagline: "Train every major muscle group three times per week with balanced full-body sessions.",
    weeks: 12,
    days: [
      {
        label: "Full Body A",
        exercises: [
          { exId: "bench", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "chest_supported_row", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "squat", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "leg_curl_seated", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "lat_raise", sets: 2, reps: 15, repRange: [12, 20], rir: [1, 2] },
          { exId: "barbell_curl", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "tricep_pushdown", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
      {
        label: "Full Body B",
        exercises: [
          { exId: "ohp", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "lat_pulldown", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "rdl", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "leg_press", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "cable_fly", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "hammer_curl", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "overhead_tricep_ext", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
      {
        label: "Full Body C",
        exercises: [
          { exId: "incline_bench", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "barbell_row", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "hack_squat", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "leg_curl_seated", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "rear_delt_fly", sets: 2, reps: 15, repRange: [12, 20], rir: [1, 2] },
          { exId: "calf_raise_standing", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "cable_crunch", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
    ],
  },
  {
    id: "prog_3day_ppl",
    name: "3-Day Push / Pull / Legs",
    tagline: "A classic three-day bodybuilding split with dedicated push, pull, and lower-body sessions.",
    weeks: 12,
    days: [
      {
        label: "Push",
        exercises: [
          { exId: "bench", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "incline_bench", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "ohp", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "cable_fly", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "lat_raise", sets: 3, reps: 15, repRange: [12, 20], rir: [1, 2] },
          { exId: "tricep_pushdown", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "overhead_tricep_ext", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
      {
        label: "Pull",
        exercises: [
          { exId: "lat_pulldown", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "chest_supported_row", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "barbell_row", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "rear_delt_fly", sets: 3, reps: 15, repRange: [12, 20], rir: [1, 2] },
          { exId: "barbell_curl", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "hammer_curl", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
      {
        label: "Legs",
        exercises: [
          { exId: "squat", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "leg_press", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "rdl", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "leg_curl_seated", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "leg_extension", sets: 3, reps: 13, repRange: [12, 15], rir: [1, 2] },
          { exId: "calf_raise_standing", sets: 4, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "cable_crunch", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
    ],
  },
  {
    id: "prog_3day_upper_lower_full",
    name: "3-Day Upper / Lower / Full Body",
    tagline: "A hybrid three-day split combining focused upper/lower training with a balanced full-body day.",
    weeks: 12,
    days: [
      {
        label: "Upper",
        exercises: [
          { exId: "bench", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "chest_supported_row", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "incline_bench", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "lat_pulldown", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "lat_raise", sets: 3, reps: 15, repRange: [12, 20], rir: [1, 2] },
          { exId: "barbell_curl", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "tricep_pushdown", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
      {
        label: "Lower",
        exercises: [
          { exId: "squat", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "rdl", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "leg_press", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "leg_curl_seated", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "calf_raise_standing", sets: 3, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "cable_crunch", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
        ],
      },
      {
        label: "Full Body",
        exercises: [
          { exId: "ohp", sets: 3, reps: 8, repRange: [6, 10], rir: [1, 2] },
          { exId: "lat_pulldown", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "incline_bench", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "barbell_row", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "leg_press", sets: 3, reps: 10, repRange: [8, 12], rir: [1, 2] },
          { exId: "rdl", sets: 2, reps: 12, repRange: [10, 15], rir: [1, 2] },
          { exId: "lat_raise", sets: 2, reps: 15, repRange: [12, 20], rir: [1, 2] },
        ],
      },
    ],
  },
  // Titan (all 5 frequency variants), Athena, and Shape — see src/data/programFamilies.js.
  ...FAMILY_PROGRAMS,
];

// Defaults for the auto-started rest timer, keyed by movement category. Compound lifts get
// the longest rest, isolation/conditioning/superset work progressively less — overridable
// per-category in Settings.
const DEFAULT_REST_DEFAULTS = { compound: 150, isolation: 90, conditioning: 60, superset: 45 };

function loadInitialState() {
  return {
    templates: DEFAULT_TEMPLATES,
    programs: HERO_PROGRAMS,
    customPlans: [],
    customPrograms: [], // { id, name, tagline, days: [{ label, exercises }] }
    customExercises: [], // { id, name, type, muscle, secondaryMuscles?, equipment?, movementCategory?, brand?, notes?, custom: true, archived?, createdAt }
    logs: [], // { id, exId, date, sets: [{weight, reps, drops?, setType?, rir?, rpe?}], targetReps }
    cardioLogs: [], // { id, exId, date, distance, distanceUnit, duration, load, notes }
    currentProgram: null, // { programId, programName, source: "builtin" | "custom", dayIndex, totalDays, startDate, selectedForDays? }
    // Set only when the athlete changes Planned Training Days while a program is active (see
    // AthleteProfileForm.save()) — { fromDays, toDays, at }. TemplatesTab shows a Review/Keep
    // banner while this is set and clears it either way; it never mutates currentProgram itself.
    pendingFrequencyReview: null,
    // A one-day "swap workout" override — { programId, source, dayIndex, date } — set by
    // SwapWorkoutSheet when the athlete picks a different day of their CURRENT program to run
    // today. Never mutates currentProgram.dayIndex or the program's own day data (see
    // programSchedule.js's activeOverrideFor/resolveCurrentProgramDay). Cleared once its workout
    // is completed (finishRun), once a genuinely different program is started (startRun), or
    // simply stops applying once the calendar date moves past it.
    programDayOverride: null,
    photos: [], // { id, date, context, dataUrl }
    completedPrograms: [], // { id, programId, programSource, programName, weeks, startDate, endDate }
    hasSeenOnboarding: false, // sticky — never re-derived from current data, only set true by a real action
    settings: {
      rirSystem: "rir", // "rir" | "rpe"
      restDefaults: DEFAULT_REST_DEFAULTS,
      barWeight: 45,
    },
    exerciseNotes: {}, // { [exId]: { general, machine, cue } }
    workoutSessions: [], // finished guided-run summaries — see buildSessionSummary()
    // Finished mobility/recovery sessions — deliberately a SEPARATE collection from
    // workoutSessions (never mixed in) so lifting analytics/PRs/volume can never be corrupted by
    // stretching. See src/utils/mobilitySession.js buildRecoverySessionSummary().
    recoverySessions: [],
    goals: [], // { id, title, type, startValue, currentValue, targetValue, targetDate, units,
    // priority: "primary"|"secondary", notes, status: "active"|"paused"|"completed",
    // linkedExId?, metric?, history?, createdAt } — see src/utils/goalMath.js, goalData.js
    bodyweightLogs: [], // { id, date, weight, waist, bodyFat, notes }
    readinessLogs: [], // { id, date, sleepQuality, sleepHours, soreness, stress, motivation, energy, restingHR, notes }
    coachHistory: [], // { id, date, type: "morning_checkin"|"pre_workout"|"post_workout"|"weekly_review"|"question", question?, message }
    weeklySchedule: null, // { mode: "fixed"|"rolling", fixedDays?, rollingSequence?, rollingCursor?, createdAt } — see src/utils/weeklySchedule.js
    scheduleLog: [], // sparse per-date overrides (skip/move/resolved) — see src/utils/weeklySchedule.js
    recoveryLogs: [], // { id, date, activity, notes } — logged from an Active Recovery scheduled day
    athleteProfile: null, // Coach memory Layer 1 — see src/utils/athleteProfile.js
    coachMemories: [], // Coach memory Layer 3, persisted/evolving — see src/utils/coachMemoryStore.js
    commitments: [], // see src/utils/commitments.js
    specialtyInterest: {}, // { [specialtyId]: true } — "Notify me" taps on locked Coach specialties, see src/coachSpecialties
    coachAccess: null, // future trial/subscription scaffold, unenforced — see backupKeyDefault
    coachOnboarding: null, // { specialtySelected, specialty, confirmedAt } — see src/utils/coachOnboarding.js
    coachConversations: [], // real multi-turn AI chat threads — { id, createdAt, updatedAt, specialty, messages: [...] } — see src/utils/coachConversations.js
    // ---------------- NUTRITION ----------------
    // See src/utils/nutrition.js for shape helpers/defaults. Kept as flat top-level state keys
    // (not nested under one "nutrition" object) so each piece follows the same persist/backup
    // convention as every other data type here, and so a future cloud sync can map each entity
    // to its own table without an unpacking step.
    nutritionProfile: null, // assessment answers + realistic-adherence + control level — Layer 1, mirrors athleteProfile.js
    nutritionTargets: null, // { calories, protein, carbs, fat, estimatedMaintenance, method, history: [...] }
    foodLogs: [], // { id, date, time, meal, food, brand?, servingDesc, serving_quantity?, serving_unit?, serving_grams?, calories, protein, carbs, fat, fiber?, source, food_id?, fdcId? } — source: manual|quick|food|saved_meal|recent|barcode|usda
    savedFoods: [], // { id, name, servingDesc, calories, protein, carbs, fat, fiber?, lastUsedAt }
    savedMeals: [], // { id, name, items: [{ name, calories, protein, carbs, fat }], totals, lastUsedAt }
    favoriteFoods: [], // { id, name, brand?, servingDesc, basis, servingGrams, calories, protein, carbs, fat, fiber?, source, fdcId?, favoritedAt } — see src/utils/foodSearchService.js
    nutritionMealPlan: null, // generated FULL MEAL PLAN — { meals: [{ id, label, time, items, totals }], generatedAt }
    nutritionCheckIns: [], // { id, date, hunger, energy, trainingPerformance, difficulty (1-5), events, canRepeat }
    nutritionCoachAdjustments: [], // { id, date, fromCalories, toCalories, fromMacros, toMacros, reason, status }
    // Which muscle groups the athlete says matter most — informational + Coach context only,
    // never used to auto-rewrite curated programs. null until the athlete visits the screen;
    // sanitizeDevelopmentPriorities(null) already returns a full "everything at Develop" default,
    // so nothing else needs a null-check. See src/utils/developmentPriorities.js.
    developmentPriorities: null,
    // Append-only record of "a swap displaced the active program's own planned day for today" —
    // written only by SwapWorkoutSheet's commitRow, read only by resolveProgramTimeline (see
    // programSchedule.js) so a deliberately-rescheduled day reads as SWAPPED there rather than
    // MISSED once its week concludes. Never read by anything else, never mutates dayIndex/
    // history/completion — purely an additive annotation layer. { date, programId, source,
    // dayIndex, dayLabel }
    programSwapLog: [],
    // Optional saved "which physical machine did you use" profiles — see
    // src/utils/equipmentProfiles.js. Additive/backward-compatible: an exercise with no
    // profiles here, or a log entry with no equipmentProfileId, behaves exactly as BRK always
    // has (bucket "Default Machine"). { id, exerciseId, label, gymLabel, isDefault, createdAt }
    equipmentProfiles: [],
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

// One-time corrective fix for a Coach onboarding bug that shipped briefly: an earlier build
// auto-migrated anyone with pre-existing Coach data (Athlete Profile / history / memories)
// straight past "Select Your Coach," silently defaulting them to Bodybuilding — treating old
// Coach usage as proof a specialty had been explicitly chosen, which it never was. That path
// is the only place `coachOnboarding.migrationNoticeShown` was ever written; the corrected
// picker flow no longer writes that field at all, so its mere presence on a saved record is
// an unambiguous fingerprint of "this user was silently auto-migrated by the old bug, not by
// their own explicit confirmation." For exactly those records, resets specialtySelected back
// to false so they see the real picker once, the way they should have originally — every
// other field (their Athlete Profile, history, memories, commitments, everything else) is
// left completely untouched.
function migrateStaleCoachOnboarding(state) {
  const onboarding = state.coachOnboarding;
  if (onboarding && Object.prototype.hasOwnProperty.call(onboarding, "migrationNoticeShown")) {
    const { migrationNoticeShown, ...rest } = onboarding;
    return { ...state, coachOnboarding: { ...rest, specialtySelected: false, specialty: null, confirmedAt: null } };
  }
  return state;
}

// ---------- Data export / import ----------
// Everything the user has actually created — not the built-in templates/programs, which
// ship with the app and always come from source, never from a backup file.
const BACKUP_DATA_KEYS = [
  "logs",
  "cardioLogs",
  "customExercises",
  "customPlans",
  "customPrograms",
  "currentProgram",
  "photos",
  "completedPrograms",
  "settings",
  "exerciseNotes",
  "workoutSessions",
  "recoverySessions",
  "goals",
  "bodyweightLogs",
  "readinessLogs",
  "coachHistory",
  "weeklySchedule",
  "scheduleLog",
  "recoveryLogs",
  "athleteProfile",
  "coachMemories",
  "commitments",
  "specialtyInterest",
  "coachAccess",
  "coachOnboarding",
  "coachConversations",
  "nutritionProfile",
  "nutritionTargets",
  "foodLogs",
  "savedFoods",
  "savedMeals",
  "favoriteFoods",
  "nutritionMealPlan",
  "nutritionCheckIns",
  "nutritionCoachAdjustments",
  "developmentPriorities",
  "programSwapLog",
  "equipmentProfiles",
];

// Per-key fallback when a key is missing from state entirely (older saves) — objects default
// to {}, currentProgram/weeklySchedule/athleteProfile/coachAccess/coachOnboarding/
// nutritionProfile/nutritionTargets/nutritionMealPlan to null, everything else (arrays) to [].
function backupKeyDefault(key) {
  if (
    key === "currentProgram" ||
    key === "weeklySchedule" ||
    key === "athleteProfile" ||
    key === "coachAccess" ||
    key === "coachOnboarding" ||
    key === "nutritionProfile" ||
    key === "nutritionTargets" ||
    key === "nutritionMealPlan" ||
    key === "developmentPriorities"
  )
    return null;
  if (key === "settings" || key === "exerciseNotes" || key === "specialtyInterest") return {};
  return [];
}

function exportBackupFile(state) {
  const payload = {
    app: "BRK - Lift",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(BACKUP_DATA_KEYS.map((k) => [k, state[k] ?? backupKeyDefault(k)])),
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

// Turns the raw editor rows (string inputs, possibly-empty drop rows) into the clean shape
// saved to state.logs. A set is dropped entirely if its own weight/reps are blank; an
// individual blank drop row is dropped without affecting the rest. drops/setType/rir/rpe are
// omitted from the result whenever they'd carry only a default/empty value, keeping old and
// new saved entries structurally identical wherever nothing new was actually used.
function cleanSetsInput(sets) {
  return sets
    .filter((s) => s.weight !== "" && s.reps !== "")
    .map((s) => {
      const cleanDrops = (s.drops || [])
        .filter((d) => d.weight !== "" && d.reps !== "")
        .map((d) => ({ weight: Number(d.weight), reps: Number(d.reps) }));
      return {
        weight: Number(s.weight),
        reps: Number(s.reps),
        ...(cleanDrops.length > 0 ? { drops: cleanDrops } : {}),
        ...(s.setType && s.setType !== "working" ? { setType: s.setType } : {}),
        ...(s.rir !== "" && s.rir != null ? { rir: Number(s.rir) } : {}),
        ...(s.rpe !== "" && s.rpe != null ? { rpe: Number(s.rpe) } : {}),
        // Passthrough only — no UI here builds these from scratch (see TrainingExerciseCard's
        // quality/pain quick-flag), but preserving whatever's already on the row keeps an
        // existing flag intact if this set is later re-saved through the shared set editor
        // (EditLogEntryPanel), instead of silently discarding it because the editor doesn't
        // itself offer a way to change it.
        ...(s.quality ? { quality: s.quality } : {}),
        ...(s.pain ? { pain: s.pain } : {}),
      };
    });
}

// ---------- PR detection ----------
// Epley formula — the standard, simple estimated-1RM approximation. Not exact, never claimed
// to be; just a consistent basis for comparing effort across different rep ranges.
function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}
// Sum of weight*reps across a counted set's main reps plus any drops — drops are real reps at
// real weight, so they count toward volume even though they're ignored for suggestNext/PRs
// that are specifically about the top working weight.
function setVolume(s) {
  const dropVolume = (s.drops || []).reduce((sum, d) => sum + d.weight * d.reps, 0);
  return s.weight * s.reps + dropVolume;
}
function entryVolume(entry) {
  return countedSets(entry.sets).reduce((sum, s) => sum + setVolume(s), 0);
}

// Compares a freshly-saved entry against every prior log for the same exercise (priorLogs
// must NOT include the new entry itself) and reports which PR categories it broke. Returns
// [] for an exercise's very first-ever log — there's no baseline yet to call a "record."
//
// Equipment-profile aware (see utils/equipmentProfiles.js): the PR check itself is always
// scoped to newEntry's own equipment bucket (same saved profile, or both "Default Machine") —
// never comparing a heavier easy-machine number against a lighter hard-machine one, and never
// letting a "different machine today" temporary entry claim or contribute to a record at all.
// For an athlete who's never touched equipment profiles, every entry shares the same null
// bucket, so this is byte-identical to the exercise's full history — nothing changes. Each PR
// also carries a `scope`: "all-time" when the bucketed number is also the best across every
// other bucket ever logged for this exercise (the only case possible before this feature
// existed, and the common case even after — most machine exercises never get more than one
// profile), or "profile" when some OTHER bucket already has a heavier/better number, so the UI
// never announces an "ALL-TIME PR" that's really just this one machine's best.
function detectPRs(exId, newEntry, priorLogs) {
  const targetProfileId = newEntry.equipmentProfileId ?? null;
  const targetContext = newEntry.equipmentContext ?? null;
  const bucketPriorForEx = priorLogs.filter((l) => l.exId === exId && sameEquipmentBucket(l, targetProfileId, targetContext));
  const newCounted = countedSets(newEntry.sets);
  if (bucketPriorForEx.length === 0 || newCounted.length === 0) return [];

  // Temporary-variant entries are excluded from the all-time pool too (they're never a fair
  // baseline for anyone), but otherwise this is every bucket combined — used only to decide PR
  // *labeling*, never whether a PR fired (that's always the bucket-scoped numbers above).
  const allTimePriorForEx = priorLogs.filter((l) => l.exId === exId && l.equipmentContext !== TEMPORARY_EQUIPMENT_CONTEXT);
  const usesMultipleBuckets = bucketPriorForEx.length !== allTimePriorForEx.length;

  const bucketCountedSets = bucketPriorForEx.flatMap((l) => countedSets(l.sets));
  const prevMaxWeight = Math.max(0, ...bucketCountedSets.map((s) => s.weight));
  const prevMaxE1RM = Math.max(0, ...bucketCountedSets.map((s) => estimateOneRM(s.weight, s.reps)));
  const prevMaxVolume = Math.max(0, ...bucketPriorForEx.map(entryVolume));
  // Best reps ever previously done at a weight >= this one, so a rep PR only counts against
  // an equal-or-harder load, never an easier one.
  const prevBestRepsAtWeight = (weight) =>
    Math.max(0, ...bucketCountedSets.filter((s) => s.weight >= weight).map((s) => s.reps));

  // Identical to the bucketed numbers above whenever no other bucket has any history (the
  // default, pre-feature case) — deliberately not recomputed in that case, so scope is always
  // "all-time" then, matching current behavior exactly.
  const allTimeCountedSets = usesMultipleBuckets ? allTimePriorForEx.flatMap((l) => countedSets(l.sets)) : bucketCountedSets;
  const allTimeMaxWeight = usesMultipleBuckets ? Math.max(0, ...allTimeCountedSets.map((s) => s.weight)) : prevMaxWeight;
  const allTimeMaxE1RM = usesMultipleBuckets ? Math.max(0, ...allTimeCountedSets.map((s) => estimateOneRM(s.weight, s.reps))) : prevMaxE1RM;
  const allTimeMaxVolume = usesMultipleBuckets ? Math.max(0, ...allTimePriorForEx.map(entryVolume)) : prevMaxVolume;
  const scopeFor = (achieved, allTimeMax) => (achieved > allTimeMax ? "all-time" : "profile");

  // Task section 7/15: a difficult set still counts as a real PR (never silently deleted) but is
  // labeled distinctly rather than presented as identical, unqualified evidence to a clean PR —
  // CLEAN / GRIND / FLAGGED (Form Breakdown) / FLAGGED (Pain). Grind carries through here too
  // (unlike isConcerningQuality's suppression check in progression.js, which deliberately treats
  // only Form Breakdown/Pain as strong enough to hold back a load increase) — a PR still fires
  // and is still a real record on a Grind set, just softly labeled instead of shown as clean.
  const flagOf = (set) => (set && set.quality && set.quality !== "clean" ? set.quality : null);
  // Multiple sets can carry different quality flags in one entry (e.g. a Pain-flagged top set
  // plus a Clean back-off set) — the exerciseVolume PR spans the WHOLE entry, so it must surface
  // whichever flag is most concerning rather than defaulting to "Form Breakdown" regardless of
  // what actually happened (task section 6: never mislabel a Pain set as Form Breakdown).
  const QUALITY_FLAG_PRIORITY = { pain: 3, form_breakdown: 2, grind: 1 };
  const worstQualityOf = (sets) =>
    sets.reduce((worst, s) => {
      const rank = QUALITY_FLAG_PRIORITY[s.quality] || 0;
      return rank > (QUALITY_FLAG_PRIORITY[worst] || 0) ? s.quality : worst;
    }, null);

  const prs = [];
  const heaviestSet = newCounted.reduce((best, s) => (s.weight > best.weight ? s : best), newCounted[0]);
  if (heaviestSet.weight > prevMaxWeight) {
    prs.push({
      type: "weight",
      weight: heaviestSet.weight,
      reps: heaviestSet.reps,
      prev: prevMaxWeight,
      scope: scopeFor(heaviestSet.weight, allTimeMaxWeight),
      equipmentProfileId: targetProfileId,
      qualityFlag: flagOf(heaviestSet),
    });
  }
  const repPrSet = newCounted.find((s) => s.reps > prevBestRepsAtWeight(s.weight));
  if (repPrSet) {
    prs.push({
      type: "reps",
      weight: repPrSet.weight,
      reps: repPrSet.reps,
      prev: prevBestRepsAtWeight(repPrSet.weight),
      // A true weight-conditional all-time check is fuzzier across buckets — conservatively
      // downgrades to "profile" whenever another bucket exists rather than risk overclaiming.
      scope: usesMultipleBuckets ? "profile" : "all-time",
      equipmentProfileId: targetProfileId,
      qualityFlag: flagOf(repPrSet),
    });
  }
  const bestE1RMSet = newCounted.reduce(
    (best, s) => (estimateOneRM(s.weight, s.reps) > estimateOneRM(best.weight, best.reps) ? s : best),
    newCounted[0]
  );
  const newE1RM = estimateOneRM(bestE1RMSet.weight, bestE1RMSet.reps);
  if (newE1RM > prevMaxE1RM) {
    prs.push({
      type: "e1rm",
      weight: bestE1RMSet.weight,
      reps: bestE1RMSet.reps,
      value: Math.round(newE1RM),
      prev: Math.round(prevMaxE1RM),
      scope: scopeFor(newE1RM, allTimeMaxE1RM),
      equipmentProfileId: targetProfileId,
      qualityFlag: flagOf(bestE1RMSet),
    });
  }
  const newVolume = entryVolume(newEntry);
  if (newVolume > prevMaxVolume) {
    prs.push({
      type: "exerciseVolume",
      value: Math.round(newVolume),
      prev: Math.round(prevMaxVolume),
      scope: scopeFor(newVolume, allTimeMaxVolume),
      equipmentProfileId: targetProfileId,
      qualityFlag: worstQualityOf(newCounted),
    });
  }
  return prs;
}

// ---------- Plate calculator ----------
// Moved to utils/plateMath.js (PLATE_SIZES, platesPerSide) and components/PlateCalculatorPanel.jsx
// (the tap-to-build UI, PlateCalculatorToggle) — imported at the top of this file.

// ---------- Post-workout summary ----------
// Builds the record saved to state.workoutSessions when a guided run is finished. priorLogs
// should be state.logs *excluding* this session's own entries (they're already in state.logs
// by the time this runs) so PR detection compares against what came before the session, not
// against itself.
function buildSessionSummary(run, allLogs, priorSessions, exMap) {
  const finishedAt = new Date();
  const startedAt = run.startedAt ? new Date(run.startedAt) : finishedAt;
  const durationSec = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
  const entries = run.sessionEntries.map((se) => se.entry);
  const entryIds = new Set(entries.map((e) => e.id));
  const priorLogs = allLogs.filter((l) => !entryIds.has(l.id));

  let workingSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  const rirValues = [];
  const muscleCounts = {};
  const prs = [];

  entries.forEach((entry) => {
    const counted = countedSets(entry.sets);
    workingSets += counted.length;
    counted.forEach((s) => {
      totalReps += s.reps + (s.drops || []).reduce((sum, d) => sum + d.reps, 0);
      if (s.rir != null) rirValues.push(s.rir);
      else if (s.rpe != null) rirValues.push(10 - s.rpe);
    });
    totalVolume += entryVolume(entry);
    const muscle = exMap[entry.exId]?.muscle;
    if (muscle) muscleCounts[muscle] = (muscleCounts[muscle] || 0) + 1;
    detectPRs(entry.exId, entry, priorLogs).forEach((pr) => prs.push({ ...pr, exId: entry.exId }));
  });

  const avgRir = rirValues.length > 0 ? rirValues.reduce((s, v) => s + v, 0) / rirValues.length : null;
  const mainMuscles = Object.entries(muscleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);

  const prevSameFn = priorSessions
    .filter((s) => s.planName === run.planName)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  const prevSame = prevSameFn[0] || null;
  const perfDeltaPct =
    prevSame && prevSame.totalVolume > 0 ? Math.round(((totalVolume - prevSame.totalVolume) / prevSame.totalVolume) * 1000) / 10 : null;

  const prevMaxSessionVolume = Math.max(0, ...priorSessions.map((s) => s.totalVolume || 0));
  const isVolumePR = priorSessions.length > 0 && totalVolume > prevMaxSessionVolume;

  // "Best lift" for the headline — prefer an actual weight/e1RM PR; fall back to the single
  // best e1RM set of the session when nothing broke a record.
  let bestLift = null;
  const headlinePR = prs.find((p) => p.type === "weight") || prs.find((p) => p.type === "e1rm");
  if (headlinePR) {
    bestLift = { exId: headlinePR.exId, weight: headlinePR.weight, reps: headlinePR.reps };
  } else {
    let best = null;
    entries.forEach((entry) => {
      countedSets(entry.sets).forEach((s) => {
        const e1rm = estimateOneRM(s.weight, s.reps);
        if (!best || e1rm > best.e1rm) best = { exId: entry.exId, weight: s.weight, reps: s.reps, e1rm };
      });
    });
    bestLift = best;
  }

  return {
    id: `session_${Date.now()}`,
    planName: run.planName,
    // Optional metadata only — nothing existing reads this. "program" for a scheduled program
    // day, "blank"/"repeated" for the two off-program Start Workout Today paths, "custom" as
    // the catch-all for every pre-existing plan/template start that predates this field.
    source: run.source || (run.programContext ? "program" : "custom"),
    // Where the workout actually came from — set even when it's NOT the active program (an
    // outside-program/standalone swap-workout override; see programSchedule.js's
    // resolveTodayWorkout). Lets history show provenance without ever mislabeling a workout as
    // whatever program happens to be active. Falls back to the run's own programContext (the
    // normal, own-program case) so every existing program-day session already has this filled
    // in identically to before this field existed. Optional/additive — nothing existing reads it.
    sourceProgramId: run.sourceProgramId ?? run.programContext?.programId ?? null,
    sourceProgramName: run.sourceProgramName ?? run.programContext?.programName ?? null,
    sourceDayLabel: run.sourceDayLabel ?? null,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationSec,
    exerciseCount: entries.length,
    workingSets,
    totalReps,
    totalVolume: Math.round(totalVolume),
    prs,
    isVolumePR,
    mainMuscles,
    avgRir: avgRir != null ? Math.round(avgRir * 10) / 10 : null,
    perfDeltaPct,
    bestLift,
    rating: null,
    // Snapshot of exactly what was performed, in performed order — independent of state.logs
    // going forward, so editing/deleting a log entry later can never retroactively change what
    // a historical Workout History Detail view shows for this session (see
    // components/WorkoutHistoryDetail.jsx). Sessions finished before this field existed simply
    // won't have it; the detail screen degrades gracefully rather than reconstructing a guess.
    entries: entries.map((e) => ({
      exId: e.exId,
      sets: e.sets,
      targetReps: e.targetReps,
      ...(e.equipmentProfileId ? { equipmentProfileId: e.equipmentProfileId } : {}),
      ...(e.equipmentContext ? { equipmentContext: e.equipmentContext } : {}),
      // Exercise-level joint/pain note (task section 12) — separate from any per-set `pain`
      // flag already carried on e.sets itself.
      ...(e.jointNote ? { jointNote: e.jointNote } : {}),
    })),
    // Travel/Alternate Gym mode (task Part 3) — whole-session, defaults to "normal" for every
    // run that predates this. Read by workoutRecap.js's "ALTERNATE GYM SESSION" note.
    sessionContext: sanitizeSessionContext(run.sessionContext),
  };
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

// The main nav is deliberately just these four — everything else (mission detail, cardio,
// templates, build, catalog, top used, photos, settings, coach) is still its own screen with
// its own `tab` id, just reached by tapping into it from one of these four instead of having
// a permanent slot in the bar. SECTION_OF is only for highlighting which of the four is
// "closest" to wherever the user actually is; it doesn't gate access to anything.
const TOP_TABS = [
  { id: "today", label: "Today", icon: Home },
  { id: "train", label: "Train", icon: Dumbbell },
  { id: "coach", label: "Coach", icon: MessageCircle },
  { id: "progress", label: "Progress", icon: Scale },
  { id: "more", label: "More", icon: MoreHorizontal },
];
const SECTION_OF = {
  today: "today",
  mission: "today",
  coach: "coach",
  coachKnowledge: "coach",
  coachProfile: "coach",
  coachSettings: "coach",
  coachSelect: "coach",
  nutrition: "coach",
  nutritionLog: "coach",
  nutritionMealPlan: "coach",
  nutritionCheckIn: "coach",
  nutritionScan: "coach",
  nutritionScanBarcode: "coach",
  nutritionScanLabel: "coach",
  foodSearch: "coach",
  foodDetail: "coach",
  workoutDetail: "today",
  sessionRecap: "today",
  train: "train",
  log: "train",
  cardio: "train",
  templates: "train",
  build: "train",
  progress: "progress",
  photos: "progress",
  more: "more",
  catalog: "more",
  top: "more",
  settings: "more",
  schedule: "more",
  dataWorkbook: "more",
  breakMeaning: "more",
  intervalTimer: "train",
  mobility: "more",
  mobilityDetail: "more",
  mobilitySession: "more",
  developmentPriorities: "coach",
  programTimeline: "train",
};

// Travel/Alternate Gym mode (task Part 3) — a whole-session flag, not per-exercise. Defaults to
// "normal" so every existing/older run (and every run started without ever touching Session
// Options) behaves exactly as before this existed.
function sanitizeSessionContext(raw) {
  const locationMode = raw?.locationMode === "alternate_gym" ? "alternate_gym" : "normal";
  const locationLabel = typeof raw?.locationLabel === "string" && raw.locationLabel.trim() ? raw.locationLabel.trim().slice(0, 80) : null;
  return { locationMode, locationLabel };
}

// ---------------- ACTIVE WORKOUT DRAFT PERSISTENCE ----------------
// The persisted shape of `liftlog-active-run`. Bumping this only matters if a future change
// makes an old draft meaningfully incompatible — sanitizeActiveRun() below already recovers as
// much of an old/partial object as it can rather than discarding it, so most schema growth
// (like adding draftByIndex here) never needs a bump at all.
const ACTIVE_RUN_VERSION = 1;
// Defends against a corrupted/partial/pre-this-change `liftlog-active-run` value crashing the
// workout screen: every field is defaulted individually so one missing/malformed property (an
// old save from before draftByIndex existed, a hand-edited value, truncated storage, etc.) never
// takes the rest of a legitimate in-progress workout down with it. Returns null only when there's
// nothing usable at all.
function sanitizeActiveRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  try {
    return {
      version: ACTIVE_RUN_VERSION,
      planName: typeof raw.planName === "string" && raw.planName ? raw.planName : "Workout",
      exercises: Array.isArray(raw.exercises) ? raw.exercises : [],
      sessionEntries: Array.isArray(raw.sessionEntries) ? raw.sessionEntries : [],
      swaps: raw.swaps && typeof raw.swaps === "object" ? raw.swaps : {},
      finished: !!raw.finished,
      returnTab: typeof raw.returnTab === "string" ? raw.returnTab : "templates",
      programContext: raw.programContext && typeof raw.programContext === "object" ? raw.programContext : null,
      source: typeof raw.source === "string" ? raw.source : null,
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString(),
      // Per-exercise-slot in-progress state (confirmed-but-exercise-not-finished sets, plus the
      // current unsaved set draft) — see TrainingExerciseCard's draft autosave. Keyed by the
      // exercise's index within `exercises`, cleared the moment that slot's exercise is finished.
      draftByIndex: raw.draftByIndex && typeof raw.draftByIndex === "object" ? raw.draftByIndex : {},
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : (typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString()),
      summaryId: raw.summaryId ?? null,
      coachHistoryId: raw.coachHistoryId ?? null,
      // Travel/Alternate Gym mode (see SessionOptionsSheet) — a whole-session flag, defaulting
      // to "normal" for every run started before this existed. Persists immediately on change
      // (task section 28), same treatment as an equipment-profile selection.
      sessionContext: sanitizeSessionContext(raw.sessionContext),
    };
  } catch (e) {
    return null;
  }
}

export default function LiftLog() {
  const [state, setState] = useState(loadInitialState());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  // Lazy-initted straight from localStorage (not loaded in an effect like `state` below) so
  // an in-progress workout is already in place on the very first render — no flash back to
  // the plan-picker tab, and no race with the persist effect right below.
  const [activeRun, setActiveRun] = useState(() => {
    try {
      const raw = window.localStorage.getItem("liftlog-active-run");
      return raw ? sanitizeActiveRun(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  });
  // Lets the athlete navigate to other tabs (Progress, More, Train) mid-workout without losing
  // it — GuidedRunView stays mounted in `activeRun` the whole time, this just controls whether
  // it's the thing currently on screen. Tapping "Exit" mid-workout sets this true instead of
  // clearing activeRun (that used to destroy the whole in-progress session with zero
  // confirmation); Train then surfaces a "Resume workout" card to bring it back. Always reset to
  // false on a fresh startRun() so a brand-new workout is never born already minimized.
  const [workoutMinimized, setWorkoutMinimized] = useState(false);
  // Mobility/recovery navigation — deliberately plain component state, not persisted: a
  // recovery session is an intentionally lightweight, ephemeral flow (see MobilitySessionRunner
  // and finishRecoverySession), so an in-progress one simply doesn't survive a refresh; "Log
  // Recovery Session" from the library remains the always-available fallback either way.
  const [mobilitySelectedId, setMobilitySelectedId] = useState(null);
  const [mobilityRunContext, setMobilityRunContext] = useState(null); // { routine, programContext, returnTab }
  // Drives the small "Saved / Saving… / Not saved" indicator during an active workout — see the
  // activeRun-persist effect below (which is the single place that actually knows whether the
  // localStorage write succeeded) and TrainingExerciseCard's draft-dirty callback (which flips
  // this to "saving" the instant a field changes, ahead of the debounce actually committing).
  const [persistStatus, setPersistStatus] = useState("saved");
  const markDraftDirty = useCallback(() => setPersistStatus("saving"), []);
  // Transient hand-off from BarcodeScannerScreen's "unknown barcode" path to
  // NutritionLabelScannerScreen — the scanned barcode gets attached to the food the user is
  // about to build from the label photo. Navigation-only state, never persisted.
  const [pendingScanBarcode, setPendingScanBarcode] = useState(null);
  // Hand-off from the Daily Food Log's "+ Add Food" (per meal, or the top-level Search Food)
  // into AddFoodScreen, and from AddFoodScreen's search results into FoodDetailScreen — which
  // meal/date to log into, and which food object was selected. Navigation-only, never persisted.
  const [pendingFoodMeal, setPendingFoodMeal] = useState(null);
  const [pendingFoodDate, setPendingFoodDate] = useState(null);
  const [pendingSelectedFood, setPendingSelectedFood] = useState(null);
  // Which day the Daily Food Log is viewing — lifted out of FoodLogScreen itself so it
  // survives navigating away to Add Food/Food Detail and back (a plain useState inside
  // FoodLogScreen would reset to today on every remount, silently losing "I was reviewing
  // yesterday" context right after adding something).
  const [dailyLogDate, setDailyLogDate] = useState(() => todayDateKey());
  // What the AI Coach chat should reference when opened from somewhere other than its own
  // tab — a just-finished session, or a specific date's nutrition — so the compact context sent
  // with the athlete's first message already points the model at the right tool call (spec
  // sections 31-33). Cleared whenever the athlete navigates to Coach on their own.
  const [pendingCoachContext, setPendingCoachContext] = useState(null);
  // Which completed session Workout History Detail is currently showing — set by whichever
  // entry point (Today, Program day list, Training Calendar, Session Complete) the user tapped
  // "View Workout" from, all of which open this same id + the same detail screen.
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const viewWorkout = (sessionId) => {
    setSelectedSessionId(sessionId);
    setTab("workoutDetail");
  };
  // Auto Post-Workout Recap (task Part 1) — reopenable from Workout History → Session → Recap
  // (task section 1), reusing the same selectedSessionId plumbing as viewWorkout so there's one
  // way sessions get looked up, not two.
  const viewRecap = (sessionId) => {
    setSelectedSessionId(sessionId);
    setTab("sessionRecap");
  };
  // Keeps the in-progress (or just-finished-but-not-yet-exited) run surviving a closed tab,
  // backgrounded phone, or crash — otherwise closing mid-workout silently drops everything
  // that wasn't already saved as a logged set. Cleared once the user actually exits the run
  // (finishRun -> "Back to plans", or Exit), not merely on "Finish workout".
  useEffect(() => {
    try {
      if (activeRun) window.localStorage.setItem("liftlog-active-run", JSON.stringify(activeRun));
      else window.localStorage.removeItem("liftlog-active-run");
      if (activeRun) setPersistStatus("saved");
    } catch (e) {
      // Storage full/unavailable (private browsing, quota exceeded, etc.) — the workout keeps
      // running normally in memory, but the athlete needs to know it won't survive a close, not
      // see a false "Saved" while nothing was actually written.
      if (activeRun) setPersistStatus("error");
    }
  }, [activeRun]);
  const [restBump, setRestBump] = useState({ token: 0, seconds: 90 });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("liftlog-data");
      if (raw) {
        const parsed = JSON.parse(raw);
        setState((s) => {
          // templates/programs are static, app-shipped content — always take the fresh
          // in-source copy, never whatever got persisted from an older build. Older saves
          // (from before persist() excluded them) can still carry a stale copy forward
          // through this spread otherwise, silently reverting any future edit to the
          // built-in library — which is exactly what happened with this rename.
          const merged = { ...s, ...parsed, templates: DEFAULT_TEMPLATES, programs: HERO_PROGRAMS };
          let migrated = migrateProgramNames(merged);
          migrated = migrateStaleCoachOnboarding(migrated);
          // Backward-compat: a returning user whose save predates the onboarding flag
          // already clearly isn't a fresh install — retroactively mark them as having
          // seen it so they never see the welcome screen. A brand-new install has no
          // `raw` at all, so this block never runs for them and the loadInitialState()
          // default (false) correctly stands.
          if (!migrated.hasSeenOnboarding) {
            const alreadyActive =
              (migrated.logs || []).length > 0 || (migrated.cardioLogs || []).length > 0 || !!migrated.currentProgram;
            if (alreadyActive) migrated = { ...migrated, hasSeenOnboarding: true };
          }
          try {
            const { templates, programs, ...toPersist } = migrated;
            window.localStorage.setItem("liftlog-data", JSON.stringify(toPersist));
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
      // Never persist templates/programs — they're static app content that should
      // always come from source on the next load, not a snapshot from whatever build
      // last saved.
      const { templates, programs, ...toPersist } = next;
      window.localStorage.setItem("liftlog-data", JSON.stringify(toPersist));
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

  // Picks the right rest duration for whatever just got logged and (re)starts the global
  // timer at it. Accepts a logged entry (category derived from its exercise's compound/
  // isolation type), or a plain category string directly (e.g. CardioTab passes
  // "conditioning" — there's no exMap lookup for a run/row).
  const bumpRestTimer = useCallback(
    (arg) => {
      // Called synchronously from the Save Set click handler — the real user-gesture call
      // stack, and a more reliable place for iOS to honor an AudioContext resume() than a
      // useEffect reacting to the resulting state change one render later.
      unlockAudio();
      const defaults = { ...DEFAULT_REST_DEFAULTS, ...(state.settings?.restDefaults || {}) };
      let category = "compound";
      if (typeof arg === "string" && defaults[arg] != null) category = arg;
      else if (arg && typeof arg === "object" && arg.exId) category = exMap[arg.exId]?.type === "isolation" ? "isolation" : "compound";
      const seconds = defaults[category] ?? defaults.compound;
      const nextWeight = arg && typeof arg === "object" ? arg.nextWeight : undefined;
      const nextReps = arg && typeof arg === "object" ? arg.nextReps : undefined;
      setRestBump((prev) => ({ token: prev.token + 1, seconds, nextWeight, nextReps }));
    },
    [state.settings, exMap]
  );

  const startRun = (plan, fromTab, programContext) => {
    const now = new Date().toISOString();
    setWorkoutMinimized(false);
    setPersistStatus("saved");
    setActiveRun({
      version: ACTIVE_RUN_VERSION,
      planName: plan.name,
      exercises: plan.exercises,
      sessionEntries: [],
      swaps: {},
      finished: false,
      returnTab: fromTab,
      programContext: programContext || null,
      // Optional metadata only (see buildSessionSummary) — "blank"/"repeated" come from the
      // plan object the Start Workout Today choice screen builds; every other caller leaves
      // plan.source unset and gets the same "program"/"custom" inference as before this existed.
      source: plan.source || null,
      // Provenance metadata (see buildSessionSummary / resolveTodayWorkout) — set whenever the
      // workout came from an outside-program swap-workout override or a standalone plan/custom
      // build, so history can record what was ACTUALLY performed without depending on whatever
      // program happens to be active later. Falls back to programContext for the normal
      // own-program case, and to null for every pre-existing caller that supplies neither.
      sourceProgramId: plan.sourceProgramId ?? programContext?.programId ?? null,
      sourceProgramName: plan.sourceProgramName ?? programContext?.programName ?? null,
      sourceDayLabel: plan.sourceDayLabel ?? null,
      startedAt: now,
      draftByIndex: {},
      updatedAt: now,
      sessionContext: { locationMode: "normal", locationLabel: null },
    });
    if (programContext) {
      updateState((prev) => {
        const isSameProgram =
          prev.currentProgram &&
          prev.currentProgram.programId === programContext.programId &&
          prev.currentProgram.source === programContext.source;
        const startDate = isSameProgram ? prev.currentProgram.startDate : new Date().toISOString();
        // Records what planned-training-frequency was active when this program was picked, purely
        // as future context (e.g. for Coach to later notice "you planned 5 days but this program
        // assumes 3" — see programRecommendation.js). Never read to gate or block anything today,
        // and stays null/undefined for anyone without a set preference — no behavior changes.
        const selectedForDays = isSameProgram ? prev.currentProgram.selectedForDays ?? null : prev.athleteProfile?.preferredDays ?? null;
        // Starting a genuinely different program (not just a different day of the same one)
        // makes any existing swap-workout override stale — clear it proactively so it can never
        // leak into the new program (activeOverrideFor's programId/source check already prevents
        // it from being misread, but there's no reason to let dead state linger).
        const programDayOverride = isSameProgram ? prev.programDayOverride : null;
        return { ...prev, currentProgram: { ...programContext, startDate, selectedForDays }, programDayOverride, hasSeenOnboarding: true };
      });
    }
  };
  // Naming is entirely optional (see StartWorkoutChoice/GuidedRunView) — this just lets an
  // athlete who started a Blank/Repeat workout give it a real name at any point, right up to
  // Finish Workout, without ever being asked for one up front.
  const renameRun = (name) => setActiveRun((run) => (run ? { ...run, planName: name } : run));
  // Travel/Alternate Gym mode (task Part 3) — writes straight to activeRun so it persists
  // immediately, the same treatment every other in-workout selection gets (task section 28).
  const updateSessionContext = (next) => setActiveRun((run) => (run ? { ...run, sessionContext: sanitizeSessionContext(next) } : run));
  const recordRunEntry = (index, entry) => {
    setActiveRun((run) => {
      // The exercise is now durable in state.logs/sessionEntries (real completed history) — its
      // slot's in-progress draft (confirmed sets + the current typed set) is now redundant and
      // would otherwise resurrect stale confirmed sets if this slot were ever revisited.
      const draftByIndex = { ...(run.draftByIndex || {}) };
      delete draftByIndex[index];
      return {
        ...run,
        sessionEntries: [...run.sessionEntries, { index, exId: entry.exId, entry }],
        draftByIndex,
        updatedAt: new Date().toISOString(),
      };
    });
  };
  // "Save this machine profile" (task section 17) — converts a just-logged temporary-variant
  // exercise into real, comparable history under a newly-saved profile. Touches both durable
  // state (the new profile + the retagged state.logs entry) and the in-memory activeRun's own
  // copy of that entry (run.sessionEntries), so the collapsed summary immediately stops
  // offering to save again and reflects the new profile without needing a refresh.
  const saveTemporaryAsProfile = (idx, entry, label, gymLabel) => {
    const id = `equipment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    updateState((prev) => ({
      ...prev,
      equipmentProfiles: addEquipmentProfile(prev, entry.exId, label, gymLabel, id),
      logs: convertTemporaryLogToProfile(prev.logs, entry.id, id),
    }));
    setActiveRun((run) => {
      if (!run) return run;
      return {
        ...run,
        sessionEntries: run.sessionEntries.map((se) =>
          se.index === idx ? { ...se, entry: { ...se.entry, equipmentProfileId: id, equipmentContext: null } } : se
        ),
      };
    });
  };
  // Debounced/immediate autosave target for TrainingExerciseCard's in-progress state — confirmed
  // sets already saved via "Save Set" but not yet exercise-finished, plus the current unsaved
  // weight/reps/RIR/set-type/drops draft. See sanitizeActiveRun's draftByIndex comment for shape.
  const updateRunDraft = useCallback((index, draft) => {
    setActiveRun((run) => {
      if (!run) return run;
      return {
        ...run,
        draftByIndex: { ...(run.draftByIndex || {}), [index]: draft },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);
  // Used when a collapsed "Logged this session" card is edited/deleted via the shared
  // EditLogEntryPanel — keeps the run's own tracking of which slot is logged in sync with
  // state.logs, since that's what determines which card collapses vs. stays active.
  const editRunEntry = (index, updatedEntry) => {
    setActiveRun((run) => ({
      ...run,
      sessionEntries: run.sessionEntries.map((se) => (se.index === index ? { ...se, entry: updatedEntry } : se)),
    }));
  };
  const deleteRunEntry = (index) => {
    setActiveRun((run) => ({ ...run, sessionEntries: run.sessionEntries.filter((se) => se.index !== index) }));
  };
  const swapRunExercise = (index, newExId) => {
    setActiveRun((run) => {
      // This slot's draft (if any) belonged to the exercise being swapped away from — carrying
      // it forward would show the old exercise's typed weight/reps as the new exercise's own.
      const draftByIndex = { ...(run.draftByIndex || {}) };
      delete draftByIndex[index];
      return { ...run, swaps: { ...(run.swaps || {}), [index]: newExId }, draftByIndex, updatedAt: new Date().toISOString() };
    });
  };
  // Appends an exercise the plan never had (session-only, not saved back to the plan) — the
  // slot lands at the end of run.exercises, so it becomes the active card once everything
  // already queued ahead of it is logged, no matter when during the workout it's added.
  const addRunExercise = (exId) => {
    setActiveRun((run) => ({ ...run, exercises: [...run.exercises, { exId, sets: 3 }] }));
  };
  // Shared by finishRun (lifting) and finishRecoverySession (mobility/recovery) — a program day
  // is a program day regardless of whether it was a lifting workout or a recovery day, so
  // "advance to the next day, clear a same-day override, record when/what was completed" is one
  // rule, not two. Pure function of (prev, ctx); the caller wraps it in updateState.
  const applyProgramDayAdvance = (prev, ctx) => {
    // A swap-workout override (see programSchedule.js) is a one-day substitution — the instant
    // its workout is actually completed, the override has done its job and is resolved/cleared,
    // exactly like the task's "completing the swapped workout clears the override" requirement.
    // Only clear it if it belongs to THIS program (a stale override from some other program
    // should already be inert, but this keeps state tidy too).
    const ov = prev.programDayOverride;
    const clearOverride = ov && ov.programId === ctx.programId && ov.source === ctx.source;
    return {
      ...prev,
      programDayOverride: clearOverride ? null : prev.programDayOverride,
      currentProgram: {
        ...ctx,
        dayIndex: (ctx.dayIndex + 1) % ctx.totalDays,
        startDate: prev.currentProgram?.startDate || new Date().toISOString(),
        // dayIndex above already points at the *next* day — these two record what was actually
        // just finished and when, so the Today card keeps showing today's day (see
        // resolveCurrentProgramDay) instead of jumping to tomorrow's within the same calendar day.
        lastCompletedAt: new Date().toISOString(),
        lastCompletedDayIndex: ctx.dayIndex,
      },
    };
  };

  const finishRun = () => {
    const summary = buildSessionSummary(activeRun, state.logs, state.workoutSessions || [], exMap);
    // Only worth a coach review when something was actually logged — an empty session has
    // nothing to grade.
    const coachMessage = summary.exerciseCount > 0 ? generatePostWorkoutReview(summary).message : null;
    const summaryWithCoach = coachMessage ? { ...summary, coachMessage } : summary;
    const coachHistoryId = coachMessage ? `coach_${Date.now()}` : null;
    updateState((prev) => ({
      ...prev,
      workoutSessions: [summaryWithCoach, ...(prev.workoutSessions || [])],
      ...(coachMessage
        ? {
            coachHistory: [
              { id: coachHistoryId, date: new Date().toISOString(), type: "post_workout", message: coachMessage },
              ...(prev.coachHistory || []),
            ],
          }
        : {}),
    }));
    // Whatever was still sitting in a slot's draft (an active-but-not-yet-Finish-Exercise'd
    // exercise, if Finish Workout was tapped directly) is unsaved by definition — buildSessionSummary
    // above already only counted real state.logs entries, so this is just clearing now-dead state.
    setActiveRun((run) => ({ ...run, finished: true, summaryId: summary.id, coachHistoryId, draftByIndex: {} }));
    if (activeRun?.programContext) {
      const ctx = activeRun.programContext;
      updateState((prev) => applyProgramDayAdvance(prev, ctx));
    }
  };

  // Recovery-session counterpart to finishRun — deliberately does NOT touch state.workoutSessions,
  // state.logs, PRs, or lifting volume (task: "do not mix these records into lifting
  // workoutSessions," "do not count mobility volume as lifting volume," "do not generate PRs from
  // recovery work"). No activeRun/GuidedRunView involved either — the mobility session runner is
  // its own lightweight, ephemeral flow (see MobilitySessionRunner.jsx); this is the one place its
  // result gets committed to persisted state. `programContext` is only present when the routine
  // was started FROM the active program's own recovery day (see resolveTodayWorkout/TrainTab) —
  // starting a routine from the Mobility & Stretching library directly never touches currentProgram.
  const finishRecoverySession = (routine, programContext, result, manual = false) => {
    const summary = buildRecoverySessionSummary({ routine, programContext, result, manual });
    updateState((prev) => ({ ...prev, recoverySessions: [summary, ...(prev.recoverySessions || [])] }));
    if (programContext) {
      updateState((prev) => applyProgramDayAdvance(prev, programContext));
    }
    return summary;
  };
  // Navigates into the mobility session runner — `fromTab` is remembered so Exit/Complete lands
  // back where the athlete actually started from (Today, Train, the library itself, or a
  // program's detail screen), same "returnTab" convention startRun already uses for lifting runs.
  const startRecoverySession = (routine, programContext, fromTab) => {
    setMobilityRunContext({ routine, programContext, returnTab: fromTab });
    setTab("mobilitySession");
  };
  // The lightweight "LOG RECOVERY SESSION" path (task section 15) — marks a routine done without
  // running the timer at all, straight from wherever it's offered (library, Today, program detail).
  const logManualRecovery = (routine, programContext) => finishRecoverySession(routine, programContext, null, true);
  // Undoes exactly what finishRun() committed (the session summary, its coach note, the
  // program-day advance, and the today-completed marker) so tapping "Add exercise" from the
  // Session Complete screen can safely go back to logging — finishing again afterward
  // recomputes everything correctly with the extra exercise included, instead of leaving a
  // stale summary, a double-advanced program day, or a "completed today" Today card pointing
  // at a session that no longer exists.
  const reopenRun = () => {
    if (!activeRun) return;
    const { summaryId, coachHistoryId, programContext: ctx } = activeRun;
    updateState((prev) => {
      const next = { ...prev, workoutSessions: (prev.workoutSessions || []).filter((s) => s.id !== summaryId) };
      if (coachHistoryId) next.coachHistory = (prev.coachHistory || []).filter((h) => h.id !== coachHistoryId);
      if (ctx && prev.currentProgram?.programId === ctx.programId && prev.currentProgram?.source === ctx.source) {
        next.currentProgram = { ...prev.currentProgram, dayIndex: ctx.dayIndex, lastCompletedAt: null, lastCompletedDayIndex: null };
      }
      return next;
    });
    setActiveRun((run) => ({ ...run, finished: false, summaryId: null, coachHistoryId: null }));
  };
  const exitRun = () => {
    setTab(activeRun?.returnTab || "templates");
    setActiveRun(null);
    setWorkoutMinimized(false);
  };
  // Mid-workout "Exit" — the athlete is stepping away to another tab, not abandoning the
  // session. Keeps activeRun (and everything already persisted in it) fully intact; Train
  // surfaces a "Resume workout" card to bring GuidedRunView back. This replaces what used to be
  // a silent, unconfirmed full discard (see discardRun below for the real, explicit version).
  const minimizeRun = () => {
    setWorkoutMinimized(true);
    // Land on Train specifically, not wherever `tab` happened to be left pointed before the
    // workout took over the screen (e.g. mid-way through Start Workout Today's own sub-steps) —
    // that's where the "Resume workout" card lives, so Exit always has somewhere useful to go.
    setTab("train");
  };
  const resumeRun = () => setWorkoutMinimized(false);
  // The one genuinely destructive action — gated behind an explicit confirmation in the UI, never
  // called automatically. Completed sets already written to state.logs by finishExercise() (every
  // "Finish exercise" tap commits immediately, well before Finish Workout) belong to THIS run and
  // nowhere else, so they're removed too — otherwise a discarded exercise would keep quietly
  // feeding progression/PRs even though the athlete explicitly threw the session away. Scoped
  // strictly to the log ids this run itself recorded (activeRun.sessionEntries), so it can never
  // touch a previously completed, unrelated session.
  const discardRun = () => {
    if (!activeRun) return;
    const loggedIds = new Set((activeRun.sessionEntries || []).map((se) => se.entry?.id).filter(Boolean));
    if (loggedIds.size > 0) {
      updateState((prev) => ({ ...prev, logs: (prev.logs || []).filter((l) => !loggedIds.has(l.id)) }));
    }
    setActiveRun(null);
    setWorkoutMinimized(false);
  };
  const rateSession = (sessionId, rating) => {
    updateState((prev) => ({
      ...prev,
      workoutSessions: (prev.workoutSessions || []).map((s) => (s.id === sessionId ? { ...s, rating } : s)),
    }));
  };
  const restartCurrentProgram = () => {
    updateState((prev) =>
      prev.currentProgram
        ? { ...prev, currentProgram: { ...prev.currentProgram, dayIndex: 0, startDate: new Date().toISOString() } }
        : prev
    );
  };
  // Used by the completed-programs history list to relaunch a program that's no longer
  // "current" (its currentProgram was cleared when the user moved on).
  const restartProgramById = (programId, source) => {
    const list = source === "custom" ? state.customPrograms || [] : state.programs || [];
    const prog = list.find((p) => p.id === programId);
    if (!prog) return;
    updateState((prev) => ({
      ...prev,
      currentProgram: {
        programId: prog.id,
        programName: prog.name,
        source,
        dayIndex: 0,
        totalDays: prog.days.length,
        startDate: new Date().toISOString(),
      },
    }));
    setTab("log");
  };
  const goToTemplatesAndClearProgram = () => {
    updateState((prev) => ({ ...prev, currentProgram: null }));
    setTab("templates");
  };

  // Records a program's completion to history once (deduped by programId+startDate, the
  // unique identifier for a given run-through) as soon as it's detected — independent of
  // whether the "Program complete" banner is currently on screen. Doesn't clear
  // currentProgram itself; that only happens when the user picks Restart or New program,
  // so the banner (and its actions) stays usable however long they take to respond.
  useEffect(() => {
    const resolved = resolveCurrentProgramDay(state);
    if (!resolved?.isComplete) return;
    const cp = state.currentProgram;
    const alreadyRecorded = (state.completedPrograms || []).some(
      (c) => c.programId === cp.programId && c.startDate === cp.startDate
    );
    if (alreadyRecorded) return;
    const entry = {
      id: `completed_${Date.now()}`,
      programId: cp.programId,
      programSource: cp.source,
      programName: resolved.programName,
      weeks: resolved.totalWeeks,
      startDate: cp.startDate,
      endDate: new Date().toISOString(),
    };
    updateState((prev) => {
      if (!prev.currentProgram || prev.currentProgram.programId !== cp.programId || prev.currentProgram.startDate !== cp.startDate) {
        return prev;
      }
      const dup = (prev.completedPrograms || []).some((c) => c.programId === cp.programId && c.startDate === cp.startDate);
      if (dup) return prev;
      return { ...prev, completedPrograms: [entry, ...(prev.completedPrograms || [])] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!loaded) {
    return (
      <div className="w-full min-h-[400px] flex items-center justify-center bg-v5-bg text-v5-subtext text-sm">
        Loading...
      </div>
    );
  }

  // A run that exists but is currently minimized (athlete tapped "Exit" to browse another tab)
  // is not "the active screen" for either the rest timer or the bottom nav — those should behave
  // exactly as if there were no active run at all while it's backgrounded.
  const runOnScreen = activeRun && !workoutMinimized;
  // The only two screens that call bumpRestTimer outside a guided run (LogTab, CardioTab) — see
  // the RestTimer mount comment below for why this exists instead of a blanket "always mounted."
  const restTimerRelevantTab = !runOnScreen && (tab === "log" || tab === "cardio");

  return (
    <div className="w-full bg-v5-bg text-v5-text font-sans min-h-[600px]">
      <Header />
      {/* Only mounted on screens where logging a set is actually possible — an active (not yet
          finished) guided run, the standalone Log tab, or Cardio/conditioning, the three places
          bumpRestTimer is ever called from. Everywhere else (Train browsing, the Start Workout
          choice screen, Repeat Recent, Programs, readiness, the just-finished Session Complete
          screen, or a minimized run) it's unmounted outright, so a rest period that was still
          ticking when the athlete navigated away can't follow them there — rather than relying
          only on RestTimer's own idle-state check, which by itself can't distinguish "never
          started" from "started earlier, now stale on a different screen." */}
      {(restTimerRelevantTab || (runOnScreen && !activeRun.finished)) && <RestTimer bump={restBump} settings={state.settings} />}
      <div className={`p-4 sm:p-6 ${!runOnScreen ? "pb-24" : ""}`}>
        {runOnScreen ? (
          <GuidedRunView
            run={activeRun}
            state={state}
            updateState={updateState}
            exMap={exMap}
            allExercises={allExercises}
            onSaved={recordRunEntry}
            onEditEntry={editRunEntry}
            onDeleteEntry={deleteRunEntry}
            onFinish={finishRun}
            onExit={exitRun}
            onMinimize={minimizeRun}
            onDraftChange={updateRunDraft}
            onDraftDirty={markDraftDirty}
            persistStatus={persistStatus}
            onSwap={swapRunExercise}
            onAddExercise={addRunExercise}
            onReopen={reopenRun}
            onLoggedSet={bumpRestTimer}
            onRate={rateSession}
            onAskCoach={() => {
              if (activeRun?.summaryId) {
                setPendingCoachContext({ type: "workout", sessionId: activeRun.summaryId, label: activeRun.planName });
              }
              exitRun();
              setTab("coach");
            }}
            onViewWorkout={(sessionId) => {
              exitRun();
              viewWorkout(sessionId);
            }}
            onRename={renameRun}
            onSaveTemporaryProfile={saveTemporaryAsProfile}
            onUpdateSessionContext={updateSessionContext}
          />
        ) : (
          <>
            {tab === "today" &&
              (!state.hasSeenOnboarding ? (
                <OnboardingView
                  state={state}
                  onStartRun={(plan, programContext) => startRun(plan, "today", programContext)}
                  onGoToTemplates={() => setTab("templates")}
                />
              ) : (
                <TodayTab
                  state={state}
                  updateState={updateState}
                  exMap={exMap}
                  allExercises={allExercises}
                  activeRun={activeRun}
                  onStartRun={(plan, programContext) => startRun(plan, "today", programContext)}
                  onStartRecovery={(routine, programContext) => startRecoverySession(routine, programContext, "today")}
                  onNavigate={setTab}
                  onViewWorkout={viewWorkout}
                />
              ))}
            {tab === "workoutDetail" && (
              <WorkoutHistoryDetail
                session={(state.workoutSessions || []).find((s) => s.id === selectedSessionId) || null}
                state={state}
                exMap={exMap}
                onBack={() => setTab("today")}
                onViewRecap={viewRecap}
                onAskCoach={(session) => {
                  setPendingCoachContext({ type: "workout", sessionId: session.id, label: session.planName });
                  setTab("coach");
                }}
              />
            )}
            {tab === "sessionRecap" && (
              <SessionRecapView
                session={(state.workoutSessions || []).find((s) => s.id === selectedSessionId) || null}
                state={state}
                exMap={exMap}
                onBack={() => setTab("workoutDetail")}
                onViewFullSession={() => setTab("workoutDetail")}
              />
            )}
            {tab === "train" && (
              <TrainTab
                state={state}
                updateState={updateState}
                exMap={exMap}
                activeRun={activeRun && workoutMinimized && !activeRun.finished ? activeRun : null}
                onStartRun={(plan, programContext) => startRun(plan, "train", programContext)}
                onStartRecovery={(routine, programContext) => startRecoverySession(routine, programContext, "train")}
                onResumeWorkout={resumeRun}
                onDiscardWorkout={() => {
                  if (
                    window.confirm(
                      "Discard workout?\n\nYour completed sets and unsaved workout draft will be removed from this active session."
                    )
                  ) {
                    discardRun();
                  }
                }}
                onNavigate={setTab}
              />
            )}
            {tab === "startWorkout" && (
              <StartWorkoutChoice
                state={state}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "train", programContext)}
                onRepeatRecent={() => setTab("repeatRecent")}
                onBack={() => setTab("train")}
              />
            )}
            {tab === "repeatRecent" && (
              <RepeatRecentWorkoutPicker
                state={state}
                onStartRun={(plan) => startRun(plan, "train")}
                onBack={() => setTab("startWorkout")}
              />
            )}
            {tab === "more" && <MoreTab state={state} updateState={updateState} onNavigate={setTab} />}
            {tab === "log" && (
              <LogTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "log", programContext)}
                onLoggedSet={bumpRestTimer}
                onRestartProgram={restartCurrentProgram}
                onGoToTemplates={goToTemplatesAndClearProgram}
              />
            )}
            {tab === "mission" && <MissionTab state={state} updateState={updateState} allExercises={allExercises} exMap={exMap} />}
            {tab === "coach" && (
              <CoachTab
                state={state}
                updateState={updateState}
                exMap={exMap}
                allExercises={allExercises}
                onNavigate={setTab}
                openContext={pendingCoachContext}
              />
            )}
            {tab === "coachKnowledge" && <CoachKnowledgeScreen state={state} updateState={updateState} onNavigate={setTab} onBack={() => setTab("coach")} />}
            {tab === "coachProfile" && <AthleteProfileForm state={state} updateState={updateState} mode="edit" onDone={() => setTab("coach")} />}
            {tab === "coachSettings" && <CoachSettingsScreen state={state} updateState={updateState} onNavigate={setTab} onBack={() => setTab("coach")} />}
            {tab === "coachSelect" && (
              <CoachSpecialtySelect
                state={state}
                updateState={updateState}
                mode="change"
                onSelectComplete={() => setTab("coachSettings")}
                onCancel={() => setTab("coachSettings")}
              />
            )}
            {tab === "nutrition" && (
              <NutritionHome
                state={state}
                updateState={updateState}
                onNavigate={setTab}
                onAskCoach={() => {
                  setPendingCoachContext({ type: "nutrition", dateKey: todayDateKey(), label: "Today's nutrition" });
                  setTab("coach");
                }}
              />
            )}
            {tab === "nutritionLog" && (
              <FoodLogScreen
                state={state}
                updateState={updateState}
                onNavigate={setTab}
                selectedDate={dailyLogDate}
                onChangeDate={setDailyLogDate}
                onAddFood={(meal, dateKey) => {
                  setPendingFoodMeal(meal);
                  setPendingFoodDate(dateKey);
                  setTab("foodSearch");
                }}
              />
            )}
            {tab === "foodSearch" && (
              <AddFoodScreen
                state={state}
                updateState={updateState}
                onNavigate={setTab}
                initialMeal={pendingFoodMeal}
                dateKey={pendingFoodDate || dailyLogDate}
                onSelectFood={(food, meal, dateKey) => {
                  setPendingSelectedFood(food);
                  setPendingFoodMeal(meal);
                  setPendingFoodDate(dateKey);
                  setTab("foodDetail");
                }}
              />
            )}
            {tab === "foodDetail" && (
              <FoodDetailScreen
                state={state}
                updateState={updateState}
                onNavigate={setTab}
                food={pendingSelectedFood}
                meal={pendingFoodMeal}
                dateKey={pendingFoodDate}
              />
            )}
            {tab === "nutritionMealPlan" && <MealPlanView state={state} updateState={updateState} onBack={() => setTab("nutrition")} />}
            {tab === "nutritionCheckIn" && <NutritionCheckInScreen state={state} updateState={updateState} onBack={() => setTab("nutrition")} />}
            {tab === "nutritionScan" && <ScanFoodChooser onNavigate={setTab} />}
            {tab === "nutritionScanBarcode" && (
              <BarcodeScannerScreen
                state={state}
                updateState={updateState}
                onNavigate={setTab}
                onScanLabelForBarcode={(barcode) => {
                  setPendingScanBarcode(barcode);
                  setTab("nutritionScanLabel");
                }}
                onManualEntry={() => setTab("nutritionLog")}
              />
            )}
            {tab === "nutritionScanLabel" && (
              <NutritionLabelScannerScreen
                updateState={updateState}
                onNavigate={(next) => {
                  setPendingScanBarcode(null);
                  setTab(next);
                }}
                pendingBarcode={pendingScanBarcode}
              />
            )}
            {tab === "cardio" && (
              <CardioTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onLoggedSet={bumpRestTimer}
                onNavigate={setTab}
              />
            )}
            {tab === "intervalTimer" && (
              <IntervalTimerScreen updateState={updateState} allExercises={allExercises} onBack={() => setTab("cardio")} />
            )}
            {tab === "progress" && (
              <ProgressTab state={state} updateState={updateState} allExercises={allExercises} exMap={exMap} onNavigate={setTab} onViewWorkout={viewWorkout} />
            )}
            {tab === "templates" && (
              <TemplatesTab
                state={state}
                updateState={updateState}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "templates", programContext)}
                onStartRecovery={(routine, programContext) => startRecoverySession(routine, programContext, "templates")}
                onLogManualRecovery={logManualRecovery}
                onRestartCompletedProgram={restartProgramById}
                onGoToBuild={() => setTab("build")}
                onViewWorkout={viewWorkout}
              />
            )}
            {tab === "build" && (
              <BuildPlanTab
                state={state}
                updateState={updateState}
                allExercises={allExercises}
                exMap={exMap}
                onStartRun={(plan, programContext) => startRun(plan, "build", programContext)}
                onGoToPlans={() => setTab("templates")}
              />
            )}
            {tab === "mobility" && (
              <MobilityLibraryScreen
                state={state}
                onSelectMovement={(id) => {
                  setMobilitySelectedId(id);
                  setTab("mobilityDetail");
                }}
                onStartRoutine={(routine, programContext) => startRecoverySession(routine, programContext, "mobility")}
                onLogManualRoutine={(routine, programContext) => logManualRecovery(routine, programContext)}
              />
            )}
            {tab === "mobilityDetail" && <MobilityDetailScreen movementId={mobilitySelectedId} onBack={() => setTab("mobility")} />}
            {tab === "mobilitySession" && mobilityRunContext && (
              <MobilitySessionRunner
                routine={mobilityRunContext.routine}
                onComplete={(result) => {
                  finishRecoverySession(mobilityRunContext.routine, mobilityRunContext.programContext, result, false);
                  setTab(mobilityRunContext.returnTab || "mobility");
                  setMobilityRunContext(null);
                }}
                onExit={() => {
                  setTab(mobilityRunContext.returnTab || "mobility");
                  setMobilityRunContext(null);
                }}
              />
            )}
            {tab === "programTimeline" && (
              <ProgramTimelineScreen state={state} exMap={exMap} onBack={() => setTab("train")} onViewWorkout={viewWorkout} />
            )}
            {tab === "developmentPriorities" && (
              <DevelopmentPrioritiesScreen state={state} updateState={updateState} onBack={() => setTab("coach")} />
            )}
            {tab === "schedule" && <ScheduleEditor state={state} updateState={updateState} onBack={() => setTab("more")} />}
            {tab === "catalog" && <CatalogTab state={state} updateState={updateState} allExercises={allExercises} />}
            {tab === "top" && <TopUsedTab state={state} exMap={exMap} />}
            {tab === "photos" && <PhotosTab state={state} updateState={updateState} />}
            {tab === "settings" && <SettingsTab state={state} updateState={updateState} onNavigate={setTab} />}
            {tab === "dataWorkbook" && (
              <DataWorkbookScreen state={state} exMap={exMap} onBack={() => setTab("settings")} onViewWorkout={viewWorkout} />
            )}
            {tab === "breakMeaning" && <BreakMeaningPage onBack={() => setTab("more")} logoSrc={BREAK_LOGO} />}
          </>
        )}
      </div>

      {!runOnScreen && (
        <div className="fixed bottom-0 left-0 right-0 z-20 flex bg-v5-surface border-t border-white/[0.06]">
          {TOP_TABS.map((t) => {
            const active = (SECTION_OF[tab] || tab) === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] uppercase tracking-widest transition-colors ${
                  active ? "text-v5-red" : "text-v5-subtext/70 hover:text-v5-subtext"
                }`}
              >
                <t.icon size={20} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="px-4 sm:px-6 pt-3 pb-2 bg-v5-bg">
      <div className="flex items-center gap-2">
        <img src={BREAK_LOGO} alt="B.R.E.A.K. logo" className="w-7 h-7 rounded-full object-cover ring-1 ring-v5-red/50" />
        <div>
          <div className="text-v5-text font-black tracking-wide text-sm leading-none">
            BRK <span className="text-v5-red">-</span> LIFT
          </div>
          <div className="text-[9px] text-v5-subtext/70 tracking-[0.18em] uppercase mt-1">Keep the promises you make to yourself</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- SHARED SLIDE-IN DRILL-DOWN PANEL ----------------
// Full-width view that slides in from the right with a back arrow at the top, replacing
// an accordion-expand or a dead-end tap. Used for Templates/My plans drill-down and the
// exercise swap picker.

// ---------------- EXERCISE SWAP PICKER ----------------
// Filtered to the same muscle group as the exercise being swapped, with a search bar
// (same pattern as the catalog search elsewhere) to widen it if needed.
function ExerciseSwapPicker({ currentExId, allExercises, exMap, state, updateState, muscleGroups, onBack, onSelect }) {
  const [query, setQuery] = useState("");
  const [creatingCustom, setCreatingCustom] = useState(false);
  const currentMuscle = exMap[currentExId]?.muscle;
  const selectable = useMemo(() => selectableExercises(allExercises), [allExercises]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q
      ? selectable.filter((ex) => matchesExerciseSearch(ex, q))
      : selectable.filter((ex) => ex.muscle === currentMuscle);
    return pool.filter((ex) => ex.id !== currentExId);
  }, [query, selectable, currentMuscle, currentExId]);

  if (creatingCustom) {
    return (
      <CustomExerciseForm
        state={state}
        updateState={updateState}
        allExercises={allExercises}
        muscleGroups={muscleGroups}
        onBack={() => setCreatingCustom(false)}
        onSaved={(exId) => onSelect(exId)}
      />
    );
  }

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
        className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-xs focus:outline-none focus:border-v5-red"
      />
      <div className="space-y-1.5">
        {results.map((ex) => (
          <button
            key={ex.id}
            onClick={() => onSelect(ex.id)}
            className="w-full text-left px-3 py-2 text-sm border border-white/[0.06] text-v5-text/90 hover:border-v5-red hover:text-white"
          >
            {ex.name}
            <span className="text-xs text-v5-subtext/70 ml-2">
              {ex.custom ? formatCustomLabel(ex) : ex.muscle}
            </span>
          </button>
        ))}
        {results.length === 0 && (
          <div className="text-xs text-v5-subtext/70 py-4 text-center">No matches. Try a different search.</div>
        )}
        <button
          onClick={() => setCreatingCustom(true)}
          className="w-full text-left px-3 py-2.5 text-sm border border-dashed border-white/10 text-v5-red hover:border-v5-red hover:text-v5-red flex items-center gap-1.5"
        >
          <Plus size={14} /> Create custom exercise
        </button>
      </div>
    </SlideInPanel>
  );
}

// Adds an exercise to the active session that was never part of the plan — search by name, or
// browse a muscle group when nothing's typed yet. Distinct from ExerciseSwapPicker: no "current"
// exercise to bias toward or exclude, so nothing shows until the user searches or picks a group.
// "Recent" and "Custom" are both cheap to derive from state that already exists — usage
// timestamps from state.logs, and the `custom` flag already carried on every custom exercise —
// so surfacing them here doesn't need any new stored data.
function AddExercisePicker({ allExercises, state, updateState, muscleGroups, onBack, onSelect }) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState(null); // a muscleGroups value, or the sentinel "Custom"
  const [creatingCustom, setCreatingCustom] = useState(false);
  const selectable = useMemo(() => selectableExercises(allExercises), [allExercises]);

  const recent = useMemo(() => {
    const byExId = new Map();
    [...(state.logs || [])]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((l) => {
        if (!byExId.has(l.exId)) byExId.set(l.exId, l.date);
      });
    return [...byExId.keys()]
      .map((exId) => selectable.find((ex) => ex.id === exId))
      .filter(Boolean)
      .slice(0, 8);
  }, [state.logs, selectable]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return selectable.filter((ex) => matchesExerciseSearch(ex, q));
    if (muscle === "Custom") return selectable.filter((ex) => ex.custom);
    if (muscle) return selectable.filter((ex) => ex.muscle === muscle);
    return [];
  }, [query, muscle, selectable]);

  if (creatingCustom) {
    return (
      <CustomExerciseForm
        state={state}
        updateState={updateState}
        allExercises={allExercises}
        muscleGroups={muscleGroups}
        onBack={() => setCreatingCustom(false)}
        onSaved={(exId) => onSelect(exId)}
      />
    );
  }

  const ResultRow = ({ ex }) => (
    <button
      onClick={() => onSelect(ex.id)}
      className="w-full text-left px-3.5 py-3 rounded-xl bg-v5-surface hover:bg-v5-elevated flex items-center justify-between gap-3"
    >
      <span className="min-w-0 truncate text-sm text-v5-text">{ex.name}</span>
      <span className="shrink-0 text-xs text-v5-subtext">{ex.custom ? formatCustomLabel(ex) : ex.muscle}</span>
    </button>
  );

  const browsing = !query && !muscle;

  return (
    <SlideInPanel title="Add exercise" subtitle="This session only — added to the end of your workout" onBack={onBack}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setMuscle(null);
        }}
        placeholder="Search the catalog..."
        className="w-full bg-v5-surface rounded-xl text-v5-text placeholder:text-v5-subtext px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red"
      />
      {!query && (
        <div className="flex flex-wrap gap-1.5">
          {["Custom", ...muscleGroups].map((m) => (
            <button
              key={m}
              onClick={() => setMuscle((cur) => (cur === m ? null : m))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                muscle === m ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext hover:text-v5-text"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {browsing && recent.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-v5-subtext">Recent</div>
          {recent.map((ex) => (
            <ResultRow key={ex.id} ex={ex} />
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {results.map((ex) => (
          <ResultRow key={ex.id} ex={ex} />
        ))}
        {query && results.length === 0 && <div className="text-xs text-v5-subtext py-4 text-center">No matches. Try a different search.</div>}
        {muscle && results.length === 0 && (
          <div className="text-xs text-v5-subtext py-4 text-center">
            {muscle === "Custom" ? "No custom exercises yet." : "No matches in this category."}
          </div>
        )}
        {browsing && recent.length === 0 && (
          <div className="text-xs text-v5-subtext py-4 text-center">Search, or pick a category above.</div>
        )}
        <button
          onClick={() => setCreatingCustom(true)}
          className="w-full text-left px-3.5 py-3 rounded-xl text-sm text-v5-red hover:opacity-80 flex items-center gap-1.5"
        >
          <Plus size={14} /> Create custom exercise
        </button>
      </div>
    </SlideInPanel>
  );
}

// ---------------- SET ROWS EDITOR ----------------
// Shared by the standalone logger's "Today's sets" and the edit panel's "Sets" — each set
// row can carry its own nested drops array, added/removed independently of the set itself.
// Row shape while editing: { weight: string, reps: string, drops: [{weight, reps}, ...] }.
function SetRowsEditor({ sets, onChange, rirSystem = "rir", simple = false }) {
  const updateSetRow = (idx, field, val) => onChange(sets.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));
  const addSetRow = () => onChange([...sets, { weight: "", reps: "", drops: [], setType: "working", rir: "", rpe: "" }]);
  const removeSetRow = (idx) => onChange(sets.filter((_, i) => i !== idx));
  // Quick logging: nudge a row's weight/reps without retyping, or clone it as the next set —
  // the common case mid-workout is "same weight, one more rep" or "just repeat that."
  const duplicateSetRow = (idx) =>
    onChange([...sets.slice(0, idx + 1), { ...sets[idx], drops: (sets[idx].drops || []).map((d) => ({ ...d } )) }, ...sets.slice(idx + 1)]);
  const addDropRow = (idx) =>
    onChange(sets.map((row, i) => (i === idx ? { ...row, drops: [...(row.drops || []), { weight: "", reps: "" }] } : row)));
  const updateDropRow = (idx, dIdx, field, val) =>
    onChange(
      sets.map((row, i) =>
        i === idx ? { ...row, drops: row.drops.map((d, di) => (di === dIdx ? { ...d, [field]: val } : d)) } : row
      )
    );
  const removeDropRow = (idx, dIdx) =>
    onChange(sets.map((row, i) => (i === idx ? { ...row, drops: row.drops.filter((_, di) => di !== dIdx) } : row)));

  return (
    <div className="space-y-3">
      {sets.map((row, idx) => (
        <div key={idx} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-v5-subtext/70 w-5">{idx + 1}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Weight"
              value={row.weight}
              onChange={(e) => updateSetRow(idx, "weight", e.target.value)}
              className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="Reps"
              value={row.reps}
              onChange={(e) => updateSetRow(idx, "reps", e.target.value)}
              className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
            />
            {sets.length > 1 && (
              <button onClick={() => removeSetRow(idx)} className="text-v5-subtext/70 hover:text-v5-red p-1">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 pl-7 overflow-x-auto">
            <button
              onClick={() => duplicateSetRow(idx)}
              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40"
            >
              <Copy size={10} /> Duplicate
            </button>
          </div>
          {!simple && (
            <>
              <div className="flex items-center gap-1 pl-7 overflow-x-auto">
                {SET_TYPES.map((t) => {
                  const active = (row.setType || "working") === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => updateSetRow(idx, "setType", t.value)}
                      className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                        active ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                      }`}
                    >
                      {t.short}
                    </button>
                  );
                })}
                <input
                  type="number"
                  placeholder={rirSystem === "rpe" ? "RPE" : "RIR"}
                  value={rirSystem === "rpe" ? row.rpe ?? "" : row.rir ?? ""}
                  onChange={(e) => updateSetRow(idx, rirSystem === "rpe" ? "rpe" : "rir", e.target.value)}
                  className="shrink-0 w-14 bg-v5-elevated border border-white/10 text-v5-text px-1.5 py-0.5 text-[11px] text-center focus:outline-none focus:border-v5-red"
                />
              </div>
              {(row.drops || []).map((drop, dIdx) => (
                <div key={dIdx} className="flex items-center gap-2 pl-7">
                  <span className="text-xs text-v5-subtext/40">↳</span>
                  <input
                    type="number"
                    placeholder="Drop weight"
                    value={drop.weight}
                    onChange={(e) => updateDropRow(idx, dIdx, "weight", e.target.value)}
                    className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
                  />
                  <input
                    type="number"
                    placeholder="Drop reps"
                    value={drop.reps}
                    onChange={(e) => updateDropRow(idx, dIdx, "reps", e.target.value)}
                    className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
                  />
                  <button onClick={() => removeDropRow(idx, dIdx)} className="text-v5-subtext/70 hover:text-v5-red p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => addDropRow(idx)} className="pl-7 flex items-center gap-1 text-[11px] text-v5-subtext/70 hover:text-v5-red">
                <Plus size={11} /> Add drop
              </button>
            </>
          )}
        </div>
      ))}
      <button onClick={addSetRow} className="flex items-center gap-1 text-xs text-v5-subtext hover:text-v5-red">
        <Plus size={12} /> Add set
      </button>
    </div>
  );
}

// ---------------- EDIT LOGGED ENTRY ----------------
// Lets a previously-saved history entry be corrected (weight/reps per set and per drop,
// target reps) or deleted outright. Edits flow back through the same state.logs array, so
// suggestNext recomputes automatically off the corrected numbers.
function EditLogEntryPanel({ entry, exMap, onBack, onSave, onDelete, rirSystem = "rir", simple = false }) {
  const [sets, setSets] = useState(
    entry.sets.map((s) => ({
      weight: String(s.weight),
      reps: String(s.reps),
      drops: (s.drops || []).map((d) => ({ weight: String(d.weight), reps: String(d.reps) })),
      setType: s.setType || "working",
      rir: s.rir != null ? String(s.rir) : "",
      rpe: s.rpe != null ? String(s.rpe) : "",
      // Not editable from this panel (see TrainingExerciseCard for where quality/pain are set)
      // — carried through unchanged so editing weight/reps here can never silently wipe an
      // existing quality/pain flag off a set.
      quality: s.quality ?? null,
      pain: s.pain ?? null,
    }))
  );
  const [targetReps, setTargetReps] = useState(String(entry.targetReps));

  const canSave = sets.some((s) => s.weight !== "" && s.reps !== "");

  const handleSave = () => {
    const cleanSets = cleanSetsInput(sets);
    if (cleanSets.length === 0) return;
    onSave({ sets: cleanSets, targetReps: Number(targetReps) || cleanSets[0].reps });
  };

  return (
    <SlideInPanel
      title={exMap[entry.exId]?.name || entry.exId}
      subtitle={new Date(entry.date).toLocaleDateString()}
      onBack={onBack}
    >
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Target reps</label>
        <input
          type="number"
          value={targetReps}
          onChange={(e) => setTargetReps(e.target.value)}
          className="w-24 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Sets</label>
        <SetRowsEditor sets={sets} onChange={setSets} rirSystem={rirSystem} simple={simple} />
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-v5-red border-v5-red text-white hover:opacity-90"
            : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"
        }`}
      >
        Save changes
      </button>
      <button
        onClick={onDelete}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-subtext hover:text-v5-red hover:border-v5-red/25 flex items-center justify-center gap-1.5"
      >
        <Trash2 size={14} /> Delete entry
      </button>
    </SlideInPanel>
  );
}

// ---------------- SHARED SINGLE-EXERCISE LOGGER ----------------
// Recommended panel + target reps + set rows + save + history, for a fixed exercise.
// Used standalone by the Log tab (with its own exercise picker wrapped around it) and
// by the guided plan runner (with a plan-driven step indicator wrapped around it).
// ---------------- EXERCISE NOTES ----------------
// Persistent per-exercise notes (general / machine setup / technique cue), keyed by exId in
// state.exerciseNotes. Shown collapsed-to-a-summary the moment there's anything saved, so
// they surface automatically every time this exercise is opened — no digging required.
function ExerciseNotesPanel({ exId, state, updateState }) {
  const saved = state.exerciseNotes?.[exId] || { general: "", machine: "", cue: "" };
  const hasAny = !!(saved.general || saved.machine || saved.cue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);

  useEffect(() => {
    setDraft(state.exerciseNotes?.[exId] || { general: "", machine: "", cue: "" });
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exId]);

  const save = () => {
    updateState((prev) => ({ ...prev, exerciseNotes: { ...(prev.exerciseNotes || {}), [exId]: draft } }));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext flex items-center gap-1.5">
          <StickyNote size={12} /> Exercise notes
        </div>
        {[
          ["machine", "Machine / setup", "e.g. Seat 4, pin 9, bench angle 30°"],
          ["cue", "Technique cue", "e.g. Neutral grip, strap in on final sets"],
          ["general", "General", "Anything else worth remembering"],
        ].map(([key, label, placeholder]) => (
          <div key={key}>
            <label className="block text-[10px] uppercase tracking-widest text-v5-subtext/70 mb-1">{label}</label>
            <input
              type="text"
              value={draft[key] || ""}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
          </div>
        ))}
        <div className="flex gap-2">
          <button
            onClick={save}
            className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
          >
            Save notes
          </button>
          <button
            onClick={() => {
              setDraft(saved);
              setEditing(false);
            }}
            className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-left border border-white/10 bg-v5-elevated p-3 hover:border-white/10"
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext flex items-center gap-1.5">
          <StickyNote size={12} /> Notes
        </div>
        <span className="text-[11px] text-v5-red">{hasAny ? "Edit" : "+ Add"}</span>
      </div>
      {hasAny ? (
        <div className="mt-1.5 space-y-0.5 text-sm text-v5-text/90">
          {saved.machine && (
            <div>
              <span className="text-v5-subtext/70">Setup: </span>
              {saved.machine}
            </div>
          )}
          {saved.cue && (
            <div>
              <span className="text-v5-subtext/70">Cue: </span>
              {saved.cue}
            </div>
          )}
          {saved.general && (
            <div>
              <span className="text-v5-subtext/70">Note: </span>
              {saved.general}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-1 text-xs text-v5-subtext/70">Seat position, pin, grip, cues…</div>
      )}
    </button>
  );
}

// ---------------- PLATE CALCULATOR ----------------
// Rebuilt as a tap-to-build calculator in components/PlateCalculatorPanel.jsx (imported at the
// top of this file as PlateCalculatorToggle) — the athlete builds the bar by tapping plates
// instead of typing a target weight and being told what to load.

const BLANK_SET_ROW = { weight: "", reps: "", drops: [], setType: "working", rir: "", rpe: "" };

function ExerciseLogger({ exId, title, state, updateState, exMap, allExercises, onSaved, onSwap, saveLabel = "Save session", showHistory = true }) {
  const [targetReps, setTargetReps] = useState(8);
  const [setsInput, setSetsInput] = useState([{ ...BLANK_SET_ROW, drops: [] }]);
  const [swapOpen, setSwapOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const rirSystem = state.settings?.rirSystem || "rir";
  const isSimple = (state.settings?.trainingDetail || "advanced") === "simple";

  const suggestion = useMemo(
    () => suggestNext(exId, state.logs, exMap, { readinessLogs: state.readinessLogs }),
    [exId, state.logs, exMap, state.readinessLogs]
  );

  useEffect(() => {
    setTargetReps(suggestion.targetReps ?? 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exId]);

  const canSave = setsInput.some((s) => s.weight !== "" && s.reps !== "");

  const saveLog = () => {
    const sets = cleanSetsInput(setsInput);
    if (sets.length === 0) return;
    const entry = {
      id: `log_${Date.now()}`,
      exId,
      date: new Date().toISOString(),
      sets,
      targetReps: Number(targetReps) || sets[0].reps,
    };
    updateState((prev) => ({ ...prev, logs: [entry, ...prev.logs], hasSeenOnboarding: true }));
    setSetsInput([{ ...BLANK_SET_ROW, drops: [] }]);
    onSaved?.(entry);
  };

  const recentForEx = state.logs
    .filter((l) => l.exId === exId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  // Equipment-profile filter chips for the History list below — "All" plus one chip per
  // machine actually present in this exercise's own (already-capped) recent history, so the
  // list never advertises a filter option with nothing behind it.
  const [historyEquipFilter, setHistoryEquipFilter] = useState(undefined); // undefined = "All"
  const historyEquipOptions = useMemo(() => {
    const seen = new Map();
    recentForEx.forEach((l) => {
      const key = l.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT ? TEMPORARY_EQUIPMENT_CONTEXT : l.equipmentProfileId || null;
      if (!seen.has(key)) seen.set(key, equipmentDisplayLabel(state, l.equipmentProfileId, l.equipmentContext));
    });
    if (seen.size <= 1) return [];
    return [{ key: undefined, label: "All" }, ...[...seen.entries()].map(([key, label]) => ({ key, label }))];
  }, [recentForEx, state]);
  const filteredHistoryForEx =
    historyEquipFilter === undefined
      ? recentForEx
      : recentForEx.filter(
          (l) => (l.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT ? TEMPORARY_EQUIPMENT_CONTEXT : l.equipmentProfileId || null) === historyEquipFilter
        );

  if (swapOpen) {
    return (
      <ExerciseSwapPicker
        currentExId={exId}
        allExercises={allExercises}
        exMap={exMap}
        state={state}
        updateState={updateState}
        muscleGroups={MUSCLE_GROUPS}
        onBack={() => setSwapOpen(false)}
        onSelect={(newExId) => {
          setSwapOpen(false);
          onSwap(newExId);
        }}
      />
    );
  }

  if (editingEntryId) {
    const entry = state.logs.find((l) => l.id === editingEntryId);
    if (!entry) {
      return (
        <SlideInPanel title="Entry not found" onBack={() => setEditingEntryId(null)}>
          <div className="text-sm text-v5-subtext">This entry no longer exists.</div>
        </SlideInPanel>
      );
    }
    return (
      <EditLogEntryPanel
        entry={entry}
        exMap={exMap}
        rirSystem={rirSystem}
        simple={isSimple}
        onBack={() => setEditingEntryId(null)}
        onSave={(changes) => {
          updateState((prev) => ({
            ...prev,
            logs: prev.logs.map((l) => (l.id === editingEntryId ? { ...l, ...changes } : l)),
          }));
          setEditingEntryId(null);
        }}
        onDelete={() => {
          if (!window.confirm("Delete this logged entry? This can't be undone.")) return;
          updateState((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== editingEntryId) }));
          setEditingEntryId(null);
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
              className="shrink-0 text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red flex items-center gap-1"
            >
              <ArrowLeftRight size={12} /> Swap
            </button>
          )}
        </div>
      )}

      <ExerciseNotesPanel exId={exId} state={state} updateState={updateState} />

      {recentForEx.length > 0 && (
        <div className="border border-white/10 bg-v5-elevated p-4">
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Last time</div>
          <div className="space-y-1">
            {recentForEx[0].sets.map((s, i) => (
              <div key={i} className="text-lg text-v5-text/90">
                {formatSetCompact(s)}
              </div>
            ))}
          </div>
          <div className="text-xs text-v5-subtext/70 mt-2 flex items-center gap-1.5">
            {new Date(recentForEx[0].date).toLocaleDateString()}
            {(recentForEx[0].equipmentProfileId || recentForEx[0].equipmentContext) && (
              <span className="text-v5-subtext">· {equipmentDisplayLabel(state, recentForEx[0].equipmentProfileId, recentForEx[0].equipmentContext)}</span>
            )}
          </div>
        </div>
      )}

      <div className="border border-v5-red/25 bg-v5-elevated p-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-red mb-2">Recommended</div>
        {suggestion.suggestion !== null ? (
          <>
            <div className="text-4xl font-bold text-white">{suggestion.suggestion} lb x {suggestion.targetReps} reps</div>
            <div className="text-xs text-v5-subtext mt-1">{suggestion.reason}</div>
            {recentForEx.length > 0 && <div className="text-sm text-v5-subtext/70 mt-2">Goal: beat last session without losing form.</div>}
            <button
              onClick={() => {
                setTargetReps(suggestion.targetReps ?? 8);
                setSetsInput((rows) =>
                  rows.map((r, i) =>
                    i === 0 ? { ...r, weight: String(suggestion.suggestion), reps: String(suggestion.targetReps) } : r
                  )
                );
              }}
              className="mt-3 text-[11px] uppercase tracking-widest text-v5-red hover:text-v5-red"
            >
              Use suggested — fill set 1
            </button>
          </>
        ) : (
          <div className="text-sm text-v5-subtext">{suggestion.reason}</div>
        )}
      </div>

      <PlateCalculatorToggle
        barWeight={state.settings?.barWeight || 45}
        onUseWeight={(w) => setSetsInput((rows) => rows.map((r, i) => (i === 0 ? { ...r, weight: String(w) } : r)))}
      />

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Target reps this session</label>
        <input
          type="number"
          value={targetReps}
          onChange={(e) => setTargetReps(e.target.value)}
          className="w-24 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext">Today's sets</label>
          {recentForEx.length > 0 && (
            <button
              onClick={() =>
                setSetsInput(
                  recentForEx[0].sets.map((s) => ({
                    weight: String(s.weight),
                    reps: String(s.reps),
                    drops: (s.drops || []).map((d) => ({ weight: String(d.weight), reps: String(d.reps) })),
                    setType: s.setType || "working",
                    rir: s.rir != null ? String(s.rir) : "",
                    rpe: s.rpe != null ? String(s.rpe) : "",
                  }))
                )
              }
              className="flex items-center gap-1 text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red"
            >
              <Copy size={11} /> Copy last workout
            </button>
          )}
        </div>
        <SetRowsEditor sets={setsInput} onChange={setSetsInput} rirSystem={rirSystem} simple={isSimple} />
      </div>

      <button
        onClick={saveLog}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-v5-red border-v5-red text-white hover:opacity-90"
            : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"
        }`}
      >
        {saveLabel}
      </button>

      {showHistory && recentForEx.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">History</div>
          {/* Optional equipment-profile filter (task section 13) — shown only once the athlete
              actually has more than one machine's worth of history for this exercise; defaults
              to "All" so nothing is ever hidden without the athlete choosing to narrow it down. */}
          {historyEquipOptions.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {historyEquipOptions.map((opt) => (
                <button
                  key={opt.key ?? "all"}
                  onClick={() => setHistoryEquipFilter(opt.key)}
                  className={`shrink-0 px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold border rounded-full ${
                    historyEquipFilter === opt.key ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {filteredHistoryForEx.map((l) => (
              <button
                key={l.id}
                onClick={() => setEditingEntryId(l.id)}
                className="w-full flex items-center justify-between gap-2 text-xs border-b border-white/[0.06] py-2 text-left hover:border-white/10"
              >
                <span className="text-v5-subtext shrink-0">
                  {new Date(l.date).toLocaleDateString()}
                  {(l.equipmentProfileId || l.equipmentContext) && (
                    <span className="block text-v5-subtext/70">{equipmentDisplayLabel(state, l.equipmentProfileId, l.equipmentContext)}</span>
                  )}
                </span>
                <span className="text-sm text-v5-text/90 text-right">{l.sets.map(formatSetCompact).join(", ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- ONBOARDING ----------------
// Shown in place of the Log tab only for a genuinely fresh install — no logs, no cardio
// logs, no active program — until the user logs anything or starts a program, at which
// point hasSeenOnboarding latches true for good (see startRun / saveLog / saveEntry).
function OnboardingView({ state, onStartRun, onGoToTemplates }) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-3 py-2">
        <img
          src={BREAK_LOGO}
          alt="B.R.E.A.K. logo"
          className="w-16 h-16 rounded-full object-cover ring-1 ring-red-700/60 mx-auto"
        />
        <div>
          <div className="text-xl font-bold text-white">Welcome to BRK - Lift</div>
          <p className="text-sm text-v5-subtext mt-2 max-w-sm mx-auto">
            Log every set, follow a structured multi-day program, and let the app tell you what to lift next. Pick a
            program below to start Day 1 right now.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Pick a program</div>
        {(state.programs || []).map((prog) => (
          <div key={prog.id} className="border border-v5-red/25 bg-v5-elevated p-4 space-y-2">
            <div>
              <div className="text-base font-medium text-white">{prog.name}</div>
              <div className="text-xs text-v5-subtext mt-0.5">
                {prog.tagline}
                {prog.weeks ? ` · ${prog.weeks} weeks` : ""}
              </div>
            </div>
            <button
              onClick={() =>
                onStartRun(
                  { name: `${prog.name} — ${prog.days[0].label}`, exercises: prog.days[0].exercises },
                  { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: 0, totalDays: prog.days.length }
                )
              }
              className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5"
            >
              <ChevronRight size={12} /> Start Day 1
            </button>
          </div>
        ))}
      </div>

      <button onClick={onGoToTemplates} className="w-full text-center text-xs text-v5-subtext hover:text-v5-red py-2">
        Or browse everything in Templates
      </button>
    </div>
  );
}

// ---------------- LOG TAB ----------------
// ---------------- PR CELEBRATION ----------------
function prHeadline(prs) {
  return prs.find((p) => p.type === "weight") || prs.find((p) => p.type === "e1rm") || prs.find((p) => p.type === "reps") || prs[0];
}
function prLine(pr) {
  switch (pr.type) {
    case "weight":
      return `Heaviest weight: ${pr.weight} lb (+${Math.round((pr.weight - pr.prev) * 10) / 10} lb vs previous best ${pr.prev} lb)`;
    case "reps":
      return `Rep record @ ${pr.weight} lb: ${pr.reps} reps${pr.prev > 0 ? ` (prev ${pr.prev})` : ""}`;
    case "e1rm":
      return `Estimated 1RM: ${pr.value} lb (+${pr.value - pr.prev} lb vs previous best)`;
    case "exerciseVolume":
      return `Exercise volume: ${pr.value.toLocaleString()} lb (+${(pr.value - pr.prev).toLocaleString()} lb)`;
    default:
      return "";
  }
}
// Aggressive-but-clean celebration, shown once a set breaks a PR. Used both in the standalone
// Log tab (dismissible) and pinned to a collapsed "logged" card in the guided run (permanent
// for the session, since that card is the one thing that survives after the exercise input
// collapses away).
function PRCallout({ exMap, exId, prs, state, onDismiss }) {
  if (!prs || prs.length === 0) return null;
  const headline = prHeadline(prs);
  // "New Profile PR" instead of "New PR" whenever the record only holds on this specific
  // machine, not across every machine ever logged for this exercise (task section 12) — for
  // every exercise nobody has ever set up equipment profiles for (the common case), scope is
  // always "all-time" and this reads exactly as it always has.
  const isProfileScoped = headline?.scope === "profile";
  const profileLabel = isProfileScoped && state ? equipmentDisplayLabel(state, headline.equipmentProfileId, null) : null;
  return (
    <div className="border border-v5-red bg-v5-red/30 p-4 space-y-2 relative">
      {onDismiss && (
        <button onClick={onDismiss} className="absolute top-2 right-2 text-v5-subtext hover:text-white">
          <X size={14} />
        </button>
      )}
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-v5-red">
        <Award size={14} /> New {isProfileScoped ? "Profile " : ""}PR
      </div>
      <div className="text-lg font-bold text-white truncate pr-6">{exMap[exId]?.name || exId}</div>
      {profileLabel && <div className="text-xs text-v5-subtext -mt-1">{profileLabel}</div>}
      {headline && headline.weight != null && (
        <div className="text-2xl font-bold text-white">
          {headline.weight} × {headline.reps}
        </div>
      )}
      <div className="space-y-0.5 text-sm text-v5-text/90">
        {prs.map((pr, i) => (
          <div key={i}>{prLine(pr)}</div>
        ))}
      </div>
      <div className="pt-1">
        <ShareCardButton buildDataUrl={() => buildPRShareCard(exMap[exId]?.name || exId, prs)} filename="brk-lift-pr.png" />
      </div>
    </div>
  );
}

const CREATE_CUSTOM_EXERCISE_OPTION = "__create_custom_exercise__";

function LogTab({ state, updateState, allExercises, exMap, onStartRun, onLoggedSet, onRestartProgram, onGoToTemplates }) {
  const [selectedExId, setSelectedExId] = useState(allExercises[0].id);
  const [exFilter, setExFilter] = useState("");
  const [prBanner, setPrBanner] = useState(null);
  const [creatingCustom, setCreatingCustom] = useState(false);

  useEffect(() => setPrBanner(null), [selectedExId]);

  const selectableAll = useMemo(() => selectableExercises(allExercises), [allExercises]);
  const filteredExercises = useMemo(() => {
    const q = exFilter.trim().toLowerCase();
    if (!q) return selectableAll;
    return selectableAll.filter((ex) => matchesExerciseSearch(ex, q));
  }, [exFilter, selectableAll]);

  if (creatingCustom) {
    return (
      <CustomExerciseForm
        state={state}
        updateState={updateState}
        allExercises={allExercises}
        muscleGroups={MUSCLE_GROUPS}
        onBack={() => setCreatingCustom(false)}
        onSaved={(exId) => {
          setSelectedExId(exId);
          setCreatingCustom(false);
        }}
      />
    );
  }

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
      <ReadinessCheckIn state={state} updateState={updateState} />

      {currentProgramDay?.isComplete && (
        <div className="border border-v5-red/25 bg-v5-elevated px-4 py-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-v5-red">Program complete</div>
            <div className="text-base text-white mt-0.5">
              {currentProgramDay.programName} — {currentProgramDay.totalWeeks} weeks done
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRestartProgram}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90"
            >
              Restart
            </button>
            <button
              onClick={onGoToTemplates}
              className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-text/90 hover:border-v5-red/40"
            >
              New program
            </button>
          </div>
        </div>
      )}

      {currentProgramDay && !currentProgramDay.isComplete && (
        <div className="border border-v5-red/25 bg-v5-elevated px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-v5-red">Current program</div>
            <div className="text-base text-white mt-0.5 truncate">
              {currentProgramDay.programName}
              {currentProgramDay.weekNumber !== null
                ? ` — Week ${currentProgramDay.weekNumber} of ${currentProgramDay.totalWeeks}, Day ${currentProgramDay.dayIndex + 1} of ${currentProgramDay.totalDays}`
                : ` — Day ${currentProgramDay.dayIndex + 1} of ${currentProgramDay.totalDays}`}
            </div>
            <div className="text-xs text-v5-subtext mt-0.5 truncate">{currentProgramDay.dayLabel}</div>
          </div>
          <button
            onClick={() => onStartRun(currentProgramDay.plan, currentProgramDay.programContext)}
            className="shrink-0 ml-3 text-xs text-v5-red hover:text-v5-red flex items-center gap-1"
          >
            <ChevronRight size={14} /> Start
          </button>
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Exercise</label>
        <input
          type="text"
          value={exFilter}
          onChange={(e) => setExFilter(e.target.value)}
          placeholder="Search the catalog..."
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-xs mb-2 focus:outline-none focus:border-v5-red"
        />
        <select
          value={selectedExId}
          onChange={(e) => {
            if (e.target.value === CREATE_CUSTOM_EXERCISE_OPTION) {
              setCreatingCustom(true);
              return;
            }
            setSelectedExId(e.target.value);
          }}
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red"
        >
          {Object.entries(groupedByMuscle).map(([muscle, exs]) => (
            <optgroup key={muscle} label={muscle}>
              {exs.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                  {ex.custom ? " (Custom)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={CREATE_CUSTOM_EXERCISE_OPTION}>+ Create custom exercise</option>
        </select>
        {filteredExercises.length === 0 && (
          <div className="text-xs text-v5-subtext/70 mt-1.5">
            No match —{" "}
            <button type="button" onClick={() => setCreatingCustom(true)} className="text-v5-red hover:text-v5-red underline">
              create a custom exercise
            </button>
            .
          </div>
        )}
      </div>

      {prBanner && <PRCallout exMap={exMap} exId={prBanner.exId} prs={prBanner.prs} state={state} onDismiss={() => setPrBanner(null)} />}

      <ExerciseLogger
        exId={selectedExId}
        title={exMap[selectedExId]?.name}
        state={state}
        updateState={updateState}
        exMap={exMap}
        allExercises={allExercises}
        onSwap={setSelectedExId}
        onSaved={(entry) => {
          const prs = detectPRs(entry.exId, entry, state.logs);
          setPrBanner(prs.length > 0 ? { exId: entry.exId, prs } : null);
          onLoggedSet(entry);
        }}
      />
    </div>
  );
}

// ---------------- REST TIMER ----------------
// Sticky widget with fixed presets (1:00 / 1:30 / 2:00 / 3:00) plus a category-aware
// auto-start: whenever a set is logged, the caller computes the right default (compound /
// isolation / conditioning / superset, from Settings) and bumps { token, seconds }.
const REST_PRESETS = [60, 90, 120, 180];
// How long "Rest complete" stays up before auto-collapsing back to nothing, for an athlete who
// doesn't immediately log the next set — logging one before this fires clears it right away
// anyway (a fresh bump always wins), this is only the fallback so it never lingers forever.
const REST_COMPLETE_AUTO_COLLAPSE_MS = 8000;

function formatRestTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

// Web Audio (not an <audio> element) so the beep mixes with whatever the user is already
// playing (Spotify/Apple Music/etc.) instead of pausing it, the way <audio>/<video> often do
// on mobile. A single AudioContext is reused and resumed on user gestures (autoplay policy
// requires that) so it's already unlocked by the time the countdown actually hits zero.
//
// ROOT CAUSE of the beep going silent: iOS can auto-suspend an AudioContext after backgrounding
// or a period of inactivity — extremely common mid-rest, since resting is exactly when someone
// checks a text or locks the phone. ctx.resume() returns a Promise, and the old code never
// handled its rejection; a resume that silently failed (or a resume attempted from inside a
// useEffect instead of a real click-handler call stack, which iOS is stricter about) meant the
// beep call ran against a still-suspended context and produced nothing, with no error anywhere
// to notice. Both are fixed below: unlockAudio() is now also called synchronously inside
// bumpRestTimer() itself (the actual click-handler call stack from Save Set), and every
// resume()/play attempt is wrapped so a rejection can never silently eat the alert or throw.
//
// This logic now lives in utils/timerAudio.js (imported above) so the Cardio Interval Timer
// reuses the exact same proven unlock/resume handling instead of a second, divergent copy.
const playRestCompleteBeep = playCompletionBeep;

// Shows a system notification for a rest-complete event that happens while the tab is hidden
// but JS is still actually running (switched tabs, not fully suspended) — works on several
// desktop/Android browsers without any server involvement, and uses public/sw.js's
// registration.showNotification() when that worker is active (see main.jsx) since it's better
// supported for a backgrounded-but-alive tab than a bare `new Notification()`.
//
// The honest boundary: this is NOT the same as a true screen-locked iOS notification. Once iOS
// fully suspends a backgrounded/locked PWA, no JS at all runs — not this function, not the
// service worker's own script — until the athlete reopens the app. Making a notification appear
// in that state requires real Web Push: a server holding the athlete's push subscription, plus
// something to actually trigger the send at the right moment. BRK has no backend database or
// job scheduler today (only two stateless serverless proxies), so that path doesn't exist yet.
// Nothing here pretends otherwise — this function only ever fires from live, running JS.
async function showBackgroundNotification() {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const title = "REST COMPLETE";
    const options = { body: "Time for your next set.", icon: "/apple-touch-icon.png", tag: "brk-rest-complete", renotify: true };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch {
    // Best-effort only — never let a notification failure affect the rest timer itself.
  }
}

// Persists the active/paused rest timer (spec section 12) so a refresh mid-rest recovers
// against the real expiration timestamp instead of losing the timer or resetting it — mirrors
// the existing liftlog-active-run pattern (its own small key, not folded into the big app-state
// blob that only persists on the normal debounce cycle). alertedFor is included so a refresh
// landing exactly after completion but before the athlete has acted doesn't re-alert.
const REST_TIMER_STORAGE_KEY = "liftlog-rest-timer";
function loadPersistedRestTimer() {
  try {
    const raw = window.localStorage.getItem(REST_TIMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function persistRestTimerState({ duration, endsAt, pausedRemainingMs, alertedFor }) {
  try {
    if (endsAt != null || pausedRemainingMs != null) {
      window.localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ duration, endsAt, pausedRemainingMs, alertedFor }));
    } else {
      window.localStorage.removeItem(REST_TIMER_STORAGE_KEY);
    }
  } catch {
    // storage unavailable
  }
}

// The one place a rest-complete event is ever handled (spec section 3) — avoids the old bug
// class of duplicated completion logic (interval tick + resume reconciliation each doing their
// own thing) firing the alert more than once or handling foreground/background differently by
// accident.
function triggerRestCompleteAlert({ sound = true, vibration = true, backgroundAlerts = true } = {}) {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    if (sound) playRestCompleteBeep();
    if (vibration) vibratePattern([300, 150, 300, 150, 300]);
  } else if (backgroundAlerts) {
    showBackgroundNotification();
  }
}

// Global rest timer widget — mounted once at the app shell so it survives tab switches.
// Idle state is a slim bar; the instant it's running (or just hit zero) it expands into a
// large, high-contrast readout meant to be legible from across a gym, with a vibration +
// flash + beep on completion.
//
// Tracks an absolute endsAt timestamp (spec section 4) instead of decrementing a counter, so a
// throttled/paused setInterval while backgrounded can never cause drift — the displayed
// countdown and the completion check are always derived fresh from endsAt - Date.now(), not
// from how many ticks actually fired. visibilitychange/pageshow/focus (section 5) force an
// immediate recompute the instant BRK becomes active again, so returning from background jumps
// straight to "complete" rather than resuming a stale number.
function RestTimer({ bump, settings }) {
  const initial = loadPersistedRestTimer();
  const [duration, setDuration] = useState(initial?.duration ?? 90);
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? null); // absolute ms timestamp; null while idle
  const [pausedRemainingMs, setPausedRemainingMs] = useState(initial?.pausedRemainingMs ?? null); // set only while paused (endsAt is null then)
  const [justFinished, setJustFinished] = useState(false);
  // Compact "REST 1:27" pill by default (spec: prioritize exercise/weight/reps/sets, not the
  // timer) — tapping it reveals Pause/Reset/+30/+60/Skip/presets. Resets to collapsed on every
  // new bump so an expand during one rest period doesn't carry over into the next.
  const [expanded, setExpanded] = useState(false);
  const [, forceTick] = useState(0);
  // Dedup guard (section 13) — keyed on the endsAt value itself, so each distinct timer
  // instance (a new preset/bump always gets a new endsAt) can only ever alert once, regardless
  // of how many things try to trigger completion (an interval tick, a visibility reconciliation,
  // both racing on return-from-background). Seeded from the persisted value so a refresh landing
  // right after completion doesn't re-alert.
  const alertedForRef = useRef(initial?.alertedFor ?? null);

  const soundEnabled = settings?.restTimerSound !== false;
  const vibrationEnabled = settings?.restTimerVibration !== false;
  const backgroundAlertsEnabled = settings?.restTimerBackgroundAlerts !== false;

  const paused = pausedRemainingMs !== null;
  const isActive = endsAt !== null || paused;
  const remaining = paused ? Math.ceil(pausedRemainingMs / 1000) : endsAt != null ? Math.ceil(Math.max(0, endsAt - Date.now()) / 1000) : null;

  const fireCompletionIfDue = useCallback(() => {
    if (endsAt == null) return;
    if (Date.now() < endsAt) return;
    if (alertedForRef.current === endsAt) return;
    const completedEndsAt = endsAt;
    alertedForRef.current = completedEndsAt;
    persistRestTimerState({ duration, endsAt, pausedRemainingMs, alertedFor: completedEndsAt });
    triggerRestCompleteAlert({ sound: soundEnabled, vibration: vibrationEnabled, backgroundAlerts: backgroundAlertsEnabled });
    setJustFinished(true);
    setTimeout(() => setJustFinished(false), 2000);
    // Falls back to fully idle (nothing rendered at all — see the outer isActive/justFinished
    // check) if the athlete never interacts. Guarded against the still-current endsAt so a set
    // logged in the meantime (a fresh bump, a new endsAt) is never clobbered by this timeout.
    setTimeout(() => {
      setEndsAt((prev) => (prev === completedEndsAt ? null : prev));
    }, REST_COMPLETE_AUTO_COLLAPSE_MS);
  }, [endsAt, duration, pausedRemainingMs, soundEnabled, vibrationEnabled, backgroundAlertsEnabled]);

  // Persists on every meaningful state change, and once more immediately on mount to catch
  // "the stored timer already expired while BRK was closed" without waiting for the next tick.
  useEffect(() => {
    persistRestTimerState({ duration, endsAt, pausedRemainingMs, alertedFor: alertedForRef.current });
  }, [duration, endsAt, pausedRemainingMs]);
  useEffect(() => {
    fireCompletionIfDue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forces a re-render every second while genuinely running so the countdown visibly ticks, and
  // checks completion on every tick. If iOS throttles/skips ticks while backgrounded, nothing
  // breaks — the visibilitychange/focus reconciliation below catches up the instant BRK is
  // active again, computing straight from the real clock.
  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => {
      forceTick((t) => t + 1);
      fireCompletionIfDue();
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, fireCompletionIfDue]);

  useEffect(() => {
    const reconcile = () => {
      forceTick((t) => t + 1);
      fireCompletionIfDue();
    };
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("pageshow", reconcile);
    window.addEventListener("focus", reconcile);
    return () => {
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("pageshow", reconcile);
      window.removeEventListener("focus", reconcile);
    };
  }, [fireCompletionIfDue]);

  // Compares against the last-seen bump token (rather than a "have I ever run" flag) so
  // React StrictMode's double-invoke-on-commit in dev can't misfire this as a real bump.
  const lastBumpToken = useRef(bump.token);
  // What to show as "Next: 245 x 8" — the weight/reps the athlete just logged, carried along on
  // the bump that started this rest period. Undefined for a superset bump (no single "next" set)
  // or when a set was logged with no numeric weight/reps, in which case the line is just omitted.
  const [nextTarget, setNextTarget] = useState(null);
  useEffect(() => {
    if (bump.token === lastBumpToken.current) return;
    lastBumpToken.current = bump.token;
    setDuration(bump.seconds);
    setEndsAt(Date.now() + bump.seconds * 1000);
    setPausedRemainingMs(null);
    alertedForRef.current = null;
    setExpanded(false);
    setNextTarget(bump.nextWeight != null && bump.nextReps != null ? { weight: bump.nextWeight, reps: bump.nextReps } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bump.token]);

  const startPreset = (secs) => {
    unlockAudio(); // a real click handler — the most reliable place iOS honors a resume() call
    setDuration(secs);
    setEndsAt(Date.now() + secs * 1000);
    setPausedRemainingMs(null);
    alertedForRef.current = null;
  };
  const addSeconds = (n) => {
    if (paused) {
      setPausedRemainingMs((r) => (r ?? 0) + n * 1000);
      return;
    }
    setEndsAt((prev) => (prev == null ? Date.now() + n * 1000 : prev + n * 1000));
  };
  const skip = () => {
    setEndsAt(null);
    setPausedRemainingMs(null);
  };
  const reset = () => {
    setEndsAt(Date.now() + duration * 1000);
    setPausedRemainingMs(null);
    alertedForRef.current = null;
  };
  const togglePause = () => {
    if (paused) {
      setEndsAt(Date.now() + pausedRemainingMs);
      setPausedRemainingMs(null);
    } else if (endsAt != null) {
      setPausedRemainingMs(Math.max(0, endsAt - Date.now()));
      setEndsAt(null);
    }
  };

  // Nothing has actually run yet this workout (no bump, and no lingering completion) — this is
  // the "not relevant" state the redesign wants fully invisible, not just visually quiet.
  if (!isActive && !justFinished) return null;

  const complete = remaining === 0;

  // Thin progress indicator — fraction of the configured rest duration remaining, drained
  // left-to-right as the countdown ticks. Purely visual; nothing here feeds the actual timer.
  const progressFrac = duration > 0 && remaining != null ? Math.max(0, Math.min(1, remaining / duration)) : 0;

  if (!expanded) {
    // Default active view: a slim, tappable pill so exercise/weight/reps/sets stay the focus.
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`w-full bg-v5-elevated px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-bold tracking-wide transition-colors relative overflow-hidden ${
          justFinished ? "animate-rest-flash" : ""
        } ${complete ? "text-v5-red" : paused ? "text-v5-subtext" : "text-v5-text"}`}
      >
        {!complete && !paused && (
          <span
            className="absolute left-0 bottom-0 h-0.5 bg-v5-red transition-all"
            style={{ width: `${progressFrac * 100}%` }}
          />
        )}
        <Timer size={13} className="text-v5-red shrink-0" />
        {complete
          ? "Rest complete · Ready for next set"
          : `Rest ${formatRestTime(remaining)}${paused ? " · Paused" : ""}${
              !paused && nextTarget ? ` · Next ${nextTarget.weight} × ${nextTarget.reps}` : ""
            }`}
      </button>
    );
  }

  return (
    <div className={`bg-v5-elevated px-4 py-5 transition-colors ${justFinished ? "animate-rest-flash" : ""}`}>
      <button
        onClick={() => setExpanded(false)}
        className="w-full flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-v5-red mb-3 justify-center"
      >
        <Timer size={12} /> Rest timer
      </button>

      <div className="space-y-3">
        <div className="text-center">
          {remaining > 0 ? (
            <div className={`text-7xl font-bold tabular-nums leading-none ${paused ? "text-v5-subtext" : "text-v5-text"}`}>
              {formatRestTime(remaining)}
            </div>
          ) : (
            <div className="text-4xl font-bold text-v5-red leading-none">Rest complete</div>
          )}
          {paused && remaining > 0 && <div className="text-[11px] uppercase tracking-widest text-v5-subtext mt-1">Paused</div>}
          {!paused && remaining > 0 && nextTarget && (
            <div className="text-xs text-v5-subtext mt-1">
              Next: {nextTarget.weight} × {nextTarget.reps}
            </div>
          )}
        </div>
        {remaining > 0 && (
          <div className="h-1 bg-v5-muted rounded-full w-full overflow-hidden">
            <div className="h-1 bg-v5-red transition-all" style={{ width: `${progressFrac * 100}%` }} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => addSeconds(30)}
            className="flex-1 py-3 text-sm uppercase tracking-widest font-bold rounded-lg bg-v5-muted text-v5-text hover:opacity-80"
          >
            +30s
          </button>
          <button
            onClick={() => addSeconds(60)}
            className="flex-1 py-3 text-sm uppercase tracking-widest font-bold rounded-lg bg-v5-muted text-v5-text hover:opacity-80"
          >
            +60s
          </button>
          <button onClick={skip} className="flex-1 py-3 text-sm uppercase tracking-widest font-bold rounded-lg bg-v5-red text-white hover:opacity-90">
            Skip
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className="flex-1 py-2 text-xs uppercase tracking-widest font-bold rounded-lg bg-v5-muted text-v5-text hover:opacity-80 flex items-center justify-center gap-1.5"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={reset}
            className="flex-1 py-2 text-xs uppercase tracking-widest font-bold rounded-lg bg-v5-muted text-v5-text hover:opacity-80 flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
        <div className="flex items-center gap-2">
          {REST_PRESETS.map((secs) => (
            <button
              key={secs}
              onClick={() => startPreset(secs)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${
                duration === secs ? "bg-v5-red text-white" : "bg-v5-muted text-v5-subtext hover:text-v5-text"
              }`}
            >
              {formatRestTime(secs)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Today's readiness in the small { loggedToday, score, band } shape the coach service
// expects — shared by the pre-workout card below and buildCoachContext.
function todayReadinessSummary(state) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const entry = (state.readinessLogs || []).find((r) => r.date.slice(0, 10) === todayKey);
  if (!entry) return { loggedToday: false };
  const score = computeReadinessScore(entry);
  return { loggedToday: true, score, band: readinessBand(score) };
}

// ---------------- TRAINING MODE: ONE-SET-AT-A-TIME CARD ----------------
// Purpose-built for the guided run's *active* exercise only — large steppers (the number
// between the +/- buttons is a real input, so typing is still "manual entry"), one dominant
// Save Set button, and a per-set rest-timer bump via onSetSaved. Writes the exact same
// { id, exId, date, sets, targetReps } shape to state.logs that ExerciseLogger always has, via
// the same onSaved(entry) contract GuidedRunView already wires up — so detectPRs, suggestNext,
// buildSessionSummary and exports don't need to know this exists. The standalone Log tab and
// history-edit flow keep using ExerciseLogger/SetRowsEditor untouched.
function clampRirStep(n, system) {
  return system === "rpe" ? Math.max(6, Math.min(10, n)) : Math.max(0, Math.min(5, n));
}

function TrainingExerciseCard({
  exId,
  exSlot,
  state,
  updateState,
  exMap,
  allExercises,
  onSaved,
  onSwap,
  onSetSaved,
  draft,
  onDraftChange,
  onDraftDirty,
  sessionContext,
  exIndex,
  totalExercises,
}) {
  const rirSystem = state.settings?.rirSystem || "rir";
  const trainingDetail = state.settings?.trainingDetail || "advanced";
  const isSimple = trainingDetail === "simple";

  // ---------------- EQUIPMENT PROFILE (machine-based exercises only) ----------------
  // Restored from the autosaved draft first (crash/refresh must not lose which machine was
  // selected — task section 25); otherwise starts on this exercise's marked-default profile if
  // the athlete has set one, else "Default Machine" (null/null) — never auto-selected any other
  // way (task: "keep it manual and reliable," no GPS/location switching).
  const [equipmentProfileId, setEquipmentProfileId] = useState(() =>
    draft && draft.equipmentProfileId !== undefined ? draft.equipmentProfileId : defaultProfileFor(state, exId)?.id ?? null
  );
  const [equipmentContext, setEquipmentContext] = useState(() => (draft && draft.equipmentContext !== undefined ? draft.equipmentContext : null));
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false);
  const isBucketedEquipment = !!equipmentProfileId || equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT;
  // In Alternate Gym mode, a machine exercise still sitting on "Default Machine" with nothing
  // ever chosen gets a one-time nudge (task section 20) rather than silently assuming the home
  // gym's numbers apply — dismissible per exercise-instance so it never nags on every set.
  const [altGymNudgeDismissed, setAltGymNudgeDismissed] = useState(false);
  const isAlternateGym = sessionContext?.locationMode === "alternate_gym";
  const showAltGymNudge =
    isAlternateGym && isMachineBasedExercise(exMap[exId]) && !isBucketedEquipment && !altGymNudgeDismissed;

  // ---------------- SET QUALITY & PAIN/JOINT FLAGS (optional, task Part 2) ----------------
  // Draft-restored exactly like equipment — a crash/refresh must not lose an in-progress
  // quality/pain selection (task section 28). Defaults to no flag ("clean enough," never
  // forced) so an athlete who never touches this feature never sees it change anything.
  const [quality, setQuality] = useState(() => draft?.quality ?? null);
  const [painBodyArea, setPainBodyArea] = useState(() => draft?.pain?.bodyArea ?? null);
  const [painSeverity, setPainSeverity] = useState(() => draft?.pain?.severity ?? null);
  const [painNote, setPainNote] = useState(() => draft?.pain?.note ?? "");
  // Exercise-level joint note (task section 12) — discomfort attached to the whole movement
  // rather than one specific set. Separate control, separate field on the finished entry.
  const [jointNoteOpen, setJointNoteOpen] = useState(false);
  const [jointNoteArea, setJointNoteArea] = useState(() => draft?.jointNote?.bodyArea ?? null);
  const [jointNoteSeverity, setJointNoteSeverity] = useState(() => draft?.jointNote?.severity ?? null);
  const [jointNoteText, setJointNoteText] = useState(() => draft?.jointNote?.note ?? "");

  const suggestion = useMemo(
    () => suggestNext(exId, state.logs, exMap, { readinessLogs: state.readinessLogs, equipmentProfileId, equipmentContext }),
    [exId, state.logs, exMap, state.readinessLogs, equipmentProfileId, equipmentContext]
  );
  // Overall history for this exercise regardless of machine — kept for the "no history on this
  // machine, but here's when it was last performed overall" fallback (task section 11) and for
  // targetSetCount, which is a reasonable default no matter which machine was used.
  const overallRecentForEx = useMemo(
    () => state.logs.filter((l) => l.exId === exId).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3),
    [state.logs, exId]
  );
  // The same exercise's history, but only entries that share this exercise instance's current
  // equipment bucket — this is what "Last"/"Last session" below actually show once a specific
  // profile or temporary machine is selected (task section 9/14: "SAME EXERCISE + SAME EQUIPMENT
  // PROFILE"). Identical to overallRecentForEx whenever nothing else has ever been logged under
  // a different bucket for this exercise, which is why an athlete who never touches this feature
  // sees no change at all.
  const recentForEx = useMemo(
    () =>
      state.logs
        .filter((l) => l.exId === exId && sameEquipmentBucket(l, equipmentProfileId, equipmentContext))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3),
    [state.logs, exId, equipmentProfileId, equipmentContext]
  );
  const targetSetCount = exSlot?.sets || overallRecentForEx[0]?.sets.length || 3;
  // Recent pain pattern for this exercise (task section 5) — deliberately keyed off the
  // exercise's FULL history, not the current equipment bucket, since joint discomfort is about
  // the movement/body, not which machine performed it. Only surfaces once a body area (or
  // "unspecified") has repeated across 2+ of the last 4 sessions — a single occurrence is
  // already visible from that session's own pain flag, so repeating it here would just be noise
  // (task section 16: never add friction/clutter to the default logging flow).
  const painTrendCaution = useMemo(() => {
    const sorted = state.logs.filter((l) => l.exId === exId).sort((a, b) => new Date(b.date) - new Date(a.date));
    return painTrendForExercise(sorted).find((t) => t.sessionsWithPain >= 2) || null;
  }, [state.logs, exId]);

  // Restoring an in-progress workout: `draft` is this exercise's autosaved slot from
  // activeRun.draftByIndex (see sanitizeActiveRun/updateRunDraft in LiftLog), holding any sets
  // already saved via "Save Set" but not yet exercise-finished, plus whatever was typed into the
  // current set. Falls back to the normal fresh-exercise defaults when there's no draft (the
  // common case — a brand-new exercise, or one whose draft was already cleared by finishExercise).
  const [confirmedSets, setConfirmedSets] = useState(() => draft?.confirmedSets ?? []);
  // Defaults to 0, not "", when there's no suggestion (a brand-new exercise — exactly the
  // common case right after "Add exercise"): an empty weight field left Save Set silently
  // disabled with no obvious reason, reading as broken rather than "type a number first."
  const [weight, setWeight] = useState(() => (draft && draft.weight !== undefined ? draft.weight : suggestion.suggestion ?? 0));
  const [reps, setReps] = useState(() => (draft && draft.reps !== undefined ? draft.reps : suggestion.targetReps ?? 8));
  const [rirVal, setRirVal] = useState(() => draft?.rir ?? "");
  const [setType, setSetType] = useState(() => draft?.setType ?? "working");
  const [drops, setDrops] = useState(() => draft?.drops ?? []);
  // Progressive disclosure state — every one of these defaults closed. This component gets a
  // fresh `key={currentExId}` from GuidedRunView on every exercise switch, so there's no need
  // to reset these in an effect: a new exercise is a whole new component instance.
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [plateCalcOpen, setPlateCalcOpen] = useState(false);
  const [lastSessionOpen, setLastSessionOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [addingExtra, setAddingExtra] = useState(false);
  const [editingSetIndex, setEditingSetIndex] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");

  // ---------------- ACTIVE WORKOUT DRAFT AUTOSAVE ----------------
  // Continuously mirrors this exercise's in-progress state (confirmed-but-not-yet-exercise-
  // finished sets, plus the current unsaved set) up into activeRun.draftByIndex, so closing/
  // reloading the app mid-exercise never silently drops it — the previous architecture kept all
  // of this in this component's local React state only, with nothing durable until
  // finishExercise() ran. A completed set (confirmedSets changing — Save Set, or editing an
  // already-confirmed set) is written through immediately, never debounced: a "completed set" is
  // never allowed to depend on a timer or on Finish Workout to become durable. Everything else
  // (weight/reps/RIR/set type/drops being typed) is debounced so fast typing doesn't write on
  // every keystroke, but still commits well inside a window an accidental close could exploit.
  const draftTimerRef = useRef(null);
  const pendingSnapshotRef = useRef(null);
  const prevConfirmedRef = useRef(confirmedSets);
  const prevEquipmentRef = useRef({ id: equipmentProfileId, ctx: equipmentContext });
  const prevQualityRef = useRef({ quality, painBodyArea, painSeverity, painNote, jointNoteArea, jointNoteSeverity, jointNoteText });
  const onDraftChangeRef = useRef(onDraftChange);
  const onDraftDirtyRef = useRef(onDraftDirty);
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
    onDraftDirtyRef.current = onDraftDirty;
  }, [onDraftChange, onDraftDirty]);

  useEffect(() => {
    const snapshot = {
      confirmedSets,
      weight,
      reps,
      rir: rirVal,
      setType,
      drops,
      equipmentProfileId,
      equipmentContext,
      quality,
      pain: quality === "pain" ? { bodyArea: painBodyArea, severity: painSeverity, note: painNote } : null,
      jointNote: jointNoteArea || jointNoteSeverity || jointNoteText ? { bodyArea: jointNoteArea, severity: jointNoteSeverity, note: jointNoteText } : null,
      updatedAt: new Date().toISOString(),
    };
    pendingSnapshotRef.current = snapshot;
    onDraftDirtyRef.current?.();
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    const completedSetChanged = confirmedSets !== prevConfirmedRef.current;
    // Task section 25/28: an equipment-profile change, or a quality/pain flag, must persist
    // immediately, not on the usual debounce — same "never allowed to depend on a timer" rule
    // Save Set already gets. Losing which machine was selected, or a just-reported pain flag,
    // on a crash/refresh would silently corrupt the athlete's training context.
    const equipmentChanged = equipmentProfileId !== prevEquipmentRef.current.id || equipmentContext !== prevEquipmentRef.current.ctx;
    const qualityChanged =
      quality !== prevQualityRef.current.quality ||
      painBodyArea !== prevQualityRef.current.painBodyArea ||
      painSeverity !== prevQualityRef.current.painSeverity ||
      painNote !== prevQualityRef.current.painNote ||
      jointNoteArea !== prevQualityRef.current.jointNoteArea ||
      jointNoteSeverity !== prevQualityRef.current.jointNoteSeverity ||
      jointNoteText !== prevQualityRef.current.jointNoteText;
    prevConfirmedRef.current = confirmedSets;
    prevEquipmentRef.current = { id: equipmentProfileId, ctx: equipmentContext };
    prevQualityRef.current = { quality, painBodyArea, painSeverity, painNote, jointNoteArea, jointNoteSeverity, jointNoteText };
    if (completedSetChanged || equipmentChanged || qualityChanged) {
      onDraftChangeRef.current?.(snapshot);
      pendingSnapshotRef.current = null;
    } else {
      draftTimerRef.current = setTimeout(() => {
        draftTimerRef.current = null;
        pendingSnapshotRef.current = null;
        onDraftChangeRef.current?.(snapshot);
      }, 300);
    }
  }, [
    confirmedSets,
    weight,
    reps,
    rirVal,
    setType,
    drops,
    equipmentProfileId,
    equipmentContext,
    quality,
    painBodyArea,
    painSeverity,
    painNote,
    jointNoteArea,
    jointNoteSeverity,
    jointNoteText,
  ]);

  // Secondary safety net only (per the reliability spec — mobile Safari/PWAs don't guarantee
  // these fire): flushes any still-pending debounced draft immediately when the tab is hidden,
  // the page is about to unload, or this card unmounts (switching exercises, or the workout being
  // minimized/exited). The primary protection is the effect above already writing into
  // continuously-persisted activeRun state — this just closes the up-to-300ms gap for a fast
  // close that lands mid-debounce.
  useEffect(() => {
    const flushNow = () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
      if (pendingSnapshotRef.current) {
        onDraftChangeRef.current?.(pendingSnapshotRef.current);
        pendingSnapshotRef.current = null;
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("beforeunload", flushNow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("beforeunload", flushNow);
      flushNow();
    };
  }, []);

  const showDraft = confirmedSets.length < targetSetCount || addingExtra;
  const lastEntry = recentForEx[0];
  const lastTopSet = lastEntry ? topSetOf(lastEntry.sets) : null;
  const notesSaved = state.exerciseNotes?.[exId];
  const hasNotes = !!(notesSaved && (notesSaved.general || notesSaved.machine || notesSaved.cue));
  const optionsHasContent = (!isSimple && (rirVal !== "" || setType !== "working" || drops.length > 0)) || hasNotes || !!quality || !!jointNoteArea;

  // Mid-exercise correction (a fat-fingered weight/reps entry shouldn't have to wait until the
  // whole workout is finished and edited from history) — edits the already-confirmed set in
  // place, preserving its rir/rpe/setType/drops, before it's ever written to state.logs.
  const startEditSet = (i) => {
    setEditingSetIndex(i);
    setEditWeight(String(confirmedSets[i].weight));
    setEditReps(String(confirmedSets[i].reps));
  };
  const cancelEditSet = () => setEditingSetIndex(null);
  const saveEditSet = () => {
    if (editWeight === "" || editReps === "") return;
    const i = editingSetIndex;
    setConfirmedSets((prev) => {
      const merged = cleanSetsInput([{ ...prev[i], weight: editWeight, reps: editReps }])[0];
      return prev.map((s, idx) => (idx === i ? merged : s));
    });
    setEditingSetIndex(null);
  };

  const saveSet = () => {
    if (weight === "" || reps === "") return;
    const raw = {
      weight,
      reps,
      drops,
      setType,
      rir: rirSystem === "rir" ? rirVal : "",
      rpe: rirSystem === "rpe" ? rirVal : "",
      quality,
      pain: quality === "pain" ? sanitizePainInfo({ bodyArea: painBodyArea, severity: painSeverity, note: painNote }) : null,
    };
    const cleaned = cleanSetsInput([raw])[0];
    setConfirmedSets((prev) => [...prev, cleaned]);
    onSetSaved?.({ weight, reps });
    setRirVal("");
    setSetType("working");
    setDrops([]);
    // Quality/pain is per-set, not sticky across sets — each one starts clean again, matching
    // the task's "no flag / clean enough" default (never carried forward as an assumption).
    setQuality(null);
    setPainBodyArea(null);
    setPainSeverity(null);
    setPainNote("");
    setOptionsOpen(false);
    setAddingExtra(false);
  };

  const finishExercise = () => {
    if (confirmedSets.length === 0) return;
    // Cancel any still-pending debounced draft flush for whatever was mid-typed in an abandoned
    // extra set — the athlete just chose to finish without it, so it must not resurrect as a
    // stale draft the next time this exercise slot is reopened (see the unmount flush effect
    // above; recordRunEntry already clears draftByIndex[idx] for the real completed sets).
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    pendingSnapshotRef.current = null;
    const entry = {
      id: `log_${Date.now()}`,
      exId,
      date: new Date().toISOString(),
      sets: confirmedSets,
      targetReps: Number(reps) || confirmedSets[0].reps,
      // Whatever equipment context was selected when this exercise was finished (task section
      // 8) — omitted entirely for "Default Machine" so an entry logged with no equipment
      // engagement at all is byte-identical to every entry BRK has ever saved.
      ...(equipmentProfileId ? { equipmentProfileId } : {}),
      ...(equipmentContext ? { equipmentContext } : {}),
      // Exercise-level joint note (task section 12) — discomfort attached to the whole
      // movement, separate from any per-set pain flag already on confirmedSets.
      ...(sanitizePainInfo({ bodyArea: jointNoteArea, severity: jointNoteSeverity, note: jointNoteText })
        ? { jointNote: sanitizePainInfo({ bodyArea: jointNoteArea, severity: jointNoteSeverity, note: jointNoteText }) }
        : {}),
    };
    updateState((prev) => ({ ...prev, logs: [entry, ...prev.logs], hasSeenOnboarding: true }));
    onSaved?.(entry);
  };

  const useSuggested = () => {
    if (suggestion.suggestion == null) return;
    setWeight(suggestion.suggestion);
    setReps(suggestion.targetReps ?? 8);
  };
  const duplicateLast = () => {
    const last = confirmedSets[confirmedSets.length - 1] || recentForEx[0]?.sets?.[0];
    if (!last) return;
    setWeight(last.weight);
    setReps(last.reps);
  };

  if (equipmentSheetOpen) {
    return (
      <EquipmentProfileSheet
        exId={exId}
        exName={exMap[exId]?.name || exId}
        state={state}
        updateState={updateState}
        equipmentProfileId={equipmentProfileId}
        equipmentContext={equipmentContext}
        onSelect={({ equipmentProfileId: pid, equipmentContext: ctx }) => {
          setEquipmentProfileId(pid);
          setEquipmentContext(ctx);
          // Refreshes the still-blank weight/reps draft to the newly-selected bucket's own
          // suggestion — critical, not cosmetic: leaving a different machine's number sitting in
          // the input after switching would be exactly the misleading cross-machine carryover
          // this whole feature exists to prevent (task section 11). Only when nothing has been
          // logged yet this exercise — a mid-exercise switch after already confirming sets under
          // the old context leaves whatever's currently typed alone, since Finish Exercise
          // decides the entry's equipment tag from whatever's selected at that moment anyway.
          if (confirmedSets.length === 0) {
            const next = suggestNext(exId, state.logs, exMap, { readinessLogs: state.readinessLogs, equipmentProfileId: pid, equipmentContext: ctx });
            setWeight(next.suggestion ?? 0);
            setReps(next.targetReps ?? 8);
          }
          setEquipmentSheetOpen(false);
        }}
        onBack={() => setEquipmentSheetOpen(false)}
      />
    );
  }

  if (swapOpen) {
    return (
      <ExerciseSwapPicker
        currentExId={exId}
        allExercises={allExercises}
        exMap={exMap}
        state={state}
        updateState={updateState}
        muscleGroups={MUSCLE_GROUPS}
        onBack={() => setSwapOpen(false)}
        onSelect={(newExId) => {
          // Same reasoning as finishExercise: cancel any pending debounced draft for the
          // exercise being swapped away from, so it can't leak into draftByIndex for this slot
          // and resurface as the new exercise's initial weight/reps once swapRunExercise (which
          // also clears this slot's draft) commits.
          if (draftTimerRef.current) {
            clearTimeout(draftTimerRef.current);
            draftTimerRef.current = null;
          }
          pendingSnapshotRef.current = null;
          setSwapOpen(false);
          onSwap(newExId);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* The "current exercise hero" the mockup builds Active Workout around — anatomy figure
          cleanly positioned in the card, exercise number/name/target muscles, and the last-time/
          today's-target numbers overlaid right on the card rather than in a separate strip
          below it. */}
      <PhotoHero
        exercise={exMap[exId]}
        eyebrow={totalExercises ? `Exercise ${(exIndex ?? 0) + 1} of ${totalExercises}` : undefined}
        title={exMap[exId]?.name || exId}
        className="pb-4"
      >
        {exMap[exId]?.muscle && (
          <div className="text-xs text-v5-subtext">Targets: {exMap[exId].muscle}</div>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1">
          {lastTopSet && (
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-v5-subtext">Last</div>
              <div className="text-sm font-bold text-v5-text tabular-nums">{lastTopSet.weight} × {lastTopSet.reps}</div>
            </div>
          )}
          {suggestion.suggestion != null && (
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-v5-red">Today's target</div>
              <div className="text-sm font-bold text-v5-text tabular-nums">{suggestion.suggestion} × {suggestion.targetReps}</div>
            </div>
          )}
        </div>
      </PhotoHero>
      {onSwap && (
        <button
          onClick={() => setSwapOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-v5-subtext hover:text-v5-red py-0.5"
        >
          <ArrowLeftRight size={12} /> Swap exercise
        </button>
      )}

      {/* Equipment Profile control (task section 3) — only for exercises where two physical
          units can plausibly load very differently, quiet/small so it never competes with the
          actual set-logging controls, and completely absent for free-weight movements. */}
      {isMachineBasedExercise(exMap[exId]) && (
        <button
          onClick={() => setEquipmentSheetOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-v5-surface text-left"
        >
          <span className="text-[10px] uppercase tracking-wide text-v5-subtext shrink-0">Equipment</span>
          <span className="text-xs font-bold text-v5-text truncate ml-2">{equipmentDisplayLabel(state, equipmentProfileId, equipmentContext)} ▾</span>
        </button>
      )}

      {/* Alternate Gym mode (task section 20) — a machine exercise still on "Default Machine"
          gets one dismissible nudge rather than silently assuming home-gym numbers apply here
          too. Never shown for free-weight exercises (no isMachineBasedExercise match) and never
          shown once a profile/temporary machine has actually been chosen. */}
      {showAltGymNudge && (
        <div className="border border-v5-red/40 bg-v5-red/5 rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-v5-text">Different machine?</div>
          <div className="text-[11px] text-v5-subtext">You're training somewhere else today — this machine may not match your usual one.</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEquipmentContext(TEMPORARY_EQUIPMENT_CONTEXT);
                setEquipmentProfileId(null);
                const next = suggestNext(exId, state.logs, exMap, {
                  readinessLogs: state.readinessLogs,
                  equipmentProfileId: null,
                  equipmentContext: TEMPORARY_EQUIPMENT_CONTEXT,
                });
                if (confirmedSets.length === 0) {
                  setWeight(next.suggestion ?? 0);
                  setReps(next.targetReps ?? 8);
                }
                setAltGymNudgeDismissed(true);
              }}
              className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold bg-v5-red text-white rounded-md hover:opacity-90"
            >
              Use temporary machine
            </button>
            <button
              onClick={() => setEquipmentSheetOpen(true)}
              className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold border border-v5-subtext/40 text-v5-subtext rounded-md hover:text-v5-text"
            >
              Select saved profile
            </button>
          </div>
          <button onClick={() => setAltGymNudgeDismissed(true)} className="text-[10px] text-v5-subtext/70 hover:text-v5-subtext">
            Dismiss
          </button>
        </div>
      )}

      {/* Substitution flow (task section 22) — Alternate Gym only, reuses the exact same Swap
          picker the regular Swap icon already opens (no separate substitution system). Never
          silently swaps — this only ever opens the picker for the athlete to choose from. */}
      {isAlternateGym && onSwap && (
        <button
          onClick={() => setSwapOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-v5-surface text-left"
        >
          <span className="text-[11px] text-v5-subtext">Equipment not available?</span>
          <span className="text-[11px] font-bold text-v5-red">Find substitute</span>
        </button>
      )}

      {/* Compact progression controls — the actual Last/Target numbers now live on the hero
          card above (overlaid, mockup-style), so this strip is just the "Use," "Why this
          target," and same-machine caveats that don't fit up there. When a specific equipment
          profile/temporary machine is active, a "No history here" callout points at the
          exercise's overall last-performed date (task section 11) rather than silently showing
          nothing, or worse, another machine's numbers. */}
      {(isBucketedEquipment && !lastTopSet && overallRecentForEx.length > 0) && (
        <div className="bg-v5-surface rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-v5-red">No history here</div>
            <div className="text-xs text-v5-subtext mt-0.5">
              Last overall: {new Date(overallRecentForEx[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </div>
          </div>
        </div>
      )}
      {(suggestion.suggestion != null || (lastEntry && lastEntry.sets.length > 1)) && (
        <div className="flex items-center gap-4 px-1">
          {suggestion.suggestion != null && (
            <button onClick={useSuggested} className="text-[11px] uppercase tracking-widest text-v5-red hover:opacity-80">
              Use suggested
            </button>
          )}
          {suggestion.reason && (
            <button onClick={() => setReasonOpen((o) => !o)} className="text-[11px] text-v5-subtext hover:text-v5-text">
              {reasonOpen ? "Hide" : "Why this target?"}
            </button>
          )}
          {lastEntry && lastEntry.sets.length > 1 && (
            <button onClick={() => setLastSessionOpen((o) => !o)} className="text-[11px] text-v5-subtext hover:text-v5-text">
              Last session {lastSessionOpen ? "▴" : "▾"}
            </button>
          )}
        </div>
      )}
      {reasonOpen && suggestion.reason && <div className="px-1 text-xs text-v5-subtext">{suggestion.reason}</div>}
      {lastSessionOpen && lastEntry && (
        <div className="px-1 space-y-0.5">
          {lastEntry.sets.map((s, i) => (
            <div key={i} className="text-xs text-v5-subtext">
              {formatSetVerbose(s)}
            </div>
          ))}
        </div>
      )}

      {painTrendCaution && (
        <div className="text-[11px] text-v5-red bg-v5-red/5 border border-v5-red/30 rounded-lg px-3 py-2">
          {painTrendLabel(painTrendCaution)} — training context only, not a diagnosis.
        </div>
      )}

      {confirmedSets.length > 0 && (
        <div className="space-y-1.5">
          {confirmedSets.length > 1 && <SectionLabel tone="muted">Today's sets</SectionLabel>}
          {confirmedSets.map((s, i) => {
            // Purely a display highlight (never affects saving/editing/order) — the heaviest
            // logged set this exercise, ties broken by reps, mirrors the mockup's "best set"
            // column without inventing a second source of truth for what "best" means.
            const isBest =
              confirmedSets.length > 1 &&
              confirmedSets.every((other, j) => j === i || s.weight > other.weight || (s.weight === other.weight && s.reps >= other.reps));
            return editingSetIndex === i ? (
              <div key={i} className="flex items-center gap-2 text-sm bg-v5-elevated rounded-lg p-2">
                <span className="text-v5-subtext shrink-0">Set {i + 1}:</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  className="w-16 bg-v5-muted rounded text-v5-text text-center px-1 py-1 focus:outline-none focus:ring-1 focus:ring-v5-red"
                />
                <span className="text-v5-subtext text-xs">lb x</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editReps}
                  onChange={(e) => setEditReps(e.target.value)}
                  className="w-14 bg-v5-muted rounded text-v5-text text-center px-1 py-1 focus:outline-none focus:ring-1 focus:ring-v5-red"
                />
                <span className="text-v5-subtext text-xs">reps</span>
                <button onClick={saveEditSet} className="ml-auto shrink-0 text-v5-success hover:opacity-80 p-1">
                  <Check size={16} />
                </button>
                <button onClick={cancelEditSet} className="shrink-0 text-v5-subtext hover:text-v5-red p-1">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                key={i}
                onClick={() => startEditSet(i)}
                aria-label={`Edit set ${i + 1}`}
                className="w-full flex items-center gap-2 text-sm bg-v5-surface rounded-lg px-3 py-2.5 hover:bg-v5-elevated"
              >
                <Check size={13} className="text-v5-success shrink-0" />
                <span className="text-v5-subtext shrink-0">Set {i + 1}</span>
                <span className="flex-1 text-left text-v5-text font-bold">{formatSetCompact(s)}</span>
                {isBest && (
                  <span className="shrink-0 text-[9px] uppercase tracking-widest font-bold bg-v5-red/15 text-v5-red px-1.5 py-0.5 rounded-full">
                    Best
                  </span>
                )}
                {(s.rir != null && s.rir !== "") || (s.rpe != null && s.rpe !== "") ? (
                  <span className="text-[10px] text-v5-subtext shrink-0">
                    {s.rir != null && s.rir !== "" ? `RIR ${s.rir}` : `RPE ${s.rpe}`}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {showDraft && (
        <div className="bg-v5-surface rounded-xl p-2.5 space-y-1.5">
          <div className="text-sm font-bold text-v5-text">
            Set {confirmedSets.length + 1}
            {targetSetCount ? ` of ${targetSetCount}` : ""}
          </div>

          {/* Weight and Reps are two short, independent boxes (not one tall Weight card with the
              adjuster nested inside it) — the quick-load strip is its own compact row scoped to
              Weight's column below, so Weight reads as wider (60%) rather than taller, and Reps
              stays genuinely short instead of stretching to match a taller neighbor. */}
          <div className="flex items-start gap-2">
            <div className="flex-[3] min-w-0 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-v5-subtext">Weight</div>
              <div className="bg-v5-muted rounded-lg px-3 py-1.5 flex items-baseline justify-center gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent text-3xl font-bold text-v5-text text-center focus:outline-none placeholder:text-v5-subtext/40"
                />
                <span className="shrink-0 text-xs font-bold text-v5-subtext">lb</span>
              </div>
              {/* Updates only this draft weight field, the same one manual typing and
                  "Use"/"Duplicate" already write to. Never saves a set, never touches the rest
                  timer. */}
              <QuickLoadAdjuster weight={weight} onChange={(w) => setWeight(w)} />
            </div>
            <div className="flex-[2] min-w-0 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-v5-subtext">Reps</div>
              <div className="bg-v5-muted rounded-lg px-3 py-1.5">
                <input
                  type="number"
                  inputMode="numeric"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="0"
                  className="w-full bg-transparent text-3xl font-bold text-v5-text text-center focus:outline-none placeholder:text-v5-subtext/40"
                />
              </div>
            </div>
            {/* RIR/RPE as a third always-visible column (mockup: weight/reps/RIR all shown at
                once, not hidden behind a toggle) — compact stepper rather than a full box, so it
                reads as lighter-weight than Weight/Reps without disappearing into Options. Still
                writes to the exact same rirVal state Options' controls used before, and stays
                fully optional: never stepped away from "" unless the athlete taps it. */}
            {!isSimple && (
              <div className="flex-[1.3] min-w-0 space-y-1">
                <div className="text-[10px] uppercase tracking-wide text-v5-subtext text-center">{rirSystem === "rpe" ? "RPE" : "RIR"}</div>
                <div className="bg-v5-muted rounded-lg px-1 py-1 flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRirVal((v) => clampRirStep((v === "" ? (rirSystem === "rpe" ? 7 : 3) : Number(v)) + 1, rirSystem))}
                    className="text-v5-subtext hover:text-v5-red p-0.5"
                    aria-label="Increase"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <span className="text-xl font-bold text-v5-text tabular-nums leading-none">{rirVal === "" ? "—" : rirVal}</span>
                  <button
                    type="button"
                    onClick={() => setRirVal((v) => clampRirStep((v === "" ? (rirSystem === "rpe" ? 9 : 1) : Number(v)) - 1, rirSystem))}
                    className="text-v5-subtext hover:text-v5-red p-0.5"
                    aria-label="Decrease"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Compact advanced-tools row — RIR/Set Type/Notes bundled behind "More", Plate Calc
              as its own quick-access toggle, matching the v5 "RIR / Set Type / Notes / Plate
              Calc / More" row while keeping every existing control's underlying behavior (and
              accessible name) unchanged. Collapsed by default so the current set stays the
              visual center; a small dot marks "More" when it already holds something so nothing
              set earlier this exercise silently goes unnoticed while hidden. Small, low-emphasis
              utility chips — deliberately lighter than the Weight/Reps boxes above them so they
              read as secondary tools, not another major section. */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPlateCalcOpen((o) => !o)}
              className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wide font-bold ${
                plateCalcOpen ? "bg-v5-red/15 text-v5-red" : "text-v5-subtext hover:text-v5-text"
              }`}
            >
              Plate calc {plateCalcOpen ? "▴" : "▾"}
            </button>
            <button
              onClick={() => setOptionsOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wide font-bold ${
                optionsOpen ? "bg-v5-red/15 text-v5-red" : "text-v5-subtext hover:text-v5-text"
              }`}
            >
              Options {optionsOpen ? "▴" : "▾"}
              {optionsHasContent && !optionsOpen && <span className="w-1.5 h-1.5 rounded-full bg-v5-red" />}
            </button>
          </div>
          {plateCalcOpen && (
            <PlateCalculatorPanel
              barWeight={state.settings?.barWeight || 45}
              onUseWeight={(w) => {
                setWeight(w);
                setPlateCalcOpen(false);
              }}
            />
          )}
          {optionsOpen && (
            <div className="space-y-3 pt-1">
              {!isSimple && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-v5-subtext mb-1.5">Set type</div>
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {SET_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => setSetType(t.value)}
                        className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded ${
                          setType === t.value ? "bg-v5-red text-white" : "bg-v5-muted text-v5-subtext hover:text-v5-text"
                        }`}
                      >
                        {t.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Set quality (task Part 2) — one tap, no flag by default. Pain reveals a small
                  body-area/severity/note sub-form inline, never a separate modal (task section
                  9: "do not create a full modal requiring multiple steps"). */}
              {!isSimple && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-v5-subtext mb-1.5">Set quality</div>
                  <div className="flex items-center gap-1.5">
                    {SET_QUALITY_LEVELS.map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality((v) => (v === q ? null : q))}
                        className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded ${
                          quality === q ? "bg-v5-red text-white" : "bg-v5-muted text-v5-subtext hover:text-v5-text"
                        }`}
                      >
                        <span aria-hidden="true">{SET_QUALITY_GLYPH[q]}</span> {SET_QUALITY_LABEL[q]}
                      </button>
                    ))}
                  </div>
                  {quality === "pain" && (
                    <div className="mt-2 space-y-2 bg-v5-muted/40 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 overflow-x-auto">
                        {PAIN_BODY_AREAS.map((area) => (
                          <button
                            key={area}
                            onClick={() => setPainBodyArea((v) => (v === area ? null : area))}
                            className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded ${
                              painBodyArea === area ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext hover:text-v5-text"
                            }`}
                          >
                            {area}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wide text-v5-subtext shrink-0">Severity</span>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={painSeverity ?? 3}
                          onChange={(e) => setPainSeverity(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-xs font-bold text-v5-text w-6 text-right">{painSeverity ?? 3}</span>
                      </div>
                      <input
                        value={painNote}
                        onChange={(e) => setPainNote(e.target.value.slice(0, 200))}
                        placeholder="Optional note — e.g. outer elbow"
                        className="w-full bg-v5-elevated rounded-lg text-v5-text px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-v5-red"
                      />
                    </div>
                  )}
                </div>
              )}

              {!isSimple && (
                <div className="space-y-2">
                  {drops.map((d, di) => (
                    <div key={di} className="flex items-center gap-2">
                      <span className="text-xs text-v5-subtext">↳</span>
                      <input
                        type="number"
                        placeholder="Drop weight"
                        value={d.weight}
                        onChange={(e) => setDrops((ds) => ds.map((x, i) => (i === di ? { ...x, weight: e.target.value } : x)))}
                        className="flex-1 min-w-0 bg-v5-muted rounded-lg text-v5-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red"
                      />
                      <input
                        type="number"
                        placeholder="Drop reps"
                        value={d.reps}
                        onChange={(e) => setDrops((ds) => ds.map((x, i) => (i === di ? { ...x, reps: e.target.value } : x)))}
                        className="flex-1 min-w-0 bg-v5-muted rounded-lg text-v5-text px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red"
                      />
                      <button onClick={() => setDrops((ds) => ds.filter((_, i) => i !== di))} className="text-v5-subtext hover:text-v5-red p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setDrops((ds) => [...ds, { weight: "", reps: "" }])}
                    className="flex items-center gap-1 text-[11px] text-v5-subtext hover:text-v5-red"
                  >
                    <Plus size={11} /> Add drop
                  </button>
                </div>
              )}

              <button onClick={duplicateLast} className="text-[11px] uppercase tracking-wide text-v5-subtext hover:text-v5-red">
                Duplicate last set
              </button>

              {/* Exercise-level joint note (task section 12) — discomfort consistent across the
                  whole movement rather than one specific set. Separate, optional, off by
                  default. */}
              <div>
                <button
                  onClick={() => setJointNoteOpen((o) => !o)}
                  className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-v5-subtext hover:text-v5-red"
                >
                  Joint note{jointNoteArea ? ` — ${jointNoteArea}` : ""} {jointNoteOpen ? "▴" : "▾"}
                </button>
                {jointNoteOpen && (
                  <div className="mt-2 space-y-2 bg-v5-muted/40 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {PAIN_BODY_AREAS.map((area) => (
                        <button
                          key={area}
                          onClick={() => setJointNoteArea((v) => (v === area ? null : area))}
                          className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded ${
                            jointNoteArea === area ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext hover:text-v5-text"
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-v5-subtext shrink-0">Severity</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={jointNoteSeverity ?? 3}
                        onChange={(e) => setJointNoteSeverity(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-xs font-bold text-v5-text w-6 text-right">{jointNoteSeverity ?? 3}</span>
                    </div>
                    <input
                      value={jointNoteText}
                      onChange={(e) => setJointNoteText(e.target.value.slice(0, 200))}
                      placeholder="Optional note — e.g. elbow discomfort"
                      className="w-full bg-v5-elevated rounded-lg text-v5-text px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-v5-red"
                    />
                  </div>
                )}
              </div>

              <ExerciseNotesPanel exId={exId} state={state} updateState={updateState} />
            </div>
          )}

          {/* The one unmistakable primary action on this screen — larger and given a soft red
              glow so it never reads as just another row of buttons among Plate Calc/Options. */}
          <button
            onClick={saveSet}
            disabled={weight === "" || reps === ""}
            className={`w-full py-3.5 rounded-xl text-sm uppercase tracking-widest font-bold transition-shadow ${
              weight !== "" && reps !== ""
                ? "bg-v5-red text-white hover:opacity-90 shadow-[0_10px_28px_-10px_rgba(210,38,46,0.6)]"
                : "bg-v5-muted/50 text-v5-subtext/60 cursor-not-allowed"
            }`}
          >
            Save set
          </button>
        </div>
      )}

      {!showDraft && confirmedSets.length >= targetSetCount && (
        <div className="space-y-2">
          <button
            onClick={finishExercise}
            className="w-full py-3 rounded-xl text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:opacity-90"
          >
            Finish exercise →
          </button>
          <button
            onClick={() => setAddingExtra(true)}
            className="w-full text-center text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red"
          >
            + Add another set
          </button>
        </div>
      )}
      {showDraft && confirmedSets.length > 0 && confirmedSets.length < targetSetCount && (
        <button onClick={finishExercise} className="w-full text-center text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red py-1">
          Finish exercise now ({confirmedSets.length} set{confirmedSets.length > 1 ? "s" : ""} logged)
        </button>
      )}
    </div>
  );
}

// ---------------- GUIDED PLAN RUNNER ----------------
// Shows every exercise in the plan on one page so the whole session is visible at once, but
// only the current, not-yet-logged exercise ever shows active input fields — logged ones
// collapse to a read-only summary (with an Edit link back into the shared edit panel), and
// not-yet-reached ones show just their name, so there's never more than one live input
// target on screen to mis-tap. Saving a set writes to the same state.logs array the
// standalone Log tab uses and bumps the rest timer. A "Finish workout" button ends the
// session; it doesn't require every exercise to be logged.
function GuidedRunView({
  run,
  state,
  updateState,
  exMap,
  allExercises,
  onSaved,
  onEditEntry,
  onDeleteEntry,
  onFinish,
  onExit,
  onMinimize,
  onDraftChange,
  onDraftDirty,
  persistStatus,
  onSwap,
  onAddExercise,
  onReopen,
  onLoggedSet,
  onRate,
  onAskCoach,
  onViewWorkout,
  onRename,
  onSaveTemporaryProfile,
  onUpdateSessionContext,
}) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [prByIndex, setPrByIndex] = useState({});
  const [addingExercise, setAddingExercise] = useState(false);
  // Redesigned workout share flow (task: "Redesign the workout share/export feature") — a full
  // preview modal with template/size/featured-lift choice, opened from the same "Share" action
  // this screen has always had. See components/WorkoutSharePreview.jsx.
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  // Travel/Alternate Gym mode (task Part 3, section 17) — "Active Workout → Session Options."
  const [sessionOptionsOpen, setSessionOptionsOpen] = useState(false);
  // "Save this machine profile" (task section 17) — a non-blocking, optional prompt shown right
  // on a just-finished exercise's collapsed summary when it was logged as a temporary/different
  // machine. Only one at a time and never forced; saving or dismissing never interrupts the rest
  // of the workout.
  const [savingProfileForIdx, setSavingProfileForIdx] = useState(null);
  // Naming is optional and never forced — a program day keeps its scheduled name (not
  // renamable here), but a blank/repeated off-program workout can be renamed at any point,
  // including right up to Finish Workout, without ever having been asked for a name up front.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(run.planName);
  // "Save as Workout Template" — offered only for a fresh custom build (run.source === "blank",
  // the "+ Create Workout for Today" path), never forced. Reuses the exact same state.customPlans
  // architecture BuildPlanTab's "Save plan" already writes to — no new save/template system.
  const [templateSaved, setTemplateSaved] = useState(false);
  const saveAsTemplate = () => {
    const plan = { id: `plan_${Date.now()}`, name: run.planName, exercises: run.exercises, isCustom: true };
    updateState((prev) => ({ ...prev, customPlans: [...(prev.customPlans || []), plan] }));
    setTemplateSaved(true);
  };
  const canRename = !run.programContext && !!onRename;
  const saveNameEdit = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== run.planName) onRename(trimmed);
    setEditingName(false);
  };
  const rirSystem = state.settings?.rirSystem || "rir";
  const isSimple = (state.settings?.trainingDetail || "advanced") === "simple";

  // Live elapsed-time clock for the Training Mode header — ticks off run.startedAt so it keeps
  // counting correctly even if the tab was backgrounded (no drift accumulation from setInterval).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (run.finished) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run.finished]);

  if (run.finished) {
    const summary = (state.workoutSessions || []).find((s) => s.id === run.summaryId) || null;
    // Auto Post-Workout Recap (task Part 1) — same buildWorkoutRecap engine the standalone
    // Workout History → Session → Recap screen uses (SessionRecapView), so the two surfaces
    // never disagree. Only the NEW pieces (progression wins/declines, quality/pain attention,
    // next-time targets, alternate-gym note) are appended here — the PR/best-lift/duration/
    // volume/rating/share content just below is this screen's own long-standing, already-
    // tested "Session complete" summary and is left as-is rather than risking a full rewrite.
    const recap = summary ? buildWorkoutRecap({ session: summary, logs: state.logs || [], exMap, state }) : null;
    return (
      <div className="space-y-5">
        <ScreenHeader eyebrow={run.planName} title="Session complete" />

        {summary && (
          <Card tone="accent" padding="p-5" className="space-y-3">
            {(() => {
              const { featured, others } = featuredAndOtherPRs(summary);
              if (featured) {
                const pr = featured.pr;
                // "New Profile PR" whenever this record only holds on the specific machine it
                // was logged on, not across every machine ever used for this exercise — see
                // PRCallout's identical scope check (task section 12).
                const isProfileScoped = pr.scope === "profile";
                const profileLabel = isProfileScoped ? equipmentDisplayLabel(state, pr.equipmentProfileId, null) : null;
                return (
                  <div className="space-y-1.5 pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <SectionLabel className="flex items-center gap-1.5">
                        <Award size={12} /> New {isProfileScoped ? "Profile " : ""}PR
                      </SectionLabel>
                      {others.length > 0 && (
                        <div className="text-[10px] uppercase tracking-widest text-v5-subtext">{others.length + 1} PRs</div>
                      )}
                    </div>
                    <div className="text-lg font-bold text-v5-text leading-tight">{exMap[featured.exId]?.name || featured.exId}</div>
                    {profileLabel && <div className="text-xs text-v5-subtext">{profileLabel}</div>}
                    <div className="text-3xl font-black text-v5-text leading-tight">{prHeroLabel(pr)}</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold">{PR_TYPE_LABEL[pr.type]}</div>
                      {/* Task section 7: the most prominent PR surface in the app must not present
                          a Pain/Form Breakdown-flagged PR as identical, unqualified evidence to a
                          clean one — Grind gets a softer "Grind" tag, Form Breakdown/Pain get an
                          explicit "flagged" tag. */}
                      {pr.qualityFlag && (
                        <span className="text-[9px] uppercase tracking-widest bg-v5-elevated text-v5-subtext px-1.5 py-0.5 rounded-full">
                          {pr.qualityFlag === "grind" ? SET_QUALITY_LABEL.grind : `${SET_QUALITY_LABEL[pr.qualityFlag]} flagged`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-v5-subtext">
                      Previous: {prPreviousLabel(pr)} <span className="text-v5-success font-bold">{prDeltaLabel(pr)}</span>
                    </div>
                    {others.length > 0 && (
                      <div className="pt-2 mt-1 border-t border-white/[0.06] space-y-1">
                        <div className="text-[10px] uppercase tracking-widest text-v5-subtext/70">Other PRs</div>
                        {others.map(({ exId, pr: op }) => (
                          <div key={exId} className="flex items-center justify-between text-xs text-v5-subtext gap-2">
                            <span className="truncate">
                              {exMap[exId]?.name || exId}
                              {op.qualityFlag && (
                                <span className="ml-1.5 text-[9px] uppercase tracking-widest text-v5-subtext/70">
                                  ({op.qualityFlag === "grind" ? SET_QUALITY_LABEL.grind : `${SET_QUALITY_LABEL[op.qualityFlag]} flagged`})
                                </span>
                              )}
                            </span>
                            <span className="text-v5-success font-bold shrink-0 ml-2">{prDeltaLabel(op)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (summary.bestLift) {
                return (
                  <div className="space-y-1 pb-3 border-b border-white/[0.06]">
                    <SectionLabel tone="muted">Best lift</SectionLabel>
                    <div className="text-lg font-bold text-v5-text leading-tight">{exMap[summary.bestLift.exId]?.name || summary.bestLift.exId}</div>
                    <div className="text-2xl font-black text-v5-text leading-tight">
                      {summary.bestLift.weight} × {summary.bestLift.reps}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Duration" value={formatSessionDuration(summary.durationSec)} />
              <StatTile label="Working sets" value={summary.workingSets} />
              <StatTile label="Volume" value={`${summary.totalVolume.toLocaleString()} lb${summary.isVolumePR ? " — PR" : ""}`} />
              <StatTile label="Total reps" value={summary.totalReps} />
            </div>

            {summary.perfDeltaPct != null && (
              <div className="text-sm text-v5-text/90">
                Performance vs last {summary.planName}:{" "}
                <span className={summary.perfDeltaPct >= 0 ? "text-v5-success font-bold" : "text-v5-red font-bold"}>
                  {summary.perfDeltaPct >= 0 ? "+" : ""}
                  {summary.perfDeltaPct}%
                </span>
              </div>
            )}
            {summary.avgRir != null && (
              <div className="text-sm text-v5-text/90">
                Average {rirSystem === "rpe" ? "RPE" : "RIR"}: {rirSystem === "rpe" ? Math.round((10 - summary.avgRir) * 10) / 10 : summary.avgRir}
              </div>
            )}
            {summary.mainMuscles.length > 0 && (
              <div className="text-sm text-v5-text/90">Main muscles trained: {summary.mainMuscles.join(", ")}</div>
            )}

            {/* Auto Post-Workout Recap additions (task Part 1) — progression per exercise,
                joint/pain + set-quality attention, and next-time targets, all computed by the
                same buildWorkoutRecap() the reopenable Workout History → Session → Recap screen
                uses. Tone matches the rest of this card: factual, no cheering. */}
            {recap?.alternateGym && (
              <div className="border-t border-white/[0.06] pt-3 space-y-1">
                <SectionLabel>Alternate gym session</SectionLabel>
                {recap.alternateGym.locationLabel && <div className="text-sm text-v5-text/90">{recap.alternateGym.locationLabel}</div>}
                <div className="text-xs text-v5-subtext">
                  {recap.alternateGym.differentEquipmentCount > 0
                    ? `${recap.alternateGym.differentEquipmentCount} exercise${
                        recap.alternateGym.differentEquipmentCount === 1 ? "" : "s"
                      } used different equipment. Direct load comparisons excluded where appropriate.`
                    : "No equipment differences flagged this session."}
                </div>
              </div>
            )}

            {recap?.wins.length > 0 && (
              <div className="border-t border-white/[0.06] pt-3 space-y-2">
                <SectionLabel tone="muted">Progression</SectionLabel>
                {recap.wins.map((w) => (
                  <div key={w.exId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-v5-subtext truncate">{w.name}</span>
                    <span className="text-v5-success font-bold text-xs shrink-0">{w.progression.message}</span>
                  </div>
                ))}
              </div>
            )}

            {recap?.attention.length > 0 && (
              <div className="border-t border-white/[0.06] pt-3 space-y-2.5">
                <SectionLabel tone="muted">Attention</SectionLabel>
                {recap.attention.map((e) => (
                  <div key={e.exId} className="space-y-0.5">
                    <div className="text-sm font-bold text-v5-text">{e.name}</div>
                    {e.painSummary && <div className="text-xs text-v5-red">{painSummaryLabel(e.painSummary)}</div>}
                    <div className="text-xs text-v5-subtext">
                      {[
                        e.qualityCounts.grind > 0 ? `${e.qualityCounts.grind} set${e.qualityCounts.grind === 1 ? "" : "s"} marked Grind` : null,
                        e.qualityCounts.form_breakdown > 0
                          ? `${e.qualityCounts.form_breakdown} set${e.qualityCounts.form_breakdown === 1 ? "" : "s"} marked Form Breakdown`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recap?.perExercise.some((e) => e.nextTime) && (
              <div className="border-t border-white/[0.06] pt-3 space-y-2.5">
                <SectionLabel tone="muted">Next time</SectionLabel>
                {recap.perExercise
                  .filter((e) => e.nextTime)
                  .map((e) => (
                    <div key={e.exId}>
                      <div className="text-sm font-bold text-v5-text">{e.name}</div>
                      <div className="text-sm text-v5-subtext">
                        {e.nextTime.weight != null ? `Try ${e.nextTime.weight} × ${e.nextTime.repsLabel}` : e.nextTime.reason}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {summary.coachMessage && (
              <div className="border-t border-white/[0.06] pt-3">
                <SectionLabel className="mb-1 flex items-center gap-1.5">
                  <MessageCircle size={11} /> Coach
                </SectionLabel>
                <div className="text-sm text-v5-text/90 whitespace-pre-line">{summary.coachMessage}</div>
                {onAskCoach && (
                  <ButtonText onClick={onAskCoach} className="mt-2">Ask Coach →</ButtonText>
                )}
              </div>
            )}

            <div>
              <SectionLabel tone="muted" className="mb-1.5">Rate this session</SectionLabel>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => onRate(summary.id, n)} className="p-0.5">
                    <Star size={20} className={n <= (summary.rating || 0) ? "text-v5-red fill-v5-red" : "text-v5-subtext/40"} />
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/[0.06] pt-3">
              <ButtonText tone="muted" icon={Share2} onClick={() => setSharePreviewOpen(true)}>Share</ButtonText>
            </div>
          </Card>
        )}

        {sharePreviewOpen && summary && (
          <WorkoutSharePreview session={summary} exMap={exMap} onClose={() => setSharePreviewOpen(false)} />
        )}

        {summary && onViewWorkout && (
          <ButtonSecondary onClick={() => onViewWorkout(summary.id)}>View Workout</ButtonSecondary>
        )}

        {run.source === "blank" && !run.programContext && (
          <button
            onClick={saveAsTemplate}
            disabled={templateSaved}
            className={`w-full py-3 rounded-xl text-xs uppercase tracking-widest font-bold ${
              templateSaved ? "bg-v5-success/10 text-v5-success cursor-default" : "bg-v5-elevated text-v5-subtext hover:text-v5-text"
            }`}
          >
            {templateSaved ? "Saved to My Plans ✓" : "Save as Workout Template"}
          </button>
        )}

        {run.sessionEntries.length > 0 ? (
          (() => {
            // "Baseline established" only means *this exercise* had no prior log before this
            // session, independent of PR status — an exercise's first-ever log can never be a
            // PR (detectPRs requires a prior entry to compare against), so the two tags never
            // collide on the same card.
            const sessionEntryIds = new Set(run.sessionEntries.map((se) => se.entry.id));
            const priorExIds = new Set((state.logs || []).filter((l) => !sessionEntryIds.has(l.id)).map((l) => l.exId));
            const prExIds = new Set((summary?.prs || []).map((p) => p.exId));
            return (
              <div className="space-y-1.5">
                {run.sessionEntries.map(({ entry }, i) => {
                  const hasPR = prExIds.has(entry.exId);
                  const isBaseline = !hasPR && !priorExIds.has(entry.exId);
                  return (
                    <Card key={entry.id || i} padding="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-v5-text flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{exMap[entry.exId]?.name || entry.exId}</span>
                          {hasPR && <Pill className="shrink-0">PR</Pill>}
                          {isBaseline && <Pill tone="inactive" className="shrink-0">Baseline</Pill>}
                        </span>
                        <span className="text-xs text-v5-subtext shrink-0">Target {entry.targetReps}</span>
                      </div>
                      <div className="text-xs text-v5-subtext mt-1">{entry.sets.map(formatSetCompact).join(", ")}</div>
                    </Card>
                  );
                })}
              </div>
            );
          })()
        ) : (
          <div className="text-sm text-v5-subtext">Nothing logged this session.</div>
        )}

        <ButtonSecondary
          icon={Plus}
          onClick={() => {
            onReopen();
            setAddingExercise(true);
          }}
        >
          Add exercise
        </ButtonSecondary>

        <ButtonPrimary size="lg" onClick={onExit}>Back to plans</ButtonPrimary>
      </div>
    );
  }

  const entryForIndex = (idx) => run.sessionEntries.find((se) => se.index === idx)?.entry || null;
  const currentIdx = run.exercises.findIndex((_, idx) => !entryForIndex(idx));

  // Superset/giant-set grouping: exercises carry an optional single-letter `group` (set in
  // Build Plan). Two or more *consecutive* plan entries sharing a letter render as A1/A2/A3
  // and share one rest window — logging a non-last member skips the rest timer entirely so
  // the flow is "log A1 -> log A2 -> rest -> repeat," not a rest after every single movement.
  const groupLabel = (idx) => {
    const g = run.exercises[idx].group;
    if (!g) return null;
    const prevSame = idx > 0 && run.exercises[idx - 1].group === g;
    const nextSame = idx < run.exercises.length - 1 && run.exercises[idx + 1].group === g;
    if (!prevSame && !nextSame) return null;
    let start = idx;
    while (start > 0 && run.exercises[start - 1].group === g) start--;
    return `${g}${idx - start + 1}`;
  };
  const isLastInGroup = (idx) => {
    const g = run.exercises[idx].group;
    if (!g) return true;
    return !(idx < run.exercises.length - 1 && run.exercises[idx + 1].group === g);
  };

  // Pre-workout advice, shown only before anything's been logged — once the session's under
  // way, per-exercise Recommended/Last-time cards already carry that context.
  let preWorkout = null;
  if (run.sessionEntries.length === 0 && run.exercises.length > 0) {
    const leadExId = run.swaps?.[0] ?? run.exercises[0].exId;
    const leadSuggestion = suggestNext(leadExId, state.logs, exMap, { readinessLogs: state.readinessLogs });
    const focus =
      leadSuggestion.suggestion != null
        ? {
            name: exMap[leadExId]?.name || leadExId,
            lastWeight: leadSuggestion.lastWeight,
            lastReps: leadSuggestion.lastReps,
            suggestedWeight: leadSuggestion.suggestion,
            suggestedReps: leadSuggestion.targetReps,
          }
        : null;
    preWorkout = generatePreWorkoutAdvice({ readiness: todayReadinessSummary(state) }, focus);
  }

  const totalExercises = run.exercises.length;
  const loggedCount = run.sessionEntries.length;
  const stepNumber = Math.min(currentIdx === -1 ? totalExercises : currentIdx + 1, totalExercises);
  const progressPct = totalExercises > 0 ? Math.round((loggedCount / totalExercises) * 100) : 0;
  const elapsedSec = Math.max(0, Math.round((nowTick - new Date(run.startedAt).getTime()) / 1000));
  const elapsedLabel = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* Overlay, not a view-swap: the active exercise's confirmed-but-not-yet-"Finish
          exercise"-locked sets live only in TrainingExerciseCard's local state, so navigating
          away by unmounting it here would silently drop them. Staying mounted underneath keeps
          in-progress sets intact no matter when mid-workout this gets opened. */}
      {addingExercise && (
        <div className="fixed inset-0 z-30 bg-v5-surface overflow-y-auto p-4 sm:p-6">
          <AddExercisePicker
            allExercises={allExercises}
            state={state}
            updateState={updateState}
            muscleGroups={MUSCLE_GROUPS}
            onBack={() => setAddingExercise(false)}
            onSelect={(exId) => {
              onAddExercise(exId);
              setAddingExercise(false);
            }}
          />
        </div>
      )}
      {sessionOptionsOpen && onUpdateSessionContext && (
        <div className="fixed inset-0 z-30 bg-v5-surface overflow-y-auto p-4 sm:p-6">
          <SessionOptionsSheet
            sessionContext={run.sessionContext}
            onChange={onUpdateSessionContext}
            onBack={() => setSessionOptionsOpen(false)}
          />
        </div>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {editingName ? (
              <input
                autoFocus
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={saveNameEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNameEdit();
                  if (e.key === "Escape") {
                    setNameDraft(run.planName);
                    setEditingName(false);
                  }
                }}
                className="w-full bg-v5-elevated rounded-lg text-v5-text text-sm font-bold px-2 py-1 focus:outline-none focus:ring-1 focus:ring-v5-red"
              />
            ) : (
              <button
                onClick={() => canRename && setEditingName(true)}
                disabled={!canRename}
                className="flex items-center gap-1.5 min-w-0 text-left"
              >
                <span className="text-lg font-bold text-v5-text truncate">{run.planName}</span>
                {canRename && <Pencil size={10} className="text-v5-subtext shrink-0" />}
              </button>
            )}
            <div className="text-sm text-v5-subtext mt-0.5">
              {totalExercises > 0 ? `Exercise ${stepNumber} of ${totalExercises} · ${elapsedLabel}` : `No exercises yet · ${elapsedLabel}`}
            </div>
            {/* Tiny, unobtrusive persistence indicator — never its own card, just a one-line
                honest status. "Saved" only ever reflects a write that actually succeeded (see the
                activeRun-persist effect in LiftLog); a genuine localStorage failure surfaces as
                "Not saved" here instead of a false "Saved". */}
            <div className="text-[10px] uppercase tracking-wide text-v5-subtext/70 mt-0.5 flex items-center gap-2">
              {persistStatus === "error" ? (
                <span className="text-v5-red">Not saved</span>
              ) : persistStatus === "saving" ? (
                "Saving…"
              ) : (
                "Saved ✓"
              )}
              {/* Travel/Alternate Gym mode entry point (task section 17) — "Active Workout →
                  Session Options." Quiet, secondary — never competes with Finish/Exit. */}
              {onUpdateSessionContext && (
                <button onClick={() => setSessionOptionsOpen(true)} className="text-v5-subtext/70 hover:text-v5-red normal-case tracking-normal">
                  · {run.sessionContext?.locationMode === "alternate_gym" ? run.sessionContext.locationLabel || "Alternate gym" : "Session options"}
                </button>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <button onClick={onMinimize} className="text-xs text-v5-subtext hover:text-v5-red">
              Exit
            </button>
            <button onClick={onFinish} className="text-xs uppercase tracking-widest font-bold text-v5-red hover:opacity-80">
              Finish
            </button>
          </div>
        </div>
        {persistStatus === "error" && (
          <div className="rounded-lg bg-v5-elevated px-3 py-2 text-xs text-v5-red">
            Workout changes could not be saved locally. Keep this tab open — your progress is only safe in memory right now.
          </div>
        )}
        {totalExercises > 0 && (
          <div className="h-1 bg-v5-muted rounded-full w-full overflow-hidden">
            <div className="h-1 bg-v5-red transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      {totalExercises === 0 && (
        <div className="py-10 text-center">
          <div className="text-sm text-v5-subtext">No exercises yet.</div>
          <div className="text-xs text-v5-subtext/70 mt-1">Tap + Add Exercise below to log your first movement.</div>
        </div>
      )}

      {/* Compact contextual insight, not a card competing with the workout itself — a thin red
          accent bar and one line of text, gone the moment something's actually logged (see
          preWorkout's own sessionEntries.length === 0 guard above). */}
      {preWorkout && (
        <div className="flex items-start gap-2 pl-2.5 border-l-2 border-v5-red/60">
          <span className="text-xs text-v5-subtext leading-snug">{preWorkout.message}</span>
        </div>
      )}

      <div className="space-y-8">
        {run.exercises.map((exSlot, idx) => {
          const currentExId = run.swaps?.[idx] ?? exSlot.exId;
          const entry = entryForIndex(idx);
          const isLogged = !!entry;
          const isEditing = editingIdx === idx;
          const isActive = !isLogged && idx === currentIdx;

          const label = groupLabel(idx);

          return (
            <div key={idx} className="border-t border-white/[0.06] pt-6 first:border-t-0 first:pt-0">
              {label && (
                <div className="text-[10px] uppercase tracking-widest text-v5-red font-bold mb-1.5">{label}</div>
              )}
              {isEditing ? (
                <EditLogEntryPanel
                  entry={entry}
                  exMap={exMap}
                  rirSystem={rirSystem}
                  simple={isSimple}
                  onBack={() => setEditingIdx(null)}
                  onSave={(changes) => {
                    const updatedEntry = { ...entry, ...changes };
                    updateState((prev) => ({
                      ...prev,
                      logs: prev.logs.map((l) => (l.id === entry.id ? updatedEntry : l)),
                    }));
                    onEditEntry(idx, updatedEntry);
                    setEditingIdx(null);
                  }}
                  onDelete={() => {
                    if (!window.confirm("Delete this logged entry? This can't be undone.")) return;
                    updateState((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== entry.id) }));
                    onDeleteEntry(idx);
                    setEditingIdx(null);
                  }}
                />
              ) : isLogged ? (
                // Collapsed to a summary, not every set re-listed — the full breakdown is one
                // tap away (Edit, or tapping the card itself) via the same shared edit panel
                // programmed workouts already use, so nothing about editing changed underneath.
                (() => {
                  const finishedTop = topSetOf(entry.sets);
                  const workingCount = countedSets(entry.sets).length;
                  return (
                    <div className="space-y-3">
                      <button onClick={() => setEditingIdx(idx)} className="w-full text-left flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-v5-text mb-1">
                            <Check size={14} className="text-v5-success shrink-0" />
                            <span className="truncate">{exMap[currentExId]?.name || currentExId}</span>
                          </div>
                          <div className="text-xs text-v5-subtext">
                            {workingCount} working set{workingCount === 1 ? "" : "s"} · Best {finishedTop.weight} × {finishedTop.reps} · Volume{" "}
                            {Math.round(entryVolume(entry)).toLocaleString()} lb
                          </div>
                        </div>
                        <span className="shrink-0 text-xs uppercase tracking-widest text-v5-red hover:opacity-80">Edit</span>
                      </button>
                      {prByIndex[idx] && <PRCallout exMap={exMap} exId={currentExId} prs={prByIndex[idx]} state={state} />}
                      {/* Optional, non-blocking — task section 17: a temporary/different-machine
                          entry can become real, comparable history without ever having required
                          a saved profile up front. */}
                      {entry.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT && onSaveTemporaryProfile && (
                        savingProfileForIdx === idx ? (
                          <AddEquipmentProfileForm
                            saveLabel="Save profile"
                            onSave={(label, gymLabel) => {
                              onSaveTemporaryProfile(idx, entry, label, gymLabel);
                              setSavingProfileForIdx(null);
                            }}
                            onCancel={() => setSavingProfileForIdx(null)}
                          />
                        ) : (
                          <button
                            onClick={() => setSavingProfileForIdx(idx)}
                            className="text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red"
                          >
                            Save this machine profile
                          </button>
                        )
                      )}
                    </div>
                  );
                })()
              ) : isActive ? (
                <TrainingExerciseCard
                  key={currentExId}
                  exId={currentExId}
                  exSlot={exSlot}
                  state={state}
                  updateState={updateState}
                  exMap={exMap}
                  allExercises={allExercises}
                  onSaved={(savedEntry) => {
                    const prs = detectPRs(currentExId, savedEntry, state.logs);
                    if (prs.length > 0) setPrByIndex((m) => ({ ...m, [idx]: prs }));
                    onSaved(idx, savedEntry);
                  }}
                  onSwap={(newExId) => onSwap(idx, newExId)}
                  sessionContext={run.sessionContext}
                  exIndex={idx}
                  totalExercises={totalExercises}
                  onSetSaved={(justSaved) => {
                    // Mid-group (e.g. still on A1 of an A1/A2 pair): no rest, straight into the
                    // next movement. Rest only starts once the group's last exercise logs a set,
                    // and uses the "superset" default rather than this one exercise's own
                    // compound/isolation category. Within a solo exercise (or the group's last
                    // member), every individual saved set now bumps rest, not just the whole
                    // exercise at once. The just-saved weight/reps ride along so the compact
                    // rest timer can show "Next: 245 x 8" — the same numbers as the set that was
                    // just logged, since that's what the athlete will most likely repeat.
                    if (isLastInGroup(idx)) {
                      onLoggedSet?.(
                        label ? "superset" : { exId: currentExId, nextWeight: justSaved?.weight, nextReps: justSaved?.reps }
                      );
                    }
                  }}
                  draft={run.draftByIndex?.[idx]}
                  onDraftChange={(draft) => onDraftChange?.(idx, draft)}
                  onDraftDirty={onDraftDirty}
                />
              ) : (
                <div className="text-base font-medium text-v5-subtext">{exMap[currentExId]?.name || currentExId}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 pt-1">
        {/* Ghost/outlined, not a solid filled block — ranks below Save Set at a glance, exactly
            like Finish Workout below it, rather than reading as another primary button. */}
        <button
          onClick={() => setAddingExercise(true)}
          className="w-full py-2.5 rounded-lg text-xs uppercase tracking-widest font-bold border border-v5-muted text-v5-subtext hover:text-v5-text hover:border-v5-subtext/50 flex items-center justify-center gap-1.5"
        >
          <Plus size={14} /> Add exercise
        </button>

        {/* Outlined rather than solid-fill red — Save Set (inside the active set card above) is
            the one dominant CTA on screen while a set is being logged; Finish Workout stays a
            strong, unmistakably red action without visually tying with it for attention. */}
        <button
          onClick={onFinish}
          className="w-full py-3 rounded-lg text-xs uppercase tracking-widest font-bold border border-v5-red/70 text-v5-red hover:bg-v5-red hover:text-white mt-1"
        >
          Finish workout
        </button>
      </div>
    </div>
  );
}

// ---------------- EDIT CARDIO ENTRY ----------------
// Same idea as EditLogEntryPanel but for cardio's distance/duration/load/notes shape.
// Edits flow back through state.cardioLogs, so bestCardioStat recomputes automatically.
function EditCardioEntryPanel({ entry, exMap, onBack, onSave, onDelete }) {
  const [distance, setDistance] = useState(entry.distance != null ? String(entry.distance) : "");
  const [distanceUnit, setDistanceUnit] = useState(entry.distanceUnit || "mi");
  const [duration, setDuration] = useState(entry.duration != null ? String(entry.duration) : "");
  const [load, setLoad] = useState(entry.load != null ? String(entry.load) : "");
  const [notes, setNotes] = useState(entry.notes || "");

  const canSave = distance !== "" || duration !== "";

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      distance: distance !== "" ? Number(distance) : null,
      distanceUnit,
      duration: duration !== "" ? Number(duration) : null,
      load: load !== "" ? Number(load) : null,
      notes: notes.trim(),
    });
  };

  return (
    <SlideInPanel
      title={exMap[entry.exId]?.name || entry.exId}
      subtitle={new Date(entry.date).toLocaleDateString()}
      onBack={onBack}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Distance</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0"
              className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
            />
            <select
              value={distanceUnit}
              onChange={(e) => setDistanceUnit(e.target.value)}
              className="bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-xs focus:outline-none focus:border-v5-red"
            >
              <option value="mi">mi</option>
              <option value="yd">yd</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="0"
            className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Load — sled/ruck only (lb)</label>
        <input
          type="number"
          value={load}
          onChange={(e) => setLoad(e.target.value)}
          placeholder="Optional"
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How it felt, route, weather, etc."
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-v5-red border-v5-red text-white hover:opacity-90"
            : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"
        }`}
      >
        Save changes
      </button>
      <button
        onClick={onDelete}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-subtext hover:text-v5-red hover:border-v5-red/25 flex items-center justify-center gap-1.5"
      >
        <Trash2 size={14} /> Delete entry
      </button>
    </SlideInPanel>
  );
}

// ---------------- CARDIO TAB ----------------
function CardioTab({ state, updateState, allExercises, exMap, onLoggedSet, onNavigate }) {
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
  const [editingEntryId, setEditingEntryId] = useState(null);

  if (conditioningExercises.length === 0) {
    return (
      <div className="text-center py-16 text-v5-subtext text-sm">
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
    updateState((prev) => ({ ...prev, cardioLogs: [entry, ...(prev.cardioLogs || [])], hasSeenOnboarding: true }));
    onLoggedSet?.("conditioning");
    setDistance("");
    setDuration("");
    setLoad("");
    setNotes("");
  };

  if (editingEntryId) {
    const entry = cardioLogs.find((l) => l.id === editingEntryId);
    if (!entry) {
      return (
        <SlideInPanel title="Entry not found" onBack={() => setEditingEntryId(null)}>
          <div className="text-sm text-v5-subtext">This entry no longer exists.</div>
        </SlideInPanel>
      );
    }
    return (
      <EditCardioEntryPanel
        entry={entry}
        exMap={exMap}
        onBack={() => setEditingEntryId(null)}
        onSave={(changes) => {
          updateState((prev) => ({
            ...prev,
            cardioLogs: (prev.cardioLogs || []).map((l) => (l.id === editingEntryId ? { ...l, ...changes } : l)),
          }));
          setEditingEntryId(null);
        }}
        onDelete={() => {
          if (!window.confirm("Delete this logged entry? This can't be undone.")) return;
          updateState((prev) => ({ ...prev, cardioLogs: (prev.cardioLogs || []).filter((l) => l.id !== editingEntryId) }));
          setEditingEntryId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => onNavigate?.("intervalTimer")}
        className="w-full flex items-center justify-between border border-white/10 bg-v5-elevated p-4 hover:border-v5-red/40"
      >
        <div className="flex items-center gap-3 text-left">
          <Timer size={18} className="text-v5-subtext shrink-0" />
          <div>
            <div className="text-base font-bold text-white">Interval Timer</div>
            <div className="text-xs text-v5-subtext mt-0.5">Alternate timed work and recovery intervals automatically.</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-v5-subtext/70 shrink-0" />
      </button>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Run / conditioning work</label>
        <select
          value={currentExId}
          onChange={(e) => setSelectedExId(e.target.value)}
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red"
        >
          {conditioningExercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {(lastEntry || best) && (
        <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Where you stand</div>
          {best && (
            <div className="text-3xl font-bold text-white">
              Best {best.type === "pace" ? "pace" : "distance"}: {best.value}
              {best.type === "pace" ? " /mi" : ""}
            </div>
          )}
          {lastEntry && (
            <div className="text-sm text-v5-subtext">
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
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Distance</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0"
              className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
            />
            <select
              value={distanceUnit}
              onChange={(e) => setDistanceUnit(e.target.value)}
              className="bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-xs focus:outline-none focus:border-v5-red"
            >
              <option value="mi">mi</option>
              <option value="yd">yd</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Duration (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="0"
            className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Load — sled/ruck only (lb)</label>
        <input
          type="number"
          value={load}
          onChange={(e) => setLoad(e.target.value)}
          placeholder="Optional"
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-base focus:outline-none focus:border-v5-red"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How it felt, route, weather, etc."
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
      </div>

      <button
        onClick={saveEntry}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave
            ? "bg-v5-red border-v5-red text-white hover:opacity-90"
            : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"
        }`}
      >
        Save session
      </button>

      {recentForEx.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">History</div>
          <div className="space-y-1.5">
            {recentForEx.map((l) => {
              const pace = cardioPace(l);
              return (
                <button
                  key={l.id}
                  onClick={() => setEditingEntryId(l.id)}
                  className="w-full text-xs border-b border-white/[0.06] py-2 text-left hover:border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-v5-subtext">{new Date(l.date).toLocaleDateString()}</span>
                    <span className="text-sm text-v5-text/90">
                      {l.distance ? `${l.distance} ${l.distanceUnit}` : ""}
                      {l.distance && l.duration ? " · " : ""}
                      {l.duration ? `${l.duration} min` : ""}
                      {pace ? ` · ${formatPace(pace)} /mi` : ""}
                      {l.load ? ` · ${l.load} lb` : ""}
                    </span>
                  </div>
                  {l.notes && <div className="text-v5-subtext/70 mt-1 text-left">{l.notes}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- TEMPLATES TAB ----------------
// formatSetPrescription now lives in utils/exercisePrescription.js so TrainTab.jsx (the
// workout/day preview) can share the exact same formatting instead of reimplementing it.

function TemplatesTab({ state, updateState, exMap, onStartRun, onStartRecovery, onLogManualRecovery, onRestartCompletedProgram, onGoToBuild, onViewWorkout }) {
  const [detail, setDetail] = useState(null); // { kind: "program" | "template" | "customPlan" | "customProgram", id }
  // Frequency-aware program picker (Part 2) — selectedDays starts from the athlete's saved
  // preference (or a pending review's proposed frequency) but is local UI state, never written
  // back to the profile just by browsing. reviewCompare only exists while the athlete arrived via
  // the "Review New Plan" banner below, driving the Current -> Proposed framing in the picker and
  // the program detail panel; it's cleared on Keep/back-out and never mutates currentProgram.
  const [selectedDays, setSelectedDays] = useState(() => state.pendingFrequencyReview?.toDays ?? state.athleteProfile?.preferredDays ?? null);
  const [reviewCompare, setReviewCompare] = useState(null); // { fromDays, toDays } | null
  // Program-detail frequency switcher (Part 1) — lets an athlete preview a sibling weekly
  // variant of the SAME program family (e.g. Titan at 4 days instead of 3) inline, without
  // navigating away or touching currentProgram. Keyed by the originally-opened program's id so
  // opening a different program always starts from that program's own content, not a stale
  // preview. Never applied until the athlete explicitly taps Start on the previewed day.
  const [familyPreview, setFamilyPreview] = useState(null); // { baseId, days } | null

  const pendingReview = state.pendingFrequencyReview;
  const dismissPendingReview = () => updateState((prev) => ({ ...prev, pendingFrequencyReview: null }));
  const openReview = () => {
    if (!pendingReview) return;
    setSelectedDays(pendingReview.toDays);
    setReviewCompare({ fromDays: pendingReview.fromDays, toDays: pendingReview.toDays });
    dismissPendingReview();
  };

  const deleteCustomPlan = (id) => updateState((prev) => ({ ...prev, customPlans: prev.customPlans.filter((p) => p.id !== id) }));
  const deleteCustomProgram = (id) =>
    updateState((prev) => ({ ...prev, customPrograms: (prev.customPrograms || []).filter((p) => p.id !== id) }));

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
  const isCurrentCustom = (progId) => state.currentProgram?.source === "custom" && state.currentProgram.programId === progId;
  const isCompleteCustom = (progId) => isCurrentCustom(progId) && currentProgramDay?.isComplete;
  // Manually corrects which day the active program is parked on — for when it's drifted from
  // where the athlete actually is (e.g. dayIndex already advanced past a day before this
  // tracking existed, or a day was skipped/repeated outside the normal finish-a-workout flow).
  // Unlike "Start workout," this doesn't log anything — it just repoints the Today card.
  const setCurrentProgramDay = (di) => {
    updateState((prev) => ({
      ...prev,
      // A manual permanent repoint supersedes any one-day swap override that might still be
      // sitting around — otherwise the override could point somewhere stale relative to the
      // newly repointed day.
      programDayOverride: null,
      currentProgram: { ...prev.currentProgram, dayIndex: di, lastCompletedAt: null, lastCompletedDayIndex: null },
    }));
  };

  // A day's completion status is derived by matching its plan name against workoutSessions —
  // there's no programId/dayIndex stored on the session itself (see buildSessionSummary), only
  // the exact name it was started under, which onStartRun always sets to `${program} — ${day}`.
  const dayCompletionRow = (planName) => {
    const session = findMostRecentSessionForPlan(state.workoutSessions, planName);
    if (!session) return null;
    return (
      <div className="flex items-center justify-between text-xs text-v5-subtext pt-1.5 mt-1.5 border-t border-white/[0.06]">
        <span>Completed {new Date(session.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        {onViewWorkout && (
          <button onClick={() => onViewWorkout(session.id)} className="text-[11px] uppercase tracking-widest text-v5-red hover:text-v5-red flex items-center gap-1">
            View Workout <ChevronRight size={11} />
          </button>
        )}
      </div>
    );
  };
  // Same idea as dayCompletionRow above but for a recovery-type program day — reads
  // state.recoverySessions instead of state.workoutSessions (never the same collection).
  const recoveryCompletionRow = (planName) => {
    const session = findMostRecentSessionForPlan(state.recoverySessions, planName);
    if (!session) return null;
    return (
      <div className="text-xs text-v5-subtext pt-1.5 mt-1.5 border-t border-white/[0.06]">
        Completed {new Date(session.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
    );
  };
  // Renders one recovery-type program day's row — label/badges identical to a lifting day's, but
  // the body is a routine summary + Start Recovery Session / Log Recovery Session instead of an
  // exercise list (recovery movements are never forced into ExerciseAnatomyRow's lifting-set
  // prescription format). Shared by the built-in and custom program detail screens below.
  const recoveryDayRow = (prog, day, di, programContext) => {
    const routine = recoveryRoutineById(day.routineId);
    const minutes = routine ? Math.round(routine.movements.reduce((s, m) => s + (m.durationSeconds || (m.reps || 0) * 3) * (m.sets || 1), 0) / 60) : 0;
    return (
      <div key={di} className="border-t border-white/[0.06] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-v5-red flex items-center gap-1.5">
            {day.label}
            {isCurrent(prog.id) && state.currentProgram.dayIndex === di && (
              <span className="text-[9px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Next up</span>
            )}
          </span>
          {isCurrent(prog.id) && state.currentProgram.dayIndex !== di && (
            <button onClick={() => setCurrentProgramDay(di)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
              Set as today
            </button>
          )}
        </div>
        <div className="text-xs text-v5-subtext mb-2">{routine ? `${routine.movements.length} movements · Est. ${minutes} min` : "Recovery routine"}</div>
        <div className="flex gap-3">
          <button
            onClick={() => onStartRecovery(routine, programContext)}
            className="text-[11px] text-v5-red hover:text-v5-red flex items-center gap-1"
          >
            <ChevronRight size={11} /> Start Recovery Session
          </button>
          <button onClick={() => onLogManualRecovery(routine, programContext)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
            Log Recovery Session
          </button>
        </div>
        {recoveryCompletionRow(`${prog.name} — ${day.label}`)}
      </div>
    );
  };

  if (detail?.kind === "customPlan") {
    const p = state.customPlans.find((pl) => pl.id === detail.id);
    if (!p) return null;
    return (
      <SlideInPanel title={p.name} subtitle={`${p.exercises.length} exercises`} onBack={() => setDetail(null)}>
        <div>
          {p.exercises.map((e, i) => (
            <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} group={e.group} prescription={formatSetPrescription(e)} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(p)} className="text-xs text-v5-red hover:text-v5-red flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button
            onClick={() => {
              if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
              deleteCustomPlan(p.id);
              setDetail(null);
            }}
            className="text-xs text-v5-subtext hover:text-v5-red flex items-center gap-1"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </SlideInPanel>
    );
  }

  if (detail?.kind === "customProgram") {
    const prog = (state.customPrograms || []).find((pr) => pr.id === detail.id);
    if (!prog) return null;
    return (
      <SlideInPanel
        title={prog.name}
        subtitle={prog.weeks ? `${prog.days.length} days · ${prog.weeks} weeks` : `${prog.days.length} days`}
        onBack={() => setDetail(null)}
      >
        {prog.days.map((day, di) => (
          <div key={di} className="border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-v5-red flex items-center gap-1.5">
                {day.label}
                {isCurrentCustom(prog.id) && state.currentProgram.dayIndex === di && (
                  <span className="text-[9px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Next up</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                {isCurrentCustom(prog.id) && state.currentProgram.dayIndex !== di && (
                  <button onClick={() => setCurrentProgramDay(di)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
                    Set as today
                  </button>
                )}
                <button
                  onClick={() =>
                    onStartRun(
                      { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                      { programId: prog.id, programName: prog.name, source: "custom", dayIndex: di, totalDays: prog.days.length }
                    )
                  }
                  className="text-[11px] text-v5-red hover:text-v5-red flex items-center gap-1"
                >
                  <ChevronRight size={11} /> Start workout
                </button>
              </div>
            </div>
            <div>
              {day.exercises.map((e, i) => (
                <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
              ))}
            </div>
            {dayCompletionRow(`${prog.name} — ${day.label}`)}
          </div>
        ))}
        <button
          onClick={() => {
            if (!window.confirm(`Delete "${prog.name}"? This can't be undone.`)) return;
            deleteCustomProgram(prog.id);
            setDetail(null);
          }}
          className="text-xs text-v5-subtext hover:text-v5-red flex items-center gap-1"
        >
          <Trash2 size={12} /> Delete program
        </button>
      </SlideInPanel>
    );
  }

  if (detail?.kind === "program") {
    const baseProg = (state.programs || []).find((p) => p.id === detail.id);
    if (!baseProg) return null;
    // Sibling frequency variants of the same program family (Titan/Athena/Shape today — see
    // programFamilies.js), keyed by day count. Switching the chip below only changes what `prog`
    // resolves to for THIS render — a local preview, never applied until Start is tapped.
    const siblings = baseProg.familyId ? familyVariants(baseProg.familyId, state.programs) : {};
    const previewDays = familyPreview?.baseId === detail.id ? familyPreview.days : null;
    const prog = (previewDays && siblings[previewDays]) || baseProg;
    const switchPreview = (n) => {
      setFamilyPreview({ baseId: detail.id, days: n });
      if (reviewCompare) setReviewCompare((r) => ({ ...r, toDays: n }));
    };
    return (
      <SlideInPanel
        title={baseProg.name}
        subtitle={prog.weeks ? `${prog.tagline} · ${prog.weeks} weeks` : prog.tagline}
        onBack={() => setDetail(null)}
      >
        {isCurrent(prog.id) &&
          (() => {
            const adherence = programWeekAdherence(state);
            if (!adherence || adherence.recovery.scheduled === 0) return null;
            return (
              <div className="border border-white/10 bg-v5-elevated px-4 py-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-widest text-v5-subtext">
                  {prog.name.toUpperCase()} — TRAILING {adherence.windowDays} DAYS
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-v5-subtext">Strength sessions</span>
                  <span className="text-white font-bold">
                    {adherence.lifting.completed} / {adherence.lifting.scheduled}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-v5-subtext">Recovery sessions</span>
                  <span className="text-white font-bold">
                    {adherence.recovery.completed} / {adherence.recovery.scheduled}
                  </span>
                </div>
              </div>
            );
          })()}
        {Object.keys(siblings).length > 1 && (
          <div className="border border-white/10 bg-v5-elevated px-4 py-3 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-v5-subtext">
              {prog.trainingDays} {prog.trainingDays === 1 ? "Day" : "Days"} / Week
            </div>
            <div className="flex gap-1.5">
              {[2, 3, 4, 5, 6].map((n) => {
                const variant = siblings[n];
                if (!variant) return null;
                const active = variant.id === prog.id;
                return (
                  <button
                    key={n}
                    onClick={() => switchPreview(n)}
                    aria-pressed={active}
                    className={`flex-1 py-2 text-xs font-bold border ${
                      active ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-v5-subtext/70">
              Previewing {baseProg.name} at {prog.trainingDays} days/week — tap Start on a day below to actually switch to it.
            </p>
          </div>
        )}
        {reviewCompare && (
          <div className="border border-v5-red/25 bg-v5-elevated px-4 py-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-v5-subtext/70">Current → Proposed</div>
            <div className="text-sm text-v5-text/90">
              <span className="text-v5-subtext">{state.currentProgram?.programName || "No active program"}</span>
              {` (${reviewCompare.fromDays} days) → `}
              <span className="text-white font-bold">{prog.name}</span>
              {` (${prog.days.length} days)`}
            </div>
            <div className="text-xs text-v5-subtext">Approximate weekly volume: {totalWeeklySets(prog)} sets across {prog.days.length} sessions</div>
            <button
              onClick={() => {
                setReviewCompare(null);
                setDetail(null);
              }}
              className="text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-text/90"
            >
              Keep current plan instead
            </button>
          </div>
        )}
        <button
          onClick={() => copyProgramToCustom(prog)}
          className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30 flex items-center justify-center gap-1.5"
        >
          <Plus size={12} /> Add to my program
        </button>
        {prog.days.map((day, di) =>
          day.type === "recovery" ? (
            recoveryDayRow(prog, day, di, { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: di, totalDays: prog.days.length })
          ) : (
            <div key={di} className="border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-v5-red flex items-center gap-1.5">
                  {day.label}
                  {isCurrent(prog.id) && state.currentProgram.dayIndex === di && (
                    <span className="text-[9px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Next up</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {isCurrent(prog.id) && state.currentProgram.dayIndex !== di && (
                    <button onClick={() => setCurrentProgramDay(di)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
                      Set as today
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReviewCompare(null);
                      onStartRun(
                        { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                        { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: di, totalDays: prog.days.length }
                      );
                    }}
                    className="text-[11px] text-v5-red hover:text-v5-red flex items-center gap-1"
                  >
                    <ChevronRight size={11} /> {reviewCompare ? "Apply — Start" : "Start workout"}
                  </button>
                  <button
                    onClick={() => copyDayToCustom(prog, day)}
                    className="text-[11px] text-v5-subtext hover:text-v5-red flex items-center gap-1"
                  >
                    <Plus size={11} /> Copy to my plans
                  </button>
                </div>
              </div>
              <div>
                {day.exercises.map((e, i) => (
                  <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
                ))}
              </div>
              {dayCompletionRow(`${prog.name} — ${day.label}`)}
            </div>
          )
        )}
      </SlideInPanel>
    );
  }

  if (detail?.kind === "template") {
    const tpl = state.templates.find((t) => t.id === detail.id);
    if (!tpl) return null;
    return (
      <SlideInPanel title={tpl.name} onBack={() => setDetail(null)}>
        <div>
          {tpl.exercises.map((e, i) => (
            <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(tpl)} className="text-xs text-v5-red hover:text-v5-red flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button onClick={() => copyToCustom(tpl)} className="text-xs text-v5-subtext hover:text-v5-red flex items-center gap-1">
            <Plus size={12} /> Copy to my plans
          </button>
        </div>
      </SlideInPanel>
    );
  }

  return (
    <div className="space-y-6">
      <ScreenHeader
        eyebrow="Plans & programs"
        title="Browse everything"
        right={onGoToBuild && <ButtonText icon={Plus} onClick={onGoToBuild}>Create plan</ButtonText>}
      />

      {/* Shown only while pendingFrequencyReview is set — i.e. only right after the athlete
          changed Planned Training Days while a program was active (see AthleteProfileForm.save()).
          Both actions dismiss it; only Review New Plan also opens the frequency-filtered picker
          below pre-set to the new day count. currentProgram is untouched either way until the
          athlete explicitly starts a different program day from that picker. */}
      {pendingReview && (
        <HeroCard>
          <div className="text-sm text-v5-text/90">
            You changed your planned training frequency from <span className="font-bold text-v5-text">{pendingReview.fromDays}</span> to{" "}
            <span className="font-bold text-v5-text">{pendingReview.toDays}</span> days per week.
          </div>
          <div className="text-xs text-v5-subtext">Would you like BRK to adapt your current program?</div>
          <div className="flex gap-2">
            <ButtonPrimary size="sm" onClick={openReview} className="flex-1">
              Review {pendingReview.toDays}-Day Version
            </ButtonPrimary>
            <ButtonSecondary size="sm" onClick={dismissPendingReview} className="flex-1">
              Keep Current Program
            </ButtonSecondary>
          </div>
        </HeroCard>
      )}

      {state.customPlans.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>My plans</SectionLabel>
          <div className="space-y-2">
            {state.customPlans.map((p) => (
              // Two independent tap targets (open detail vs. jump straight to Start) — kept as
              // sibling buttons inside a plain (non-button) Card, never a button nested inside
              // ListRow's own button, which the HTML spec disallows.
              <Card key={p.id} className="flex items-center justify-between gap-3">
                <button onClick={() => setDetail({ kind: "customPlan", id: p.id })} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-bold text-v5-text truncate">{p.name}</div>
                  <div className="text-xs text-v5-subtext mt-0.5">{p.exercises.length} exercises</div>
                </button>
                <ButtonText icon={ChevronRight} onClick={() => onStartRun(p)} className="shrink-0">
                  Start
                </ButtonText>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(state.customPrograms || []).length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>My programs</SectionLabel>
          <div className="space-y-2">
            {state.customPrograms.map((prog) => (
              <ListRow
                key={prog.id}
                onClick={() => setDetail({ kind: "customProgram", id: prog.id })}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{prog.name}</span>
                    {isCompleteCustom(prog.id) ? (
                      <Pill tone="inactive">Complete</Pill>
                    ) : (
                      isCurrentCustom(prog.id) && <Pill>Current</Pill>
                    )}
                  </span>
                }
                subtitle={`${prog.days.length} days${prog.weeks ? ` · ${prog.weeks} weeks` : ""}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Frequency-aware picker (Part 2) — "available days -> best-fit split," not "force the
          same split into N days." Built-in/custom programs matching the selected day count are
          grouped Recommended/Other Options; day counts with no concrete match yet (2/4/5/6 today)
          fall back to structure guidance instead of fabricating a program. Nothing here is
          hidden — the full "All Programs" list below is unaffected and still shows everything
          regardless of day count. */}
      <div className="space-y-2.5">
        <SectionLabel>Find a program for your schedule</SectionLabel>
        {reviewCompare && (
          <div className="text-xs text-v5-subtext border-l-2 border-v5-red pl-2.5">
            Current: <span className="text-v5-text/90">{state.currentProgram?.programName || "No active program"}</span> (
            {reviewCompare.fromDays} days) → Proposed: {reviewCompare.toDays} days
          </div>
        )}
        <TrainingDaysSelector
          label="How many days can you train?"
          value={selectedDays}
          onChange={(d) => {
            setSelectedDays(d);
            if (reviewCompare) setReviewCompare((r) => ({ ...r, toDays: d }));
          }}
        />
        {selectedDays != null &&
          (() => {
            // While reviewing a frequency change (or just browsing with an active builtin
            // program), bias "Recommended" toward the athlete's OWN program family — e.g.
            // someone on 5-day Titan who drops to 3 days sees "Titan — 3-Day Version"
            // recommended first, not an unrelated program.
            const activeFamilyId =
              state.currentProgram?.source === "builtin"
                ? (state.programs || []).find((p) => p.id === state.currentProgram.programId)?.familyId
                : null;
            const rec = recommendationFor(selectedDays, {
              programs: state.programs,
              customPrograms: state.customPrograms,
              preferFamilyId: activeFamilyId,
            });
            const guidance = FREQUENCY_GUIDANCE[selectedDays];
            const programRow = (p, isRecommended) => (
              <ListRow
                key={p.id}
                tone={isRecommended ? "accent" : "default"}
                onClick={() => setDetail({ kind: p.source === "custom" ? "customProgram" : "program", id: p.id })}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{p.name}</span>
                    {isRecommended && <Pill>Recommended</Pill>}
                  </span>
                }
                subtitle={`${p.tagline}${p.weeks ? ` · ${p.weeks} weeks` : ""}`}
              />
            );
            return (
              <div className="space-y-3">
                {guidance?.warning && (
                  <div className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">{guidance.note}</div>
                )}
                {rec.recommended && (
                  <div className="space-y-1.5">
                    <SectionLabel tone="muted">Recommended</SectionLabel>
                    {programRow(rec.recommended, true)}
                  </div>
                )}
                {rec.others.length > 0 && (
                  <div className="space-y-1.5">
                    <SectionLabel tone="muted">Other Options</SectionLabel>
                    {rec.others.map((p) => programRow(p, false))}
                  </div>
                )}
                {rec.matches.length === 0 && guidance && !guidance.warning && (
                  <Card className="space-y-2 text-xs text-v5-subtext">
                    <div>
                      No built-in program at {selectedDays} days yet. Recommended structure: {guidance.structure.join(" / ")}.
                    </div>
                    <div className="text-v5-subtext/70">{guidance.note}</div>
                    {onGoToBuild && <ButtonText onClick={onGoToBuild}>Build one from scratch →</ButtonText>}
                  </Card>
                )}
              </div>
            );
          })()}
      </div>

      {/* "Recommended for you" hero + a compact grid for the rest (mockup section 7) — the
          featured pick is never a fabricated category, just the most personally relevant real
          program: the athlete's own active program if they have one, otherwise the best match
          for their stated training frequency, otherwise BRK's flagship. Every stat shown
          (days/week, weeks, tagline) reads straight off the program's own real fields. */}
      {(() => {
        const all = state.programs || [];
        if (all.length === 0) return null;
        const activeFamilyId = state.currentProgram?.source === "builtin" ? all.find((p) => p.id === state.currentProgram.programId)?.familyId : null;
        let featured = state.currentProgram?.source === "builtin" ? all.find((p) => p.id === state.currentProgram.programId) : null;
        if (!featured) {
          const prefDays = state.athleteProfile?.preferredDays ?? selectedDays;
          if (prefDays != null) featured = recommendationFor(prefDays, { programs: all, customPrograms: [], preferFamilyId: activeFamilyId }).recommended;
        }
        if (!featured) featured = all[0];
        const others = all.filter((p) => p.id !== featured.id);
        const daysPerWeek = (prog) => prog.trainingDays || prog.days?.length || null;
        return (
          <>
            <div className="space-y-2.5">
              <SectionLabel>Recommended for you</SectionLabel>
              <PhotoHero
                exercise={exMap[featured.days?.[0]?.exercises?.[0]?.exId]}
                eyebrow={featured.tagline}
                title={featured.name}
                meta={
                  <div className="flex items-center gap-4 text-xs font-bold text-v5-subtext">
                    {daysPerWeek(featured) && (
                      <span className="flex items-center gap-1.5"><ClipboardList size={13} className="text-v5-red" /> {daysPerWeek(featured)} Days/Week</span>
                    )}
                    {featured.weeks && (
                      <span className="flex items-center gap-1.5"><Timer size={13} className="text-v5-red" /> {featured.weeks} weeks</span>
                    )}
                    {isComplete(featured.id) ? <Pill tone="inactive">Complete</Pill> : isCurrent(featured.id) && <Pill>Current</Pill>}
                  </div>
                }
              >
                <ButtonPrimary size="lg" onClick={() => setDetail({ kind: "program", id: featured.id })}>
                  View program
                </ButtonPrimary>
              </PhotoHero>
            </div>

            {others.length > 0 && (
              <div className="space-y-2.5">
                <SectionLabel tone="muted">Other programs</SectionLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  {others.map((prog) => (
                    <Card key={prog.id} onClick={() => setDetail({ kind: "program", id: prog.id })} padding="p-3.5" className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-v5-text truncate">{prog.name}</span>
                        {isComplete(prog.id) ? <Pill tone="inactive">Done</Pill> : isCurrent(prog.id) && <Pill>Current</Pill>}
                      </div>
                      <div className="text-[11px] text-v5-subtext line-clamp-2">{prog.tagline}</div>
                      <div className="text-[10px] font-bold text-v5-subtext/70 flex items-center gap-2 pt-0.5">
                        {daysPerWeek(prog) && <span>{daysPerWeek(prog)} Days/Week</span>}
                        {prog.weeks && <span>· {prog.weeks} wks</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      <div className="space-y-2.5">
        <SectionLabel tone="muted">Single day templates</SectionLabel>
        <p className="text-xs text-v5-subtext">Standard split templates. Copy one into your own plans to customize it.</p>
        <div className="space-y-2">
          {state.templates.map((tpl) => (
            <ListRow key={tpl.id} title={tpl.name} onClick={() => setDetail({ kind: "template", id: tpl.id })} />
          ))}
        </div>
      </div>

      {(state.completedPrograms || []).length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel tone="muted">Completed programs</SectionLabel>
          <p className="text-xs text-v5-subtext">Every program you've finished — earned, not reset silently.</p>
          <div className="space-y-2">
            {state.completedPrograms.map((c) => (
              // Plain (non-button) Card — its only action is the sibling Restart button, so
              // there's no outer click target competing with it.
              <Card key={c.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-v5-text truncate">{c.programName}</div>
                  <div className="text-xs text-v5-subtext mt-0.5">
                    {c.weeks} weeks · {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                  </div>
                </div>
                <ButtonText icon={ChevronRight} onClick={() => onRestartCompletedProgram(c.programId, c.programSource)} className="shrink-0">
                  Restart
                </ButtonText>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- BUILD PLAN TAB ----------------
function BuildPlanTab({ state, updateState, allExercises, exMap, onStartRun, onGoToPlans }) {
  const [planName, setPlanName] = useState("");
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [exFilter, setExFilter] = useState("");
  const [supersetMode, setSupersetMode] = useState(false);
  const [supersetPicks, setSupersetPicks] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [creatingCustom, setCreatingCustom] = useState(false);

  const selectableAll = useMemo(() => selectableExercises(allExercises), [allExercises]);
  const filteredExercises = useMemo(() => {
    const q = exFilter.trim().toLowerCase();
    if (!q) return selectableAll;
    return selectableAll.filter((ex) => matchesExerciseSearch(ex, q));
  }, [exFilter, selectableAll]);

  const addExercise = (exId) => {
    if (selectedExercises.some((e) => e.exId === exId)) return;
    setSelectedExercises((s) => [...s, { exId, sets: 3, reps: 10, group: "" }]);
    setJustSaved(false);
  };
  const removeExercise = (exId) => {
    setSelectedExercises((s) => s.filter((e) => e.exId !== exId));
    setSupersetPicks((p) => p.filter((id) => id !== exId));
  };
  const updateExercise = (exId, field, val) =>
    setSelectedExercises((s) => s.map((e) => (e.exId === exId ? { ...e, [field]: field === "group" ? val : Number(val) } : e)));

  // Simplified superset creation: pick 2+ exercises already added to the plan, tap "Create
  // superset" once, and they're grouped under the next free letter and moved next to each
  // other in the plan order — the raw group-letter text field is gone, but the underlying
  // single-letter `group` field GuidedRunView reads is unchanged.
  const toggleSupersetPick = (exId) =>
    setSupersetPicks((picks) => (picks.includes(exId) ? picks.filter((id) => id !== exId) : [...picks, exId]));
  const createSuperset = () => {
    if (supersetPicks.length < 2) return;
    const used = new Set(selectedExercises.map((e) => e.group).filter(Boolean));
    let letter = "A";
    for (let i = 0; i < 26; i++) {
      const c = String.fromCharCode(65 + i);
      if (!used.has(c)) {
        letter = c;
        break;
      }
    }
    const pickedSet = new Set(supersetPicks);
    const grouped = selectedExercises.filter((e) => pickedSet.has(e.exId)).map((e) => ({ ...e, group: letter }));
    const next = [];
    let inserted = false;
    selectedExercises.forEach((e) => {
      if (pickedSet.has(e.exId)) {
        if (!inserted) {
          next.push(...grouped);
          inserted = true;
        }
      } else {
        next.push(e);
      }
    });
    setSelectedExercises(next);
    setSupersetPicks([]);
    setSupersetMode(false);
  };
  const ungroup = (exId) => updateExercise(exId, "group", "");

  const savePlan = () => {
    if (!planName.trim() || selectedExercises.length === 0) return;
    const plan = { id: `plan_${Date.now()}`, name: planName.trim(), exercises: selectedExercises, isCustom: true };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, plan] }));
    setPlanName("");
    setSelectedExercises([]);
    setJustSaved(true);
  };

  if (creatingCustom) {
    return (
      <CustomExerciseForm
        state={state}
        updateState={updateState}
        allExercises={allExercises}
        muscleGroups={MUSCLE_GROUPS}
        onBack={() => setCreatingCustom(false)}
        onSaved={(exId) => {
          addExercise(exId);
          setCreatingCustom(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Create plan</div>
          <div className="text-xl font-bold text-white mt-1">Build a workout</div>
        </div>
        {onGoToPlans && (
          <button onClick={onGoToPlans} className="shrink-0 text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            My plans →
          </button>
        )}
      </div>

      {justSaved && (
        <div className="border border-v5-red/25 bg-v5-elevated px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-v5-text/90">Plan saved.</div>
          {onGoToPlans && (
            <button onClick={onGoToPlans} className="text-xs uppercase tracking-widest text-v5-red hover:text-v5-red flex items-center gap-1">
              <ChevronRight size={12} /> View my plans
            </button>
          )}
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Plan name</label>
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="e.g. Fat loss phase - upper focus"
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Add exercises</label>
        <input
          type="text"
          value={exFilter}
          onChange={(e) => setExFilter(e.target.value)}
          placeholder="Search the catalog..."
          className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-xs mb-2 focus:outline-none focus:border-v5-red"
        />
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-white/[0.06] p-2">
          {filteredExercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => addExercise(ex.id)}
              disabled={selectedExercises.some((e) => e.exId === ex.id)}
              className={`text-left text-xs px-2 py-1.5 border ${
                selectedExercises.some((e) => e.exId === ex.id)
                  ? "border-v5-red/40 text-v5-red bg-v5-red/30"
                  : "border-white/[0.06] text-v5-subtext hover:border-white/10"
              }`}
            >
              {ex.name}
            </button>
          ))}
          {filteredExercises.length === 0 && (
            <div className="col-span-2 text-xs text-v5-subtext/70 py-2 text-center">No match — create it below.</div>
          )}
        </div>
        <button
          onClick={() => setCreatingCustom(true)}
          className="w-full mt-2 py-2 text-xs uppercase tracking-widest font-bold border border-dashed border-white/10 text-v5-red hover:border-v5-red hover:text-v5-red flex items-center justify-center gap-1.5"
        >
          <Plus size={13} /> Create custom exercise
        </button>
      </div>

      {selectedExercises.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] uppercase tracking-widest text-v5-subtext">Plan exercises</label>
            {selectedExercises.length >= 2 && !supersetMode && (
              <button
                onClick={() => setSupersetMode(true)}
                className="text-[11px] uppercase tracking-widest text-v5-red hover:text-v5-red"
              >
                Group as superset
              </button>
            )}
          </div>

          {supersetMode && (
            <div className="border border-v5-red/25 bg-v5-elevated p-3 space-y-2">
              <div className="text-xs text-v5-subtext">Select 2 or more exercises to superset, then confirm.</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={createSuperset}
                  disabled={supersetPicks.length < 2}
                  className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                    supersetPicks.length >= 2
                      ? "bg-v5-red border-v5-red text-white hover:opacity-90"
                      : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"
                  }`}
                >
                  Create superset ({supersetPicks.length})
                </button>
                <button
                  onClick={() => {
                    setSupersetMode(false);
                    setSupersetPicks([]);
                  }}
                  className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {selectedExercises.map((e) => (
            <div key={e.exId} className="border border-white/[0.06] px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                {supersetMode && (
                  <input
                    type="checkbox"
                    checked={supersetPicks.includes(e.exId)}
                    onChange={() => toggleSupersetPick(e.exId)}
                    className="shrink-0 w-4 h-4 accent-red-700"
                  />
                )}
                <span className="flex-1 min-w-0 text-base text-v5-text/90 truncate">{exMap[e.exId]?.name}</span>
                {e.group && !supersetMode && (
                  <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-red-900/40 text-v5-red px-1.5 py-0.5">
                    Superset {e.group}
                    <button onClick={() => ungroup(e.exId)} className="hover:text-white">
                      <X size={10} />
                    </button>
                  </span>
                )}
                {!supersetMode && (
                  <button onClick={() => removeExercise(e.exId)} className="shrink-0 text-v5-subtext/70 hover:text-v5-red">
                    <X size={14} />
                  </button>
                )}
              </div>
              {!supersetMode && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="number"
                    value={e.sets}
                    onChange={(ev) => updateExercise(e.exId, "sets", ev.target.value)}
                    className="w-14 bg-v5-elevated border border-white/10 text-v5-text px-2 py-1 text-xs"
                  />
                  <span className="text-v5-subtext/70 text-xs">sets</span>
                  <input
                    type="number"
                    value={e.reps}
                    onChange={(ev) => updateExercise(e.exId, "reps", ev.target.value)}
                    className="w-14 bg-v5-elevated border border-white/10 text-v5-text px-2 py-1 text-xs"
                  />
                  <span className="text-v5-subtext/70 text-xs">reps</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {onStartRun && (
          <button
            onClick={() =>
              onStartRun({
                name: planName.trim() || "Workout Today",
                exercises: selectedExercises,
                source: "blank",
              })
            }
            disabled={selectedExercises.length === 0}
            className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
              selectedExercises.length > 0
                ? "bg-v5-red border-v5-red text-white hover:opacity-90"
                : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"
            }`}
          >
            Start workout
          </button>
        )}
        <button
          onClick={savePlan}
          disabled={!planName.trim() || selectedExercises.length === 0}
          className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
            planName.trim() && selectedExercises.length > 0
              ? "bg-v5-elevated border-v5-red text-v5-red hover:bg-v5-red/30"
              : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"
          }`}
        >
          Save plan
        </button>
      </div>
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
      <div className="text-center py-16 text-v5-subtext text-sm">
        No sessions logged yet. Log a workout and this tab tracks what you actually train most.
      </div>
    );
  }

  const max = ranked[0].count;

  return (
    <div className="space-y-3">
      <p className="text-xs text-v5-subtext">Ranked by how often you've logged each lift.</p>
      {ranked.map((r, i) => (
        <div key={r.ex.id} className="border border-white/10 bg-v5-elevated px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {i === 0 && <Star size={12} className="text-v5-red" />}
              <span className="text-base text-white">{r.ex.name}</span>
            </div>
            <span className="text-xs text-v5-subtext">{r.count}x</span>
          </div>
          <div className="h-1 bg-v5-surface">
            <div className="h-1 bg-v5-red" style={{ width: `${(r.count / max) * 100}%` }} />
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
  const [showArchived, setShowArchived] = useState(false);
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allExercises.filter((ex) => {
      if (isArchived(ex) && !showArchived) return false;
      const matchesQuery = !q || matchesExerciseSearch(ex, q);
      const matchesMuscle = muscleFilter === "All" || ex.muscle === muscleFilter;
      return matchesQuery && matchesMuscle;
    });
  }, [query, muscleFilter, allExercises, showArchived]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((ex) => {
      if (!groups[ex.muscle]) groups[ex.muscle] = [];
      groups[ex.muscle].push(ex);
    });
    return groups;
  }, [filtered]);

  if (creatingCustom) {
    return (
      <CustomExerciseForm
        state={state}
        updateState={updateState}
        allExercises={allExercises}
        muscleGroups={MUSCLE_GROUPS}
        onBack={() => setCreatingCustom(false)}
        onSaved={() => setCreatingCustom(false)}
      />
    );
  }
  if (editingExercise) {
    return (
      <CustomExerciseForm
        state={state}
        updateState={updateState}
        allExercises={allExercises}
        muscleGroups={MUSCLE_GROUPS}
        exercise={editingExercise}
        onBack={() => setEditingExercise(null)}
        onSaved={() => setEditingExercise(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-v5-subtext">
        Every movement and machine in the library. Can't find something you use — add it once and it shows up
        everywhere you pick an exercise.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          className="flex-1 bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
        <select
          value={muscleFilter}
          onChange={(e) => setMuscleFilter(e.target.value)}
          className="bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-xs focus:outline-none focus:border-v5-red"
        >
          <option value="All">All</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-v5-subtext">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived custom exercises
      </label>

      <button
        onClick={() => setCreatingCustom(true)}
        className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30 flex items-center justify-center gap-1.5"
      >
        <Plus size={14} /> Create custom exercise
      </button>

      <div className="space-y-5">
        {Object.entries(grouped).map(([muscle, exs]) => (
          <div key={muscle}>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">{muscle}</div>
            <div className="space-y-1.5">
              {exs.map((ex) => (
                <div
                  key={ex.id}
                  className={`flex items-center justify-between text-sm border bg-v5-elevated px-3 py-2 ${
                    isArchived(ex) ? "border-white/[0.06] opacity-50" : "border-white/[0.06]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-base text-v5-text/90 truncate">{ex.name}</div>
                    {ex.custom && (
                      <div className="text-[10px] uppercase tracking-wider text-v5-subtext/70 mt-0.5 truncate">
                        {formatCustomLabel(ex)}
                        {isArchived(ex) ? " • Archived" : ""}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!ex.custom && <span className="text-[10px] uppercase tracking-wider text-v5-subtext/70">{ex.type}</span>}
                    {ex.custom && (
                      <button onClick={() => setEditingExercise(ex)} className="text-v5-subtext/70 hover:text-v5-red">
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-v5-subtext/70 text-sm">No matches — create it above.</div>
        )}
      </div>
    </div>
  );
}

// ---------------- PHOTOS ----------------
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load image"));
    img.src = src;
  });
}

const PROGRESS_PHOTO_MAX_DIM = 1080;
const PROGRESS_PHOTO_QUALITY = 0.7;

// Resizes to a max dimension, then burns the BREAK_LOGO watermark and a date/context
// caption directly into the pixel data (not a CSS overlay) so the branding survives
// wherever the photo gets shared, and compresses to JPEG to keep localStorage usage sane.
async function compositeProgressPhoto(file, contextLine) {
  const objectUrl = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const scale = Math.min(1, PROGRESS_PHOTO_MAX_DIM / Math.max(img.width, img.height));
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const lines = contextLine ? [contextLine, dateStr] : [dateStr];

  const padding = Math.round(width * 0.035);
  const fontSize = Math.max(13, Math.round(width * 0.034));
  const lineHeight = Math.round(fontSize * 1.35);
  const logoSize = Math.round(width * 0.13);
  const barHeight = Math.max(lines.length * lineHeight + padding * 1.5, logoSize + padding * 2);

  const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.68)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height - barHeight, width, barHeight);

  // Watermark logo, bottom-right, clipped to a circle with a red ring
  try {
    const logo = await loadImage(BREAK_LOGO);
    const logoX = width - padding - logoSize;
    const logoY = height - padding - logoSize;
    ctx.save();
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    ctx.restore();
    ctx.strokeStyle = "rgba(220,38,38,0.9)";
    ctx.lineWidth = Math.max(1, logoSize * 0.045);
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  } catch (e) {
    // logo failed to load — still burn the text caption below
  }

  // Date + context caption, bottom-left
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "bottom";
  let ty = height - padding;
  for (let i = lines.length - 1; i >= 0; i--) {
    const isPrimary = i === 0 && lines.length > 1;
    ctx.font = `${isPrimary ? "bold " : ""}${Math.round(isPrimary ? fontSize : fontSize * 0.82)}px sans-serif`;
    ctx.fillText(lines[i], padding, ty);
    ty -= lineHeight;
  }

  return canvas.toDataURL("image/jpeg", PROGRESS_PHOTO_QUALITY);
}

function PhotoFullView({ photo, onBack, onDelete }) {
  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    setShareSupported(typeof navigator.share === "function");
  }, []);

  const handleShare = async () => {
    try {
      const res = await fetch(photo.dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `brk-lift-${photo.date.slice(0, 10)}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "BRK - Lift progress photo" });
      } else {
        await navigator.share({ title: "BRK - Lift progress photo", text: photo.context || "" });
      }
    } catch (e) {
      // user cancelled the share sheet, or sharing failed — nothing to do
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = photo.dataUrl;
    a.download = `brk-lift-${photo.date.slice(0, 10)}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <SlideInPanel title="Progress photo" subtitle={new Date(photo.date).toLocaleString()} onBack={onBack}>
      <img src={photo.dataUrl} alt="Progress" className="w-full border border-white/10" />
      {photo.context && <div className="text-xs text-v5-subtext">{photo.context}</div>}
      <div className="flex items-center gap-2">
        {shareSupported ? (
          <button
            onClick={handleShare}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5"
          >
            <Share2 size={14} /> Share
          </button>
        ) : (
          <button
            onClick={handleDownload}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> Download
          </button>
        )}
        <button
          onClick={onDelete}
          className="py-3 px-4 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-text/90 hover:border-v5-red/40 flex items-center justify-center gap-1.5"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </SlideInPanel>
  );
}

// ---------------- PHOTOS TAB ----------------
function PhotosTab({ state, updateState }) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [viewingId, setViewingId] = useState(null);

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);
  const photos = state.photos || [];

  const handleTakePhoto = () => {
    setErrorMsg(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const contextLine =
        currentProgramDay && !currentProgramDay.isComplete
          ? `${currentProgramDay.programName} — ${currentProgramDay.dayLabel}`
          : null;
      const dataUrl = await compositeProgressPhoto(file, contextLine);
      const photo = { id: `photo_${Date.now()}`, date: new Date().toISOString(), context: contextLine, dataUrl };
      let quotaError = false;
      updateState((prev) => {
        const next = { ...prev, photos: [photo, ...(prev.photos || [])] };
        try {
          window.localStorage.setItem("liftlog-data", JSON.stringify(next));
        } catch (err) {
          quotaError = true;
          return prev;
        }
        return next;
      });
      if (quotaError) {
        setErrorMsg("Couldn't save that photo — you're out of local storage space. Delete some older photos and try again.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Couldn't process that photo. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const deletePhoto = (id) => {
    updateState((prev) => ({ ...prev, photos: (prev.photos || []).filter((p) => p.id !== id) }));
    setViewingId(null);
  };

  if (viewingId) {
    const photo = photos.find((p) => p.id === viewingId);
    if (!photo) return null;
    return <PhotoFullView photo={photo} onBack={() => setViewingId(null)} onDelete={() => deletePhoto(photo.id)} />;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={handleTakePhoto}
        disabled={busy}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Camera size={16} /> {busy ? "Processing..." : "Take progress photo"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        className="hidden"
      />
      {errorMsg && <div className="text-xs text-v5-red">{errorMsg}</div>}

      {photos.length === 0 ? (
        <div className="text-center py-16 text-v5-subtext text-sm">
          No progress photos yet. Take one to start tracking visually over time.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setViewingId(p.id)}
              className="aspect-square overflow-hidden border border-white/10 bg-v5-elevated"
            >
              <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- SETTINGS TAB ----------------
// The only backup mechanism available, since everything lives in localStorage with no
// server. Export/import cover every piece of user-created data — logs, cardio logs,
// custom exercises, custom plans and programs, and which program is currently active —
// not just workout logs.
function notificationPermissionState() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

function SettingsTab({ state, updateState, onNavigate }) {
  const fileInputRef = useRef(null);
  const [importMessage, setImportMessage] = useState(null); // { type: "error" | "success", text }
  // Section 10 — tracked as real state (not read fresh every render) so requesting permission
  // from the Enable button updates this screen immediately without needing a remount.
  const [notifPermission, setNotifPermission] = useState(notificationPermissionState);
  const requestRestTimerAlerts = async () => {
    // Only ever called from this button's onClick — a direct user gesture, never on load
    // (section 6). Browsers refuse/ignore a requestPermission() call made outside one anyway.
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
    } catch {
      setNotifPermission(notificationPermissionState());
    }
  };

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
        // hasSeenOnboarding isn't backup data (it's a local "is this device set up" flag), but
        // a deliberate restore is never a fresh install — without this, importing real history
        // into a blank browser profile would still show the welcome screen until the next
        // full page reload triggers the same retroactive check loadInitialState() runs.
        next.hasSeenOnboarding = true;
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
    photos: (state.photos || []).length,
    completedPrograms: (state.completedPrograms || []).length,
    goals: (state.goals || []).length,
    bodyweightLogs: (state.bodyweightLogs || []).length,
  };

  const settings = { rirSystem: "rir", restDefaults: DEFAULT_REST_DEFAULTS, barWeight: 45, ...(state.settings || {}) };
  const updateSettings = (patch) => updateState((prev) => ({ ...prev, settings: { ...(prev.settings || {}), ...patch } }));
  const updateRestDefault = (category, val) =>
    updateSettings({ restDefaults: { ...(settings.restDefaults || DEFAULT_REST_DEFAULTS), [category]: Number(val) || 0 } });

  return (
    <div className="space-y-6">
      <div className="border border-white/10 bg-v5-elevated p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Training</div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Effort tracking</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ rirSystem: "rir" })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                settings.rirSystem !== "rpe" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              RIR
            </button>
            <button
              onClick={() => updateSettings({ rirSystem: "rpe" })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                settings.rirSystem === "rpe" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              RPE
            </button>
          </div>
          <p className="text-xs text-v5-subtext/70 mt-1.5">Reps in reserve (0–5+) or rate of perceived exertion (6–10), logged per set.</p>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Rest timer defaults (seconds)</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["compound", "Compound"],
              ["isolation", "Isolation"],
              ["conditioning", "Conditioning"],
              ["superset", "Superset"],
            ].map(([key, label]) => (
              <div key={key}>
                <div className="text-[10px] text-v5-subtext/70 mb-1">{label}</div>
                <input
                  type="number"
                  value={(settings.restDefaults || DEFAULT_REST_DEFAULTS)[key]}
                  onChange={(e) => updateRestDefault(key, e.target.value)}
                  className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Barbell weight</label>
          <div className="flex gap-2 items-center">
            {[45, 35].map((w) => (
              <button
                key={w}
                onClick={() => updateSettings({ barWeight: w })}
                className={`px-4 py-2 text-xs font-bold border ${
                  settings.barWeight === w ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                }`}
              >
                {w} lb
              </button>
            ))}
            <input
              type="number"
              value={settings.barWeight}
              onChange={(e) => updateSettings({ barWeight: Number(e.target.value) || 0 })}
              placeholder="Custom"
              className="w-24 bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
          </div>
        </div>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Rest Timer Alerts</div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-v5-text/90">Rest timer sound</div>
            <div className="text-xs text-v5-subtext/70">Plays a beep when rest ends, while BRK is open.</div>
          </div>
          <div className="flex gap-1.5 shrink-0 ml-3">
            <button
              onClick={() => updateSettings({ restTimerSound: true })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerSound !== false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              ON
            </button>
            <button
              onClick={() => updateSettings({ restTimerSound: false })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerSound === false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              OFF
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-v5-text/90">Vibration</div>
          <div className="flex gap-1.5 shrink-0 ml-3">
            <button
              onClick={() => updateSettings({ restTimerVibration: true })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerVibration !== false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              ON
            </button>
            <button
              onClick={() => updateSettings({ restTimerVibration: false })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerVibration === false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              OFF
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-v5-text/90">Background alerts</div>
            {notifPermission === "granted" && (
              <div className="flex gap-1.5 shrink-0 ml-3">
                <button
                  onClick={() => updateSettings({ restTimerBackgroundAlerts: true })}
                  className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerBackgroundAlerts !== false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
                >
                  ON
                </button>
                <button
                  onClick={() => updateSettings({ restTimerBackgroundAlerts: false })}
                  className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerBackgroundAlerts === false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
                >
                  OFF
                </button>
              </div>
            )}
          </div>
          {notifPermission === "default" && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-v5-subtext">BRK can notify you when your rest timer ends while your phone is locked or you're using another app.</p>
              <button onClick={requestRestTimerAlerts} className="px-4 py-2 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
                Enable
              </button>
            </div>
          )}
          {notifPermission === "denied" && <p className="text-xs text-v5-subtext/70 mt-1">OFF — Notification permission denied</p>}
          {notifPermission === "unsupported" && <p className="text-xs text-v5-subtext/70 mt-1">Not supported in this browser. Foreground sound still works.</p>}
        </div>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Data &amp; Privacy</div>
        <button
          onClick={() => onNavigate?.("dataWorkbook")}
          className="w-full flex items-center justify-between border border-white/10 p-3 hover:border-v5-red/40"
        >
          <div className="text-left flex items-center gap-3">
            <FileSpreadsheet size={18} className="text-v5-subtext shrink-0" />
            <div>
              <div className="text-sm font-bold text-white">My Data Workbook</div>
              <div className="text-xs text-v5-subtext mt-0.5">Review, filter, and export the fitness data BRK has collected.</div>
            </div>
          </div>
          <ChevronRight size={18} className="text-v5-subtext/70 shrink-0" />
        </button>
      </div>

      <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Data backup</div>
          <p className="text-xs text-v5-subtext mt-1">
            Everything is stored on this device only — there's no account or server. Export a backup before
            switching phones or clearing browser data, and import it to restore.
          </p>
        </div>

        <div className="text-xs text-v5-subtext space-y-1">
          <div>{counts.logs} lift logs</div>
          <div>{counts.cardioLogs} run / conditioning logs</div>
          <div>{counts.customExercises} custom exercises</div>
          <div>{counts.customPlans} custom plans</div>
          <div>{counts.customPrograms} custom programs</div>
          <div>{counts.photos} progress photos</div>
          <div>{counts.completedPrograms} completed programs</div>
          <div>{counts.goals} goals</div>
          <div>{counts.bodyweightLogs} bodyweight entries</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleExport}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> Export data
          </button>
          <button
            onClick={handleImportClick}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-text/90 hover:border-v5-red/40 flex items-center justify-center gap-1.5"
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
          <div className={`text-xs ${importMessage.type === "error" ? "text-v5-red" : "text-green-500"}`}>
            {importMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}
