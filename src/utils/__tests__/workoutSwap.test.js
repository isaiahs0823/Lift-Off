import { it, expect } from "vitest";
import { swapWorkoutExercise, stampWorkoutDraft, collectConfirmedWorkout, completeWorkoutState } from "../workoutIntegrity.js";

const time = "2026-10-30T12:00:00Z";
const set = { weight: 100, reps: 8, rir: 2, setType: "working", drops: [{ weight: 75, reps: 3 }] };
const state = () => ({ logs: [{ id: "old", exId: "bench", date: "2025-01-01", sets: [set] }], workoutSessions: [{ id: "history", note: "unchanged" }], currentProgram: null });
function run(sets = [set]) {
  return { id: "swap", exercises: [{ exId: "bench", workoutSlotId: "a", group: "A", sets: 3 }, { exId: "squat", workoutSlotId: "b", sets: 3 }], sessionEntries: [], swaps: {}, programContext: { programId: "keep" }, draftByIndex: { 0: { confirmedSets: sets, reps: 8, entryDate: time, updatedAt: time, equipmentProfileId: "machine", jointNote: { note: "original cue" } } } };
}
const summary = (r) => ({ entries: r.sessionEntries.map((se) => se.entry), workingSets: r.sessionEntries.reduce((n, se) => n + se.entry.sets.length, 0) });
it("swaps an empty slot without inserting work or carrying unsaved inputs", () => {
  const r = run([]), next = swapWorkoutExercise(r, 0, "incline");
  expect(next.exercises).toBe(r.exercises); expect(next.sessionEntries).toEqual([]);
  expect(next.swaps[0]).toBe("incline"); expect(next.draftByIndex[0]).toBeUndefined();
});
it.each([1, 3])("preserves %i confirmed sets with original identity, date and metadata", (count) => {
  const r = run(Array(count).fill(set)), before = structuredClone(r);
  const next = swapWorkoutExercise(r, 0, "incline");
  expect(next.sessionEntries[0].entry).toMatchObject({ id: "log_swap_a", exId: "bench", date: time, sets: Array(count).fill(set), equipmentProfileId: "machine", jointNote: { note: "original cue" } });
  expect(next.exercises.map((s) => s.exId)).toEqual(["bench", "incline", "squat"]);
  expect(next.exercises[1].workoutSlotId).not.toBe("a"); expect(next.exercises[1].group).toBeUndefined();
  expect(next.draftByIndex[1]).toBeUndefined(); expect(next.programContext).toBe(r.programContext);
  expect(r).toEqual(before);
});
it("keeps a previously swapped exercise's performed identity", () => {
  const r = run(); r.swaps[0] = "dumbbell";
  const next = swapWorkoutExercise(r, 0, "incline");
  expect(next.sessionEntries[0].entry.exId).toBe("dumbbell");
  expect(next.swaps[0]).toBe("dumbbell"); expect(next.swaps[1]).toBeUndefined();
});
it("reindexes later entries, swaps and drafts together without changing their log IDs", () => {
  const r = run(); const later = { index: 1, entry: { id: "later-log", exId: "other", sets: [set] } };
  r.sessionEntries = [later]; r.swaps[1] = "other"; r.draftByIndex[1] = { weight: 123 };
  const next = swapWorkoutExercise(r, 0, "incline");
  expect(next.sessionEntries[1]).toEqual({ ...later, index: 2 });
  expect(next.swaps[2]).toBe("other"); expect(next.draftByIndex[2]).toEqual({ weight: 123 });
  expect(next.exercises[2].workoutSlotId).toBe("b");
});
it("supports swapping a completed slot without deleting or duplicating its canonical log", () => {
  const r = run(), previous = state();
  const entry = collectConfirmedWorkout(r).sessionEntries[0];
  r.sessionEntries = [entry]; r.draftByIndex = {}; previous.logs.unshift(entry.entry);
  const before = structuredClone(previous);
  const next = swapWorkoutExercise(r, 0, "incline", previous.logs);
  const result = completeWorkoutState(previous, next, summary);
  expect(result.summary.workingSets).toBe(1); expect(result.state.logs).toHaveLength(2);
  expect(result.state.logs.find((l) => l.id === entry.entry.id)).toEqual(entry.entry);
  expect(previous).toEqual(before);
});
it("repeated swaps keep independent completed slots and intentional identical sets", () => {
  let r = swapWorkoutExercise(run([set, set]), 0, "incline");
  r.draftByIndex[1] = { confirmedSets: [set], reps: 8, entryDate: time };
  r = swapWorkoutExercise(r, 1, "dumbbell");
  r = swapWorkoutExercise(r, 2, "bench"); // no sets on dumbbell, replace in place
  r.draftByIndex[2] = { confirmedSets: [set], reps: 8, entryDate: time };
  const previous = state(), result = completeWorkoutState(previous, JSON.parse(JSON.stringify(r)), summary);
  expect(result.summary.entries.map((e) => e.exId)).toEqual(["bench", "incline", "bench"]);
  expect(result.summary.workingSets).toBe(4); expect(new Set(result.summary.entries.map((e) => e.id)).size).toBe(3);
  expect(result.state.workoutSessions[1]).toBe(previous.workoutSessions[0]); expect(result.state.logs.at(-1)).toBe(previous.logs[0]);
  expect(completeWorkoutState(result.state, r, summary).state).toBe(result.state);
});
it("reconciles an older canonical log after a partial write before swapping", () => {
  const r = run(), first = collectConfirmedWorkout(r).sessionEntries[0].entry;
  r.draftByIndex[0] = stampWorkoutDraft(r, 0, { ...r.draftByIndex[0], confirmedSets: [set, set] }, [first]);
  const next = swapWorkoutExercise(r, 0, "incline", [first]);
  expect(next.sessionEntries[0].entry.sets).toEqual([set, set]);
  expect(completeWorkoutState({ ...state(), logs: [first] }, next, summary).state.logs[0].sets).toEqual([set, set]);
});
it("preserves conflicting copies instead of silently swapping them away", () => {
  const r = run(), canonical = { ...collectConfirmedWorkout(r).sessionEntries[0].entry, sets: [{ ...set, weight: 999 }] };
  const before = structuredClone(r);
  expect(() => swapWorkoutExercise(r, 0, "incline", [canonical])).toThrow("Both copies are preserved");
  expect(r).toEqual(before);
});
it("does not alter the run for the same selection, invalid slot, or a finished or pending run", () => {
  const r = run(); expect(swapWorkoutExercise(r, 0, "bench")).toBe(r); expect(swapWorkoutExercise(r, 4, "incline")).toBe(r);
  for (const flag of ["finished", "completionPending"]) { const locked = { ...r, [flag]: true }; expect(swapWorkoutExercise(locked, 0, "incline")).toBe(locked); }
});
