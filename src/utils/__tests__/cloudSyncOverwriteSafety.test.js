import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOutboxState, enqueueOperation, persistOutboxState, loadOutboxState, reconcileRetryOutcome } from "../../persistence/syncOutbox.js";

// This file exists to answer one question with evidence, not opinion: does the dormant
// CLOUD_SYNC_V2 path actually prevent the P0 cloud-overwrite risk documented in PR #2
// ("unconditional upserts and local-wins same-ID merging have no server revision
// preconditions")? The safety-critical tests below call the REAL exported
// `pushOperationWithRevision` against a minimal in-memory fake Postgres table — never a real
// network call, never a real Supabase project, per the explicit instruction not to activate
// cloud sync for real accounts. The fake implements exactly the one piece of Postgres semantics
// this all depends on: an UPDATE/DELETE's WHERE clause (including `.eq("revision", x)`) only
// matches and mutates rows that satisfy it — it does not special-case "always succeed."

function createFakeSupabaseTable(seedRowsByTable = {}) {
  const tables = new Map();
  for (const [name, rows] of Object.entries(seedRowsByTable)) {
    tables.set(name, new Map(rows.map((r) => [r.id, { ...r }])));
  }
  function tableMap(name) {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  }
  function from(name) {
    const filters = [];
    let op = { type: "select" };
    let selected = false;
    const builder = {
      eq(key, value) {
        filters.push([key, value]);
        return builder;
      },
      select() {
        selected = true;
        return builder;
      },
      insert(row) {
        op = { type: "insert", row };
        return builder;
      },
      update(row) {
        op = { type: "update", row };
        return builder;
      },
      delete() {
        op = { type: "delete" };
        return builder;
      },
      async upsert(rows) {
        const t = tableMap(name);
        for (const row of rows) t.set(row.id, { ...row });
        return { error: null };
      },
      async maybeSingle() {
        return run(true);
      },
    };
    function matches(row) {
      return filters.every(([k, v]) => row[k] === v);
    }
    function run(single) {
      const t = tableMap(name);
      if (op.type === "insert") {
        if (t.has(op.row.id)) return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        t.set(op.row.id, { ...op.row });
        return { data: selected ? { ...op.row } : null, error: null };
      }
      if (op.type === "update") {
        const match = [...t.values()].find(matches);
        if (!match) return { data: null, error: null }; // WHERE matched zero rows — nothing mutated
        const updated = { ...match, ...op.row };
        t.set(match.id, updated);
        return { data: selected ? updated : null, error: null };
      }
      if (op.type === "delete") {
        const match = [...t.values()].find(matches);
        if (!match) return { data: null, error: null };
        t.delete(match.id);
        return { data: selected ? match : null, error: null };
      }
      const rowsMatched = [...t.values()].filter(matches);
      return single ? { data: rowsMatched[0] ?? null, error: null } : { data: rowsMatched, error: null };
    }
    return builder;
  }
  return { from, _dump: (name) => [...tableMap(name).values()] };
}

let fakeSupabase = createFakeSupabaseTable({});

vi.mock("../../lib/supabaseClient.js", () => ({
  get supabase() {
    return { from: (name) => fakeSupabase.from(name) };
  },
  supabaseEnabled: true,
}));
vi.mock("../../config/featureFlags.js", () => ({ CLOUD_SYNC_V2_ENABLED: true }));

const { pushOperationWithRevision } = await import("../supabaseSync.js");

beforeEach(() => {
  fakeSupabase = createFakeSupabaseTable({});
});

const BASE_OP = { table: "workout_sessions", rowId: "s1", type: "upsert" };

