import { ChevronRight } from "lucide-react";
import { Card, SectionLabel, ProgressBar } from "./ui/Kit.jsx";
import { tierTheme, tierCardStyle } from "../utils/rankTheme.js";

const TIERS = ["Initiate", "Built", "Forged", "Relentless", "Elite", "Champion"];

// Shared "how am I doing, in one glance" card — used on both Progress Overview (full) and Today
// (compact: task "the card should be compact enough that today's workout remains above the fold
// or very close to it"). Reads the LATEST snapshot only; never computes anything itself. Two
// states now (v2 engine): establishing_baseline (no number at all — zero valid lifting history)
// and a real OVR + Rank, tagged "Provisional" when the lifting evidence behind it is still thin.
// Rank is never withheld while a number exists (task: "do not show rank as Calibrating when the
// athlete has a valid provisional or established OVR") — Provisional is a tag ALONGSIDE the real
// rank, never a replacement for it.
export default function AthleteRatingCard({ snapshot, onOpen, compact = false }) {
  const ovrTier = snapshot?.ovrTier || "establishing_baseline";

  if (!snapshot || snapshot.ovr == null) {
    if (compact) {
      return (
        <Card onClick={onOpen} className="flex items-center justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-v5-red font-bold">BRK Athlete</div>
            <div className="text-sm font-bold text-v5-text">Establishing baseline</div>
          </div>
          <ChevronRight size={15} className="text-v5-subtext shrink-0" />
        </Card>
      );
    }
    return (
      <Card onClick={onOpen} className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionLabel tone="red">BRK Athlete</SectionLabel>
          <ChevronRight size={15} className="text-v5-subtext shrink-0" />
        </div>
        <div className="text-lg font-black text-v5-text">Establishing baseline</div>
        <p className="text-xs text-v5-subtext">Log one completed workout — that's all BRK needs to give you a real rating.</p>
      </Card>
    );
  }

  const { ovr, ovrDelta, rank } = snapshot;
  const isProvisional = ovrTier === "provisional";
  const tier = tierTheme(rank.tier);

  // Progress toward the next rank TIER (not sub-level) — always meaningful now, provisional
  // included, since rank is always computed whenever ovr exists.
  const tierIdx = TIERS.indexOf(rank.tier);
  const nextTier = tierIdx >= 0 && tierIdx < 5 ? TIERS[tierIdx + 1] : null;
  const span = rank.max - rank.min + 1;
  const pct = Math.round(((ovr - rank.min) / span) * 100);
  const pointsToNext = rank.max + 1 - ovr;

  if (compact) {
    return (
      <Card onClick={onOpen} className="flex items-center justify-between gap-2 py-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-2xl font-black text-v5-text tabular-nums shrink-0">{ovr}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wide truncate" style={{ color: tier.color }}>
                {rank.label}
              </span>
              {isProvisional && <span className="text-[9px] font-bold text-v5-subtext shrink-0">PROV</span>}
              {ovrDelta != null && ovrDelta !== 0 && (
                <span className={`text-[11px] font-bold shrink-0 ${ovrDelta > 0 ? "text-v5-success" : "text-v5-red"}`}>
                  {ovrDelta > 0 ? "↑" : "↓"}
                  {Math.abs(ovrDelta)}
                </span>
              )}
            </div>
            {nextTier && (
              <div className="text-[10px] text-v5-subtext truncate">
                {pointsToNext} to {nextTier}
              </div>
            )}
          </div>
        </div>
        <ChevronRight size={15} className="text-v5-subtext shrink-0" />
      </Card>
    );
  }

  return (
    <Card onClick={onOpen} tone="default" style={tierCardStyle(rank.tier)} className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel tone="red">BRK Athlete</SectionLabel>
        <ChevronRight size={15} className="text-v5-subtext shrink-0" />
      </div>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">OVR</span>
          <span className="text-4xl font-black text-v5-text tabular-nums">{ovr}</span>
          {ovrDelta != null && ovrDelta !== 0 && (
            <span className={`text-xs font-bold ${ovrDelta > 0 ? "text-v5-success" : "text-v5-red"}`}>
              {ovrDelta > 0 ? "↑" : "↓"}
              {Math.abs(ovrDelta)}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-black uppercase tracking-wide" style={{ color: tier.color }}>
            {rank.label}
          </div>
          {isProvisional && <div className="text-[9px] uppercase tracking-widest font-bold text-v5-subtext">Provisional</div>}
        </div>
      </div>
      {nextTier && (
        <div className="space-y-1">
          <ProgressBar pct={pct} color={tier.color} />
          <div className="text-[11px] text-v5-subtext">
            {pointsToNext} to {nextTier}
          </div>
        </div>
      )}
    </Card>
  );
}
