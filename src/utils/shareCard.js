// ---------------- SHARE CARDS ----------------
// Canvas-drawn branded BRK cards — no image/charting dependency, just 2D canvas text and
// shapes in the app's own dark/red identity. Sized for Instagram Stories (1080x1920, 9:16)
// but reads fine as a square-ish crop too since the content is centered with generous margin.

const WIDTH = 1080;
const HEIGHT = 1920;
const COLOR = {
  bg: "#151515",
  panel: "#202020",
  border: "#3f2020",
  red: "#dc2626",
  white: "#f5f5f5",
  gray: "#a3a3a3",
  dimGray: "#6b6b6b",
};

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines++;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, y + lines * lineHeight);
  return lines + 1;
}

// config: { eyebrow, title, bigStat, bigStatLabel, lines: string[], accentLine? }
function drawCard(ctx, config) {
  ctx.fillStyle = COLOR.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Header wordmark
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.red;
  ctx.font = "bold 64px system-ui, -apple-system, sans-serif";
  ctx.fillText("BRK", WIDTH / 2, 180);
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = "600 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("LIFT", WIDTH / 2, 224);

  ctx.strokeStyle = COLOR.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 280);
  ctx.lineTo(WIDTH - 120, 280);
  ctx.stroke();

  let y = 460;

  if (config.eyebrow) {
    ctx.fillStyle = COLOR.red;
    ctx.font = "bold 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(config.eyebrow.toUpperCase(), WIDTH / 2, y);
    y += 90;
  }

  if (config.title) {
    ctx.fillStyle = COLOR.white;
    ctx.font = "bold 68px system-ui, -apple-system, sans-serif";
    y += drawWrapped(ctx, config.title, WIDTH / 2, y, WIDTH - 200, 78) * 78 - 78 + 40;
  }

  if (config.bigStat) {
    ctx.fillStyle = COLOR.white;
    ctx.font = "bold 128px system-ui, -apple-system, sans-serif";
    ctx.fillText(config.bigStat, WIDTH / 2, y + 110);
    y += 180;
    if (config.bigStatLabel) {
      ctx.fillStyle = COLOR.gray;
      ctx.font = "32px system-ui, -apple-system, sans-serif";
      ctx.fillText(config.bigStatLabel, WIDTH / 2, y);
      y += 70;
    }
  }

  y += 40;
  (config.lines || []).forEach((line) => {
    ctx.fillStyle = COLOR.gray;
    ctx.font = "36px system-ui, -apple-system, sans-serif";
    ctx.fillText(line, WIDTH / 2, y);
    y += 58;
  });

  if (config.accentLine) {
    y += 20;
    ctx.fillStyle = COLOR.red;
    ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
    ctx.fillText(config.accentLine, WIDTH / 2, y);
  }

  // Footer tagline — matches the app header's own tagline for brand consistency.
  ctx.fillStyle = COLOR.dimGray;
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("KEEP THE PROMISES YOU MAKE TO YOURSELF", WIDTH / 2, HEIGHT - 100);
}

function renderToDataUrl(config) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  drawCard(ctx, config);
  return canvas.toDataURL("image/png");
}

export function buildPRShareCard(exName, prs, entry) {
  const headline = prs.find((p) => p.type === "weight") || prs.find((p) => p.type === "e1rm") || prs[0];
  const bigStat = headline?.weight != null ? `${headline.weight} × ${headline.reps}` : entry?.sets?.[0] ? `${entry.sets[0].weight} × ${entry.sets[0].reps}` : "";
  const lines = prs.map((p) => {
    if (p.type === "weight") return `Heaviest weight: ${p.weight} lb (+${Math.round((p.weight - p.prev) * 10) / 10} lb)`;
    if (p.type === "e1rm") return `Estimated 1RM: ${p.value} lb (+${p.value - p.prev} lb)`;
    if (p.type === "reps") return `Rep record @ ${p.weight} lb: ${p.reps} reps`;
    if (p.type === "exerciseVolume") return `Exercise volume: ${p.value.toLocaleString()} lb`;
    return "";
  });
  return renderToDataUrl({ eyebrow: "New PR", title: exName, bigStat, lines });
}

export function buildWeeklyReviewShareCard(review) {
  const lines = [`Strength: ${review.strengthTrend}`, `${review.prCount} PR${review.prCount === 1 ? "" : "s"} this week`];
  return renderToDataUrl({
    eyebrow: "Weekly review",
    title: review.plannedSessions != null ? `${review.sessionsCompleted}/${review.plannedSessions} sessions` : `${review.sessionsCompleted} sessions`,
    lines,
  });
}

export function buildGoalShareCard(goal, progressPct) {
  return renderToDataUrl({
    eyebrow: "Mission",
    title: goal.title,
    bigStat: `${progressPct}%`,
    bigStatLabel: "complete",
    lines: [`${goal.currentValue}${goal.units ? " " + goal.units : ""} → ${goal.targetValue}${goal.units ? " " + goal.units : ""}`],
  });
}
