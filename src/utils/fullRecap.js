// ---------------- FULL RECAP — THE COMPLETE WORKOUT RECORD ----------------
// Full Recap is categorically different from the Performance/Minimal Story share templates
// (workoutShareCard.js): those are social posters — one hero lift, a handful of stats, deliberately
// curated. Full Recap's job is completeness: every exercise, every set (warm-up, working, top set,
// back-off, drop set, failure, AMRAP), every PR, equipment context, session notes, pain/quality
// flags, and a real vs-last-time comparison — enough that an athlete can hand this to an outside
// coach or another AI and have them understand the entire session without any other screenshot.
//
// One rule above all others: never fabricate. A field with no real data is omitted, not guessed —
// see buildFullRecapData below. This file only reads state; nothing is mutated.

import { countedSets, formatSessionDuration, formatSetVerbose, isWarmup, SET_TYPE_LABEL } from "./workoutSets.js";
import { topSetOf } from "./progression.js";
import { setVolume } from "./dataWorkbook.js";
import { equipmentDisplayLabel, DEFAULT_MACHINE_LABEL } from "./equipmentProfiles.js";
import { computeReadinessScore, readinessBand, BAND_LABEL } from "./readiness.js";
import { PR_TYPE_LABEL, prDeltaLabel, prHeroLabel, prPreviousLabel, sessionPRCount } from "./prSummary.js";
import { SET_QUALITY_LABEL, painSummaryLabel, summarizePainFlags } from "./workoutQuality.js";

// A PR fires on a specific SET (weight+reps identify it) for every type except exerciseVolume,
// which describes the whole exercise entry rather than one set — so it's never attached to a row.
function prsForSet(exPrs, set) {
  return exPrs.filter((pr) => pr.type !== "exerciseVolume" && pr.weight === set.weight && pr.reps === set.reps);
}

// One display-ready row per logged set — every field that's actually present, nothing invented.
// `drops` are kept as their own array (never flattened into a fake single set — task section 4)
// so the caller can render "275 x 6 -> 185 x 4 -> 135 x 5" as a real sequence.
function buildSetRow(set, index, exPrs) {
  const prs = prsForSet(exPrs, set);
  return {
    index: index + 1,
    setType: set.setType || "working",
    setTypeLabel: SET_TYPE_LABEL[set.setType || "working"],
    isWarmup: isWarmup(set),
    weight: set.weight,
    reps: set.reps,
    drops: set.drops || [],
    rir: set.rir ?? null,
    rpe: set.rpe == null ? null : set.rpe,
    quality: set.quality && set.quality !== "clean" ? set.quality : null,
    qualityLabel: set.quality && set.quality !== "clean" ? SET_QUALITY_LABEL[set.quality] : null,
    pain: set.quality === "pain" ? set.pain || null : null,
    prs,
    raw: set,
  };
}

function buildExercise(entry, exMap, prsByExId, state) {
  const exPrs = prsByExId.get(entry.exId) || [];
  const sets = entry.sets || [];
  const counted = countedSets(sets);
  const workingReps = counted.reduce((sum, s) => sum + s.reps + (s.drops || []).reduce((a, d) => a + d.reps, 0), 0);
  const volume = counted.reduce((sum, s) => sum + setVolume(s), 0);
  const equipmentLabel = equipmentDisplayLabel(state || {}, entry.equipmentProfileId ?? null, entry.equipmentContext ?? null);
  return {
    exId: entry.exId,
    name: exMap?.[entry.exId]?.name || entry.exId,
    equipmentLabel: equipmentLabel !== DEFAULT_MACHINE_LABEL ? equipmentLabel : null,
    targetReps: entry.targetReps ?? null,
    setRows: sets.map((s, i) => buildSetRow(s, i, exPrs)),
    warmupCount: sets.length - counted.length,
    workingSetCount: counted.length,
    workingReps,
    volume: Math.round(volume),
    bestSet: counted.length > 0 ? topSetOf(sets) : null,
    prs: exPrs,
    jointNote: entry.jointNote || null,
    painSummary: summarizePainFlags(entry),
  };
}

function groupPrsByExId(session) {
  const map = new Map();
  (session.prs || []).forEach((pr) => {
    if (!map.has(pr.exId)) map.set(pr.exId, []);
    map.get(pr.exId).push(pr);
  });
  return map;
}

// The most notable single PR per exercise, for the near-top "N PRs" summary — same one-PR-per-
// exercise convention prSummary.js's featuredAndOtherPRs uses elsewhere, just without the
// "which one is THE hero" ordering (Full Recap lists all of them, not just one).
const PR_TYPE_PRIORITY = { weight: 0, reps: 1, e1rm: 2, exerciseVolume: 3 };
function mostNotablePr(prs) {
  return [...prs].sort((a, b) => PR_TYPE_PRIORITY[a.type] - PR_TYPE_PRIORITY[b.type])[0];
}

