import { it, expect, vi, describe } from "vitest";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import AthleteMuscleMap from "../AthleteMuscleMap.jsx";

// mode="zones" (added for Exercise Discovery) must leave the default mode="ratings" behavior
// (Progress's existing Muscle Map) completely unchanged — every assertion below checks that
// explicitly alongside the new behavior.

function findClickablePaths(root) {
  return root.root.findAllByType("path").filter((p) => typeof p.props.onClick === "function");
}

describe("AthleteMuscleMap — default mode='ratings' (Progress's Muscle Map, unchanged)", () => {
  it("only the 8 rating-group zones are clickable — abs/full are not, even in a view that draws them", () => {
    const onSelectZone = vi.fn();
    let root;
    act(() => {
      root = TestRenderer.create(<AthleteMuscleMap ratings={{}} view="front" onSelectZone={onSelectZone} />);
    });
    for (const p of findClickablePaths(root)) {
      act(() => p.props.onClick());
    }
    const calledWith = onSelectZone.mock.calls.map((c) => c[0]);
    expect(calledWith.length).toBeGreaterThan(0);
    expect(calledWith.every((g) => ["chest", "back", "shoulders", "arms", "quads", "hamstrings", "glutes", "calves"].includes(g))).toBe(true);
    expect(calledWith).not.toContain("abs");
  });

  it("colors a zone by its rating score, not a neutral tone", () => {
    let root;
    act(() => {
      root = TestRenderer.create(<AthleteMuscleMap ratings={{ chest: { score: 80 } }} view="front" onSelectZone={() => {}} />);
    });
    const chestPaths = root.root.findAllByType("path").filter((p) => typeof p.props.fill === "string" && p.props.fill.startsWith("rgb("));
    expect(chestPaths.length).toBeGreaterThan(0);
  });
});

describe("AthleteMuscleMap — mode='zones' (Exercise Discovery)", () => {
  it("every real anatomy zone this SVG draws is individually clickable, including abs", () => {
    const onSelectZone = vi.fn();
    let root;
    act(() => {
      root = TestRenderer.create(<AthleteMuscleMap mode="zones" view="front" onSelectZone={onSelectZone} />);
    });
    for (const p of findClickablePaths(root)) {
      act(() => p.props.onClick());
    }
    const calledWith = new Set(onSelectZone.mock.calls.map((c) => c[0]));
    expect(calledWith.has("abs")).toBe(true);
    expect(calledWith.has("chest")).toBe(true);
    expect(calledWith.has("biceps")).toBe(true); // distinct from the ratings mode's folded "arms" group
  });

  it("the selected zone is visibly highlighted (stroke) while others are not", () => {
    let root;
    act(() => {
      root = TestRenderer.create(<AthleteMuscleMap mode="zones" view="front" selected="chest" onSelectZone={() => {}} />);
    });
    const selectedPaths = root.root.findAllByType("path").filter((p) => p.props.strokeWidth === 1.5);
    const unselectedPaths = root.root.findAllByType("path").filter((p) => p.props.strokeWidth === 0.75);
    expect(selectedPaths.length).toBeGreaterThan(0);
    expect(unselectedPaths.length).toBeGreaterThan(0);
  });
});
