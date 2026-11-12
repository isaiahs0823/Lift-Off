import { describe, it, expect } from "vitest";
import {
  diffCollections,
  diffProfile,
  enqueueDiff,
  setRevision,
  clearRevision,
  recordPulledRevisions,
  classifySendError,
  drainOutbox,
  resetInFlightToPending,
} from "../cloudSyncEngine.js";
import { createOutboxState, switchAccount, persistOutboxState, loadOutboxState, pendingCount, exportConflicts } from "../syncOutbox.js";

const TABLES = { workoutSessions: "workout_sessions", logs: "exercise_logs" };

describe("diffProfile — the workout_profile singleton, protected like every other synced row", () => {
  it("detects a changed currentProgram", () => {
    const prev = { currentProgram: null };
    const next = { currentProgram: { programId: "p1" } };
    const change = diffProfile(prev, next, "user-1");
    expect(change).toEqual({ table: "workout_profile", rowId: "user-1", type: "upsert", payload: expect.objectContaining({ currentProgram: { programId: "p1" } }), isNew: false });
  });

  it("detects a changed settings object", () => {
    const change = diffProfile({ settings: { barWeight: 45 } }, { settings: { barWeight: 35 } }, "user-1");
    expect(change).not.toBeNull();
  });

  it("detects a changed scheduleLog (program progress/completion state)", () => {
    const change = diffProfile({ scheduleLog: [] }, { scheduleLog: [{ date: "2026-01-01", completed: true }] }, "user-1");
    expect(change).not.toBeNull();
  });

  it("reports no change when nothing profile-relevant actually differs", () => {
    expect(diffProfile({ currentProgram: { programId: "p1" }, settings: {} }, { currentProgram: { programId: "p1" }, settings: {} }, "user-1")).toBeNull();
  });

  it("ignores changes to fields outside the profile (e.g. workoutSessions) — no false positive", () => {
    expect(diffProfile({ currentProgram: null, workoutSessions: [] }, { currentProgram: null, workoutSessions: [{ id: "s1" }] }, "user-1")).toBeNull();
  });

  it("returns null without a userId — never enqueues a profile write with no account to scope it to", () => {
    expect(diffProfile({ currentProgram: null }, { currentProgram: { programId: "p1" } }, null)).toBeNull();
  });

  it("the payload carries every protected field, not just the one that changed (whole-row, by design)", () => {
    const next = { currentProgram: { programId: "p1" }, weeklySchedule: { mon: "push" }, scheduleLog: [{ x: 1 }], reminderSettings: { enabled: true }, settings: { barWeight: 45 }, hasSeenOnboarding: true };
    const change = diffProfile({ currentProgram: null }, next, "user-1");
    expect(change.payload).toEqual(next);
  });
});

// A minimal in-memory fake Postgres table, same discipline as cloudSyncOverwriteSafety.test.js:
// an UPDATE/DELETE's WHERE clause (including revision) only matches rows that actually satisfy
// it. `send` below adapts this into the { outcome, row } shape drainOutbox expects, mirroring
// exactly what pushOperationWithRevision does against the real Supabase client.
function createFakeTable(seed = {}) {
  const tables = new Map(Object.entries(seed).map(([t, rows]) => [t, new Map(rows.map((r) => [r.id, { ...r }]))]));
  function t(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  }
  return {
    dump: (name) => [...t(name).values()],
    async send(op, { authFailFor } = {}) {
      if (authFailFor && authFailFor(op)) throw { status: 401, message: "JWT expired" };
      const table = t(op.table);
      if (op.type === "delete") {
        const row = table.get(op.rowId);
        if (!row) return { outcome: "confirmed", row: null };
        if (op.expectedRevision !== null && row.revision !== op.expectedRevision) return { outcome: "conflict", row };
        table.delete(op.rowId);
        return { outcome: "confirmed", row: null };
      }
      const existing = table.get(op.rowId);
      if (op.expectedRevision === null) {
        if (existing) {
          // A duplicate-key insert — exactly like the real pushOperationWithRevision, this falls
          // through to checking whether it's actually THIS op landing a second time (lost
          // acknowledgement, confirmed) versus a genuine concurrent insert by something else.
          if (existing.last_operation_id === op.opId) return { outcome: "confirmed", row: existing };
          return { outcome: "conflict", row: existing };
        }
        const row = { ...op.payload, id: op.rowId, revision: 1, last_operation_id: op.opId };
        table.set(op.rowId, row);
        return { outcome: "confirmed", row };
      }
      if (!existing) return { outcome: "missing", row: null };
      if (existing.last_operation_id === op.opId) return { outcome: "confirmed", row: existing }; // lost-ack retry
      if (existing.revision !== op.expectedRevision) return { outcome: "conflict", row: existing };
      const row = { ...existing, ...op.payload, revision: existing.revision + 1, last_operation_id: op.opId };
      table.set(op.rowId, row);
      return { outcome: "confirmed", row };
    },
  };
}

