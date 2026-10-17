import { describe, it, expect } from "vitest";
import { isReplacingActiveProgram, applyProgramActivation, nextCurrentProgramForStartRun } from "../programActivation.js";

function baseState(overrides = {}) {
  return {
    currentProgram: null,
    customPrograms: [],
    programs: [],
    workoutSessions: [{ id: "s1", planName: "Old Program — Day 1", finishedAt: "2026-01-01T00:00:00Z" }],
    logs: [{ id: "l1", exId: "bench", sets: [{ weight: 100, reps: 5 }] }],
    weeklySchedule: { mode: "fixed", fixedDays: { mon: { type: "rest", source: null, label: "Rest" } }, createdAt: "2026-01-01T00:00:00Z" },
    athleteProfile: { preferredDays: 4 },
    hasSeenOnboarding: true,
    ...overrides,
  };
}

const program = { id: "program_1", name: "Upper Lower", days: [{ id: "day_1", label: "Upper Heavy" }, { id: "day_2", label: "Lower Heavy" }] };

describe("isReplacingActiveProgram", () => {
  it("is false when no program is currently active", () => {
    expect(isReplacingActiveProgram(baseState(), program, "custom")).toBe(false);
  });

  it("is false when re-activating the SAME already-active program", () => {
    const state = baseState({ currentProgram: { programId: "program_1", programName: "Upper Lower", source: "custom", dayIndex: 3 } });
    expect(isReplacingActiveProgram(state, program, "custom")).toBe(false);
  });

  it("is true when a DIFFERENT program is currently active", () => {
    const state = baseState({ currentProgram: { programId: "program_other", programName: "Berserker", source: "builtin", dayIndex: 0 } });
    expect(isReplacingActiveProgram(state, program, "custom")).toBe(true);
  });

  it("is true when the same programId is active but under a different source (builtin vs its custom fork)", () => {
    const state = baseState({ currentProgram: { programId: "program_1", programName: "Upper Lower", source: "builtin", dayIndex: 0 } });
    expect(isReplacingActiveProgram(state, program, "custom")).toBe(true);
  });
});

describe("applyProgramActivation", () => {
  it("sets currentProgram to the new program, starting at day 0", () => {
    const next = applyProgramActivation(baseState(), program, "custom");
    expect(next.currentProgram).toMatchObject({
      programId: "program_1",
      programName: "Upper Lower",
      source: "custom",
      dayIndex: 0,
      totalDays: 2,
      lastCompletedAt: null,
      lastCompletedDayIndex: null,
    });
    expect(typeof next.currentProgram.startDate).toBe("string");
  });

  it("never sets activeRun / never starts a logging session (the task's explicit 'Important' rule)", () => {
    const next = applyProgramActivation(baseState(), program, "custom");
    expect(next).not.toHaveProperty("activeRun");
  });

  it("clears a stale programDayOverride and any pending frequency review", () => {
    const state = baseState({ programDayOverride: { sourceType: "program", programId: "program_other" }, pendingFrequencyReview: { fromDays: 3, toDays: 5 } });
    const next = applyProgramActivation(state, program, "custom");
    expect(next.programDayOverride).toBeNull();
    expect(next.pendingFrequencyReview).toBeNull();
  });

  it("never touches workoutSessions, logs, customPrograms, or weeklySchedule — activation cannot lose existing data", () => {
    const state = baseState();
    const next = applyProgramActivation(state, program, "custom");
    expect(next.workoutSessions).toBe(state.workoutSessions);
    expect(next.logs).toBe(state.logs);
    expect(next.customPrograms).toBe(state.customPrograms);
    expect(next.weeklySchedule).toBe(state.weeklySchedule);
  });

  it("preserves the athlete's preferredDays into selectedForDays", () => {
    const next = applyProgramActivation(baseState({ athleteProfile: { preferredDays: 5 } }), program, "custom");
    expect(next.currentProgram.selectedForDays).toBe(5);
  });

  it("switching from program A to program B fully replaces currentProgram — no leftover fields from A", () => {
    const stateWithA = baseState({ currentProgram: { programId: "program_A", programName: "Program A", source: "custom", dayIndex: 3, totalDays: 4, lastCompletedAt: "2026-01-02T00:00:00Z", lastCompletedDayIndex: 2 } });
    const programB = { id: "program_B", name: "Program B", days: [{ id: "b1", label: "Day 1" }] };
    const next = applyProgramActivation(stateWithA, programB, "custom");
    expect(next.currentProgram.programId).toBe("program_B");
    expect(next.currentProgram.dayIndex).toBe(0);
    expect(next.currentProgram.lastCompletedAt).toBeNull();
    expect(next.currentProgram.lastCompletedDayIndex).toBeNull();
    // Program A's own history session is untouched (same reference, not just equal content).
    expect(next.workoutSessions).toBe(stateWithA.workoutSessions);
  });
});

// The currentProgram patch startRun applies whenever a run carries a programContext — covers the
// bug a non-current-day "Start This Workout" (Program Timeline) or a Swap Workout → Today → Start
// round trip would otherwise reintroduce: starting a SWAPPED day of the already-active program
// must never move the program's real sequential position.
describe("nextCurrentProgramForStartRun", () => {
  const activeCP = { programId: "program_1", programName: "Upper Lower", source: "custom", dayIndex: 1, totalDays: 3, startDate: "2026-01-01T00:00:00Z", selectedForDays: 4 };

  it("starting a SWAPPED day of the SAME program preserves dayIndex/totalDays/startDate — only identity fields come from programContext", () => {
    // Athlete is on Day 2 (index 1) of a 3-day program, but swapped today to Day 3 (index 2).
    const programContext = { programId: "program_1", programName: "Upper Lower", source: "custom", dayIndex: 2, totalDays: 3 };
    const next = nextCurrentProgramForStartRun(activeCP, programContext, null);
    expect(next.dayIndex).toBe(1); // NOT 2 — real progress untouched by the one-day swap
    expect(next.totalDays).toBe(3);
    expect(next.startDate).toBe("2026-01-01T00:00:00Z");
    expect(next.selectedForDays).toBe(4);
    expect(next.programId).toBe("program_1");
  });

  it("starting the program's own literal CURRENT day (no swap) is a no-op in effect — same dayIndex either way", () => {
    const programContext = { programId: "program_1", programName: "Upper Lower", source: "custom", dayIndex: 1, totalDays: 3 };
    const next = nextCurrentProgramForStartRun(activeCP, programContext, null);
    expect(next.dayIndex).toBe(1);
  });

  it("activating a genuinely DIFFERENT program (no prior currentProgram) takes dayIndex/totalDays fresh from programContext", () => {
    const programContext = { programId: "program_new", programName: "New Program", source: "custom", dayIndex: 0, totalDays: 4 };
    const next = nextCurrentProgramForStartRun(null, programContext, 5);
    expect(next.dayIndex).toBe(0);
    expect(next.totalDays).toBe(4);
    expect(next.selectedForDays).toBe(5); // falls back to the athlete's stated preference
    expect(next.startDate).toEqual(expect.any(String));
  });

  it("switching to a different program while one is already active also takes dayIndex fresh, not the old program's position", () => {
    const programContext = { programId: "program_other", programName: "Other Program", source: "builtin", dayIndex: 0, totalDays: 5 };
    const next = nextCurrentProgramForStartRun(activeCP, programContext, null);
    expect(next.dayIndex).toBe(0);
    expect(next.totalDays).toBe(5);
    expect(next.selectedForDays).toBeNull(); // not the same program — old selectedForDays doesn't carry over
  });
});
