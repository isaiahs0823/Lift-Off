// ---------------- NUTRITION ADHERENCE ----------------
// Range-based, not exact-match (section 17): a day counts as "on plan" if calories land in a
// reasonable band around target and protein clears a minimum threshold — never "hit every
// macro exactly." Only days with an actual log count toward the percentage; a day with no
// entries is missing data, not automatically a miss, so adherence isn't silently punished by
// gaps in logging habits it isn't measuring.

import { dailyTotals, todayDateKey } from "./nutrition.js";

const CALORIE_BAND_PCT = 0.1; // within ±10% of target counts as "on plan"
const PROTEIN_MIN_PCT = 0.9; // at least 90% of target protein counts as "hit"

function dateKeysInWindow(days, asOf = new Date()) {
  const keys = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(asOf);
    d.setDate(d.getDate() - i);
    keys.push(todayDateKey(d));
  }
  return keys;
}

export function dayAdherence(foodLogs, targets, dateKey) {
  const totals = dailyTotals(foodLogs, dateKey);
  const logged = (foodLogs || []).some((f) => f.date === dateKey);
  if (!logged || !targets) return { logged, totals, caloriesOnPlan: null, proteinHit: null };
  const calLow = targets.calories * (1 - CALORIE_BAND_PCT);
  const calHigh = targets.calories * (1 + CALORIE_BAND_PCT);
  const caloriesOnPlan = totals.calories >= calLow && totals.calories <= calHigh;
  const proteinHit = totals.protein >= targets.protein * PROTEIN_MIN_PCT;
  return { logged, totals, caloriesOnPlan, proteinHit };
}

// A day is "on plan" only when both calories land in the band AND protein clears the floor —
// hitting protein while wildly over on calories, or vice versa, isn't real adherence.
export function rollingNutritionAdherence(state, days = 7, asOf = new Date()) {
  const targets = state.nutritionTargets;
  const foodLogs = state.foodLogs || [];
  if (!targets) return { pct: null, loggedDays: 0, onPlanDays: 0, avgCalories: null, avgProtein: null };

  const keys = dateKeysInWindow(days, asOf);
  let loggedDays = 0;
  let onPlanDays = 0;
  let calorieSum = 0;
  let proteinSum = 0;

  keys.forEach((key) => {
    const { logged, totals, caloriesOnPlan, proteinHit } = dayAdherence(foodLogs, targets, key);
    if (!logged) return;
    loggedDays++;
    calorieSum += totals.calories;
    proteinSum += totals.protein;
    if (caloriesOnPlan && proteinHit) onPlanDays++;
  });

  return {
    pct: loggedDays > 0 ? Math.round((onPlanDays / loggedDays) * 100) : null,
    loggedDays,
    onPlanDays,
    avgCalories: loggedDays > 0 ? Math.round(calorieSum / loggedDays) : null,
    avgProtein: loggedDays > 0 ? Math.round(proteinSum / loggedDays) : null,
  };
}
