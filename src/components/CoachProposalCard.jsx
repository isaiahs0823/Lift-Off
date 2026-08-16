import React, { useState } from "react";
import { createCommitment } from "../utils/commitments.js";
import { applyAdjustment } from "../services/nutritionCoachService.js";

// Renders under a specific chat message when that turn's tool call proposed a commitment or a
// nutrition target change (see coachConversations.js's extractProposalFromToolResults). Never
// mutates anything until the athlete taps a button — matches every other confirm-before-change
// flow already in BRK (spec section 11/12/37): the model can only propose, never write.
export default function CoachProposalCard({ proposal, updateState, onResolve }) {
  if (!proposal || proposal.status !== "pending") {
    if (proposal?.status && proposal.status !== "pending") {
      const label = proposal.status === "accepted" ? "Accepted" : proposal.status === "modified" ? "Accepted (modified)" : "Declined";
      return <div className="text-[11px] uppercase tracking-widest text-neutral-600 mt-2">{label}</div>;
    }
    return null;
  }
  if (proposal.proposalType === "commitment") return <CommitmentProposal proposal={proposal.proposal} updateState={updateState} onResolve={onResolve} />;
  if (proposal.proposalType === "nutrition_target_change") return <NutritionProposal proposal={proposal.proposal} updateState={updateState} onResolve={onResolve} />;
  return null;
}

function CommitmentProposal({ proposal, updateState, onResolve }) {
  const accept = () => {
    const commitment = createCommitment(proposal);
    updateState((prev) => ({ ...prev, commitments: [...(prev.commitments || []), commitment] }));
    onResolve("accepted");
  };
  const decline = () => onResolve("declined");

  return (
    <div className="mt-2 border border-red-900/40 bg-charcoal-panel p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-red-600">Proposed commitment</div>
      <div className="text-sm text-white font-bold">{proposal.text}</div>
      <div className="flex gap-2 pt-1">
        <button onClick={accept} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          Accept Commitment
        </button>
        <button onClick={decline} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
          Not Now
        </button>
      </div>
    </div>
  );
}

function NutritionProposal({ proposal, updateState, onResolve }) {
  const [modifying, setModifying] = useState(false);
  const [modifiedCalories, setModifiedCalories] = useState(String(proposal.toCalories));

  const apply = (action, calories) => {
    updateState((prev) => {
      const patch = applyAdjustment(prev, proposal, action, calories);
      return { ...prev, ...patch };
    });
    onResolve(action === "modify" ? "modified" : action === "decline" ? "declined" : "accepted");
  };

  return (
    <div className="mt-2 border border-red-900/40 bg-charcoal-panel p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-red-600">Proposed nutrition target change</div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Current</div>
          <div className="text-white font-bold">{proposal.fromCalories} kcal</div>
          <div className="text-neutral-500 text-xs">
            {proposal.fromMacros.protein}P · {proposal.fromMacros.carbs}C · {proposal.fromMacros.fat}F
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Proposed</div>
          <div className="text-white font-bold">{proposal.toCalories} kcal</div>
          <div className="text-neutral-500 text-xs">
            {proposal.toMacros.protein}P · {proposal.toMacros.carbs}C · {proposal.toMacros.fat}F
          </div>
        </div>
      </div>
      <div className="text-xs text-neutral-400">
        <span className="text-neutral-600 uppercase tracking-widest text-[10px]">Why — </span>
        {proposal.reason}
      </div>

      {modifying ? (
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-widest text-neutral-600">Calories</label>
          <input
            type="number"
            inputMode="decimal"
            value={modifiedCalories}
            onChange={(e) => setModifiedCalories(e.target.value)}
            className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
          />
          <div className="flex gap-2">
            <button onClick={() => apply("modify", Number(modifiedCalories) || proposal.toCalories)} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
              Save
            </button>
            <button onClick={() => setModifying(false)} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => apply("accepted")} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
            Accept
          </button>
          <button onClick={() => setModifying(true)} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
            Modify
          </button>
          <button onClick={() => apply("declined")} className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
