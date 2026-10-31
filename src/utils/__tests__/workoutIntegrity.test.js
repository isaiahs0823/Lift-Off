import { describe, it, expect, vi } from "vitest";
import { hasUnfinishedWorkout, workoutLogId, collectConfirmedWorkout, completeWorkoutState, advanceProgramForWorkout, writeWorkoutCompletion, stampWorkoutDraft } from "../workoutIntegrity.js";

const time = "2026-10-30T12:00:00Z";
const set = { weight: 100, reps: 8, rir: 2, setType: "working", drops: [{ weight: 75, reps: 4 }] };
const assignment = { programId: "p", source: "custom", dayIndex: 0, totalDays: 2, startDate: "2026-10-01T12:00:00Z", programName: "Program", selectedForDays: 3 };
function workout(overrides = {}) {
  return {
    id: "run-1", planName: "Program — A", startedAt: time, finished: false,
    exercises: [{ exId: "bench", sets: 3 }, { exId: "squat", sets: 3 }],
    programContext: { programId: "p", source: "custom", dayIndex: 0, totalDays: 2, assignmentStartDate: assignment.startDate },
    sessionEntries: [], swaps: {}, draftByIndex: { 0: { confirmedSets: [set], reps: 8, updatedAt: time, jointNote: { note: "synthetic cue" } } },
    ...overrides,
  };
}
function state(overrides = {}) {
  return { currentProgram: assignment, workoutSessions: [{ id: "old-session", note: "unchanged" }], logs: [{ id: "old-log", sets: [set] }], ...overrides };
}
function summary(run) {
  return { entries: run.sessionEntries.map((se) => se.entry), workingSets: run.sessionEntries.reduce((n, se) => n + se.entry.sets.length, 0) };
}

