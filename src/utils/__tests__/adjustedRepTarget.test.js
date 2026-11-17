import { describe, it, expect } from "vitest";
import { computeAdjustedRepTarget, isAdjustedRepTargetCompatible, adjustedRepTargetCue } from "../adjustedRepTarget.js";

describe("computeAdjustedRepTarget — inverse Epley math", () => {
  it("225 lb x 10 -> 245 lb gives ~7 reps (the task's own worked example)", () => {
    const r = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 245, targetRIR: 0 });
    expect(r.reps).toBe(7);
    expect(r.outOfModelRange).toBe(false);
  });

  it("a lighter load gives MORE reps, not fewer", () => {
    const r = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 205, targetRIR: 0 });
    expect(r.reps).toBeGreaterThan(10);
    expect(r.reps).toBe(14);
  });

  it("the exact same weight restores the exact original rep target (ratio = 1)", () => {
    const r = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 225, targetRIR: 0 });
    expect(r.reps).toBe(10);
    expect(r.raw).toBe(10);
  });

  it("repeated weight changes never compound rounding — always recomputed fresh from the same original inputs", () => {
    const original = { originalWeight: 225, originalReps: 10, targetRIR: 1 };
    const a = computeAdjustedRepTarget({ ...original, newWeight: 245 });
    const b = computeAdjustedRepTarget({ ...original, newWeight: 235 });
    const c = computeAdjustedRepTarget({ ...original, newWeight: 245 }); // back to the same weight as `a`
    expect(c.reps).toBe(a.reps);
    expect(c.raw).toBe(a.raw); // not just the rounded display value — the raw (unrounded) result is byte-identical too
    // b is a genuinely different computation (different weight), not influenced by a's result at all.
    expect(b.raw).not.toBe(a.raw);
  });

  it("returning all the way back to the original weight restores the original reps exactly, even after several intermediate changes", () => {
    const original = { originalWeight: 225, originalReps: 10, targetRIR: 2 };
    computeAdjustedRepTarget({ ...original, newWeight: 245 });
    computeAdjustedRepTarget({ ...original, newWeight: 275 });
    computeAdjustedRepTarget({ ...original, newWeight: 195 });
    const backToOriginal = computeAdjustedRepTarget({ ...original, newWeight: 225 });
    expect(backToOriginal.reps).toBe(10);
    expect(backToOriginal.raw).toBe(10);
  });

  it("uses the prescribed targetRIR in the calculation when provided", () => {
    const withRir = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 245, targetRIR: 2 });
    const withoutRir = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 245, targetRIR: 0 });
    expect(withRir.raw).not.toBe(withoutRir.raw);
  });

  it("lb/kg equivalence: the result is identical whether the inputs are in lb or a consistent kg scaling (pure ratio formula)", () => {
    const lb = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 245, targetRIR: 1 });
    const KG = 0.45359237;
    const kg = computeAdjustedRepTarget({ originalWeight: 225 * KG, originalReps: 10, newWeight: 245 * KG, targetRIR: 1 });
    expect(kg.reps).toBe(lb.reps);
    expect(kg.raw).toBeCloseTo(lb.raw, 9);
  });

  it("an out-of-model-range result (very light new weight) is flagged, not presented as reliable", () => {
    const r = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 50, targetRIR: 0 });
    expect(r.outOfModelRange).toBe(true);
    expect(r.reps).toBeGreaterThan(30);
  });

  it("an out-of-model-range result (much heavier new weight, forcing near-zero or negative reps) is flagged", () => {
    const r = computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 500, targetRIR: 0 });
    expect(r.outOfModelRange).toBe(true);
    expect(r.reps).toBeLessThan(1);
  });

  it("returns null for invalid inputs (zero/negative/missing weight or reps) rather than NaN/Infinity", () => {
    expect(computeAdjustedRepTarget({ originalWeight: 0, originalReps: 10, newWeight: 245 })).toBeNull();
    expect(computeAdjustedRepTarget({ originalWeight: 225, originalReps: 0, newWeight: 245 })).toBeNull();
    expect(computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: 0 })).toBeNull();
    expect(computeAdjustedRepTarget({ originalWeight: 225, originalReps: 10, newWeight: -50 })).toBeNull();
  });
});

