import React, { useState } from "react";
import { ChevronRight, ClipboardList, Timer, Dumbbell, Plus, Play, RefreshCw } from "lucide-react";
import { resolveCurrentProgramDay } from "../utils/programSchedule.js";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import ExerciseAnatomyRow from "./ExerciseAnatomyRow.jsx";
import SwapWorkoutSheet from "./SwapWorkoutSheet.jsx";

// Never auto-discards on age — a workout logged right up to midnight, or one left open for
// days, is still fully recoverable, just described differently: minutes/hours for something
// from the same stretch of time, a plain date once it's genuinely old (see the reliability
// spec's "Unfinished workout from Aug 22" example) rather than an ever-growing "loads of hours
// ago" that reads as more alarming than informative.
function elapsedLabel(startedAt) {
  const started = new Date(startedAt);
  const mins = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 20) {
    const rem = mins % 60;
    return `${hrs} hour${hrs === 1 ? "" : "s"}${rem ? ` ${rem} min` : ""} ago`;
  }
  return `on ${started.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// Landing/menu for the Train section. Hierarchy when no workout is active: Current Program
// (if one exists) -> the single "Start Workout Today" CTA -> Programs -> Cardio -> secondary
// tools. "My plans" no longer gets its own preview list here — it's one tap away via Programs,
// and now also reachable through Start Workout Today -> Repeat Recent — so nothing about
// starting a saved plan is lost, it's just not competing for space on the landing screen.
//
// `activeRun` is only ever passed here already minimized (see LiftLog) — i.e. the athlete has an
// in-progress, not-yet-finished workout they stepped away from. When present it takes over the
// entire screen: "Resume workout" becomes the one thing to do here, matching the reliability
// spec's "primary CTA should be RESUME WORKOUT, not Start Workout — do not make them navigate
// through workout-selection flows again."
export default function TrainTab({ state, updateState, exMap, activeRun, onStartRun, onResumeWorkout, onDiscardWorkout, onNavigate }) {
  const programDay = resolveCurrentProgramDay(state);
  const [swapOpen, setSwapOpen] = useState(false);

  if (swapOpen && !activeRun) {
    return <SwapWorkoutSheet state={state} updateState={updateState} exMap={exMap} onClose={() => setSwapOpen(false)} />;
  }

  if (activeRun) {
    const totalExercises = activeRun.exercises.length;
    const loggedIndices = new Set((activeRun.sessionEntries || []).map((se) => se.index));
    const completedExercises = loggedIndices.size;
    const completedSets =
      (activeRun.sessionEntries || []).reduce((sum, se) => sum + (se.entry?.sets?.length || 0), 0) +
      Object.values(activeRun.draftByIndex || {}).reduce((sum, d) => sum + (d?.confirmedSets?.length || 0), 0);
    // The first not-yet-logged slot is "current" — same rule GuidedRunView uses to pick the
    // active exercise. Its draft (if the athlete had typed a weight/reps without saving) is what
    // "Unsaved set restored" below refers to.
    const currentIdx = activeRun.exercises.findIndex((_, idx) => !loggedIndices.has(idx));
    const currentDraft = currentIdx >= 0 ? activeRun.draftByIndex?.[currentIdx] : null;
    const hasUnsavedSet =
      !!currentDraft &&
      ((currentDraft.weight !== "" && currentDraft.weight !== 0 && currentDraft.weight != null) ||
        (currentDraft.reps !== "" && currentDraft.reps !== 0 && currentDraft.reps != null));
    const currentExName = currentIdx >= 0 ? exMap[activeRun.swaps?.[currentIdx] ?? activeRun.exercises[currentIdx].exId]?.name : null;

    return (
      <div className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Train</div>
          <div className="text-xl font-bold text-v5-text mt-1">Resume workout</div>
        </div>

        <div className="bg-v5-surface rounded-2xl p-5 space-y-3">
          <div>
            <div className="text-xl font-bold text-v5-text">{activeRun.planName}</div>
            <div className="text-sm text-v5-subtext">Started {elapsedLabel(activeRun.startedAt)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-v5-subtext">Exercises</div>
              <div className="text-lg font-bold text-v5-text">
                {completedExercises}
                {totalExercises ? ` / ${totalExercises}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-v5-subtext">Completed sets</div>
              <div className="text-lg font-bold text-v5-text">{completedSets}</div>
            </div>
          </div>
          {hasUnsavedSet && (
            <div className="text-xs text-v5-red font-bold">
              Unsaved set restored{currentExName ? ` — ${currentExName}` : ""}
            </div>
          )}
          <button
            onClick={onResumeWorkout}
            className="w-full py-4 rounded-xl text-sm uppercase tracking-widest font-bold bg-v5-red text-white hover:opacity-90"
          >
            Resume workout
          </button>
          <button onClick={onDiscardWorkout} className="w-full text-center text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red py-1">
            Discard workout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Train</div>
        <div className="text-xl font-bold text-v5-text mt-1">Choose your workout</div>
      </div>

      {programDay && !programDay.isComplete && (
        <div className="bg-v5-surface rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Current program</div>
            {programDay.totalDays > 1 && (
              <button
                onClick={() => setSwapOpen(true)}
                aria-label="Swap workout"
                className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-widest text-v5-subtext hover:text-v5-text"
              >
                <RefreshCw size={11} /> Swap workout
              </button>
            )}
          </div>
          <div className="text-xl font-bold text-v5-text">{programDay.programName}</div>
          {programDay.isSwapped ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Swapped for today</span>
              </div>
              <div className="text-sm text-v5-subtext">
                {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
                {programDay.dayLabel}
              </div>
              {programDay.plannedDayLabel && (
                <div className="text-xs text-v5-subtext/70">Originally planned: {programDay.plannedDayLabel}</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-v5-subtext">
              {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
              Next: {programDay.dayLabel}
            </div>
          )}
          {/* Day preview — same compact anatomy row used in My Plan/program detail, so the
              athlete can see today's muscle emphasis before committing to Start. */}
          {programDay.plan?.exercises?.length > 0 && (
            <div className="pt-1">
              {programDay.plan.exercises.map((e, i) => (
                <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
              ))}
            </div>
          )}
          <button
            onClick={() => onStartRun(programDay.plan, programDay.programContext)}
            className="w-full py-3.5 rounded-xl text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:opacity-90"
          >
            Start
          </button>
        </div>
      )}

      <button
        onClick={() => onNavigate("startWorkout")}
        className="w-full py-5 rounded-2xl text-base uppercase tracking-widest font-bold bg-v5-red text-white hover:opacity-90 flex items-center justify-center gap-2"
      >
        <Play size={20} fill="currentColor" /> Start workout today
      </button>

      <button
        onClick={() => onNavigate("templates")}
        className="w-full flex items-center justify-between bg-v5-surface rounded-2xl p-4 hover:bg-v5-elevated"
      >
        <div className="flex items-center gap-3">
          <ClipboardList size={18} className="text-v5-subtext" />
          <div className="text-left">
            <div className="text-base font-bold text-v5-text">Programs</div>
            <div className="text-xs text-v5-subtext">All plans, hero programs, single-day templates</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-v5-subtext shrink-0" />
      </button>

      <button
        onClick={() => onNavigate("cardio")}
        className="w-full flex items-center justify-between bg-v5-surface rounded-2xl p-4 hover:bg-v5-elevated"
      >
        <div className="flex items-center gap-3">
          <Timer size={18} className="text-v5-subtext" />
          <div className="text-left">
            <div className="text-base font-bold text-v5-text">Cardio / conditioning</div>
            <div className="text-xs text-v5-subtext">Runs, sleds, intervals</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-v5-subtext shrink-0" />
      </button>

      <div className="flex items-center gap-4 pt-2">
        <button onClick={() => onNavigate("build")} className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-v5-red hover:opacity-80">
          <Plus size={14} /> Create plan
        </button>
        <button onClick={() => onNavigate("log")} className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-text">
          <Dumbbell size={14} /> Log a single exercise
        </button>
      </div>
    </div>
  );
}
