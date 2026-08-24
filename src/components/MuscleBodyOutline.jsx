import React, { useId } from "react";
import { getMuscleDisplay } from "../utils/muscleDisplay.js";

// A premium anatomical figure — a shaded charcoal silhouette with defined, tapered muscle
// groups (and actual hands/feet, not stub limbs), the exercise's target region lit up in BRK
// red. Two views (front/back) share the same overall build (head/neck/torso/limbs) so switching
// between them reads as the same athlete, not a different character; getMuscleDisplay
// (unchanged) decides which view and zone apply for a given exercise. This is informational
// styling, not a medical illustration — proportions are simplified and deliberately symmetrical
// — but every muscle group is its own anatomically-shaped piece (teardrop pecs, a six-pack ab
// grid, a trap triangle + separate lat wings on the back, tapered limbs) with a subtle top-lit
// gradient for volume, on an elongated athletic silhouette rather than a rounded toy figure.
const BODY_TOP = "#4E5257";
const BODY_BOTTOM = "#24262A";
const RED_TOP = "#E6474E";
const RED_BOTTOM = "#9E141B";
const SEAM = "#131415"; // thin separating stroke so adjacent muscle groups never visually merge
const DIM = 0.62; // inactive-zone opacity against the near-black card background

const MIRROR = "scale(-1,1) translate(-100,0)";

function Zone({ d, on, bodyFill, redFill, opacity = 1, transform, strokeWidth = 1.1 }) {
  return (
    <path
      d={d}
      fill={on ? redFill : bodyFill}
      opacity={on ? opacity : DIM}
      stroke={SEAM}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      transform={transform}
    />
  );
}

// Left-side shapes, mirrored for the right — elongated and tapered (wide at the joint, narrow at
// the distal end) with real hand/foot terminals, not rounded stub caps.
const DELT_L = "M25 30 C15 30 8 37 8 46 C8 53 13 58 21 57 C27 56 30 50 29 43 C28 36 30 31 25 30 Z";
const UPPER_ARM_L = "M22 38 C13 40 8 48 8 58 C8 66 10 74 14 80 C17 84 22 82 23 77 C25 68 25 53 23 43 C23 40 22 39 22 38 Z";
const FOREARM_L = "M14 82 C10 87 8 96 9 105 C10 111 13 115 17 114 C20 113 21 107 21 100 C21 92 20 85 18 80 C17 79 15 80 14 82 Z";
// Hand — a simple closed fist shape terminating the forearm, the single biggest cue that this is
// a real limb rather than a rounded stub.
const HAND_L = "M9 106 C7 110 7 116 10 120 C13 123 18 123 20 119 C22 115 21 109 18 105 C15 103 11 103 9 106 Z";

const QUAD_L = "M47 118 C39 116 30 119 27 129 C24 140 24 158 27 174 C29 184 40 189 47 182 C52 176 52 155 50 137 C50 130 49 122 47 118 Z";
const CALF_L = "M31 176 C25 183 24 195 27 206 C29 214 36 220 42 217 C47 214 47 202 45 192 C43 182 40 175 35 172 C33 171 32 173 31 176 Z";
// Foot — a simple angled wedge terminating the calf.
const FOOT_L = "M27 208 C22 210 15 213 13 218 C12 222 15 225 20 224 L44 222 C47 221 47 217 44 214 L34 210 C31 208 28 207 27 208 Z";

// Two small rounded rects per row = a six-pack — recognizable "abs" shape at a glance rather
// than one blank rounded rectangle, built from a tight loop instead of six hand-written elements.
const AB_ROWS = [68, 80, 92];

