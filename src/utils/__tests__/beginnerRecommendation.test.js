import { it, expect, describe } from "vitest";
import { recommendForBeginner, trainingDetailForExperience } from "../beginnerRecommendation.js";
import { FAMILY_PROGRAMS } from "../../data/programFamilies.js";

const programs = [
  { id: "prog_3day_full_body", name: "3-Day Full Body", days: [{ label: "Full Body A", exercises: [{ exId: "bench" }] }, { label: "Full Body B", exercises: [] }] },
  ...FAMILY_PROGRAMS,
];

describe("trainingDetailForExperience", () => {
  it("maps new/some to simple", () => {
    expect(trainingDetailForExperience("new")).toBe("simple");
    expect(trainingDetailForExperience("some")).toBe("simple");
  });
  it("maps experienced to advanced", () => {
    expect(trainingDetailForExperience("experienced")).toBe("advanced");
  });
});

describe("recommendForBeginner", () => {
  it("recommends the purpose-built 3-day beginner program when days === 3, regardless of goal", () => {
    const { program, gap } = recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "full" }, { programs });
    expect(program.id).toBe("prog_3day_full_body");
    expect(gap).toBeNull();
  });

  it("falls back to a goal-mapped family variant for a non-3-day frequency that the family actually offers", () => {
    const { program, gap } = recommendForBeginner({ experience: "new", goal: "muscle", days: 4, equipment: "full" }, { programs });
    expect(program).toBeTruthy();
    expect(program.familyId).toBe("shape");
    expect(program.trainingDays).toBe(4);
    expect(gap).toBeNull();
  });

  it("maps goal=strength to the titan family", () => {
    const { program } = recommendForBeginner({ experience: "new", goal: "strength", days: 4, equipment: "full" }, { programs });
    expect(program.familyId).toBe("titan");
  });

  it("maps goal=fatloss to the athena family", () => {
    const { program } = recommendForBeginner({ experience: "new", goal: "fatloss", days: 4, equipment: "full" }, { programs });
    expect(program.familyId).toBe("athena");
  });

  it("honestly reports a gap instead of fabricating a frequency the family doesn't offer (Shape has no 6-day variant)", () => {
    const shapeDays = FAMILY_PROGRAMS.filter((p) => p.familyId === "shape").map((p) => p.trainingDays);
    expect(shapeDays).not.toContain(6);
    const { program, gap } = recommendForBeginner({ experience: "new", goal: "muscle", days: 6, equipment: "full" }, { programs });
    expect(program).toBeTruthy(); // still gives a closest-match program, never nothing
    expect(gap).toBeTruthy(); // but says so
    expect(program.familyId).toBe("shape");
  });

  it("reports an equipment gap for home gym rather than silently assuming full-gym exercises work", () => {
    const { equipmentGap } = recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "home" }, { programs });
    expect(equipmentGap).toMatch(/don't have a dedicated home-gym/i);
  });

  it("reports an equipment gap for minimal equipment", () => {
    const { equipmentGap } = recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "minimal" }, { programs });
    expect(equipmentGap).toBeTruthy();
  });

  it("reports no equipment gap for full gym or not-sure-yet", () => {
    expect(recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "full" }, { programs }).equipmentGap).toBeNull();
    expect(recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "unsure" }, { programs }).equipmentGap).toBeNull();
  });

  it("generates plain-language reason lines that name the actual recommended program and frequency", () => {
    const { program, reasonLines } = recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "full" }, { programs });
    expect(reasonLines.join(" ")).toContain(program.name);
    expect(reasonLines.join(" ")).toContain("3 workouts per week");
  });

  it("carries the experience-derived trainingDetail through the result", () => {
    expect(recommendForBeginner({ experience: "experienced", goal: "muscle", days: 3, equipment: "full" }, { programs }).trainingDetail).toBe("advanced");
    expect(recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "full" }, { programs }).trainingDetail).toBe("simple");
  });

  it("never mutates the programs array it reads", () => {
    const before = JSON.stringify(programs);
    recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "full" }, { programs });
    expect(JSON.stringify(programs)).toBe(before);
  });

  it("handles an empty programs list without throwing", () => {
    const { program, reasonLines } = recommendForBeginner({ experience: "new", goal: "muscle", days: 3, equipment: "full" }, { programs: [] });
    expect(program).toBeNull();
    expect(reasonLines).toEqual([]);
  });
});