describe("pushOperationWithRevision (the real exported function) — the actual fix for the documented P0 overwrite", () => {
  it("a stale write (old expectedRevision) is REJECTED by the real function, never silently overwrites a newer row", async () => {
    fakeSupabase = createFakeSupabaseTable({
      workout_sessions: [{ id: "s1", user_id: "u1", plan_name: "A's newer edit", revision: 1, last_operation_id: "op-from-A" }],
    });
    const staleOp = { ...BASE_OP, payload: { id: "s1", planName: "B's STALE version — must not win" }, expectedRevision: 0, opId: "op-from-B" };

    const outcome = await pushOperationWithRevision(staleOp, "u1");

    expect(outcome.outcome).toBe("conflict"); // surfaced for review, never auto-resolved by picking a side
    const current = fakeSupabase._dump("workout_sessions")[0];
    expect(current.plan_name).toBe("A's newer edit"); // A's newer data survives, completely untouched
    expect(current.revision).toBe(1);
  });

  it("a correctly-sequenced write (matching expectedRevision) succeeds and bumps the revision", async () => {
    fakeSupabase = createFakeSupabaseTable({ workout_sessions: [{ id: "s1", user_id: "u1", revision: 0, last_operation_id: "op-create", plan_name: "original" }] });
    const op = { ...BASE_OP, payload: { id: "s1", planName: "A's edit" }, expectedRevision: 0, opId: "op-A" };

    const outcome = await pushOperationWithRevision(op, "u1");

    expect(outcome.outcome).toBe("confirmed");
    const current = fakeSupabase._dump("workout_sessions")[0];
    expect(current.plan_name).toBe("A's edit");
    expect(current.revision).toBe(1);
  });

  it("a genuinely first write for a row (expectedRevision null) succeeds as a plain insert", async () => {
    fakeSupabase = createFakeSupabaseTable({});
    const op = { ...BASE_OP, rowId: "new-session", payload: { id: "new-session", planName: "brand new" }, expectedRevision: null, opId: "op-1" };

    const outcome = await pushOperationWithRevision(op, "u1");

    expect(outcome.outcome).toBe("confirmed");
    expect(fakeSupabase._dump("workout_sessions")[0].plan_name).toBe("brand new");
  });

  it("contrast: the OLD (currently active, deployed) push path has no such protection — the bug, demonstrated against the real deployed schema shape", async () => {
    const legacyTable = createFakeSupabaseTable({
      workout_sessions: [{ id: "s1", user_id: "u1", plan_name: "A's newer edit" }], // no revision column — today's real schema
    });
    // Exactly what pushWorkoutDataToSupabase (the active path) does: an unconditional upsert.
    await legacyTable.from("workout_sessions").upsert([{ id: "s1", user_id: "u1", plan_name: "B's STALE version" }]);
    const current = legacyTable._dump("workout_sessions")[0];
    expect(current.plan_name).toBe("B's STALE version"); // A's newer edit is gone — silently, with no error and no signal
  });
});

describe("deleted records — compare-and-swap delete (the fix applied in this branch)", () => {
  it("the real function rejects a delete queued against a stale revision — never removes a row someone else has since updated", async () => {
    fakeSupabase = createFakeSupabaseTable({
      workout_sessions: [{ id: "s1", user_id: "u1", plan_name: "Updated after the delete was queued", revision: 2, last_operation_id: "op-update" }],
    });
    const op = { table: "workout_sessions", rowId: "s1", type: "delete", expectedRevision: 0, opId: "op-stale-delete" };

    const outcome = await pushOperationWithRevision(op, "u1");

    expect(outcome.outcome).toBe("conflict");
    expect(fakeSupabase._dump("workout_sessions")).toHaveLength(1);
    expect(fakeSupabase._dump("workout_sessions")[0].plan_name).toBe("Updated after the delete was queued");
  });

  it("the real function succeeds a delete at the correct expected revision and removes exactly that row", async () => {
    fakeSupabase = createFakeSupabaseTable({ workout_sessions: [{ id: "s1", user_id: "u1", revision: 0, last_operation_id: "op-create" }] });
    const op = { table: "workout_sessions", rowId: "s1", type: "delete", expectedRevision: 0, opId: "op-delete" };

    const outcome = await pushOperationWithRevision(op, "u1");

    expect(outcome.outcome).toBe("confirmed");
    expect(fakeSupabase._dump("workout_sessions")).toHaveLength(0);
  });

  it("regression guard for the bug fixed in this branch: a successful delete reports confirmed directly, never a synthetic conflict", async () => {
    // Before the fix, a successful delete was reconciled against a hardcoded
    // { revision: null, last_operation_id: null } object, which falsely reported "conflict"
    // whenever the caller's op carried a real (non-null) expectedRevision — exactly this case.
    fakeSupabase = createFakeSupabaseTable({ workout_sessions: [{ id: "s1", user_id: "u1", revision: 3, last_operation_id: "op-prior" }] });
    const op = { table: "workout_sessions", rowId: "s1", type: "delete", expectedRevision: 3, opId: "op-delete-2" };

    const outcome = await pushOperationWithRevision(op, "u1");

    expect(outcome.outcome).toBe("confirmed");
  });

  it("deleting a row that's already gone (confirmed by a previous attempt, response lost) reconciles as confirmed, not an error", () => {
    const op = { opId: "op-1", type: "delete", expectedRevision: 0 };
    const outcome = reconcileRetryOutcome(op, { updatedRow: null, currentRow: null });
    expect(outcome.outcome).toBe("confirmed");
  });
});