// Real comparison only — the most recent PRIOR session with the same plan name. Never invented,
// never a synthetic "average of last N" (task section 13/23: "do not invent missing prior data").
function findPreviousComparable(session, allSessions) {
  return (allSessions || [])
    .filter((s) => s.id !== session.id && s.planName === session.planName && new Date(s.finishedAt) < new Date(session.finishedAt))
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0] || null;
}

function buildComparison(session, prev) {
  if (!prev) return null;
  const deltaVolumePct = prev.totalVolume > 0 ? Math.round(((session.totalVolume - prev.totalVolume) / prev.totalVolume) * 1000) / 10 : null;
  const prevBest = prev.bestLift || null;
  const currentBest = session.bestLift || null;
  return {
    planName: prev.planName,
    prevDate: prev.finishedAt,
    deltaVolumePct,
    deltaWorkingSets: session.workingSets != null && prev.workingSets != null ? session.workingSets - prev.workingSets : null,
    deltaTotalReps: session.totalReps != null && prev.totalReps != null ? session.totalReps - prev.totalReps : null,
    prCount: sessionPRCount(session),
    bestLift: currentBest && prevBest ? { current: currentBest, previous: prevBest } : null,
  };
}

// The one function everything else (in-app screen, plaintext export, tall share image) reads
// from — a single structured pass over the session so all three surfaces always agree.
export function buildFullRecapData({ session, state, exMap }) {
  if (!session) return null;
  const entries = session.entries || [];
  const prsByExId = groupPrsByExId(session);

  const dateKey = (session.startedAt || session.finishedAt || "").slice(0, 10);
  const readinessEntry = (state?.readinessLogs || []).find((r) => (r.date || "").slice(0, 10) === dateKey) || null;
  const readinessScore = readinessEntry ? computeReadinessScore(readinessEntry) : null;
  const readiness = readinessScore != null ? { score: readinessScore, band: readinessBand(readinessScore), bandLabel: BAND_LABEL[readinessBand(readinessScore)] } : null;

  const exercises = entries.map((entry) => buildExercise(entry, exMap, prsByExId, state));

  const prSummary = [...prsByExId.entries()].map(([exId, prs]) => {
    const pr = mostNotablePr(prs);
    return { exId, name: exMap?.[exId]?.name || exId, pr, typeLabel: PR_TYPE_LABEL[pr.type], heroLabel: prHeroLabel(pr), prevLabel: prPreviousLabel(pr), deltaLabel: prDeltaLabel(pr) };
  });

  const totalSets = entries.reduce((sum, e) => sum + (e.sets?.length || 0), 0);
  const warmupSets = totalSets - (session.workingSets ?? 0);

  const prev = findPreviousComparable(session, state?.workoutSessions);

  return {
    session,
    planName: session.planName || "Workout",
    dateKey,
    startedAt: session.startedAt || null,
    finishedAt: session.finishedAt || null,
    durationSec: session.durationSec ?? 0,
    durationLabel: formatSessionDuration(session.durationSec ?? 0),
    mainMuscles: session.mainMuscles || [],
    totalSets,
    workingSets: session.workingSets ?? 0,
    warmupSets: Math.max(0, warmupSets),
    totalReps: session.totalReps ?? 0,
    totalVolume: session.totalVolume ?? 0,
    prCount: sessionPRCount(session),
    prSummary,
    exercises,
    alternateGym: session.sessionContext?.locationMode === "alternate_gym" ? { locationLabel: session.sessionContext.locationLabel || null } : null,
    readiness,
    note: typeof session.note === "string" && session.note.trim() ? session.note.trim() : null,
    coachMessage: session.coachMessage || null,
    comparison: buildComparison(session, prev),
  };
}

