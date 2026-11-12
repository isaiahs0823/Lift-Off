import { describe, it, expect, vi, beforeEach } from "vitest";

// Proves the workout_profile singleton (current program identity, program progress/completion
// state, settings, profile-level training configuration) is protected the same way every other
// synced row is — against the REAL exported pushProfileWithRevision, with a fake table, never a
// real Supabase project. workout_profile's primary key is user_id itself (see
// supabase_schema.sql), not a separate id column, so this needs its own small fake rather than
// reusing cloudSyncOverwriteSafety.test.js's id-keyed one.

function createFakeProfileTable(seed = null) {
  let row = seed ? { ...seed } : null;
  return {
    get: () => row,
    from(name) {
      if (name !== "workout_profile") throw new Error(`unexpected table ${name}`);
      let filters = [];
      let op = null;
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
        insert(r) {
          op = { type: "insert", row: r };
          return builder;
        },
        update(r) {
          op = { type: "update", row: r };
          return builder;
        },
        async maybeSingle() {
          const matches = (candidate) => filters.every(([k, v]) => candidate && candidate[k] === v);
          if (op?.type === "insert") {
            if (row) return { data: null, error: { message: "duplicate key value violates unique constraint" } };
            row = { ...op.row };
            return { data: selected ? { ...row } : null, error: null };
          }
          if (op?.type === "update") {
            if (!matches(row)) return { data: null, error: null };
            row = { ...row, ...op.row };
            return { data: selected ? { ...row } : null, error: null };
          }
          // plain select
          return { data: matches(row) ? { ...row } : null, error: null };
        },
      };
      return builder;
    },
  };
}

let fakeTable = createFakeProfileTable(null);
vi.mock("../../lib/supabaseClient.js", () => ({
  get supabase() {
    return { from: (name) => fakeTable.from(name) };
  },
  supabaseEnabled: true,
}));
vi.mock("../../config/featureFlags.js", () => ({ CLOUD_SYNC_V2_ENABLED: true }));

const { pushProfileWithRevision } = await import("../supabaseSync.js");

beforeEach(() => {
  fakeTable = createFakeProfileTable(null);
});

describe("pushProfileWithRevision — protects current program identity, progress state, and settings", () => {
  it("a brand-new account's first profile write succeeds as a plain insert", async () => {
    const op = { table: "workout_profile", rowId: "user-1", type: "upsert", expectedRevision: null, opId: "op-1", payload: { currentProgram: { programId: "p1" }, settings: {}, hasSeenOnboarding: true } };
    const outcome = await pushProfileWithRevision(op, "user-1");
    expect(outcome.outcome).toBe("confirmed");
    expect(fakeTable.get().current_program).toEqual({ programId: "p1" });
  });

  it("a stale write (old expectedRevision) is rejected — never silently replaces a newer current-program/settings state", async () => {
    fakeTable = createFakeProfileTable({ user_id: "user-1", current_program: { programId: "newer-program" }, settings: { barWeight: 45 }, revision: 2, last_operation_id: "op-newer" });
    const staleOp = { table: "workout_profile", rowId: "user-1", type: "upsert", expectedRevision: 0, opId: "op-stale", payload: { currentProgram: { programId: "STALE" }, settings: { barWeight: 999 } } };

    const outcome = await pushProfileWithRevision(staleOp, "user-1");

    expect(outcome.outcome).toBe("conflict");
    expect(fakeTable.get().current_program).toEqual({ programId: "newer-program" }); // untouched
    expect(fakeTable.get().settings).toEqual({ barWeight: 45 }); // untouched
  });

  it("a correctly-sequenced write (matching revision) succeeds and protects program progress state (scheduleLog)", async () => {
    fakeTable = createFakeProfileTable({ user_id: "user-1", schedule_log: [], revision: 0, last_operation_id: "op-create" });
    const op = { table: "workout_profile", rowId: "user-1", type: "upsert", expectedRevision: 0, opId: "op-progress", payload: { scheduleLog: [{ date: "2026-01-01", completed: true }] } };

    const outcome = await pushProfileWithRevision(op, "user-1");

    expect(outcome.outcome).toBe("confirmed");
    expect(fakeTable.get().schedule_log).toEqual([{ date: "2026-01-01", completed: true }]);
    expect(fakeTable.get().revision).toBe(1);
  });

  it("two devices racing an edit to the same profile: the loser is preserved as a conflict, never silently discarded, and the winner's data survives", async () => {
    fakeTable = createFakeProfileTable({ user_id: "user-1", current_program: null, revision: 0, last_operation_id: null });
    const opA = { table: "workout_profile", rowId: "user-1", type: "upsert", expectedRevision: 0, opId: "op-A", payload: { currentProgram: { programId: "A-picked-this" } } };
    const opB = { table: "workout_profile", rowId: "user-1", type: "upsert", expectedRevision: 0, opId: "op-B", payload: { currentProgram: { programId: "B-picked-this" } } };

    const outcomeA = await pushProfileWithRevision(opA, "user-1");
    expect(outcomeA.outcome).toBe("confirmed");
    const outcomeB = await pushProfileWithRevision(opB, "user-1");

    expect(outcomeB.outcome).toBe("conflict");
    expect(fakeTable.get().current_program).toEqual({ programId: "A-picked-this" }); // recoverable, intact, never overwritten
  });

  it("a lost-acknowledgement retry (the write already landed, response never arrived) is confirmed, never re-applied or treated as a conflict", async () => {
    fakeTable = createFakeProfileTable({ user_id: "user-1", current_program: { programId: "p1" }, revision: 1, last_operation_id: "op-1" });
    const retryOp = { table: "workout_profile", rowId: "user-1", type: "upsert", expectedRevision: 0, opId: "op-1", payload: { currentProgram: { programId: "p1" } } };

    const outcome = await pushProfileWithRevision(retryOp, "user-1");

    expect(outcome.outcome).toBe("confirmed");
  });

  it("backwards compatibility: an existing pre-v2 profile row (revision defaulted to 0, no last_operation_id) is still readable and writable, not rejected outright", async () => {
    fakeTable = createFakeProfileTable({ user_id: "user-1", current_program: { programId: "pre-existing" }, settings: { barWeight: 45 }, has_seen_onboarding: true, revision: 0, last_operation_id: null });
    const op = { table: "workout_profile", rowId: "user-1", type: "upsert", expectedRevision: 0, opId: "op-first-v2-write", payload: { currentProgram: { programId: "pre-existing" }, settings: { barWeight: 50 }, hasSeenOnboarding: true } };

    const outcome = await pushProfileWithRevision(op, "user-1");

    expect(outcome.outcome).toBe("confirmed");
    expect(fakeTable.get().settings).toEqual({ barWeight: 50 });
  });
});
