import { describe, it, expect, vi, afterEach } from "vitest";
import { findMostRecentSessionForPlan, findTodaysSessionForPlan } from "../workoutHistory.js";

afterEach(() => {
  vi.useRealTimers();
});

const sessions = [
  { id: "s1", planName: "Upper Lower — Upper Heavy", finishedAt: "2026-01-01T10:00:00Z" },
  { id: "s2", planName: "Upper Lower — Upper Heavy", finishedAt: "2026-01-08T10:00:00Z" }, // more recent
  { id: "s3", planName: "Push Pull Legs — Push", finishedAt: "2026-01-05T10:00:00Z" },
];

describe("findMostRecentSessionForPlan", () => {
  it("returns the most recent session matching the exact plan name", () => {
    expect(findMostRecentSessionForPlan(sessions, "Upper Lower — Upper Heavy").id).toBe("s2");
  });

  it("never matches a different plan's sessions — a program rename doesn't retroactively relink old history", () => {
    expect(findMostRecentSessionForPlan(sessions, "Upper Lower — Upper Heavy (Renamed)")).toBeNull();
  });

  it("returns null for an empty or missing plan name rather than matching everything", () => {
    expect(findMostRecentSessionForPlan(sessions, null)).toBeNull();
    expect(findMostRecentSessionForPlan(sessions, "")).toBeNull();
  });

  it("is a pure read — never mutates the sessions array passed in", () => {
    const copy = JSON.parse(JSON.stringify(sessions));
    findMostRecentSessionForPlan(sessions, "Upper Lower — Upper Heavy");
    expect(sessions).toEqual(copy);
  });
});

describe("findTodaysSessionForPlan", () => {
  it("returns the session only when its completion date is today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-08T12:00:00"));
    expect(findTodaysSessionForPlan(sessions, "Upper Lower — Upper Heavy").id).toBe("s2");
  });

  it("returns null once the calendar date has moved past the completion — yesterday's workout is not today's", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-09T12:00:00"));
    expect(findTodaysSessionForPlan(sessions, "Upper Lower — Upper Heavy")).toBeNull();
  });
});
