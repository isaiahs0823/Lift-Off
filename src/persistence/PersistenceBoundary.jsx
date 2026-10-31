import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { activateEditor, createEditorSession, EDITOR_LOCK } from "./editorSession.js";
import { prepareInitialization } from "./initialization.js";

// App (including Supabase's auth client) is not imported until ownership is granted.
const EditorApp = lazy(() => import("../App.jsx"));
export default function PersistenceBoundary() {
  const [mode, setMode] = useState("opening"), [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState(null), [message, setMessage] = useState("");
  const holder = useRef(null);
  const admitted = useRef(false);
  useEffect(() => {
    let disposed = false, release;
    if (!globalThis.isSecureContext || !navigator.locks?.request) { setMode("unavailable"); return; }
    navigator.locks.request(EDITOR_LOCK, { mode: "exclusive", ifAvailable: true }, async (lock) => {
      if (disposed) return;
      if (!lock) { setMode("readonly"); return; }
      let raw;
      try { raw = window.localStorage; }
      catch { raw = { getItem() { throw new Error("Saved storage is unavailable"); } }; }
      const session = createEditorSession(raw);
      session.initialize(prepareInitialization);
      activateEditor(session);
      admitted.current = !session.snapshot().blocked;
      const off = session.subscribe(setStatus);
      const done = new Promise((resolve) => { release = resolve; });
      holder.current = { session, release: () => { session.revoke(); release(); } };
      const hide = () => {
        try { session.flush(); } catch { /* Last durable copies remain intact. */ }
        finally { holder.current.release(); setMode("released"); }
      };
      const show = (event) => { if (event.persisted) window.location.reload(); };
      const changed = (event) => {
        if (event.storageArea === raw) session.observe(event.key);
      };
      const unload = (event) => {
        try { session.prepareRelease(); } catch { event.preventDefault(); event.returnValue = ""; }
      };
      window.addEventListener("pagehide", hide);
      window.addEventListener("pageshow", show);
      window.addEventListener("beforeunload", unload);
      window.addEventListener("storage", changed);
      setMode("owner");
      await done;
      off();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("storage", changed);
      // Keep pageshow fencing for BFCache restores: this realm must never regain ownership.
    }).catch((error) => { if (!disposed) { setMessage(error.message); setMode("unavailable"); } });
    return () => { disposed = true; if (release) { holder.current?.session.revoke(); release(); } };
  }, [attempt]);
  const relinquish = () => {
    try {
      holder.current.session.prepareRelease();
      holder.current.release(); setMode("released"); setMessage("");
    } catch (error) { setMessage(error.message); }
  };
  const exportRecovery = () => {
    const payload = holder.current?.session.recovery();
    const link = document.createElement("a"), url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    link.href = url; link.download = "brk-persistence-recovery.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    {mode === "owner" ? <>
      {status?.initialization === "failed" && <section className="p-6 space-y-3">
        <h1 className="text-xl font-bold">Initialization failed</h1>
        <p role="alert">Your saved data could not be opened safely. Editing and account synchronization are disabled. No data has been reset.</p>
        <button className="underline" onClick={exportRecovery}>Export original saved data</button>
        <button className="underline ml-4" onClick={() => window.location.reload()}>Reload to retry safely</button>
      </section>}
      <div className="bg-v5-surface text-v5-subtext px-4 py-2 text-xs flex flex-wrap items-center gap-3">
        <span role={status?.error ? "alert" : undefined}>{status?.error ? "Not saved — keep this tab open and retry or export recovery." : "Editing in this tab"}</span>
        <button onClick={relinquish} className="underline">Release editing</button>
        {status?.error && <button onClick={exportRecovery} className="underline">Export persistence recovery</button>}
        {message && <span role="alert">{message}</span>}
      </div>
      {status?.blocked && <p className="p-6" role="status">Read-only: saved copies need recovery review. Export them before reloading or resolving the conflict.</p>}
      {admitted.current && <fieldset disabled={!!status?.blocked || !status?.active}>
        <Suspense fallback={<p className="p-6">Opening your saved workout…</p>}><EditorApp /></Suspense>
      </fieldset>}
    </> : <main className="min-h-screen bg-v5-bg text-v5-text p-6 space-y-4">
      <h1 className="text-xl font-bold">{mode === "opening" ? "Opening BRK Fit" : "Read-only"}</h1>
      <p>{mode === "readonly" ? "BRK Fit is being edited in another tab. Use that tab, or release editing there first. This tab has not loaded an editable copy." : mode === "released" ? "Editing released. Saved changes are available to the next editor. Reload this tab to request editing again." : mode === "unavailable" ? "Safe editing coordination is unavailable. Use a supported browser in a secure context. Your saved data has not been changed." : "Checking safe editing access…"}</p>
      <p>Only saved changes transfer. No tab can force another editor to release its workout.</p>
      {message && <p role="alert">{message}</p>}
      {mode === "readonly" && <button className="underline" onClick={() => { setMode("opening"); setAttempt((n) => n + 1); }}>Enable editing</button>}
      {mode === "released" && <button className="underline" onClick={() => window.location.reload()}>Reload to edit</button>}
    </main>}
  </>;
}
