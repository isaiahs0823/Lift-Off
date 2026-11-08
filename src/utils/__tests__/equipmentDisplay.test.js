import { it, expect, describe } from "vitest";
import { getEquipmentLabel, getMovementTypeLabel } from "../equipmentDisplay.js";

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
