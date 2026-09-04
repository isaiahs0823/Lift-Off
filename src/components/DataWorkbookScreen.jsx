import React, { useMemo, useState } from "react";
import { ChevronLeft, Download, FileSpreadsheet, FileJson, FileText } from "lucide-react";
import { DATE_RANGE_PRESETS, resolveDateRange } from "../utils/dateRange.js";
import {
  computeOverview,
  computeSessionRows,
  computeExerciseRows,
  computeSetRows,
  computeBodyweightRows,
  computeReadinessRows,
  computeNutritionRows,
  computeNutritionSummary,
} from "../utils/dataWorkbook.js";
import { exportXlsx, exportCsv, exportJson } from "../utils/workbookExport.js";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sessions", label: "Sessions" },
  { id: "exercises", label: "Exercises" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "readiness", label: "Readiness" },
  { id: "nutrition", label: "Nutrition" },
];

function dateLabel(iso) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value }) {
  return (
    <div className="border border-white/10 bg-v5-elevated p-3">
      <div className="text-[11px] uppercase tracking-widest text-v5-subtext">{label}</div>
      <div className="text-lg font-bold text-white mt-1">{value == null ? "N/A" : value}</div>
    </div>
  );
}

// Minimal hand-rolled line chart, matching the sparkline already used in BodyweightTab.jsx /
// ProgressTab.jsx — kept local rather than shared/imported for the same reason those two are:
// a drawing routine this small doesn't earn the indirection of a shared component.
function Sparkline({ points, height = 70 }) {
  if (points.length < 2) return null;
  const width = 320;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 8) + 4;
    const y = height - 4 - ((p.value - min) / span) * (height - 8);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <path d={path} fill="none" stroke="#dc2626" strokeWidth="2" />
      <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="3" fill="#dc2626" />
    </svg>
  );
}

function EmptyState({ text }) {
  return <div className="text-sm text-v5-subtext text-center py-10 border border-white/10 bg-v5-elevated">{text}</div>;
}

