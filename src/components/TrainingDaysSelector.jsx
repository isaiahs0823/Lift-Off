import { useState } from "react";

// Chip selector for "how many days per week can you realistically train" — reused by the athlete
// profile form (onboarding + editing) and by the program-picker's frequency-aware recommendation
// flow, so both places save/read the exact same value (athleteProfile.preferredDays) the exact
// same way. 7 is deliberately not a peer chip: BRK doesn't want to nudge anyone toward daily
// resistance training, so it's tucked behind an explicit "advanced" reveal with its own warning
// copy, per spec.
const STANDARD_DAYS = [2, 3, 4, 5, 6];

export default function TrainingDaysSelector({ value, onChange, label = "How many days per week can you realistically train?" }) {
  const [advancedOpen, setAdvancedOpen] = useState(value === 7);

  return (
    <div>
      {label && <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">{label}</label>}
      <div className="grid grid-cols-5 gap-1.5">
        {STANDARD_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={value === d}
            className={`py-2.5 text-sm font-bold border ${
              value === d ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {value != null && (
        <div className="text-[11px] text-v5-subtext mt-1.5">
          Selected: <span className="text-v5-text/90 font-bold">{value} day{value === 1 ? "" : "s"}</span>
        </div>
      )}

      {!advancedOpen ? (
        <button type="button" onClick={() => setAdvancedOpen(true)} className="text-[11px] text-v5-subtext/70 hover:text-v5-subtext mt-1 py-2 -mx-1 px-1">
          Train 7 days? (advanced)
        </button>
      ) : (
        <div className="mt-2 space-y-1.5 border border-amber-900/40 bg-amber-950/10 px-3 py-2">
          <button
            type="button"
            onClick={() => onChange(7)}
            aria-pressed={value === 7}
            className={`text-xs font-bold uppercase tracking-wide px-2.5 py-2 border ${
              value === 7 ? "bg-amber-700 border-amber-700 text-white" : "border-amber-800 text-amber-500 hover:border-amber-600"
            }`}
          >
            7 days
          </button>
          <p className="text-[11px] text-amber-600/90">
            Not recommended as a standard target — seven hard resistance-training days leaves no dedicated recovery. BRK will build in
            recovery/active-recovery days rather than seven straight training sessions.
          </p>
        </div>
      )}
    </div>
  );
}
