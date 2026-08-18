// ---------------- DATA WORKBOOK — AGGREGATION ----------------
// Read-only aggregation over BRK's existing data for the My Data Workbook screen and its
// exports. Every function here only reads state — nothing is mutated, nothing is fabricated.
//
// Historical exercise/set data always comes from a session's own frozen `entries[]` snapshot
// (state.workoutSessions[i].entries, written once by buildSessionSummary in App.jsx at the
// moment a workout finishes) — never from a program's *current* template. That snapshot is
// exactly what was actually performed: exercise swaps, added/removed sets, and changed
// loads/reps for that session are already baked in, and later editing or deleting a live log
// entry can never retroactively change it. Sessions finished before this field existed simply
// have no set-level detail available — they still count toward session-level totals (those
// were always stored on the session itself), just not toward the Exercises tab or the
// per-set Exercise Performance sheet.
import { isWithinRange } from "./dateRange.js";
import { countedSets, formatSessionDuration, SET_TYPE_LABEL } from "./workoutSets.js";
import { computeReadinessScore } from "./readiness.js";
import { dailyTotals } from "./nutrition.js";
import { dayAdherence } from "./nutritionAdherence.js";

// Same Epley formula PR detection uses in App.jsx (estimateOneRM) — duplicated locally since
// App.jsx doesn't export it, matching the existing convention of this exact one-liner already
// appearing standalone a second time in weeklyReview.js.
export function estimateOneRM(weight, reps) {
  return weight * (1 + reps / 30);
}
export function setVolume(s) {
  const dropVolume = (s.drops || []).reduce((sum, d) => sum + d.weight * d.reps, 0);
  return s.weight * s.reps + dropVolume;
}

export function resolveExerciseName(exId, exMap) {
  return exMap?.[exId]?.name || exId;
}

export function sessionsInRange(state, range) {
  return (state.workoutSessions || [])
    .filter((s) => isWithinRange(s.finishedAt || s.startedAt, range))
    .sort((a, b) => new Date(b.finishedAt || b.startedAt) - new Date(a.finishedAt || a.startedAt));
}

function dateKeyOf(iso) {
  return typeof iso === "string" ? iso.slice(0, 10) : null;
}

// A set inside a session's frozen entry is PR-flagged only when it's the exact set (weight +
// reps) that a stored session.prs entry names — the same object detectPRs used to generate
// the PR in the first place. exerciseVolume PRs describe the whole exercise entry, not one
// set, so they never flag an individual row (real distinction, not an omission).
function buildPrFlagLookup(session) {
  const byExId = new Map();
  (session.prs || []).forEach((pr) => {
    if (pr.weight == null || pr.reps == null) return; // exerciseVolume PRs have no single set
    if (!byExId.has(pr.exId)) byExId.set(pr.exId, []);
    byExId.get(pr.exId).push(pr);
  });
  return byExId;
}

// ---------------- OVERVIEW ----------------
export function computeOverview(state, range) {
  const sessions = sessionsInRange(state, range);
  const bodyweight = (state.bodyweightLogs || []).filter((e) => isWithinRange(e.date, range));
  const readiness = (state.readinessLogs || []).filter((e) => isWithinRange(e.date, range));

  const trainingDays = new Set(sessions.map((s) => dateKeyOf(s.finishedAt || s.startedAt)).filter(Boolean)).size;
  const totalExercises = sessions.reduce((sum, s) => sum + (s.exerciseCount || 0), 0);
  const totalWorkingSets = sessions.reduce((sum, s) => sum + (s.workingSets || 0), 0);
  const totalReps = sessions.reduce((sum, s) => sum + (s.totalReps || 0), 0);
  const totalVolume = sessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
  const prCount = sessions.reduce((sum, s) => sum + new Set((s.prs || []).map((p) => p.exId)).size, 0);

  const durations = sessions.map((s) => s.durationSec).filter((d) => typeof d === "number" && d > 0);
  const avgDurationSec = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const readinessScores = readiness.map((r) => computeReadinessScore(r)).filter((v) => v != null);
  const avgReadiness = readinessScores.length ? Math.round(readinessScores.reduce((a, b) => a + b, 0) / readinessScores.length) : null;

  const sortedBw = [...bodyweight].sort((a, b) => new Date(a.date) - new Date(b.date));
  const startingBodyweight = sortedBw.length ? sortedBw[0].weight : null;
  const endingBodyweight = sortedBw.length ? sortedBw[sortedBw.length - 1].weight : null;
  const bodyweightChange =
    startingBodyweight != null && endingBodyweight != null ? Math.round((endingBodyweight - startingBodyweight) * 10) / 10 : null;

  // Monthly workout counts — only meaningful (and only shown) when the range spans more than
  // one calendar month; a same-month range would just repeat the total as one bucket.
  const monthly = new Map();
  sessions.forEach((s) => {
    const d = new Date(s.finishedAt || s.startedAt);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly.set(key, (monthly.get(key) || 0) + 1);
  });
  const monthlyWorkouts = [...monthly.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, count]) => {
      const [y, m] = key.split("-").map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: sessions.length && new Set([...monthly.keys()].map((k) => k.slice(0, 4))).size > 1 ? "numeric" : undefined });
      return { key, label, count };
    });

  return {
    workoutsCompleted: sessions.length,
    trainingDays,
    totalExercises,
    totalWorkingSets,
    totalReps,
    totalVolume: sessions.length ? Math.round(totalVolume) : null,
    prCount,
    avgDurationSec,
    avgDurationLabel: avgDurationSec != null ? formatSessionDuration(avgDurationSec) : null,
    avgReadiness,
    startingBodyweight,
    endingBodyweight,
    bodyweightChange,
    monthlyWorkouts: monthlyWorkouts.length > 1 ? monthlyWorkouts : [],
  };
}

