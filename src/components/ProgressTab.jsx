import React, { useState } from "react";
import BodyweightTab from "./BodyweightTab.jsx";
import TrainingCalendar from "./TrainingCalendar.jsx";

// Thin wrapper: bodyweight/physique dashboard and the training calendar share a top-level
// "Progress" tab via a segmented control, rather than each claiming its own slot in an
// already-long nav bar.
export default function ProgressTab({ state, updateState, exMap }) {
  const [view, setView] = useState("body");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setView("body")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
            view === "body" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
            view === "calendar" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
          }`}
        >
          Calendar
        </button>
      </div>
      {view === "body" ? <BodyweightTab state={state} updateState={updateState} /> : <TrainingCalendar state={state} exMap={exMap} />}
    </div>
  );
}
