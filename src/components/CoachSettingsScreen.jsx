import React from "react";
import { ChevronRight } from "lucide-react";
import {
  COACHING_STYLES,
  COACHING_STYLE_LABEL,
  COACHING_STYLE_DESC,
  RESPONSE_LENGTHS,
  RESPONSE_LENGTH_LABEL,
  resolveProfile,
} from "../utils/athleteProfile.js";

// The Coach-specific control panel (section 39): tone/length/learning toggle plus entry points
// into the two deeper screens (full profile editor, What Coach Knows). Distinct from
// AthleteProfileForm's edit mode — that's the full ~10-field profile; this is just "how Coach
// behaves," saved immediately per change rather than behind a Save button, matching how a
// settings screen (not a form) is expected to behave.
export default function CoachSettingsScreen({ state, updateState, onNavigate, onBack }) {
  const profile = resolveProfile(state);

  const patch = (fields) => {
    updateState((prev) => ({ ...prev, athleteProfile: { ...resolveProfile(prev), ...fields, updatedAt: new Date().toISOString() } }));
  };

  const clearMemory = () => {
    const ok = window.confirm(
      "Clear everything Coach has learned from conversations and detected patterns? Your workout history, goals, and logged data are never touched — this only resets Coach's own memory and chat history."
    );
    if (!ok) return;
    updateState((prev) => ({ ...prev, coachMemories: [], coachHistory: [] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
          <div className="text-xl font-bold text-white mt-1">Coach settings</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500">
            ← Back
          </button>
        )}
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-2">How should Coach talk to you?</label>
        <div className="space-y-1.5">
          {COACHING_STYLES.map((s) => (
            <button
              key={s}
              onClick={() => patch({ coachingStyle: s })}
              className={`w-full text-left px-3 py-2.5 border ${
                profile.coachingStyle === s ? "border-red-700 bg-red-950/20" : "border-neutral-800 hover:border-neutral-600"
              }`}
            >
              <div className={`text-sm font-bold ${profile.coachingStyle === s ? "text-white" : "text-neutral-300"}`}>{COACHING_STYLE_LABEL[s]}</div>
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
              onClick={() => patch({ responseLength: r })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                profile.responseLength === r ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
              }`}
            >
              {RESPONSE_LENGTH_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-neutral-800 bg-charcoal-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">Learn from my training data</div>
            <div className="text-xs text-neutral-500 mt-0.5">When off, Coach stops detecting new patterns. Existing memories stay until you delete them.</div>
          </div>
          <button
            onClick={() => patch({ learningEnabled: !profile.learningEnabled })}
            className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${profile.learningEnabled ? "bg-red-700" : "bg-neutral-800"}`}
            aria-label="Toggle learning from training data"
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.learningEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <button onClick={() => onNavigate?.("coachKnowledge")} className="w-full flex items-center justify-between border border-neutral-800 bg-charcoal-panel p-3 text-sm text-neutral-300 hover:border-neutral-600">
          What Coach knows about you
          <ChevronRight size={16} className="text-neutral-600" />
        </button>
        <button onClick={() => onNavigate?.("coachProfile")} className="w-full flex items-center justify-between border border-neutral-800 bg-charcoal-panel p-3 text-sm text-neutral-300 hover:border-neutral-600">
          Edit full athlete profile
          <ChevronRight size={16} className="text-neutral-600" />
        </button>
      </div>

      <div className="border border-neutral-800 p-4 space-y-2">
        <div className="text-sm font-bold text-white">Clear conversation memory</div>
        <div className="text-xs text-neutral-500">Resets everything Coach has learned from conversations and detected patterns. Your workout history, goals, and logs are never affected.</div>
        <button onClick={clearMemory} className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-red-900 text-red-500 hover:bg-red-950/30">
          Clear conversation memory
        </button>
      </div>
    </div>
  );
}
