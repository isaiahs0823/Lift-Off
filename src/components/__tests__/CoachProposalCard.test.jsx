import { it, expect, vi } from "vitest";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import CoachProposalCard from "../CoachProposalCard.jsx";

// Nutrition P0.1 fix coverage — the nutrition_target_change proposal card is the one real UI
// path that called applyAdjustment with a mismatched action word and mis-reported Decline as
// Accepted upstream (see nutritionCoachService.test.js's "modified" tests for the applyAdjustment
// half of this fix). react-test-renderer, no jsdom, matching ExerciseInstructionPanel.test.jsx.
function findAllButtons(node) {
  const out = [];
  (function walk(n) {
    if (n == null || typeof n !== "object") return;
    if (n.type === "button") out.push(n);
    for (const child of [].concat(n.children || [])) walk(child);
  })(node);
  return out;
}
function text(node) {
  if (node == null || typeof node === "string" || typeof node === "number") return String(node ?? "");
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "object") return text(node.children);
  return "";
}

const pendingProposal = {
  proposalType: "nutrition_target_change",
  status: "pending",
  proposal: {
    fromCalories: 2500,
    toCalories: 2350,
    fromMacros: { protein: 180, carbs: 250, fat: 70 },
    toMacros: { protein: 180, carbs: 212, fat: 70 },
    reason: "test reason",
  },
};

it("Accept reports 'accepted' upstream, not relabeled", () => {
  const onResolve = vi.fn();
  const updateState = vi.fn();
  let root;
  act(() => {
    root = TestRenderer.create(<CoachProposalCard proposal={pendingProposal} updateState={updateState} onResolve={onResolve} />);
  });
  const acceptBtn = findAllButtons(root.toJSON()).find((b) => text(b.children) === "Accept");
  act(() => acceptBtn.props.onClick());
  expect(onResolve).toHaveBeenCalledWith("accepted");
});

it("Decline reports 'declined' upstream — the fixed bug used to report this as 'accepted'", () => {
  const onResolve = vi.fn();
  const updateState = vi.fn();
  let root;
  act(() => {
    root = TestRenderer.create(<CoachProposalCard proposal={pendingProposal} updateState={updateState} onResolve={onResolve} />);
  });
  const declineBtn = findAllButtons(root.toJSON()).find((b) => text(b.children) === "Decline");
  act(() => declineBtn.props.onClick());
  expect(onResolve).toHaveBeenCalledWith("declined");
  expect(onResolve).not.toHaveBeenCalledWith("accepted");
});

it("Modify applies the typed calories via updateState and reports 'modified' upstream", () => {
  const onResolve = vi.fn();
  let capturedPatch = null;
  const updateState = (fn) => {
    capturedPatch = fn({ nutritionTargets: { calories: 2500, protein: 180, carbs: 250, fat: 70 }, nutritionCoachAdjustments: [] });
  };
  let root;
  act(() => {
    root = TestRenderer.create(<CoachProposalCard proposal={pendingProposal} updateState={updateState} onResolve={onResolve} />);
  });
  act(() => findAllButtons(root.toJSON()).find((b) => text(b.children) === "Modify").props.onClick());
  const input = root.root.findByType("input");
  act(() => input.props.onChange({ target: { value: "2600" } }));
  act(() => findAllButtons(root.toJSON()).find((b) => text(b.children) === "Save").props.onClick());

  expect(onResolve).toHaveBeenCalledWith("modified");
  expect(capturedPatch.nutritionTargets.calories).toBe(2600); // the typed value, not the original proposal.toCalories (2350)
});
