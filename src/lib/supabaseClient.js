import { createClient } from "@supabase/supabase-js";

// Read-only from env — never hardcode a URL/key here. Both must come from
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (.env, gitignored; see .env.example).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cloud sync is entirely optional — a build with no env vars set (or a user who never signs
// in) must behave exactly like the original local-only app. Every call site checks this instead
// of assuming `supabase` is non-null.
export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
