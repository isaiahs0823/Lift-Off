// ---------------- MOBILITY / RECOVERY SESSION HELPERS ----------------
// Pure functions only (no React/localStorage), same discipline as programSchedule.js and
// workoutHistory.js. Recovery completion re-uses those exact same "is this day done" helpers
// (findMostRecentSessionForPlan/findTodaysSessionForPlan) against state.recoverySessions instead
// of state.workoutSessions — recoverySessions is a dedicated collection (see the task's "do not
// mix these into lifting workoutSessions"), but the plan-name-match convention for "was today's
// thing already done" is identical, so there's no reason to duplicate that logic.

import { mobilityById, recoveryRoutineById } from "../data/mobilityLibrary.js";
import { findMostRecentSessionForPlan, findTodaysSessionForPlan } from "./workoutHistory.js";

// Rough per-rep time for a rep-based movement, used only for the card/preview minute estimate —
// never shown as an exact promise, same spirit as estimateWorkoutMinutes in programSchedule.js.
const SEC_PER_REP_ESTIMATE = 3;

export function resolveRoutineMovements(routine) {
  return (routine?.movements || [])
    .map((row) => ({ ...row, movement: mobilityById(row.movementId) }))
    .filter((row) => !!row.movement);
}

function movementRowSeconds(row) {
  const movement = row.movement || mobilityById(row.movementId);
  if (!movement) return 0;
  const perOccurrence = row.durationSeconds != null ? row.durationSeconds : (row.reps || 0) * SEC_PER_REP_ESTIMATE;
  const sides = movement.perSide ? 2 : 1;
  return perOccurrence * (row.sets || 1) * sides;
}

export function estimateRoutineSeconds(routine) {
  return resolveRoutineMovements(routine).reduce((sum, row) => sum + movementRowSeconds(row), 0);
}
export function estimateRoutineMinutes(routine) {
  const sec = estimateRoutineSeconds(routine);
  return sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0;
}

// Same "<Program> — <Day label>" convention every workout/plan already uses for history —
// keeps recoverySessions readable identically to workoutSessions. A routine started outside any
// program (from the Mobility & Stretching library directly) just uses the routine's own name.
export function recoveryPlanName({ programName, dayLabel, routine }) {
  if (programName) return dayLabel ? `${programName} — ${dayLabel}` : programName;
  return routine?.name || "Recovery session";
}

export function findMostRecentRecoverySessionForPlan(state, planName) {
  return findMostRecentSessionForPlan(state.recoverySessions, planName);
}
export function findTodaysRecoverySessionForPlan(state, planName) {
  return findTodaysSessionForPlan(state.recoverySessions, planName);
}

// Builds the persisted recoverySessions record. `result` is whatever the session runner (or the
// lightweight manual-log flow) collected: { completedMovementIds, skippedMovementIds, durationSec }.
// completionPct is rounded, not exact-fraction-forever, since a manual log has no real per-
// movement breakdown (see buildManualRecoverySession below) — both paths produce the same shape
// so history/adherence never need to know which one was used.
export function buildRecoverySessionSummary({ routine, programContext, result, manual = false }) {
  const totalMovements = (routine?.movements || []).length;
  const completedCount = manual ? totalMovements : (result?.completedMovementIds || []).length;
  const completionPct = totalMovements > 0 ? Math.round((completedCount / totalMovements) * 100) : 100;
  return {
    id: `recovery_${Date.now()}`,
    routineId: routine?.id || null,
    routineName: routine?.name || null,
    planName: recoveryPlanName({ programName: programContext?.programName, dayLabel: programContext?.dayLabel, routine }),
    finishedAt: new Date().toISOString(),
    totalMovements,
    movementsCompleted: completedCount,
    completionPct,
    durationSec: manual ? 0 : Math.max(0, Math.round(result?.durationSec || 0)),
    manual,
    // Provenance — mirrors buildSessionSummary's sourceProgramId/sourceProgramName/sourceDayLabel
    // in App.jsx so recovery history reads the same way lifting history does.
    sourceProgramId: programContext?.programId ?? null,
    sourceProgramName: programContext?.programName ?? null,
    sourceDayLabel: programContext?.dayLabel ?? null,
  };
}

// The "LOG RECOVERY SESSION" lightweight manual path (task section 15) — no timer was run, no
// per-movement breakdown exists, so this is deliberately just "mark it done."
export function buildManualRecoverySession({ routine, programContext }) {
  return buildRecoverySessionSummary({ routine, programContext, result: null, manual: true });
}
