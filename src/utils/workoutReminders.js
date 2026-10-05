// ---------------- WORKOUT REMINDERS (provider-agnostic scheduling logic) ----------------
// This module answers exactly one question — "should BRK remind this athlete about a scheduled
// workout right now, and what should it say?" — and nothing about HOW the reminder is delivered.
// App.jsx's local notification check and, eventually, a server-side push sender, both read the
// same `buildTodayReminderPlan` output. A future Capacitor build swapping in native local
// notifications reuses this exact module unchanged (task: "never tightly coupled to one
// notification provider").
//
// Reminders only ever concern TODAY's scheduled slot (per task Part 3 — "configurable default
// time" for scheduled workout days), so this intentionally does not look further ahead.
import { hasSchedule, getTodaySchedule, DAY_TYPE_LABEL } from "./weeklySchedule.js";

export const DEFAULT_REMINDER_TIME = "17:30";

function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getReminderSettings(state) {
  return (
    state.reminderSettings || {
      enabled: false,
      time: DEFAULT_REMINDER_TIME,
      timeZone: detectTimeZone(),
      lastFiredDateKey: null,
    }
  );
}

function todayDateKeyInZone(timeZone) {
  // en-CA gives YYYY-MM-DD directly — avoids a manual month/day zero-pad dance.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Converts a wall-clock "HH:MM on this date, in this IANA zone" into the actual UTC instant it
// represents — the one piece of real timezone math a naive `new Date(dateStr + "T" + time)`
// gets wrong, since that constructor always assumes either UTC or the SYSTEM's zone, never an
// arbitrary stored one. A 5:30 PM reminder saved while traveling must still fire at 5:30 PM
// local, not silently shift (task's explicit timezone-safety warning).
//
// Standard single-correction-pass algorithm: guess the instant assuming UTC, read back what
// wall-clock time that guess actually renders as in the target zone, then shift by the
// difference. Exact except inside the ~1hr window of a DST transition itself on the target date
// (an acknowledged, documented edge case — see the final report).
export function zonedTimeToUtcDate(dateKeyStr, hhmm, timeZone) {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  const [hh, mm] = (hhmm || DEFAULT_REMINDER_TIME).split(":").map(Number);
  const guessMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(guessMs)).map((p) => [p.type, p.value]));
  // formatToParts renders hour "24" for midnight in some locales/zones — normalize to 0.
  const renderedHour = parts.hour === "24" ? 0 : Number(parts.hour);
  const renderedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), renderedHour, Number(parts.minute), Number(parts.second));
  const driftMs = guessMs - renderedAsUtc;
  return new Date(guessMs + driftMs);
}

// The core decision function. Returns null whenever a reminder should NOT fire/exist right now:
// disabled, no real schedule, today is a rest day, or today's slot is already complete (task DO
// NOT: "send reminders after workout completion"). Otherwise returns everything a notification
// needs to render and deep-link, plus the exact instant it's due.
export function buildTodayReminderPlan(state) {
  const settings = getReminderSettings(state);
  if (!settings.enabled) return null;
  if (!hasSchedule(state)) return null;

  const today = getTodaySchedule(state);
  if (!today || !today.type || today.type === "rest") return null;
  if (today.status === "completed") return null;

  const timeZone = settings.timeZone || detectTimeZone();
  const dateKey = todayDateKeyInZone(timeZone);
  const fireAt = zonedTimeToUtcDate(dateKey, settings.time || DEFAULT_REMINDER_TIME, timeZone);
  const label = today.label || DAY_TYPE_LABEL[today.type] || "Training day";

  return {
    dateKey,
    fireAt,
    title: "BRK — Training day",
    body: `${label} is on today's schedule.`,
    tag: "brk-workout-reminder",
    deepLink: "today",
    scheduleType: today.type,
  };
}

// Dedup guard — a reminder should fire at most once per scheduled date, never re-fire on every
// periodic check after the first. Compares against the persisted lastFiredDateKey rather than a
// boolean, so it naturally resets itself the next scheduled day without any cleanup step.
export function reminderIsDue(state, now = new Date()) {
  const plan = buildTodayReminderPlan(state);
  if (!plan) return null;
  const settings = getReminderSettings(state);
  if (settings.lastFiredDateKey === plan.dateKey) return null;
  if (now.getTime() < plan.fireAt.getTime()) return null;
  return plan;
}