describe("confirmed workout durability", () => {
  it("recognizes an unfinished session even when it has no finished exercise entries", () => {
    expect(hasUnfinishedWorkout(workout())).toBe(true);
    expect(hasUnfinishedWorkout(null)).toBe(false);
    expect(hasUnfinishedWorkout(workout({ finished: true }))).toBe(false);
  });
  it("promotes Save Set immediately, retaining reps, drops, effort and notes", () => {
    const run = workout(), before = structuredClone(run);
    const saved = collectConfirmedWorkout(run, time).sessionEntries[0].entry;
    expect(saved.sets).toEqual([set]); expect(saved.jointNote).toEqual({ note: "synthetic cue" });
    expect(run).toEqual(before);
  });
  it("does not commit typed-but-unconfirmed input", () => {
    const run = workout({ draftByIndex: { 0: { confirmedSets: [], weight: 200, reps: 10 } } });
    expect(collectConfirmedWorkout(run).sessionEntries).toEqual([]);
  });
  it("combines complete and partial exercises in slot order exactly once", () => {
    const finished = { index: 0, entry: { id: "finished", exId: "bench", sets: [set, set] } };
    const run = workout({ sessionEntries: [finished], draftByIndex: { 1: { confirmedSets: [set, set] } } });
    const completed = completeWorkoutState(state({ logs: [finished.entry] }), run, summary, time);
    expect(completed.summary.workingSets).toBe(4);
    expect(completed.state.logs.map((l) => l.sets.length)).toEqual([2, 2]);
    expect(completed.state.logs.filter((l) => l.id === "finished")).toHaveLength(1);
  });
  it("keeps repeated identical sets as separate work, and repeated exercise slots separate", () => {
    const run = workout({ exercises: [{ exId: "bench" }, { exId: "bench" }], draftByIndex: { 0: { confirmedSets: [set, set] }, 1: { confirmedSets: [set] } } });
    const saved = collectConfirmedWorkout(run);
    expect(saved.sessionEntries.map((se) => se.entry.sets.length)).toEqual([2, 1]);
    expect(new Set(saved.sessionEntries.map((se) => se.entry.id)).size).toBe(2);
  });
  it("preserves swapped exercise and equipment identity", () => {
    const saved = collectConfirmedWorkout(workout({ swaps: { 0: "db_bench" }, draftByIndex: { 0: { confirmedSets: [set], equipmentProfileId: "machine", equipmentContext: "temporary_variant" } } }));
    expect(saved.sessionEntries[0].entry).toMatchObject({ exId: "db_bench", equipmentProfileId: "machine", equipmentContext: "temporary_variant" });
  });
  it("keeps a slot's log identity after another exercise is removed or inserted", () => {
    const original = workout({ exercises: [{ exId: "bench", workoutSlotId: "a" }, { exId: "squat", workoutSlotId: "b" }] });
    const shifted = { ...original, exercises: [original.exercises[1], { exId: "bench", workoutSlotId: "c" }] };
    expect(workoutLogId(shifted, 0)).toBe(workoutLogId(original, 1));
    expect(workoutLogId(shifted, 1)).not.toBe(workoutLogId(original, 1));
  });
  it("reconciles an interrupted exercise write with more saved sets without duplicating its log", () => {
    const run = workout();
    const priorEntry = collectConfirmedWorkout(run).sessionEntries[0].entry;
    run.draftByIndex[0] = stampWorkoutDraft(run, 0, { ...run.draftByIndex[0], confirmedSets: [set, set] }, [priorEntry]);
    const result = completeWorkoutState(state({ logs: [priorEntry, { id: "unrelated", sets: [set] }] }), run, summary);
    expect(result.state.logs).toHaveLength(2);
    expect(result.state.logs[0].sets).toHaveLength(2);
    expect(result.summary.workingSets).toBe(2);
    expect(result.state.logs[1]).toEqual({ id: "unrelated", sets: [set] });
  });
  it("resumes a serialized workout with the same IDs and confirmed data", () => {
    const run = workout(), restored = JSON.parse(JSON.stringify(run));
    expect(collectConfirmedWorkout(restored, time)).toEqual(collectConfirmedWorkout(run, time));
  });
  it("preserves unrelated historical sessions and logs unchanged", () => {
    const previous = state(), before = structuredClone(previous);
    const result = completeWorkoutState(previous, workout(), summary, time);
    expect(previous).toEqual(before);
    expect(result.state.workoutSessions[1]).toBe(previous.workoutSessions[0]);
    expect(result.state.logs[1]).toBe(previous.logs[0]);
  });
  it("preserves conflicting canonical corrections rather than silently choosing a stale snapshot", () => {
    const stale = { id: "log_run-1_0", exId: "bench", sets: [set] };
    const corrected = { ...stale, sets: [set, set], note: "latest correction" };
    const run = workout({ sessionEntries: [{ index: 0, entry: stale }], draftByIndex: {} });
    expect(() => completeWorkoutState(state({ logs: [corrected] }), run, summary)).toThrow("Both copies are preserved");
    expect(corrected.note).toBe("latest correction");
    expect(run.sessionEntries[0].entry.sets).toHaveLength(1);
  });
  it("retrying an unfinished checkpoint cannot duplicate history or advance a second time", () => {
    const run = workout(), first = completeWorkoutState(state(), run, summary, time);
    const retry = completeWorkoutState(first.state, run, summary, time);
    expect(retry.state).toBe(first.state);
    expect(retry.state.workoutSessions).toHaveLength(2);
    expect(retry.state.logs).toHaveLength(2);
    expect(retry.run.finished).toBe(true);
    expect(retry.run.draftByIndex).toEqual({});
  });
  it("reopening and finishing reuses existing promoted logs without duplicates", () => {
    const first = completeWorkoutState(state(), workout(), summary, time);
    const reopened = { ...first.run, finished: false, summaryId: null };
    const previous = { ...first.state, workoutSessions: first.state.workoutSessions.slice(1) };
    const second = completeWorkoutState(previous, reopened, summary, time);
    expect(second.state.logs).toHaveLength(first.state.logs.length);
    expect(second.summary.workingSets).toBe(1);
    expect(second.summary.id).toBe(first.summary.id);
  });
});

