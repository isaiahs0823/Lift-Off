import React from "react";
import { MessageCircle, Flame, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { computeWeeklyReview } from "../utils/weeklyReview.js";
import { generateWeeklyReview } from "../services/coachService.js";
import ShareCardButton from "./ShareCardButton.jsx";
import { buildWeeklyReviewShareCard } from "../utils/shareCard.js";
import { hasSchedule, computeScheduleAdherence, computeScheduleStreak } from "../utils/weeklySchedule.js";
import { muscleVolumeTrend } from "../utils/muscleVolume.js";

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus };
const TREND_COLOR = { up: "text-green-500", down: "text-v5-red", flat: "text-v5-subtext" };

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

export default function WeeklyReviewCard({ state, exMap }) {
  const review = computeWeeklyReview(state, 7);
  const scheduled = hasSchedule(state);
  const scheduleAdherence = scheduled ? computeScheduleAdherence(state, 7) : null;
  const streak = scheduled ? computeScheduleStreak(state) : 0;
  // Bodybuilding-specific (section 19) — visual-only, doesn't change the Coach line's own text.
  const isBodybuilding = state.athleteProfile?.coachSpecialty === "bodybuilding";
  const muscleTrend = isBodybuilding && exMap ? muscleVolumeTrend(state, exMap) : null;
  const muscleEntries = muscleTrend ? Object.entries(muscleTrend) : [];

  return (
    <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Weekly review</div>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-v5-red font-bold">
            <Flame size={12} /> {streak} day{streak === 1 ? "" : "s"} on plan
          </div>
        )}
      </div>

      {scheduleAdherence && (
        <div className="border border-white/[0.06] bg-v5-surface p-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Weekly plan</div>
          {scheduleAdherence.lifting.scheduled > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-v5-subtext">Lifting</span>
              <span className="text-white font-bold">{scheduleAdherence.lifting.completed}/{scheduleAdherence.lifting.scheduled}</span>
            </div>
          )}
          {scheduleAdherence.conditioning.scheduled > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-v5-subtext">Conditioning</span>
              <span className="text-white font-bold">{scheduleAdherence.conditioning.completed}/{scheduleAdherence.conditioning.scheduled}</span>
            </div>
          )}
          {scheduleAdherence.recovery.scheduled > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-v5-subtext">Recovery</span>
              <span className="text-white font-bold">{scheduleAdherence.recovery.completed}/{scheduleAdherence.recovery.scheduled}</span>
            </div>
          )}
          {scheduleAdherence.restDays > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-v5-subtext">Rest days</span>
              <span className="text-white font-bold">{scheduleAdherence.restDays}</span>
            </div>
          )}
          {scheduleAdherence.overall != null && (
            <div className="flex items-center justify-between text-sm border-t border-white/10 pt-1.5 mt-1.5">
              <span className="text-v5-subtext">Overall adherence</span>
              <span className="text-white font-bold">{scheduleAdherence.overall}%</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Training</div>
          <div className="text-white font-bold">
            {review.sessionsCompleted}
            {review.plannedSessions != null ? `/${review.plannedSessions}` : ""} sessions
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Bodyweight</div>
          <div className="text-white font-bold">{fmtDelta(review.weightTrend)} lb avg</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Strength</div>
          <div className="text-white font-bold">{STRENGTH_LABEL[review.strengthTrend]}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext">PRs</div>
          <div className="text-white font-bold">{review.prCount}</div>
        </div>
        {review.cardioTarget != null && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Conditioning</div>
            <div className="text-white font-bold">
              {review.cardioCompleted}/{review.cardioTarget} completed
            </div>
          </div>
        )}
        {review.avgReadiness != null && (
          <div>
            <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Avg readiness</div>
            <div className="text-white font-bold">{review.avgReadiness}</div>
          </div>
        )}
      </div>

      {review.activeGoals.length > 0 && (
        <div className="text-xs text-v5-subtext border-t border-white/[0.06] pt-3">
          Tracking {review.activeGoals.length} active goal{review.activeGoals.length > 1 ? "s" : ""}:{" "}
          {review.activeGoals.map((g) => g.title).join(", ")}
        </div>
      )}

      {review.weakestArea && (
        <div className="text-xs text-v5-subtext border-t border-white/[0.06] pt-3">
          Weakest area this week: <span className="text-white">{review.weakestArea.label}</span> ({review.weakestArea.pct}%)
        </div>
      )}

      {muscleEntries.length > 0 && (
        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext mb-1.5">Muscle progression</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {muscleEntries.map(([muscle, trend]) => {
              const Icon = TREND_ICON[trend];
              return (
                <div key={muscle} className="flex items-center justify-between text-sm">
                  <span className="text-v5-subtext">{muscle}</span>
                  <Icon size={13} className={TREND_COLOR[trend]} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-t border-white/[0.06] pt-3">
        <div className="text-[10px] uppercase tracking-widest text-v5-red mb-1 flex items-center gap-1.5">
          <MessageCircle size={11} /> Coach
        </div>
        <div className="text-sm text-v5-text/90">{generateWeeklyReview(review, scheduleAdherence).message}</div>
      </div>

      <div className="border-t border-white/[0.06] pt-3">
        <ShareCardButton buildDataUrl={() => buildWeeklyReviewShareCard(review)} filename="brk-lift-weekly-review.png" />
      </div>
    </div>
  );
}
