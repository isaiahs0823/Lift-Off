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
import { sameEquipmentBucket, equipmentDisplayLabel, TEMPORARY_EQUIPMENT_CONTEXT } from "./equipmentProfiles.js";
import { isConcerningQuality, qualityAttentionLabel } from "./workoutQuality.js";

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
    return { weight: null, repsLabel: null, reason: "Different equipment used — repeat and reassess once back on a familiar machine." };
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

// Categorizes one exercise entry against the most recent PRIOR entry for the same exercise +
// equipment bucket (task section 5) — "only compare directly when the progression context is
// valid." A temporary/alternate-machine entry is never compared, and never explained as a
// decline; a brand-new saved profile with no history yet is its own distinct status rather than
// silently falling through to "first time."
function progressionStatusFor(entry, priorEntry) {
  if (entry.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT) {
    return { status: "equipment_different", message: "Different equipment used — direct load comparison excluded." };
  }
  if (!priorEntry) {
    return entry.equipmentProfileId
      ? { status: "new_profile_no_history", message: "New equipment profile — no prior comparison yet." }
      : { status: "first_time", message: "First time logged." };
  }
  const newTop = topSetOf(entry.sets);
  const priorTop = topSetOf(priorEntry.sets);
  if (newTop.weight > priorTop.weight) {
    return { status: "increased_load", message: `+${Math.round((newTop.weight - priorTop.weight) * 10) / 10} lb at ${newTop.reps} reps`, priorTop, newTop };
  }
  if (newTop.weight === priorTop.weight && newTop.reps > priorTop.reps) {
    return { status: "increased_reps", message: `+${newTop.reps - priorTop.reps} rep${newTop.reps - priorTop.reps === 1 ? "" : "s"} at the same load`, priorTop, newTop };
  }
  if (newTop.weight === priorTop.weight && newTop.reps === priorTop.reps) {
    return { status: "matched", message: "Matched last session", priorTop, newTop };
  }
  return { status: "declined", message: `${priorTop.weight} × ${priorTop.reps} → ${newTop.weight} × ${newTop.reps}`, priorTop, newTop };
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

  const perExercise = entries.map((entry) => {
    const priorForEx = priorLogsAll
      .filter((l) => l.exId === entry.exId && sameEquipmentBucket(l, entry.equipmentProfileId ?? null, entry.equipmentContext ?? null))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const priorEntry = priorForEx[0] || null;
    const progression = progressionStatusFor(entry, priorEntry);
    const counted = countedSets(entry.sets);
    const qualityCounts = { grind: 0, form_breakdown: 0, pain: 0 };
    const painFlags = [];
    entry.sets.forEach((s) => {
      if (s.quality === "grind") qualityCounts.grind++;
      if (s.quality === "form_breakdown") qualityCounts.form_breakdown++;
      if (s.quality === "pain") {
        qualityCounts.pain++;
        if (s.pain) painFlags.push(s.pain);
      }
    });
    if (entry.jointNote) painFlags.push(entry.jointNote);

    return {
      exId: entry.exId,
      name: exMap?.[entry.exId]?.name || entry.exId,
      entry,
      equipmentLabel: equipmentDisplayLabel(state || {}, entry.equipmentProfileId ?? null, entry.equipmentContext ?? null),
      workingSetCount: counted.length,
      topSet: counted.length > 0 ? topSetOf(entry.sets) : null,
      progression,
      qualityCounts,
      painFlags,
      hasAttention: qualityCounts.grind > 0 || qualityCounts.form_breakdown > 0 || qualityCounts.pain > 0 || painFlags.length > 0,
      nextTime: nextTimeTargetFromEntry(entry, exMap || {}),
    };
  });

  const wins = perExercise.filter((e) => e.progression.status === "increased_load" || e.progression.status === "increased_reps");
  const declines = perExercise.filter((e) => e.progression.status === "declined");
  const attention = perExercise.filter((e) => e.hasAttention);

  const differentEquipmentCount = entries.filter(
    (e) => e.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT || (e.equipmentProfileId && session.sessionContext?.locationMode === "alternate_gym")
  ).length;

  return {
    planName: session.planName,
    durationSec: session.durationSec,
    exerciseCount: entries.length,
    workingSets: session.workingSets,
    totalVolume: session.totalVolume,
    prs: session.prs || [],
    bestLift: session.bestLift || null,
    perExercise,
    wins,
    declines,
    attention,
    alternateGym:
      session.sessionContext?.locationMode === "alternate_gym"
        ? { locationLabel: session.sessionContext.locationLabel || null, differentEquipmentCount }
        : null,
  };
}
