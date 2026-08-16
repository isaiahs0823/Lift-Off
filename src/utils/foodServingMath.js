// ---------------- FOOD SERVING MATH ----------------
// Scales a normalized food's macros (reported against its `basis` — either a declared label
// serving or 100g, see usdaNormalize.js) to whatever quantity/unit the user actually ate.
// Values are returned unrounded; callers round at render/write time the same way the rest of
// BRK's nutrition math already does (dailyTotals, MacroRow) — one rounding convention, not two.
const OZ_TO_G = 28.3495;

// What unit choices make sense for this specific food. "serving" is always available (it's
// just "1x the basis" — for a 100g-basis food that's literally 100g, which is honest rather
// than implying a discrete serving exists when USDA never reported one). Grams/ounces only
// make sense once we know the gram weight of that basis serving.
export function servingUnitOptions(food) {
  const opts = [{ value: "serving", label: food.basis === "label" ? (food.householdUnit ? `serving (${food.householdUnit})` : "serving") : "100g serving" }];
  if (food.servingGrams != null) {
    opts.push({ value: "g", label: "g" }, { value: "oz", label: "oz" });
  }
  return opts;
}

// { calories, protein, carbs, fat, fiber } — any nutrient the source didn't report stays null,
// never 0, all the way through the scale (0 * anything is still 0, but null * anything must
// stay null so the UI can render "—" instead of a fabricated zero).
export function scaleFoodMacros(food, quantity, unit) {
  const qty = Number(quantity);
  const invalid = { calories: null, protein: null, carbs: null, fat: null, fiber: null, gramsUsed: null };
  if (!Number.isFinite(qty) || qty <= 0) return invalid;

  let multiplier;
  let gramsUsed = null;
  if (unit === "g" || unit === "oz") {
    if (food.servingGrams == null) return { ...invalid, unavailable: true };
    const grams = unit === "oz" ? qty * OZ_TO_G : qty;
    multiplier = grams / food.servingGrams;
    gramsUsed = grams;
  } else {
    // "serving" — the food's reported values already ARE 1 unit of this multiplier.
    multiplier = qty;
    gramsUsed = food.servingGrams != null ? food.servingGrams * qty : null;
  }

  const scale = (v) => (typeof v === "number" ? v * multiplier : null);
  return {
    calories: scale(food.calories),
    protein: scale(food.protein),
    carbs: scale(food.carbs),
    fat: scale(food.fat),
    fiber: scale(food.fiber),
    gramsUsed,
  };
}
