import { describe, it, expect } from "vitest";
import { collectConfirmedWorkout, completeWorkoutState, stampWorkoutDraft, recoverWorkoutCheckpoint, writeWorkoutCompletion, workoutEntryKey } from "../workoutIntegrity.js";

const set = { weight: 100, reps: 8, rir: 2, drops: [{ weight: 80, reps: 3 }] };
const oldSession = { id: "previous-session", entries: [], note: "preserve existing history" };
const oldLog = { id: "previous-log", exId: "squat", sets: [set] };
const base = () => ({ logs: [oldLog], workoutSessions: [oldSession], currentProgram: null });
const run = () => ({ id: "recovery", planName: "Synthetic", exercises: [{ exId: "bench", workoutSlotId: "a" }], swaps: {}, sessionEntries: [], draftByIndex: {}, finished: false });
const summary = (r) => ({ workingSets: r.sessionEntries.reduce((n, se) => n + se.entry.sets.length, 0), entries: r.sessionEntries.map((se) => se.entry) });
function save(r, sets, logs = []) {
  return { ...r, draftByIndex: { 0: stampWorkoutDraft(r, 0, { confirmedSets: sets, reps: 8, updatedAt: "2026-10-30T12:00:00Z" }, logs) } };
}
const checkpoint = (result, original) => ({ ...result.run, finished: false, draftByIndex: original.draftByIndex, completionPending: true });
function memory(initial) {
  const values = { "liftlog-data": JSON.stringify(initial) };
  return { values, getItem: (key) => values[key] || null, setItem: (key, value) => { values[key] = value; } };
}
function twoVersions() {
  const first = save(run(), [set]);
  const canonical = collectConfirmedWorkout(first).sessionEntries[0].entry;
  const next = save(first, [set, set], [canonical]);
  return { canonical, next, state: { ...base(), logs: [canonical, oldLog] } };
}

