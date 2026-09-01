import React, { useEffect, useRef, useState } from "react";
import { Search, Barcode, Star, Plus } from "lucide-react";
import { searchFoods, deriveRecentFoods } from "../utils/foodSearchService.js";
import { todayDateKey, MEAL_SLOT_LABEL } from "../utils/nutrition.js";
import { QuickAddForm, FullAddForm, guessMealSlot } from "./foodEntryForms.jsx";

const SOURCE_LABEL = { usda: "USDA", myFoods: "My Foods", favorite: "Favorite", recent: "Recent", custom: "My Foods", barcode: "Scanned", manual: "My Foods" };

function isFavorited(state, food) {
  return (state.favoriteFoods || []).some((f) => f.id === food.id || (f.fdcId && f.fdcId === food.fdcId));
}

function FoodResultRow({ food, favorited, onSelect, onToggleFavorite }) {
  const macroBits = [];
  if (food.protein != null) macroBits.push(`${Math.round(food.protein)}P`);
  if (food.carbs != null) macroBits.push(`${Math.round(food.carbs)}C`);
  if (food.fat != null) macroBits.push(`${Math.round(food.fat)}F`);
  const sourceLabel = SOURCE_LABEL[food.matchSource] || SOURCE_LABEL[food.source] || null;

  return (
    <div className="w-full border border-white/10 bg-v5-elevated p-3 flex items-center gap-2 hover:border-v5-red">
      <button onClick={() => onSelect(food)} className="flex-1 min-w-0 text-left">
        {food.brand && <div className="text-[10px] uppercase tracking-widest text-v5-subtext truncate">{food.brand}</div>}
        <div className="text-sm text-white font-bold truncate">{food.name}</div>
        <div className="text-xs text-v5-subtext truncate">
          {food.servingDesc || "1 serving"}
          {food.calories != null && <> · {Math.round(food.calories)} kcal</>}
          {macroBits.length > 0 && <> · {macroBits.join(" ")}</>}
          {sourceLabel && <span className="text-v5-subtext/40"> · {sourceLabel}</span>}
        </div>
      </button>
      <button onClick={() => onToggleFavorite(food)} className={`shrink-0 p-1.5 ${favorited ? "text-v5-red" : "text-v5-subtext/70 hover:text-v5-red"}`} aria-label={favorited ? "Remove favorite" : "Add favorite"}>
        <Star size={16} fill={favorited ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

// The core of the food-search feature (spec sections 1-4, 9-11, 15-18): a fast, debounced
// search across BRK's own local data (recent/favorites/My Foods) and USDA FoodData Central,
// plus the fallback paths (barcode, quick add, create food) so the user is never stuck when a
// database search comes up empty.
export default function AddFoodScreen({ state, updateState, onNavigate, onSelectFood, initialMeal, dateKey }) {
  const activeDateKey = dateKey || todayDateKey();
  const meal = initialMeal || guessMealSlot();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ local: [], remote: [], remoteError: null });
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null); // null | "quick" | "full"
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    // Empty query: instant local view (Recent), no network, no debounce needed.
    if (query.trim().length === 0) {
      setResults({ local: deriveRecentFoods(state), remote: [], remoteError: null });
      setLoading(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = query.trim();
      const cached = cacheRef.current.get(trimmed.toLowerCase());
      if (cached) {
        setResults(cached);
        setLoading(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      searchFoods(trimmed, state, { signal: controller.signal })
        .then((r) => {
          cacheRef.current.set(trimmed.toLowerCase(), r);
          setResults(r);
          setLoading(false);
        })
        .catch((e) => {
          if (e?.name === "AbortError") return; // superseded by a newer keystroke
          setResults({ local: [], remote: [], remoteError: e });
          setLoading(false);
        });
    }, 400);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const logEntry = (entry) => {
    updateState((prev) => ({
      ...prev,
      foodLogs: [{ id: `food_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, date: activeDateKey, time: new Date().toISOString(), ...entry }, ...(prev.foodLogs || [])],
    }));
  };

  const toggleFavorite = (food) => {
    updateState((prev) => {
      const existing = prev.favoriteFoods || [];
      const already = existing.some((f) => f.id === food.id || (food.fdcId && f.fdcId === food.fdcId));
      if (already) {
        return { ...prev, favoriteFoods: existing.filter((f) => f.id !== food.id && f.fdcId !== food.fdcId) };
      }
      const { matchSource, relogFrom, ...clean } = food;
      return { ...prev, favoriteFoods: [{ ...clean, favoritedAt: new Date().toISOString() }, ...existing] };
    });
  };

  const allResults = [...results.local, ...results.remote];
  const showEmptyState = query.trim().length >= 2 && !loading && allResults.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Add Food</div>
        </div>
        <button onClick={() => onNavigate("nutritionLog")} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          ← Back
        </button>
      </div>

      <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Adding to {MEAL_SLOT_LABEL[meal] || meal}</div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-v5-subtext/70" />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods, brands, restaurants..."
          className="w-full bg-v5-elevated border border-white/10 text-v5-text pl-9 pr-3 py-3 text-base focus:outline-none focus:border-v5-red"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => onNavigate("nutritionScanBarcode")} className="flex flex-col items-center gap-1 py-2.5 text-[11px] uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red">
          <Barcode size={16} />
          Scan Barcode
        </button>
        <button onClick={() => setMode("quick")} className="py-2.5 text-[11px] uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red">
          Quick Add
        </button>
        <button onClick={() => setMode("full")} className="py-2.5 text-[11px] uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red">
          Create Food
        </button>
      </div>

      {mode === "quick" && (
        <QuickAddForm initialMeal={meal} onCancel={() => setMode(null)} onSave={(e) => { logEntry(e); setMode(null); onNavigate("nutritionLog"); }} />
      )}
      {mode === "full" && (
        <FullAddForm
          initialMeal={meal}
          onCancel={() => setMode(null)}
          onSave={(entry, saveToFoods) => {
            logEntry(entry);
            if (saveToFoods) {
              updateState((prev) => ({
                ...prev,
                savedFoods: [
                  { id: `savedfood_${Date.now()}`, name: entry.food, servingDesc: entry.servingDesc, calories: entry.calories, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber, source: "custom", lastUsedAt: new Date().toISOString() },
                  ...(prev.savedFoods || []),
                ],
              }));
            }
            setMode(null);
            onNavigate("nutritionLog");
          }}
        />
      )}

      {results.remoteError && (
        <div className="text-xs text-amber-500 border border-amber-900/40 bg-v5-elevated p-3">
          Couldn't reach the food database right now — showing what's saved locally. Try Scan Barcode, Quick Add, or Create Food instead.
        </div>
      )}

      {query.trim().length === 0 && allResults.length > 0 && <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Recent</div>}

      {loading && <div className="text-xs text-v5-subtext/70 py-2 text-center">Searching…</div>}

      {!showEmptyState && (
        <div className="space-y-2">
          {allResults.map((food) => (
            <FoodResultRow
              key={food.id}
              food={food}
              favorited={isFavorited(state, food)}
              onSelect={(f) => onSelectFood(f, meal, activeDateKey)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}

      {showEmptyState && (
        <div className="border border-white/10 bg-v5-elevated p-5 text-center space-y-3">
          <div className="text-sm text-v5-subtext">We couldn't find that food.</div>
          <div className="flex flex-col gap-2">
            <button onClick={() => onNavigate("nutritionScanBarcode")} className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red flex items-center justify-center gap-1.5">
              <Barcode size={14} /> Scan Barcode
            </button>
            <button onClick={() => onNavigate("nutritionScanLabel")} className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red">
              Scan Nutrition Label
            </button>
            <button onClick={() => setMode("full")} className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5">
              <Plus size={14} /> Create Food
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
