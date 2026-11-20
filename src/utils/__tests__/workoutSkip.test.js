import { it, expect } from "vitest";
import { skipWorkoutExercise, unskipWorkoutExercise, swapWorkoutExercise, moveWorkoutExercise, collectConfirmedWorkout, completeWorkoutState } from "../workoutIntegrity.js";

// Bug report: "no skip option — had to swap exercise or 0 out all the sets so they don't count."
// Skip is a third, honest option distinct from both: unlike swap it doesn't replace the exercise
// with something else, and unlike 0-ing out sets (which cleanSetsInput already refuses to save)
// it never writes anything to state.logs or counts toward any stat — a skipped slot simply never
// has a sessionEntry. Same conventions as workoutSwap.test.js/workoutReorder.test.js: a bare
// `run()` helper, sessionEntries/draftByIndex/swaps/skipped keyed appropriately, workoutSlotId as
// the one identity stable across a reorder.
const time = "2026-11-20T12:00:00Z";
const hackSquatSet = { weight: 135, reps: 10, setType: "working" };

function run() {
  return {
    id: "skip",
    exercises: [
      { exId: "hack_squat", workoutSlotId: "a", group: "A", sets: 3 },
      { exId: "leg_press", workoutSlotId: "b", sets: 3 },
    ],
    sessionEntries: [],
    swaps: {},
    skipped: {},
    programContext: { programId: "keep" },
    draftByIndex: {},
  };
}
const state = () => ({ logs: [], workoutSessions: [], currentProgram: null });
const summary = (r) => ({ entries: r.sessionEntries.map((se) => se.entry), exerciseCount: r.sessionEntries.length, workingSets: r.sessionEntries.reduce((n, se) => n + se.entry.sets.length, 0) });

it("marks the slot's own workoutSlotId as skipped, keyed by id rather than index", () => {
  const r = run(), before = structuredClone(r);
  const next = skipWorkoutExercise(r, 0);
  expect(next.skipped.a).toBeTruthy();
  expect(next.skipped.b).toBeUndefined();
  expect(r).toEqual(before); // pure — input untouched
});

it("abandons only an unconfirmed draft at that index — there's nothing confirmed to lose", () => {
  const r = run();
  r.draftByIndex[0] = { weight: 135, reps: 10 }; // typed but never Saved
  const next = skipWorkoutExercise(r, 0);
  expect(next.draftByIndex[0]).toBeUndefined();
  expect(next.skipped.a).toBeTruthy();
});

it("a skipped exercise never produces a sessionEntry, so it's never logged or counted", () => {
  const r = skipWorkoutExercise(run(), 0);
  const completed = collectConfirmedWorkout(r);
  expect(completed.sessionEntries).toEqual([]);
  const result = completeWorkoutState(state(), completed, summary);
  expect(result.summary.exerciseCount).toBe(0);
  expect(result.summary.entries).toEqual([]);
  expect(result.state.logs).toEqual([]);
});

it("refuses to skip a slot that already has a confirmed sessionEntry", () => {
  const r = run();
  r.sessionEntries = [{ index: 0, entry: { id: "log_a", exId: "hack_squat", sets: [hackSquatSet] } }];
  expect(skipWorkoutExercise(r, 0)).toBe(r);
});

it("does not alter the run for an invalid slot or a finished/pending run", () => {
  const r = run();
  expect(skipWorkoutExercise(r, 5)).toBe(r);
  for (const flag of ["finished", "completionPending"]) {
    const locked = { ...r, [flag]: true };
    expect(skipWorkoutExercise(locked, 0)).toBe(locked);
  }
});

it("unskip clears the mark, leaving the slot a normal open one again", () => {
  const skipped = skipWorkoutExercise(run(), 0);
  const next = unskipWorkoutExercise(skipped, 0);
  expect(next.skipped.a).toBeUndefined();
});

it("unskip is a no-op when the slot was never skipped, or the run is finished/pending", () => {
  const r = run();
  expect(unskipWorkoutExercise(r, 0)).toBe(r);
  const skipped = skipWorkoutExercise(run(), 0);
  for (const flag of ["finished", "completionPending"]) {
    const locked = { ...skipped, [flag]: true };
    expect(unskipWorkoutExercise(locked, 0)).toBe(locked);
  }
});

it("swapping a skipped slot to a different exercise clears the stale skip mark", () => {
  const r = skipWorkoutExercise(run(), 0);
  const next = swapWorkoutExercise(r, 0, "front_squat");
  expect(next.swaps[0]).toBe("front_squat");
  expect(next.skipped.a).toBeUndefined(); // the athlete decided to actually do something here
});

it("swapping a DIFFERENT slot never disturbs another slot's skip mark", () => {
  const r = skipWorkoutExercise(run(), 0);
  const next = swapWorkoutExercise(r, 1, "squat");
  expect(next.skipped.a).toBeTruthy(); // untouched
  expect(next.swaps[1]).toBe("squat");
});

it("a skip mark survives a reorder — it's keyed by workoutSlotId, never remapped by index", () => {
  const r = skipWorkoutExercise(run(), 0); // "a" (hack_squat) skipped
  const next = moveWorkoutExercise(r, 0, 1); // hack_squat moves to index 1
  expect(next.exercises[1].workoutSlotId).toBe("a");
  expect(next.skipped.a).toBeTruthy();
  expect(next.skipped).toBe(r.skipped); // moveWorkoutExercise doesn't even need to touch it
});

it("one skipped slot and one normally-finished slot together produce exactly one history entry", () => {
  let r = skipWorkoutExercise(run(), 0); // hack_squat skipped
  r = { ...r, draftByIndex: { 1: { confirmedSets: [hackSquatSet], reps: 10, entryDate: time, updatedAt: time } } };
  const completed = collectConfirmedWorkout(r);
  const result = completeWorkoutState(state(), completed, summary);
  expect(result.summary.entries.map((e) => e.exId)).toEqual(["leg_press"]);
  expect(result.summary.exerciseCount).toBe(1);
});
