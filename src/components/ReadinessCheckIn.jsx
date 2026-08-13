import React, { useState } from "react";
import { computeReadinessScore, readinessBand, READINESS_RECOMMENDATION, BAND_LABEL } from "../utils/readiness.js";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const BAND_COLOR = { green: "text-green-500", yellow: "text-yellow-500", red: "text-red-500" };
const BAND_BORDER = { green: "border-green-700/50", yellow: "border-yellow-700/50", red: "border-red-700/50" };

const RATING_FIELDS = [
  { key: "sleepQuality", label: "Sleep quality" },
  { key: "soreness", label: "Muscle soreness" },
  { key: "stress", label: "Stress" },
  { key: "motivation", label: "Motivation" },
  { key: "energy", label: "Energy" },
];

function RatingRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-300">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-8 h-8 text-xs font-bold border ${
              value === n ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact "already checked in today" summary — score, band, and the rule-based
// recommendation, with an Edit link back into the form.
function TodaySummary({ entry, onEdit }) {
  const score = computeReadinessScore(entry);
  const band = readinessBand(score);
  return (
    <div className={`border ${BAND_BORDER[band]} bg-charcoal-panel p-4 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Readiness</div>
        <button onClick={onEdit} className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500">
          Edit
        </button>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-bold ${BAND_COLOR[band]}`}>{score}</span>
        <span className={`text-xs font-bold uppercase tracking-widest ${BAND_COLOR[band]}`}>{BAND_LABEL[band]}</span>
      </div>
      <div className="text-sm text-neutral-400">{READINESS_RECOMMENDATION[band]}</div>
    </div>
  );
}

export default function ReadinessCheckIn({ state, updateState }) {
  const entries = state.readinessLogs || [];
  const todayEntry = entries.find((e) => e.date.slice(0, 10) === todayStr());
  const [editing, setEditing] = useState(!todayEntry);
  const [form, setForm] = useState({
    sleepQuality: todayEntry?.sleepQuality ?? 3,
    sleepHours: todayEntry?.sleepHours != null ? String(todayEntry.sleepHours) : "",
    soreness: todayEntry?.soreness ?? 3,
    stress: todayEntry?.stress ?? 3,
    motivation: todayEntry?.motivation ?? 3,
    energy: todayEntry?.energy ?? 3,
    restingHR: todayEntry?.restingHR != null ? String(todayEntry.restingHR) : "",
    notes: todayEntry?.notes || "",
  });

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const save = () => {
    const fields = {
      sleepQuality: form.sleepQuality,
      sleepHours: form.sleepHours !== "" ? Number(form.sleepHours) : null,
      soreness: form.soreness,
      stress: form.stress,
      motivation: form.motivation,
      energy: form.energy,
      restingHR: form.restingHR !== "" ? Number(form.restingHR) : null,
      notes: form.notes.trim(),
    };
    updateState((prev) => {
      const list = prev.readinessLogs || [];
      const existing = list.find((e) => e.date.slice(0, 10) === todayStr());
      if (existing) {
        return { ...prev, readinessLogs: list.map((e) => (e.id === existing.id ? { ...e, ...fields } : e)) };
      }
      return { ...prev, readinessLogs: [{ id: `readiness_${Date.now()}`, date: new Date().toISOString(), ...fields }, ...list] };
    });
    setEditing(false);
  };

  if (!editing && todayEntry) {
    return <TodaySummary entry={todayEntry} onEdit={() => setEditing(true)} />;
  }

  const previewScore = computeReadinessScore(form);

  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-4">
      <div className="text-[11px] uppercase tracking-widest text-red-600">Daily readiness check-in</div>
      <div className="space-y-2.5">
        {RATING_FIELDS.map((f) => (
          <RatingRow key={f.key} label={f.label} value={form[f.key]} onChange={(v) => setField(f.key, v)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Sleep hours (optional)</label>
          <input
            type="number"
            value={form.sleepHours}
            onChange={(e) => setField("sleepHours", e.target.value)}
            className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-2 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Resting HR (optional)</label>
          <input
            type="number"
            value={form.restingHR}
            onChange={(e) => setField("restingHR", e.target.value)}
            className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-2 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
      </div>
      <input
        type="text"
        value={form.notes}
        onChange={(e) => setField("notes", e.target.value)}
        placeholder="Notes — optional"
        className="w-full bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
      />
      {previewScore != null && (
        <div className="text-xs text-neutral-500">
          Score preview: <span className="text-white font-bold">{previewScore}</span>
        </div>
      )}
      <button onClick={save} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
        Save check-in
      </button>
    </div>
  );
}