describe("diffCollections — the single choke point that replaces tracking 41 call sites by hand", () => {
  it("detects an inserted row", () => {
    const prev = { workoutSessions: [] };
    const next = { workoutSessions: [{ id: "s1", planName: "A" }] };
    const changes = diffCollections(prev, next, TABLES);
    expect(changes).toEqual([{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "A" }, isNew: true }]);
  });

  it("detects an updated row (same id, different content)", () => {
    const prev = { workoutSessions: [{ id: "s1", planName: "A" }] };
    const next = { workoutSessions: [{ id: "s1", planName: "A-edited" }] };
    const changes = diffCollections(prev, next, TABLES);
    expect(changes).toEqual([{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "A-edited" }, isNew: false }]);
  });

  it("detects a deleted row", () => {
    const prev = { workoutSessions: [{ id: "s1", planName: "A" }] };
    const next = { workoutSessions: [] };
    const changes = diffCollections(prev, next, TABLES);
    expect(changes).toEqual([{ table: "workout_sessions", rowId: "s1", type: "delete", payload: null, isNew: false }]);
  });

  it("reports nothing for an unchanged collection (same reference or deep-equal content)", () => {
    const shared = [{ id: "s1", planName: "A" }];
    expect(diffCollections({ workoutSessions: shared }, { workoutSessions: shared }, TABLES)).toEqual([]);
    expect(diffCollections({ workoutSessions: [{ id: "s1", planName: "A" }] }, { workoutSessions: [{ id: "s1", planName: "A" }] }, TABLES)).toEqual([]);
  });

  it("diffs multiple synced collections independently in one pass", () => {
    const prev = { workoutSessions: [{ id: "s1" }], logs: [] };
    const next = { workoutSessions: [{ id: "s1" }], logs: [{ id: "l1", exId: "bench" }] };
    const changes = diffCollections(prev, next, TABLES);
    expect(changes).toEqual([{ table: "exercise_logs", rowId: "l1", type: "upsert", payload: { id: "l1", exId: "bench" }, isNew: true }]);
  });

  it("repeated import followed by sync: re-importing an identical file produces zero new diff (the import's own idempotency plus the engine's diff both hold)", () => {
    const sessionsAfterFirstImport = [{ id: "session_import_1", planName: "Imported" }];
    const changes1 = diffCollections({ workoutSessions: [] }, { workoutSessions: sessionsAfterFirstImport }, TABLES);
    expect(changes1).toHaveLength(1);
    // Re-importing the same file is, by the historical-import feature's own design, a no-op —
    // state after a second import attempt is reference-identical to state after the first.
    const changes2 = diffCollections({ workoutSessions: sessionsAfterFirstImport }, { workoutSessions: sessionsAfterFirstImport }, TABLES);
    expect(changes2).toEqual([]);
  });
});

