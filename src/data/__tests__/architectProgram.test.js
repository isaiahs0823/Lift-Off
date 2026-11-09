import { describe, it, expect } from "vitest";
import { FAMILY_PROGRAMS, PROGRAM_FAMILIES } from "../programFamilies.js";
import { EXERCISE_LIBRARY } from "../../App.jsx";

// THE ARCHITECT (BRK Owner Edition) — locked personal programming spec. These assertions pin
// the exact exercise order, set counts, and catalog ids the spec requires, so a future edit to
// programFamilies.js can't silently drift from the approved program.
const EXERCISE_IDS = new Set(EXERCISE_LIBRARY.map((e) => e.id));

function architectProgram() {
  return FAMILY_PROGRAMS.find((p) => p.familyId === "architect");
}

describe("THE ARCHITECT program", () => {
  it("is registered exactly once as a 5-day, 12-week family", () => {
    const matches = PROGRAM_FAMILIES.filter((f) => f.familyId === "architect");
    expect(matches).toHaveLength(1);
    expect(Object.keys(matches[0].variants)).toEqual(["5"]);
    const prog = architectProgram();
    expect(prog).toBeTruthy();
    expect(prog.weeks).toBe(12);
    expect(prog.trainingDays).toBe(5);
    expect(prog.name).toBe("The Architect");
  });

  it("has every exercise id resolving in the real exercise catalog", () => {
    const prog = architectProgram();
    for (const day of prog.days) {
      for (const ex of day.exercises) {
        expect(EXERCISE_IDS.has(ex.exId), `${ex.exId} (day "${day.label}") is missing from EXERCISE_LIBRARY`).toBe(true);
      }
    }
  });

  it("has no duplicate catalog ids for the two newly-added exercises", () => {
    const kelso = EXERCISE_LIBRARY.filter((e) => e.id === "kelso_shrug");
    const beltSplit = EXERCISE_LIBRARY.filter((e) => e.id === "belt_squat_split_squat");
    expect(kelso).toHaveLength(1);
    expect(beltSplit).toHaveLength(1);
  });

  it("preserves the exact day order and labels from the spec", () => {
    const prog = architectProgram();
    expect(prog.days.map((d) => d.label)).toEqual(["Push", "Pull", "Legs A", "Upper", "Legs B"]);
  });

  it("preserves the exact exercise order and working-set totals per day", () => {
    const prog = architectProgram();
    const expected = {
      Push: { exIds: ["pec_deck", "hammer_strength_iso_incline_press", "seated_ohp_machine", "hammer_strength_iso_chest_press", "lat_raise_machine", "tricep_pushdown"], sets: 13 },
      Pull: { exIds: ["hammer_strength_iso_front_lat_pulldown", "chest_supported_row", "hammer_strength_iso_row", "kelso_shrug", "bicep_curl_machine", "incline_db_curl"], sets: 14 },
      "Legs A": { exIds: ["hip_adduction_machine", "leg_curl_lying", "leg_extension", "leg_press", "hack_squat", "calf_raise_seated"], sets: 13 },
      Upper: { exIds: ["hammer_strength_iso_incline_press", "chest_supported_row", "pec_deck", "single_arm_pulldown", "lat_raise_machine", "rear_delt_machine"], sets: 13 },
      "Legs B": { exIds: ["leg_curl_seated", "hip_adduction_machine", "hammer_strength_belt_squat", "belt_squat_split_squat", "leg_extension", "calf_raise_seated"], sets: 13 },
    };
    for (const day of prog.days) {
      const spec = expected[day.label];
      expect(day.exercises.map((e) => e.exId)).toEqual(spec.exIds);
      expect(day.exercises.reduce((sum, e) => sum + e.sets, 0)).toBe(spec.sets);
    }
  });

  it("never touches any other registered family", () => {
    const names = PROGRAM_FAMILIES.map((f) => f.familyId);
    expect(new Set(names).size).toBe(names.length); // no accidental familyId collisions
  });
});
