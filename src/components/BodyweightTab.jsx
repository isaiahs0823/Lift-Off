import React, { useState, useMemo } from "react";
import { Trash2 } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import { rollingAverage, weeklyRateOfChange, totalChange, latestValue, paceClassification, PACE_LABEL } from "../utils/bodyweightMath.js";
import { requiredPace, projectedCompletionDate } from "../utils/goalMath.js";
import { goalHistory, resolveGoalCurrentValue } from "../utils/goalData.js";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(v, digits = 1) {
  return v == null ? "—" : v.toFixed(digits);
}
function fmtDelta(v, digits = 1) {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}

// Minimal hand-rolled line chart — no charting dependency, matches the "keep it light"
// posture of the rest of the app. Just enough to show shape/direction, not a precision tool.
function Sparkline({ points, height = 80 }) {
  if (points.length < 2) {
    return <div className="text-xs text-v5-subtext/70 py-6 text-center">Log a few more days to see a trend line.</div>;
  }
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

function EditEntryPanel({ entry, onBack, onSave, onDelete }) {
  const [weight, setWeight] = useState(entry.weight != null ? String(entry.weight) : "");
  const [waist, setWaist] = useState(entry.waist != null ? String(entry.waist) : "");
  const [bodyFat, setBodyFat] = useState(entry.bodyFat != null ? String(entry.bodyFat) : "");
  const [notes, setNotes] = useState(entry.notes || "");
  const canSave = weight !== "" || waist !== "" || bodyFat !== "";

  return (
    <SlideInPanel title="Edit entry" subtitle={new Date(entry.date).toLocaleDateString()} onBack={onBack}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Weight</label>
          <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red" />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Waist</label>
          <input type="number" value={waist} onChange={(e) => setWaist(e.target.value)} className="w-full bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red" />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Body fat %</label>
          <input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} className="w-full bg-v5-elevated border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red" />
        </div>
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Notes</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-v5-elevated border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red" />
      </div>
      <button
        onClick={() =>
          canSave &&
          onSave({
            weight: weight !== "" ? Number(weight) : null,
            waist: waist !== "" ? Number(waist) : null,
            bodyFat: bodyFat !== "" ? Number(bodyFat) : null,
            notes: notes.trim(),
          })
        }
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${canSave ? "bg-v5-red border-v5-red text-white hover:opacity-90" : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"}`}
      >
        Save changes
      </button>
      <button onClick={onDelete} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-subtext hover:text-v5-red hover:border-v5-red/25 flex items-center justify-center gap-1.5">
        <Trash2 size={14} /> Delete entry
      </button>
    </SlideInPanel>
  );
}

export default function BodyweightTab({ state, updateState }) {
  const entries = state.bodyweightLogs || [];
  const existingToday = entries.find((e) => e.date.slice(0, 10) === todayStr());
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState(null);

  const canSave = weight !== "" || waist !== "" || bodyFat !== "";

  const saveToday = () => {
    if (!canSave) return;
    updateState((prev) => {
      const list = prev.bodyweightLogs || [];
      const todayEntry = list.find((e) => e.date.slice(0, 10) === todayStr());
      const fields = {
        weight: weight !== "" ? Number(weight) : todayEntry?.weight ?? null,
        waist: waist !== "" ? Number(waist) : todayEntry?.waist ?? null,
        bodyFat: bodyFat !== "" ? Number(bodyFat) : todayEntry?.bodyFat ?? null,
        notes: notes.trim() || todayEntry?.notes || "",
      };
      if (todayEntry) {
        return { ...prev, bodyweightLogs: list.map((e) => (e.id === todayEntry.id ? { ...e, ...fields } : e)) };
      }
      const entry = { id: `bw_${Date.now()}`, date: new Date().toISOString(), ...fields };
      return { ...prev, bodyweightLogs: [entry, ...list], hasSeenOnboarding: true };
    });
    setWeight("");
    setWaist("");
    setBodyFat("");
    setNotes("");
  };

  const sortedEntries = useMemo(() => [...entries].sort((a, b) => new Date(b.date) - new Date(a.date)), [entries]);

  const weightGoal = (state.goals || []).find((g) => g.type === "weight" && g.status === "active");
  const goalWithCurrent = weightGoal ? { ...weightGoal, currentValue: resolveGoalCurrentValue(weightGoal, state) } : null;
  const goalHist = goalWithCurrent ? goalHistory(goalWithCurrent, state) : [];
  const targetWeeklyRate = goalWithCurrent ? requiredPace(goalWithCurrent) : null;
  const projectedDate = goalWithCurrent ? projectedCompletionDate(goalWithCurrent, goalHist) : null;

  const weeklyRate = weeklyRateOfChange(entries, "weight");
  const pace = paceClassification(weeklyRate, targetWeeklyRate);

  if (editingId) {
    const entry = entries.find((e) => e.id === editingId);
    if (!entry) return null;
    return (
      <EditEntryPanel
        entry={entry}
        onBack={() => setEditingId(null)}
        onSave={(changes) => {
          updateState((prev) => ({ ...prev, bodyweightLogs: prev.bodyweightLogs.map((e) => (e.id === editingId ? { ...e, ...changes } : e)) }));
          setEditingId(null);
        }}
        onDelete={() => {
          if (!window.confirm("Delete this entry? This can't be undone.")) return;
          updateState((prev) => ({ ...prev, bodyweightLogs: prev.bodyweightLogs.filter((e) => e.id !== editingId) }));
          setEditingId(null);
        }}
      />
    );
  }

  const chartPoints = sortedEntries
    .filter((e) => e.weight != null)
    .slice(0, 60)
    .reverse()
    .map((e) => ({ date: e.date, value: e.weight }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Physique</div>
        <div className="text-xl font-bold text-white mt-1">Body composition</div>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext">{existingToday ? "Update today's entry" : "Log today"}</div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-v5-subtext/70 mb-1">Weight</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={existingToday?.weight != null ? String(existingToday.weight) : "lb"}
              className="w-full bg-v5-surface border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-v5-subtext/70 mb-1">Waist</label>
            <input
              type="number"
              value={waist}
              onChange={(e) => setWaist(e.target.value)}
              placeholder={existingToday?.waist != null ? String(existingToday.waist) : "in"}
              className="w-full bg-v5-surface border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-v5-subtext/70 mb-1">Body fat %</label>
            <input
              type="number"
              value={bodyFat}
              onChange={(e) => setBodyFat(e.target.value)}
              placeholder={existingToday?.bodyFat != null ? String(existingToday.bodyFat) : "%"}
              className="w-full bg-v5-surface border border-white/10 text-v5-text px-2 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
          </div>
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes — optional"
          className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
        <button
          onClick={saveToday}
          disabled={!canSave}
          className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${canSave ? "bg-v5-red border-v5-red text-white hover:opacity-90" : "bg-v5-elevated border-white/10 text-v5-subtext/40 cursor-not-allowed"}`}
        >
          {existingToday ? "Update entry" : "Log entry"}
        </button>
      </div>

      <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Trend</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Current</div>
            <div className="text-2xl font-bold text-white">{fmt(latestValue(entries, "weight"))} lb</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">7-day avg</div>
            <div className="text-2xl font-bold text-white">{fmt(rollingAverage(entries, "weight", 7))} lb</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">14-day avg</div>
            <div className="text-lg text-v5-text/90">{fmt(rollingAverage(entries, "weight", 14))} lb</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Weekly rate</div>
            <div className="text-lg text-v5-text/90">{fmtDelta(weeklyRate)} lb/week</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Total change</div>
            <div className="text-lg text-v5-text/90">{fmtDelta(totalChange(entries, "weight"))} lb</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Status</div>
            <div className="text-lg text-v5-text/90">{PACE_LABEL[pace]}</div>
          </div>
        </div>
        {projectedDate && (
          <div className="text-xs text-v5-subtext border-t border-white/[0.06] pt-3">
            At this pace, projected to hit your {weightGoal.title} goal around{" "}
            <span className="text-white font-bold">{new Date(projectedDate).toLocaleDateString()}</span>.
          </div>
        )}
        <Sparkline points={chartPoints} />
      </div>

      {(rollingAverage(entries, "waist", 14) != null || rollingAverage(entries, "bodyFat", 14) != null) && (
        <div className="border border-white/10 bg-v5-elevated p-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Waist (14-day avg)</div>
            <div className="text-lg font-bold text-white">{fmt(rollingAverage(entries, "waist", 14))} in</div>
            <div className="text-xs text-v5-subtext">{fmtDelta(weeklyRateOfChange(entries, "waist"))} in/week</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Body fat (14-day avg)</div>
            <div className="text-lg font-bold text-white">{fmt(rollingAverage(entries, "bodyFat", 14))}%</div>
            <div className="text-xs text-v5-subtext">{fmtDelta(weeklyRateOfChange(entries, "bodyFat"))}%/week</div>
          </div>
        </div>
      )}

      {sortedEntries.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">History</div>
          <div className="space-y-1.5">
            {sortedEntries.slice(0, 30).map((e) => (
              <button key={e.id} onClick={() => setEditingId(e.id)} className="w-full flex items-center justify-between text-xs border-b border-white/[0.06] py-2 text-left hover:border-white/10">
                <span className="text-v5-subtext">{new Date(e.date).toLocaleDateString()}</span>
                <span className="text-sm text-v5-text/90">
                  {e.weight != null ? `${e.weight} lb` : ""}
                  {e.waist != null ? ` · ${e.waist} in waist` : ""}
                  {e.bodyFat != null ? ` · ${e.bodyFat}% bf` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
