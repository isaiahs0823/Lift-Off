import React from "react";
import { getMuscleDisplay } from "../utils/muscleDisplay.js";

// A small, premium-feeling anatomical icon — a muted gray silhouette with the exercise's target
// region highlighted in BRK red. Two views (front/back) share the same body outline so switching
// between them reads as the same figure, not a different character; getMuscleDisplay decides
// which view and zone apply for a given exercise (see that file for the mapping). This is
// informational styling, not a medical illustration — proportions are simplified and symmetrical
// on purpose.
const BODY = "#3A3D42"; // muted neutral gray — the base silhouette, never the highlight color
const RED = "#D2262E";

function Zone({ d, on, opacity = 1 }) {
  return <path d={d} fill={on ? RED : BODY} opacity={on ? opacity : 0.55} />;
}
function ZoneCircle({ cx, cy, r, on }) {
  return <circle cx={cx} cy={cy} r={r} fill={on ? RED : BODY} opacity={on ? 1 : 0.55} />;
}

// Shared skeleton both views draw from — head/neck/shoulders/torso taper/limb segmentation.
// Front and back differ only in which named zone(s) light up.
function Figure({ view, zone, size }) {
  const full = zone === "full";
  const is = (z) => full || zone === z;

  return (
    <svg
      width={size}
      height={size * 1.6}
      viewBox="0 0 64 104"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      data-testid="muscle-body-outline"
    >
      {/* head + neck — orientation only, never highlighted */}
      <ellipse cx="32" cy="8" rx="6" ry="7" fill={BODY} opacity="0.55" />
      <rect x="29" y="14" width="6" height="5" rx="1.5" fill={BODY} opacity="0.55" />

      {view === "front" ? (
        <>
          <ZoneCircle cx="17" cy="20" r="7" on={is("shoulders")} />
          <ZoneCircle cx="47" cy="20" r="7" on={is("shoulders")} />
          <Zone d="M19 18 L45 18 L43 38 L21 38 Z" on={is("chest")} />
          <Zone d="M21 38 L43 38 L39.5 58 L24.5 58 Z" on={is("abs")} />
          <Zone d="M10 20 h9 a4 4 0 0 1 4 4 v15 a4 4 0 0 1 -4 4 h-9 Z" on={is("biceps")} />
          <Zone d="M45 20 h9 a4 4 0 0 1 4 4 v15 a4 4 0 0 1 -4 4 h-9 Z" on={is("biceps")} />
          <Zone d="M9.5 43 h7.5 a3.5 3.5 0 0 1 3.5 3.5 v12 a3.5 3.5 0 0 1 -3.5 3.5 h-7.5 Z" on={is("forearms")} />
          <Zone d="M43.5 43 h7.5 a3.5 3.5 0 0 1 3.5 3.5 v12 a3.5 3.5 0 0 1 -3.5 3.5 h-7.5 Z" on={is("forearms")} />
          <path d="M24.5 58 L39.5 58 L41.5 64 L22.5 64 Z" fill={BODY} opacity="0.55" />
          <Zone d="M21 64 h10 a4 4 0 0 1 4 4 v14 a4 4 0 0 1 -4 4 h-10 Z" on={is("quads")} />
          <Zone d="M33 64 h10 a4 4 0 0 1 4 4 v14 a4 4 0 0 1 -4 4 h-10 Z" on={is("quads")} />
          <path d="M22 86 h8 a3 3 0 0 1 3 3 v11 a3 3 0 0 1 -3 3 h-8 Z" fill={BODY} opacity="0.55" />
          <path d="M31 86 h8 a3 3 0 0 1 3 3 v11 a3 3 0 0 1 -3 3 h-8 Z" fill={BODY} opacity="0.55" />
        </>
      ) : (
        <>
          <ZoneCircle cx="17" cy="20" r="7" on={is("shoulders")} />
          <ZoneCircle cx="47" cy="20" r="7" on={is("shoulders")} />
          <Zone d="M22 17 L42 17 L44 38 L20 38 Z" on={is("back")} />
          <Zone d="M20 38 L44 38 L40.5 58 L23.5 58 Z" on={is("back")} opacity="0.75" />
          <Zone d="M10 20 h9 a4 4 0 0 1 4 4 v15 a4 4 0 0 1 -4 4 h-9 Z" on={is("triceps")} />
          <Zone d="M45 20 h9 a4 4 0 0 1 4 4 v15 a4 4 0 0 1 -4 4 h-9 Z" on={is("triceps")} />
          <Zone d="M9.5 43 h7.5 a3.5 3.5 0 0 1 3.5 3.5 v12 a3.5 3.5 0 0 1 -3.5 3.5 h-7.5 Z" on={is("forearms")} />
          <Zone d="M43.5 43 h7.5 a3.5 3.5 0 0 1 3.5 3.5 v12 a3.5 3.5 0 0 1 -3.5 3.5 h-7.5 Z" on={is("forearms")} />
          <path d="M23.5 58 L40.5 58 L41.5 64 L22.5 64 Z" fill={BODY} opacity="0.55" />
          <Zone d="M21 64 h10 a4 4 0 0 1 4 4 v8 h-14 v-8 a4 4 0 0 1 4 -4 Z" on={is("glutes")} />
          <Zone d="M33 64 h10 a4 4 0 0 1 4 4 v8 h-14 v-8 a4 4 0 0 1 4 -4 Z" on={is("glutes")} />
          <Zone d="M21 76 h10 v10 a4 4 0 0 1 -4 4 h-2 a4 4 0 0 1 -4 -4 Z" on={is("hamstrings")} />
          <Zone d="M33 76 h10 v10 a4 4 0 0 1 -4 4 h-2 a4 4 0 0 1 -4 -4 Z" on={is("hamstrings")} />
          <Zone d="M22 86 h8 a3 3 0 0 1 3 3 v11 a3 3 0 0 1 -3 3 h-8 Z" on={is("calves")} />
          <Zone d="M31 86 h8 a3 3 0 0 1 3 3 v11 a3 3 0 0 1 -3 3 h-8 Z" on={is("calves")} />
        </>
      )}
    </svg>
  );
}

export default function MuscleBodyOutline({ exercise, size = 44 }) {
  const { view, zone } = getMuscleDisplay(exercise);
  return <Figure view={view} zone={zone} size={size} />;
}
