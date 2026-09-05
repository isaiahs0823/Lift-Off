// ---------------- WORKOUT SHARE CARDS (v3 — premium redesign) ----------------
// Premium, canvas-drawn branded BRK share cards for a completed workout session. Three
// templates (Performance / Minimal Story / Full Recap) each rendered at three export sizes
// (9:16 Story, 4:5 Post, 1:1 Square). Pure canvas, no image/charting dependency.
//
// v3 moves the card from "clean but forgettable" to "premium, bold, social-ready" without
// copying any literal reference imagery: stronger hierarchy (workout title now dominates, not
// the clock), a cohesive stat strip instead of scattered numbers, numbered exercise rows with a
// real PR treatment, and — replacing generic athlete photography entirely — BRK's own
// MuscleBodyOutline anatomy system rendered directly onto the canvas as a muted watermark with
// the session's trained muscle group lit up in BRK red. See drawAnatomyWatermark() below.

import { countedSets, topSetOf } from "./progression.js";
import { featuredAndOtherPRs, sessionPRCount, PR_TYPE_LABEL } from "./prSummary.js";
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
  { id: "recap", label: "Full Recap", blurb: "Exercise-by-exercise summary" },
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
}

function wordmark(ctx, W, y, size = 40) {
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.red;
  ctx.font = `800 ${size}px ${FONT}`;
  const brkWidth = ctx.measureText("BRK").width;
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${size * 0.42}px ${FONT}`;
  const liftWidth = ctx.measureText("LIFT").width;
  const gap = size * 0.22;
  const totalW = brkWidth + gap + liftWidth;
  const startX = W / 2 - totalW / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = COLOR.red;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText("BRK", startX, y);
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${size * 0.42}px ${FONT}`;
  ctx.fillText("LIFT", startX + brkWidth + gap, y - size * 0.02);
  ctx.textAlign = "center";
}

