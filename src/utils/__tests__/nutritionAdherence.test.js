import { it, expect, describe } from "vitest";
import { dayAdherence, rollingNutritionAdherence } from "../nutritionAdherence.js";

// Nutrition P0, step 2 — baseline coverage of existing adherence rules (feeds diagnoseNutrition's
// evidence gate). Hand-constructed fixed logs with independently computed expected bands.
const targets = { calories: 2000, protein: 150, carbs: 200, fat: 60 };

function dateKey(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

describe("dayAdherence", () => {
  it("a day with no log entries is 'not logged', not automatically a miss", () => {
    const result = dayAdherence([], targets, dateKey(0));
    expect(result.logged).toBe(false);
    expect(result.caloriesOnPlan).toBeNull();
    expect(result.proteinHit).toBeNull();
  });

  it("calories within +/-10% of target AND protein >=90% of target counts as on-plan — hand-computed: 2000 target, band is [1800, 2200]", () => {
    const logs = [{ date: dateKey(0), calories: 2100, protein: 140, carbs: 0, fat: 0 }]; // 140/150=93.3% >=90%, 2100 within [1800,2200]
    const result = dayAdherence(logs, targets, dateKey(0));
    expect(result.logged).toBe(true);
    expect(result.caloriesOnPlan).toBe(true);
    expect(result.proteinHit).toBe(true);
  });

  it("calories outside the +/-10% band is NOT on-plan even with protein hit", () => {
    const logs = [{ date: dateKey(0), calories: 2500, protein: 150, carbs: 0, fat: 0 }]; // 25% over
    const result = dayAdherence(logs, targets, dateKey(0));
    expect(result.caloriesOnPlan).toBe(false);
  });

  it("protein under 90% of target is NOT a hit even with calories on-plan", () => {
    const logs = [{ date: dateKey(0), calories: 2000, protein: 100, carbs: 0, fat: 0 }]; // 100/150=66.7%
    const result = dayAdherence(logs, targets, dateKey(0));
    expect(result.proteinHit).toBe(false);
  });
});

describe("rollingNutritionAdherence", () => {
  it("only logged days count toward the percentage — a 3-day window with 1 on-plan log out of 2 logged days (1 unlogged) is 50%, not 33%", () => {
    const logs = [
      { date: dateKey(0), calories: 2000, protein: 150, carbs: 0, fat: 0 }, // on-plan
      { date: dateKey(1), calories: 3000, protein: 150, carbs: 0, fat: 0 }, // logged, off-plan (calories)
      // dateKey(2) has no log at all
    ];
    const result = rollingNutritionAdherence({ nutritionTargets: targets, foodLogs: logs }, 3);
    expect(result.loggedDays).toBe(2);
    expect(result.onPlanDays).toBe(1);
    expect(result.pct).toBe(50);
  });

  it("returns null pct (not 0) when there are no targets at all", () => {
    const result = rollingNutritionAdherence({ nutritionTargets: null, foodLogs: [] }, 7);
    expect(result.pct).toBeNull();
    expect(result.loggedDays).toBe(0);
  });

  it("returns null pct when there are targets but zero logged days in the window — never fabricates a 0% or 100%", () => {
    const result = rollingNutritionAdherence({ nutritionTargets: targets, foodLogs: [] }, 7);
    expect(result.pct).toBeNull();
    expect(result.loggedDays).toBe(0);
  });

  it("averages are computed only across logged days", () => {
    const logs = [
      { date: dateKey(0), calories: 2000, protein: 150, carbs: 0, fat: 0 },
      { date: dateKey(1), calories: 2200, protein: 150, carbs: 0, fat: 0 },
    ];
    const result = rollingNutritionAdherence({ nutritionTargets: targets, foodLogs: logs }, 7);
    expect(result.avgCalories).toBe(2100); // (2000+2200)/2
    expect(result.loggedDays).toBe(2);
  });
});
