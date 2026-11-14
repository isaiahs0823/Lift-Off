import { describe, it, expect } from "vitest";
import { suggestNext, topSetOf, countedSets } from "../progression.js";

// Quality Sprint 01 — Fix 1 (beginner warm-up classification). A beginner who can now tag a
// set "warmup" must have that reflected correctly in the next-session suggestion — the exact
// reason a mis-tagged warmup is a data-correctness defect, not just a labeling nicety.

const exMap = { bench: { id: "bench", name: "Barbell bench press", type: "compound" } };

describe("countedSets / topSetOf — warm-ups excluded from progression math", () => {
  it("topSetOf ignores a warm-up set even when picking the heaviest counted set", () => {
    const sets = [
      { weight: 45, reps: 10, setType: "warmup" },
      { weight: 135, reps: 8, setType: "working" },
      { weight: 135, reps: 8, setType: "working" },
    ];
    expect(topSetOf(sets).weight).toBe(135);
    expect(countedSets(sets)).toHaveLength(2);
  });
});

describe("suggestNext — a light, low-rep warm-up must not suppress a deserved weight increase", () => {
  const baseLog = {
    id: "l1",
    exId: "bench",
    date: "2026-11-10T18:00:00.000Z",
    targetReps: 8,
  };

  it("recommends an increase when every WORKING set hit target reps, even though an earlier warm-up (fewer reps, lighter weight) did not", () => {
    const logs = [
      {
        ...baseLog,
        sets: [
          { weight: 95, reps: 5, setType: "warmup" }, // below target reps — must not count against "allHitTarget"
          { weight: 135, reps: 8, setType: "working" },
          { weight: 135, reps: 8, setType: "working" },
        ],
      },
    ];
    const result = suggestNext("bench", logs, exMap, {});
    expect(result.suggestion).toBeGreaterThan(135);
  });

  it("control: the same reps/weights WITHOUT a warmup tag on the light set incorrectly suppress the increase — proving the tag is what fixes it", () => {
    const logs = [
      {
        ...baseLog,
        sets: [
          { weight: 95, reps: 5 }, // no setType — counted as working, drags allHitTarget to false
          { weight: 135, reps: 8 },
          { weight: 135, reps: 8 },
        ],
      },
    ];
    const result = suggestNext("bench", logs, exMap, {});
    expect(result.suggestion).not.toBeGreaterThan(135);
  });
});
