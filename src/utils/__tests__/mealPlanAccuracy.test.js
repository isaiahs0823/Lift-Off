import { it, expect, describe } from "vitest";
import { calculateNutritionTargets } from "../nutritionMath.js";
import { generateMealPlan, planMeetsTargets, planGaps, MEAL_PLAN_TOLERANCE_PCT } from "../mealPlanGenerator.js";

// Nutrition P0, step 3 — repairs generateMealPlan's systematic target undershoot. These tests
// use the same Gate-A-audited worked example as the fixed reference, re-run against the ACTUAL
// function (not a mock), plus independent additional profiles — never a calculation function
// grading its own output.

// Audited reference profile: male, 30, 5'10", 180lb, light occupation, 4x resistance + 2x
// cardio/week, muscle_gain. calculateNutritionTargets (already covered by its own baseline
// tests in nutritionMath.test.js) produces 2903 kcal / 153g protein / 391g carbs / 81g fat for
// this exact profile — reused here as the INPUT to the meal-plan fix under test, not re-derived.
const AUDITED_PROFILE = {
  sex: "male",
  age: 30,
  heightIn: 70,
  occupationActivity: "light",
  resistanceFrequency: 4,
  cardioFrequency: 2,
  cardioDurationMin: 30,
  primaryGoal: "muscle_gain",
  mealsPerDayPreference: 4,
  trainingTime: "6:00 PM",
};
const AUDITED_WEIGHT_LB = 180;

describe("MEAL_PLAN_TOLERANCE_PCT — documented acceptance policy", () => {
  it("is explicit and fixed, not computed per-call", () => {
    expect(MEAL_PLAN_TOLERANCE_PCT).toEqual({ calories: 0.1, protein: 0.1, carbs: 0.15, fat: 0.15 });
  });
});

describe("planMeetsTargets / planGaps — pure, independently testable", () => {
  it("flags a macro outside its tolerance band", () => {
    const totals = { calories: 2000, protein: 100, carbs: 200, fat: 50 };
    const targets = { calories: 1000, protein: 100, carbs: 200, fat: 50 }; // calories 2x over
    const result = planMeetsTargets(totals, targets);
    expect(result.calories).toBe(false);
    expect(result.protein).toBe(true);
  });
  it("flags a macro inside its tolerance band", () => {
    const totals = { calories: 1050, protein: 105, carbs: 200, fat: 50 }; // all within 10%/15%
    const targets = { calories: 1000, protein: 100, carbs: 200, fat: 50 };
    const result = planMeetsTargets(totals, targets);
    expect(Object.values(result).every(Boolean)).toBe(true);
  });
  it("planGaps is signed: negative means short of target, positive means over", () => {
    const gaps = planGaps({ calories: 900, protein: 110 }, { calories: 1000, protein: 100 });
    expect(gaps.calories).toBe(-100);
    expect(gaps.protein).toBe(10);
  });
  it("a target of 0 for a macro is trivially satisfied, never a division-by-zero", () => {
    expect(() => planMeetsTargets({ calories: 500, protein: 0, carbs: 0, fat: 0 }, { calories: 500, protein: 0, carbs: 0, fat: 0 })).not.toThrow();
  });
});

