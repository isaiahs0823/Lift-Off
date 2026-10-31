import { newWorkoutId } from "./workoutIntegrity.js";

// Travel/Alternate Gym mode (task Part 3) — a whole-session flag, not per-exercise. Defaults to
// "normal" so every existing/older run (and every run started without ever touching Session
// Options) behaves exactly as before this existed.
export function sanitizeSessionContext(raw) {
  const locationMode = raw?.locationMode === "alternate_gym" ? "alternate_gym" : "normal";
  const locationLabel = typeof raw?.locationLabel === "string" && raw.locationLabel.trim() ? raw.locationLabel.trim().slice(0, 80) : null;
  return { locationMode, locationLabel };
}

// ---------------- ACTIVE WORKOUT DRAFT PERSISTENCE ----------------
// The persisted shape of `liftlog-active-run`. Bumping this only matters if a future change
// makes an old draft meaningfully incompatible — sanitizeActiveRun() below already recovers as
// much of an old/partial object as it can rather than discarding it, so most schema growth
// (like adding draftByIndex here) never needs a bump at all.
export const ACTIVE_RUN_VERSION = 1;
// Defends against a corrupted/partial/pre-this-change `liftlog-active-run` value crashing the
// workout screen: every field is defaulted individually so one missing/malformed property (an
// old save from before draftByIndex existed, a hand-edited value, truncated storage, etc.) never
// takes the rest of a legitimate in-progress workout down with it. Returns null only when there's
// nothing usable at all.
export function sanitizeActiveRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  try {
    return {
      ...raw,
      version: ACTIVE_RUN_VERSION,
      id: typeof raw.id === "string" ? raw.id : newWorkoutId(),
      completionPending: !!raw.completionPending,
      completionReceipt: raw.completionReceipt ?? null,
      recoveryConflict: raw.recoveryConflict ?? null,
      programBeforeCompletion: raw.programBeforeCompletion ?? null,
      sourceProgramId: raw.sourceProgramId ?? raw.programContext?.programId ?? null,
      sourceProgramName: raw.sourceProgramName ?? raw.programContext?.programName ?? null,
      sourceDayLabel: raw.sourceDayLabel ?? null,
      planName: typeof raw.planName === "string" && raw.planName ? raw.planName : "Workout",
      exercises: Array.isArray(raw.exercises) ? raw.exercises.map((slot) => ({ ...slot, workoutSlotId: slot.workoutSlotId || newWorkoutId() })) : [],
      sessionEntries: Array.isArray(raw.sessionEntries) ? raw.sessionEntries : [],
      swaps: raw.swaps && typeof raw.swaps === "object" ? raw.swaps : {},
      finished: !!raw.finished,
      returnTab: typeof raw.returnTab === "string" ? raw.returnTab : "templates",
      programContext: raw.programContext && typeof raw.programContext === "object" ? raw.programContext : null,
      source: typeof raw.source === "string" ? raw.source : null,
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString(),
      // Per-exercise-slot in-progress state (confirmed-but-exercise-not-finished sets, plus the
      // current unsaved set draft) — see TrainingExerciseCard's draft autosave. Keyed by the
      // exercise's index within `exercises`, cleared the moment that slot's exercise is finished.
      draftByIndex: raw.draftByIndex && typeof raw.draftByIndex === "object" ? raw.draftByIndex : {},
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : (typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString()),
      summaryId: raw.summaryId ?? null,
      coachHistoryId: raw.coachHistoryId ?? null,
      // Travel/Alternate Gym mode (see SessionOptionsSheet) — a whole-session flag, defaulting
      // to "normal" for every run started before this existed. Persists immediately on change
      // (task section 28), same treatment as an equipment-profile selection.
      sessionContext: sanitizeSessionContext(raw.sessionContext),
    };
  } catch (e) {
    return null;
  }
}
