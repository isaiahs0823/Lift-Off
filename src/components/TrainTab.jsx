import React from "react";
import { ChevronRight, ClipboardList, Timer, Dumbbell, Plus, Play } from "lucide-react";
import { resolveCurrentProgramDay } from "../utils/programSchedule.js";

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
export default function TrainTab({ state, exMap, activeRun, onStartRun, onResumeWorkout, onDiscardWorkout, onNavigate }) {
  const programDay = resolveCurrentProgramDay(state);

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
          <div className="text-[11px] uppercase tracking-widest text-red-600">Train</div>
          <div className="text-xl font-bold text-white mt-1">Resume workout</div>
        </div>

        <div className="border-2 border-red-700 bg-charcoal-panel p-4 space-y-3">
          <div>
            <div className="text-xl font-bold text-white">{activeRun.planName}</div>
            <div className="text-sm text-neutral-400">Started {elapsedLabel(activeRun.startedAt)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">Exercises</div>
              <div className="text-lg font-bold text-white">
                {completedExercises}
                {totalExercises ? ` / ${totalExercises}` : ""}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">Completed sets</div>
              <div className="text-lg font-bold text-white">{completedSets}</div>
            </div>
          </div>
          {hasUnsavedSet && (
            <div className="text-xs text-red-500 font-bold">
              Unsaved set restored{currentExName ? ` — ${currentExName}` : ""}
            </div>
          )}
          <button
            onClick={onResumeWorkout}
            className="w-full py-4 text-sm uppercase tracking-widest font-bold border-2 bg-red-700 border-red-700 text-white hover:bg-red-600"
          >
            Resume workout
          </button>
          <button onClick={onDiscardWorkout} className="w-full text-center text-[11px] uppercase tracking-widest text-neutral-600 hover:text-red-500 py-1">
            Discard workout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-red-600">Train</div>
        <div className="text-xl font-bold text-white mt-1">Choose your workout</div>
      </div>

      {programDay && !programDay.isComplete && (
        <div className="border-2 border-red-700 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Current program</div>
          <div className="text-xl font-bold text-white">{programDay.programName}</div>
          <div className="text-sm text-neutral-400">
            {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
            Next: {programDay.dayLabel}
          </div>
          <button
            onClick={() => onStartRun(programDay.plan, programDay.programContext)}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
          >
            Start
          </button>
        </div>
      )}

      <button
        onClick={() => onNavigate("startWorkout")}
        className="w-full py-5 text-base uppercase tracking-widest font-bold border-2 bg-red-700 border-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-2"
      >
        <Play size={20} fill="currentColor" /> Start workout today
      </button>

      <button
        onClick={() => onNavigate("templates")}
        className="w-full flex items-center justify-between border border-neutral-800 bg-charcoal-panel p-4 hover:border-neutral-600"
      >
        <div className="flex items-center gap-3">
          <ClipboardList size={18} className="text-neutral-500" />
          <div className="text-left">
            <div className="text-base font-bold text-white">Programs</div>
            <div className="text-xs text-neutral-500">All plans, hero programs, single-day templates</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-neutral-600 shrink-0" />
      </button>

      <button
        onClick={() => onNavigate("cardio")}
        className="w-full flex items-center justify-between border border-neutral-800 bg-charcoal-panel p-4 hover:border-neutral-600"
      >
        <div className="flex items-center gap-3">
          <Timer size={18} className="text-neutral-500" />
          <div className="text-left">
            <div className="text-base font-bold text-white">Cardio / conditioning</div>
            <div className="text-xs text-neutral-500">Runs, sleds, intervals</div>
          </div>
        </div>
        <ChevronRight size={18} className="text-neutral-600 shrink-0" />
      </button>

      <div className="flex items-center gap-4 pt-2">
        <button onClick={() => onNavigate("build")} className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-red-500 hover:text-red-400">
          <Plus size={14} /> Create plan
        </button>
        <button onClick={() => onNavigate("log")} className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-neutral-500 hover:text-neutral-300">
          <Dumbbell size={14} /> Log a single exercise
        </button>
      </div>
    </div>
  );
}
