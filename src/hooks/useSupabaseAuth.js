import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseEnabled } from "../lib/supabaseClient.js";

// Thin wrapper around Supabase email magic-link auth. Signing in/out is purely additive — the
// app has no concept of "logged out and blocked"; `user` is simply null until someone opts in.
export function useSupabaseAuth() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(supabaseEnabled);

  useEffect(() => {
    if (!supabaseEnabled) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session ?? null);
        setAuthLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email) => {
    if (!supabaseEnabled) throw new Error("Cloud sync isn't configured yet.");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return;
    await supabase.auth.signOut();
  }, []);

  return {
    supabaseEnabled,
    authLoading,
    session,
    user: session?.user ?? null,
    signInWithEmail,
    signOut,
  };
}
