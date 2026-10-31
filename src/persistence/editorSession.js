// Web Locks supplies exclusion. Snapshot revisions below only detect unexpected writers;
// localStorage read/compare/write is deliberately NOT used to acquire ownership.
export const EDITOR_LOCK = "brk-fit:user-state:single-editor:v1";
const KEYS = ["liftlog-data", "liftlog-active-run", "liftlog-sync-status", "liftlog-rest-timer", "liftlog-interval-timer", "brk-standalone-rest-timer"];
const recoverable = (key) => KEYS.includes(key); // Never duplicate/export SDK auth credentials.
let editor;
export function activateEditor(session) {
  if (editor) throw new Error("Reload this tab before opening another editor");
  editor = session;
}
export function getEditorSession() {
  if (!editor) throw new Error("Editing ownership has not been acquired");
  return editor;
}
export const editorStorage = () => getEditorSession().storage;

export function createEditorSession(raw, id = globalThis.crypto.randomUUID()) {
  let active = true, revision = 0, running = 0, unreadable = false;
  let initialization = "pending", prepared = null, initializationError = null;
  const expected = new Map(), attempted = new Map(), failures = new Map(), pending = new Set(), conflicts = [];
  const listeners = new Set(), flushers = new Set();
  const discovered = [];
  try { for (let i=0; i < (raw.length || 0); i++) discovered.push(raw.key(i)); }
  catch { unreadable = true; failures.set("storage-index","Saved storage could not be inspected."); }
  for (const key of new Set([...KEYS, ...discovered])) {
    if (key) {
      try {
        const value = raw.getItem(key);
        expected.set(key, value);
        // An unresolved conflict must not disappear merely because the app reloaded.
        if (key.startsWith("brk-recovery:") && value) conflicts.push({ ...JSON.parse(value), recoveryKey: key });
      } catch { unreadable = true; failures.set(key,"Original saved data could not be read safely."); }
    }
  }
  const original = Object.freeze({
    canonical: expected.has("liftlog-data") ? expected.get("liftlog-data") : {unreadable:true},
    active: expected.has("liftlog-active-run") ? expected.get("liftlog-active-run") : {unreadable:true},
  });
  const snapshot = () => ({ id, active, revision, running, initialization, initializationError, blocked: initialization !== "ready" || unreadable || conflicts.length > 0, pending: pending.size, error: initialization === "failed" || failures.size > 0 || conflicts.length > 0 || unreadable, conflicts: [...conflicts] });
  const emit = () => listeners.forEach((fn) => fn(snapshot()));
  function assertOwner(requireInitialization = true) {
    if (!active) throw Object.assign(new Error("This editor is read-only. Reload after editing has been released."), { code: "EDITOR_RELEASED" });
    if (unreadable) throw new Error("Saved data could not be read safely. Export recovery before reloading.");
    if (conflicts.length) throw Object.assign(new Error("Stored data changed outside this editor. Export recovery copies before reloading."), { code: "EDITOR_CONFLICT" });
    if (requireInitialization && initialization !== "ready") throw new Error("Initialization has not completed safely. Editing is disabled.");
  }
  function check(key, candidate) {
    const actual = raw.getItem(key);
    if (!expected.has(key)) expected.set(key, actual);
    if (actual !== expected.get(key)) {
      // A previous write may have committed before its verification read threw.
      if (attempted.has(key) && actual === attempted.get(key)) expected.set(key, actual);
      else {
        const copy = recoverable(key)
          ? { key, base: expected.get(key), attempted: candidate, observed: actual, owner: id, revision }
          : { key, credentialConflict: true, owner: id, revision };
        conflicts.push(copy);
        // A separate immutable recovery record never replaces either canonical copy.
        try {
          const recoveryKey = `brk-recovery:${id}:${conflicts.length}`;
          const payload = JSON.stringify(copy);
          raw.setItem(recoveryKey, payload);
          if (raw.getItem(recoveryKey) !== payload) throw new Error("Recovery copy not verified");
          copy.recoveryKey = recoveryKey;
        } catch { copy.memoryOnly = true; }
        emit();
        throw Object.assign(new Error("Stored data changed outside this editor. Both copies are preserved for recovery."), { code: "EDITOR_CONFLICT", records: copy });
      }
    }
    return actual;
  }
  function mutate(key, value, initializing = false) {
    assertOwner(!initializing);
    try {
      check(key, value);
      attempted.set(key, value);
      if (value === null) raw.removeItem(key); else raw.setItem(key, value);
      if (raw.getItem(key) !== value) throw new Error("Local persistence could not be verified");
      expected.set(key, value); attempted.delete(key); failures.delete(key); pending.delete(key);
      revision++; emit();
    } catch (error) { attempted.set(key, value); failures.set(key, error.message); emit(); throw error; }
  }
  const session = {
    id, snapshot, assertOwner, isOwner: () => active && initialization === "ready" && !conflicts.length && !unreadable,
    initialize(prepare) {
      if (initialization !== "pending") throw new Error("Reload before retrying initialization.");
      try {
        assertOwner(false);
        for (const key of expected.keys()) check(key);
        const candidate = prepare(original);
        if (!candidate || !(candidate.serialized === null || typeof candidate.serialized === "string")) throw new Error("Invalid prepared state");
        if (original.canonical !== null && candidate.serialized === null) throw new Error("Initialization cannot remove existing canonical data");
        if (candidate.serialized !== original.canonical) {
          // Validate in prepare(), then preserve the original and verify a staged copy
          // BEFORE replacing canonical state. No component/SDK can write in this phase.
          mutate(`brk-initialization-original:${id}`,JSON.stringify(original),true);
          mutate(`brk-initialization-stage:${id}`,candidate.serialized,true);
          mutate("liftlog-data",candidate.serialized,true);
        }
        prepared = candidate;
        initialization = "ready"; emit(); return true;
      } catch {
        initializationError = "Saved data could not be initialized safely. Original copies are preserved for export.";
        initialization = "failed"; emit(); return false;
      }
    },
    initializedState() { assertOwner(); return prepared; },
    storage: {
      getItem(key) {
        assertOwner();
        try { return check(key, attempted.get(key)); }
        catch (error) { unreadable = true; failures.set(key, error.message); emit(); throw error; }
      },
      setItem(key, value) { mutate(key, String(value)); },
      removeItem(key) { mutate(key, null); },
    },
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
    markPending(key) { if (active) { pending.add(key); emit(); } },
    cancelPending(key) { pending.delete(key); emit(); },
    registerFlush(fn) { flushers.add(fn); return () => flushers.delete(fn); },
    observe(key) {
      if (!active || key?.startsWith("brk-recovery:")) return;
      try {
        assertOwner();
        for (const changed of key === null ? expected.keys() : [key]) check(changed);
      } catch (error) {
        if (!conflicts.length) unreadable = true;
        failures.set(key, error.message); emit();
      }
    },
    flush() { for (const fn of flushers) fn(); },
    prepareRelease() {
      assertOwner(); session.flush();
      if (running || pending.size || failures.size) throw new Error("Not saved. Finish pending operations or retry saving before releasing editing.");
      for (const key of expected.keys()) check(key);
    },
    revoke() { active = false; emit(); },
    async task(fn) {
      assertOwner(); running++; emit();
      // Callers fence results through this capability's storage/state updater. A completed
      // request is allowed to settle after pagehide; it cannot reactivate the capability.
      try { return await fn(); }
      finally { running--; emit(); }
    },
    recovery() {
      const observed = [...expected.keys()].filter(recoverable).map((key) => {
        try { return [key, raw.getItem(key)]; } catch { return [key, { unreadable: true }]; }
      });
      return { owner: id, revision, initialization, initializationError, original, conflicts, base: [...expected].filter(([key]) => recoverable(key)), observed, failedWrites: [...failures], attempted: [...attempted].filter(([key]) => recoverable(key)) };
    },
  };
  return session;
}
