// ---------------- MEAL PLAN GENERATOR ----------------
// Section 8/9/10 of the nutrition spec: a practical daily meal plan built from normal,
// repeatable foods — not bizarre "fitness foods" invented to hit numbers. Deliberately
// approximate (serving multipliers in 0.5x steps, not gram-precise) because a plan a person
// will actually cook and eat matters more than one that's numerically perfect on paper.

const FOOD_DB = {
  protein: [
    { name: "Chicken breast", servingDesc: "6oz", calories: 280, protein: 52, carbs: 0, fat: 6, tags: ["meat"] },
    { name: "Lean beef (93/7)", servingDesc: "6oz", calories: 340, protein: 48, carbs: 0, fat: 16, tags: ["meat"] },
    { name: "Turkey breast", servingDesc: "6oz", calories: 260, protein: 50, carbs: 0, fat: 5, tags: ["meat"] },
    { name: "Salmon", servingDesc: "6oz", calories: 350, protein: 46, carbs: 0, fat: 18, tags: ["fish"] },
    { name: "Tilapia", servingDesc: "6oz", calories: 220, protein: 46, carbs: 0, fat: 3, tags: ["fish"] },
    { name: "Shrimp", servingDesc: "6oz", calories: 200, protein: 42, carbs: 2, fat: 2, tags: ["fish", "shellfish"] },
    { name: "Eggs", servingDesc: "3 whole", calories: 230, protein: 19, carbs: 2, fat: 16, tags: ["vegetarian", "eggs"] },
    { name: "Egg whites", servingDesc: "1 cup", calories: 120, protein: 26, carbs: 2, fat: 0, tags: ["vegetarian", "eggs"] },
    { name: "Greek yogurt", servingDesc: "1 cup", calories: 150, protein: 25, carbs: 9, fat: 0, tags: ["vegetarian", "dairy"] },
    { name: "Cottage cheese", servingDesc: "1 cup", calories: 180, protein: 25, carbs: 8, fat: 5, tags: ["vegetarian", "dairy"] },
    { name: "Tofu", servingDesc: "6oz", calories: 180, protein: 20, carbs: 4, fat: 10, tags: ["vegan", "soy"] },
    { name: "Black beans", servingDesc: "1 cup", calories: 220, protein: 15, carbs: 40, fat: 1, tags: ["vegan"] },
    { name: "Lentils", servingDesc: "1 cup", calories: 230, protein: 18, carbs: 40, fat: 1, tags: ["vegan"] },
  ],
  carb: [
    { name: "White rice", servingDesc: "1 cup cooked", calories: 205, protein: 4, carbs: 45, fat: 0, tags: ["vegan", "gluten_free"] },
    { name: "Brown rice", servingDesc: "1 cup cooked", calories: 215, protein: 5, carbs: 45, fat: 2, tags: ["vegan", "gluten_free"] },
    { name: "Oatmeal", servingDesc: "1 cup cooked", calories: 165, protein: 6, carbs: 28, fat: 3, tags: ["vegan", "gluten_free"] },
    { name: "Potato", servingDesc: "1 medium", calories: 160, protein: 4, carbs: 37, fat: 0, tags: ["vegan", "gluten_free"] },
    { name: "Sweet potato", servingDesc: "1 medium", calories: 115, protein: 2, carbs: 27, fat: 0, tags: ["vegan", "gluten_free"] },
    { name: "Pasta", servingDesc: "1 cup cooked", calories: 220, protein: 8, carbs: 43, fat: 1, tags: ["vegan", "gluten"] },
    { name: "Whole wheat bread", servingDesc: "2 slices", calories: 160, protein: 8, carbs: 28, fat: 2, tags: ["vegan", "gluten"] },
    { name: "Tortilla", servingDesc: "2 medium", calories: 220, protein: 6, carbs: 36, fat: 6, tags: ["vegan", "gluten"] },
    { name: "Berries", servingDesc: "1 cup", calories: 65, protein: 1, carbs: 15, fat: 0, tags: ["vegan", "gluten_free"] },
    { name: "Banana", servingDesc: "1 medium", calories: 105, protein: 1, carbs: 27, fat: 0, tags: ["vegan", "gluten_free"] },
  ],
  fat: [
    { name: "Olive oil", servingDesc: "1 tbsp", calories: 120, protein: 0, carbs: 0, fat: 14, tags: ["vegan", "gluten_free"] },
    { name: "Avocado", servingDesc: "1/2", calories: 120, protein: 1, carbs: 6, fat: 11, tags: ["vegan", "gluten_free"] },
    { name: "Almonds", servingDesc: "1oz", calories: 165, protein: 6, carbs: 6, fat: 14, tags: ["vegan", "gluten_free", "nuts"] },
    { name: "Peanut butter", servingDesc: "2 tbsp", calories: 190, protein: 7, carbs: 7, fat: 16, tags: ["vegan", "gluten_free", "nuts"] },
  ],
  veg: [
    { name: "Broccoli", servingDesc: "1 cup", calories: 30, protein: 3, carbs: 6, fat: 0, tags: ["vegan", "gluten_free"] },
    { name: "Mixed vegetables", servingDesc: "1 cup", calories: 50, protein: 2, carbs: 10, fat: 0, tags: ["vegan", "gluten_free"] },
    { name: "Green beans", servingDesc: "1 cup", calories: 35, protein: 2, carbs: 8, fat: 0, tags: ["vegan", "gluten_free"] },
    { name: "Salad greens", servingDesc: "2 cups", calories: 20, protein: 1, carbs: 4, fat: 0, tags: ["vegan", "gluten_free"] },
  ],
};

