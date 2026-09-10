import React, { useState } from "react";
import { Settings as SettingsIcon, Apple } from "lucide-react";
import { hasNutritionProfile, resolveNutritionProfile, dailyTotals, todayDateKey, CONTROL_LEVEL_LABEL } from "../utils/nutrition.js";
import { currentBodyweightLbs, macroCalorieCheck, missingNutritionFields, formatMissingFieldsList } from "../utils/nutritionMath.js";
import { rollingNutritionAdherence } from "../utils/nutritionAdherence.js";
import { diagnoseNutrition, generateAdjustmentProposal, applyAdjustment } from "../services/nutritionCoachService.js";
import { mealMacroDistribution, foodGuidanceCategories } from "../utils/mealPlanGenerator.js";
import { nutritionPhaseFraming } from "../coachSpecialties/bodybuilding.js";
import { NUTRITION_FOOD_LOGGING_ENABLED } from "../utils/nutritionFeatureFlags.js";
import NutritionAssessmentForm from "./NutritionAssessmentForm.jsx";
import NutritionQuickWeightCapture from "./NutritionQuickWeightCapture.jsx";
import NutritionAdjustmentCard from "./NutritionAdjustmentCard.jsx";
import { ScreenHeader, SectionLabel, Card, HeroCard, ButtonPrimary, ButtonSecondary, ButtonText, StatTile, ListRow, Divider, EmptyState } from "./ui/Kit.jsx";

