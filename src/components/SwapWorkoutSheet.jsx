import { useMemo, useState } from "react";
import { ChevronRight, Check, Search, X, Plus } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import ExerciseAnatomyRow from "./ExerciseAnatomyRow.jsx";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import { programDaysOverview, allProgramWorkouts, myWorkouts, buildOverrideFromRow } from "../utils/programSchedule.js";

// Chips mix real muscle-group tags (matched against each exercise's exMap muscle) and split/
// theme keywords (matched against the day/program name) — a workout day doesn't carry its own
// "split type" field, so the keyword match is the pragmatic way to let "Push"/"Upper"/etc. filter
// without inventing new day-level tagging architecture.
const SPLIT_FILTERS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Full Body", "Upper", "Lower", "Push", "Pull"];

function rowMatchesFilter(row, exMap, filter) {
  if (!filter) return true;
  const f = filter.toLowerCase();
  if ((row.dayLabel || "").toLowerCase().includes(f) || (row.programName || "").toLowerCase().includes(f)) return true;
  return (row.exercises || []).some((e) => (exMap[e.exId]?.muscle || "").toLowerCase() === f);
}
function rowMatchesSearch(row, exMap, q) {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  if ((row.programName || "").toLowerCase().includes(query)) return true;
  if ((row.dayLabel || "").toLowerCase().includes(query)) return true;
  return (row.exercises || []).some((e) => (exMap[e.exId]?.name || "").toLowerCase().includes(query));
}
function rowKey(row) {
  return row.sourceType === "program" ? `p_${row.source}_${row.programId}_${row.dayIndex}` : `c_${row.planSource}_${row.planId}`;
}
function groupRows(rows) {
  const groups = [];
  const byId = new Map();
  rows.forEach((row) => {
    const gid = row.groupId ?? row.planId ?? row.programName;
    let g = byId.get(gid);
    if (!g) {
      g = { groupId: gid, groupName: row.groupName || row.programName, rows: [] };
      byId.set(gid, g);
      groups.push(g);
    }
    g.rows.push(row);
  });
  return groups;
}