export default function DataWorkbookScreen({ state, exMap, onBack, onViewWorkout }) {
  const [preset, setPreset] = useState("last90");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [exporting, setExporting] = useState(null); // null | "xlsx" | "csv" | "json"

  // A "custom" preset with one or both dates not yet picked has no real boundary yet — without
  // this, resolveDateRange's `start: null` (meaning "no lower bound") would silently fall back
  // to showing every workout the moment "Custom Range" is tapped, before the athlete has chosen
  // anything, which reads as a bug (why does this already show data?). Snapping the effective
  // range to a real Date(0)-Date(0) window instead means nothing matches until both dates are set.
  const range = useMemo(() => {
    const resolved = resolveDateRange(preset, { customStart, customEnd });
    if (preset === "custom" && (!customStart || !customEnd)) {
      return { ...resolved, start: new Date(0), end: new Date(0) };
    }
    return resolved;
  }, [preset, customStart, customEnd]);
  const customRangeIncomplete = preset === "custom" && (!customStart || !customEnd);

  // All aggregation happens here, once per range/state change — not recomputed on every
  // render (e.g. switching tabs, typing in a date field before it's applied).
  const computed = useMemo(() => {
    const overview = computeOverview(state, range);
    const sessionRows = computeSessionRows(state, range);
    const exerciseRows = computeExerciseRows(state, range, exMap);
    const setRows = computeSetRows(state, range, exMap);
    const bodyweightRows = computeBodyweightRows(state, range);
    const readinessRows = computeReadinessRows(state, range);
    const nutritionRows = computeNutritionRows(state, range);
    const nutritionSummary = computeNutritionSummary(nutritionRows);
    return { overview, sessionRows, exerciseRows, setRows, bodyweightRows, readinessRows, nutritionRows, nutritionSummary };
  }, [state, range, exMap]);

  const hasAnyData =
    computed.overview.workoutsCompleted > 0 ||
    computed.bodyweightRows.length > 0 ||
    computed.readinessRows.length > 0 ||
    computed.nutritionRows.length > 0;

  const runExport = (type) => {
    setExporting(type);
    // requestAnimationFrame lets "Preparing export…" actually paint before the (possibly
    // async, for xlsx) build work runs — xlsx generation can take a moment on a large history,
    // and the dynamic import() itself needs a tick before the work even starts.
    requestAnimationFrame(async () => {
      try {
        if (type === "xlsx") await exportXlsx(computed, range);
        else if (type === "csv") exportCsv(computed.setRows, range);
        else if (type === "json") exportJson(computed, range);
      } finally {
        setExporting(null);
      }
    });
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">My Data Workbook</div>
          <div className="text-xl font-bold text-white mt-1">Your training data, organized.</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red flex items-center gap-1 shrink-0">
            <ChevronLeft size={14} /> Back
          </button>
        )}
      </div>
      <p className="text-xs text-v5-subtext -mt-4">
        Review your progress, filter your history, and export your data for backup, spreadsheets, or AI analysis.
      </p>

      {/* ---------------- DATE RANGE ---------------- */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {DATE_RANGE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`shrink-0 px-3 py-2 text-[11px] uppercase tracking-wide font-bold border whitespace-nowrap ${
                preset === p.value ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red"
              style={{ fontSize: 16 }}
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 min-w-0 bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red"
              style={{ fontSize: 16 }}
            />
          </div>
        )}

        <div className="border border-white/10 bg-v5-elevated p-3">
          <div className="text-sm font-bold text-white">{range.label}</div>
          <div className="text-xs text-v5-subtext mt-0.5">{range.sublabel}</div>
          {!customRangeIncomplete && <div className="text-xs text-v5-subtext mt-1">{computed.overview.workoutsCompleted} workouts</div>}
        </div>
      </div>

      {/* ---------------- TABS ---------------- */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 border-b border-white/10" style={{ scrollbarWidth: "none" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-3 py-2.5 text-xs uppercase tracking-wide font-bold whitespace-nowrap border-b-2 ${
              activeTab === t.id ? "border-red-600 text-white" : "border-transparent text-v5-subtext hover:text-v5-text/90"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {customRangeIncomplete ? (
        <EmptyState text="Select a start and end date to see your data." />
      ) : !hasAnyData ? (
        <EmptyState text="No training data was found for this date range." />
      ) : (
        <>
          {activeTab === "overview" && <OverviewTabPanel overview={computed.overview} />}
          {activeTab === "sessions" && <SessionsTabPanel rows={computed.sessionRows} onViewWorkout={onViewWorkout} />}
          {activeTab === "exercises" && <ExercisesTabPanel rows={computed.exerciseRows} />}
          {activeTab === "bodyweight" && <BodyweightTabPanel rows={computed.bodyweightRows} overview={computed.overview} />}
          {activeTab === "readiness" && <ReadinessTabPanel rows={computed.readinessRows} avgReadiness={computed.overview.avgReadiness} />}
          {activeTab === "nutrition" && <NutritionTabPanel rows={computed.nutritionRows} summary={computed.nutritionSummary} />}
        </>
      )}

      {/* ---------------- EXPORT ---------------- */}
      <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Export Your Data</div>
          <p className="text-xs text-v5-subtext mt-1">
            Download the selected data for backup, spreadsheet analysis, or use with AI tools.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => runExport("xlsx")}
            disabled={exporting != null || customRangeIncomplete}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <FileSpreadsheet size={14} /> {exporting === "xlsx" ? "Preparing export…" : "Export Excel (.xlsx)"}
          </button>
          <button
            onClick={() => runExport("csv")}
            disabled={exporting != null || customRangeIncomplete}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-text/90 hover:border-v5-red/40 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <FileText size={14} /> {exporting === "csv" ? "Preparing export…" : "Export CSV"}
          </button>
          <button
            onClick={() => runExport("json")}
            disabled={exporting != null || customRangeIncomplete}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-text/90 hover:border-v5-red/40 disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <FileJson size={14} /> {exporting === "json" ? "Preparing export…" : "Export JSON"}
          </button>
        </div>

        <div className="text-[11px] text-v5-subtext space-y-1 pt-1 border-t border-white/10">
          <div className="text-v5-text/90 font-bold">Your data belongs to you.</div>
          <div>Exports are generated from your BRK fitness history and can be saved, backed up, or analyzed with other tools.</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- OVERVIEW ----------------
function OverviewTabPanel({ overview: o }) {
  return (
    <div className="space-y-4">
      <div className="border border-white/10 bg-v5-elevated p-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Training Summary</div>
        <div className="text-sm text-v5-text/90 space-y-0.5">
          <div>{o.workoutsCompleted} workouts</div>
          <div>{o.totalWorkingSets.toLocaleString()} working sets</div>
          <div>{o.prCount} PRs</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Workouts Completed" value={o.workoutsCompleted} />
        <StatCard label="Training Days" value={o.trainingDays} />
        <StatCard label="Total Exercises" value={o.totalExercises} />
        <StatCard label="Working Sets" value={o.totalWorkingSets.toLocaleString()} />
        <StatCard label="Total Reps" value={o.totalReps.toLocaleString()} />
        <StatCard label="Total Volume (lb)" value={o.totalVolume != null ? o.totalVolume.toLocaleString() : null} />
        <StatCard label="PR Count" value={o.prCount} />
        <StatCard label="Avg. Workout Duration" value={o.avgDurationLabel} />
        <StatCard label="Avg. Readiness" value={o.avgReadiness} />
        <StatCard label="Starting Bodyweight" value={o.startingBodyweight} />
        <StatCard label="Ending Bodyweight" value={o.endingBodyweight} />
        <StatCard label="Bodyweight Change" value={o.bodyweightChange != null ? `${o.bodyweightChange > 0 ? "+" : ""}${o.bodyweightChange}` : null} />
      </div>

      {o.monthlyWorkouts.length > 1 && (
        <div className="border border-white/10 bg-v5-elevated p-4">
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Monthly Workouts</div>
          <div className="space-y-1">
            {o.monthlyWorkouts.map((m) => (
              <div key={m.key} className="flex items-center justify-between text-sm">
                <span className="text-v5-subtext">{m.label}</span>
                <span className="text-white font-bold">{m.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- SESSIONS ----------------
function SessionsTabPanel({ rows, onViewWorkout }) {
  if (rows.length === 0) return <EmptyState text="No workouts in this period." />;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <button
          key={r.id}
          onClick={() => onViewWorkout && onViewWorkout(r.id)}
          className="w-full text-left border border-white/10 bg-v5-elevated p-3 hover:border-v5-red/40"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-white truncate">{r.planName}</div>
            <div className="text-[11px] text-v5-subtext shrink-0">{dateLabel(r.date)}</div>
          </div>
          <div className="text-xs text-v5-subtext mt-0.5">{r.bodyParts}</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-v5-subtext mt-1.5">
            <span>{r.durationLabel}</span>
            <span>{r.workingSets ?? "N/A"} sets</span>
            <span>{r.volume != null ? `${r.volume.toLocaleString()} lb` : "N/A"}</span>
            {r.avgRir != null && <span>{r.avgRir} avg RIR</span>}
            {r.prCount > 0 && <span className="text-v5-red font-bold">{r.prCount} PR{r.prCount === 1 ? "" : "s"}</span>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------- EXERCISES ----------------
function ExercisesTabPanel({ rows }) {
  if (rows.length === 0) return <EmptyState text="No exercise history in this period." />;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.exId} className="border border-white/10 bg-v5-elevated p-3">
          <div className="text-sm font-bold text-white">{r.name}</div>
          <div className="text-xs text-v5-subtext mt-0.5">
            {dateLabel(r.firstDate)} – {dateLabel(r.lastDate)}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-v5-subtext mt-1.5">
            <span>{r.sessionCount} session{r.sessionCount === 1 ? "" : "s"}</span>
            <span>{r.totalSets} sets</span>
            <span>{r.totalReps} reps</span>
            <span>{r.totalVolume.toLocaleString()} lb volume</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-v5-text/90 mt-1">
            <span>Best: {r.bestWeight != null ? `${r.bestWeight} × ${r.bestWeightReps}` : "N/A"}</span>
            <span>Est. 1RM: {r.bestE1RM != null ? `${r.bestE1RM} lb` : "N/A"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------- BODYWEIGHT ----------------
function BodyweightTabPanel({ rows, overview }) {
  if (rows.length === 0) return <EmptyState text="No bodyweight entries in this period." />;
  const points = rows.filter((r) => r.weight != null).map((r) => ({ date: r.date, value: r.weight }));
  return (
    <div className="space-y-3">
      <div className="border border-white/10 bg-v5-elevated p-4">
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Start</div>
            <div className="text-base font-bold text-white">{overview.startingBodyweight ?? "N/A"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Current</div>
            <div className="text-base font-bold text-white">{overview.endingBodyweight ?? "N/A"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Change</div>
            <div className="text-base font-bold text-white">
              {overview.bodyweightChange != null ? `${overview.bodyweightChange > 0 ? "+" : ""}${overview.bodyweightChange}` : "N/A"}
            </div>
          </div>
        </div>
        <Sparkline points={points} />
      </div>
      <div className="space-y-1.5">
        {[...rows].reverse().map((r, i) => (
          <div key={`${r.date}-${i}`} className="flex items-center justify-between border border-white/10 bg-v5-elevated px-3 py-2 text-sm">
            <span className="text-v5-subtext text-xs">{dateLabel(r.date)}</span>
            <span className="text-white font-bold">
              {r.weight ?? "N/A"}
              {r.bodyFat != null && <span className="text-v5-subtext font-normal text-xs ml-2">{r.bodyFat}% BF</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- READINESS ----------------
function ReadinessTabPanel({ rows, avgReadiness }) {
  if (rows.length === 0) return <EmptyState text="No readiness check-ins in this period." />;
  return (
    <div className="space-y-2">
      <div className="border border-white/10 bg-v5-elevated p-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-v5-subtext">Average Readiness</span>
        <span className="text-lg font-bold text-white">{avgReadiness ?? "N/A"}</span>
      </div>
      {[...rows].reverse().map((r, i) => (
        <div key={`${r.date}-${i}`} className="border border-white/10 bg-v5-elevated p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-v5-subtext">{dateLabel(r.date)}</span>
            <span className="text-sm font-bold text-white">{r.score != null ? r.score : "N/A"}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-v5-subtext mt-1">
            {r.sleepQuality != null && <span>Sleep {r.sleepQuality}/5</span>}
            {r.soreness != null && <span>Soreness {r.soreness}/5</span>}
            {r.energy != null && <span>Energy {r.energy}/5</span>}
            {r.stress != null && <span>Stress {r.stress}/5</span>}
          </div>
          {r.notes && <div className="text-xs text-v5-subtext mt-1 italic">{r.notes}</div>}
        </div>
      ))}
    </div>
  );
}

// ---------------- NUTRITION ----------------
function NutritionTabPanel({ rows, summary }) {
  if (rows.length === 0) return <EmptyState text="No nutrition data logged in this period." />;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Avg Daily Calories" value={summary.avgCalories} />
        <StatCard label="Avg Protein" value={summary.avgProtein != null ? `${summary.avgProtein}g` : null} />
        <StatCard label="Days Logged" value={summary.daysLogged} />
        <StatCard label="Target Adherence" value={summary.targetAdherencePct != null ? `${summary.targetAdherencePct}%` : null} />
      </div>
      {[...rows].reverse().map((r) => (
        <div key={r.date} className="border border-white/10 bg-v5-elevated p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-v5-subtext">{dateLabel(r.date)}</span>
            <span className="text-sm font-bold text-white">{r.calories} cal</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-v5-subtext mt-1">
            <span>{r.protein}g protein</span>
            <span>{r.carbs}g carbs</span>
            <span>{r.fat}g fat</span>
            {r.calorieTarget != null && <span>Target: {r.calorieTarget} cal</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
