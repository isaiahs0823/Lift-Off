import React, { useEffect, useState } from "react";
import { ChevronRight, MessageCircle, Award, Scale, Timer, Check, RefreshCw, Map, Play, Weight, Dumbbell, TrendingUp, TrendingDown } from "lucide-react";
import ReadinessCheckIn from "./ReadinessCheckIn.jsx";
import NutritionCard from "./NutritionCard.jsx";
import SwapWorkoutSheet from "./SwapWorkoutSheet.jsx";
import { ScreenHeader, SectionLabel, Card, HeroCard, PhotoHero, ButtonPrimary, ButtonSecondary, ButtonText, StatTile, Pill, ProgressBar, ActionTile, LineChart } from "./ui/Kit.jsx";
import { rollingAverage, weeklyRateOfChange, latestValue } from "../utils/bodyweightMath.js";
import { resolveGoalCurrentValue, goalHistory } from "../utils/goalData.js";
import { goalProgressPct, goalStatus, GOAL_STATUS_LABEL } from "../utils/goalMath.js";
import { resolveTodayWorkout } from "../utils/programSchedule.js";
import { findTodaysSessionForPlan } from "../utils/workoutHistory.js";
import { formatSessionDuration } from "../utils/workoutSets.js";
import { buildCoachContext } from "../utils/coachContext.js";
import { generateTodaySnapshot } from "../services/coachService.js";
import { computeReadinessScore, readinessBand, BAND_LABEL } from "../utils/readiness.js";
import { syncCoachMemory } from "../utils/coachMemory.js";
import {
  hasSchedule,
  getTodaySchedule,
  getScheduleDay,
  getMissedEntry,
  getWeekStrip,
  syncRollingToday,
  buildRunFromSource,
  buildSkipPatch,
  buildMovePatch,
  buildDoTodayPatch,
  computeScheduleAdherence,
  DAY_TYPE_LABEL,
} from "../utils/weeklySchedule.js";

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
function addDaysStr(dateKeyStr, n) {
  const d = new Date(dateKeyStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function todayReadiness(state) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const entry = (state.readinessLogs || []).find((r) => r.date.slice(0, 10) === todayKey);
  if (!entry) return null;
  const score = computeReadinessScore(entry);
  if (score == null) return null;
  return { score, band: readinessBand(score) };
}
const STATUS_COLOR = { ahead: "text-v5-success", on_track: "text-v5-success", behind: "text-v5-red", no_data: "text-v5-subtext" };
const READINESS_COLOR = { green: "text-v5-success", yellow: "text-amber-400", red: "text-v5-red" };
const GLYPH_FOR_STATUS = { completed: "✓", pending: "●", upcoming: "○", rest: "REST", missed: "×", skipped: "×", moved_away: "–", none: "" };
const GLYPH_COLOR = {
  completed: "text-v5-success",
  pending: "text-v5-red",
  upcoming: "text-v5-subtext/50",
  rest: "text-v5-subtext",
  missed: "text-v5-red",
  skipped: "text-v5-red",
  moved_away: "text-v5-subtext/50",
  none: "text-v5-subtext/20",
};

// Compact Mon-Sun row on the Today dashboard — a screenshot-friendly week-at-a-glance. Tapping
// a day expands a one-line detail instead of navigating away, keeping this a glance, not a trip.
function WeekStrip({ strip }) {
  const [openIdx, setOpenIdx] = useState(null);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Card padding="p-4">
      <SectionLabel tone="muted" className="mb-2.5">This week</SectionLabel>
      <div className="grid grid-cols-7 gap-1 text-center">
        {strip.map((day, i) => (
          <button
            key={i}
            onClick={() => setOpenIdx((idx) => (idx === i ? null : i))}
            className="flex flex-col items-center gap-1.5 py-1.5 rounded-lg hover:bg-v5-elevated"
          >
            <span className="text-[10px] font-bold text-v5-subtext/60">{labels[i]}</span>
            <span className={`text-xs font-bold ${GLYPH_COLOR[day.status]}`}>{GLYPH_FOR_STATUS[day.status] || "·"}</span>
          </button>
        ))}
      </div>
      {openIdx != null && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-v5-subtext">
          {strip[openIdx].status === "none" ? (
            "Nothing scheduled."
          ) : (
            <>
              <span className="text-v5-text font-bold">{strip[openIdx].label || DAY_TYPE_LABEL[strip[openIdx].type]}</span>
              {" — "}
              {strip[openIdx].status === "completed" && "completed"}
              {strip[openIdx].status === "pending" && "today"}
              {strip[openIdx].status === "upcoming" && "upcoming"}
              {strip[openIdx].status === "rest" && "rest day"}
              {strip[openIdx].status === "missed" && "missed"}
              {strip[openIdx].status === "skipped" && "skipped"}
              {strip[openIdx].status === "moved_away" && "moved to another day"}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// Fixed-mode only (see weeklySchedule.js) — surfaces the single most recent unresolved day
// with three low-drama options, never a stack of banners.
function MissedWorkoutBanner({ missed, state, updateState, onStartRun }) {
  const [mode, setMode] = useState(null); // null | "move" | "skip"

  const doToday = () => {
    updateState((prev) => ({ ...prev, scheduleLog: [...(prev.scheduleLog || []), ...buildDoTodayPatch(missed)] }));
  };
  const moveTo = (dateStr) => {
    updateState((prev) => ({ ...prev, scheduleLog: [...(prev.scheduleLog || []), ...buildMovePatch(missed, dateStr)] }));
    setMode(null);
  };
  const confirmSkip = () => {
    updateState((prev) => ({ ...prev, scheduleLog: [...(prev.scheduleLog || []), buildSkipPatch(missed)] }));
    setMode(null);
  };

  const missedDate = new Date(missed.date + "T12:00:00");
  const dayDiff = Math.round((Date.now() - missedDate.getTime()) / 86400000);
  const whenLabel = dayDiff <= 1 ? "yesterday" : `${dayDiff} days ago`;

  const moveOptions = Array.from({ length: 4 }, (_, i) => addDaysStr(new Date().toISOString().slice(0, 10), i));

  return (
    <HeroCard>
      <SectionLabel>Missed workout</SectionLabel>
      <div className="text-base text-v5-text">
        {missed.label || DAY_TYPE_LABEL[missed.type]} was scheduled {whenLabel}.
      </div>

      {mode === "skip" ? (
        <div className="space-y-3">
          <div className="text-sm text-v5-subtext">
            Skip {missed.label || DAY_TYPE_LABEL[missed.type]}? This will count as a missed scheduled session.
          </div>
          <div className="flex gap-2">
            <ButtonPrimary size="sm" onClick={confirmSkip} className="flex-1">Skip</ButtonPrimary>
            <ButtonSecondary size="sm" onClick={() => setMode(null)} className="flex-1">Cancel</ButtonSecondary>
          </div>
        </div>
      ) : mode === "move" ? (
        <div className="space-y-3">
          <SectionLabel tone="muted">Move to</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {moveOptions.map((d) => (
              <button
                key={d}
                onClick={() => moveTo(d)}
                className="px-3 py-2 rounded-lg text-xs uppercase tracking-widest font-bold bg-v5-elevated text-v5-subtext hover:text-v5-text"
              >
                {new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}
              </button>
            ))}
          </div>
          <ButtonText tone="muted" onClick={() => setMode(null)}>Cancel</ButtonText>
        </div>
      ) : (
        <div className="flex gap-2">
          <ButtonPrimary size="sm" onClick={doToday} className="flex-1">Do today</ButtonPrimary>
          <ButtonSecondary size="sm" onClick={() => setMode("move")} className="flex-1">Move</ButtonSecondary>
          <ButtonSecondary size="sm" onClick={() => setMode("skip")} className="flex-1">Skip</ButtonSecondary>
        </div>
      )}
    </HeroCard>
  );
}

const RECOVERY_ACTIVITIES = ["Walk", "Mobility", "Light cardio"];
function RecoveryLogCard({ label, state, updateState }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const loggedToday = (state.recoveryLogs || []).find((r) => r.date.slice(0, 10) === todayKey);
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState(RECOVERY_ACTIVITIES[0]);
  const [notes, setNotes] = useState("");

  const save = () => {
    updateState((prev) => ({
      ...prev,
      recoveryLogs: [{ id: `recovery_${Date.now()}`, date: new Date().toISOString(), activity, notes: notes.trim() }, ...(prev.recoveryLogs || [])],
      hasSeenOnboarding: true,
    }));
    setOpen(false);
  };

  return (
    <HeroCard>
      <SectionLabel>Active recovery</SectionLabel>
      <div className="text-2xl font-black text-v5-text">{label}</div>
      <div className="text-sm text-v5-subtext">Walk · Mobility · Light cardio</div>
      {loggedToday ? (
        <div className="text-sm text-v5-success font-bold flex items-center gap-1.5">
          <Check size={14} /> Recovery logged — {loggedToday.activity}
        </div>
      ) : open ? (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {RECOVERY_ACTIVITIES.map((a) => (
              <button
                key={a}
                onClick={() => setActivity(a)}
                className={`px-3 py-2 rounded-lg text-xs uppercase tracking-widest font-bold ${
                  activity === a ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes — optional"
            className="w-full bg-v5-elevated rounded-lg text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red placeholder:text-v5-subtext/50"
          />
          <ButtonPrimary onClick={save}>Save</ButtonPrimary>
        </div>
      ) : (
        <ButtonPrimary size="lg" onClick={() => setOpen(true)}>Log recovery</ButtonPrimary>
      )}
    </HeroCard>
  );
}

// Paired with Readiness in a 2-column row (mockup section 5) — current number, a short trend
// line, and a small sparkline built from the athlete's own recent bodyweight logs. Real data
// only: with fewer than 2 points there's nothing to trend, so it falls back to just the number.
function BodyweightCard({ state, currentWeight, avg7, weeklyChange, onNavigate }) {
  const entries = (state.bodyweightLogs || [])
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-10);
  const points = entries.map((e) => ({
    label: new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    value: e.weight,
  }));
  const trendUp = weeklyChange != null && weeklyChange > 0;
  const trendDown = weeklyChange != null && weeklyChange < 0;
  return (
    <Card onClick={() => onNavigate("progress")} padding="p-4" className="space-y-2">
      <SectionLabel tone="muted">Bodyweight</SectionLabel>
      <div className="text-2xl font-black text-v5-text tabular-nums leading-none">
        {fmt1(currentWeight)} <span className="text-xs font-normal text-v5-subtext">lb</span>
      </div>
      {weeklyChange != null ? (
        <div className={`flex items-center gap-1 text-[11px] font-bold ${trendUp ? "text-v5-success" : trendDown ? "text-v5-red" : "text-v5-subtext"}`}>
          {trendUp ? <TrendingUp size={12} /> : trendDown ? <TrendingDown size={12} /> : null}
          {fmt1(Math.abs(weeklyChange))} lb/wk
        </div>
      ) : (
        <div className="text-[11px] text-v5-subtext">7-day avg {fmt1(avg7)}</div>
      )}
      {points.length >= 2 && <LineChart points={points} height={36} tone="subtle" className="[&_span]:hidden" />}
    </Card>
  );
}

function SetupSchedulePrompt({ onSetup, onLater }) {
  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-v5-text">Set up your training week</div>
        <div className="text-xs text-v5-subtext mt-0.5">Know which days are training, conditioning, recovery, or rest.</div>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <ButtonText tone="muted" onClick={onLater}>Later</ButtonText>
        <button onClick={onSetup} className="px-3 py-2 rounded-lg text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:opacity-90">
          Set up
        </button>
      </div>
    </Card>
  );
}

export default function TodayTab({ state, updateState, exMap, allExercises, activeRun, onStartRun, onStartRecovery, onNavigate, onViewWorkout }) {
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

  const programDay = resolveTodayWorkout(state);
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

  const [swapOpen, setSwapOpen] = useState(false);

  const coachContext = buildCoachContext(state, exMap);
  const coachMessage = generateTodaySnapshot(coachContext).message;

  const recentWin = [...(state.workoutSessions || [])]
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))
    .flatMap((s) => (s.prs || []).map((p) => ({ ...p, exId: p.exId, sessionDate: s.finishedAt })))[0];

  // ---- weekly schedule ----
  const scheduleOn = hasSchedule(state);
  const todaySchedule = scheduleOn ? getTodaySchedule(state) : null;
  const missedEntry = scheduleOn ? getMissedEntry(state) : null;
  const weekStrip = scheduleOn ? getWeekStrip(state) : null;
  const readiness = todayReadiness(state);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

  // Rolling mode's "today" only advances once resolved — safe to call every mount, it's a
  // no-op once today is already settled.
  useEffect(() => {
    const sync = syncRollingToday(state);
    if (sync) {
      updateState((prev) => ({
        ...prev,
        scheduleLog: [...(prev.scheduleLog || []), sync.logEntry],
        weeklySchedule: { ...prev.weeklySchedule, rollingCursor: sync.newCursor },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.weeklySchedule, state.scheduleLog, state.workoutSessions, state.cardioLogs, state.recoveryLogs]);

  // Keeps persisted Coach memory (Layer 3) current every time Today is opened — promotes newly
  // detected patterns, ages out ones that stopped recurring. See coachMemory.js's syncCoachMemory.
  useEffect(() => {
    if (state.athleteProfile && state.athleteProfile.learningEnabled === false) return;
    const next = syncCoachMemory(state);
    if (next !== state.coachMemories) {
      updateState((prev) => ({ ...prev, coachMemories: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workoutSessions, state.cardioLogs, state.logs, state.bodyweightLogs, state.readinessLogs, state.scheduleLog, state.weeklySchedule]);

  const startScheduled = (source) => {
    const run = buildRunFromSource(state, source);
    if (run) onStartRun(run.plan, run.programContext);
  };

  if (swapOpen && !activeRun) {
    return <SwapWorkoutSheet state={state} updateState={updateState} exMap={exMap} onClose={() => setSwapOpen(false)} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-2xl font-black text-v5-text tracking-tight">{greeting()}</div>
        <div className="text-xs text-v5-subtext mt-0.5">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      </div>

      {missedEntry && <MissedWorkoutBanner missed={missedEntry} state={state} updateState={updateState} onStartRun={onStartRun} />}

      {/* Today's training — the dominant card on the page. */}
      {scheduleOn && todaySchedule?.type === "rest" ? (
        (() => {
          const tomorrow = getScheduleDay(state, addDaysStr(new Date().toISOString().slice(0, 10), 1));
          const adherence = computeScheduleAdherence(state, 7);
          return (
            <Card padding="p-5" className="space-y-3">
              <SectionLabel tone="muted">Rest day</SectionLabel>
              <div className="text-2xl font-black text-v5-text">Recover</div>
              <div className="text-sm text-v5-subtext">
                {tomorrow.status !== "none" && tomorrow.type && tomorrow.type !== "rest"
                  ? `Training resumes tomorrow — ${tomorrow.label || DAY_TYPE_LABEL[tomorrow.type]}.`
                  : "Training resumes soon."}
              </div>
              {adherence && adherence.overall != null && (
                <div className="text-xs text-v5-subtext border-t border-white/[0.06] pt-3">
                  Weekly adherence: <span className="text-v5-text font-bold">{adherence.overall}%</span>
                </div>
              )}
            </Card>
          );
        })()
      ) : scheduleOn && todaySchedule?.type === "recovery" ? (
        <RecoveryLogCard label={todaySchedule.label || "Active Recovery"} state={state} updateState={updateState} />
      ) : scheduleOn && todaySchedule?.type === "conditioning" ? (
        (() => {
          // A "conditioning" slot pointing at currentProgram is not a supported combination with
          // a recovery-type program day — fall back to "no plan attached" rather than crash on a
          // lifting-shaped .plan that doesn't exist for a recovery day.
          const rawRun = buildRunFromSource(state, todaySchedule.source);
          const run = rawRun?.isRecoveryDay ? null : rawRun;
          const completedSession = todaySchedule.status === "completed" && run ? findTodaysSessionForPlan(state.workoutSessions, run.plan.name) : null;
          return (
            <HeroCard>
              <SectionLabel className="flex items-center gap-1.5">
                <Timer size={12} /> Conditioning
              </SectionLabel>
              <div className="text-2xl font-black text-v5-text">{todaySchedule.label || "Conditioning"}</div>
              {run && <div className="text-sm text-v5-subtext">{run.plan.exercises.length} exercises · Est. {estimateMinutes(run.plan)} min</div>}
              {todaySchedule.status === "completed" && (
                <div className="text-sm text-v5-success font-bold flex items-center gap-1.5">
                  <Check size={14} /> Complete
                </div>
              )}
              {completedSession && (
                <div className="text-sm text-v5-subtext">
                  {formatSessionDuration(completedSession.durationSec)} · {completedSession.workingSets} working sets · {completedSession.totalVolume.toLocaleString()} lb volume
                </div>
              )}
              {completedSession && onViewWorkout && (
                <ButtonSecondary onClick={() => onViewWorkout(completedSession.id)}>View Workout</ButtonSecondary>
              )}
              <ButtonPrimary size="lg" onClick={() => (run ? startScheduled(todaySchedule.source) : onNavigate("cardio"))}>
                {todaySchedule.status === "completed" ? "Log another session" : "Start conditioning"}
              </ButtonPrimary>
            </HeroCard>
          );
        })()
      ) : scheduleOn && todaySchedule?.type === "workout" ? (
        (() => {
          const run = buildRunFromSource(state, todaySchedule.source);
          // A weekly-schedule "workout" slot pointing at the current program can still resolve to
          // one of the program's own recovery-type days (see Berserker) — never treat that as a
          // lifting workout (task: no "START WORKOUT" on a recovery-only day).
          if (run?.isRecoveryDay) {
            const recoveryDone = findTodaysSessionForPlan(state.recoverySessions, `${run.programName} — ${run.dayLabel}`);
            return (
              <HeroCard>
                <SectionLabel>{run.programName}</SectionLabel>
                <div className="text-2xl font-black text-v5-text">{run.dayLabel}</div>
                {recoveryDone ? (
                  <div className="flex items-center gap-2 text-v5-success font-bold text-lg">
                    <Check size={18} /> Recovery complete
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-v5-subtext">
                      {run.routine?.movements?.length ?? 0} movements · Est. {run.estMinutes} min
                    </div>
                    <ButtonPrimary size="lg" onClick={() => onStartRecovery(run.routine, run.programContext)}>
                      Start Recovery Session
                    </ButtonPrimary>
                  </>
                )}
              </HeroCard>
            );
          }
          const completedSession = todaySchedule.status === "completed" && run ? findTodaysSessionForPlan(state.workoutSessions, run.plan.name) : null;
          if (todaySchedule.status === "completed") {
            return (
              <HeroCard>
                <div className="flex items-center gap-2 text-v5-success font-bold text-lg">
                  <Check size={18} /> {todaySchedule.label || "Training day"}
                </div>
                <div className="text-sm text-v5-subtext">Complete</div>
                {completedSession && (
                  <div className="text-sm text-v5-subtext">
                    {formatSessionDuration(completedSession.durationSec)} · {completedSession.workingSets} working sets · {completedSession.totalVolume.toLocaleString()} lb volume
                  </div>
                )}
                {completedSession && onViewWorkout && (
                  <ButtonPrimary onClick={() => onViewWorkout(completedSession.id)}>View Workout</ButtonPrimary>
                )}
              </HeroCard>
            );
          }
          return (
            <PhotoHero
              exercise={run ? exMap[run.plan.exercises[0]?.exId] : null}
              eyebrow="Today's workout"
              title={todaySchedule.label || "Training day"}
              meta={
                run ? (
                  <div className="flex items-center gap-4 text-xs font-bold text-v5-subtext">
                    <span className="flex items-center gap-1.5"><Dumbbell size={13} className="text-v5-red" /> {run.plan.exercises.length} exercises</span>
                    <span className="flex items-center gap-1.5"><Timer size={13} className="text-v5-red" /> Est. {estimateMinutes(run.plan)} min</span>
                  </div>
                ) : (
                  <div className="text-sm text-v5-subtext">No plan attached to this day yet.</div>
                )
              }
            >
              {readiness && (
                <div className="text-xs text-v5-subtext">
                  Readiness <span className={`font-bold ${READINESS_COLOR[readiness.band]}`}>{readiness.score} {BAND_LABEL[readiness.band]}</span>
                </div>
              )}
              <ButtonPrimary size="lg" icon={Play} onClick={() => (run ? startScheduled(todaySchedule.source) : onNavigate("train"))}>
                {run ? "Start workout" : "Choose a workout"}
              </ButtonPrimary>
            </PhotoHero>
          );
        })()
      ) : todayPlan && !programDay?.isRecoveryDay && !programDay.completedToday ? (
        // The primary, most common Today state — this is the mockup's cinematic hero moment:
        // large gradient card, anatomy figure integrated on the trailing edge, eyebrow/title/
        // meta row, one unmistakable red CTA.
        <PhotoHero
          exercise={exMap[todayPlan.exercises[0]?.exId]}
          eyebrow="Today's workout"
          title={todayPlan.name}
          meta={
            <div className="flex items-center gap-4 text-xs font-bold text-v5-subtext">
              <span className="flex items-center gap-1.5"><Dumbbell size={13} className="text-v5-red" /> {todayPlan.exercises.length} exercises</span>
              <span className="flex items-center gap-1.5"><Timer size={13} className="text-v5-red" /> Est. {estimateMinutes(todayPlan)} min</span>
            </div>
          }
        >
          {programDay.isOutsideProgram ? (
            <Pill>{programDay.sourceType === "program" ? "From another program" : "Custom workout today"}</Pill>
          ) : (
            programDay.isSwapped && <Pill>Swapped for today</Pill>
          )}
          {programDay.isOutsideProgram ? (
            programDay.plannedProgramName && (
              <div className="text-xs text-v5-subtext/70">
                {programDay.plannedProgramName}
                {programDay.plannedDayLabel ? ` — ${programDay.plannedDayLabel}` : ""} still pending, unaffected
              </div>
            )
          ) : (
            programDay.isSwapped &&
            programDay.plannedDayLabel && <div className="text-xs text-v5-subtext/70">Originally planned: {programDay.plannedDayLabel}</div>
          )}
          {lastCompletedDaysAgo != null && (
            <div className="text-xs text-v5-subtext/70">Last completed {lastCompletedDaysAgo === 0 ? "today" : `${lastCompletedDaysAgo} day${lastCompletedDaysAgo === 1 ? "" : "s"} ago`}</div>
          )}
          <div className="flex gap-2">
            {programDay.isSwapped && (
              <ButtonSecondary size="lg" fullWidth={false} onClick={() => setSwapOpen(true)} className="shrink-0 px-5">
                Change
              </ButtonSecondary>
            )}
            <ButtonPrimary size="lg" icon={Play} onClick={() => onStartRun(todayPlan, programDay.programContext)} className="flex-1">
              Start workout
            </ButtonPrimary>
          </div>
          <div className="flex items-center justify-between pt-1">
            <ButtonText tone="muted" icon={Map} onClick={() => onNavigate("programTimeline")}>View Program</ButtonText>
            {!activeRun && <ButtonText tone="muted" icon={RefreshCw} onClick={() => setSwapOpen(true)}>Swap workout</ButtonText>}
          </div>
        </PhotoHero>
      ) : (
        <HeroCard>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Today</SectionLabel>
            {(todayPlan || programDay?.isRecoveryDay) && !programDay.completedToday && !activeRun && (
              <ButtonText tone="muted" icon={RefreshCw} onClick={() => setSwapOpen(true)}>Swap workout</ButtonText>
            )}
          </div>
          {programDay?.isRecoveryDay ? (
            // Recovery days are never treated as a lifting workout in disguise (task: "Do not
            // display START WORKOUT for a recovery-only day") — a dedicated card with recovery-
            // appropriate language and its own CTA into the mobility session runner.
            (() => {
              const recoveryDone = findTodaysSessionForPlan(state.recoverySessions, `${programDay.programName} — ${programDay.dayLabel}`);
              return (
                <>
                  <div className="text-xs uppercase tracking-widest text-v5-subtext">{programDay.programName}</div>
                  <div className="text-2xl font-black text-v5-text">{programDay.dayLabel}</div>
                  {recoveryDone ? (
                    <div className="flex items-center gap-2 text-v5-success font-bold text-lg">
                      <Check size={18} /> Recovery complete
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-v5-subtext">
                        {programDay.routine?.movements?.length ?? 0} movements · Est. {programDay.estMinutes} min
                      </div>
                      <ButtonPrimary size="lg" onClick={() => onStartRecovery(programDay.routine, programDay.programContext)}>
                        Start Recovery Session
                      </ButtonPrimary>
                    </>
                  )}
                </>
              );
            })()
          ) : todayPlan && programDay.completedToday ? (
            // Today's own workout is the whole story once it's done — no invitation to start
            // tomorrow's, and no dominant CTA at all (that's what read as "started the next
            // workout"). A small "Next lift" link is the only nod to what's coming up.
            (() => {
              const completedSession = findTodaysSessionForPlan(state.workoutSessions, todayPlan.name);
              return (
                <>
                  <div className="flex items-center gap-2 text-v5-success font-bold text-lg">
                    <Check size={18} /> {todayPlan.name}
                  </div>
                  <div className="text-sm text-v5-subtext">Complete</div>
                  {completedSession && (
                    <div className="text-sm text-v5-subtext">
                      {formatSessionDuration(completedSession.durationSec)} · {completedSession.workingSets} working sets · {completedSession.totalVolume.toLocaleString()} lb volume
                    </div>
                  )}
                  {completedSession && onViewWorkout && (
                    <ButtonPrimary onClick={() => onViewWorkout(completedSession.id)}>View Workout</ButtonPrimary>
                  )}
                  {programDay.nextDayLabel && (
                    <ButtonText tone="muted" onClick={() => onNavigate("train")} className="pt-1">
                      Next lift: {programDay.nextDayLabel} <ChevronRight size={12} />
                    </ButtonText>
                  )}
                </>
              );
            })()
          ) : (
            <>
              <div className="text-sm text-v5-subtext">No workout queued up.</div>
              <ButtonPrimary size="lg" onClick={() => onNavigate("train")}>Choose a workout</ButtonPrimary>
            </>
          )}
          {/* Compact Program Timeline entry point (task Part 1, section 1) — only when there's an
              actual active program behind today's card, never for the "nothing queued up" state. */}
          {programDay && (
            <ButtonText tone="muted" icon={Map} onClick={() => onNavigate("programTimeline")} className="pt-1">
              View Program
            </ButtonText>
          )}
        </HeroCard>
      )}

      {!scheduleOn && !dismissedPrompt && (
        <SetupSchedulePrompt onSetup={() => onNavigate("schedule")} onLater={() => setDismissedPrompt(true)} />
      )}

      {/* Modular 2-column row — Readiness paired with Bodyweight, each a compact focused tile
          rather than another full-width card competing with the hero above (mockup section 5). */}
      <div className="grid grid-cols-2 gap-3">
        <ReadinessCheckIn state={state} updateState={updateState} compact />
        {currentWeight != null ? (
          <BodyweightCard state={state} currentWeight={currentWeight} avg7={avg7} weeklyChange={weeklyChange} onNavigate={onNavigate} />
        ) : (
          <Card onClick={() => onNavigate("progress")} padding="p-4" className="flex flex-col justify-center items-center text-center space-y-1.5">
            <Scale size={18} className="text-v5-subtext/60" />
            <div className="text-[11px] text-v5-subtext">Log your weight</div>
          </Card>
        )}
      </div>

      <NutritionCard state={state} onNavigate={onNavigate} />

      <Card>
        <SectionLabel className="mb-2 flex items-center gap-1.5">
          <MessageCircle size={12} /> Coach Brief
        </SectionLabel>
        <div className="text-sm text-v5-text/90 leading-relaxed">{coachMessage}</div>
        <ButtonText onClick={() => onNavigate("coach")} className="mt-2.5">View plan →</ButtonText>
      </Card>

      {weekStrip && <WeekStrip strip={weekStrip} />}

      {missionView && (
        <Card onClick={() => onNavigate("mission")}>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel tone="muted">Mission</SectionLabel>
            <div className={`text-[11px] uppercase tracking-widest font-bold ${STATUS_COLOR[missionView.status]}`}>{GOAL_STATUS_LABEL[missionView.status]}</div>
          </div>
          <div className="text-lg font-bold text-v5-text truncate">{missionView.goal.title}</div>
          <ProgressBar pct={missionView.pct} className="mt-2.5" />
          <div className="text-xs text-v5-subtext mt-1.5">{missionView.pct}% complete</div>
        </Card>
      )}

      {recentWin && (
        <Card>
          <SectionLabel tone="muted" className="mb-1.5 flex items-center gap-1.5">
            <Award size={12} className="text-v5-red" /> Recent win
          </SectionLabel>
          <div className="text-base font-bold text-v5-text">{exMap[recentWin.exId]?.name || recentWin.exId}</div>
          {recentWin.weight != null && <div className="text-lg text-v5-subtext">{recentWin.weight} × {recentWin.reps}</div>}
        </Card>
      )}

      <div>
        <SectionLabel tone="muted" className="mb-2">Quick actions</SectionLabel>
        <div className="grid grid-cols-4 gap-2">
          <ActionTile icon={Weight} label="Log weight" onClick={() => onNavigate("progress")} />
          <ActionTile icon={RefreshCw} label="Change workout" onClick={() => onNavigate("train")} />
          <ActionTile icon={TrendingUp} label="View progress" onClick={() => onNavigate("progress")} />
          <ActionTile icon={MessageCircle} label="Ask coach" onClick={() => onNavigate("coach")} />
        </div>
      </div>
    </div>
  );
}
