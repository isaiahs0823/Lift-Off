// ---------------- WORKOUT SHARE CARDS (v2) ----------------
// Premium, canvas-drawn branded BRK share cards for a completed workout session. Three
// templates (Performance / Minimal Story / Full Recap) each rendered at three export sizes
// (9:16 Story, 4:5 Post, 1:1 Square). Pure canvas, no image/charting dependency — same approach
// as the original utils/shareCard.js, but the hero of every layout here is the athlete's best
// PERFORMANCE (a lift: weight × reps), never the clock. See pickFeaturedLift() below for how
// that lift is chosen, and WorkoutSharePreview.jsx for the UI that drives this.

import { countedSets, topSetOf } from "./progression.js";
import { featuredAndOtherPRs, sessionPRCount, PR_TYPE_LABEL, prDeltaLabel } from "./prSummary.js";
import { formatSessionDuration } from "./workoutSets.js";

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
  bgTop: "#181818",
  bgBottom: "#0a0a0a",
  glow: "rgba(220, 38, 38, 0.16)",
  panel: "rgba(255,255,255,0.04)",
  panelBorder: "rgba(255,255,255,0.09)",
  red: "#ef4444",
  redDeep: "#b91c1c",
  white: "#f7f7f7",
  gray: "#a3a3a3",
  dimGray: "#707070",
  green: "#22c55e",
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

// Center-aligned word wrap. Returns the number of lines drawn.
function wrapCentered(ctx, text, cx, y, maxWidth, lineHeight, maxLines = 3) {
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
  clipped.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  return clipped.length;
}

