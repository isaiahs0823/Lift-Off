import { formatSessionDuration } from "../utils/workoutSets.js";
import { PR_TYPE_LABEL, prHeroLabel, prDeltaLabel } from "../utils/prSummary.js";
import { buildWorkoutRecap } from "../utils/workoutRecap.js";
import { SET_QUALITY_LABEL, painSummaryLabel } from "../utils/workoutQuality.js";
import { Award } from "lucide-react";

// Auto Post-Workout Recap (task Part 1) — a short, factual coaching recap, not an analytics
// dump. Tone per task section 3: concise, training-focused, no "AMAZING WORKOUT!" Reused as-is
// both right after Finish Workout (GuidedRunView passes no onBack — it supplies its own
// surrounding header/actions) and from Workout History → Session → Recap (App.jsx's
// `sessionRecap` tab passes onBack, so this renders its own small back row).
export default function SessionRecapView({ session, state, exMap, onBack, onViewFullSession }) {
  if (!session) {
    return (
      <div className="space-y-4">
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
            ← Back
          </button>
        )}
        <div className="text-sm text-neutral-500">Session not found.</div>
      </div>
    );
  }

  const recap = buildWorkoutRecap({ session, logs: state.logs || [], exMap, state });
  if (!recap) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">{recap.planName}</div>
          <div className="text-xl font-bold text-white mt-0.5">Session recap</div>
          <div className="text-sm text-neutral-400 mt-0.5">{formatSessionDuration(recap.durationSec)}</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="shrink-0 text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
            ← Back
          </button>
        )}
      </div>

      {recap.alternateGym && (
        <div className="border border-neutral-800 bg-charcoal-panel p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-red-600 font-bold">Alternate gym session</div>
          {recap.alternateGym.locationLabel && <div className="text-sm text-neutral-200">{recap.alternateGym.locationLabel}</div>}
          {recap.alternateGym.differentEquipmentCount > 0 ? (
            <div className="text-xs text-neutral-500">
              {recap.alternateGym.differentEquipmentCount} exercise{recap.alternateGym.differentEquipmentCount === 1 ? "" : "s"} used different
              equipment. Direct load comparisons excluded where appropriate.
            </div>
          ) : (
            <div className="text-xs text-neutral-500">No equipment differences flagged this session.</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Exercises</div>
          <div className="text-lg font-bold text-white">{recap.exerciseCount}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Working sets</div>
          <div className="text-lg font-bold text-white">{recap.workingSets}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Volume</div>
          <div className="text-lg font-bold text-white">{recap.totalVolume.toLocaleString()} lb</div>
        </div>
      </div>

      {recap.bestLift && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Top set</div>
          <div className="text-base font-bold text-white">{exMap[recap.bestLift.exId]?.name || recap.bestLift.exId}</div>
          <div className="text-2xl font-bold text-white">
            {recap.bestLift.weight} × {recap.bestLift.reps}
          </div>
        </div>
      )}

      {recap.wins.length > 0 && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-2.5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Progression</div>
          {recap.wins.map((w) => (
            <div key={w.exId} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-neutral-300 truncate">{w.name}</span>
              <span className="text-green-500 font-bold shrink-0">{w.progression.message}</span>
            </div>
          ))}
        </div>
      )}

      {recap.prs.length > 0 && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-2.5">
          <div className="text-[10px] uppercase tracking-widest text-red-600 font-bold flex items-center gap-1.5">
            <Award size={12} /> New PR
          </div>
          {recap.prs.map((pr, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white truncate">{exMap[pr.exId]?.name || pr.exId}</span>
                <span className="text-green-500 font-bold text-xs shrink-0">{prDeltaLabel(pr)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>
                  {prHeroLabel(pr)} · {PR_TYPE_LABEL[pr.type]}
                </span>
                {pr.qualityFlag && (
                  <span className="text-[9px] uppercase tracking-widest bg-neutral-800 text-neutral-300 px-1.5 py-0.5">
                    {/* Task section 7: Grind is a softer PR label ("Grind") — not presented as
                        identical evidence to a Form Breakdown/Pain PR, which reads "X flagged." */}
                    {pr.qualityFlag === "grind" ? SET_QUALITY_LABEL.grind : `${SET_QUALITY_LABEL[pr.qualityFlag]} flagged`}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(recap.attention.length > 0 || recap.declines.length > 0) && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Attention</div>
          {recap.attention.map((e) => (
            <div key={e.exId} className="space-y-0.5">
              <div className="text-sm font-bold text-white">{e.name}</div>
              {e.painSummary && <div className="text-xs text-red-500">{painSummaryLabel(e.painSummary)}</div>}
              <div className="text-xs text-neutral-400">
                {[
                  e.qualityCounts.grind > 0 ? `${e.qualityCounts.grind} set${e.qualityCounts.grind === 1 ? "" : "s"} marked Grind` : null,
                  e.qualityCounts.form_breakdown > 0
                    ? `${e.qualityCounts.form_breakdown} set${e.qualityCounts.form_breakdown === 1 ? "" : "s"} marked Form Breakdown`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          ))}
          {recap.declines
            .filter((e) => !e.hasAttention)
            .map((e) => (
              <div key={e.exId} className="space-y-0.5">
                <div className="text-sm font-bold text-white">{e.name}</div>
                <div className="text-xs text-neutral-400">{e.progression.message}</div>
              </div>
            ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-widest text-neutral-500">Next time</div>
        {recap.perExercise
          .filter((e) => e.nextTime)
          .map((e) => (
            <div key={e.exId} className="border-b border-neutral-900 pb-2.5 last:border-b-0">
              <div className="text-sm font-bold text-white">{e.name}</div>
              <div className="text-sm text-neutral-300">
                {e.nextTime.weight != null ? `Try ${e.nextTime.weight} × ${e.nextTime.repsLabel}` : e.nextTime.reason}
              </div>
              {e.nextTime.weight != null && <div className="text-xs text-neutral-600 mt-0.5">{e.nextTime.reason}</div>}
              {e.equipmentLabel !== "Default Machine" && <div className="text-[10px] text-neutral-600 mt-0.5">{e.equipmentLabel}</div>}
            </div>
          ))}
      </div>

      {onViewFullSession && (
        <button onClick={onViewFullSession} className="w-full text-center text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500 py-1">
          View full session
        </button>
      )}
    </div>
  );
}
