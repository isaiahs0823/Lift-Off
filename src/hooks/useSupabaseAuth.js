import { getEditorSession } from "../persistence/editorSession.js";
import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "../lib/supabaseClient.js";
import { parseAuthCallbackError, urlWithAuthParamsCleared } from "../utils/authCallback.js";

// Thin wrapper around Supabase email magic-link auth. Signing in/out is purely additive — the
// app has no concept of "logged out and blocked"; `user` is simply null until someone opts in.
export function useSupabaseAuth() {
  const persistence = getEditorSession();
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
    if (!supabaseEnabled) return;
    if (authCallbackError && window.history?.replaceState) {
      window.history.replaceState(null, "", urlWithAuthParamsCleared(window.location.href));
    }
    let active = true;
    supabase.auth.startAutoRefresh();
    persistence.task(() => supabase.auth.getSession()).then(({ data }) => {
      if (active && persistence.isOwner()) {
        setSession(data.session ?? null);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (active) { setAuthLoading(false); setAuthCallbackError("Couldn't restore account access. Try again after resolving any local persistence error."); }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active || !persistence.isOwner()) return;
      setSession(nextSession ?? null);
      // A link that DOES verify successfully supersedes any stale error from a previous failed
      // attempt still sitting in this tab's state.
      if (nextSession) setAuthCallbackError(null);
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
    const { error } = await persistence.task(() => supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    }));
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return;
    await persistence.task(() => supabase.auth.signOut());
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
