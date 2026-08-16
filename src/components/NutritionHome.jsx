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
          <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
          <div className="text-xl font-bold text-white mt-1">Nutrition Plan</div>
        </div>
        <button onClick={() => setShowAssessment(true)} className="text-neutral-500 hover:text-red-500 p-1" title="Edit nutrition assessment">
          <SettingsIcon size={18} />
        </button>
      </div>

      {!targets ? (
        <div className="border border-amber-900/40 bg-charcoal-panel p-4 text-sm text-amber-500">
          I couldn't calculate real numbers yet — I need age, sex, height, and a logged bodyweight entry. Log a bodyweight in Progress, then revisit the assessment.
        </div>
      ) : (
        <>
          {bbPhaseFraming && <div className="text-xs text-neutral-500 -mb-2">{bbPhaseFraming.text}</div>}
          <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">Today</div>
              <div className="text-sm text-neutral-400">Goal: {CONTROL_LEVEL_LABEL[profile.controlLevel] || "Flexible"}</div>
            </div>
            <div className="text-2xl font-bold text-white">
              {Math.round(totals.calories).toLocaleString()} <span className="text-base font-normal text-neutral-500">/ {targets.calories.toLocaleString()} kcal</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-white">
                  {Math.round(totals.protein)}<span className="text-sm text-neutral-500">/{targets.protein}g</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Protein</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {Math.round(totals.carbs)}<span className="text-sm text-neutral-500">/{targets.carbs}g</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Carbs</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  {Math.round(totals.fat)}<span className="text-sm text-neutral-500">/{targets.fat}g</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">Fat</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onNavigate("nutritionLog")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
                Log Food
              </button>
              <button onClick={() => onNavigate("nutritionScan")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-red-700 hover:text-red-500">
                Scan Food
              </button>
            </div>
            {onAskCoach && (
              <button onClick={onAskCoach} className="w-full py-2 text-[11px] uppercase tracking-widest font-bold text-neutral-500 hover:text-red-500">
                Ask Coach
              </button>
            )}
          </div>

          <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">Estimated maintenance</div>
              <div className="text-sm text-neutral-300">{targets.estimatedMaintenance.toLocaleString()} kcal/day</div>
            </div>
            <div className="text-[11px] text-neutral-600">
              Treated as an estimate — refined from your actual bodyweight trend and adherence over time, not fixed.
            </div>
            <button onClick={() => setShowWhy((s) => !s)} className="text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400">
              {showWhy ? "Hide the math" : "Why these numbers?"}
            </button>
            {showWhy && weightLbs && (
              <div className="text-xs text-neutral-400 space-y-1 pt-1 border-t border-neutral-900">
                <div>Bodyweight used: {weightLbs} lb</div>
                <div>Method: Mifflin-St Jeor resting energy + activity estimate</div>
                <div>Goal adjustment applied for {profile.primaryGoal?.replace("_", " ") || "maintenance"}</div>
                {macroCheck && <div>Macro calories reconcile within {Math.abs(macroCheck.diff)} kcal of target</div>}
              </div>
            )}
          </div>

          <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">7-day nutrition adherence</div>
              <div className="text-lg font-bold text-white">{adherence.pct != null ? `${adherence.pct}%` : "—"}</div>
            </div>
            {adherence.loggedDays > 0 && (
              <div className="text-xs text-neutral-500">
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
              <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-1">
                <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
                <div className="text-sm text-neutral-300 whitespace-pre-line">{diagnosis.message}</div>
              </div>
            )
          )}

          <div className="border border-neutral-800 divide-y divide-neutral-900">
            {profile.controlLevel === "full_plan" && (
              <button onClick={() => onNavigate("nutritionMealPlan")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-panel">
                <span className="text-sm text-neutral-200">Meal Plan</span>
                <ChevronRight size={16} className="text-neutral-600" />
              </button>
            )}
            <button onClick={() => onNavigate("nutritionCheckIn")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-panel">
              <span className="text-sm text-neutral-200">Weekly Check-In</span>
              <ChevronRight size={16} className="text-neutral-600" />
            </button>
            <button onClick={() => onNavigate("nutritionLog")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-panel">
              <span className="text-sm text-neutral-200">Food Log</span>
              <ChevronRight size={16} className="text-neutral-600" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
