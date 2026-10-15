import { describe, it, expect } from "vitest";
import { applyProgramEnd, applyProgramActivation, isReplacingActiveProgram } from "../programActivation.js";
import { clearCurrentProgramSlots, defaultFixedDays, emptySlot } from "../weeklySchedule.js";

// Active program management fix — "I am running Titan, Week 9 of 12, 27/60 sessions completed. I
// cannot find a way to end my current program and start a different one." These tests pin down
// applyProgramEnd (the state-patch behind the new "End Current Program" action) and confirm
// switching already worked correctly regardless of completion status (it did — the bug was purely
// the missing UI entry point, not the underlying activation logic).

const titan = { id: "prog_titan", name: "Titan", source: "builtin", days: Array.from({ length: 5 }, (_, i) => ({ label: `Day ${i + 1}`, exercises: [] })) };

function midProgramState(overrides = {}) {
  return {
    currentProgram: {
      programId: "prog_titan",
      programName: "Titan",
      source: "builtin",
      dayIndex: 2,
      totalDays: 5,
      startDate: "2026-01-01T00:00:00Z", // week 9ish by the time a test runs "now"
      lastCompletedAt: null,
      lastCompletedDayIndex: null,
    },
    programs: [titan],
    customPrograms: [],
    completedPrograms: [],
    workoutSessions: [
      { id: "s1", planName: "Titan — Day 1", finishedAt: "2026-01-02T00:00:00Z" },
      { id: "s2", planName: "Titan — Day 2", finishedAt: "2026-01-04T00:00:00Z" },
    ],
    logs: [{ id: "l1", exId: "bench" }],
    programDayOverride: { sourceType: "program", programId: "prog_titan", source: "builtin", date: "2026-01-01" },
    pendingFrequencyReview: { fromDays: 5, toDays: 4 },
    weeklySchedule: {
      mode: "fixed",
      fixedDays: { ...defaultFixedDays(), mon: { type: "workout", source: { kind: "currentProgram" }, label: "Training day" } },
      createdAt: "2026-01-01T00:00:00Z",
    },
    ...overrides,
  };
}