function SearchBar({ value, onChange }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-v5-subtext/70" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search workouts or exercises…"
        className="w-full bg-v5-elevated border border-white/10 pl-8 pr-8 py-2.5 text-sm text-v5-text placeholder-neutral-600 focus:border-v5-red focus:outline-none"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-v5-subtext/70 hover:text-v5-text/90" aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function FilterChips({ value, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
      {SPLIT_FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(value === f ? null : f)}
          className={`shrink-0 px-2.5 py-1 text-[10px] uppercase tracking-widest font-bold border ${
            value === f ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}

// One selectable workout row — used identically across all three tabs so a row from "Current
// Program" looks and behaves the same as one from "All Programs" or "My Workouts"; only the
// planned/completed badges (Current Program only, see showPlannedBadges) differ.
function WorkoutRow({ row, exMap, onClick, showPlannedBadges, subLabel }) {
  const previewExercises = row.exercises.slice(0, 3);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border p-3 space-y-2 ${
        showPlannedBadges && row.isToday ? "border-v5-red bg-v5-red/10" : "border-white/10 bg-v5-elevated hover:border-v5-red/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{row.dayLabel || row.programName}</div>
          <div className="text-[11px] text-v5-subtext mt-0.5 truncate">
            {subLabel ? `${subLabel} · ` : ""}
            {row.exerciseCount} exercises · Est. {row.estMinutes} min
          </div>
        </div>
        <ChevronRight size={16} className="text-v5-subtext/70 shrink-0" />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {showPlannedBadges && row.isToday && !row.isPlanned && (
          <span className="text-[9px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Swapped for today</span>
        )}
        {showPlannedBadges && row.isToday && row.isPlanned && (
          <span className="text-[9px] uppercase tracking-widest bg-v5-red text-white px-1.5 py-0.5">Planned</span>
        )}
        {showPlannedBadges && !row.isToday && row.isPlanned && (
          <span className="text-[9px] uppercase tracking-widest border border-white/10 text-v5-subtext px-1.5 py-0.5">Originally planned</span>
        )}
        {row.completedSession && (
          <span className="text-[9px] uppercase tracking-widest text-green-500 flex items-center gap-1">
            <Check size={10} /> Completed {new Date(row.completedSession.finishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      {previewExercises.length > 0 && (
        <div className="flex items-center gap-1.5">
          {previewExercises.map((e, i) => (
            <MuscleBodyOutline key={i} exercise={exMap[e.exId]} size={28} />
          ))}
          {row.exercises.length > previewExercises.length && (
            <span className="text-[11px] text-v5-subtext/70">+{row.exercises.length - previewExercises.length} more</span>
          )}
        </div>
      )}
    </button>
  );
}

// Shared by the Today card and the Train → Current Program card (they each own their own
// open/closed toggle, but render this exact same component) — "one shared swap system," per the
// task, across every workout source: the currently active program's own days, every day of every
// other built-in/custom program, the athlete's own saved plans/custom-program days, and a fresh
// blank build. The only state any of these paths ever writes is `programDayOverride` (see
// programSchedule.js's buildOverrideFromRow) — a small additive, self-contained snapshot that
// never touches currentProgram.dayIndex, any program's own day data, or workout history.
export default function SwapWorkoutSheet({ state, updateState, exMap, onClose, onNavigate }) {
  const overview = programDaysOverview(state);
  const [tabView, setTabView] = useState(overview ? "current" : "all");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(null);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);

  const currentRows = useMemo(() => {
    if (!overview) return [];
    return overview.days.map((d) => ({
      sourceType: "program",
      programId: overview.programId,
      source: overview.source,
      dayIndex: d.index,
      groupId: overview.programId,
      groupName: overview.programName,
      programName: overview.programName,
      dayLabel: d.label,
      exercises: d.exercises,
      exerciseCount: d.exerciseCount,
      estMinutes: d.estMinutes,
      isPlanned: d.isPlanned,
      isToday: d.isToday,
      completedSession: d.completedSession,
    }));
  }, [overview]);

  const allRows = useMemo(() => allProgramWorkouts(state), [state.programs, state.customPrograms, state.templates]);
  const mineRows = useMemo(() => myWorkouts(state), [state.customPlans, state.customPrograms]);
  const allGroups = useMemo(() => groupRows(allRows), [allRows]);

  const filtering = !!(search.trim() || filter);

  const visibleAllRows = useMemo(() => {
    let rows = allRows;
    if (openGroupId) rows = rows.filter((r) => (r.groupId ?? r.planId) === openGroupId);
    if (filtering) rows = rows.filter((r) => rowMatchesSearch(r, exMap, search) && rowMatchesFilter(r, exMap, filter));
    return rows;
  }, [allRows, openGroupId, filtering, search, filter, exMap]);

  const visibleMineRows = useMemo(
    () => mineRows.filter((r) => rowMatchesSearch(r, exMap, search) && rowMatchesFilter(r, exMap, filter)),
    [mineRows, search, filter, exMap]
  );

  if (!overview && allRows.length === 0 && mineRows.length === 0) return null; // nothing to swap to at all

  const commitRow = (row) => {
    updateState((prev) => {
      const cp = prev.currentProgram;
      // Picking the day BRK already had planned just clears any existing override rather than
      // storing a redundant one that points at the same place.
      const isPlannedNoOp = cp && row.sourceType === "program" && row.programId === cp.programId && row.source === cp.source && row.dayIndex === cp.dayIndex;
      if (isPlannedNoOp) return { ...prev, programDayOverride: null };
      // Record that the active program's own planned day for today was deliberately displaced —
      // an additive, append-only annotation (see programSwapLog's own comment in
      // loadInitialState) read only by resolveProgramTimeline so that day's slot reads as
      // SWAPPED rather than MISSED once its week concludes, instead of silently looking like it
      // was skipped. currentRows/overview reflect the active program at open time, so
      // `plannedRow` here is always the day actually being displaced by this commit.
      const plannedRow = overview ? currentRows.find((r) => r.isPlanned) : null;
      const swapLogEntry =
        cp && plannedRow
          ? { date: new Date().toISOString().slice(0, 10), programId: cp.programId, source: cp.source, dayIndex: plannedRow.dayIndex, dayLabel: plannedRow.dayLabel }
          : null;
      return {
        ...prev,
        programDayOverride: buildOverrideFromRow(row),
        programSwapLog: swapLogEntry ? [swapLogEntry, ...(prev.programSwapLog || [])].slice(0, 200) : prev.programSwapLog,
      };
    });
    onClose();
  };

  const goCreateWorkout = () => {
    onClose();
    if (onNavigate) onNavigate("build");
  };

  if (previewRow) {
    return (
      <SlideInPanel
        title="Today's Workout"
        subtitle={previewRow.dayLabel ? `${previewRow.programName} — ${previewRow.dayLabel}` : previewRow.programName}
        onBack={() => setPreviewRow(null)}
      >
        <div>
          {previewRow.exercises.map((e, i) => (
            <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => commitRow(previewRow)}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
          >
            Use This Workout Today
          </button>
          <button
            onClick={() => setPreviewRow(null)}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40"
          >
            Cancel
          </button>
        </div>
      </SlideInPanel>
    );
  }

  const TABS = [
    overview ? { id: "current", label: "Current Program" } : null,
    { id: "all", label: "All Programs" },
    { id: "mine", label: "My Workouts" },
  ].filter(Boolean);

  return (
    <SlideInPanel title="Choose Today's Workout" subtitle={state.currentProgram?.programName || null} onBack={onClose}>
      <div className="flex gap-1.5 border-b border-white/10 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTabView(t.id);
              setSearch("");
              setFilter(null);
              setOpenGroupId(null);
            }}
            className={`shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold border ${
              tabView === t.id ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabView === "current" && overview && (
        <div className="space-y-2">
          <div className="text-xs text-v5-subtext">{overview.weekNumber ? `Week ${overview.weekNumber} · ${overview.programName}` : overview.programName}</div>
          {currentRows.map((row) => (
            <WorkoutRow key={rowKey(row)} row={row} exMap={exMap} showPlannedBadges onClick={() => setPreviewRow(row)} />
          ))}
        </div>
      )}

      {tabView === "all" && (
        <div className="space-y-3">
          <SearchBar value={search} onChange={setSearch} />
          <FilterChips value={filter} onChange={setFilter} />
          {openGroupId && !filtering && (
            <button onClick={() => setOpenGroupId(null)} className="text-[11px] uppercase tracking-widest text-v5-subtext hover:text-v5-red">
              ← All programs
            </button>
          )}
          {filtering || openGroupId ? (
            <div className="space-y-2">
              {visibleAllRows.length === 0 && <div className="text-sm text-v5-subtext/70 py-4 text-center">No workouts match.</div>}
              {visibleAllRows.map((row) => (
                <WorkoutRow key={rowKey(row)} row={row} exMap={exMap} subLabel={row.groupName} onClick={() => setPreviewRow(row)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {allGroups.map((g) => (
                <button
                  key={g.groupId}
                  onClick={() => setOpenGroupId(g.groupId)}
                  className="w-full text-left border border-white/10 bg-v5-elevated p-3 flex items-center justify-between hover:border-v5-red/40"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{g.groupName}</div>
                    <div className="text-[11px] text-v5-subtext mt-0.5">{g.rows.length} workout{g.rows.length === 1 ? "" : "s"}</div>
                  </div>
                  <ChevronRight size={16} className="text-v5-subtext/70 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tabView === "mine" && (
        <div className="space-y-3">
          <SearchBar value={search} onChange={setSearch} />
          <div className="space-y-2">
            {visibleMineRows.length === 0 && <div className="text-sm text-v5-subtext/70 py-4 text-center">No saved workouts yet.</div>}
            {visibleMineRows.map((row) => (
              <WorkoutRow key={rowKey(row)} row={row} exMap={exMap} subLabel={row.groupName} onClick={() => setPreviewRow(row)} />
            ))}
          </div>
          {onNavigate && (
            <button
              onClick={goCreateWorkout}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs uppercase tracking-widest font-bold border border-dashed border-white/10 text-v5-text/90 hover:border-v5-red hover:text-v5-red"
            >
              <Plus size={14} /> Create Workout for Today
            </button>
          )}
        </div>
      )}
    </SlideInPanel>
  );
}
