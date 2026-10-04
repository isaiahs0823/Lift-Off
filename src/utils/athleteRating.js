// ---------------- ATHLETE RATING ENGINE ----------------
// The ONE place BRK computes OVR, rank, category scores, and muscle-group ratings. No UI
// component calculates any of this independently — every screen reads a computed snapshot.
//
// Core principle: a rating is only ever as precise as the evidence behind it. A category/muscle
// with too little data returns score: null, confidence: "insufficient" — callers must render
// "Establishing baseline," never a fabricated number and never 0. Missing optional categories
// (Recovery, Nutrition) don't get zeroed into the OVR average; their weight is redistributed
// among the categories that DO have real evidence (see CORE_CATEGORIES/BONUS_CATEGORIES below).
//
// Every score is smoothed against the athlete's own previous snapshot (smooth()) so one great
// or one bad session can't swing the number — see the smoothing contract on each compute*
// function. This file only READS canonical state (workoutSessions, logs, readinessLogs,
// nutritionTargets/foodLogs, weeklySchedule) — nothing here is a second copy of that data, and
// nothing here mutates it.
import { countedSets } from "./workoutSets.js";
import { topSetOf } from "./progression.js";
import { matchExerciseEntry, MATCHED_STATUSES } from "./sessionComparison.js";
import { TEMPORARY_EQUIPMENT_CONTEXT } from "./equipmentProfiles.js";
import { getMuscleDisplay } from "./muscleDisplay.js";
import { computeScheduleAdherence, hasSchedule } from "./weeklySchedule.js";
import { computeAdherence } from "./adherence.js";
import { computeReadinessScore } from "./readiness.js";
import { rollingNutritionAdherence } from "./nutritionAdherence.js";

const MS_DAY = 86400000;

export const CONFIDENCE = { INSUFFICIENT: "insufficient", LOW: "low", MODERATE: "moderate", HIGH: "high" };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
// Same Epley formula used elsewhere in BRK (dataWorkbook.js, weeklyReview.js, App.jsx's local
// detectPRs) — duplicated here rather than imported, matching this codebase's own established
// pattern for this one-line formula rather than introducing a new shared dependency for it.
function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}

// Blends a freshly computed score against the athlete's last DISPLAYED score for that same
// category/muscle (70% prior / 30% new) — this is the volatility control: a rolling-window
// computation already resists single-session noise, and this adds a second layer so one PR
// can't jump a score double digits and one bad session can't collapse it. The very first score
// ever computed (no prior snapshot) is shown as-is — that's the baseline reveal.
function smooth(newScore, priorScore) {
  if (priorScore == null) return Math.round(newScore);
  return Math.round(0.7 * priorScore + 0.3 * newScore);
}

// ---------------- OVR weighting ----------------
// Weights when every category is qualified. Recovery and Nutrition are "bonus" — opt-in data
// (readiness check-ins, a nutrition target) that most athletes may not maintain. If insufficient,
// their weight is redistributed proportionally among the 4 CORE categories rather than scored as
// zero, so an athlete who's never touched Nutrition isn't punished for it — and isn't rewarded
// for skipping it either, since OVR then rests entirely on honestly-earned core evidence.
export const CATEGORY_WEIGHTS = { strength: 20, consistency: 20, progression: 20, recovery: 15, trainingQuality: 15, nutrition: 10 };
const CORE_CATEGORIES = ["strength", "consistency", "progression", "trainingQuality"];
const BONUS_CATEGORIES = ["recovery", "nutrition"];

