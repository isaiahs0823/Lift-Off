// Session-boundary rules. Typed inputs are drafts; confirmedSets are saved athlete work.
// Keep these transitions pure so retries and recovery can be exercised without browser data.
export function newWorkoutId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function hasUnfinishedWorkout(run) {
  return Boolean(run && !run.finished);
}

export function workoutLogId(run, index) {
  return `log_${run.id}_${run.exercises[index].workoutSlotId || index}`;
}

// Compare complete payloads deterministically; dates are retained as metadata, never used
// to order revisions. A generated date change alone does not represent different saved work.
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => [k, ordered(value[k])]));
  return value;
}
export function workoutEntryKey(entry) {
  if (!entry) return null;
  const { date, ...payload } = entry;
  return JSON.stringify(ordered(payload));
}
function receiptEntryKey(entry) {
  return JSON.stringify(ordered(Object.fromEntries(["exId", "sets", "targetReps", "equipmentProfileId", "equipmentContext", "jointNote"].filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]))));
}
export class WorkoutRecoveryConflict extends Error {
  constructor(message, records) {
    super(message);
    this.code = "WORKOUT_RECOVERY_CONFLICT";
    this.records = records;
  }
}
function conflict(canonical, checkpoint, reason = "Workout copies disagree. Both copies are preserved; export recovery data before resolving the conflict.") {
  throw new WorkoutRecoveryConflict(reason, { canonical, checkpoint });
}
function entryFromDraft(run, index, draft, now) {
  const sets = (draft?.confirmedSets || []).filter((set) => Number(set.reps) > 0);
  if (!sets.length) return null;
  return {
    id: workoutLogId(run, index), exId: run.swaps?.[index] ?? run.exercises[index].exId,
    date: draft.entryDate || draft.updatedAt || now, sets,
    targetReps: Number(draft.reps) || sets[0].reps,
    ...(draft.equipmentProfileId ? { equipmentProfileId: draft.equipmentProfileId } : {}),
    ...(draft.equipmentContext ? { equipmentContext: draft.equipmentContext } : {}),
    ...(draft.jointNote ? { jointNote: draft.jointNote } : {}),
  };
}

// An optimistic write journal lives only in the active workout. Each mutation records the
// exact preceding payload, not a time or set count. This proves which whole snapshot can
// replace a partially written log. Arrays of sets are never concatenated or value-deduped.
export function stampWorkoutDraft(run, index, draft, logs = []) {
  const previous = run.draftByIndex?.[index];
  const canonical = logs.find((entry) => entry.id === workoutLogId(run, index));
  const before = entryFromDraft(run, index, previous, draft.updatedAt);
  const bases = [...(previous?.recoveryBases || [])];
  if (before && !bases.includes(workoutEntryKey(before))) bases.push(workoutEntryKey(before));
  const acknowledged = before && workoutEntryKey(before) === workoutEntryKey(canonical);
  return {
    ...draft, recoveryBases: bases,
    entryDate: previous?.entryDate || (acknowledged ? canonical.date : draft.updatedAt),
  };
}
export function collectConfirmedWorkout(run, now = new Date().toISOString()) {
  const entries = new Map((run.sessionEntries || []).map((entry) => [entry.index, entry]));
  (run.exercises || []).forEach((slot, index) => {
    if (entries.has(index)) return;
    const draft = run.draftByIndex?.[index];
    const entry = entryFromDraft(run, index, draft, now);
    if (entry) entries.set(index, { index, exId: entry.exId, entry, writeState: "prepared", recoveryBases: draft.recoveryBases || [] });
  });
  return { ...run, sessionEntries: [...entries.values()].sort((a, b) => a.index - b.index) };
}
function reconcileEntry(canonical, candidate, bases = []) {
  if (!canonical) return candidate;
  if (workoutEntryKey(canonical) === workoutEntryKey(candidate)) return canonical;
  if (bases.includes(workoutEntryKey(canonical))) return { ...candidate, ...(canonical.date ? { date: canonical.date } : {}) };
  conflict(canonical, candidate);
}
function reconcileEntries(state, run, now) {
  const slots = new Map();
  for (const se of run.sessionEntries || []) {
    if (slots.has(se.index) && workoutEntryKey(slots.get(se.index)) !== workoutEntryKey(se.entry)) conflict(slots.get(se.index), se.entry);
    slots.set(se.index, se.entry);
  }
  const collected = collectConfirmedWorkout(run, now);
  const ids = new Set();
  for (const se of collected.sessionEntries) {
    if (ids.has(se.entry.id)) conflict(collected.sessionEntries, se, "Multiple workout slots share one log ID. Recovery data is preserved for review.");
    ids.add(se.entry.id);
  }
  const canonical = new Map();
  for (const entry of state.logs || []) {
    if (canonical.has(entry.id) && workoutEntryKey(canonical.get(entry.id)) !== workoutEntryKey(entry)) conflict(canonical.get(entry.id), entry);
    canonical.set(entry.id, entry);
  }
  return { ...collected, sessionEntries: collected.sessionEntries.map((se) => {
    let candidate = se.entry;
    let bases = se.recoveryBases || [];
    const draft = run.draftByIndex?.[se.index];
    const draftEntry = entryFromDraft(run, se.index, draft, now);
    if (draftEntry && workoutEntryKey(draftEntry) !== workoutEntryKey(candidate)) {
      // A checkpoint can coexist with an old draft after a partial write. Require a proven
      // predecessor relationship in either direction, or preserve both as a conflict.
      const draftIsNext = (draft.recoveryBases || []).includes(workoutEntryKey(candidate));
      const entryIsNext = bases.includes(workoutEntryKey(draftEntry));
      if (draftIsNext && entryIsNext) conflict(candidate, draftEntry);
      if (draftIsNext) {
        candidate = draftEntry; bases = draft.recoveryBases;
      } else if (!entryIsNext) conflict(candidate, draftEntry);
    }
    return { ...se, recoveryBases: bases, entry: reconcileEntry(canonical.get(candidate.id), candidate, bases) };
  }) };
}

