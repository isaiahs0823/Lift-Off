import React, { useState } from "react";
import BodyweightTab from "./BodyweightTab.jsx";
import TrainingCalendar from "./TrainingCalendar.jsx";
import AnalyticsTab from "./AnalyticsTab.jsx";

const VIEWS = [
  { id: "body", label: "Body" },
  { id: "calendar", label: "Calendar" },
  { id: "analytics", label: "Analytics" },
];

// Thin wrapper: bodyweight/physique dashboard, training calendar, and performance analytics
// share a top-level "Progress" tab via a segmented control, rather than each claiming its own
// slot in an already-long nav bar.
export default function ProgressTab({ state, updateState, allExercises, exMap }) {
  const [view, setView] = useState("body");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
              view === v.id ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "body" && <BodyweightTab state={state} updateState={updateState} />}
      {view === "calendar" && <TrainingCalendar state={state} exMap={exMap} />}
      {view === "analytics" && <AnalyticsTab state={state} allExercises={allExercises} exMap={exMap} />}
    </div>
  );
}
