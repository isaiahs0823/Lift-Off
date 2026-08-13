import React from "react";
import { computeWeeklyReview } from "../utils/weeklyReview.js";

const STRENGTH_LABEL = {
  improving: "Improving",
  stable: "Stable",
  declining: "Declining",
  insufficient_data: "Not enough data",
};

function fmtDelta(v, digits = 1) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

export default function WeeklyReviewCard({ state }) {
  const review = computeWeeklyReview(state, 7);

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-red-600">Weekly review</div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Training</div>
          <div className="text-white font-bold">
            {review.sessionsCompleted}
            {review.plannedSessions != null ? `/${review.plannedSessions}` : ""} sessions
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Bodyweight</div>
          <div className="text-white font-bold">{fmtDelta(review.weightTrend)} lb avg</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Strength</div>
          <div className="text-white font-bold">{STRENGTH_LABEL[review.strengthTrend]}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">PRs</div>
          <div className="text-white font-bold">{review.prCount}</div>
        </div>
        {review.cardioTarget != null && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Conditioning</div>
            <div className="text-white font-bold">
              {review.cardioCompleted}/{review.cardioTarget} completed
            </div>
          </div>
        )}
        {review.avgReadiness != null && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Avg readiness</div>
            <div className="text-white font-bold">{review.avgReadiness}</div>
          </div>
        )}
      </div>

      {review.activeGoals.length > 0 && (
        <div className="text-xs text-neutral-400 border-t border-neutral-900 pt-3">
          Tracking {review.activeGoals.length} active goal{review.activeGoals.length > 1 ? "s" : ""}:{" "}
          {review.activeGoals.map((g) => g.title).join(", ")}
        </div>
      )}

      {review.weakestArea && (
        <div className="text-xs text-neutral-400 border-t border-neutral-900 pt-3">
          Weakest area this week: <span className="text-white">{review.weakestArea.label}</span> ({review.weakestArea.pct}%)
        </div>
      )}
    </div>
  );
}
