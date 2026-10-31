import React, { useState, useMemo } from "react";
import { Plus, Trash2, ChevronRight, ClipboardList, Check, Timer, Play, Pencil, Type } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import ProgramBuilder from "./ProgramBuilder.jsx";
import ExerciseAnatomyRow from "./ExerciseAnatomyRow.jsx";
import TrainingDaysSelector from "./TrainingDaysSelector.jsx";
import { ScreenHeader, SectionLabel, Card, HeroCard, PhotoHero, ButtonPrimary, ButtonSecondary, ButtonText, Pill, ListRow } from "./ui/Kit.jsx";
import { resolveCurrentProgramDay, programWeekAdherence, activeProgramAndCP } from "../utils/programSchedule.js";
import { trainingDayCountLabel, countTrainingDays, renameProgram } from "../utils/programBuilder.js";
import { findMostRecentSessionForPlan } from "../utils/workoutHistory.js";
import { recoveryRoutineById } from "../data/mobilityLibrary.js";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import { recommendationFor, totalWeeklySets, FREQUENCY_GUIDANCE, familyVariants, uniqueFamilyPrograms, familyFrequencyRange } from "../utils/programRecommendation.js";

// Extracted from App.jsx verbatim (see the extraction commit) — the program/plan browser screen
// (catalog, program detail with its frequency switcher, custom-program management, templates,
// program history). No behavior changed by the move itself; every dependency below was already a
// clean module import in App.jsx except MUSCLE_GROUPS, which is now the `muscleGroups` prop
// instead of a same-file constant.
export default function TemplatesTab({ state, updateState, exMap, allExercises, muscleGroups, onStartRun, onStartRecovery, onLogManualRecovery, onRestartCompletedProgram, onGoToBuild, onActivateProgram, onViewWorkout, onBack }) {
  // Live-resolved active-program name (program renaming UX fix, item 4) — state.currentProgram.
  // programName is a snapshot taken at activation time; reading it directly anywhere a rename
  // should show up immediately would keep displaying the OLD name until the next sign-in.
  const activeProgramName = activeProgramAndCP(state)?.prog?.name ?? state.currentProgram?.programName;
  const [detail, setDetail] = useState(null); // { kind: "program" | "template" | "customPlan" | "customProgram", id }
  // Program Builder (task: "fully editable training splits") — { programId } to edit an existing
  // custom program, or { startFrom: <template or program object> } to fork a new editable copy
  // from a built-in template / blank starting point. Set by the entry points below; cleared by
  // the builder's own "Done" action, which returns here (never auto-navigates further).
  const [builderTarget, setBuilderTarget] = useState(null);
  // Inline "Rename program" (program renaming UX fix) — an expand-in-place row on the custom
  // program detail screen, not a separate screen. renamingProgramId tracks which program's
  // detail view currently has the input open (null = none); renameJustSavedId briefly flashes
  // "Saved" on the program that was just renamed, then clears itself.
  const [renamingProgramId, setRenamingProgramId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameJustSavedId, setRenameJustSavedId] = useState(null);
  const startRenaming = (prog) => {
    setRenamingProgramId(prog.id);
    setRenameDraft(prog.name);
  };
  const cancelRenaming = () => setRenamingProgramId(null);
  const saveRename = (prog) => {
    const trimmed = renameDraft.trim();
    // Never save an empty name, and a no-op edit (retyped the same name, or just whitespace
    // around it) closes the row without writing anything — "in seconds," not a confirmation gate.
    if (!trimmed || trimmed === prog.name) {
      setRenamingProgramId(null);
      return;
    }
    // renameProgram only ever touches `.name` — id, days, exercises, and every other field on
    // this exact object are untouched, so history/schedules keyed by id are never affected (task
    // items 5-7). Scoped to THIS program's id in the map, so no other custom program or the
    // built-in template it may have been forked from is ever touched.
    updateState((prev) => ({
      ...prev,
      customPrograms: (prev.customPrograms || []).map((p) => (p.id === prog.id ? renameProgram(p, trimmed) : p)),
    }));
    setRenamingProgramId(null);
    setRenameJustSavedId(prog.id);
    setTimeout(() => setRenameJustSavedId((id) => (id === prog.id ? null : id)), 2000);
  };
  // Frequency-aware program picker (Part 2) — selectedDays starts from the athlete's saved
  // preference (or a pending review's proposed frequency) but is local UI state, never written
  // back to the profile just by browsing. reviewCompare only exists while the athlete arrived via
  // the "Review New Plan" banner below, driving the Current -> Proposed framing in the picker and
  // the program detail panel; it's cleared on Keep/back-out and never mutates currentProgram.
  const [selectedDays, setSelectedDays] = useState(() => state.pendingFrequencyReview?.toDays ?? state.athleteProfile?.preferredDays ?? null);
  const [reviewCompare, setReviewCompare] = useState(null); // { fromDays, toDays } | null
  // Program-detail frequency switcher (Part 1) — lets an athlete preview a sibling weekly
  // variant of the SAME program family (e.g. Titan at 4 days instead of 3) inline, without
  // navigating away or touching currentProgram. Keyed by the originally-opened program's id so
  // opening a different program always starts from that program's own content, not a stale
  // preview. Never applied until the athlete explicitly taps Start on the previewed day.
  const [familyPreview, setFamilyPreview] = useState(null); // { baseId, days } | null

  const pendingReview = state.pendingFrequencyReview;
  const dismissPendingReview = () => updateState((prev) => ({ ...prev, pendingFrequencyReview: null }));
  const openReview = () => {
    if (!pendingReview) return;
    setSelectedDays(pendingReview.toDays);
    setReviewCompare({ fromDays: pendingReview.fromDays, toDays: pendingReview.toDays });
    dismissPendingReview();
  };

  const deleteCustomPlan = (id) => updateState((prev) => ({ ...prev, customPlans: prev.customPlans.filter((p) => p.id !== id) }));
  const deleteCustomProgram = (id) =>
    updateState((prev) => ({ ...prev, customPrograms: (prev.customPrograms || []).filter((p) => p.id !== id) }));

  const copyToCustom = (tpl) => {
    const newPlan = { ...tpl, id: `plan_${Date.now()}`, name: `${tpl.name} (copy)`, isCustom: true };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, newPlan] }));
  };

  const copyDayToCustom = (program, day) => {
    const newPlan = {
      id: `plan_${Date.now()}`,
      name: `${program.name} — ${day.label}`,
      exercises: day.exercises,
      isCustom: true,
    };
    updateState((prev) => ({ ...prev, customPlans: [...prev.customPlans, newPlan] }));
  };

  const currentProgramDay = useMemo(() => resolveCurrentProgramDay(state), [state]);
  const isCurrent = (progId) =>
    state.currentProgram?.source === "builtin" && state.currentProgram.programId === progId;
  const isComplete = (progId) => isCurrent(progId) && currentProgramDay?.isComplete;
  const isCurrentCustom = (progId) => state.currentProgram?.source === "custom" && state.currentProgram.programId === progId;
  const isCompleteCustom = (progId) => isCurrentCustom(progId) && currentProgramDay?.isComplete;
  // Manually corrects which day the active program is parked on — for when it's drifted from
  // where the athlete actually is (e.g. dayIndex already advanced past a day before this
  // tracking existed, or a day was skipped/repeated outside the normal finish-a-workout flow).
  // Unlike "Start workout," this doesn't log anything — it just repoints the Today card.
  const setCurrentProgramDay = (di) => {
    updateState((prev) => ({
      ...prev,
      // A manual permanent repoint supersedes any one-day swap override that might still be
      // sitting around — otherwise the override could point somewhere stale relative to the
      // newly repointed day.
      programDayOverride: null,
      currentProgram: { ...prev.currentProgram, dayIndex: di, lastCompletedAt: null, lastCompletedDayIndex: null },
    }));
  };

  // A day's completion status is derived by matching its plan name against workoutSessions —
  // there's no programId/dayIndex stored on the session itself (see buildSessionSummary), only
  // the exact name it was started under, which onStartRun always sets to `${program} — ${day}`.
  const dayCompletionRow = (planName) => {
    const session = findMostRecentSessionForPlan(state.workoutSessions, planName);
    if (!session) return null;
    return (
      <div className="flex items-center justify-between text-xs text-v5-subtext pt-1.5 mt-1.5 border-t border-white/[0.06]">
        <span>Completed {new Date(session.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        {onViewWorkout && (
          <button onClick={() => onViewWorkout(session.id)} className="text-[11px] uppercase tracking-widest text-v5-red hover:text-v5-red flex items-center gap-1">
            View Workout <ChevronRight size={11} />
          </button>
        )}
      </div>
    );
  };
  // Same idea as dayCompletionRow above but for a recovery-type program day — reads
  // state.recoverySessions instead of state.workoutSessions (never the same collection).
  const recoveryCompletionRow = (planName) => {
    const session = findMostRecentSessionForPlan(state.recoverySessions, planName);
    if (!session) return null;
    return (
      <div className="text-xs text-v5-subtext pt-1.5 mt-1.5 border-t border-white/[0.06]">
        Completed {new Date(session.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
    );
  };
  // Renders one recovery-type program day's row — label/badges identical to a lifting day's, but
  // the body is a routine summary + Start Recovery Session / Log Recovery Session instead of an
  // exercise list (recovery movements are never forced into ExerciseAnatomyRow's lifting-set
  // prescription format). Shared by the built-in and custom program detail screens below.
  const recoveryDayRow = (prog, day, di, programContext) => {
    const routine = recoveryRoutineById(day.routineId);
    const minutes = routine ? Math.round(routine.movements.reduce((s, m) => s + (m.durationSeconds || (m.reps || 0) * 3) * (m.sets || 1), 0) / 60) : 0;
    return (
      <div key={di} className="border-t border-white/[0.06] pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-v5-red flex items-center gap-1.5">
            {day.label}
            {isCurrent(prog.id) && state.currentProgram.dayIndex === di && (
              <span className="text-[11px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Next up</span>
            )}
          </span>
          {isCurrent(prog.id) && state.currentProgram.dayIndex !== di && (
            <button onClick={() => setCurrentProgramDay(di)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
              Set as today
            </button>
          )}
        </div>
        <div className="text-xs text-v5-subtext mb-2">{routine ? `${routine.movements.length} movements · Est. ${minutes} min` : "Recovery routine"}</div>
        <div className="flex gap-3">
          <button
            onClick={() => onStartRecovery(routine, programContext)}
            className="text-[11px] text-v5-red hover:text-v5-red flex items-center gap-1"
          >
            <ChevronRight size={11} /> Start Recovery Session
          </button>
          <button onClick={() => onLogManualRecovery(routine, programContext)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
            Log Recovery Session
          </button>
        </div>
        {recoveryCompletionRow(`${prog.name} — ${day.label}`)}
      </div>
    );
  };

  if (builderTarget) {
    return (
      <ProgramBuilder
        state={state}
        updateState={updateState}
        exMap={exMap}
        allExercises={allExercises}
        muscleGroups={muscleGroups}
        programId={builderTarget.programId}
        startFrom={builderTarget.startFrom}
        onBack={() => setBuilderTarget(null)}
        onDone={() => setBuilderTarget(null)}
      />
    );
  }

  if (detail?.kind === "customPlan") {
    const p = state.customPlans.find((pl) => pl.id === detail.id);
    if (!p) return null;
    return (
      <SlideInPanel title={p.name} subtitle={`${p.exercises.length} exercises`} onBack={() => setDetail(null)}>
        <div>
          {p.exercises.map((e, i) => (
            <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} group={e.group} prescription={formatSetPrescription(e)} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(p)} className="text-xs text-v5-red hover:text-v5-red flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button
            onClick={() => {
              if (!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;
              deleteCustomPlan(p.id);
              setDetail(null);
            }}
            className="text-xs text-v5-subtext hover:text-v5-red flex items-center gap-1"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      </SlideInPanel>
    );
  }

  if (detail?.kind === "customProgram") {
    const prog = (state.customPrograms || []).find((pr) => pr.id === detail.id);
    if (!prog) return null;
    return (
      <SlideInPanel
        title={prog.name}
        subtitle={trainingDayCountLabel(prog.days)}
        onBack={() => setDetail(null)}
      >
        {renamingProgramId === prog.id ? (
          <div className="space-y-2">
            <label className="block text-[11px] uppercase tracking-widest text-v5-subtext">Program name</label>
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename(prog);
                if (e.key === "Escape") cancelRenaming();
              }}
              autoFocus
              className="w-full bg-v5-elevated text-v5-text rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-v5-red"
            />
            <div className="flex gap-2">
              <button
                onClick={cancelRenaming}
                className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:text-v5-text/90"
              >
                Cancel
              </button>
              <button
                onClick={() => saveRename(prog)}
                disabled={!renameDraft.trim()}
                className="flex-1 py-2 text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:bg-v5-red/90 disabled:opacity-40"
              >
                Save name
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {isCurrentCustom(prog.id) ? (
              <div className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-v5-red/40 bg-v5-red/10 text-v5-red flex items-center justify-center gap-1.5">
                <Check size={12} /> Currently active
              </div>
            ) : (
              <button
                onClick={() => onActivateProgram(prog, "custom")}
                className="w-full py-2.5 text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:bg-v5-red/90 flex items-center justify-center gap-1.5"
              >
                <Play size={12} /> Start this program
              </button>
            )}
            <button
              onClick={() => setBuilderTarget({ programId: prog.id })}
              className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40 hover:text-v5-text/90 flex items-center justify-center gap-1.5"
            >
              <Pencil size={12} /> Customize program
            </button>
            <button
              onClick={() => startRenaming(prog)}
              className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40 hover:text-v5-text/90 flex items-center justify-center gap-1.5"
            >
              <Type size={12} /> Rename program
            </button>
            {renameJustSavedId === prog.id && (
              <div className="text-center text-xs text-v5-text/70 flex items-center justify-center gap-1.5">
                <Check size={12} className="text-v5-red" /> Name saved
              </div>
            )}
          </div>
        )}
        {prog.days.map((day, di) => (
          <div key={di} className="border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-v5-red flex items-center gap-1.5">
                {day.label}
                {isCurrentCustom(prog.id) && state.currentProgram.dayIndex === di && (
                  <span className="text-[11px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Next up</span>
                )}
              </span>
              <div className="flex items-center gap-3">
                {isCurrentCustom(prog.id) && state.currentProgram.dayIndex !== di && (
                  <button onClick={() => setCurrentProgramDay(di)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
                    Set as today
                  </button>
                )}
                <button
                  onClick={() =>
                    onStartRun(
                      { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                      { programId: prog.id, programName: prog.name, source: "custom", dayIndex: di, totalDays: prog.days.length }
                    )
                  }
                  className="text-[11px] text-v5-red hover:text-v5-red flex items-center gap-1"
                >
                  <ChevronRight size={11} /> Start workout
                </button>
              </div>
            </div>
            <div>
              {day.exercises.map((e, i) => (
                <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
              ))}
            </div>
            {dayCompletionRow(`${prog.name} — ${day.label}`)}
          </div>
        ))}
        <button
          onClick={() => {
            if (!window.confirm(`Delete "${prog.name}"? This can't be undone.`)) return;
            deleteCustomProgram(prog.id);
            setDetail(null);
          }}
          className="text-xs text-v5-subtext hover:text-v5-red flex items-center gap-1"
        >
          <Trash2 size={12} /> Delete program
        </button>
      </SlideInPanel>
    );
  }

  if (detail?.kind === "program") {
    const baseProg = (state.programs || []).find((p) => p.id === detail.id);
    if (!baseProg) return null;
    // Sibling frequency variants of the same program family (Titan/Athena/Shape today — see
    // programFamilies.js), keyed by day count. Switching the chip below only changes what `prog`
    // resolves to for THIS render — a local preview, never applied until Start is tapped.
    const siblings = baseProg.familyId ? familyVariants(baseProg.familyId, state.programs) : {};
    const previewDays = familyPreview?.baseId === detail.id ? familyPreview.days : null;
    const prog = (previewDays && siblings[previewDays]) || baseProg;
    const switchPreview = (n) => {
      setFamilyPreview({ baseId: detail.id, days: n });
      if (reviewCompare) setReviewCompare((r) => ({ ...r, toDays: n }));
    };
    return (
      <SlideInPanel
        title={baseProg.name}
        subtitle={prog.weeks ? `${prog.tagline} · ${prog.weeks} weeks` : prog.tagline}
        onBack={() => setDetail(null)}
      >
        {isCurrent(prog.id) &&
          (() => {
            const adherence = programWeekAdherence(state);
            if (!adherence || adherence.recovery.scheduled === 0) return null;
            return (
              <div className="border border-white/10 bg-v5-elevated px-4 py-3 space-y-1.5">
                <div className="text-[11px] uppercase tracking-widest text-v5-subtext">
                  {prog.name.toUpperCase()} — TRAILING {adherence.windowDays} DAYS
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-v5-subtext">Strength sessions</span>
                  <span className="text-white font-bold">
                    {adherence.lifting.completed} / {adherence.lifting.scheduled}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-v5-subtext">Recovery sessions</span>
                  <span className="text-white font-bold">
                    {adherence.recovery.completed} / {adherence.recovery.scheduled}
                  </span>
                </div>
              </div>
            );
          })()}
        {Object.keys(siblings).length > 1 && (
          <div className="border border-white/10 bg-v5-elevated px-4 py-3 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">
              {prog.trainingDays} {prog.trainingDays === 1 ? "Day" : "Days"} / Week
            </div>
            <div className="flex gap-1.5">
              {[2, 3, 4, 5, 6].map((n) => {
                const variant = siblings[n];
                if (!variant) return null;
                const active = variant.id === prog.id;
                return (
                  <button
                    key={n}
                    onClick={() => switchPreview(n)}
                    aria-pressed={active}
                    className={`flex-1 py-2 text-xs font-bold border ${
                      active ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-v5-subtext/70">
              Previewing {baseProg.name} at {prog.trainingDays} days/week — tap Start on a day below to actually switch to it.
            </p>
          </div>
        )}
        {reviewCompare && (
          <div className="border border-v5-red/25 bg-v5-elevated px-4 py-3 space-y-1.5">
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext/70">Current → Proposed</div>
            <div className="text-sm text-v5-text/90">
              <span className="text-v5-subtext">{activeProgramName || "No active program"}</span>
              {` (${reviewCompare.fromDays} days) → `}
              <span className="text-white font-bold">{prog.name}</span>
              {` (${countTrainingDays(prog.days)} days)`}
            </div>
            <div className="text-xs text-v5-subtext">
              Approximate weekly volume: {totalWeeklySets(prog)} sets across {countTrainingDays(prog.days)} sessions
            </div>
            <button
              onClick={() => {
                setReviewCompare(null);
                setDetail(null);
              }}
              className="text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-text/90"
            >
              Keep current plan instead
            </button>
          </div>
        )}
        <div className="space-y-2">
          {isCurrent(prog.id) ? (
            <div className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-v5-red/40 bg-v5-red/10 text-v5-red flex items-center justify-center gap-1.5">
              <Check size={12} /> Currently active
            </div>
          ) : (
            <button
              onClick={() => onActivateProgram(prog, "builtin")}
              className="w-full py-2.5 text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:bg-v5-red/90 flex items-center justify-center gap-1.5"
            >
              <Play size={12} /> Start this program
            </button>
          )}
          <button
            onClick={() => setBuilderTarget({ startFrom: prog })}
            className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40 hover:text-v5-text/90 flex items-center justify-center gap-1.5"
          >
            <Pencil size={12} /> Customize program
          </button>
          {/* "Clearly explain that the athlete is creating their own editable version" (program
              renaming UX fix, item 2) — inline, not a confirmation dialog: Customize forks {prog}
              into a brand-new customPrograms entry the instant it's tapped (forkProgramForEditing
              in programBuilder.js), and this template object is never touched by that fork or
              anything done to it afterward (item 7). */}
          <p className="text-[11px] text-v5-subtext/60 text-center px-2">
            Creates your own editable copy — rename it, change the days, add exercises. {prog.name} itself never changes.
          </p>
        </div>
        {prog.days.map((day, di) =>
          day.type === "recovery" ? (
            recoveryDayRow(prog, day, di, { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: di, totalDays: prog.days.length })
          ) : (
            <div key={di} className="border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-v5-red flex items-center gap-1.5">
                  {day.label}
                  {isCurrent(prog.id) && state.currentProgram.dayIndex === di && (
                    <span className="text-[11px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Next up</span>
                  )}
                </span>
                <div className="flex items-center gap-3">
                  {isCurrent(prog.id) && state.currentProgram.dayIndex !== di && (
                    <button onClick={() => setCurrentProgramDay(di)} className="text-[11px] text-v5-subtext hover:text-v5-text/90">
                      Set as today
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setReviewCompare(null);
                      onStartRun(
                        { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
                        { programId: prog.id, programName: prog.name, source: "builtin", dayIndex: di, totalDays: prog.days.length }
                      );
                    }}
                    className="text-[11px] text-v5-red hover:text-v5-red flex items-center gap-1"
                  >
                    <ChevronRight size={11} /> {reviewCompare ? "Apply — Start" : "Start workout"}
                  </button>
                  <button
                    onClick={() => copyDayToCustom(prog, day)}
                    className="text-[11px] text-v5-subtext hover:text-v5-red flex items-center gap-1"
                  >
                    <Plus size={11} /> Copy to my plans
                  </button>
                </div>
              </div>
              <div>
                {day.exercises.map((e, i) => (
                  <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
                ))}
              </div>
              {dayCompletionRow(`${prog.name} — ${day.label}`)}
            </div>
          )
        )}
      </SlideInPanel>
    );
  }

  if (detail?.kind === "template") {
    const tpl = state.templates.find((t) => t.id === detail.id);
    if (!tpl) return null;
    return (
      <SlideInPanel title={tpl.name} onBack={() => setDetail(null)}>
        <div>
          {tpl.exercises.map((e, i) => (
            <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => onStartRun(tpl)} className="text-xs text-v5-red hover:text-v5-red flex items-center gap-1">
            <ChevronRight size={12} /> Start workout
          </button>
          <button onClick={() => copyToCustom(tpl)} className="text-xs text-v5-subtext hover:text-v5-red flex items-center gap-1">
            <Plus size={12} /> Copy to my plans
          </button>
        </div>
      </SlideInPanel>
    );
  }

  return (
    <div className="space-y-6">
      <ScreenHeader
        eyebrow="Plans & programs"
        title="Browse everything"
        right={
          <div className="flex items-center gap-3">
            {onGoToBuild && <ButtonText icon={Plus} onClick={onGoToBuild}>Create plan</ButtonText>}
            {onBack && (
              <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
                ← Back
              </button>
            )}
          </div>
        }
      />

      {/* Shown only while pendingFrequencyReview is set — i.e. only right after the athlete
          changed Planned Training Days while a program was active (see AthleteProfileForm.save()).
          Both actions dismiss it; only Review New Plan also opens the frequency-filtered picker
          below pre-set to the new day count. currentProgram is untouched either way until the
          athlete explicitly starts a different program day from that picker. */}
      {pendingReview && (
        <HeroCard>
          <div className="text-sm text-v5-text/90">
            You changed your planned training frequency from <span className="font-bold text-v5-text">{pendingReview.fromDays}</span> to{" "}
            <span className="font-bold text-v5-text">{pendingReview.toDays}</span> days per week.
          </div>
          <div className="text-xs text-v5-subtext">Would you like BRK to adapt your current program?</div>
          <div className="flex gap-2">
            <ButtonPrimary size="sm" onClick={openReview} className="flex-1">
              Review {pendingReview.toDays}-Day Version
            </ButtonPrimary>
            <ButtonSecondary size="sm" onClick={dismissPendingReview} className="flex-1">
              Keep Current Program
            </ButtonSecondary>
          </div>
        </HeroCard>
      )}

      {state.customPlans.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>My plans</SectionLabel>
          <div className="space-y-2">
            {state.customPlans.map((p) => (
              // Two independent tap targets (open detail vs. jump straight to Start) — kept as
              // sibling buttons inside a plain (non-button) Card, never a button nested inside
              // ListRow's own button, which the HTML spec disallows.
              <Card key={p.id} className="flex items-center justify-between gap-3">
                <button onClick={() => setDetail({ kind: "customPlan", id: p.id })} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-bold text-v5-text truncate">{p.name}</div>
                  <div className="text-xs text-v5-subtext mt-0.5">{p.exercises.length} exercises</div>
                </button>
                <ButtonText icon={ChevronRight} onClick={() => onStartRun(p)} className="shrink-0">
                  Start
                </ButtonText>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {(state.customPrograms || []).length > 0 && <SectionLabel>My programs</SectionLabel>}
        <button
          onClick={() => setBuilderTarget({ startFrom: { id: "blank", name: "New Program", days: [] } })}
          className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-dashed border-white/15 text-v5-subtext hover:border-v5-red/40 hover:text-v5-text/90 flex items-center justify-center gap-1.5"
        >
          <Plus size={12} /> Build a program
        </button>
        {(state.customPrograms || []).length > 0 && (
          <div className="space-y-2">
            {state.customPrograms.map((prog) => (
              <ListRow
                key={prog.id}
                onClick={() => setDetail({ kind: "customProgram", id: prog.id })}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{prog.name}</span>
                    {isCompleteCustom(prog.id) ? (
                      <Pill tone="inactive">Complete</Pill>
                    ) : (
                      isCurrentCustom(prog.id) && <Pill>Current</Pill>
                    )}
                  </span>
                }
                subtitle={`${trainingDayCountLabel(prog.days)}${prog.weeks ? ` · ${prog.weeks} weeks` : ""}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Frequency-aware picker (Part 2) — "available days -> best-fit split," not "force the
          same split into N days." Built-in/custom programs matching the selected day count are
          grouped Recommended/Other Options; day counts with no concrete match yet (2/4/5/6 today)
          fall back to structure guidance instead of fabricating a program. Nothing here is
          hidden — the full "All Programs" list below is unaffected and still shows everything
          regardless of day count. */}
      <div className="space-y-2.5">
        <SectionLabel>Find a program for your schedule</SectionLabel>
        {reviewCompare && (
          <div className="text-xs text-v5-subtext border-l-2 border-v5-red pl-2.5">
            Current: <span className="text-v5-text/90">{activeProgramName || "No active program"}</span> (
            {reviewCompare.fromDays} days) → Proposed: {reviewCompare.toDays} days
          </div>
        )}
        <TrainingDaysSelector
          label="How many days can you train?"
          value={selectedDays}
          onChange={(d) => {
            setSelectedDays(d);
            if (reviewCompare) setReviewCompare((r) => ({ ...r, toDays: d }));
          }}
        />
        {selectedDays != null &&
          (() => {
            // While reviewing a frequency change (or just browsing with an active builtin
            // program), bias "Recommended" toward the athlete's OWN program family — e.g.
            // someone on 5-day Titan who drops to 3 days sees "Titan — 3-Day Version"
            // recommended first, not an unrelated program.
            const activeFamilyId =
              state.currentProgram?.source === "builtin"
                ? (state.programs || []).find((p) => p.id === state.currentProgram.programId)?.familyId
                : null;
            const rec = recommendationFor(selectedDays, {
              programs: state.programs,
              customPrograms: state.customPrograms,
              preferFamilyId: activeFamilyId,
            });
            const guidance = FREQUENCY_GUIDANCE[selectedDays];
            const programRow = (p, isRecommended) => (
              <ListRow
                key={p.id}
                tone={isRecommended ? "accent" : "default"}
                onClick={() => setDetail({ kind: p.source === "custom" ? "customProgram" : "program", id: p.id })}
                title={
                  <span className="flex items-center gap-2">
                    <span className="truncate">{p.name}</span>
                    {isRecommended && <Pill>Recommended</Pill>}
                  </span>
                }
                subtitle={`${p.tagline}${p.weeks ? ` · ${p.weeks} weeks` : ""}`}
              />
            );
            return (
              <div className="space-y-3">
                {guidance?.warning && (
                  <div className="rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-400">{guidance.note}</div>
                )}
                {rec.recommended && (
                  <div className="space-y-1.5">
                    <SectionLabel tone="muted">Recommended</SectionLabel>
                    {programRow(rec.recommended, true)}
                  </div>
                )}
                {rec.others.length > 0 && (
                  <div className="space-y-1.5">
                    <SectionLabel tone="muted">Other Options</SectionLabel>
                    {rec.others.map((p) => programRow(p, false))}
                  </div>
                )}
                {rec.matches.length === 0 && guidance && !guidance.warning && (
                  <Card className="space-y-2 text-xs text-v5-subtext">
                    <div>
                      No built-in program at {selectedDays} days yet. Recommended structure: {guidance.structure.join(" / ")}.
                    </div>
                    <div className="text-v5-subtext/70">{guidance.note}</div>
                    {onGoToBuild && <ButtonText onClick={onGoToBuild}>Build one from scratch →</ButtonText>}
                  </Card>
                )}
              </div>
            );
          })()}
      </div>

      {/* "Recommended for you" hero + a compact grid for the rest (mockup section 7) — the
          featured pick is never a fabricated category, just the most personally relevant real
          program: the athlete's own active program if they have one, otherwise the best match
          for their stated training frequency, otherwise BRK's flagship. Every stat shown
          (days/week, weeks, tagline) reads straight off the program's own real fields. */}
      {(() => {
        const all = state.programs || [];
        if (all.length === 0) return null;
        const activeFamilyId = state.currentProgram?.source === "builtin" ? all.find((p) => p.id === state.currentProgram.programId)?.familyId : null;
        let featured = state.currentProgram?.source === "builtin" ? all.find((p) => p.id === state.currentProgram.programId) : null;
        if (!featured) {
          const prefDays = state.athleteProfile?.preferredDays ?? selectedDays;
          if (prefDays != null) featured = recommendationFor(prefDays, { programs: all, customPrograms: [], preferFamilyId: activeFamilyId }).recommended;
        }
        if (!featured) featured = all[0];
        // One catalog card per program family (Titan/Athena/Shape), not one per frequency
        // variant — the fix for "Titan — 2-Day," "Titan — 3-Day," ... all appearing as separate
        // products. `featured`'s own family (if it has one) is excluded entirely rather than
        // deduped-and-kept, since it's already shown above as the hero card.
        const others = uniqueFamilyPrograms(all, { preferredDays: state.athleteProfile?.preferredDays }).filter(
          (p) => p.id !== featured.id && (!featured.familyId || p.familyId !== featured.familyId)
        );
        const daysPerWeek = (prog) => prog.trainingDays || countTrainingDays(prog.days) || null;
        const frequencyLabel = (prog) => {
          if (!prog.familyId) return daysPerWeek(prog) ? `${daysPerWeek(prog)} Days/Week` : null;
          const range = familyFrequencyRange(prog.familyId, all);
          return range ? (range.min === range.max ? `${range.min} Days/Week` : `${range.min}–${range.max} Days/Week`) : null;
        };
        return (
          <>
            <div className="space-y-2.5">
              <SectionLabel>Recommended for you</SectionLabel>
              <PhotoHero
                exercise={exMap[featured.days?.[0]?.exercises?.[0]?.exId]}
                eyebrow={featured.tagline}
                title={featured.name}
                meta={
                  <div className="flex items-center gap-4 text-xs font-bold text-v5-subtext">
                    {daysPerWeek(featured) && (
                      <span className="flex items-center gap-1.5"><ClipboardList size={13} className="text-v5-red" /> {daysPerWeek(featured)} Days/Week</span>
                    )}
                    {featured.weeks && (
                      <span className="flex items-center gap-1.5"><Timer size={13} className="text-v5-red" /> {featured.weeks} weeks</span>
                    )}
                    {isComplete(featured.id) ? <Pill tone="inactive">Complete</Pill> : isCurrent(featured.id) && <Pill>Current</Pill>}
                  </div>
                }
              >
                <ButtonPrimary size="lg" onClick={() => setDetail({ kind: "program", id: featured.id })}>
                  View program
                </ButtonPrimary>
              </PhotoHero>
            </div>

            {others.length > 0 && (
              <div className="space-y-2.5">
                <SectionLabel tone="muted">Other programs</SectionLabel>
                <div className="grid grid-cols-2 gap-2.5">
                  {others.map((prog) => (
                    <Card key={prog.id} onClick={() => setDetail({ kind: "program", id: prog.id })} padding="p-3.5" className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-v5-text truncate">{prog.name}</span>
                        {isComplete(prog.id) ? <Pill tone="inactive">Done</Pill> : isCurrent(prog.id) && <Pill>Current</Pill>}
                      </div>
                      {/* A family representative's own tagline is "N-Day Version — <family
                          tagline>" (expandProgramFamilies) — accurate for the program-detail view,
                          misleading on a catalog card standing in for every frequency the family
                          supports. Strip that prefix here so the card reads as the family's
                          identity, not one arbitrarily-picked variant. */}
                      <div className="text-[11px] text-v5-subtext line-clamp-2">
                        {prog.familyId ? prog.tagline.replace(/^\d+-Day Version — /, "") : prog.tagline}
                      </div>
                      <div className="text-[11px] font-bold text-v5-subtext/70 flex items-center gap-2 pt-0.5">
                        {frequencyLabel(prog) && <span>{frequencyLabel(prog)}</span>}
                        {prog.weeks && <span>· {prog.weeks} wks</span>}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      <div className="space-y-2.5">
        <SectionLabel tone="muted">Single day templates</SectionLabel>
        <p className="text-xs text-v5-subtext">Standard split templates. Copy one into your own plans to customize it.</p>
        <div className="space-y-2">
          {state.templates.map((tpl) => (
            <ListRow key={tpl.id} title={tpl.name} onClick={() => setDetail({ kind: "template", id: tpl.id })} />
          ))}
        </div>
      </div>

      {(state.completedPrograms || []).length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel tone="muted">Program history</SectionLabel>
          <p className="text-xs text-v5-subtext">Every program you've run — earned, not reset silently.</p>
          <div className="space-y-2">
            {state.completedPrograms.map((c) => {
              // Missing status = a legacy entry recorded before this field existed, which only
              // ever happened on an actual full completion — defaults to "completed", never
              // "ended_early" (active-program-management fix, item 3's distinction).
              const endedEarly = c.status === "ended_early";
              return (
                // Plain (non-button) Card — its only action is the sibling Restart button, so
                // there's no outer click target competing with it.
                <Card key={c.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="text-sm font-bold text-v5-text truncate">{c.programName}</div>
                      <Pill tone={endedEarly ? "inactive" : undefined}>{endedEarly ? "Ended early" : "Completed"}</Pill>
                    </div>
                    <div className="text-xs text-v5-subtext mt-0.5">
                      {c.weeks ? `${c.weeks} weeks · ` : ""}
                      {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <ButtonText icon={ChevronRight} onClick={() => onRestartCompletedProgram(c.programId, c.programSource)} className="shrink-0">
                    Restart
                  </ButtonText>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
