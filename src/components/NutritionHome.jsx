import React, { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { hasNutritionProfile, resolveNutritionProfile, dailyTotals, todayDateKey, CONTROL_LEVEL_LABEL } from "../utils/nutrition.js";
import { currentBodyweightLbs, macroCalorieCheck } from "../utils/nutritionMath.js";
import { rollingNutritionAdherence } from "../utils/nutritionAdherence.js";
import { diagnoseNutrition, generateAdjustmentProposal, applyAdjustment } from "../services/nutritionCoachService.js";
import { nutritionPhaseFraming } from "../coachSpecialties/bodybuilding.js";
import NutritionAssessmentForm from "./NutritionAssessmentForm.jsx";
import NutritionAdjustmentCard from "./NutritionAdjustmentCard.jsx";
import { ScreenHeader, SectionLabel, Card, HeroCard, ButtonPrimary, ButtonSecondary, ButtonText, StatTile, ListRow, Divider } from "./ui/Kit.jsx";

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
    <div className="space-y-5">
      <ScreenHeader
        eyebrow="Coach"
        title="Nutrition Plan"
        right={
          <button onClick={() => setShowAssessment(true)} className="text-v5-subtext hover:text-v5-red p-1" title="Edit nutrition assessment">
            <SettingsIcon size={18} />
          </button>
        }
      />

      {!targets ? (
        <Card className="border border-amber-900/40">
          <span className="text-sm text-amber-500">
            I couldn't calculate real numbers yet — I need age, sex, height, and a logged bodyweight entry. Log a bodyweight in Progress, then revisit
            the assessment.
          </span>
        </Card>
      ) : (
        <>
          {bbPhaseFraming && <div className="text-xs text-v5-subtext -mb-2">{bbPhaseFraming.text}</div>}

          <HeroCard>
            <div className="flex items-center justify-between">
              <SectionLabel>Today</SectionLabel>
              <div className="text-sm text-v5-subtext">Goal: {CONTROL_LEVEL_LABEL[profile.controlLevel] || "Flexible"}</div>
            </div>
            <div className="text-2xl font-black text-v5-text">
              {Math.round(totals.calories).toLocaleString()} <span className="text-base font-normal text-v5-subtext">/ {targets.calories.toLocaleString()} kcal</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <StatTile value={<>{Math.round(totals.protein)}<span className="text-sm text-v5-subtext">/{targets.protein}g</span></>} label="Protein" className="mx-auto" />
              <StatTile value={<>{Math.round(totals.carbs)}<span className="text-sm text-v5-subtext">/{targets.carbs}g</span></>} label="Carbs" className="mx-auto" />
              <StatTile value={<>{Math.round(totals.fat)}<span className="text-sm text-v5-subtext">/{targets.fat}g</span></>} label="Fat" className="mx-auto" />
            </div>
            <div className="flex gap-2">
              <ButtonPrimary onClick={() => onNavigate("nutritionLog")} className="flex-1">
                Log Food
              </ButtonPrimary>
              <ButtonSecondary onClick={() => onNavigate("nutritionScan")} className="flex-1">
                Scan Food
              </ButtonSecondary>
            </div>
            {onAskCoach && (
              <ButtonText tone="muted" onClick={onAskCoach} className="w-full py-1 justify-center">
                Ask Coach
              </ButtonText>
            )}
          </HeroCard>

          <Card className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel tone="muted">Estimated maintenance</SectionLabel>
              <div className="text-sm text-v5-text/90">{targets.estimatedMaintenance.toLocaleString()} kcal/day</div>
            </div>
            <div className="text-[11px] text-v5-subtext/70">
              Treated as an estimate — refined from your actual bodyweight trend and adherence over time, not fixed.
            </div>
            <ButtonText onClick={() => setShowWhy((s) => !s)}>{showWhy ? "Hide the math" : "Why these numbers?"}</ButtonText>
            {showWhy && weightLbs && (
              <>
                <Divider />
                <div className="text-xs text-v5-subtext space-y-1">
                  <div>Bodyweight used: {weightLbs} lb</div>
                  <div>Method: Mifflin-St Jeor resting energy + activity estimate</div>
                  <div>Goal adjustment applied for {profile.primaryGoal?.replace("_", " ") || "maintenance"}</div>
                  {macroCheck && <div>Macro calories reconcile within {Math.abs(macroCheck.diff)} kcal of target</div>}
                </div>
              </>
            )}
          </Card>

          <Card className="space-y-1">
            <div className="flex items-center justify-between">
              <SectionLabel tone="muted">7-day nutrition adherence</SectionLabel>
              <div className="text-lg font-bold text-v5-text">{adherence.pct != null ? `${adherence.pct}%` : "—"}</div>
            </div>
            {adherence.loggedDays > 0 && (
              <div className="text-xs text-v5-subtext">
                {adherence.onPlanDays} of {adherence.loggedDays} logged days on plan · avg {adherence.avgCalories} kcal, {adherence.avgProtein}g protein
              </div>
            )}
          </Card>

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
              <Card tone="accent" className="space-y-1">
                <SectionLabel>Coach</SectionLabel>
                <div className="text-sm text-v5-text/90 whitespace-pre-line">{diagnosis.message}</div>
              </Card>
            )
          )}

          <div className="space-y-2">
            {profile.controlLevel === "full_plan" && <ListRow title="Meal Plan" onClick={() => onNavigate("nutritionMealPlan")} />}
            <ListRow title="Weekly Check-In" onClick={() => onNavigate("nutritionCheckIn")} />
            <ListRow title="Food Log" onClick={() => onNavigate("nutritionLog")} />
          </div>
        </>
      )}
    </div>
  );
}
