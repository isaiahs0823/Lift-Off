import { describe, it, expect, vi, afterEach } from "vitest";
import { activeProgramAndCP, resolveCurrentProgramDay, resolveTodayWorkout, programWeekAdherence, programTotalAdherence, resolveProgramTimeline, applyProgramDaySwap } from "../programSchedule.js";

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

// A rename only ever changes prog.name — these three functions used to rebuild a match string
// from the CURRENT name (`${prog.name} — ${day.label}`), which meant renaming an active program
// silently un-completed every day logged under its previous name. They now match primarily via
// each session's own sourceProgramId/sourceDayLabel (set at log time, immune to a later rename),
// falling back to the legacy name match only for sessions that predate those fields.
describe("adherence/timeline survive a program rename (regression)", () => {
  const renamedProgram = {
    id: "program_shape_fork",
    name: "My Shape Plan", // the CURRENT, post-rename name
    weeks: 10,
    days: [
      { label: "Day 1 — Lower: Glutes", exercises: [{ exId: "rdl", sets: 3, reps: 10 }] },
      { label: "Day 2 — Upper: Push", exercises: [{ exId: "bench", sets: 3, reps: 8 }] },
    ],
  };
  const cp = { programId: "program_shape_fork", programName: "My Shape Plan", source: "custom", dayIndex: 1, totalDays: 2, startDate: "2026-10-16T00:00:00Z" };

  it("programTotalAdherence still counts a session logged under the program's OLD name, via sourceProgramId+sourceDayLabel", () => {
    const state = {
      currentProgram: cp,
      customPrograms: [renamedProgram],
      programs: [],
      recoverySessions: [],
      workoutSessions: [
        { id: "s1", planName: "Shape — Day 1 — Lower: Glutes", finishedAt: "2026-10-16T12:00:00Z", sourceProgramId: "program_shape_fork", sourceDayLabel: "Day 1 — Lower: Glutes" },
      ],
    };
    const adherence = programTotalAdherence(state);
    expect(adherence.lifting.completed).toBe(1); // NOT 0 — this is the exact bug a naive rename feature would reintroduce
  });

  it("programWeekAdherence does the same for the trailing-window count", () => {
    const state = {
      currentProgram: cp,
      customPrograms: [renamedProgram],
      programs: [],
      recoverySessions: [],
      workoutSessions: [
        { id: "s1", planName: "Shape — Day 1 — Lower: Glutes", finishedAt: new Date().toISOString(), sourceProgramId: "program_shape_fork", sourceDayLabel: "Day 1 — Lower: Glutes" },
      ],
    };
    const adherence = programWeekAdherence(state);
    expect(adherence.lifting.completed).toBe(1);
  });

  it("resolveProgramTimeline still shows the day as completed (green check), not missed", () => {
    const state = {
      currentProgram: cp,
      customPrograms: [renamedProgram],
      programs: [],
      recoverySessions: [],
      workoutSessions: [
        { id: "s1", planName: "Shape — Day 1 — Lower: Glutes", finishedAt: cp.startDate, sourceProgramId: "program_shape_fork", sourceDayLabel: "Day 1 — Lower: Glutes" },
      ],
    };
    const timeline = resolveProgramTimeline(state);
    const day1 = timeline.weeks[0].days[0];
    expect(day1.status).toBe("completed");
    expect(day1.completedSession.id).toBe("s1");
  });

  it("legacy sessions with no sourceProgramId still match by name, as long as the name hasn't changed (backward compatibility)", () => {
    const stillNamedShape = { ...renamedProgram, name: "Shape" };
    const state = {
      currentProgram: { ...cp, programName: "Shape" },
      customPrograms: [stillNamedShape],
      programs: [],
      recoverySessions: [],
      workoutSessions: [{ id: "s1", planName: "Shape — Day 1 — Lower: Glutes", finishedAt: "2026-10-16T12:00:00Z" }], // no sourceProgramId at all
    };
    const adherence = programTotalAdherence(state);
    expect(adherence.lifting.completed).toBe(1);
  });

  it("still counts a session logged BEFORE a built-in program was forked-and-renamed, via the fork's createdFrom.templateId", () => {
    // This is the real scenario: athlete runs built-in "Shape" (id prog_shape_5day), logs Day 1,
    // THEN renames it from Program Timeline — applyActiveProgramRename forks Shape into a NEW
    // custom program id, so the session's sourceProgramId (still prog_shape_5day) no longer equals
    // the active program's new id directly; it must match via the fork's own createdFrom record.
    const forkOfShape = {
      ...renamedProgram,
      id: "program_fork_of_shape",
      createdFrom: { kind: "template", templateId: "prog_shape_5day", name: "Shape" },
    };
    const state = {
      currentProgram: { ...cp, programId: "program_fork_of_shape", programName: "My Shape Plan" },
      customPrograms: [forkOfShape],
      programs: [],
      recoverySessions: [],
      workoutSessions: [
        { id: "s1", planName: "Shape — Day 1 — Lower: Glutes", finishedAt: "2026-10-16T12:00:00Z", sourceProgramId: "prog_shape_5day", sourceDayLabel: "Day 1 — Lower: Glutes" },
      ],
    };
    const adherence = programTotalAdherence(state);
    expect(adherence.lifting.completed).toBe(1);
    const timeline = resolveProgramTimeline(state);
    expect(timeline.weeks[0].days[0].status).toBe("completed");
  });

  it("a session belonging to a DIFFERENT program is never counted, even with a matching old-name string", () => {
    const state = {
      currentProgram: cp,
      customPrograms: [renamedProgram],
      programs: [],
      recoverySessions: [],
      workoutSessions: [
        { id: "s1", planName: "Shape — Day 1 — Lower: Glutes", finishedAt: "2026-10-16T12:00:00Z", sourceProgramId: "some_other_program", sourceDayLabel: "Day 1 — Lower: Glutes" },
      ],
    };
    const adherence = programTotalAdherence(state);
    expect(adherence.lifting.completed).toBe(0);
  });
});

