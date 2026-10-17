import { describe, it, expect } from "vitest";
import { initialSyncStatus, markSyncStarted, markSyncSuccess, markSyncFailure, formatLastSynced, MAX_SYNC_ATTEMPTS } from "../syncStatus.js";

describe("sync status transitions — 'never falsely reported as successful' (P0 audit item 6)", () => {
  it("starts with no success recorded", () => {
    expect(initialSyncStatus().lastSuccessAt).toBeNull();
  });

  it("markSyncFailure NEVER sets lastSuccessAt, no matter how many times it's called", () => {
    let status = initialSyncStatus();
    status = markSyncStarted(status, 1);
    status = markSyncFailure(status, ["workout_sessions: network error"], true);
    expect(status.lastSuccessAt).toBeNull();
    expect(status.lastError).toContain("network error");
    status = markSyncStarted(status, 2);
    status = markSyncFailure(status, ["workout_sessions: network error"], true);
    expect(status.lastSuccessAt).toBeNull();
  });

  it("markSyncSuccess is the ONLY function that sets lastSuccessAt, and clears any prior error", () => {
    let status = initialSyncStatus();
    status = markSyncFailure(status, ["boom"], false);
    expect(status.lastError).toBe("boom");
    status = markSyncSuccess(status);
    expect(status.lastError).toBeNull();
    expect(typeof status.lastSuccessAt).toBe("string");
  });

  it("a failure before MAX_SYNC_ATTEMPTS leaves pending true (another retry is coming)", () => {
    const status = markSyncFailure(markSyncStarted(initialSyncStatus(), 1), ["x"], 1 < MAX_SYNC_ATTEMPTS);
    expect(status.pending).toBe(true);
  });

  it("a failure AT MAX_SYNC_ATTEMPTS leaves pending false (stop retrying, offer manual retry)", () => {
    const status = markSyncFailure(markSyncStarted(initialSyncStatus(), MAX_SYNC_ATTEMPTS), ["x"], false);
    expect(status.pending).toBe(false);
    expect(status.lastError).toBeTruthy(); // the error stays visible once retries are exhausted
  });

  it("markSyncStarted records an attempt timestamp without touching lastSuccessAt", () => {
    const prior = markSyncSuccess(initialSyncStatus());
    const started = markSyncStarted(prior, 1);
    expect(started.lastSuccessAt).toBe(prior.lastSuccessAt); // untouched by starting a NEW attempt
    expect(started.pending).toBe(true);
  });
});

describe("formatLastSynced", () => {
  it("reads 'Never synced' when nothing has ever succeeded", () => {
    expect(formatLastSynced(null)).toBe("Never synced");
  });

  it("reads 'Just now' for a very recent sync", () => {
    const now = new Date("2026-01-01T12:00:30Z");
    expect(formatLastSynced("2026-01-01T12:00:00Z", now)).toBe("Just now");
  });

  it("reads in minutes, then hours, then days, as time passes", () => {
    const base = new Date("2026-01-01T12:00:00Z").toISOString();
    expect(formatLastSynced(base, new Date("2026-01-01T12:05:00Z"))).toBe("5 minutes ago");
    expect(formatLastSynced(base, new Date("2026-01-01T15:00:00Z"))).toBe("3 hours ago");
    expect(formatLastSynced(base, new Date("2026-01-04T12:00:00Z"))).toBe("3 days ago");
  });
});
