import React, { useState } from "react";
import { ChevronRight, Award, Calendar, TrendingUp, ClipboardCheck, Flame } from "lucide-react";
import BodyweightTab from "./BodyweightTab.jsx";
import TrainingCalendar from "./TrainingCalendar.jsx";
import AnalyticsTab from "./AnalyticsTab.jsx";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import { ScreenHeader, SectionLabel, Card, MetricTile, ProgressBar, ListRow, RingGauge, MiniBarChart, LineChart, PeriodSelect } from "./ui/Kit.jsx";
import { rollingAverage, weeklyRateOfChange, latestValue } from "../utils/bodyweightMath.js";
import { resolveGoalCurrentValue } from "../utils/goalData.js";
import { goalProgressPct } from "../utils/goalMath.js";
import { hasSchedule, computeScheduleAdherence } from "../utils/weeklySchedule.js";

function fmt1(v) {
  return v == null ? "—" : v.toFixed(1);
}

const PERIOD_OPTIONS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];
const PERIOD_DAYS = { week: 7, month: 30, all: 365 };

const DRILL_DOWNS = [
  { id: "calendar", label: "Training calendar", desc: "Every logged session by day", icon: Calendar },
  { id: "analytics", label: "Analytics", desc: "Volume trends, muscle frequency, per-exercise stats", icon: TrendingUp },
];

// Last 7 calendar days' total training volume, oldest first — deliberately "last 7 days ending
// today" rather than a fixed Mon-Sun week, since the app has no fixed week-start convention
// elsewhere (weeklySchedule.js's own adherence window works the same way).
function weeklyVolumeBars(sessions) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const volume = sessions
      .filter((s) => s.finishedAt?.slice(0, 10) === key)
      .reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "narrow" }), value: volume, active: i === 0 });
  }
  return days;
}

// Whichever muscle group shows up most often across recent sessions' mainMuscles — an honest,
// purely-frequency signal (never a fabricated "trending up/down" judgment BRK doesn't actually
// compute). `null` when there's nothing recent to summarize.
function topRecentMuscle(sessions) {
  const recent = [...sessions].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 6);
  const counts = new Map();
  recent.forEach((s) => (s.mainMuscles || []).forEach((m) => counts.set(m, (counts.get(m) || 0) + 1)));
  if (counts.size === 0) return null;
  const [muscle, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { muscle, count, of: recent.length };
}

