import React, { useState } from "react";
import { ChevronRight, Award, Calendar, TrendingUp } from "lucide-react";
import BodyweightTab from "./BodyweightTab.jsx";
import TrainingCalendar from "./TrainingCalendar.jsx";
import AnalyticsTab from "./AnalyticsTab.jsx";
import { rollingAverage, weeklyRateOfChange, latestValue } from "../utils/bodyweightMath.js";
import { resolveGoalCurrentValue } from "../utils/goalData.js";
import { goalProgressPct } from "../utils/goalMath.js";

function fmt1(v) {
  return v == null ? "—" : v.toFixed(1);
}

// Same hand-rolled sparkline as BodyweightTab's, sized down for a snapshot card. Kept local
// (not shared) since it's a small enough drawing routine that a shared component would add
// more indirection than it saves.
function MiniSparkline({ points, height = 44 }) {
  if (points.length < 2) return null;
  const width = 280;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 8) + 4;
    const y = height - 4 - ((p.value - min) / span) * (height - 8);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <path d={path} fill="none" stroke="#dc2626" strokeWidth="2" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="3" fill="#dc2626" />
    </svg>
  );
}

const DRILL_DOWNS = [
  { id: "calendar", label: "Training calendar", desc: "Every logged session by day", icon: Calendar },
  { id: "analytics", label: "Analytics", desc: "Volume trends, muscle frequency, per-exercise stats", icon: TrendingUp },
];

// Visual-first landing: bodyweight snapshot, mission progress, recent PRs, and photo
// thumbnails up front — the things worth glancing at daily. Calendar and Analytics (which
// already houses per-exercise "performance" drill-down) are one tap away instead of competing
// for the same default screen via a segmented control. Adherence and Weekly Review stay on the
// Mission screen where they already live, alongside the goal they're measuring progress on.
function ProgressLanding({ state, exMap, onDrillDown, onNavigate }) {
  const entries = state.bodyweightLogs || [];
  const currentWeight = latestValue(entries, "weight");
  const avg7 = rollingAverage(entries, "weight", 7);
  const weeklyChange = weeklyRateOfChange(entries, "weight");
  const chartPoints = [...entries]
    .filter((e) => e.weight != null)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30)
    .map((e) => ({ date: e.date, value: e.weight }));

  const goals = state.goals || [];
  const primaryGoal = goals.find((g) => g.status === "active" && g.priority === "primary");
  const missionPct = primaryGoal ? goalProgressPct({ ...primaryGoal, currentValue: resolveGoalCurrentValue(primaryGoal, state) }) : null;

  const recentPRs = [...(state.workoutSessions || [])]
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .flatMap((s) => (s.prs || []).map((p) => ({ ...p, sessionDate: s.finishedAt })))
    .slice(0, 3);

  const recentPhotos = [...(state.photos || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-red-600">Progress</div>
        <div className="text-xl font-bold text-white mt-1">Where you stand</div>
      </div>

      <button onClick={() => onDrillDown("body")} className="w-full text-left border border-red-900/40 bg-charcoal-panel p-4 space-y-2 hover:border-red-700/60">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Bodyweight</div>
          <ChevronRight size={16} className="text-neutral-600" />
        </div>
        {currentWeight != null ? (
          <>
            <div className="text-3xl font-bold text-white">
              {fmt1(currentWeight)} <span className="text-sm font-normal text-neutral-500">lb</span>
            </div>
            <div className="text-xs text-neutral-500">
              7-day avg {fmt1(avg7)} · {weeklyChange != null ? `${weeklyChange >= 0 ? "+" : ""}${fmt1(weeklyChange)} lb/wk` : "—"}
            </div>
            <MiniSparkline points={chartPoints} />
          </>
        ) : (
          <div className="text-sm text-neutral-500">No entries yet — log your weight to see a trend here.</div>
        )}
      </button>

      {primaryGoal && (
        <button onClick={() => onNavigate("mission")} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 hover:border-neutral-600">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest text-neutral-500">Mission</div>
            <ChevronRight size={16} className="text-neutral-600" />
          </div>
          <div className="text-base font-bold text-white truncate">{primaryGoal.title}</div>
          <div className="h-2 bg-charcoal-deep border border-neutral-800 overflow-hidden mt-2">
            <div className="h-full bg-red-700" style={{ width: `${missionPct}%` }} />
          </div>
          <div className="text-xs text-neutral-500 mt-1">{missionPct}% complete</div>
        </button>
      )}

      {recentPRs.length > 0 && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
            <Award size={12} className="text-red-500" /> Recent PRs
          </div>
          {recentPRs.map((pr, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-neutral-300 truncate">{exMap[pr.exId]?.name || pr.exId}</span>
              <span className="text-white font-bold shrink-0 ml-2">{pr.weight != null ? `${pr.weight} × ${pr.reps}` : `${pr.value} lb`}</span>
            </div>
          ))}
        </div>
      )}

      {recentPhotos.length > 0 && (
        <button onClick={() => onNavigate("photos")} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 space-y-2 hover:border-neutral-600">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-widest text-neutral-500">Progress photos</div>
            <ChevronRight size={16} className="text-neutral-600" />
          </div>
          <div className="flex gap-2">
            {recentPhotos.map((p) => (
              <img key={p.id} src={p.dataUrl} alt="" className="w-16 h-16 object-cover border border-neutral-800" />
            ))}
          </div>
        </button>
      )}

      <div className="space-y-2 pt-2">
        {DRILL_DOWNS.map((d) => (
          <button
            key={d.id}
            onClick={() => onDrillDown(d.id)}
            className="w-full flex items-center justify-between border border-neutral-800 bg-charcoal-panel p-4 hover:border-neutral-600"
          >
            <div className="flex items-center gap-3">
              <d.icon size={18} className="text-neutral-500" />
              <div className="text-left">
                <div className="text-base font-bold text-white">{d.label}</div>
                <div className="text-xs text-neutral-500">{d.desc}</div>
              </div>
            </div>
            <ChevronRight size={18} className="text-neutral-600 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProgressTab({ state, updateState, allExercises, exMap, onNavigate }) {
  const [view, setView] = useState("landing");

  if (view !== "landing") {
    return (
      <div className="space-y-4">
        <button onClick={() => setView("landing")} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
          ← Progress
        </button>
        {view === "body" && <BodyweightTab state={state} updateState={updateState} />}
        {view === "calendar" && <TrainingCalendar state={state} exMap={exMap} />}
        {view === "analytics" && <AnalyticsTab state={state} allExercises={allExercises} exMap={exMap} />}
      </div>
    );
  }

  return <ProgressLanding state={state} exMap={exMap} onDrillDown={setView} onNavigate={onNavigate} />;
}
