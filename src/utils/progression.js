// ---------------- PROGRESSION ENGINE ----------------
// Suggests the next session's weight from double progression, sharpened by RIR/RPE and
// (new in Phase 3) aware of same-day readiness so a bad-recovery miss doesn't get treated
// the same as a genuine plateau. Kept conservative throughout — one bad session is never
// enough on its own to suggest a load drop; two in a row (with normal readiness) is.

import { computeReadinessScore, readinessBand } from "./readiness.js";

function isWarmup(s) {
  return s.setType === "warmup";
}
// Warm-ups never distort progression math — the one filter every branch below runs sets
// through first.
function countedSets(sets) {
  return sets.filter((s) => !isWarmup(s));
}
function increment(exType) {
  return exType === "compound" ? 5 : 2.5;
}

function readinessBandOnDate(readinessLogs, dateISO) {
  if (!readinessLogs || readinessLogs.length === 0) return null;
  const day = dateISO.slice(0, 10);
  const entry = readinessLogs.find((r) => r.date.slice(0, 10) === day);
  if (!entry) return null;
  return readinessBand(computeReadinessScore(entry));
}

// context: { readinessLogs? } — optional; omit entirely and this behaves exactly as before
// readiness existed. Only ever reads the top (non-warm-up) working set — s.drops, when
// present, is never touched, so a dropset's reduced-weight drops can't skew the suggestion.
export function suggestNext(exId, logs, exMap, context = {}) {
  const exLogs = logs.filter((l) => l.exId === exId).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (exLogs.length === 0)
    return { lastWeight: null, lastReps: null, suggestion: null, targetReps: null, reason: "No history yet — log a starting weight." };
  const last = exLogs[0];
  const scored = countedSets(last.sets).length > 0 ? countedSets(last.sets) : last.sets;
  const topSet = scored[0];
  const allHitTarget = scored.every((s) => s.reps >= last.targetReps);
  const ex = exMap[exId];
  const inc = increment(ex ? ex.type : "isolation");
  // RIR/RPE on the top set turns a plain "hit target reps" into "with room to spare" vs.
  // "barely ground it out" — reps alone can't tell those apart.
  const topRir = topSet.rir != null ? topSet.rir : topSet.rpe != null ? 10 - topSet.rpe : null;

  let suggestion, reason;
  if (allHitTarget && topRir != null && topRir <= 1) {
    suggestion = topSet.weight;
    reason = `Hit target reps but at ${topRir} RIR — repeat ${topSet.weight} lb before adding load.`;
  } else if (allHitTarget) {
    suggestion = topSet.weight + inc;
    reason =
      topRir != null && topRir >= 2
        ? `Hit target reps with ${topRir}+ RIR to spare — add ${inc} lb.`
        : `Hit target reps last time (${last.targetReps}+) — add ${inc} lb.`;
  } else {
    // A miss on a RED-readiness day isn't automatically "regression" — don't let it trigger
    // the two-sessions-in-a-row escalation, and say so plainly instead of quietly repeating
    // the same weight with no context.
    const lastWasLowReadiness = readinessBandOnDate(context.readinessLogs, last.date) === "red";

    const missedLastTwo =
      !lastWasLowReadiness &&
      exLogs.length >= 2 &&
      exLogs[0].sets[0]?.weight === exLogs[1].sets[0]?.weight &&
      exLogs.slice(0, 2).every((l) => {
        const s = countedSets(l.sets).length > 0 ? countedSets(l.sets) : l.sets;
        return !s.every((set) => set.reps >= l.targetReps);
      });

    suggestion = topSet.weight;
    if (lastWasLowReadiness) {
      reason = `Missed target reps last time, but readiness was RED that day — not necessarily regression. Repeat ${topSet.weight} lb and reassess.`;
    } else {
      reason = missedLastTwo
        ? `Missed target reps two sessions in a row at ${topSet.weight} lb — hold here, or drop ${inc} lb and rebuild.`
        : `Missed target reps last time — repeat ${topSet.weight} lb and push for ${last.targetReps}.`;
    }
  }
  return { lastWeight: topSet.weight, lastReps: topSet.reps, suggestion, targetReps: last.targetReps, reason, date: last.date };
}
