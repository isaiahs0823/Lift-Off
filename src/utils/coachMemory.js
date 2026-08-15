// ---------------- COACH MEMORY (Layer 3 detectors) ----------------
// Factual pattern detection from actually-logged behavior only — nothing here is invented or
// inferred beyond what the data directly shows. Each detector requires a minimum sample size
// before it's willing to claim a pattern exists, and returns nothing rather than guess when
// the data's too thin. detectCoachMemory() itself is the original ephemeral "what's true right
// now" read (used directly by coachContext for immediate answers); syncCoachMemory() is the
// newer persistence layer on top of it — see its own comment below.

import { upsertObservedMemory, decayMemory } from "./coachMemoryStore.js";
import { repeatedScheduleMiss } from "./weeklySchedule.js";
import { detectNutritionMemory, NUTRITION_DETECTOR_KEYS } from "./nutritionMemory.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);
}
function isWarmup(s) {
  return s.setType === "warmup";
}

// The spec's flagship example: does conditioning work consistently disappear right after a
// heavy lower-body session? Only claims the pattern once there are at least 3 leg sessions to
// judge from, and only when it holds for a clear majority of them. Deliberately windowed to
// the most recent 6 leg sessions (not all-time) so the pattern can actually resolve once
// behavior changes — section 16/scenario E: six clean weeks should stop counting against a
// habit from months ago.
const LEG_DAY_WINDOW = 6;
function legDayConditioningSkip(state) {
  const legSessions = [...(state.workoutSessions || [])]
    .filter((s) => (s.mainMuscles || []).includes("Legs"))
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, LEG_DAY_WINDOW);
  if (legSessions.length < 3) return null;
  const cardioDates = (state.cardioLogs || []).map((c) => c.date);
  let skipped = 0;
  legSessions.forEach((s) => {
    const hasFollowupCardio = cardioDates.some((cd) => {
      const gap = daysBetween(s.finishedAt, cd);
      return gap >= 0 && gap <= 2;
    });
    if (!hasFollowupCardio) skipped++;
  });
  const ratio = skipped / legSessions.length;
  if (ratio < 0.7) return null;
  return {
    key: "leg_day_conditioning_skip",
    text: `Conditioning has been missing after leg day in ${skipped} of your last ${legSessions.length} leg sessions.`,
    tags: ["conditioning", "cardio", "legs", "lower_body"],
  };
}

// Exercises where the last 3 sessions are all at the same top-set weight with target reps
// missed every time — a real plateau, not just one rough day.
function stallingExercises(state) {
  const byEx = {};
  (state.logs || []).forEach((l) => {
    (byEx[l.exId] ||= []).push(l);
  });
  const stalled = [];
  Object.entries(byEx).forEach(([exId, logs]) => {
    const sorted = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
    if (sorted.length < 3) return;
    const topWeights = sorted.map((l) => {
      const counted = l.sets.filter((s) => !isWarmup(s));
      return (counted.length ? counted : l.sets)[0];
    });
    const sameWeight = topWeights.every((s) => s.weight === topWeights[0].weight);
    const allMissed = sorted.every((l, i) => {
      const counted = l.sets.filter((s) => !isWarmup(s));
      return !(counted.length ? counted : l.sets).every((s) => s.reps >= l.targetReps);
    });
    if (sameWeight && allMissed) stalled.push({ exId, weight: topWeights[0].weight });
  });
  return stalled;
}

// Weekly rate of change near zero for two consecutive trailing weeks — a real plateau, not
// this week's noise.
function bodyweightPlateau(state) {
  const entries = state.bodyweightLogs || [];
  const weekAgo = new Date(Date.now() - 7 * MS_PER_DAY);
  const avgWindow = (days, asOf) => {
    const end = asOf.getTime();
    const start = end - days * MS_PER_DAY;
    const w = entries.filter((e) => e.weight != null && new Date(e.date).getTime() >= start && new Date(e.date).getTime() <= end);
    if (!w.length) return null;
    return w.reduce((s, e) => s + e.weight, 0) / w.length;
  };
  const now = new Date();
  const twoWeeksAgo = new Date(weekAgo.getTime() - 7 * MS_PER_DAY);
  const thisWeekAvg = avgWindow(7, now);
  const priorWeekAvg = avgWindow(7, weekAgo);
  const twoWeeksAgoAvg = avgWindow(7, twoWeeksAgo);
  // `null - null` coerces to 0 in JS, not NaN — without an explicit null check here, zero
  // logged bodyweight entries reads as a rate of exactly 0 and falsely claims a plateau.
  if (thisWeekAvg == null || priorWeekAvg == null || twoWeeksAgoAvg == null) return null;
  const thisWeekRate = thisWeekAvg - priorWeekAvg;
  const lastWeekRate = priorWeekAvg - twoWeeksAgoAvg;
  if (Math.abs(thisWeekRate) < 0.25 && Math.abs(lastWeekRate) < 0.25) {
    return { key: "bodyweight_plateau", text: "Bodyweight has been flat for two straight weeks.", tags: ["bodyweight", "weight", "plateau"] };
  }
  return null;
}