export default function MuscleBodyOutline({ exercise, size = 44 }) {
  const uid = useId();
  const bodyGradId = `mbo-body-${uid}`;
  const redGradId = `mbo-red-${uid}`;
  const { view, zone } = getMuscleDisplay(exercise);
  const full = zone === "full";
  const is = (z) => full || zone === z;
  const bodyFill = `url(#${bodyGradId})`;
  const redFill = `url(#${redGradId})`;
  const zp = { bodyFill, redFill };

  return (
    <svg
      width={size}
      height={size * 2.3}
      viewBox="0 0 100 230"
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

      {/* head + neck — orientation only, never highlighted; a slightly elongated oval reads
          less like a toy than a perfect circle */}
      <ellipse cx="50" cy="14" rx="8" ry="11.5" fill={bodyFill} opacity={DIM} stroke={SEAM} strokeWidth="1.1" />
      <path d="M45 23 L43 32 L57 32 L55 23 Z" fill={bodyFill} opacity={DIM} stroke={SEAM} strokeWidth="1" strokeLinejoin="round" />

      {/* torso base — a real athletic taper (broad shoulders, narrow waist, slight hip flare),
          always drawn so the silhouette stays whole even where a zone isn't highlighted */}
      <path
        d="M30 32 C25 38 24 48 25 58 C26 70 28 82 33 92 C35 96 33 100 32 104 C31 110 32 116 36 120 L64 120 C68 116 69 110 68 104 C67 100 65 96 67 92 C72 82 74 70 75 58 C76 48 75 38 70 32 C62 36 38 36 30 32 Z"
        fill={bodyFill}
        opacity={DIM}
        stroke={SEAM}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      <Zone d={DELT_L} on={is("shoulders")} {...zp} />
      <Zone d={DELT_L} on={is("shoulders")} {...zp} transform={MIRROR} />
      <Zone d={UPPER_ARM_L} on={is(view === "front" ? "biceps" : "triceps")} {...zp} />
      <Zone d={UPPER_ARM_L} on={is(view === "front" ? "biceps" : "triceps")} {...zp} transform={MIRROR} />
      <Zone d={FOREARM_L} on={is("forearms")} {...zp} />
      <Zone d={FOREARM_L} on={is("forearms")} {...zp} transform={MIRROR} />
      <Zone d={HAND_L} on={false} {...zp} strokeWidth="0.9" />
      <Zone d={HAND_L} on={false} {...zp} strokeWidth="0.9" transform={MIRROR} />

      {view === "front" ? (
        <>
          {/* pecs — teardrop, pointed toward the sternum, rounded at the outer/lower edge,
              matching how pectoralis major actually reads on a silhouette */}
          <Zone d="M49 38 C44 34 36 34 31 38 C26 42 24 50 27 57 C30 62 40 63 46 58 C49 54 50 45 49 38 Z" on={is("chest")} {...zp} />
          <Zone
            d="M49 38 C44 34 36 34 31 38 C26 42 24 50 27 57 C30 62 40 63 46 58 C49 54 50 45 49 38 Z"
            on={is("chest")}
            {...zp}
            transform={MIRROR}
          />
          {/* abs — a six-pack grid rather than a blank panel */}
          {AB_ROWS.map((y) => (
            <React.Fragment key={y}>
              <Zone d={`M36 ${y} h9 a2.4 2.4 0 0 1 2.4 2.4 v6.2 a2.4 2.4 0 0 1 -2.4 2.4 h-9 a2.4 2.4 0 0 1 -2.4 -2.4 v-6.2 a2.4 2.4 0 0 1 2.4 -2.4 Z`} on={is("abs")} {...zp} strokeWidth="0.9" />
              <Zone
                d={`M36 ${y} h9 a2.4 2.4 0 0 1 2.4 2.4 v6.2 a2.4 2.4 0 0 1 -2.4 2.4 h-9 a2.4 2.4 0 0 1 -2.4 -2.4 v-6.2 a2.4 2.4 0 0 1 2.4 -2.4 Z`}
                on={is("abs")}
                {...zp}
                strokeWidth="0.9"
                transform={MIRROR}
              />
            </React.Fragment>
          ))}
          <Zone d={FOOT_L} on={false} {...zp} />
          <Zone d={FOOT_L} on={false} {...zp} transform={MIRROR} />
          {/* shins — always neutral; the front view has no dedicated lower-leg zone */}
          <Zone d={CALF_L} on={false} {...zp} />
          <Zone d={CALF_L} on={false} {...zp} transform={MIRROR} />
          <Zone d={QUAD_L} on={is("quads")} {...zp} />
          <Zone d={QUAD_L} on={is("quads")} {...zp} transform={MIRROR} />
        </>
      ) : (
        <>
          {/* traps — a centered diamond at the base of the neck */}
          <Zone d="M50 32 C43 32 38 35 36 40 L50 52 L64 40 C62 35 57 32 50 32 Z" on={is("back")} {...zp} />
          {/* lats — bilateral wings flaring from the mid-back, tapering to a point at the waist */}
          <Zone
            d="M42 44 C32 45 25 53 24 64 C23 75 27 86 36 90 C41 92 45 87 45 79 C45 68 44 55 42 44 Z"
            on={is("back")}
            {...zp}
          />
          <Zone
            d="M42 44 C32 45 25 53 24 64 C23 75 27 86 36 90 C41 92 45 87 45 79 C45 68 44 55 42 44 Z"
            on={is("back")}
            {...zp}
            transform={MIRROR}
          />
          <Zone d={FOOT_L} on={false} {...zp} />
          <Zone d={FOOT_L} on={false} {...zp} transform={MIRROR} />
          <Zone
            d="M46 118 C38 116 29 120 27 129 C25 138 30 147 39 149 C45 150 48 144 48 135 C48 129 47 122 46 118 Z"
            on={is("glutes")}
            {...zp}
          />
          <Zone
            d="M46 118 C38 116 29 120 27 129 C25 138 30 147 39 149 C45 150 48 144 48 135 C48 129 47 122 46 118 Z"
            on={is("glutes")}
            {...zp}
            transform={MIRROR}
          />
          <Zone
            d="M28 151 C26 160 27 171 30 180 C32 186 41 187 45 181 C48 174 49 162 47 151 C42 156 33 156 28 151 Z"
            on={is("hamstrings")}
            {...zp}
          />
          <Zone
            d="M28 151 C26 160 27 171 30 180 C32 186 41 187 45 181 C48 174 49 162 47 151 C42 156 33 156 28 151 Z"
            on={is("hamstrings")}
            {...zp}
            transform={MIRROR}
          />
          <Zone d={CALF_L} on={is("calves")} {...zp} />
          <Zone d={CALF_L} on={is("calves")} {...zp} transform={MIRROR} />
        </>
      )}
    </svg>
  );
}
