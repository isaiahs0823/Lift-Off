import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Play, Plus, Search } from "lucide-react";
import { ScreenHeader, SectionLabel, Card, ListRow, Pill, ButtonPrimary, ButtonSecondary, ButtonText, EmptyState } from "./ui/Kit.jsx";
import AthleteMuscleMap from "./AthleteMuscleMap.jsx";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import ExerciseInstructionPanel from "./ExerciseInstructionPanel.jsx";
import { getMuscleDisplay } from "../utils/muscleDisplay.js";
import { getEquipmentLabel, getMovementTypeLabel } from "../utils/equipmentDisplay.js";
import { selectableExercises } from "../utils/customExercises.js";
import { FRONT_ZONE_SLUGS, BACK_ZONE_SLUGS } from "../assets/anatomyData.js";

// Every real anatomical zone the shared anatomy artwork actually draws (src/assets/anatomyData.js
// — the same data AthleteMuscleMap/MuscleBodyOutline already use everywhere else in BRK). Not a
// new taxonomy: these are exactly the zone keys getMuscleDisplay already resolves real exercises
// to (see utils/muscleDisplay.js), so "tap Shoulders, see shoulder exercises" is driven by the
// same mapping already shipping in the active-workout logger's instruction panel and exercise
// cards — never a second, invented muscle system.
const ZONES = ["chest", "back", "shoulders", "biceps", "triceps", "forearms", "abs", "quads", "hamstrings", "glutes", "calves"];
const ZONE_LABEL = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
};
// A zone that only ever appears on one side of the shared anatomy artwork auto-switches the
// diagram to that side when selected (from the diagram itself or the text grid below it), so the
// highlight is always visible rather than silently doing nothing on the "wrong" view. A zone
// drawn on both sides (shoulders, triceps, forearms, calves) leaves whatever view the athlete is
// already looking at alone. Computed from the real zone-slug data, not hand-guessed.
const ZONE_ONLY_VIEW = Object.fromEntries(
  ZONES.map((zone) => {
    const front = (FRONT_ZONE_SLUGS[zone] || []).length > 0;
    const back = (BACK_ZONE_SLUGS[zone] || []).length > 0;
    if (front && !back) return [zone, "front"];
    if (back && !front) return [zone, "back"];
    return [zone, null];
  })
);

function ZoneButton({ zone, count, onClick }) {
  return (
    <Card onClick={onClick} className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-xs font-bold text-v5-text">{ZONE_LABEL[zone]}</div>
        <div className="text-[10px] uppercase tracking-wide text-v5-subtext">
          {count} exercise{count === 1 ? "" : "s"}
        </div>
      </div>
      <ChevronRight size={14} className="text-v5-subtext/60 shrink-0" />
    </Card>
  );
}

