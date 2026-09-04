import React from "react";
import { Star } from "lucide-react";

// Extracted from App.jsx as part of a safe, incremental decomposition pass — self-contained,
// only ever depended on props (state/exMap) plus this one local helper.
function usageCounts(logs) {
  const counts = {};
  logs.forEach((l) => {
    counts[l.exId] = (counts[l.exId] || 0) + 1;
  });
  return counts;
}

export default function TopUsedTab({ state, exMap }) {
  const counts = usageCounts(state.logs);
  const ranked = Object.entries(counts)
    .map(([exId, count]) => ({ ex: exMap[exId], count }))
    .filter((r) => r.ex)
    .sort((a, b) => b.count - a.count);

  if (ranked.length === 0) {
    return (
      <div className="text-center py-16 text-v5-subtext text-sm">
        No sessions logged yet. Log a workout and this tab tracks what you actually train most.
      </div>
    );
  }

  const max = ranked[0].count;

  return (
    <div className="space-y-3">
      <p className="text-xs text-v5-subtext">Ranked by how often you've logged each lift.</p>
      {ranked.map((r, i) => (
        <div key={r.ex.id} className="border border-white/10 bg-v5-elevated px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {i === 0 && <Star size={12} className="text-v5-red" />}
              <span className="text-base text-white">{r.ex.name}</span>
            </div>
            <span className="text-xs text-v5-subtext">{r.count}x</span>
          </div>
          <div className="h-1 bg-v5-surface">
            <div className="h-1 bg-v5-red" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
