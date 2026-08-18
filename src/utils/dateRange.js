// ---------------- DATA WORKBOOK — DATE RANGE ----------------
// No shared date-range utility exists elsewhere in BRK (every consumer — weeklyReview.js,
// bodyweightMath.js, muscleVolume.js, nutritionAdherence.js — reimplements its own trailing-
// days window locally). This is the first one, built fresh for the workbook. Everything here
// works in LOCAL time, not UTC, specifically to avoid the off-by-one a date-only string like
// "2026-08-18" gets when parsed with `new Date(str)` (which is UTC midnight, and can land on
// the wrong side of a local-time boundary for negative UTC offsets).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Accepts a Date, a date-only string ("2026-08-18"), or a full ISO datetime string (which
// already carries its own offset/zone and parses correctly as-is). Date-only strings are
// split and built with the local Date constructor rather than passed straight to `new Date()`
// — the whole point of this function.
export function parseDateFlexible(value) {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmt(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const DATE_RANGE_PRESETS = [
  { value: "last30", label: "Last 30 Days" },
  { value: "last90", label: "Last 90 Days" },
  { value: "last365", label: "Last 365 Days" },
  { value: "thisYear", label: "This Calendar Year" },
  { value: "lastYear", label: "Last Calendar Year" },
  { value: "allTime", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

// Returns { preset, start, end, label, sublabel }. `start: null` means no lower bound (all
// time). `end` always has a value. Trailing-day presets are inclusive of today — "Last 30
// Days" covers today plus the 29 days before it, 30 calendar days total.
export function resolveDateRange(preset, { customStart, customEnd, now = new Date() } = {}) {
  const today = startOfDayLocal(now);
  const todayEnd = endOfDayLocal(now);

  switch (preset) {
    case "last30": {
      const start = startOfDayLocal(new Date(today.getTime() - 29 * MS_PER_DAY));
      return { preset, start, end: todayEnd, label: "Last 30 Days", sublabel: `${fmt(start)} – ${fmt(todayEnd)}` };
    }
    case "last90": {
      const start = startOfDayLocal(new Date(today.getTime() - 89 * MS_PER_DAY));
      return { preset, start, end: todayEnd, label: "Last 90 Days", sublabel: `${fmt(start)} – ${fmt(todayEnd)}` };
    }
    case "last365": {
      const start = startOfDayLocal(new Date(today.getTime() - 364 * MS_PER_DAY));
      return { preset, start, end: todayEnd, label: "Last 365 Days", sublabel: `${fmt(start)} – ${fmt(todayEnd)}` };
    }
    case "thisYear": {
      const year = today.getFullYear();
      const start = new Date(year, 0, 1);
      const end = endOfDayLocal(new Date(year, 11, 31));
      return { preset, start, end, label: `${year} Calendar Year`, sublabel: `${fmt(start)} – ${fmt(end)}` };
    }
    case "lastYear": {
      const year = today.getFullYear() - 1;
      const start = new Date(year, 0, 1);
      const end = endOfDayLocal(new Date(year, 11, 31));
      return { preset, start, end, label: `${year} Calendar Year`, sublabel: `${fmt(start)} – ${fmt(end)}` };
    }
    case "custom": {
      const start = customStart ? startOfDayLocal(parseDateFlexible(customStart)) : null;
      const end = customEnd ? endOfDayLocal(parseDateFlexible(customEnd)) : todayEnd;
      return {
        preset,
        start,
        end,
        label: "Custom Range",
        sublabel: start ? `${fmt(start)} – ${fmt(end)}` : "Select a start and end date",
      };
    }
    case "allTime":
    default:
      return { preset: "allTime", start: null, end: todayEnd, label: "All Time", sublabel: "Every recorded entry" };
  }
}

// True if `value` (a Date, date-only string, or ISO datetime string) falls inside `range`
// (inclusive on both ends). A range with `start: null` has no lower bound.
export function isWithinRange(value, range) {
  if (!range) return true;
  const d = parseDateFlexible(value);
  if (!d) return false;
  const t = d.getTime();
  if (range.start && t < range.start.getTime()) return false;
  if (range.end && t > range.end.getTime()) return false;
  return true;
}
