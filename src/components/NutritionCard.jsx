import React from "react";
import { ChevronRight } from "lucide-react";
import { hasNutritionProfile, dailyTotals, todayDateKey } from "../utils/nutrition.js";

// Compact Today-dashboard card (nutrition spec section 1/16). Before Nutrition is set up, this
// is just an invitation — never a wall of empty macro bars that reads as broken.
export default function NutritionCard({ state, onNavigate }) {
  if (!hasNutritionProfile(state) || !state.nutritionTargets) {
    return (
      <button onClick={() => onNavigate("nutrition")} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 hover:border-neutral-600">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
        <div className="text-sm text-neutral-400 mt-1">Set up nutrition so Coach can track intake alongside training.</div>
        <div className="mt-2 text-[11px] uppercase tracking-widest text-red-500 flex items-center gap-1">
          Set up nutrition <ChevronRight size={12} />
        </div>
      </button>
    );
  }

  const targets = state.nutritionTargets;
  const totals = dailyTotals(state.foodLogs, todayDateKey());

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
        <div className="text-sm text-neutral-300">
          <span className="text-white font-bold">{Math.round(totals.calories).toLocaleString()}</span> / {targets.calories.toLocaleString()} kcal
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-sm font-bold text-white">
            {Math.round(totals.protein)}/{targets.protein}g
          </div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Protein</div>
        </div>
        <div>
          <div className="text-sm font-bold text-white">
            {Math.round(totals.carbs)}/{targets.carbs}g
          </div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Carbs</div>
        </div>
        <div>
          <div className="text-sm font-bold text-white">
            {Math.round(totals.fat)}/{targets.fat}g
          </div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Fat</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onNavigate("nutritionLog")}
          className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
        >
          Log Food
        </button>
        <button
          onClick={() => onNavigate("nutrition")}
          className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600"
        >
          View Nutrition
        </button>
      </div>
    </div>
  );
}
