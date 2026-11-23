import { it, expect } from "vitest";
import { moveWorkoutExercise, collectConfirmedWorkout, completeWorkoutState } from "../workoutIntegrity.js";

// BRK Active Workout — Reorder Exercises. Same conventions as workoutSwap.test.js: a bare `run()`
// helper building a minimal activeRun, sessionEntries/draftByIndex/swaps keyed by array position,
// workoutSlotId as the one identity stable across the move.
const time = "2026-11-16T12:00:00Z";
const hipAddSet = { weight: 40, reps: 15, setType: "working" };
const legExtDraft = { weight: 90, reps: 10 };

function run() {
  return {
    id: "reorder",
    exercises: [
      { exId: "hip_adduction", workoutSlotId: "a", group: "A", sets: 3 },
      { exId: "leg_extension", workoutSlotId: "b", sets: 3 },
      { exId: "calf_raise", workoutSlotId: "c", sets: 3 },
    ],
    sessionEntries: [],
    swaps: {},
    programContext: { programId: "keep" },
    draftByIndex: {
      0: { confirmedSets: [hipAddSet], reps: 15, entryDate: time, updatedAt: time },
      1: { confirmedSets: [], ...legExtDraft },
    },
  };
}
const state = () => ({ logs: [], workoutSessions: [], currentProgram: null });
const summary = (r) => ({ entries: r.sessionEntries.map((se) => se.entry), workingSets: r.sessionEntries.reduce((n, se) => n + se.entry.sets.length, 0) });

it("moves the exercise order without touching the saved program/template reference", () => {
  const r = run();
  const next = moveWorkoutExercise(r, 1, 0); // drag leg_extension above hip_adduction
  expect(next.exercises.map((e) => e.exId)).toEqual(["leg_extension", "hip_adduction", "calf_raise"]);
  expect(next.programContext).toBe(r.programContext); // same reference — program/template untouched
});

it("carries a confirmed-set draft to its exercise's new position, not to whatever lands at its old one", () => {
  const r = run(), before = structuredClone(r);
  const next = moveWorkoutExercise(r, 1, 0); // leg_extension (idx 1) -> idx 0, hip_adduction (idx 0) -> idx 1
  // hip_adduction's confirmed set followed hip_adduction, now at index 1 — not left behind at index 0.
  expect(next.draftByIndex[1].confirmedSets).toEqual([hipAddSet]);
  expect(next.draftByIndex[0]).toMatchObject(legExtDraft);
  expect(next.draftByIndex[0].confirmedSets).toEqual([]);
  expect(r).toEqual(before); // pure — input untouched
});

it("keeps the group label attached to its own exercise through the move", () => {
  const next = moveWorkoutExercise(run(), 1, 0);
  expect(next.exercises.find((e) => e.exId === "hip_adduction").group).toBe("A");
  expect(next.exercises.find((e) => e.exId === "leg_extension").group).toBeUndefined();
});

it("shifts every slot between the old and new position, not just the moved one", () => {
  const r = run();
  const next = moveWorkoutExercise(r, 2, 0); // calf_raise to the front
  expect(next.exercises.map((e) => e.exId)).toEqual(["calf_raise", "hip_adduction", "leg_extension"]);
  // hip_adduction's confirmed set (was index 0) shifts to index 1; leg_extension's draft (was index 1) shifts to index 2.
  expect(next.draftByIndex[1].confirmedSets).toEqual([hipAddSet]);
  expect(next.draftByIndex[2]).toMatchObject(legExtDraft);
});

it("moves a swapped-in replacement's performed identity along with it, not the slot it vacates", () => {
  const r = run();
  r.swaps[1] = "lat_raise"; // leg_extension slot was already replaced in place with lat_raise
  const next = moveWorkoutExercise(r, 1, 0);
  expect(next.swaps[0]).toBe("lat_raise");
  expect(next.swaps[1]).toBeUndefined();
});

it("moves two instances of the same exercise independently", () => {
  const r = run();
  r.exercises[2] = { exId: "hip_adduction", workoutSlotId: "c2", sets: 3 }; // a second, distinct hip_adduction slot
  r.draftByIndex[2] = { confirmedSets: [], weight: 50, reps: 12 };
  const next = moveWorkoutExercise(r, 2, 0); // move only the SECOND hip_adduction slot to the front
  expect(next.exercises[0].workoutSlotId).toBe("c2");
  expect(next.draftByIndex[0]).toMatchObject({ weight: 50, reps: 12 });
  // the FIRST hip_adduction slot (confirmed set, workoutSlotId "a") is undisturbed at its shifted position.
  expect(next.exercises[1].workoutSlotId).toBe("a");
  expect(next.draftByIndex[1].confirmedSets).toEqual([hipAddSet]);
});

it("a reorder followed by finishing every exercise produces exactly one history entry per slot, correctly attributed", () => {
  const r = moveWorkoutExercise(run(), 1, 0); // leg_extension first, hip_adduction second
  // Finish both remaining exercises (simulate Save Set + Finish on each, matching entryFromDraft's shape).
  r.draftByIndex[0].confirmedSets = [legExtDraft];
  r.draftByIndex[1].confirmedSets = [hipAddSet];
  r.draftByIndex[2] = { confirmedSets: [{ weight: 25, reps: 20 }], reps: 20 };
  const completed = collectConfirmedWorkout(r);
  const result = completeWorkoutState(state(), completed, summary);
  expect(result.state.workoutSessions).toHaveLength(1);
  expect(result.summary.entries.map((e) => e.exId)).toEqual(["leg_extension", "hip_adduction", "calf_raise"]);
  expect(result.summary.entries.find((e) => e.exId === "hip_adduction").sets).toEqual([hipAddSet]);
});

