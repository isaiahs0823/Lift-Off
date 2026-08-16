// ---------------- USDA FoodData Central — response normalization ----------------
// Pure, network-free functions. Shared by the serverless proxy (api/food-search.js, which
// runs this server-side right after fetching from USDA) and by tests, so the exact same
// normalization logic that ships to production is what gets verified — no separate "test
// version" of this logic to drift out of sync.
//
// USDA reports nutrients two different ways depending on food type, and mixing them up
// silently produces wrong numbers:
//   - Foundation / SR Legacy / Survey (FNDDS) foods: `foodNutrients[]`, always per 100g.
//   - Branded foods: usually also carry `labelNutrients` — the actual Nutrition Facts panel
//     values, per the label's declared serving (servingSize + servingSizeUnit). That's what
//     a person looks at on the package, so branded foods are normalized against label values
//     when present rather than the per-100g figure.
// Nutrients absent from the source are left `null`, never defaulted to 0 — section 20 of the
// spec this was built against is explicit that inventing a missing value is worse than
// admitting it isn't known.

const NUTRIENT_NUMBERS = {
  calories: "208",
  protein: "203",
  fat: "204",
  carbs: "205",
  fiber: "291",
};

function pickFoodNutrient(foodNutrients, number) {
  const hit = (foodNutrients || []).find((n) => String(n.nutrientNumber) === number);
  return hit && typeof hit.value === "number" ? hit.value : null;
}

function pickLabelNutrient(labelNutrients, key) {
  const hit = labelNutrients?.[key];
  return hit && typeof hit.value === "number" ? hit.value : null;
}

// Best-effort pull of a friendly unit word (cup, tbsp, container, ...) out of USDA's
// household-serving text ("1 container (170g)") so the serving picker can show something more
// useful than a bare "1 serving" when the data supports it. Falls back to null rather than
// guessing — the caller just offers "serving" as the label instead.
const HOUSEHOLD_UNIT_WORDS = ["cup", "tbsp", "tablespoon", "tsp", "teaspoon", "container", "piece", "slice", "bar", "can", "bottle", "package", "scoop"];
export function parseHouseholdUnit(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const word of HOUSEHOLD_UNIT_WORDS) {
    if (lower.includes(word)) return word;
  }
  return null;
}

export function normalizeUsdaFood(raw) {
  const brand = raw.brandName || raw.brandOwner || null;
  const householdText = raw.householdServingFullText || null;
  const hasLabel = raw.labelNutrients && typeof raw.labelNutrients === "object" && Object.keys(raw.labelNutrients).length > 0;

  let basis, servingGrams, servingDesc, calories, protein, carbs, fat, fiber;

  if (hasLabel) {
    basis = "label";
    servingGrams = typeof raw.servingSize === "number" && raw.servingSizeUnit === "g" ? raw.servingSize : null;
    servingDesc = householdText || (raw.servingSize ? `${raw.servingSize}${raw.servingSizeUnit || ""}` : "1 serving");
    calories = pickLabelNutrient(raw.labelNutrients, "calories");
    protein = pickLabelNutrient(raw.labelNutrients, "protein");
    carbs = pickLabelNutrient(raw.labelNutrients, "carbohydrates");
    fat = pickLabelNutrient(raw.labelNutrients, "fat");
    fiber = pickLabelNutrient(raw.labelNutrients, "fiber");
  } else {
    basis = "100g";
    servingGrams = 100;
    servingDesc = "100 g";
    calories = pickFoodNutrient(raw.foodNutrients, NUTRIENT_NUMBERS.calories);
    protein = pickFoodNutrient(raw.foodNutrients, NUTRIENT_NUMBERS.protein);
    carbs = pickFoodNutrient(raw.foodNutrients, NUTRIENT_NUMBERS.carbs);
    fat = pickFoodNutrient(raw.foodNutrients, NUTRIENT_NUMBERS.fat);
    fiber = pickFoodNutrient(raw.foodNutrients, NUTRIENT_NUMBERS.fiber);
  }

  return {
    id: `usda_${raw.fdcId}`,
    source: "usda",
    fdcId: raw.fdcId,
    dataType: raw.dataType || null,
    name: raw.description || "Unknown food",
    brand,
    basis, // "label" | "100g" — what the numbers below are measured against
    servingGrams, // grams per 1 unit of `basis`, when known
    servingDesc,
    householdUnit: hasLabel ? parseHouseholdUnit(householdText) : null,
    calories,
    protein,
    carbs,
    fat,
    fiber,
  };
}

export function normalizeUsdaSearchResponse(json) {
  return (json?.foods || []).map(normalizeUsdaFood);
}
