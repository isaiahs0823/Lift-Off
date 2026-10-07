import { CATEGORY_WEIGHTS } from "../utils/athleteRating.js";
import { tierTheme } from "../utils/rankTheme.js";

const BRAND_RED = "#D2262E";

const CATEGORY_LABEL = {
  strength: "Strength",
  consistency: "Consistency",
  progression: "Progression",
  recovery: "Recovery",
  trainingQuality: "Training Quality",
  nutrition: "Nutrition",
};

// The one moment this feature gets dramatic (task: "one place the visual design can become
// slightly more dramatic") — but still restrained: a static BRK-red glow card, no confetti, no
// particle effects. Only ever shown right after a recalculation that actually crossed a level or
// a rank (see recalcAthleteRatingState in App.jsx) or on the very first real OVR — never after
// an ordinary workout that didn't move the number.
export default function LevelUpScreen({ event, onDismiss }) {
  if (!event) return null;

  const { type, snapshot } = event;

  // The moment picks up the LANDED tier's color — a rank-up should visibly look different from
  // crossing into a different tier (task: "a rank-up changes what color you are, not just the
  // number next to it"). A same-tier level-up never changed tiers, so it stays BRK's constant
  // red; so does a first rating that's still Provisional (no tier yet to color with).
  const accentTier = type === "rankup" ? event.toRank.tier : type === "first" && snapshot.rank ? snapshot.rank.tier : null;
  const accent = accentTier ? tierTheme(accentTier).color : BRAND_RED;

  // Contributing factors — the categories that actually moved, biggest first, so the athlete can
  // see WHY the number changed (task's closing "they should trust why the number changed").
  const factors =
    type !== "first" && event.priorSnapshot
      ? Object.keys(CATEGORY_WEIGHTS)
          .map((key) => ({ key, delta: snapshot.categories[key]?.delta }))
          .filter((f) => f.delta != null && f.delta !== 0)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 3)
      : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
      <div
        className="w-full max-w-sm bg-gradient-to-b via-v5-bg to-v5-bg border rounded-2xl p-6 text-center space-y-5"
        style={{ backgroundImage: `linear-gradient(to bottom, ${accent}33, #0A0A0B, #0A0A0B)`, borderColor: `${accent}66`, boxShadow: `0 0 60px -10px ${accent}80` }}
      >
        <div className="text-[11px] uppercase tracking-[0.3em] font-bold" style={{ color: accent }}>
          {type === "first" ? "Athlete Rating" : type === "rankup" ? "Rank Up" : "Athlete Rating"}
        </div>
        <div className="text-2xl font-black uppercase tracking-wide text-v5-text">
          {type === "first" ? "Your First Rating Is Ready" : type === "rankup" ? "Rank Up" : "Level Up"}
        </div>

        {type === "first" && (
          <div className="space-y-1">
            <div className="text-5xl font-black text-v5-text tabular-nums">
              {snapshot.ovr}
              {snapshot.rank && (
                <span className="text-base align-middle uppercase tracking-wide ml-2" style={{ color: accent }}>
                  {snapshot.rank.label}
                </span>
              )}
            </div>
            {!snapshot.rank && <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">Provisional</div>}
          </div>
        )}

        {type === "levelup" && (
          <div className="flex items-center justify-center gap-3 text-4xl font-black text-v5-text tabular-nums">
            <span className="text-v5-subtext/60">{event.fromOvr}</span>
            <span style={{ color: accent }}>→</span>
            <span>{event.toOvr}</span>
          </div>
        )}

        {type === "rankup" && (
          <div className="space-y-1">
            <div className="text-base font-black uppercase tracking-wide" style={{ color: tierTheme(event.fromRank.tier).color }}>
              {event.fromRank.label}
            </div>
            <div className="text-lg" style={{ color: accent }}>↓</div>
            <div className="text-xl font-black uppercase tracking-wide" style={{ color: accent }}>
              {event.toRank.label}
            </div>
          </div>
        )}

        {factors.length > 0 && (
          <div className="space-y-1.5 text-left bg-v5-elevated/60 rounded-xl p-3">
            {factors.map((f) => (
              <div key={f.key} className="flex items-center justify-between text-xs">
                <span className="text-v5-subtext">{CATEGORY_LABEL[f.key]}</span>
                <span className={`font-bold ${f.delta > 0 ? "text-v5-success" : "text-v5-red"}`}>
                  {f.delta > 0 ? "+" : ""}
                  {f.delta}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onDismiss}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold rounded-xl bg-v5-red text-white hover:opacity-90"
        >
          Keep Going
        </button>
      </div>
    </div>
  );
}
