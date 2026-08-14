import React, { useState } from "react";
import { X } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import {
  COACHING_STYLES,
  COACHING_STYLE_LABEL,
  COACHING_STYLE_DESC,
  RESPONSE_LENGTHS,
  RESPONSE_LENGTH_LABEL,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LABEL,
  resolveProfile,
} from "../utils/athleteProfile.js";

const CONSTRAINT_SUGGESTIONS = ["Shift work", "Night shift", "Long workdays", "Travel often", "Kids / family", "Limited gym access", "Variable training times"];

function TagList({ items, onAdd, onRemove, suggestions, placeholder }) {
  const [draft, setDraft] = useState("");
  const add = (val) => {
    const trimmed = val.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onAdd(trimmed);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item} className="flex items-center gap-1 px-2.5 py-1 text-xs border border-neutral-800 text-neutral-300 bg-charcoal-deep">
              {item}
              <button onClick={() => onRemove(item)} className="text-neutral-600 hover:text-red-500">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add(draft)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
        <button onClick={() => add(draft)} className="shrink-0 px-3 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
          Add
        </button>
      </div>
      {suggestions && suggestions.filter((s) => !items.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !items.includes(s))
            .map((s) => (
              <button key={s} onClick={() => add(s)} className="px-2 py-1 text-[11px] text-neutral-500 border border-neutral-900 hover:border-neutral-700 hover:text-neutral-300">
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// Shared by first-run onboarding (section 36 — ~7 questions, always skippable) and the ongoing
// editor reached from Coach Settings (section 3, full field set, progressive per section 37).
// Same component either way; onboarding mode just keeps the optional "more preferences" section
// collapsed so it doesn't read as a 30-question form.
export default function AthleteProfileForm({ state, updateState, mode = "edit", onDone, onSkip }) {
  const existing = resolveProfile(state);
  const [motivation, setMotivation] = useState(existing.motivation);
  const [experience, setExperience] = useState(existing.experience);
  const [preferredDays, setPreferredDays] = useState(existing.preferredDays != null ? String(existing.preferredDays) : "");
  const [preferredDuration, setPreferredDuration] = useState(existing.preferredDuration != null ? String(existing.preferredDuration) : "");
  const [constraints, setConstraints] = useState(existing.constraints);
  const [coachingStyle, setCoachingStyle] = useState(existing.coachingStyle);
  const [responseLength, setResponseLength] = useState(existing.responseLength);
  const [trainingStyle, setTrainingStyle] = useState(existing.trainingStyle);
  const [equipment, setEquipment] = useState(existing.equipment);
  const [showMore, setShowMore] = useState(mode === "edit");

  const save = () => {
    updateState((prev) => ({
      ...prev,
      athleteProfile: {
        ...resolveProfile(prev),
        motivation: motivation.trim(),
        experience,
        preferredDays: preferredDays !== "" ? Number(preferredDays) : null,
        preferredDuration: preferredDuration !== "" ? Number(preferredDuration) : null,
        constraints,
        coachingStyle,
        responseLength,
        trainingStyle: trainingStyle.trim(),
        equipment,
        onboardedAt: prev.athleteProfile?.onboardedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }));
    onDone?.();
  };

  const body = (
    <div className="space-y-6">
      {mode === "onboarding" && (
        <p className="text-sm text-neutral-400">
          A few quick questions so BRK Coach has a starting point — you can skip any of this and it'll figure the rest out over time.
        </p>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Why does your goal matter to you?</label>
        <input
          type="text"
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="Optional — e.g. I want to prove I can finish something difficult"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
        <p className="text-[11px] text-neutral-600 mt-1">Private. Coach uses this sparingly — not repeated every day.</p>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Training experience</label>
        <div className="grid grid-cols-4 gap-1.5">
          {EXPERIENCE_LEVELS.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setExperience(lvl)}
              className={`py-2 text-[11px] font-bold uppercase tracking-wide border ${
                experience === lvl ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
              }`}
            >
              {EXPERIENCE_LABEL[lvl]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Days/week you can train</label>
          <input
            type="number"
            min="1"
            max="7"
            value={preferredDays}
            onChange={(e) => setPreferredDays(e.target.value)}
            placeholder="e.g. 4"
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Preferred session length (min)</label>
          <input
            type="number"
            value={preferredDuration}
            onChange={(e) => setPreferredDuration(e.target.value)}
            placeholder="e.g. 60"
            className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Scheduling constraints</label>
        <TagList items={constraints} onAdd={(v) => setConstraints((c) => [...c, v])} onRemove={(v) => setConstraints((c) => c.filter((x) => x !== v))} suggestions={CONSTRAINT_SUGGESTIONS} placeholder="e.g. 24-hour shifts" />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-2">How should Coach talk to you?</label>
        <div className="space-y-1.5">
          {COACHING_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => setCoachingStyle(s)}
              className={`w-full text-left px-3 py-2.5 border ${
                coachingStyle === s ? "border-red-700 bg-red-950/20" : "border-neutral-800 hover:border-neutral-600"
              }`}
            >
              <div className={`text-sm font-bold ${coachingStyle === s ? "text-white" : "text-neutral-300"}`}>{COACHING_STYLE_LABEL[s]}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{COACHING_STYLE_DESC[s]}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Response length</label>
        <div className="flex gap-2">
          {RESPONSE_LENGTHS.map((r) => (
            <button
              key={r}
              onClick={() => setResponseLength(r)}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                responseLength === r ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
              }`}
            >
              {RESPONSE_LENGTH_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {mode === "onboarding" && !showMore && (
        <button onClick={() => setShowMore(true)} className="text-[11px] uppercase tracking-widest text-neutral-500 hover:text-red-500">
          More preferences (optional) ▾
        </button>
      )}

      {showMore && (
        <>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Training style</label>
            <input
              type="text"
              value={trainingStyle}
              onChange={(e) => setTrainingStyle(e.target.value)}
              placeholder="e.g. Heavy compounds, minimal isolation"
              className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Equipment / gym access</label>
            <TagList items={equipment} onAdd={(v) => setEquipment((e) => [...e, v])} onRemove={(v) => setEquipment((e) => e.filter((x) => x !== v))} placeholder="e.g. Home gym, dumbbells only" />
          </div>
        </>
      )}

      <button onClick={save} className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
        {mode === "onboarding" ? "Save & continue" : "Save profile"}
      </button>
      {mode === "onboarding" && onSkip && (
        <button onClick={save} className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300 py-1">
          Skip for now
        </button>
      )}
    </div>
  );

  if (mode === "onboarding") {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Coach setup</div>
          <div className="text-xl font-bold text-white mt-1">A few quick questions</div>
        </div>
        {body}
      </div>
    );
  }
  return (
    <SlideInPanel title="Athlete profile" subtitle="What Coach knows about how you want to train" onBack={onDone}>
      {body}
    </SlideInPanel>
  );
}
