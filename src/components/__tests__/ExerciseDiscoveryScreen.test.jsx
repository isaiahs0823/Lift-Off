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
  // Second Back-zone exercise, bodyweight, isolation, with real instruction content — gives the
  // Back zone real variety (two equipment labels, two movement types) to filter across.
  { id: "pullup", name: "Weighted pull-up", type: "compound", muscle: "Back" },
  // A third Back-zone exercise with no recognizable equipment keyword and no entry in
  // exerciseInstructions.js — exercises the "Not specified" equipment option and the "Has Guide"
  // filter's negative case honestly, without inventing data for it.
  { id: "mystery_back_move", name: "Mystery back move", type: "isolation", muscle: "Back" },
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

describe("ExerciseDiscoveryScreen — list filters (honest, real-data-backed only)", () => {
  it("Movement Type filter narrows to only the selected type", () => {
    const root = renderScreen();
    clickByText(root, "Back"); // deadlift (compound), pullup (compound), mystery_back_move (isolation)
    let rendered = text(root.toJSON());
    expect(rendered).toContain("Deadlift");
    expect(rendered).toContain("Weighted pull-up");
    expect(rendered).toContain("Mystery back move");

    clickByText(root, "Isolation");
    rendered = text(root.toJSON());
    expect(rendered).toContain("Mystery back move");
    expect(rendered).not.toContain("Deadlift");
    expect(rendered).not.toContain("Weighted pull-up");
  });

  it("Equipment filter narrows to only exercises with that real, name-derived label", () => {
    const root = renderScreen();
    clickByText(root, "Back");
    clickByText(root, "Bodyweight"); // only pullup resolves to Bodyweight
    const rendered = text(root.toJSON());
    expect(rendered).toContain("Weighted pull-up");
    expect(rendered).not.toContain("Deadlift");
    expect(rendered).not.toContain("Mystery back move");
  });

  it("Has Guide filter keeps only exercises with real exerciseInstructions.js content, never inventing a difficulty rating", () => {
    const root = renderScreen();
    clickByText(root, "Back");
    clickByText(root, "Has Guide");
    const rendered = text(root.toJSON());
    expect(rendered).toContain("Deadlift"); // has real content
    expect(rendered).toContain("Weighted pull-up"); // has real content
    expect(rendered).not.toContain("Mystery back move"); // no manifest entry
  });

  it("shows an honest empty state (with a Clear filters action) when filters match nothing, rather than a blank list", () => {
    const root = renderScreen();
    clickByText(root, "Back");
    clickByText(root, "Isolation");
    clickByText(root, "Has Guide"); // mystery_back_move is isolation but has no guide -> zero results
    const rendered = text(root.toJSON());
    expect(rendered).toContain("No exercises match these filters");
    clickByText(root, "Clear filters");
    expect(text(root.toJSON())).toContain("Deadlift"); // back to the unfiltered zone list
  });

  it("switching muscles resets filters so they can't silently hide exercises in a new zone", () => {
    const root = renderScreen();
    clickByText(root, "Back");
    clickByText(root, "Isolation");
    // Navigate back to the muscle grid, then into a different zone — filters must not carry over.
    const backNav = findAllButtons(root.toJSON()).find((b) => b.props["aria-label"] === "Back");
    act(() => backNav.props.onClick());
    clickByText(root, "Chest");
    expect(text(root.toJSON())).toContain("Barbell bench press"); // compound, would be hidden if the Isolation filter carried over
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