function ExerciseCard({ exercise, onClick }) {
  const equipment = getEquipmentLabel(exercise);
  const movementType = getMovementTypeLabel(exercise);
  return (
    <Card onClick={onClick} className="flex items-center gap-3">
      <MuscleBodyOutline exercise={exercise} size={44} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-v5-text truncate">{exercise.name}</div>
        {/* Pill (Kit.jsx) has no built-in max-width — a long single pill like the honest
            "Not specified" fallback could otherwise force this row (and the whole card) wider
            than a narrow phone viewport. A percentage max-width doesn't reliably resolve here
            (this row sits inside a shrink-to-fit flex chain with no definite width to resolve
            the percentage against), so a fixed pixel cap is used instead — it clips reliably
            regardless of the row's own computed width. truncate+max-w keeps every pill inside
            the card at any viewport width rather than touching Pill globally. */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Pill tone="inactive" className="truncate max-w-[150px]">
            {equipment || "Not specified"}
          </Pill>
          {movementType && (
            <Pill tone="outline" className="truncate max-w-[100px]">
              {movementType}
            </Pill>
          )}
        </div>
      </div>
      <ChevronRight size={14} className="text-v5-subtext/60 shrink-0" />
    </Card>
  );
}

// Exercise Discovery (Train -> Find Exercises): tap a muscle on the shared interactive anatomy
// figure, or its text-button equivalent below it, browse the real exercise catalog filtered to
// that muscle, open a beginner-friendly exercise card (equipment + movement type, both honestly
// derived from the exercise's own data — never fabricated — see equipmentDisplay.js), reuse the
// exact same How To / Tips / Muscles panel the active-workout logger already shows, then either
// Start Quick Workout or Add to Current Workout using the SAME startRun/addRunExercise engine
// every other entry point in BRK uses — no second workout engine.
//
// Accessibility: the diagram's SVG zones are a visual affordance only (tap/click, no keyboard
// focus or screen-reader name — the same limitation Progress's existing Muscle Map has). The real
// accessible, keyboard-operable equivalent is the full text-button grid rendered right below it,
// covering the identical 11 zones — same pattern MuscleMapScreen already established ("a textual
// equivalent of the same data — color/shape is never the only signal").
export default function ExerciseDiscoveryScreen({ allExercises, exMap, activeRun, onBack, onStartRun, onAddToActiveRun }) {
  const [view, setView] = useState("muscles"); // "muscles" | "exercises" | "detail"
  const [zone, setZone] = useState(null);
  const [exId, setExId] = useState(null);
  const [diagramSide, setDiagramSide] = useState("front");

  const catalog = useMemo(() => selectableExercises(allExercises), [allExercises]);

  const exercisesByZone = useMemo(() => {
    const map = {};
    ZONES.forEach((z) => (map[z] = []));
    catalog.forEach((ex) => {
      const { zone: z } = getMuscleDisplay(ex);
      if (map[z]) map[z].push(ex);
    });
    return map;
  }, [catalog]);

  const hasActiveRun = !!(activeRun && !activeRun.finished);

  function selectZone(z) {
    setZone(z);
    if (ZONE_ONLY_VIEW[z]) setDiagramSide(ZONE_ONLY_VIEW[z]);
    setView("exercises");
  }

  function selectExercise(id) {
    setExId(id);
    setView("detail");
  }

  function startQuickWorkout(exercise) {
    onStartRun({ name: `${exercise.name} — Quick Workout`, exercises: [{ exId: exercise.id, sets: 3 }] });
  }

  if (view === "detail" && exId) {
    const exercise = exMap[exId];
    if (!exercise) {
      setView("exercises");
      return null;
    }
    const equipment = getEquipmentLabel(exercise);
    const movementType = getMovementTypeLabel(exercise);
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("exercises")} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <ScreenHeader eyebrow={ZONE_LABEL[zone] || "Exercise"} title={exercise.name} className="min-w-0" />
        </div>

        <div className="flex items-center gap-4">
          <MuscleBodyOutline exercise={exercise} size="detail" />
          <div className="flex flex-col gap-1.5 min-w-0">
            <Pill tone="inactive" className="truncate max-w-[220px]">
              {equipment || "Not specified"}
            </Pill>
            {movementType && (
              <Pill tone="outline" className="truncate max-w-[220px]">
                {movementType}
              </Pill>
            )}
          </div>
        </div>

        <ExerciseInstructionPanel exId={exercise.id} exerciseName={exercise.name} muscle={exercise.muscle} />

        <div className="space-y-2 pt-1">
          <ButtonPrimary size="lg" icon={Play} onClick={() => startQuickWorkout(exercise)}>
            Start Quick Workout
          </ButtonPrimary>
          {hasActiveRun ? (
            <ButtonSecondary
              size="lg"
              icon={Plus}
              onClick={() => {
                onAddToActiveRun(exercise.id);
                onBack();
              }}
            >
              Add to Current Workout
            </ButtonSecondary>
          ) : (
            <ButtonText tone="muted" className="w-full py-1 justify-center">
              Start a workout to add this exercise to it instead
            </ButtonText>
          )}
        </div>
      </div>
    );
  }

  if (view === "exercises" && zone) {
    const exercises = exercisesByZone[zone] || [];
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("muscles")} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <ScreenHeader eyebrow="Exercise Discovery" title={ZONE_LABEL[zone]} />
        </div>
        {exercises.length === 0 ? (
          <EmptyState icon={Search} title="No exercises for this muscle yet" body="Try a different muscle group." />
        ) : (
          <div className="space-y-2">
            {exercises.map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} onClick={() => selectExercise(ex.id)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
          <ChevronLeft size={20} />
        </button>
        <ScreenHeader eyebrow="Train" title="Find Exercises" subtitle="Tap a muscle to browse exercises for it." />
      </div>

      <div className="flex justify-center gap-1.5">
        {["front", "back"].map((v) => (
          <button
            key={v}
            onClick={() => setDiagramSide(v)}
            className={`px-4 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold ${
              diagramSide === v ? "bg-v5-red text-white" : "bg-v5-muted text-v5-subtext hover:text-v5-text"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <AthleteMuscleMap mode="zones" view={diagramSide} selected={zone} onSelectZone={selectZone} width={200} />
      </div>

      <div>
        <SectionLabel tone="muted" className="mb-2">
          Select a Muscle
        </SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {ZONES.map((z) => (
            <ZoneButton key={z} zone={z} count={(exercisesByZone[z] || []).length} onClick={() => selectZone(z)} />
          ))}
        </div>
      </div>
    </div>
  );
}