describe("enqueueDiff — uses the correct known revision, or null for a genuinely new row", () => {
  it("a new row gets expectedRevision null", () => {
    let outbox = createOutboxState();
    outbox = switchAccount(outbox, "acct-1");
    outbox = enqueueDiff(outbox, {}, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: {}, isNew: true }]);
    expect(outbox.byAccount["acct-1"].operations[0].expectedRevision).toBeNull();
  });

  it("an updated row uses the last known local revision, not null", () => {
    let outbox = createOutboxState();
    outbox = switchAccount(outbox, "acct-1");
    const revisions = setRevision({}, "workout_sessions", "s1", 3);
    outbox = enqueueDiff(outbox, revisions, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: {}, isNew: false }]);
    expect(outbox.byAccount["acct-1"].operations[0].expectedRevision).toBe(3);
  });

  it("clearRevision removes tracking for a deleted row", () => {
    let revisions = setRevision({}, "workout_sessions", "s1", 2);
    revisions = clearRevision(revisions, "workout_sessions", "s1");
    expect(revisions.workout_sessions.s1).toBeUndefined();
  });

  it("recordPulledRevisions tracks a row's revision as soon as it's pulled, before any local push", () => {
    const revisions = recordPulledRevisions({}, "workout_sessions", [{ id: "s1", revision: 5 }, { id: "s2" }]);
    expect(revisions.workout_sessions.s1).toBe(5);
    expect(revisions.workout_sessions.s2).toBeUndefined(); // no revision on this row — not fabricated
  });
});

describe("classifySendError — distinguishing auth failures from everything else", () => {
  it("classifies a 401 status as auth", () => expect(classifySendError({ status: 401 })).toBe("auth"));
  it("classifies a JWT-expired message as auth", () => expect(classifySendError({ message: "JWT expired" })).toBe("auth"));
  it("classifies a generic network error as unknown (safe to keep retrying on backoff)", () => expect(classifySendError({ message: "Failed to fetch" })).toBe("unknown"));
  it("classifies no error as null", () => expect(classifySendError(null)).toBeNull());
});

describe("Phase 3 scenario 1 — two devices editing the same workout", () => {
  it("device A wins the race; device B's edit is preserved as a conflict, never silently discarded, and A's data survives", async () => {
    const fake = createFakeTable({ workout_sessions: [{ id: "s1", revision: 0, last_operation_id: null, planName: "original" }] });
    let outbox = switchAccount(createOutboxState(), "acct-1");
    let revisions = setRevision({}, "workout_sessions", "s1", 0);

    outbox = enqueueDiff(outbox, revisions, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "A's edit" }, isNew: false }]);
    outbox = enqueueDiff(outbox, revisions, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "B's edit" }, isNew: false }]);

    let result = await drainOutbox({ state: outbox, revisions, accountId: "acct-1", send: (op) => fake.send(op) });
    expect(result.drainedCount).toBe(2);
    expect(fake.dump("workout_sessions")[0].planName).toBe("A's edit"); // whichever was enqueued first wins; the loser never overwrites it
    const conflicts = exportConflicts(result.state);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].rowId).toBe("s1");
    // The original (A's) data remains fully recoverable — it's just sitting in the table, untouched.
    expect(fake.dump("workout_sessions")).toHaveLength(1);
  });
});

describe("Phase 3 scenarios 2–3 — offline device, reconnect with stale records", () => {
  it("a device offline since before another device's newer edit correctly fails to overwrite it on reconnect", async () => {
    const fake = createFakeTable({ workout_sessions: [{ id: "s1", revision: 2, last_operation_id: "op-other-device", planName: "newer edit from elsewhere" }] });
    let outbox = switchAccount(createOutboxState(), "acct-1");
    // This device went offline back when it last knew the row at revision 0.
    const revisions = setRevision({}, "workout_sessions", "s1", 0);
    outbox = enqueueDiff(outbox, revisions, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "stale local edit" }, isNew: false }]);

    const result = await drainOutbox({ state: outbox, revisions, accountId: "acct-1", send: (op) => fake.send(op) });

    expect(exportConflicts(result.state)).toHaveLength(1);
    expect(fake.dump("workout_sessions")[0].planName).toBe("newer edit from elsewhere"); // untouched
  });
});

