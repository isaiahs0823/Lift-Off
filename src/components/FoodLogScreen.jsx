import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, Pencil, Check, X, Plus } from "lucide-react";
import { dailyTotals, todayDateKey, MEAL_SLOTS, MEAL_SLOT_LABEL } from "../utils/nutrition.js";
import { guessMealSlot } from "./foodEntryForms.jsx";

const MEAL_DISPLAY_GROUPS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_GROUP_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

// pre_workout/post_workout log entries fold into the Snacks section visually (spec's daily log
// mockup only shows 4 meal buckets) but keep their own label on the item row itself, so nothing
// about the original meal choice is lost — just grouped for a cleaner day view.
function groupFor(meal) {
  return MEAL_DISPLAY_GROUPS.includes(meal) ? meal : "snack";
}

function shiftDateKey(dateKey, deltaDays) {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + deltaDays);
  return todayDateKey(d);
}

function dateLabel(dateKey) {
  const today = todayDateKey();
  if (dateKey === today) return "Today";
  if (dateKey === shiftDateKey(today, -1)) return "Yesterday";
  if (dateKey === shiftDateKey(today, 1)) return "Tomorrow";
  return new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function sumMacros(entries) {
  return entries.reduce(
    (acc, f) => ({
      calories: acc.calories + (f.calories || 0),
      protein: acc.protein + (f.protein || 0),
      carbs: acc.carbs + (f.carbs || 0),
      fat: acc.fat + (f.fat || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function MacroRow({ label, value, target }) {
  return (
    <div className="text-center">
      <div className="text-sm font-bold text-white">
        {Math.round(value)}
        {target != null && <span className="text-v5-subtext">/{target}g</span>}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-v5-subtext">{label}</div>
    </div>
  );
}

// Rescales a previously-logged entry's macros proportionally from its own recorded quantity —
// e.g. entry was 255g at 150 kcal, user corrects it to 300g -> 176.5 kcal. Only possible when
// the entry carries serving_quantity (anything logged through Food Detail does; legacy quick-
// add/manual entries never had a "quantity" concept in the first place, so they just don't
// offer this control — direct macro edits still work for those).
function rescaleEntry(entry, newQuantity) {
  if (!entry.serving_quantity || entry.serving_quantity <= 0 || !(newQuantity > 0)) return null;
  const ratio = newQuantity / entry.serving_quantity;
  const scale = (v) => (typeof v === "number" ? v * ratio : v);
  return {
    serving_quantity: newQuantity,
    serving_grams: entry.serving_grams != null ? entry.serving_grams * ratio : null,
    calories: scale(entry.calories),
    protein: scale(entry.protein),
    carbs: scale(entry.carbs),
    fat: scale(entry.fat),
    fiber: scale(entry.fiber),
  };
}

function LoggedItemRow({ entry, editing, onStartEdit, onCancelEdit, onSave, onDelete }) {
  const [meal, setMeal] = useState(entry.meal);
  const [quantity, setQuantity] = useState(entry.serving_quantity != null ? String(entry.serving_quantity) : "");
  const [calories, setCalories] = useState(String(Math.round(entry.calories || 0)));
  const [protein, setProtein] = useState(String(Math.round(entry.protein || 0)));
  const [carbs, setCarbs] = useState(String(Math.round(entry.carbs || 0)));
  const [fat, setFat] = useState(String(Math.round(entry.fat || 0)));

  if (!editing) {
    const macroBits = [];
    if (entry.protein != null) macroBits.push(`${Math.round(entry.protein)}p`);
    if (entry.carbs != null) macroBits.push(`${Math.round(entry.carbs)}c`);
    if (entry.fat != null) macroBits.push(`${Math.round(entry.fat)}f`);
    return (
      <button onClick={onStartEdit} className="w-full text-left border border-white/10 bg-v5-elevated p-3 flex items-center justify-between hover:border-v5-red/40">
        <div className="min-w-0">
          <div className="text-sm text-white font-bold truncate">{entry.food || "Quick add"}</div>
          <div className="text-xs text-v5-subtext truncate">
            {entry.servingDesc ? `${entry.servingDesc} · ` : ""}
            {entry.calories != null ? `${Math.round(entry.calories)} kcal` : "—"}
            {macroBits.length > 0 && ` · ${macroBits.join(" / ")}`}
            {(entry.meal === "pre_workout" || entry.meal === "post_workout") && ` · ${MEAL_SLOT_LABEL[entry.meal]}`}
          </div>
        </div>
        <Pencil size={14} className="text-v5-subtext/70 shrink-0 ml-2" />
      </button>
    );
  }

  const canRescale = entry.serving_quantity != null;

  const save = () => {
    let patch = { meal, calories: Number(calories) || 0, protein: Number(protein) || 0, carbs: Number(carbs) || 0, fat: Number(fat) || 0 };
    if (canRescale && quantity !== "" && Number(quantity) !== entry.serving_quantity) {
      const rescaled = rescaleEntry(entry, Number(quantity));
      if (rescaled) patch = { ...patch, ...rescaled };
    }
    onSave(patch);
  };

  return (
    <div className="border border-v5-red/25 bg-v5-elevated p-3 space-y-2.5">
      <div className="text-sm text-white font-bold">{entry.food || "Quick add"}</div>
      <div className="flex flex-wrap gap-1.5">
        {MEAL_SLOTS.map((m) => (
          <button
            key={m}
            onClick={() => setMeal(m)}
            className={`px-2 py-1 text-[10px] border ${meal === m ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
          >
            {MEAL_SLOT_LABEL[m]}
          </button>
        ))}
      </div>
      {canRescale && (
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-v5-subtext/70 mb-1">Serving quantity</label>
          <input
            type="number"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 bg-v5-surface border border-white/10 text-v5-text px-2 py-1.5 text-sm focus:outline-none focus:border-v5-red"
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories" className="bg-v5-surface border border-white/10 text-v5-text px-2 py-1.5 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein" className="bg-v5-surface border border-white/10 text-v5-text px-2 py-1.5 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs" className="bg-v5-surface border border-white/10 text-v5-text px-2 py-1.5 text-sm focus:outline-none focus:border-v5-red" />
        <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat" className="bg-v5-surface border border-white/10 text-v5-text px-2 py-1.5 text-sm focus:outline-none focus:border-v5-red" />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={save} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1">
          <Check size={14} /> Save
        </button>
        <button onClick={onCancelEdit} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40 flex items-center justify-center gap-1">
          <X size={14} /> Cancel
        </button>
        <button onClick={onDelete} className="p-2 text-v5-subtext/70 hover:text-v5-red" aria-label="Delete">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// The daily food log (spec sections 7/8/21/22): date-navigable, meal-grouped, editable in
// place. Search/scan/quick-add/create-food all live one level up on AddFoodScreen — this
// screen is purely "what did I eat, organized by meal and day."
export default function FoodLogScreen({ state, updateState, onNavigate, onAddFood, selectedDate, onChangeDate }) {
  const [editingId, setEditingId] = useState(null);
  const foodLogs = state.foodLogs || [];
  const savedMeals = state.savedMeals || [];
  const targets = state.nutritionTargets;
  const totals = dailyTotals(foodLogs, selectedDate);
  const dayEntries = foodLogs.filter((f) => f.date === selectedDate).sort((a, b) => (b.time || "").localeCompare(a.time || ""));
  const tomorrowKey = shiftDateKey(todayDateKey(), 1);
  const yesterdayEntries = foodLogs.filter((f) => f.date === shiftDateKey(selectedDate, -1));

  // Repetitive diets (spec section 13) — copy an entire meal forward from the previous day
  // instead of re-searching/re-entering the same foods. Only offered when today's version of
  // that meal is still empty, so it can't silently duplicate something already logged.
  const copyMealFromYesterday = (group) => {
    const items = yesterdayEntries.filter((f) => groupFor(f.meal) === group);
    if (items.length === 0) return;
    updateState((prev) => ({
      ...prev,
      foodLogs: [
        ...items.map((f) => ({ ...f, id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, date: selectedDate, time: new Date().toISOString() })),
        ...(prev.foodLogs || []),
      ],
    }));
  };

  const patchEntry = (id, patch) => {
    updateState((prev) => ({ ...prev, foodLogs: (prev.foodLogs || []).map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
    setEditingId(null);
  };
  const deleteEntry = (id) => {
    updateState((prev) => ({ ...prev, foodLogs: (prev.foodLogs || []).filter((f) => f.id !== id) }));
    setEditingId(null);
  };
  const logSavedMeal = (meal) => {
    updateState((prev) => ({
      ...prev,
      foodLogs: [
        { id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, date: selectedDate, time: new Date().toISOString(), meal: guessMealSlot(), food: meal.name, servingDesc: null, ...meal.totals, source: "saved_meal" },
        ...(prev.foodLogs || []),
      ],
      savedMeals: (prev.savedMeals || []).map((m) => (m.id === meal.id ? { ...m, lastUsedAt: new Date().toISOString() } : m)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Food Log</div>
        </div>
        <button onClick={() => onNavigate("nutrition")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          ← Back
        </button>
      </div>

      <div className="flex items-center justify-between border border-white/10 bg-v5-elevated px-2 py-2.5">
        <button onClick={() => onChangeDate(shiftDateKey(selectedDate, -1))} className="p-2 text-v5-subtext hover:text-v5-red" aria-label="Previous day">
          <ChevronLeft size={18} />
        </button>
        <div className="text-sm font-bold uppercase tracking-widest text-white">{dateLabel(selectedDate)}</div>
        <button
          onClick={() => onChangeDate(shiftDateKey(selectedDate, 1))}
          disabled={selectedDate >= tomorrowKey}
          className="p-2 text-v5-subtext hover:text-v5-red disabled:opacity-30 disabled:hover:text-v5-subtext"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <div className="text-2xl font-bold text-white">
          {Math.round(totals.calories).toLocaleString()}
          {targets && <span className="text-base font-normal text-v5-subtext"> / {targets.calories.toLocaleString()} kcal</span>}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MacroRow label="Protein" value={totals.protein} target={targets?.protein} />
          <MacroRow label="Carbs" value={totals.carbs} target={targets?.carbs} />
          <MacroRow label="Fat" value={totals.fat} target={targets?.fat} />
        </div>
      </div>

      <button
        onClick={() => onAddFood(guessMealSlot(), selectedDate)}
        className="w-full py-3 text-sm uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
      >
        Search Food
      </button>

      {MEAL_DISPLAY_GROUPS.map((group) => {
        const items = dayEntries.filter((f) => groupFor(f.meal) === group);
        const groupTotals = sumMacros(items);
        const canCopyFromYesterday = items.length === 0 && yesterdayEntries.some((f) => groupFor(f.meal) === group);
        return (
          <div key={group} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">{MEAL_GROUP_LABEL[group]}</div>
              {items.length > 0 && (
                <div className="text-[11px] text-v5-subtext">
                  {Math.round(groupTotals.calories)} kcal · {Math.round(groupTotals.protein)}P · {Math.round(groupTotals.carbs)}C · {Math.round(groupTotals.fat)}F
                </div>
              )}
            </div>
            {canCopyFromYesterday && (
              <button
                onClick={() => copyMealFromYesterday(group)}
                className="w-full py-2 text-[11px] uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red hover:text-v5-red"
              >
                Copy {MEAL_GROUP_LABEL[group]} from yesterday
              </button>
            )}
            {items.map((entry) => (
              <LoggedItemRow
                key={entry.id}
                entry={entry}
                editing={editingId === entry.id}
                onStartEdit={() => setEditingId(entry.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(patch) => patchEntry(entry.id, patch)}
                onDelete={() => deleteEntry(entry.id)}
              />
            ))}
            <button
              onClick={() => onAddFood(group, selectedDate)}
              className="w-full py-2 text-[11px] uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red hover:text-v5-red flex items-center justify-center gap-1"
            >
              <Plus size={12} /> Add Food
            </button>
          </div>
        );
      })}

      {savedMeals.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Saved meals</div>
          {savedMeals.map((m) => (
            <div key={m.id} className="border border-white/10 bg-v5-elevated p-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-white font-bold">{m.name}</div>
                <div className="text-xs text-v5-subtext">
                  {m.totals.calories} kcal · {m.totals.protein}p / {m.totals.carbs}c / {m.totals.fat}f
                </div>
              </div>
              <button onClick={() => logSavedMeal(m)} className="shrink-0 px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30">
                Log Meal
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
