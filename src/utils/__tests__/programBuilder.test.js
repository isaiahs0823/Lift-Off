import { describe, it, expect } from "vitest";
import {
  forkProgramForEditing,
  ensureDayIds,
  renameDay,
  setDayExercises,
  addExerciseToDay,
  removeExerciseFromDay,
  reorderExercisesInDay,
  updateExerciseInDay,
  addBlankDay,
  addRestDay,
  duplicateDay,
  removeDay,
  dayHasContent,
  reorderDays,
  countTrainingDays,
  countRestDays,
  trainingDayCountLabel,
} from "../programBuilder.js";

const template = {
  id: "prog_template",
  name: "Upper Lower",
  days: [
    { label: "Upper Heavy", exercises: [{ exId: "bench", sets: 4, reps: 6 }] },
    { label: "Lower Heavy", exercises: [{ exId: "squat", sets: 4, reps: 6 }] },
  ],
};

describe("program editing never touches unrelated app data (data protection)", () => {
  it("every programBuilder.js editing function returns an object with no workoutSessions/logs/customPlans keys — it is structurally impossible for a day/exercise edit to overwrite history", () => {
    const program = forkProgramForEditing(template);
    const edited = [
      renameDay(program, program.days[0].id, "Renamed"),
      setDayExercises(program, program.days[0].id, []),
      addExerciseToDay(program, program.days[0].id, { exId: "ohp", sets: 3, reps: 10 }),
      removeExerciseFromDay(program, program.days[0].id, 0),
      addBlankDay(program, "New Day"),
      addRestDay(program),
      duplicateDay(program, program.days[0].id),
      removeDay(program, program.days[1].id),
    ];
    for (const result of edited) {
      expect(result).not.toHaveProperty("workoutSessions");
      expect(result).not.toHaveProperty("logs");
      expect(result).not.toHaveProperty("customPlans");
      expect(result).not.toHaveProperty("currentProgram");
    }
  });

  it("forking a template deep-clones days/exercises — editing the fork never mutates the original template object", () => {
    const fork = forkProgramForEditing(template);
    fork.days[0].label = "Mutated Copy"; // direct mutation, simulating a bug if sharing occurred
    fork.days[0].exercises[0].sets = 99;
    expect(template.days[0].label).toBe("Upper Heavy");
    expect(template.days[0].exercises[0].sets).toBe(4);
  });

  it("the fork gets a brand-new program id, never colliding with the template's id", () => {
    const fork = forkProgramForEditing(template);
    expect(fork.id).not.toBe(template.id);
  });

  it("every day in a freshly forked program gets a stable id", () => {
    const fork = forkProgramForEditing(template);
    expect(fork.days.every((d) => !!d.id)).toBe(true);
    const ids = fork.days.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("ensureDayIds backfills missing ids on an old program without touching days that already have one", () => {
    const legacy = { id: "p1", name: "Legacy", days: [{ id: "keep-me", label: "Day A" }, { label: "Day B" }] };
    const patched = ensureDayIds(legacy);
    expect(patched.days[0].id).toBe("keep-me");
    expect(patched.days[1].id).toBeTruthy();
  });

  it("ensureDayIds is a no-op (same reference) when every day already has an id — avoids needless re-renders/writes", () => {
    const fork = forkProgramForEditing(template);
    expect(ensureDayIds(fork)).toBe(fork);
  });
});

describe("removing a day never silently drops programmed exercises", () => {
  it("dayHasContent correctly flags a day with exercises, and a rest day never counts as having content", () => {
    const fork = forkProgramForEditing(template);
    expect(dayHasContent(fork.days[0])).toBe(true);
    const restFork = addRestDay(fork);
    const restDay = restFork.days[restFork.days.length - 1];
    expect(dayHasContent(restDay)).toBe(false);
  });

  it("removeDay only removes the targeted day — every other day's exercises are untouched", () => {
    const fork = forkProgramForEditing(template);
    const targetId = fork.days[0].id;
    const keptId = fork.days[1].id;
    const result = removeDay(fork, targetId);
    expect(result.days.find((d) => d.id === targetId)).toBeUndefined();
    const kept = result.days.find((d) => d.id === keptId);
    expect(kept.exercises).toEqual(fork.days[1].exercises);
  });
});

describe("duplicating a day is fully independent of the original", () => {
  it("editing the duplicate's exercises never changes the original day's exercises", () => {
    const fork = forkProgramForEditing(template);
    const originalId = fork.days[0].id;
    const withDupe = duplicateDay(fork, originalId);
    const dupe = withDupe.days[withDupe.days.length - 1];
    const edited = updateExerciseInDay(withDupe, dupe.id, 0, { sets: 10 });
    const originalDay = edited.days.find((d) => d.id === originalId);
    expect(originalDay.exercises[0].sets).toBe(4); // unchanged
    const editedDupe = edited.days.find((d) => d.id === dupe.id);
    expect(editedDupe.exercises[0].sets).toBe(10);
  });
});

describe("reordering days/exercises preserves content, only changes order", () => {
  it("reorderDays moves a day without losing or duplicating any day", () => {
    const fork = forkProgramForEditing(template);
    const reordered = reorderDays(fork, 0, 1);
    expect(reordered.days.length).toBe(fork.days.length);
    expect(reordered.days.map((d) => d.label).sort()).toEqual(fork.days.map((d) => d.label).sort());
    expect(reordered.days[0].label).toBe("Lower Heavy");
  });

  it("reorderExercisesInDay moves an exercise within a day without losing any exercise", () => {
    const fork = forkProgramForEditing(template);
    const dayWithTwo = addExerciseToDay(fork, fork.days[0].id, { exId: "row", sets: 3, reps: 10 });
    const dayId = dayWithTwo.days[0].id;
    const reordered = reorderExercisesInDay(dayWithTwo, dayId, 0, 1);
    const exIds = reordered.days[0].exercises.map((e) => e.exId);
    expect(exIds).toEqual(["row", "bench"]);
  });
});

describe("training-day counts exclude rest days (UX audit Phase 1, item 5)", () => {
  it("countTrainingDays/countRestDays split correctly", () => {
    const fork = forkProgramForEditing(template);
    const withRest = addRestDay(addRestDay(fork));
    expect(countTrainingDays(withRest.days)).toBe(2);
    expect(countRestDays(withRest.days)).toBe(2);
  });

  it("trainingDayCountLabel reads '5 Training Days · 2 Rest Days' for a 5-lift/2-rest program (the task's own example)", () => {
    const days = [
      { type: undefined, label: "A" },
      { type: undefined, label: "B" },
      { type: undefined, label: "C" },
      { type: undefined, label: "D" },
      { type: undefined, label: "E" },
      { type: "rest", label: "Rest" },
      { type: "rest", label: "Rest" },
    ];
    expect(trainingDayCountLabel(days)).toBe("5 Training Days · 2 Rest Days");
  });

  it("omits the rest-day clause entirely when there are no rest days", () => {
    const fork = forkProgramForEditing(template);
    expect(trainingDayCountLabel(fork.days)).toBe("2 Training Days");
  });
});
