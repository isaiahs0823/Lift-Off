import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Dumbbell, Play, Plus, Search } from "lucide-react";
import { ScreenHeader, SectionLabel, Card, ListRow, Pill, PhotoHero, ButtonPrimary, ButtonSecondary, ButtonText, EmptyState } from "./ui/Kit.jsx";
import AthleteMuscleMap from "./AthleteMuscleMap.jsx";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import ExerciseInstructionPanel from "./ExerciseInstructionPanel.jsx";
import { getMuscleDisplay } from "../utils/muscleDisplay.js";
import { getEquipmentLabel, getMovementTypeLabel } from "../utils/equipmentDisplay.js";
import { hasInstructionContent } from "../content/exerciseInstructions.js";
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

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold whitespace-nowrap ${
        active ? "bg-v5-red text-white" : "bg-v5-muted text-v5-subtext hover:text-v5-text"
      }`}
    >
      {label}
    </button>
  );
}

// Filters, each honestly backed by real per-exercise data — never a fabricated classification.
// Equipment and movement type come straight from equipmentDisplay.js's name-keyword inference
// (the same function the exercise cards already show a label from). "Guide" is NOT a difficulty
// or beginner-suitability rating BRK's data doesn't have — it's the one real, directly-verifiable
// fact available: whether this exercise has real Setup/Execution/Tips/Mistakes content written
// for it (hasInstructionContent, exerciseInstructions.js). That's still the most useful lens for
// "which movement should a beginner pick" without inventing a difficulty score: an exercise BRK
// can actually walk you through step by step is the easiest one to confidently attempt.
const MOVEMENT_TYPES = ["Compound", "Isolation"];

function ExerciseCard({ exercise, onClick }) {
  const equipment = getEquipmentLabel(exercise);
  const movementType = getMovementTypeLabel(exercise);
  const hasGuide = hasInstructionContent(exercise.id);
  return (
    <Card onClick={onClick} className="flex items-center gap-3">
      <MuscleBodyOutline exercise={exercise} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="text-sm font-bold text-v5-text truncate min-w-0">{exercise.name}</div>
          {/* Honest "has real How To / Tips / Mistakes content" signal, right on the card — not
              a beginner/difficulty rating BRK's data doesn't have (see this file's top comment),
              but the most useful real signal for "which movement can I confidently attempt". */}
          {hasGuide && <BookOpen size={12} className="shrink-0 text-v5-red" aria-label="Has instructions" />}
        </div>
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
  const [equipmentFilter, setEquipmentFilter] = useState("All");
  const [movementFilter, setMovementFilter] = useState("All");
  const [guideFilter, setGuideFilter] = useState(false);

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
    setEquipmentFilter("All");
    setMovementFilter("All");
    setGuideFilter(false);
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
      <div className="space-y-4">
        <button onClick={() => setView("exercises")} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
          <ChevronLeft size={20} />
        </button>

        {/* PhotoHero (same component the active-workout logger and Today's workout cards already
            use for an exercise's visual area) replaces the old small icon-plus-pills row — a
            denser, more premium single block instead of a thin anatomy thumbnail next to mostly
            empty space, and the selected muscle/exercise title are still right there as its
            eyebrow/title. Equipment and movement-type (both honest, never fabricated — see
            equipmentDisplay.js) sit in its meta slot. */}
        <PhotoHero
          exercise={exercise}
          icon={Dumbbell}
          eyebrow={ZONE_LABEL[zone] || "Exercise"}
          title={exercise.name}
          meta={
            <div className="flex items-center gap-2 flex-wrap">
              <Pill tone="inactive" className="truncate max-w-[180px]">
                {equipment || "Not specified"}
              </Pill>
              {movementType && (
                <Pill tone="outline" className="truncate max-w-[140px]">
                  {movementType}
                </Pill>
              )}
            </div>
          }
        />

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

    // Equipment options are built live from what's actually present in this muscle's exercise
    // list — never a fixed invented list, and never offering a choice that would filter to zero
    // results. "Not specified" only appears as its own filter option when at least one exercise
    // in this zone genuinely has no recognizable equipment keyword in its name.
    const equipmentOptions = Array.from(
      new Set(exercises.map((ex) => getEquipmentLabel(ex) || "Not specified"))
    ).sort();

    const filteredExercises = exercises.filter((ex) => {
      const equipment = getEquipmentLabel(ex) || "Not specified";
      if (equipmentFilter !== "All" && equipment !== equipmentFilter) return false;
      if (movementFilter !== "All" && getMovementTypeLabel(ex) !== movementFilter) return false;
      if (guideFilter && !hasInstructionContent(ex.id)) return false;
      return true;
    });

    const filtersActive = equipmentFilter !== "All" || movementFilter !== "All" || guideFilter;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("muscles")} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <ScreenHeader eyebrow="Exercise Discovery" title={ZONE_LABEL[zone]} />
        </div>

        {exercises.length > 0 && (
          <div className="space-y-2">
            {equipmentOptions.length > 1 && (
              // Contained horizontal scroll, not an edge-to-edge bleed (-mx/px trick) — that
              // combination measured 2px wider than the viewport at 375/390/430px (a sub-pixel
              // rounding gap between the negative margin and matching padding), which is enough
              // to trip document-level horizontal scroll. Same plain pattern already used
              // elsewhere in the app (ExerciseHistorySheet, MobilityLibraryScreen) with no issue.
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
                <FilterChip label="All Equipment" active={equipmentFilter === "All"} onClick={() => setEquipmentFilter("All")} />
                {equipmentOptions.map((opt) => (
                  <FilterChip key={opt} label={opt} active={equipmentFilter === opt} onClick={() => setEquipmentFilter(opt)} />
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterChip label="All Types" active={movementFilter === "All"} onClick={() => setMovementFilter("All")} />
              {MOVEMENT_TYPES.map((t) => (
                <FilterChip key={t} label={t} active={movementFilter === t} onClick={() => setMovementFilter(t)} />
              ))}
              {/* "Has Guide" — never framed as "Beginner" or "Easy": BRK's exercise data has no
                  difficulty rating, so this filters on the one real, verifiable fact available —
                  whether real Setup/Execution/Tips/Mistakes content exists for an exercise (see
                  this file's FilterChip comment). Still the most useful lens for "which movement
                  should I pick" without inventing a classification. */}
              <FilterChip
                label={guideFilter ? "✓ Has Guide" : "Has Guide"}
                active={guideFilter}
                onClick={() => setGuideFilter((g) => !g)}
              />
            </div>
          </div>
        )}

        {exercises.length === 0 ? (
          <EmptyState icon={Search} title="No exercises for this muscle yet" body="Try a different muscle group." />
        ) : filteredExercises.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No exercises match these filters"
            body="Try a different equipment, movement type, or guide filter."
            action={
              filtersActive && (
                <ButtonText
                  onClick={() => {
                    setEquipmentFilter("All");
                    setMovementFilter("All");
                    setGuideFilter(false);
                  }}
                >
                  Clear filters
                </ButtonText>
              )
            }
          />
        ) : (
          <div className="space-y-2">
            {filteredExercises.map((ex) => (
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
