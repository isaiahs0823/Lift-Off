import { describe, it, expect } from "vitest";
import { parseImportFile, analyzeImport, applyImportPlan, HISTORY_IMPORT_KEYS, IMPORT_SOURCE_TAG } from "../workoutHistoryImport.js";

function entry(id, exId, sets, extra = {}) {
  return { id, exId, date: "2026-09-01T12:00:00.000Z", sets, targetReps: sets[0]?.reps ?? 8, ...extra };
}
function reconstructedSession(id, overrides = {}) {
  const entries = overrides.entries ?? [entry(`log_${id}`, "bench", [{ weight: 135, reps: 8 }])];
  return {
    id, planName: "Push Day", source: "import", dataQuality: "reconstructed",
    sourceProgramId: null, sourceProgramName: null, sourceDayLabel: null,
    startedAt: "2026-09-01T12:00:00.000Z", finishedAt: "2026-09-01T13:00:00.000Z",
    durationSec: 3600, exerciseCount: entries.length,
    workingSets: entries.reduce((s, e) => s + e.sets.length, 0),
    totalReps: entries.reduce((s, e) => s + e.sets.reduce((ss, set) => ss + set.reps, 0), 0),
    totalVolume: entries.reduce((s, e) => s + e.sets.reduce((ss, set) => ss + set.weight * set.reps, 0), 0),
    prs: [], isVolumePR: false, mainMuscles: ["Chest"], avgRir: null, perfDeltaPct: null, bestLift: null,
    entries, ...overrides,
  };
}
function candidateFile(sessions, extra = {}) {
  return JSON.stringify({ app: "BRK - Fit", schemaVersion: 1, data: { logs: sessions.flatMap((s) => s.entries), workoutSessions: sessions, bodyweightLogs: [], readinessLogs: [], customExercises: [], ...extra } });
}

describe("parseImportFile", () => {
  it("rejects invalid JSON", () => {
    const r = parseImportFile("{not json");
    expect(r.ok).toBe(false);
  });
  it("rejects a file with no recognizable history keys", () => {
    const r = parseImportFile(JSON.stringify({ data: { settings: { rirSystem: "rir" } } }));
    expect(r.ok).toBe(false);
  });
  it("accepts a valid file and extracts only the five history keys, dropping everything else", () => {
    const text = JSON.stringify({
      data: {
        workoutSessions: [reconstructedSession("s1")],
        logs: [entry("log_s1", "bench", [{ weight: 135, reps: 8 }])],
        customPrograms: [{ id: "cp1", name: "Should never appear", days: [] }], // not a history key
        currentProgram: { programId: "x" }, // must never leak through
      },
    });
    const r = parseImportFile(text);
    expect(r.ok).toBe(true);
    expect(Object.keys(r.data).sort()).toEqual([...HISTORY_IMPORT_KEYS].sort().filter((k) => k in r.data).sort());
    expect(r.data.customPrograms).toBeUndefined();
    expect(r.data.currentProgram).toBeUndefined();
  });
  it("rejects a file that fails canonical validation (e.g. a set missing reps)", () => {
    const bad = candidateFile([reconstructedSession("s1", { entries: [{ id: "e1", exId: "bench", date: "2026-09-01T12:00:00.000Z", sets: [{ weight: 100 }] }] })]);
    const r = parseImportFile(bad);
    expect(r.ok).toBe(false);
  });
});

describe("analyzeImport — fresh import (empty existing state)", () => {
  it("classifies every session as new to import when state is empty", () => {
    const candidate = JSON.parse(candidateFile([reconstructedSession("s1"), reconstructedSession("s2", { startedAt: "2026-09-02T12:00:00.000Z" })])).data;
    const plan = analyzeImport(candidate, { workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] });
    expect(plan.toImport).toHaveLength(2);
    expect(plan.alreadyImported).toHaveLength(0);
    expect(plan.potentialConflicts).toHaveLength(0);
  });
});

