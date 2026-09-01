import React, { useState } from "react";
import { ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { hasNutritionProfile, resolveNutritionProfile, dailyTotals, todayDateKey, CONTROL_LEVEL_LABEL } from "../utils/nutrition.js";
import { currentBodyweightLbs, macroCalorieCheck } from "../utils/nutritionMath.js";
import { rollingNutritionAdherence } from "../utils/nutritionAdherence.js";
import { diagnoseNutrition, generateAdjustmentProposal, applyAdjustment } from "../services/nutritionCoachService.js";
import { nutritionPhaseFraming } from "../coachSpecialties/bodybuilding.js";
import NutritionAssessmentForm from "./NutritionAssessmentForm.jsx";
import NutritionAdjustmentCard from "./NutritionAdjustmentCard.jsx";

// Coach's "Nutrition Plan" destination (section 1/42). Gates to the conversational assessment
// exactly once, the same pattern CoachTab.jsx uses for Athlete Profile — after that, this is
// the daily home: targets, today's totals, adherence, and Coach's read on whether the plan or
// the execution is the actual issue.
export default function NutritionHome({ state, updateState, onNavigate, onAskCoach }) {
  const [showAssessment, setShowAssessment] = useState(!hasNutritionProfile(state));
  const [showWhy, setShowWhy] = useState(false);
  const [adjustmentResolved, setAdjustmentResolved] = useState(false);

  if (showAssessment) {
    return <NutritionAssessmentForm state={state} updateState={updateState} onDone={() => setShowAssessment(false)} />;
  }

  const profile = resolveNutritionProfile(state);
  const targets = state.nutritionTargets;
  const weightLbs = currentBodyweightLbs(state);
  const totals = dailyTotals(state.foodLogs, todayDateKey());
  const adherence = rollingNutritionAdherence(state, 7);
  const diagnosis = diagnoseNutrition(state);
  const macroCheck = targets ? macroCalorieCheck(targets) : null;
  // Section 38 — the Bodybuilding Coach reads nutrition data through the athlete's physique
  // phase (Athlete Profile, not the nutrition assessment itself — one source of truth for
  // phase, same as the training side).
  const bbPhaseFraming = state.athleteProfile?.coachSpecialty === "bodybuilding" ? nutritionPhaseFraming(state.athleteProfile?.physiquePhase) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Coach</div>
          <div className="text-xl font-bold text-white mt-1">Nutrition Plan</div>
        </div>
        <button onClick={() => setShowAssessment(true)} className="text-v5-subtext hover:text-v5-red p-1" title="Edit nutrition assessment">
          <SettingsIcon size={18} />
        </button>
      </div>

      {!targets ? (
        <div className="border border-amber-900/40 bg-v5-elevated p-4 text-sm text-amber-500">
          I couldn't calculate real numbers yet — I need age, sex, height, and a logged bodyweight entry. Log a bodyweight in Progress, then revisit the assessment.
        </div>
      ) : (
        <>
          {bbPhaseFraming && <div className="text-xs text-v5-subtext -mb-2">{bbPhaseFraming.text}</div>}
          <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Today</div>
              <div className="text-sm text-v5-subtext">Goal: {CONTROL_LEVEL_LABEL[profile.controlLevel] || "Flexible"}</div>
            </div>
            <div className="text-2xl font-bold text-white">
              {Math.round(totals.calories).toLocaleString()} <span className="text-base font-normal text-v5-subtext">/ {targets.calories.toLocaleString()} kcal</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-white">
                  {Math.round(totals.protein)}<span className="text-sm text-v5-subtext">/{targets.protein}g</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Protein</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {Math.round(totals.carbs)}<span className="text-sm text-v5-subtext">/{targets.carbs}g</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Carbs</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {Math.round(totals.fat)}<span className="text-sm text-v5-subtext">/{targets.fat}g</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Fat</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onNavigate("nutritionLog")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
                Log Food
              </button>
              <button onClick={() => onNavigate("nutritionScan")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red">
                Scan Food
              </button>
            </div>
            {onAskCoach && (
              <button onClick={onAskCoach} className="w-full py-2 text-[11px] uppercase tracking-widest font-bold text-v5-subtext hover:text-v5-red">
                Ask Coach
              </button>
            )}
          </div>

          <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Estimated maintenance</div>
              <div className="text-sm text-v5-text/90">{targets.estimatedMaintenance.toLocaleString()} kcal/day</div>
            </div>
            <div className="text-[11px] text-v5-subtext/70">
              Treated as an estimate — refined from your actual bodyweight trend and adherence over time, not fixed.
            </div>
            <button onClick={() => setShowWhy((s) => !s)} className="text-[11px] uppercase tracking-widest text-v5-red hover:text-v5-red">
              {showWhy ? "Hide the math" : "Why these numbers?"}
            </button>
            {showWhy && weightLbs && (
              <div className="text-xs text-v5-subtext space-y-1 pt-1 border-t border-white/[0.06]">
                <div>Bodyweight used: {weightLbs} lb</div>
                <div>Method: Mifflin-St Jeor resting energy + activity estimate</div>
                <div>Goal adjustment applied for {profile.primaryGoal?.replace("_", " ") || "maintenance"}</div>
                {macroCheck && <div>Macro calories reconcile within {Math.abs(macroCheck.diff)} kcal of target</div>}
              </div>
            )}
          </div>

          <div className="border border-white/10 bg-v5-elevated p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">7-day nutrition adherence</div>
              <div className="text-lg font-bold text-white">{adherence.pct != null ? `${adherence.pct}%` : "—"}</div>
            </div>
            {adherence.loggedDays > 0 && (
              <div className="text-xs text-v5-subtext">
                {adherence.onPlanDays} of {adherence.loggedDays} logged days on plan · avg {adherence.avgCalories} kcal, {adherence.avgProtein}g protein
              </div>
            )}
          </div>

          {diagnosis && diagnosis.kind === "target_needs_adjustment" && !adjustmentResolved ? (
            <NutritionAdjustmentCard
              proposal={generateAdjustmentProposal(state)}
              onResolve={(proposal, action, modifiedCalories) => {
                const patch = applyAdjustment(state, proposal, action, modifiedCalories);
                updateState((prev) => ({ ...prev, ...patch }));
                setAdjustmentResolved(true);
              }}
            />
          ) : (
            diagnosis && (
              <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-1">
                <div className="text-[11px] uppercase tracking-widest text-v5-red">Coach</div>
                <div className="text-sm text-v5-text/90 whitespace-pre-line">{diagnosis.message}</div>
              </div>
            )
          )}

          <div className="border border-white/10 divide-y divide-neutral-900">
            {profile.controlLevel === "full_plan" && (
              <button onClick={() => onNavigate("nutritionMealPlan")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-v5-elevated">
                <span className="text-sm text-v5-text/90">Meal Plan</span>
                <ChevronRight size={16} className="text-v5-subtext/70" />
              </button>
            )}
            <button onClick={() => onNavigate("nutritionCheckIn")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-v5-elevated">
              <span className="text-sm text-v5-text/90">Weekly Check-In</span>
              <ChevronRight size={16} className="text-v5-subtext/70" />
            </button>
            <button onClick={() => onNavigate("nutritionLog")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-v5-elevated">
              <span className="text-sm text-v5-text/90">Food Log</span>
              <ChevronRight size={16} className="text-v5-subtext/70" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
