import React from "react";

// Maps BRK's existing exercise `muscle` field (Chest/Back/Shoulders/Arms/Legs/Core/Conditioning/
// Full body — see the EXERCISE_LIBRARY entries in App.jsx) onto a small set of highlightable
// zones on a simplified front-facing silhouette. This is NOT a second muscle taxonomy: it reuses
// the one value BRK already stores per exercise and is purely informational, not anatomically
// precise — a rough "where on the body" cue, not a medical diagram. "Back" has no dedicated rear
// view (there's nothing to draw a real one from), so it highlights the upper-traps/rear-delt band
// that's still visible on a front silhouette, which is an honest approximation rather than an
// invented one.
const ZONES_BY_MUSCLE = {
  Chest: ["chest"],
  Back: ["traps"],
  Shoulders: ["shoulders"],
  Arms: ["arms"],
  Legs: ["legs"],
  Core: ["core"],
  Conditioning: ["shoulders", "chest", "core", "legs"],
  "Full body": ["shoulders", "chest", "core", "legs", "arms"],
};

export default function MuscleBodyOutline({ muscle, size = 56 }) {
  const active = new Set(ZONES_BY_MUSCLE[muscle] || []);
  const fill = (zone) => (active.has(zone) ? "#D2262E" : "#2A2D31");
  const opacity = (zone) => (active.has(zone) ? 1 : 0.6);

  return (
    <svg
      width={size}
      height={size * 1.5}
      viewBox="0 0 60 90"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* head — never highlighted, just orients the figure */}
      <circle cx="30" cy="8" r="6" fill="#2A2D31" opacity="0.6" />
      {/* traps / upper back band (Back) */}
      <rect x="20" y="15" width="20" height="5" rx="2" fill={fill("traps")} opacity={opacity("traps")} />
      {/* shoulders / delts */}
      <circle cx="15" cy="21" r="5.5" fill={fill("shoulders")} opacity={opacity("shoulders")} />
      <circle cx="45" cy="21" r="5.5" fill={fill("shoulders")} opacity={opacity("shoulders")} />
      {/* arms */}
      <rect x="7" y="24" width="8" height="30" rx="4" fill={fill("arms")} opacity={opacity("arms")} />
      <rect x="45" y="24" width="8" height="30" rx="4" fill={fill("arms")} opacity={opacity("arms")} />
      {/* chest */}
      <rect x="18" y="20" width="24" height="15" rx="4" fill={fill("chest")} opacity={opacity("chest")} />
      {/* core */}
      <rect x="20" y="35" width="20" height="19" rx="3" fill={fill("core")} opacity={opacity("core")} />
      {/* legs */}
      <rect x="18" y="55" width="10" height="32" rx="4" fill={fill("legs")} opacity={opacity("legs")} />
      <rect x="32" y="55" width="10" height="32" rx="4" fill={fill("legs")} opacity={opacity("legs")} />
    </svg>
  );
}
