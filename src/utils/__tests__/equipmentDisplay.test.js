import { it, expect, describe } from "vitest";
import { getEquipmentLabel, getMovementTypeLabel, isPlateLoadedEquipment, isExactPlateLoad } from "../equipmentDisplay.js";

describe("getEquipmentLabel — honest name-keyword inference, never a fabricated guess", () => {
  it("recognizes Smith machine before the generic machine rule", () => {
    expect(getEquipmentLabel({ name: "Smith machine bench press" })).toBe("Smith Machine");
  });
  it("recognizes barbell, dumbbell, cable, and plain machine exercises", () => {
    expect(getEquipmentLabel({ name: "Barbell row" })).toBe("Barbell");
    expect(getEquipmentLabel({ name: "Flat dumbbell press" })).toBe("Dumbbell");
    expect(getEquipmentLabel({ name: "Cable fly (mid)" })).toBe("Cable");
    expect(getEquipmentLabel({ name: "Leg press" })).toBe("Machine");
    expect(getEquipmentLabel({ name: "Pec deck / chest fly machine" })).toBe("Machine");
  });
  it("recognizes bodyweight movements", () => {
    expect(getEquipmentLabel({ name: "Push-up" })).toBe("Bodyweight");
    expect(getEquipmentLabel({ name: "Weighted pull-up" })).toBe("Bodyweight");
  });
  it("returns null (never a guess) for a name with no recognizable equipment keyword", () => {
    expect(getEquipmentLabel({ name: "Arnold press" })).toBeNull();
    expect(getEquipmentLabel({ name: "Front raise" })).toBeNull();
  });
  it("never throws on missing/malformed input", () => {
    expect(getEquipmentLabel(null)).toBeNull();
    expect(getEquipmentLabel({})).toBeNull();
    expect(getEquipmentLabel({ name: 42 })).toBeNull();
  });
});

