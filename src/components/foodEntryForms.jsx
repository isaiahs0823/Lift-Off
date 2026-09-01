import React, { useState } from "react";
import { MEAL_SLOTS, MEAL_SLOT_LABEL } from "../utils/nutrition.js";

export function guessMealSlot() {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}

export function MealChips({ meal, setMeal }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MEAL_SLOTS.map((m) => (
        <button
          key={m}
          onClick={() => setMeal(m)}
          className={`px-2.5 py-1.5 text-[11px] border ${meal === m ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
        >
          {MEAL_SLOT_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

// Macros-only, no name lookup — for restaurant meals or anything where exact food search
// isn't worth the effort (spec section 14). Logs directly; no serving math, no detail screen.
export function QuickAddForm({ onSave, onCancel, initialMeal }) {
  const [meal, setMeal] = useState(initialMeal || guessMealSlot());
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const save = () => {
    if (calories === "") return;
    onSave({
      meal,
      food: "Quick add",
      servingDesc: null,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      fiber: 0,
      source: "quick",
    });
  };

  return (
    <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Quick add — for restaurant meals or known macros</div>
      <MealChips meal={meal} setMeal={setMeal} />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
          Save
        </button>
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
          Cancel
        </button>
      </div>
    </div>
  );
}

// Fully manual food entry — for anything search/scan/quick-add doesn't cover. Optionally saved
// to My Foods so it becomes searchable (spec section 11: any custom food should be findable
// alongside database foods, not stuck in a separate silo).
export function FullAddForm({ onSave, onCancel, initialMeal }) {
  const [meal, setMeal] = useState(initialMeal || guessMealSlot());
  const [food, setFood] = useState("");
  const [servingDesc, setServingDesc] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [saveToFoods, setSaveToFoods] = useState(false);

  const save = () => {
    if (!food.trim() || calories === "") return;
    onSave(
      {
        meal,
        food: food.trim(),
        servingDesc: servingDesc.trim() || null,
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        fiber: fiber === "" ? null : Number(fiber) || 0,
        source: "manual",
      },
      saveToFoods
    );
  };

  return (
    <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-3">
      <MealChips meal={meal} setMeal={setMeal} />
      <input type="text" value={food} onChange={(e) => setFood(e.target.value)} placeholder="Food name" className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
      <input type="text" value={servingDesc} onChange={(e) => setServingDesc(e.target.value)} placeholder="Serving (e.g. 6oz, 1 cup) — optional" className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat (g)" className="bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
      </div>
      <input type="number" inputMode="decimal" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="Fiber (g) — optional" className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
      <label className="flex items-center gap-2 text-xs text-v5-subtext">
        <input type="checkbox" checked={saveToFoods} onChange={(e) => setSaveToFoods(e.target.checked)} />
        Save to My Foods for quick re-logging
      </label>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
          Save
        </button>
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
          Cancel
        </button>
      </div>
    </div>
  );
}
