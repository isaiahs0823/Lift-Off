import { it, expect, describe } from "vitest";
import { EXERCISE_INSTRUCTIONS } from "../exerciseInstructions.js";

// Quality Sprint 01, final pass — every confirmed plate-loaded exercise in BRK's catalog should
// teach control through the repetition, especially the lowering (eccentric) phase. This is the
// exact set of real catalog exId's identified as plate-loaded during that audit (App.jsx), kept
// here as a flat list (same pattern equipmentDisplay.test.js already uses — literal, verified
// exercise data, not a live import of the App.jsx catalog) so a regression in either direction —
// an exId silently losing its entry, or the catalog adding a new plate-loaded exercise with none
// — is caught without needing to parse JSX in a test.
const CONFIRMED_PLATE_LOADED_IDS = [
  // Already had real content before this pass — needed a genuine control/tempo cue appended.
  // leg_press and barbell_curl looked like they already had one on a loose keyword match (their
  // existing cue contains "don't let"), but on inspection that cue is about hip/elbow
  // POSITIONING, not controlling the weight's tempo — so they needed one too, same as the rest.
  "bench", "incline_bench", "barbell_row", "ohp", "hack_squat", "hip_thrust", "leg_press", "barbell_curl",
  // Had zero content before this pass — minimal cues-only entries created.
  "decline_bench", "smith_bench", "incline_smith_press", "trap_bar_deadlift", "t_bar_row",
  "barbell_pullover", "shrug_barbell", "smith_ohp", "smith_squat", "vertical_leg_press",
  "pendulum_squat", "leg_press_calf_raise", "preacher_curl",
  "arsenal_linear_leg_press", "arsenal_linear_hack_squat", "arsenal_belt_squat",
  "hammer_strength_iso_bench_press", "hammer_strength_iso_horizontal_bench_press",
  "hammer_strength_iso_incline_press", "hammer_strength_iso_super_incline_press",
  "hammer_strength_iso_decline_chest_press", "hammer_strength_iso_wide_chest_press",
  "hammer_strength_iso_chest_press", "hammer_strength_plate_super_fly",
  "hammer_strength_chest_back_chest_press", "hammer_strength_iso_row",
  "hammer_strength_iso_low_row", "hammer_strength_iso_dy_row", "hammer_strength_t_bar_row",
  "hammer_strength_iso_wide_pulldown", "hammer_strength_iso_front_lat_pulldown",
  "hammer_strength_plate_pullover", "hammer_strength_chest_back_lat_pulldown",
  "hammer_strength_iso_shoulder_press", "hammer_strength_plate_seated_biceps",
  "hammer_strength_plate_seated_dip", "hammer_strength_plate_gripper",
  "hammer_strength_linear_leg_press", "hammer_strength_hack_squat",
  "hammer_strength_pendulum_x_squat", "hammer_strength_belt_squat", "belt_squat_split_squat",
  "hammer_strength_ground_base_multi_squat", "hammer_strength_iso_leg_extension",
  "hammer_strength_iso_kneeling_leg_curl", "hammer_strength_plate_glute_drive",
  "hammer_strength_plate_seated_calf_raise", "hammer_strength_plate_tibia_dorsi_flexion",
  "hammer_strength_plate_ab_oblique_crunch",
];

const CONTROL_KEYWORDS = /\bcontrol\b|momentum|\bdrop\b|bounce|\bswing\b|eccentric|yank/i;

describe("every confirmed plate-loaded exercise has a control-focused tip", () => {
  it("has an EXERCISE_INSTRUCTIONS entry at all", () => {
    for (const exId of CONFIRMED_PLATE_LOADED_IDS) {
      expect(EXERCISE_INSTRUCTIONS[exId], exId).toBeTruthy();
    }
  });

  it("that entry's cues include at least one control-focused tip", () => {
    for (const exId of CONFIRMED_PLATE_LOADED_IDS) {
      const cues = EXERCISE_INSTRUCTIONS[exId]?.cues || [];
      const hasControl = cues.some((c) => CONTROL_KEYWORDS.test(c));
      expect(hasControl, `${exId} cues: ${JSON.stringify(cues)}`).toBe(true);
    }
  });

  it("no entry has more than one control-focused cue (no duplicate guidance)", () => {
    for (const exId of CONFIRMED_PLATE_LOADED_IDS) {
      const cues = EXERCISE_INSTRUCTIONS[exId]?.cues || [];
      const controlCues = cues.filter((c) => CONTROL_KEYWORDS.test(c));
      expect(controlCues.length, `${exId}: ${JSON.stringify(controlCues)}`).toBe(1);
    }
  });
});

describe("acceptance test: the real Hammer Strength plate-loaded leg extension", () => {
  // The task's own phrase, "Hammer Strength Plate Loaded Leg Extension," does not exist verbatim
  // in the catalog — per the catalog's documented equipment-family comment, BRK's classic
  // plate-loaded Hammer Strength line is named "Iso-Lateral," not "Plate Loaded" (that word is
  // reserved for a different HS sub-line that explicitly spells it out, e.g. "Plate-Loaded Super
  // Fly"). The real plate-loaded leg extension in the catalog is
  // hammer_strength_iso_leg_extension ("Hammer Strength Iso-Lateral Leg Extension") — confirmed
  // in App.jsx, muscle: "Legs". The pin-stack "Select"/"MTS" leg extension variants are separate,
  // correctly-excluded exId's.
  const exId = "hammer_strength_iso_leg_extension";

  it("has a real instructional entry (not the 'no demonstration yet' fallback)", () => {
    expect(EXERCISE_INSTRUCTIONS[exId]).toBeTruthy();
  });

  it("displays a clear, control-focused tip", () => {
    const cues = EXERCISE_INSTRUCTIONS[exId].cues;
    expect(cues.length).toBeGreaterThan(0);
    expect(CONTROL_KEYWORDS.test(cues[0])).toBe(true);
  });

  it("never fabricates setup/execution/video/image for this minimal entry", () => {
    const entry = EXERCISE_INSTRUCTIONS[exId];
    expect(entry.setup).toBeUndefined();
    expect(entry.execution).toBeUndefined();
    expect(entry.video).toBeNull();
    expect(entry.image).toBeNull();
  });
});

describe("existing useful tips are preserved, not replaced", () => {
  it("bench keeps its original stance/shoulder-blade cue alongside the new control tip", () => {
    expect(EXERCISE_INSTRUCTIONS.bench.cues).toContain(
      "Keep your feet flat on the floor and your shoulder blades pulled together and down."
    );
  });
  it("barbell_row keeps its original flat-back cue alongside the new control tip", () => {
    expect(EXERCISE_INSTRUCTIONS.barbell_row.cues).toContain("Keep your back flat throughout — if it rounds, lighten the weight.");
  });
  it("leg_press keeps its original hip-position cue alongside the new control tip", () => {
    expect(EXERCISE_INSTRUCTIONS.leg_press.cues).toContain(
      "Keep your lower back flat against the pad — don't let your hips round up off it at the bottom."
    );
  });
  it("barbell_curl keeps its original elbow-position cue alongside the new control tip", () => {
    expect(EXERCISE_INSTRUCTIONS.barbell_curl.cues).toContain("Keep your elbows pinned at your sides — don't let them drift forward.");
  });
});
