import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScreenHeader, Card, SectionLabel } from "./ui/Kit.jsx";
import AthleteMuscleMap from "./AthleteMuscleMap.jsx";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABEL, CONFIDENCE } from "../utils/athleteRating.js";

function MuscleCard({ group, data, onClick }) {
  const label = MUSCLE_GROUP_LABEL[group];
  const isRated = data?.score != null;
  return (
    <Card onClick={onClick} className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs font-bold text-v5-text">{label}</div>
        {isRated ? (
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-v5-text tabular-nums">{data.score}</span>
            {data.delta != null && data.delta !== 0 && (
              <span className={`text-[10px] font-bold ${data.delta > 0 ? "text-v5-success" : "text-v5-red"}`}>
                {data.delta > 0 ? "↑" : "↓"}
                {Math.abs(data.delta)}
              </span>
            )}
          </div>
        ) : (
          <div className="text-[10px] uppercase tracking-wide text-v5-subtext">
            {data?.confidence === CONFIDENCE.INSUFFICIENT ? "Establishing baseline" : "—"}
          </div>
        )}
      </div>
      <ChevronRight size={14} className="text-v5-subtext/60 shrink-0" />
    </Card>
  );
}

// Front/back anatomy, colored by muscle performance-development rating, with the 8-group grid
// underneath for a textual equivalent of the same data (accessibility — color is never the only
// signal; see task's accessibility section). Tapping either the figure or a card opens
// MuscleDetailScreen for that group.
export default function MuscleMapScreen({ snapshot, onBack, onSelectMuscle }) {
  const [view, setView] = useState("front");
  const muscles = snapshot?.muscles || {};

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <ScreenHeader eyebrow="Progress" title="Muscle Map" />
      </div>

      <div className="flex justify-center gap-1.5">
        {["front", "back"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold ${
              view === v ? "bg-v5-red text-white" : "bg-v5-muted text-v5-subtext hover:text-v5-text"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <AthleteMuscleMap ratings={muscles} view={view} onSelectZone={onSelectMuscle} width={200} />
      </div>

      <div>
        <SectionLabel tone="muted" className="mb-2">
          Muscle Performance
        </SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {MUSCLE_GROUPS.map((group) => (
            <MuscleCard key={group} group={group} data={muscles[group]} onClick={() => onSelectMuscle(group)} />
          ))}
        </div>
      </div>
    </div>
  );
}