// A replacement is new work, never a retagging of performed sets. Persist the
// completed original slot and fresh replacement together in the active checkpoint.
export function swapWorkoutExercise(run, index, newExId, logs = []) {
  const slot = run?.exercises?.[index];
  if (!slot || run.finished || run.completionPending || !newExId) return run;
  if (newExId === (run.swaps?.[index] ?? slot.exId)) return run;
  const selected = reconcileEntries({ logs: logs.filter((log) =>
    log.id === workoutLogId(run, index) || run.sessionEntries?.some((se) => se.index === index && se.entry.id === log.id)
  ) }, {
    ...run,
    sessionEntries: (run.sessionEntries || []).filter((se) => se.index === index),
    draftByIndex: { [index]: run.draftByIndex?.[index] },
  }, new Date().toISOString()).sessionEntries.find((se) => se.index === index);
  const draftByIndex = { ...run.draftByIndex };
  delete draftByIndex[index]; // Only unconfirmed input is abandoned; selected holds saved work.
  if (!selected) {
    // A skipped slot keeps its workoutSlotId when relabeled this way (see skipWorkoutExercise's
    // own comment on why it's keyed by workoutSlotId, not index) — swapping to a different
    // exercise is a fresh decision to actually perform something today, so any skip mark for
    // this slot is stale the moment that happens and must not carry over onto the new exercise.
    const skipped = { ...run.skipped };
    delete skipped[slot.workoutSlotId];
    return { ...run, draftByIndex, skipped, swaps: { ...run.swaps, [index]: newExId } };
  }
  const shift = (i) => i > index ? i + 1 : i;
  const { group, ...replacement } = slot;
  return {
    ...run,
    exercises: [
      ...run.exercises.slice(0, index + 1),
      { ...replacement, exId: newExId, workoutSlotId: newWorkoutId() },
      ...run.exercises.slice(index + 1),
    ],
    sessionEntries: [
      ...(run.sessionEntries || []).filter((se) => se.index !== index).map((se) => ({ ...se, index: shift(se.index) })),
      selected,
    ].sort((a, b) => a.index - b.index),
    draftByIndex: Object.fromEntries(Object.entries(draftByIndex).map(([i, draft]) => [shift(Number(i)), draft])),
    swaps: Object.fromEntries(Object.entries(run.swaps || {}).map(([i, exId]) => [shift(Number(i)), exId])),
  };
}

