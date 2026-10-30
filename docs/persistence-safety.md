# Single-editor persistence safety

BRK Fit admits one editor per origin and browser storage partition. Other tabs show a read-only admission screen; they do not load an editable React state snapshot. This intentionally prevents concurrent browsing/editing through a second app instance. It does not coordinate other devices, separate PWA/browser storage partitions, native WebViews, or remote database writers.

## Ownership and revisions

`PersistenceBoundary` requests the exclusive Web Lock `brk-fit:user-state:single-editor:v1` before importing App or its Supabase client. The lock callback remains alive for the editor's lifetime. There is no timestamp lease, automatic expiry, force/steal option, or localStorage ownership fallback. An unavailable API, insecure context, rejected lock request, or unreadable initial storage leaves editing disabled.

Each granted editor gets a unique capability/epoch and an in-session monotonic revision counter. The broker snapshots the exact serialized revisions of stored keys under the lock. It compares the current stored payload against the accepted payload before every mutation and verifies read-back before acknowledging it. Exact payload equality avoids hash collisions, timestamp ordering and accidental metadata loss. The counter is diagnostic and scoped to that capability; it is not a global durable version or cross-tab compare-and-swap. **Web Locks supplies mutual exclusion; snapshot comparisons alone are not atomic.** Historical data and auth key schemas are unchanged.

A page can activate only one capability. After releasing editing, it must reload before editing again. Every old storage reference remains permanently revoked. Functional app-state updaters are also fenced before their callback runs, so a late file reader or cloud response cannot manufacture another write through a new editor. Deferred cloud operations check ownership before starting and before applying results; tracked requests prevent voluntary transfer while in flight. SDK auth storage is bound to the same capability, with auto-refresh stopped on app unmount.

`storage` events detect unexpected writers; they do not grant ownership. Before any normal write the same revision checks still run. An old build, developer-console mutation, or unrelated same-origin client may not honor the lock. Unexpected revisions quarantine the editor, preserve base/attempted/observed copies, and block overwrite. No frontend protocol can make an uncooperative native localStorage writer participate in its mutex; close/reload older app builds during rollout. This is not a distributed Supabase conflict-resolution protocol.

## Writer inventory

| Persisted state | Writer path | Protection |
| --- | --- | --- |
| Active workout, saved sets, notes, swaps, draft cleanup | App `setActiveRun` | Guarded broker write/removal and read-back; latest failure overrides dirty status |
| Exercise logs, completed sessions, program lifecycle/progress, custom programs/exercises, athlete profile, nutrition, goals and history | App `updateState` / `persist` | Per-editor state updater fence and guarded whole-state write |
| Startup migrations | App load effect | App cannot mount before lock; initial reads and migration writes use broker |
| Workout completion and checkpoint retirement | `writeWorkoutCompletion` | Receives guarded storage; existing checkpoint-first ordering and canonical receipt verification remain |
| Cloud hydration / photo hydration | App cloud effect | Tracked requests and ownership checks before applying responses; state updater and persistence both fenced |
| Cloud push, retry and photo upload callbacks | App cloud callbacks | Ownership checks before starting/retrying; tracked work prevents voluntary handoff mid-request; result handlers fenced |
| Auth/session/account storage | Supabase client custom storage adapter and auth hook | Client loaded only after admission; captured broker rejects reads/writes from released editor; auth API calls tracked |
| Sync status | App sync-status effect | Guarded separate storage key; local persistence success does not mean a cloud request succeeded |
| Progress photos and metadata | PhotosTab and shared `updateState` | Image processing is tracked so voluntary release waits; direct photo write and subsequent state persistence both use broker; async result updater is fenced |
| Backup import | SettingsTab FileReader -> shared `updateState` | Late callback cannot run its mutation after release; explicit existing overwrite confirmation retained |
| Backup/export and recovery downloads | Backup and recovery exporters | Download files; no canonical storage mutation. Recovery downloads exclude auth credentials |
| Workout rest timer | App timer helpers | Guarded read/write/removal |
| Standalone rest timer | StandaloneRestTimer helpers | Guarded read/write/removal |
| Interval timer | IntervalTimerScreen helpers | Guarded read/write/removal |
| Notifications/service worker | Existing notification plumbing | No direct athlete-history localStorage writer |

Source audit: the only production `window.localStorage` reference is the boundary passing the native store into the broker. Remaining storage mutations use the broker or a supplied guarded storage parameter. No localStorage clear, destructive migration, history reset, program-ID rewrite, new dependency, or production/Supabase configuration change is included.

## Transfer, lifecycle and status

The owner explicitly chooses **Release editing**. The broker synchronously flushes registered workout draft callbacks, refuses release while pending work, failed writes or tracked requests remain, and rechecks all accepted storage revisions. Only then is the capability revoked and the browser lock released. The waiting tab chooses **Enable editing**, acquires the lock, and imports/mounts App from fresh durable storage. A waiting tab never steals ownership or writes startup migrations.