describe("checkpoint authority and whole-record recovery", () => {
  it("keeps the newer checkpoint after the combined interrupted exercise and failed history writes", () => {
    const { state, next } = twoVersions();
    const attempt = completeWorkoutState(state, next, summary);
    const pending = JSON.parse(JSON.stringify(checkpoint(attempt, next)));
    const retry = completeWorkoutState(state, pending, summary);
    expect(retry.summary.workingSets).toBe(2);
    expect(retry.state.logs.filter((l) => l.id === pending.sessionEntries[0].entry.id)).toHaveLength(1);
    expect(retry.state.logs[0].sets).toEqual([set, set]);
    expect(retry.state.workoutSessions[1]).toBe(oldSession);
    expect(retry.state.logs[1]).toBe(oldLog);
  });
  it("does not concatenate overlapping sets or erase intentional identical repetitions", () => {
    const { state, next } = twoVersions();
    const result = completeWorkoutState(state, next, summary);
    expect(result.state.logs[0].sets).toEqual([set, set]); // not 1 and not 3
  });
  it("supports multiple sequential failed completions, reloads, and retries", () => {
    const { state, next } = twoVersions();
    let pending = next;
    for (let attempt = 0; attempt < 4; attempt++) {
      const result = completeWorkoutState(state, pending, summary);
      const storage = memory(state);
      storage.setItem = () => { throw new Error("unavailable"); };
      expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("unavailable");
      pending = JSON.parse(JSON.stringify(checkpoint(result, pending)));
      pending = recoverWorkoutCheckpoint(state, pending);
      expect(pending.finished).toBe(false);
    }
    const recovered = completeWorkoutState(state, pending, summary);
    const again = completeWorkoutState(recovered.state, pending, summary);
    expect(again.state).toBe(recovered.state);
    expect(again.summary.workingSets).toBe(2);
    expect(again.state.workoutSessions).toHaveLength(2);
  });
  it("accepts any recorded predecessor, not only the immediately previous failed revision", () => {
    const { state, next } = twoVersions();
    const third = save(next, [set, set, { ...set, weight: 120 }], state.logs);
    expect(completeWorkoutState(state, third, summary).summary.workingSets).toBe(3);
  });
  it("preserves deliberate edits and deletions as a whole snapshot", () => {
    const { state, next } = twoVersions();
    const edited = save(next, [{ ...set, weight: 110 }], state.logs);
    expect(completeWorkoutState(state, edited, summary).state.logs[0].sets).toEqual([{ ...set, weight: 110 }]);
  });
  it("does not infer authority from timestamps", () => {
    const { canonical, state, next } = twoVersions();
    canonical.date = "2099-01-01";
    next.draftByIndex[0].entryDate = "2000-01-01";
    expect(completeWorkoutState(state, next, summary).summary.workingSets).toBe(2);
  });
  it("normalizes object key order but retains set order and metadata", () => {
    expect(workoutEntryKey({ id: "a", sets: [set], exId: "bench" })).toBe(workoutEntryKey({ exId: "bench", sets: [set], id: "a" }));
    const { state, next } = twoVersions();
    next.draftByIndex[0].equipmentProfileId = "profile";
    next.draftByIndex[0].jointNote = { note: "keep this" };
    const result = completeWorkoutState(state, next, summary);
    expect(result.run.sessionEntries[0].entry).toMatchObject({ equipmentProfileId: "profile", jointNote: { note: "keep this" } });
    expect(result.summary.id).toBe("session_recovery");
  });
  it("rejects unrelated canonical edits and retains both full copies", () => {
    const { state, next } = twoVersions();
    state.logs[0] = { ...state.logs[0], sets: [{ ...set, weight: 999 }], note: "external correction" };
    const before = structuredClone({ state, next });
    try { completeWorkoutState(state, next, summary); throw new Error("should conflict"); }
    catch (error) {
      expect(error.code).toBe("WORKOUT_RECOVERY_CONFLICT");
      expect(error.records.canonical.note).toBe("external correction");
      expect(error.records.checkpoint.sets).toHaveLength(2);
    }
    expect({ state, next }).toEqual(before);
  });
  it("blocks a longer canonical record of unknown lineage rather than dropping either version", () => {
    const { state, next } = twoVersions();
    state.logs[0] = { ...state.logs[0], sets: [set, set, set] };
    expect(() => completeWorkoutState(state, next, summary)).toThrow("Both copies are preserved");
  });
  it("rejects conflicting duplicates for a single workout slot", () => {
    const r = save(run(), [set]);
    const entry = collectConfirmedWorkout(r).sessionEntries[0].entry;
    r.sessionEntries = [{ index: 0, entry }, { index: 0, entry: { ...entry, sets: [set, set] } }];
    expect(() => completeWorkoutState(base(), r, summary)).toThrow("Both copies are preserved");
  });
  it("rejects different exercise slots sharing a log ID instead of counting or overwriting them", () => {
    const r = save(run(), [set]);
    const entry = collectConfirmedWorkout(r).sessionEntries[0].entry;
    r.exercises.push({ exId: "bench", workoutSlotId: "a" });
    r.draftByIndex = {}; r.sessionEntries = [{ index: 0, entry }, { index: 1, entry }];
    expect(() => completeWorkoutState(base(), r, summary)).toThrow("share one log ID");
  });
  it("does not guess that an ambiguous legacy checkpoint is newer just because it has more sets", () => {
    const { state, next } = twoVersions();
    const legacy = { ...next, summaryId: "session_recovery", sessionEntries: collectConfirmedWorkout(next).sessionEntries };
    legacy.draftByIndex[0].recoveryBases = [];
    legacy.sessionEntries[0].recoveryBases = [];
    expect(() => completeWorkoutState(state, legacy, summary)).toThrow("Both copies are preserved");
    expect(legacy.draftByIndex[0].confirmedSets).toHaveLength(2);
  });
  it("does not silently ignore an unknown leftover draft with different confirmed sets", () => {
    const r = save(run(), [set, set, set]);
    const entry = collectConfirmedWorkout(r).sessionEntries[0].entry;
    r.sessionEntries = [{ index: 0, entry: { ...entry, sets: [set] } }];
    expect(() => completeWorkoutState(base(), r, summary)).toThrow("Both copies are preserved");
    expect(r.draftByIndex[0].confirmedSets).toHaveLength(3);
    expect(r.sessionEntries[0].entry.sets).toHaveLength(1);
  });
  it("does not trust session-ID existence when the stored receipt has fewer sets", () => {
    const { state, next } = twoVersions();
    const result = completeWorkoutState(state, next, summary);
    const pending = checkpoint(result, next);
    const damaged = { ...result.state, workoutSessions: [{ ...result.summary, entries: [{ ...result.summary.entries[0], sets: [set] }] }, oldSession] };
    expect(() => recoverWorkoutCheckpoint(damaged, pending)).toThrow("does not match");
    expect(pending.draftByIndex[0].confirmedSets).toHaveLength(2);
  });
  it("does not clear a checkpoint when an otherwise matching session is missing its canonical log", () => {
    const { state, next } = twoVersions();
    const result = completeWorkoutState(state, next, summary);
    expect(() => recoverWorkoutCheckpoint({ ...result.state, logs: [oldLog] }, checkpoint(result, next))).toThrow("missing a matching exercise log");
  });
  it("does not clear a checkpoint with a mismatching completed total", () => {
    const { state, next } = twoVersions();
    const result = completeWorkoutState(state, next, summary);
    const damaged = { ...result.state, workoutSessions: [{ ...result.summary, workingSets: 1 }, oldSession] };
    expect(() => recoverWorkoutCheckpoint(damaged, checkpoint(result, next))).toThrow("completion receipt");
  });
  it("verifies a matching durable receipt before retiring a checkpoint", () => {
    const { state, next } = twoVersions();
    const result = completeWorkoutState(state, next, summary);
    const recovered = recoverWorkoutCheckpoint(result.state, checkpoint(result, next));
    expect(recovered.finished).toBe(true); expect(recovered.draftByIndex).toEqual({});
  });
});