// "Swap Workout" from Program Timeline (and the same mechanism Program Timeline's new "Start This
// Workout" button uses for a non-current day) — extracted from SwapWorkoutSheet's own commitRow so
// both share one rule.
describe("applyProgramDaySwap", () => {
  const cp = { programId: "program_A", programName: "Program A", source: "custom", dayIndex: 0, totalDays: 2, startDate: "2026-01-01T00:00:00Z" };

  it("sets programDayOverride to the chosen day and logs the displaced (planned) day as swapped", () => {
    const state = { currentProgram: cp, customPrograms: [programA, programB], programs: [], workoutSessions: [], recoverySessions: [], programSwapLog: [] };
    const row = { sourceType: "program", programId: "program_A", source: "custom", dayIndex: 1, programName: "Program A", dayLabel: "A Day 2", exercises: programA.days[1].exercises };
    const next = applyProgramDaySwap(state, row);
    expect(next.programDayOverride).toEqual({ date: expect.any(String), exercises: row.exercises, programName: "Program A", dayLabel: "A Day 2", sourceType: "program", programId: "program_A", source: "custom", dayIndex: 1 });
    expect(next.programSwapLog[0]).toMatchObject({ programId: "program_A", source: "custom", dayIndex: 0, dayLabel: "A Day 1" }); // the displaced, originally-planned day
  });

  it("swapping to a DIFFERENT program's day works the same way (cross-program swap)", () => {
    const state = { currentProgram: cp, customPrograms: [programA, programB], programs: [], workoutSessions: [], recoverySessions: [], programSwapLog: [] };
    const row = { sourceType: "program", programId: "program_B", source: "custom", dayIndex: 2, programName: "Program B", dayLabel: "B Day 3", exercises: programB.days[2].exercises };
    const next = applyProgramDaySwap(state, row);
    expect(next.programDayOverride.programId).toBe("program_B");
    expect(next.programDayOverride.dayIndex).toBe(2);
  });

  it("picking the already-planned day is a no-op that clears any existing override, not a redundant one", () => {
    const state = { currentProgram: cp, customPrograms: [programA, programB], programs: [], workoutSessions: [], recoverySessions: [], programSwapLog: [], programDayOverride: { sourceType: "program", programId: "program_B", source: "custom", dayIndex: 1 } };
    const row = { sourceType: "program", programId: "program_A", source: "custom", dayIndex: 0, programName: "Program A", dayLabel: "A Day 1", exercises: programA.days[0].exercises };
    const next = applyProgramDaySwap(state, row);
    expect(next.programDayOverride).toBeNull();
    expect(next.programSwapLog).toEqual([]); // untouched — nothing was actually displaced
  });

  it("never touches workoutSessions, logs, or any program's own day data", () => {
    const sessions = [{ id: "s1", planName: "x" }];
    const state = { currentProgram: cp, customPrograms: [programA, programB], programs: [], workoutSessions: sessions, recoverySessions: [], programSwapLog: [] };
    const row = { sourceType: "program", programId: "program_A", source: "custom", dayIndex: 1, programName: "Program A", dayLabel: "A Day 2", exercises: programA.days[1].exercises };
    const next = applyProgramDaySwap(state, row);
    expect(next.workoutSessions).toBe(sessions);
    expect(next.customPrograms).toBe(state.customPrograms);
  });
});
