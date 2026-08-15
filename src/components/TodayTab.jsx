import React, { useEffect, useState } from "react";
import { ChevronRight, MessageCircle, Award, Scale, Timer, Check } from "lucide-react";
import ReadinessCheckIn from "./ReadinessCheckIn.jsx";
import NutritionCard from "./NutritionCard.jsx";
import { rollingAverage, weeklyRateOfChange, latestValue } from "../utils/bodyweightMath.js";
import { resolveGoalCurrentValue, goalHistory } from "../utils/goalData.js";
import { goalProgressPct, goalStatus, GOAL_STATUS_LABEL } from "../utils/goalMath.js";
import { resolveCurrentProgramDay } from "../utils/programSchedule.js";
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
const STATUS_COLOR = { ahead: "text-green-500", on_track: "text-green-500", behind: "text-red-500", no_data: "text-neutral-500" };
const READINESS_COLOR = { green: "text-green-500", yellow: "text-yellow-500", red: "text-red-500" };
const GLYPH_FOR_STATUS = { completed: "✓", pending: "●", upcoming: "○", rest: "REST", missed: "×", skipped: "×", moved_away: "–", none: "" };
const GLYPH_COLOR = {
  completed: "text-green-500",
  pending: "text-red-500",
  upcoming: "text-neutral-600",
  rest: "text-neutral-500",
  missed: "text-red-600",
  skipped: "text-red-600",
  moved_away: "text-neutral-600",
  none: "text-neutral-800",
};