describe("program lifecycle boundaries", () => {
  it("does not reactivate an ended program but still completes its historical workout", () => {
    const result = completeWorkoutState(state({ currentProgram: null }), workout(), summary, time);
    expect(result.state.currentProgram).toBeNull(); expect(result.summary.workingSets).toBe(1);
    expect(result.run.programContext.programId).toBe("p");
  });
  it("does not replace a different active program", () => {
    const current = { ...assignment, programId: "different" };
    expect(advanceProgramForWorkout(state({ currentProgram: current }), workout()).currentProgram).toBe(current);
  });
  it("does not advance a new assignment of the same program", () => {
    const previous = state({ currentProgram: { ...assignment, startDate: "2026-10-30T13:00:00Z" } });
    expect(advanceProgramForWorkout(previous, workout())).toBe(previous);
  });
  it("does not overwrite progress changed after a workout started", () => {
    const run = workout();
    run.programContext.assignmentDayIndex = 0; run.programContext.assignmentLastCompletedAt = null;
    const previous = state({ currentProgram: { ...assignment, dayIndex: 1, lastCompletedAt: time } });
    const result = completeWorkoutState(previous, run, summary, time);
    expect(result.state.currentProgram).toBe(previous.currentProgram);
    expect(result.summary.workingSets).toBe(1);
  });
  it("retains live names and assignment metadata while advancing the matching assignment", () => {
    const previous = state({ currentProgram: { ...assignment, programName: "Renamed" } });
    expect(advanceProgramForWorkout(previous, workout(), time).currentProgram).toMatchObject({ programName: "Renamed", selectedForDays: 3, dayIndex: 1, startDate: assignment.startDate });
  });
  it.each(["fixed", "rolling"])("leaves %s schedule and its log untouched", (mode) => {
    const weeklySchedule = { mode, rollingCursor: 4, fixedDays: { mon: { type: "rest" } } }, scheduleLog = [{ date: "2026-10-29", kind: "skip" }];
    const result = completeWorkoutState(state({ weeklySchedule, scheduleLog }), workout(), summary, time);
    expect(result.state.weeklySchedule).toBe(weeklySchedule); expect(result.state.scheduleLog).toBe(scheduleLog);
  });
  it("only clears a matching program override", () => {
    const override = { programId: "different", source: "custom" };
    expect(advanceProgramForWorkout(state({ programDayOverride: override }), workout()).programDayOverride).toBe(override);
    expect(advanceProgramForWorkout(state({ programDayOverride: { programId: "p", source: "custom" } }), workout()).programDayOverride).toBeNull();
  });
  it("supports a legacy run only if its assignment predates the workout", () => {
    const run = workout(); delete run.programContext.assignmentStartDate;
    expect(advanceProgramForWorkout(state(), run).currentProgram.dayIndex).toBe(1);
    const previous = state({ currentProgram: { ...assignment, startDate: "2026-10-30T13:00:00Z" } });
    expect(advanceProgramForWorkout(previous, run)).toBe(previous);
  });
});

describe("completion storage ordering", () => {
  it("writes canonical history before retiring the recoverable checkpoint", () => {
    const values = {};
    const storage = { setItem: vi.fn((k, v) => { values[k] = v; }), getItem: (k) => values[k] || null };
    expect(writeWorkoutCompletion(storage, state(), workout({ finished: true }))).toBe(true);
    expect(storage.setItem.mock.calls.map(([key]) => key)).toEqual(["liftlog-data", "liftlog-active-run"]);
  });
  it("does not retire a draft when the main-state write fails", () => {
    const storage = { getItem: () => null, setItem: vi.fn(() => { throw new Error("quota"); }) };
    expect(() => writeWorkoutCompletion(storage, state(), workout())).toThrow("quota");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
  it("keeps durable history recoverable if writing the finished marker fails", () => {
    const values = {};
    const storage = { getItem: (k) => values[k] || null, setItem: (key, value) => { if (key === "liftlog-active-run") throw new Error("quota"); values[key] = value; } };
    const run = workout(), result = completeWorkoutState(state(), run, summary, time);
    expect(writeWorkoutCompletion(storage, result.state, result.run)).toBe(false);
    const retry = completeWorkoutState(JSON.parse(values["liftlog-data"]), JSON.parse(JSON.stringify(run)), summary, time);
    expect(retry.state.workoutSessions).toHaveLength(2); expect(retry.state.logs).toHaveLength(2);
  });
});
