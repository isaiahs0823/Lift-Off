import React from "react";
import { ChevronRight } from "lucide-react";
import { hasNutritionProfile, dailyTotals, todayDateKey } from "../utils/nutrition.js";
import { Card, SectionLabel, ButtonPrimary, ButtonSecondary, ProgressBar } from "./ui/Kit.jsx";

// Today-dashboard card (nutrition spec section 1/16). Before Nutrition is set up, this is just
// an invitation — never a wall of empty macro bars that reads as broken. `compact` drops the
// carbs/fat breakdown and the second button so this fits cleanly as one half of a paired
// Nutrition/Coach Brief row (task: "if 2-column content becomes cramped at 375px, stack instead"
// — dropping down to one metric + one CTA is what keeps it from cramping in the first place).
export default function NutritionCard({ state, onNavigate, compact = false }) {
  if (!hasNutritionProfile(state) || !state.nutritionTargets) {
    return (
      <Card onClick={() => onNavigate("nutrition")}>
        <SectionLabel>Nutrition</SectionLabel>
        <div className="text-sm text-v5-subtext mt-1">{compact ? "Set up nutrition tracking." : "Set up nutrition so Coach can track intake alongside training."}</div>
        <div className="mt-2 text-[11px] uppercase tracking-widest text-v5-red font-bold flex items-center gap-1">
          Set up nutrition <ChevronRight size={12} />
        </div>
      </Card>
    );
  }

  const targets = state.nutritionTargets;
  const totals = dailyTotals(state.foodLogs, todayDateKey());
  const calPct = targets.calories > 0 ? Math.round((totals.calories / targets.calories) * 100) : 0;

  if (compact) {
    return (
      <Card onClick={() => onNavigate("nutrition")} className="space-y-2">
        <SectionLabel>Nutrition</SectionLabel>
        <div className="text-sm text-v5-text/90">
          <span className="text-v5-text font-bold">{Math.round(totals.calories).toLocaleString()}</span> / {targets.calories.toLocaleString()} kcal
        </div>
        <ProgressBar pct={calPct} />
        <div className="text-xs text-v5-subtext">
          {Math.round(totals.protein)}/{targets.protein}g protein
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Nutrition</SectionLabel>
        <div className="text-sm text-v5-text/90">
          <span className="text-v5-text font-bold">{Math.round(totals.calories).toLocaleString()}</span> / {targets.calories.toLocaleString()} kcal
        </div>
      </div>
      <ProgressBar pct={calPct} />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-sm font-bold text-v5-text">
            {Math.round(totals.protein)}/{targets.protein}g
          </div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Protein</div>
        </div>
        <div>
          <div className="text-sm font-bold text-v5-text">
            {Math.round(totals.carbs)}/{targets.carbs}g
          </div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Carbs</div>
        </div>
        <div>
          <div className="text-sm font-bold text-v5-text">
            {Math.round(totals.fat)}/{targets.fat}g
          </div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Fat</div>
        </div>
      </div>
      <div className="flex gap-2">
        <ButtonPrimary size="sm" onClick={() => onNavigate("nutritionLog")} className="flex-1">Log Food</ButtonPrimary>
        <ButtonSecondary size="sm" onClick={() => onNavigate("nutrition")} className="flex-1">View Nutrition</ButtonSecondary>
      </div>
    </Card>
  );
}
