import { describe, it, expect } from "vitest";
import { PHOTOGRAPHY_MANIFEST, hasPhotography, resolveProgramCoverSlot } from "../../content/photographyManifest.js";

const REQUIRED_SLOTS = [
  "onboardingHero",
  "todayHeader",
  "programCoverStrength",
  "programCoverHypertrophy",
  "programCoverConditioning",
  "programCoverRecovery",
  "programCoverTitan",
  "programCoverAthena",
  "programCoverShape",
  "programCoverBerserker",
];

describe("photography manifest", () => {
  it("defines all six required slots", () => {
    for (const key of REQUIRED_SLOTS) {
      expect(PHOTOGRAPHY_MANIFEST[key]).toBeDefined();
    }
  });

  it("gives every slot a usage, aspect ratio, crop, alt text, and fallback treatment", () => {
    for (const [key, slot] of Object.entries(PHOTOGRAPHY_MANIFEST)) {
      expect(slot.usage, key).toBeTruthy();
      expect(slot.aspectRatio, key).toBeTruthy();
      expect(slot.crop, key).toBeTruthy();
      expect(slot.alt, key).toBeTruthy();
      expect(slot.fallback, key).toBeTruthy();
    }
  });

  it("ships with no imagery configured — nothing fabricated or downloaded", () => {
    for (const [key, slot] of Object.entries(PHOTOGRAPHY_MANIFEST)) {
      expect(hasPhotography(key), key).toBe(false);
      expect(slot.sources.avif).toBeNull();
      expect(slot.sources.webp).toBeNull();
      expect(slot.sources.fallback).toBeNull();
    }
  });

  it("hasPhotography is true once any one source is present", () => {
    PHOTOGRAPHY_MANIFEST._test = { sources: { avif: null, webp: null, fallback: "/images/x.jpg" } };
    expect(hasPhotography("_test")).toBe(true);
    delete PHOTOGRAPHY_MANIFEST._test;
  });

  it("returns false for an unknown slot instead of throwing", () => {
    expect(hasPhotography("doesNotExist")).toBe(false);
  });
});

describe("resolveProgramCoverSlot", () => {
  it("resolves each known family to its own cover slot", () => {
    expect(resolveProgramCoverSlot({ familyId: "titan" })).toBe("programCoverTitan");
    expect(resolveProgramCoverSlot({ familyId: "athena" })).toBe("programCoverAthena");
    expect(resolveProgramCoverSlot({ familyId: "shape" })).toBe("programCoverShape");
  });

  it("resolves Berserker by its program id, not a familyId (it has none)", () => {
    expect(resolveProgramCoverSlot({ id: "prog_berserker" })).toBe("programCoverBerserker");
  });

  it("returns null for a custom program — stock photography never covers an athlete's own creation", () => {
    expect(resolveProgramCoverSlot({ id: "custom_123", familyId: undefined })).toBeNull();
  });

  it("returns null for an unrecognized family or standalone program, rather than throwing", () => {
    expect(resolveProgramCoverSlot({ familyId: "some-future-family" })).toBeNull();
    expect(resolveProgramCoverSlot({ id: "prog_some_future_program" })).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(resolveProgramCoverSlot(null)).toBeNull();
    expect(resolveProgramCoverSlot(undefined)).toBeNull();
  });
});
