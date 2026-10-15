import { describe, it, expect, vi, afterEach } from "vitest";
import { getTodaySchedule, buildRunFromSource, suggestWeekdaysForProgramDays, suggestRollingSequenceForProgramDays, emptySlot, defaultFixedDays, clearCurrentProgramSlots } from "../weeklySchedule.js";

afterEach(() => {
  vi.useRealTimers();
});

// A fixed, known Monday so Fixed-mode weekday resolution is deterministic.
const MONDAY = "2026-01-05T12:00:00";

const programA = {
  id: "program_A",
  name: "Upper Lower",
  days: [
    { id: "a1", label: "Upper Heavy", exercises: [{ exId: "bench", sets: 4, reps: 6 }] },
    { id: "a2", label: "Lower Heavy", exercises: [{ exId: "squat", sets: 4, reps: 6 }] },
  ],
};
const programB = {
  id: "program_B",
  name: "Push Pull Legs",
  days: [
    { id: "b1", label: "Push", exercises: [{ exId: "ohp", sets: 3, reps: 8 }] },
    { id: "b2", label: "Pull", exercises: [{ exId: "row", sets: 3, reps: 10 }] },
    { id: "b3", label: "Legs", exercises: [{ exId: "squat", sets: 4, reps: 8 }] },
  ],
};

function baseState(extra = {}) {
  return { customPrograms: [programA, programB], customPlans: [], templates: [], workoutSessions: [], cardioLogs: [], recoveryLogs: [], scheduleLog: [], ...extra };
}

describe("buildRunFromSource", () => {
  it("resolves a programDay source to the exact day it names, regardless of which program is 'current'", () => {
    const state = baseState();
    const run = buildRunFromSource(state, { kind: "programDay", programId: "program_A", dayId: "a2" });
    expect(run.plan.name).toBe("Upper Lower — Lower Heavy");
    expect(run.plan.exercises).toEqual(programA.days[1].exercises);
    // programContext stays null — a Program Builder day never overwrites currentProgram's
    // sequential dayIndex just by being scheduled onto a weekday (task Part 4).
    expect(run.programContext).toBeNull();
  });

  it("returns null for a program that no longer exists (deleted) rather than throwing or resolving stale data", () => {
    const state = baseState({ customPrograms: [programB] });
    expect(buildRunFromSource(state, { kind: "programDay", programId: "program_A", dayId: "a1" })).toBeNull();
  });

  it("returns null for a rest-type day inside a program — never builds a fake 'workout'", () => {
    const withRest = { ...programA, days: [...programA.days, { id: "a3", label: "Rest", type: "rest", exercises: [] }] };
    const state = baseState({ customPrograms: [withRest] });
    expect(buildRunFromSource(state, { kind: "programDay", programId: "program_A", dayId: "a3" })).toBeNull();
  });
});

describe("Switching between two programs with DIFFERENT Fixed schedules", () => {
  it("Today resolves Program A's Monday assignment while A's schedule is active", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY));
    const fixedDaysA = { ...defaultFixedDays(), mon: { type: "workout", source: { kind: "programDay", programId: "program_A", dayId: "a1" }, label: "Upper Heavy" } };
    const state = baseState({ weeklySchedule: { mode: "fixed", fixedDays: fixedDaysA, createdAt: "2026-01-01T00:00:00Z" } });

    const today = getTodaySchedule(state);
    expect(today.type).toBe("workout");
    const run = buildRunFromSource(state, today.source);
    expect(run.plan.name).toBe("Upper Lower — Upper Heavy");
  });

  it("after switching the schedule to point Monday at Program B instead, Today resolves ONLY Program B — Program A's old assignment is gone, not merged", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY));
    // Simulate the athlete re-saving the schedule in ScheduleEditor with a brand-new fixedDays
    // object (exactly what the Save button writes — a wholesale replacement, never a per-key merge
    // of old + new).
    const fixedDaysB = { ...defaultFixedDays(), mon: { type: "workout", source: { kind: "programDay", programId: "program_B", dayId: "b3" }, label: "Legs" } };
    const state = baseState({ weeklySchedule: { mode: "fixed", fixedDays: fixedDaysB, createdAt: "2026-01-01T00:00:00Z" } });

    const today = getTodaySchedule(state);
    const run = buildRunFromSource(state, today.source);
    expect(run.plan.name).toBe("Push Pull Legs — Legs");
    expect(run.plan.name).not.toContain("Upper Lower");
  });
});

