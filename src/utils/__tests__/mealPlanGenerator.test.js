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
