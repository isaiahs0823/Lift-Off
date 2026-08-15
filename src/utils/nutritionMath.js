// ---------------- NUTRITION MATH ----------------
// Turns a nutrition profile + current bodyweight into a starting estimate — explicitly an
// estimate (section 5): Mifflin-St Jeor has real error bars against any individual's actual
// metabolism. This is a starting point for observed data to correct, not a verdict.

import { latestValue } from "./bodyweightMath.js";

const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

export function lbToKg(lb) {
  return lb / LB_PER_KG;
}
export function inToCm(inches) {
  return inches * CM_PER_IN;
}

// Mifflin-St Jeor — the most widely validated resting-energy equation for a general fitness
// population (more accurate than Harris-Benedict for most people). Requires weight(kg),
// height(cm), age(years); the +5/-161 offset is sex-specific. "unspecified"/missing sex
// defaults to the male offset — a documented, disclosed simplification, not a guess dressed
// up as precision.
export function estimateBMR({ sex, weightKg, heightCm, age }) {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "female" ? base - 161 : base + 5);
}

const OCCUPATION_MULTIPLIER = { sedentary: 1.2, light: 1.35, moderate: 1.5, very_active: 1.65 };

// Occupation sets the base (how much of the day is spent moving regardless of training), then
// resistance + cardio sessions bump it — deliberately coarse (this is an estimate feeding a
// system that corrects itself from real bodyweight trend data, not a lab-grade TDEE model).
export function estimateTDEE(profile, weightLbs) {
  const weightKg = lbToKg(weightLbs);
  const heightCm = inToCm(profile.heightIn);
  const bmr = estimateBMR({ sex: profile.sex, weightKg, heightCm, age: profile.age });
  if (!bmr) return null;
  const occMultiplier = OCCUPATION_MULTIPLIER[profile.occupationActivity || "light"];
  const resistanceBump = Math.min(profile.resistanceFrequency || 0, 6) * 0.02;
  const cardioBump = Math.min(profile.cardioFrequency || 0, 6) * ((profile.cardioDurationMin || 30) >= 45 ? 0.018 : 0.012);
  const multiplier = occMultiplier + resistanceBump + cardioBump;
  return Math.round(bmr * multiplier);
}

// Deliberately conservative, sustainable ranges — not the fastest theoretical rate. Extreme
// asks get moderated here rather than in the UI copy alone (section 29).
export const GOAL_ADJUSTMENT_PCT = {
  fat_loss: -0.2,
  recomposition: -0.08,
  maintenance: 0,
  performance: 0,
  muscle_gain: 0.12,
};

// Protein target scales with goal, not just bodyweight — a cut needs more protein per pound
// to defend muscle in a deficit than a maintenance phase does.
const PROTEIN_G_PER_LB = {
  fat_loss: 1.0,
  recomposition: 0.95,
  muscle_gain: 0.85,
  maintenance: 0.8,
  performance: 0.85,
};
const FAT_PCT_OF_CALORIES = 0.25;
const FAT_FLOOR_G_PER_LB = 0.3; // hormonal-health floor, independent of the calorie-derived number

// weightLbs should be the athlete's current logged bodyweight (bodyweightLogs), not a
// self-reported number from the assessment — same reasoning as resolveNutritionProfile's
// comment: one source of truth for weight.
export function calculateNutritionTargets(profile, weightLbs) {
  const estimatedMaintenance = estimateTDEE(profile, weightLbs);
  if (!estimatedMaintenance || !weightLbs) return null;

  const goal = profile.primaryGoal || "maintenance";
  const adjustmentPct = GOAL_ADJUSTMENT_PCT[goal] ?? 0;
  let calories = Math.round(estimatedMaintenance * (1 + adjustmentPct));

  // Safety floor — never recommend below a level that's unsafe regardless of how aggressive
  // the requested timeline is (section 29: Coach isn't a compliance bot).
  const floor = profile.sex === "female" ? 1200 : 1500;
  calories = Math.max(calories, floor);

  const proteinPerLb = PROTEIN_G_PER_LB[goal] ?? 0.8;
  const protein = Math.round(weightLbs * proteinPerLb);
  const proteinCalories = protein * 4;

  let fat = Math.round((calories * FAT_PCT_OF_CALORIES) / 9);
  const fatFloor = Math.round(weightLbs * FAT_FLOOR_G_PER_LB);
  fat = Math.max(fat, fatFloor);
  const fatCalories = fat * 9;

  const remainingCalories = Math.max(0, calories - proteinCalories - fatCalories);
  const carbs = Math.round(remainingCalories / 4);

  return {
    estimatedMaintenance,
    calories,
    protein,
    carbs,
    fat,
    goal,
    method: "mifflin_st_jeor",
  };
}

// Sanity check that protein/carb/fat calories approximately reconcile with the calorie target
// (section 6) — used in tests and available to Coach's "why" explanation, not shown by default.
export function macroCalorieCheck(targets) {
  if (!targets) return null;
  const derived = targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
  return { derivedCalories: derived, diff: derived - targets.calories };
}

export function currentBodyweightLbs(state) {
  return latestValue(state.bodyweightLogs || [], "weight");
}
