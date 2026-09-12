// ---------------- WORKOUT SHARE CARDS (v3 — premium redesign) ----------------
// Premium, canvas-drawn branded BRK share cards for a completed workout session. Two social
// poster templates — Performance and Minimal Story — each rendered at three export sizes (9:16
// Story, 4:5 Post, 1:1 Square). Pure canvas, no image/charting dependency.
//
// Full Recap (task: "BRK FULL RECAP REBUILD") is deliberately NOT a third poster template here —
// it's a categorically different thing (the complete workout record, not a curated social
// highlight) and lives in its own full-screen scrollable component, FullWorkoutRecap.jsx, backed
// by utils/fullRecap.js's data/plaintext builders. Its own image export, renderFullRecapImage
// below, is a tall document sized to its real content rather than one of SHARE_SIZES' fixed
// aspect ratios — see that function's own comment.
//
// v3 moves the card from "clean but forgettable" to "premium, bold, social-ready" without
// copying any literal reference imagery: stronger hierarchy (workout title now dominates, not
// the clock), a cohesive stat strip instead of scattered numbers, numbered exercise rows with a
// real PR treatment, and — replacing generic athlete photography entirely — BRK's own
// MuscleBodyOutline anatomy system rendered directly onto the canvas as a muted watermark with
// the session's trained muscle group lit up in BRK red. See drawAnatomyWatermark() below.

import { countedSets, topSetOf } from "./progression.js";
import { featuredAndOtherPRs, sessionPRCount, PR_TYPE_LABEL, prDeltaLabel, prPreviousLabel } from "./prSummary.js";
import { formatSessionDuration } from "./workoutSets.js";
import { getMuscleDisplay } from "./muscleDisplay.js";
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

export const SHARE_TEMPLATES = [
  { id: "performance", label: "Performance", blurb: "Hero lift, key stats, PR badges" },
  { id: "minimal", label: "Minimal Story", blurb: "Big number, clean and sparse" },
];

export const SHARE_SIZES = [
  { id: "story", label: "Story", ratio: "9:16", width: 1080, height: 1920 },
  { id: "post", label: "Post", ratio: "4:5", width: 1080, height: 1350 },
  { id: "square", label: "Square", ratio: "1:1", width: 1080, height: 1080 },
];

const FONT = "system-ui, -apple-system, 'Helvetica Neue', sans-serif";
const COLOR = {
  bgTop: "#1a1a1a",
  bgBottom: "#080808",
  glow: "rgba(220, 38, 38, 0.20)",
  panel: "rgba(255,255,255,0.045)",
  panelStrong: "rgba(255,255,255,0.07)",
  panelBorder: "rgba(255,255,255,0.10)",
  prPanel: "rgba(220,38,38,0.09)",
  prBorder: "rgba(239,68,68,0.55)",
  red: "#ef4444",
  redDeep: "#b91c1c",
  white: "#f7f7f7",
  gray: "#a3a3a3",
  dimGray: "#707070",
  green: "#22c55e",
  // Anatomy watermark — deliberately dimmer than the in-app MuscleBodyOutline colors (this is a
  // background signature element sitting behind/beside real data, never the primary focus).
  muscleBody: "#34363b",
  muscleOutline: "#1b1c1f",
  muscleHead: "#2c2e33",
  muscleHair: "#1b1c1f",
};

function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}

// ---------------- primitives ----------------

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Shrinks a single-line font size until `text` fits within maxWidth (never grows past `max`),
// so a long exercise name (task's own example: "Hammer Strength MTS Iso-Lateral High Row")
// never overflows or gets silently truncated when it's the hero of the card.
function fitFontSize(ctx, text, maxWidth, weight, max, min) {
  let size = max;
  while (size > min) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = `${weight} ${size}px ${FONT}`;
  return size;
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

// Word-wraps `text` within maxWidth, drawing left/center-aligned depending on `align`. `anchorX`
// is the left edge when align === "left", or the horizontal center when align === "center" —
// same convention ctx.textAlign itself uses, so callers don't need to think about it twice.
// Returns the number of lines drawn.
function wrapAligned(ctx, text, anchorX, y, maxWidth, lineHeight, maxLines = 3, align = "center") {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);
  const clipped = lines.slice(0, maxLines);
  if (lines.length > maxLines) clipped[maxLines - 1] = truncateToWidth(ctx, clipped[maxLines - 1] + "…", maxWidth);
  ctx.textAlign = align;
  clipped.forEach((l, i) => ctx.fillText(l, anchorX, y + i * lineHeight));
  return clipped.length;
}

function wrapCentered(ctx, text, cx, y, maxWidth, lineHeight, maxLines = 3) {
  return wrapAligned(ctx, text, cx, y, maxWidth, lineHeight, maxLines, "center");
}

