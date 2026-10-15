import { describe, it, expect, vi, afterEach } from "vitest";
import { activeProgramAndCP, resolveCurrentProgramDay, resolveTodayWorkout } from "../programSchedule.js";

afterEach(() => {
  vi.useRealTimers();
});

const programA = {
  id: "program_A",
  name: "Program A",
  days: [
    { label: "A Day 1", exercises: [{ exId: "bench", sets: 4, reps: 6 }] },
    { label: "A Day 2", exercises: [{ exId: "squat", sets: 4, reps: 6 }] },
  ],
};
const programB = {
  id: "program_B",
  name: "Program B",
  days: [
    { label: "B Day 1", exercises: [{ exId: "ohp", sets: 3, reps: 8 }] },
    { label: "B Day 2", exercises: [{ exId: "deadlift", sets: 3, reps: 5 }] },
    { label: "B Day 3", exercises: [{ exId: "row", sets: 3, reps: 10 }] },
  ],
};

function stateWithCurrent(cp, extra = {}) {
  return {
    currentProgram: cp,
    customPrograms: [programA, programB].filter((p) => p.id !== undefined),
    programs: [],
    workoutSessions: [],
    recoverySessions: [],
    ...extra,
  };
}

describe("activeProgramAndCP", () => {
  it("returns null when no program is active", () => {
    expect(activeProgramAndCP({ currentProgram: null })).toBeNull();
  });

  it("returns null when the active program was deleted from customPrograms (never crashes)", () => {
    const state = stateWithCurrent({ programId: "program_deleted", source: "custom", dayIndex: 0 }, { customPrograms: [programA] });
    expect(activeProgramAndCP(state)).toBeNull();
  });

  it("resolves the correct program object by id + source", () => {
    const state = stateWithCurrent({ programId: "program_B", source: "custom", dayIndex: 0 });
    const { prog } = activeProgramAndCP(state);
    expect(prog.id).toBe("program_B");
  });
});

describe("resolveCurrentProgramDay — switching between two different active programs", () => {
  it("resolves Program A's own day while A is active", () => {
    const state = stateWithCurrent({ programId: "program_A", programName: "Program A", source: "custom", dayIndex: 0, totalDays: 2, startDate: "2026-01-01T00:00:00Z" });
    const day = resolveCurrentProgramDay(state);
    expect(day.programName).toBe("Program A");
    expect(day.dayLabel).toBe("A Day 1");
    expect(day.plan.exercises).toEqual(programA.days[0].exercises);
  });

  it("switching currentProgram to Program B resolves ONLY Program B's day — nothing from A leaks through", () => {
    const state = stateWithCurrent({ programId: "program_B", programName: "Program B", source: "custom", dayIndex: 1, totalDays: 3, startDate: "2026-01-01T00:00:00Z" });
    const day = resolveCurrentProgramDay(state);
    expect(day.programName).toBe("Program B");
    expect(day.dayLabel).toBe("B Day 2");
    expect(day.plan.exercises).toEqual(programB.days[1].exercises);
    expect(day.totalDays).toBe(3); // B's own day count, not A's
  });

  it("a fresh activation (dayIndex 0, lastCompletedAt null) never shows a stale 'completed today' from the PREVIOUS program", () => {
    // Regression for the exact failure mode item 3 warns about: switching programs must not drag
    // forward a same-day completion flag that belonged to the program just replaced.
    const state = stateWithCurrent({
      programId: "program_B",
      programName: "Program B",
      source: "custom",
      dayIndex: 0,
      totalDays: 3,
      startDate: "2026-01-05T00:00:00Z",
      lastCompletedAt: null,
      lastCompletedDayIndex: null,
    });
    const day = resolveCurrentProgramDay(state);
    expect(day.completedToday).toBe(false);
    expect(day.dayLabel).toBe("B Day 1");
  });
});

describe("resolveTodayWorkout", () => {
  it("falls back to resolveCurrentProgramDay's answer when there is no override", () => {
    const state = stateWithCurrent({ programId: "program_A", programName: "Program A", source: "custom", dayIndex: 0, totalDays: 2 });
    const today = resolveTodayWorkout(state);
    expect(today.programName).toBe("Program A");
    expect(today.isOutsideProgram).toBe(false);
  });

  it("returns null cleanly when nothing is active — never throws", () => {
    expect(resolveTodayWorkout({ currentProgram: null })).toBeNull();
  });
});
