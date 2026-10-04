import { useId, useMemo } from "react";
import {
  VIEW_BOX_FRONT,
  VIEW_BOX_BACK,
  OUTLINE_FRONT,
  OUTLINE_BACK,
  HEAD_FRONT,
  HAIR_FRONT,
  HEAD_BACK,
  HAIR_BACK,
  FRONT_PARTS,
  BACK_PARTS,
  FRONT_ZONE_SLUGS,
  BACK_ZONE_SLUGS,
} from "../assets/anatomyData.js";

// Multi-zone companion to MuscleBodyOutline (which only ever highlights ONE zone, for a
// single exercise's target muscle). This one colors EVERY zone at once by its Athlete Rating
// muscle score, and supports a front/back toggle + tap-to-drill-down — a different interaction
// model MuscleBodyOutline was never built for, so this reuses the same underlying anatomy
// artwork/data rather than bolting a second API onto that component.
const OUTLINE_FILL = "#212327";
const OUTLINE_STROKE = "#0d0e10";
const UNRATED_FILL = "#2b2d31"; // dark charcoal — "nothing here yet" (insufficient evidence)
const SEAM = "#101113";
const HEAD_FILL = "#5e6269";
const HAIR_FILL = "#2b2d31";
const SELECTED_STROKE = "#e6474e";

// Low-score neutral slate -> high-score BRK red, so intensity reads as "how developed" rather
// than a hard on/off — restrained, not a rainbow (only ever slate-to-red, one hue ramp).
function scoreToColor(score) {
  const t = Math.max(0, Math.min(100, score)) / 100;
  const from = { r: 0x6d, g: 0x71, b: 0x78 };
  const to = { r: 0xe6, g: 0x47, b: 0x4e };
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r},${g},${b})`;
}

// "ratings" is { chest: {score, confidence}, back: {...}, ... } keyed by the 8 MUSCLE_GROUPS
// from utils/athleteRating.js. "view" is controlled by the caller (front/back toggle lives in
// the parent screen, not here) so it can be kept in sync with any surrounding UI.
export default function AthleteMuscleMap({ ratings, view = "front", selected = null, onSelectZone, width = 220 }) {
  const uid = useId();
  const isBack = view === "back";
  const parts = isBack ? BACK_PARTS : FRONT_PARTS;
  const zoneSlugs = isBack ? BACK_ZONE_SLUGS : FRONT_ZONE_SLUGS;

  // Each anatomy "zone" slug (e.g. biceps, triceps, forearms) maps to one of the 8 rating
  // groups (Arms covers all three) — same mapping athleteRating.js's ZONE_TO_GROUP uses, kept
  // in sync by hand since one is SVG-zone-keyed and the other is rating-group-keyed.
  const ZONE_TO_GROUP = useMemo(
    () => ({
      chest: "chest",
      back: "back",
      shoulders: "shoulders",
      biceps: "arms",
      triceps: "arms",
      forearms: "arms",
      quads: "quads",
      hamstrings: "hamstrings",
      glutes: "glutes",
      calves: "calves",
    }),
    []
  );

  const fillForSlug = (slug) => {
    // Find which anatomy zone this SVG part slug belongs to in the current view
    const zone = Object.entries(zoneSlugs).find(([, slugs]) => slugs.includes(slug))?.[0];
    const group = zone ? ZONE_TO_GROUP[zone] : null;
    if (!group) return `url(#amm-body-${uid})`; // abs/full/unmapped parts — neutral body tone
    const rating = ratings?.[group];
    if (!rating || rating.score == null) return UNRATED_FILL;
    return scoreToColor(rating.score);
  };
  const isSelected = (slug) => {
    const zone = Object.entries(zoneSlugs).find(([, slugs]) => slugs.includes(slug))?.[0];
    const group = zone ? ZONE_TO_GROUP[zone] : null;
    return !!group && group === selected;
  };
  const groupForSlug = (slug) => {
    const zone = Object.entries(zoneSlugs).find(([, slugs]) => slugs.includes(slug))?.[0];
    return zone ? ZONE_TO_GROUP[zone] : null;
  };

  const height = width * 2;

  return (
    <svg width={width} height={height} viewBox={isBack ? VIEW_BOX_BACK : VIEW_BOX_FRONT} fill="none" className="shrink-0">
      <defs>
        <linearGradient id={`amm-body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d7178" />
          <stop offset="100%" stopColor="#4a4e55" />
        </linearGradient>
      </defs>

      <path d={isBack ? OUTLINE_BACK : OUTLINE_FRONT} fill={OUTLINE_FILL} stroke={OUTLINE_STROKE} strokeWidth={1} vectorEffect="non-scaling-stroke" />

      {Object.entries(parts).map(([slug, ds]) => {
        const group = groupForSlug(slug);
        const clickable = !!group && !!onSelectZone;
        return ds.map((d, i) => (
          <path
            key={`${slug}-${i}`}
            d={d}
            fill={fillForSlug(slug)}
            stroke={isSelected(slug) ? SELECTED_STROKE : SEAM}
            strokeWidth={isSelected(slug) ? 1.5 : 0.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            onClick={clickable ? () => onSelectZone(group) : undefined}
            style={clickable ? { cursor: "pointer" } : undefined}
            aria-hidden={!clickable}
          />
        ));
      })}

      <path d={isBack ? HAIR_BACK : HAIR_FRONT} fill={HAIR_FILL} stroke={SEAM} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
      <path d={isBack ? HEAD_BACK : HEAD_FRONT} fill={HEAD_FILL} stroke={SEAM} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
