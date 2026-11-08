import { it, expect, vi, describe } from "vitest";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import ExerciseDiscoveryScreen from "../ExerciseDiscoveryScreen.jsx";

// A small, realistic fixture spanning several real muscle zones — not the full ~300-exercise
// catalog, but exercises with the same real shape ({id, name, type, muscle}) and names that
// exercise getMuscleDisplay's actual keyword rules, so "which zone does this land in" is the
// same logic the real app uses, not a test-only shortcut.
const allExercises = [
  { id: "bench", name: "Barbell bench press", type: "compound", muscle: "Chest" },
  { id: "db_shoulder_press", name: "Dumbbell shoulder press", type: "compound", muscle: "Shoulders" },
  { id: "barbell_curl", name: "Barbell curl", type: "isolation", muscle: "Arms" },
  { id: "deadlift", name: "Deadlift", type: "compound", muscle: "Back" },
  { id: "leg_press", name: "Leg press", type: "compound", muscle: "Legs" },
];
const exMap = Object.fromEntries(allExercises.map((e) => [e.id, e]));

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
function clickByText(root, label) {
  const btn = findAllButtons(root.toJSON()).find((b) => text(b.children).includes(label));
  expect(btn, `button containing "${label}" should exist`).toBeTruthy();
  act(() => btn.props.onClick());
}

function renderScreen(props = {}) {
  let root;
  act(() => {
    root = TestRenderer.create(
      <ExerciseDiscoveryScreen
        allExercises={allExercises}
        exMap={exMap}
        activeRun={null}
        onBack={() => {}}
        onStartRun={() => {}}
        onAddToActiveRun={() => {}}
        {...props}
      />
    );
  });
  return root;
}

describe("ExerciseDiscoveryScreen — muscle selection and filtering", () => {
  it("shows a real, non-fabricated per-zone exercise count on the muscle grid", () => {
    const root = renderScreen();
    expect(text(root.toJSON())).toContain("Chest");
    expect(text(root.toJSON())).toContain("1 exercise"); // exactly one Chest exercise in the fixture
  });

  it("selecting a muscle shows only exercises whose real catalog muscle/name resolve to that zone", () => {
    const root = renderScreen();
    clickByText(root, "Chest");
    const rendered = text(root.toJSON());
    expect(rendered).toContain("Barbell bench press");
    expect(rendered).not.toContain("Dumbbell shoulder press");
    expect(rendered).not.toContain("Deadlift");
  });

  it("selecting a different muscle (Shoulders) filters to a different, correct set", () => {
    const root = renderScreen();
    clickByText(root, "Shoulders");
    const rendered = text(root.toJSON());
    expect(rendered).toContain("Dumbbell shoulder press");
    expect(rendered).not.toContain("Barbell bench press");
  });
});

describe("ExerciseDiscoveryScreen — exercise detail", () => {
  it("opening an exercise shows its real equipment and movement-type labels, never fabricated ones", () => {
    const root = renderScreen();
    clickByText(root, "Chest");
    clickByText(root, "Barbell bench press");
    const rendered = text(root.toJSON());
    expect(rendered).toContain("Barbell");
    expect(rendered).toContain("Compound");
  });

  it("falls back to an honest 'Not specified' label when no equipment keyword matches", () => {
    const customExercises = [{ id: "arnold", name: "Arnold press", type: "compound", muscle: "Shoulders" }];
    const customExMap = { arnold: customExercises[0] };
    const root = renderScreen({ allExercises: customExercises, exMap: customExMap });
    clickByText(root, "Shoulders");
    clickByText(root, "Arnold press");
    expect(text(root.toJSON())).toContain("Not specified");
  });
});

describe("ExerciseDiscoveryScreen — Start Quick Workout (existing workout engine, no duplicate)", () => {
  it("Start Quick Workout calls onStartRun with a single-exercise plan shaped like every other entry point's", () => {
    const onStartRun = vi.fn();
    const root = renderScreen({ onStartRun });
    clickByText(root, "Chest");
    clickByText(root, "Barbell bench press");
    clickByText(root, "Start Quick Workout");
    expect(onStartRun).toHaveBeenCalledTimes(1);
    const [plan] = onStartRun.mock.calls[0];
    expect(plan.exercises).toEqual([{ exId: "bench", sets: 3 }]);
    expect(plan.name).toContain("Barbell bench press");
  });
});

describe("ExerciseDiscoveryScreen — Add to Current Workout (active-session preservation)", () => {
  it("is not offered at all when there is no active run — never a dead disabled button", () => {
    const root = renderScreen({ activeRun: null });
    clickByText(root, "Chest");
    clickByText(root, "Barbell bench press");
    const buttonLabels = findAllButtons(root.toJSON()).map((b) => text(b.children));
    expect(buttonLabels.some((l) => l.includes("Add to Current Workout"))).toBe(false);
    expect(text(root.toJSON())).toContain("Start a workout to add this exercise to it instead");
  });

  it("calls onAddToActiveRun with the exercise id (never mutating activeRun itself) when a run is active", () => {
    const onAddToActiveRun = vi.fn();
    const onBack = vi.fn();
    const activeRun = { finished: false, exercises: [{ exId: "deadlift", sets: 3 }], sessionEntries: [] };
    const root = renderScreen({ activeRun, onAddToActiveRun, onBack });
    clickByText(root, "Chest");
    clickByText(root, "Barbell bench press");
    clickByText(root, "Add to Current Workout");
    expect(onAddToActiveRun).toHaveBeenCalledWith("bench");
    expect(onBack).toHaveBeenCalledTimes(1); // returns to Train so the athlete sees the updated Resume card
  });

  it("does not offer Add to Current Workout once the active run is finished", () => {
    const activeRun = { finished: true, exercises: [], sessionEntries: [] };
    const root = renderScreen({ activeRun });
    clickByText(root, "Chest");
    clickByText(root, "Barbell bench press");
    const buttonLabels = findAllButtons(root.toJSON()).map((b) => text(b.children));
    expect(buttonLabels.some((l) => l.includes("Add to Current Workout"))).toBe(false);
  });
});
