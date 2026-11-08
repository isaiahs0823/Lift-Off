import React from "react";
import { PHOTOGRAPHY_MANIFEST, hasPhotography } from "../../content/photographyManifest.js";

// Renders a manifest-driven photography slot as a real, responsive, lazy-loaded <picture> once
// real assets exist for it — and renders nothing (letting the caller's own fallback show through)
// until they do. This is the only thing that changes when photography ships: no component using
// it needs to change, and the app never blocks on an image that hasn't loaded yet (decoding is
// async and nothing here is render-blocking).
//
// `slotKey` must be a key in PHOTOGRAPHY_MANIFEST. `className` sizes/positions the <picture> —
// this component doesn't impose its own layout.
export default function CinematicImage({ slotKey, className = "" }) {
  const slot = PHOTOGRAPHY_MANIFEST[slotKey];
  if (!slot || !hasPhotography(slotKey)) return null;
  const { avif, webp, fallback } = slot.sources;
  return (
    <picture className={className}>
      {avif && <source srcSet={avif} type="image/avif" />}
      {webp && <source srcSet={webp} type="image/webp" />}
      <img src={fallback || webp || avif} alt={slot.alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
    </picture>
  );
}