const RESTRICTION_EXCLUDES = {
  vegetarian: ["meat", "fish", "shellfish"],
  vegan: ["meat", "fish", "shellfish", "dairy", "eggs"],
  pescatarian: ["meat"],
  "gluten-free": ["gluten"],
  "gluten free": ["gluten"],
  "dairy-free": ["dairy"],
  "dairy free": ["dairy"],
  lactose: ["dairy"],
};

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function excludedTagsFor(profile) {
  const tags = new Set();
  (profile.dietaryRestrictions || []).forEach((r) => {
    const key = normalize(r);
    Object.entries(RESTRICTION_EXCLUDES).forEach(([k, excludes]) => {
      if (key.includes(k.split(/[- ]/)[0])) excludes.forEach((t) => tags.add(t));
    });
  });
  return tags;
}

function isAllergenOrDisliked(food, profile) {
  const blockers = [...(profile.allergies || []), ...(profile.dislikedFoods || [])].map(normalize);
  if (blockers.length === 0) return false;
  const name = normalize(food.name);
  return blockers.some((b) => b && (name.includes(b) || b.includes(name) || (food.tags || []).some((t) => normalize(t).includes(b))));
}

function isPreferred(food, profile) {
  const preferred = (profile.preferredFoods || []).map(normalize);
  return preferred.some((p) => p && normalize(food.name).includes(p));
}

// Filters a category pool against restrictions/allergies/dislikes, then sorts preferred foods
// first — never removes a food silently for a reason the athlete didn't state.
export function availableFoods(category, profile) {
  const excluded = excludedTagsFor(profile);
  const pool = FOOD_DB[category].filter((f) => !isAllergenOrDisliked(f, profile) && !(f.tags || []).some((t) => excluded.has(t)));
  return [...pool].sort((a, b) => (isPreferred(b, profile) ? 1 : 0) - (isPreferred(a, profile) ? 1 : 0));
}

function scaleFor(food, targetGrams, macroKey) {
  if (!food[macroKey] || food[macroKey] <= 0) return 1;
  const mult = targetGrams / food[macroKey];
  return Math.max(0.5, Math.min(2.5, Math.round(mult * 2) / 2));
}

function buildItem(food, mult) {
  return {
    name: food.name,
    servingDesc: mult === 1 ? food.servingDesc : `${mult}x ${food.servingDesc}`,
    calories: Math.round(food.calories * mult),
    protein: Math.round(food.protein * mult),
    carbs: Math.round(food.carbs * mult),
    fat: Math.round(food.fat * mult),
  };
}

