// ---------------- CLOUD SYNC STATUS ----------------
// P0 auth audit, root cause #1/#2/#3/#6 — pushWorkoutDataToSupabase's result was never read
// anywhere, so a failed push produced zero feedback and was never retried. This gives App.jsx a
// small, pure, testable state machine for "what actually happened the last time we tried to
// sync," persisted to its own localStorage key (liftlog-sync-status) separately from the main
// synced state blob — so showing/tracking sync status can never itself trigger another sync
// cycle, and surviving a reload doesn't require it to live inside the thing being synced.
//
// Invariant every function here upholds: lastSuccessAt only ever moves forward from
// markSyncSuccess, which the caller must only invoke after a push/pull actually reported
// ok:true. A failure NEVER sets lastSuccessAt — "never falsely reported as successful" (task).

export function initialSyncStatus() {
  return { lastSuccessAt: null, lastError: null, lastAttemptAt: null, pending: false, attempt: 0 };
}

export function markSyncStarted(status, attempt = 1) {
  return { ...status, pending: true, lastAttemptAt: new Date().toISOString(), attempt };
}

export function markSyncSuccess(status) {
  return { ...status, pending: false, lastError: null, lastSuccessAt: new Date().toISOString(), attempt: 0 };
}

// `willRetry` controls whether `pending` stays true (another attempt is already scheduled) or
// drops to false (retries exhausted — the UI should offer a manual "Retry now" instead).
export function markSyncFailure(status, errors, willRetry) {
  const message = Array.isArray(errors) && errors.length > 0 ? errors.join("; ") : "Sync failed.";
  return { ...status, pending: !!willRetry, lastError: message };
}

export const MAX_SYNC_ATTEMPTS = 3;
// Bounded, increasing backoff (5s, 10s) — enough to ride out a transient blip without hammering
// Supabase on a real outage, and never an infinite retry loop.
export function retryDelayMs(attempt) {
  return attempt * 5000;
}

// "Last synced 2 hours ago" / "Last synced just now" (item 7's "last-successful-sync
// information"). Pure function of a timestamp + a reference "now" (defaulted, overridable for
// tests) so it never depends on when the test happens to run.
export function formatLastSynced(iso, now = new Date()) {
  if (!iso) return "Never synced";
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 0) return "Just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