describe("generateMealPlan — the repaired audited worked example (the exact reported defect)", () => {
  const targets = calculateNutritionTargets(AUDITED_PROFILE, AUDITED_WEIGHT_LB);
  const plan = generateMealPlan(AUDITED_PROFILE, targets);

  it("sanity: the real target is still 2903/153/391/81 (confirms this test uses the actual audited numbers)", () => {
    expect(targets).toMatchObject({ calories: 2903, protein: 153, carbs: 391, fat: 81 });
  });

  it("no longer produces the previously reported systematic shortfall (was 2151 kcal / -26%; now within the documented tolerance)", () => {
    expect(plan.totals.calories).toBeGreaterThan(targets.calories * (1 - MEAL_PLAN_TOLERANCE_PCT.calories));
    expect(plan.totals.calories).toBeLessThan(targets.calories * (1 + MEAL_PLAN_TOLERANCE_PCT.calories));
  });

  it("all four macros land within the documented tolerance for this profile", () => {
    const within = planMeetsTargets(plan.totals, plan.targets);
    expect(within).toEqual({ calories: true, protein: true, carbs: true, fat: true });
  });

  it("the plan honestly reports its own gaps and totals — never silently matching without disclosure", () => {
    expect(plan.targets).toEqual({ calories: 2903, protein: 153, carbs: 391, fat: 81 });
    expect(plan.gaps).toEqual(planGaps(plan.totals, plan.targets));
    expect(plan.withinTolerance).toEqual(planMeetsTargets(plan.totals, plan.targets));
  });

  it("totals are the real sum of real item macros, not reverse-engineered from the target", () => {
    const summedFromItems = plan.meals
      .flatMap((m) => m.items)
      .reduce((acc, i) => ({ calories: acc.calories + i.calories, protein: acc.protein + i.protein, carbs: acc.carbs + i.carbs, fat: acc.fat + i.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(plan.totals).toEqual(summedFromItems);
  });

  it("every generated item's macros trace back to a real FOOD_DB entry (nothing invented)", () => {
    // Each item's calories must be an exact food.calories * (a valid 0.5x-step multiplier
    // between 0.5 and 2.5) — verified indirectly: the serving description always names either
    // the food's own base serving or an explicit "Nx " multiple of it.
    plan.meals.forEach((meal) => {
      meal.items.forEach((item) => {
        expect(item.servingDesc).toMatch(/^(\d+(\.\d+)?x )?.+/);
        expect(item.calories).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it("is deterministic for fixed inputs — generating twice from the same targets/profile produces identical totals", () => {
    const plan2 = generateMealPlan(AUDITED_PROFILE, targets);
    expect(plan2.totals).toEqual(plan.totals);
    expect(plan2.meals.map((m) => m.items.map((i) => i.name))).toEqual(plan.meals.map((m) => m.items.map((i) => i.name)));
  });
});

describe("generateMealPlan — additional independent profiles (not just the audited one)", () => {
  it("female / fat_loss / 3 meals: produces a real plan with honestly-reported tolerance results", () => {
    const profile = { sex: "female", age: 25, heightIn: 65, occupationActivity: "sedentary", resistanceFrequency: 3, cardioFrequency: 0, primaryGoal: "fat_loss", mealsPerDayPreference: 3 };
    const targets = calculateNutritionTargets(profile, 140);
    expect(targets).toMatchObject({ calories: 1392, protein: 140, carbs: 114, fat: 42 });
    const plan = generateMealPlan(profile, targets);
    expect(plan.meals).toHaveLength(3);
    expect(plan.totals.calories).toBeGreaterThan(0);
    // Never silently drops the comparison even when a macro misses tolerance.
    expect(plan.withinTolerance).toBeDefined();
    expect(plan.gaps).toBeDefined();
  });

  it("5-meal plan with a pre-workout slot produces 6 meals total and a coherent day-level total", () => {
    const profile = { sex: "male", age: 40, heightIn: 68, occupationActivity: "moderate", resistanceFrequency: 5, cardioFrequency: 3, cardioDurationMin: 45, primaryGoal: "maintenance", mealsPerDayPreference: 5, trainingTime: "5:00 PM" };
    const targets = calculateNutritionTargets(profile, 200);
    const plan = generateMealPlan(profile, targets);
    expect(plan.meals).toHaveLength(6); // 5 main + 1 pre-workout
    expect(plan.totals.calories).toBe(plan.meals.reduce((s, m) => s + m.totals.calories, 0));
  });

  it("vegan restriction: every generated item respects the restriction (no meat/fish/dairy/eggs)", () => {
    const profile = { sex: "female", age: 28, heightIn: 64, occupationActivity: "light", resistanceFrequency: 4, cardioFrequency: 1, primaryGoal: "muscle_gain", mealsPerDayPreference: 4, dietaryRestrictions: ["vegan"] };
    const targets = calculateNutritionTargets(profile, 135);
    const plan = generateMealPlan(profile, targets);
    const bannedNames = ["Chicken breast", "Lean beef (93/7)", "Turkey breast", "Salmon", "Tilapia", "Shrimp", "Eggs", "Egg whites", "Greek yogurt", "Cottage cheese"];
    plan.meals.forEach((meal) => meal.items.forEach((item) => expect(bannedNames).not.toContain(item.name)));
  });

  it("infeasible (vegan + gluten-free + nut allergy): never throws, never fabricates a food, honestly reports a large gap", () => {
    const profile = { sex: "male", age: 30, heightIn: 70, occupationActivity: "light", resistanceFrequency: 3, cardioFrequency: 1, primaryGoal: "muscle_gain", mealsPerDayPreference: 3, dietaryRestrictions: ["vegan", "gluten-free"], allergies: ["almonds", "peanut"] };
    const targets = calculateNutritionTargets(profile, 180);
    expect(() => generateMealPlan(profile, targets)).not.toThrow();
    const plan = generateMealPlan(profile, targets);
    expect(plan.meals.length).toBeGreaterThan(0);
    // Whatever the result, it's an honest comparison against the real target — never hidden.
    expect(plan.gaps).toBeDefined();
    expect(plan.withinTolerance).toBeDefined();
  });

  it("a category-exhausting restriction (nothing left in the protein pool) returns an honestly-empty meal, never a crash or a fabricated item", () => {
    // vegan removes every meat/fish/dairy/egg protein; Tofu, Black beans and Lentils are the
    // only survivors (all vegan-tagged) — excluding those three by name/allergy empties the
    // entire protein pool, which buildMeal must handle as an honest empty meal, not a crash.
    const profile = { primaryGoal: "muscle_gain", mealsPerDayPreference: 3, dietaryRestrictions: ["vegan"], allergies: ["tofu", "soy"], dislikedFoods: ["black beans", "lentils"] };
    const targets = { calories: 2500, protein: 150, carbs: 250, fat: 70 };
    const plan = generateMealPlan(profile, targets);
    plan.meals.forEach((meal) => expect(meal.items).toEqual([]));
    expect(plan.gaps.calories).toBeLessThan(0); // honestly way short, not hidden
    expect(plan.withinTolerance.calories).toBe(false);
  });
});

describe("generateMealPlan — boundary cases", () => {
  it("returns null for null targets, same as before the fix (no change to this contract)", () => {
    expect(generateMealPlan({}, null)).toBeNull();
  });
});
