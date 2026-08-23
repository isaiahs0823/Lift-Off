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
        <div className="bg-v5-surface rounded-2xl p-5 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Current program</div>
          <div className="text-xl font-bold text-v5-text">{programDay.programName}</div>
          <div className="text-sm text-v5-subtext">
            {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
            {programDay.dayLabel}
          </div>
          <button
            onClick={() => onStartRun(programDay.plan, programDay.programContext)}
            className="w-full py-3.5 rounded-xl text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:opacity-90"
          >
            Start programmed workout
          </button>
        </div>
      )}

      <button
        onClick={() => onStartRun({ name: "Workout Today", exercises: [], source: "blank" })}
        className="w-full text-left bg-v5-surface rounded-2xl p-5 hover:bg-v5-elevated flex items-center gap-3"
      >
        <FilePlus size={20} className="text-v5-red shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-v5-text">Blank workout</div>
          <div className="text-xs text-v5-subtext mt-0.5">Start with an empty workout and add exercises as you go.</div>
        </div>
        <ChevronRight size={18} className="text-v5-subtext shrink-0" />
      </button>

      <button
        onClick={onRepeatRecent}
        className="w-full text-left bg-v5-surface rounded-2xl p-5 hover:bg-v5-elevated flex items-center gap-3"
      >
        <History size={20} className="text-v5-subtext shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold text-v5-text">Repeat recent workout</div>
          <div className="text-xs text-v5-subtext mt-0.5">Start from a workout you completed before.</div>
        </div>
        <ChevronRight size={18} className="text-v5-subtext shrink-0" />
      </button>
    </SlideInPanel>
  );
}
