// Web Locks supplies exclusion. Snapshot revisions below only detect unexpected writers;
// localStorage read/compare/write is deliberately NOT used to acquire ownership.
export const EDITOR_LOCK = "brk-fit:user-state:single-editor:v1";
const KEYS = ["brk-dataset-ownership:v1", "liftlog-data", "liftlog-active-run", "liftlog-sync-status", "liftlog-rest-timer", "liftlog-interval-timer", "brk-standalone-rest-timer"];
const recoverable = (key) => KEYS.includes(key) || key.startsWith("brk-account-recovery:"); // Never duplicate/export SDK auth credentials.
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
  let initialization = "pending", prepared = null, initializationError = null, preparer=null, accountGuard=null;
  const authKey = key => /^sb-.*-auth-token(?:.*)?$/.test(key);
  const assertAccount = key => { if(accountGuard && !authKey(key) && !accountGuard()) throw Object.assign(new Error("Athlete data is protected by account ownership."), {code:"ACCOUNT_CHANGED"}); };
  const expected = new Map(), attempted = new Map(), failures = new Map(), pending = new Set(), conflicts = [];
  const listeners = new Set(), flushers = new Set();
  let accountRecovery=null;
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
  const existingAthleteData = KEYS.filter(key=>key!=="brk-dataset-ownership:v1").some(key=>expected.get(key)!=null);
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
  function mutate(key, value, initializing = false, control = false) {
    assertOwner(!initializing);
    if(!initializing && !control) assertAccount(key);
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
    id, snapshot, assertOwner,
    isEditor: () => active && initialization === "ready" && !conflicts.length && !unreadable,
    isOwner: () => session.isEditor() && (!accountGuard || accountGuard()),
    installAccountGuard(fn) {if(accountGuard)throw Error("Ownership guard already installed");accountGuard=fn;},
    hadAthleteData: () => existingAthleteData,
    verifyExportOwnership(value) {
      if(!active || initialization!=="ready")return false;
      try {
        if(raw.getItem("brk-dataset-ownership:v1")!==value)return false;
        // Conflict quarantine blocks mutation, not an authorized recovery download.
        // Credentials must still match the session that verified this account.
        return [...expected].filter(([key])=>authKey(key)).every(([key,accepted])=>raw.getItem(key)===accepted);
      } catch {return false;}
    },
    hasAccountRecovery: () => !!accountRecovery || [...expected].some(([key,value])=>key.startsWith("brk-account-recovery:") && value!==null),
    preserveAccountTransition(metadata) {
      if(!pending.size && ![...failures.keys()].some(key=>KEYS.includes(key)))return false;
      accountRecovery ??= {metadata,original,base:[...expected].filter(([key])=>KEYS.includes(key)),attempted:[...attempted].filter(([key])=>KEYS.includes(key)),pending:[...pending]};
      const key=`brk-account-recovery:${id}`;
      try {mutate(key,JSON.stringify(accountRecovery),false,true);}catch{/* Keep the full copy in memory if storage rejects the recovery journal too. */}
      return true;
    },
    controlStorage: {
      getItem(key) {assertOwner();if(key!=="brk-dataset-ownership:v1")throw Error("Invalid ownership key");return check(key);},
      setItem(key,value) {if(key!=="brk-dataset-ownership:v1")throw Error("Invalid ownership key");mutate(key,String(value),false,true);},
    },
    scoped() {
      const lease=session.account?.lease();
      const current=()=>session.isOwner() && (!lease || lease.current());
      const assert=()=>{assertOwner();if(!current())throw Object.assign(new Error("Account generation changed"),{code:"ACCOUNT_CHANGED"});};
      return {...session,isOwner:current,assertOwner:assert,
        storage:{getItem(key){assert();return session.storage.getItem(key);},setItem(key,value){assert();return session.storage.setItem(key,value);},removeItem(key){assert();return session.storage.removeItem(key);}},
        async task(fn){assert();const result=await session.task(fn);assert();return result;},
      };
    },
    initialize(prepare) {
      preparer=prepare;
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
    initializedState() { assertOwner(); if(accountGuard) assertAccount("liftlog-data"); return preparer ? preparer({canonical:check("liftlog-data"),active:check("liftlog-active-run")}) : prepared; },
    storage: {
      getItem(key) {
        assertOwner(); assertAccount(key);
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
    prepareAccountChange() {
      assertOwner(); session.flush();
      if(pending.size || failures.size) throw new Error("Not saved. Retry saving or export recovery before changing accounts.");
    },
    prepareRelease() {
      assertOwner(); session.flush();
      if (running || pending.size || failures.size) throw new Error("Not saved. Finish pending operations or retry saving before releasing editing.");
      for (const key of expected.keys()) check(key);
    },
    revoke() { active = false; emit(); },
    async authTask(fn) {
      assertOwner(); running++; emit();
      try {return await fn();} finally {running--;emit();}
    },
    async task(fn) {
      assertOwner(); assertAccount("liftlog-data"); running++; emit();
      // Callers fence results through this capability's storage/state updater. A completed
      // request is allowed to settle after pagehide; it cannot reactivate the capability.
      try { return await fn(); }
      finally { running--; emit(); }
    },
    recovery() {
      // Failed initialization never imports auth. A known/invalid ownership record
      // must not expose its original athlete snapshot through that fallback screen.
      if(!session.account && !expected.has("brk-dataset-ownership:v1"))return {redacted:true,reason:"Ownership could not be read safely."};
      if(!session.account && expected.get("brk-dataset-ownership:v1")!=null) {
        try {
          const owner=JSON.parse(expected.get("brk-dataset-ownership:v1"));
          if(owner.version!==1 || typeof owner.datasetId!=="string" || !["anonymous","review"].includes(owner.kind) || owner.accountId!==null) return {redacted:true,reason:"Verify the owning account before exporting athlete data."};
        } catch {return {redacted:true,reason:"Ownership must be reviewed before exporting athlete data."};}
      }
      if(session.account && !session.account.canExport()) return {redacted:true, reason:"Sign in as the dataset owner before exporting athlete data."};
      const observed = [...expected.keys()].filter(recoverable).map((key) => {
        try { return [key, raw.getItem(key)]; } catch { return [key, { unreadable: true }]; }
      });
      return { owner: id, revision, initialization, initializationError, original, accountRecovery, conflicts, base: [...expected].filter(([key]) => recoverable(key)), observed, failedWrites: [...failures], attempted: [...attempted].filter(([key]) => recoverable(key)) };
    },
  };
  return session;
}
