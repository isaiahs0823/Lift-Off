import { describe, it, expect } from "vitest";
import {
  createOutboxState,
  switchAccount,
  enqueueOperation,
  markInFlight,
  reconcileRetryOutcome,
  applyServerResult,
  selectNextToSend,
  pendingCount,
  exportConflicts,
  validateCloudRecord,
  downloadAllPages,
  nextRetryDelayMs,
} from "../syncOutbox.js";

function enqueue(state, overrides = {}) {
  return enqueueOperation(state, { accountId: "acct-a", table: "workout_sessions", rowId: "row-1", type: "upsert", payload: { note: "x" }, expectedRevision: 0, ...overrides });
}

describe("account queues", () => {
  it("keeps a separate queue per account", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state);
    state = switchAccount(state, "acct-b");
    expect(pendingCount(state, "acct-a")).toBe(1);
    expect(pendingCount(state, "acct-b")).toBe(0);
  });

  it("never drops the outgoing account's pending operations on switch", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state);
    state = switchAccount(state, "acct-b");
    state = switchAccount(state, "acct-a");
    expect(pendingCount(state, "acct-a")).toBe(1);
  });

  it("bumps generation on every switch", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    const gen1 = state.generation;
    state = switchAccount(state, "acct-b");
    expect(state.generation).toBe(gen1 + 1);
  });
});

describe("generation fencing for async callbacks", () => {
  it("flags a response that lands after the account changed as not for the active UI", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1" });
    const op = state.byAccount["acct-a"].operations[0];
    state = switchAccount(state, "acct-b"); // account changed while op-1 was in flight
    const { shouldUpdateActiveUI } = applyServerResult(state, op, "confirmed");
    expect(shouldUpdateActiveUI).toBe(false);
  });

  it("still books the result against the correct (now inactive) account", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1" });
    const op = state.byAccount["acct-a"].operations[0];
    state = switchAccount(state, "acct-b");
    const { state: next } = applyServerResult(state, op, "confirmed");
    expect(pendingCount(next, "acct-a")).toBe(0);
  });

  it("flags a response for the still-active account/generation as safe to reflect in the UI", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1" });
    const op = state.byAccount["acct-a"].operations[0];
    const { shouldUpdateActiveUI } = applyServerResult(state, op, "confirmed");
    expect(shouldUpdateActiveUI).toBe(true);
  });
});

describe("idempotent retries / lost-acknowledgement recovery", () => {
  it("treats a resend whose write already landed as confirmed, not a conflict", () => {
    const op = { opId: "op-1", type: "upsert", expectedRevision: 0 };
    const outcome = reconcileRetryOutcome(op, { updatedRow: null, currentRow: { revision: 1, last_operation_id: "op-1" } });
    expect(outcome.outcome).toBe("confirmed");
  });

  it("treats someone else's change at the expected revision as a genuine conflict", () => {
    const op = { opId: "op-1", type: "upsert", expectedRevision: 0 };
    const outcome = reconcileRetryOutcome(op, { updatedRow: null, currentRow: { revision: 1, last_operation_id: "some-other-op" } });
    expect(outcome.outcome).toBe("conflict");
  });

  it("treats a straightforward successful update as confirmed", () => {
    const op = { opId: "op-1", type: "upsert", expectedRevision: 0 };
    const outcome = reconcileRetryOutcome(op, { updatedRow: { revision: 1, last_operation_id: "op-1" }, currentRow: null });
    expect(outcome.outcome).toBe("confirmed");
  });

  it("retries (not conflicts) a transient failure at the same expected revision with no committed row", () => {
    const op = { opId: "op-1", type: "upsert", expectedRevision: 0 };
    const outcome = reconcileRetryOutcome(op, { updatedRow: null, currentRow: { revision: 0, last_operation_id: "some-other-op" } });
    expect(outcome.outcome).toBe("retry");
  });

  it("treats a delete whose target row is already gone as confirmed", () => {
    const op = { opId: "op-1", type: "delete", expectedRevision: 0 };
    const outcome = reconcileRetryOutcome(op, { updatedRow: null, currentRow: null });
    expect(outcome.outcome).toBe("confirmed");
  });

  it("flags a missing row on a non-delete op for investigation rather than silently dropping it", () => {
    const op = { opId: "op-1", type: "upsert", expectedRevision: 0 };
    const outcome = reconcileRetryOutcome(op, { updatedRow: null, currentRow: null });
    expect(outcome.outcome).toBe("missing");
  });
});

