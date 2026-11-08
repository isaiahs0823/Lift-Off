import { it, expect, vi } from "vitest";
import { createEditorSession } from "../../persistence/editorSession.js";
import { prepareInitialization, validateCanonicalData } from "../../persistence/initialization.js";

// Mirrors initialization.test.js's existing helper pattern (same log/history shape, same raw
// localStorage-like mock) rather than inventing a new one — Beginner Experience V2, Stage 2C:
// "Workout-history protection" and "Existing athlete with no onboarding preferences".
const log = { id: "old-log", exId: "bench", date: "2026-01-01", sets: [{ weight: 150, reps: 8 }], targetReps: 8 };
const existingAthleteHistory = () => ({
  hasSeenOnboarding: true,
  logs: [structuredClone(log)],
  workoutSessions: [{ id: "old-session", entries: [structuredClone(log)], workingSets: 1, totalVolume: 1200 }],
  customPlans: [],
  customPrograms: [],
  currentProgram: { programId: "prog_x", programName: "Existing Plan", source: "builtin", dayIndex: 1, totalDays: 3 },
  settings: { rirSystem: "rir", barWeight: 45 },
  // Deliberately NO beginnerOnboarding key — this is every real existing account today.
});
function memory(data, active = null) {
  const values = new Map();
  if (data !== null) values.set("liftlog-data", typeof data === "string" ? data : JSON.stringify(data));
  if (active !== null) values.set("liftlog-active-run", typeof active === "string" ? active : JSON.stringify(active));
  return { values, get length() { return values.size; }, key: (i) => [...values.keys()][i], getItem: (k) => values.get(k) ?? null, setItem: vi.fn((k, v) => values.set(k, v)), removeItem: vi.fn((k) => values.delete(k)) };
}

it("an existing account with no beginnerOnboarding field loads byte-for-byte unchanged — nothing backfills or overwrites it", () => {
  const raw = memory(existingAthleteHistory());
  const original = raw.getItem("liftlog-data");
  const s = createEditorSession(raw, "a");
  expect(s.initialize(prepareInitialization)).toBe(true);
  expect(s.initializedState().data).toEqual(existingAthleteHistory());
  expect(s.initializedState().data.beginnerOnboarding).toBeUndefined();
  expect(raw.getItem("liftlog-data")).toBe(original);
  expect(raw.setItem).not.toHaveBeenCalled();
});

it("an existing account's trainingDetail setting (absent, same as every real account today) is untouched by initialization", () => {
  const raw = memory(existingAthleteHistory());
  const s = createEditorSession(raw, "a");
  s.initialize(prepareInitialization);
  expect(s.initializedState().data.settings.trainingDetail).toBeUndefined();
});

it("a completed beginnerOnboarding record round-trips byte-for-byte on a fresh account", () => {
  const data = { hasSeenOnboarding: true, logs: [], workoutSessions: [], customPlans: [], customPrograms: [], beginnerOnboarding: { experience: "new", goal: "muscle", days: 3, equipment: "full", completedAt: "2026-11-03T00:00:00.000Z" }, settings: { trainingDetail: "simple" } };
  const raw = memory(data);
  const original = raw.getItem("liftlog-data");
  const s = createEditorSession(raw, "a");
  expect(s.initialize(prepareInitialization)).toBe(true);
  expect(s.initializedState().data.beginnerOnboarding).toEqual(data.beginnerOnboarding);
  expect(s.initializedState().data.settings.trainingDetail).toBe("simple");
  expect(raw.getItem("liftlog-data")).toBe(original);
});

it("rejects a malformed (non-object) beginnerOnboarding field rather than silently accepting it", () => {
  const data = { hasSeenOnboarding: true, logs: [], workoutSessions: [], customPlans: [], customPrograms: [], beginnerOnboarding: ["not", "an", "object"] };
  expect(() => validateCanonicalData(data)).toThrow("beginnerOnboarding");
});

it("accepts beginnerOnboarding: null (its documented default/unanswered state)", () => {
  const data = { hasSeenOnboarding: false, logs: [], workoutSessions: [], customPlans: [], customPrograms: [], beginnerOnboarding: null };
  expect(() => validateCanonicalData(data)).not.toThrow();
});

it("workout history and PRs survive initialization unchanged when beginnerOnboarding is present alongside real history", () => {
  const data = { ...existingAthleteHistory(), beginnerOnboarding: { experience: "experienced", goal: "strength", days: 5, equipment: "full", completedAt: "2026-11-03T00:00:00.000Z" } };
  const raw = memory(data);
  const s = createEditorSession(raw, "a");
  s.initialize(prepareInitialization);
  const result = s.initializedState().data;
  expect(result.logs).toEqual(data.logs);
  expect(result.workoutSessions).toEqual(data.workoutSessions);
  expect(result.currentProgram).toEqual(data.currentProgram);
});
