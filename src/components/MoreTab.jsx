import React from "react";
import { ChevronRight, Search, Flame, Settings as SettingsIcon, CalendarDays, HeartPulse, ShieldCheck } from "lucide-react";
import { MORE_CARD_CONTENT } from "../utils/breakBrandContent.js";
import { ScreenHeader, SectionLabel, Card, ListRow, ButtonPrimary, ButtonSecondary } from "./ui/Kit.jsx";

// B.R.E.A.K. Meaning used to also have its own row here, duplicating the brand card below —
// the card (with its "LEARN WHAT B.R.E.A.K. MEANS" CTA) is now the single entry point to that
// page from More. See breakBrandContent.js — MORE_ROW_CONTENT is no longer read anywhere, kept
// there only in case a second nav entry point is wanted again later.
const ITEMS = [
  { id: "schedule", label: "Weekly schedule", desc: "Which days are training, conditioning, recovery, or rest", icon: CalendarDays },
  { id: "catalog", label: "Exercise catalog", desc: "Every movement in the library, plus your own", icon: Search },
  { id: "mobility", label: "Mobility & Stretching", desc: "Stretch/mobility library, recovery routines, and guided sessions", icon: HeartPulse },
  { id: "top", label: "Top used", desc: "Your most-logged exercises", icon: Flame },
  { id: "settings", label: "Settings", desc: "Training defaults, backup & restore", icon: SettingsIcon },
];

// Restrained brand card below the normal navigation rows — a deliberate brand touch, not an
// advertisement. Copy comes from breakBrandContent.js so it stays in sync with the meaning page.
function BrandCard({ onNavigate }) {
  return (
    <Card onClick={() => onNavigate("breakMeaning")} tone="accent" padding="p-5">
      <div className="font-brk-heading text-xs font-bold uppercase tracking-[0.25em] text-v5-red">{MORE_CARD_CONTENT.eyebrow}</div>
      <div className="font-brk-display text-lg font-black uppercase tracking-wide text-v5-text mt-1">{MORE_CARD_CONTENT.title}</div>
      <p className="font-brk-body text-xs text-v5-subtext mt-2 leading-relaxed max-w-sm">{MORE_CARD_CONTENT.body}</p>
      <div className="text-[11px] font-bold uppercase tracking-widest text-v5-red mt-3 flex items-center gap-1">
        {MORE_CARD_CONTENT.cta} <ChevronRight size={14} />
      </div>
    </Card>
  );
}

// Training Detail (Simple/Advanced) only controls *visibility* of already-built features —
// RIR/RPE, set classification, advanced analytics — never a separate code path or a second
// version of the app. Defaults to Advanced so nothing changes for anyone already using this.
function TrainingDetailToggle({ state, updateState }) {
  const level = state.settings?.trainingDetail || "advanced";
  const setLevel = (v) => updateState((prev) => ({ ...prev, settings: { ...(prev.settings || {}), trainingDetail: v } }));
  return (
    <Card>
      <SectionLabel tone="muted" className="mb-2">Training detail</SectionLabel>
      <div className="flex gap-2">
        {["simple", "advanced"].map((v) => {
          const active = level === v;
          const Btn = active ? ButtonPrimary : ButtonSecondary;
          return (
            <Btn key={v} size="sm" onClick={() => setLevel(v)} className="flex-1 capitalize">
              {v}
            </Btn>
          );
        })}
      </div>
      <p className="text-[11px] text-v5-subtext/70 mt-2">Simple hides RIR/RPE, set types, and advanced analytics until you want them.</p>
    </Card>
  );
}

// Non-alarming reminder that this is still a local-first app — no account, no cloud sync yet —
// surfaced where a user would actually look for it rather than buried a screen deeper. Routes
// straight to the real export/import flow already built into Settings rather than duplicating
// it or faking a "back up" action here.
function DataSafetyCard({ onNavigate }) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} className="text-v5-subtext shrink-0" />
        <SectionLabel tone="muted">Data safety</SectionLabel>
      </div>
      <p className="text-xs text-v5-subtext">Your training data is currently stored on this device only. Export a backup before switching phones or clearing browser data.</p>
      <ButtonSecondary size="sm" onClick={() => onNavigate("settings")} fullWidth={false}>
        Back up data
      </ButtonSecondary>
    </Card>
  );
}

export default function MoreTab({ state, updateState, onNavigate }) {
  return (
    <div className="space-y-4">
      <ScreenHeader eyebrow="More" title="Tools & settings" />

      <div className="space-y-2">
        {ITEMS.map((item) => (
          <ListRow key={item.id} icon={item.icon} title={item.label} subtitle={item.desc} onClick={() => onNavigate(item.id)} />
        ))}
      </div>

      <DataSafetyCard onNavigate={onNavigate} />

      <TrainingDetailToggle state={state} updateState={updateState} />

      <BrandCard onNavigate={onNavigate} />
    </div>
  );
}
