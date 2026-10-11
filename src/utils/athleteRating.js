// ---------------- ATHLETE RATING ENGINE (v2 — Lifting Foundation + Earned Bonus) ----------------
// The ONE place BRK computes OVR, rank, the lifting foundation, bonus points, and muscle-group
// ratings. No UI component calculates any of this independently — every screen reads a computed
// snapshot. This file only READS canonical state (logs, workoutSessions, readinessLogs,
// nutritionTargets/foodLogs, weeklySchedule) — nothing here is a second copy of that data, and
// nothing here mutates it.
//
// ---- v1 -> v2: what changed and why (see the final report for the full diagnosis) ----
// v1 required `hasConsistency && qualifiedCoreCount >= 1` just to show ANY number — and
// Consistency itself only ever looked at the trailing 28 days of activity. An athlete with months
// of real lifting history but nothing logged in the last 4 weeks got `evidenceCount: 0` from
// Consistency and was permanently stuck on "Establishing baseline," regardless of how much
// history existed. Separately, v1's Strength category was a 90-day-window %-change-from-start
// score, so an athlete who held their performance steady (0% change) scored a mediocre 50, and a
// small dip scored WORSE than that — "maintaining" read as "failing." And `recalcAthleteRatingState`
// was only ever called from finishRun/log-edit/log-delete — a returning user whose history
// arrived via Supabase pull, a restored backup, or simply a fresh install reading old localStorage
// never got a snapshot computed AT ALL until they finished a brand-new workout, so their very
// real existing history was invisible to the UI.
//
// v2's fix, in one sentence: VALID LIFTING HISTORY IS SUFFICIENT TO ESTABLISH A RATING. OVR is
// now Lifting Foundation (0-100, derived purely from actual logged working-set performance,
// evaluated against the ATHLETE'S OWN historical best — never a 90-day-only window, never gated
// on Consistency/Nutrition/Recovery/Training Quality) plus a small Earned Bonus (0-10, from those
// four categories, which ADD a modest advantage but are never required). App.jsx additionally
// gained a one-time bootstrap recompute on load/hydration so existing history gets a snapshot
// immediately, never waiting on a new workout.
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

