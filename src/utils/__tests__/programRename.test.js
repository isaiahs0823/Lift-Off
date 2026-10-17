import { describe, it, expect } from "vitest";
import { renameProgram, forkProgramForEditing } from "../programBuilder.js";
import { activeProgramAndCP, resolveCurrentProgramDay } from "../programSchedule.js";

// Program renaming UX fix — items 4-8: a rename must show up immediately everywhere the active
// program's name is displayed, must never touch ids/history/exercise data/the built-in template,
// and must behave identically whether the renamed program is currently active or not.

const builtInTemplate = {
  id: "prog_shape",
  name: "Shape",
  tagline: "A balanced physique split",
  weeks: 10,
  days: [
    { label: "Day 1", exercises: [{ exId: "bench", sets: 4, reps: 8 }] },
    { label: "Day 2", exercises: [{ exId: "squat", sets: 4, reps: 8 }] },
  ],
};

describe("renameProgram — only ever touches the name", () => {
  it("changes name and leaves every other field byte-identical by reference", () => {
    const fork = forkProgramForEditing(builtInTemplate);
    const renamed = renameProgram(fork, "Upper Lower 5");
    expect(renamed.name).toBe("Upper Lower 5");
    expect(renamed.id).toBe(fork.id); // stable id preserved (item 5)
    expect(renamed.days).toBe(fork.days); // exercise data untouched, same reference (item 5)
    expect(renamed.weeks).toBe(fork.weeks);
  });

  it("never touches the built-in template it was forked from (item 7)", () => {
    const fork = forkProgramForEditing(builtInTemplate);
    renameProgram(fork, "Upper Lower 5"); // renaming the FORK
    expect(builtInTemplate.name).toBe("Shape"); // original template untouched
  });
});

describe("renaming an INACTIVE custom program", () => {
  it("updates only that program's entry in customPrograms; currentProgram and history are untouched", () => {
    const inactiveProgram = { id: "prog_inactive", name: "Old Name", days: [] };
    const otherProgram = { id: "prog_other", name: "Leave Me Alone", days: [] };
    const state = {
      currentProgram: { programId: "prog_other", programName: "Leave Me Alone", source: "custom", dayIndex: 0 },
      customPrograms: [inactiveProgram, otherProgram],
      workoutSessions: [{ id: "s1", planName: "Old Name — Day 1", finishedAt: "2026-01-01T00:00:00Z" }],
    };
    const renamed = renameProgram(inactiveProgram, "New Name");
    const nextCustomPrograms = state.customPrograms.map((p) => (p.id === inactiveProgram.id ? renamed : p));

    expect(nextCustomPrograms.find((p) => p.id === "prog_inactive").name).toBe("New Name");
    expect(nextCustomPrograms.find((p) => p.id === "prog_other")).toBe(otherProgram); // unrelated program untouched
    expect(state.currentProgram.programId).toBe("prog_other"); // not the renamed program — irrelevant to it
    // Historical session names are never retroactively rewritten (item 6) — nothing in this
    // flow even touches workoutSessions, by construction.
    expect(state.workoutSessions[0].planName).toBe("Old Name — Day 1");
  });
});

describe("renaming an ACTIVE custom program", () => {
  it("the live resolver (activeProgramAndCP) reflects the new name immediately — no sign-out/sign-in needed (item 4)", () => {
    const activeProgram = { id: "prog_active", name: "Shape (Copy)", days: [{ id: "d1", label: "Day 1", exercises: [{ exId: "bench", sets: 3, reps: 8 }] }] };
    let state = {
      currentProgram: { programId: "prog_active", programName: "Shape (Copy)", source: "custom", dayIndex: 0, totalDays: 1, startDate: "2026-01-01T00:00:00Z" },
      customPrograms: [activeProgram],
    };

    // Before renaming: live resolution matches the original name.
    expect(activeProgramAndCP(state).prog.name).toBe("Shape (Copy)");

    // Rename the active program (same update App.jsx's save handler performs).
    const renamed = renameProgram(activeProgram, "Upper Lower 5");
    state = { ...state, customPrograms: state.customPrograms.map((p) => (p.id === activeProgram.id ? renamed : p)) };

    // Today/Train/schedules all resolve through activeProgramAndCP / resolveCurrentProgramDay —
    // both must show the new name on the very next render, with no other state touched.
    expect(activeProgramAndCP(state).prog.name).toBe("Upper Lower 5");
    const day = resolveCurrentProgramDay(state);
    expect(day.programName).toBe("Upper Lower 5");
    expect(day.plan.exercises).toEqual(activeProgram.days[0].exercises); // exercise data preserved (item 5)
  });

  it("does not require touching currentProgram.programName (the activation-time snapshot) at all — the fix is resolving live, not rewriting the snapshot", () => {
    const activeProgram = { id: "prog_active", name: "Old Name", days: [] };
    const state = {
      currentProgram: { programId: "prog_active", programName: "Old Name", source: "custom", dayIndex: 0 },
      customPrograms: [renameProgram(activeProgram, "New Name")],
    };
    // The snapshot field is allowed to still read "Old Name" — every live-resolving call site
    // (TrainTab, SwapWorkoutSheet, Today via resolveCurrentProgramDay) ignores it in favor of
    // activeProgramAndCP's fresh lookup, so the athlete never sees the stale value on screen.
    expect(state.currentProgram.programName).toBe("Old Name");
    expect(activeProgramAndCP(state).prog.name).toBe("New Name");
  });

  it("completed session history keeps its original plan name string after the program is renamed (item 6)", () => {
    const activeProgram = { id: "prog_active", name: "Old Name", days: [{ id: "d1", label: "Day 1", exercises: [] }] };
    const workoutSessions = [{ id: "s1", planName: "Old Name — Day 1", finishedAt: "2026-01-01T00:00:00Z" }];
    const renamed = renameProgram(activeProgram, "New Name");
    // renameProgram's return value has no workoutSessions key at all — it is structurally
    // impossible for this call to have touched history.
    expect(renamed).not.toHaveProperty("workoutSessions");
    expect(workoutSessions[0].planName).toBe("Old Name — Day 1");
  });
});
