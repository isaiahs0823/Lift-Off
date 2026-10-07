import { TIER_ORDER, tierTheme } from "../utils/rankTheme.js";

const TIER_INITIALS = { Initiate: "IN", Built: "BU", Forged: "FO", Relentless: "RE", Elite: "EL", Champion: "CH" };

// Six-chip rank ladder — shows the whole climb at a glance, current tier lit in its own color,
// the rest shown as a dim preview of what's ahead (approved mockup: "a rank-up changes what
// color you are, not just the number next to it"). Tier-only (no sub-level granularity here —
// the OVR card above it already states the exact sub-level in text).
export default function RankLadder({ currentTier }) {
  return (
    <div className="flex gap-1.5">
      {TIER_ORDER.map((tierName) => {
        const { color, text } = tierTheme(tierName);
        const active = tierName === currentTier;
        return (
          <div
            key={tierName}
            className="flex-1 h-8 rounded-lg flex items-center justify-center text-[10px] font-extrabold"
            style={
              active
                ? { backgroundColor: color, color: text, boxShadow: `0 0 14px ${color}70` }
                : { backgroundColor: `${color}12`, color, border: `1px solid ${color}40` }
            }
            title={tierName}
          >
            {TIER_INITIALS[tierName]}
          </div>
        );
      })}
    </div>
  );
}
