import React, { useState } from "react";
import { Plus, Play, Check } from "lucide-react";
import { GoalEditor } from "./GoalEditor.jsx";
import { resolveGoalCurrentValue, goalHistory, withManualProgress } from "../utils/goalData.js";
import { goalProgressPct, daysRemaining, currentPaceFromHistory, requiredPace, goalStatus, GOAL_STATUS_LABEL } from "../utils/goalMath.js";
import { computeAdherence } from "../utils/adherence.js";
import WeeklyReviewCard from "./WeeklyReviewCard.jsx";
import ShareCardButton from "./ShareCardButton.jsx";
import { buildGoalShareCard } from "../utils/shareCard.js";
import { ScreenHeader, SectionLabel, Card, HeroCard, ButtonText, StatTile, ListRow, ProgressBar, Divider, EmptyState } from "./ui/Kit.jsx";

function unitLabel(goal) {
  return goal.units ? ` ${goal.units}` : "";
}
function fmtVal(v) {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const STATUS_COLOR = {
  ahead: "text-v5-success",
  on_track: "text-v5-success",
  behind: "text-v5-red",
  no_data: "text-v5-subtext",
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
      <HeroCard as="div" onClick={onOpen}>
        <div className="flex items-center justify-between">
          <SectionLabel>Mission</SectionLabel>
          <div className={`text-[11px] uppercase tracking-widest font-bold ${STATUS_COLOR[status]}`}>{GOAL_STATUS_LABEL[status]}</div>
        </div>
        <div className="text-2xl font-black text-v5-text">{g.title}</div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile value={`${fmtVal(g.currentValue)}${unitLabel(g)}`} label="Current" />
          <StatTile value={`${fmtVal(g.targetValue)}${unitLabel(g)}`} label="Target" />
          <StatTile value={`${fmtVal(g.startValue)}${unitLabel(g)}`} label="Start" valueClassName="text-sm" />
          <StatTile value={days != null ? Math.max(0, days) : "No date"} label="Days remaining" valueClassName="text-sm" />
        </div>
        <div>
          <ProgressBar pct={pct} />
          <div className="text-xs text-v5-subtext mt-1">{pct}% complete</div>
        </div>
        <Divider />
        <div className="grid grid-cols-2 gap-3 text-xs text-v5-subtext">
          <div>
            <SectionLabel tone="muted">Current pace</SectionLabel>
            <div className="mt-0.5">{pace != null ? `${pace >= 0 ? "+" : ""}${pace.toFixed(1)}${unitLabel(g)}/week` : "Collecting data"}</div>
          </div>
          <div>
            <SectionLabel tone="muted">Required pace</SectionLabel>
            <div className="mt-0.5">{required != null ? `${required >= 0 ? "+" : ""}${required.toFixed(1)}${unitLabel(g)}/week` : "—"}</div>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ShareCardButton buildDataUrl={() => buildGoalShareCard(g, pct)} filename="brk-lift-goal.png" />
        </div>
      </HeroCard>
    );
  }

  return (
    <Card onClick={onOpen} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-v5-text truncate">{g.title}</div>
          <div className="text-xs text-v5-subtext mt-0.5">
            {fmtVal(g.currentValue)}
            {unitLabel(g)} → {fmtVal(g.targetValue)}
            {unitLabel(g)}
          </div>
        </div>
        <div className={`shrink-0 text-[11px] uppercase tracking-widest font-bold ${STATUS_COLOR[status]}`}>{GOAL_STATUS_LABEL[status]}</div>
      </div>
      <ProgressBar pct={pct} />
    </Card>
  );
}

function AdherenceCard({ state }) {
  const weekly = computeAdherence(state, 7);
  const monthly = computeAdherence(state, 30);
  return (
    <Card className="space-y-3">
      <SectionLabel>Adherence</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <StatTile value={`${weekly.overall}%`} label="This week" valueClassName="text-3xl" />
        <StatTile value={`${monthly.overall}%`} label="This month" valueClassName="text-3xl" />
      </div>
      <Divider />
      <div className="space-y-1.5 text-xs text-v5-subtext">
        <div className="flex items-center justify-between">
          <span>Strength ({weekly.strengthDays}/{weekly.plannedSessions} planned this week)</span>
          <span className="text-v5-text/90">{weekly.strengthPct}%</span>
        </div>
        {weekly.cardioPct != null && (
          <div className="flex items-center justify-between">
            <span>Conditioning</span>
            <span className="text-v5-text/90">{weekly.cardioPct}%</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>Check-ins</span>
          <span className="text-v5-text/90">{weekly.checkinPct}%</span>
        </div>
      </div>
    </Card>
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
    <div className="space-y-5">
      <ScreenHeader
        eyebrow="Mission"
        title="What am I trying to become"
        right={
          <ButtonText onClick={() => setView({ kind: "new" })} icon={Plus}>
            New goal
          </ButtonText>
        }
      />

      {primary ? (
        <GoalCard goal={primary} state={state} primary onOpen={() => setView({ kind: "edit", id: primary.id })} />
      ) : (
        <EmptyState title="No primary goal set" body="Add one — this is the thing everything else here points at." />
      )}

      {secondary.length > 0 && (
        <div className="space-y-2">
          <SectionLabel tone="muted">Secondary goals</SectionLabel>
          {secondary.map((g) => (
            <GoalCard key={g.id} goal={g} state={state} onOpen={() => setView({ kind: "edit", id: g.id })} />
          ))}
        </div>
      )}

      <AdherenceCard state={state} />

      <WeeklyReviewCard state={state} exMap={exMap} />

      {inactiveGoals.length > 0 && (
        <div className="space-y-2">
          <SectionLabel tone="muted">Paused / completed</SectionLabel>
          {inactiveGoals.map((g) => (
            <ListRow
              key={g.id}
              onClick={() => setView({ kind: "edit", id: g.id })}
              title={g.title}
              subtitle={g.status}
              right={
                <div className="shrink-0 flex items-center gap-2">
                  {g.status === "paused" && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setGoalStatus(g.id, "active");
                      }}
                      className="text-v5-subtext hover:text-v5-red p-1"
                      title="Resume"
                    >
                      <Play size={14} />
                    </span>
                  )}
                  {g.status === "completed" && <Check size={14} className="text-v5-success" />}
                </div>
              }
            />
          ))}
        </div>
      )}

      {activeGoals.length > 0 && (
        <div className="text-[11px] text-v5-subtext/70">
          Tap a goal to edit it, change its target date, or mark it paused/completed from there.
        </div>
      )}
    </div>
  );
}
