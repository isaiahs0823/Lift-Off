import { describe, it, expect } from "vitest";
import { isWarmup, countedSets, getSetDisplayDesignation, hasNotableDesignation, SET_TYPES } from "../workoutSets.js";

// Quality Sprint 01 — Fix 1 (beginner warm-up classification). These cover the shared
// classification/analytics helper every surface (volume, PRs, progression, share cards,
// coach memory, goals) reads sets through, so correctness here is correctness everywhere.

describe("isWarmup", () => {
  it("is true only for a set explicitly tagged warmup", () => {
    expect(isWarmup({ weight: 45, reps: 10, setType: "warmup" })).toBe(true);
  });
  it("defaults to false (working) for a set with no setType at all — pre-feature history", () => {
    expect(isWarmup({ weight: 135, reps: 8 })).toBe(false);
  });
  it("is false for an explicit working set and for other technique tags", () => {
    expect(isWarmup({ weight: 135, reps: 8, setType: "working" })).toBe(false);
    expect(isWarmup({ weight: 135, reps: 8, setType: "amrap" })).toBe(false);
  });
  it("fails safe to false for an unrecognized/corrupted setType value", () => {
    expect(isWarmup({ weight: 135, reps: 8, setType: "banana" })).toBe(false);
  });
});

describe("countedSets", () => {
  it("excludes warm-up sets from the working-set list used for volume/PR/progression", () => {
    const sets = [
      { weight: 45, reps: 10, setType: "warmup" },
      { weight: 135, reps: 8, setType: "working" },
      { weight: 135, reps: 8, setType: "working" },
    ];
    const counted = countedSets(sets);
    expect(counted).toHaveLength(2);
    expect(counted.every((s) => s.weight === 135)).toBe(true);
  });

  it("never mutates or drops the warm-up set from the original confirmed-sets array — it is preserved, only excluded from counting", () => {
    const sets = [
      { weight: 45, reps: 10, setType: "warmup" },
      { weight: 135, reps: 8, setType: "working" },
    ];
    countedSets(sets);
    expect(sets).toHaveLength(2);
    expect(sets[0]).toEqual({ weight: 45, reps: 10, setType: "warmup" });
  });

  it("returns every set when none are warm-ups (unchanged existing-workout behavior)", () => {
    const sets = [{ weight: 100, reps: 10 }, { weight: 105, reps: 8 }];
    expect(countedSets(sets)).toHaveLength(2);
  });
});

describe("getSetDisplayDesignation — warm-up takes priority over any other designation", () => {
  it("reads 'Warm-up' even if (invalidly) a programRole were also present", () => {
    expect(getSetDisplayDesignation({ setType: "warmup", programRole: "top" })).toBe("Warm-up");
  });
  it("reads 'Working' for the plain default", () => {
    expect(getSetDisplayDesignation({ weight: 135, reps: 8 })).toBe("Working");
  });
});

describe("hasNotableDesignation — a plain warm-up is not flagged as a separate notable badge", () => {
  it("is false for a plain warm-up (warm-up has its own distinct marker elsewhere, not double-labeled)", () => {
    expect(hasNotableDesignation({ setType: "warmup" })).toBe(false);
  });
});

describe("SET_TYPES data — the full advanced-mode list still includes warm-up as one option", () => {
  it("has exactly one warmup entry beginners' minimal toggle maps onto", () => {
    const warmup = SET_TYPES.find((t) => t.value === "warmup");
    expect(warmup).toBeTruthy();
    expect(warmup.label).toBe("Warm-up");
  });
});
