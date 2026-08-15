import React, { useState } from "react";
import { rollingNutritionAdherence } from "../utils/nutritionAdherence.js";
import { interpretCheckIn } from "../services/nutritionCoachService.js";

const SCALE = [1, 2, 3, 4, 5];
const DIFFICULTY_LABEL = { 1: "Easy", 2: "Manageable", 3: "Required effort", 4: "Very difficult", 5: "Unsustainable" };

function ScaleRow({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">{label}</label>
      <div className="flex gap-1.5">
        {SCALE.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex-1 py-2.5 text-sm font-bold border ${value === n ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// Section 21/22 — short weekly check-in. The difficulty score and "could you repeat this
// another week" question matter as much as the raw adherence number (interpretCheckIn uses
// both together, not adherence alone).
export default function NutritionCheckInScreen({ state, updateState, onBack }) {
  const [hunger, setHunger] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [trainingPerformance, setTrainingPerformance] = useState(3);
  const [difficulty, setDifficulty] = useState(3);
  const [events, setEvents] = useState("");
  const [canRepeat, setCanRepeat] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  const submit = () => {
    const checkIn = {
      id: `nutchk_${Date.now()}`,
      date: new Date().toISOString(),
      hunger,
      energy,
      trainingPerformance,
      difficulty,
      events: events.trim(),
      canRepeat,
    };
    updateState((prev) => ({ ...prev, nutritionCheckIns: [checkIn, ...(prev.nutritionCheckIns || [])] }));
    const adherence = rollingNutritionAdherence(state, 7);
    setSubmitted({ checkIn, message: interpretCheckIn(checkIn, adherence) });
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Check-in saved</div>
        </div>
        {submitted.message && (
          <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-1">
            <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
            <div className="text-sm text-neutral-300 whitespace-pre-line">{submitted.message}</div>
          </div>
        )}
        <button onClick={onBack} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Weekly Check-In</div>
        </div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
          ← Back
        </button>
      </div>

      <ScaleRow label="How was hunger?" value={hunger} onChange={setHunger} />
      <ScaleRow label="How was energy?" value={energy} onChange={setEnergy} />
      <ScaleRow label="How was training performance?" value={trainingPerformance} onChange={setTrainingPerformance} />

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">How hard was this plan to follow?</label>
        <div className="space-y-1.5">
          {SCALE.map((n) => (
            <button
              key={n}
              onClick={() => setDifficulty(n)}
              className={`w-full text-left px-3 py-2.5 border ${difficulty === n ? "border-red-700 bg-red-950/20 text-white" : "border-neutral-800 text-neutral-300 hover:border-neutral-600"}`}
            >
              {n} — {DIFFICULTY_LABEL[n]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Any meals/events that made the plan difficult?</label>
        <input
          type="text"
          value={events}
          onChange={(e) => setEvents(e.target.value)}
          placeholder="Optional"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Could you realistically repeat this another week?</label>
        <div className="flex gap-2">
          <button
            onClick={() => setCanRepeat(true)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border ${canRepeat === true ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"}`}
          >
            Yes
          </button>
          <button
            onClick={() => setCanRepeat(false)}
            className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border ${canRepeat === false ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"}`}
          >
            No
          </button>
        </div>
      </div>

      <button onClick={submit} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
        Submit Check-In
      </button>
    </div>
  );
}
