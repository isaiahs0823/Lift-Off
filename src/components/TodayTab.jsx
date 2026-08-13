import React from "react";
import { ChevronRight, MessageCircle, Award, Scale, Dumbbell } from "lucide-react";
import ReadinessCheckIn from "./ReadinessCheckIn.jsx";
import { rollingAverage, weeklyRateOfChange, latestValue } from "../utils/bodyweightMath.js";
import { resolveGoalCurrentValue, goalHistory } from "../utils/goalData.js";
import { goalProgressPct, goalStatus, GOAL_STATUS_LABEL } from "../utils/goalMath.js";
import { resolveCurrentProgramDay } from "../utils/programSchedule.js";
import { buildCoachContext } from "../utils/coachContext.js";
import { generateTodaySnapshot } from "../services/coachService.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
function fmt1(v) {
  return v == null ? "—" : v.toFixed(1);
}
function estimateMinutes(plan) {
  const totalSets = (plan.exercises || []).reduce((sum, e) => sum + (Number(e.sets) || 0), 0);
  return Math.round(totalSets * 3.5);
}
const STATUS_COLOR = { ahead: "text-green-500", on_track: "text-green-500", behind: "text-red-500", no_data: "text-neutral-500" };

export default function TodayTab({ state, updateState, exMap, allExercises, activeRun, onStartRun, onNavigate }) {
  const entries = state.bodyweightLogs || [];
  const currentWeight = latestValue(entries, "weight");
  const avg7 = rollingAverage(entries, "weight", 7);
  const weeklyChange = weeklyRateOfChange(entries, "weight");

  const goals = state.goals || [];
  const primaryGoal = goals.find((g) => g.status === "active" && g.priority === "primary");
  let missionView = null;
  if (primaryGoal) {
    const withCurrent = { ...primaryGoal, currentValue: resolveGoalCurrentValue(primaryGoal, state) };
    const history = goalHistory(withCurrent, state);
    missionView = {
      goal: withCurrent,
      pct: goalProgressPct(withCurrent),
      status: goalStatus(withCurrent, history),
    };
  }

  const programDay = resolveCurrentProgramDay(state);
  const todayPlan = programDay && !programDay.isComplete ? programDay.plan : null;
  let lastCompletedDaysAgo = null;
  if (todayPlan) {
    const matching = (state.workoutSessions || [])
      .filter((s) => s.planName === todayPlan.name)
      .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
    if (matching[0]) {
      lastCompletedDaysAgo = Math.round((Date.now() - new Date(matching[0].finishedAt).getTime()) / 86400000);
    }
  }

  const coachContext = buildCoachContext(state, exMap);
  const coachMessage = generateTodaySnapshot(coachContext).message;

  const recentWin = [...(state.workoutSessions || [])]
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .flatMap((s) => (s.prs || []).map((p) => ({ ...p, exId: p.exId, sessionDate: s.finishedAt })))[0];

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-bold text-white">{greeting()}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      </div>

      {currentWeight != null && (
        <button onClick={() => onNavigate("progress")} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 flex items-center justify-between hover:border-neutral-600">
          <div className="flex items-center gap-3">
            <Scale size={18} className="text-neutral-500 shrink-0" />
            <div>
              <div className="text-2xl font-bold text-white">{fmt1(currentWeight)} <span className="text-sm font-normal text-neutral-500">lb</span></div>
              <div className="text-xs text-neutral-500">
                7-day avg {fmt1(avg7)} · {weeklyChange != null ? `${weeklyChange >= 0 ? "+" : ""}${fmt1(weeklyChange)} lb/wk` : "—"}
              </div>
            </div>
          </div>
          <ChevronRight size={18} className="text-neutral-600 shrink-0" />
        </button>
      )}

      {missionView && (
        <button onClick={() => onNavigate("mission")} className="w-full text-left border border-red-900/40 bg-charcoal-panel p-4 hover:border-red-700/60">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest text-red-600">Mission</div>
            <div className={`text-[11px] uppercase tracking-widest font-bold ${STATUS_COLOR[missionView.status]}`}>{GOAL_STATUS_LABEL[missionView.status]}</div>
          </div>
          <div className="text-lg font-bold text-white truncate">{missionView.goal.title}</div>
          <div className="h-2 bg-charcoal-deep border border-neutral-800 overflow-hidden mt-2">
            <div className="h-full bg-red-700" style={{ width: `${missionView.pct}%` }} />
          </div>
          <div className="text-xs text-neutral-500 mt-1">{missionView.pct}% complete</div>
        </button>
      )}

      <ReadinessCheckIn state={state} updateState={updateState} compact />

      {/* Today's training — the dominant card on the page. */}
      <div className="border-2 border-red-700 bg-charcoal-panel p-5 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Today</div>
        {todayPlan ? (
          <>
            <div className="text-2xl font-bold text-white">{todayPlan.name}</div>
            <div className="text-sm text-neutral-400">
              {todayPlan.exercises.length} exercises · Est. {estimateMinutes(todayPlan)} min
            </div>
            {lastCompletedDaysAgo != null && (
              <div className="text-xs text-neutral-600">Last completed {lastCompletedDaysAgo === 0 ? "today" : `${lastCompletedDaysAgo} day${lastCompletedDaysAgo === 1 ? "" : "s"} ago`}</div>
            )}
            <button
              onClick={() => onStartRun(todayPlan, programDay.programContext)}
              className="w-full py-4 text-sm uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
            >
              Start workout
            </button>
          </>
        ) : (
          <>
            <div className="text-sm text-neutral-400">No workout queued up.</div>
            <button
              onClick={() => onNavigate("train")}
              className="w-full py-4 text-sm uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
            >
              Choose a workout
            </button>
          </>
        )}
      </div>

      <div className="border border-neutral-800 bg-charcoal-panel p-4">
        <div className="text-[11px] uppercase tracking-widest text-red-600 mb-1.5 flex items-center gap-1.5">
          <MessageCircle size={12} /> Coach
        </div>
        <div className="text-sm text-neutral-300">{coachMessage}</div>
        <button onClick={() => onNavigate("coach")} className="mt-2 text-[11px] uppercase tracking-widest text-red-500 hover:text-red-400">
          Ask Coach →
        </button>
      </div>

      {recentWin && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1 flex items-center gap-1.5">
            <Award size={12} className="text-red-500" /> Recent win
          </div>
          <div className="text-base font-bold text-white">{exMap[recentWin.exId]?.name || recentWin.exId}</div>
          {recentWin.weight != null && <div className="text-lg text-neutral-300">{recentWin.weight} × {recentWin.reps}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button onClick={() => onNavigate("progress")} className="py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
          Log weight
        </button>
        <button onClick={() => onNavigate("train")} className="py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
          Change workout
        </button>
        <button onClick={() => onNavigate("progress")} className="py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
          View progress
        </button>
        <button onClick={() => onNavigate("coach")} className="py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
          Ask coach
        </button>
      </div>
    </div>
  );
}
