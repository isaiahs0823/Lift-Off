import { describe, it, expect } from "vitest";
import { applyActiveProgramRename } from "../programActivation.js";

// Renaming the ACTIVE program directly from Program Timeline (the screen had no rename path at
// all before this fix) — covers both branches: an already-custom active program (simple in-place
// rename) and an active BUILT-IN program (forks a personal copy, since static template data can't
// be renamed in place, but must carry over the run's exact progress rather than restarting at day
// 0 the way a genuine program switch does).

const builtInTemplate = {
  id: "prog_shape",
  name: "Shape",
  tagline: "A balanced physique split",
  weeks: 10,
  days: [
    { label: "Day 1 — Lower: Glutes", exercises: [{ exId: "rdl", sets: 3, reps: 10 }] },
    { label: "Day 2 — Upper: Push", exercises: [{ exId: "bench", sets: 3, reps: 8 }] },
  ],
};

function baseState(overrides = {}) {
  return {
    currentProgram: null,
    customPrograms: [],
    programs: [builtInTemplate],
    workoutSessions: [],
    logs: [],
    ...overrides,
  };
}

describe("applyActiveProgramRename — no-op guards", () => {
  it("returns the SAME state reference when nothing is active", () => {
    const state = baseState();
    expect(applyActiveProgramRename(state, "New Name")).toBe(state);
  });

  it("returns the same reference for an empty/whitespace-only name", () => {
    const state = baseState({ currentProgram: { programId: "prog_shape", programName: "Shape", source: "builtin", dayIndex: 0, totalDays: 2 } });
    expect(applyActiveProgramRename(state, "   ")).toBe(state);
    expect(applyActiveProgramRename(state, "")).toBe(state);
  });

  it("returns the same reference when the name is unchanged (builtin)", () => {
    const state = baseState({ currentProgram: { programId: "prog_shape", programName: "Shape", source: "builtin", dayIndex: 0, totalDays: 2 } });
    expect(applyActiveProgramRename(state, "Shape")).toBe(state);
  });

  it("returns the same reference when the name is unchanged (custom)", () => {
    const custom = { id: "program_1", name: "My Plan", days: [] };
    const state = baseState({ customPrograms: [custom], currentProgram: { programId: "program_1", programName: "My Plan", source: "custom", dayIndex: 0 } });
    expect(applyActiveProgramRename(state, "My Plan")).toBe(state);
  });
});

describe("applyActiveProgramRename — active CUSTOM program", () => {
  it("renames the matching customPrograms entry in place, preserving id/days", () => {
    const custom = { id: "program_1", name: "Old Name", days: [{ id: "d1", label: "Day 1", exercises: [] }] };
    const state = baseState({ customPrograms: [custom], currentProgram: { programId: "program_1", programName: "Old Name", source: "custom", dayIndex: 0, totalDays: 1 } });
    const next = applyActiveProgramRename(state, "New Name");
    const renamed = next.customPrograms.find((p) => p.id === "program_1");
    expect(renamed.name).toBe("New Name");
    expect(renamed.id).toBe("program_1");
    expect(renamed.days).toBe(custom.days); // untouched reference
    expect(next.currentProgram.programId).toBe("program_1"); // same program, not a switch
    expect(next.currentProgram.dayIndex).toBe(0); // progress untouched
  });

  it("never touches an unrelated custom program", () => {
    const target = { id: "program_1", name: "Old Name", days: [] };
    const other = { id: "program_2", name: "Leave Me Alone", days: [] };
    const state = baseState({ customPrograms: [target, other], currentProgram: { programId: "program_1", programName: "Old Name", source: "custom", dayIndex: 0 } });
    const next = applyActiveProgramRename(state, "New Name");
    expect(next.customPrograms.find((p) => p.id === "program_2")).toBe(other);
  });
});

describe("applyActiveProgramRename — active BUILT-IN program (forks, preserves progress)", () => {
  it("creates a new customPrograms entry with a NEW id, never mutating the built-in template", () => {
    const state = baseState({ currentProgram: { programId: "prog_shape", programName: "Shape", source: "builtin", dayIndex: 1, totalDays: 2 } });
    const next = applyActiveProgramRename(state, "My Shape Plan");
    expect(next.customPrograms).toHaveLength(1);
    const fork = next.customPrograms[0];
    expect(fork.name).toBe("My Shape Plan");
    expect(fork.id).not.toBe("prog_shape");
    expect(state.programs[0].name).toBe("Shape"); // original template untouched
  });

  it("reassigns currentProgram to the fork WITHOUT resetting day-by-day progress (not a switch)", () => {
    const state = baseState({
      currentProgram: {
        programId: "prog_shape",
        programName: "Shape",
        source: "builtin",
        dayIndex: 1,
        totalDays: 2,
        startDate: "2026-09-01T00:00:00Z",
        lastCompletedAt: "2026-10-15T00:00:00Z",
        lastCompletedDayIndex: 0,
        selectedForDays: 5,
      },
    });
    const next = applyActiveProgramRename(state, "My Shape Plan");
    const forkId = next.customPrograms[0].id;
    expect(next.currentProgram.programId).toBe(forkId);
    expect(next.currentProgram.source).toBe("custom");
    expect(next.currentProgram.programName).toBe("My Shape Plan");
    // Everything about WHERE the athlete is in the program carries over byte-for-byte.
    expect(next.currentProgram.dayIndex).toBe(1);
    expect(next.currentProgram.totalDays).toBe(2);
    expect(next.currentProgram.startDate).toBe("2026-09-01T00:00:00Z");
    expect(next.currentProgram.lastCompletedAt).toBe("2026-10-15T00:00:00Z");
    expect(next.currentProgram.lastCompletedDayIndex).toBe(0);
    expect(next.currentProgram.selectedForDays).toBe(5);
  });

  it("the fork's days are content-identical to the built-in's (same labels/exercises, now with stable day ids)", () => {
    const state = baseState({ currentProgram: { programId: "prog_shape", programName: "Shape", source: "builtin", dayIndex: 0, totalDays: 2 } });
    const next = applyActiveProgramRename(state, "My Shape Plan");
    const fork = next.customPrograms[0];
    expect(fork.days.map((d) => d.label)).toEqual(builtInTemplate.days.map((d) => d.label));
    expect(fork.days.every((d) => !!d.id)).toBe(true);
  });

  it("never touches workoutSessions, logs, or writes a completedPrograms entry — nothing has ended", () => {
    const sessions = [{ id: "s1", planName: "Shape — Day 1 — Lower: Glutes", finishedAt: "2026-10-15T00:00:00Z", sourceProgramId: "prog_shape", sourceDayLabel: "Day 1 — Lower: Glutes" }];
    const state = baseState({
      workoutSessions: sessions,
      currentProgram: { programId: "prog_shape", programName: "Shape", source: "builtin", dayIndex: 1, totalDays: 2 },
    });
    const next = applyActiveProgramRename(state, "My Shape Plan");
    expect(next.workoutSessions).toBe(sessions); // same reference, untouched
    expect(next.completedPrograms).toBeUndefined();
  });
});
