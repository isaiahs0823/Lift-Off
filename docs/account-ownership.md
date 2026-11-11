# Step 3B.1 — account ownership and isolation

Baseline: `b81679e3896d5990a59cf3f1e68ebf6849d5f40f` on development.
Feature branch: `feature/account-data-isolation`.

## Reproduced failure

The synthetic-auth browser build keeps the real application, persistence broker,
cloud converters and sync scheduler. Only the Supabase SDK transport is substituted;
external requests are blocked. On the baseline, A signs out and B signs in: four
A-derived records are submitted with B's user ID. The permanent browser assertion
fails with `4 !== 0`. The corrected implementation submits zero B records and
removes the athlete application from the account-mismatch screen.

## Ownership model

There is one retained device dataset, not an automatically switched account vault.
`brk-dataset-ownership:v1` holds `{version, datasetId, kind, accountId}`. Dataset IDs
are random stable IDs. Account IDs are Supabase user IDs, never email matching or
wall-clock ordering. The states are:

- `anonymous`: only a proven new installation is classified this way automatically.
  Signed-out local tracking remains supported. Signing in closes the athlete editor
  until the user explicitly associates the anonymous dataset with that account.
- `account`: only that authenticated ID may open or sync the retained dataset.
  Signing out hides it without deleting its history, active workout or any other
  athlete fields. Another account cannot adopt it as anonymous. Returning to the
  rightful account opens the current durable data, not the original startup copy.
- `review`: preexisting data without ownership evidence. It is preserved and blocked
  from editing, adoption and cloud hydration/upload. No inferred owner is taken from
  a stored token, an email, a timestamp, a photo flag or the next sign-in.

Missing metadata is considered fresh only when the original athlete storage keys
were absent before initialization. Existing timer/sync keys also count as evidence
of prior state. The isolated preview's explicitly seeded first installation can
acquire anonymous provenance because its original device storage was empty.
Malformed/unreadable ownership or rejected/unverified metadata writes fail closed.
Only metadata is written during an ownership transition; athlete payloads are not
moved, renamed, emptied or copied into another account.

A displayed adoption action includes the account ID and generation it was shown
for. A late click cannot authorize another account. The association is verified by
storage read-back before any cloud work is permitted. Declining it signs out and
retains anonymous local data.

## Boundary and async work

The Web Lock and startup gate still run first. Ownership is installed in the same
broker before AccountBoundary imports authentication and before App mounts. Auth
storage and tracked auth tasks can run without athlete admission; athlete storage,
state updaters and tasks cannot. App mounts only after both startup and account
admission. UI hiding is accompanied by broker guards and direct cloud-function
checks, not used as the sole security mechanism.

Identity changes synchronously suspend admission and increment an in-memory
generation. Cloud functions capture a lease with the initiating user ID/generation,
check it before requests and after awaits, and reject mismatched direct callers.
An already-sent request cannot be recalled, but its payload remains scoped to its
original account. No subsequent profile/photo write or local result application is
allowed through the old lease. Returning to A does not restore A's old leases.

App, photo processing, backup readers and all three timer persistence paths capture
scoped storage capabilities. Debounced sync/retry timers are cleared on unmount;
their callbacks also check their original capability. Auth events re-read the SDK's
current session outside the SDK callback lock, rather than trusting a late event's
payload. A revision counter rejects obsolete restoration results. Even a broker
conflict cannot make a later identity event leave the old athlete UI open.

Explicit sign-out flushes pending local drafts and refuses if local persistence is
uncertain. An external auth change cannot be refused: if its flush fails, the
broker captures base/attempted athlete payloads into `brk-account-recovery:*` and
blocks re-opening, including after returning/reloading, for recovery review. If
that journal is also rejected, the copy remains in memory and must be exported
before leaving; complete storage rejection plus process termination cannot be
made durable by frontend code.

## Recovery, backups and compatibility

No history/session/program identifier or workout schema is rewritten. Existing
startup validation and its original/staging journals remain. Existing ownerless
local data is deliberately quarantined, not silently upgraded into anonymous data.
There is no reset, clear, automatic account migration or automatic repair action.
A reviewed recovery/import tool is a follow-up; users with legacy data need that
review before normal editing can resume. This is a compatibility restriction that
must be considered before rollout, not evidence of damaged/deleted records.

Recovery downloads require matching ownership and unchanged accepted auth storage.
Wrong-account and signed-out known-account downloads are redacted. Signed-out
legacy review allows explicit recovery export. Conflict quarantine still permits
an authorized recovery download without granting writes. Failed startup cannot
export known-account data before auth verification. SDK auth keys and values are
not included in recovery records/exports.

