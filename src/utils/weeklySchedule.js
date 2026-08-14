// ---------------- WEEKLY SCHEDULE ----------------
// The engine behind "does BRK know the difference between a training day, a conditioning day,
// an active recovery day, a scheduled rest day, and a missed workout." Two independent pieces
// of state, both optional (a user who never sets this up sees zero change in behavior):
//
//   state.weeklySchedule — the recurring plan itself.
//     { mode: "fixed" | "rolling",
//       fixedDays: { mon, tue, wed, thu, fri, sat, sun } -> DaySlot   (mode "fixed")
//       rollingSequence: [DaySlot, ...], rollingCursor: number        (mode "rolling")
//       createdAt }
//   DaySlot = { type: "workout"|"conditioning"|"recovery"|"rest", source: Source|null, label }
//   Source = { kind: "currentProgram" } | { kind: "plan", id } | { kind: "template", id }
//
//   state.scheduleLog — sparse, append-only overrides layered on top of the recurring plan:
//   one entry per calendar date that ever needed something other than the default lookup
//   (a skip, a move, or — rolling mode only — a permanent snapshot of what that date resolved
//   to, since rolling's "today" depends on how many prior slots have been consumed and that
//   history has to be recorded somewhere). Fixed-mode dates with nothing exceptional never get
//   an entry at all; they're just recomputed from fixedDays every time.
//     { id, date, kind: "skip"|"move_out"|"move_in"|"resolved",
//       type, source, label, status?, movedTo?, movedFrom?, createdAt }
//
// Every function here is a pure read (of state) or a pure builder that returns a plain patch
// object/array for the caller to apply via updateState — nothing in this file touches React or
// localStorage directly, matching resolveCurrentProgramDay/adherence.js/coachContext.js.

import { resolveCurrentProgramDay } from "./programSchedule.js";

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const WEEKDAY_LABELS = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
export const DAY_TYPES = ["workout", "conditioning", "recovery", "rest"];
export const DAY_TYPE_LABEL = {
  workout: "Strength",
  conditioning: "Conditioning",
  recovery: "Active Recovery",
  rest: "Rest",
};

