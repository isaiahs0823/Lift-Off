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
      <p className="text-xs text-v5-subtext">
        Training somewhere different today? BRK will treat unfamiliar machines more cautiously and make substitutions/equipment
        selection easier to reach for the rest of this workout.
      </p>

      <div className="space-y-1.5">
        <button
          onClick={setNormal}
          className={`w-full flex items-center gap-2.5 px-3 py-3 text-left border ${
            !isAlternate ? "border-v5-red bg-v5-red/10" : "border-white/10 bg-v5-elevated"
          }`}
        >
          <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${!isAlternate ? "border-red-600" : "border-white/10"}`}>
            {!isAlternate && <span className="w-2 h-2 rounded-full bg-red-600" />}
          </span>
          <span className="text-sm text-v5-text flex-1 truncate">Usual Location</span>
        </button>

        <div className={`border ${isAlternate ? "border-v5-red bg-v5-red/10" : "border-white/10 bg-v5-elevated"}`}>
          <button onClick={setAlternate} className="w-full flex items-center gap-2.5 px-3 py-3 text-left">
            <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isAlternate ? "border-red-600" : "border-white/10"}`}>
              {isAlternate && <span className="w-2 h-2 rounded-full bg-red-600" />}
            </span>
            <span className="text-sm font-bold text-v5-text flex-1 truncate">Training Somewhere Else</span>
            {isAlternate && <Check size={16} className="text-v5-red shrink-0" />}
          </button>
          {isAlternate && (
            <div className="px-3 pb-3">
              <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1">Gym name / location (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => onChange({ locationMode: "alternate_gym", locationLabel: label.trim() || null })}
                placeholder="LA Fitness Tacoma"
                className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
              />
            </div>
          )}
        </div>
      </div>
    </SlideInPanel>
  );
}
