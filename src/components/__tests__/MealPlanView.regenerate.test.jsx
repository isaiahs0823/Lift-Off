import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import MealPlanView from "../MealPlanView.jsx";
import { generateMealPlan } from "../../utils/mealPlanGenerator.js";

// Regression coverage for the "Regenerate does nothing" bug report: generateMealPlan was a pure
// function of (profile, targets), so tapping Regenerate called it again with the exact same
// inputs and silently re-saved an identical plan — the tap wasn't ignored and nothing failed to
// save, it just produced the same result every time, which looked exactly like nothing happened.
// These tests exercise the actual MealPlanView component (not just the generator) to confirm the
// fix end-to-end: a real tap saves a genuinely different plan, a rapid double-tap only submits
// once, and exhausting every attempt (mocked) leaves the current plan untouched with a clear
// message instead of silently failing again.

function text(node) {
  if (node == null || typeof node === "string" || typeof node === "number") return String(node ?? "");
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "object") return text(node.children);
  return "";
}
function findAllButtons(node) {
  const out = [];
  (function walk(n) {
    if (n == null || typeof n !== "object") return;
    if (n.type === "button") out.push(n);
    for (const child of [].concat(n.children || [])) walk(child);
  })(node);
  return out;
}
function regenerateButton(root) {
  return findAllButtons(root.toJSON()).find((b) => /regenerate/i.test(text(b.children)));
}

const profile = { trainingTime: "0500", mealsPerDayPreference: 3, dietaryRestrictions: [], allergies: [], dislikedFoods: [], preferredFoods: [] };
const targets = { calories: 2800, protein: 190, carbs: 300, fat: 80 };

function baseState(overrides = {}) {
  return {
    nutritionProfile: profile,
    nutritionTargets: targets,
    nutritionMealPlan: generateMealPlan(profile, targets, { variation: 0 }),
    ...overrides,
  };
}

describe("MealPlanView — Regenerate produces an actually different, saved plan", () => {
  it("tapping Regenerate once saves a meaningfully different plan with an incremented variation", () => {
    const state = baseState();
    const updateState = vi.fn((updater) => {
      state.nutritionMealPlan = updater(state).nutritionMealPlan;
    });
    let root;
    act(() => {
      root = TestRenderer.create(<MealPlanView state={state} updateState={updateState} onBack={vi.fn()} />);
    });
    const before = state.nutritionMealPlan;
    act(() => regenerateButton(root).props.onClick());
    expect(updateState).toHaveBeenCalledTimes(1);
    expect(state.nutritionMealPlan).not.toBe(before);
    expect(state.nutritionMealPlan.variation).toBe(1);
  });

  it("a rapid double-tap (two synchronous clicks before any re-render) only submits once", () => {
    const state = baseState();
    const updateState = vi.fn((updater) => {
      state.nutritionMealPlan = updater(state).nutritionMealPlan;
    });
    let root;
    act(() => {
      root = TestRenderer.create(<MealPlanView state={state} updateState={updateState} onBack={vi.fn()} />);
    });
    act(() => {
      const btn = regenerateButton(root);
      // Two calls in the same act() — simulates two taps landing before React has committed the
      // disabled-button re-render from the first one. The ref guard (not the isRegenerating state)
      // is what has to catch this.
      btn.props.onClick();
      btn.props.onClick();
    });
    expect(updateState).toHaveBeenCalledTimes(1);
  });

  it("surviving a refresh means the saved plan's own variation is what the next regenerate continues from", () => {
    // Simulates: regenerate once, then reload the app (a fresh MealPlanView mount reading the
    // already-persisted nutritionMealPlan, exactly like a real refresh would).
    const state = baseState();
    const updateState = vi.fn((updater) => {
      state.nutritionMealPlan = updater(state).nutritionMealPlan;
    });
    let root;
    act(() => {
      root = TestRenderer.create(<MealPlanView state={state} updateState={updateState} onBack={vi.fn()} />);
    });
    act(() => regenerateButton(root).props.onClick());
    expect(state.nutritionMealPlan.variation).toBe(1);

    // Fresh mount with the persisted state — a stand-in for a real page refresh.
    act(() => {
      root = TestRenderer.create(<MealPlanView state={state} updateState={updateState} onBack={vi.fn()} />);
    });
    act(() => regenerateButton(root).props.onClick());
    expect(state.nutritionMealPlan.variation).toBe(2); // continues forward, doesn't restart from 0/1
  });
});

describe("MealPlanView — Regenerate when no different plan is available", () => {
  it("keeps the current plan untouched and shows a clear message, without ever calling updateState with a new plan", async () => {
    vi.resetModules();
    vi.doMock("../../utils/mealPlanGenerator.js", async () => {
      const actual = await vi.importActual("../../utils/mealPlanGenerator.js");
      return {
        ...actual,
        // Every attempt returns the exact same plan regardless of variation — simulates an
        // exhausted/fully-restricted food pool with no valid alternative to offer.
        generateMealPlan: (p, t) => actual.generateMealPlan(p, t, { variation: 0 }),
      };
    });
    const { default: MealPlanViewMocked } = await import("../MealPlanView.jsx");

    const state = baseState();
    const originalPlan = state.nutritionMealPlan;
    const updateState = vi.fn();
    let root;
    act(() => {
      root = TestRenderer.create(<MealPlanViewMocked state={state} updateState={updateState} onBack={vi.fn()} />);
    });
    act(() => regenerateButton(root).props.onClick());

    expect(updateState).not.toHaveBeenCalled();
    expect(state.nutritionMealPlan).toBe(originalPlan); // untouched
    expect(text(root.toJSON())).toMatch(/no different plan is available with your current preferences/i);

    vi.doUnmock("../../utils/mealPlanGenerator.js");
  });
});

describe("MealPlanView — Regenerate when generation throws", () => {
  it("shows a retry message and leaves the plan untouched on error, then succeeds on a later retry", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    let callCount = 0;
    vi.doMock("../../utils/mealPlanGenerator.js", async () => {
      const actual = await vi.importActual("../../utils/mealPlanGenerator.js");
      return {
        ...actual,
        generateMealPlan: (...args) => {
          callCount++;
          if (callCount === 1) throw new Error("boom");
          return actual.generateMealPlan(...args);
        },
      };
    });
    const { default: MealPlanViewMocked } = await import("../MealPlanView.jsx");

    const state = baseState();
    const originalPlan = state.nutritionMealPlan;
    const updateState = vi.fn((updater) => {
      state.nutritionMealPlan = updater(state).nutritionMealPlan;
    });
    let root;
    act(() => {
      root = TestRenderer.create(<MealPlanViewMocked state={state} updateState={updateState} onBack={vi.fn()} />);
    });

    // First tap: generateMealPlan throws.
    act(() => regenerateButton(root).props.onClick());
    expect(updateState).not.toHaveBeenCalled();
    expect(state.nutritionMealPlan).toBe(originalPlan); // untouched
    expect(text(root.toJSON())).toMatch(/something went wrong/i);

    // The guard's cooldown timer must still run (in `finally`) even though generation threw,
    // so the button is usable again rather than permanently stuck disabled.
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Retry: generateMealPlan now succeeds normally.
    act(() => regenerateButton(root).props.onClick());
    expect(updateState).toHaveBeenCalledTimes(1);
    expect(state.nutritionMealPlan).not.toBe(originalPlan);
    expect(state.nutritionMealPlan.variation).toBe(1);

    vi.doUnmock("../../utils/mealPlanGenerator.js");
    vi.useRealTimers();
  });
});