// Soreness rated 4-5 in a clear majority of the last 7 check-ins.
function recurringSoreness(state) {
  const recent = (state.readinessLogs || [])
    .filter((r) => new Date(r.date).getTime() >= Date.now() - 7 * MS_PER_DAY)
    .filter((r) => r.soreness != null);
  if (recent.length < 4) return null;
  const soreCount = recent.filter((r) => r.soreness >= 4).length;
  if (soreCount / recent.length < 0.6) return null;
  return {
    key: "recurring_soreness",
    text: `Soreness has been rated high in ${soreCount} of your last ${recent.length} check-ins.`,
    tags: ["soreness", "recovery", "readiness"],
  };
}

// Returns a small list of { key, text } facts — never more than a handful, never speculative.
export function detectCoachMemory(state) {
  const memory = [];
  const legSkip = legDayConditioningSkip(state);
  if (legSkip) memory.push(legSkip);
  const plateau = bodyweightPlateau(state);
  if (plateau) memory.push(plateau);
  const soreness = recurringSoreness(state);
  if (soreness) memory.push(soreness);
  const stalled = stallingExercises(state);
  if (stalled.length > 0) {
    memory.push({
      key: "stalling_exercises",
      text: `${stalled.length} exercise${stalled.length > 1 ? "s have" : " has"} missed target reps at the same weight for 3 sessions straight.`,
      exIds: stalled.map((s) => s.exId),
      tags: ["strength", "stall", "plateau", ...stalled.map((s) => s.exId)],
    });
  }
  return memory;
}

// ---------------- PERSISTED SYNC (Coach Memory Layer 3) ----------------
// detectCoachMemory() above is a pure, ephemeral read — recomputed fresh every render, nothing
// stored. This is the layer on top of it: promotes each currently-true fact into a standing,
// evolving record in state.coachMemories (bumping its confidence/evidence if it already
// exists), and ages any previously-detected pattern that *stopped* recurring toward resolved
// instead of leaving a stale claim standing forever. Pure — returns the next memories array;
// the caller applies it via updateState, same pattern as weeklySchedule.js's syncRollingToday.
const DETECTOR_KEYS = ["leg_day_conditioning_skip", "bodyweight_plateau", "recurring_soreness", "stalling_exercises", ...NUTRITION_DETECTOR_KEYS];
const INFERRED_KEYS = new Set(["bodyweight_plateau"]);
const NUTRITION_KEY_SET = new Set(NUTRITION_DETECTOR_KEYS);

export function syncCoachMemory(state) {
  let memories = state.coachMemories || [];
  const detected = [...detectCoachMemory(state), ...detectNutritionMemory(state)];
  const detectedKeys = new Set(detected.map((d) => d.key));

  detected.forEach((d) => {
    const category = d.key === "leg_day_conditioning_skip" || NUTRITION_KEY_SET.has(d.key) ? "behavioralPatterns" : "trainingInsights";
    const source = INFERRED_KEYS.has(d.key) ? "inferred" : "observed";
    memories = upsertObservedMemory(memories, { category, text: d.text, source, key: d.key, tags: d.tags || [] });
  });

  DETECTOR_KEYS.forEach((key) => {
    if (!detectedKeys.has(key)) memories = decayMemory(memories, key);
  });

  // Schedule-adherence patterns (repeated misses by type) use their own keyspace so they never
  // collide with the training-data detectors above.
  const scheduleMiss = repeatedScheduleMiss(state, 30);
  const scheduleMissKeys = ["repeated_miss_workout", "repeated_miss_conditioning", "repeated_miss_recovery"];
  if (scheduleMiss) {
    const key = `repeated_miss_${scheduleMiss.type}`;
    memories = upsertObservedMemory(memories, {
      category: "behavioralPatterns",
      text: scheduleMiss.text,
      source: "observed",
      key,
      tags: [scheduleMiss.type, "schedule", "missed"],
    });
    scheduleMissKeys.filter((k) => k !== key).forEach((k) => {
      memories = decayMemory(memories, k);
    });
  } else {
    scheduleMissKeys.forEach((k) => {
      memories = decayMemory(memories, k);
    });
  }

  return memories;
}
