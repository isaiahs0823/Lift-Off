// ---------------- AUTH CALLBACK ERROR DETECTION ----------------
// P0 auth audit — root cause #4: a magic link that fails to verify (expired, already used, or
// the redirect origin wasn't on Supabase's allow-list) sends the athlete back with
// #error=...&error_code=...&error_description=... (or the same three as query params, depending
// on flow) appended to the URL. supabase-js's own `detectSessionInUrl` only ever handles the
// SUCCESS case — on failure it finds nothing to exchange, `getSession()` resolves to null, and
// the athlete lands back in the app looking exactly like someone who never tried to sign in.
// Nothing previously read these params at all. Pure, no React/window-dependent state, so it's
// unit-testable — useSupabaseAuth.js just calls these against the real window.location.
export function parseAuthCallbackError(hash, search) {
  const fromHash = new URLSearchParams((hash || "").replace(/^#/, ""));
  const fromSearch = new URLSearchParams(search || "");
  const params = fromHash.get("error") ? fromHash : fromSearch.get("error") ? fromSearch : null;
  if (!params) return null;
  const code = params.get("error_code") || params.get("error");
  const rawDescription = params.get("error_description");
  const description = rawDescription ? rawDescription.replace(/\+/g, " ") : "That sign-in link didn't work.";
  return { code, description };
}

// A friendlier, actionable version of Supabase's raw error for the UI — the raw
// error_description ("Email link is invalid or has expired") is accurate but doesn't tell the
// athlete what to actually do next.
export function friendlyAuthCallbackMessage(authCallbackError) {
  if (!authCallbackError) return null;
  if (authCallbackError.code === "otp_expired") {
    return "That sign-in link expired. Request a new one below — links are valid for a limited time.";
  }
  if (authCallbackError.code === "access_denied") {
    return "That sign-in link couldn't be verified (it may have already been used). Request a new one below.";
  }
  return `${authCallbackError.description} Request a new sign-in link below.`;
}

// Strips the error params (from both hash and query string) once read, so a reload or a
// bookmarked link never re-surfaces a stale "link expired" message. Never touches
// localStorage/session data — this is a pure string transform of the URL the caller then applies
// via history.replaceState.
export function urlWithAuthParamsCleared(href) {
  const url = new URL(href);
  url.hash = "";
  ["error", "error_code", "error_description"].forEach((k) => url.searchParams.delete(k));
  return url.pathname + url.search;
}