// Compact Mon-Sun row on the Today dashboard — a screenshot-friendly week-at-a-glance. Tapping
// a day expands a one-line detail instead of navigating away, keeping this a glance, not a trip.
function WeekStrip({ strip }) {
  const [openIdx, setOpenIdx] = useState(null);
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-3">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">This week</div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {strip.map((day, i) => (
          <button
            key={i}
            onClick={() => setOpenIdx((idx) => (idx === i ? null : i))}
            className="flex flex-col items-center gap-1 py-1.5 hover:bg-charcoal-deep"
          >
            <span className="text-[10px] text-neutral-600">{labels[i]}</span>
            <span className={`text-xs font-bold ${GLYPH_COLOR[day.status]}`}>{GLYPH_FOR_STATUS[day.status] || "·"}</span>
          </button>
        ))}
      </div>
      {openIdx != null && (
        <div className="mt-2 pt-2 border-t border-neutral-900 text-xs text-neutral-400">
          {strip[openIdx].status === "none" ? (
            "Nothing scheduled."
          ) : (
            <>
              <span className="text-white font-bold">{strip[openIdx].label || DAY_TYPE_LABEL[strip[openIdx].type]}</span>
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
    </div>
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
    <div className="border-2 border-red-700 bg-charcoal-panel p-4 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-red-600">Missed workout</div>
      <div className="text-base text-white">
        {missed.label || DAY_TYPE_LABEL[missed.type]} was scheduled {whenLabel}.
      </div>

      {mode === "skip" ? (
        <div className="space-y-2">
          <div className="text-sm text-neutral-400">
            Skip {missed.label || DAY_TYPE_LABEL[missed.type]}? This will count as a missed scheduled session.
          </div>
          <div className="flex gap-2">
            <button onClick={confirmSkip} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
              Skip
            </button>
            <button onClick={() => setMode(null)} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
              Cancel
            </button>
          </div>
        </div>
      ) : mode === "move" ? (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Move to</div>
          <div className="flex flex-wrap gap-2">
            {moveOptions.map((d) => (
              <button
                key={d}
                onClick={() => moveTo(d)}
                className="px-3 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-red-700 hover:text-red-500"
              >
                {new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}
              </button>
            ))}
          </div>
          <button onClick={() => setMode(null)} className="text-xs text-neutral-600 hover:text-neutral-400">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={doToday} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
            Do today
          </button>
          <button onClick={() => setMode("move")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600">
            Move
          </button>
          <button onClick={() => setMode("skip")} className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-500 hover:text-red-500">
            Skip
          </button>
        </div>
      )}
    </div>
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
    <div className="border-2 border-red-700 bg-charcoal-panel p-5 space-y-3">
      <div className="text-[11px] uppercase tracking-widest text-red-600">Active recovery</div>
      <div className="text-2xl font-bold text-white">{label}</div>
      <div className="text-sm text-neutral-400">Walk · Mobility · Light cardio</div>
      {loggedToday ? (
        <div className="text-sm text-green-500 font-bold">Recovery logged — {loggedToday.activity}</div>
      ) : open ? (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {RECOVERY_ACTIVITIES.map((a) => (
              <button
                key={a}
                onClick={() => setActivity(a)}
                className={`px-3 py-2 text-xs uppercase tracking-widest font-bold border ${
                  activity === a ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
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
            className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          />
          <button onClick={save} className="w-full py-3 text-sm uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
            Save
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full py-4 text-sm uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          Log recovery
        </button>
      )}
    </div>
  );
}

function SetupSchedulePrompt({ onSetup, onLater }) {
  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-bold text-white">Set up your training week</div>
        <div className="text-xs text-neutral-500 mt-0.5">Know which days are training, conditioning, recovery, or rest.</div>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <button onClick={onLater} className="text-xs text-neutral-600 hover:text-neutral-400">
          Later
        </button>
        <button onClick={onSetup} className="px-3 py-2 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
          Set up
        </button>
      </div>
    </div>
  );
}

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

      {weekStrip && <WeekStrip strip={weekStrip} />}

      {missedEntry && <MissedWorkoutBanner missed={missedEntry} state={state} updateState={updateState} onStartRun={onStartRun} />}

      {/* Today's training — the dominant card on the page. */}
      {scheduleOn && todaySchedule?.type === "rest" ? (
        (() => {
          const tomorrow = getScheduleDay(state, addDaysStr(new Date().toISOString().slice(0, 10), 1));
          const adherence = computeScheduleAdherence(state, 7);
          return (
            <div className="border border-neutral-800 bg-charcoal-panel p-5 space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">Rest day</div>
              <div className="text-2xl font-bold text-white">Recover</div>
              <div className="text-sm text-neutral-400">
                {tomorrow.status !== "none" && tomorrow.type && tomorrow.type !== "rest"
                  ? `Training resumes tomorrow — ${tomorrow.label || DAY_TYPE_LABEL[tomorrow.type]}.`
                  : "Training resumes soon."}
              </div>
              {adherence && adherence.overall != null && (
                <div className="text-xs text-neutral-500 border-t border-neutral-900 pt-3">
                  Weekly adherence: <span className="text-white font-bold">{adherence.overall}%</span>
                </div>
              )}
            </div>
          );
        })()
      ) : scheduleOn && todaySchedule?.type === "recovery" ? (
        <RecoveryLogCard label={todaySchedule.label || "Active Recovery"} state={state} updateState={updateState} />
      ) : scheduleOn && todaySchedule?.type === "conditioning" ? (
        (() => {
          const run = buildRunFromSource(state, todaySchedule.source);
          return (
            <div className="border-2 border-red-700 bg-charcoal-panel p-5 space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-red-600 flex items-center gap-1.5">
                <Timer size={12} /> Conditioning
              </div>
              <div className="text-2xl font-bold text-white">{todaySchedule.label || "Conditioning"}</div>
              {run && <div className="text-sm text-neutral-400">{run.plan.exercises.length} exercises · Est. {estimateMinutes(run.plan)} min</div>}
              {todaySchedule.status === "completed" && (
                <div className="text-sm text-green-500 font-bold flex items-center gap-1.5">
                  <Check size={14} /> Completed today
                </div>
              )}
              <button
                onClick={() => (run ? startScheduled(todaySchedule.source) : onNavigate("cardio"))}
                className="w-full py-4 text-sm uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
              >
                {todaySchedule.status === "completed" ? "Log another session" : "Start conditioning"}
              </button>
            </div>
          );
        })()
      ) : scheduleOn && todaySchedule?.type === "workout" ? (
        (() => {
          const run = buildRunFromSource(state, todaySchedule.source);
          return (
            <div className="border-2 border-red-700 bg-charcoal-panel p-5 space-y-3">
              <div className="text-[11px] uppercase tracking-widest text-red-600">Today</div>
              <div className="text-2xl font-bold text-white">{todaySchedule.label || "Training day"}</div>
              {run ? (
                <div className="text-sm text-neutral-400">
                  {run.plan.exercises.length} exercises · Est. {estimateMinutes(run.plan)} min
                </div>
              ) : (
                <div className="text-sm text-neutral-400">No plan attached to this day yet.</div>
              )}
              {readiness && (
                <div className="text-sm text-neutral-400">
                  Readiness <span className={`font-bold ${READINESS_COLOR[readiness.band]}`}>{readiness.score} {BAND_LABEL[readiness.band]}</span>
                </div>
              )}
              {todaySchedule.status === "completed" && (
                <div className="text-sm text-green-500 font-bold flex items-center gap-1.5">
                  <Check size={14} /> Completed today
                </div>
              )}
              <button
                onClick={() => (run ? startScheduled(todaySchedule.source) : onNavigate("train"))}
                className="w-full py-4 text-sm uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
              >
                {!run ? "Choose a workout" : todaySchedule.status === "completed" ? "Log another session" : "Start workout"}
              </button>
            </div>
          );
        })()
      ) : (
        <div className="border-2 border-red-700 bg-charcoal-panel p-5 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Today</div>
          {todayPlan && programDay.completedToday ? (
            // Today's own workout is the whole story once it's done — no invitation to start
            // tomorrow's, and no dominant CTA at all (that's what read as "started the next
            // workout"). A small "Next lift" link is the only nod to what's coming up.
            <>
              <div className="flex items-center gap-2 text-green-500 font-bold text-lg">
                <Check size={18} /> {todayPlan.name}
              </div>
              <div className="text-sm text-neutral-400">Completed today</div>
              {programDay.nextDayLabel && (
                <button
                  onClick={() => onNavigate("train")}
                  className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500 flex items-center gap-1 pt-1"
                >
                  Next lift: {programDay.nextDayLabel} <ChevronRight size={12} />
                </button>
              )}
            </>
          ) : todayPlan ? (
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
      )}

      {!scheduleOn && !dismissedPrompt && (
        <SetupSchedulePrompt onSetup={() => onNavigate("schedule")} onLater={() => setDismissedPrompt(true)} />
      )}

      <NutritionCard state={state} onNavigate={onNavigate} />

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