function sumTotals(items) {
  return items.reduce(
    (acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function buildMeal(label, time, macroShare, profile, { includeVeg = false, light = false } = {}) {
  const proteinPool = availableFoods("protein", profile);
  const carbPool = availableFoods("carb", profile);
  const vegPool = availableFoods("veg", profile);
  if (proteinPool.length === 0 || carbPool.length === 0) return { id: `meal_${label}`, label, time, items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } };

  const protein = proteinPool[light ? Math.min(1, proteinPool.length - 1) : 0];
  const carb = carbPool[light ? Math.min(1, carbPool.length - 1) : 0];
  const proteinMult = scaleFor(protein, macroShare.protein * 0.6, "protein");
  const carbMult = scaleFor(carb, macroShare.carbs * 0.7, "carbs");

  const items = [buildItem(protein, proteinMult), buildItem(carb, carbMult)];
  if (includeVeg && vegPool.length > 0) items.push(buildItem(vegPool[0], 1));

  return { id: `meal_${label.toLowerCase().replace(/\s+/g, "_")}`, label, time, items, totals: sumTotals(items) };
}

// Section 8: builds a full day's meals from targets + preferences/schedule. Adds a
// Pre-Workout slot ahead of the athlete's stated training time when one is known, matching
// the spec's own worked example (Meal 1, Meal 2, Pre-Workout, Dinner).
export function generateMealPlan(profile, targets) {
  if (!targets) return null;
  const mealCount = Math.max(3, Math.min(5, profile.mealsPerDayPreference || 3));
  const hasPreWorkout = !!profile.trainingTime;

  const preWorkoutFrac = hasPreWorkout ? 0.1 : 0;
  const mainFrac = (1 - preWorkoutFrac) / mealCount;

  const mainLabels = ["Breakfast", "Lunch", "Dinner", "Snack 1", "Snack 2"].slice(0, mealCount);
  const mainTimes = ["7:00 AM", "12:00 PM", "7:00 PM", "3:00 PM", "9:00 PM"].slice(0, mealCount);

  const meals = mainLabels.map((label, i) =>
    buildMeal(label, mainTimes[i], { calories: targets.calories * mainFrac, protein: targets.protein * mainFrac, carbs: targets.carbs * mainFrac, fat: targets.fat * mainFrac }, profile, {
      includeVeg: label === "Lunch" || label === "Dinner",
    })
  );

  if (hasPreWorkout) {
    const preWorkoutMeal = buildMeal(
      "Pre-Workout",
      profile.trainingTime,
      { calories: targets.calories * preWorkoutFrac, protein: targets.protein * preWorkoutFrac, carbs: targets.carbs * preWorkoutFrac, fat: targets.fat * preWorkoutFrac },
      profile,
      { light: true }
    );
    // Insert before Dinner if there's one, otherwise append.
    const dinnerIdx = meals.findIndex((m) => m.label === "Dinner");
    if (dinnerIdx >= 0) meals.splice(dinnerIdx, 0, preWorkoutMeal);
    else meals.push(preWorkoutMeal);
  }

  return { meals, generatedAt: new Date().toISOString() };
}

// Section 9 — SWAP FOOD: keeps the replacement in the same category (protein/carb/fat/veg) so
// the swap stays nutritionally compatible with the meal's purpose, not just "a different food."
export function getSwapOptions(foodName, profile) {
  for (const category of Object.keys(FOOD_DB)) {
    if (FOOD_DB[category].some((f) => f.name === foodName)) {
      return availableFoods(category, profile).filter((f) => f.name !== foodName);
    }
  }
  return [];
}

export function swapFoodInMeal(meal, oldItemName, newFood) {
  const oldItem = meal.items.find((i) => i.name === oldItemName);
  if (!oldItem) return meal;
  // Preserve the same rough calorie contribution the swapped-out food had — matching intent,
  // not just dropping in a base serving that might be way off.
  const mult = oldItem.calories > 0 && newFood.calories > 0 ? Math.max(0.5, Math.min(2.5, Math.round((oldItem.calories / newFood.calories) * 2) / 2)) : 1;
  const newItem = buildItem(newFood, mult);
  const items = meal.items.map((i) => (i.name === oldItemName ? newItem : i));
  return { ...meal, items, totals: sumTotals(items) };
}

// Section 10 — "I don't have that": builds a reasonable replacement meal from whatever the
// athlete says they actually have on hand, matched to the original meal's protein/carb split
// rather than demanding a match to a static plan.
export function suggestFromAvailable(availableFoodNames, meal) {
  const named = availableFoodNames.map((n) => normalize(n));
  const matches = [];
  Object.values(FOOD_DB)
    .flat()
    .forEach((f) => {
      if (named.some((n) => n && (normalize(f.name).includes(n) || n.includes(normalize(f.name))))) matches.push(f);
    });
  if (matches.length === 0) return null;

  const protein = matches.find((f) => FOOD_DB.protein.includes(f));
  const carb = matches.find((f) => FOOD_DB.carb.includes(f));
  const items = [];
  if (protein) items.push(buildItem(protein, scaleFor(protein, meal.totals.protein * 0.6, "protein")));
  if (carb) items.push(buildItem(carb, scaleFor(carb, meal.totals.carbs * 0.7, "carbs")));
  if (items.length === 0) items.push(...matches.slice(0, 2).map((f) => buildItem(f, 1)));

  return { ...meal, items, totals: sumTotals(items), note: "Built from what you had on hand." };
}