describe("applyProgramEnd — ends without marking completed, preserves everything else", () => {
  it("clears currentProgram and records a completedPrograms entry tagged ended_early, never 'completed' (item 3)", () => {
    const state = midProgramState();
    const next = applyProgramEnd(state);
    expect(next.currentProgram).toBeNull();
    expect(next.completedPrograms.length).toBe(1);
    expect(next.completedPrograms[0].status).toBe("ended_early");
    expect(next.completedPrograms[0].programId).toBe("prog_titan");
    expect(next.completedPrograms[0].programName).toBe("Titan");
    expect(next.completedPrograms[0].startDate).toBe("2026-01-01T00:00:00Z"); // preserves identity/start (item 3)
  });

  it("is a no-op when no program is currently active", () => {
    const state = midProgramState({ currentProgram: null });
    expect(applyProgramEnd(state)).toBe(state);
  });

  it("never touches workoutSessions, logs, or customPrograms — history and PR data are untouched (item 9)", () => {
    const state = midProgramState();
    const next = applyProgramEnd(state);
    expect(next.workoutSessions).toBe(state.workoutSessions);
    expect(next.logs).toBe(state.logs);
    expect(next.customPrograms).toBe(state.customPrograms);
    // Confirms it is structurally impossible for this to have rewritten a historical plan name.
    expect(next.workoutSessions.map((s) => s.planName)).toEqual(["Titan — Day 1", "Titan — Day 2"]);
  });

  it("clears the stale swap-workout override and any pending frequency review tied to the ended program", () => {
    const state = midProgramState();
    const next = applyProgramEnd(state);
    expect(next.programDayOverride).toBeNull();
    expect(next.pendingFrequencyReview).toBeNull();
  });

  it("converts dangling {kind:'currentProgram'} schedule slots to rest, leaving the schedule's mode and every other slot untouched (item 5)", () => {
    const state = midProgramState();
    const next = applyProgramEnd(state);
    expect(next.weeklySchedule.mode).toBe("fixed");
    expect(next.weeklySchedule.fixedDays.mon).toEqual(emptySlot("rest"));
    // Every other weekday was already rest by default and stays exactly that — nothing extra touched.
    expect(next.weeklySchedule.fixedDays.tue).toEqual(emptySlot("rest"));
  });

  it("preserves a Fixed-mode programDay slot (pinned to a specific custom program's day) completely untouched — only the dangling currentProgram slot is cleared", () => {
    const state = midProgramState({
      weeklySchedule: {
        mode: "fixed",
        fixedDays: {
          ...defaultFixedDays(),
          mon: { type: "workout", source: { kind: "currentProgram" }, label: "Training day" },
          wed: { type: "workout", source: { kind: "programDay", programId: "other_custom", dayId: "d1" }, label: "Leg Day" },
        },
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    const next = applyProgramEnd(state);
    expect(next.weeklySchedule.fixedDays.mon.type).toBe("rest");
    expect(next.weeklySchedule.fixedDays.wed).toEqual(state.weeklySchedule.fixedDays.wed); // completely untouched
  });

  it("does the same cleanup for a Rolling-mode sequence", () => {
    const state = midProgramState({
      weeklySchedule: {
        mode: "rolling",
        rollingSequence: [
          { type: "workout", source: { kind: "currentProgram" }, label: "Training day" },
          { type: "workout", source: { kind: "programDay", programId: "other_custom", dayId: "d1" }, label: "Leg Day" },
          emptySlot("rest"),
        ],
        rollingCursor: 0,
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    const next = applyProgramEnd(state);
    expect(next.weeklySchedule.rollingSequence[0].type).toBe("rest");
    expect(next.weeklySchedule.rollingSequence[1]).toBe(state.weeklySchedule.rollingSequence[1]); // untouched reference
    expect(next.weeklySchedule.rollingSequence[2]).toBe(state.weeklySchedule.rollingSequence[2]); // already-rest, untouched
  });

  it("never erases unrelated schedule preferences — a schedule with no dangling currentProgram slots at all comes back byte-identical", () => {
    const state = midProgramState({
      weeklySchedule: {
        mode: "fixed",
        fixedDays: { ...defaultFixedDays(), wed: { type: "workout", source: { kind: "programDay", programId: "other", dayId: "d1" }, label: "Leg Day" } },
        createdAt: "2026-01-01T00:00:00Z",
      },
    });
    const next = applyProgramEnd(state);
    expect(next.weeklySchedule).toBe(state.weeklySchedule); // same reference — nothing needed changing
  });
});

describe("switching programs works regardless of the outgoing program's completion status (item 4)", () => {
  it("isReplacingActiveProgram is true for a mid-progress program (Week 9 of 12, nowhere near done)", () => {
    const state = midProgramState();
    const newProgram = { id: "prog_shape", name: "Shape", days: [{ id: "d1", label: "Day 1" }] };
    expect(isReplacingActiveProgram(state, newProgram, "builtin")).toBe(true);
  });

  it("applyProgramActivation replaces a mid-progress program cleanly, starting the new one at day 0", () => {
    const state = midProgramState();
    const newProgram = { id: "prog_shape", name: "Shape", days: [{ id: "d1", label: "Day 1" }, { id: "d2", label: "Day 2" }] };
    const next = applyProgramActivation(state, newProgram, "builtin");
    expect(next.currentProgram.programId).toBe("prog_shape");
    expect(next.currentProgram.dayIndex).toBe(0);
    // Titan's own history is still there, untouched by the switch.
    expect(next.workoutSessions).toBe(state.workoutSessions);
  });

  it("switching directly (without first calling End) does NOT write a completedPrograms entry for the old program — that's End's job, not Switch's", () => {
    const state = midProgramState();
    const newProgram = { id: "prog_shape", name: "Shape", days: [{ id: "d1", label: "Day 1" }] };
    const next = applyProgramActivation(state, newProgram, "builtin");
    expect(next.completedPrograms).toEqual([]);
  });
});
