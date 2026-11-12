// Cloud sync v2 — the wiring layer between real app mutations and the already-verified,
// revision-checked outbox (syncOutbox.js) / compare-and-swap push (supabaseSync.js's
// pushOperationWithRevision). This is the piece that was missing before: everything below is
// still gated on CLOUD_SYNC_V2_ENABLED, and when that flag is off (the default, and the only
// state any real account has ever run in) NONE of this runs — App.jsx's original
// pushWorkoutDataToSupabase path is untouched and behaves exactly as it did before this file
// existed. The two paths are never both active for the same account at the same time; see
// App.jsx's persist()/scheduleCloudSync() for the branch that enforces that.
//
// Design:
// - diffCollections finds exactly what changed between two full local-state snapshots, per
//   synced collection, by id. This is the single choke point every mutation already passes
//   through (persist(next, prev), called from updateState) — so this module never needs its own
//   list of "the 41 places state changes," which would drift out of date the moment a new one is
//   added. A row present in `next` but not `prev` is an insert; present in both but different
//   (deep-equal by JSON, cheap enough at this app's realistic data sizes and already the pattern
//   used elsewhere in this codebase, e.g. mergeRemoteIntoLocal's tests) is an update; present in
//   `prev` but not `next` is a delete.
// - Local per-row revision tracking (a plain {table: {rowId: revision}} map, persisted alongside
//   the outbox) is what lets an update know its expectedRevision without re-fetching first. It's
//   updated from the server's own confirmed revision after every successful push, and (so a
//   pulled/merged row is immediately write-safe, not just read-safe) after every pull.
// - drainOutbox sends one operation at a time (serialized, per the outbox's own design), applies
//   the result, and keeps going — except it STOPS (pauses, not crashes, not silently drops) the
//   moment a send fails for an auth reason, since retrying an expired-token write forever is
//   both useless and would mask the real problem (the user needs to re-authenticate, not wait on
//   a backoff timer). A conflict on one row never blocks any other row's operations — conflicts
//   are removed from the queue (preserved for review, never retried as-is) and draining continues.
import { enqueueOperation, selectNextToSend, markInFlight, applyServerResult, reconcileRetryOutcome } from "./syncOutbox.js";

export function diffCollections(prev, next, collectionTables) {
  const changes = [];
  for (const [key, table] of Object.entries(collectionTables)) {
    const prevItems = Array.isArray(prev?.[key]) ? prev[key] : [];
    const nextItems = Array.isArray(next?.[key]) ? next[key] : [];
    if (prevItems === nextItems) continue; // same array reference — nothing in this collection changed
    const prevById = new Map(prevItems.filter((i) => i && i.id != null).map((i) => [i.id, i]));
    const nextById = new Map(nextItems.filter((i) => i && i.id != null).map((i) => [i.id, i]));
    for (const [id, item] of nextById) {
      const prevItem = prevById.get(id);
      if (!prevItem) changes.push({ table, rowId: id, type: "upsert", payload: item, isNew: true });
      else if (prevItem !== item && JSON.stringify(prevItem) !== JSON.stringify(item)) changes.push({ table, rowId: id, type: "upsert", payload: item, isNew: false });
    }
    for (const [id] of prevById) {
      if (!nextById.has(id)) changes.push({ table, rowId: id, type: "delete", payload: null, isNew: false });
    }
  }
  return changes;
}

// Enqueues one outbox operation per changed row, with the expectedRevision this account
// currently believes that row is at (null for a genuinely new row — nothing to compare against
// yet). Pure: takes and returns plain state, no network/storage access here.
export function enqueueDiff(outboxState, revisions, accountId, changes) {
  let state = outboxState;
  for (const change of changes) {
    const known = revisions[change.table]?.[change.rowId];
    const expectedRevision = change.isNew ? null : known ?? null;
    state = enqueueOperation(state, {
      accountId,
      table: change.table,
      rowId: change.rowId,
      type: change.type,
      payload: change.payload,
      expectedRevision,
    });
  }
  return state;
}

export function setRevision(revisions, table, rowId, revision) {
  return { ...revisions, [table]: { ...(revisions[table] || {}), [rowId]: revision } };
}

export function clearRevision(revisions, table, rowId) {
  if (!revisions[table] || !(rowId in revisions[table])) return revisions;
  const tableRevs = { ...revisions[table] };
  delete tableRevs[rowId];
  return { ...revisions, [table]: tableRevs };
}

// Records a row's revision as soon as it's pulled from the cloud (not just after this device's
// own push), so an immediate local edit to a freshly-pulled row (e.g. a second device's history
// just arrived, user edits one of those sessions right away) knows the correct expectedRevision
// instead of treating it as a brand-new row with no revision to protect.
export function recordPulledRevisions(revisions, table, rows) {
  let next = revisions;
  for (const row of rows) {
    if (row && row.id != null && typeof row.revision === "number") next = setRevision(next, table, row.id, row.revision);
  }
  return next;
}