// Quality Sprint 01, Phase 3: the Plate Calculator must only be offered for equipment a barbell
// plate actually goes on — never for a dumbbell/cable/kettlebell/band/bodyweight exercise, where
// it's a confusing, honestly wrong control.
describe("isPlateLoadedEquipment", () => {
  it("is true for a barbell exercise", () => {
    expect(isPlateLoadedEquipment({ name: "Barbell bench press" })).toBe(true);
  });
  it("is true for a Smith machine exercise", () => {
    expect(isPlateLoadedEquipment({ name: "Smith machine squat" })).toBe(true);
  });
  it("is true for the plate-loaded machines (leg press, hack squat)", () => {
    expect(isPlateLoadedEquipment({ name: "Leg press (45 degree)" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Hack squat machine" })).toBe(true);
  });
  it("is false for a pin-stack machine, even though it's still the broad 'Machine' category", () => {
    expect(isPlateLoadedEquipment({ name: "Lat pulldown" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Leg extension machine" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Leg curl machine" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Pec deck / chest fly machine" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Assisted pull-up machine" })).toBe(false);
  });
  it("is false for dumbbell, cable, kettlebell, band, and bodyweight exercises", () => {
    expect(isPlateLoadedEquipment({ name: "Dumbbell shoulder press" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Seated cable row" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Kettlebell swing" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Band pull-apart" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Push-up" })).toBe(false);
  });
  it("is false (never a guess) when equipment can't be confidently inferred from the name", () => {
    expect(isPlateLoadedEquipment({ name: "Arnold press" })).toBe(false);
  });
  it("never throws on missing/malformed input", () => {
    expect(isPlateLoadedEquipment(null)).toBe(false);
    expect(isPlateLoadedEquipment({})).toBe(false);
  });

  // Quality Sprint 01, final pass — the Hammer Strength line names its own equipment family in
  // the exercise name (see App.jsx's "Hammer Strength line" catalog comment): "Select" and "MTS"
  // are selectorized/pin-stack, "Assisted" is weight-assisted — none of those are plate-loaded,
  // even though some of them also contain a movement-type keyword ("leg press") that would
  // otherwise match the generic rule.
  it("is true for Hammer Strength's plate-loaded sub-lines (plain Iso-Lateral, explicit Plate-Loaded, Ground Base, T-Bar Row, Linear Leg Press, Hack Squat, Pendulum-X Squat, Belt Squat)", () => {
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Iso-Lateral Bench Press" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Plate-Loaded Super Fly" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Ground Base Multi-Squat" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength T-Bar Row" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Linear Leg Press" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Hack Squat" })).toBe(true);
  });
  it("is false for Hammer Strength's selectorized/assisted sub-lines, even when the name also contains a plate-loaded movement keyword", () => {
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Select Chest Press" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength MTS Iso-Lateral Chest Press" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Select Seated Leg Press" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Assisted Chin-Up" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Hammer Strength Assisted Dip" })).toBe(false);
  });
  it("is true for a non-Hammer-Strength leverage machine by movement type, regardless of brand (Arsenal, or no brand prefix at all)", () => {
    expect(isPlateLoadedEquipment({ name: "Arsenal Linear Leg Press" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Arsenal Linear Hack Squat" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Arsenal Belt Squat" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "T-bar row" })).toBe(true);
    expect(isPlateLoadedEquipment({ name: "Pendulum squat machine" })).toBe(true);
  });
  it("stays honestly unclassified (false) for equipment it cannot confidently infer — never a blanket guess based on brand name alone", () => {
    // Real Arsenal Strength catalog entries with no recognizable plate-loaded movement keyword.
    // Arsenal happens to build only plate-loaded equipment in real life, but nothing in this data
    // says so, so this deliberately does NOT assume it from the brand name.
    expect(isPlateLoadedEquipment({ name: "Arsenal Standing Chest Press" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Arsenal Lever Row" })).toBe(false);
    expect(isPlateLoadedEquipment({ name: "Arsenal Viking Press" })).toBe(false);
  });
});

describe("isExactPlateLoad — distinguishes a true barbell/Smith-machine load from a leverage machine's approximate one", () => {
  it("is true (exact) for a plain barbell or Smith machine", () => {
    expect(isExactPlateLoad({ name: "Barbell bench press" })).toBe(true);
    expect(isExactPlateLoad({ name: "Smith machine squat" })).toBe(true);
  });
  it("is false (approximate) for a leverage/leg-press/hack-squat machine, even though it's still plate-loaded", () => {
    expect(isExactPlateLoad({ name: "Leg press (45 degree)" })).toBe(false);
    expect(isExactPlateLoad({ name: "Hack squat machine" })).toBe(false);
    expect(isExactPlateLoad({ name: "T-bar row" })).toBe(false);
  });
  it("is false (approximate) for any Hammer Strength plate-loaded machine", () => {
    expect(isExactPlateLoad({ name: "Hammer Strength Iso-Lateral Bench Press" })).toBe(false);
    expect(isExactPlateLoad({ name: "Hammer Strength Linear Leg Press" })).toBe(false);
  });
  it("never throws on missing/malformed input", () => {
    expect(isExactPlateLoad(null)).toBe(false);
    expect(isExactPlateLoad({})).toBe(false);
  });
});

describe("getMovementTypeLabel — the one real, non-fabricated categorization BRK's data has", () => {
  it("maps compound/isolation to their display labels", () => {
    expect(getMovementTypeLabel({ type: "compound" })).toBe("Compound");
    expect(getMovementTypeLabel({ type: "isolation" })).toBe("Isolation");
  });
  it("returns null for anything else rather than inventing a label", () => {
    expect(getMovementTypeLabel({ type: "cardio" })).toBeNull();
    expect(getMovementTypeLabel({})).toBeNull();
    expect(getMovementTypeLabel(null)).toBeNull();
  });
});
