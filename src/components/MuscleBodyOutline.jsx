import { useId } from "react";
import { getMuscleDisplay } from "../utils/muscleDisplay.js";
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
} from "../assets/anatomyData.js";

// A real anatomical figure (full-body outline + individually-shaped muscle groups, adapted from
// an open-source anatomy-illustration asset — see src/assets/anatomyData.js for provenance) rather
// than a hand-drawn icon: every muscle group is its own illustrated boundary, not a primitive
// shape. The base body renders in muted charcoal; the exercise's target region lights up in BRK
// red. getMuscleDisplay (unchanged) still decides which view and zone apply for a given exercise.
const OUTLINE_FILL = "#212327";
const OUTLINE_STROKE = "#0d0e10";
const BODY_TOP = "#6d7178";
const BODY_BOTTOM = "#4a4e55";
const RED_TOP = "#e6474e";
const RED_BOTTOM = "#9e141b";
const SEAM = "#101113";
const HEAD_FILL = "#5e6269";
const HAIR_FILL = "#2b2d31";

// Which illustrated muscle-group slugs light up for a given {view, zone}. Several zones only ever
// occur with one view under getMuscleDisplay's current rules (e.g. "chest" is always front), but
// every combination is mapped so the component never silently no-ops on an unexpected pairing.
const FRONT_ZONE_SLUGS = {
  chest: ["chest"],
  back: ["trapezius"],
  shoulders: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  abs: ["abs", "obliques"],
  quads: ["quadriceps"],
  hamstrings: [],
  glutes: [],
  calves: ["calves"],
};
const BACK_ZONE_SLUGS = {
  chest: [],
  back: ["trapezius", "upper-back", "lower-back"],
  shoulders: ["deltoids"],
  biceps: [],
  triceps: ["triceps"],
  forearms: ["forearm"],
  abs: [],
  quads: [],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves"],
};

export default function MuscleBodyOutline({ exercise, size = 44 }) {
  const uid = useId();
  const bodyGradId = `mbo-body-${uid}`;
  const redGradId = `mbo-red-${uid}`;

  const { view, zone } = getMuscleDisplay(exercise);
  const isBack = view === "back";
  const parts = isBack ? BACK_PARTS : FRONT_PARTS;
  const zoneSlugs = isBack ? BACK_ZONE_SLUGS : FRONT_ZONE_SLUGS;
  const activeSlugs = zone === "full" ? Object.keys(parts) : zoneSlugs[zone] || [];
  const isActive = (slug) => activeSlugs.includes(slug);

  const bodyFill = `url(#${bodyGradId})`;
  const redFill = `url(#${redGradId})`;

  return (
    <svg
      width={size}
      height={size * 2}
      viewBox={isBack ? VIEW_BOX_BACK : VIEW_BOX_FRONT}
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      data-testid="muscle-body-outline"
    >
      <defs>
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BODY_TOP} />
          <stop offset="100%" stopColor={BODY_BOTTOM} />
        </linearGradient>
        <linearGradient id={redGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RED_TOP} />
          <stop offset="100%" stopColor={RED_BOTTOM} />
        </linearGradient>
      </defs>

      {/* full-body base silhouette every muscle group sits on top of */}
      <path
        d={isBack ? OUTLINE_BACK : OUTLINE_FRONT}
        fill={OUTLINE_FILL}
        stroke={OUTLINE_STROKE}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />

      {Object.entries(parts).map(([slug, ds]) =>
        ds.map((d, i) => (
          <path
            key={`${slug}-${i}`}
            d={d}
            fill={isActive(slug) ? redFill : bodyFill}
            stroke={SEAM}
            strokeWidth={0.75}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )),
      )}

      <path d={isBack ? HAIR_BACK : HAIR_FRONT} fill={HAIR_FILL} stroke={SEAM} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
      <path d={isBack ? HEAD_BACK : HEAD_FRONT} fill={HEAD_FILL} stroke={SEAM} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
