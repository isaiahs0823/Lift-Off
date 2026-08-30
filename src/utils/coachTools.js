// ---------------- COACH AI TOOL EXECUTORS (client-side) ----------------
// BRK has no backend database — everything lives in this browser's state, so tool calls the
// model requests can only be executed here, never on the server. Every executor below is a
// thin wrapper around an EXISTING BRK util/calculation; none of them recompute anything that
// already has a source of truth elsewhere in the app (see the imports).
//
// Schemas live in coachToolSchemas.js (shared with the server, which is what actually tells the
// model these tools exist). This file only needs to agree on names/argument shapes with that
// file — see COACH_TOOL_NAMES.
//
// Every executor has the same signature — (state, exMap, allExercises, args) — even ones that
// don't need every param, so coachToolRunner.js can dispatch generically without a per-tool
// special case.
import { resolveProfile } from "./athleteProfile.js";
import { formatSetVerbose, SET_TYPE_LABEL, formatSessionDuration } from "./workoutSets.js";
import { rollingAverage, weeklyRateOfChange, latestValue } from "./bodyweightMath.js";
import { computeReadinessScore, readinessBand } from "./readiness.js";
import { MEAL_SLOT_LABEL } from "./nutrition.js";
import { rollingNutritionAdherence } from "./nutritionAdherence.js";
import { weeklyMuscleVolume, muscleVolumeTrend } from "./muscleVolume.js";
import { suggestNext } from "./progression.js";
import { PR_TYPE_LABEL, prDeltaLabel, prHeroLabel } from "./prSummary.js";
import { resolveCurrentProgramDay } from "./programSchedule.js";
import { diagnoseNutrition, generateAdjustmentProposal } from "../services/nutritionCoachService.js";
import { equipmentDisplayLabel, TEMPORARY_EQUIPMENT_CONTEXT } from "./equipmentProfiles.js";
import { painTrendForExercise } from "./workoutQuality.js";

function findExercise(allExercises, nameQuery) {
  if (!nameQuery) return null;
  const q = nameQuery.toLowerCase().trim();
  return (
    (allExercises || []).find((ex) => ex.name.toLowerCase() === q) ||
    (allExercises || []).find((ex) => ex.name.toLowerCase().includes(q)) ||
    null
  );
}

function dateKeyDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export const COACH_TOOL_EXECUTORS = {
  getAthleteProfile(state) {
    const p = resolveProfile(state);
    return {
      experience: p.experience,
      trainingStyle: p.trainingStyle,
      preferredDays: p.preferredDays,
      preferredDuration: p.preferredDuration,
      equipment: p.equipment,
      constraints: p.constraints,
      motivation: p.motivation,
      coachingStyle: p.coachingStyle,
      coachSpecialty: p.coachSpecialty,
      physiquePhase: p.physiquePhase,
      physiquePriorities: p.physiquePriorities,
      dislikedExercises: p.dislikedExercises,
      favoriteExercises: p.favoriteExercises,
      dislikedCardio: p.dislikedCardio,
      likedCardio: p.likedCardio,
    };
  },

  getCurrentProgram(state, exMap) {
    const resolved = resolveCurrentProgramDay(state);
    if (!resolved) return { hasActiveProgram: false };
    const list = resolved.programContext?.source === "custom" ? state.customPrograms || [] : state.programs || [];
    const program = list.find((p) => p.id === resolved.programContext?.programId);
    return {
      hasActiveProgram: true,
      programName: resolved.programName,
      currentDayLabel: resolved.plan?.name || null,
      isComplete: !!resolved.isComplete,
      weekNumber: resolved.weekNumber,
      totalWeeks: resolved.totalWeeks,
      completedToday: !!resolved.completedToday,
      // Full day/exercise structure — needed for "take my current program and change X" requests
      // (program-builder spec section 33). Omitted from the compact per-turn context on purpose;
      // this tool is how the model gets it when actually needed.
      scheduleMode: program?.scheduleMode || null,
      days: (program?.days || []).map((d) => ({
        label: d.label,
        weekday: d.weekday || null,
        exercises: (d.exercises || []).map((ex) => ({ exercise: exMap[ex.exId]?.name || ex.exId, sets: ex.sets, reps: ex.reps })),
      })),
    };
  },

  getExerciseLibrary(state, exMap, allExercises, { muscle, query } = {}) {
    let list = allExercises || [];
    if (muscle) list = list.filter((e) => (e.muscle || "").toLowerCase() === String(muscle).toLowerCase());
    if (query) {
      const q = String(query).toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    const capped = list.slice(0, 40);
    return {
      count: capped.length,
      truncated: list.length > capped.length,
      exercises: capped.map((e) => ({ id: e.id, name: e.name, type: e.type, muscle: e.muscle })),
    };
  },

  getRecentWorkouts(state, exMap, allExercises, { limit = 5 } = {}) {
    const sessions = [...(state.workoutSessions || [])].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    return sessions.slice(0, Math.min(limit || 5, 20)).map((s) => ({
      sessionId: s.id,
      planName: s.planName,
      finishedAt: s.finishedAt,
      durationSec: s.durationSec,
      workingSets: s.workingSets,
      totalVolume: s.totalVolume,
      totalReps: s.totalReps,
      prCount: (s.prs || []).length,
      rating: s.rating,
      // Task section 15: purely informational — WHERE the athlete trained, never evidence of a
      // performance change on its own. Whether any of this session's numbers are directly
      // comparable to prior history is decided entirely by equipment profile/context (see
      // equipmentNote in getExerciseHistory below) — location is never part of that decision.
      ...(s.sessionContext?.locationMode === "alternate_gym"
        ? { location: s.sessionContext.locationLabel || "Alternate gym", locationNote: "Training location only — not itself evidence of a performance change." }
        : {}),
    }));
  },

  getWorkoutById(state, exMap, allExercises, { sessionId } = {}) {
    const session = (state.workoutSessions || []).find((s) => s.id === sessionId);
    if (!session) return { found: false };
    return {
      found: true,
      planName: session.planName,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      duration: formatSessionDuration(session.durationSec),
      workingSets: session.workingSets,
      totalVolume: session.totalVolume,
      totalReps: session.totalReps,
      mainMuscles: session.mainMuscles,
      coachReviewAlreadyGiven: session.coachMessage || null,
      exercises: (session.entries || []).map((e) => ({
        exercise: exMap[e.exId]?.name || e.exId,
        sets: e.sets.map((s) => ({ text: formatSetVerbose(s), setType: SET_TYPE_LABEL[s.setType || "working"] })),
      })),
      prs: (session.prs || []).map((pr) => ({ exercise: exMap[pr.exId]?.name || pr.exId, type: PR_TYPE_LABEL[pr.type], result: prHeroLabel(pr), improvement: prDeltaLabel(pr) })),
      detailedSetDataAvailable: Array.isArray(session.entries) && session.entries.length > 0,
    };
  },

  getExerciseHistory(state, exMap, allExercises, { exerciseName } = {}) {
    const ex = findExercise(allExercises, exerciseName);
    if (!ex) return { found: false, reason: `No exercise matching "${exerciseName}" found in BRK's catalog.` };
    const logs = (state.logs || []).filter((l) => l.exId === ex.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    // Equipment-profile aware (task section 21): the progression suggestion is scoped to
    // whichever machine the athlete most recently used, matching what they'd actually see on
    // that exercise's card — never blending a heavier "Default Machine" number with a lighter
    // "Iron Temple" one into one misleading suggestion.
    const mostRecent = logs[0];
    const suggestion = suggestNext(ex.id, state.logs || [], exMap, {
      readinessLogs: state.readinessLogs,
      equipmentProfileId: mostRecent?.equipmentProfileId ?? null,
      equipmentContext: mostRecent?.equipmentContext ?? null,
    });
    // Only worth mentioning once the exercise actually spans more than one machine — most
    // exercises never do, and for those this is simply absent (no behavior/prompt change).
    const distinctEquipment = new Set(
      logs.map((l) => (l.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT ? TEMPORARY_EQUIPMENT_CONTEXT : l.equipmentProfileId || "default"))
    );
    const painTrend = painTrendForExercise(logs);
    return {
      found: true,
      exercise: ex.name,
      muscle: ex.muscle,
      entryCount: logs.length,
      history: logs.slice(0, 10).map((l) => ({
        date: l.date,
        sets: l.sets.map((s) => formatSetVerbose(s)),
        equipment: equipmentDisplayLabel(state, l.equipmentProfileId, l.equipmentContext),
        // Present only when a set was actually flagged — most sets have nothing here.
        ...(l.sets.some((s) => s.quality && s.quality !== "clean") ? { qualityFlags: l.sets.map((s) => s.quality || "clean") } : {}),
      })),
      progressionSuggestion: suggestion.suggestion
        ? { suggestedNext: suggestion.suggestion, reason: suggestion.reason, lastWeight: suggestion.lastWeight, lastReps: suggestion.lastReps }
        : { reason: suggestion.reason },
      // Present only when the exercise has been logged on more than one machine/equipment
      // context — tells the model these loads are not directly comparable, so it never reads a
      // lighter number on a different machine as strength loss (task section 21).
      ...(distinctEquipment.size > 1
        ? {
            equipmentNote:
              "This exercise has been logged under multiple equipment profiles/machines. Loads are not directly comparable across different equipment — do not interpret a lighter number on a different machine as a strength decline.",
          }
        : {}),
      // Training context only (task section 13/29) — never a diagnosis. Absent when nothing's
      // been reported recently.
      ...(painTrend.length > 0 ? { painTrend, painNote: "This is athlete-reported training context, not a medical diagnosis." } : {}),
    };
  },

  getRecentPRs(state, exMap, allExercises, { limit = 5 } = {}) {
    const sessions = [...(state.workoutSessions || [])].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    const prs = [];
    for (const s of sessions) {
      for (const pr of s.prs || []) {
        prs.push({ exercise: exMap[pr.exId]?.name || pr.exId, type: PR_TYPE_LABEL[pr.type], result: prHeroLabel(pr), improvement: prDeltaLabel(pr), date: s.finishedAt });
        if (prs.length >= (limit || 5)) break;
      }
      if (prs.length >= (limit || 5)) break;
    }
    return { prs };
  },

  getReadinessTrend(state, exMap, allExercises, { days = 14 } = {}) {
    const sinceKey = dateKeyDaysAgo(days || 14);
    const logs = (state.readinessLogs || []).filter((r) => r.date.slice(0, 10) >= sinceKey).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (logs.length === 0) return { hasData: false };
    const scored = logs.map((r) => ({ date: r.date, score: computeReadinessScore(r) })).filter((r) => r.score != null);
    const avg = scored.length ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : null;
    return {
      hasData: scored.length > 0,
      entryCount: scored.length,
      averageScore: avg,
      averageBand: avg != null ? readinessBand(avg) : null,
      recent: scored.slice(-7),
    };
  },

  getBodyweightTrend(state, exMap, allExercises, { days = 30 } = {}) {
    const entries = state.bodyweightLogs || [];
    if (entries.length === 0) return { hasData: false };
    const sinceKey = dateKeyDaysAgo(days || 30);
    const windowed = entries.filter((e) => (e.date || "").slice(0, 10) >= sinceKey);
    return {
      hasData: true,
      current: latestValue(entries, "weight"),
      rollingAverage7Day: rollingAverage(entries, "weight", 7),
      weeklyRateOfChange: weeklyRateOfChange(entries, "weight"),
      entriesInWindow: windowed.length,
    };
  },

  getMuscleVolume(state, exMap) {
    return { thisWeek: weeklyMuscleVolume(state, exMap, 7), trend: muscleVolumeTrend(state, exMap) };
  },

  getProgressionSuggestion(state, exMap, allExercises, { exerciseName } = {}) {
    const ex = findExercise(allExercises, exerciseName);
    if (!ex) return { found: false, reason: `No exercise matching "${exerciseName}" found.` };
    const suggestion = suggestNext(ex.id, state.logs || [], exMap, { readinessLogs: state.readinessLogs });
    return { found: true, exercise: ex.name, ...suggestion };
  },

  getNutritionTargets(state) {
    if (!state.nutritionTargets) return { hasTargets: false };
    const t = state.nutritionTargets;
    return { hasTargets: true, calories: t.calories, protein: t.protein, carbs: t.carbs, fat: t.fat, estimatedMaintenance: t.estimatedMaintenance, method: t.method };
  },

  getNutritionAdherence(state, exMap, allExercises, { days = 7 } = {}) {
    if (!state.nutritionTargets) return { hasTargets: false };
    return rollingNutritionAdherence(state, days || 7);
  },

  getRecentFoodLogs(state, exMap, allExercises, { days = 3 } = {}) {
    const sinceKey = dateKeyDaysAgo(days || 3);
    const entries = (state.foodLogs || []).filter((f) => f.date >= sinceKey).sort((a, b) => (b.time || "").localeCompare(a.time || ""));
    return {
      entries: entries.slice(0, 40).map((f) => ({ date: f.date, meal: MEAL_SLOT_LABEL[f.meal] || f.meal, food: f.food, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat })),
    };
  },

  getCoachMemories(state) {
    const memories = state.coachMemories || [];
    return {
      facts: memories.filter((m) => m.source === "stated" && m.status !== "outdated").map((m) => m.text),
      patterns: memories.filter((m) => m.source !== "stated" && m.status !== "outdated").map((m) => ({ text: m.text, confidence: m.confidence, evidenceCount: m.evidenceCount })),
    };
  },

  getActiveCommitments(state) {
    const commitments = (state.commitments || []).filter((c) => c.status === "active");
    return { commitments: commitments.map((c) => ({ id: c.id, text: c.text, type: c.type, target: c.target, period: c.period })) };
  },

  proposeNutritionTargetChange(state) {
    if (!state.nutritionTargets) return { applicable: false, reason: "No nutrition targets set up yet." };
    const diagnosis = diagnoseNutrition(state);
    if (!diagnosis || diagnosis.kind !== "target_needs_adjustment") {
      return { applicable: false, reason: diagnosis?.message || "No adjustment is indicated right now — current targets still fit the evidence." };
    }
    const proposal = generateAdjustmentProposal(state);
    if (!proposal) return { applicable: false, reason: "No adjustment is indicated right now." };
    return { applicable: true, proposal };
  },

  // saveMemory, proposeCommitment, and proposeProgram are handled specially by
  // coachToolRunner.js (they need to call updateState / validate / render a confirmation card)
  // rather than returning plain data.
};

export function findExerciseByName(allExercises, nameQuery) {
  return findExercise(allExercises, nameQuery);
}
