import React, { useState } from "react";

// Section 36 — no unexplained algorithmic changes. Every proposed calorie/macro change shows
// the WHY and requires an explicit choice; nothing here ever applies itself silently.
export default function NutritionAdjustmentCard({ proposal, onResolve }) {
  const [modifying, setModifying] = useState(false);
  const [modifiedCalories, setModifiedCalories] = useState(proposal?.toCalories ?? "");

  if (!proposal) return null;

  return (
    <div className="border-2 border-red-700 bg-charcoal-panel p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-red-600">Proposed change</div>
      <div className="flex items-center gap-3 text-lg font-bold">
        <span className="text-neutral-400">{proposal.fromCalories.toLocaleString()}</span>
        <span className="text-red-600">→</span>
        <span className="text-white">{proposal.toCalories.toLocaleString()} kcal</span>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1">Why</div>
        <div className="text-sm text-neutral-300">{proposal.reason}</div>
      </div>

      {modifying ? (
        <div className="space-y-2">
          <input
            type="number"
            value={modifiedCalories}
            onChange={(e) => setModifiedCalories(e.target.value)}
            className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(proposal, "modified", Number(modifiedCalories) || proposal.toCalories)}
              className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
            >
              Save
            </button>
            <button onClick={() => setModifying(false)} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onResolve(proposal, "accepted")}
            className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
          >
            Accept
          </button>
          <button onClick={() => setModifying(true)} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
            Modify
          </button>
          <button
            onClick={() => onResolve(proposal, "declined")}
            className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-500 hover:text-red-500"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