describe("Switching from a Fixed schedule to a Rolling schedule (two different programs)", () => {
  it("Fixed mode (Program A) resolves from fixedDays; Rolling mode (Program B) resolves from rollingSequence — never a mix of the two", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY));

    const fixedState = baseState({
      weeklySchedule: {
        mode: "fixed",
        fixedDays: { ...defaultFixedDays(), mon: { type: "workout", source: { kind: "programDay", programId: "program_A", dayId: "a1" }, label: "Upper Heavy" } },
        rollingSequence: [{ type: "workout", source: { kind: "programDay", programId: "program_B", dayId: "b1" }, label: "Push" }], // present but UNUSED while mode is fixed
        rollingCursor: 0,
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    const fixedToday = buildRunFromSource(fixedState, getTodaySchedule(fixedState).source);
    expect(fixedToday.plan.name).toBe("Upper Lower — Upper Heavy");

    // Now the athlete switches mode to Rolling (Program B) — same state object shape, only `mode`
    // and the active sequence differ, exactly like ScheduleEditor's save() does.
    const rollingState = baseState({
      weeklySchedule: {
        mode: "rolling",
        fixedDays: fixedState.weeklySchedule.fixedDays, // old Fixed assignment still stored, but...
        rollingSequence: [{ type: "workout", source: { kind: "programDay", programId: "program_B", dayId: "b2" }, label: "Pull" }],
        rollingCursor: 0,
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    const rollingToday = buildRunFromSource(rollingState, getTodaySchedule(rollingState).source);
    // ...must NOT silently carry over — mode: "rolling" means fixedDays is never consulted.
    expect(rollingToday.plan.name).toBe("Push Pull Legs — Pull");
    expect(rollingToday.plan.name).not.toContain("Upper Lower");
  });

  it("Rolling mode advances by rollingCursor, not by the calendar weekday — a stale cursor from a replaced program's sequence never bleeds into the new one because the whole sequence is replaced on save", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(MONDAY));
    const state = baseState({
      weeklySchedule: {
        mode: "rolling",
        rollingSequence: [
          { type: "workout", source: { kind: "programDay", programId: "program_B", dayId: "b1" }, label: "Push" },
          { type: "workout", source: { kind: "programDay", programId: "program_B", dayId: "b2" }, label: "Pull" },
          { type: "workout", source: { kind: "programDay", programId: "program_B", dayId: "b3" }, label: "Legs" },
        ],
        rollingCursor: 2,
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    const today = getTodaySchedule(state);
    expect(today.label).toBe("Legs");
    const run = buildRunFromSource(state, today.source);
    expect(run.plan.name).toBe("Push Pull Legs — Legs");
  });
});

describe("suggestWeekdaysForProgramDays / suggestRollingSequenceForProgramDays", () => {
  it("every suggested Fixed slot points at THIS program's own days only, by stable id", () => {
    const suggested = suggestWeekdaysForProgramDays(programA);
    const workoutSlots = Object.values(suggested).filter((s) => s.type === "workout");
    expect(workoutSlots.length).toBeGreaterThan(0);
    for (const slot of workoutSlots) {
      expect(slot.source.kind).toBe("programDay");
      expect(slot.source.programId).toBe("program_A");
      expect(programA.days.some((d) => d.id === slot.source.dayId)).toBe(true);
    }
  });

  it("every suggested Rolling slot points at THIS program's own days only, by stable id", () => {
    const suggested = suggestRollingSequenceForProgramDays(programB);
    const workoutSlots = suggested.filter((s) => s.type === "workout");
    expect(workoutSlots.length).toBe(3);
    for (const slot of workoutSlots) {
      expect(slot.source.programId).toBe("program_B");
      expect(programB.days.some((d) => d.id === slot.source.dayId)).toBe(true);
    }
  });

  it("re-suggesting for a DIFFERENT program never includes the previous program's day ids", () => {
    const suggestedA = suggestWeekdaysForProgramDays(programA);
    const suggestedB = suggestWeekdaysForProgramDays(programB);
    const bProgramIds = Object.values(suggestedB).filter((s) => s.source).map((s) => s.source.programId);
    expect(bProgramIds.every((id) => id === "program_B")).toBe(true);
    expect(bProgramIds).not.toContain("program_A");
    // Sanity: suggestedA really did reference A, proving the two calls aren't coincidentally identical.
    const aProgramIds = Object.values(suggestedA).filter((s) => s.source).map((s) => s.source.programId);
    expect(aProgramIds.every((id) => id === "program_A")).toBe(true);
  });
});

describe("clearCurrentProgramSlots (active-program-management fix, item 5)", () => {
  it("converts only {kind:'currentProgram'} slots to rest, in both fixedDays and rollingSequence", () => {
    const schedule = {
      mode: "fixed",
      fixedDays: {
        ...defaultFixedDays(),
        mon: { type: "workout", source: { kind: "currentProgram" }, label: "Training day" },
        wed: { type: "workout", source: { kind: "programDay", programId: "p1", dayId: "d1" }, label: "Leg Day" },
      },
      rollingSequence: [{ type: "workout", source: { kind: "currentProgram" }, label: "Training day" }],
      createdAt: "2026-01-01T00:00:00Z",
    };
    const next = clearCurrentProgramSlots(schedule);
    expect(next.fixedDays.mon).toEqual(emptySlot("rest"));
    expect(next.fixedDays.wed).toBe(schedule.fixedDays.wed); // untouched reference
    expect(next.rollingSequence[0]).toEqual(emptySlot("rest"));
  });

  it("returns the same reference when there is nothing to clean up — never a needless write", () => {
    const schedule = { mode: "fixed", fixedDays: defaultFixedDays(), createdAt: "2026-01-01T00:00:00Z" };
    expect(clearCurrentProgramSlots(schedule)).toBe(schedule);
  });

  it("handles a null/missing schedule without throwing", () => {
    expect(clearCurrentProgramSlots(null)).toBeNull();
    expect(clearCurrentProgramSlots(undefined)).toBeUndefined();
  });
});
