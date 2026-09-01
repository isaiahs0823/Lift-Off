import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { computeExerciseAnalytics, computeOverallAnalytics } from "../utils/analytics.js";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus, insufficient_data: null };
const TREND_COLOR = { up: "text-green-500", down: "text-v5-red", flat: "text-v5-subtext", insufficient_data: "text-v5-subtext/70" };
const TREND_LABEL = { up: "Trending up", down: "Trending down", flat: "Flat", insufficient_data: "Not enough data" };

// Exercise detail/history — the one place in BRK where a larger "detail"-size anatomy figure is
// appropriate (see MuscleBodyOutline's size hierarchy), sitting next to the exercise name and
// muscle label above its performance summary, per BRK's anatomy-as-signature-feature direction.
function ExerciseAnalyticsCard({ exId, exMap, state }) {
  const exercise = exMap[exId];
  const stats = useMemo(() => computeExerciseAnalytics(exId, state.logs || []), [exId, state.logs]);
  const TrendIcon = stats ? TREND_ICON[stats.volumeTrend] : null;

  return (
    <div className="space-y-3">
      {exercise && (
        <div className="flex items-center gap-3">
          <MuscleBodyOutline exercise={exercise} size="detail" />
          <div className="min-w-0">
            <div className="text-lg font-bold text-white truncate">{exercise.name}</div>
            {exercise.muscle && <div className="text-xs text-v5-subtext mt-0.5">{exercise.muscle}</div>}
          </div>
        </div>
      )}
      {!stats ? (
        <div className="text-sm text-v5-subtext">No logs yet for this exercise.</div>
      ) : (
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Best set</div>
              <div className="text-white font-bold">{stats.bestSet ? `${stats.bestSet.weight} × ${stats.bestSet.reps}` : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Est. 1RM</div>
              <div className="text-white font-bold">{stats.estimatedOneRM} lb</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Recent working weight</div>
              <div className="text-white font-bold">{stats.recentWorkingWeight ?? "—"} lb</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Volume trend</div>
              <div className={`font-bold flex items-center gap-1 ${TREND_COLOR[stats.volumeTrend]}`}>
                {TrendIcon && <TrendIcon size={14} />} {TREND_LABEL[stats.volumeTrend]}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Avg RIR</div>
              <div className="text-white font-bold">{stats.avgRir ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext">Frequency</div>
              <div className="text-white font-bold">{stats.frequencyPerWeek}/week</div>
            </div>
          </div>
          <div className="text-xs text-v5-subtext border-t border-white/[0.06] pt-3">
            Last trained {new Date(stats.lastTrained).toLocaleDateString()} · {stats.totalSessions} sessions logged
          </div>
          {stats.prHistory.length > 0 && (
            <div className="border-t border-white/[0.06] pt-3">
              <div className="text-[10px] uppercase tracking-widest text-v5-subtext mb-1.5">PR history</div>
              <div className="space-y-1">
                {stats.prHistory.map((pr, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-v5-subtext">{new Date(pr.date).toLocaleDateString()}</span>
                    <span className="text-v5-text/90">
                      {pr.type === "weight" ? `${pr.value} lb` : `${pr.value} lb e1RM`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsTab({ state, allExercises, exMap }) {
  const trainedExIds = useMemo(() => [...new Set((state.logs || []).map((l) => l.exId))], [state.logs]);
  const [selectedExId, setSelectedExId] = useState(trainedExIds[0] || "");
  const overall = useMemo(() => computeOverallAnalytics(state, exMap), [state, exMap]);
  const maxVolume = Math.max(1, ...overall.weeklyVolume.map((w) => w.volume));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Weekly volume</div>
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
          {overall.weeklyVolume.map((w) => (
            <div key={w.weekLabel} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] text-v5-subtext">{w.weekLabel}</span>
              <div className="flex-1 h-4 bg-v5-surface border border-white/[0.06]">
                <div className="h-full bg-v5-red" style={{ width: `${(w.volume / maxVolume) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-[11px] text-v5-subtext">{w.volume.toLocaleString()}</span>
            </div>
          ))}
          {overall.avgDurationMin != null && (
            <div className="text-xs text-v5-subtext border-t border-white/[0.06] pt-2">Average session: {overall.avgDurationMin} min</div>
          )}
        </div>
      </div>

      {overall.muscleFrequency.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Muscle group frequency</div>
          <div className="border border-white/10 bg-v5-elevated p-4 space-y-1.5">
            {overall.muscleFrequency.slice(0, 8).map((m) => (
              <div key={m.muscle} className="flex items-center justify-between text-sm">
                <span className="text-v5-text/90">{m.muscle}</span>
                <span className="text-v5-subtext">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(overall.improving.length > 0 || overall.declining.length > 0 || overall.stalled.length > 0) && (
        <div className="grid grid-cols-1 gap-3">
          {overall.improving.length > 0 && (
            <div className="border border-green-900/40 bg-v5-elevated p-4">
              <div className="text-[11px] uppercase tracking-widest text-green-500 mb-2 flex items-center gap-1.5">
                <TrendingUp size={12} /> Improving
              </div>
              {overall.improving.map((l) => (
                <div key={l.exId} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-v5-text/90">{l.name}</span>
                  <span className="text-green-500">+{l.pctChange}%</span>
                </div>
              ))}
            </div>
          )}
          {overall.declining.length > 0 && (
            <div className="border border-v5-red/25 bg-v5-elevated p-4">
              <div className="text-[11px] uppercase tracking-widest text-v5-red mb-2 flex items-center gap-1.5">
                <TrendingDown size={12} /> Declining
              </div>
              {overall.declining.map((l) => (
                <div key={l.exId} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-v5-text/90">{l.name}</span>
                  <span className="text-v5-red">{l.pctChange}%</span>
                </div>
              ))}
            </div>
          )}
          {overall.stalled.length > 0 && (
            <div className="border border-white/10 bg-v5-elevated p-4">
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Stalled (3 sessions, same weight, target missed)</div>
              {overall.stalled.map((l) => (
                <div key={l.exId} className="text-sm text-v5-text/90 py-0.5">
                  {l.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Per-exercise</div>
        {trainedExIds.length === 0 ? (
          <div className="text-sm text-v5-subtext">Log a few sessions to see per-exercise analytics.</div>
        ) : (
          <>
            <select
              value={selectedExId}
              onChange={(e) => setSelectedExId(e.target.value)}
              className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:border-v5-red mb-3"
            >
              {trainedExIds.map((id) => (
                <option key={id} value={id}>
                  {exMap[id]?.name || id}
                </option>
              ))}
            </select>
            <ExerciseAnalyticsCard exId={selectedExId} exMap={exMap} state={state} />
          </>
        )}
      </div>
    </div>
  );
}