Tab closure/process death releases the browser lock. Pagehide flushes what it can and irrevocably fences the old realm; a BFCache pageshow forces a full reload rather than reusing old state. Mere backgrounding does not expire the owner. A suspended live owner may prevent a second tab editing until it resumes or is closed; that is intentional. Beforeunload warns on unsaved work where the browser permits it. Mobile operating systems do not guarantee these events execute.

- **Saving:** registered draft work is pending; it is not an acknowledgement.
- **Saved:** the latest accepted local write has been read back successfully, with no outstanding broker failure masking it.
- **Not saved:** persistence failed or is uncertain. A dirty signal or unrelated successful write cannot clear a failed key's error. Only verified persistence of that key clears it.
- **Read-only:** another tab owns the store, coordination is unavailable, ownership was released, or an unresolved revision conflict prevents safe editing.

After a rejected Finish checkpoint, the original editable workout remains in memory; it is not replaced by a completionPending editor that ignores new inputs. A successful retry completes saved sets once. Existing cloud-sync status remains separate from local save status.

## Conflict and failure recovery

Unexpected revisions preserve the accepted base, attempted update and observed durable copy. A unique `brk-recovery:<capability>:<index>` record is written and verified if storage permits, without replacing canonical history. Export also captures the latest observed user-state copies. SDK auth credential values are never copied into these recovery records or downloads. For auth conflicts only the key/epoch/revision and need for review are retained; the canonical credential is not overwritten.

Unresolved recovery records survive reload and keep editing blocked for review. There is deliberately no automatic selection, array concatenation, credential reset or destructive cleanup. Resolution requires explicit recovery review outside this change; the app supplies an export, not an automatic repair UI. If recovery storage also fails, the copies remain in memory and must be exported before closing. Exact prior uncertain writes can be recognized on retry; arbitrary foreign payloads cannot.

Complete storage rejection plus process termination can still lose new in-memory work: no browser lock can make rejected writes durable. The UI reports Not saved, refuses voluntary transfer, and retains attempted payloads for export/retry. A browser/OS storage eviction is also outside the lock's guarantee. Existing typed-but-unconfirmed input still has a debounce, with synchronous flush for voluntary transfer and best-effort lifecycle flush.

## Browser support and limits

Web Locks requires a secure context (HTTPS; localhost is trusted for testing). Documented browser support includes Chromium 69+, Firefox 96+, and Safari/iOS Safari 15.4+. See [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) and its compatibility table. These published support versions are not a claim that physical devices were tested here. Feature detection is the runtime authority; unsupported or denied environments fail read-only.

Executed integration tests use Chromium 154.0.8037.57 on Linux. Installed iOS PWA/Safari process termination, background lock lifetime, real BFCache behavior, private browsing, quota pressure and auth redirects require physical device verification. The browser test dispatches lifecycle events and performs real reload/close operations; it does not simulate an OS process kill. Safari and a home-screen PWA may use distinct storage environments, so a lock cannot be promised across them. Cross-device/cloud ordering remains a separate concern; a remote request already sent before page/process death cannot be recalled by the local lock.

## Regression validation

Before implementation, the isolated exact baseline `5004b00c444d7e76d25c61d071078f7816dd0af8` fails the two reported application gate tests: the 150-pound set disappears, and failed Finish remains Saving. Baseline test scripts and outputs are outside the repository; no real athlete records or external requests were used.

Validated totals: 205 unit tests in 16 files (16 new coordinator tests), 43 browser tests with zero skipped (14 new browser cases), and the Vite production build. The build retains the existing large-chunk warning. All six original workout-integrity scenarios pass.

Permanent broker unit tests cover verified writes/removal, sticky errors, silent dropped writes, failed revision reads, reload quarantine, auth-token redaction, uncertainty, stale callback fencing, pending-request transfer refusal, lifecycle settlement and recovery exports. Real shared-context browser tabs cover non-owner admission, no startup writes in the waiting tab, safe handoff of pending inputs, the 100/150/200 set sequence, owner closure/reload, captured stale Finish, delayed backup reader, full write rejection/retry, silent dropped writes, unavailable/rejected Web Locks, unreadable admission, pagehide/BFCache fencing, photo metadata and unexpected external writes. Existing six workout-integrity defect scenarios remain in the same browser suite.

Commands:

```sh
npm --logs-max=0 test
npm --logs-max=0 run build
npm --logs-max=0 run preview -- --host 127.0.0.1 --port 4173
BRK_PLAYWRIGHT_MODULE=/tmp/brk-audit-tools/node_modules/playwright/index.mjs node --test scripts/workoutIntegrity.browser.mjs
```

Playwright lives outside the checkout; tests use synthetic fixtures, fresh contexts and blocked external requests. The older-history/legacy fixtures are seeded while no editor owns storage, then loaded through real startup. Separate tests deliberately mutate a live store to verify conflict quarantine. No test weakens the data-preservation assertions to accept a missing set.

Recommend an independent persistence/account/startup review and physical iOS validation before a development merge. No merge or deployment is part of this change.