// Supabase/postgrest surfaces an expired/invalid session as a 401, or sometimes as a PostgREST
// "JWT expired"/"invalid JWT" message depending on which layer rejects first. Classifying this
// distinctly from a generic network blip or a real conflict is what lets the drain loop pause
// and wait for re-authentication instead of burning through retries that can never succeed.
export function classifySendError(error) {
  if (!error) return null;
  const status = error.status ?? error.code;
  const message = String(error.message || error).toLowerCase();
  if (status === 401 || status === "401" || message.includes("jwt") || message.includes("expired") || message.includes("not authenticated")) return "auth";
  return "unknown";
}

// An operation can be persisted mid-flight (markInFlight ran, then the tab closed or crashed
// before the send resolved either way) — selectNextToSend refuses to pick a NEW op for an
// account while ANY of its operations is "in-flight", by design (only one in-flight write per
// account at a time). Without this, a crash during a send would permanently wedge that account's
// entire queue on the next load: nothing would ever drain again. Resetting a stale in-flight op
// back to "pending" on load is safe specifically because resends are idempotent
// (reconcileRetryOutcome's last_operation_id check tells a lost acknowledgement apart from a
// real conflict) — it is never a case of blindly replaying an unconfirmed write as if it were new.
export function resetInFlightToPending(state) {
  const byAccount = {};
  for (const [accountId, account] of Object.entries(state.byAccount)) {
    byAccount[accountId] = {
      ...account,
      operations: account.operations.map((op) => (op.status === "in-flight" ? { ...op, status: "pending", nextRetryAt: new Date().toISOString() } : op)),
    };
  }
  return { ...state, byAccount };
}

const DEFAULT_MAX_OPS_PER_DRAIN = 50; // a safety cap, not a realistic ceiling — stops a pathological queue from blocking the event loop in one call.

// Drains as much of one account's outbox as it can in one pass. `send(op)` must return either
// `{ outcome, row }` (the shape pushOperationWithRevision already returns) or throw. A thrown
// error is treated as a transient failure (scheduled for backoff, same as any other "retry"
// outcome) UNLESS classifySendError says it's an auth problem, in which case draining stops
// immediately for this account — the caller is expected to surface that (syncStatus) and retry
// only after the user re-authenticates, not on the normal backoff schedule.
export async function drainOutbox({ state, revisions, accountId, send, maxOps = DEFAULT_MAX_OPS_PER_DRAIN, now = Date.now() }) {
  let currentState = state;
  let currentRevisions = revisions;
  let drainedCount = 0;
  let paused = false;
  let pausedReason = null;
  let shouldUpdateActiveUI = false;

  for (let i = 0; i < maxOps; i++) {
    const op = selectNextToSend(currentState, accountId, { now });
    if (!op) break;
    currentState = markInFlight(currentState, accountId, op.opId);

    let outcome;
    try {
      outcome = await send(op);
    } catch (error) {
      const kind = classifySendError(error);
      if (kind === "auth") {
        // Roll the in-flight op back to pending so it's retried once auth is restored, rather
        // than leaving it stuck "in-flight" forever (which would block every other op behind it).
        // Deliberately NOT routed through applyServerResult's "retry" outcome: that increments
        // `attempts` and schedules the normal exponential backoff, which is the right behavior
        // for a flaky send but wrong here — this wasn't a failed delivery attempt, it's a
        // deliberate stop-before-trying. The op must be immediately retryable the moment
        // re-authentication succeeds, not stuck behind a backoff timer that started ticking for
        // an unrelated reason.
        currentState = {
          ...currentState,
          byAccount: {
            ...currentState.byAccount,
            [accountId]: {
              ...currentState.byAccount[accountId],
              operations: currentState.byAccount[accountId].operations.map((o) => (o.opId === op.opId ? { ...o, status: "pending", nextRetryAt: new Date(now).toISOString(), lastError: "auth" } : o)),
            },
          },
        };
        paused = true;
        pausedReason = "auth";
        break;
      }
      outcome = { outcome: "retry" };
    }

    const result = applyServerResult(currentState, op, outcome.outcome, { now: new Date(now).toISOString() });
    currentState = result.state;
    shouldUpdateActiveUI = shouldUpdateActiveUI || result.shouldUpdateActiveUI;
    drainedCount++;

    if (outcome.outcome === "confirmed") {
      if (op.type === "delete") currentRevisions = clearRevision(currentRevisions, op.table, op.rowId);
      else if (outcome.row && typeof outcome.row.revision === "number") currentRevisions = setRevision(currentRevisions, op.table, op.rowId, outcome.row.revision);
    }
    // "conflict" is intentionally not auto-resolved here — applyServerResult already moved it to
    // that account's conflicts list; this loop just continues on to the next queued operation.
  }

  return { state: currentState, revisions: currentRevisions, drainedCount, paused, pausedReason, shouldUpdateActiveUI };
}

// One-off helper for a caller that already knows a specific op is a lost-acknowledgement retry
// (e.g. reconciling after a browser crash mid-send) without going through the full send path —
// exported mainly so Phase 3's "interrupted upload" / "duplicate retry" scenarios can be tested
// against this module directly, the same way supabaseSync.js's own tests do.
export { reconcileRetryOutcome };
