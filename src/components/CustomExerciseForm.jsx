import React, { useState } from "react";
import { Check, AlertTriangle, Archive, RotateCcw, Trash2 } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import {
  EQUIPMENT_TYPES,
  MOVEMENT_CATEGORIES,
  inferExerciseType,
  generateCustomExerciseId,
  findDuplicateExercise,
  isExerciseUsedAnywhere,
} from "../utils/customExercises.js";

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs border ${
        active ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}

// Shared create/edit screen for custom exercises — every exercise picker in the app (workout
// builder, program builder, swap, standalone logger, catalog) opens this same component rather
// than each rolling its own form. `exercise` present = edit mode (id and createdAt are locked,
// never regenerated); absent = create mode. `onSaved(exId)` fires after a genuine save so the
// caller can immediately select/return the exercise into whatever picker flow opened this.
export default function CustomExerciseForm({
  state,
  updateState,
  allExercises,
  muscleGroups,
  exercise = null,
  onBack,
  onSaved,
}) {
  const isEdit = !!exercise;
  const [name, setName] = useState(exercise?.name || "");
  const [muscle, setMuscle] = useState(exercise?.muscle || muscleGroups[0]);
  const [secondaryMuscles, setSecondaryMuscles] = useState(exercise?.secondaryMuscles || []);
  const [equipment, setEquipment] = useState(exercise?.equipment || "");
  const [movementCategory, setMovementCategory] = useState(exercise?.movementCategory || "");
  const [brand, setBrand] = useState(exercise?.brand || "");
  const [notes, setNotes] = useState(exercise?.notes || "");
  const [dupWarning, setDupWarning] = useState(null); // the existing exercise a name collided with
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !!muscle && !!equipment;

  const toggleSecondary = (m) => {
    if (m === muscle) return; // primary can't also be a secondary
    setSecondaryMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const buildPayload = (id, createdAt) => ({
    id,
    name: trimmedName,
    muscle,
    secondaryMuscles,
    equipment,
    movementCategory: movementCategory || "",
    brand: brand.trim(),
    notes: notes.trim(),
    type: inferExerciseType(movementCategory),
    custom: true,
    archived: exercise?.archived || false,
    createdAt,
  });

  const doSave = () => {
    if (!canSave) return;
    if (isEdit) {
      updateState((prev) => ({
        ...prev,
        customExercises: (prev.customExercises || []).map((e) =>
          e.id === exercise.id ? buildPayload(exercise.id, exercise.createdAt) : e
        ),
      }));
      onSaved?.(exercise.id);
      return;
    }
    const id = generateCustomExerciseId();
    const entry = buildPayload(id, new Date().toISOString());
    updateState((prev) => ({ ...prev, customExercises: [...(prev.customExercises || []), entry] }));
    onSaved?.(id);
  };

  const handleSaveClick = () => {
    if (!canSave) return;
    if (!isEdit) {
      const dupe = findDuplicateExercise(trimmedName, allExercises);
      if (dupe && !dupWarning) {
        setDupWarning(dupe);
        return;
      }
    }
    doSave();
  };

  const usageCount = isEdit ? isExerciseUsedAnywhere(exercise.id, state) : false;

  const archiveExercise = () => {
    updateState((prev) => ({
      ...prev,
      customExercises: (prev.customExercises || []).map((e) => (e.id === exercise.id ? { ...e, archived: true } : e)),
    }));
    onBack();
  };
  const restoreExercise = () => {
    updateState((prev) => ({
      ...prev,
      customExercises: (prev.customExercises || []).map((e) => (e.id === exercise.id ? { ...e, archived: false } : e)),
    }));
  };
  const deleteExercise = () => {
    updateState((prev) => ({ ...prev, customExercises: (prev.customExercises || []).filter((e) => e.id !== exercise.id) }));
    onBack();
  };

  return (
    <SlideInPanel title={isEdit ? "Edit custom exercise" : "Create custom exercise"} onBack={onBack}>
      {dupWarning && (
        <div className="border border-yellow-700/50 bg-yellow-950/20 p-3 space-y-2">
          <div className="flex items-start gap-2 text-xs text-yellow-500">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>An exercise named "{dupWarning.name}" already exists. Use it, or create this one anyway?</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSaved?.(dupWarning.id)}
              className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-neutral-700 text-neutral-200 hover:border-neutral-500"
            >
              Use existing
            </button>
            <button
              onClick={doSave}
              className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
            >
              Create anyway
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Exercise name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDupWarning(null);
          }}
          placeholder="e.g. Atlantis Pendulum Squat"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Primary muscle *</label>
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {m}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Secondary muscles</label>
        <div className="flex flex-wrap gap-1.5">
          {muscleGroups
            .filter((m) => m !== muscle)
            .map((m) => (
              <Chip key={m} active={secondaryMuscles.includes(m)} onClick={() => toggleSecondary(m)}>
                {m}
              </Chip>
            ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Equipment type *</label>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT_TYPES.map((eq) => (
            <Chip key={eq} active={equipment === eq} onClick={() => setEquipment(eq)}>
              {eq}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Movement category</label>
        <div className="flex flex-wrap gap-1.5">
          {MOVEMENT_CATEGORIES.map((c) => (
            <Chip key={c} active={movementCategory === c} onClick={() => setMovementCategory(movementCategory === c ? "" : c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Brand / manufacturer</label>
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Optional — e.g. Atlantis"
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Seat position, pin, grip, cues…"
          rows={2}
          className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700 resize-none"
        />
      </div>

      <button
        onClick={handleSaveClick}
        disabled={!canSave}
        className={`w-full py-3 text-xs uppercase tracking-widest font-bold border flex items-center justify-center gap-1.5 ${
          canSave
            ? "bg-red-700 border-red-700 text-white hover:bg-red-600"
            : "bg-charcoal-panel border-neutral-800 text-neutral-700 cursor-not-allowed"
        }`}
      >
        <Check size={14} /> {isEdit ? "Save changes" : "Create exercise"}
      </button>

      {isEdit && (
        <div className="border-t border-neutral-900 pt-4 space-y-2">
          {exercise.archived ? (
            <button
              onClick={restoreExercise}
              className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-700 text-neutral-200 hover:border-neutral-500 flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={13} /> Restore exercise
            </button>
          ) : confirmArchive ? (
            <div className="border border-neutral-800 bg-charcoal-panel p-3 space-y-2">
              <div className="text-xs text-neutral-400">
                Archive "{exercise.name}"? It'll disappear from search, but every past workout, PR, and progression record
                stays intact.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={archiveExercise}
                  className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
                >
                  Archive
                </button>
                <button
                  onClick={() => setConfirmArchive(false)}
                  className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-neutral-800 text-neutral-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmArchive(true)}
              className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-700 text-neutral-300 hover:border-neutral-500 flex items-center justify-center gap-1.5"
            >
              <Archive size={13} /> Archive exercise
            </button>
          )}

          {!usageCount &&
            (confirmDelete ? (
              <div className="border border-red-900/40 bg-charcoal-panel p-3 space-y-2">
                <div className="text-xs text-neutral-400">
                  Permanently delete "{exercise.name}"? It's never been used in any workout, so this can't be undone but
                  nothing else is affected.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={deleteExercise}
                    className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
                  >
                    Delete permanently
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 text-[11px] uppercase tracking-widest font-bold border border-neutral-800 text-neutral-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-600 hover:text-red-600 hover:border-red-900 flex items-center justify-center gap-1.5"
              >
                <Trash2 size={13} /> Delete permanently — never used
              </button>
            ))}
        </div>
      )}
    </SlideInPanel>
  );
}
