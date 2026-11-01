// Cloud-sync v2 outbox — pure logic, no network/storage/React here (see supabaseSync.js for the
// thin wrappers that actually call Supabase; see src/config/featureFlags.js — this is disabled by
// default and nothing in the app calls it yet).
//
// Design, in order of the problem each piece solves:
//
// - Per-account queues, never a single global one. Switching the signed-in account must never
//   drop another account's still-unsent operations ("never silently discard pending operations"),
//   so each account keeps its own operation list for as long as the outbox state is kept around.
// - Every operation carries the account id and the outbox "generation" active when it was
//   enqueued. A response that lands after the account changed still updates ITS OWN account's
//   bookkeeping (so nothing is lost when that account is revisited), but callers must check
//   `shouldUpdateActiveUI` before touching anything a newly-active account's screen is showing —
//   that's the account-generation fence for async callbacks.
// - Idempotent retries: each operation has one opId for life. A revision-gated write is naturally
//   safe to resend, but a response can be lost AFTER the write actually committed (the request
//   succeeded server-side, the confirmation never arrived). reconcileRetryOutcome tells a resend
//   apart from a genuine conflict by checking whether the row's last_operation_id already equals
//   this op's id — if so, this op already landed; that is success, not a conflict.
// - A real conflict (someone/something else changed the row first) is never auto-resolved by
//   picking a side. It is moved to that account's conflict list, preserved for export/review, and
//   the operation is NOT retried as-is.
// - Only one in-flight operation per account at a time (serialized uploads) — selectNextToSend
//   enforces that.

export function createOutboxState() {
  return { activeAccountId: null, generation: 0, byAccount: {} };
}

function ensureAccount(state, accountId) {
  if (state.byAccount[accountId]) return state;
  return { ...state, byAccount: { ...state.byAccount, [accountId]: { operations: [], conflicts: [] } } };
}

// Switching accounts bumps the generation (fencing late responses from the outgoing account's
// in-flight requests) but keeps every account's own queue intact — including the outgoing
// account's still-pending operations, which resume being sendable the next time it's active.
export function switchAccount(state, newAccountId) {
  const withAccount = ensureAccount(state, newAccountId);
  return { ...withAccount, activeAccountId: newAccountId, generation: state.generation + 1 };
}

export function enqueueOperation(state, { accountId, table, rowId, type, payload, expectedRevision, opId = globalThis.crypto.randomUUID(), now = new Date().toISOString() }) {
  const withAccount = ensureAccount(state, accountId);
  const op = {
    opId,
    accountId,
    generation: withAccount.generation,
    table,
    rowId,
    type,
    payload,
    expectedRevision: expectedRevision ?? null,
    status: "pending",
    attempts: 0,
    enqueuedAt: now,
    nextRetryAt: now,
    lastError: null,
  };
  const account = withAccount.byAccount[accountId];
  return { ...withAccount, byAccount: { ...withAccount.byAccount, [accountId]: { ...account, operations: [...account.operations, op] } } };
}

function updateOp(state, accountId, opId, patch) {
  const account = state.byAccount[accountId];
  if (!account) return state;
  const operations = account.operations.map((op) => (op.opId === opId ? { ...op, ...patch } : op));
  return { ...state, byAccount: { ...state.byAccount, [accountId]: { ...account, operations } } };
}

export function markInFlight(state, accountId, opId) {
  return updateOp(state, accountId, opId, { status: "in-flight" });
}

const MAX_BACKOFF_MS = 5 * 60 * 1000;
export function nextRetryDelayMs(attempts) {
  return Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
}