// ---------------- Rank thresholds ----------------
// 6 ranks, evenly dividing 0-100 (~16-17 points each), each split into 3 sub-levels (~5-6 points
// each). III is the entry sub-level of a rank, I is the exit sub-level right before the next
// rank — e.g. "Forged III" -> "Forged II" -> "Forged I" -> "Relentless III". A stable, documented
// structure, not copied from the mockup's own (self-inconsistent) example numbers.
export const RANKS = [
  { tier: "Initiate", min: 0, max: 16 },
  { tier: "Built", min: 17, max: 33 },
  { tier: "Forged", min: 34, max: 50 },
  { tier: "Relentless", min: 51, max: 67 },
  { tier: "Elite", min: 68, max: 84 },
  { tier: "Champion", min: 85, max: 100 },
];
const SUBLEVELS = ["III", "II", "I"];
export function rankForOvr(ovr) {
  const tier = RANKS.find((r) => ovr >= r.min && ovr <= r.max) || RANKS[ovr < 0 ? 0 : RANKS.length - 1];
  const span = tier.max - tier.min + 1;
  const subIndex = clamp(Math.floor(((ovr - tier.min) / span) * 3), 0, 2);
  const sublevel = SUBLEVELS[subIndex];
  return { tier: tier.tier, sublevel, label: `${tier.tier} ${sublevel}`, min: tier.min, max: tier.max };
}
// True rank ADVANCEMENT (not just a sub-level tick) — used to tell a Level Up moment from the
// bigger Rank Up moment.
export function ranksDiffer(a, b) {
  return !!a && !!b && a.tier !== b.tier;
}

// ---------------- muscle-group taxonomy ----------------
// BRK's exercise catalog only stores a broad `muscle` category (Chest/Back/Shoulders/Arms/Legs/
// Core/Conditioning/Full body — see App.jsx EXERCISE_LIBRARY). The finer Quads/Hamstrings/Glutes/
// Calves split the mockup wants already exists as a derived signal — getMuscleDisplay() (used
// today to pick which anatomy-diagram zone lights up) refines the broad category using the
// exercise's own NAME. Reusing it here (rather than inventing a second taxonomy) means muscle
// ratings and the anatomy diagram can never disagree about which zone an exercise belongs to.
const ZONE_TO_GROUP = {
  chest: "chest",
  back: "back",
  shoulders: "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  quads: "quads",
  hamstrings: "hamstrings",
  glutes: "glutes",
  calves: "calves",
  // "abs" and "full" (Core/Conditioning/Full body) don't map onto the 8-card mockup grid and are
  // intentionally excluded from muscle-group ratings — see MUSCLE_GROUPS.
};
export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "quads", "hamstrings", "glutes", "calves"];
export const MUSCLE_GROUP_LABEL = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};
function exerciseGroupMap(exMap) {
  const map = {};
  Object.entries(exMap || {}).forEach(([id, ex]) => {
    const group = ZONE_TO_GROUP[getMuscleDisplay(ex).zone];
    if (group) map[id] = group;
  });
  return map;
}