describe("isAdjustedRepTargetCompatible — exercise scoping", () => {
  it("accepts an ordinary compound/isolation barbell or machine exercise", () => {
    expect(isAdjustedRepTargetCompatible({ name: "Barbell bench press", type: "compound" })).toBe(true);
    expect(isAdjustedRepTargetCompatible({ name: "Leg extension machine", type: "isolation" })).toBe(true);
  });

  it("skips bodyweight-only movements", () => {
    expect(isAdjustedRepTargetCompatible({ name: "Push-up", type: "compound" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Wide-Grip Pull-Up", type: "compound" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Chest dip", type: "compound" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Bodyweight Squat", type: "compound" })).toBe(false);
  });

  it("skips the WEIGHTED variant of a bodyweight movement family too — the logged weight is added resistance, not total load", () => {
    // All three are BRK's only "Weighted ..." naming variants of a bodyweight-family movement
    // (confirmed against the full exercise library). The inverse-Epley ratio math assumes the
    // weight field is the full load; for these it's only the added plate/dumbbell, so +25 lb ->
    // +35 lb would otherwise read as a ~40% load jump and produce a misleading rep target.
    expect(isAdjustedRepTargetCompatible({ name: "Weighted pull-up", type: "compound" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Weighted chin-up", type: "compound" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Weighted dip", type: "compound" })).toBe(false);
  });

  it("skips assisted movements, even a weighted-sounding one", () => {
    expect(isAdjustedRepTargetCompatible({ name: "Assisted pull-up machine", type: "compound" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Hammer Strength Assisted Dip", type: "compound" })).toBe(false);
  });

  it("skips timed/carry movements, even when externally loaded", () => {
    expect(isAdjustedRepTargetCompatible({ name: "Farmer's carry", type: "compound" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Weighted plank", type: "isolation" })).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Handstand Hold", type: "isolation" })).toBe(false);
  });

  it("rejects a missing/malformed exercise entry defensively", () => {
    expect(isAdjustedRepTargetCompatible(null)).toBe(false);
    expect(isAdjustedRepTargetCompatible({})).toBe(false);
    expect(isAdjustedRepTargetCompatible({ name: "Mystery move" })).toBe(false); // no type
  });
});

describe("adjustedRepTargetCue — the full cue BRK shows next to Weight/Reps", () => {
  const bench = { name: "Barbell bench press", type: "compound" };
  const pushup = { name: "Push-up", type: "compound" };

  it("the worked example: 225x10 suggested, weight changed to 245 -> 'Aim for 7 reps'", () => {
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: 225, originalReps: 10, newWeight: 245 });
    expect(cue.outOfRange).toBe(false);
    expect(cue.reps).toBe(7);
    expect(cue.label).toBe("Aim for 7 reps (rough estimate)"); // no prescribed RIR here
  });

  it("with a prescribed RIR range, shows plain-language effort guidance alongside the rep target", () => {
    const cue = adjustedRepTargetCue({
      ex: bench,
      exSlot: { sets: 3, reps: 10, repRange: [6, 12], rir: [2, 2] },
      setType: "working",
      originalWeight: 225,
      originalReps: 10,
      newWeight: 245,
    });
    expect(cue.outOfRange).toBe(false);
    expect(cue.isEstimate).toBe(false);
    expect(cue.label).toBe("Aim for 7 reps · Leave 2 reps in reserve");
  });

  it("a genuine RIR range (not a flat point) is shown as a range in the reserve label", () => {
    const cue = adjustedRepTargetCue({
      ex: bench,
      exSlot: { sets: 3, reps: 10, rir: [1, 2] },
      setType: "working",
      originalWeight: 225,
      originalReps: 10,
      newWeight: 245,
    });
    expect(cue.label).toContain("Leave 1–2 reps in reserve");
  });

  it("no prescribed RIR -> labeled as a rough estimate", () => {
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: 225, originalReps: 10, newWeight: 245 });
    expect(cue.isEstimate).toBe(true);
    expect(cue.label).toContain("rough estimate");
  });

  it("revert to the original weight: the cue reflects the original target exactly", () => {
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: 225, originalReps: 10, newWeight: 225 });
    expect(cue.reps).toBe(10);
  });

  it("manual rep entry is never touched by this — the cue is independent of whatever is typed into reps", () => {
    // adjustedRepTargetCue never reads/returns anything that would overwrite the reps input;
    // its only output is a read-only label. This asserts the function's own contract: it takes
    // no "currentTypedReps" argument at all and cannot influence it.
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: 225, originalReps: 10, newWeight: 245 });
    expect(cue).not.toHaveProperty("setReps");
    expect(typeof cue.reps).toBe("number"); // a plain suggestion value, not a mutation of any kind
  });

  it("out-of-range vs. the program's own prescribed repRange says 'Outside the target rep range'", () => {
    // 225x10 -> 400 lb implies ~1-2 reps, outside this program's prescribed 6-12 rep range.
    const cue = adjustedRepTargetCue({
      ex: bench,
      exSlot: { sets: 3, reps: 10, repRange: [6, 12] },
      setType: "working",
      originalWeight: 225,
      originalReps: 10,
      newWeight: 400,
    });
    expect(cue.outOfRange).toBe(true);
    expect(cue.label).toBe("Outside the target rep range");
  });

  it("out-of-range vs. the model's own supported range (no repRange prescribed at all)", () => {
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: 225, originalReps: 10, newWeight: 50 });
    expect(cue.outOfRange).toBe(true);
    expect(cue.label).toBe("Outside the target rep range");
  });

  it("warm-up sets are skipped entirely", () => {
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "warmup", originalWeight: 225, originalReps: 10, newWeight: 245 });
    expect(cue).toBeNull();
  });

  it("bodyweight-only exercises are skipped entirely, even with a seemingly valid weight/reps baseline", () => {
    const cue = adjustedRepTargetCue({ ex: pushup, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: 0, originalReps: 20, newWeight: 0 });
    expect(cue).toBeNull();
  });

  describe("weighted bodyweight edge case (weighted pull-ups/chin-ups/dips)", () => {
    // Realistic added-weight scenario: a dip belt moving from +25 lb to +35 lb is a genuinely
    // valid weight/reps entry (not zero, not missing) that would otherwise trigger a cue — the
    // formula would treat it as a ~40% total-load jump (25 -> 35) when it's really a much smaller
    // change in true total load (bodyweight + added weight). The cue must stay hidden here, while
    // the Weight/Reps fields themselves stay fully usable (adjustedRepTargetCue never touches
    // those — it only ever returns a label or null).
    const weightedPullup = { name: "Weighted pull-up", type: "compound" };
    const weightedChinup = { name: "Weighted chin-up", type: "compound" };
    const weightedDip = { name: "Weighted dip", type: "compound" };

    it("weighted pull-up: no cue even for a clearly-valid +25 lb -> +35 lb change", () => {
      const cue = adjustedRepTargetCue({ ex: weightedPullup, exSlot: { sets: 3, reps: 8 }, setType: "working", originalWeight: 25, originalReps: 8, newWeight: 35 });
      expect(cue).toBeNull();
    });

    it("weighted chin-up: no cue even for a clearly-valid +25 lb -> +35 lb change", () => {
      const cue = adjustedRepTargetCue({ ex: weightedChinup, exSlot: { sets: 3, reps: 7 }, setType: "working", originalWeight: 25, originalReps: 7, newWeight: 35 });
      expect(cue).toBeNull();
    });

    it("weighted dip: no cue even for a clearly-valid +25 lb -> +35 lb change", () => {
      const cue = adjustedRepTargetCue({ ex: weightedDip, exSlot: { sets: 3, reps: 8, repRange: [6, 10] }, setType: "working", originalWeight: 25, originalReps: 8, newWeight: 35 });
      expect(cue).toBeNull();
    });

    it("stays null across the full range of weight changes an athlete might make, not just the one example above", () => {
      for (const newWeight of [0.1, 5, 15, 25, 35, 45, 90]) {
        expect(adjustedRepTargetCue({ ex: weightedPullup, exSlot: { sets: 3, reps: 8 }, setType: "working", originalWeight: 25, originalReps: 8, newWeight })).toBeNull();
      }
    });
  });

  it("no suggestion yet (no load/rep recommendation) -> no cue, preserving plain manual logging", () => {
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: null, originalReps: null, newWeight: 245 });
    expect(cue).toBeNull();
  });

  it("no weight typed in yet -> no cue", () => {
    const cue = adjustedRepTargetCue({ ex: bench, exSlot: { sets: 3, reps: 10 }, setType: "working", originalWeight: 225, originalReps: 10, newWeight: "" });
    expect(cue).toBeNull();
  });
});