describe("analyzeImport / applyImportPlan — idempotent re-import (task 6)", () => {
  it("re-running the identical import against the post-import state imports nothing new", () => {
    const sessions = [reconstructedSession("s1"), reconstructedSession("s2", { startedAt: "2026-09-02T12:00:00.000Z" })];
    const candidate = JSON.parse(candidateFile(sessions)).data;
    let state = { workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] };
    const plan1 = analyzeImport(candidate, state);
    state = applyImportPlan(state, plan1);
    expect(state.workoutSessions).toHaveLength(2);
    expect(state.logs).toHaveLength(2);

    // Re-import the SAME file against the now-populated state.
    const plan2 = analyzeImport(candidate, state);
    expect(plan2.toImport).toHaveLength(0);
    expect(plan2.alreadyImported).toHaveLength(2);
    const state2 = applyImportPlan(state, plan2);
    expect(state2.workoutSessions).toHaveLength(2); // never duplicated
    expect(state2.logs).toHaveLength(2);
    const totalVolume = state2.workoutSessions.reduce((s, w) => s + w.totalVolume, 0);
    expect(totalVolume).toBe(2160); // two sessions at 135*8=1080 each, never doubled by the re-import
  });
});

describe("analyzeImport — conflict detection (task 5: never equate similar with identical)", () => {
  it("flags a date collision with an existing NON-import session as a potential conflict, never auto-skips or auto-merges it", () => {
    const candidate = JSON.parse(candidateFile([reconstructedSession("s1")])).data; // date 2026-09-01
    const liveSession = { id: "session_live_abc", planName: "My Own Push Day", startedAt: "2026-09-01T18:30:00.000Z", finishedAt: "2026-09-01T19:15:00.000Z", workingSets: 3, totalVolume: 900, entries: [], prs: [] }; // no importSource — a real, independently-logged session
    const state = { workoutSessions: [liveSession], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] };
    const plan = analyzeImport(candidate, state);
    expect(plan.toImport).toHaveLength(0);
    expect(plan.potentialConflicts).toHaveLength(1);
    expect(plan.potentialConflicts[0].conflictsWith[0].id).toBe("session_live_abc");

    // Applying this plan must add NOTHING for the conflicted session — it's surfaced, not resolved.
    const next = applyImportPlan(state, plan);
    expect(next.workoutSessions).toHaveLength(1); // only the pre-existing live session
  });

  it("does NOT flag a conflict against a session that is itself a prior import on the same date", () => {
    const priorImport = reconstructedSession("s1_different_hash", { startedAt: "2026-09-01T12:00:00.000Z", importSource: IMPORT_SOURCE_TAG });
    const candidate = JSON.parse(candidateFile([reconstructedSession("s1_new_hash", { startedAt: "2026-09-01T12:00:00.000Z" })])).data;
    const state = { workoutSessions: [priorImport], logs: priorImport.entries, customExercises: [], bodyweightLogs: [], readinessLogs: [] };
    const plan = analyzeImport(candidate, state);
    // Different id, same date, but the existing session is itself a historical import — same-day
    // re-imports of a corrected/re-run conversion must not be treated as athlete-logged conflicts.
    expect(plan.potentialConflicts).toHaveLength(0);
    expect(plan.toImport).toHaveLength(1);
  });
});

describe("applyImportPlan — never touches anything outside the five history keys (task 3)", () => {
  it("preserves currentProgram, customPrograms, settings, nutrition data, goals byte-for-byte", () => {
    const candidate = JSON.parse(candidateFile([reconstructedSession("s1")])).data;
    const untouchable = {
      currentProgram: { programId: "titan", programName: "Titan" },
      customPrograms: [{ id: "cp1", name: "My Program", days: [] }],
      customPlans: [{ id: "pl1", name: "My Plan", exercises: [] }],
      settings: { rirSystem: "rpe", barWeight: 45 },
      nutritionProfile: { calories: 2800 },
      nutritionTargets: { protein: 180 },
      goals: [{ id: "g1", text: "Bench 315" }],
      photos: [{ id: "ph1", date: "2026-01-01" }],
      equipmentProfiles: [{ id: "eq1", name: "Home gym" }],
      hasSeenOnboarding: true,
    };
    const state = { workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [], ...untouchable };
    const plan = analyzeImport(candidate, state);
    const next = applyImportPlan(state, plan);
    for (const key of Object.keys(untouchable)) {
      expect(next[key]).toEqual(untouchable[key]);
      expect(next[key]).toBe(untouchable[key]); // same reference — never even copied/rebuilt
    }
  });
});