// Bug report: an athlete who can't do a scheduled movement (injury, equipment taken, whatever)
// had no way to move on except swapping in a different exercise or fighting the app into saving
// fake 0-rep sets — both of which either lose the fact that something was scheduled here at all,
// or (before cleanSetsInput existed) polluted history with sets that never happened. Skip is a
// third, honest option: "not today," visibly recorded, but never logged or counted anywhere.
// Keyed by workoutSlotId rather than index (like selectedSlotId, and unlike draftByIndex/swaps/
// sessionEntries) specifically so it needs no remapping in moveWorkoutExercise/removeRunExercise
// — a reorder or a later removal elsewhere in the list never has to know this map exists.
// Only valid for a slot with nothing confirmed yet: once a real set is logged there's no
// ambiguity to resolve, just Finish Exercise with whatever's confirmed.
export function skipWorkoutExercise(run, index) {
  const slot = run?.exercises?.[index];
  if (!slot || run.finished || run.completionPending) return run;
  if (run.sessionEntries?.some((se) => se.index === index)) return run;
  const draftByIndex = { ...run.draftByIndex };
  delete draftByIndex[index]; // Abandons only unconfirmed typed input — nothing confirmed exists at this slot.
  return {
    ...run,
    draftByIndex,
    skipped: { ...run.skipped, [slot.workoutSlotId]: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  };
}

// "Log it after all" — reverses a skip. Nothing else needs restoring: a skipped slot was never
// allowed to hold a sessionEntry, so clearing the mark alone returns it to a normal open slot.
export function unskipWorkoutExercise(run, index) {
  const slot = run?.exercises?.[index];
  if (!slot || run.finished || run.completionPending) return run;
  if (!run.skipped?.[slot.workoutSlotId]) return run;
  const skipped = { ...run.skipped };
  delete skipped[slot.workoutSlotId];
  return { ...run, skipped, updatedAt: new Date().toISOString() };
}

// Reorders one exercise slot within the active session only — never the saved program/template,
// and never past workout history (those are untouched; this only ever mutates activeRun).
// sessionEntries/draftByIndex/swaps are keyed by array position (see sanitizeActiveRun's
// draftByIndex comment), so moving a slot without also moving its own entry/draft/swap would
// silently reattach them to whatever exercise ends up at the old position instead. This computes
// the move by workoutSlotId — the one identity that's stable across the reorder — and carries
// every index-keyed structure through the exact same old-index -> new-index mapping, the same
// pattern removeRunExercise/swapWorkoutExercise already use for a shrinking or inserting array,
// generalized here to an arbitrary single-slot move. Using workoutSlotId (not exId) is also what
// lets two slots of the same exercise move independently without crossing wires.
export function moveWorkoutExercise(run, fromIndex, toIndex) {
  const exercises = run?.exercises;
  if (!Array.isArray(exercises) || run.finished || run.completionPending) return run;
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= exercises.length || toIndex >= exercises.length) return run;
  const reordered = [...exercises];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  const newIndexBySlotId = new Map(reordered.map((slot, i) => [slot.workoutSlotId, i]));
  const remap = (oldIdx) => newIndexBySlotId.get(exercises[oldIdx]?.workoutSlotId) ?? oldIdx;
  return {
    ...run,
    exercises: reordered,
    sessionEntries: (run.sessionEntries || []).map((se) => ({ ...se, index: remap(se.index) })),
    draftByIndex: Object.fromEntries(Object.entries(run.draftByIndex || {}).map(([i, draft]) => [remap(Number(i)), draft])),
    swaps: Object.fromEntries(Object.entries(run.swaps || {}).map(([i, exId]) => [remap(Number(i)), exId])),
    updatedAt: new Date().toISOString(),
  };
}

export function advanceProgramForWorkout(state, run, now = new Date().toISOString()) {
  const cp = state.currentProgram, ctx = run.programContext;
  if (!cp || !ctx || cp.programId !== ctx.programId || cp.source !== ctx.source) return state;
  // New runs pin the assignment, not just the reusable program template. Legacy drafts can
  // advance only an assignment that already existed when they started.
  if (Object.hasOwn(ctx, "assignmentStartDate")) {
    if (!ctx.assignmentStartDate || cp.startDate !== ctx.assignmentStartDate) return state;
  } else if (!cp.startDate || !run.startedAt || new Date(cp.startDate) > new Date(run.startedAt)) {
    return state;
  }
  if (Object.hasOwn(ctx, "assignmentDayIndex") && (
    cp.dayIndex !== ctx.assignmentDayIndex || (cp.lastCompletedAt ?? null) !== ctx.assignmentLastCompletedAt
  )) return state;
  if (cp.lastWorkoutRunId === run.id || !(ctx.totalDays > 0)) return state;
  const ov = state.programDayOverride;
  return {
    ...state,
    programDayOverride: ov?.programId === ctx.programId && ov.source === ctx.source ? null : ov,
    currentProgram: {
      ...cp,
      dayIndex: (ctx.dayIndex + 1) % ctx.totalDays,
      lastCompletedAt: now,
      lastCompletedDayIndex: ctx.dayIndex,
      lastWorkoutRunId: run.id,
    },
  };
}

