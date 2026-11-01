import { describe, it, expect } from "vitest";
import { uniqueFamilyPrograms, familyFrequencyRange, familyVariants, recommendedProgramId, matchingPrograms, totalWeeklySets } from "../programRecommendation.js";

function familyProgram(familyId, name, trainingDays, overrides = {}) {
  return {
    id: `prog_${familyId}_${trainingDays}day`,
    name,
    tagline: `${trainingDays}-Day Version — Test tagline for ${name}`,
    weeks: 10,
    familyId,
    trainingDays,
    days: Array.from({ length: trainingDays }, (_, i) => ({ label: `Day ${i + 1}`, exercises: [{ exId: "bench", sets: 3, reps: 8 }] })),
    ...overrides,
  };
}

const TITAN = [2, 3, 4, 5, 6].map((n) => familyProgram("titan", "Titan", n));
const ATHENA = [2, 3, 4, 5, 6].map((n) => familyProgram("athena", "Athena", n));
const SHAPE = [2, 3, 4, 5].map((n) => familyProgram("shape", "Shape", n));
const BERSERKER = { id: "prog_berserker", name: "Berserker", tagline: "Standalone program", weeks: 8, trainingDays: 5, days: Array.from({ length: 5 }, (_, i) => ({ label: `Day ${i + 1}`, exercises: [] })) };
const ALL = [...TITAN, ...ATHENA, ...SHAPE, BERSERKER];

describe("uniqueFamilyPrograms", () => {
  it("collapses each family down to exactly one representative", () => {
    const result = uniqueFamilyPrograms(ALL);
    const titanCount = result.filter((p) => p.familyId === "titan").length;
    const athenaCount = result.filter((p) => p.familyId === "athena").length;
    const shapeCount = result.filter((p) => p.familyId === "shape").length;
    expect(titanCount).toBe(1);
    expect(athenaCount).toBe(1);
    expect(shapeCount).toBe(1);
  });

  it("never touches a standalone (non-family) program — it passes through unchanged", () => {
    const result = uniqueFamilyPrograms(ALL);
    expect(result.find((p) => p.id === "prog_berserker")).toEqual(BERSERKER);
  });

  it("defaults to the 3-day variant when no preference is given (BRK's stated default)", () => {
    const result = uniqueFamilyPrograms(ALL);
    const titan = result.find((p) => p.familyId === "titan");
    expect(titan.id).toBe("prog_titan_3day");
  });

  it("prefers a variant matching the athlete's preferredDays over the 3-day default", () => {
    const result = uniqueFamilyPrograms(ALL, { preferredDays: 5 });
    const titan = result.find((p) => p.familyId === "titan");
    expect(titan.id).toBe("prog_titan_5day");
  });

  it("falls back to the 3-day variant when preferredDays doesn't exist for that family but 3 does", () => {
    // Shape has no 6-day variant; asking for 6 should fall back to its 3-day (BRK's default),
    // not throw or omit Shape from the catalog.
    const result = uniqueFamilyPrograms(ALL, { preferredDays: 6 });
    const shape = result.find((p) => p.familyId === "shape");
    expect(shape).toBeDefined();
    expect(shape.id).toBe("prog_shape_3day");
  });

  it("falls back to the lowest supported day count when neither 3 nor preferredDays exist for that family", () => {
    const noThreeOrSix = [familyProgram("odd", "Odd", 2), familyProgram("odd", "Odd", 4), familyProgram("odd", "Odd", 5)];
    const result = uniqueFamilyPrograms(noThreeOrSix, { preferredDays: 6 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("prog_odd_2day"); // lowest of [2,4,5]
  });

  it("prefers the active program's own day count for its family over the 3-day default", () => {
    const result = uniqueFamilyPrograms(ALL, { preferFamilyId: "titan", activeDaysByFamily: { titan: 6 } });
    const titan = result.find((p) => p.familyId === "titan");
    expect(titan.id).toBe("prog_titan_6day");
  });

  it("preserves list length as (family count) + (standalone count)", () => {
    const result = uniqueFamilyPrograms(ALL);
    expect(result).toHaveLength(3 + 1); // titan, athena, shape + berserker
  });

  it("returns an empty list for an empty input", () => {
    expect(uniqueFamilyPrograms([])).toEqual([]);
  });
});

describe("familyFrequencyRange", () => {
  it("reports the true min/max across a family's variants", () => {
    expect(familyFrequencyRange("titan", ALL)).toEqual({ min: 2, max: 6 });
    expect(familyFrequencyRange("shape", ALL)).toEqual({ min: 2, max: 5 });
  });

  it("returns null for a family with no matching programs", () => {
    expect(familyFrequencyRange("nonexistent", ALL)).toBeNull();
  });

  it("is unaffected by uniqueFamilyPrograms having collapsed the list — always reads the full program set", () => {
    const collapsed = uniqueFamilyPrograms(ALL);
    // Called with the FULL list (as App.jsx does), not the collapsed one — this is the caller's
    // contract, asserted here so a future refactor can't silently start passing the collapsed list.
    expect(familyFrequencyRange("titan", ALL)).toEqual({ min: 2, max: 6 });
    expect(collapsed.filter((p) => p.familyId === "titan")).toHaveLength(1);
  });
});

describe("existing recommendation logic stays correct (regression coverage — previously untested)", () => {
  it("familyVariants keys variants by their own trainingDays", () => {
    const variants = familyVariants("titan", ALL);
    expect(Object.keys(variants).map(Number).sort()).toEqual([2, 3, 4, 5, 6]);
    expect(variants[4].id).toBe("prog_titan_4day");
  });

  it("matchingPrograms filters by exact day count across builtin and custom", () => {
    const customFourDay = { id: "custom_1", name: "My Plan", days: [1, 2, 3, 4].map((i) => ({ label: `D${i}`, exercises: [] })) };
    const matches = matchingPrograms(4, { programs: ALL, customPrograms: [customFourDay] });
    expect(matches.some((p) => p.id === "prog_titan_4day" && p.source === "builtin")).toBe(true);
    expect(matches.some((p) => p.id === "custom_1" && p.source === "custom")).toBe(true);
    expect(matches.every((p) => p.days.length === 4)).toBe(true);
  });

  it("recommendedProgramId prefers the athlete's current family at a new day count over an unrelated match", () => {
    const matches = matchingPrograms(4, { programs: ALL });
    expect(recommendedProgramId(4, matches, "athena")).toBe("prog_athena_4day");
  });

  it("totalWeeklySets sums sets across every day", () => {
    const prog = familyProgram("titan", "Titan", 2, {
      days: [
        { label: "A", exercises: [{ exId: "bench", sets: 3 }, { exId: "row", sets: 3 }] },
        { label: "B", exercises: [{ exId: "squat", sets: 4 }] },
      ],
    });
    expect(totalWeeklySets(prog)).toBe(10);
  });
});
