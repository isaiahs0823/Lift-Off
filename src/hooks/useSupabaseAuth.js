import { getEditorSession } from "../persistence/editorSession.js";
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase, supabaseEnabled } from "../lib/supabaseClient.js";
import { parseAuthCallbackError, urlWithAuthParamsCleared } from "../utils/authCallback.js";

// Authentication is independent of athlete-data admission. Identity changes revoke the
// previous account generation before any new account may open the retained dataset.
export function useSupabaseAuth() {
  const persistence = getEditorSession();
  const authRevision=useRef(0), signingOut=useRef(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(supabaseEnabled);
  // P0 auth audit, root cause #4 — a failed magic-link verification (expired, already used, or
  // redirect origin not on Supabase's allow-list) previously left zero trace: this reads it once
  // on mount, before anything strips it, then cleans the URL so a reload never re-shows it.
  const [authCallbackError, setAuthCallbackError] = useState(() => {
    if (typeof window === "undefined" || !supabaseEnabled) return null;
    return parseAuthCallbackError(window.location.hash, window.location.search);
  });
  const dismissAuthCallbackError = useCallback(() => setAuthCallbackError(null), []);

  useEffect(() => {
    if (!supabaseEnabled) {persistence.account.identity(null);return;}
    if (authCallbackError && window.history?.replaceState) {
      window.history.replaceState(null, "", urlWithAuthParamsCleared(window.location.href));
    }
    let active = true;
    const accept=(data,revision)=>{
      if(!active || !persistence.isEditor() || signingOut.current || revision!==authRevision.current)return;
      persistence.account.identity(data.session?.user?.id ?? null);
      setSession(data.session ?? null);setAuthLoading(false);
      if(data.session)setAuthCallbackError(null);
    };
    const restore=async revision=>{
      try {
        const {data,error}=await persistence.authTask(()=>supabase.auth.getSession());
        if(error)throw error;
        accept(data,revision);
      } catch {
        if(active && revision===authRevision.current){persistence.account.suspend();setAuthLoading(false);setAuthCallbackError({code:"restore_failed",description:"Could not verify account access. Reload to retry safely."});}
      }
    };
    supabase.auth.startAutoRefresh();
    restore(authRevision.current);
    const {data:listener}=supabase.auth.onAuthStateChange((_event,nextSession)=>{
      if(!active)return;
      const revision=++authRevision.current;
      // Revoke immediately, before React renders. Do not trust a late event's account ID.
      if(nextSession?.user?.id !== persistence.account.snapshot().accountId || _event==='SIGNED_OUT')persistence.account.suspend();
      if(!persistence.isEditor()){setAuthLoading(false);setSession(null);return;}
      // SDK auth methods must run outside its onAuthStateChange lock/callback.
      setTimeout(()=>{if(active && !signingOut.current && revision===authRevision.current)restore(revision);},0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      supabase.auth.stopAutoRefresh();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- authCallbackError is read once at
    // mount time (the useState initializer above) and only ever cleared afterward; including it
    // here would just re-run URL cleanup on every dismiss, which is harmless but pointless.
  }, []);

  const signInWithEmail = useCallback(async (email) => {
    if (!supabaseEnabled) throw new Error("Cloud sync isn't configured yet.");
    const { error } = await persistence.authTask(() => supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    }));
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return;
    if(persistence.isOwner()) persistence.prepareAccountChange();
    signingOut.current=true;authRevision.current++;
    persistence.account.suspend();
    try {
      const {error}=await persistence.authTask(()=>supabase.auth.signOut());
      if(error)throw error;
      const {data,error:restoreError}=await persistence.authTask(()=>supabase.auth.getSession());
      if(restoreError)throw restoreError;
      persistence.account.identity(data.session?.user?.id ?? null);
      setSession(data.session ?? null);
    } finally {signingOut.current=false;}

  }, []);

  return {
    supabaseEnabled,
    authLoading,
    session,
    user: session?.user ?? null,
    signInWithEmail,
    signOut,
    authCallbackError,
    dismissAuthCallbackError,
  };
}
