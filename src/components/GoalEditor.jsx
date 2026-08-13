import React, { useState } from "react";
import { Trash2 } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";

// Goal types that drive a live currentValue instead of a manually-typed one — see
// resolveGoalCurrentValue in MissionTab.jsx. "lift" additionally needs an exercise link.
export const AUTO_TRACKED_TYPES = new Set(["weight", "bodyfat", "lift"]);

export const GOAL_TYPES = [
  { value: "weight", label: "Bodyweight", units: "lb" },
  { value: "bodyfat", label: "Body fat %", units: "%" },
  { value: "lift", label: "Lift a weight", units: "lb" },
  { value: "run", label: "Run pace/time", units: "min" },
  { value: "reps", label: "Rep target (pull-ups, etc.)", units: "reps" },
  { value: "consistency", label: "Train N days/week", units: "days/wk" },
  { value: "cardio_frequency", label: "Cardio sessions/week", units: "sessions/wk" },
  { value: "program", label: "Complete a program", units: "" },
  { value: "custom", label: "Custom", units: "" },
];

// Add/edit form for a single goal. Shared by MissionTab for both the "new goal" and "edit
// goal" flows — same fields either way, just seeded differently.
export function GoalEditor({ goal, allExercises, exMap, hasPrimary, onBack, onSave, onDelete }) {
  const [title, setTitle] = useState(goal?.title || "");
  const [type, setType] = useState(goal?.type || "weight");
  const [startValue, setStartValue] = useState(goal?.startValue != null ? String(goal.startValue) : "");
  const [currentValue, setCurrentValue] = useState(goal?.currentValue != null ? String(goal.currentValue) : "");
  const [targetValue, setTargetValue] = useState(goal?.targetValue != null ? String(goal.targetValue) : "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ? goal.targetDate.slice(0, 10) : "");
  const [units, setUnits] = useState(goal?.units || GOAL_TYPES.find((t) => t.value === (goal?.type || "weight"))?.units || "");
  const [priority, setPriority] = useState(goal?.priority || (hasPrimary ? "secondary" : "primary"));
  const [notes, setNotes] = useState(goal?.notes || "");
  const [linkedExId, setLinkedExId] = useState(goal?.linkedExId || "");
  const [metric, setMetric] = useState(goal?.metric || "weight");
  const [status, setStatus] = useState(goal?.status || "active");

  const canSave = title.trim() && startValue !== "" && targetValue !== "";

  const handleTypeChange = (val) => {
    setType(val);
    const preset = GOAL_TYPES.find((t) => t.value === val);
    if (preset && !goal) setUnits(preset.units);
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      type,
      startValue: Number(startValue),
      currentValue: currentValue !== "" ? Number(currentValue) : Number(startValue),
      targetValue: Number(targetValue),
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      units: units.trim(),
      priority,
      notes: notes.trim(),
      linkedExId: type === "lift" ? linkedExId || null : null,
      metric: type === "lift" ? metric : null,
      status,
    });
  };

  return (
    <SlideInPanel title={goal ? "Edit goal" : "New goal"} onBack={onBack}>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Goal title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Reach 205 lb"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-base focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Type</label>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        >
          {GOAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {type === "lift" && (
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Linked exercise (optional)</label>
          <select
            value={linkedExId}
            onChange={(e) => setLinkedExId(e.target.value)}
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700 mb-2"
          >
            <option value="">Not linked — track manually</option>
            {allExercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
          {linkedExId && (
            <div className="flex gap-2">
              <button
                onClick={() => setMetric("weight")}
                className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                  metric === "weight" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
                }`}
              >
                Heaviest weight
              </button>
              <button
                onClick={() => setMetric("e1rm")}
                className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                  metric === "e1rm" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
                }`}
              >
                Estimated 1RM
              </button>
            </div>
          )}
          <p className="text-xs text-neutral-600 mt-1.5">
            Linked, current value tracks itself off your logs for {exMap[linkedExId]?.name || "that exercise"}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Start</label>
          <input
            type="number"
            value={startValue}
            onChange={(e) => setStartValue(e.target.value)}
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Current</label>
          <input
            type="number"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            disabled={type === "lift" && !!linkedExId}
            placeholder={type === "lift" && linkedExId ? "auto" : ""}
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-sm focus:outline-none focus:border-red-700 disabled:text-neutral-600"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Target</label>
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Units</label>
          <input
            type="text"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            placeholder="lb, %, min..."
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Target date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Priority</label>
        <div className="flex gap-2">
          <button
            onClick={() => setPriority("primary")}
            className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
              priority === "primary" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
            }`}
          >
            Primary
          </button>
          <button
            onClick={() => setPriority("secondary")}
            className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
              priority === "secondary" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
            }`}
          >
            Secondary
          </button>
        </div>
        {priority === "primary" && hasPrimary && goal?.priority !== "primary" && (
          <p className="text-xs text-neutral-600 mt-1.5">This replaces your current primary goal — it becomes secondary.</p>
        )}
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Why this goal (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Your reason — shown nowhere else, just for you."
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      {goal && (
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Status</label>
          <div className="flex gap-2">
            {["active", "paused", "completed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                  status === s ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border ${
          canSave ? "bg-red-700 border-red-700 text-white hover:bg-red-600" : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        {goal ? "Save changes" : "Create goal"}
      </button>

      {goal && onDelete && (
        <button
          onClick={onDelete}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-neutral-800 bg-charcoal-panel text-neutral-400 hover:text-red-500 hover:border-red-900/40 flex items-center justify-center gap-1.5"
        >
          <Trash2 size={14} /> Delete goal
        </button>
      )}
    </SlideInPanel>
  );
}