// ---------------- STRENGTH ----------------
// Evidence: per-exercise estimated-1RM trend over a 90-day window, scoped to the SAME exercise +
// SAME equipment bucket (never blending two machines' numbers — same rule PRs/progression
// already use). Only the counted top set of each log feeds this (topSetOf already excludes
// warm-ups and never reads into a set's `.drops` sub-array), so warm-up volume and drop-set/
// myo-rep/rest-pause mini-set tonnage cannot inflate it. Needs >=2 comparable exposures on at
// least one exercise to return a score at all.
function computeStrengthCategory(state, exMap, now, priorSnapshot) {
  const WINDOW_DAYS = 90;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const logs = (state.logs || []).filter(
    (l) => new Date(l.date).getTime() >= cutoff && l.equipmentContext !== TEMPORARY_EQUIPMENT_CONTEXT
  );

  const buckets = new Map();
  logs.forEach((l) => {
    const top = topSetOf(l.sets || []);
    if (!top) return;
    const key = `${l.exId}::${l.equipmentProfileId || "default"}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ date: new Date(l.date).getTime(), e1rm: estimateOneRM(top.weight, top.reps) });
  });

  let exercisesWithEnoughData = 0;
  let totalExposures = 0;
  let weightedSum = 0;
  let totalWeight = 0;

  buckets.forEach((points) => {
    if (points.length < 2) return;
    points.sort((a, b) => a.date - b.date);
    exercisesWithEnoughData++;
    totalExposures += points.length;
    const first = points[0].e1rm;
    const last = points[points.length - 1].e1rm;
    if (first <= 0) return;
    const pctChange = ((last - first) / first) * 100;
    const w = Math.min(points.length, 6);
    weightedSum += pctChange * w;
    totalWeight += w;
  });

  if (exercisesWithEnoughData === 0 || totalWeight === 0) {
    return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0, exercisesTracked: 0 };
  }

  const avgPctChange = weightedSum / totalWeight;
  // 0% comparable e1RM change over the window = a neutral 50 (holding steady, not "bad"); each
  // 1% of trend moves the score ~3.5 points, so a genuinely strong 10% comparable gain lands in
  // the mid-80s rather than maxing the category out from one good stretch.
  const rawScore = clamp(Math.round(50 + avgPctChange * 3.5), 5, 99);

  let confidence = CONFIDENCE.LOW;
  if (exercisesWithEnoughData >= 3 && totalExposures >= 9) confidence = CONFIDENCE.HIGH;
  else if (exercisesWithEnoughData >= 2 && totalExposures >= 5) confidence = CONFIDENCE.MODERATE;

  const score = smooth(rawScore, priorSnapshot?.categories?.strength?.score ?? null);
  return { score, confidence, evidenceCount: totalExposures, exercisesTracked: exercisesWithEnoughData };
}

// ---------------- CONSISTENCY ----------------
// "Did what you said you'd do" — a RATIO (completed/scheduled), never a raw session count, so a
// 4-day athlete who completes all 4 scores as well as a 7-day athlete who completes all 7
// (spec Test J). Uses BRK's existing Weekly Schedule adherence when a schedule exists (blending
// a 28-day and 7-day window so one off week doesn't swing it); falls back to the generic
// goal-based adherence ratio (adherence.js) when there's no schedule to measure against.
function computeConsistencyCategory(state, now, priorSnapshot) {
  let overall = null;
  let evidenceCount = 0;

  if (hasSchedule(state)) {
    const a28 = computeScheduleAdherence(state, 28);
    const a7 = computeScheduleAdherence(state, 7);
    if (a28 && a28.overall != null) {
      overall = a7 && a7.overall != null ? Math.round(0.6 * a28.overall + 0.4 * a7.overall) : a28.overall;
      evidenceCount = (a28.lifting?.scheduled || 0) + (a28.conditioning?.scheduled || 0) + (a28.recovery?.scheduled || 0);
    }
  } else {
    const a28 = computeAdherence(state, 28);
    overall = a28.overall;
    evidenceCount = a28.strengthDays || 0;
  }

  if (overall == null || evidenceCount === 0) {
    return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0 };
  }

  let confidence = CONFIDENCE.LOW;
  if (evidenceCount >= 8) confidence = CONFIDENCE.HIGH;
  else if (evidenceCount >= 4) confidence = CONFIDENCE.MODERATE;

  const score = smooth(clamp(overall, 0, 100), priorSnapshot?.categories?.consistency?.score ?? null);
  return { score, confidence, evidenceCount };
}

// ---------------- PROGRESSION ----------------
// Reuses BRK's canonical comparison engine (sessionComparison.js's matchExerciseEntry) directly
// — the same function Workout Recap, Full Recap, and Coach already call — so a lift that reads
// "improved" in Recap can never read "regressed" here. Scores the mix of increased_load/
// increased_reps/matched/declined outcomes across every matched exercise exposure in the last 45
// days. Total workout volume/tonnage is never read here at all.
function computeProgressionCategory(state, exMap, now, priorSnapshot) {
  const WINDOW_DAYS = 45;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const recentSessions = (state.workoutSessions || [])
    .filter((s) => new Date(s.finishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));

  const statuses = [];
  recentSessions.forEach((session) => {
    const sessionStartMs = new Date(session.startedAt || session.finishedAt).getTime();
    const priorLogsAll = (state.logs || []).filter((l) => new Date(l.date).getTime() < sessionStartMs);
    (session.entries || []).forEach((entry) => {
      const r = matchExerciseEntry(entry, priorLogsAll);
      if (MATCHED_STATUSES.has(r.status)) statuses.push(r.status);
    });
  });

  const total = statuses.length;
  if (total < 3) return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: total };

  const counts = { increased_load: 0, increased_reps: 0, matched: 0, declined: 0 };
  statuses.forEach((s) => counts[s]++);
  const improved = counts.increased_load + counts.increased_reps;
  // Improving beats merely holding (matched), which beats declining — never a blind reps/volume
  // count, always a WIN/HOLD/DECLINE classification already scoped equipment-aware.
  const weighted = improved * 1.0 + counts.matched * 0.55;
  const rawScore = clamp(Math.round((weighted / total) * 100), 0, 100);

  let confidence = CONFIDENCE.LOW;
  if (total >= 10) confidence = CONFIDENCE.HIGH;
  else if (total >= 6) confidence = CONFIDENCE.MODERATE;

  const score = smooth(rawScore, priorSnapshot?.categories?.progression?.score ?? null);
  return { score, confidence, evidenceCount: total, breakdown: counts };
}

// ---------------- RECOVERY ----------------
// Pure readiness check-in data (computeReadinessScore already returns null for an empty
// check-in — nothing is ever inferred here that BRK wasn't actually told). Below 3 check-ins in
// 30 days, this is "establishing baseline," never a fabricated/zeroed score.
function computeRecoveryCategory(state, now, priorSnapshot) {
  const WINDOW_DAYS = 30;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const scores = (state.readinessLogs || [])
    .filter((r) => new Date(r.date).getTime() >= cutoff)
    .map((r) => computeReadinessScore(r))
    .filter((s) => s != null);

  if (scores.length < 3) return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: scores.length };

  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  let confidence = CONFIDENCE.LOW;
  if (scores.length >= 10) confidence = CONFIDENCE.HIGH;
  else if (scores.length >= 6) confidence = CONFIDENCE.MODERATE;

  const score = smooth(avg, priorSnapshot?.categories?.recovery?.score ?? null);
  return { score, confidence, evidenceCount: scores.length };
}

// ---------------- TRAINING QUALITY ----------------
// Discipline, not tonnage: scores the rate of Pain/Form Breakdown/Grind set-quality flags across
// recent counted (non-warmup) sets. Pain costs the most, Form Breakdown less, Grind only a
// little (occasional grinding is normal training, not recklessness). A set with no quality flag
// at all is treated as clean — the same convention every other BRK screen already uses when
// rendering quality warnings (`s.quality && s.quality !== "clean"`).
function computeTrainingQualityCategory(state, now, priorSnapshot) {
  const WINDOW_DAYS = 30;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const sessions = (state.workoutSessions || []).filter((s) => new Date(s.finishedAt).getTime() >= cutoff);
  if (sessions.length < 2) return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: sessions.length };

  let totalSets = 0;
  let painCount = 0;
  let formBreakdownCount = 0;
  let grindCount = 0;
  sessions.forEach((s) => {
    (s.entries || []).forEach((e) => {
      countedSets(e.sets || []).forEach((set) => {
        totalSets++;
        if (set.quality === "pain") painCount++;
        else if (set.quality === "form_breakdown") formBreakdownCount++;
        else if (set.quality === "grind") grindCount++;
      });
    });
  });

  if (totalSets === 0) return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: sessions.length };

  const concernWeight = painCount * 1.0 + formBreakdownCount * 0.6 + grindCount * 0.2;
  const concernRate = concernWeight / totalSets;
  const rawScore = clamp(Math.round(100 - concernRate * 220), 10, 100);

  let confidence = CONFIDENCE.LOW;
  if (sessions.length >= 8) confidence = CONFIDENCE.HIGH;
  else if (sessions.length >= 4) confidence = CONFIDENCE.MODERATE;

  const score = smooth(rawScore, priorSnapshot?.categories?.trainingQuality?.score ?? null);
  return { score, confidence, evidenceCount: sessions.length, totalSets, painCount, formBreakdownCount, grindCount };
}

// ---------------- NUTRITION ----------------
// Only ever reads BRK's existing calorie/protein-band adherence (nutritionAdherence.js) — no
// food-search/barcode dependency, no new tracking invented for this feature.
function computeNutritionCategory(state, now, priorSnapshot) {
  if (!state.nutritionTargets) return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0 };
  const adherence = rollingNutritionAdherence(state, 14);
  if (adherence.pct == null || adherence.loggedDays < 3) {
    return { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: adherence.loggedDays || 0 };
  }

  let confidence = CONFIDENCE.LOW;
  if (adherence.loggedDays >= 10) confidence = CONFIDENCE.HIGH;
  else if (adherence.loggedDays >= 6) confidence = CONFIDENCE.MODERATE;

  const score = smooth(clamp(adherence.pct, 0, 100), priorSnapshot?.categories?.nutrition?.score ?? null);
  return { score, confidence, evidenceCount: adherence.loggedDays };
}

// ---------------- MUSCLE-GROUP RATINGS ----------------
// Same matched-exposure WIN/HOLD/DECLINE scoring as Progression, scoped per muscle group over a
// 60-day window, plus time-decay: a group untouched for 45+ days is downgraded back toward "low
// confidence" rather than holding a stale high score forever (it still SHOWS the last score —
// nothing here resets to zero — just stops presenting it as freshly-confirmed evidence).
function computeMuscleRatings(state, exMap, now, priorSnapshot) {
  const WINDOW_DAYS = 60;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const exGroup = exerciseGroupMap(exMap);

  const recentSessions = (state.workoutSessions || [])
    .filter((s) => new Date(s.finishedAt).getTime() >= cutoff)
    .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));

  const byGroup = {};
  MUSCLE_GROUPS.forEach((g) => (byGroup[g] = { statuses: [], lastExposureMs: 0, exercisesSeen: new Set() }));

  recentSessions.forEach((session) => {
    const sessionStartMs = new Date(session.startedAt || session.finishedAt).getTime();
    const priorLogsAll = (state.logs || []).filter((l) => new Date(l.date).getTime() < sessionStartMs);
    const finishedMs = new Date(session.finishedAt).getTime();
    (session.entries || []).forEach((entry) => {
      const group = exGroup[entry.exId];
      if (!group) return;
      const bucket = byGroup[group];
      bucket.lastExposureMs = Math.max(bucket.lastExposureMs, finishedMs);
      bucket.exercisesSeen.add(entry.exId);
      const r = matchExerciseEntry(entry, priorLogsAll);
      if (MATCHED_STATUSES.has(r.status)) bucket.statuses.push(r.status);
    });
  });

  const result = {};
  MUSCLE_GROUPS.forEach((group) => {
    const { statuses, lastExposureMs, exercisesSeen } = byGroup[group];
    const total = statuses.length;
    if (total < 2) {
      result[group] = { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: total, exercisesTracked: exercisesSeen.size };
      return;
    }
    const counts = { increased_load: 0, increased_reps: 0, matched: 0, declined: 0 };
    statuses.forEach((s) => counts[s]++);
    const improved = counts.increased_load + counts.increased_reps;
    const weighted = improved * 1.0 + counts.matched * 0.55;
    const rawScore = clamp(Math.round((weighted / total) * 100), 5, 99);

    const daysSinceExposure = lastExposureMs > 0 ? (now - lastExposureMs) / MS_DAY : Infinity;
    let confidence = CONFIDENCE.LOW;
    if (total >= 6 && exercisesSeen.size >= 2 && daysSinceExposure <= 14) confidence = CONFIDENCE.HIGH;
    else if (total >= 4 && exercisesSeen.size >= 2) confidence = CONFIDENCE.MODERATE;
    if (daysSinceExposure > 45) confidence = CONFIDENCE.LOW;

    const score = smooth(rawScore, priorSnapshot?.muscles?.[group]?.score ?? null);
    result[group] = {
      score,
      confidence,
      evidenceCount: total,
      exercisesTracked: exercisesSeen.size,
      daysSinceExposure: Number.isFinite(daysSinceExposure) ? Math.round(daysSinceExposure) : null,
    };
  });
  return result;
}

// ---------------- master entry point ----------------
// Pure function — computes a fresh snapshot from current state, optionally smoothed against
// `priorSnapshot` (the most recent persisted snapshot, or null for a brand-new athlete). Does
// NOT persist anything itself — see the caller in App.jsx for when/how a snapshot gets saved.
export function computeAthleteRating(state, exMap, priorSnapshot = null) {
  const now = Date.now();

  const categories = {
    strength: computeStrengthCategory(state, exMap, now, priorSnapshot),
    consistency: computeConsistencyCategory(state, now, priorSnapshot),
    progression: computeProgressionCategory(state, exMap, now, priorSnapshot),
    recovery: computeRecoveryCategory(state, now, priorSnapshot),
    trainingQuality: computeTrainingQualityCategory(state, now, priorSnapshot),
    nutrition: computeNutritionCategory(state, now, priorSnapshot),
  };
  Object.keys(categories).forEach((key) => {
    const prior = priorSnapshot?.categories?.[key]?.score;
    categories[key].delta = categories[key].score != null && prior != null ? categories[key].score - prior : null;
  });

  const muscles = computeMuscleRatings(state, exMap, now, priorSnapshot);
  Object.keys(muscles).forEach((key) => {
    const prior = priorSnapshot?.muscles?.[key]?.score;
    muscles[key].delta = muscles[key].score != null && prior != null ? muscles[key].score - prior : null;
  });

  // ---- OVR ----
  // Minimum evidence bar before BRK shows ANY number at all (spec Test A/B): needs Consistency
  // (basically "has this athlete logged anything") plus at least 2 of the 3 hardest-to-fake core
  // categories. A single workout can qualify Consistency but rarely clears this bar alone.
  const hasConsistency = categories.consistency.score != null;
  const strongCoreCount = ["strength", "progression", "trainingQuality"].filter((k) => categories[k].score != null).length;
  const meetsOvrBar = hasConsistency && strongCoreCount >= 2;

  let ovr = null;
  let ovrConfidence = CONFIDENCE.INSUFFICIENT;
  if (meetsOvrBar) {
    let weightSum = 0;
    let scoreSum = 0;
    [...CORE_CATEGORIES, ...BONUS_CATEGORIES].forEach((key) => {
      if (categories[key].score == null) return;
      scoreSum += categories[key].score * CATEGORY_WEIGHTS[key];
      weightSum += CATEGORY_WEIGHTS[key];
    });
    const rawOvr = weightSum > 0 ? scoreSum / weightSum : null;
    if (rawOvr != null) {
      ovr = clamp(smooth(rawOvr, priorSnapshot?.ovr ?? null), 0, 100);
      const qualifiedCount = CORE_CATEGORIES.filter((k) => categories[k].score != null).length + BONUS_CATEGORIES.filter((k) => categories[k].score != null).length;
      ovrConfidence = qualifiedCount >= 5 ? CONFIDENCE.HIGH : qualifiedCount >= 3 ? CONFIDENCE.MODERATE : CONFIDENCE.LOW;
    }
  }

  const rank = ovr != null ? rankForOvr(ovr) : null;
  const ovrDelta = ovr != null && priorSnapshot?.ovr != null ? ovr - priorSnapshot.ovr : null;

  return { computedAt: new Date(now).toISOString(), ovr, ovrConfidence, ovrDelta, rank, categories, muscles };
}

// ---------------- Recent Progress feed ----------------
// The most recent genuinely-improved (increased_load/increased_reps) exercise exposures, one per
// exercise, newest first — built from the exact same matchExerciseEntry calls Progression uses,
// never a second interpretation of "did this get better." PRs are flagged inline (session.prs),
// not independently detected here.
export function recentProgressFeed(state, exMap, { limit = 10 } = {}) {
  const sessions = [...(state.workoutSessions || [])].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 15);
  const exGroup = exerciseGroupMap(exMap);
  const seen = new Set();
  const items = [];

  for (const session of sessions) {
    const sessionStartMs = new Date(session.startedAt || session.finishedAt).getTime();
    const priorLogsAll = (state.logs || []).filter((l) => new Date(l.date).getTime() < sessionStartMs);
    for (const entry of session.entries || []) {
      if (seen.has(entry.exId)) continue;
      const r = matchExerciseEntry(entry, priorLogsAll);
      if (r.status !== "increased_load" && r.status !== "increased_reps") continue;
      seen.add(entry.exId);
      const isPR = (session.prs || []).some((pr) => pr.exId === entry.exId);
      items.push({
        exId: entry.exId,
        name: exMap?.[entry.exId]?.name || entry.exId,
        message: r.message,
        isPR,
        date: session.finishedAt,
        group: exGroup[entry.exId] || null,
      });
      if (items.length >= limit) return items;
    }
  }
  return items;
}

// ---------------- muscle detail: top exercises ----------------
// "Lat Pulldown 185x8 -> 270x8" style lines for a muscle group's detail screen — one per
// exercise, its most recent comparable (same equipment) exposure vs the one before that. Reuses
// matchExerciseEntry's own priorTop/newTop rather than re-deriving a second interpretation of
// "comparable." Only legitimate matched comparisons are shown — a first-time or equipment-
// mismatched exercise is silently skipped here (never faked into a false before/after).
export function topExercisesForMuscle(state, exMap, group, { limit = 4 } = {}) {
  const exGroup = exerciseGroupMap(exMap);
  const exIdsInGroup = new Set(Object.entries(exGroup).filter(([, g]) => g === group).map(([id]) => id));
  if (exIdsInGroup.size === 0) return [];

  const sessions = [...(state.workoutSessions || [])].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 20);
  const seen = new Set();
  const items = [];

  for (const session of sessions) {
    const sessionStartMs = new Date(session.startedAt || session.finishedAt).getTime();
    const priorLogsAll = (state.logs || []).filter((l) => new Date(l.date).getTime() < sessionStartMs);
    for (const entry of session.entries || []) {
      if (!exIdsInGroup.has(entry.exId) || seen.has(entry.exId)) continue;
      const r = matchExerciseEntry(entry, priorLogsAll);
      if (!MATCHED_STATUSES.has(r.status) || !r.priorTop || !r.newTop) continue;
      seen.add(entry.exId);
      items.push({
        exId: entry.exId,
        name: exMap?.[entry.exId]?.name || entry.exId,
        from: `${r.priorTop.weight}×${r.priorTop.reps}`,
        to: `${r.newTop.weight}×${r.newTop.reps}`,
        status: r.status,
      });
      if (items.length >= limit) return items;
    }
  }
  return items;
}

// ---------------- plain-English "why this score" ----------------
// `?? 0` fallbacks throughout: a snapshot persisted by an OLDER version of this engine (before a
// field existed) must still render a sane sentence rather than "undefined" — rating HISTORY is
// kept forever (never recomputed retroactively), so this file has to stay backward-compatible
// with its own past output shapes.
export function explainCategory(key, data) {
  if (!data || data.score == null) return "Not enough comparable data yet.";
  const exercisesTracked = data.exercisesTracked ?? 0;
  const evidenceCount = data.evidenceCount ?? 0;
  const totalSets = data.totalSets ?? 0;
  switch (key) {
    case "strength":
      return `Based on estimated-strength trend across ${exercisesTracked} tracked exercise${exercisesTracked === 1 ? "" : "s"} over the last 90 days.`;
    case "consistency":
      return "Based on scheduled workout completion and training adherence.";
    case "progression":
      return `Based on ${evidenceCount} comparable exercise exposure${evidenceCount === 1 ? "" : "s"} (same exercise, same equipment) over the last 45 days.`;
    case "recovery":
      return `Based on ${evidenceCount} readiness check-in${evidenceCount === 1 ? "" : "s"} over the last 30 days.`;
    case "trainingQuality":
      return `Based on ${totalSets} working sets completed and set-quality flags over the last 30 days.`;
    case "nutrition":
      return `Based on ${evidenceCount} logged day${evidenceCount === 1 ? "" : "s"} of calorie/protein adherence over the last 14 days.`;
    default:
      return "";
  }
}
export function explainMuscle(group, data) {
  if (!data || data.score == null) return "Not enough comparable sessions for this group yet.";
  const label = MUSCLE_GROUP_LABEL[group] || group;
  const evidenceCount = data.evidenceCount ?? 0;
  const exercisesTracked = data.exercisesTracked ?? 0;
  return `Based on ${evidenceCount} comparable set${evidenceCount === 1 ? "" : "s"} across ${exercisesTracked} ${label.toLowerCase()} exercise${exercisesTracked === 1 ? "" : "s"} over the last 60 days.`;
}

// ---------------- recalculation + event detection ----------------
// Pure comparison between two consecutive snapshots — a genuine Level Up / Rank Up / first-
// rating-ready moment, or null when nothing celebration-worthy happened (including any OVR
// DECREASE — a drop never triggers a moment, only crossing upward does). Exported separately
// from recalcAthleteRatingState (below) because detecting the event from inside a setState
// updater is unreliable — updaters run asynchronously, so a value captured via a closure
// immediately after calling updateState is read before the updater has actually executed. The
// caller in App.jsx instead calls this from a useEffect watching athleteRatingSnapshots itself,
// which correctly sees the applied state.
export function detectRatingEvent(priorSnapshot, freshSnapshot) {
  if (!freshSnapshot || freshSnapshot.ovr == null) return null;
  if (!priorSnapshot || priorSnapshot.ovr == null) return { type: "first", snapshot: freshSnapshot };
  if (freshSnapshot.ovr <= priorSnapshot.ovr) return null;
  if (ranksDiffer(priorSnapshot.rank, freshSnapshot.rank)) {
    return { type: "rankup", fromOvr: priorSnapshot.ovr, toOvr: freshSnapshot.ovr, fromRank: priorSnapshot.rank, toRank: freshSnapshot.rank, snapshot: freshSnapshot, priorSnapshot };
  }
  return { type: "levelup", fromOvr: priorSnapshot.ovr, toOvr: freshSnapshot.ovr, snapshot: freshSnapshot, priorSnapshot };
}

// The ONE place a fresh snapshot gets appended to state. Called at workout completion/edit/
// delete (App.jsx) — never on every render. Returns only the updated state; see
// detectRatingEvent above for how the caller separately decides whether to show a celebration
// for this new snapshot (e.g. a quiet historical edit in the Log tab applies the new snapshot
// but never surfaces a popup for it).
export function recalcAthleteRatingState(prevState, exMap) {
  const priorSnapshots = prevState.athleteRatingSnapshots || [];
  const priorSnapshot = priorSnapshots[priorSnapshots.length - 1] || null;
  const fresh = { id: `rating_${Date.now()}`, ...computeAthleteRating(prevState, exMap, priorSnapshot) };
  return { ...prevState, athleteRatingSnapshots: [...priorSnapshots, fresh] };
}
