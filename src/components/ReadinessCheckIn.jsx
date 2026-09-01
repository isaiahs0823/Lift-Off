import React, { useState } from "react";
import { computeReadinessScore, readinessBand, BAND_LABEL, READINESS_SHORT } from "../utils/readiness.js";
import { buildCoachContext } from "../utils/coachContext.js";
import { generateMorningCheckIn } from "../services/coachService.js";
import { Card, SectionLabel, ButtonText, ButtonPrimary, RingGauge } from "./ui/Kit.jsx";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const BAND_TONE = { green: "success", yellow: "warn", red: "red" };
const BAND_TEXT = { green: "text-v5-success", yellow: "text-amber-400", red: "text-v5-red" };

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
      <span className="text-sm text-v5-text/90">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-lg text-xs font-bold ${
              value === n ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext hover:text-v5-text"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact "already checked in today" summary. On the full readiness screen this shows the
// coach's morning check-in message; on the Today dashboard (compact) it's just the score,
// band, and one short line, with an Edit link back into the form either way. The ring gauge
// gives the score real visual weight — this is the one number BRK asks the athlete to glance at
// every single morning, so it earns more than a plain digit.
function TodaySummary({ entry, state, onEdit, compact }) {
  const score = computeReadinessScore(entry);
  const band = readinessBand(score);
  const message = compact ? READINESS_SHORT[band] : generateMorningCheckIn(buildCoachContext(state)).message;
  return (
    <Card padding="p-4" className="space-y-1">
      <div className="flex items-center justify-between">
        <SectionLabel>Readiness</SectionLabel>
        <ButtonText tone="muted" onClick={onEdit}>Edit</ButtonText>
      </div>
      <div className="flex items-center gap-3">
        <RingGauge pct={score ?? 0} value={score} tone={BAND_TONE[band] || "red"} size={64} strokeWidth={6} />
        <div className="min-w-0">
          <div className={`text-xs font-bold uppercase tracking-widest ${BAND_TEXT[band] || "text-v5-subtext"}`}>{BAND_LABEL[band]}</div>
          <div className="text-sm text-v5-subtext whitespace-pre-line mt-0.5">{message}</div>
        </div>
      </div>
    </Card>
  );
}

// Collapsed "no check-in yet" prompt for compact (Today dashboard) placement — full form
// takes real screen space, so on Today it only opens once the user actually taps in.
function CheckInPrompt({ onOpen }) {
  return (
    <Card onClick={onOpen} className="flex items-center justify-between">
      <div>
        <SectionLabel>Readiness</SectionLabel>
        <div className="text-sm text-v5-subtext mt-1">Check in — 2 min</div>
      </div>
      <span className="shrink-0 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold bg-v5-red text-white">Check in</span>
    </Card>
  );
}

export default function ReadinessCheckIn({ state, updateState, compact = false }) {
  const entries = state.readinessLogs || [];
  const todayEntry = entries.find((e) => e.date.slice(0, 10) === todayStr());
  const [editing, setEditing] = useState(!compact && !todayEntry);
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
      const readinessLogs = existing
        ? list.map((e) => (e.id === existing.id ? { ...e, ...fields } : e))
        : [{ id: `readiness_${Date.now()}`, date: new Date().toISOString(), ...fields }, ...list];
      const next = { ...prev, readinessLogs };
      // Only log a fresh coach-history entry for a brand-new check-in, not every edit to it.
      if (!existing) {
        const { message } = generateMorningCheckIn(buildCoachContext(next));
        next.coachHistory = [
          { id: `coach_${Date.now()}`, date: new Date().toISOString(), type: "morning_checkin", message },
          ...(prev.coachHistory || []),
        ];
      }
      return next;
    });
    setEditing(false);
  };

  if (!editing && todayEntry) {
    return <TodaySummary entry={todayEntry} state={state} compact={compact} onEdit={() => setEditing(true)} />;
  }
  if (!editing && compact) {
    return <CheckInPrompt onOpen={() => setEditing(true)} />;
  }

  const previewScore = computeReadinessScore(form);

  return (
    <Card padding="p-4" className="space-y-4">
      <SectionLabel>Daily readiness check-in</SectionLabel>
      <div className="space-y-2.5">
        {RATING_FIELDS.map((f) => (
          <RatingRow key={f.key} label={f.label} value={form[f.key]} onChange={(v) => setField(f.key, v)} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-v5-subtext mb-1">Sleep hours (optional)</label>
          <input
            type="number"
            value={form.sleepHours}
            onChange={(e) => setField("sleepHours", e.target.value)}
            className="w-full bg-v5-elevated rounded-lg text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-v5-subtext mb-1">Resting HR (optional)</label>
          <input
            type="number"
            value={form.restingHR}
            onChange={(e) => setField("restingHR", e.target.value)}
            className="w-full bg-v5-elevated rounded-lg text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red"
          />
        </div>
      </div>
      <input
        type="text"
        value={form.notes}
        onChange={(e) => setField("notes", e.target.value)}
        placeholder="Notes — optional"
        className="w-full bg-v5-elevated rounded-lg text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red placeholder:text-v5-subtext/50"
      />
      {previewScore != null && (
        <div className="text-xs text-v5-subtext">
          Score preview: <span className="text-v5-text font-bold">{previewScore}</span>
        </div>
      )}
      <ButtonPrimary onClick={save}>Save check-in</ButtonPrimary>
    </Card>
  );
}