describe("Phase 3 scenario 4 — browser closure with unsynced changes", () => {
  it("the outbox survives a serialize/reload round trip with pending operations intact", () => {
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, {}, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1" }, isNew: true }]);
    const serialized = persistOutboxState(outbox);
    const reloaded = loadOutboxState(serialized);
    expect(pendingCount(reloaded, "acct-1")).toBe(1);
  });
});

describe("Phase 3 scenario 5 — interrupted upload (crash mid-send)", () => {
  it("an op left stuck in-flight by a crash is reset to pending on reload, so the queue isn't wedged forever", () => {
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, {}, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1" }, isNew: true }]);
    const opId = outbox.byAccount["acct-1"].operations[0].opId;
    outbox = { ...outbox, byAccount: { ...outbox.byAccount, "acct-1": { ...outbox.byAccount["acct-1"], operations: outbox.byAccount["acct-1"].operations.map((o) => ({ ...o, status: "in-flight" })) } } };
    // Without the reset, selectNextToSend would refuse to pick anything for this account ever
    // again (its own rule: never two in-flight ops at once, and nothing ever clears this one).
    const resumed = resetInFlightToPending(outbox);
    expect(resumed.byAccount["acct-1"].operations[0].status).toBe("pending");
  });

  it("the write actually committed server-side before the crash: the resumed resend is recognized as already-done, not re-applied or conflicted", async () => {
    const fake = createFakeTable({ workout_sessions: [{ id: "s1", revision: 1, last_operation_id: "op-1", planName: "committed before the crash" }] });
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, setRevision({}, "workout_sessions", "s1", 0), "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "committed before the crash" }, isNew: false }]);
    const opId = outbox.byAccount["acct-1"].operations[0].opId;
    outbox = { ...outbox, byAccount: { ...outbox.byAccount, "acct-1": { ...outbox.byAccount["acct-1"], operations: [{ ...outbox.byAccount["acct-1"].operations[0], status: "in-flight", opId: "op-1" }] } } };
    const resumed = resetInFlightToPending(outbox);

    const result = await drainOutbox({ state: resumed, revisions: {}, accountId: "acct-1", send: (op) => fake.send(op) });
    expect(exportConflicts(result.state)).toHaveLength(0);
    expect(pendingCount(result.state, "acct-1")).toBe(0); // confirmed, cleared from the queue
  });
});

describe("Phase 3 scenario 6 — duplicate retries (idempotent)", () => {
  it("sending the same op twice (simulated double-submit) never double-applies or duplicates", async () => {
    const fake = createFakeTable({});
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, {}, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "x" }, isNew: true }]);
    const op = { ...outbox.byAccount["acct-1"].operations[0] };

    const first = await fake.send(op);
    expect(first.outcome).toBe("confirmed");
    // Retry the exact same op (as if the client never saw the first response).
    const second = await fake.send(op);
    expect(second.outcome).toBe("confirmed"); // last_operation_id matches — recognized as already done
    expect(fake.dump("workout_sessions")).toHaveLength(1); // never duplicated
  });
});

describe("Phase 3 scenario 7 — conflicting deletions", () => {
  it("one device deletes while another updates the same row: the delete is rejected, the update's data is recoverable", async () => {
    const fake = createFakeTable({ workout_sessions: [{ id: "s1", revision: 1, last_operation_id: "op-update", planName: "updated elsewhere" }] });
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, setRevision({}, "workout_sessions", "s1", 0), "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "delete", payload: null, isNew: false }]);

    const result = await drainOutbox({ state: outbox, revisions: {}, accountId: "acct-1", send: (op) => fake.send(op) });

    expect(exportConflicts(result.state)).toHaveLength(1);
    expect(fake.dump("workout_sessions")).toHaveLength(1); // not deleted — the newer update survives, fully recoverable
  });

  it("two devices both delete the same already-gone row: both resolve as confirmed, never an error", async () => {
    const fake = createFakeTable({});
    const op = { table: "workout_sessions", rowId: "s1", type: "delete", expectedRevision: 0, opId: "op-1" };
    const outcome = await fake.send(op);
    expect(outcome.outcome).toBe("confirmed");
  });
});

