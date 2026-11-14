import { it, expect, describe } from "vitest";
import { getEquipmentLabel, getMovementTypeLabel, isPlateLoadedEquipment } from "../equipmentDisplay.js";

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
