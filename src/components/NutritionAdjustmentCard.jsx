import React, { useState } from "react";

// Section 36 — no unexplained algorithmic changes. Every proposed calorie/macro change shows
// the WHY and requires an explicit choice; nothing here ever applies itself silently.
export default function NutritionAdjustmentCard({ proposal, onResolve }) {
  const [modifying, setModifying] = useState(false);
  const [modifiedCalories, setModifiedCalories] = useState(proposal?.toCalories ?? "");

  if (!proposal) return null;

  return (
    <div className="border-2 border-v5-red bg-v5-elevated p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-v5-red">Proposed change</div>
      <div className="flex items-center gap-3 text-lg font-bold">
        <span className="text-v5-subtext">{proposal.fromCalories.toLocaleString()}</span>
        <span className="text-v5-red">→</span>
        <span className="text-white">{proposal.toCalories.toLocaleString()} kcal</span>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-1">Why</div>
        <div className="text-sm text-v5-text/90">{proposal.reason}</div>
      </div>

      {modifying ? (
        <div className="space-y-2">
          <input
            type="number"
            value={modifiedCalories}
            onChange={(e) => setModifiedCalories(e.target.value)}
            className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onResolve(proposal, "modified", Number(modifiedCalories) || proposal.toCalories)}
              className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
            >
              Save
            </button>
            <button onClick={() => setModifying(false)} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => onResolve(proposal, "accepted")}
            className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
          >
            Accept
          </button>
          <button onClick={() => setModifying(true)} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
            Modify
          </button>
          <button
            onClick={() => onResolve(proposal, "declined")}
            className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:text-v5-red"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
