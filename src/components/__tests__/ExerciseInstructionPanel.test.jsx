import { it, expect } from "vitest";
import ExerciseInstructionPanel from "../ExerciseInstructionPanel.jsx";

// Same direct-call pattern as workoutChooser.test.jsx — ExerciseInstructionPanel takes no hooks
// of its own, so calling it as a plain function and walking the returned element tree is valid
// without a DOM renderer. Beginner Experience V2, Stage 2B fallback-chain coverage.
function text(element) {
  if (element == null || typeof element === "string" || typeof element === "number") return String(element ?? "");
  if (Array.isArray(element)) return element.map(text).join("");
  if (typeof element === "object" && element.props) return text(element.props.children);
  return "";
}
function findTag(element, tag) {
  if (element == null || typeof element !== "object") return null;
  if (element.type === tag) return element;
  const kids = [element.props?.children].flat(Infinity);
  for (const k of kids) {
    const found = findTag(k, tag);
    if (found) return found;
  }
  return null;
}

it("falls back to a safe 'no demonstration yet' state for an exercise with no manifest entry — never a broken element", () => {
  const el = ExerciseInstructionPanel({ exId: "totally_unknown_exercise_id", exerciseName: "Mystery Move" });
  expect(text(el)).toContain("No demonstration for Mystery Move yet");
  expect(findTag(el, "video")).toBeNull();
  expect(findTag(el, "img")).toBeNull();
});

it("renders plain-language instructions and a coaching cue for a known exercise (bench)", () => {
  const el = ExerciseInstructionPanel({ exId: "bench", exerciseName: "Barbell bench press" });
  const rendered = text(el);
  expect(rendered).toContain("Lie on the bench");
  expect(rendered).toContain("shoulder blades pulled together");
});

it("always renders the non-verified disclosure alongside any real content", () => {
  const el = ExerciseInstructionPanel({ exId: "bench", exerciseName: "Barbell bench press" });
  expect(text(el)).toContain("not professionally verified");
});

it("never renders a <video> or <img> element when no media exists, even though instructions exist", () => {
  const el = ExerciseInstructionPanel({ exId: "squat", exerciseName: "Squat" });
  expect(findTag(el, "video")).toBeNull();
  expect(findTag(el, "img")).toBeNull();
});
