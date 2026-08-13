import React from "react";
import { ChevronRight, ClipboardList, Timer, Dumbbell, Plus } from "lucide-react";
import { resolveCurrentProgramDay } from "../utils/programSchedule.js";

// Landing/menu for the Train section, ordered Current Program -> My Plans -> Programs so the
// most-used paths don't require a click into a submenu first; full browsing (built-in
// programs, single-day templates, completed programs) and plan creation still live one tap
// deeper, reached via "See all" / "Create plan" rather than shown by default.
export default function TrainTab({ state, onStartRun, onNavigate }) {
  const programDay = resolveCurrentProgramDay(state);
  const myPlans = (state.customPlans || []).slice(0, 3);

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

      {myPlans.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">My plans</div>
          {myPlans.map((p) => (
            <div key={p.id} className="border border-neutral-800 bg-charcoal-panel px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-base text-white truncate">{p.name}</div>
                <div className="text-xs text-neutral-600">{p.exercises.length} exercises</div>
              </div>
              <button
                onClick={() => onStartRun(p)}
                className="shrink-0 ml-3 text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
              >
                <ChevronRight size={12} /> Start
              </button>
            </div>
          ))}
        </div>
      )}

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