describe("conflicts are preserved for review, never auto-resolved", () => {
  it("moves a conflicting op out of the queue and into that account's conflict list", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1" });
    const op = state.byAccount["acct-a"].operations[0];
    const { state: next } = applyServerResult(state, op, "conflict");
    expect(pendingCount(next, "acct-a")).toBe(0);
    expect(next.byAccount["acct-a"].conflicts).toHaveLength(1);
  });

  it("exports conflicts across every account, tagged with which account they belong to", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1" });
    const op = state.byAccount["acct-a"].operations[0];
    const { state: next } = applyServerResult(state, op, "conflict");
    const exported = exportConflicts(next);
    expect(exported).toHaveLength(1);
    expect(exported[0].accountId).toBe("acct-a");
  });
});

describe("serialized uploads", () => {
  it("never selects a second op while one is in flight for the same account", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1" });
    state = enqueue(state, { opId: "op-2" });
    state = markInFlight(state, "acct-a", "op-1");
    expect(selectNextToSend(state, "acct-a")).toBeNull();
  });

  it("picks the oldest ready pending op", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1", now: "2026-01-01T00:00:00Z" });
    state = enqueue(state, { opId: "op-2", now: "2026-01-01T00:01:00Z" });
    expect(selectNextToSend(state, "acct-a").opId).toBe("op-1");
  });

  it("skips an op still inside its backoff window", () => {
    let state = createOutboxState();
    state = switchAccount(state, "acct-a");
    state = enqueue(state, { opId: "op-1" });
    const future = new Date(Date.now() + 60_000).toISOString();
    state = { ...state, byAccount: { "acct-a": { ...state.byAccount["acct-a"], operations: state.byAccount["acct-a"].operations.map((o) => ({ ...o, nextRetryAt: future })) } } };
    expect(selectNextToSend(state, "acct-a")).toBeNull();
  });
});

describe("retry backoff", () => {
  it("grows exponentially and caps out", () => {
    expect(nextRetryDelayMs(0)).toBe(1000);
    expect(nextRetryDelayMs(1)).toBe(2000);
    expect(nextRetryDelayMs(2)).toBe(4000);
    expect(nextRetryDelayMs(20)).toBe(5 * 60 * 1000);
  });
});

describe("cloud record validation", () => {
  it("rejects a record with no id", () => {
    expect(validateCloudRecord({ note: "x" }, []).valid).toBe(false);
  });

  it("rejects a record missing a required key", () => {
    expect(validateCloudRecord({ id: "1" }, ["finished_at"]).valid).toBe(false);
  });

  it("accepts a well-formed record", () => {
    expect(validateCloudRecord({ id: "1", finished_at: "2026-01-01" }, ["finished_at"]).valid).toBe(true);
  });
});

describe("pagination beyond 1000 rows", () => {
  it("keeps paging while a page comes back full", async () => {
    const pages = [Array.from({ length: 1000 }, (_, i) => i), Array.from({ length: 1000 }, (_, i) => 1000 + i), Array.from({ length: 250 }, (_, i) => 2000 + i)];
    let call = 0;
    const fetchPage = async () => pages[call++];
    const all = await downloadAllPages(fetchPage, { pageSize: 1000 });
    expect(all).toHaveLength(2250);
    expect(call).toBe(3);
  });

  it("stops after a single short page", async () => {
    const fetchPage = async () => [1, 2, 3];
    const all = await downloadAllPages(fetchPage, { pageSize: 1000 });
    expect(all).toEqual([1, 2, 3]);
  });
});
