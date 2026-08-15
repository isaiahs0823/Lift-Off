import React, { useState } from "react";
import { resolveNutritionProfile } from "../utils/nutrition.js";
import { generateMealPlan, getSwapOptions, swapFoodInMeal, suggestFromAvailable } from "../utils/mealPlanGenerator.js";

function IDontHaveThat({ meal, onApply, onClose }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);

  const build = () => {
    const foods = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (foods.length === 0) return;
    setResult(suggestFromAvailable(foods, meal));
  };

  return (
    <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
      <div className="text-sm text-white">What do you have instead?</div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. ground beef, eggs, rice"
        className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
      />
      <button onClick={build} className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30">
        Build from this
      </button>
      {result && (
        <div className="space-y-2 pt-2 border-t border-neutral-900">
          {result.items.map((i) => (
            <div key={i.name} className="text-sm text-neutral-300">
              {i.name} — {i.servingDesc}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => onApply(result)} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
              Use this
            </button>
            <button onClick={onClose} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
              Cancel
            </button>
          </div>
        </div>
      )}
      {!result && (
        <button onClick={onClose} className="text-xs text-neutral-600 hover:text-neutral-400">
          Cancel
        </button>
      )}
    </div>
  );
}

function MealCard({ meal, profile, onSwap, onDontHave }) {
  const [swapItem, setSwapItem] = useState(null);
  const [showDontHave, setShowDontHave] = useState(false);

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-white">
          {meal.label.toUpperCase()} — {meal.time}
        </div>
        <div className="text-xs text-neutral-500">{meal.totals.calories} kcal</div>
      </div>
      <div className="space-y-1.5">
        {meal.items.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="text-neutral-300">
              {item.name} <span className="text-neutral-600">— {item.servingDesc}</span>
            </div>
            <button onClick={() => setSwapItem(swapItem === item.name ? null : item.name)} className="text-[10px] uppercase tracking-widest text-red-500 hover:text-red-400 shrink-0 ml-2">
              Swap
            </button>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-neutral-600">
        {meal.totals.protein}p / {meal.totals.carbs}c / {meal.totals.fat}f
      </div>

      {swapItem && (
        <div className="border-t border-neutral-900 pt-2 space-y-1.5">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Swap {swapItem} for</div>
          <div className="flex flex-wrap gap-1.5">
            {getSwapOptions(swapItem, profile).map((f) => (
              <button
                key={f.name}
                onClick={() => {
                  onSwap(meal.id, swapItem, f);
                  setSwapItem(null);
                }}
                className="px-2.5 py-1.5 text-[11px] border border-neutral-800 text-neutral-300 hover:border-red-700 hover:text-red-500"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showDontHave ? (
        <button onClick={() => setShowDontHave(true)} className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500">
          I don't have this tonight
        </button>
      ) : (
        <IDontHaveThat
          meal={meal}
          onApply={(built) => {
            onDontHave(meal.id, built);
            setShowDontHave(false);
          }}
          onClose={() => setShowDontHave(false)}
        />
      )}
    </div>
  );
}

// Section 8/9/10 — the FULL MEAL PLAN control level's home. Every meal supports a same-
// category swap and a conversational "I don't have that" substitution, because a static PDF
// nobody can follow on a real Tuesday isn't worth generating.
export default function MealPlanView({ state, updateState, onBack }) {
  const profile = resolveNutritionProfile(state);
  const targets = state.nutritionTargets;
  const plan = state.nutritionMealPlan;

  const regenerate = () => {
    const generated = generateMealPlan(profile, targets);
    updateState((prev) => ({ ...prev, nutritionMealPlan: generated }));
  };

  const updateMeal = (mealId, updatedMeal) => {
    updateState((prev) => ({
      ...prev,
      nutritionMealPlan: {
        ...prev.nutritionMealPlan,
        meals: (prev.nutritionMealPlan?.meals || []).map((m) => (m.id === mealId ? { ...m, ...updatedMeal } : m)),
      },
    }));
  };

  const handleSwap = (mealId, oldItemName, newFood) => {
    const meal = plan.meals.find((m) => m.id === mealId);
    updateMeal(mealId, swapFoodInMeal(meal, oldItemName, newFood));
  };

  const handleDontHave = (mealId, built) => {
    updateMeal(mealId, { items: built.items, totals: built.totals });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Meal Plan</div>
        </div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
          ← Back
        </button>
      </div>

      {!targets ? (
        <p className="text-sm text-amber-500">Set up your nutrition targets first.</p>
      ) : !plan ? (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
          <p className="text-sm text-neutral-400">Build a practical daily meal plan from your targets and preferences.</p>
          <button onClick={regenerate} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
            Generate Meal Plan
          </button>
        </div>
      ) : (
        <>
          {plan.meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} profile={profile} onSwap={handleSwap} onDontHave={handleDontHave} />
          ))}
          <button onClick={regenerate} className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
            Regenerate
          </button>
        </>
      )}
    </div>
  );
}
