import { SlideInPanel } from "./SlideInPanel.jsx";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import { mobilityById, mobilityAnatomyExercise, MOBILITY_TYPE_LABEL } from "../data/mobilityLibrary.js";

function prescriptionLabel(movement) {
  const side = movement.perSide ? " / side" : "";
  if (movement.durationRange) {
    const [lo, hi] = movement.durationRange;
    return `2 × ${lo === hi ? lo : `${lo}–${hi}`} sec${side}`;
  }
  if (movement.repsRange) {
    const [lo, hi] = movement.repsRange;
    return `2 × ${lo}–${hi} reps${side}`;
  }
  return "";
}

// Movement detail — reached by tapping a card in MobilityLibraryScreen (or from a running
// session's "i" if that's ever added). Reuses MuscleBodyOutline exactly as-is (see
// mobilityAnatomyExercise in mobilityLibrary.js) rather than a second anatomy visualization.
export default function MobilityDetailScreen({ movementId, onBack }) {
  const movement = mobilityById(movementId);
  if (!movement) return null;

  return (
    <SlideInPanel title={movement.name} subtitle={`${movement.bodyRegion.join(", ")} · ${MOBILITY_TYPE_LABEL[movement.type]}`} onBack={onBack}>
      <div className="flex items-center gap-4 border border-white/10 bg-v5-elevated p-4">
        <MuscleBodyOutline exercise={mobilityAnatomyExercise(movement)} size="detail" />
        <div>
          <div className="text-lg font-bold text-white">{prescriptionLabel(movement)}</div>
          {movement.equipment && movement.equipment !== "None" && <div className="text-xs text-v5-subtext mt-1">Equipment: {movement.equipment}</div>}
          <div className="text-xs text-v5-subtext/70 mt-1 capitalize">{movement.difficulty}</div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-red mb-2">How to</div>
        <ol className="space-y-1.5">
          {movement.instructions.map((step, i) => (
            <li key={i} className="text-sm text-v5-text/90 flex gap-2">
              <span className="text-v5-subtext/70 shrink-0">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {movement.cues.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext mb-2">Cues</div>
          <ul className="space-y-1.5">
            {movement.cues.map((cue, i) => (
              <li key={i} className="text-sm text-v5-subtext flex gap-2">
                <span className="text-v5-subtext/40 shrink-0">—</span>
                {cue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SlideInPanel>
  );
}
