import React, { useEffect, useMemo, useState } from "react";
import { Search, X, Calendar, List, Award } from "lucide-react";
import TrainingCalendar from "./TrainingCalendar.jsx";
import { PeriodSelect } from "./ui/Kit.jsx";
import { formatSessionDuration } from "../utils/workoutSets.js";
import { sessionPRCount } from "../utils/prSummary.js";

// "Titan — Day 4: Shoulders & Arms" -> "Titan" — the part before the em dash is the
// program/plan family name every multi-day program's planName already uses (see finishRun);
// a plain custom/blank workout has no dash at all, so it becomes its own single-session
// bucket rather than being forced into a fake "Custom" catch-all.
function programBucket(session) {
  const name = session.planName || "Workout";
  const dashIdx = name.indexOf(" — ");
  return dashIdx > -1 ? name.slice(0, dashIdx).trim() : name;
}

const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "3months", label: "Last 3 months" },
];
function withinPeriod(session, period) {
  if (period === "all") return true;
  const date = new Date(session.finishedAt || session.startedAt);
  const days = { week: 7, month: 30, "3months": 90 }[period];
  return Date.now() - date.getTime() <= days * 86400000;
}

// One history row — date / workout name / duration • sets • volume • PRs, exactly the format
// the task's own example uses. Opens the SAME historical-session detail every other "View
// Workout" entry point uses (onViewWorkout === LiftLog's viewWorkout, looked up by stable
// session id) — never a reconstructed/approximate view.
function SessionRow({ session, onClick }) {
  const prCount = sessionPRCount(session);
  return (
    <button
      onClick={onClick}
      className="snap-scroll-row w-full text-left border border-white/10 bg-v5-elevated px-4 py-3 hover:border-v5-red/40 space-y-1"
    >
      <div className="text-[11px] uppercase tracking-widest text-v5-subtext">
        {new Date(session.finishedAt || session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </div>
      <div className="text-sm font-bold text-white truncate">{session.planName || "Workout"}</div>
      <div className="text-xs text-v5-subtext flex items-center gap-1.5 flex-wrap">
        <span>{formatSessionDuration(session.durationSec || 0)}</span>
        <span className="text-v5-subtext/40">•</span>
        <span>{session.workingSets ?? 0} sets</span>
        <span className="text-v5-subtext/40">•</span>
        <span>{Math.round(session.totalVolume || 0).toLocaleString()} lb</span>
        {prCount > 0 && (
          <>
            <span className="text-v5-subtext/40">•</span>
            <span className="text-v5-red font-bold flex items-center gap-0.5">
              <Award size={11} /> {prCount} PR{prCount === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>
    </button>
  );
}

// TRAIN > HISTORY — the task's primary destination ("workout history exists conceptually but
// isn't obvious or easy enough to access"). Recent-list is the default (task section 2/9: "do
// not force the user into a calendar first"); Calendar is one tap away and is the EXISTING
// TrainingCalendar component (already built for Progress > Performance) dropped in unchanged —
// both ultimately open the exact same WorkoutHistoryDetail via `onViewWorkout`, so there is
// still only one "view a past workout" implementation in the app, just two ways to browse to it.
export default function TrainHistorySection({ state, exMap, onViewWorkout, initialFilter = "all" }) {
  const [subView, setSubView] = useState("list"); // "list" | "calendar"
  const [query, setQuery] = useState("");
  // Seeded once from the caller (e.g. Progress's PRs tile deep-links straight to "pr") — a plain
  // local default otherwise, so freely re-filtering afterward inside this screen still works
  // exactly like before this prop existed.
  const [filter, setFilter] = useState(initialFilter);
  const [period, setPeriod] = useState("all");

  // Snap-scroll only applies to the Recent list (task: "better scrolling stopping points" — a
  // card sliced in half by the fixed bottom nav on a momentum stop reads as broken); the
  // Calendar grid has no rows to snap to, so this turns off whenever that sub-view is active,
  // and always turns off on unmount so leaving History never leaves another screen snapping.
  useEffect(() => {
    if (subView !== "list") return;
    document.documentElement.classList.add("snap-scroll-active");
    return () => document.documentElement.classList.remove("snap-scroll-active");
  }, [subView]);

  const sessions = useMemo(
    () =>
      [...(state.workoutSessions || [])].sort(
        (a, b) => new Date(b.finishedAt || b.startedAt) - new Date(a.finishedAt || a.startedAt)
      ),
    [state.workoutSessions]
  );

  // Filter chips are generated from the athlete's OWN data (their actual most-frequent
  // programs), not a hardcoded list — "Titan"/"Custom" in the task's example are illustrative,
  // not literal program names every install will have.
  const topBuckets = useMemo(() => {
    const counts = new Map();
    sessions.forEach((s) => {
      const b = programBucket(s);
      counts.set(b, (counts.get(b) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name]) => name);
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = sessions.filter((s) => withinPeriod(s, period));
    if (filter === "pr") list = list.filter((s) => sessionPRCount(s) > 0);
    else if (filter !== "all") list = list.filter((s) => programBucket(s) === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        if ((s.planName || "").toLowerCase().includes(q)) return true;
        if ((s.mainMuscles || []).some((m) => m.toLowerCase().includes(q))) return true;
        return (s.entries || []).some((e) => (exMap[e.exId]?.name || e.exId).toLowerCase().includes(q));
      });
    }
    return list;
  }, [sessions, filter, period, query, exMap]);

  return (
    <div className="space-y-3">
      <div className="flex bg-v5-surface rounded-lg p-1">
        <button
          onClick={() => setSubView("list")}
          className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors ${
            subView === "list" ? "bg-v5-red text-white" : "text-v5-subtext hover:text-v5-text"
          }`}
        >
          <List size={13} /> Recent
        </button>
        <button
          onClick={() => setSubView("calendar")}
          className={`flex-1 py-2 rounded-md text-[11px] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors ${
            subView === "calendar" ? "bg-v5-red text-white" : "text-v5-subtext hover:text-v5-text"
          }`}
        >
          <Calendar size={13} /> Calendar
        </button>
      </div>

      {subView === "calendar" ? (
        <TrainingCalendar state={state} exMap={exMap} onViewWorkout={onViewWorkout} />
      ) : sessions.length === 0 ? (
        <div className="text-center py-10 text-sm text-v5-subtext">No completed workouts yet.</div>
      ) : (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-v5-subtext/70" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workouts or exercises…"
              className="w-full bg-v5-elevated border border-white/10 rounded-lg pl-8 pr-8 py-2.5 text-sm text-v5-text placeholder-neutral-600 focus:border-v5-red focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-v5-subtext/70 hover:text-v5-text/90" aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {["all", ...topBuckets, "pr"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-widest font-bold border ${
                    filter === f ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                  }`}
                >
                  {f === "all" ? "All" : f === "pr" ? "PR Sessions" : f}
                </button>
              ))}
            </div>
            <PeriodSelect value={period} onChange={setPeriod} options={PERIOD_OPTIONS} className="shrink-0" />
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-v5-subtext">No workouts match.</div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((s) => (
                <SessionRow key={s.id} session={s} onClick={() => onViewWorkout(s.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