describe("account isolation — a push/delete for one account can never touch another account's row", () => {
  // `id text primary key` in supabase_schema.sql is global, not scoped per account — two
  // different accounts can never simultaneously own a row with the same id in the real schema.
  // The real isolation question is therefore: if account B's locally-generated id ever collides
  // with a row account A already owns (ids are app-generated, not server-partitioned per
  // account, so this isn't theoretically impossible even though it's astronomically unlikely in
  // practice), can B's write ever touch A's row? Confirmed below: no — the `.eq("user_id", userId)`
  // filter means B's query can never even see A's row, so the operation correctly reports
  // "missing" rather than "confirmed" or, worse, silently mutating or adopting A's data.
  it("account B pushing to an id that belongs to account A never matches or mutates A's row — reported as missing, not confirmed", async () => {
    fakeSupabase = createFakeSupabaseTable({
      workout_sessions: [{ id: "owned-by-A", user_id: "acct-A", plan_name: "A's workout", revision: 0, last_operation_id: null }],
    });
    const op = { table: "workout_sessions", rowId: "owned-by-A", type: "upsert", payload: { id: "owned-by-A", planName: "B's attempted overwrite" }, expectedRevision: 0, opId: "op-B" };

    const outcome = await pushOperationWithRevision(op, "acct-B");

    expect(outcome.outcome).toBe("missing"); // B's user_id-scoped query can't see A's row at all
    const aRow = fakeSupabase._dump("workout_sessions").find((r) => r.user_id === "acct-A");
    expect(aRow.plan_name).toBe("A's workout"); // completely untouched by B's attempt
  });

  it("the outbox keeps fully separate queues per account — switching accounts never leaks or merges pending operations", () => {
    let state = createOutboxState();
    state = enqueueOperation(state, { accountId: "acct-A", table: "workout_sessions", rowId: "r1", type: "upsert", payload: {}, expectedRevision: 0 });
    state = enqueueOperation(state, { accountId: "acct-B", table: "workout_sessions", rowId: "r1", type: "upsert", payload: {}, expectedRevision: 0 });
    expect(state.byAccount["acct-A"].operations).toHaveLength(1);
    expect(state.byAccount["acct-B"].operations).toHaveLength(1);
    expect(state.byAccount["acct-A"].operations[0]).not.toBe(state.byAccount["acct-B"].operations[0]);
  });
});

