import { useState } from "react";
import { ChevronRight, Check } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import ExerciseAnatomyRow from "./ExerciseAnatomyRow.jsx";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import { programDaysOverview } from "../utils/programSchedule.js";

// Shared by both the Today card and the Train → Current Program card (they each own their own
// open/closed toggle, but render this exact same component) — "one shared swap system," per the
// task, rather than two independently-built pickers. Purely a UI layer: the only state it writes
// is `programDayOverride`, a small additive record (see programSchedule.js's activeOverrideFor)
// that never touches currentProgram.dayIndex, the program's own day data, or workout history.
// Works identically for built-in, frequency-adaptive-family, and user-created custom programs —
// it only ever reads `prog.days`, never anything program-family-specific.
export default function SwapWorkoutSheet({ state, updateState, exMap, onClose }) {
  const overview = programDaysOverview(state);
  const [previewIndex, setPreviewIndex] = useState(null);

  if (!overview) return null; // nothing to swap between — caller already guards on this too

  const commit = (dayIndex) => {
    updateState((prev) => {
      const cp = prev.currentProgram;
      if (!cp) return prev;
      // Picking the day BRK already had planned just clears any existing override rather than
      // storing a redundant one that points at the same place.
      if (dayIndex === cp.dayIndex) return { ...prev, programDayOverride: null };
      return {
        ...prev,
        programDayOverride: { programId: cp.programId, source: cp.source, dayIndex, date: new Date().toISOString().slice(0, 10) },
      };
    });
    onClose();
  };

  if (previewIndex != null) {
    const day = overview.days[previewIndex];
    return (
      <SlideInPanel title="Today's Workout" subtitle={`${overview.programName} — ${day.label}`} onBack={() => setPreviewIndex(null)}>
        <div>
          {day.exercises.map((e, i) => (
            <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => commit(previewIndex)}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
          >
            Use this workout
          </button>
          <button
            onClick={() => setPreviewIndex(null)}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600"
          >
            Cancel
          </button>
        </div>
      </SlideInPanel>
    );
  }

  return (
    <SlideInPanel
      title="Choose Today's Workout"
      subtitle={overview.weekNumber ? `${overview.programName} — Week ${overview.weekNumber}` : overview.programName}
      onBack={onClose}
    >
      <div className="space-y-2">
        {overview.days.map((day) => {
          const previewExercises = day.exercises.slice(0, 3);
          return (
            <button
              key={day.index}
              onClick={() => setPreviewIndex(day.index)}
              className={`w-full text-left border p-3 space-y-2 ${
                day.isToday ? "border-red-700 bg-red-950/10" : "border-neutral-800 bg-charcoal-panel hover:border-neutral-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{day.label}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {day.exerciseCount} exercises · Est. {day.estMinutes} min
                  </div>
                </div>
                <ChevronRight size={16} className="text-neutral-600 shrink-0" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {day.isToday && !day.isPlanned && (
                  <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">Swapped for today</span>
                )}
                {day.isToday && day.isPlanned && (
                  <span className="text-[9px] uppercase tracking-widest bg-red-700 text-white px-1.5 py-0.5">Planned</span>
                )}
                {!day.isToday && day.isPlanned && (
                  <span className="text-[9px] uppercase tracking-widest border border-neutral-700 text-neutral-400 px-1.5 py-0.5">
                    Originally planned
                  </span>
                )}
                {day.completedSession && (
                  <span className="text-[9px] uppercase tracking-widest text-green-500 flex items-center gap-1">
                    <Check size={10} /> Completed{" "}
                    {new Date(day.completedSession.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
              {previewExercises.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {/* A smaller hint size than the "compact" row preset — several of these sit
                      side by side in a list row here, where the goal is a quick muscle-emphasis
                      glance while scanning days, not per-exercise identification. */}
                  {previewExercises.map((e, i) => (
                    <MuscleBodyOutline key={i} exercise={exMap[e.exId]} size={28} />
                  ))}
                  {day.exercises.length > previewExercises.length && (
                    <span className="text-[11px] text-neutral-600">+{day.exercises.length - previewExercises.length} more</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </SlideInPanel>
  );
}
