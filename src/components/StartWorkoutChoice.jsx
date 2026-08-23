import React from "react";
import { ChevronRight, FilePlus, History } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import { resolveCurrentProgramDay } from "../utils/programSchedule.js";

// The one screen "Start Workout Today" opens — kept to exactly the three paths the redesign
// calls for, in priority order. Never forces the athlete through history/program/exercise
// browsing before they can begin: each option is a single tap away from actually training.
export default function StartWorkoutChoice({ state, onStartRun, onRepeatRecent, onBack }) {
  const programDay = resolveCurrentProgramDay(state);
  const hasProgram = programDay && !programDay.isComplete;

  return (
    <SlideInPanel title="Start workout" onBack={onBack}>
      {hasProgram && (
        <div className="border-2 border-red-700 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Current program</div>
          <div className="text-xl font-bold text-white">{programDay.programName}</div>
          <div className="text-sm text-neutral-400">
            {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
            {programDay.dayLabel}
          </div>
          <button
            onClick={() => onStartRun(programDay.plan, programDay.programContext)}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
          >
            Start programmed workout
          </button>
        </div>
      )}

      <button
        onClick={() => onStartRun({ name: "Workout Today", exercises: [], source: "blank" })}
        className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 hover:border-red-700 flex items-center gap-3"
      >
        <FilePlus size={20} className="text-red-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-white">Blank workout</div>
          <div className="text-xs text-neutral-500 mt-0.5">Start with an empty workout and add exercises as you go.</div>
        </div>
        <ChevronRight size={18} className="text-neutral-600 shrink-0" />
      </button>

      <button
        onClick={onRepeatRecent}
        className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 hover:border-neutral-600 flex items-center gap-3"
      >
        <History size={20} className="text-neutral-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-white">Repeat recent workout</div>
          <div className="text-xs text-neutral-500 mt-0.5">Start from a workout you completed before.</div>
        </div>
        <ChevronRight size={18} className="text-neutral-600 shrink-0" />
      </button>
    </SlideInPanel>
  );
}
