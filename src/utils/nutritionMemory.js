// ---------------- NUTRITION COACH MEMORY DETECTORS ----------------
// Section 33: nutrition-specific patterns for the same persisted Coach-memory system
// coachMemory.js already runs (Layer 3 — evolving, observed facts). Same rule as every other
// detector in this codebase: real sample-size gates, never a claim from a handful of days.

import { dailyTotals } from "./nutrition.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_LOGGED_DAYS = 14;

function loggedDateKeys(foodLogs, days = 30) {
  const cutoff = Date.now() - days * MS_PER_DAY;
  const keys = new Set();
  (foodLogs || []).forEach((f) => {
    if (new Date(f.date).getTime() >= cutoff) keys.add(f.date);
  });
  return [...keys];
}

function isWeekend(dateKey) {
  const day = new Date(dateKey + "T12:00:00").getDay();
  return day === 0 || day === 6;
}

// "Weekend intake tends to exceed target" (section 33 example) — compares average logged
// calories on weekend vs. weekday days against the actual target, not just against each other.
function weekendOvereating(state) {
  const targets = state.nutritionTargets;
  if (!targets) return null;
  const keys = loggedDateKeys(state.foodLogs, 30);
  const weekendKeys = keys.filter(isWeekend);
  const weekdayKeys = keys.filter((k) => !isWeekend(k));
  if (weekendKeys.length < 4 || weekdayKeys.length < 6) return null;

  const avg = (dateKeys) => dateKeys.reduce((sum, k) => sum + dailyTotals(state.foodLogs, k).calories, 0) / dateKeys.length;
  const weekendAvg = avg(weekendKeys);
  const weekdayAvg = avg(weekdayKeys);
  const weekendOverTarget = weekendAvg - targets.calories;
  if (weekendOverTarget > 200 && weekendAvg - weekdayAvg > 150) {
    return {
      key: "weekend_overeating",
      text: `Weekend intake has been averaging ${Math.round(weekendOverTarget)} calories above target — noticeably higher than weekdays.`,
      tags: ["nutrition", "weekend", "calories"],
    };
  }
  return null;
}

// "Breakfast is frequently skipped" — needs a real logging habit established first (otherwise
// a missing breakfast log might just mean the athlete hasn't logged yet that day).
function breakfastSkipped(state) {
  const keys = loggedDateKeys(state.foodLogs, 21);
  if (keys.length < MIN_LOGGED_DAYS) return null;
  const skippedCount = keys.filter((k) => !(state.foodLogs || []).some((f) => f.date === k && f.meal === "breakfast")).length;
  const ratio = skippedCount / keys.length;
  if (ratio >= 0.6) {
    return {
      key: "breakfast_skipped",
      text: `Breakfast has gone unlogged on ${skippedCount} of your last ${keys.length} logged days — it's frequently skipped.`,
      tags: ["nutrition", "breakfast", "meal_pattern"],
    };
  }
  return null;
}

// "Three-meal structure produces better adherence than five meals" — compares on-plan rate
// between lower-meal-count days and higher-meal-count days for this athlete specifically.
function mealFrequencyAdherence(state) {
  const targets = state.nutritionTargets;
  if (!targets) return null;
  const keys = loggedDateKeys(state.foodLogs, 30);
  if (keys.length < MIN_LOGGED_DAYS) return null;

  const onPlan = (k) => {
    const t = dailyTotals(state.foodLogs, k);
    return t.calories >= targets.calories * 0.9 && t.calories <= targets.calories * 1.1;
  };
  const mealCount = (k) => new Set((state.foodLogs || []).filter((f) => f.date === k).map((f) => f.meal)).size;

  const lowFreqDays = keys.filter((k) => mealCount(k) <= 3);
  const highFreqDays = keys.filter((k) => mealCount(k) >= 5);
  if (lowFreqDays.length < 5 || highFreqDays.length < 5) return null;

  const lowRate = lowFreqDays.filter(onPlan).length / lowFreqDays.length;
  const highRate = highFreqDays.filter(onPlan).length / highFreqDays.length;
  if (lowRate - highRate >= 0.25) {
    return {
      key: "meal_frequency_adherence",
      text: "Fewer, larger meals have consistently produced better adherence than spreading targets across many small meals.",
      tags: ["nutrition", "meal_frequency", "adherence"],
    };
  }
  if (highRate - lowRate >= 0.25) {
    return {
      key: "meal_frequency_adherence",
      text: "More frequent, smaller meals have consistently produced better adherence than fewer large ones.",
      tags: ["nutrition", "meal_frequency", "adherence"],
    };
  }
  return null;
}

// "Adheres better with larger dinners" — compares on-plan rate on days where dinner carried
// the largest share of calories against days it didn't.
function largeDinnerAdherence(state) {
  const targets = state.nutritionTargets;
  if (!targets) return null;
  const keys = loggedDateKeys(state.foodLogs, 30);
  if (keys.length < MIN_LOGGED_DAYS) return null;

  const dinnerShare = (k) => {
    const entries = (state.foodLogs || []).filter((f) => f.date === k);
    const total = entries.reduce((s, f) => s + (f.calories || 0), 0);
    if (total === 0) return 0;
    const dinner = entries.filter((f) => f.meal === "dinner").reduce((s, f) => s + (f.calories || 0), 0);
    return dinner / total;
  };
  const onPlan = (k) => {
    const t = dailyTotals(state.foodLogs, k);
    return t.calories >= targets.calories * 0.9 && t.calories <= targets.calories * 1.1;
  };

  const largeDinnerDays = keys.filter((k) => dinnerShare(k) >= 0.4);
  const smallDinnerDays = keys.filter((k) => dinnerShare(k) < 0.4 && dinnerShare(k) > 0);
  if (largeDinnerDays.length < 5 || smallDinnerDays.length < 5) return null;

  const largeRate = largeDinnerDays.filter(onPlan).length / largeDinnerDays.length;
  const smallRate = smallDinnerDays.filter(onPlan).length / smallDinnerDays.length;
  if (largeRate - smallRate >= 0.25) {
    return {
      key: "large_dinner_adherence",
      text: "Adherence has consistently been better on days with a larger dinner.",
      tags: ["nutrition", "dinner", "adherence"],
    };
  }
  return null;
}

export function detectNutritionMemory(state) {
  const memory = [];
  const weekend = weekendOvereating(state);
  if (weekend) memory.push(weekend);
  const breakfast = breakfastSkipped(state);
  if (breakfast) memory.push(breakfast);
  const freq = mealFrequencyAdherence(state);
  if (freq) memory.push(freq);
  const dinner = largeDinnerAdherence(state);
  if (dinner) memory.push(dinner);
  return memory;
}

export const NUTRITION_DETECTOR_KEYS = ["weekend_overeating", "breakfast_skipped", "meal_frequency_adherence", "large_dinner_adherence"];
