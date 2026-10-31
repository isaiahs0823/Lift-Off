// Photography asset manifest — maps each of BRK Fit's six cinematic image slots to its usage,
// aspect ratio, crop guidance, alt text, and fallback treatment.
//
// No photography is bundled here. Every `sources` entry is null until real, rights-cleared
// imagery (original, licensed, or explicitly supplied by BRK) is dropped into the matching
// public/images/photography/<slot> folder and this file is updated to point at it. This file
// does not fabricate a photo, download a copyrighted one, or fake one with a placeholder service
// — the entire point of CinematicImage (see src/components/ui/CinematicImage.jsx) is that the
// app looks and behaves identically, fallback included, whether or not a slot has ever been
// filled in.
//
// `sources`: { avif, webp, fallback } — each a public/ path, or null if not supplied. `fallback`
// should be a compressed JPEG/PNG for browsers without AVIF/WebP support; avif/webp are optional
// but preferred when available (smaller mobile payloads).
// `crop`: the intended focal treatment so a future asset is art-directed consistently — framing
// guidance for whoever sources/crops the image, not a CSS value.

export const PHOTOGRAPHY_MANIFEST = {
  onboardingHero: {
    usage: "Onboarding welcome screen, full-bleed hero above the headline.",
    aspectRatio: "4 / 5",
    crop: "Single athlete, three-quarter or full figure, hard side lighting, strong shadow falloff toward the frame edge opposite the key light. Leave the lower third clear for headline/CTA overlay.",
    alt: "Athlete in a disciplined training stance, dramatic monochrome lighting.",
    fallback: "gradient", // existing v5-red/elevated/surface gradient wash, no imagery
    sources: { avif: null, webp: null, fallback: null },
    publicDir: "images/photography/onboarding",
  },
  todayHeader: {
    usage: "Today screen's hero card background, behind the workout title/meta — must never reduce text contrast below WCAG AA.",
    aspectRatio: "16 / 9",
    crop: "Close/mid shot (hands, bar, back, shoulders — not a full face) with the subject weighted to the trailing (right) edge, leaving the leading two-thirds darker/emptier for title text to sit over without a scrim fighting the image.",
    alt: "Close-up training detail, dramatic monochrome lighting.",
    fallback: "gradient-with-anatomy", // today's existing PhotoHero gradient + MuscleBodyOutline watermark
    sources: { avif: null, webp: null, fallback: null },
    publicDir: "images/photography/today",
  },
  programCoverStrength: {
    usage: "Strength program category cover (Train → Programs browser).",
    aspectRatio: "1 / 1",
    crop: "Barbell/rack movement (squat, deadlift, press), low angle, heavy shadow, subject centered — reads as 'strength' at thumbnail size.",
    alt: "Strength training program cover photo.",
    fallback: "solid",
    sources: { avif: null, webp: null, fallback: null },
    publicDir: "images/photography/programs/strength",
  },
  programCoverHypertrophy: {
    usage: "Hypertrophy program category cover (Train → Programs browser).",
    aspectRatio: "1 / 1",
    crop: "Isolation/machine or dumbbell movement mid-contraction, tighter crop on working muscle group, hard rim light to emphasize definition.",
    alt: "Hypertrophy training program cover photo.",
    fallback: "solid",
    sources: { avif: null, webp: null, fallback: null },
    publicDir: "images/photography/programs/hypertrophy",
  },
  programCoverConditioning: {
    usage: "Athletic conditioning program category cover (Train → Programs browser).",
    aspectRatio: "1 / 1",
    crop: "Dynamic motion — sprint, sled push, battle ropes — mid-action blur acceptable, higher energy than the strength/hypertrophy covers.",
    alt: "Athletic conditioning program cover photo.",
    fallback: "solid",
    sources: { avif: null, webp: null, fallback: null },
    publicDir: "images/photography/programs/conditioning",
  },
  programCoverRecovery: {
    usage: "Recovery/mobility program category cover (Train → Programs browser).",
    aspectRatio: "1 / 1",
    crop: "Calm, controlled stretch/mobility pose, softer (but still hard-light, monochrome) treatment than the other three covers — lower visual intensity to read as 'recovery' at a glance.",
    alt: "Recovery and mobility program cover photo.",
    fallback: "solid",
    sources: { avif: null, webp: null, fallback: null },
    publicDir: "images/photography/programs/recovery",
  },
};

// True once a slot actually has at least one real source filled in — callers use this (rather
// than checking `sources` shape themselves) to decide whether to render a real <picture> or the
// documented fallback.
export function hasPhotography(slotKey) {
  const slot = PHOTOGRAPHY_MANIFEST[slotKey];
  if (!slot) return false;
  return !!(slot.sources.avif || slot.sources.webp || slot.sources.fallback);
}
