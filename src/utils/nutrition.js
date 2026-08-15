// ---------------- NUTRITION PROFILE (assessment + preferences) ----------------
// Mirrors athleteProfile.js's pattern deliberately: a stated, user-owned profile that Coach
// reads from but never silently overwrites. Collected once via the conversational assessment
// (NutritionAssessmentForm.jsx), editable after. Current bodyweight is read from
// state.bodyweightLogs rather than duplicated here — one source of truth for weight.

export const NUTRITION_GOALS = ["fat_loss", "muscle_gain", "maintenance", "recomposition", "performance"];
export const NUTRITION_GOAL_LABEL = {
  fat_loss: "Fat Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  recomposition: "Recomposition",
  performance: "Performance",
};

export const OCCUPATION_ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "very_active"];
export const OCCUPATION_ACTIVITY_LABEL = {
  sedentary: "Desk job, mostly sitting",
  light: "On your feet sometimes",
  moderate: "On your feet most of the day",
  very_active: "Physically demanding job",
};

export const COOKING_ABILITY_LEVELS = ["minimal", "basic", "comfortable", "advanced"];
export const COOKING_ABILITY_LABEL = {
  minimal: "Minimal — I barely cook",
  basic: "Basic — simple meals",
  comfortable: "Comfortable in the kitchen",
  advanced: "Advanced — I can cook anything",
};

export const MEAL_PREP_WILLINGNESS_LEVELS = ["none", "some", "full"];
export const MEAL_PREP_WILLINGNESS_LABEL = {
  none: "Not interested in prepping",
  some: "Willing to prep sometimes",
  full: "Happy to prep in bulk",
};

export const BUDGET_LEVELS = ["tight", "moderate", "flexible"];
export const BUDGET_LEVEL_LABEL = {
  tight: "Tight — cost matters a lot",
  moderate: "Moderate",
  flexible: "Flexible — cost isn't a big constraint",
};

export const REALISTIC_ADHERENCE_OPTIONS = ["easy", "effort", "maybe", "no"];
export const REALISTIC_ADHERENCE_LABEL = {
  easy: "Yes — easily",
  effort: "Yes — but it will take effort",
  maybe: "Maybe",
  no: "No — this isn't realistic",
};

// section 3 — what specifically makes a plan unrealistic, used to actually change the plan
// rather than just noting the complaint.
export const ADHERENCE_BARRIERS = [
  "too_much_cooking",
  "too_many_meals",
  "work_schedule",
  "family_meals",
  "eating_out",
  "hunger",
  "food_preferences",
  "cost",
  "travel",
  "weekend_lifestyle",
  "training_schedule",
];
export const ADHERENCE_BARRIER_LABEL = {
  too_much_cooking: "Too much cooking",
  too_many_meals: "Too many meals",
  work_schedule: "Work schedule",
  family_meals: "Family meals",
  eating_out: "Eating out",
  hunger: "Hunger",
  food_preferences: "Food preferences",
  cost: "Cost",
  travel: "Travel",
  weekend_lifestyle: "Weekend lifestyle",
  training_schedule: "Training schedule",
};

// section 7 — how structured the athlete wants nutrition to be. Coach matches structure to
// the person instead of defaulting everyone into a full weighed meal plan.
export const CONTROL_LEVELS = ["flexible", "macros", "meal_structure", "full_plan"];
export const CONTROL_LEVEL_LABEL = {
  flexible: "Flexible",
  macros: "Macros",
  meal_structure: "Meal Structure",
  full_plan: "Full Meal Plan",
};
export const CONTROL_LEVEL_DESC = {
  flexible: "Give me calories and protein. I'll handle the rest.",
  macros: "Give me calorie, protein, carb, and fat targets.",
  meal_structure: "Give me targets plus a suggested meal structure.",
  full_plan: "Build my meals for me.",
};

export const RECENT_WEIGHT_TREND_OPTIONS = ["losing", "stable", "gaining", "unsure"];
export const RECENT_WEIGHT_TREND_LABEL = { losing: "Losing", stable: "Stable", gaining: "Gaining", unsure: "Not sure" };

export function defaultNutritionProfile() {
  return {
    onboardedAt: null,
    updatedAt: null,
    // Calculation inputs
    age: null,
    sex: null, // "male" | "female" | "unspecified" — only used for the BMR formula's offset term
    heightIn: null,
    goalWeight: null,
    bodyFatPct: null, // optional
    primaryGoal: null, // one of NUTRITION_GOALS
    // Activity
    resistanceFrequency: null, // sessions/week
    cardioFrequency: null, // sessions/week
    cardioType: "",
    cardioDurationMin: null,
    occupationActivity: null, // one of OCCUPATION_ACTIVITY_LEVELS
    dailySteps: null,
    // Schedule
    wakeTime: "",
    bedTime: "",
    workSchedule: "",
    trainingTime: "",
    // Preferences / restrictions
    dietaryRestrictions: [],
    allergies: [],
    dislikedFoods: [],
    preferredFoods: [],
    cookingAbility: null,
    mealPrepWillingness: null,
    mealsPerDayPreference: null,
    eatingOutFrequency: null, // times/week
    weekdayEatingNotes: "",
    weekendEatingNotes: "",
    alcoholFrequency: "",
    // Self-reported baseline (optional)
    currentCalorieIntake: null,
    currentMacroIntake: "", // free text — most people don't know exact macros
    recentWeightTrend: null,
    dietingExperience: "",
    biggestDifficulty: "",
    budgetLevel: null,
    householdConsiderations: "",
    // The most important question (section 3)
    realisticAdherence: null,
    adherenceBarriers: [],
    // How structured they want this (section 7)
    controlLevel: null,
  };
}

export function hasNutritionProfile(state) {
  return !!state.nutritionProfile?.onboardedAt;
}

export function resolveNutritionProfile(state) {
  return { ...defaultNutritionProfile(), ...(state.nutritionProfile || {}) };
}

// ---------------- FOOD LOG / SAVED FOODS / SAVED MEALS ----------------
export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack", "pre_workout", "post_workout"];
export const MEAL_SLOT_LABEL = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  pre_workout: "Pre-Workout",
  post_workout: "Post-Workout",
};

export function todayDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function dailyTotals(foodLogs, dateKey) {
  const entries = (foodLogs || []).filter((f) => f.date === dateKey);
  return entries.reduce(
    (acc, f) => ({
      calories: acc.calories + (f.calories || 0),
      protein: acc.protein + (f.protein || 0),
      carbs: acc.carbs + (f.carbs || 0),
      fat: acc.fat + (f.fat || 0),
      fiber: acc.fiber + (f.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}