Normal backup exports add ownership provenance. Imports require matching known
account ownership, or explicit anonymous provenance into an anonymous dataset,
plus the existing overwrite confirmation. Differently owned or ownerless old
backups remain intact but require review; they are not implicitly adopted.
Active workouts remain in the dedicated checkpoint/recovery paths, not the normal
backup schema. This change does not expand normal backup coverage.

## Validation and review scope

Commands:

```sh
npm --logs-max=0 test
npm --logs-max=0 run build
npm --logs-max=0 run preview -- --host 127.0.0.1 --port 4173
BRK_PLAYWRIGHT_MODULE=/tmp/brk-audit-tools/node_modules/playwright/index.mjs node --test scripts/workoutIntegrity.browser.mjs
node scripts/buildAccountFixture.mjs
node_modules/.bin/vite preview --outDir /tmp/brk-account-fixture --host 127.0.0.1 --port 4174
BRK_PLAYWRIGHT_MODULE=/tmp/brk-audit-tools/node_modules/playwright/index.mjs node --test scripts/accountOwnership.browser.mjs
VITE_LOCAL_ONLY_PREVIEW=true npm --logs-max=0 run build -- --outDir /tmp/brk-account-local-preview
node_modules/.bin/vite preview --outDir /tmp/brk-account-local-preview --host 127.0.0.1 --port 4175
BRK_PLAYWRIGHT_MODULE=/tmp/brk-audit-tools/node_modules/playwright/index.mjs node --test scripts/accountOwnership.localPreview.browser.mjs
```

The synthetic SDK is selected only by the dedicated test-build script. Production
Vite configuration, dependencies, lockfile, Supabase configuration and deployment
configuration are unchanged. Synthetic SDK identifiers were checked absent from
the normal production artifact. Original workout browser fixtures now explicitly
identify their synthetic anonymous provenance; their data-preservation assertions
remain. The new suite covers the requested account transitions, adoption/decline,
active drafts, stale auth/cloud/photo/retry callbacks, reloads, rejected adoption,
credential-free recovery, failed-write transition quarantine and backup isolation.

## Remaining release blockers and limits

The previously confirmed same-account stale-cloud overwrite remains: unconditional
upserts and local-wins same-ID merging have no server revision preconditions. This
phase does not repair that P0, restore retry/pagination, deletion resurrection,
photo error reporting/URL renewal or account deletion. It must not be described as
a complete cloud-reliability fix. Per the no-known-P0 push gate, this branch must
remain unpublished until that outstanding gate is resolved or its scope is
explicitly changed by the user.

No live Supabase account, RLS deployment, email delivery or native device flow was
tested. Physical iOS testing still needs magic-link routing, Safari/PWA storage
separation, background/force-quit recovery, quota pressure and real auth refresh.
Close/reload old application tabs before rollout: an older build that does not
honor ownership cannot be secured by new code in another JavaScript realm. Local
storage is not encrypted storage or a defense against hostile same-origin scripts
or direct access to an unlocked device's browser profile. No live athlete data was
used and no production/Supabase configuration or records were changed.

## Final validation results

274 unit tests passed in 20 files (241 existing + 33 new). All 55 existing workout
browser tests passed. All 19 account browser tests and the one fresh local-only
preview browser test passed: 75 browser tests total, none skipped. The production,
synthetic-auth fixture and isolated local-preview builds succeeded. The existing
large-bundle warning remains. The account fixture's baseline reproduction failed
before the fix as described above; it passed after the fix. Self-review included
all production storage writers, transition ordering, backup paths, stale leases,
recovery exports, generated artifacts and credential patterns. No application
schema, program ID or historical workout record is migrated by the ownership code.

## Changed-file inventory

```text
docs/account-ownership.md
scripts/accountOwnership.browser.mjs
scripts/accountOwnership.localPreview.browser.mjs
scripts/buildAccountFixture.mjs
scripts/fixtures/accountSupabase.js
scripts/workoutIntegrity.browser.mjs
src/App.jsx
src/components/IntervalTimerScreen.jsx
src/components/MoreTab.jsx
src/components/SettingsTab.jsx
src/components/StandaloneRestTimer.jsx
src/hooks/useSupabaseAuth.js
src/persistence/AccountBoundary.jsx
src/persistence/PersistenceBoundary.jsx
src/persistence/accountOwnership.js
src/persistence/cloudAccount.js
src/persistence/editorSession.js
src/utils/__tests__/accountOwnership.test.js
src/utils/__tests__/cloudAccount.test.js
src/utils/backup.js
src/utils/photoStorage.js
src/utils/supabaseSync.js
```
