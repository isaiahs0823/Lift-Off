import { describe, it, expect } from "vitest";
import { mergeRemoteIntoLocal } from "../supabaseSync.js";

// mergeRemoteIntoLocal is the single function standing between "sign in on a second device" and
// "silently lose your workout history" — the CRITICAL DATA SAFETY constraints in the P0 auth
// audit ("Do not overwrite existing local workout history with empty cloud data") live or die on
// this function's behavior. These tests pin that behavior down explicitly, not just by reading
// the comment above it.

const localSession = { id: "local-1", planName: "Upper Lower — Upper Heavy", finishedAt: "2026-01-01T00:00:00Z" };
const remoteOnlySession = { id: "remote-1", planName: "Push Pull Legs — Push", finishedAt: "2026-01-02T00:00:00Z" };

function localState(overrides = {}) {
  return {
    workoutSessions: [localSession],
    customPrograms: [],
    currentProgram: null,
    weeklySchedule: null,
    scheduleLog: [],
    reminderSettings: null,
    hasSeenOnboarding: false,
    ...overrides,
  };
}

describe("mergeRemoteIntoLocal — never overwrites or deletes existing local data", () => {
  it("completely empty remote data leaves local state untouched (byte-identical references)", () => {
    const local = localState();
    const merged = mergeRemoteIntoLocal(local, {});
    expect(merged.workoutSessions).toBe(local.workoutSessions); // same array reference — never rebuilt
    expect(merged.workoutSessions).toEqual([localSession]);
  });

  it("a pull that errored and returned {} behaves identically to 'nothing new' — never destructive", () => {
    // Simulates pullWorkoutDataFromSupabase's own return shape on failure: { ok:false, errors, data:{} }.
    const local = localState({ workoutSessions: [localSession, { ...localSession, id: "local-2" }] });
    const merged = mergeRemoteIntoLocal(local, {});
    expect(merged.workoutSessions.length).toBe(2);
    expect(merged.workoutSessions).toEqual(local.workoutSessions);
  });

  it("remote rows that already exist locally (same id) are never duplicated or used to replace the local version", () => {
    const localCopy = { ...localSession, planName: "LOCAL VERSION — do not overwrite" };
    const remoteCopy = { ...localSession, planName: "REMOTE VERSION — must not win" };
    const local = localState({ workoutSessions: [localCopy] });
    const merged = mergeRemoteIntoLocal(local, { workoutSessions: [remoteCopy] });
    expect(merged.workoutSessions.length).toBe(1);
    expect(merged.workoutSessions[0].planName).toBe("LOCAL VERSION — do not overwrite");
  });

  it("remote rows with a NEW id (not present locally) are added — the actual 'restore on a second device' case (item 5)", () => {
    const local = localState();
    const merged = mergeRemoteIntoLocal(local, { workoutSessions: [remoteOnlySession] });
    expect(merged.workoutSessions.length).toBe(2);
    expect(merged.workoutSessions.map((s) => s.id).sort()).toEqual(["local-1", "remote-1"]);
    // The pre-existing local session's own object is untouched, not re-created.
    expect(merged.workoutSessions.find((s) => s.id === "local-1")).toBe(localSession);
  });

  it("a brand-new/empty local device (no history yet) correctly adopts ALL of the account's remote history", () => {
    const local = localState({ workoutSessions: [] });
    const remote = { workoutSessions: [localSession, remoteOnlySession] };
    const merged = mergeRemoteIntoLocal(local, remote);
    expect(merged.workoutSessions.length).toBe(2);
  });

  it("works the same way across a second collection (customPrograms) — the merge logic is generic, not special-cased per table", () => {
    const localProgram = { id: "prog-local", name: "My Custom Split" };
    const remoteProgram = { id: "prog-remote", name: "Cloud-Only Program" };
    const local = localState({ customPrograms: [localProgram] });
    const merged = mergeRemoteIntoLocal(local, { customPrograms: [remoteProgram] });
    expect(merged.customPrograms.length).toBe(2);
    expect(merged.customPrograms.find((p) => p.id === "prog-local")).toBe(localProgram);
  });
});

describe("mergeRemoteIntoLocal — the workout_profile singleton never clobbers an in-progress local value", () => {
  it("adopts the remote currentProgram only when local has none at all", () => {
    const local = localState({ currentProgram: null });
    const remoteProfile = { currentProgram: { programId: "p1", programName: "Remote Program", dayIndex: 2 } };
    const merged = mergeRemoteIntoLocal(local, { workoutProfile: remoteProfile });
    expect(merged.currentProgram).toEqual(remoteProfile.currentProgram);
  });

  it("NEVER overwrites a local currentProgram that's already set, even with newer-looking remote data", () => {
    const localCP = { programId: "local-active", programName: "What I'm Actually Doing Right Now", dayIndex: 1 };
    const local = localState({ currentProgram: localCP });
    const remoteProfile = { currentProgram: { programId: "stale-remote", programName: "Old Remote Snapshot", dayIndex: 9 } };
    const merged = mergeRemoteIntoLocal(local, { workoutProfile: remoteProfile });
    expect(merged.currentProgram).toBe(localCP);
  });

  it("hasSeenOnboarding is OR'd, never downgraded — a local 'true' can never flip back to false from a stale remote profile", () => {
    const local = localState({ hasSeenOnboarding: true });
    const merged = mergeRemoteIntoLocal(local, { workoutProfile: { hasSeenOnboarding: false } });
    expect(merged.hasSeenOnboarding).toBe(true);
  });

  it("an absent workoutProfile (pull error, or a genuinely brand-new account) leaves every profile field untouched", () => {
    const local = localState({ currentProgram: { programId: "x" }, hasSeenOnboarding: true });
    const merged = mergeRemoteIntoLocal(local, {});
    expect(merged.currentProgram).toBe(local.currentProgram);
    expect(merged.hasSeenOnboarding).toBe(true);
  });
});