// Bumped whenever the scoring FORMULA changes (not when evidence changes) — every snapshot
// records the version that produced it. A snapshot from an older version is never smoothed
// against, never blended into a trend delta, and never used to detect a level-up/rank-up — see
// `computeAthleteRating`'s `safePrior` and `detectRatingEvent` below (Part 11: "do not silently
// mix old-formula OVR values with new-formula OVR values... do not trigger a fake level-up or
// rank-up simply because the scoring formula changed").
export const RATING_SCHEMA_VERSION = 2;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
// Same Epley formula used elsewhere in BRK (dataWorkbook.js, weeklyReview.js, App.jsx's local
// detectPRs) — duplicated here rather than imported, matching this codebase's own established
// pattern for this one-line formula rather than introducing a new shared dependency for it.
function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}
// Defensive de-dupe by id — a sync merge or a double-save should never let the same log/session
// count as two pieces of evidence (Part 7: "a user must not gain bonus points by... creating
// duplicate workout records").
function dedupeById(items) {
  const seen = new Set();
  const out = [];
  (items || []).forEach((item) => {
    if (!item || item.id == null || seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  });
  return out;
}
function safeDateMs(dateLike) {
  const t = new Date(dateLike).getTime();
  return Number.isFinite(t) ? t : null;
}

// Blends a freshly computed score against the athlete's last DISPLAYED score for that same
// signal (70% prior / 30% new) — the volatility control: a rolling-window computation already
// resists single-session noise, and this adds a second layer so one PR can't jump a score double
// digits and one bad session can't collapse it. The very first score ever computed (no prior, or
// a prior from a different scoring version — see RATING_SCHEMA_VERSION) is shown as-is.
function smooth(newScore, priorScore) {
  if (priorScore == null) return newScore;
  return 0.7 * priorScore + 0.3 * newScore;
}

// ---------------- TUNABLE CONFIG ----------------
// Every bonus cap and evidence threshold lives here, named and documented, so these can be
// validated/retuned without hunting through the scoring functions themselves (task: "these values
// are initial design parameters and should be centralized for tuning"). Nothing outside this file
// should need to know these numbers — read snapshot.foundation/.bonuses instead.
export const RATING_CONFIG = {
  // Lifting Foundation (0-100) — see computeLiftingFoundation.
  FOUNDATION_NEUTRAL_START: 50, // Part 5's "clearly defined neutral starting point" for an
  // athlete with real completed workouts but no comparable (same exercise+equipment, 2+
  // exposures) pair yet to measure against — never fabricated, just the scale's honest midpoint.
  FOUNDATION_MIN_SCORE: 20, // floor for a qualifying exercise even far below its own peak —
  // a real decline still reads as evidence of training, never collapses toward 0.
  FOUNDATION_ESTABLISHED_MIN_BUCKETS: 2, // distinct comparable exercises needed for "established"
  FOUNDATION_ESTABLISHED_MIN_EXPOSURES: 6, // total comparable exposures needed for "established"
  FOUNDATION_RECENT_POINTS: 3, // how many of the most-recent comparable exposures are averaged
  // into "current" capability (smooths one fluke session without hiding genuine recent change).
  // Earned Bonus caps — sum of these four is the hard ceiling (Part 6: "total maximum: +10").
  BONUS_MAX: { consistency: 5, trainingQuality: 2, recovery: 1, nutrition: 2 },
  BONUS_TOTAL_MAX: 10,
  // Minimum evidence before ANY Training Quality bonus is even considered — explicitly guards
  // against "no pain/form flags entered" reading as "clean training" by default (Part 6: "do not
  // award automatic Training Quality points simply because no pain/form flags were entered").
  TRAINING_QUALITY_MIN_SETS: 12,
  RECOVERY_MIN_CHECKINS: 3,
  NUTRITION_MIN_LOGGED_DAYS: 3,
};
const C = RATING_CONFIG;

// ---------------- Rank thresholds ----------------
// 6 ranks, evenly dividing 0-100 (~16-17 points each), each split into 3 sub-levels (~5-6 points
// each). III is the entry sub-level of a rank, I is the exit sub-level right before the next
// rank — e.g. "Forged III" -> "Forged II" -> "Forged I" -> "Relentless III".
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
// Calves split already exists as a derived signal — getMuscleDisplay() (used today to pick which
// anatomy-diagram zone lights up) refines the broad category using the exercise's own NAME.
// Reusing it here (rather than inventing a second taxonomy) means muscle ratings and the anatomy
// diagram can never disagree about which zone an exercise belongs to.
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

// ---------------- LIFTING FOUNDATION (0-100) ----------------
// The core of OVR (Part 3/4). Evidence: the counted (non-warmup) TOP set of each log entry — one
// representative value per (date, exercise, equipment-bucket) exposure, exactly like v1's
// Strength category used, which already correctly excludes warm-up inflation (topSetOf/
// countedSets never read a set's `.drops` sub-array, so drop-set/myo-rep/rest-pause CONTINUATION
// sets, which are always sub-maximal, can never out-weigh the real top set) — see
// workoutSets.js/progression.js. Reuses BRK's existing e1RM math (estimateOneRM) rather than
// inventing a second one.
//
// Unlike v1, this reads ALL-TIME logs — no 90-day cutoff — so an existing athlete's real history
// is usable immediately (Part 5: "process historical workouts chronologically... do not force
// existing users to log several new workouts"). And unlike v1's "% change since the start of the
// window" (which scored a flat, well-maintained athlete as mediocre and a slight dip as bad),
// this scores CURRENT capability relative to the athlete's OWN best-ever comparable performance
// for that exercise+equipment — holding at or near your lifetime peak scores HIGH, not "no
// change = 50" (Part 4's explicit "maintaining established performance should not automatically
// mean a bad rating... separate current rating from short-term progression trend"). This is
// deliberately self-relative, never population-relative — BRK never claims to know where an
// athlete stands against other lifters or any scientific strength norm.
function computeLiftingFoundation(state, exMap, now, safePrior) {
  const seenLogIds = new Set();
  const buckets = new Map(); // "exId::equipmentBucket" -> [{date, e1rm}]
  let totalValidLogs = 0;

  (state.logs || []).forEach((l) => {
    if (!l || l.id == null || seenLogIds.has(l.id)) return; // de-dupe (Part 7)
    if (l.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT) return; // travel/one-off gear never
    // rewrites a home-equipment bucket's history (same rule v1 used).
    const dateMs = safeDateMs(l.date);
    if (dateMs == null) return; // malformed/legacy date guard
    const top = topSetOf(l.sets || []);
    if (!top || !(top.weight > 0) || !(top.reps > 0)) return;
    seenLogIds.add(l.id);
    totalValidLogs++;
    const key = `${l.exId}::${l.equipmentProfileId || "default"}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ date: dateMs, e1rm: estimateOneRM(top.weight, top.reps) });
  });

  if (totalValidLogs === 0) {
    return { score: null, tier: "none", confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0, exercisesTracked: 0 };
  }

  const exercisesTracked = buckets.size; // breadth, shown even before a bucket can support a ratio

  let weightedSum = 0;
  let totalWeight = 0;
  let qualifyingBuckets = 0;
  let qualifyingExposures = 0;

  buckets.forEach((points) => {
    if (points.length < 2) return; // nothing to compare a single exposure against yet
    points.sort((a, b) => a.date - b.date);
    const peak = points.reduce((m, p) => Math.max(m, p.e1rm), 0);
    if (peak <= 0) return;
    // Averaging the last few points smooths one fluke session once there's real depth to smooth
    // across — but with FEWER points than that window, averaging in an older, lower exposure can
    // perversely DROP the score the moment the athlete sets a brand-new, heavier PR (the new
    // point becomes the peak, while the stale older point pulls "current" below it) — a bigger
    // lift must never score worse. Below the window size, "current" is simply the latest point.
    const current =
      points.length >= C.FOUNDATION_RECENT_POINTS
        ? points.slice(-C.FOUNDATION_RECENT_POINTS).reduce((s, p) => s + p.e1rm, 0) / C.FOUNDATION_RECENT_POINTS
        : points[points.length - 1].e1rm;
    const ratio = clamp(current / peak, 0, 1);
    // ratio 1.0 (at/above lifetime best right now) -> 100; ratio 0 -> FOUNDATION_MIN_SCORE. Self-
    // relative only — see the file banner above.
    const exerciseScore = clamp(C.FOUNDATION_MIN_SCORE + ratio * (100 - C.FOUNDATION_MIN_SCORE), C.FOUNDATION_MIN_SCORE, 100);
    const w = Math.min(points.length, 6); // diminishing returns — one obsessively-logged lift
    // can't single-handedly dominate the average.
    weightedSum += exerciseScore * w;
    totalWeight += w;
    qualifyingBuckets++;
    qualifyingExposures += points.length;
  });

  const priorFoundationScore = safePrior?.foundation?.score ?? null;

  if (qualifyingBuckets === 0) {
    // Real completed lifting history exists, but every exercise has only ever been logged once —
    // nothing comparable to measure a ratio against. Part 5's neutral starting point, never a
    // fabricated comparison.
    const score = clamp(Math.round(smooth(C.FOUNDATION_NEUTRAL_START, priorFoundationScore)), 0, 100);
    return { score, tier: "provisional", confidence: CONFIDENCE.LOW, evidenceCount: totalValidLogs, exercisesTracked, atNeutralStart: true };
  }

  const rawScore = weightedSum / totalWeight;
  const score = clamp(Math.round(smooth(rawScore, priorFoundationScore)), 0, 100);
  const tier =
    qualifyingBuckets >= C.FOUNDATION_ESTABLISHED_MIN_BUCKETS && qualifyingExposures >= C.FOUNDATION_ESTABLISHED_MIN_EXPOSURES
      ? "established"
      : "provisional";

  let confidence = CONFIDENCE.LOW;
  if (qualifyingBuckets >= 3 && qualifyingExposures >= 9) confidence = CONFIDENCE.HIGH;
  else if (qualifyingBuckets >= 2 && qualifyingExposures >= 5) confidence = CONFIDENCE.MODERATE;

  return { score, tier, confidence, evidenceCount: qualifyingExposures, exercisesTracked };
}

// ---------------- EARNED BONUS (0-10 total) ----------------
// Part 6/7: small, bounded, EARNED — never required, never farmable. Each function below mirrors
// one rule: missing/insufficient data returns points: 0 (never a penalty to Foundation, never a
// fabricated score), and every input is either day-deduplicated or session/log-id-deduplicated so
// repeating the same check-in or re-saving the same workout cannot inflate evidence.

// Consistency (up to +5) — "planned workouts completed," not raw gym-day count (Part 6): uses
// BRK's existing Weekly Schedule adherence ratio when a schedule exists (blended 28d/7d window),
// falling back to the generic goal-based adherence ratio otherwise. Same two-path source v1 used,
// just rescaled from a 0-100 category score into a 0-5 point bonus.
function computeConsistencyBonus(state, now, safePrior) {
  let overall = null;
  let evidenceCount = 0;
  if (hasSchedule(state)) {
    const a28 = computeScheduleAdherence(state, 28);
    const a7 = computeScheduleAdherence(state, 7);
    if (a28 && a28.overall != null) {
      overall = a7 && a7.overall != null ? 0.6 * a28.overall + 0.4 * a7.overall : a28.overall;
      evidenceCount = (a28.lifting?.scheduled || 0) + (a28.conditioning?.scheduled || 0) + (a28.recovery?.scheduled || 0);
    }
  } else {
    const a28 = computeAdherence(state, 28);
    overall = a28.overall;
    evidenceCount = a28.strengthDays || 0;
  }
  const max = C.BONUS_MAX.consistency;
  if (overall == null || evidenceCount === 0) {
    return { points: 0, max, earned: false, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0 };
  }
  const prior = safePrior?.bonuses?.consistency?.points ?? null;
  const rawPoints = (clamp(overall, 0, 100) / 100) * max;
  const points = clamp(Math.round(smooth(rawPoints, prior)), 0, max);
  let confidence = CONFIDENCE.LOW;
  if (evidenceCount >= 8) confidence = CONFIDENCE.HIGH;
  else if (evidenceCount >= 4) confidence = CONFIDENCE.MODERATE;
  return { points, max, earned: points > 0, confidence, evidenceCount, adherencePct: Math.round(overall) };
}

// Training Quality (up to +2) — rewards a LOW rate of pain/form-breakdown/grind flags across a
// real minimum volume of logged sets. The minimum-sets floor is the load-bearing anti-farming
// rule here: Part 6 explicitly forbids awarding this "simply because no pain/form flags were
// entered" — silence from a handful of sets is not evidence of quality, so below
// TRAINING_QUALITY_MIN_SETS this returns unearned regardless of how clean those few sets were.
function computeTrainingQualityBonus(state, now, safePrior) {
  const WINDOW_DAYS = 30;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const sessions = dedupeById(state.workoutSessions || []).filter((s) => {
    const t = safeDateMs(s.finishedAt);
    return t != null && t >= cutoff;
  });
  let totalSets = 0,
    painCount = 0,
    formBreakdownCount = 0,
    grindCount = 0;
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
  const max = C.BONUS_MAX.trainingQuality;
  if (totalSets < C.TRAINING_QUALITY_MIN_SETS) {
    return { points: 0, max, earned: false, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: totalSets, totalSets };
  }
  const concernWeight = painCount * 1.0 + formBreakdownCount * 0.6 + grindCount * 0.2;
  const cleanFraction = clamp(1 - concernWeight / totalSets, 0, 1);
  const prior = safePrior?.bonuses?.trainingQuality?.points ?? null;
  const points = clamp(Math.round(smooth(cleanFraction * max, prior)), 0, max);
  const confidence = sessions.length >= 8 ? CONFIDENCE.HIGH : sessions.length >= 4 ? CONFIDENCE.MODERATE : CONFIDENCE.LOW;
  return { points, max, earned: points > 0, confidence, evidenceCount: sessions.length, totalSets, painCount, formBreakdownCount, grindCount };
}

// Recovery / Readiness (up to +1) — day-deduplicated (latest check-in wins) so logging the same
// day's readiness multiple times can't multiply evidence (Part 7).
function computeRecoveryBonus(state, now, safePrior) {
  const WINDOW_DAYS = 30;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const byDay = new Map();
  (state.readinessLogs || []).forEach((r) => {
    const t = safeDateMs(r?.date);
    if (t == null || t < cutoff) return;
    const dayKey = new Date(t).toISOString().slice(0, 10);
    const existing = byDay.get(dayKey);
    if (!existing || t > existing.t) byDay.set(dayKey, { t, r });
  });
  const scores = [...byDay.values()].map(({ r }) => computeReadinessScore(r)).filter((s) => s != null);
  const max = C.BONUS_MAX.recovery;
  if (scores.length < C.RECOVERY_MIN_CHECKINS) {
    return { points: 0, max, earned: false, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: scores.length };
  }
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const prior = safePrior?.bonuses?.recovery?.points ?? null;
  const points = clamp(Math.round(smooth((clamp(avg, 0, 100) / 100) * max, prior)), 0, max);
  const confidence = scores.length >= 10 ? CONFIDENCE.HIGH : scores.length >= 6 ? CONFIDENCE.MODERATE : CONFIDENCE.LOW;
  return { points, max, earned: points > 0, confidence, evidenceCount: scores.length, avgReadiness: Math.round(avg) };
}

// Nutrition (up to +2) — only ever reads BRK's existing calorie/protein-band adherence
// (nutritionAdherence.js, itself day-based — "loggedDays") — no new tracking invented here.
function computeNutritionBonus(state, safePrior) {
  const max = C.BONUS_MAX.nutrition;
  if (!state.nutritionTargets) {
    return { points: 0, max, earned: false, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0 };
  }
  const adherence = rollingNutritionAdherence(state, 14);
  if (adherence.pct == null || adherence.loggedDays < C.NUTRITION_MIN_LOGGED_DAYS) {
    return { points: 0, max, earned: false, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: adherence.loggedDays || 0 };
  }
  const prior = safePrior?.bonuses?.nutrition?.points ?? null;
  const points = clamp(Math.round(smooth((clamp(adherence.pct, 0, 100) / 100) * max, prior)), 0, max);
  const confidence = adherence.loggedDays >= 10 ? CONFIDENCE.HIGH : adherence.loggedDays >= 6 ? CONFIDENCE.MODERATE : CONFIDENCE.LOW;
  return { points, max, earned: points > 0, confidence, evidenceCount: adherence.loggedDays };
}

// ---------------- PROGRESSION TREND (informational — NOT part of OVR) ----------------
// Part 3/4: "separate current game rating from short-term progression trend." This is that
// separate signal — unchanged from v1's Progression category except that it no longer feeds OVR.
// Reuses BRK's canonical comparison engine (sessionComparison.js's matchExerciseEntry) directly —
// the same function Workout Recap, Full Recap, and Coach already call (Part 4: "do not create a
// competing progression engine") — scoring the mix of increased_load/increased_reps/matched/
// declined outcomes across matched exposures in the last 45 days. Total workout volume/tonnage is
// never read here.
function computeProgressionTrend(state, exMap, now, safePrior) {
  const WINDOW_DAYS = 45;
  const cutoff = now - WINDOW_DAYS * MS_DAY;
  const recentSessions = dedupeById(state.workoutSessions || [])
    .filter((s) => {
      const t = safeDateMs(s.finishedAt);
      return t != null && t >= cutoff;
    })
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
  const weighted = improved * 1.0 + counts.matched * 0.55;
  const rawScore = clamp(Math.round((weighted / total) * 100), 0, 100);

  let confidence = CONFIDENCE.LOW;
  if (total >= 10) confidence = CONFIDENCE.HIGH;
  else if (total >= 6) confidence = CONFIDENCE.MODERATE;

  const score = Math.round(smooth(rawScore, safePrior?.progressionTrend?.score ?? null));
  return { score, confidence, evidenceCount: total, breakdown: counts };
}

// ---------------- MUSCLE-GROUP RATINGS ----------------
// Same matched-exposure WIN/HOLD/DECLINE scoring as Progression Trend, scoped per muscle group —
// unlike v1, no hard time-window CUTOFF excludes older sessions entirely (Part 10: "avoid
// indefinite Calibrating where legitimate historical training exists"); recency instead only
// affects CONFIDENCE (a group untouched for 45+ days is downgraded back toward "low confidence"
// rather than holding a stale high score forever — it still SHOWS the last score). A group with
// exactly one comparable exposure is PROVISIONAL rather than "establishing baseline" (Part 10).
// Never requires Consistency/Nutrition/Recovery — purely lifting evidence, same as Foundation.
function computeMuscleRatings(state, exMap, now, safePrior) {
  const exGroup = exerciseGroupMap(exMap);
  const recentSessions = dedupeById(state.workoutSessions || []).sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));

  const byGroup = {};
  MUSCLE_GROUPS.forEach((g) => (byGroup[g] = { statuses: [], lastExposureMs: 0, exercisesSeen: new Set() }));

  recentSessions.forEach((session) => {
    const sessionStartMs = new Date(session.startedAt || session.finishedAt).getTime();
    const priorLogsAll = (state.logs || []).filter((l) => new Date(l.date).getTime() < sessionStartMs);
    const finishedMs = safeDateMs(session.finishedAt);
    if (finishedMs == null) return;
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
    if (total === 0) {
      result[group] = { score: null, tier: "none", confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0, exercisesTracked: exercisesSeen.size };
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

    const score = Math.round(smooth(rawScore, safePrior?.muscles?.[group]?.score ?? null));
    result[group] = {
      score,
      tier: total < 3 ? "provisional" : "established",
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
// `priorSnapshot` (the most recent persisted snapshot, or null for a brand-new athlete). Does NOT
// persist anything itself — see the caller in App.jsx for when/how a snapshot gets saved.
export function computeAthleteRating(state, exMap, priorSnapshot = null) {
  const now = Date.now();
  // A prior snapshot computed under a DIFFERENT scoring version is treated as if it doesn't
  // exist — never smoothed against, never diffed for a delta (Part 11). This is the one place
  // that decision is made; every function below just takes `safePrior` and never has to know
  // about versioning itself.
  const safePrior = priorSnapshot && priorSnapshot.scoringVersion === RATING_SCHEMA_VERSION ? priorSnapshot : null;

  const foundation = computeLiftingFoundation(state, exMap, now, safePrior);
  const bonuses = {
    consistency: computeConsistencyBonus(state, now, safePrior),
    trainingQuality: computeTrainingQualityBonus(state, now, safePrior),
    recovery: computeRecoveryBonus(state, now, safePrior),
    nutrition: computeNutritionBonus(state, safePrior),
  };
  const bonusTotal = clamp(
    Object.values(bonuses).reduce((s, b) => s + (b.points || 0), 0),
    0,
    C.BONUS_TOTAL_MAX
  );

  const progressionTrend = computeProgressionTrend(state, exMap, now, safePrior);

  const muscles = computeMuscleRatings(state, exMap, now, safePrior);
  Object.keys(muscles).forEach((key) => {
    const prior = safePrior?.muscles?.[key]?.score;
    muscles[key].delta = muscles[key].score != null && prior != null ? muscles[key].score - prior : null;
  });

  // ---- OVR = Lifting Foundation + Earned Bonus ----
  // Foundation alone decides whether OVR exists at all and which tier it's in — Consistency,
  // Training Quality, Recovery, and Nutrition can only ever ADD points on top, never gate it
  // (Part 3: "an athlete who logs legitimate lifts gets a rating; everything else helps them
  // build on it"). Bonus is capped before it's added, so it can never overwhelm genuine lifting
  // performance (Part 3: "the bonus must never overwhelm genuine lifting performance").
  let ovr = null;
  let ovrTier = "establishing_baseline";
  if (foundation.score != null) {
    ovr = clamp(Math.round(foundation.score + bonusTotal), 0, 100);
    ovrTier = foundation.tier; // "provisional" | "established"
  }
  foundation.delta = foundation.score != null && safePrior?.foundation?.score != null ? foundation.score - safePrior.foundation.score : null;
  Object.keys(bonuses).forEach((key) => {
    const prior = safePrior?.bonuses?.[key]?.points;
    bonuses[key].delta = bonuses[key].points != null && prior != null ? bonuses[key].points - prior : null;
  });

  // Rank is visible whenever OVR exists — PROVISIONAL included (Part 8: "do not show rank as
  // Calibrating when the athlete has a valid provisional or established OVR"). This is a
  // deliberate change from v1, which withheld Rank entirely during Provisional.
  const rank = ovr != null ? rankForOvr(ovr) : null;
  const ovrDelta = ovr != null && safePrior?.ovr != null ? ovr - safePrior.ovr : null;

  return {
    computedAt: new Date(now).toISOString(),
    scoringVersion: RATING_SCHEMA_VERSION,
    ovr,
    ovrTier,
    ovrDelta,
    rank,
    foundation,
    bonuses,
    bonusTotal,
    progressionTrend,
    muscles,
  };
}

// ---------------- Recent Progress feed ----------------
// The most recent genuinely-improved (increased_load/increased_reps) exercise exposures, one per
// exercise, newest first — built from the exact same matchExerciseEntry calls Progression Trend
// uses, never a second interpretation of "did this get better." PRs are flagged inline
// (session.prs), not independently detected here. Unchanged by the v2 rewrite.
export function recentProgressFeed(state, exMap, { limit = 10 } = {}) {
  const sessions = dedupeById(state.workoutSessions || [])
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 15);
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
// "comparable." Only legitimate matched comparisons are shown. Unchanged by the v2 rewrite.
export function topExercisesForMuscle(state, exMap, group, { limit = 4 } = {}) {
  const exGroup = exerciseGroupMap(exMap);
  const exIdsInGroup = new Set(Object.entries(exGroup).filter(([, g]) => g === group).map(([id]) => id));
  if (exIdsInGroup.size === 0) return [];

  const sessions = dedupeById(state.workoutSessions || [])
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, 20);
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
export function explainFoundation(data) {
  if (!data || data.score == null) return "Log a completed workout to establish your Lifting Foundation.";
  if (data.atNeutralStart) {
    return "A neutral starting point — BRK doesn't have a second comparable exposure on any exercise yet to measure current vs. your best.";
  }
  const exercisesTracked = data.exercisesTracked ?? 0;
  return `Based on your current top-set performance vs. your own best-ever comparable lift, across ${exercisesTracked} tracked exercise${
    exercisesTracked === 1 ? "" : "s"
  }.`;
}
const BONUS_EXPLAIN = {
  consistency: (d) => (d.earned ? "Based on planned workouts actually completed." : "Set up a training schedule and complete it to earn this."),
  trainingQuality: (d) =>
    d.earned || d.evidenceCount > 0
      ? `Based on ${d.totalSets ?? 0} working sets logged with a low rate of pain/form/grind flags.`
      : "Log more working sets to earn this — a few clean sets alone isn't enough evidence.",
  recovery: (d) => (d.earned ? `Based on ${d.evidenceCount} daily readiness check-ins.` : "Log at least 3 readiness check-ins to earn this."),
  nutrition: (d) => (d.earned ? `Based on ${d.evidenceCount} logged days of calorie/protein adherence.` : "Log at least 3 days of nutrition to earn this."),
};
export function explainBonus(key, data) {
  if (!data) return "Not logged.";
  if (data.confidence === CONFIDENCE.INSUFFICIENT && !data.earned) return "Not logged.";
  return (BONUS_EXPLAIN[key] || (() => ""))(data);
}
export function explainMuscle(group, data) {
  if (!data || data.score == null) return "Not enough comparable sessions for this group yet.";
  const label = MUSCLE_GROUP_LABEL[group] || group;
  const evidenceCount = data.evidenceCount ?? 0;
  const exercisesTracked = data.exercisesTracked ?? 0;
  const recency = data.daysSinceExposure != null && data.daysSinceExposure > 45 ? " — training data a while back, shown at lower confidence." : "";
  return `Based on ${evidenceCount} comparable set${evidenceCount === 1 ? "" : "s"} across ${exercisesTracked} ${label.toLowerCase()} exercise${
    exercisesTracked === 1 ? "" : "s"
  }.${recency}`;
}

// ---------------- recalculation + event detection ----------------
// Pure comparison between two consecutive snapshots — a genuine Level Up / Rank Up / first-
// rating-ready moment, or null when nothing celebration-worthy happened (including any OVR
// DECREASE, and ANY scoring-model version change — Part 11: a formula change must never itself
// read as athlete progress, whether that's the very first v2 snapshot after a long v1 history
// (not a "first rating" moment — they already had one) or a v2-to-v2 comparison, the only case
// allowed to celebrate). Exported separately from recalcAthleteRatingState because detecting the
// event from inside a setState updater is unreliable — updaters run asynchronously, so a value
// captured via a closure immediately after calling updateState is read before the updater has
// actually executed. The caller in App.jsx instead calls this from a useEffect watching
// athleteRatingSnapshots itself, which correctly sees the applied state.
export function detectRatingEvent(priorSnapshot, freshSnapshot) {
  if (!freshSnapshot || freshSnapshot.ovr == null) return null;
  if (!priorSnapshot || priorSnapshot.scoringVersion !== freshSnapshot.scoringVersion) {
    return priorSnapshot ? null : { type: "first", snapshot: freshSnapshot };
  }
  if (priorSnapshot.ovr == null) return { type: "first", snapshot: freshSnapshot };
  if (freshSnapshot.ovr <= priorSnapshot.ovr) return null;
  if (ranksDiffer(priorSnapshot.rank, freshSnapshot.rank)) {
    return {
      type: "rankup",
      fromOvr: priorSnapshot.ovr,
      toOvr: freshSnapshot.ovr,
      fromRank: priorSnapshot.rank,
      toRank: freshSnapshot.rank,
      snapshot: freshSnapshot,
      priorSnapshot,
    };
  }
  return { type: "levelup", fromOvr: priorSnapshot.ovr, toOvr: freshSnapshot.ovr, snapshot: freshSnapshot, priorSnapshot };
}

// The ONE place a fresh snapshot gets appended to state. Called at workout completion/edit/
// delete (App.jsx), and once by App.jsx's load/hydration bootstrap effect for an athlete whose
// history predates this snapshot (never shown as a celebration — see that effect's own comment).
// Returns only the updated state; see detectRatingEvent above for how the caller separately
// decides whether to show a celebration for this new snapshot.
export function recalcAthleteRatingState(prevState, exMap) {
  const priorSnapshots = prevState.athleteRatingSnapshots || [];
  const priorSnapshot = priorSnapshots[priorSnapshots.length - 1] || null;
  const fresh = { id: `rating_${Date.now()}`, ...computeAthleteRating(prevState, exMap, priorSnapshot) };
  return { ...prevState, athleteRatingSnapshots: [...priorSnapshots, fresh] };
}