// Decides what a just-returned server outcome means for this op: a clean success, a resend of
// an op that actually already landed (lost acknowledgement — treat as success, don't retry and
// don't conflict), or a genuine conflict against someone/something else's change.
//
// `currentRow` is the row as it stands on the server right now (null if the update affected no
// rows and a follow-up read found nothing — e.g. the row was deleted).
export function reconcileRetryOutcome(op, { updatedRow, currentRow }) {
  if (updatedRow) return { outcome: "confirmed", row: updatedRow };
  if (!currentRow) return { outcome: op.type === "delete" ? "confirmed" : "missing", row: null };
  if (currentRow.last_operation_id === op.opId) return { outcome: "confirmed", row: currentRow };
  if (currentRow.revision !== op.expectedRevision) return { outcome: "conflict", row: currentRow };
  // Same expected revision, different op id, update still didn't apply — an infra hiccup rather
  // than a real conflict; safe to retry as-is.
  return { outcome: "retry", row: currentRow };
}

export function applyServerResult(state, op, outcome, { now = new Date().toISOString() } = {}) {
  const account = state.byAccount[op.accountId];
  if (!account) return { state, shouldUpdateActiveUI: false };
  let nextState = state;
  if (outcome === "confirmed") {
    nextState = { ...state, byAccount: { ...state.byAccount, [op.accountId]: { ...account, operations: account.operations.filter((o) => o.opId !== op.opId) } } };
  } else if (outcome === "conflict") {
    const withoutOp = account.operations.filter((o) => o.opId !== op.opId);
    const conflictRecord = { opId: op.opId, table: op.table, rowId: op.rowId, payload: op.payload, expectedRevision: op.expectedRevision, detectedAt: now };
    nextState = { ...state, byAccount: { ...state.byAccount, [op.accountId]: { operations: withoutOp, conflicts: [...account.conflicts, conflictRecord] } } };
  } else {
    // retry / missing / a thrown error — stays pending, scheduled for backoff.
    const attempts = op.attempts + 1;
    nextState = updateOp(state, op.accountId, op.opId, { status: "pending", attempts, nextRetryAt: new Date(Date.now() + nextRetryDelayMs(attempts)).toISOString(), lastError: outcome });
  }
  return { state: nextState, shouldUpdateActiveUI: op.accountId === state.activeAccountId && op.generation === state.generation };
}

// One in-flight operation per account at a time — the oldest pending op whose backoff has
// elapsed, or null if nothing is ready (queue empty, or something is already in flight).
export function selectNextToSend(state, accountId, { now = Date.now() } = {}) {
  const account = state.byAccount[accountId];
  if (!account) return null;
  if (account.operations.some((op) => op.status === "in-flight")) return null;
  const ready = account.operations.filter((op) => op.status === "pending" && new Date(op.nextRetryAt).getTime() <= now);
  if (ready.length === 0) return null;
  return ready.reduce((oldest, op) => (new Date(op.enqueuedAt) < new Date(oldest.enqueuedAt) ? op : oldest));
}

export function pendingCount(state, accountId) {
  return state.byAccount[accountId]?.operations.length ?? 0;
}

// Flattened, exportable view of every account's unresolved conflicts — for a "download
// conflicts" action, never for picking a side automatically.
export function exportConflicts(state) {
  return Object.entries(state.byAccount).flatMap(([accountId, account]) => account.conflicts.map((c) => ({ accountId, ...c })));
}

// Rejects a cloud row that doesn't look like the shape it claims to be, instead of letting a
// malformed/partial row crash the merge or silently poison local state.
export function validateCloudRecord(record, requiredKeys) {
  if (!record || typeof record !== "object") return { valid: false, reason: "not an object" };
  if (typeof record.id !== "string" || record.id.length === 0) return { valid: false, reason: "missing id" };
  for (const key of requiredKeys) {
    if (!(key in record)) return { valid: false, reason: `missing ${key}` };
  }
  return { valid: true, reason: null };
}

// Pages through a Supabase-style range query past its implicit/explicit row cap. `fetchPage`
// is injected so this stays network-free and testable; the real wrapper (supabaseSync.js)
// supplies `({ from, to }) => supabase.from(table).select("*").range(from, to)`.
export async function downloadAllPages(fetchPage, { pageSize = 1000 } = {}) {
  const all = [];
  let from = 0;
  for (;;) {
    const page = await fetchPage({ from, to: from + pageSize - 1 });
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
