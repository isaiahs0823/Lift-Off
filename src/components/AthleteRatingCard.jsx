import { ChevronRight } from "lucide-react";
import { Card, SectionLabel, ProgressBar } from "./ui/Kit.jsx";
import { tierTheme, tierCardStyle } from "../utils/rankTheme.js";

const TIERS = ["Initiate", "Built", "Forged", "Relentless", "Elite", "Champion"];

// Shared "how am I doing, in one glance" card — used on both Progress Overview (full) and Today
// (compact: task "the card should be compact enough that today's workout remains above the fold
// or very close to it"). Reads the LATEST snapshot only; never computes anything itself. Three
// states, matching the engine's ovrTier: establishing_baseline (no number at all), provisional
// (a real but still-thin number, no Rank yet), established (full OVR + Rank + progress bar).
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
        <p className="text-xs text-v5-subtext">
          Keep logging workouts — your Athlete Rating reveals itself once BRK has enough real training evidence to trust.
        </p>
      </Card>
    );
  }

  const { ovr, ovrDelta, rank } = snapshot;
  const isProvisional = ovrTier === "provisional" || !rank;

  // Progress toward the next rank TIER (not sub-level) — only meaningful once established.
  let nextTier = null;
  let pct = null;
  let pointsToNext = null;
  if (rank) {
    const tierIdx = TIERS.indexOf(rank.tier);
    nextTier = tierIdx >= 0 && tierIdx < 5 ? TIERS[tierIdx + 1] : null;
    const span = rank.max - rank.min + 1;
    pct = Math.round(((ovr - rank.min) / span) * 100);
    pointsToNext = rank.max + 1 - ovr;
  }

  const tier = rank ? tierTheme(rank.tier) : null;

  if (compact) {
    return (
      <Card onClick={onOpen} className="flex items-center justify-between gap-2 py-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-2xl font-black text-v5-text tabular-nums shrink-0">{ovr}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-black uppercase tracking-wide truncate ${isProvisional ? "text-v5-subtext" : ""}`}
                style={isProvisional ? undefined : { color: tier.color }}
              >
                {isProvisional ? "Provisional" : rank.label}
              </span>
              {ovrDelta != null && ovrDelta !== 0 && (
                <span className={`text-[11px] font-bold shrink-0 ${ovrDelta > 0 ? "text-v5-success" : "text-v5-red"}`}>
                  {ovrDelta > 0 ? "↑" : "↓"}
                  {Math.abs(ovrDelta)}
                </span>
              )}
            </div>
            {nextTier && <div className="text-[10px] text-v5-subtext truncate">{pointsToNext} to {nextTier}</div>}
          </div>
        </div>
        <ChevronRight size={15} className="text-v5-subtext shrink-0" />
      </Card>
    );
  }

  return (
    <Card
      onClick={onOpen}
      tone={tier ? "default" : "accent"}
      style={tier ? tierCardStyle(rank.tier) : undefined}
      className="space-y-3"
    >
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
          <div
            className={`text-sm font-black uppercase tracking-wide ${isProvisional ? "text-v5-subtext" : ""}`}
            style={isProvisional ? undefined : { color: tier.color }}
          >
            {isProvisional ? "Provisional" : rank.label}
          </div>
        </div>
      </div>
      {isProvisional ? (
        <p className="text-[11px] text-v5-subtext">A real first read on limited evidence — Rank unlocks once BRK has a bit more to go on.</p>
      ) : (
        nextTier && (
          <div className="space-y-1">
            <ProgressBar pct={pct} color={tier.color} />
            <div className="text-[11px] text-v5-subtext">
              {pointsToNext} to {nextTier}
            </div>
          </div>
        )
      )}
    </Card>
  );
}
