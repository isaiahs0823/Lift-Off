import { Dumbbell, CalendarCheck, Moon, Award, Utensils, ChevronLeft } from "lucide-react";
import { ScreenHeader, Card, SectionLabel, ProgressBar } from "./ui/Kit.jsx";
import { CONFIDENCE, explainFoundation, explainBonus } from "../utils/athleteRating.js";
import { tierTheme, tierCardStyle } from "../utils/rankTheme.js";
import RankLadder from "./RankLadder.jsx";

// v5-success — reused directly (not re-exported from Kit.jsx) so a bonus row's progress fill
// reads as a distinctly different, restrained-green signal from the Foundation row's red one,
// matching the task's "restrained green for positive changes" visual direction.
const BONUS_GREEN = "#29C17E";

const BONUS_META = {
  consistency: { label: "Consistency", icon: CalendarCheck },
  trainingQuality: { label: "Training Quality", icon: Award },
  recovery: { label: "Recovery", icon: Moon },
  nutrition: { label: "Nutrition", icon: Utensils },
};
const BONUS_ORDER = ["consistency", "trainingQuality", "recovery", "nutrition"];
const EMPTY_BONUS = { points: 0, max: 0, earned: false, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0 };

function FoundationRow({ data }) {
  const isRated = data.score != null;
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 w-8 h-8 rounded-full bg-v5-elevated flex items-center justify-center">
          <Dumbbell size={15} className="text-v5-subtext" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-v5-text">Lifting Foundation</div>
        </div>
        {isRated ? (
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-xl font-black text-v5-text tabular-nums">{data.score}</span>
            {data.delta != null && data.delta !== 0 && (
              <span className={`text-[11px] font-bold ${data.delta > 0 ? "text-v5-success" : "text-v5-red"}`}>
                {data.delta > 0 ? "↑" : "↓"}
                {Math.abs(data.delta)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold shrink-0">Establishing baseline</span>
        )}
      </div>
      {isRated && <ProgressBar pct={data.score} />}
      <p className="text-[11px] text-v5-subtext leading-relaxed">{explainFoundation(data)}</p>
    </Card>
  );
}

function BonusRow({ bonusKey, data }) {
  const meta = BONUS_META[bonusKey];
  const Icon = meta.icon;
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 w-8 h-8 rounded-full bg-v5-elevated flex items-center justify-center">
          <Icon size={15} className="text-v5-subtext" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-v5-text">{meta.label} Bonus</div>
        </div>
        {data.earned ? (
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-lg font-black text-v5-success tabular-nums">+{data.points}</span>
            <span className="text-[10px] text-v5-subtext">/{data.max}</span>
          </div>
        ) : (
          <span className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold shrink-0">Not logged</span>
        )}
      </div>
      {data.earned && <ProgressBar pct={(data.points / data.max) * 100} color={BONUS_GREEN} />}
      <p className="text-[11px] text-v5-subtext leading-relaxed">{explainBonus(bonusKey, data)}</p>
    </Card>
  );
}

// Tapping the Athlete Rating card opens this — the full "WHY THIS RATING?" breakdown: Lifting
// Foundation (the core, always shown first) plus each of the four earned bonuses, ending in the
// same TOTAL the OVR card shows up top. snapshot is null for an athlete who hasn't finished a
// single workout yet — every row falls back to its own honest "establishing baseline"/"not
// logged" state rather than this screen crashing or showing nothing.
export default function AthleteRatingDetail({ snapshot, onBack }) {
  const ovr = snapshot?.ovr ?? null;
  const rank = snapshot?.rank ?? null;
  const ovrTier = snapshot?.ovrTier ?? "establishing_baseline";
  const foundation = snapshot?.foundation ?? { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0, exercisesTracked: 0 };
  const bonuses = snapshot?.bonuses ?? Object.fromEntries(BONUS_ORDER.map((k) => [k, EMPTY_BONUS]));
  const isProvisional = ovrTier === "provisional";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <ScreenHeader eyebrow="Athlete Rating" title="Rating breakdown" />
      </div>

      {ovr != null ? (
        // rank is guaranteed non-null whenever ovr is non-null (task: "do not show rank as
        // Calibrating when the athlete has a valid provisional or established OVR") — Provisional
        // is now a small tag ALONGSIDE the real rank, never a replacement for it.
        <Card tone="default" style={tierCardStyle(rank.tier)} className="text-center space-y-3 py-5">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">OVR</span>
              <span className="text-5xl font-black text-v5-text tabular-nums">{ovr}</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="text-sm font-black uppercase tracking-wide" style={{ color: tierTheme(rank.tier).color }}>
                {rank.label}
              </div>
              {isProvisional && (
                <span className="text-[9px] uppercase tracking-widest font-bold text-v5-subtext border border-white/15 rounded-full px-1.5 py-0.5">
                  Provisional
                </span>
              )}
            </div>
            <div className="text-[11px] text-v5-subtext">
              {isProvisional
                ? "A real rating on limited evidence — it firms up as more comparable training data comes in."
                : "Lifting Foundation plus earned bonuses."}
            </div>
          </div>
          <RankLadder currentTier={rank.tier} />
        </Card>
      ) : (
        <Card className="text-center space-y-1 py-5">
          <div className="text-lg font-black text-v5-text">Establishing baseline</div>
          <p className="text-xs text-v5-subtext">Log one completed workout to get your first rating — that's all BRK needs to start.</p>
        </Card>
      )}

      <div>
        <SectionLabel tone="muted" className="mb-2">
          Why this rating?
        </SectionLabel>
        <div className="space-y-2">
          <FoundationRow data={foundation} />
          {BONUS_ORDER.map((key) => (
            <BonusRow key={key} bonusKey={key} data={bonuses[key] || EMPTY_BONUS} />
          ))}
          {ovr != null && (
            <Card className="flex items-center justify-between py-3">
              <span className="text-xs uppercase tracking-widest font-bold text-v5-subtext">Total</span>
              <span className="text-xl font-black text-v5-text tabular-nums">{ovr}</span>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
