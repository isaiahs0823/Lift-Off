// ---------------- SAFE HISTORICAL WORKOUT IMPORT ----------------
// A separate, non-destructive workflow from Settings' "Restore Full Backup" (see backup.js).
// That restore is, and remains, a full-state overwrite — it stays exactly as-is for its own
// purpose (replacing this device's data with a prior export of itself). This module instead
// MERGES a historical workout-history export into whatever already exists: it only ever reads
// logs / workoutSessions / bodyweightLogs / readinessLogs / customExercises from the uploaded
// file, and only ever ADDS to those same five collections — current program, custom plans/
// programs, settings, nutrition data, goals, photos, equipment profiles, and everything else on
// state is never read from the import file and never appears in the returned patch.
//
// Three-step flow, each pure and independently testable:
//   parseImportFile(text)            -> validates schema, extracts only the five collections
//   analyzeImport(candidate, state)  -> classifies every candidate record, never mutates
//   applyImportPlan(state, plan)     -> returns new state with only `toImport` records added
//
// Duplicate/conflict philosophy (task: "never equate a similar workout with an identical
// workout without sufficient evidence"):
//   - A candidate whose own id already exists in state is the SAME import re-run (ids here are
//     deterministic hashes of real source identity — e.g. date+plan-name from the workbook
//     converter) -> automatically skipped, every time, with no data risk. That is what makes
//     re-importing the same file idempotent (task 6).
//   - A candidate whose id is new, but whose calendar date collides with an EXISTING session
//     that is not itself a prior import of this same source, is flagged as a potential conflict
//     for the athlete to look at. It is never auto-skipped and never auto-merged — surfaced,
//     not resolved.
//   - Nothing else is ever treated as "the same workout." Similar volume, similar exercises, a
//     similar-sounding plan name — none of that is sufficient evidence on its own.
import { validateCanonicalData, migrateCanonicalData } from "../persistence/initialization.js";

export const HISTORY_IMPORT_KEYS = ["logs", "workoutSessions", "bodyweightLogs", "readinessLogs", "customExercises"];

// Marks a session as imported-and-reconstructed-from-history, distinct from a normal live
// session (which carries no such field at all). `dataQuality` additionally distinguishes a
// fully reconstructed session (real per-set detail) from an aggregate-only one (task 7) so any
// screen or analytic that cares can tell them apart without re-deriving it from `entries.length`
// (a session can legitimately have very few real entries and still not be "aggregate-only").
export const IMPORT_SOURCE_TAG = "historical-import";

function isHistoricalImport(session) {
  return session?.importSource === IMPORT_SOURCE_TAG;
}

function dateKeyOf(session) {
  const iso = session?.startedAt || session?.finishedAt;
  if (!iso) return null;
  return String(iso).slice(0, 10);
}

// Never throws. Returns { ok: true, data } with ONLY the five history keys populated (every
// other key the uploaded file might contain — a full backup works here too — is read and then
// discarded, never merged into state), or { ok: false, error }.
export function parseImportFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const raw = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed.data || parsed : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "That file doesn't look like a BRK - Fit export." };
  }
  if (!HISTORY_IMPORT_KEYS.some((k) => k in raw)) {
    return { ok: false, error: "That file doesn't contain any recognizable workout history." };
  }
  // Validate against the real canonical schema (task 1) — build the smallest possible candidate
  // object (only the keys this feature ever reads) so validation never depends on unrelated
  // fields a full backup happens to also carry.
  const candidate = {};
  for (const key of HISTORY_IMPORT_KEYS) if (key in raw) candidate[key] = raw[key];
  try {
    validateCanonicalData(candidate);
    const migrated = migrateCanonicalData(candidate);
    validateCanonicalData(migrated);
    // migrateCanonicalData can add fields unrelated to this feature's own five keys (e.g. it
    // back-fills hasSeenOnboarding whenever logs is non-empty, since it's designed to run over a
    // whole app state, not a scoped candidate). Re-scope the result so this function's contract
    // — "only ever reads/returns these five keys" — holds regardless of what migration adds.
    const scoped = {};
    for (const key of HISTORY_IMPORT_KEYS) if (key in migrated) scoped[key] = migrated[key];
    return { ok: true, data: scoped };
  } catch (err) {
    return { ok: false, error: `Backup data could not be validated safely: ${err.message}` };
  }
}

