import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { dailyTotals, todayDateKey, MEAL_SLOTS, MEAL_SLOT_LABEL } from "../utils/nutrition.js";

function guessMealSlot() {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}

function MacroRow({ label, value, target }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-white">
        {Math.round(value)}
        {target != null && <span className="text-neutral-500">/{target}g</span>}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}

// Section 12/13/14 of the nutrition spec: food/serving/macros logging, Quick Add for
// restaurant meals or known macros, and one-tap re-logging from recent/saved foods/saved
// meals — the app gets faster to use as history builds, not slower.
export default function FoodLogScreen({ state, updateState, onBack, onNavigate }) {
  const dateKey = todayDateKey();
  const foodLogs = state.foodLogs || [];
  const savedFoods = state.savedFoods || [];
  const savedMeals = state.savedMeals || [];
  const targets = state.nutritionTargets;
  const todayEntries = foodLogs.filter((f) => f.date === dateKey).sort((a, b) => (b.time || "").localeCompare(a.time || ""));
  const totals = dailyTotals(foodLogs, dateKey);

  const [mode, setMode] = useState(null); // null | "quick" | "full"

  const logEntry = (entry) => {
    updateState((prev) => ({
      ...prev,
      foodLogs: [{ id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, date: dateKey, time: new Date().toISOString(), ...entry }, ...(prev.foodLogs || [])],
    }));
  };

  const deleteEntry = (id) => {
    updateState((prev) => ({ ...prev, foodLogs: (prev.foodLogs || []).filter((f) => f.id !== id) }));
  };

  const logFromSaved = (food) => {
    logEntry({ meal: guessMealSlot(), food: food.name, servingDesc: food.servingDesc, calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, fiber: food.fiber || 0, source: "food" });
    updateState((prev) => ({
      ...prev,
      savedFoods: (prev.savedFoods || []).map((f) => (f.id === food.id ? { ...f, lastUsedAt: new Date().toISOString() } : f)),
    }));
  };

  const logSavedMeal = (meal) => {
    logEntry({ meal: guessMealSlot(), food: meal.name, servingDesc: null, ...meal.totals, source: "saved_meal" });
    updateState((prev) => ({
      ...prev,
      savedMeals: (prev.savedMeals || []).map((m) => (m.id === meal.id ? { ...m, lastUsedAt: new Date().toISOString() } : m)),
    }));
  };

  // Recent = distinct foods from the last ~20 logged entries, most-recent first — separate
  // from savedFoods (an explicit "keep this" action), so the list gets useful automatically.
  const recentFoods = [];
  const seen = new Set();
  for (const f of foodLogs.slice(0, 40)) {
    if (!f.food || seen.has(f.food)) continue;
    seen.add(f.food);
    recentFoods.push(f);
    if (recentFoods.length >= 8) break;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Food Log</div>
        </div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
          ← Back
        </button>
      </div>

      <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
        <div className="text-2xl font-bold text-white">
          {Math.round(totals.calories).toLocaleString()}
          {targets && <span className="text-base font-normal text-neutral-500"> / {targets.calories.toLocaleString()} kcal</span>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MacroRow label="Protein" value={totals.protein} target={targets?.protein} />
          <MacroRow label="Carbs" value={totals.carbs} target={targets?.carbs} />
          <MacroRow label="Fat" value={totals.fat} target={targets?.fat} />
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setMode("quick")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          Quick Add
        </button>
        <button onClick={() => setMode("full")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
          Create Food
        </button>
      </div>
      {onNavigate && (
        <div className="flex gap-2">
          <button onClick={() => onNavigate("nutritionScanBarcode")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-red-700 hover:text-red-500">
            Scan Barcode
          </button>
          <button onClick={() => onNavigate("nutritionScanLabel")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-red-700 hover:text-red-500">
            Scan Nutrition Label
          </button>
        </div>
      )}

      {mode === "quick" && <QuickAddForm onCancel={() => setMode(null)} onSave={(e) => { logEntry(e); setMode(null); }} />}
      {mode === "full" && (
        <FullAddForm
          onCancel={() => setMode(null)}
          onSave={(entry, saveToFoods) => {
            logEntry(entry);
            if (saveToFoods) {
              updateState((prev) => ({
                ...prev,
                savedFoods: [
                  { id: `savedfood_${Date.now()}`, name: entry.food, servingDesc: entry.servingDesc, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber, lastUsedAt: new Date().toISOString() },
                  ...(prev.savedFoods || []),
                ],
              }));
            }
            setMode(null);
          }}
        />
      )}

      {todayEntries.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Today</div>
          {todayEntries.map((f) => (
            <div key={f.id} className="border border-neutral-800 bg-charcoal-panel p-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-white font-bold">{f.food || "Quick add"}</div>
                <div className="text-xs text-neutral-500">
                  {MEAL_SLOT_LABEL[f.meal] || f.meal} · {Math.round(f.calories)} kcal · {Math.round(f.protein)}p / {Math.round(f.carbs)}c / {Math.round(f.fat)}f
                </div>
              </div>
              <button onClick={() => deleteEntry(f.id)} className="text-neutral-600 hover:text-red-500 p-1">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {savedMeals.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Saved meals</div>
          {savedMeals.map((m) => (
            <div key={m.id} className="border border-neutral-800 bg-charcoal-panel p-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-white font-bold">{m.name}</div>
                <div className="text-xs text-neutral-500">
                  {m.totals.calories} kcal · {m.totals.protein}p / {m.totals.carbs}c / {m.totals.fat}f
                </div>
              </div>
              <button onClick={() => logSavedMeal(m)} className="shrink-0 px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold border border-red-700 text-red-500 hover:bg-red-950/30">
                Log Meal
              </button>
            </div>
          ))}
        </div>
      )}

      {savedFoods.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Favorites</div>
          {savedFoods.map((f) => (
            <button key={f.id} onClick={() => logFromSaved(f)} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-3 flex items-center justify-between hover:border-red-700">
              <div>
                <div className="text-sm text-white font-bold">{f.name}</div>
                <div className="text-xs text-neutral-500">{f.calories} kcal · {f.protein}p / {f.carbs}c / {f.fat}f</div>
              </div>
              <Plus size={16} className="text-red-500 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {recentFoods.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Recent</div>
          {recentFoods.map((f) => (
            <button
              key={f.id}
              onClick={() => logEntry({ meal: guessMealSlot(), food: f.food, servingDesc: f.servingDesc, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber || 0, source: "recent" })}
              className="w-full text-left border border-neutral-800 bg-charcoal-panel p-3 flex items-center justify-between hover:border-red-700"
            >
              <div>
                <div className="text-sm text-white font-bold">{f.food}</div>
                <div className="text-xs text-neutral-500">{Math.round(f.calories)} kcal · {Math.round(f.protein)}p / {Math.round(f.carbs)}c / {Math.round(f.fat)}f</div>
              </div>
              <Plus size={16} className="text-red-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuickAddForm({ onSave, onCancel }) {
  const [meal, setMeal] = useState(guessMealSlot());
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
    <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-neutral-500">Quick add — for restaurant meals or known macros</div>
      <MealChips meal={meal} setMeal={setMeal} />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
        <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein (g)" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
        <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs (g)" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
        <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat (g)" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          Save
        </button>
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

function FullAddForm({ onSave, onCancel }) {
  const [meal, setMeal] = useState(guessMealSlot());
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
        fiber: Number(fiber) || 0,
        source: "manual",
      },
      saveToFoods
    );
  };

  return (
    <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
      <MealChips meal={meal} setMeal={setMeal} />
      <input type="text" value={food} onChange={(e) => setFood(e.target.value)} placeholder="Food name" className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
      <input type="text" value={servingDesc} onChange={(e) => setServingDesc(e.target.value)} placeholder="Serving (e.g. 6oz, 1 cup) — optional" className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
      <div className="grid grid-cols-2 gap-3">
        <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
        <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein (g)" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
        <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs (g)" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
        <input type="number" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat (g)" className="bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
      </div>
      <input type="number" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="Fiber (g) — optional" className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700" />
      <label className="flex items-center gap-2 text-xs text-neutral-400">
        <input type="checkbox" checked={saveToFoods} onChange={(e) => setSaveToFoods(e.target.checked)} />
        Save to My Foods for quick re-logging
      </label>
      <div className="flex gap-2">
        <button onClick={save} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          Save
        </button>
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

function MealChips({ meal, setMeal }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MEAL_SLOTS.map((m) => (
        <button
          key={m}
          onClick={() => setMeal(m)}
          className={`px-2.5 py-1.5 text-[11px] border ${meal === m ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"}`}
        >
          {MEAL_SLOT_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
