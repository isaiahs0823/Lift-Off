// Disabled-by-default switches for work that is implemented but not yet safe to turn on in
// production. Flip via a Vite env var (never hardcode true here) only after the companion
// migration has been reviewed and applied, and the client has been verified end to end.
export const CLOUD_SYNC_V2_ENABLED = import.meta.env.VITE_CLOUD_SYNC_V2 === "true";