function background(ctx, W, H, glowY) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLOR.bgTop);
  grad.addColorStop(1, COLOR.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Soft red glow behind the hero — the one "premium" lighting cue that separates this from a
  // flat receipt, kept subtle so it never competes with the numbers on top of it.
  const glow = ctx.createRadialGradient(W * 0.62, glowY, 0, W * 0.62, glowY, W * 0.75);
  glow.addColorStop(0, COLOR.glow);
  glow.addColorStop(1, "rgba(220,38,38,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Restrained vignette at the very top/bottom edges — the "subtle depth" cue the flat original
  // was missing, without any literal grain/noise texture that would read as generated/Canva-ish.
  const vignette = ctx.createLinearGradient(0, 0, 0, H);
  vignette.addColorStop(0, "rgba(0,0,0,0.28)");
  vignette.addColorStop(0.12, "rgba(0,0,0,0)");
  vignette.addColorStop(0.88, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Premium framing pass (follow-up task: "stronger card framing," "subtle red highlight
  // lines") — a barely-there red hairline at the very top edge, and a soft inset border, so the
  // card reads as a designed asset rather than a plain screenshot even before any content
  // renders. Both stay far below anything that would compete with the hero content.
  const hairline = ctx.createLinearGradient(W * 0.22, 0, W * 0.78, 0);
  hairline.addColorStop(0, "rgba(239,68,68,0)");
  hairline.addColorStop(0.5, "rgba(239,68,68,0.55)");
  hairline.addColorStop(1, "rgba(239,68,68,0)");
  ctx.fillStyle = hairline;
  ctx.fillRect(W * 0.22, 0, W * 0.56, 3);

  const inset = Math.round(W * 0.022);
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, 28);
  ctx.stroke();
}

// `align: "left"` (task: Performance's poster composition puts the small brand lockup top-left,
// like the reference, distinct from every template's centered bottom-footer wordmark which keeps
// calling this the old way) anchors at `leftX` instead of computing a centered start.
function wordmark(ctx, W, y, size = 40, align = "center", leftX = 0) {
  ctx.font = `800 ${size}px ${FONT}`;
  const brkWidth = ctx.measureText("BRK").width;
  ctx.font = `700 ${size * 0.42}px ${FONT}`;
  const liftWidth = ctx.measureText("LIFT").width;
  const gap = size * 0.22;
  const totalW = brkWidth + gap + liftWidth;
  const startX = align === "left" ? leftX : W / 2 - totalW / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.red;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText("BRK", startX, y);
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${size * 0.42}px ${FONT}`;
  ctx.fillText("LIFT", startX + brkWidth + gap, y - size * 0.02);
  ctx.textAlign = "center";
}

// `extraPad` (follow-up task: "Instagram Story format... margins are safe") lifts the footer
// further off the very bottom edge on Story-sized exports specifically, so BRK's own branding
// never lands inside the reply-bar zone Instagram reserves at the bottom of a Story.
function footerTagline(ctx, W, H, size = 22, extraPad = 0) {
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillText("KEEP THE PROMISES YOU MAKE TO YOURSELF", W / 2, H - size * 2.1 - extraPad);
}

// A small red badge, e.g. "PR" or "+15 LB". Returns the badge's rendered width.
function drawBadge(ctx, cx, y, text, { fontSize = 24, padX = 18, padY = 10, filled = true } = {}) {
  ctx.font = `800 ${fontSize}px ${FONT}`;
  const textW = ctx.measureText(text).width;
  const w = textW + padX * 2;
  const h = fontSize + padY * 2;
  const x = cx - w / 2;
  if (filled) {
    ctx.fillStyle = COLOR.red;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = COLOR.white;
  } else {
    ctx.strokeStyle = COLOR.red;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();
    ctx.fillStyle = COLOR.red;
  }
  ctx.textAlign = "center";
  ctx.fillText(text, cx, y + h / 2 + fontSize * 0.35);
  return w;
}

function drawBadgeInline(ctx, x, y, text, k = 1) {
  const fontSize = Math.max(12, Math.round(16 * k));
  ctx.font = `800 ${fontSize}px ${FONT}`;
  const w = ctx.measureText(text).width + 18;
  const h = fontSize + 14;
  ctx.fillStyle = COLOR.red;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = COLOR.white;
  ctx.textAlign = "left";
  ctx.fillText(text, x + 9, y + h / 2 + fontSize * 0.35);
  return w;
}

// A reusable 1x1-ish offscreen context used only to MEASURE how tall a body block will render
// (font metrics don't depend on canvas size) before drawing it for real — see centerBody() below.
let _scratchCtx = null;
function scratchContext() {
  if (!_scratchCtx) {
    const c = document.createElement("canvas");
    c.width = 10;
    c.height = 10;
    _scratchCtx = c.getContext("2d");
  }
  return _scratchCtx;
}

// Runs `bodyFn(ctx, startY) => endY` once on a scratch context to measure its rendered height,
// then runs it again for real on `ctx`, nudged down so the block sits vertically centered in the
// space between `startY` and `footerTopY` instead of always hugging the top — this is what keeps
// every template free of the large dead space a short session (few PRs, one exercise) would
// otherwise leave above the footer.
function centerBody(ctx, startY, footerTopY, bodyFn) {
  const measuredEnd = bodyFn(scratchContext(), startY);
  const contentHeight = measuredEnd - startY;
  const available = footerTopY - startY;
  const offset = Math.max(0, (available - contentHeight) / 2);
  bodyFn(ctx, startY + offset);
}

function divider(ctx, W, y, opacity = 0.12, widthPct = 0.76) {
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * (0.5 - widthPct / 2), y);
  ctx.lineTo(W * (0.5 + widthPct / 2), y);
  ctx.stroke();
}

// Short centered accent rule under the hero title — a restrained "premium divider" cue instead
// of a full-width line, per the brand rule that red is an accent, never a flood.
function accentRule(ctx, cx, y, width = 64) {
  ctx.strokeStyle = COLOR.red;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, y);
  ctx.lineTo(cx + width / 2, y);
  ctx.stroke();
}

// ---------------- anatomy watermark ----------------

function parseViewBox(vb) {
  const [minX, minY, w, h] = vb.split(" ").map(Number);
  return { minX, minY, w, h };
}

// BRK's real illustrated anatomy system (src/assets/anatomyData.js — the same data
// MuscleBodyOutline.jsx renders in-app), drawn directly onto the canvas as the share card's
// visual signature. This replaces generic athlete photography entirely: no stock imagery, no
// fabricated body. The session's dominant trained muscle group (session.mainMuscles[0], already
// computed by buildSessionSummary — never invented here) lights up in BRK red; everything else
// stays a muted charcoal watermark, low enough contrast to sit behind real data without
// competing with it. `zone === "full"` (a catch-all/conditioning day, or missing muscle data on
// an old session) intentionally skips the red highlight — lighting up the entire figure red
// would flood the card with color the brand rule explicitly reserves for accents.
// `forceView` overrides the view getMuscleDisplay would normally resolve — used for the
// Performance poster's "companion" figure (task section 5's two-figure spread, front + back
// flanking each other like the reference), which always renders the OPPOSITE view of the real
// trained-muscle figure. `highlight = false` keeps that companion figure permanently muted/
// charcoal, since it never represents real trained-muscle data — it's decorative symmetry only,
// exactly as uncolored in the reference as the real figure is red.
function drawAnatomyWatermark(ctx, { centerX, topY, height, muscleCategory, bodyAlpha = 0.4, redAlpha = 0.92, forceView = null, highlight = true }) {
  const resolved = getMuscleDisplay({ muscle: muscleCategory });
  const view = forceView || resolved.view;
  const zone = resolved.zone;
  const isBack = view === "back";
  const vb = parseViewBox(isBack ? VIEW_BOX_BACK : VIEW_BOX_FRONT);
  const parts = isBack ? BACK_PARTS : FRONT_PARTS;
  const zoneSlugs = isBack ? BACK_ZONE_SLUGS : FRONT_ZONE_SLUGS;
  const activeSlugs = highlight && zone !== "full" ? zoneSlugs[zone] || [] : [];

  const scale = height / vb.h;
  const width = vb.w * scale;

  ctx.save();
  ctx.translate(centerX - width / 2, topY);
  ctx.scale(scale, scale);
  ctx.translate(-vb.minX, -vb.minY);

  ctx.globalAlpha = bodyAlpha;
  ctx.fillStyle = COLOR.muscleOutline;
  ctx.fill(new Path2D(isBack ? OUTLINE_BACK : OUTLINE_FRONT));

  Object.entries(parts).forEach(([slug, ds]) => {
    if (activeSlugs.includes(slug)) return;
    ds.forEach((d) => {
      ctx.fillStyle = COLOR.muscleBody;
      ctx.fill(new Path2D(d));
    });
  });

  ctx.fillStyle = COLOR.muscleHair;
  ctx.fill(new Path2D(isBack ? HAIR_BACK : HAIR_FRONT));
  ctx.fillStyle = COLOR.muscleHead;
  ctx.fill(new Path2D(isBack ? HEAD_BACK : HEAD_FRONT));

  if (activeSlugs.length > 0) {
    ctx.globalAlpha = redAlpha;
    // Local-space gradient (pre-scale coordinates) so it reads correctly regardless of the
    // transform above — same top/bottom red gradient MuscleBodyOutline uses in-app.
    const redGrad = ctx.createLinearGradient(0, vb.minY, 0, vb.minY + vb.h);
    redGrad.addColorStop(0, "#e6474e");
    redGrad.addColorStop(1, "#9e141b");
    Object.entries(parts).forEach(([slug, ds]) => {
      if (!activeSlugs.includes(slug)) return;
      ds.forEach((d) => {
        ctx.fillStyle = redGrad;
        ctx.fill(new Path2D(d));
      });
    });
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------- data-driven copy helpers ----------------

// "BACK DAY" / "LEGS DAY" — never fabricated: pulled straight from session.mainMuscles, the same
// field Progress/Coach already use, computed once by buildSessionSummary from what was actually
// logged. null when the session predates that field or was pure conditioning.
function dayLabel(session) {
  const m = session.mainMuscles?.[0];
  return m ? `${m.toUpperCase()} DAY` : null;
}

// One short, data-driven session statement (task: never fake motivational copy) — PRs first
// (the strongest real claim), then the featured lift, then total volume as the last resort so a
// session with genuinely no PRs and no standout lift still gets a real, honest line.
// Only ever called by Performance, which already renders `featured` as its own big hero block
// above this line — so a "Best performance: name weight x reps" restatement here would just be
// the exact same fact twice on one card. That branch is intentionally skipped: PR count is new
// information (the hero shows the single best PR, this says how many happened), and total
// volume-by-muscle is a genuinely different framing of the number than the stat strip's raw
// volume figure — the only case with truly nothing new to add is a no-PR, no-volume session,
// which correctly yields no chip at all.
function performanceLine(session) {
  const prCount = sessionPRCount(session);
  if (prCount > 0) return `${prCount} PR${prCount > 1 ? "s" : ""} · ${session.workingSets ?? 0} working sets`;
  if (session.totalVolume) {
    const muscle = session.mainMuscles?.[0];
    return `${muscle ? `${muscle} volume` : "Session volume"}: ${session.totalVolume.toLocaleString()} lb`;
  }
  return null;
}

// ---------------- featured-lift selection ----------------

// Auto-picks the "hero" lift for the share card. Priority (per spec):
//   1. The session's own featured PR (same ordering App.jsx's Session Complete PR card and
//      SessionRecapView already use, via featuredAndOtherPRs, so the share card never disagrees
//      with what the athlete already saw).
//   2. The heaviest top set among COMPOUND exercises actually logged this session.
//   3. The single best top set of the whole session by estimated 1RM — identical to how
//      buildSessionSummary itself picks session.bestLift, so this tier is just that field.
//   4. The first exercise logged, whatever data is available for it.
export function pickFeaturedLift(session, exMap) {
  if (!session) return null;
  const entries = session.entries || [];

  const { featured } = featuredAndOtherPRs(session);
  if (featured) {
    const pr = featured.pr;
    return {
      exId: featured.exId,
      name: exMap?.[featured.exId]?.name || featured.exId,
      weight: pr.weight ?? session.bestLift?.weight ?? null,
      reps: pr.reps ?? session.bestLift?.reps ?? null,
      isPR: true,
      pr,
      source: "pr",
    };
  }

  if (entries.length > 0) {
    let bestCompound = null;
    entries.forEach((entry) => {
      if (exMap?.[entry.exId]?.type !== "compound") return;
      const counted = countedSets(entry.sets);
      if (counted.length === 0) return;
      const top = topSetOf(entry.sets);
      const e1rm = estimateOneRM(top.weight, top.reps);
      if (!bestCompound || e1rm > bestCompound.e1rm) bestCompound = { exId: entry.exId, weight: top.weight, reps: top.reps, e1rm };
    });
    if (bestCompound) {
      return {
        exId: bestCompound.exId,
        name: exMap?.[bestCompound.exId]?.name || bestCompound.exId,
        weight: bestCompound.weight,
        reps: bestCompound.reps,
        isPR: false,
        pr: null,
        source: "compound",
      };
    }
  }

  if (session.bestLift) {
    return {
      exId: session.bestLift.exId,
      name: exMap?.[session.bestLift.exId]?.name || session.bestLift.exId,
      weight: session.bestLift.weight,
      reps: session.bestLift.reps,
      isPR: false,
      pr: null,
      source: "bestSet",
    };
  }

  if (entries.length > 0) {
    const entry = entries[0];
    const counted = countedSets(entry.sets);
    const top = counted.length > 0 ? topSetOf(entry.sets) : entry.sets?.[0];
    if (!top) return null;
    return {
      exId: entry.exId,
      name: exMap?.[entry.exId]?.name || entry.exId,
      weight: top.weight,
      reps: top.reps,
      isPR: false,
      pr: null,
      source: "fallback",
    };
  }

  return null;
}

// Every exercise the athlete can manually pick as the featured lift, each with its own top set
// and whether IT personally produced a PR — feeds the "change featured lift" picker.
export function listFeaturableLifts(session, exMap) {
  const entries = session?.entries || [];
  const prsByExId = new Map();
  (session?.prs || []).forEach((pr) => {
    if (!prsByExId.has(pr.exId)) prsByExId.set(pr.exId, []);
    prsByExId.get(pr.exId).push(pr);
  });
  return entries
    .map((entry) => {
      const counted = countedSets(entry.sets);
      const top = counted.length > 0 ? topSetOf(entry.sets) : entry.sets?.[0];
      if (!top) return null;
      const prs = prsByExId.get(entry.exId) || [];
      return {
        exId: entry.exId,
        name: exMap?.[entry.exId]?.name || entry.exId,
        weight: top.weight,
        reps: top.reps,
        isPR: prs.length > 0,
        pr: prs[0] || null,
        source: prs.length > 0 ? "pr" : "manual",
      };
    })
    .filter(Boolean);
}

function heroTypeLabel(pr) {
  if (!pr) return null;
  return PR_TYPE_LABEL[pr.type] || "PR";
}

// ---------------- shared: stat strip ----------------

// Small hand-drawn glyphs (task section 8: "small red icon" per column, matching the reference's
// clock/layers/bar-chart/trophy row) — canvas can't use the app's Lucide SVGs directly, so these
// are minimal representative shapes at the same visual weight, red-stroked to match the brand's
// icon color everywhere else in the card.
function drawStatIcon(ctx, type, cx, cy, size) {
  ctx.save();
  ctx.strokeStyle = COLOR.red;
  ctx.fillStyle = COLOR.red;
  ctx.lineWidth = Math.max(1.4, size * 0.13);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const r = size / 2;
  if (type === "clock") {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - r * 0.55);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * 0.42, cy + r * 0.12);
    ctx.stroke();
  } else if (type === "layers") {
    for (let i = 0; i < 3; i++) {
      const yy = cy - r * 0.55 + i * r * 0.55;
      ctx.beginPath();
      ctx.moveTo(cx, yy - r * 0.32);
      ctx.lineTo(cx + r, yy);
      ctx.lineTo(cx, yy + r * 0.32);
      ctx.lineTo(cx - r, yy);
      ctx.closePath();
      if (i === 2) ctx.fill();
      else ctx.stroke();
    }
  } else if (type === "chart") {
    const barW = size * 0.22;
    const heights = [0.5, 0.85, 1, 0.65];
    const gap = size * 0.12;
    const totalW = heights.length * barW + (heights.length - 1) * gap;
    let bx = cx - totalW / 2;
    heights.forEach((hh) => {
      const bh = size * hh;
      roundRect(ctx, bx, cy + r - bh, barW, bh, barW * 0.3);
      ctx.fill();
      bx += barW + gap;
    });
  } else if (type === "trophy") {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.55, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.1);
    ctx.lineTo(cx - r * 0.4, cy + r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.55, cy - r * 0.45, r * 0.28, Math.PI * 0.3, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + r * 0.55, cy - r * 0.45, r * 0.28, Math.PI * 1.65, Math.PI * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.1);
    ctx.lineTo(cx, cy + r * 0.38);
    ctx.moveTo(cx - r * 0.32, cy + r * 0.55);
    ctx.lineTo(cx + r * 0.32, cy + r * 0.55);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, size * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ONE cohesive panel (task section 5: "one cohesive stat strip is better" than individual
// cards) — a layered surface with thin vertical separators between up to 4 columns, a small red
// icon per column, and a strong value/label pair. Used by both Performance and Recap so the two
// templates' stats always look like the same design system; Recap's stats (which don't pass
// `icon`) fall back to the original plain accent dot, unchanged.
function drawStatStrip(ctx, { x, y, width, stats, k }) {
  const h = sz(126, k, 82);
  ctx.fillStyle = COLOR.panelStrong;
  roundRect(ctx, x, y, width, h, 20);
  ctx.fill();
  ctx.strokeStyle = COLOR.panelBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, h, 20);
  ctx.stroke();

  const n = stats.length;
  const colW = width / n;
  stats.forEach((s, i) => {
    const cx = x + colW * i + colW / 2;
    if (s.icon) {
      drawStatIcon(ctx, s.icon, cx, y + h * 0.24, sz(20, k, 15));
    } else {
      ctx.beginPath();
      ctx.fillStyle = COLOR.red;
      ctx.arc(cx, y + h * 0.24, sz(4.5, k, 3), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.white;
    ctx.font = `800 ${sz(36, k, 23)}px ${FONT}`;
    ctx.fillText(s.value, cx, y + h * 0.62);
    ctx.fillStyle = COLOR.gray;
    ctx.font = `700 ${sz(15, k, 11)}px ${FONT}`;
    ctx.fillText(s.label.toUpperCase(), cx, y + h * 0.87);

    if (i < n - 1) {
      ctx.strokeStyle = COLOR.panelBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + colW * (i + 1), y + h * 0.24);
      ctx.lineTo(x + colW * (i + 1), y + h * 0.8);
      ctx.stroke();
    }
  });

  return h;
}

// ---------------- shared: numbered exercise rows ----------------

// Numbered, PR-aware exercise rows (task section 7) shared by Performance's compact breakdown
// and Recap's full breakdown — a PR row gets a red-tinted panel + border + badge + red value
// (task section 6: "PR = special," never flooding ordinary rows with red).
function drawExerciseRows(ctx, { x, y, width, rows, rowH, k, exMap, prsByExId, showPrevious = false }) {
  const gap = sz(14, k, 6);
  rows.forEach((entry, i) => {
    const counted = countedSets(entry.sets);
    const top = counted.length > 0 ? topSetOf(entry.sets) : entry.sets?.[0];
    const exPRs = prsByExId.get(entry.exId) || [];
    const isPR = exPRs.length > 0;
    const rowY = y + i * rowH;
    const h = rowH - gap;
    // Performance (showPrevious=true) reserves room for a real "Previous: X (+Y)" line on the PR
    // row (task follow-up: "repeat prior-performance detail in the PR row") by centering the main
    // content a little higher than dead-center; Recap never passes this, so its rows are
    // unaffected. Only the PR row actually draws the second line — other rows just get a touch
    // more breathing room above/below, which reads as intentional, not empty.
    const willShowPrev = showPrevious && isPR && exPRs[0]?.type === "weight" && exPRs[0]?.prev != null;
    const midY = willShowPrev ? rowY + h * 0.4 : rowY + h / 2;

    ctx.fillStyle = isPR ? COLOR.prPanel : i % 2 === 0 ? COLOR.panel : "rgba(255,255,255,0.015)";
    roundRect(ctx, x, rowY, width, h, 14);
    ctx.fill();
    if (isPR) {
      ctx.strokeStyle = COLOR.prBorder;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, rowY, width, h, 14);
      ctx.stroke();
    }

    const numW = sz(54, k, 34);
    const padX = sz(22, k, 14);
    ctx.textAlign = "left";
    ctx.fillStyle = isPR ? COLOR.red : COLOR.dimGray;
    ctx.font = `800 ${sz(21, k, 14)}px ${FONT}`;
    ctx.fillText(String(i + 1).padStart(2, "0"), x + padX, midY + sz(7, k, 5));

    ctx.fillStyle = COLOR.white;
    ctx.font = `700 ${sz(25, k, 16)}px ${FONT}`;
    const badgeReserve = isPR ? sz(68, k, 44) : 0;
    const name = truncateToWidth(ctx, exMap?.[entry.exId]?.name || entry.exId, width - numW - sz(200, k, 130) - badgeReserve);
    ctx.fillText(name, x + padX + numW, midY + sz(8, k, 5));
    const nameWidth = ctx.measureText(name).width;

    if (isPR) {
      drawBadgeInline(ctx, x + padX + numW + nameWidth + sz(14, k, 8), midY - sz(15, k, 11), "PR", k);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = isPR ? COLOR.red : COLOR.gray;
    ctx.font = `800 ${sz(25, k, 16)}px ${FONT}`;
    const setText = top ? `${top.weight} × ${top.reps}` : "—";
    ctx.fillText(setText, x + width - padX, midY + sz(8, k, 5));

    if (willShowPrev) {
      const pr = exPRs[0];
      const grayPart = `Previous: ${pr.prev} lb `;
      const deltaPart = `(+${Math.round((pr.weight - pr.prev) * 10) / 10} lb)`;
      const subSize = sz(15, k, 11);
      const subY = rowY + h * 0.76;
      ctx.font = `700 ${subSize}px ${FONT}`;
      const grayW = ctx.measureText(grayPart).width;
      ctx.font = `800 ${subSize}px ${FONT}`;
      const deltaW = ctx.measureText(deltaPart).width;
      const startX = x + width - padX - (grayW + deltaW);
      ctx.textAlign = "left";
      ctx.font = `700 ${subSize}px ${FONT}`;
      ctx.fillStyle = COLOR.gray;
      ctx.fillText(grayPart, startX, subY);
      ctx.font = `800 ${subSize}px ${FONT}`;
      ctx.fillStyle = COLOR.green;
      ctx.fillText(deltaPart, startX + grayW, subY);
    }
    ctx.textAlign = "center";
  });
  return rows.length * rowH;
}

// Three-tier density scale keyed off the actual export height rather than a single "compact"
// boolean — Square (1080px tall) has meaningfully less room than Post (1350px), and a two-tier
// system that was tuned against Post/Story silently overflowed into the footer on Square (every
// gap and font was simply too tall to fit). `k` scales every subsequent gap/font down from the
// Story-tuned base numbers; `maxRows` bounds the exercise breakdown separately since a row count
// is discrete, not something that can be scaled continuously.
function sizeScale(H) {
  if (H <= 1100) return { k: 0.6, maxRows: 3 };
  if (H <= 1500) return { k: 0.78, maxRows: 4 };
  return { k: 1, maxRows: 6 };
}

// Scales `base` by `k`, never going below `floor` — keeps Square legible instead of shrinking
// proportionally into unreadable text.
function sz(base, k, floor) {
  return Math.max(floor, Math.round(base * k));
}

function buildPrsByExId(session) {
  const map = new Map();
  (session.prs || []).forEach((pr) => {
    if (!map.has(pr.exId)) map.set(pr.exId, []);
    map.get(pr.exId).push(pr);
  });
  return map;
}

// ---------------- template: PERFORMANCE CARD (social poster) ----------------
// v4 rebuild (task: "the Performance template is a social poster generator, not an app screen
// mirrored to canvas"). Every section below is anchored to a FIXED fraction of the export height
// — not measured-then-centered like the old flow layout — so the composition is deterministic
// regardless of session content, matching the task's explicit "do not let the exported image
// depend on content length" requirement. Zone budget (task section 18): top 20% brand/title/
// anatomy, next 25% PR hero, next 15% stat strip + comparison, next 25% top sets, bottom 15%
// footer. Only the title/subtitle pair flows locally against each other (a 2-line title still
// needs its own subtitle directly under it) — every OTHER section start is a fixed H-fraction.

// Small, tasteful side copy (task section 11) — static BRK brand language, identical on every
// export, never a per-workout fabrication.
const POSTER_SIDE_LINES = ["DISCIPLINE", "PROGRESS", "A STRONGER YOU"];

// Splits "Program — Day" style titles so the segment after the em dash can render in BRK red
// (task section 4's "Titan — [Legs in red]" example) — but ONLY when the whole title fits on one
// line at the fitted size. A wrapped multi-line title falls back to plain white rather than risk
// coloring the wrong fragment of a long, real (not curated) workout name.
// Guarded to short suffixes only ("Titan — Back", "Titan — Legs") — this app's real program/day
// names aren't always that tidy (a family program day can read "Reaper — Day 1: Full body
// functional"), and painting a whole long phrase red stops looking like "emphasis on the body-
// part word" and starts looking like an error. The dash itself stays in the white prefix.
function splitTitleForColor(text) {
  const idx = text.indexOf(" — ");
  if (idx === -1) return null;
  const suffix = text.slice(idx + 3);
  if (suffix.length === 0 || suffix.length > 18) return null;
  return { prefix: text.slice(0, idx + 3), suffix };
}

// Dark, softly-glowing panel behind the PR/Best-Set hero (task section 6: "dark translucent
// background... red outline/glow around panel"). `isPR` drives whether the glow/border actually
// reads as red or stays a neutral premium panel for the calmer Best Set tier.
function drawHeroPanel(ctx, x, y, w, h, isPR) {
  ctx.save();
  if (isPR) {
    ctx.shadowColor = "rgba(239,68,68,0.5)";
    ctx.shadowBlur = 46;
  }
  ctx.fillStyle = "rgba(5,5,6,0.42)";
  roundRect(ctx, x, y, w, h, 32);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = isPR ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.12)";
  ctx.lineWidth = isPR ? 2 : 1.5;
  roundRect(ctx, x, y, w, h, 32);
  ctx.stroke();
}

function drawPerformanceCard(ctx, W, H, session, exMap, featured) {
  const { k } = sizeScale(H);
  const isPR = !!featured?.isPR;

  background(ctx, W, H, H * 0.38);

  const leftX = W * 0.08;
  const rightEdge = W - W * 0.07;
  const topMargin = Math.max(H * 0.06, 84);
  const storyPad = k === 1 ? 46 : 0;

  // ---- top-left brand lockup (task section 3: top-left, not centered) ----
  const brandSize = sz(34, k, 22);
  wordmark(ctx, W, topMargin + brandSize * 0.72, brandSize, "left", leftX);
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${sz(16, k, 12)}px ${FONT}`;
  const sessionLabelY = topMargin + brandSize * 0.72 + sz(30, k, 20);
  ctx.fillText("SESSION COMPLETE", leftX, sessionLabelY);

  // ---- tiny atmospheric side copy, top-right, with a thin red accent line (task section 11) ----
  const sideSize = sz(13, k, 10);
  const sideLineH = sideSize * 1.9;
  const sideTop = topMargin + sz(4, k, 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(154,160,166,0.7)";
  ctx.font = `700 ${sideSize}px ${FONT}`;
  POSTER_SIDE_LINES.forEach((line, i) => {
    ctx.fillText(line, rightEdge, sideTop + i * sideLineH);
  });
  ctx.strokeStyle = "rgba(239,68,68,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rightEdge + sz(14, k, 10), sideTop - sideSize * 0.7);
  ctx.lineTo(rightEdge + sz(14, k, 10), sideTop + (POSTER_SIDE_LINES.length - 1) * sideLineH + sideSize * 0.3);
  ctx.stroke();

  // ---- dual anatomy figures (task section 5): the real trained-muscle figure plus a muted
  // companion of the opposite view, flanking each other upper-right like the reference. Neither
  // figure nor its highlight is fabricated — the companion is never colored, ever. ----
  const anatomyHeight = H * (k < 1 ? 0.46 : 0.43);
  const anatomyTop = H * 0.082;
  const { view: activeView } = getMuscleDisplay({ muscle: session.mainMuscles?.[0] });
  const companionView = activeView === "back" ? "front" : "back";
  drawAnatomyWatermark(ctx, {
    centerX: W * 0.65,
    topY: anatomyTop,
    height: anatomyHeight,
    muscleCategory: session.mainMuscles?.[0],
    forceView: companionView,
    highlight: false,
    bodyAlpha: 0.28,
  });
  drawAnatomyWatermark(ctx, {
    centerX: W * 0.94,
    topY: anatomyTop,
    height: anatomyHeight,
    muscleCategory: session.mainMuscles?.[0],
    // Bug found in QA: at the previous 0.52, the muted charcoal outline/body fill became
    // functionally invisible against this exact spot's accumulated darkening (page vignette +
    // radial glow falloff + the hero panel's own translucent fill underneath it) — only the much
    // higher-alpha red highlight still read. 0.78 stays a watermark (not a flat opaque cutout)
    // while actually surviving that darkening everywhere the figure can land.
    bodyAlpha: 0.78,
  });

  // ---- eyebrow + title + subtitle (left-aligned, title is the biggest single element) ----
  const eyebrowY = H * 0.152;
  accentRule(ctx, leftX + sz(16, k, 12), eyebrowY, sz(32, k, 22));
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${sz(15, k, 11)}px ${FONT}`;
  ctx.fillText("STRONGER CONSISTENTLY", leftX + sz(42, k, 30), eyebrowY + sz(5, k, 4));

  const titleY = H * 0.2;
  const titleMaxW = W * 0.56;
  const titleText = session.planName || "Workout";
  const titleSize = fitFontSize(ctx, titleText, titleMaxW, "900", sz(64, k, 32), 24);
  const colorSplit = splitTitleForColor(titleText);
  const fitsOneLine = colorSplit && ctx.measureText(titleText).width <= titleMaxW;
  let titleBottom;
  if (fitsOneLine) {
    ctx.font = `900 ${titleSize}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillStyle = COLOR.white;
    ctx.fillText(colorSplit.prefix, leftX, titleY + titleSize * 0.82);
    const prefixW = ctx.measureText(colorSplit.prefix).width;
    ctx.fillStyle = COLOR.red;
    ctx.fillText(colorSplit.suffix, leftX + prefixW, titleY + titleSize * 0.82);
    titleBottom = titleY + titleSize * 0.82;
  } else {
    ctx.fillStyle = COLOR.white;
    const titleLines = wrapAligned(ctx, titleText, leftX, titleY + titleSize * 0.82, titleMaxW, titleSize * 1.04, 2, "left");
    titleBottom = titleY + titleSize * 0.82 + (titleLines - 1) * titleSize * 1.04;
  }

  const day = dayLabel(session);
  const subtitle = day ? `${day} · ${formatSessionDuration(session.durationSec).toUpperCase()}` : formatSessionDuration(session.durationSec).toUpperCase();
  ctx.fillStyle = COLOR.gray;
  ctx.font = `700 ${sz(22, k, 15)}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(subtitle, leftX, titleBottom + sz(38, k, 26));

  // ---- PR / Best Set hero panel — fixed zone 2 (task's 20%-45% band) ----
  const heroPanelY = H * 0.3;
  const heroPanelH = H * 0.22;
  const heroPanelW = W * 0.88;
  const heroPanelX = W / 2 - heroPanelW / 2;
  drawHeroPanel(ctx, heroPanelX, heroPanelY, heroPanelW, heroPanelH, isPR);

  // ---- decorative side copy, left of the panel (follow-up polish: fills the otherwise-empty
  // strip left of the hero panel, mirroring the top-right triplet's tiny/low-contrast/secondary
  // treatment — static brand voice, never workout data, never fighting the panel for attention).
  const sideLeftSize = sz(13, k, 10);
  const sideLeftLineH = sideLeftSize * 1.9;
  const sideLeftLines = ["SAME WORK.", "HIGHER STANDARDS."];
  const sideLeftY = heroPanelY + heroPanelH / 2 - ((sideLeftLines.length - 1) * sideLeftLineH) / 2;
  const sideLeftX = leftX;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(154,160,166,0.6)";
  ctx.font = `700 ${sideLeftSize}px ${FONT}`;
  sideLeftLines.forEach((line, i) => ctx.fillText(line, sideLeftX, sideLeftY + i * sideLeftLineH));
  ctx.strokeStyle = "rgba(239,68,68,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sideLeftX - sz(14, k, 10), sideLeftY - sideLeftSize * 0.7);
  ctx.lineTo(sideLeftX - sz(14, k, 10), sideLeftY + (sideLeftLines.length - 1) * sideLeftLineH + sideLeftSize * 0.3);
  ctx.stroke();

  ctx.textAlign = "center";
  let hy = heroPanelY + heroPanelH * 0.16;
  const labelText = isPR ? "NEW PR" : "BEST SET";
  ctx.fillStyle = COLOR.red;
  ctx.font = `800 ${sz(22, k, 16)}px ${FONT}`;
  const ruleW = sz(46, k, 30);
  ctx.fillText(labelText, W / 2, hy);
  const labelW = ctx.measureText(labelText).width;
  ctx.strokeStyle = "rgba(239,68,68,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - labelW / 2 - ruleW - sz(14, k, 10), hy - sz(6, k, 4));
  ctx.lineTo(W / 2 - labelW / 2 - sz(14, k, 10), hy - sz(6, k, 4));
  ctx.moveTo(W / 2 + labelW / 2 + sz(14, k, 10), hy - sz(6, k, 4));
  ctx.lineTo(W / 2 + labelW / 2 + ruleW + sz(14, k, 10), hy - sz(6, k, 4));
  ctx.stroke();
  hy += sz(46, k, 30);

  if (featured) {
    const nameSize = fitFontSize(ctx, featured.name, heroPanelW * 0.86, "800", sz(34, k, 18), 16);
    ctx.fillStyle = COLOR.white;
    ctx.font = `800 ${nameSize}px ${FONT}`;
    wrapCentered(ctx, featured.name, W / 2, hy, heroPanelW * 0.86, nameSize * 1.06, 1);
    hy += nameSize * 1.06 + sz(10, k, 6);

    const heroSize = sz(96, k, 52);
    const spotlightY = hy + heroSize * 0.35;
    const spotlight = ctx.createRadialGradient(W / 2, spotlightY, 0, W / 2, spotlightY, W * 0.38);
    spotlight.addColorStop(0, isPR ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)");
    spotlight.addColorStop(1, "rgba(239,68,68,0)");
    ctx.fillStyle = spotlight;
    ctx.fillRect(heroPanelX, spotlightY - heroPanelW * 0.5, heroPanelW, heroPanelW);

    ctx.fillStyle = COLOR.white;
    ctx.font = `900 ${heroSize}px ${FONT}`;
    ctx.textAlign = "center";
    const heroText = featured.weight != null ? `${featured.weight} × ${featured.reps}` : "—";
    ctx.fillText(heroText, W / 2, hy + heroSize * 0.78);
    hy += heroSize * 0.78 + sz(22, k, 14);

    if (isPR) {
      drawBadge(ctx, W / 2, hy, heroTypeLabel(featured.pr) || "WEIGHT PR", { fontSize: sz(18, k, 13) });
      // Floor raised from 30->42 (found during Square QA — the badge's own rendered height at
      // its font floor already exceeds a 30px gap, so the previous/delta line below it was
      // drawing inside the badge instead of under it).
      hy += sz(52, k, 42);
      if (featured.pr?.type === "weight" && featured.pr.prev != null) {
        // Two-color line ("Previous: 170 lb" gray, "+5 lb" green) — drawn as two left-anchored
        // runs sized to sit centered as one unit, since canvas has no mixed-color text primitive.
        const grayPart = `Previous: ${featured.pr.prev} lb   `;
        const greenPart = `+${Math.round((featured.weight - featured.pr.prev) * 10) / 10} lb`;
        ctx.font = `700 ${sz(16, k, 12)}px ${FONT}`;
        const grayW = ctx.measureText(grayPart).width;
        const greenW = ctx.measureText(greenPart).width;
        const startX = W / 2 - (grayW + greenW) / 2;
        ctx.textAlign = "left";
        ctx.fillStyle = COLOR.gray;
        ctx.fillText(grayPart, startX, hy);
        ctx.fillStyle = COLOR.green;
        ctx.fillText(greenPart, startX + grayW, hy);
        ctx.textAlign = "center";
      }
    }
  } else {
    ctx.fillStyle = COLOR.white;
    ctx.font = `800 ${sz(40, k, 22)}px ${FONT}`;
    ctx.fillText("Workout logged", W / 2, hy + sz(30, k, 18));
  }

  // ---- stat strip — fixed zone 3 start ----
  const stripY = H * 0.545;
  const stripW = W * 0.86;
  const stripX = W / 2 - stripW / 2;
  const prCount = sessionPRCount(session);
  const stats = [
    { value: formatSessionDuration(session.durationSec), label: "Duration", icon: "clock" },
    { value: String(session.workingSets ?? 0), label: "Sets", icon: "layers" },
    { value: (session.totalVolume ?? 0).toLocaleString(), label: "Volume", icon: "chart" },
    { value: String(prCount), label: "PR", icon: "trophy" },
  ];
  const stripH = drawStatStrip(ctx, { x: stripX, y: stripY, width: stripW, stats, k });
  const hasComparison = session.perfDeltaPct != null;
  const cmpY = stripY + stripH + sz(38, k, 24);

  // ---- performance-comparison strip (task section 9) — real data only, cleanly omitted when
  // there's no prior session to compare against. Never invented. ----
  if (hasComparison) {
    const up = session.perfDeltaPct >= 0;
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.gray;
    ctx.font = `600 ${sz(18, k, 13)}px ${FONT}`;
    const prefix = `Performance vs last ${session.planName}: `;
    const deltaText = `${up ? "+" : ""}${session.perfDeltaPct}%`;
    ctx.font = `700 ${sz(18, k, 13)}px ${FONT}`;
    const prefixW = ctx.measureText(prefix).width;
    ctx.font = `800 ${sz(18, k, 13)}px ${FONT}`;
    const deltaW = ctx.measureText(deltaText).width;
    const totalW = prefixW + deltaW;
    ctx.textAlign = "left";
    ctx.font = `700 ${sz(18, k, 13)}px ${FONT}`;
    ctx.fillStyle = COLOR.gray;
    ctx.fillText(prefix, W / 2 - totalW / 2, cmpY);
    ctx.font = `800 ${sz(18, k, 13)}px ${FONT}`;
    ctx.fillStyle = up ? COLOR.green : COLOR.red;
    ctx.fillText(deltaText, W / 2 - totalW / 2 + prefixW, cmpY);
    ctx.textAlign = "center";
  }

  // ---- TOP SETS — fixed zone 4 start (task section 10: ~4 rows, not the full log). Floored at
  // the 0.655H target, but never allowed to sit closer than a safe gap after the comparison line
  // actually ends — the fixed fraction alone overlapped the comparison strip at the Square tier,
  // where stat-strip/gap floors don't compress as fast as H itself does. ----
  const topSetsY = Math.max(H * 0.655, (hasComparison ? cmpY : stripY + stripH) + sz(46, k, 28));
  const prsByExId = buildPrsByExId(session);
  const entries = session.entries || [];
  const rows = entries.slice(0, 4);
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.gray;
  ctx.font = `800 ${sz(19, k, 14)}px ${FONT}`;
  ctx.fillText("TOP SETS", leftX, topSetsY);
  if (entries.length > 0) {
    // Brand-driven tagline (follow-up polish) in place of the plain "N exercises · N sets" — that
    // count is already shown in the stat strip above, so this line can afford to be voice instead
    // of a repeated number.
    ctx.textAlign = "right";
    ctx.fillStyle = COLOR.dimGray;
    ctx.font = `700 ${sz(15, k, 11)}px ${FONT}`;
    ctx.fillText("CONSISTENT EFFORT. REAL PROGRESS.", rightEdge, topSetsY);
  }
  ctx.textAlign = "center";

  if (rows.length > 0) {
    const rowY = topSetsY + sz(28, k, 18);
    // Bumped from 84 (a bit taller than Recap's rows) — the PR row now carries a real second
    // line ("Previous: X lb (+Y lb)"), so every row needs enough room for it even though only
    // the PR row actually draws it.
    const rowH = sz(94, k, 52);
    const rowW = W * 0.86;
    const rowX = W / 2 - rowW / 2;
    const rowsBottom = rowY + drawExerciseRows(ctx, { x: rowX, y: rowY, width: rowW, rows, rowH, k, exMap, prsByExId, showPrevious: true });

    const remaining = entries.length - rows.length;
    if (remaining > 0) {
      ctx.fillStyle = COLOR.dimGray;
      ctx.font = `600 ${sz(17, k, 12)}px ${FONT}`;
      ctx.fillText(`+ ${remaining} more exercise${remaining === 1 ? "" : "s"}`, W / 2, rowsBottom + sz(30, k, 18));
    }
  }

  // ---- BRK footer — fixed zone 5, with Story-height safe-margin clearance ----
  const footerWordmarkY = H - sz(120, k, 66) - storyPad;
  wordmark(ctx, W, footerWordmarkY, sz(30, k, 20));
  footerTagline(ctx, W, H, sz(20, k, 14), storyPad);

  // ---- decorative footer-flanking copy (follow-up polish) — mirrors the reference's two small
  // taglines either side of the centered wordmark. Vertically centered ON the wordmark's own row
  // (not a separate line above it) so it never needs its own dedicated vertical space — that
  // extra space is exactly what overlapped the "+more exercises" line at the Square tier's
  // tighter budget. Same tiny/low-contrast/secondary treatment as every other decorative line
  // here; purely static brand voice, no workout data. ----
  const footerSideSize = sz(12, k, 9);
  const footerSideLineH = footerSideSize * 1.85;
  const footerSideY = footerWordmarkY - footerSideLineH * 0.55;
  ctx.fillStyle = "rgba(154,160,166,0.55)";
  ctx.font = `700 ${footerSideSize}px ${FONT}`;
  ctx.textAlign = "left";
  ["HARDER TODAY", "BRIGHTER TOMORROW"].forEach((line, i) => ctx.fillText(line, leftX, footerSideY + i * footerSideLineH));
  ctx.textAlign = "right";
  ["BUILD STRONGER", "MOVE FURTHER"].forEach((line, i) => ctx.fillText(line, rightEdge, footerSideY + i * footerSideLineH));
  ctx.textAlign = "center";
}

// ---------------- template: MINIMAL STORY CARD ----------------
// Genuinely minimal (task section 16) — workout title, best lift, key stats, a small anatomy
// visual, BRK footer. None of Performance's stat strip/exercise breakdown complexity.

function drawMinimalCard(ctx, W, H, session, featured) {
  const compact = H <= 1500;
  background(ctx, W, H, H * 0.46);

  // Extra bottom clearance on Story height only (follow-up task: keep BRK's footer out of
  // Instagram's reserved bottom reply-bar zone) — Post/Square aren't posted as Stories.
  const storyPad = compact ? 0 : 46;
  const bodyStartY = H * (compact ? 0.14 : 0.12);
  const footerTopY = H - (compact ? 130 : 170) - storyPad;

  // Small, quiet anatomy watermark — present as the brand signature but never competing with
  // the big numbers, per "keep Minimal Story genuinely minimal."
  drawAnatomyWatermark(ctx, {
    centerX: W * 0.85,
    topY: bodyStartY,
    height: compact ? H * 0.16 : H * 0.15,
    muscleCategory: session.mainMuscles?.[0],
    bodyAlpha: 0.28,
    redAlpha: 0.7,
  });

  function body(c, startY) {
    let y = startY;
    c.textAlign = "center";
    c.fillStyle = COLOR.red;
    c.font = `800 ${compact ? 24 : 28}px ${FONT}`;
    c.fillText((session.planName || "Workout").toUpperCase(), W / 2, y);
    y += compact ? 90 : 130;

    if (featured) {
      const heroSize = compact ? 140 : 180;
      c.fillStyle = COLOR.white;
      c.font = `900 ${heroSize}px ${FONT}`;
      const heroText = featured.weight != null ? `${featured.weight} × ${featured.reps}` : "—";
      c.fillText(heroText, W / 2, y + heroSize * 0.72);
      y += heroSize * 0.72 + (compact ? 30 : 42);

      const nameSize = fitFontSize(c, featured.name, W * 0.8, "700", compact ? 34 : 42, 22);
      c.fillStyle = COLOR.gray;
      c.textAlign = "center";
      const nameLines = wrapCentered(c, featured.name.toUpperCase(), W / 2, y, W * 0.8, nameSize * 1.2, 2);
      y += nameLines * nameSize * 1.2 + (compact ? 34 : 46);
    }

    const prCount = sessionPRCount(session);
    if (prCount > 0) {
      drawBadge(c, W / 2, y, `${prCount} PR${prCount > 1 ? "S" : ""}`, { fontSize: compact ? 20 : 24 });
      y += compact ? 70 : 86;
    }

    c.fillStyle = COLOR.white;
    c.font = `800 ${compact ? 30 : 36}px ${FONT}`;
    c.fillText(`${(session.totalVolume ?? 0).toLocaleString()} LB VOLUME`, W / 2, y);
    y += compact ? 42 : 50;
    c.fillStyle = COLOR.gray;
    c.font = `700 ${compact ? 18 : 22}px ${FONT}`;
    c.fillText(`${session.workingSets ?? 0} WORKING SETS  ·  ${formatSessionDuration(session.durationSec).toUpperCase()}`, W / 2, y);
    y += compact ? 14 : 18;

    return y;
  }

  centerBody(ctx, bodyStartY, footerTopY, body);

  wordmark(ctx, W, H - (compact ? 90 : 120) - storyPad, compact ? 30 : 36);
  footerTagline(ctx, W, H, compact ? 15 : 18, storyPad);
}

// ---------------- FULL RECAP — complete workout record (tall document image) ----------------
// Rebuilt (task: "BRK FULL RECAP REBUILD — turn it into the complete workout record"). This is
// NOT a social poster and is deliberately never drawn at one of SHARE_SIZES' fixed heights — the
// canvas height is measured from real content (every exercise, every set, warm-ups, drop
// sequences, PRs, equipment, notes, comparison, Coach summary) and only then allocated, so a
// 12-exercise session is simply a taller image rather than losing exercises to a row cap. Width
// stays 1080 (same as every other export) for a legible, consistent line length.
//
// Two-pass render: `drawFullRecapDoc` runs once against a throwaway scratch context purely to
// measure the real height its own content needs (font metrics don't depend on canvas size — same
// trick `centerBody` above already relies on), then runs again for real once the canvas is sized
// to fit. No content is ever cropped or capped to make it fit a guessed height.
import { buildFullRecapData } from "./fullRecap.js";

const RECAP_DOC = {
  marginX: 0.07,
  lineGap: 1.32,
};

function recapSectionLabel(ctx, x, y, text, color = COLOR.gray) {
  ctx.textAlign = "left";
  ctx.fillStyle = color;
  ctx.font = `800 21px ${FONT}`;
  ctx.fillText(text, x, y);
}

// One logged set as a document row: type/index on the left, weight x reps + RIR/quality/PR
// badges on the right side of the same line, drop sequences as their own indented arrow lines
// directly beneath (task section 4 — never flattened into one fake set).
function drawRecapSetRow(ctx, { x, width, y, row }) {
  const isWarm = row.isWarmup;
  ctx.textAlign = "left";
  ctx.fillStyle = isWarm ? COLOR.dimGray : COLOR.gray;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText(isWarm ? "WARM" : `#${row.index}`, x, y);

  ctx.fillStyle = isWarm ? COLOR.gray : COLOR.white;
  ctx.font = `800 24px ${FONT}`;
  const setText = `${row.weight} × ${row.reps}`;
  ctx.fillText(setText, x + 66, y);
  let cursorX = x + 66 + ctx.measureText(setText).width + 18;

  if (row.rir != null || row.rpe != null) {
    ctx.fillStyle = COLOR.gray;
    ctx.font = `700 16px ${FONT}`;
    const t = row.rir != null ? `RIR ${row.rir}` : `RPE ${row.rpe}`;
    ctx.fillText(t, cursorX, y);
    cursorX += ctx.measureText(t).width + 16;
  }
  if (row.setType !== "working" && row.setType !== "warmup") {
    cursorX += drawBadgeInline(ctx, cursorX, y - 20, row.setTypeLabel.toUpperCase()) + 10;
  }
  if (row.qualityLabel) {
    cursorX += drawBadgeInline(ctx, cursorX, y - 20, row.qualityLabel.toUpperCase()) + 10;
  }
  if (row.prs.length > 0) {
    cursorX += drawBadgeInline(ctx, cursorX, y - 20, "PR") + 10;
  }

  let cy = y + 28;
  row.drops.forEach((d) => {
    ctx.fillStyle = COLOR.dimGray;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText("→", x + 66, cy);
    ctx.fillStyle = COLOR.white;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(`${d.weight} × ${d.reps}`, x + 96, cy);
    cy += 30;
  });
  return cy;
}

// One complete exercise block: name/equipment/target, every set (warm-up then working), a PR
// callout when this exercise produced one, joint note, and the compact derived-totals line.
function drawRecapExercise(ctx, { x, width, y, ex, index }) {
  let cy = y;
  const hasPR = ex.prs.length > 0;

  ctx.textAlign = "left";
  ctx.fillStyle = hasPR ? COLOR.red : COLOR.dimGray;
  ctx.font = `800 20px ${FONT}`;
  ctx.fillText(String(index + 1).padStart(2, "0"), x, cy);

  ctx.fillStyle = COLOR.white;
  const nameSize = fitFontSize(ctx, ex.name, width - 56 - (hasPR ? 70 : 0), "800", 27, 18);
  ctx.font = `800 ${nameSize}px ${FONT}`;
  const name = truncateToWidth(ctx, ex.name, width - 56 - (hasPR ? 70 : 0));
  ctx.fillText(name, x + 46, cy);
  if (hasPR) drawBadgeInline(ctx, x + 46 + ctx.measureText(name).width + 14, cy - 20, "PR");
  cy += 30;

  if (ex.equipmentLabel || ex.targetReps != null) {
    ctx.fillStyle = COLOR.gray;
    ctx.font = `700 16px ${FONT}`;
    const meta = [ex.equipmentLabel, ex.targetReps != null ? `Target: ${ex.targetReps} reps` : null].filter(Boolean).join("   ·   ");
    ctx.fillText(meta, x + 46, cy);
    cy += 26;
  }
  cy += 10;

  ctx.strokeStyle = COLOR.panelBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, x, cy, width, 1, 0);
  ctx.stroke();
  cy += 20;

  ex.setRows.forEach((row) => {
    cy = drawRecapSetRow(ctx, { x, width, y: cy, row });
    cy += 14;
  });

  if (ex.prs.length > 0) {
    ex.prs.forEach((pr) => {
      ctx.fillStyle = COLOR.red;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(`${PR_TYPE_LABEL[pr.type]} — previous ${prPreviousLabel(pr)} (${prDeltaLabel(pr)})`, x + 46, cy);
      cy += 26;
    });
  }
  if (ex.jointNote) {
    ctx.fillStyle = COLOR.red;
    ctx.font = `700 16px ${FONT}`;
    const area = ex.jointNote.bodyArea ? `${ex.jointNote.bodyArea} discomfort` : "Discomfort noted";
    const sev = ex.jointNote.severity != null ? `: ${ex.jointNote.severity}/10` : "";
    ctx.fillText(`${area}${sev}`, x + 46, cy);
    cy += 26;
  }

  if (ex.workingSetCount > 0) {
    cy += 6;
    ctx.fillStyle = COLOR.gray;
    ctx.font = `700 16px ${FONT}`;
    const bits = [
      `${ex.workingSetCount} WORKING SET${ex.workingSetCount === 1 ? "" : "S"}`,
      `${ex.workingReps} REPS`,
      `${ex.volume.toLocaleString()} LB`,
      ex.bestSet ? `BEST ${ex.bestSet.weight} × ${ex.bestSet.reps}` : null,
    ]
      .filter(Boolean)
      .join("   ·   ");
    ctx.fillText(bits, x + 46, cy);
    cy += 20;
  }

  return cy + 34;
}

function drawFullRecapDoc(ctx, W, data) {
  const leftX = W * RECAP_DOC.marginX;
  const rightEdge = W - W * RECAP_DOC.marginX;
  const contentW = rightEdge - leftX;
  let y = 76;

  wordmark(ctx, W, y, 36, "left", leftX);
  y += 46;
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.red;
  ctx.font = `800 16px ${FONT}`;
  ctx.fillText("FULL WORKOUT RECAP", leftX, y);
  y += 44;

  ctx.fillStyle = COLOR.white;
  const titleSize = fitFontSize(ctx, data.planName, contentW, "900", 48, 26);
  ctx.font = `900 ${titleSize}px ${FONT}`;
  const titleLines = wrapAligned(ctx, data.planName, leftX, y, contentW, titleSize * 1.05, 2, "left");
  y += (titleLines - 1) * titleSize * 1.05 + 40;

  ctx.fillStyle = COLOR.gray;
  ctx.font = `700 18px ${FONT}`;
  const dateLabel = data.finishedAt ? new Date(data.finishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;
  ctx.fillText([dateLabel, data.durationLabel].filter(Boolean).join("   ·   "), leftX, y);
  y += 50;

  divider(ctx, W, y, 0.12, 1);
  y += 44;

  recapSectionLabel(ctx, leftX, y, "SESSION SUMMARY");
  y += 30;
  const stats = [
    { value: data.durationLabel, label: "Duration" },
    { value: String(data.workingSets), label: "Working Sets" },
    ...(data.warmupSets > 0 ? [{ value: String(data.warmupSets), label: "Warm-up" }] : []),
    { value: String(data.totalReps), label: "Total Reps" },
    { value: data.totalVolume.toLocaleString(), label: "Volume" },
    { value: String(data.prCount), label: "PRs" },
  ];
  const stripH = drawStatStrip(ctx, { x: leftX, y, width: contentW, stats: stats.slice(0, 4), k: 1 });
  y += stripH + 16;
  if (stats.length > 4) {
    const stripH2 = drawStatStrip(ctx, { x: leftX, y, width: contentW, stats: stats.slice(4), k: 1 });
    y += stripH2 + 16;
  }
  ctx.textAlign = "left"; // drawStatStrip leaves textAlign at "center" — every left-aligned line below depends on this
  if (data.mainMuscles.length > 0) {
    ctx.fillStyle = COLOR.gray;
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText(`Muscles trained: ${data.mainMuscles.join(", ")}`, leftX, y + 14);
    y += 40;
  }
  y += 20;

  if (data.readiness || data.alternateGym) {
    divider(ctx, W, y, 0.12, 1);
    y += 40;
    recapSectionLabel(ctx, leftX, y, "SESSION CONTEXT");
    y += 32;
    if (data.readiness) {
      ctx.fillStyle = COLOR.white;
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(`Readiness: ${data.readiness.score}/100 (${data.readiness.bandLabel})`, leftX, y);
      y += 30;
    }
    if (data.alternateGym) {
      ctx.fillStyle = COLOR.red;
      ctx.font = `700 18px ${FONT}`;
      ctx.fillText(`Alternate gym${data.alternateGym.locationLabel ? ` — ${data.alternateGym.locationLabel}` : ""}`, leftX, y);
      y += 30;
    }
    y += 14;
  }

  if (data.prSummary.length > 0) {
    divider(ctx, W, y, 0.12, 1);
    y += 44;
    recapSectionLabel(ctx, leftX, y, `${data.prCount} PR${data.prCount === 1 ? "" : "S"}`, COLOR.red);
    y += 34;
    data.prSummary.forEach((p) => {
      ctx.fillStyle = COLOR.white;
      ctx.font = `800 19px ${FONT}`;
      ctx.fillText(p.name, leftX, y);
      ctx.textAlign = "right";
      ctx.fillStyle = COLOR.green;
      ctx.font = `800 17px ${FONT}`;
      ctx.fillText(p.deltaLabel, rightEdge, y);
      ctx.textAlign = "left";
      ctx.fillStyle = COLOR.gray;
      ctx.font = `700 15px ${FONT}`;
      ctx.fillText(`${p.heroLabel} · ${p.typeLabel}`, leftX, y + 22);
      y += 48;
    });
    y += 8;
  }

  divider(ctx, W, y, 0.12, 1);
  y += 44;
  recapSectionLabel(ctx, leftX, y, "COMPLETE EXERCISE BREAKDOWN");
  y += 38;

  data.exercises.forEach((ex, i) => {
    y = drawRecapExercise(ctx, { x: leftX, width: contentW, y, ex, index: i });
  });

  if (data.note) {
    divider(ctx, W, y, 0.12, 1);
    y += 40;
    recapSectionLabel(ctx, leftX, y, "WORKOUT NOTES");
    y += 30;
    ctx.fillStyle = COLOR.white;
    ctx.font = `600 19px ${FONT}`;
    const noteLines = wrapAligned(ctx, data.note, leftX, y, contentW, 27, 8, "left");
    y += noteLines * 27 + 24;
  }

  if (data.comparison) {
    divider(ctx, W, y, 0.12, 1);
    y += 40;
    recapSectionLabel(ctx, leftX, y, `VS LAST ${data.comparison.planName.toUpperCase()}`);
    y += 32;
    const bits = [
      data.comparison.deltaVolumePct != null ? `Volume ${data.comparison.deltaVolumePct >= 0 ? "+" : ""}${data.comparison.deltaVolumePct}%` : null,
      data.comparison.deltaWorkingSets != null ? `Sets ${data.comparison.deltaWorkingSets >= 0 ? "+" : ""}${data.comparison.deltaWorkingSets}` : null,
      data.comparison.deltaTotalReps != null ? `Reps ${data.comparison.deltaTotalReps >= 0 ? "+" : ""}${data.comparison.deltaTotalReps}` : null,
      `${data.comparison.prCount} PR${data.comparison.prCount === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join("   ·   ");
    ctx.fillStyle = COLOR.white;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(bits, leftX, y);
    y += 40;
  }

  if (data.coachMessage) {
    divider(ctx, W, y, 0.12, 1);
    y += 40;
    recapSectionLabel(ctx, leftX, y, "BRK COACH", COLOR.red);
    y += 30;
    ctx.fillStyle = COLOR.white;
    ctx.font = `600 19px ${FONT}`;
    const coachLines = wrapAligned(ctx, data.coachMessage, leftX, y, contentW, 27, 10, "left");
    y += coachLines * 27 + 24;
  }

  y += 30;
  wordmark(ctx, W, y, 30);
  y += 20;
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText("KEEP THE PROMISES YOU MAKE TO YOURSELF", W / 2, y + 20);
  y += 70;

  return y;
}

// Full Recap's own export path — deliberately NOT part of renderWorkoutShareCard's
// template/sizeId system below, since it has neither a fixed template style choice nor one of
// SHARE_SIZES' fixed aspect ratios (task section 14: "does not need to fit inside a square").
export function renderFullRecapImage({ session, exMap, state }) {
  const data = buildFullRecapData({ session, state, exMap });
  if (!data) return null;
  const W = 1080;
  const measuredH = drawFullRecapDoc(scratchContext(), W, data);
  const H = Math.ceil(measuredH + 40);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  background(ctx, W, H, H * 0.1);
  drawFullRecapDoc(ctx, W, data);
  return canvas.toDataURL("image/png");
}

// ---------------- entry point ----------------

// Renders one workout share card to a PNG data URL.
//   session      — a workoutSessions entry (App.jsx's Session Complete `summary`, or a stored
//                  session opened from Workout History — same shape either way).
//   exMap        — id -> exercise lookup, for names/types.
//   template     — "performance" | "minimal" | "recap"
//   sizeId       — "story" | "post" | "square"
//   featuredLift — result of pickFeaturedLift()/listFeaturableLifts(), or a user override of
//                  the same shape. Ignored by the recap template (it shows every exercise).
export function renderWorkoutShareCard({ session, exMap, template = "performance", sizeId = "story", featuredLift }) {
  const size = SHARE_SIZES.find((s) => s.id === sizeId) || SHARE_SIZES[0];
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");

  const featured = featuredLift || pickFeaturedLift(session, exMap);

  if (template === "minimal") {
    drawMinimalCard(ctx, size.width, size.height, session, featured);
  } else {
    drawPerformanceCard(ctx, size.width, size.height, session, exMap, featured);
  }

  return canvas.toDataURL("image/png");
}