export function completeWorkoutState(state, run, buildSummary, now = new Date().toISOString()) {
  const summaryId = run.summaryId || `session_${run.id}`;
  const completed = reconcileEntries(state, run, now);
  const existing = (state.workoutSessions || []).find((session) => session.id === summaryId);
  if (existing) {
    const expected = completed.sessionEntries.map((se) => receiptEntryKey(se.entry));
    const actual = (existing.entries || []).map(receiptEntryKey);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) conflict(existing, completed, "Completed history does not match the recovery checkpoint. Both copies are preserved; export recovery data for review.");
    for (const se of completed.sessionEntries) {
      if (!(state.logs || []).some((entry) => entry.id === se.entry.id && workoutEntryKey(entry) === workoutEntryKey(se.entry))) conflict(existing, completed, "Completed history is missing a matching exercise log. Recovery data is preserved for review.");
    }
    for (const [key, value] of Object.entries(run.completionReceipt || {})) {
      if (JSON.stringify(ordered(existing[key])) !== JSON.stringify(ordered(value))) conflict(existing, run.completionReceipt, "Completed history does not match its completion receipt. Recovery data is preserved for review.");
    }
    return { state, summary: existing, run: { ...completed, finished: true, summaryId, completionPending: false, recoveryConflict: null, draftByIndex: {} } };
  }
  const owned = new Map(completed.sessionEntries.map((se) => [se.entry.id, se.entry]));
  const seen = new Set();
  const logs = (state.logs || []).flatMap((entry) => {
    if (!owned.has(entry.id)) return [entry];
    if (seen.has(entry.id)) return [];
    seen.add(entry.id); return [owned.get(entry.id)];
  });
  const added = completed.sessionEntries.map((se) => se.entry).filter((entry) => !seen.has(entry.id));
  const allLogs = [...added, ...logs];
  const summary = { ...buildSummary(completed, allLogs, state.workoutSessions || []), id: summaryId };
  const next = advanceProgramForWorkout({ ...state, logs: allLogs, workoutSessions: [summary, ...(state.workoutSessions || [])], hasSeenOnboarding: true }, completed, now);
  return {
    state: next, summary,
    run: {
      ...completed, finished: true, summaryId, completionPending: false, recoveryConflict: null, draftByIndex: {},
      completionReceipt: Object.fromEntries(["planName", "workingSets", "totalVolume", "totalReps", "exerciseCount", "sourceProgramId", "sourceDayLabel"].filter((key) => summary[key] !== undefined).map((key) => [key, summary[key]])),
      programBeforeCompletion: run.programBeforeCompletion ?? state.currentProgram,
    },
  };
}

export function recoverWorkoutCheckpoint(state, run) {
  if (!(state.workoutSessions || []).some((session) => session.id === run.summaryId)) return { ...run, completionPending: false };
  return completeWorkoutState(state, run, () => { throw new Error("Missing durable session"); }).run;
}

// Verify the actual stored log versions before replacement, then read the full canonical
// snapshot back before retiring its checkpoint. A write returning is not enough evidence.
export function writeWorkoutCompletion(storage, state, run) {
  const raw = storage.getItem("liftlog-data");
  const durable = raw ? JSON.parse(raw) : {};
  for (const se of run.sessionEntries || []) {
    for (const old of (durable.logs || []).filter((entry) => entry.id === se.entry.id)) {
      reconcileEntry(old, se.entry, se.recoveryBases);
      if (old.date !== se.entry.date) conflict(old, se.entry, "Stored exercise date metadata changed before completion. Both copies are preserved for review.");
    }
  }
  for (const key of ["logs", "workoutSessions"]) {
    for (const old of durable[key] || []) {
      if (key === "logs" && run.sessionEntries?.some((se) => se.entry.id === old.id)) continue;
      const incoming = (state[key] || []).find((entry) => entry.id === old.id);
      if (JSON.stringify(ordered(incoming)) !== JSON.stringify(ordered(old))) conflict(old, incoming, "Stored workout history changed before completion. Recovery data is preserved; reload before retrying.");
    }
  }
  const { templates, programs, ...data } = state;
  const payload = JSON.stringify(data);
  storage.setItem("liftlog-data", payload);
  if (storage.getItem("liftlog-data") !== payload) throw new Error("Workout history could not be verified after writing");
  try {
    storage.setItem("liftlog-active-run", JSON.stringify(run));
    return true;
  } catch {
    return false; // Verified history exists; retain the previous checkpoint for reload recovery.
  }
}
