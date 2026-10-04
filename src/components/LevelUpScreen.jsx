import { CATEGORY_WEIGHTS } from "../utils/athleteRating.js";

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
      <div className="w-full max-w-sm bg-gradient-to-b from-v5-red/20 via-v5-bg to-v5-bg border border-v5-red/40 rounded-2xl p-6 text-center space-y-5 shadow-[0_0_60px_-10px_rgba(210,38,46,0.5)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-v5-red font-bold">
          {type === "first" ? "Athlete Rating" : type === "rankup" ? "Rank Up" : "Athlete Rating"}
        </div>
        <div className="text-2xl font-black uppercase tracking-wide text-v5-text">
          {type === "first" ? "Your First Rating Is Ready" : type === "rankup" ? "Rank Up" : "Level Up"}
        </div>

        {type === "first" && (
          <div className="text-5xl font-black text-v5-text tabular-nums">
            {snapshot.ovr} <span className="text-base align-middle text-v5-red uppercase tracking-wide">{snapshot.rank.label}</span>
          </div>
        )}

        {type === "levelup" && (
          <div className="flex items-center justify-center gap-3 text-4xl font-black text-v5-text tabular-nums">
            <span className="text-v5-subtext/60">{event.fromOvr}</span>
            <span className="text-v5-red">→</span>
            <span>{event.toOvr}</span>
          </div>
        )}

        {type === "rankup" && (
          <div className="space-y-1">
            <div className="text-base font-black uppercase tracking-wide text-v5-subtext">{event.fromRank.label}</div>
            <div className="text-v5-red text-lg">↓</div>
            <div className="text-xl font-black uppercase tracking-wide text-v5-text">{event.toRank.label}</div>
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