describe("offline edits and reconnect — outbox durability across a simulated reload", () => {
  it("a pending operation enqueued while offline survives a serialize/deserialize round trip (closes the persistence gap found in this audit)", () => {
    let state = createOutboxState();
    state = enqueueOperation(state, { accountId: "acct-A", table: "workout_sessions", rowId: "r1", type: "upsert", payload: { note: "logged while offline" }, expectedRevision: 0, opId: "op-offline-1" });
    const serialized = persistOutboxState(state);
    // Simulate a browser reload: the in-memory module state is gone; only the serialized string
    // (which a caller would write to localStorage) remains.
    const reloaded = loadOutboxState(serialized);
    expect(reloaded.byAccount["acct-A"].operations).toHaveLength(1);
    expect(reloaded.byAccount["acct-A"].operations[0].opId).toBe("op-offline-1");
    expect(reloaded.byAccount["acct-A"].operations[0].status).toBe("pending");
  });

  it("a missing/corrupt persisted payload starts a clean outbox rather than crashing or losing unrelated accounts silently", () => {
    expect(loadOutboxState(null)).toEqual(createOutboxState());
    expect(loadOutboxState("{not valid json")).toEqual(createOutboxState());
    expect(loadOutboxState('{"foo":"bar"}')).toEqual(createOutboxState()); // well-formed JSON, wrong shape
  });

  it("an operation that survives a reload still sends successfully once reconnected, via the real function", async () => {
    let state = createOutboxState();
    state = enqueueOperation(state, { accountId: "acct-A", table: "workout_sessions", rowId: "s1", type: "upsert", payload: { id: "s1", planName: "logged offline" }, expectedRevision: null, opId: "op-offline-1" });
    const reloaded = loadOutboxState(persistOutboxState(state));
    const op = reloaded.byAccount["acct-A"].operations[0];

    fakeSupabase = createFakeSupabaseTable({});
    const outcome = await pushOperationWithRevision(op, "acct-A");

    expect(outcome.outcome).toBe("confirmed");
    expect(fakeSupabase._dump("workout_sessions")[0].plan_name).toBe("logged offline");
  });
});

describe("interrupted synchronization — a write that committed but whose response was lost", () => {
  it("retrying an op whose write already landed server-side (lost acknowledgement) is confirmed by the real function, never re-applied or flagged as a conflict", async () => {
    fakeSupabase = createFakeSupabaseTable({
      workout_sessions: [{ id: "s1", user_id: "u1", revision: 1, last_operation_id: "op-1", plan_name: "committed before the response was lost" }],
    });
    // The client never saw the success response and retries the SAME op with the SAME
    // now-stale-looking expectedRevision of 0 (what it believed before the first attempt).
    const op = { ...BASE_OP, payload: { id: "s1", planName: "committed before the response was lost" }, expectedRevision: 0, opId: "op-1" };

    const outcome = await pushOperationWithRevision(op, "u1");

    expect(outcome.outcome).toBe("confirmed"); // last_operation_id matches THIS op — it already landed, not a conflict
    expect(fakeSupabase._dump("workout_sessions")[0].plan_name).toBe("committed before the response was lost"); // nothing re-applied or duplicated
  });
});

describe("conflicting updates from two devices — never auto-resolved, always preserved for review", () => {
  it("both devices edit the same row from the same base revision; the loser's write is preserved as a conflict via the real function, not discarded or force-applied", async () => {
    fakeSupabase = createFakeSupabaseTable({ workout_sessions: [{ id: "s1", user_id: "u1", revision: 0, last_operation_id: null, plan_name: "original" }] });

    const opA = { ...BASE_OP, payload: { id: "s1", planName: "A's edit" }, expectedRevision: 0, opId: "op-A" };
    const outcomeA = await pushOperationWithRevision(opA, "u1");
    expect(outcomeA.outcome).toBe("confirmed");

    // Device B, also starting from revision 0, loses the race.
    const opB = { ...BASE_OP, payload: { id: "s1", planName: "B's edit" }, expectedRevision: 0, opId: "op-B" };
    const outcomeB = await pushOperationWithRevision(opB, "u1");

    expect(outcomeB.outcome).toBe("conflict"); // never force-applied, never silently thrown away
    expect(fakeSupabase._dump("workout_sessions")[0].plan_name).toBe("A's edit");
  });
});