function background(ctx, W, H, glowY) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLOR.bgTop);
  grad.addColorStop(1, COLOR.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Soft red glow behind the hero — the one "premium" lighting cue that separates this from a
  // flat receipt, kept subtle so it never competes with the numbers on top of it.
  const glow = ctx.createRadialGradient(W / 2, glowY, 0, W / 2, glowY, W * 0.62);
  glow.addColorStop(0, COLOR.glow);
  glow.addColorStop(1, "rgba(220,38,38,0)");
  ctx.fillStyle = glow;
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

function statTile(ctx, cx, y, value, label, { valueSize = 40, labelSize = 18 } = {}) {
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.white;
  ctx.font = `800 ${valueSize}px ${FONT}`;
  ctx.fillText(value, cx, y);
  ctx.fillStyle = COLOR.gray;
  ctx.font = `700 ${labelSize}px ${FONT}`;
  ctx.fillText(label.toUpperCase(), cx, y + labelSize + 12);
}

// A reusable 1x1-ish offscreen context used only to MEASURE how tall a body block will render
// (font metrics don't depend on canvas size) before drawing it for real — see centerBody() below.
// Actually drawing to it is harmless (invisible, clipped, never throws); reusing one instance
// avoids allocating a canvas on every share-card render.
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
// otherwise leave above the footer, per the "avoid empty dead space" design rule.
function centerBody(ctx, startY, footerTopY, bodyFn) {
  const measuredEnd = bodyFn(scratchContext(), startY);
  const contentHeight = measuredEnd - startY;
  const available = footerTopY - startY;
  const offset = Math.max(0, (available - contentHeight) / 2);
  bodyFn(ctx, startY + offset);
}

function divider(ctx, W, y, opacity = 0.12) {
  ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.12, y);
  ctx.lineTo(W * 0.88, y);
  ctx.stroke();
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

function progressionSummaryLine(session) {
  const prCount = sessionPRCount(session);
  const bits = [];
  if (prCount > 0) bits.push(`${prCount} New PR${prCount > 1 ? "s" : ""}`);
  if (session.isVolumePR) bits.push("Session Volume PR");
  return bits.length > 0 ? bits.join("  ·  ") : null;
}

function heroTypeLabel(pr) {
  if (!pr) return null;
  return PR_TYPE_LABEL[pr.type] || "PR";
}

// ---------------- template: PERFORMANCE CARD ----------------

function drawPerformanceCard(ctx, W, H, session, exMap, featured, prList) {
  // Square (1080) AND Post (1350) both use the trimmed layout — Post has more room than
  // Square, so centerBody's centering just spreads it out further, but the full "story" set of
  // content (2 PR highlights, taller hero) only reliably fits within Story's 1920 height without
  // overflowing into the footer.
  const compact = H <= 1500;
  const mid = compact ? 0.42 : 0.36;
  background(ctx, W, H, H * mid);

  const headerY = H * 0.075;
  wordmark(ctx, W, headerY, compact ? 42 : 48);
  divider(ctx, W, headerY + (compact ? 34 : 46));

  const bodyStartY = headerY + (compact ? 90 : 130);
  const footerTopY = H - (compact ? 150 : 210);

  const maxHighlights = compact ? 1 : 2;
  const summaryLine = progressionSummaryLine(session);

  function body(c, startY) {
    let y = startY;
    c.textAlign = "center";
    c.fillStyle = COLOR.red;
    c.font = `800 ${compact ? 24 : 30}px ${FONT}`;
    c.fillText((session.planName || "Workout").toUpperCase(), W / 2, y);
    y += compact ? 56 : 74;

    // ---- hero: the best PERFORMANCE, never the clock ----
    c.fillStyle = COLOR.gray;
    c.font = `700 ${compact ? 20 : 24}px ${FONT}`;
    c.fillText(featured?.isPR ? "NEW PR" : "TOP PERFORMANCE", W / 2, y);
    y += compact ? 44 : 56;

    if (featured) {
      const nameSize = fitFontSize(c, featured.name, W * 0.82, "800", compact ? 44 : 54, 26);
      c.fillStyle = COLOR.white;
      c.textAlign = "center";
      const lines = wrapCentered(c, featured.name, W / 2, y, W * 0.82, nameSize * 1.08, 2);
      y += lines * nameSize * 1.08 + (compact ? 14 : 22);

      c.fillStyle = COLOR.white;
      const heroSize = compact ? 118 : 156;
      c.font = `900 ${heroSize}px ${FONT}`;
      const heroText = featured.weight != null ? `${featured.weight} × ${featured.reps}` : "—";
      c.fillText(heroText, W / 2, y + heroSize * 0.78);
      y += heroSize * 0.78 + (compact ? 26 : 40);

      if (featured.isPR) {
        drawBadge(c, W / 2, y, `PR — ${heroTypeLabel(featured.pr) || "New Record"}`, { fontSize: compact ? 20 : 24 });
        y += compact ? 58 : 68;
      } else {
        c.fillStyle = COLOR.gray;
        c.font = `700 ${compact ? 18 : 22}px ${FONT}`;
        const subtitle = featured.source === "compound" ? "STRONGEST LIFT" : featured.source === "bestSet" ? "MOST IMPRESSIVE SET" : "TOP SET";
        c.fillText(subtitle, W / 2, y);
        y += compact ? 46 : 58;
      }
    } else {
      c.fillStyle = COLOR.white;
      c.font = `800 ${compact ? 40 : 54}px ${FONT}`;
      c.fillText("Workout logged", W / 2, y + 40);
      y += compact ? 90 : 120;
    }

    y += compact ? 10 : 24;
    divider(c, W, y);
    y += compact ? 50 : 70;

    // ---- key stats row ----
    const statY = y;
    const cols = [W * 0.22, W * 0.5, W * 0.78];
    statTile(c, cols[0], statY, formatSessionDuration(session.durationSec), "Duration", { valueSize: compact ? 30 : 38, labelSize: compact ? 15 : 18 });
    statTile(c, cols[1], statY, String(session.workingSets ?? 0), "Working Sets", { valueSize: compact ? 30 : 38, labelSize: compact ? 15 : 18 });
    statTile(c, cols[2], statY, `${(session.totalVolume ?? 0).toLocaleString()}`, "Lb Volume", { valueSize: compact ? 30 : 38, labelSize: compact ? 15 : 18 });
    y = statY + (compact ? 60 : 80);

    // ---- PR highlights (up to 2 full-size, 1 when compact) ----
    if (prList.length > 0) {
      y += compact ? 30 : 46;
      divider(c, W, y);
      y += compact ? 36 : 44;
      c.fillStyle = COLOR.red;
      c.font = `800 ${compact ? 18 : 20}px ${FONT}`;
      c.fillText("PR HIGHLIGHTS", W / 2, y);
      y += compact ? 40 : 50;
      const panelW = W * 0.78;
      const panelX = W / 2 - panelW / 2;
      const panelH = compact ? 78 : 92;
      prList.slice(0, maxHighlights).forEach(({ exId, pr }) => {
        c.fillStyle = COLOR.panel;
        roundRect(c, panelX, y, panelW, panelH, 16);
        c.fill();
        c.strokeStyle = COLOR.panelBorder;
        c.lineWidth = 1;
        roundRect(c, panelX, y, panelW, panelH, 16);
        c.stroke();

        c.textAlign = "left";
        c.fillStyle = COLOR.white;
        c.font = `800 ${compact ? 22 : 26}px ${FONT}`;
        const exName = truncateToWidth(c, exMap?.[exId]?.name || exId, panelW - 220);
        c.fillText(exName, panelX + 28, y + panelH * 0.42);
        c.fillStyle = COLOR.gray;
        c.font = `600 ${compact ? 15 : 18}px ${FONT}`;
        c.fillText(PR_TYPE_LABEL[pr.type] || "PR", panelX + 28, y + panelH * 0.74);

        c.textAlign = "right";
        c.fillStyle = COLOR.green;
        c.font = `800 ${compact ? 22 : 26}px ${FONT}`;
        c.fillText(prDeltaLabel(pr), panelX + panelW - 26, y + panelH * 0.56);
        c.textAlign = "center";

        y += panelH + (compact ? 16 : 20);
      });
    }

    // ---- progression summary ----
    if (summaryLine) {
      y += compact ? 6 : 10;
      c.fillStyle = COLOR.red;
      c.font = `800 ${compact ? 20 : 24}px ${FONT}`;
      c.fillText(summaryLine.toUpperCase(), W / 2, y);
      y += compact ? 4 : 6;
    }

    return y;
  }

  centerBody(ctx, bodyStartY, footerTopY, body);

  wordmark(ctx, W, H - (compact ? 96 : 130), compact ? 26 : 30);
  footerTagline(ctx, W, H, compact ? 16 : 20);
}

// ---------------- template: MINIMAL STORY CARD ----------------

function drawMinimalCard(ctx, W, H, session, featured) {
  const compact = H <= 1500;
  background(ctx, W, H, H * 0.46);

  const bodyStartY = H * (compact ? 0.14 : 0.12);
  const footerTopY = H - (compact ? 130 : 170);

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

function drawRecapCard(ctx, W, H, session, exMap, prList) {
  const compact = H <= 1500;
  background(ctx, W, H, H * 0.22);

  const headerY = H * 0.065;
  wordmark(ctx, W, headerY, compact ? 38 : 44);

  const bodyStartY = headerY + (compact ? 56 : 70);
  const footerTopY = H - (compact ? 150 : 190);

  const prCount = sessionPRCount(session);
  const entries = session.entries || [];
  const maxRows = compact ? 4 : 6;
  const rows = entries.slice(0, maxRows);
  const prsByExId = new Map();
  (session.prs || []).forEach((pr) => {
    if (!prsByExId.has(pr.exId)) prsByExId.set(pr.exId, []);
    prsByExId.get(pr.exId).push(pr);
  });
  const rowH = compact ? 78 : 96;
  const panelW = W * 0.86;
  const panelX = W / 2 - panelW / 2;

  function body(c, startY) {
    let y = startY;
    c.textAlign = "center";
    c.fillStyle = COLOR.white;
    const titleSize = fitFontSize(c, session.planName || "Workout", W * 0.86, "800", compact ? 40 : 50, 26);
    const titleLines = wrapCentered(c, session.planName || "Workout", W / 2, y + titleSize * 0.8, W * 0.86, titleSize * 1.05, 2);
    y += titleSize * 0.8 + (titleLines - 1) * titleSize * 1.05 + (compact ? 42 : 56);

    divider(c, W, y);
    y += compact ? 44 : 60;

    const statCols = prCount > 0 ? [W * 0.15, W * 0.4, W * 0.65, W * 0.87] : [W * 0.2, W * 0.5, W * 0.8];
    const statVals = prCount > 0
      ? [
          [formatSessionDuration(session.durationSec), "Duration"],
          [String(session.workingSets ?? 0), "Sets"],
          [`${(session.totalVolume ?? 0).toLocaleString()}`, "Volume"],
          [String(prCount), "PRs"],
        ]
      : [
          [formatSessionDuration(session.durationSec), "Duration"],
          [String(session.workingSets ?? 0), "Working Sets"],
          [`${(session.totalVolume ?? 0).toLocaleString()}`, "Lb Volume"],
        ];
    statVals.forEach(([val, label], i) => statTile(c, statCols[i], y, val, label, { valueSize: compact ? 28 : 34, labelSize: compact ? 14 : 16 }));
    y += compact ? 56 : 72;

    y += compact ? 30 : 46;
    divider(c, W, y);
    y += compact ? 40 : 54;

    c.fillStyle = COLOR.red;
    c.font = `800 ${compact ? 18 : 22}px ${FONT}`;
    c.fillText("SESSION BREAKDOWN", W / 2, y);
    y += compact ? 40 : 54;

    if (rows.length === 0) {
      c.fillStyle = COLOR.gray;
      c.font = `600 24px ${FONT}`;
      c.fillText("Detailed exercise data isn't available for this session.", W / 2, y + 40);
      y += 90;
    } else {
      rows.forEach((entry, i) => {
        const counted = countedSets(entry.sets);
        const top = counted.length > 0 ? topSetOf(entry.sets) : entry.sets?.[0];
        const exPRs = prsByExId.get(entry.exId) || [];
        const rowY = y + i * rowH;

        c.fillStyle = i % 2 === 0 ? COLOR.panel : "rgba(255,255,255,0.01)";
        roundRect(c, panelX, rowY, panelW, rowH - 12, 14);
        c.fill();

        // PR badge (when present) is reserved its own space to the right, BEFORE the exercise
        // name is truncated, so the two never overlap regardless of name length.
        const badgeReserve = exPRs.length > 0 ? 70 : 0;
        c.textAlign = "left";
        c.fillStyle = COLOR.white;
        c.font = `700 ${compact ? 24 : 28}px ${FONT}`;
        const name = truncateToWidth(c, exMap?.[entry.exId]?.name || entry.exId, panelW - 300 - badgeReserve);
        const nameWidth = c.measureText(name).width;
        c.fillText(name, panelX + 26, rowY + (rowH - 12) / 2 + 10);

        if (exPRs.length > 0) {
          drawBadgeInline(c, panelX + 26 + nameWidth + 14, rowY + (rowH - 12) / 2 - 15, "PR");
        }

        c.textAlign = "right";
        c.fillStyle = exPRs.length > 0 ? COLOR.red : COLOR.gray;
        c.font = `800 ${compact ? 24 : 28}px ${FONT}`;
        const setText = top ? `${top.weight} × ${top.reps}` : "—";
        c.fillText(setText, panelX + panelW - 26, rowY + (rowH - 12) / 2 + 10);
        c.textAlign = "center";
      });
      y += rows.length * rowH;
      if (entries.length > rows.length) {
        c.fillStyle = COLOR.dimGray;
        c.font = `600 20px ${FONT}`;
        c.fillText(`+ ${entries.length - rows.length} more exercise${entries.length - rows.length === 1 ? "" : "s"}`, W / 2, y + 10);
        y += 40;
      }
    }

    return y;
  }

  centerBody(ctx, bodyStartY, footerTopY, body);

  wordmark(ctx, W, H - (compact ? 92 : 120), compact ? 26 : 30);
  footerTagline(ctx, W, H, compact ? 16 : 20);
}

function drawBadgeInline(ctx, x, y, text) {
  ctx.font = `800 16px ${FONT}`;
  const w = ctx.measureText(text).width + 18;
  const h = 30;
  ctx.fillStyle = COLOR.red;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = COLOR.white;
  ctx.textAlign = "left";
  ctx.fillText(text, x + 9, y + h / 2 + 6);
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
  const { featured: featuredPR, others } = featuredAndOtherPRs(session);
  const prList = [featuredPR, ...others].filter(Boolean);

  if (template === "minimal") {
    drawMinimalCard(ctx, size.width, size.height, session, featured);
  } else if (template === "recap") {
    drawRecapCard(ctx, size.width, size.height, session, exMap, prList);
  } else {
    drawPerformanceCard(ctx, size.width, size.height, session, exMap, featured, prList);
  }

  return canvas.toDataURL("image/png");
}
