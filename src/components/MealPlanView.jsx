import React, { useState, useEffect, useRef } from "react";
import { resolveNutritionProfile } from "../utils/nutrition.js";
import { generateMealPlan, getSwapOptions, swapFoodInMeal, suggestFromAvailable, planGaps, planMeetsTargets, mealPlansMeaningfullyDiffer } from "../utils/mealPlanGenerator.js";

// Regenerate bug fix — generateMealPlan is a pure function of (profile, targets, variation), so
// calling it again with an unchanged variation silently re-saves an identical plan (the originally
// reported bug: tapping Regenerate appeared to do nothing). This tries the next few variations in
// order and keeps the first one that's actually different; a bounded cap, not an unbounded loop,
// so an exhausted/very restrictive food pool fails fast into the "no alternative" message instead
// of hanging the tap.
const MAX_REGENERATE_ATTEMPTS = 10;

// Bug report (Nutrition -> Meal Plan -> Swap -> "What do you have instead?"): Build From This
// appeared to do nothing for an unrecognized food (e.g. "Corn Flakes"). Root cause —
// suggestFromAvailable() correctly returns null when nothing in FOOD_DB overlaps the input, but
// this component had no branch for "searched and found nothing": `{result && (...)}` and
// `{!result && (...)}` render identically whether the athlete has typed anything yet or has
// already searched and come up empty, so a real "no match" outcome looked exactly like never
// having clicked the button at all. `searched`/`noMatchFor` track that distinction explicitly so
// a no-match result always says so, in plain language, instead of silently reverting.
function IDontHaveThat({ meal, onApply, onClose }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [noMatchFor, setNoMatchFor] = useState(null);
  const resultRef = useRef(null);

  const build = () => {
    const foods = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (foods.length === 0) return;
    const built = suggestFromAvailable(foods, meal);
    setResult(built);
    setNoMatchFor(built ? null : foods.join(", "));
  };

  // UI concern from the same report ("Cancel control is partially obscured"): on a real phone,
  // the on-screen keyboard shrinks the visible viewport while this input has focus. The fixed
  // bottom nav doesn't move, so new content appearing near the bottom of this panel (the result
  // row, or this no-match message) can render partially behind it. Scrolling the newly-rendered
  // content into view — the standard fix for "something appeared below the keyboard/fixed
  // chrome" — sidesteps that without touching the nav bar's own layout for every other screen.
  useEffect(() => {
    if ((result || noMatchFor) && resultRef.current) {
      resultRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [result, noMatchFor]);

  return (
    <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-3">
      <div className="text-sm text-white">What do you have instead?</div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. ground beef, eggs, rice"
        className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
      />
      <button onClick={build} className="w-full py-2 text-xs uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30">
        Build from this
      </button>
      {result && (
        <div ref={resultRef} className="space-y-2 pt-2 border-t border-white/[0.06]">
          {result.items.map((i) => (
            <div key={i.name} className="text-sm text-v5-text/90">
              {i.name} — {i.servingDesc}
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => onApply(result)} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
              Use this
            </button>
            <button onClick={onClose} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
              Cancel
            </button>
          </div>
        </div>
      )}
      {!result && noMatchFor && (
        <div ref={resultRef} className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="text-sm text-v5-red/90">
            We don't have "{noMatchFor}" in our food list yet. Try a more common name (e.g. "oats" instead of a brand
            name), or list a few options separated by commas.
          </div>
        </div>
      )}
      {!result && (
        <button onClick={onClose} className="text-xs text-v5-subtext/70 hover:text-v5-subtext">
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
    <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-white">
          {meal.label.toUpperCase()} — {meal.time}
        </div>
        <div className="text-xs text-v5-subtext">{meal.totals.calories} kcal</div>
      </div>
      <div className="space-y-1.5">
        {meal.items.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-sm">
            <div className="text-v5-text/90">
              {item.name} <span className="text-v5-subtext/70">— {item.servingDesc}</span>
            </div>
            <button onClick={() => setSwapItem(swapItem === item.name ? null : item.name)} className="text-[11px] uppercase tracking-widest text-v5-red hover:text-v5-red shrink-0 ml-2">
              Swap
            </button>
          </div>
        ))}
      </div>
      <div className="text-[11px] text-v5-subtext/70">
        {meal.totals.protein}p / {meal.totals.carbs}c / {meal.totals.fat}f
      </div>

      {swapItem && (
        <div className="border-t border-white/[0.06] pt-2 space-y-1.5">
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Swap {swapItem} for</div>
          <div className="flex flex-wrap gap-1.5">
            {getSwapOptions(swapItem, profile).map((f) => (
              <button
                key={f.name}
                onClick={() => {
                  onSwap(meal.id, swapItem, f);
                  setSwapItem(null);
                }}
                className="px-2.5 py-1.5 text-[11px] border border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!showDontHave ? (
        <button onClick={() => setShowDontHave(true)} className="text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red">
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

// Nutrition P0, step 4 — the daily plan-vs-target summary. Computed LIVE from the plan's current
// meals + the athlete's current targets (never from the plan's own stored `totals`/`gaps`, which
// are a snapshot from generation time and go stale the moment a swap or "I don't have this"
// substitution changes a meal) — so this always reflects exactly what's actually in the plan
// right now, the same real numbers the meal cards below already show per-meal. "Planned" is
// explicit in the label: this is what the plan calls for, never a claim about what was actually
// eaten (food logging, where that distinction would apply, is a separate screen entirely).
function dailyTotalsFromMeals(meals) {
  return (meals || []).reduce(
    (acc, m) => ({
      calories: acc.calories + m.totals.calories,
      protein: acc.protein + m.totals.protein,
      carbs: acc.carbs + m.totals.carbs,
      fat: acc.fat + m.totals.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function MacroRow({ label, planned, target, unit, within }) {
  const diff = planned - target;
  const sign = diff > 0 ? "+" : "";
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-t border-white/[0.06] first:border-t-0 first:pt-0">
      <div className="text-v5-subtext">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-v5-text font-bold tabular-nums">
          {planned}
          {unit}
        </span>
        <span className="text-v5-subtext/50">/</span>
        <span className="text-v5-subtext tabular-nums">
          {target}
          {unit}
        </span>
        <span className={`text-[11px] tabular-nums w-14 text-right ${within ? "text-v5-subtext/60" : "text-amber-500"}`}>
          {diff === 0 ? "exact" : `${sign}${diff}${unit}`}
        </span>
      </div>
    </div>
  );
}

function DailyNutritionSummary({ meals, targets }) {
  if (!targets) return null;
  const planned = dailyTotalsFromMeals(meals);
  const within = planMeetsTargets(planned, targets);
  const gaps = planGaps(planned, targets);
  const allWithin = Object.values(within).every(Boolean);

  return (
    <div className="border border-white/10 bg-v5-elevated p-4 space-y-1">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Planned vs. Target</div>
        {!allWithin && <div className="text-[11px] uppercase tracking-widest text-amber-500">Doesn't fully match</div>}
      </div>
      <MacroRow label="Calories" planned={planned.calories} target={targets.calories} unit=" kcal" within={within.calories} />
      <MacroRow label="Protein" planned={planned.protein} target={targets.protein} unit="g" within={within.protein} />
      <MacroRow label="Carbs" planned={planned.carbs} target={targets.carbs} unit="g" within={within.carbs} />
      <MacroRow label="Fat" planned={planned.fat} target={targets.fat} unit="g" within={within.fat} />
      {!allWithin && (
        <div className="text-[11px] text-v5-subtext/70 pt-2 border-t border-white/[0.06] mt-1">
          This plan is built from a curated set of real foods, so it won't always land exactly on every number — the
          differences above are real, not rounded away. Use Swap on any item to adjust it, or Regenerate for a new
          attempt.
        </div>
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

  // isRegenerating disables the button visibly; regenerateInFlightRef is the actual duplicate-tap
  // guard, checked/set synchronously so a second tap is caught even before React re-renders.
  // generateMealPlan is synchronous and fast, so releasing the guard in a plain try/finally (within
  // the same call) would reset it before a genuine rapid second tap even lands — two taps fired
  // close together each dispatch as their own real browser click event, not within the same JS
  // tick, so even a same-tick reset leaves a real double-tap's second click completely unguarded.
  // A short cooldown (500ms — comfortably longer than a real double-tap gap, imperceptible as a
  // delay since the plan itself is already generated and saved synchronously, before this timer is
  // even set) keeps the guard held across it.
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateMessage, setRegenerateMessage] = useState(null);
  const regenerateInFlightRef = useRef(false);

  const regenerate = () => {
    if (regenerateInFlightRef.current) return;
    regenerateInFlightRef.current = true;
    setIsRegenerating(true);
    setRegenerateMessage(null);

    // No plan yet ("Generate Meal Plan," the first-ever build) — nothing to differ from, so the
    // first attempt is the only one that matters.
    if (!plan) {
      const generated = generateMealPlan(profile, targets, { variation: 0 });
      if (generated) {
        updateState((prev) => ({ ...prev, nutritionMealPlan: generated }));
      } else {
        setRegenerateMessage("Couldn't generate a meal plan right now — check your nutrition targets.");
      }
    } else {
      // Continues forward from whatever variation the SAVED plan is already on (survives a
      // refresh, so a second Regenerate after reopening the app doesn't risk re-trying a
      // variation it already rejected or already showed).
      const startVariation = (plan.variation ?? 0) + 1;
      let found = null;
      for (let i = 0; i < MAX_REGENERATE_ATTEMPTS; i++) {
        const candidate = generateMealPlan(profile, targets, { variation: startVariation + i });
        if (candidate && mealPlansMeaningfullyDiffer(plan, candidate)) {
          found = candidate;
          break;
        }
      }
      if (found) {
        updateState((prev) => ({ ...prev, nutritionMealPlan: found }));
      } else {
        setRegenerateMessage(
          "No meaningfully different plan is available for your current targets and preferences — try adjusting dietary restrictions, training time, or meals per day, or Swap individual items instead."
        );
      }
    }

    setTimeout(() => {
      regenerateInFlightRef.current = false;
      setIsRegenerating(false);
    }, 500);
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
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Nutrition</div>
          <div className="text-xl font-bold text-white mt-1">Meal Plan</div>
        </div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          ← Back
        </button>
      </div>

      {!targets ? (
        <p className="text-sm text-amber-500">Set up your nutrition targets first.</p>
      ) : !plan ? (
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
          <p className="text-sm text-v5-subtext">Build a practical daily meal plan from your targets and preferences.</p>
          <button
            onClick={regenerate}
            disabled={isRegenerating}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90 disabled:opacity-50"
          >
            {isRegenerating ? "Generating…" : "Generate Meal Plan"}
          </button>
          {regenerateMessage && <p className="text-xs text-amber-500">{regenerateMessage}</p>}
        </div>
      ) : (
        <>
          <DailyNutritionSummary meals={plan.meals} targets={targets} />
          {plan.meals.map((meal) => (
            <MealCard key={meal.id} meal={meal} profile={profile} onSwap={handleSwap} onDontHave={handleDontHave} />
          ))}
          <button
            onClick={regenerate}
            disabled={isRegenerating}
            className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40 disabled:opacity-50"
          >
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
          {regenerateMessage && <p className="text-xs text-amber-500 text-center">{regenerateMessage}</p>}
        </>
      )}
    </div>
  );
}
