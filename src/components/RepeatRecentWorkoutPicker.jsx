import React from "react";
import { ChevronRight } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";

const RECENT_LIMIT = 15;

// Its own flow, deliberately separate from Blank Workout — the athlete picks a completed
// session here (once), and everything downstream (the new run's exercise list) is derived
// from it; nothing about the prior session itself is touched, and the new run gets its own
// independent sets/history/progression from that point on.
export default function RepeatRecentWorkoutPicker({ state, onStartRun, onBack }) {
  const sessions = (state.workoutSessions || [])
    .filter((s) => (s.entries || []).length > 0)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .slice(0, RECENT_LIMIT);

  const repeat = (session) => {
    const exercises = session.entries.map((e) => ({
      exId: e.exId,
      sets: e.sets.length,
      reps: e.targetReps || e.sets[0]?.reps || 8,
    }));
    onStartRun({ name: session.planName, exercises, source: "repeated" });
  };

  return (
    <SlideInPanel title="Repeat recent workout" subtitle="Starts a new session with the same exercises" onBack={onBack}>
      {sessions.length === 0 ? (
        <div className="text-sm text-neutral-500 py-6 text-center">No completed workouts yet.</div>
      ) : (
        <div className="space-y-1.5">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => repeat(s)}
              className="w-full text-left border border-neutral-800 bg-charcoal-panel px-4 py-3 hover:border-red-700 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-base text-white truncate">{s.planName}</div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {new Date(s.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {s.mainMuscles?.length > 0 ? ` · ${s.mainMuscles.join(", ")}` : ""} · {s.exerciseCount} exercise
                  {s.exerciseCount === 1 ? "" : "s"}
                </div>
              </div>
              <ChevronRight size={16} className="text-neutral-600 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </SlideInPanel>
  );
}
