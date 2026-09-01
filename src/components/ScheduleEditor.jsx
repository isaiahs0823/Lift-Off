import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Plus, Dumbbell, Timer, Wind, Moon } from "lucide-react";
import {
  WEEKDAY_LABELS,
  DAY_TYPES,
  DAY_TYPE_LABEL,
  emptySlot,
  defaultFixedDays,
  suggestFixedScheduleForCurrentProgram,
  suggestRollingSequenceForProgram,
} from "../utils/weeklySchedule.js";
import { resolveCurrentProgramDay } from "../utils/programSchedule.js";

const DISPLAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TYPE_ICON = { workout: Dumbbell, conditioning: Timer, recovery: Wind, rest: Moon };

function defaultLabelFor(type, source, state) {
  if (type === "rest") return "Rest";
  if (type === "recovery") return "Active Recovery";
  if (!source) return type === "conditioning" ? "Conditioning" : "Training day";
  if (source.kind === "currentProgram") return "Training day";
  if (source.kind === "plan") return (state.customPlans || []).find((p) => p.id === source.id)?.name || "Training day";
  if (source.kind === "template") return (state.templates || []).find((t) => t.id === source.id)?.name || "Training day";
  return type === "conditioning" ? "Conditioning" : "Training day";
}

// Inline accordion editor for a single DaySlot — type chips, then (for workout/conditioning) a
// flat list of sources to pick from, then an editable label. Used for both a fixed weekday row
// and a rolling sequence-position row, so the "tap to replace assignment" flow feels identical
// either way per the spec.
function SlotEditor({ slot, onChange, state, hasCurrentProgram }) {
  const setType = (type) => {
    const source = type === "workout" || type === "conditioning" ? slot.source : null;
    onChange({ type, source, label: defaultLabelFor(type, source, state) });
  };
  const setSource = (source) => onChange({ ...slot, source, label: defaultLabelFor(slot.type, source, state) });

  const showSource = slot.type === "workout" || slot.type === "conditioning";

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-4 gap-1.5">
        {DAY_TYPES.map((t) => {
          const Icon = TYPE_ICON[t];
          const active = slot.type === t;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex flex-col items-center gap-1 py-2.5 border text-[10px] uppercase tracking-wide font-bold ${
                active ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              <Icon size={14} />
              {DAY_TYPE_LABEL[t]}
            </button>
          );
        })}
      </div>

      {showSource && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-v5-subtext/70">Source</div>
          <button
            onClick={() => setSource(null)}
            disabled={!hasCurrentProgram && slot.type === "workout"}
            className={`w-full text-left px-3 py-2 text-sm border ${
              !slot.source ? "border-v5-red text-white bg-v5-red/20" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
            } ${!hasCurrentProgram && slot.type === "workout" ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            {slot.type === "conditioning" ? "No specific plan — open Cardio when it's due" : "Whatever's next — no specific plan"}
          </button>
          {hasCurrentProgram && (
            <button
              onClick={() => setSource({ kind: "currentProgram" })}
              className={`w-full text-left px-3 py-2 text-sm border ${
                slot.source?.kind === "currentProgram" ? "border-v5-red text-white bg-v5-red/20" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              Current program — next day in rotation
            </button>
          )}
          {(state.customPlans || []).map((p) => (
            <button
              key={p.id}
              onClick={() => setSource({ kind: "plan", id: p.id })}
              className={`w-full text-left px-3 py-2 text-sm border truncate ${
                slot.source?.kind === "plan" && slot.source.id === p.id ? "border-v5-red text-white bg-v5-red/20" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              {p.name}
            </button>
          ))}
          {(state.templates || []).map((t) => (
            <button
              key={t.id}
              onClick={() => setSource({ kind: "template", id: t.id })}
              className={`w-full text-left px-3 py-2 text-sm border truncate ${
                slot.source?.kind === "template" && slot.source.id === t.id ? "border-v5-red text-white bg-v5-red/20" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-v5-subtext/70 mb-1">Label</label>
        <input
          type="text"
          value={slot.label}
          onChange={(e) => onChange({ ...slot, label: e.target.value })}
          className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
        />
      </div>
    </div>
  );
}

function SlotRow({ title, slot, expanded, onToggle, onChange, onRemove, state, hasCurrentProgram }) {
  const Icon = TYPE_ICON[slot.type];
  return (
    <div className="border border-white/10 bg-v5-elevated">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[11px] uppercase tracking-widest text-v5-subtext w-9 shrink-0">{title}</span>
          <Icon size={15} className={slot.type === "rest" ? "text-v5-subtext/70" : "text-v5-red"} />
          <span className="text-sm text-white truncate">{slot.label || DAY_TYPE_LABEL[slot.type]}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onRemove && (
            <span onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-v5-subtext/70 hover:text-v5-red p-1">
              <Trash2 size={14} />
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-v5-subtext/70" /> : <ChevronDown size={16} className="text-v5-subtext/70" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <SlotEditor slot={slot} onChange={onChange} state={state} hasCurrentProgram={hasCurrentProgram} />
        </div>
      )}
    </div>
  );
}

export default function ScheduleEditor({ state, updateState, onBack }) {
  const existing = state.weeklySchedule;
  const programDay = useMemo(() => resolveCurrentProgramDay(state), [state]);
  const hasCurrentProgram = !!(programDay && !programDay.isComplete);
  const programDayCount = programDay?.totalDays || 0;

  const [mode, setMode] = useState(existing?.mode || "fixed");
  const [fixedDays, setFixedDays] = useState(existing?.fixedDays || defaultFixedDays());
  const [rollingSequence, setRollingSequence] = useState(existing?.rollingSequence || []);
  const [expandedKey, setExpandedKey] = useState(null);
  const [saved, setSaved] = useState(false);

  const applySuggestion = () => {
    if (!hasCurrentProgram) return;
    if (mode === "fixed") setFixedDays(suggestFixedScheduleForCurrentProgram(programDayCount));
    else setRollingSequence(suggestRollingSequenceForProgram(programDayCount));
    setSaved(false);
  };

  const updateFixedSlot = (key, patch) => {
    setFixedDays((d) => ({ ...d, [key]: patch }));
    setSaved(false);
  };
  const updateRollingSlot = (idx, patch) => {
    setRollingSequence((seq) => seq.map((s, i) => (i === idx ? patch : s)));
    setSaved(false);
  };
  const addRollingSlot = () => {
    setRollingSequence((seq) => [...seq, emptySlot("rest")]);
    setSaved(false);
  };
  const removeRollingSlot = (idx) => {
    setRollingSequence((seq) => seq.filter((_, i) => i !== idx));
    setExpandedKey(null);
    setSaved(false);
  };
  const moveRollingSlot = (idx, dir) => {
    setRollingSequence((seq) => {
      const next = [...seq];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return seq;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSaved(false);
  };

  const save = () => {
    updateState((prev) => ({
      ...prev,
      weeklySchedule: {
        mode,
        fixedDays,
        rollingSequence,
        rollingCursor: prev.weeklySchedule?.mode === "rolling" ? prev.weeklySchedule.rollingCursor || 0 : 0,
        createdAt: prev.weeklySchedule?.createdAt || new Date().toISOString(),
      },
      hasSeenOnboarding: true,
    }));
    setSaved(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Weekly schedule</div>
          <div className="text-xl font-bold text-white mt-1">When do you train?</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        )}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Mode</div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("fixed")}
            className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border ${mode === "fixed" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext"}`}
          >
            Fixed week
          </button>
          <button
            onClick={() => setMode("rolling")}
            className={`flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border ${mode === "rolling" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext"}`}
          >
            Rolling
          </button>
        </div>
        <p className="text-[11px] text-v5-subtext/70 mt-1.5">
          {mode === "fixed"
            ? "Repeats by weekday — best for a predictable schedule."
            : "Moves forward in order regardless of weekday, and waits on a missed day instead of jumping ahead — best for shift work or unpredictable weeks."}
        </p>
      </div>

      {hasCurrentProgram && (
        <button onClick={applySuggestion} className="text-[11px] uppercase tracking-widest text-v5-red hover:text-v5-red">
          Suggest a schedule from my current program
        </button>
      )}

      {mode === "fixed" ? (
        <div className="space-y-2">
          {DISPLAY_ORDER.map((key) => (
            <SlotRow
              key={key}
              title={WEEKDAY_LABELS[key]}
              slot={fixedDays[key] || emptySlot("rest")}
              expanded={expandedKey === key}
              onToggle={() => setExpandedKey((k) => (k === key ? null : key))}
              onChange={(patch) => updateFixedSlot(key, patch)}
              state={state}
              hasCurrentProgram={hasCurrentProgram}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {rollingSequence.length === 0 && (
            <div className="text-sm text-v5-subtext text-center py-6 border border-white/[0.06]">
              No sequence yet. Add the first day below.
            </div>
          )}
          {rollingSequence.map((slot, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <div className="flex flex-col gap-0.5 pt-3 shrink-0">
                <button onClick={() => moveRollingSlot(idx, -1)} disabled={idx === 0} className="text-v5-subtext/70 hover:text-v5-red disabled:opacity-20 p-0.5">
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moveRollingSlot(idx, 1)} disabled={idx === rollingSequence.length - 1} className="text-v5-subtext/70 hover:text-v5-red disabled:opacity-20 p-0.5">
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <SlotRow
                  title={String(idx + 1)}
                  slot={slot}
                  expanded={expandedKey === idx}
                  onToggle={() => setExpandedKey((k) => (k === idx ? null : idx))}
                  onChange={(patch) => updateRollingSlot(idx, patch)}
                  onRemove={() => removeRollingSlot(idx)}
                  state={state}
                  hasCurrentProgram={hasCurrentProgram}
                />
              </div>
            </div>
          ))}
          <button onClick={addRollingSlot} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40">
            <Plus size={12} /> Add day
          </button>
        </div>
      )}

      <button
        onClick={save}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
      >
        Save schedule
      </button>
      {saved && <div className="text-center text-xs text-green-500">Schedule saved.</div>}
    </div>
  );
}