function footerTagline(ctx, W, H, size = 22) {
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillText("KEEP THE PROMISES YOU MAKE TO YOURSELF", W / 2, H - size * 2.1);
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
function drawAnatomyWatermark(ctx, { centerX, topY, height, muscleCategory, bodyAlpha = 0.4, redAlpha = 0.92 }) {
  const { view, zone } = getMuscleDisplay({ muscle: muscleCategory });
  const isBack = view === "back";
  const vb = parseViewBox(isBack ? VIEW_BOX_BACK : VIEW_BOX_FRONT);
  const parts = isBack ? BACK_PARTS : FRONT_PARTS;
  const zoneSlugs = isBack ? BACK_ZONE_SLUGS : FRONT_ZONE_SLUGS;
  const activeSlugs = zone !== "full" ? zoneSlugs[zone] || [] : [];

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
function performanceLine(session, featured) {
  const prCount = sessionPRCount(session);
  if (prCount > 0) return `${prCount} PR${prCount > 1 ? "s" : ""} · ${session.workingSets ?? 0} working sets`;
  if (featured?.weight != null) return `Best performance: ${featured.name} ${featured.weight} × ${featured.reps}`;
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

// ONE cohesive panel (task section 5: "one cohesive stat strip is better" than individual
// cards) — a layered surface with thin vertical separators between up to 4 columns, a small red
// accent dot per column, and a strong value/label pair. Used by both Performance and Recap so
// the two templates' stats always look like the same design system.
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
    ctx.beginPath();
    ctx.fillStyle = COLOR.red;
    ctx.arc(cx, y + h * 0.24, sz(4.5, k, 3), 0, Math.PI * 2);
    ctx.fill();

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
function drawExerciseRows(ctx, { x, y, width, rows, rowH, k, exMap, prsByExId }) {
  const gap = sz(14, k, 6);
  rows.forEach((entry, i) => {
    const counted = countedSets(entry.sets);
    const top = counted.length > 0 ? topSetOf(entry.sets) : entry.sets?.[0];
    const exPRs = prsByExId.get(entry.exId) || [];
    const isPR = exPRs.length > 0;
    const rowY = y + i * rowH;
    const h = rowH - gap;

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
    ctx.fillText(String(i + 1).padStart(2, "0"), x + padX, rowY + h / 2 + sz(7, k, 5));

    ctx.fillStyle = COLOR.white;
    ctx.font = `700 ${sz(25, k, 16)}px ${FONT}`;
    const badgeReserve = isPR ? sz(68, k, 44) : 0;
    const name = truncateToWidth(ctx, exMap?.[entry.exId]?.name || entry.exId, width - numW - sz(200, k, 130) - badgeReserve);
    ctx.fillText(name, x + padX + numW, rowY + h / 2 + sz(8, k, 5));
    const nameWidth = ctx.measureText(name).width;

    if (isPR) {
      drawBadgeInline(ctx, x + padX + numW + nameWidth + sz(14, k, 8), rowY + h / 2 - sz(15, k, 11), "PR", k);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = isPR ? COLOR.red : COLOR.gray;
    ctx.font = `800 ${sz(25, k, 16)}px ${FONT}`;
    const setText = top ? `${top.weight} × ${top.reps}` : "—";
    ctx.fillText(setText, x + width - padX, rowY + h / 2 + sz(8, k, 5));
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

// ---------------- template: PERFORMANCE CARD ----------------
// The premium hero share (task section 15): BRK header -> workout title + anatomy visual ->
// best lift/PR callout -> stat strip -> exercise breakdown -> BRK footer. This is the template
// meant to make someone stop scrolling — everything else (Minimal, Recap) is deliberately lower-
// key by comparison.

function drawPerformanceCard(ctx, W, H, session, exMap, featured) {
  const { k, maxRows } = sizeScale(H);
  const heroTop = H * 0.12;
  background(ctx, W, H, heroTop + sz(210, k, 130));

  const headerY = H * 0.065;
  wordmark(ctx, W, headerY, sz(36, k, 24));
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = `700 ${sz(17, k, 13)}px ${FONT}`;
  ctx.fillText("SESSION COMPLETE", W / 2, headerY + sz(34, k, 22));

  // ---- anatomy watermark: right-aligned, partially cropped, sitting behind the hero title ----
  drawAnatomyWatermark(ctx, {
    centerX: W * 0.92,
    topY: heroTop - sz(20, k, 8),
    height: H * (k < 1 ? 0.34 : 0.3),
    muscleCategory: session.mainMuscles?.[0],
  });

  const bodyStartY = headerY + sz(84, k, 50);
  const footerTopY = H - sz(210, k, 118);
  const summaryLine = performanceLine(session, featured);
  const day = dayLabel(session);
  const prsByExId = buildPrsByExId(session);
  const rows = (session.entries || []).slice(0, maxRows);

  function body(c, startY) {
    let y = startY;
    const titleX = W * 0.08;
    const titleMaxW = W * 0.64;

    // ---- hero: workout title dominates (task section 11: title first, never the clock) ----
    const titleSize = fitFontSize(c, session.planName || "Workout", titleMaxW, "900", sz(68, k, 34), 26);
    c.fillStyle = COLOR.white;
    const titleLines = wrapAligned(c, session.planName || "Workout", titleX, y + titleSize * 0.82, titleMaxW, titleSize * 1.04, 2, "left");
    y += titleSize * 0.82 + (titleLines - 1) * titleSize * 1.04 + sz(22, k, 12);

    c.fillStyle = COLOR.gray;
    c.font = `700 ${sz(24, k, 16)}px ${FONT}`;
    c.textAlign = "left";
    const subtitle = day ? `${formatSessionDuration(session.durationSec).toUpperCase()} · ${day}` : formatSessionDuration(session.durationSec).toUpperCase();
    c.fillText(subtitle, titleX, y);
    y += sz(50, k, 30);

    accentRule(c, titleX + 32, y, sz(64, k, 44));
    c.textAlign = "left";
    y += sz(58, k, 32);
    c.textAlign = "center";

    // ---- best performance / PR callout (secondary hierarchy, centered) ----
    c.fillStyle = COLOR.red;
    c.font = `700 ${sz(21, k, 15)}px ${FONT}`;
    c.fillText(featured?.isPR ? "NEW PR" : "BEST PERFORMANCE", W / 2, y);
    y += sz(50, k, 30);

    if (featured) {
      const nameSize = fitFontSize(c, featured.name, W * 0.82, "800", sz(42, k, 20), 18);
      c.fillStyle = COLOR.white;
      c.textAlign = "center";
      const lines = wrapCentered(c, featured.name, W / 2, y, W * 0.82, nameSize * 1.08, 2);
      y += lines * nameSize * 1.08 + sz(18, k, 10);

      c.fillStyle = COLOR.white;
      const heroSize = sz(116, k, 60);
      c.font = `900 ${heroSize}px ${FONT}`;
      const heroText = featured.weight != null ? `${featured.weight} × ${featured.reps}` : "—";
      c.fillText(heroText, W / 2, y + heroSize * 0.78);
      y += heroSize * 0.78 + sz(32, k, 16);

      if (featured.isPR) {
        drawBadge(c, W / 2, y, `PR — ${heroTypeLabel(featured.pr) || "New Record"}`, { fontSize: sz(22, k, 15) });
        y += sz(64, k, 34);
      } else {
        y += sz(10, k, 6);
      }
    } else {
      c.fillStyle = COLOR.white;
      c.font = `800 ${sz(46, k, 26)}px ${FONT}`;
      c.fillText("Workout logged", W / 2, y + sz(36, k, 22));
      y += sz(100, k, 56);
    }

    // ---- stat strip ----
    y += sz(28, k, 14);
    const stripW = W * 0.86;
    const stripX = W / 2 - stripW / 2;
    const prCount = sessionPRCount(session);
    const stats = [
      { value: formatSessionDuration(session.durationSec), label: "Duration" },
      { value: String(session.workingSets ?? 0), label: "Sets" },
      { value: (session.totalVolume ?? 0).toLocaleString(), label: "Volume" },
      { value: String(prCount), label: "PR" },
    ];
    const stripH = drawStatStrip(c, { x: stripX, y, width: stripW, stats, k });
    y += stripH + sz(36, k, 18);

    // ---- one data-driven performance line ----
    if (summaryLine) {
      c.fillStyle = COLOR.red;
      c.font = `800 ${sz(20, k, 14)}px ${FONT}`;
      c.fillText(summaryLine.toUpperCase(), W / 2, y);
      y += sz(42, k, 22);
    }

    // ---- exercise breakdown ----
    if (rows.length > 0) {
      y += sz(20, k, 10);
      divider(c, W, y);
      y += sz(44, k, 24);
      c.fillStyle = COLOR.gray;
      c.font = `800 ${sz(18, k, 13)}px ${FONT}`;
      c.fillText("EXERCISE BREAKDOWN", W / 2, y);
      y += sz(42, k, 22);

      const rowH = sz(88, k, 56);
      const rowW = W * 0.86;
      const rowX = W / 2 - rowW / 2;
      y += drawExerciseRows(c, { x: rowX, y, width: rowW, rows, rowH, k, exMap, prsByExId });

      const remaining = (session.entries || []).length - rows.length;
      if (remaining > 0) {
        c.fillStyle = COLOR.dimGray;
        c.font = `600 ${sz(18, k, 13)}px ${FONT}`;
        c.fillText(`+ ${remaining} more exercise${remaining === 1 ? "" : "s"}`, W / 2, y + sz(36, k, 20));
        y += sz(54, k, 30);
      }
    }

    return y;
  }

  centerBody(ctx, bodyStartY, footerTopY, body);

  wordmark(ctx, W, H - sz(130, k, 74), sz(30, k, 20));
  footerTagline(ctx, W, H, sz(20, k, 14));
}

// ---------------- template: MINIMAL STORY CARD ----------------
// Genuinely minimal (task section 16) — workout title, best lift, key stats, a small anatomy
// visual, BRK footer. None of Performance's stat strip/exercise breakdown complexity.

function drawMinimalCard(ctx, W, H, session, featured) {
  const compact = H <= 1500;
  background(ctx, W, H, H * 0.46);

  const bodyStartY = H * (compact ? 0.14 : 0.12);
  const footerTopY = H - (compact ? 130 : 170);

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

  wordmark(ctx, W, H - (compact ? 90 : 120), compact ? 30 : 36);
  footerTagline(ctx, W, H, compact ? 15 : 18);
}

// ---------------- template: FULL SESSION RECAP CARD ----------------
// All key stats, up to 6 exercises with PR badges, an optional progression-vs-last-time line
// (task section 17), and the anatomy graphic — organized, not overloaded.

function drawRecapCard(ctx, W, H, session, exMap) {
  const { k, maxRows } = sizeScale(H);
  background(ctx, W, H, H * 0.24);

  const headerY = H * 0.06;
  wordmark(ctx, W, headerY, sz(40, k, 26));

  drawAnatomyWatermark(ctx, {
    centerX: W * 0.9,
    topY: headerY + sz(40, k, 20),
    height: H * (k < 1 ? 0.22 : 0.2),
    muscleCategory: session.mainMuscles?.[0],
    bodyAlpha: 0.3,
    redAlpha: 0.78,
  });

  const bodyStartY = headerY + sz(70, k, 42);
  const footerTopY = H - sz(190, k, 110);

  const prCount = sessionPRCount(session);
  const entries = session.entries || [];
  const rows = entries.slice(0, maxRows);
  const prsByExId = buildPrsByExId(session);
  const rowH = sz(96, k, 58);
  const panelW = W * 0.86;
  const panelX = W / 2 - panelW / 2;

  function body(c, startY) {
    let y = startY;
    c.textAlign = "center";
    c.fillStyle = COLOR.white;
    const titleSize = fitFontSize(c, session.planName || "Workout", W * 0.7, "800", sz(50, k, 28), 24);
    const titleLines = wrapCentered(c, session.planName || "Workout", W / 2, y + titleSize * 0.8, W * 0.7, titleSize * 1.05, 2);
    y += titleSize * 0.8 + (titleLines - 1) * titleSize * 1.05 + sz(40, k, 22);

    // ---- optional progression-vs-last-time line — only when real prior-session data exists ----
    if (session.perfDeltaPct != null) {
      const up = session.perfDeltaPct >= 0;
      c.fillStyle = up ? COLOR.green : COLOR.gray;
      c.font = `700 ${sz(21, k, 14)}px ${FONT}`;
      c.fillText(`${up ? "+" : ""}${session.perfDeltaPct}% volume vs last ${session.planName}`, W / 2, y);
      y += sz(42, k, 24);
    }

    divider(c, W, y);
    y += sz(54, k, 30);

    const stripW = W * 0.86;
    const stripX = W / 2 - stripW / 2;
    const stats =
      prCount > 0
        ? [
            { value: formatSessionDuration(session.durationSec), label: "Duration" },
            { value: String(session.workingSets ?? 0), label: "Sets" },
            { value: (session.totalVolume ?? 0).toLocaleString(), label: "Volume" },
            { value: String(prCount), label: "PRs" },
          ]
        : [
            { value: formatSessionDuration(session.durationSec), label: "Duration" },
            { value: String(session.workingSets ?? 0), label: "Working Sets" },
            { value: (session.totalVolume ?? 0).toLocaleString(), label: "Lb Volume" },
          ];
    const stripH = drawStatStrip(c, { x: stripX, y, width: stripW, stats, k });
    y += stripH;

    y += sz(46, k, 24);
    divider(c, W, y);
    y += sz(54, k, 30);

    c.fillStyle = COLOR.gray;
    c.font = `800 ${sz(18, k, 13)}px ${FONT}`;
    c.fillText("SESSION BREAKDOWN", W / 2, y);
    y += sz(46, k, 26);

    if (rows.length === 0) {
      c.fillStyle = COLOR.gray;
      c.font = `600 ${sz(24, k, 17)}px ${FONT}`;
      c.fillText("Detailed exercise data isn't available for this session.", W / 2, y + sz(40, k, 24));
      y += sz(90, k, 54);
    } else {
      y += drawExerciseRows(c, { x: panelX, y, width: panelW, rows, rowH, k, exMap, prsByExId });
      if (entries.length > rows.length) {
        c.fillStyle = COLOR.dimGray;
        c.font = `600 ${sz(20, k, 14)}px ${FONT}`;
        c.fillText(`+ ${entries.length - rows.length} more exercise${entries.length - rows.length === 1 ? "" : "s"}`, W / 2, y + sz(10, k, 6));
        y += sz(40, k, 22);
      }
    }

    return y;
  }

  centerBody(ctx, bodyStartY, footerTopY, body);

  wordmark(ctx, W, H - sz(120, k, 68), sz(30, k, 20));
  footerTagline(ctx, W, H, sz(20, k, 14));
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
  } else if (template === "recap") {
    drawRecapCard(ctx, size.width, size.height, session, exMap);
  } else {
    drawPerformanceCard(ctx, size.width, size.height, session, exMap, featured);
  }

  return canvas.toDataURL("image/png");
}
