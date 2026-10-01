// ---------------- AUTO POST-WORKOUT RECAP ----------------
// A short, factual coaching recap computed on demand from a finished session (state.workoutSessions
// entry) plus the athlete's log history — never a stored, fragile blob. Calling this twice for the
// same session with the same log history always produces the same recap (task section 7:
// "reproducible from workout data... the underlying workout data remains source of truth"), so the
// exact same function renders it both right after Finish Workout and later from Workout History →
// Session → Recap.
//
// Tone (task section 3): concise, factual, training-focused. No "AMAZING WORKOUT!" — every string
// here reads like a coach's note, not a cheer.

import { topSetOf, countedSets, suggestNext } from "./progression.js";
import { equipmentDisplayLabel, TEMPORARY_EQUIPMENT_CONTEXT } from "./equipmentProfiles.js";
import { isConcerningQuality, qualityAttentionLabel, summarizePainFlags } from "./workoutQuality.js";
import { matchExerciseEntry, computeSessionConfidence, describeSessionVolume, declineContext } from "./sessionComparison.js";

function increment(exType) {
  return exType === "compound" ? 5 : 2.5;
}

// Mirrors suggestNext's own hit/miss + quality logic, but anchored to THIS session's own entry
// as "last performance" rather than re-querying state.logs — so the recap's "next time" target
// is fixed to what actually happened in this session, not silently redrawn by whatever gets
// logged after it (task section 6/7). Equipment-different sessions never suggest a load pulled
// from a different machine (task section 6: never "strength dropped 40 lb").
function nextTimeTargetFromEntry(entry, exMap) {
  const counted = countedSets(entry.sets);
  if (counted.length === 0) return null;
  const top = topSetOf(entry.sets);
  const targetReps = entry.targetReps ?? top.reps;
  const allHitTarget = counted.every((s) => s.reps >= targetReps);
  const ex = exMap?.[entry.exId];
  const inc = increment(ex ? ex.type : "isolation");
  const isTemp = entry.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT;
  const concerning = isConcerningQuality(top.quality);

  if (isTemp) {
    // Task section 11: don't imply the athlete must repeat THIS temporary machine's load —
    // BRK simply has no comparable target for it. Returning to a familiar saved profile later
    // resumes that profile's own history automatically (nextTimeTargetFromEntry/suggestNext both
    // key off equipmentProfileId, never off "what happened on the temporary machine").
    return { weight: null, repsLabel: null, reason: "Different machine used. No direct load target assigned." };
  }
  if (concerning) {
    // Deliberately weight: null — task's own example renders this as "Repeat load and reassess
    // comfort," never a "Try X × Y" line (that phrasing implies a routine progression call,
    // which a pain/form-breakdown flag specifically means this isn't).
    return {
      weight: null,
      repsLabel: null,
      reason: top.quality === "pain" ? "Repeat load and reassess comfort." : "Repeat load and prioritize clean execution.",
    };
  }
  if (allHitTarget) {
    const repsLow = targetReps;
    const repsHigh = Math.max(top.reps, targetReps);
    return {
      weight: top.weight + inc,
      repsLabel: repsHigh > repsLow ? `${repsLow}–${repsHigh}` : String(repsLow),
      reason: `Hit target reps — try ${top.weight + inc} × ${repsHigh > repsLow ? `${repsLow}–${repsHigh}` : repsLow}.`,
    };
  }
  return {
    weight: top.weight,
    repsLabel: String(targetReps),
    reason: `Missed target reps — repeat ${top.weight} and push for ${targetReps}.`,
  };
}