// Classifies every record in `candidate` against `state` (the CURRENT live app state — never
// mutated here). Returns a plan; nothing is written to anything until applyImportPlan runs.
export function analyzeImport(candidate, state) {
  const existingSessionIds = new Set((state.workoutSessions || []).map((s) => s.id));
  const existingLogIds = new Set((state.logs || []).map((l) => l.id));
  const existingCustomExIds = new Set((state.customExercises || []).map((e) => e.id));
  const existingBwIds = new Set((state.bodyweightLogs || []).map((b) => b.id));
  const existingReadyIds = new Set((state.readinessLogs || []).map((r) => r.id));

  // Only non-import (or import-from-a-different-source) sessions count as something a new
  // import candidate could conflict WITH — two runs of the identical import file sharing a date
  // is expected and already handled by the exact-id "already imported" path above, not a
  // conflict.
  const existingByDate = new Map();
  for (const s of state.workoutSessions || []) {
    if (isHistoricalImport(s)) continue;
    const key = dateKeyOf(s);
    if (!key) continue;
    if (!existingByDate.has(key)) existingByDate.set(key, []);
    existingByDate.get(key).push(s);
  }

  const toImport = [];
  const alreadyImported = [];
  const potentialConflicts = [];
  for (const session of candidate.workoutSessions || []) {
    if (existingSessionIds.has(session.id)) {
      alreadyImported.push(session);
      continue;
    }
    const dateKey = dateKeyOf(session);
    const collisions = dateKey ? existingByDate.get(dateKey) || [] : [];
    if (collisions.length > 0) {
      potentialConflicts.push({ candidate: session, conflictsWith: collisions, reason: `An existing (non-imported) session is already logged on ${dateKey}.` });
      continue;
    }
    toImport.push(session);
  }

  const importedLogIds = new Set(toImport.flatMap((s) => (s.entries || []).map((e) => e.id)));
  const logsToImport = (candidate.logs || []).filter((l) => importedLogIds.has(l.id) && !existingLogIds.has(l.id));

  const newCustomExercises = (candidate.customExercises || []).filter((e) => !existingCustomExIds.has(e.id));
  const alreadyPresentCustomExercises = (candidate.customExercises || []).filter((e) => existingCustomExIds.has(e.id));

  const bodyweightToImport = (candidate.bodyweightLogs || []).filter((b) => !existingBwIds.has(b.id));
  const bodyweightAlready = (candidate.bodyweightLogs || []).filter((b) => existingBwIds.has(b.id));
  const readinessToImport = (candidate.readinessLogs || []).filter((r) => !existingReadyIds.has(r.id));
  const readinessAlready = (candidate.readinessLogs || []).filter((r) => existingReadyIds.has(r.id));

  // Prefer the source's own explicit dataQuality tag (task 7 — baked in at conversion time) over
  // re-deriving it here; fall back to the same heuristic only for older export files that
  // predate the field, so nothing regresses for them.
  const aggregateOnlySessions = toImport.filter((s) =>
    s.dataQuality ? s.dataQuality === "aggregate-only" : (s.entries || []).length === 0 && (s.workingSets || 0) > 0
  );
  const unreconstructedDropVolume = toImport.reduce(
    (sum, s) => sum + (s.entries || []).reduce((es, e) => es + (e.sets || []).reduce((ss, set) => ss + (set.unverifiedDropVolume || 0), 0), 0),
    0
  );

  return {
    toImport,
    alreadyImported,
    potentialConflicts,
    logsToImport,
    newCustomExercises,
    alreadyPresentCustomExercises,
    bodyweightToImport,
    bodyweightAlready,
    readinessToImport,
    readinessAlready,
    aggregateOnlySessions,
    unreconstructedDropVolume,
    summary: {
      sessionsToImport: toImport.length,
      sessionsAlreadyImported: alreadyImported.length,
      potentialConflicts: potentialConflicts.length,
      newCustomExercises: newCustomExercises.length,
      aggregateOnlySessions: aggregateOnlySessions.length,
      bodyweightToImport: bodyweightToImport.length,
      readinessToImport: readinessToImport.length,
      unreconstructedDropVolume,
    },
  };
}

// Pure merge — returns a NEW state object. Only ever adds to the five history collections;
// every other key on `state` (currentProgram, customPlans, customPrograms, settings,
// nutrition*, goals, photos, equipmentProfiles, coachOnboarding, everything else) is carried
// through completely untouched by reference. Conflicted/already-imported/dropped records are
// never included — only `plan.toImport` (and its already-filtered companions) ever get written.
export function applyImportPlan(state, plan) {
  const taggedSessions = plan.toImport.map((s) => ({
    ...s,
    importSource: IMPORT_SOURCE_TAG,
    // Back-fill for a source file that predates the dataQuality field (task 7) — never
    // overwrites one the file already set.
    dataQuality: s.dataQuality || ((s.entries || []).length === 0 && (s.workingSets || 0) > 0 ? "aggregate-only" : "reconstructed"),
  }));
  return {
    ...state,
    workoutSessions: [...(state.workoutSessions || []), ...taggedSessions],
    logs: [...(state.logs || []), ...plan.logsToImport],
    customExercises: [...(state.customExercises || []), ...plan.newCustomExercises],
    bodyweightLogs: [...(state.bodyweightLogs || []), ...plan.bodyweightToImport],
    readinessLogs: [...(state.readinessLogs || []), ...plan.readinessToImport],
  };
}