// Coach's "Nutrition Plan" destination (section 1/42). Gates to the conversational assessment
// exactly once, the same pattern CoachTab.jsx uses for Athlete Profile — after that, this is
// the daily home. v1 scope cut: with food logging hidden (NUTRITION_FOOD_LOGGING_ENABLED),
// this is a planning surface — targets, meal structure, the recommended meal plan, and food
// guidance — rather than a logged-intake dashboard; today's-totals/adherence/Log-Food pieces
// stay in the code, gated behind the flag, ready to come back once the food database is solid.
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

  // A pure numeric meal-macro split for the "Meal Structure" summary below — always reconciles
  // exactly to the real daily targets (see mealMacroDistribution's own comment). The deeper
  // "Recommended Meal Plan" section links to MealPlanView, which builds real curated-food meals
  // via generateMealPlan and owns saving/regenerating that plan.
  const mealDistribution = targets ? mealMacroDistribution(profile, targets) : null;
  const guidance = targets ? foodGuidanceCategories(profile) : null;

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
        (() => {
          const missing = missingNutritionFields(profile, weightLbs);
          // The one field newer to the assessment than everything else it asks for — an athlete
          // who already has age/height on file just needs that single number, not a re-run of
          // the whole multi-step assessment (section 7: existing-user fallback).
          const onlyMissingWeight = missing.length === 1 && missing[0].key === "weight";
          return onlyMissingWeight ? (
            <NutritionQuickWeightCapture state={state} updateState={updateState} />
          ) : (
            <EmptyState
              icon={Apple}
              title="Setup isn't finished yet"
              body={
                missing.length
                  ? `We still need ${formatMissingFieldsList(missing)} to calculate your targets.`
                  : "Your targets need to be recalculated — reopen the assessment to refresh them."
              }
              action={
                <ButtonPrimary onClick={() => setShowAssessment(true)} fullWidth={false}>
                  Complete Assessment
                </ButtonPrimary>
              }
            />
          );
        })()
      ) : (
        <>
          {bbPhaseFraming && <div className="text-xs text-v5-subtext -mb-2">{bbPhaseFraming.text}</div>}

          <HeroCard>
            <div className="flex items-center justify-between">
              <SectionLabel>Daily Target</SectionLabel>
              <div className="text-sm text-v5-subtext">Goal: {CONTROL_LEVEL_LABEL[profile.controlLevel] || "Flexible"}</div>
            </div>
            {NUTRITION_FOOD_LOGGING_ENABLED ? (
              <div className="text-2xl font-black text-v5-text">
                {Math.round(totals.calories).toLocaleString()} <span className="text-base font-normal text-v5-subtext">/ {targets.calories.toLocaleString()} kcal</span>
              </div>
            ) : (
              <div className="text-2xl font-black text-v5-text">
                {targets.calories.toLocaleString()} <span className="text-base font-normal text-v5-subtext">kcal / day</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 text-center">
              <StatTile
                value={NUTRITION_FOOD_LOGGING_ENABLED ? <>{Math.round(totals.protein)}<span className="text-sm text-v5-subtext">/{targets.protein}g</span></> : `${targets.protein}g`}
                label="Protein"
                className="mx-auto"
              />
              <StatTile
                value={NUTRITION_FOOD_LOGGING_ENABLED ? <>{Math.round(totals.carbs)}<span className="text-sm text-v5-subtext">/{targets.carbs}g</span></> : `${targets.carbs}g`}
                label="Carbs"
                className="mx-auto"
              />
              <StatTile
                value={NUTRITION_FOOD_LOGGING_ENABLED ? <>{Math.round(totals.fat)}<span className="text-sm text-v5-subtext">/{targets.fat}g</span></> : `${targets.fat}g`}
                label="Fat"
                className="mx-auto"
              />
            </div>
            {NUTRITION_FOOD_LOGGING_ENABLED && (
              <div className="flex gap-2">
                <ButtonPrimary onClick={() => onNavigate("nutritionLog")} className="flex-1">
                  Log Food
                </ButtonPrimary>
                <ButtonSecondary onClick={() => onNavigate("nutritionScan")} className="flex-1">
                  Scan Food
                </ButtonSecondary>
              </div>
            )}
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
              Treated as an estimate — refined from your actual bodyweight trend over time, not fixed.
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

          {/* Meal Structure — a pure numeric split of the daily target across meals (no food
              items), so it always reconciles exactly back to the target above. Recommended Meal
              Plan below is the place for concrete example foods. */}
          {mealDistribution && mealDistribution.meals?.length > 0 && (
            <Card className="space-y-3">
              <SectionLabel tone="muted">Meal Structure</SectionLabel>
              <div className="text-[11px] text-v5-subtext/70 -mt-2">How today's target splits across meals.</div>
              <div className="space-y-2">
                {mealDistribution.meals.map((meal) => (
                  <div key={meal.label} className="flex items-center justify-between text-sm border-t border-white/[0.06] pt-2 first:border-t-0 first:pt-0">
                    <div>
                      <div className="text-v5-text/90 font-bold">{meal.label}</div>
                      {meal.time && <div className="text-[11px] text-v5-subtext/70">{meal.time}</div>}
                    </div>
                    <div className="text-xs text-v5-subtext text-right">
                      {meal.calories} cal · {meal.protein}g protein
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <ListRow title="Recommended Meal Plan" subtitle="Sample meals built from your targets, with swaps" onClick={() => onNavigate("nutritionMealPlan")} />

          {/* Food Guidance — protein/carb/fat source lists from the same curated list, filtered
              by the athlete's stated restrictions/allergies. Educational, not logging. */}
          {guidance && (
            <Card className="space-y-3">
              <SectionLabel tone="muted">Food Guidance</SectionLabel>
              <FoodGuidanceRow label="Protein sources" items={guidance.protein} />
              <FoodGuidanceRow label="Carb sources" items={guidance.carb} />
              <FoodGuidanceRow label="Fat sources" items={guidance.fat} />
            </Card>
          )}

          {NUTRITION_FOOD_LOGGING_ENABLED && (
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
          )}

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
            <SectionLabel tone="muted">Plan Settings</SectionLabel>
            <ListRow title="Edit Assessment" subtitle="Goals, activity, bodyweight, preferences" onClick={() => setShowAssessment(true)} />
            <ListRow title="Weekly Check-In" onClick={() => onNavigate("nutritionCheckIn")} />
            {NUTRITION_FOOD_LOGGING_ENABLED && <ListRow title="Food Log" onClick={() => onNavigate("nutritionLog")} />}
          </div>
        </>
      )}
    </div>
  );
}

function FoodGuidanceRow({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((name) => (
          <span key={name} className="px-2.5 py-1 text-xs border border-white/10 text-v5-text/90 bg-v5-surface">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
