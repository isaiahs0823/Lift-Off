import React from "react";
import { MessageCircle, Flame } from "lucide-react";
import { computeWeeklyReview } from "../utils/weeklyReview.js";
import { generateWeeklyReview } from "../services/coachService.js";
import ShareCardButton from "./ShareCardButton.jsx";
import { buildWeeklyReviewShareCard } from "../utils/shareCard.js";
import { hasSchedule, computeScheduleAdherence, computeScheduleStreak } from "../utils/weeklySchedule.js";

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
  const scheduled = hasSchedule(state);
  const scheduleAdherence = scheduled ? computeScheduleAdherence(state, 7) : null;
  const streak = scheduled ? computeScheduleStreak(state) : 0;

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Weekly review</div>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-red-500 font-bold">
            <Flame size={12} /> {streak} day{streak === 1 ? "" : "s"} on plan
          </div>
        )}
      </div>

      {scheduleAdherence && (
        <div className="border border-neutral-900 bg-charcoal-deep p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Weekly plan</div>
          {scheduleAdherence.lifting.scheduled > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Lifting</span>
              <span className="text-white font-bold">{scheduleAdherence.lifting.completed}/{scheduleAdherence.lifting.scheduled}</span>
            </div>
          )}
          {scheduleAdherence.conditioning.scheduled > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Conditioning</span>
              <span className="text-white font-bold">{scheduleAdherence.conditioning.completed}/{scheduleAdherence.conditioning.scheduled}</span>
            </div>
          )}
          {scheduleAdherence.recovery.scheduled > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Recovery</span>
              <span className="text-white font-bold">{scheduleAdherence.recovery.completed}/{scheduleAdherence.recovery.scheduled}</span>
            </div>
          )}
          {scheduleAdherence.restDays > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">Rest days</span>
              <span className="text-white font-bold">{scheduleAdherence.restDays}</span>
            </div>
          )}
          {scheduleAdherence.overall != null && (
            <div className="flex items-center justify-between text-sm border-t border-neutral-800 pt-1.5 mt-1.5">
              <span className="text-neutral-400">Overall adherence</span>
              <span className="text-white font-bold">{scheduleAdherence.overall}%</span>
            </div>
          )}
        </div>
      )}

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

      <div className="border-t border-neutral-900 pt-3">
        <div className="text-[10px] uppercase tracking-widest text-red-600 mb-1 flex items-center gap-1.5">
          <MessageCircle size={11} /> Coach
        </div>
        <div className="text-sm text-neutral-300">{generateWeeklyReview(review, scheduleAdherence).message}</div>
      </div>

      <div className="border-t border-neutral-900 pt-3">
        <ShareCardButton buildDataUrl={() => buildWeeklyReviewShareCard(review)} filename="brk-lift-weekly-review.png" />
      </div>
    </div>
  );
}