function dk(dateLike) {
  return (typeof dateLike === "string" ? dateLike : dateLike.toISOString()).slice(0, 10);
}
export function todayKey() {
  return dk(new Date());
}
function weekdayKeyOf(dateKeyStr) {
  return WEEKDAYS[new Date(dateKeyStr + "T12:00:00").getDay()];
}
function addDays(dateKeyStr, n) {
  const d = new Date(dateKeyStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return dk(d);
}

export function hasSchedule(state) {
  return !!(state.weeklySchedule && state.weeklySchedule.mode);
}

export function emptySlot(type = "rest") {
  return { type, source: null, label: type === "rest" ? "Rest" : "" };
}
export function defaultFixedDays() {
  return WEEKDAYS.reduce((acc, k) => {
    acc[k] = emptySlot("rest");
    return acc;
  }, {});
}

// ---------- suggested starting points (never auto-saved — always shown for the user to edit) ----------
// Deliberately generic: workout slots point at { kind: "currentProgram" } rather than pinning a
// specific program day-index to a specific weekday, since resolveCurrentProgramDay already owns
// "which day is next" (advancing on every finished session regardless of weekday) — pinning a
// second, independent day-index here would just be a second clock that can drift out of sync
// with the first. The schedule's job is only "which weekdays are training days," not "which
// exact day-of-program lands on which weekday."
export function suggestFixedScheduleForCurrentProgram(programDayCount) {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const days = defaultFixedDays();
  let dayIdx = 0;
  let sinceRest = 0;
  for (const key of order) {
    if (dayIdx >= programDayCount) {
      days[key] = emptySlot("rest");
      continue;
    }
    if (sinceRest === 2) {
      days[key] = emptySlot("rest");
      sinceRest = 0;
      continue;
    }
    days[key] = { type: "workout", source: { kind: "currentProgram" }, label: "Training day" };
    dayIdx++;
    sinceRest++;
  }
  return days;
}
export function suggestRollingSequenceForProgram(programDayCount) {
  const seq = [];
  let sinceRest = 0;
  for (let i = 0; i < programDayCount; i++) {
    seq.push({ type: "workout", source: { kind: "currentProgram" }, label: "Training day" });
    sinceRest++;
    if (sinceRest === 2 && i < programDayCount - 1) {
      seq.push(emptySlot("rest"));
      sinceRest = 0;
    }
  }
  return seq;
}

// ---------- source resolution ----------
// Turns a DaySlot's `source` into the same { plan, programContext } shape startRun() already
// expects everywhere else in the app (TrainTab, TemplatesTab, BuildPlanTab) — so starting a
// scheduled day is just startRun(plan, fromTab, programContext), no new run machinery needed.
export function buildRunFromSource(state, source) {
  if (!source) return null;
  if (source.kind === "currentProgram") {
    const day = resolveCurrentProgramDay(state);
    if (!day || day.isComplete) return null;
    return { plan: day.plan, programContext: day.programContext };
  }
  if (source.kind === "plan") {
    const p = (state.customPlans || []).find((pl) => pl.id === source.id);
    if (!p) return null;
    return { plan: { name: p.name, exercises: p.exercises }, programContext: null };
  }
  if (source.kind === "template") {
    const t = (state.templates || []).find((tp) => tp.id === source.id);
    if (!t) return null;
    return { plan: { name: t.name, exercises: t.exercises }, programContext: null };
  }
  return null;
}

// ---------- completion detection ----------
// Matches purely by calendar date against logs that already exist, the same way the rest of
// the app (adherence.js, weeklyReview.js) already treats "a day with a matching entry" as done
// — no new linkage/bookkeeping required in GuidedRunView or CardioTab.
function isCompleted(state, dateKeyStr, type) {
  if (type === "workout") {
    return (state.workoutSessions || []).some((s) => dk(s.finishedAt) === dateKeyStr);
  }
  if (type === "conditioning") {
    return (
      (state.cardioLogs || []).some((c) => dk(c.date) === dateKeyStr) ||
      (state.workoutSessions || []).some((s) => dk(s.finishedAt) === dateKeyStr)
    );
  }
  if (type === "recovery") {
    return (state.recoveryLogs || []).some((r) => dk(r.date) === dateKeyStr);
  }
  return false;
}

function scheduleLogAt(state, dateKeyStr) {
  return (state.scheduleLog || []).find((e) => e.date === dateKeyStr) || null;
}

// ---------- the core resolver ----------
// Given any calendar date, returns what BRK believes is true about that day:
//   { date, type, source, label, status }
// status is one of: "none" (no schedule / unknowable), "rest", "pending" (today, not yet due to
// be judged), "completed", "missed" (past, unresolved), "skipped", "moved_away" (was scheduled
// here, explicitly moved elsewhere), "upcoming" (future).
export function getScheduleDay(state, dateKeyStr) {
  const sched = state.weeklySchedule;
  const today = todayKey();
  if (!sched || !sched.mode) return { date: dateKeyStr, type: null, source: null, label: null, status: "none" };
  // A recurring fixed schedule shouldn't retroactively claim dates before it existed as missed
  // — someone who set up a schedule 3 days ago never "missed" a training day from 3 weeks ago.
  if (sched.createdAt && dateKeyStr < dk(sched.createdAt)) {
    return { date: dateKeyStr, type: null, source: null, label: null, status: "none" };
  }

  const logEntry = scheduleLogAt(state, dateKeyStr);
  if (logEntry) {
    if (logEntry.kind === "skip") {
      return { date: dateKeyStr, type: logEntry.type, source: logEntry.source, label: logEntry.label, status: "skipped" };
    }
    if (logEntry.kind === "move_out") {
      return { date: dateKeyStr, type: logEntry.type, source: logEntry.source, label: logEntry.label, status: "moved_away" };
    }
    if (logEntry.kind === "move_in" || logEntry.kind === "resolved") {
      const type = logEntry.type;
      if (logEntry.kind === "resolved") {
        return { date: dateKeyStr, type, source: logEntry.source, label: logEntry.label, status: logEntry.status };
      }
      if (type === "rest") return { date: dateKeyStr, type, source: logEntry.source, label: logEntry.label, status: "rest" };
      const done = isCompleted(state, dateKeyStr, type);
      const status = done ? "completed" : dateKeyStr < today ? "missed" : dateKeyStr === today ? "pending" : "upcoming";
      return { date: dateKeyStr, type, source: logEntry.source, label: logEntry.label, status };
    }
  }

  let slot = null;
  if (sched.mode === "fixed") {
    slot = sched.fixedDays?.[weekdayKeyOf(dateKeyStr)] || null;
  } else if (sched.mode === "rolling" && dateKeyStr === today) {
    const seq = sched.rollingSequence || [];
    if (seq.length > 0) slot = seq[(sched.rollingCursor || 0) % seq.length];
  }
  if (!slot) return { date: dateKeyStr, type: null, source: null, label: null, status: "none" };

  if (slot.type === "rest") return { date: dateKeyStr, ...slot, status: "rest" };
  const done = isCompleted(state, dateKeyStr, slot.type);
  const status = done ? "completed" : dateKeyStr < today ? "missed" : dateKeyStr === today ? "pending" : "upcoming";
  return { date: dateKeyStr, ...slot, status };
}

export function getTodaySchedule(state) {
  return getScheduleDay(state, todayKey());
}

// Monday-first, 7 days, for the This Week strip. Works for any date the schedule can resolve —
// future/unresolved rolling days just come back status "none" and the UI renders them blank.
export function getWeekStrip(state, anchorDateStr = todayKey()) {
  const dow = new Date(anchorDateStr + "T12:00:00").getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDays(anchorDateStr, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => getScheduleDay(state, addDays(monday, i)));
}

// ---------- rolling-mode housekeeping ----------
// Rolling's "today" only advances once it's actually resolved (rest days auto-acknowledge
// themselves the moment they're seen; workout/conditioning/recovery days wait for a real log to
// match). Call this once per app-open; it's a no-op once today is already resolved, so it's
// safe to call on every TodayTab mount. Returns a patch to apply via updateState, or null.
export function syncRollingToday(state) {
  const sched = state.weeklySchedule;
  if (!sched || sched.mode !== "rolling") return null;
  const today = todayKey();
  if (scheduleLogAt(state, today)) return null;
  const seq = sched.rollingSequence || [];
  if (seq.length === 0) return null;
  const slot = seq[(sched.rollingCursor || 0) % seq.length];
  const done = slot.type === "rest" ? true : isCompleted(state, today, slot.type);
  if (!done) return null;
  const status = slot.type === "rest" ? "rest" : "completed";
  return {
    logEntry: {
      id: `sched_${Date.now()}`,
      date: today,
      kind: "resolved",
      type: slot.type,
      source: slot.source,
      label: slot.label,
      status,
      createdAt: new Date().toISOString(),
    },
    newCursor: (sched.rollingCursor || 0) + 1,
  };
}

// ---------- missed-workout banner ----------
// Fixed-mode only, by design: rolling schedules don't "miss" a slot the way a fixed weekday
// can — an unresolved rolling day just keeps showing as today's pending item (see
// getScheduleDay), which is the whole point of a rolling schedule for unpredictable weeks.
// Surfaces only the single most recent unresolved day so this never turns into a stack of
// nagging banners.
export function getMissedEntry(state, lookbackDays = 7) {
  const sched = state.weeklySchedule;
  if (!sched || sched.mode !== "fixed") return null;
  const today = todayKey();
  for (let i = 1; i <= lookbackDays; i++) {
    const dateStr = addDays(today, -i);
    const day = getScheduleDay(state, dateStr);
    if (day.status === "missed" && (day.type === "workout" || day.type === "conditioning")) return day;
  }
  return null;
}

export function buildSkipPatch(missedDay) {
  return {
    id: `sched_${Date.now()}`,
    date: missedDay.date,
    kind: "skip",
    type: missedDay.type,
    source: missedDay.source,
    label: missedDay.label,
    createdAt: new Date().toISOString(),
  };
}
// One move_out + one move_in entry — the missed date is marked resolved (so it stops showing
// as missed) and the target date carries the moved slot, which getScheduleDay checks before
// falling back to that date's normal weekday assignment, so nothing doubles up.
export function buildMovePatch(missedDay, targetDateStr) {
  const now = new Date().toISOString();
  return [
    {
      id: `sched_${Date.now()}_out`,
      date: missedDay.date,
      kind: "move_out",
      type: missedDay.type,
      source: missedDay.source,
      label: missedDay.label,
      movedTo: targetDateStr,
      createdAt: now,
    },
    {
      id: `sched_${Date.now()}_in`,
      date: targetDateStr,
      kind: "move_in",
      type: missedDay.type,
      source: missedDay.source,
      label: missedDay.label,
      movedFrom: missedDay.date,
      createdAt: now,
    },
  ];
}
// "Do Today" is just a move to today's date — same machinery, so there's no separate path that
// could create a duplicate workout.
export function buildDoTodayPatch(missedDay) {
  return buildMovePatch(missedDay, todayKey());
}

// ---------- adherence ----------
// Scheduled vs. completed, by type, over a trailing window. Rest days never enter the ratio at
// all (not even as a denominator entry) — they can't be "missed." Recovery only appears in the
// breakdown when at least one recovery day actually fell inside the window, matching the
// existing cardioPct-only-if-there's-something-to-judge pattern in adherence.js.
export function computeScheduleAdherence(state, days = 7) {
  if (!hasSchedule(state)) return null;
  const today = todayKey();
  const counts = {
    workout: { scheduled: 0, completed: 0 },
    conditioning: { scheduled: 0, completed: 0 },
    recovery: { scheduled: 0, completed: 0 },
  };
  let restDays = 0;
  for (let i = 0; i < days; i++) {
    const dateStr = addDays(today, -i);
    const day = getScheduleDay(state, dateStr);
    if (day.status === "none" || day.status === "upcoming") continue;
    if (day.type === "rest") {
      restDays++;
      continue;
    }
    if (!counts[day.type]) continue;
    counts[day.type].scheduled += 1;
    if (day.status === "completed") counts[day.type].completed += 1;
  }
  const totalScheduled = counts.workout.scheduled + counts.conditioning.scheduled + counts.recovery.scheduled;
  const totalCompleted = counts.workout.completed + counts.conditioning.completed + counts.recovery.completed;
  const overall = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : null;
  return { days, overall, restDays, lifting: counts.workout, conditioning: counts.conditioning, recovery: counts.recovery };
}

// ---------- streak ----------
// Measures "followed the plan," not "trained every day": rest days (and days explicitly moved
// elsewhere) pass through without breaking or padding the count; only an unresolved obligation
// (missed/skipped) ends it. Starts from yesterday — today may still be in progress.
export function computeScheduleStreak(state, maxLookback = 60) {
  if (!hasSchedule(state)) return 0;
  const today = todayKey();
  let streak = 0;
  for (let i = 1; i <= maxLookback; i++) {
    const dateStr = addDays(today, -i);
    const day = getScheduleDay(state, dateStr);
    if (day.status === "none") break;
    if (day.status === "rest" || day.status === "moved_away") continue;
    if (day.status === "completed") {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

// ---------- repeated-miss pattern (coach) ----------
const SPELLED_ORDINALS = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];
function ordinal(n) {
  if (n < SPELLED_ORDINALS.length) return SPELLED_ORDINALS[n];
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
// Same discipline as coachMemory.js: requires a real minimum sample before claiming a pattern,
// and only ever reports the single worst-offending type.
export function repeatedScheduleMiss(state, days = 30) {
  if (!hasSchedule(state)) return null;
  const today = todayKey();
  const missesByType = { conditioning: 0, workout: 0, recovery: 0 };
  for (let i = 1; i <= days; i++) {
    const dateStr = addDays(today, -i);
    const day = getScheduleDay(state, dateStr);
    if ((day.status === "missed" || day.status === "skipped") && missesByType[day.type] != null) {
      missesByType[day.type] += 1;
    }
  }
  const [worstType, worstCount] = Object.entries(missesByType).sort((a, b) => b[1] - a[1])[0];
  if (worstCount < 3) return null;
  return {
    type: worstType,
    count: worstCount,
    text: `This is the ${ordinal(worstCount)} ${DAY_TYPE_LABEL[worstType].toLowerCase()} session you've skipped this month. Either move it to a day you'll actually do it or stop pretending the current schedule works.`,
  };
}
