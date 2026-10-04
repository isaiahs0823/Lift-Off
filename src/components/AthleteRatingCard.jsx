import { ChevronRight } from "lucide-react";
import { Card, SectionLabel, ProgressBar } from "./ui/Kit.jsx";

// Top-of-Overview summary — the "how am I doing, in one glance" card (task: BRK Athlete /
// OVR / rank / progress-to-next). Reads the LATEST snapshot only; never computes anything
// itself. Three states: no snapshot yet (never recalculated), establishing baseline (recalculated
// but not enough evidence for a real OVR), and a real rated athlete.
export default function AthleteRatingCard({ snapshot, onOpen }) {
  if (!snapshot || snapshot.ovr == null) {
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
  // Progress toward the next rank tier (not sub-level) — matches the mockup's "N / M to
  // <NextRank>" bar.
  const tierIdx = ["Initiate", "Built", "Forged", "Relentless", "Elite", "Champion"].indexOf(rank.tier);
  const nextTier = tierIdx >= 0 && tierIdx < 5 ? ["Initiate", "Built", "Forged", "Relentless", "Elite", "Champion"][tierIdx + 1] : null;
  const span = rank.max - rank.min + 1;
  const intoRank = ovr - rank.min;
  const pct = Math.round((intoRank / span) * 100);

  return (
    <Card onClick={onOpen} tone="accent" className="space-y-3">
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
          <div className="text-sm font-black uppercase tracking-wide text-v5-red">{rank.label}</div>
        </div>
      </div>
      {nextTier && (
        <div className="space-y-1">
          <ProgressBar pct={pct} />
          <div className="text-[11px] text-v5-subtext">
            {rank.max + 1 - ovr} to {nextTier}
          </div>
        </div>
      )}
    </Card>
  );
}
