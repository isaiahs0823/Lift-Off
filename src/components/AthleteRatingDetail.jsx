import { useMemo } from "react";
import { ChevronLeft, Dumbbell, CalendarCheck, TrendingUp, Moon, Award, Utensils } from "lucide-react";
import { ScreenHeader, Card, SectionLabel, ProgressBar } from "./ui/Kit.jsx";
import { explainCategory, CONFIDENCE } from "../utils/athleteRating.js";
import { tierTheme, tierCardStyle } from "../utils/rankTheme.js";
import RankLadder from "./RankLadder.jsx";

const CATEGORY_META = {
  strength: { label: "Strength", icon: Dumbbell },
  consistency: { label: "Consistency", icon: CalendarCheck },
  progression: { label: "Progression", icon: TrendingUp },
  recovery: { label: "Recovery", icon: Moon },
  trainingQuality: { label: "Training Quality", icon: Award },
  nutrition: { label: "Nutrition", icon: Utensils },
};
const CATEGORY_ORDER = ["strength", "consistency", "progression", "recovery", "trainingQuality", "nutrition"];

function CategoryRow({ categoryKey, data }) {
  const meta = CATEGORY_META[categoryKey];
  const Icon = meta.icon;
  const isRated = data.score != null;
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 w-8 h-8 rounded-full bg-v5-elevated flex items-center justify-center">
          <Icon size={15} className="text-v5-subtext" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-v5-text">{meta.label}</div>
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
          <span className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold shrink-0">
            {data.confidence === CONFIDENCE.INSUFFICIENT ? "Establishing baseline" : "—"}
          </span>
        )}
      </div>
      {isRated && <ProgressBar pct={data.score} />}
      <p className="text-[11px] text-v5-subtext leading-relaxed">{explainCategory(categoryKey, data)}</p>
    </Card>
  );
}

// Tapping the Athlete Rating card opens this — every category's score/trend/explanation, plus
// confidence/baseline state where evidence isn't there yet (spec: "every score should eventually
// answer: why is this my score?").
const EMPTY_CATEGORY = { score: null, confidence: CONFIDENCE.INSUFFICIENT, evidenceCount: 0 };

export default function AthleteRatingDetail({ snapshot, onBack }) {
  // snapshot is null for an athlete who hasn't finished a single workout yet (no recalculation
  // has ever run) — every category falls back to its own honest "establishing baseline" state
  // rather than this screen crashing or showing nothing.
  const ovr = snapshot?.ovr ?? null;
  const rank = snapshot?.rank ?? null;
  const ovrConfidence = snapshot?.ovrConfidence ?? CONFIDENCE.INSUFFICIENT;
  const categories = snapshot?.categories ?? Object.fromEntries(CATEGORY_ORDER.map((k) => [k, EMPTY_CATEGORY]));

  const qualifiedCount = useMemo(() => CATEGORY_ORDER.filter((k) => categories[k].score != null).length, [categories]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <ScreenHeader eyebrow="Athlete Rating" title="Rating breakdown" />
      </div>

      {ovr != null ? (
        <Card tone={rank ? "default" : "accent"} style={rank ? tierCardStyle(rank.tier) : undefined} className="text-center space-y-3 py-5">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">OVR</span>
              <span className="text-5xl font-black text-v5-text tabular-nums">{ovr}</span>
            </div>
            {rank ? (
              <div className="text-sm font-black uppercase tracking-wide" style={{ color: tierTheme(rank.tier).color }}>
                {rank.label}
              </div>
            ) : (
              <div className="text-sm font-black uppercase tracking-wide text-v5-subtext">Provisional</div>
            )}
            <div className="text-[11px] text-v5-subtext">
              {rank ? (
                <>
                  Based on {qualifiedCount} of 6 rating categories
                  {ovrConfidence === CONFIDENCE.LOW ? " — still establishing confidence" : ""}
                </>
              ) : (
                "A real first read on limited evidence — Rank unlocks with a bit more training data."
              )}
            </div>
          </div>
          {rank && <RankLadder currentTier={rank.tier} />}
        </Card>
      ) : (
        <Card className="text-center space-y-1 py-5">
          <div className="text-lg font-black text-v5-text">Establishing baseline</div>
          <p className="text-xs text-v5-subtext">Keep training — BRK needs a bit more comparable evidence before issuing a real OVR.</p>
        </Card>
      )}

      <div>
        <SectionLabel tone="muted" className="mb-2">
          Rating Breakdown
        </SectionLabel>
        <div className="space-y-2">
          {CATEGORY_ORDER.map((key) => (
            <CategoryRow key={key} categoryKey={key} data={categories[key]} />
          ))}
        </div>
      </div>
    </div>
  );
}
