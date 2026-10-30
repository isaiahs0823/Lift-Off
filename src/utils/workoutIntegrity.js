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

export function collectConfirmedWorkout(run, now = new Date().toISOString()) {
  const entries = new Map((run.sessionEntries || []).map((entry) => [entry.index, entry]));
  (run.exercises || []).forEach((slot, index) => {
    // A finished exercise is authoritative. An old unmount flush must not resurrect its draft.
    if (entries.has(index)) return;
    const draft = run.draftByIndex?.[index];
    const sets = (draft?.confirmedSets || []).filter((set) => Number(set.reps) > 0);
    if (!sets.length) return;
    const exId = run.swaps?.[index] ?? slot.exId;
    const entry = {
      id: workoutLogId(run, index),
      exId,
      date: draft.updatedAt || now,
      sets,
      targetReps: Number(draft.reps) || sets[0].reps,
      ...(draft.equipmentProfileId ? { equipmentProfileId: draft.equipmentProfileId } : {}),
      ...(draft.equipmentContext ? { equipmentContext: draft.equipmentContext } : {}),
      ...(draft.jointNote ? { jointNote: draft.jointNote } : {}),
    };
    entries.set(index, { index, exId, entry });
  });
  return { ...run, sessionEntries: [...entries.values()].sort((a, b) => a.index - b.index) };
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
  const existing = (state.workoutSessions || []).find((session) => session.id === summaryId);
  if (existing) {
    return { state, summary: existing, run: { ...run, finished: true, summaryId, completionPending: false, draftByIndex: {} } };
  }
  const collected = collectConfirmedWorkout(run, now);
  const finishedIds = new Set((run.sessionEntries || []).map((se) => se.entry.id));
  const canonicalLogs = new Map((state.logs || []).map((entry) => [entry.id, entry]));
  const completed = {
    ...collected,
    sessionEntries: collected.sessionEntries.map((se) => finishedIds.has(se.entry.id) && canonicalLogs.has(se.entry.id)
      ? { ...se, entry: canonicalLogs.get(se.entry.id) } : se),
  };
  const existingIds = new Set((state.logs || []).map((entry) => entry.id));
  const added = completed.sessionEntries.map((se) => se.entry).filter((entry) => {
    if (existingIds.has(entry.id)) return false;
    existingIds.add(entry.id);
    return true;
  });
  // Finish Exercise can have written a log just before interruption. A restored slot may
  // then acquire more sets. Update only this run's owned log IDs, never unrelated history.
  const ownedEntries = new Map(completed.sessionEntries
    .map((se) => se.entry).filter((entry) => entry.id.startsWith(`log_${run.id}_`))
    .map((entry) => [entry.id, entry]));
  const logs = [...added, ...(state.logs || []).map((entry) => ownedEntries.get(entry.id) || entry)];
  const summary = { ...buildSummary(completed, logs, state.workoutSessions || []), id: summaryId };
  const next = advanceProgramForWorkout({
    ...state, logs, workoutSessions: [summary, ...(state.workoutSessions || [])], hasSeenOnboarding: true,
  }, completed, now);
  return {
    state: next,
    summary,
    run: {
      ...completed, finished: true, summaryId, completionPending: false, draftByIndex: {},
      programBeforeCompletion: state.currentProgram,
    },
  };
}

// Write canonical history before retiring its independently stored recovery checkpoint.
// If the second write fails, the unfinished checkpoint + stable IDs make retry safe.
export function writeWorkoutCompletion(storage, state, run) {
  const { templates, programs, ...data } = state;
  storage.setItem("liftlog-data", JSON.stringify(data));
  try {
    storage.setItem("liftlog-active-run", JSON.stringify(run));
    return true;
  } catch {
    // Canonical history is durable; the previous checkpoint can be reconciled on reload.
    return false;
  }
}
