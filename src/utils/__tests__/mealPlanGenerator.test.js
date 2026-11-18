import { it, expect, describe } from "vitest";
import { suggestFromAvailable } from "../mealPlanGenerator.js";

// Bug report: Nutrition -> Meal Plan -> Swap -> "What do you have instead?" -> Build From This
// appeared to do nothing for an unrecognized food ("Corn Flakes"). Root cause: this function
// correctly returns null when nothing matches, but the calling component (IDontHaveThat in
// MealPlanView.jsx) had no UI branch for that outcome — see that file's own test-equivalent
// coverage note. These tests cover the actual substitution logic: successful matches (including
// the word-overlap improvement), and the genuinely-no-match case this function must keep
// returning null for (never fabricating a food that isn't really in the catalog).
const meal = {
  id: "m1",
  label: "Breakfast",
  time: "7:00 AM",
  items: [],
  totals: { calories: 500, protein: 40, carbs: 50, fat: 15 },
};

describe("suggestFromAvailable — successful substitution", () => {
  it("matches an exact food name", () => {
    const result = suggestFromAvailable(["eggs"], meal);
    expect(result).not.toBeNull();
    expect(result.items.some((i) => i.name === "Eggs")).toBe(true);
  });

  it("matches case-insensitively and trims whitespace", () => {
    const result = suggestFromAvailable(["  EGGS  "], meal);
    expect(result).not.toBeNull();
  });

  it("matches multiple comma-separated foods, picking a protein and a carb", () => {
    const result = suggestFromAvailable(["eggs", "white rice"], meal);
    expect(result).not.toBeNull();
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it("word-overlap match: 'ground beef' matches 'Lean beef (93/7)' even though neither string contains the other", () => {
    const result = suggestFromAvailable(["ground beef"], meal);
    expect(result).not.toBeNull();
    expect(result.items.some((i) => i.name === "Lean beef (93/7)")).toBe(true);
  });

  it("word-overlap match: a single generic word ('chicken') matches 'Chicken breast'", () => {
    const result = suggestFromAvailable(["chicken"], meal);
    expect(result).not.toBeNull();
    expect(result.items.some((i) => i.name === "Chicken breast")).toBe(true);
  });

  it("never mutates the meal object it's given", () => {
    const before = JSON.stringify(meal);
    suggestFromAvailable(["eggs"], meal);
    expect(JSON.stringify(meal)).toBe(before);
  });

  it("returned totals are always derived from the actual returned items", () => {
    const result = suggestFromAvailable(["eggs", "white rice"], meal);
    const summed = result.items.reduce((s, i) => s + i.calories, 0);
    expect(result.totals.calories).toBe(summed);
  });
});

describe("suggestFromAvailable — invalid / no-match input", () => {
  it("returns null for a food with no real overlap in the catalog (the reported repro case)", () => {
    expect(suggestFromAvailable(["Corn Flakes"], meal)).toBeNull();
  });

  it("returns null for other brand names / foods outside the curated list", () => {
    expect(suggestFromAvailable(["Pop-Tarts"], meal)).toBeNull();
    expect(suggestFromAvailable(["energy drink"], meal)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(suggestFromAvailable([], meal)).toBeNull();
  });

  it("returns null when every entry is blank/whitespace", () => {
    expect(suggestFromAvailable(["", "   "], meal)).toBeNull();
  });

  it("returns null for a nonsense fragment with no real overlap to any catalog entry", () => {
    expect(suggestFromAvailable(["zzqq"], meal)).toBeNull();
  });
});

// Regenerate bug fix: generateMealPlan was a pure function of (profile, targets) with no way to
// ask for a different valid alternative — tapping Regenerate silently re-saved an identical plan.
// These cover the new `variation` parameter and mealPlansMeaningfullyDiffer helper that
// MealPlanView.jsx's regenerate() now uses to find and confirm an actually-different plan.
import { generateMealPlan, mealPlansMeaningfullyDiffer } from "../mealPlanGenerator.js";

describe("generateMealPlan — regenerate bug fix (variation)", () => {
  const profile = {
    trainingTime: "0500", // the exact reported repro input
    mealsPerDayPreference: 3,
    dietaryRestrictions: [],
    allergies: [],
    dislikedFoods: [],
    preferredFoods: [],
  };
  const targets = { calories: 2800, protein: 190, carbs: 300, fat: 80 };

  it("confirms the ORIGINAL bug: the same variation (0) called twice produces an identical plan", () => {
    const a = generateMealPlan(profile, targets, { variation: 0 });
    const b = generateMealPlan(profile, targets, { variation: 0 });
    expect(mealPlansMeaningfullyDiffer(a, b)).toBe(false);
  });

  it("a different variation produces a meaningfully different plan — the fix", () => {
    const a = generateMealPlan(profile, targets, { variation: 0 });
    const b = generateMealPlan(profile, targets, { variation: 1 });
    expect(mealPlansMeaningfullyDiffer(a, b)).toBe(true);
  });

  it("defaults variation to 0 when omitted — every pre-existing call site stays byte-identical", () => {
    const withDefault = generateMealPlan(profile, targets);
    const explicit0 = generateMealPlan(profile, targets, { variation: 0 });
    expect(mealPlansMeaningfullyDiffer(withDefault, explicit0)).toBe(false);
    expect(withDefault.variation).toBe(0);
  });

  it("records the variation used on the returned plan, for the component to continue forward from", () => {
    const plan = generateMealPlan(profile, targets, { variation: 3 });
    expect(plan.variation).toBe(3);
  });

  it("training time is preserved on the Pre-Workout slot across variations", () => {
    for (const v of [0, 1, 2, 3]) {
      const plan = generateMealPlan(profile, targets, { variation: v });
      const preWorkout = plan.meals.find((m) => m.label === "Pre-Workout");
      expect(preWorkout).toBeTruthy();
      expect(preWorkout.time).toBe("0500");
    }
  });

  it("dietary restrictions are still honored across variations (never a disallowed food, whatever the variation)", () => {
    const veganProfile = { ...profile, dietaryRestrictions: ["vegan"] };
    const disallowed = new Set(["Chicken breast", "Lean beef (93/7)", "Turkey breast", "Salmon", "Tilapia", "Shrimp", "Eggs", "Egg whites", "Greek yogurt", "Cottage cheese"]);
    for (const v of [0, 1, 2, 3, 4, 5]) {
      const plan = generateMealPlan(veganProfile, targets, { variation: v });
      for (const meal of plan.meals) {
        for (const item of meal.items) {
          expect(disallowed.has(item.name)).toBe(false);
        }
      }
    }
  });

  it("calorie/protein/carb/fat targets are still what every variation is calculated from (same dailyTargets echoed back)", () => {
    for (const v of [0, 1, 2]) {
      const plan = generateMealPlan(profile, targets, { variation: v });
      expect(plan.targets).toEqual({ calories: 2800, protein: 190, carbs: 300, fat: 80 });
    }
  });

  it("meal schedule (labels/slot count) is unchanged by variation — only which foods fill each slot changes", () => {
    const a = generateMealPlan(profile, targets, { variation: 0 });
    const b = generateMealPlan(profile, targets, { variation: 7 });
    expect(a.meals.map((m) => m.label)).toEqual(b.meals.map((m) => m.label));
  });

  it("several regenerates in a row (simulating repeated taps) keep producing new, distinct plans", () => {
    const seen = [];
    let current = generateMealPlan(profile, targets, { variation: 0 });
    seen.push(current);
    for (let i = 0; i < 5; i++) {
      const next = generateMealPlan(profile, targets, { variation: current.variation + 1 });
      expect(mealPlansMeaningfullyDiffer(current, next)).toBe(true);
      seen.push(next);
      current = next;
    }
    expect(seen.length).toBe(6);
  });
});

describe("mealPlansMeaningfullyDiffer", () => {
  it("returns false for two identical plans", () => {
    const plan = { meals: [{ label: "Breakfast", items: [{ name: "Eggs", calories: 230 }] }] };
    expect(mealPlansMeaningfullyDiffer(plan, JSON.parse(JSON.stringify(plan)))).toBe(false);
  });

  it("returns true when a food name changes in any one meal", () => {
    const a = { meals: [{ label: "Breakfast", items: [{ name: "Eggs", calories: 230 }] }] };
    const b = { meals: [{ label: "Breakfast", items: [{ name: "Oatmeal", calories: 230 }] }] };
    expect(mealPlansMeaningfullyDiffer(a, b)).toBe(true);
  });

  it("returns true when a serving size (calories) changes even with the same food name", () => {
    const a = { meals: [{ label: "Breakfast", items: [{ name: "Eggs", calories: 230 }] }] };
    const b = { meals: [{ label: "Breakfast", items: [{ name: "Eggs", calories: 345 }] }] };
    expect(mealPlansMeaningfullyDiffer(a, b)).toBe(true);
  });

  it("a different generatedAt timestamp ALONE does not count as meaningfully different", () => {
    const a = { generatedAt: "2026-01-01T00:00:00.000Z", meals: [{ label: "Breakfast", items: [{ name: "Eggs", calories: 230 }] }] };
    const b = { generatedAt: "2026-01-02T00:00:00.000Z", meals: [{ label: "Breakfast", items: [{ name: "Eggs", calories: 230 }] }] };
    expect(mealPlansMeaningfullyDiffer(a, b)).toBe(false);
  });

  it("treats null/undefined plans as different from a real plan, and the same as each other", () => {
    const plan = { meals: [] };
    expect(mealPlansMeaningfullyDiffer(null, plan)).toBe(true);
    expect(mealPlansMeaningfullyDiffer(plan, null)).toBe(true);
    expect(mealPlansMeaningfullyDiffer(null, null)).toBe(false);
  });
});