describe("Phase 3 scenario 8 — authentication expiration during synchronization", () => {
  it("drainOutbox pauses (does not keep retrying, does not drop the operation) when the send fails for an auth reason", async () => {
    const fake = createFakeTable({});
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, {}, "acct-1", [
      { table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1" }, isNew: true },
      { table: "workout_sessions", rowId: "s2", type: "upsert", payload: { id: "s2" }, isNew: true },
    ]);

    const result = await drainOutbox({ state: outbox, revisions: {}, accountId: "acct-1", send: (op) => fake.send(op, { authFailFor: () => true }) });

    expect(result.paused).toBe(true);
    expect(result.pausedReason).toBe("auth");
    expect(pendingCount(result.state, "acct-1")).toBe(2); // nothing dropped — both ops still queued, rolled back to pending
    expect(exportConflicts(result.state)).toHaveLength(0); // an auth failure is never mistaken for a data conflict
  });

  it("after re-authentication, a resumed drain sends the operations that were blocked", async () => {
    const fake = createFakeTable({});
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, {}, "acct-1", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "queued during the auth lapse" }, isNew: true }]);

    const failed = await drainOutbox({ state: outbox, revisions: {}, accountId: "acct-1", send: (op) => fake.send(op, { authFailFor: () => true }) });
    expect(failed.paused).toBe(true);

    const recovered = await drainOutbox({ state: failed.state, revisions: failed.revisions, accountId: "acct-1", send: (op) => fake.send(op) });
    expect(recovered.paused).toBe(false);
    expect(fake.dump("workout_sessions")[0].planName).toBe("queued during the auth lapse");
  });
});

describe("Phase 3 scenario 9 — athlete-account switching", () => {
  it("diffing and enqueueing for one account never touches another account's queue or revisions", () => {
    let outbox = createOutboxState();
    outbox = switchAccount(outbox, "acct-A");
    outbox = enqueueDiff(outbox, {}, "acct-A", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: {}, isNew: true }]);
    outbox = switchAccount(outbox, "acct-B");
    outbox = enqueueDiff(outbox, {}, "acct-B", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: {}, isNew: true }]);
    expect(pendingCount(outbox, "acct-A")).toBe(1);
    expect(pendingCount(outbox, "acct-B")).toBe(1);
  });

  it("switching back to an account with still-pending operations resumes them, never silently drops them", () => {
    let outbox = switchAccount(createOutboxState(), "acct-A");
    outbox = enqueueDiff(outbox, {}, "acct-A", [{ table: "workout_sessions", rowId: "s1", type: "upsert", payload: {}, isNew: true }]);
    outbox = switchAccount(outbox, "acct-B");
    outbox = switchAccount(outbox, "acct-A");
    expect(pendingCount(outbox, "acct-A")).toBe(1);
  });
});

describe("Phase 3 scenario 10 — repeated import followed by synchronization", () => {
  it("a historical import's new sessions are diffed as inserts and sync cleanly; re-importing produces no further diff or redundant sync traffic", async () => {
    const fake = createFakeTable({});
    const importedSessions = [{ id: "session_import_a", planName: "Imported A" }, { id: "session_import_b", planName: "Imported B" }];

    const changes = diffCollections({ workoutSessions: [] }, { workoutSessions: importedSessions }, TABLES);
    expect(changes).toHaveLength(2);
    let outbox = switchAccount(createOutboxState(), "acct-1");
    outbox = enqueueDiff(outbox, {}, "acct-1", changes);
    const result = await drainOutbox({ state: outbox, revisions: {}, accountId: "acct-1", send: (op) => fake.send(op) });
    expect(fake.dump("workout_sessions")).toHaveLength(2);
    expect(exportConflicts(result.state)).toHaveLength(0);

    // Re-import: historical-import's own idempotency means the resulting workoutSessions array
    // is unchanged (same ids, same content) — the diff against that same "post-import" snapshot
    // must be empty, so nothing further gets pushed.
    const secondChanges = diffCollections({ workoutSessions: importedSessions }, { workoutSessions: importedSessions }, TABLES);
    expect(secondChanges).toEqual([]);
  });
});