it("does not alter the run for a no-op move, an out-of-range index, or a finished/pending run", () => {
  const r = run();
  expect(moveWorkoutExercise(r, 0, 0)).toBe(r);
  expect(moveWorkoutExercise(r, -1, 1)).toBe(r);
  expect(moveWorkoutExercise(r, 0, 5)).toBe(r);
  for (const flag of ["finished", "completionPending"]) {
    const locked = { ...r, [flag]: true };
    expect(moveWorkoutExercise(locked, 0, 1)).toBe(locked);
  }
});

it("is a no-op when exercises is missing or malformed, never throwing", () => {
  expect(moveWorkoutExercise({ id: "x" }, 0, 1)).toEqual({ id: "x" });
  expect(moveWorkoutExercise(null, 0, 1)).toBeNull();
});

// Bug report: "an occupied machine — athlete should be able to move that exercise later in
// today's workout without deleting anything." Confirmed already implemented (moveWorkoutExercise
// + ReorderableExerciseList's Move up/down buttons and drag handle, Pointer Events-based, not
// HTML5 drag-and-drop). These pin the specific checklist items the task called out explicitly,
// on top of the equivalent coverage already above (an "up" move, a multi-position move, etc.).
it("moving an exercise DOWN one position (not just up) carries its own draft correctly", () => {
  const r = run();
  const next = moveWorkoutExercise(r, 0, 1); // hip_adduction (with its confirmed set) moves down one, past leg_extension
  expect(next.exercises.map((e) => e.exId)).toEqual(["leg_extension", "hip_adduction", "calf_raise"]);
  expect(next.draftByIndex[1].confirmedSets).toEqual([hipAddSet]); // followed hip_adduction to its new position
  expect(next.draftByIndex[0]).toMatchObject(legExtDraft); // leg_extension's draft followed it too
});

it("the exercise's full prescription (sets/reps/repRange/rir) moves with it, not just its name", () => {
  const r = run();
  r.exercises[1] = { ...r.exercises[1], sets: 4, reps: 12, repRange: [10, 15], rir: [1, 2] };
  const next = moveWorkoutExercise(r, 1, 0);
  const moved = next.exercises.find((e) => e.exId === "leg_extension");
  expect(moved).toMatchObject({ sets: 4, reps: 12, repRange: [10, 15], rir: [1, 2] });
});

it("the real reported scenario: Pec Deck (occupied) moved later, Shoulder Press and Lateral Raise move up to fill the gap, nothing deleted", () => {
  const r = {
    id: "gym-flow",
    exercises: [
      { exId: "incline_press", workoutSlotId: "s1", sets: 3 },
      { exId: "pec_deck", workoutSlotId: "s2", sets: 3 }, // occupied — athlete wants this later
      { exId: "shoulder_press", workoutSlotId: "s3", sets: 3 },
      { exId: "lateral_raise", workoutSlotId: "s4", sets: 3 },
      { exId: "triceps_pushdown", workoutSlotId: "s5", sets: 3 },
    ],
    sessionEntries: [{ index: 0, entry: { id: "log_incline", exId: "incline_press", sets: [{ weight: 135, reps: 10, setType: "working" }] } }], // Incline Press already completed
    swaps: {},
    programContext: { programId: "today" },
    draftByIndex: {},
  };
  // Move Pec Deck (index 1) down two spots, past Shoulder Press and Lateral Raise, to index 3.
  const next = moveWorkoutExercise(r, 1, 3);
  expect(next.exercises.map((e) => e.exId)).toEqual(["incline_press", "shoulder_press", "lateral_raise", "pec_deck", "triceps_pushdown"]);
  // Nothing was removed — same 5 exercises, same set of workoutSlotIds, just reordered.
  expect(next.exercises.map((e) => e.workoutSlotId).sort()).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  // The already-completed Incline Press entry followed it (still at index 0, still intact).
  expect(next.sessionEntries).toEqual([{ index: 0, entry: r.sessionEntries[0].entry }]);
  expect(next.programContext).toBe(r.programContext); // the scheduled program itself is untouched
});

it("reordering an ALREADY-COMPLETED exercise's position doesn't corrupt its entry or anyone else's", () => {
  // The existing implementation safely supports moving a completed slot too (sessionEntries are
  // tracked by workoutSlotId the same way drafts are) — per the task's own "if the existing
  // implementation safely supports more than [anchoring completed exercises], preserve it,"
  // this is intentionally exercised rather than restricted.
  const r = run();
  r.sessionEntries = [
    { index: 0, entry: { id: "log_hip", exId: "hip_adduction", sets: [hipAddSet] } },
    { index: 1, entry: { id: "log_legext", exId: "leg_extension", sets: [{ weight: 90, reps: 10, setType: "working" }] } },
  ];
  r.draftByIndex = {}; // nothing left unconfirmed
  const next = moveWorkoutExercise(r, 0, 2); // move the COMPLETED hip_adduction slot to the very end
  expect(next.exercises.map((e) => e.exId)).toEqual(["leg_extension", "calf_raise", "hip_adduction"]);
  const byExId = Object.fromEntries(next.sessionEntries.map((se) => [se.entry.exId, se]));
  expect(byExId.hip_adduction).toEqual({ index: 2, entry: r.sessionEntries[0].entry }); // followed its own slot, entry untouched
  expect(byExId.leg_extension).toEqual({ index: 0, entry: r.sessionEntries[1].entry }); // the other completed entry is undisturbed
  expect(next.sessionEntries).toHaveLength(2); // no duplication, no loss
});