// Visual-first landing: bodyweight snapshot, mission progress, recent PRs, and photo
// thumbnails up front — the things worth glancing at daily. Calendar and Analytics (which
// already houses per-exercise "performance" drill-down) are one tap away instead of competing
// for the same default screen via a segmented control. Adherence and Weekly Review stay on the
// Mission screen where they already live, alongside the goal they're measuring progress on.
function ProgressLanding({ state, exMap, onDrillDown, onNavigate }) {
  const [period, setPeriod] = useState("month");
  const entries = state.bodyweightLogs || [];
  const currentWeight = latestValue(entries, "weight");
  const avg7 = rollingAverage(entries, "weight", 7);
  const weeklyChange = weeklyRateOfChange(entries, "weight");
  const periodDays = PERIOD_DAYS[period];
  const chartPoints = [...entries]
    .filter((e) => e.weight != null && Date.now() - new Date(e.date).getTime() <= periodDays * 86400000)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-30)
    .map((e) => ({ label: new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: e.weight }));

  const goals = state.goals || [];
  const primaryGoal = goals.find((g) => g.status === "active" && g.priority === "primary");
  const missionPct = primaryGoal ? goalProgressPct({ ...primaryGoal, currentValue: resolveGoalCurrentValue(primaryGoal, state) }) : null;

  const sessions = state.workoutSessions || [];
  const recentPRs = [...sessions]
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .flatMap((s) => (s.prs || []).map((p) => ({ ...p, sessionDate: s.finishedAt })))
    .slice(0, 3);

  const recentPhotos = [...(state.photos || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  const periodSessions = sessions.filter((s) => Date.now() - new Date(s.finishedAt).getTime() <= periodDays * 86400000);
  const prsInPeriod = periodSessions.reduce((sum, s) => sum + (s.prs?.length || 0), 0);

  const scheduled = hasSchedule(state);
  const adherence = scheduled ? computeScheduleAdherence(state, periodDays) : null;
  const volumeBars = weeklyVolumeBars(sessions);
  const totalVolume = volumeBars.reduce((s, b) => s + b.value, 0);
  const focus = topRecentMuscle(sessions);

  return (
    <div className="space-y-4">
      <ScreenHeader
        eyebrow="Progress"
        title="Where you stand"
        right={<PeriodSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />}
      />

      {/* Top metric row — compact tiles, never the focal point themselves (mockup section 8). */}
      <div className="grid grid-cols-3 gap-2.5">
        <MetricTile label="Bodyweight" value={currentWeight != null ? fmt1(currentWeight) : "—"} sublabel={currentWeight != null ? "lb" : undefined} />
        <MetricTile label="Workouts" value={periodSessions.length} sublabel={PERIOD_OPTIONS.find((p) => p.value === period)?.label} />
        <MetricTile label="PRs" value={prsInPeriod} sublabel={PERIOD_OPTIONS.find((p) => p.value === period)?.label} accent={prsInPeriod > 0} />
      </div>

      {/* ONE strong, wide primary trend — bodyweight is the metric with the most consistent
          real data across the app, so it's the chart that earns the dominant slot rather than
          splitting attention across several tiny ones. */}
      <Card onClick={() => onDrillDown("body")} className="space-y-2.5">
        <div className="flex items-center justify-between">
          <SectionLabel>Bodyweight trend</SectionLabel>
          <ChevronRight size={16} className="text-v5-subtext" />
        </div>
        {currentWeight != null ? (
          <>
            <div className="text-3xl font-black text-v5-text">
              {fmt1(currentWeight)} <span className="text-sm font-normal text-v5-subtext">lb</span>
            </div>
            <div className="text-xs text-v5-subtext">
              7-day avg {fmt1(avg7)} · {weeklyChange != null ? `${weeklyChange >= 0 ? "+" : ""}${fmt1(weeklyChange)} lb/wk` : "—"}
            </div>
            <LineChart points={chartPoints} height={120} />
          </>
        ) : (
          <div className="text-sm text-v5-subtext">No entries yet — log your weight to see a trend here.</div>
        )}
      </Card>

      {/* Paired second row — weekly volume next to adherence, matching the mockup's balanced
          two-card layout instead of bundling both metrics into one crowded card. */}
      {(sessions.length > 0 || adherence?.overall != null) && (
        <div className={sessions.length > 0 && adherence?.overall != null ? "grid grid-cols-2 gap-3" : "space-y-3"}>
          {sessions.length > 0 && (
            <Card className="space-y-2.5">
              <SectionLabel tone="muted">Weekly volume</SectionLabel>
              <div className="text-lg font-black text-v5-text tabular-nums">{totalVolume.toLocaleString()} <span className="text-xs font-normal text-v5-subtext">lb</span></div>
              <MiniBarChart bars={volumeBars} height={44} />
            </Card>
          )}
          {adherence?.overall != null && (() => {
            const totalScheduled = adherence.lifting.scheduled + adherence.conditioning.scheduled + adherence.recovery.scheduled;
            const totalCompleted = adherence.lifting.completed + adherence.conditioning.completed + adherence.recovery.completed;
            return (
              <Card className="flex flex-col justify-between space-y-2.5">
                <SectionLabel tone="muted">Adherence</SectionLabel>
                <RingGauge pct={adherence.overall} value={`${adherence.overall}%`} size={64} strokeWidth={6} sublabel={`${totalCompleted}/${totalScheduled} sessions`} />
              </Card>
            );
          })()}
        </div>
      )}

      {/* Second paired row — Muscle Focus next to Recent PRs, matching the Weekly Volume /
          Adherence pattern above instead of each getting its own full-width card (task section
          10). Falls back to a single stacked column if only one of the two has data. */}
      {(focus || recentPRs.length > 0) && (
        <div className={focus && recentPRs.length > 0 ? "grid grid-cols-2 gap-3" : "space-y-3"}>
          {focus && (
            <Card className="flex items-center gap-2.5">
              <div className="shrink-0 relative w-10 h-16 overflow-hidden rounded-lg bg-v5-elevated flex items-center justify-center">
                <MuscleBodyOutline exercise={{ muscle: focus.muscle }} size={44} />
              </div>
              <div className="min-w-0">
                <SectionLabel tone="muted">Muscle focus</SectionLabel>
                <div className="text-sm font-black text-v5-text mt-0.5 truncate">{focus.muscle}</div>
                <div className="text-[11px] text-v5-subtext mt-0.5">
                  {focus.count}/{focus.of} sessions
                </div>
              </div>
            </Card>
          )}
          {recentPRs.length > 0 && (
            <Card className="space-y-1.5">
              <SectionLabel tone="muted" className="flex items-center gap-1.5">
                <Award size={11} className="text-v5-red" /> Recent PRs
              </SectionLabel>
              <div className="space-y-1">
                {recentPRs.slice(0, focus ? 2 : 3).map((pr, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-v5-subtext truncate">{exMap[pr.exId]?.name || pr.exId}</span>
                    <span className="text-v5-text font-bold shrink-0 ml-2 tabular-nums">{pr.weight != null ? `${pr.weight} × ${pr.reps}` : `${pr.value} lb`}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {primaryGoal && (
        <Card onClick={() => onNavigate("mission")}>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel tone="muted">Mission</SectionLabel>
            <ChevronRight size={16} className="text-v5-subtext" />
          </div>
          <div className="text-base font-bold text-v5-text truncate">{primaryGoal.title}</div>
          <ProgressBar pct={missionPct} className="mt-2.5" />
          <div className="text-xs text-v5-subtext mt-1.5">{missionPct}% complete</div>
        </Card>
      )}

      {recentPhotos.length > 0 && (
        <Card onClick={() => onNavigate("photos")} className="space-y-2.5">
          <div className="flex items-center justify-between">
            <SectionLabel tone="muted">Progress photos</SectionLabel>
            <ChevronRight size={16} className="text-v5-subtext" />
          </div>
          <div className="flex gap-2">
            {recentPhotos.map((p) => (
              <img key={p.id} src={p.dataUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {/* Unconditional — the goal-gated Mission card above only appears with an active goal,
            but weekly review/adherence (including the weekly schedule breakdown) is useful
            with or without one, so it needs a way in that doesn't depend on having a goal set. */}
        <ListRow icon={ClipboardCheck} title="Weekly review" subtitle="Adherence, streak, and goals" onClick={() => onNavigate("mission")} />
        {DRILL_DOWNS.map((d) => (
          <ListRow key={d.id} icon={d.icon} title={d.label} subtitle={d.desc} onClick={() => onDrillDown(d.id)} />
        ))}
      </div>
    </div>
  );
}

export default function ProgressTab({ state, updateState, allExercises, exMap, onNavigate, onViewWorkout }) {
  const [view, setView] = useState("landing");

  if (view !== "landing") {
    return (
      <div className="space-y-4">
        <button onClick={() => setView("landing")} className="text-xs font-bold uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          ← Progress
        </button>
        {view === "body" && <BodyweightTab state={state} updateState={updateState} />}
        {view === "calendar" && <TrainingCalendar state={state} exMap={exMap} onViewWorkout={onViewWorkout} />}
        {view === "analytics" && <AnalyticsTab state={state} allExercises={allExercises} exMap={exMap} />}
      </div>
    );
  }

  return <ProgressLanding state={state} exMap={exMap} onDrillDown={setView} onNavigate={onNavigate} />;
}
