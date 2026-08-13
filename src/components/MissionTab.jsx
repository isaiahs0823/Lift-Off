import React, { useState } from "react";
import { Plus, Play, Check } from "lucide-react";
import { GoalEditor } from "./GoalEditor.jsx";
import { resolveGoalCurrentValue, goalHistory, withManualProgress } from "../utils/goalData.js";
import { goalProgressPct, daysRemaining, currentPaceFromHistory, requiredPace, goalStatus, GOAL_STATUS_LABEL } from "../utils/goalMath.js";
import { computeAdherence } from "../utils/adherence.js";
import WeeklyReviewCard from "./WeeklyReviewCard.jsx";
import ShareCardButton from "./ShareCardButton.jsx";
import { buildGoalShareCard } from "../utils/shareCard.js";

function unitLabel(goal) {
  return goal.units ? ` ${goal.units}` : "";
}
function fmtVal(v) {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const STATUS_COLOR = {
  ahead: "text-green-500",
  on_track: "text-green-500",
  behind: "text-red-500",
  no_data: "text-neutral-500",
};

// A goal's live, resolved view — currentValue/history pulled fresh from state every render
// (see goalData.js) rather than trusting whatever's stored on the goal object, so an
// auto-tracked goal never shows stale numbers after a new log lands.
function resolveGoal(goal, state) {
  const currentValue = resolveGoalCurrentValue(goal, state);
  const withCurrent = { ...goal, currentValue };
  const history = goalHistory(withCurrent, state);
  return { goal: withCurrent, history };
}

function GoalCard({ goal, state, onOpen, primary }) {
  const { goal: g, history } = resolveGoal(goal, state);
  const pct = goalProgressPct(g);
  const days = daysRemaining(g);
  const status = goalStatus(g, history);

  if (primary) {
    const pace = currentPaceFromHistory(history);
    const required = requiredPace(g);
    return (
      <div onClick={onOpen} className="w-full text-left border border-red-900/40 bg-charcoal-panel p-4 space-y-3 hover:border-red-700/60 cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Mission</div>
          <div className={`text-[11px] uppercase tracking-widest font-bold ${STATUS_COLOR[status]}`}>{GOAL_STATUS_LABEL[status]}</div>
        </div>
        <div className="text-2xl font-bold text-white">{g.title}</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Current</div>
            <div className="text-lg font-bold text-white">
              {fmtVal(g.currentValue)}
              {unitLabel(g)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Target</div>
            <div className="text-lg font-bold text-white">
              {fmtVal(g.targetValue)}
              {unitLabel(g)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Start</div>
            <div className="text-sm text-neutral-300">
              {fmtVal(g.startValue)}
              {unitLabel(g)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Days remaining</div>
            <div className="text-sm text-neutral-300">{days != null ? Math.max(0, days) : "No date set"}</div>
          </div>
        </div>
        <div>
          <div className="h-2 bg-charcoal-deep border border-neutral-800 overflow-hidden">
            <div className="h-full bg-red-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-neutral-500 mt-1">{pct}% complete</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-neutral-400 border-t border-neutral-900 pt-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-600">Current pace</div>
            <div>{pace != null ? `${pace >= 0 ? "+" : ""}${pace.toFixed(1)}${unitLabel(g)}/week` : "Collecting data"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-600">Required pace</div>
            <div>{required != null ? `${required >= 0 ? "+" : ""}${required.toFixed(1)}${unitLabel(g)}/week` : "—"}</div>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ShareCardButton buildDataUrl={() => buildGoalShareCard(g, pct)} filename="brk-lift-goal.png" />
        </div>
      </div>
    );
  }

  return (
    <button onClick={onOpen} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-3 hover:border-neutral-700">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{g.title}</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {fmtVal(g.currentValue)}
            {unitLabel(g)} → {fmtVal(g.targetValue)}
            {unitLabel(g)}
          </div>
        </div>
        <div className={`shrink-0 text-[10px] uppercase tracking-widest font-bold ${STATUS_COLOR[status]}`}>{GOAL_STATUS_LABEL[status]}</div>
      </div>
      <div className="h-1.5 bg-charcoal-deep border border-neutral-800 overflow-hidden mt-2">
        <div className="h-full bg-red-700" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function AdherenceCard({ state }) {
  const weekly = computeAdherence(state, 7);
  const monthly = computeAdherence(state, 30);
  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-red-600">Adherence</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">This week</div>
          <div className="text-3xl font-bold text-white">{weekly.overall}%</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">This month</div>
          <div className="text-3xl font-bold text-white">{monthly.overall}%</div>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-neutral-400 border-t border-neutral-900 pt-3">
        <div className="flex items-center justify-between">
          <span>Strength ({weekly.strengthDays}/{weekly.plannedSessions} planned this week)</span>
          <span className="text-neutral-300">{weekly.strengthPct}%</span>
        </div>
        {weekly.cardioPct != null && (
          <div className="flex items-center justify-between">
            <span>Conditioning</span>
            <span className="text-neutral-300">{weekly.cardioPct}%</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>Check-ins</span>
          <span className="text-neutral-300">{weekly.checkinPct}%</span>
        </div>
      </div>
    </div>
  );
}

export default function MissionTab({ state, updateState, allExercises, exMap }) {
  const [view, setView] = useState({ kind: "list" }); // { kind: "list" } | { kind: "new" } | { kind: "edit", id }

  const goals = state.goals || [];
  const activeGoals = goals.filter((g) => g.status === "active");
  const primary = activeGoals.find((g) => g.priority === "primary");
  const secondary = activeGoals.filter((g) => g.priority !== "primary");
  const inactiveGoals = goals.filter((g) => g.status !== "active");

  const saveGoal = (fields) => {
    updateState((prev) => {
      const list = prev.goals || [];
      if (view.kind === "edit") {
        const editingWasPrimary = list.find((g) => g.id === view.id)?.priority === "primary";
        let next = list.map((g) => (g.id === view.id ? { ...g, ...fields } : g));
        if (fields.priority === "primary" && !editingWasPrimary) {
          next = next.map((g) => (g.id !== view.id && g.priority === "primary" ? { ...g, priority: "secondary" } : g));
        }
        return { ...prev, goals: next };
      }
      const newGoal = { id: `goal_${Date.now()}`, createdAt: new Date().toISOString(), history: [], ...fields };
      let next = [newGoal, ...list];
      if (fields.priority === "primary") {
        next = next.map((g) => (g.id !== newGoal.id && g.priority === "primary" ? { ...g, priority: "secondary" } : g));
      }
      return { ...prev, goals: next };
    });
    setView({ kind: "list" });
  };

  const deleteGoal = (id) => {
    if (!window.confirm("Delete this goal? This can't be undone.")) return;
    updateState((prev) => ({ ...prev, goals: (prev.goals || []).filter((g) => g.id !== id) }));
    setView({ kind: "list" });
  };

  const setGoalStatus = (id, status) => {
    updateState((prev) => ({ ...prev, goals: (prev.goals || []).map((g) => (g.id === id ? { ...g, status } : g)) }));
  };

  if (view.kind === "new") {
    return <GoalEditor allExercises={allExercises} exMap={exMap} hasPrimary={!!primary} onBack={() => setView({ kind: "list" })} onSave={saveGoal} />;
  }
  if (view.kind === "edit") {
    const goal = goals.find((g) => g.id === view.id);
    if (!goal) return <GoalEditor allExercises={allExercises} exMap={exMap} hasPrimary={!!primary} onBack={() => setView({ kind: "list" })} onSave={saveGoal} />;
    return (
      <GoalEditor
        goal={goal}
        allExercises={allExercises}
        exMap={exMap}
        hasPrimary={!!primary}
        onBack={() => setView({ kind: "list" })}
        onSave={saveGoal}
        onDelete={() => deleteGoal(goal.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Mission</div>
          <div className="text-xl font-bold text-white mt-1">What am I trying to become</div>
        </div>
        <button
          onClick={() => setView({ kind: "new" })}
          className="shrink-0 text-xs uppercase tracking-widest text-red-500 hover:text-red-400 flex items-center gap-1"
        >
          <Plus size={14} /> New goal
        </button>
      </div>

      {primary ? (
        <GoalCard goal={primary} state={state} primary onOpen={() => setView({ kind: "edit", id: primary.id })} />
      ) : (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 text-sm text-neutral-500">
          No primary goal set. Add one — this is the thing everything else here points at.
        </div>
      )}

      {secondary.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Secondary goals</div>
          {secondary.map((g) => (
            <GoalCard key={g.id} goal={g} state={state} onOpen={() => setView({ kind: "edit", id: g.id })} />
          ))}
        </div>
      )}

      <AdherenceCard state={state} />

      <WeeklyReviewCard state={state} />

      {inactiveGoals.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Paused / completed</div>
          {inactiveGoals.map((g) => (
            <div key={g.id} className="flex items-center justify-between border border-neutral-800 bg-charcoal-panel p-3">
              <button onClick={() => setView({ kind: "edit", id: g.id })} className="text-left min-w-0">
                <div className="text-sm text-neutral-300 truncate">{g.title}</div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-600">{g.status}</div>
              </button>
              <div className="shrink-0 flex items-center gap-2">
                {g.status === "paused" && (
                  <button onClick={() => setGoalStatus(g.id, "active")} className="text-neutral-500 hover:text-red-500 p-1" title="Resume">
                    <Play size={14} />
                  </button>
                )}
                {g.status === "completed" && <Check size={14} className="text-green-500" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeGoals.length > 0 && (
        <div className="text-[11px] text-neutral-600">
          Tap a goal to edit it, change its target date, or mark it paused/completed from there.
        </div>
      )}
    </div>
  );
}
