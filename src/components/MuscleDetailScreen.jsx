import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { ScreenHeader, Card, SectionLabel, LineChart } from "./ui/Kit.jsx";
import { MUSCLE_GROUP_LABEL, CONFIDENCE, explainMuscle, topExercisesForMuscle } from "../utils/athleteRating.js";

export default function MuscleDetailScreen({ group, state, exMap, onBack }) {
  const snapshots = state.athleteRatingSnapshots || [];
  const latest = snapshots[snapshots.length - 1] || null;
  const data = latest?.muscles?.[group] || null;
  const label = MUSCLE_GROUP_LABEL[group] || group;

  const trendPoints = useMemo(
    () =>
      snapshots.slice(-12).map((s) => ({
        value: s.muscles?.[group]?.score ?? null,
        label: new Date(s.computedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      })),
    [snapshots, group]
  );

  const topExercises = useMemo(() => topExercisesForMuscle(state, exMap, group, { limit: 4 }), [state, exMap, group]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <ScreenHeader eyebrow="Muscle" title={label} />
      </div>

      <Card className="text-center space-y-1 py-5">
        {data?.score != null ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-black text-v5-text tabular-nums">{data.score}</span>
              {data.delta != null && data.delta !== 0 && (
                <span className={`text-sm font-bold ${data.delta > 0 ? "text-v5-success" : "text-v5-red"}`}>
                  {data.delta > 0 ? "↑" : "↓"}
                  {Math.abs(data.delta)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-v5-subtext">{explainMuscle(group, data)}</p>
          </>
        ) : (
          <>
            <div className="text-lg font-black text-v5-text">
              {data?.confidence === CONFIDENCE.INSUFFICIENT ? "Establishing baseline" : "Not enough data yet"}
            </div>
            <p className="text-xs text-v5-subtext">Not enough comparable {label.toLowerCase()} sessions yet to establish a trend.</p>
          </>
        )}
      </Card>

      {trendPoints.filter((p) => p.value != null).length >= 2 && (
        <div>
          <SectionLabel tone="muted" className="mb-2">
            Progress Trend
          </SectionLabel>
          <Card>
            <LineChart points={trendPoints} />
          </Card>
        </div>
      )}

      {topExercises.length > 0 && (
        <div>
          <SectionLabel tone="muted" className="mb-2">
            Top Exercises
          </SectionLabel>
          <div className="space-y-2">
            {topExercises.map((ex) => (
              <Card key={ex.exId} className="flex items-center justify-between">
                <span className="text-sm font-bold text-v5-text truncate">{ex.name}</span>
                <span className="text-sm text-v5-subtext tabular-nums shrink-0">
                  {ex.from} <span className="text-v5-subtext/50">→</span> <span className="text-v5-text font-bold">{ex.to}</span>
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
