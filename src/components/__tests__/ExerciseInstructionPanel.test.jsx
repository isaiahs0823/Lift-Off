import { it, expect } from "vitest";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import ExerciseInstructionPanel from "../ExerciseInstructionPanel.jsx";

// Renders with react-test-renderer (no DOM/jsdom needed) since this component now holds its own
// tab state via useState — the plain-function-call pattern used elsewhere in this suite can't
// invoke hooks outside a real render. toJSON().children text is walked the same way the old
// direct-call tests walked element trees.
function text(node) {
  if (node == null || typeof node === "string" || typeof node === "number") return String(node ?? "");
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "object") return text(node.children);
  return "";
}
function findType(node, type) {
  if (node == null || typeof node !== "object") return null;
  if (node.type === type) return node;
  for (const child of [].concat(node.children || [])) {
    const found = findType(child, type);
    if (found) return found;
  }
  return null;
}

it("falls back to a safe 'no demonstration yet' state for an exercise with no manifest entry — never a broken element", () => {
  let root;
  act(() => {
    root = TestRenderer.create(<ExerciseInstructionPanel exId="totally_unknown_exercise_id" exerciseName="Mystery Move" />);
  });
  const tree = root.toJSON();
  expect(text(tree)).toContain("No demonstration for Mystery Move yet");
  expect(findType(tree, "video")).toBeNull();
  expect(findType(tree, "img")).toBeNull();
});

it("renders numbered How To steps and a Tips cue for a known exercise (bench), with no fabricated video", () => {
  let root;
  act(() => {
    root = TestRenderer.create(<ExerciseInstructionPanel exId="bench" exerciseName="Barbell bench press" />);
  });
  const tree = root.toJSON();
  expect(text(tree)).toContain("Lie on the bench");
  expect(findType(tree, "video")).toBeNull();
  expect(findType(tree, "img")).toBeNull();
  expect(text(tree)).toContain("No demonstration video yet");

  act(() => {
    root.root.findAllByType("button").find((b) => text(b.children) === "Tips")?.props.onClick();
  });
  expect(text(root.toJSON())).toContain("shoulder blades pulled together");
});

it("shows muscle data on the Muscles tab when provided, and an honest fallback when not", () => {
  let root;
  act(() => {
    root = TestRenderer.create(<ExerciseInstructionPanel exId="bench" exerciseName="Barbell bench press" muscle="Chest" />);
  });
  act(() => {
    root.root.findAllByType("button").find((b) => text(b.children) === "Muscles")?.props.onClick();
  });
  expect(text(root.toJSON())).toContain("Chest");

  let rootNoMuscle;
  act(() => {
    rootNoMuscle = TestRenderer.create(<ExerciseInstructionPanel exId="bench" exerciseName="Barbell bench press" />);
  });
  act(() => {
    rootNoMuscle.root.findAllByType("button").find((b) => text(b.children) === "Muscles")?.props.onClick();
  });
  expect(text(rootNoMuscle.toJSON())).toContain("Muscle data not available");
});

it("always renders the non-verified disclosure alongside any real content", () => {
  let root;
  act(() => {
    root = TestRenderer.create(<ExerciseInstructionPanel exId="bench" exerciseName="Barbell bench press" />);
  });
  expect(text(root.toJSON())).toContain("not professionally verified");
});

it("never renders a <video> or <img> element for a known exercise with no media, even with real instructions", () => {
  let root;
  act(() => {
    root = TestRenderer.create(<ExerciseInstructionPanel exId="squat" exerciseName="Squat" />);
  });
  const tree = root.toJSON();
  expect(findType(tree, "video")).toBeNull();
  expect(findType(tree, "img")).toBeNull();
});
