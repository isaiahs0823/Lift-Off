// __APP_VERSION__ / __BUILD_ID__ / __BUILD_TIME__ are literal strings substituted at build time
// by vite.config.js's `define` — there's no runtime lookup, so this file has zero cost and
// works identically in dev and prod. Centralized here so the Help & Guide About row (the one
// place that needs it) doesn't reference bare global identifiers directly.
export const APP_VERSION = __APP_VERSION__;
export const BUILD_ID = __BUILD_ID__;
export const BUILD_TIME = __BUILD_TIME__;