describe("analyzeImport — aggregate-only session distinction (task 7)", () => {
  it("identifies an aggregate-only session via its explicit dataQuality tag, never conflating it with a fully reconstructed one", () => {
    const aggregateOnly = reconstructedSession("s_agg", { dataQuality: "aggregate-only", entries: [], workingSets: 9, totalVolume: 4640, prs: [] });
    const reconstructed = reconstructedSession("s_full");
    const candidate = JSON.parse(candidateFile([aggregateOnly, reconstructed])).data;
    const plan = analyzeImport(candidate, { workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] });
    expect(plan.aggregateOnlySessions).toHaveLength(1);
    expect(plan.aggregateOnlySessions[0].id).toBe("s_agg");
    expect(plan.summary.sessionsToImport).toBe(2);
    expect(plan.summary.aggregateOnlySessions).toBe(1);
  });

  it("falls back to entries-based detection for an older export file with no dataQuality field", () => {
    const legacyAggregate = reconstructedSession("s_legacy", { entries: [], workingSets: 5, totalVolume: 1000 });
    delete legacyAggregate.dataQuality;
    const candidate = JSON.parse(candidateFile([legacyAggregate])).data;
    const plan = analyzeImport(candidate, { workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] });
    expect(plan.aggregateOnlySessions).toHaveLength(1);
    const applied = applyImportPlan({ workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] }, plan);
    expect(applied.workoutSessions[0].dataQuality).toBe("aggregate-only"); // back-filled, never left undefined
  });
});

describe("analyzeImport — unverified drop-set volume disclosure (task 8)", () => {
  it("sums disclosed unverifiedDropVolume across imported sets without fabricating a drops array", () => {
    const withDrop = reconstructedSession("s_drop", {
      entries: [entry("log_drop", "bench", [{ weight: 135, reps: 8, unverifiedDropVolume: 162 }, { weight: 115, reps: 8 }])],
    });
    const candidate = JSON.parse(candidateFile([withDrop])).data;
    const plan = analyzeImport(candidate, { workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] });
    expect(plan.unreconstructedDropVolume).toBe(162);
    const applied = applyImportPlan({ workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [], readinessLogs: [] }, plan);
    const importedSet = applied.workoutSessions[0].entries[0].sets[0];
    expect(importedSet.drops).toBeUndefined(); // never invented
    expect(importedSet.unverifiedDropVolume).toBe(162); // preserved, disclosed
  });
});

describe("analyzeImport — custom exercises / bodyweight / readiness dedup", () => {
  it("only imports custom exercises not already present by id", () => {
    const existingCustom = { id: "custom_abc", name: "Matrix Converging Chest Press", type: "compound", muscle: "Other", custom: true };
    const candidate = JSON.parse(candidateFile([], { customExercises: [existingCustom, { id: "custom_new", name: "Rogers Squat Machine", type: "compound", muscle: "Other", custom: true }] })).data;
    const plan = analyzeImport(candidate, { workoutSessions: [], logs: [], customExercises: [existingCustom], bodyweightLogs: [], readinessLogs: [] });
    expect(plan.newCustomExercises).toHaveLength(1);
    expect(plan.newCustomExercises[0].id).toBe("custom_new");
    expect(plan.alreadyPresentCustomExercises).toHaveLength(1);
  });

  it("only imports bodyweight/readiness entries not already present by id", () => {
    const existingBw = { id: "bw_1", date: "2026-08-15T12:00:00.000Z", weight: 220 };
    const candidate = JSON.parse(candidateFile([], { bodyweightLogs: [existingBw, { id: "bw_2", date: "2026-08-18T12:00:00.000Z", weight: 221 }] })).data;
    const plan = analyzeImport(candidate, { workoutSessions: [], logs: [], customExercises: [], bodyweightLogs: [existingBw], readinessLogs: [] });
    expect(plan.bodyweightToImport).toHaveLength(1);
    expect(plan.bodyweightToImport[0].id).toBe("bw_2");
    expect(plan.bodyweightAlready).toHaveLength(1);
  });
});
