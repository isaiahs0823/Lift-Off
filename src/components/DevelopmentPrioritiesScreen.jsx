import { useState } from "react";
import { ChevronDown, ChevronUp, Check } from "lucide-react";
import {
  MUSCLE_GROUPS,
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_LABEL,
  PRIORITY_LEVEL_EXPLANATION,
  groupedPriorities,
  moveMuscleToLevel,
  reorderMuscleBefore,
  sanitizeDevelopmentPriorities,
} from "../utils/developmentPriorities.js";

const LEVEL_ACCENT = {
  prioritize: "border-v5-red bg-v5-red/10",
  develop: "border-white/10 bg-v5-elevated",
  maintain: "border-white/10 bg-v5-elevated",
};

function HowPrioritiesWork() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 bg-v5-elevated">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-xs uppercase tracking-widest text-v5-subtext font-bold">How priorities work</span>
        {open ? <ChevronUp size={16} className="text-v5-subtext" /> : <ChevronDown size={16} className="text-v5-subtext" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
          {PRIORITY_LEVELS.map((level) => (
            <div key={level}>
              <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold">{PRIORITY_LEVEL_LABEL[level]}</div>
              <p className="text-sm text-v5-subtext mt-0.5">{PRIORITY_LEVEL_EXPLANATION[level]}</p>
            </div>
          ))}
          <p className="text-xs text-v5-subtext/70 pt-1 border-t border-white/[0.06]">
            Priorities inform Coach and future adaptive suggestions — your readiness and recovery still come first. Curated BRK programs are never rewritten
            automatically because of a priority.
          </p>
        </div>
      )}
    </div>
  );
}

// One muscle row: a tap-to-select "moving" state (highlighted) implements reordering within a
// section — tap another row in the same section to drop the moving muscle there, or tap the
// section's "place at end" strip. A separate small tier chip moves the muscle between sections.
// Deliberately not drag-and-drop and not up/down arrows — an original, touch-safe BRK gesture.
function MuscleRow({ muscleId, label, isMoving, onTapRow, onPickLevel, showLevelPicker, onToggleLevelPicker, currentLevel }) {
  return (
    <div className={`border ${isMoving ? "border-v5-red bg-v5-red/20" : "border-white/10 bg-v5-surface"}`}>
      <button onClick={() => onTapRow(muscleId)} className="w-full flex items-center justify-between px-3 py-3 text-left">
        <span className="text-sm text-v5-text flex items-center gap-2">
          {isMoving && <Check size={14} className="text-v5-red shrink-0" />}
          {label}
        </span>
        {isMoving && <span className="text-[11px] uppercase tracking-widest text-v5-red">Tap a spot to place</span>}
      </button>
      <div className="px-3 pb-2.5 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLevelPicker(muscleId);
          }}
          className="px-2 py-1 text-[11px] uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40"
        >
          {PRIORITY_LEVEL_LABEL[currentLevel]} ▾
        </button>
        {showLevelPicker &&
          PRIORITY_LEVELS.filter((l) => l !== currentLevel).map((l) => (
            <button
              key={l}
              onClick={(e) => {
                e.stopPropagation();
                onPickLevel(muscleId, l);
              }}
              className="px-2 py-1 text-[11px] uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30"
            >
              Move to {PRIORITY_LEVEL_LABEL[l]}
            </button>
          ))}
      </div>
    </div>
  );
}

function Section({ level, muscleIds, movingId, movingLevel, levelPickerFor, onTapRow, onPickLevel, onToggleLevelPicker, onPlaceAtEnd }) {
  return (
    <div className={`border p-3 space-y-2 ${LEVEL_ACCENT[level]}`}>
      <div className="text-[11px] uppercase tracking-widest text-v5-subtext font-bold">{PRIORITY_LEVEL_LABEL[level]}</div>
      {muscleIds.length === 0 ? (
        <div className="text-xs text-v5-subtext/70 py-2">No muscles here yet.</div>
      ) : (
        <div className="space-y-1.5">
          {muscleIds.map((id) => (
            <MuscleRow
              key={id}
              muscleId={id}
              label={MUSCLE_GROUPS.find((m) => m.id === id)?.label || id}
              currentLevel={level}
              isMoving={movingId === id}
              showLevelPicker={levelPickerFor === id}
              onTapRow={onTapRow}
              onPickLevel={onPickLevel}
              onToggleLevelPicker={onToggleLevelPicker}
            />
          ))}
        </div>
      )}
      {movingId && movingLevel === level && (
        <button
          onClick={() => onPlaceAtEnd(level)}
          className="w-full py-2 text-[11px] uppercase tracking-widest text-v5-subtext/70 border border-dashed border-white/10 hover:border-v5-red/40 hover:text-v5-subtext"
        >
          Place at end of {PRIORITY_LEVEL_LABEL[level]}
        </button>
      )}
    </div>
  );
}

export default function DevelopmentPrioritiesScreen({ state, updateState, onBack }) {
  const priorities = sanitizeDevelopmentPriorities(state.developmentPriorities);
  const grouped = groupedPriorities(priorities);
  const [movingId, setMovingId] = useState(null);
  const [levelPickerFor, setLevelPickerFor] = useState(null);

  const save = (next) => updateState((prev) => ({ ...prev, developmentPriorities: next }));

  const tapRow = (muscleId) => {
    setLevelPickerFor(null);
    if (movingId === muscleId) {
      setMovingId(null);
      return;
    }
    if (movingId) {
      // A second tap while a row is already selected: place the moving muscle immediately
      // before the tapped one, but only if they're in the same section (dropping across
      // sections is the tier chip's job, not this gesture's).
      if (priorities[movingId].level === priorities[muscleId].level) {
        save(reorderMuscleBefore(priorities, movingId, muscleId));
      }
      setMovingId(null);
      return;
    }
    setMovingId(muscleId);
  };

  const placeAtEnd = (level) => {
    if (!movingId) return;
    if (priorities[movingId].level === level) {
      save(reorderMuscleBefore(priorities, movingId, null));
    }
    setMovingId(null);
  };

  const pickLevel = (muscleId, level) => {
    save(moveMuscleToLevel(priorities, muscleId, level));
    setLevelPickerFor(null);
    setMovingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Coach</div>
          <div className="text-xl font-bold text-white mt-1">Development Priorities</div>
        </div>
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        )}
      </div>
      <p className="text-sm text-v5-subtext">Tell BRK which muscle groups matter most to you. Coach factors this in — your programs are never rewritten automatically.</p>

      <HowPrioritiesWork />

      {PRIORITY_LEVELS.map((level) => (
        <Section
          key={level}
          level={level}
          muscleIds={grouped[level]}
          movingId={movingId}
          movingLevel={movingId ? priorities[movingId]?.level : null}
          levelPickerFor={levelPickerFor}
          onTapRow={tapRow}
          onPickLevel={pickLevel}
          onToggleLevelPicker={(id) => setLevelPickerFor((cur) => (cur === id ? null : id))}
          onPlaceAtEnd={placeAtEnd}
        />
      ))}
    </div>
  );
}
