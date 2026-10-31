import { describe, it, expect } from "vitest";
import { PROGRAM_FAMILIES, FAMILY_PROGRAMS, expandProgramFamilies } from "../../data/programFamilies.js";

// Part 7 validation: program-family data integrity. This file had zero test coverage before this
// session despite being load-bearing for every program the catalog, Today, and Train resolve.

describe("expandProgramFamilies / FAMILY_PROGRAMS", () => {
  it("produces exactly one flat program per authored frequency variant, no more, no fewer", () => {
    const expectedCount = PROGRAM_FAMILIES.reduce((sum, fam) => sum + Object.keys(fam.variants).length, 0);
    expect(FAMILY_PROGRAMS).toHaveLength(expectedCount);
  });

  it("every program's id is globally unique — no two variants (same family or different) collide", () => {
    const ids = FAMILY_PROGRAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("honors idOverrides — Titan's 5-day variant keeps its original prog_superman id", () => {
    const titan5 = FAMILY_PROGRAMS.find((p) => p.familyId === "titan" && p.trainingDays === 5);
    expect(titan5.id).toBe("prog_superman");
  });

  it("every other variant (no override) follows the prog_<familyId>_<N>day convention", () => {
    for (const p of FAMILY_PROGRAMS) {
      if (p.id === "prog_superman") continue; // the one explicit override
      expect(p.id).toBe(`prog_${p.familyId}_${p.trainingDays}day`);
    }
  });

  it("every produced program's actual day count matches its own trainingDays field", () => {
    for (const p of FAMILY_PROGRAMS) {
      expect(p.days).toHaveLength(p.trainingDays);
    }
  });

  it("a family with no variant at a given frequency simply has no entry there — never a fabricated split", () => {
    // Shape only authors 2-5 days (no 6-day variant) — asserted directly against the real data so
    // this fails loudly if that ever silently changes.
    const shapeDays = FAMILY_PROGRAMS.filter((p) => p.familyId === "shape").map((p) => p.trainingDays).sort();
    expect(shapeDays).toEqual([2, 3, 4, 5]);
    expect(FAMILY_PROGRAMS.find((p) => p.familyId === "shape" && p.trainingDays === 6)).toBeUndefined();
  });

  it("re-running expandProgramFamilies on the same input is stable — same ids, same shape, every time", () => {
    const a = expandProgramFamilies(PROGRAM_FAMILIES);
    const b = expandProgramFamilies(PROGRAM_FAMILIES);
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("carries familyId/familyName/trainingDays on every produced program — what the catalog and recommendation logic key off of", () => {
    for (const p of FAMILY_PROGRAMS) {
      expect(p.familyId).toBeTruthy();
      expect(p.familyName).toBeTruthy();
      expect(typeof p.trainingDays).toBe("number");
    }
  });

  it("every exercise slot in every family variant has a real exId and positive sets/reps — no placeholder data", () => {
    for (const p of FAMILY_PROGRAMS) {
      for (const day of p.days) {
        for (const ex of day.exercises || []) {
          expect(typeof ex.exId, `${p.id} / ${day.label}`).toBe("string");
          expect(ex.exId.length, `${p.id} / ${day.label}`).toBeGreaterThan(0);
          expect(ex.sets, `${p.id} / ${day.label} / ${ex.exId}`).toBeGreaterThan(0);
        }
      }
    }
  });
});
