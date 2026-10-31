import { describe, it, expect } from "vitest";
import { PHOTOGRAPHY_MANIFEST, hasPhotography } from "../../content/photographyManifest.js";

const REQUIRED_SLOTS = ["onboardingHero", "todayHeader", "programCoverStrength", "programCoverHypertrophy", "programCoverConditioning", "programCoverRecovery"];

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
