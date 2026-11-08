import { it, expect, describe } from "vitest";
import { EXERCISE_INSTRUCTIONS, getExerciseInstruction, hasInstructionContent, instructionSteps } from "../exerciseInstructions.js";

describe("EXERCISE_INSTRUCTIONS — structural integrity of every authored entry", () => {
  const entries = Object.entries(EXERCISE_INSTRUCTIONS);

  it("covers a deliberately bounded set (quality over catalog coverage), not hundreds of auto-generated entries", () => {
    expect(entries.length).toBeGreaterThanOrEqual(40);
    expect(entries.length).toBeLessThan(60);
  });

  it("every entry has non-empty setup and execution text", () => {
    for (const [exId, entry] of entries) {
      expect(typeof entry.setup, `${exId}.setup`).toBe("string");
      expect(entry.setup.length, `${exId}.setup should not be empty`).toBeGreaterThan(0);
      expect(typeof entry.execution, `${exId}.execution`).toBe("string");
      expect(entry.execution.length, `${exId}.execution should not be empty`).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one coaching cue", () => {
    for (const [exId, entry] of entries) {
      expect(Array.isArray(entry.cues), `${exId}.cues should be an array`).toBe(true);
      expect(entry.cues.length, `${exId}.cues should not be empty`).toBeGreaterThan(0);
    }
  });

  it("mistakes is always an array (possibly empty, never undefined) — reformatted pre-existing content is honest about not having documented mistakes", () => {
    for (const [exId, entry] of entries) {
      expect(Array.isArray(entry.mistakes), `${exId}.mistakes should be an array`).toBe(true);
    }
  });

  it("no video or image is ever fabricated — every entry's media fields are explicitly null", () => {
    for (const [exId, entry] of entries) {
      expect(entry.video, `${exId}.video`).toBeNull();
      expect(entry.image, `${exId}.image`).toBeNull();
    }
  });

  it("no duplicate or empty exId keys", () => {
    const ids = Object.keys(EXERCISE_INSTRUCTIONS);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id && id.trim().length > 0)).toBe(true);
  });
});

describe("getExerciseInstruction / hasInstructionContent", () => {
  it("returns null for an unknown exId, never throwing", () => {
    expect(getExerciseInstruction("not_a_real_exercise")).toBeNull();
    expect(hasInstructionContent("not_a_real_exercise")).toBe(false);
  });

  it("reports content present for a known exercise", () => {
    expect(hasInstructionContent("deadlift")).toBe(true);
  });
});

describe("instructionSteps — mechanical sentence split, no content invention", () => {
  it("splits a multi-sentence execution paragraph into separate steps", () => {
    const steps = instructionSteps("Do the first part. Then do the second part.");
    expect(steps).toEqual(["Do the first part.", "Then do the second part."]);
  });

  it("falls back to the whole string as one step when it doesn't split cleanly", () => {
    expect(instructionSteps("no terminal punctuation here")).toEqual(["no terminal punctuation here"]);
  });

  it("returns an empty array for empty input, never throwing", () => {
    expect(instructionSteps("")).toEqual([]);
    expect(instructionSteps(undefined)).toEqual([]);
  });
});
