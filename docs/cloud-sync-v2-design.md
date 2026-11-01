# Cloud sync v2 — design (disabled by default)

This is a **new** design written this session. An earlier "Database Integrity Contract" (Step
3B.2) reportedly covered similar ground but was never pushed anywhere recoverable — it does not
exist in this repository's git history on any branch, local or remote, and nothing here claims to
reconstruct it. Treat this document as the current, real spec for the code it describes, not a
recovery of the old one.

## Status

Implemented, tested, **not active**. `src/config/featureFlags.js` exports
`CLOUD_SYNC_V2_ENABLED`, read from `VITE_CLOUD_SYNC_V2` and `false` unless that env var is
literally `"true"`. Nothing in the running app calls any of the gated functions in
`supabaseSync.js`, and the migration they depend on
(`database/sync-v2/001_add_revision_tracking.sql`) has not been applied to any Supabase project.

Turning this on for real needs, in order: (1) explicit approval to run the migration against a
specific project, (2) running it, (3) wiring the outbox into the actual mutation call sites in
`App.jsx` in place of (or alongside) today's whole-collection push, (4) end-to-end verification
against that project before any production rollout.

## What's here

- `src/persistence/syncOutbox.js` — pure logic, no network or storage. Per-account operation
  queues, account-generation fencing, idempotent-retry reconciliation, conflict handling,
  cloud-record validation, and pagination past 1,000 rows. Fully unit-tested
  (`src/persistence/__tests__/syncOutbox.test.js`, 23 tests).
- `src/utils/supabaseSync.js` (bottom section) — the thin, network-touching wrappers:
  `pushOperationWithRevision` (the compare-and-swap write) and `downloadTableAllPages`
  (pagination against a real table). Both no-op unless the flag is on.
- `database/sync-v2/001_add_revision_tracking.sql` — additive migration: a `revision bigint`
  and `last_operation_id text` column on every table `supabaseSync.js` already syncs. No column
  dropped, no RLS policy touched.

## Why no SECURITY DEFINER function

Step 2 of this engagement found zero `SECURITY DEFINER` code anywhere in the schema currently in
this repo — the construct the original security-review request described only existed in the lost
commit. Rather than reconstruct an unknown design from scratch, the compare-and-swap write here is
a plain `UPDATE ... WHERE id = $1 AND user_id = $2 AND revision = $3`, which Postgres already
executes atomically and which stays entirely inside the existing per-row RLS policies. There is no
elevated-privilege code path to shadow, so the temp-object/type-shadowing attack class Step 2 asked
about does not apply to this design.

## Key mechanisms

**Per-account outbox, not one global queue.** Switching the signed-in account never drops the
outgoing account's still-unsent operations — each account keeps its own queue for as long as the
outbox state is kept, and a queue is only ever read for its own account's writes.

**Account-generation fencing.** Every enqueued operation records the account id and generation
active when it was created. If a response lands after the account has since changed,
`applyServerResult` still books the outcome against the *correct* account's queue (so nothing is
lost), but returns `shouldUpdateActiveUI: false` — callers must not let that response touch
whatever the newly-active account's screen is currently showing.

**Idempotent retries via `reconcileRetryOutcome`.** A revision-gated write can succeed on the
server while its confirmation is lost in transit. A resend is told apart from a real conflict by
checking `last_operation_id` on the current row: if it already equals the retrying operation's own
id, that operation already landed — treated as confirmed, not retried, not flagged as a conflict.
Only a different revision *and* a different operation id is a genuine conflict.

**Conflicts are never auto-resolved.** A genuine conflict is removed from the pending queue and
moved to that account's conflict list (`exportConflicts`), for a human to review/export. Nothing
here guesses which side wins.

**Serialized uploads.** `selectNextToSend` refuses to pick a new operation while one is already
in-flight for that account, and skips anything still inside its exponential backoff window
(`nextRetryDelayMs`, capped at 5 minutes).

**Pagination past 1,000 rows.** `downloadAllPages` (pure) / `downloadTableAllPages` (wired) keep
requesting successive ranges until a page comes back short of the page size, so an account with
more than 1,000 rows in one collection still downloads completely.

## Known gaps, honestly stated

- Not wired into any mutation call site yet — writing to the outbox and actually driving it on an
  interval/online event is follow-up work, not done here.
- No UI for reviewing/exporting conflicts yet; `exportConflicts` returns the data, nothing renders
  it.
- The existing whole-collection push/pull in `supabaseSync.js` is untouched and still runs exactly
  as before; this is new code alongside it, not a replacement, until a deliberate cutover.
