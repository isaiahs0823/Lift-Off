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

// Meal-type-specific food preferences — the difference between "a technically valid set of
// macros" and the spec's own example (eggs/oatmeal at breakfast, yogurt/banana pre-workout,
// chicken/rice and beef/potato as *different* meals, not the same pairing four times a day).
// Tried first, but always still filtered through availableFoods for restrictions/allergies —
// falls back to the general rotation whenever a preferred name isn't actually available.
const MEAL_TYPE_PROTEIN_PREF = {
  breakfast: ["Eggs", "Egg whites", "Greek yogurt", "Cottage cheese"],
  preworkout: ["Greek yogurt", "Cottage cheese", "Egg whites"],
};
const MEAL_TYPE_CARB_PREF = {
  breakfast: ["Oatmeal", "Berries", "Banana"],
  preworkout: ["Banana", "Berries"],
};
// Breakfast-coded carbs read oddly at lunch/dinner (oatmeal for dinner) — kept out of the
// general lunch/dinner/snack rotation, still available via Swap for anyone who actually wants it.
const MAIN_CARB_EXCLUDE = new Set(["Oatmeal", "Berries", "Banana"]);

function pickFood(pool, preferredNames, rotation) {
  if (pool.length === 0) return null;
  const preferred = (preferredNames || []).map((n) => pool.find((f) => f.name === n)).filter(Boolean);
  if (preferred.length > 0) return preferred[rotation % preferred.length];
  return pool[rotation % pool.length];
}

function buildMeal(label, time, macroShare, profile, { includeVeg = false, mealType = "main", rotation = 0 } = {}) {
  const proteinPool = availableFoods("protein", profile);
  const rawCarbPool = availableFoods("carb", profile);
  const carbPool = mealType === "main" ? rawCarbPool.filter((f) => !MAIN_CARB_EXCLUDE.has(f.name)) : rawCarbPool;
  const vegPool = availableFoods("veg", profile);
  if (proteinPool.length === 0 || carbPool.length === 0) return { id: `meal_${label}`, label, time, items: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } };

  const protein = pickFood(proteinPool, MEAL_TYPE_PROTEIN_PREF[mealType], rotation);
  const carb = pickFood(carbPool, MEAL_TYPE_CARB_PREF[mealType], rotation);
  const proteinMult = scaleFor(protein, macroShare.protein * 0.6, "protein");
  const carbMult = scaleFor(carb, macroShare.carbs * 0.7, "carbs");

  const items = [buildItem(protein, proteinMult), buildItem(carb, carbMult)];
  if (includeVeg && vegPool.length > 0) items.push(buildItem(vegPool[rotation % vegPool.length], 1));

  return { id: `meal_${label.toLowerCase().replace(/\s+/g, "_")}`, label, time, items, totals: sumTotals(items) };
}

// Shared by generateMealPlan and mealMacroDistribution — which slots exist (Breakfast/Lunch/
// Dinner/Snacks, plus a Pre-Workout slot inserted ahead of Dinner when the athlete's stated a
// training time), what fraction of the day's targets each one gets, and in what order. Kept in
// one place so the curated-food plan and the pure-numbers summary can never disagree about the
// day's structure, only about how each slot's share gets filled.
function buildMealSlots(profile) {
  const mealCount = Math.max(3, Math.min(5, profile.mealsPerDayPreference || 3));
  const hasPreWorkout = !!profile.trainingTime;
  const preWorkoutFrac = hasPreWorkout ? 0.1 : 0;
  const mainFrac = (1 - preWorkoutFrac) / mealCount;

  const mainLabels = ["Breakfast", "Lunch", "Dinner", "Snack 1", "Snack 2"].slice(0, mealCount);
  const mainTimes = ["7:00 AM", "12:00 PM", "7:00 PM", "3:00 PM", "9:00 PM"].slice(0, mealCount);
  const slots = mainLabels.map((label, i) => ({ label, time: mainTimes[i], frac: mainFrac, mealType: label === "Breakfast" ? "breakfast" : "main", rotation: i }));

  if (hasPreWorkout) {
    const preWorkoutSlot = { label: "Pre-Workout", time: profile.trainingTime, frac: preWorkoutFrac, mealType: "preworkout", rotation: 0 };
    const dinnerIdx = slots.findIndex((s) => s.label === "Dinner");
    if (dinnerIdx >= 0) slots.splice(dinnerIdx, 0, preWorkoutSlot);
    else slots.push(preWorkoutSlot);
  }
  return slots;
}

// Section 8: builds a full day's meals from targets + preferences/schedule — real, curated foods
// with real serving sizes (spec sections 1-4, 9-11, 15-18's "a plan a person will actually cook
// and eat matters more than one that's numerically perfect on paper"). Because each item's
// serving multiplier is rounded to a 0.5x step, per-meal totals can land a bit off the exact
// slot share — see mealMacroDistribution below for the exact-reconciling numeric split used by
// the home screen's "Meal Structure" summary.
export function generateMealPlan(profile, targets) {
  if (!targets) return null;
  const meals = buildMealSlots(profile).map((slot) =>
    buildMeal(slot.label, slot.time, { calories: targets.calories * slot.frac, protein: targets.protein * slot.frac, carbs: targets.carbs * slot.frac, fat: targets.fat * slot.frac }, profile, {
      includeVeg: slot.label === "Lunch" || slot.label === "Dinner",
      mealType: slot.mealType,
      rotation: slot.rotation,
    })
  );
  return { meals, generatedAt: new Date().toISOString() };
}

// A pure numeric meal-macro split — no food items, so unlike generateMealPlan it always
// reconciles exactly to the real daily targets: each slot gets its rounded share except the
// last, which absorbs whatever rounding remainder is left so the meals sum to precisely the
// target rather than drifting off it. Used for the "Meal Structure" home summary; the curated
// "Recommended Meal Plan" (generateMealPlan, above) is the place for concrete example foods.
export function mealMacroDistribution(profile, targets) {
  if (!targets) return null;
  const slots = buildMealSlots(profile);
  let remaining = { calories: targets.calories, protein: targets.protein, carbs: targets.carbs, fat: targets.fat };

  const meals = slots.map((slot, i) => {
    const isLast = i === slots.length - 1;
    const share = isLast
      ? remaining
      : {
          calories: Math.round(targets.calories * slot.frac),
          protein: Math.round(targets.protein * slot.frac),
          carbs: Math.round(targets.carbs * slot.frac),
          fat: Math.round(targets.fat * slot.frac),
        };
    remaining = {
      calories: remaining.calories - share.calories,
      protein: remaining.protein - share.protein,
      carbs: remaining.carbs - share.carbs,
      fat: remaining.fat - share.fat,
    };
    return { label: slot.label, time: slot.time, ...share };
  });

  return { meals };
}

// v1 "Food Guidance" section — practical protein/carb/fat source lists for the athlete to build
// their own meals around when they're not using the full recommended meal plan. Pulled straight
// from the same curated FOOD_DB every other meal-planning feature uses (never a live database
// lookup), filtered through the athlete's stated restrictions/allergies exactly like
// availableFoods already does. `limit` keeps each list to a readable handful rather than dumping
// the entire catalog.
export function foodGuidanceCategories(profile, limit = 6) {
  return {
    protein: availableFoods("protein", profile).slice(0, limit).map((f) => f.name),
    carb: availableFoods("carb", profile).slice(0, limit).map((f) => f.name),
    fat: availableFoods("fat", profile).slice(0, limit).map((f) => f.name),
  };
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
