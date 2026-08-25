import React from "react";
import { ChevronRight, Search, Flame, Settings as SettingsIcon, CalendarDays } from "lucide-react";
import { MORE_CARD_CONTENT } from "../utils/breakBrandContent.js";

// B.R.E.A.K. Meaning used to also have its own row here, duplicating the brand card below —
// the card (with its "LEARN WHAT B.R.E.A.K. MEANS" CTA) is now the single entry point to that
// page from More. See breakBrandContent.js — MORE_ROW_CONTENT is no longer read anywhere, kept
// there only in case a second nav entry point is wanted again later.
const ITEMS = [
  { id: "schedule", label: "Weekly schedule", desc: "Which days are training, conditioning, recovery, or rest", icon: CalendarDays },
  { id: "catalog", label: "Exercise catalog", desc: "Every movement in the library, plus your own", icon: Search },
  { id: "top", label: "Top used", desc: "Your most-logged exercises", icon: Flame },
  { id: "settings", label: "Settings", desc: "Training defaults, backup & restore", icon: SettingsIcon },
];

// Restrained brand card below the normal navigation rows — a deliberate brand touch, not an
// advertisement. Copy comes from breakBrandContent.js so it stays in sync with the meaning page.
function BrandCard({ onNavigate }) {
  return (
    <button
      onClick={() => onNavigate("breakMeaning")}
      className="w-full text-left border border-neutral-800 bg-charcoal-panel px-5 py-5 hover:border-red-900/60"
    >
      <div className="font-brk-heading text-xs font-bold uppercase tracking-[0.25em] text-red-600">{MORE_CARD_CONTENT.eyebrow}</div>
      <div className="font-brk-display text-lg font-black uppercase tracking-wide text-white mt-1">{MORE_CARD_CONTENT.title}</div>
      <p className="font-brk-body text-xs text-neutral-500 mt-2 leading-relaxed max-w-sm">{MORE_CARD_CONTENT.body}</p>
      <div className="text-[11px] font-bold uppercase tracking-widest text-red-500 mt-3 flex items-center gap-1">
        {MORE_CARD_CONTENT.cta} <ChevronRight size={14} />
      </div>
    </button>
  );
}

// Training Detail (Simple/Advanced) only controls *visibility* of already-built features —
// RIR/RPE, set classification, advanced analytics — never a separate code path or a second
// version of the app. Defaults to Advanced so nothing changes for anyone already using this.
function TrainingDetailToggle({ state, updateState }) {
  const level = state.settings?.trainingDetail || "advanced";
  const setLevel = (v) => updateState((prev) => ({ ...prev, settings: { ...(prev.settings || {}), trainingDetail: v } }));
  return (
    <div className="border border-neutral-800 bg-charcoal-panel p-4">
      <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Training detail</div>
      <div className="flex gap-2">
        <button
          onClick={() => setLevel("simple")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
            level === "simple" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
          }`}
        >
          Simple
        </button>
        <button
          onClick={() => setLevel("advanced")}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
            level === "advanced" ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400"
          }`}
        >
          Advanced
        </button>
      </div>
      <p className="text-[11px] text-neutral-600 mt-1.5">Simple hides RIR/RPE, set types, and advanced analytics until you want them.</p>
    </div>
  );
}

export default function MoreTab({ state, updateState, onNavigate }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-red-600">More</div>
        <div className="text-xl font-bold text-white mt-1">Tools & settings</div>
      </div>

      <div className="space-y-2">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="w-full flex items-center justify-between border border-neutral-800 bg-charcoal-panel p-4 hover:border-neutral-600"
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} className="text-neutral-500" />
              <div className="text-left">
                <div className="text-base font-bold text-white">{item.label}</div>
                <div className="text-xs text-neutral-500">{item.desc}</div>
              </div>
            </div>
            <ChevronRight size={18} className="text-neutral-600 shrink-0" />
          </button>
        ))}
      </div>

      <TrainingDetailToggle state={state} updateState={updateState} />

      <BrandCard onNavigate={onNavigate} />
    </div>
  );
}
