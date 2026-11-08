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
//
// `mode`: "ratings" (default, unchanged) colors every zone by its Athlete Rating score and only
// the 8 rating-group zones are clickable — Progress's Muscle Map, byte-identical to before this
// prop existed. "zones" is for Exercise Discovery: every real anatomy zone this SVG actually
// draws (including abs, and biceps/triceps/forearms/quads/hamstrings/glutes/calves as their own
// distinct zones rather than folded into one "arms"/"legs" rating group) is individually
// selectable, filled with a neutral body tone, and highlighted in BRK red only when selected —
// no score, since exercise discovery isn't about performance data.
export default function AthleteMuscleMap({ ratings, view = "front", selected = null, onSelectZone, width = 220, mode = "ratings" }) {
  const uid = useId();
  const isBack = view === "back";
  const parts = isBack ? BACK_PARTS : FRONT_PARTS;
  const zoneSlugs = isBack ? BACK_ZONE_SLUGS : FRONT_ZONE_SLUGS;

  // Each anatomy "zone" slug (e.g. biceps, triceps, forearms) maps to one of the 8 rating
  // groups (Arms covers all three) — same mapping athleteRating.js's ZONE_TO_GROUP uses, kept
  // in sync by hand since one is SVG-zone-keyed and the other is rating-group-keyed. Only read
  // when mode is "ratings" (the default) — "zones" mode uses the raw zone slug directly instead.
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

  const zoneForSlug = (slug) => Object.entries(zoneSlugs).find(([, slugs]) => slugs.includes(slug))?.[0] ?? null;

  const fillForSlug = (slug) => {
    const zone = zoneForSlug(slug);
    if (mode === "zones") {
      // Neutral body tone normally; the selected zone gets a visible red tint too (not just the
      // selection stroke below) so the tap target reads clearly even for a viewer who can't
      // distinguish the thin selection outline — color is a bonus signal here, never the only
      // one, since the text button grid under the diagram is the real accessible equivalent.
      return zone && zone === selected ? SELECTED_STROKE : `url(#amm-body-${uid})`;
    }
    const group = zone ? ZONE_TO_GROUP[zone] : null;
    if (!group) return `url(#amm-body-${uid})`; // abs/full/unmapped parts — neutral body tone
    const rating = ratings?.[group];
    if (!rating || rating.score == null) return UNRATED_FILL;
    return scoreToColor(rating.score);
  };
  const isSelected = (slug) => {
    const zone = zoneForSlug(slug);
    if (mode === "zones") return !!zone && zone === selected;
    const group = zone ? ZONE_TO_GROUP[zone] : null;
    return !!group && group === selected;
  };
  const groupForSlug = (slug) => {
    const zone = zoneForSlug(slug);
    if (mode === "zones") return zone; // every drawn zone is its own selectable unit
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