// ---------------- SESSIONS ----------------
export function computeSessionRows(state, range) {
  return sessionsInRange(state, range).map((s) => ({
    id: s.id,
    date: s.finishedAt || s.startedAt || null,
    planName: s.planName || "Workout",
    durationSec: s.durationSec ?? null,
    durationLabel: typeof s.durationSec === "number" ? formatSessionDuration(s.durationSec) : "N/A",
    bodyParts: s.mainMuscles && s.mainMuscles.length ? s.mainMuscles.join(", ") : "N/A",
    exerciseCount: s.exerciseCount ?? null,
    workingSets: s.workingSets ?? null,
    volume: s.totalVolume ?? null,
    avgRir: s.avgRir ?? null,
    prCount: new Set((s.prs || []).map((p) => p.exId)).size,
  }));
}

// ---------------- EXERCISES ----------------
// Aggregates by exercise across every session's frozen entries[] in range. Sessions without a
// stored `entries` snapshot (pre-dating that field) are silently skipped here — their totals
// already counted toward the Overview via session-level fields, but there is no real per-set
// data to aggregate, and reconstructing it from anything else would mean guessing.
export function computeExerciseRows(state, range, exMap) {
  const sessions = sessionsInRange(state, range);
  const byExercise = new Map();

  sessions.forEach((session) => {
    if (!Array.isArray(session.entries)) return;
    const dateIso = session.finishedAt || session.startedAt;
    session.entries.forEach((entry) => {
      const counted = countedSets(entry.sets || []);
      if (counted.length === 0) return;
      if (!byExercise.has(entry.exId)) {
        byExercise.set(entry.exId, {
          exId: entry.exId,
          sessionsSet: new Set(),
          totalSets: 0,
          totalReps: 0,
          totalVolume: 0,
          bestWeight: null,
          bestWeightReps: null,
          bestE1RM: null,
          firstDate: dateIso,
          lastDate: dateIso,
        });
      }
      const agg = byExercise.get(entry.exId);
      agg.sessionsSet.add(session.id);
      counted.forEach((s) => {
        agg.totalSets += 1;
        agg.totalReps += s.reps + (s.drops || []).reduce((sum, d) => sum + d.reps, 0);
        agg.totalVolume += setVolume(s);
        if (agg.bestWeight == null || s.weight > agg.bestWeight) {
          agg.bestWeight = s.weight;
          agg.bestWeightReps = s.reps;
        }
        const e1rm = estimateOneRM(s.weight, s.reps);
        if (agg.bestE1RM == null || e1rm > agg.bestE1RM) agg.bestE1RM = e1rm;
      });
      if (dateIso && (!agg.firstDate || new Date(dateIso) < new Date(agg.firstDate))) agg.firstDate = dateIso;
      if (dateIso && (!agg.lastDate || new Date(dateIso) > new Date(agg.lastDate))) agg.lastDate = dateIso;
    });
  });

  return [...byExercise.values()]
    .map((agg) => ({
      exId: agg.exId,
      name: resolveExerciseName(agg.exId, exMap),
      sessionCount: agg.sessionsSet.size,
      totalSets: agg.totalSets,
      totalReps: agg.totalReps,
      totalVolume: Math.round(agg.totalVolume),
      bestWeight: agg.bestWeight,
      bestWeightReps: agg.bestWeightReps,
      bestE1RM: agg.bestE1RM != null ? Math.round(agg.bestE1RM) : null,
      firstDate: agg.firstDate,
      lastDate: agg.lastDate,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume);
}

// One row per performed set — the raw material for the CSV export and Excel Sheet 3.
export function computeSetRows(state, range, exMap) {
  const sessions = sessionsInRange(state, range);
  const rows = [];
  sessions.forEach((session) => {
    if (!Array.isArray(session.entries)) return;
    const prLookup = buildPrFlagLookup(session);
    const dateIso = session.finishedAt || session.startedAt;
    session.entries.forEach((entry) => {
      const prsForEx = prLookup.get(entry.exId) || [];
      (entry.sets || []).forEach((s, idx) => {
        const isPr = prsForEx.some((pr) => pr.weight === s.weight && pr.reps === s.reps);
        rows.push({
          date: dateIso,
          sessionId: session.id,
          sessionName: session.planName || "Workout",
          exId: entry.exId,
          exerciseName: resolveExerciseName(entry.exId, exMap),
          setNumber: idx + 1,
          setType: SET_TYPE_LABEL[s.setType || "working"] || "Working",
          weight: s.weight,
          reps: s.reps,
          rir: s.rir ?? null,
          rpe: s.rpe ?? null,
          volume: Math.round(setVolume(s) * 100) / 100,
          isPr,
        });
      });
    });
  });
  return rows;
}

// ---------------- BODYWEIGHT ----------------
export function computeBodyweightRows(state, range) {
  const entries = (state.bodyweightLogs || [])
    .filter((e) => isWithinRange(e.date, range))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return entries.map((e) => ({ date: e.date, weight: e.weight ?? null, waist: e.waist ?? null, bodyFat: e.bodyFat ?? null, notes: e.notes || "" }));
}

// ---------------- READINESS ----------------
export function computeReadinessRows(state, range) {
  const entries = (state.readinessLogs || [])
    .filter((e) => isWithinRange(e.date, range))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  return entries.map((e) => ({
    date: e.date,
    sleepQuality: e.sleepQuality ?? null,
    sleepHours: e.sleepHours ?? null,
    soreness: e.soreness ?? null,
    stress: e.stress ?? null,
    motivation: e.motivation ?? null,
    energy: e.energy ?? null,
    restingHR: e.restingHR ?? null,
    score: computeReadinessScore(e),
    notes: e.notes || "",
  }));
}

// ---------------- NUTRITION ----------------
export function computeNutritionRows(state, range) {
  const foodLogs = state.foodLogs || [];
  const targets = state.nutritionTargets || null;
  const dateKeys = [...new Set(foodLogs.map((f) => f.date))].filter((k) => isWithinRange(k, range)).sort();

  return dateKeys.map((dateKey) => {
    const totals = dailyTotals(foodLogs, dateKey);
    const adherence = targets ? dayAdherence(foodLogs, targets, dateKey) : null;
    return {
      date: dateKey,
      calories: Math.round(totals.calories),
      protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat),
      calorieTarget: targets?.calories ?? null,
      proteinTarget: targets?.protein ?? null,
      carbTarget: targets?.carbs ?? null,
      fatTarget: targets?.fat ?? null,
      onPlan: adherence ? adherence.caloriesOnPlan && adherence.proteinHit : null,
    };
  });
}

export function computeNutritionSummary(nutritionRows) {
  if (!nutritionRows.length) return { daysLogged: 0, avgCalories: null, avgProtein: null, targetAdherencePct: null };
  const withTarget = nutritionRows.filter((r) => r.onPlan != null);
  return {
    daysLogged: nutritionRows.length,
    avgCalories: Math.round(nutritionRows.reduce((s, r) => s + r.calories, 0) / nutritionRows.length),
    avgProtein: Math.round(nutritionRows.reduce((s, r) => s + r.protein, 0) / nutritionRows.length),
    targetAdherencePct: withTarget.length ? Math.round((withTarget.filter((r) => r.onPlan).length / withTarget.length) * 100) : null,
  };
}
