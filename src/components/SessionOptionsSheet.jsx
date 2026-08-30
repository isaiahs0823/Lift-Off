import { useState } from "react";
import { Check } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";

// Travel/Alternate Gym mode (task Part 3, section 17-18) — one lightweight, whole-session
// control reached from Active Workout → Session Options. Deliberately not GPS-based ("keep it
// manual and reliable," same rule Equipment Profiles already follows) — the athlete just says
// "I'm training somewhere different today," optionally names it, and BRK treats unfamiliar
// machines more cautiously for the rest of this session (see TrainingExerciseCard's alternate-
// gym nudge and workoutRecap.js's "ALTERNATE GYM SESSION" note).
export default function SessionOptionsSheet({ sessionContext, onChange, onBack }) {
  const [label, setLabel] = useState(sessionContext?.locationLabel || "");
  const isAlternate = sessionContext?.locationMode === "alternate_gym";

  const setNormal = () => onChange({ locationMode: "normal", locationLabel: null });
  const setAlternate = () => onChange({ locationMode: "alternate_gym", locationLabel: label.trim() || null });

  return (
    <SlideInPanel title="Session Options" subtitle="Training location" onBack={onBack}>
      <p className="text-xs text-neutral-500">
        Training somewhere different today? BRK will treat unfamiliar machines more cautiously and make substitutions/equipment
        selection easier to reach for the rest of this workout.
      </p>

      <div className="space-y-1.5">
        <button
          onClick={setNormal}
          className={`w-full flex items-center gap-2.5 px-3 py-3 text-left border ${
            !isAlternate ? "border-red-700 bg-red-950/10" : "border-neutral-800 bg-charcoal-panel"
          }`}
        >
          <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${!isAlternate ? "border-red-600" : "border-neutral-700"}`}>
            {!isAlternate && <span className="w-2 h-2 rounded-full bg-red-600" />}
          </span>
          <span className="text-sm text-neutral-100 flex-1 truncate">Home Gym</span>
        </button>

        <div className={`border ${isAlternate ? "border-red-700 bg-red-950/10" : "border-neutral-800 bg-charcoal-panel"}`}>
          <button onClick={setAlternate} className="w-full flex items-center gap-2.5 px-3 py-3 text-left">
            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isAlternate ? "border-red-600" : "border-neutral-700"}`}>
              {isAlternate && <span className="w-2 h-2 rounded-full bg-red-600" />}
            </span>
            <span className="text-sm font-bold text-neutral-100 flex-1 truncate">Training somewhere else</span>
            {isAlternate && <Check size={16} className="text-red-500 shrink-0" />}
          </button>
          {isAlternate && (
            <div className="px-3 pb-3">
              <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Gym name / location (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => onChange({ locationMode: "alternate_gym", locationLabel: label.trim() || null })}
                placeholder="LA Fitness Tacoma"
                className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
              />
            </div>
          )}
        </div>
      </div>
    </SlideInPanel>
  );
}
