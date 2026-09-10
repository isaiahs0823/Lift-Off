import React, { useState } from "react";
import { resolveNutritionProfile } from "../utils/nutrition.js";
import { buildNutritionAssessmentPatch } from "../utils/nutritionMath.js";
import { upsertBodyweightEntry, isValidBodyweightLb, BODYWEIGHT_MIN_LB, BODYWEIGHT_MAX_LB } from "../utils/bodyweightMath.js";
import { Card, SectionLabel, ButtonPrimary } from "./ui/Kit.jsx";

// The "existing user, missing only bodyweight" path (section 7 of the nutrition-onboarding
// fix): an athlete who completed the assessment before bodyweight was part of it. Asking them
// to re-run the full multi-step assessment just to supply one number is the same dead-end
// friction this fix removes elsewhere — so this is a single-field capture that writes straight
// into bodyweightLogs (the same one-source-of-truth path the full assessment and Progress use)
// and recalculates targets immediately, without touching any of their other saved answers.
export default function NutritionQuickWeightCapture({ state, updateState }) {
  const [weight, setWeight] = useState("");
  const weightNum = weight !== "" ? Number(weight) : null;
  const error = weightNum != null && !isValidBodyweightLb(weightNum);
  const canSubmit = weightNum != null && !error;

  const submit = () => {
    if (!canSubmit) return;
    const profile = resolveNutritionProfile(state);
    updateState((prev) => ({
      ...prev,
      ...buildNutritionAssessmentPatch(prev, profile, weightNum, "Added missing bodyweight"),
      bodyweightLogs: upsertBodyweightEntry(prev.bodyweightLogs || [], { weight: weightNum }),
      hasSeenOnboarding: true,
    }));
  };

  return (
    <Card className="space-y-3 border border-v5-red/25">
      <SectionLabel>One more thing</SectionLabel>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Current bodyweight (lb)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={BODYWEIGHT_MIN_LB}
          max={BODYWEIGHT_MAX_LB}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="e.g. 217"
          className={`w-full bg-v5-elevated border text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red ${
            error ? "border-v5-red" : "border-white/10"
          }`}
        />
        <p className={`text-[11px] mt-1 ${error ? "text-v5-red" : "text-v5-subtext/70"}`}>
          {error ? `Enter a weight between ${BODYWEIGHT_MIN_LB} and ${BODYWEIGHT_MAX_LB} lb.` : "This becomes your starting bodyweight entry in Progress too."}
        </p>
      </div>
      <ButtonPrimary onClick={submit} disabled={!canSubmit}>
        Calculate my targets
      </ButtonPrimary>
    </Card>
  );
}
