import React, { useState } from "react";
import { Star } from "lucide-react";
import { scaleFoodMacros, servingUnitOptions } from "../utils/foodServingMath.js";
import { todayDateKey } from "../utils/nutrition.js";
import { MealChips, guessMealSlot } from "./foodEntryForms.jsx";

function MacroValue({ label, value, unit = "g" }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-white">{value == null ? "—" : `${Math.round(value * 10) / 10}${unit === "g" ? "" : unit}`}</div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}

function isFavorited(state, food) {
  return (state.favoriteFoods || []).some((f) => f.id === food.id || (food.fdcId && f.fdcId === food.fdcId));
}

// Spec sections 5/6/20: change the quantity, the numbers scale — no manual math, no invented
// nutrients when the source didn't report one. This is the only screen that actually writes a
// foodLogs entry from a database/search result (Quick Add and Create Food write directly from
// AddFoodScreen since they never have a "food" object to scale in the first place).
export default function FoodDetailScreen({ state, updateState, onNavigate, food, meal, dateKey }) {
  const unitOptions = servingUnitOptions(food);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState(unitOptions[0].value);
  const [selectedMeal, setSelectedMeal] = useState(meal || guessMealSlot());

  if (!food) {
    // Defensive — this screen only makes sense with a food in hand (e.g. a stale reload mid-
    // navigation). Send the user back to search rather than render a blank/broken screen.
    return (
      <div className="space-y-4">
        <div className="text-sm text-neutral-400">No food selected.</div>
        <button onClick={() => onNavigate("nutritionLog")} className="text-xs uppercase tracking-widest text-red-500 hover:text-red-400">
          ← Back to Food Log
        </button>
      </div>
    );
  }

  const scaled = scaleFoodMacros(food, quantity, unit);
  const favorited = isFavorited(state, food);
  const activeDateKey = dateKey || todayDateKey();

  const toggleFavorite = () => {
    updateState((prev) => {
      const existing = prev.favoriteFoods || [];
      const already = existing.some((f) => f.id === food.id || (food.fdcId && f.fdcId === food.fdcId));
      if (already) return { ...prev, favoriteFoods: existing.filter((f) => f.id !== food.id && f.fdcId !== food.fdcId) };
      const { matchSource, relogFrom, ...clean } = food;
      return { ...prev, favoriteFoods: [{ ...clean, favoritedAt: new Date().toISOString() }, ...existing] };
    });
  };

  const canAdd = scaled.calories != null && !scaled.unavailable;

  const addFood = () => {
    if (!canAdd) return;
    const unitLabel = unitOptions.find((o) => o.value === unit)?.label || unit;
    updateState((prev) => ({
      ...prev,
      foodLogs: [
        {
          id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          date: activeDateKey,
          time: new Date().toISOString(),
          meal: selectedMeal,
          food: food.name,
          brand: food.brand || null,
          servingDesc: `${quantity} ${unitLabel}`,
          serving_quantity: Number(quantity) || null,
          serving_unit: unit,
          serving_grams: scaled.gramsUsed,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fat: scaled.fat,
          fiber: scaled.fiber,
          food_id: food.id,
          fdcId: food.fdcId || null,
          source: food.source || "food",
        },
        ...(prev.foodLogs || []),
      ],
    }));
    onNavigate("nutritionLog");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Food Details</div>
        </div>
        <button onClick={() => onNavigate("foodSearch")} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
          ← Back
        </button>
      </div>

      <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-1">
        {food.brand && <div className="text-[11px] uppercase tracking-widest text-neutral-500">{food.brand}</div>}
        <div className="flex items-start justify-between gap-2">
          <div className="text-lg font-bold text-white">{food.name}</div>
          <button onClick={toggleFavorite} className={`shrink-0 p-1 ${favorited ? "text-red-500" : "text-neutral-600 hover:text-red-500"}`} aria-label={favorited ? "Remove favorite" : "Add favorite"}>
            <Star size={18} fill={favorited ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500">Serving</label>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="flex-1 bg-charcoal-panel border border-neutral-800 text-white text-lg font-bold text-center px-3 py-3 focus:outline-none focus:border-red-700"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-3 text-sm focus:outline-none focus:border-red-700"
          >
            {unitOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {scaled.unavailable && <div className="text-xs text-amber-500">Grams/ounces aren't available for this food — use "serving" instead.</div>}
      </div>

      <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
        <div className="text-2xl font-bold text-white text-center">{scaled.calories == null ? "—" : Math.round(scaled.calories)} <span className="text-sm font-normal text-neutral-500">kcal</span></div>
        <div className="grid grid-cols-4 gap-2">
          <MacroValue label="Protein" value={scaled.protein} />
          <MacroValue label="Carbs" value={scaled.carbs} />
          <MacroValue label="Fat" value={scaled.fat} />
          <MacroValue label="Fiber" value={scaled.fiber} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500">Add to</label>
        <MealChips meal={selectedMeal} setMeal={setSelectedMeal} />
      </div>

      <button
        onClick={addFood}
        disabled={!canAdd}
        className="w-full py-3.5 text-sm uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Add Food
      </button>
    </div>
  );
}