// `logs` should be the athlete's full state.logs (or any superset covering this exercise) —
// filtered internally to entries strictly BEFORE this session's own start time, which is what
// makes the recap reproducible regardless of what gets logged afterward. `state` is passed
// through only to resolve saved equipment-profile labels (equipmentDisplayLabel reads
// state.equipmentProfiles) — never mutated.
export function buildWorkoutRecap({ session, logs, exMap, state }) {
  if (!session) return null;
  const entries = session.entries || [];
  const sessionStartMs = new Date(session.startedAt || session.finishedAt).getTime();
  const priorLogsAll = (logs || []).filter((l) => new Date(l.date).getTime() < sessionStartMs);

  const sessionDateKey = (session.startedAt || session.finishedAt || "").slice(0, 10);

  const perExercise = entries.map((entry, entryIndex) => {
    // Task section 2 (CRITICAL): comparability is decided by sameEquipmentBucket alone (inside
    // matchExerciseEntry) — never by session.sessionContext.locationMode. Alternate Gym is where
    // the athlete trained, not whether today's numbers are comparable to a saved profile's own
    // history; a saved profile used before at that same gym compares normally here.
    const progression = matchExerciseEntry(entry, priorLogsAll);
    const counted = countedSets(entry.sets);
    const qualityCounts = { grind: 0, form_breakdown: 0, pain: 0 };
    entry.sets.forEach((s) => {
      if (s.quality === "grind") qualityCounts.grind++;
      if (s.quality === "form_breakdown") qualityCounts.form_breakdown++;
      if (s.quality === "pain") qualityCounts.pain++;
    });
    // One condensed pain line per exercise (task section 13/14) instead of one per set/jointNote
    // — see summarizePainFlags for why a detail-free pain-flagged set still produces a summary.
    const painSummary = summarizePainFlags(entry);
    // Only ever built from data actually logged for this session (exercise position, readiness)
    // — never an invented explanation. Empty array is the honest default, not a placeholder.
    const declineNotes = progression.status === "declined" ? declineContext({ entryIndex, totalEntries: entries.length, state, sessionDateKey }) : [];

    return {
      exId: entry.exId,
      name: exMap?.[entry.exId]?.name || entry.exId,
      entry,
      equipmentLabel: equipmentDisplayLabel(state || {}, entry.equipmentProfileId ?? null, entry.equipmentContext ?? null),
      workingSetCount: counted.length,
      topSet: counted.length > 0 ? topSetOf(entry.sets) : null,
      progression,
      declineNotes,
      qualityCounts,
      painSummary,
      hasAttention: qualityCounts.grind > 0 || qualityCounts.form_breakdown > 0 || qualityCounts.pain > 0 || !!painSummary,
      nextTime: nextTimeTargetFromEntry(entry, exMap || {}),
    };
  });

  const wins = perExercise.filter((e) => e.progression.status === "increased_load" || e.progression.status === "increased_reps");
  const declines = perExercise.filter((e) => e.progression.status === "declined");
  const attention = perExercise.filter((e) => e.hasAttention);

  // Task section 3 (CRITICAL): counts ONLY exercises where a direct load comparison was actually
  // excluded — i.e. a genuinely unfamiliar/temporary machine was used this session
  // (progression.status === "equipment_different"). A saved profile with its own prior history,
  // or a brand-new saved profile with none yet, is never "different equipment" just because
  // Alternate Gym happens to be on — those get their own honest statuses (normal comparison, or
  // "new_profile_no_history") rather than inflating this count.
  const differentEquipmentCount = perExercise.filter((e) => e.progression.status === "equipment_different").length;

  // Session comparison confidence (see sessionComparison.js header) and the volume line it
  // gates — total tonnage is never the headline, and increased tonnage never stands in for
  // "stronger" on its own. perfDeltaPct/planName come straight from session (buildSessionSummary
  // already computes the raw delta against the most recent same-plan session); this only changes
  // how that number gets INTERPRETED, never how it's calculated.
  const sessionConfidence = computeSessionConfidence(perExercise);
  const volumeLine = describeSessionVolume({ perfDeltaPct: session.perfDeltaPct ?? null, planName: session.planName, confidence: sessionConfidence });

  return {
    planName: session.planName,
    durationSec: session.durationSec,
    exerciseCount: entries.length,
    workingSets: session.workingSets,
    totalVolume: session.totalVolume,
    perfDeltaPct: session.perfDeltaPct ?? null,
    prs: session.prs || [],
    bestLift: session.bestLift || null,
    perExercise,
    wins,
    declines,
    attention,
    sessionConfidence,
    volumeLine,
    alternateGym:
      session.sessionContext?.locationMode === "alternate_gym"
        ? { locationLabel: session.sessionContext.locationLabel || null, differentEquipmentCount }
        : null,
  };
}
