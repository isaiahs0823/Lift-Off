import React, { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { computeExerciseAnalytics, computeOverallAnalytics } from "../utils/analytics.js";

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus, insufficient_data: null };
const TREND_COLOR = { up: "text-green-500", down: "text-red-500", flat: "text-neutral-400", insufficient_data: "text-neutral-600" };
const TREND_LABEL = { up: "Trending up", down: "Trending down", flat: "Flat", insufficient_data: "Not enough data" };

function ExerciseAnalyticsCard({ exId, exMap, state }) {
  const stats = useMemo(() => computeExerciseAnalytics(exId, state.logs || []), [exId, state.logs]);
  if (!stats) return <div className="text-sm text-neutral-500">No logs yet for this exercise.</div>;
  const TrendIcon = TREND_ICON[stats.volumeTrend];

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Best set</div>
          <div className="text-white font-bold">{stats.bestSet ? `${stats.bestSet.weight} × ${stats.bestSet.reps}` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Est. 1RM</div>
          <div className="text-white font-bold">{stats.estimatedOneRM} lb</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Recent working weight</div>
          <div className="text-white font-bold">{stats.recentWorkingWeight ?? "—"} lb</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Volume trend</div>
          <div className={`font-bold flex items-center gap-1 ${TREND_COLOR[stats.volumeTrend]}`}>
            {TrendIcon && <TrendIcon size={14} />} {TREND_LABEL[stats.volumeTrend]}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Avg RIR</div>
          <div className="text-white font-bold">{stats.avgRir ?? "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Frequency</div>
          <div className="text-white font-bold">{stats.frequencyPerWeek}/week</div>
        </div>
      </div>
      <div className="text-xs text-neutral-500 border-t border-neutral-900 pt-3">
        Last trained {new Date(stats.lastTrained).toLocaleDateString()} · {stats.totalSessions} sessions logged
      </div>
      {stats.prHistory.length > 0 && (
        <div className="border-t border-neutral-900 pt-3">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">PR history</div>
          <div className="space-y-1">
            {stats.prHistory.map((pr, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">{new Date(pr.date).toLocaleDateString()}</span>
                <span className="text-neutral-300">
                  {pr.type === "weight" ? `${pr.value} lb` : `${pr.value} lb e1RM`}
                </span>
              </div>
            ))}
          </div>
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
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Weekly volume</div>
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-2">
          {overall.weeklyVolume.map((w) => (
            <div key={w.weekLabel} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] text-neutral-500">{w.weekLabel}</span>
              <div className="flex-1 h-4 bg-charcoal-deep border border-neutral-900">
                <div className="h-full bg-red-700" style={{ width: `${(w.volume / maxVolume) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-[11px] text-neutral-400">{w.volume.toLocaleString()}</span>
            </div>
          ))}
          {overall.avgDurationMin != null && (
            <div className="text-xs text-neutral-500 border-t border-neutral-900 pt-2">Average session: {overall.avgDurationMin} min</div>
          )}
        </div>
      </div>

      {overall.muscleFrequency.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Muscle group frequency</div>
          <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-1.5">
            {overall.muscleFrequency.slice(0, 8).map((m) => (
              <div key={m.muscle} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300">{m.muscle}</span>
                <span className="text-neutral-500">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(overall.improving.length > 0 || overall.declining.length > 0 || overall.stalled.length > 0) && (
        <div className="grid grid-cols-1 gap-3">
          {overall.improving.length > 0 && (
            <div className="border border-green-900/40 bg-charcoal-panel p-4">
              <div className="text-[11px] uppercase tracking-widest text-green-500 mb-2 flex items-center gap-1.5">
                <TrendingUp size={12} /> Improving
              </div>
              {overall.improving.map((l) => (
                <div key={l.exId} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-neutral-300">{l.name}</span>
                  <span className="text-green-500">+{l.pctChange}%</span>
                </div>
              ))}
            </div>
          )}
          {overall.declining.length > 0 && (
            <div className="border border-red-900/40 bg-charcoal-panel p-4">
              <div className="text-[11px] uppercase tracking-widest text-red-500 mb-2 flex items-center gap-1.5">
                <TrendingDown size={12} /> Declining
              </div>
              {overall.declining.map((l) => (
                <div key={l.exId} className="flex items-center justify-between text-sm py-0.5">
                  <span className="text-neutral-300">{l.name}</span>
                  <span className="text-red-500">{l.pctChange}%</span>
                </div>
              ))}
            </div>
          )}
          {overall.stalled.length > 0 && (
            <div className="border border-neutral-800 bg-charcoal-panel p-4">
              <div className="text-[11px] uppercase tracking-widest text-neutral-400 mb-2">Stalled (3 sessions, same weight, target missed)</div>
              {overall.stalled.map((l) => (
                <div key={l.exId} className="text-sm text-neutral-300 py-0.5">
                  {l.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Per-exercise</div>
        {trainedExIds.length === 0 ? (
          <div className="text-sm text-neutral-500">Log a few sessions to see per-exercise analytics.</div>
        ) : (
          <>
            <select
              value={selectedExId}
              onChange={(e) => setSelectedExId(e.target.value)}
              className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700 mb-3"
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
