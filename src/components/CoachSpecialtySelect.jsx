import React, { useState } from "react";
import { COACH_SPECIALTIES, getSpecialty, isSpecialtyActive } from "../coachSpecialties/index.js";
import { resolveProfile } from "../utils/athleteProfile.js";
import { resolveCoachOnboarding } from "../utils/coachOnboarding.js";

// The dedicated "Select Your Coach" flow (section 1-5, 11 of the spec): pick a specialty, see
// its detail, confirm. Reused for both first-run onboarding (mode="onboarding") and switching
// specialties later from Coach Settings (mode="change") — the same screen either way, so a
// future specialty going live needs no new UI, just its status flipped in the registry.
export default function CoachSpecialtySelect({ state, updateState, mode = "onboarding", onSelectComplete, onCancel }) {
  const profile = resolveProfile(state);
  const currentId = profile.coachSpecialty || "bodybuilding";
  const [pickedId, setPickedId] = useState(currentId);
  const [step, setStep] = useState("pick"); // "pick" | "confirm" | "switchConfirm"

  const picked = getSpecialty(pickedId);
  const interest = state.specialtyInterest || {};
  const wantsPicked = !!interest[pickedId];
  const toggleInterest = () => {
    updateState((prev) => ({ ...prev, specialtyInterest: { ...(prev.specialtyInterest || {}), [pickedId]: !(prev.specialtyInterest || {})[pickedId] } }));
  };

  const persistSelection = (id) => {
    updateState((prev) => ({
      ...prev,
      athleteProfile: { ...resolveProfile(prev), coachSpecialty: id, updatedAt: new Date().toISOString() },
      coachOnboarding: {
        ...resolveCoachOnboarding(prev),
        specialtySelected: true,
        specialty: id,
        confirmedAt: new Date().toISOString(),
      },
    }));
  };

  const handleContinue = () => {
    if (!isSpecialtyActive(pickedId)) return;
    if (mode === "change" && pickedId !== currentId && isSpecialtyActive(pickedId)) {
      setStep("switchConfirm");
      return;
    }
    setStep("confirm");
  };

  const confirmSwitch = () => {
    setStep("confirm");
  };

  const finish = () => {
    persistSelection(pickedId);
    onSelectComplete?.(pickedId);
  };

  if (step === "switchConfirm") {
    const from = getSpecialty(currentId);
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
          <div className="text-xl font-bold text-white mt-1">Change Coach?</div>
        </div>
        <div className="border border-neutral-800 bg-charcoal-panel p-4 flex items-center justify-center gap-3 text-sm">
          <span className="text-neutral-400">{from.label}</span>
          <span className="text-red-600">&rarr;</span>
          <span className="text-white font-bold">{picked.label}</span>
        </div>
        <p className="text-sm text-neutral-400">
          Your workout history, goals, Coach memory, and Athlete Profile will remain intact. Only the coaching methodology will change.
        </p>
        <div className="flex gap-2">
          <button onClick={confirmSwitch} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
            Change
          </button>
          <button onClick={() => setStep("pick")} className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
          <div className="text-xl font-bold text-white mt-1">{picked.label} Coach</div>
          <div className="text-sm text-neutral-500">Selected.</div>
        </div>
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">{picked.subtitle}</div>
          <p className="text-sm text-neutral-300">
            BRK will analyze your training through a {picked.label.toLowerCase()}-focused coaching framework.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">You can change your Coach at any time.</p>
          <p className="text-xs text-neutral-500">Coach &rarr; Settings &rarr; Coach Specialty</p>
        </div>
        <button onClick={finish} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          {mode === "onboarding" ? "Set Up My Coach" : "Done"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
          <div className="text-xl font-bold text-white mt-1">Select Your Coach</div>
        </div>
        {mode === "change" && onCancel && (
          <button onClick={onCancel} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500 shrink-0 mt-1">
            Cancel
          </button>
        )}
      </div>
      <p className="text-sm text-neutral-400">Choose the coaching system BRK will use to analyze your training.</p>
      <p className="text-xs text-neutral-600">Your training history stays with you. You can change your Coach at any time.</p>

      <div>
        <select
          value={pickedId}
          onChange={(e) => setPickedId(e.target.value)}
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-3 text-sm font-bold focus:outline-none focus:border-red-700"
        >
          {COACH_SPECIALTIES.map((sp) => (
            <option key={sp.id} value={sp.id} disabled={sp.status !== "active"}>
              {sp.label}
              {sp.status !== "active" ? " — Coming Soon" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-white uppercase tracking-wide">{picked.label}</div>
          <span
            className={`shrink-0 text-[9px] uppercase tracking-widest px-1.5 py-0.5 ${
              picked.status === "active" ? "bg-red-700 text-white" : "border border-neutral-700 text-neutral-500"
            }`}
          >
            {picked.status === "active" ? "Available" : "Coming Soon"}
          </span>
        </div>
        <div className="text-[11px] uppercase tracking-widest text-neutral-500">{picked.subtitle}</div>
        <p className="text-sm text-neutral-300">{picked.description}</p>
      </div>

      {picked.status === "active" ? (
        <button
          onClick={handleContinue}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
        >
          Continue
        </button>
      ) : (
        <button
          onClick={toggleInterest}
          className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
            wantsPicked ? "bg-red-700 border-red-700 text-white" : "border-red-700 text-red-500 hover:bg-red-950/30"
          }`}
        >
          {wantsPicked ? "You'll be notified" : "Notify me when this launches"}
        </button>
      )}
    </div>
  );
}