// ---------------- AI-FRIENDLY PLAINTEXT EXPORT ----------------
// Clean structured text meant to be pasted directly into ChatGPT, Claude, Gemini, email, a text
// message, or coach software — no markup, no app-specific jargon beyond plain labels. Every line
// comes straight from buildFullRecapData's fields; nothing here re-derives or guesses a number.
function fmtDateLong(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function setLineForText(row) {
  const base = formatSetVerbose(row.raw);
  const suffixes = [];
  if (row.setType !== "working" && row.setType !== "warmup") suffixes.push(row.setTypeLabel.toUpperCase());
  if (row.qualityLabel) suffixes.push(row.pain?.bodyArea ? `${row.qualityLabel.toUpperCase()} (${row.pain.bodyArea}${row.pain.severity != null ? `, ${row.pain.severity}/10` : ""})` : row.qualityLabel.toUpperCase());
  if (row.prs.length > 0) suffixes.push(row.prs.map((pr) => PR_TYPE_LABEL[pr.type].toUpperCase()).join(", "));
  return suffixes.length > 0 ? `${base} — ${suffixes.join(" — ")}` : base;
}

export function buildFullRecapText(data) {
  if (!data) return "";
  const lines = [];
  lines.push("BRK LIFT — FULL WORKOUT RECAP");
  lines.push("");
  lines.push(`Workout: ${data.planName}`);
  const dateLabel = fmtDateLong(data.finishedAt || data.startedAt);
  if (dateLabel) lines.push(`Date: ${dateLabel}`);
  lines.push(`Duration: ${data.durationLabel}`);
  lines.push(`Working Sets: ${data.workingSets}`);
  if (data.warmupSets > 0) lines.push(`Warm-up Sets: ${data.warmupSets}`);
  lines.push(`Total Reps: ${data.totalReps}`);
  lines.push(`Working Volume: ${data.totalVolume.toLocaleString()} lb`);
  lines.push(`PRs: ${data.prCount}`);
  if (data.mainMuscles.length > 0) lines.push(`Muscles Trained: ${data.mainMuscles.join(", ")}`);

  if (data.readiness) {
    lines.push("");
    lines.push("READINESS");
    lines.push(`${data.readiness.score}/100 (${data.readiness.bandLabel})`);
  }

  if (data.alternateGym) {
    lines.push("");
    lines.push("SESSION CONTEXT");
    lines.push(data.alternateGym.locationLabel ? `Alternate gym: ${data.alternateGym.locationLabel}` : "Alternate gym session");
  }

  data.exercises.forEach((ex, i) => {
    lines.push("");
    lines.push(`EXERCISE ${i + 1}`);
    lines.push(ex.name);
    if (ex.equipmentLabel) lines.push(`Equipment: ${ex.equipmentLabel}`);
    if (ex.targetReps != null) lines.push(`Target: ${ex.targetReps} reps`);

    const warmups = ex.setRows.filter((r) => r.isWarmup);
    const working = ex.setRows.filter((r) => !r.isWarmup);
    if (warmups.length > 0) {
      lines.push("");
      lines.push("Warm-up:");
      warmups.forEach((r) => lines.push(setLineForText(r)));
    }
    if (working.length > 0) {
      lines.push("");
      lines.push("Working Sets:");
      working.forEach((r, wi) => lines.push(`${wi + 1}. ${setLineForText(r)}`));
    }
    if (ex.jointNote) {
      const area = ex.jointNote.bodyArea ? `${ex.jointNote.bodyArea} discomfort` : "Discomfort noted";
      const sev = ex.jointNote.severity != null ? `: ${ex.jointNote.severity}/10` : "";
      const note = ex.jointNote.note ? ` — ${ex.jointNote.note}` : "";
      lines.push(`Joint note: ${area}${sev}${note}`);
    }
    if (ex.workingSetCount > 0) {
      lines.push("");
      lines.push(
        `Summary: ${ex.workingSetCount} working set${ex.workingSetCount === 1 ? "" : "s"}, ${ex.workingReps} reps, ${ex.volume.toLocaleString()} lb volume` +
          (ex.bestSet ? `, best set ${ex.bestSet.weight} x ${ex.bestSet.reps}` : "")
      );
    }
    if (ex.prs.length > 0) {
      lines.push(`PR: ${ex.prs.map((pr) => `${PR_TYPE_LABEL[pr.type]} (${prHeroLabel(pr)}, previous ${prPreviousLabel(pr)})`).join("; ")}`);
    }
  });

  if (data.note) {
    lines.push("");
    lines.push("WORKOUT NOTES");
    lines.push(data.note);
  }

  if (data.coachMessage) {
    lines.push("");
    lines.push("BRK COACH SUMMARY");
    lines.push(data.coachMessage);
  }

  if (data.comparison) {
    lines.push("");
    lines.push(`VS LAST ${data.comparison.planName.toUpperCase()}`);
    if (data.comparison.deltaVolumePct != null) lines.push(`Volume: ${data.comparison.deltaVolumePct >= 0 ? "+" : ""}${data.comparison.deltaVolumePct}%`);
    if (data.comparison.deltaWorkingSets != null) lines.push(`Working Sets: ${data.comparison.deltaWorkingSets >= 0 ? "+" : ""}${data.comparison.deltaWorkingSets}`);
    if (data.comparison.deltaTotalReps != null) lines.push(`Total Reps: ${data.comparison.deltaTotalReps >= 0 ? "+" : ""}${data.comparison.deltaTotalReps}`);
    lines.push(`PRs: ${data.comparison.prCount}`);
    if (data.comparison.bestLift) {
      lines.push(
        `Best Lift: ${data.comparison.bestLift.current.weight} x ${data.comparison.bestLift.current.reps} vs ${data.comparison.bestLift.previous.weight} x ${data.comparison.bestLift.previous.reps}`
      );
    }
  }

  return lines.join("\n");
}
