// ---------------- RANK TIER VISUAL IDENTITY ----------------
// Purely presentational — athleteRating.js's RANKS/rankForOvr own the actual tier boundaries and
// math; this only maps a tier NAME to how it should look, so a rank-up changes what color the
// athlete is, not just the number next to it (ranked-shooter convention, approved mockup at
// https://claude.ai/artifact/4Fc48TruAbkxZartTRAkVk). Cooler/duller at Initiate, warming up
// toward Champion, which keeps BRK's own brand red — just brighter — rather than spending an
// unrelated color on the top of the ladder.
export const TIER_ORDER = ["Initiate", "Built", "Forged", "Relentless", "Elite", "Champion"];

export const TIER_COLORS = {
  Initiate: { color: "#8A93A0", text: "#0A0A0B" },
  Built: { color: "#BF7A42", text: "#FFFFFF" },
  Forged: { color: "#C7D0D9", text: "#0A0A0B" },
  Relentless: { color: "#E8B23D", text: "#1A1408" },
  Elite: { color: "#35D6C4", text: "#06201C" },
  Champion: { color: "#FF4850", text: "#FFFFFF" },
};

export function tierTheme(tier) {
  return TIER_COLORS[tier] || TIER_COLORS.Initiate;
}

// BRK's SUBLEVELS run III (just entered the tier) -> II -> I (about to rank up) — see
// athleteRating.js's SUBLEVELS/rankForOvr — the same convention ranked shooters/MOBAs use (e.g.
// "Gold III/II/I"). III renders as the dimmest version of the tier color, I the brightest/
// fullest, so a sub-level-up is a visible step even before the tier itself changes.
const SUBLEVEL_ALPHA = { III: "70", II: "B0", I: "FF" };
export function sublevelColor(tier, sublevel) {
  return tierTheme(tier).color + (SUBLEVEL_ALPHA[sublevel] || "FF");
}

// Card-accent helpers — an inline style object for the OVR card's tinted background/ring/glow,
// built the same way as the approved mockup (a soft gradient wash + a low-alpha ring, not a flat
// fill) so it reads as the same "accent card" language the rest of BRK already uses, just tinted
// per tier instead of always red.
export function tierCardStyle(tier) {
  const { color } = tierTheme(tier);
  return {
    background: `linear-gradient(180deg, ${color}1A, transparent)`,
    boxShadow: `inset 0 0 0 1px ${color}40`,
  };
}