describe("durable completion verification", () => {
  it("retains an active checkpoint if reading storage becomes unavailable", () => {
    const { state, next } = twoVersions(), result = completeWorkoutState(state, next, summary);
    const storage = { getItem: () => { throw new Error("read unavailable"); }, setItem: () => { throw new Error("must not write"); } };
    expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("read unavailable");
    expect(next.draftByIndex[0].confirmedSets).toHaveLength(2);
  });
  it("does not retire a checkpoint if canonical read-back does not match", () => {
    const { state, next } = twoVersions(), result = completeWorkoutState(state, next, summary);
    let writes = 0;
    const raw = JSON.stringify(state);
    const storage = { getItem: () => raw, setItem: () => { writes++; } };
    expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("could not be verified");
    expect(writes).toBe(1);
  });
  it("does not retire a checkpoint if storage throws during read-back", () => {
    const { state, next } = twoVersions(), result = completeWorkoutState(state, next, summary);
    let reads = 0, writes = 0;
    const storage = { getItem: () => { if (reads++) throw new Error("read-back unavailable"); return JSON.stringify(state); }, setItem: () => { writes++; } };
    expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("read-back unavailable");
    expect(writes).toBe(1);
  });
  it("checks actual durable log versions before replacing them", () => {
    const { state, next } = twoVersions(), result = completeWorkoutState(state, next, summary);
    const changed = { ...state, logs: [{ ...state.logs[0], sets: [{ ...set, weight: 777 }] }, oldLog] };
    const storage = memory(changed), before = storage.values["liftlog-data"];
    expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("Both copies are preserved");
    expect(storage.values["liftlog-data"]).toBe(before);
    expect(storage.values["liftlog-active-run"]).toBeUndefined();
  });
  it("checks every durable duplicate rather than ignoring an unknown conflicting copy", () => {
    const { state, next } = twoVersions(), result = completeWorkoutState(state, next, summary);
    const storage = memory({ ...state, logs: [state.logs[0], { ...state.logs[0], sets: [{ ...set, weight: 777 }] }, oldLog] });
    const before = storage.values["liftlog-data"];
    expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("Both copies are preserved");
    expect(storage.values["liftlog-data"]).toBe(before);
  });
  it("rejects changes to unrelated completed history instead of overwriting them", () => {
    const { state, next } = twoVersions(), result = completeWorkoutState(state, next, summary);
    const storage = memory({ ...state, workoutSessions: [{ ...oldSession, note: "other writer" }] });
    expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("Stored workout history changed");
    expect(JSON.parse(storage.values["liftlog-data"]).workoutSessions[0].note).toBe("other writer");
  });
  it("preserves changed durable date metadata instead of ordering records by that date", () => {
    const { state, next } = twoVersions(), result = completeWorkoutState(state, next, summary);
    const storage = memory({ ...state, logs: [{ ...state.logs[0], date: "2099-01-01" }, oldLog] });
    expect(() => writeWorkoutCompletion(storage, result.state, result.run)).toThrow("date metadata changed");
    expect(JSON.parse(storage.values["liftlog-data"]).logs[0].date).toBe("2099-01-01");
  });
});
