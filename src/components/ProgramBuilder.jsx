import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, ChevronUp, ChevronDown, MoreHorizontal, Copy, Trash2, ChevronRight, Dumbbell, Calendar, X, Check } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import { Card, SectionLabel, ScreenHeader, ButtonPrimary, ButtonSecondary, ButtonText, Pill } from "./ui/Kit.jsx";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import { AddExercisePicker } from "../App.jsx";
import {
  createDayId,
  forkProgramForEditing,
  ensureDayIds,
  renameProgram,
  reorderDays,
  renameDay,
  setDayExercises,
  addExerciseToDay,
  removeExerciseFromDay,
  reorderExercisesInDay,
  updateExerciseInDay,
  addBlankDay,
  addRestDay,
  duplicateDay,
  removeDay,
  dayHasContent,
  addSuggestedDay,
  SUGGESTED_DAY_FOCUSES,
  suggestDayFocusesForProgram,
  countTrainingDays,
  countRestDays,
} from "../utils/programBuilder.js";
import { plannedWeeklyVolumeByMuscle } from "../utils/programProposal.js";
import { WEEKDAYS, WEEKDAY_LABELS } from "../utils/weeklySchedule.js";
import ScheduleEditor from "./ScheduleEditor.jsx";

const MIN_DAYS = 1;
const MAX_DAYS = 7;

// Reads which weekdays currently point at a given program day (by id) — purely a read, used to
// show a small "Mon, Thu" summary on the home screen's day rows. The authoritative write path is
// the Weekly Schedule screen; this never itself touches state.weeklySchedule.
function weekdaysForDay(state, programId, dayId) {
  const fixedDays = state.weeklySchedule?.mode === "fixed" ? state.weeklySchedule.fixedDays : null;
  if (!fixedDays) return [];
  return WEEKDAYS.filter((wd) => fixedDays[wd]?.source?.kind === "programDay" && fixedDays[wd].source.programId === programId && fixedDays[wd].source.dayId === dayId).map(
    (wd) => WEEKDAY_LABELS[wd]
  );
}

// ---------------- DAY LIST ROW (home screen) ----------------
// Move-up/move-down buttons, not drag-and-drop (UX audit Phase 1, item 3) — the native HTML5 drag
// API these replaced (draggable/onDragStart/onDragOver/onDrop) never fires from a real touchscreen
// tap-and-hold, so reordering was effectively broken on mobile despite working in a mouse-driven
// browser or a test harness that dispatches synthetic drag events. Buttons work identically on
// every input type and double as the "clear visual feedback" the row's new position already gives.
function DayRow({ day, index, state, programId, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isRest = day.type === "rest";
  const assignedDays = weekdaysForDay(state, programId, day.id);
  return (
    <Card className="flex items-start gap-2.5">
      <div className="shrink-0 flex flex-col -my-1">
        <button
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="p-1 text-v5-subtext/70 hover:text-v5-text disabled:opacity-20 disabled:pointer-events-none"
          aria-label={`Move "${day.label}" up`}
        >
          <ChevronUp size={16} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="p-1 text-v5-subtext/70 hover:text-v5-text disabled:opacity-20 disabled:pointer-events-none"
          aria-label={`Move "${day.label}" down`}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      <button onClick={() => !isRest && onEdit(day.id)} disabled={isRest} className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-v5-subtext shrink-0">{index + 1}.</span>
          <span className="text-sm font-bold text-v5-text truncate">{day.label}</span>
          {isRest && <Pill tone="inactive">Rest</Pill>}
        </div>
        {!isRest && (
          <div className="text-[11px] text-v5-subtext mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{(day.exercises || []).length} exercises</span>
            {assignedDays.length > 0 && (
              <>
                <span className="text-v5-subtext/40">·</span>
                <span className="text-v5-red/80">{assignedDays.join(", ")}</span>
              </>
            )}
          </div>
        )}
      </button>
      <div className="relative shrink-0">
        <button onClick={() => setMenuOpen((v) => !v)} className="p-1.5 text-v5-subtext hover:text-v5-text" aria-label="Day options">
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 z-10 w-40 bg-v5-elevated border border-white/10 rounded-lg overflow-hidden shadow-lg">
            {!isRest && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate(day.id);
                }}
                className="w-full text-left px-3 py-2.5 text-xs text-v5-text hover:bg-v5-surface flex items-center gap-2"
              >
                <Copy size={13} /> Duplicate
              </button>
            )}
            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete(day.id);
              }}
              className="w-full text-left px-3 py-2.5 text-xs text-v5-red hover:bg-v5-surface flex items-center gap-2"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------- HOME ----------------
function BuilderHome({ program, state, updateState, onEdit, onAddDay, onOpenSchedule, onClose, setProgram, persist }) {
  const [nameJustSaved, setNameJustSaved] = useState(false);
  const trainingCount = countTrainingDays(program.days);
  const restCount = countRestDays(program.days);
  const atMaxDays = program.days.length >= MAX_DAYS;

  // "−" always removes a TRAINING day specifically (searching back from the end), never a rest
  // day, so the number shown always matches what it says — "N Training Days" (UX audit Phase 1,
  // item 5: "the frequency selector must represent actual training sessions, not the total number
  // of program entries"). "+" no longer creates a blank day on its own (item 4: it used to, which
  // meant the stepper and the "Add Day" button right below it looked like two controls for the
  // same thing but behaved differently) — it now opens the exact same Add Day sheet Add Day does,
  // so every way of growing the program offers Blank/Duplicate/Suggested/Rest every time.
  const removeLastTrainingDay = () => {
    if (trainingCount <= MIN_DAYS) return;
    const idx = [...program.days].reverse().findIndex((d) => d.type !== "rest");
    if (idx === -1) return;
    const last = program.days[program.days.length - 1 - idx];
    if (dayHasContent(last)) {
      if (!window.confirm(`Remove "${last.label}"? It has ${last.exercises.length} exercise${last.exercises.length === 1 ? "" : "s"} programmed — this can't be undone.`)) return;
    }
    persist(removeDay(program, last.id));
  };

  const handleDuplicate = (dayId) => persist(duplicateDay(program, dayId));
  const handleDelete = (dayId) => {
    const day = program.days.find((d) => d.id === dayId);
    if (dayHasContent(day)) {
      if (!window.confirm(`Delete "${day.label}"? It has ${day.exercises.length} exercise${day.exercises.length === 1 ? "" : "s"} programmed — this can't be undone.`)) return;
    }
    persist(removeDay(program, dayId));
  };

  // Move-up/move-down (UX audit Phase 1, item 3) — see DayRow's comment for why this replaced
  // native HTML5 drag-and-drop outright rather than keeping both.
  const moveDay = (index, delta) => {
    const toIndex = index + delta;
    if (toIndex < 0 || toIndex >= program.days.length) return;
    persist(reorderDays(program, index, toIndex));
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <SectionLabel tone="muted">Program Name</SectionLabel>
          {/* "Clear saved feedback" (program renaming UX fix, item 3) — every keystroke already
              persists immediately (local-first, unchanged), this just confirms it visually once
              the athlete stops typing rather than flashing on every character. */}
          {nameJustSaved && (
            <span className="text-[11px] text-v5-subtext/70 flex items-center gap-1">
              <Check size={11} className="text-v5-red" /> Saved
            </span>
          )}
        </div>
        <input
          type="text"
          value={program.name}
          onChange={(e) => persist(renameProgram(program, e.target.value))}
          onBlur={() => {
            if (!program.name.trim()) return;
            setNameJustSaved(true);
            setTimeout(() => setNameJustSaved(false), 2000);
          }}
          placeholder="Program name"
          className="w-full bg-transparent text-2xl font-black text-v5-text focus:outline-none border-b border-transparent focus:border-v5-red/40 pb-1 mt-1"
        />
      </div>

      <div>
        <SectionLabel tone="muted" className="mb-2">
          Training Days Per Week
        </SectionLabel>
        <div className="flex items-center justify-center gap-5 bg-v5-elevated rounded-xl py-3">
          <button
            onClick={removeLastTrainingDay}
            disabled={trainingCount <= MIN_DAYS}
            className="w-10 h-10 rounded-full bg-v5-surface flex items-center justify-center text-v5-text disabled:opacity-30"
            aria-label="Remove a training day"
          >
            <Minus size={18} />
          </button>
          <span className="text-3xl font-black text-v5-text tabular-nums w-10 text-center">{trainingCount}</span>
          <button
            onClick={onAddDay}
            disabled={atMaxDays}
            className="w-10 h-10 rounded-full bg-v5-red flex items-center justify-center text-white disabled:opacity-30"
            aria-label="Add a training day"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="text-center text-[11px] text-v5-subtext mt-1.5">
          {restCount > 0 ? `${trainingCount} Training · ${restCount} Rest Day${restCount === 1 ? "" : "s"}` : "No rest days scheduled yet"}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel tone="muted">Training Days</SectionLabel>
          <ButtonText icon={Plus} onClick={onAddDay} disabled={atMaxDays} className="disabled:opacity-30 disabled:pointer-events-none">
            Add Day
          </ButtonText>
        </div>
        <div className="space-y-2">
          {program.days.map((day, i) => (
            <DayRow
              key={day.id}
              day={day}
              index={i}
              state={state}
              programId={program.id}
              onEdit={onEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onMoveUp={() => moveDay(i, -1)}
              onMoveDown={() => moveDay(i, 1)}
              canMoveUp={i > 0}
              canMoveDown={i < program.days.length - 1}
            />
          ))}
          {program.days.length === 0 && (
            <Card className="text-center py-6 text-sm text-v5-subtext">No training days yet — tap "Add Day" to start.</Card>
          )}
        </div>
      </div>

      <Card onClick={onOpenSchedule} className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Calendar size={16} className="text-v5-red" />
          <div>
            <div className="text-sm font-bold text-v5-text">Weekly Schedule</div>
            <div className="text-[11px] text-v5-subtext">Assign training days to weekdays, set reminders</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-v5-subtext shrink-0" />
      </Card>

      <ButtonPrimary onClick={onClose}>Done</ButtonPrimary>
    </div>
  );
}

// ---------------- ADD DAY SHEET ----------------
function AddDaySheet({ program, state, exMap, allExercises, onBack, onAdded, persist }) {
  const ranked = useMemo(() => suggestDayFocusesForProgram(program, { exMap, allExercises }, plannedWeeklyVolumeByMuscle), [program, exMap, allExercises]);

  const addBlank = () => {
    const next = addBlankDay(program, `Day ${program.days.length + 1}`);
    const added = next.days[next.days.length - 1];
    persist(next);
    onAdded(added.id);
  };
  const addRest = () => {
    persist(addRestDay(program));
    onBack();
  };
  const addFromDuplicate = (sourceDayId) => {
    const next = duplicateDay(program, sourceDayId);
    const added = next.days[next.days.length - 1];
    persist(next);
    onAdded(added.id);
  };
  const addFromFocus = (focusKey) => {
    const next = addSuggestedDay(program, focusKey);
    const added = next.days[next.days.length - 1];
    persist(next);
    onAdded(added.id);
  };

  const workoutDays = program.days.filter((d) => d.type !== "rest");

  return (
    <SlideInPanel title="Add Training Day" subtitle="Choose how you want to create your new day" onBack={onBack}>
      <div className="space-y-2">
        <Card onClick={addBlank} className="flex items-center gap-3">
          <Plus size={16} className="text-v5-red shrink-0" />
          <div>
            <div className="text-sm font-bold text-v5-text">Blank Workout</div>
            <div className="text-[11px] text-v5-subtext">Start empty and build it yourself</div>
          </div>
        </Card>
        <Card onClick={addRest} className="flex items-center gap-3">
          <span className="text-v5-subtext shrink-0">💤</span>
          <div>
            <div className="text-sm font-bold text-v5-text">Rest Day</div>
            <div className="text-[11px] text-v5-subtext">No exercises — a scheduled day off</div>
          </div>
        </Card>
      </div>

      {workoutDays.length > 0 && (
        <div>
          <SectionLabel tone="muted" className="mb-2">
            Duplicate Existing Day
          </SectionLabel>
          <div className="space-y-2">
            {workoutDays.map((d) => (
              <Card key={d.id} onClick={() => addFromDuplicate(d.id)} className="flex items-center justify-between">
                <span className="text-sm text-v5-text truncate">{d.label}</span>
                <span className="text-[11px] text-v5-subtext shrink-0">{d.exercises.length} exercises</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionLabel tone="muted" className="mb-1">
          Suggested
        </SectionLabel>
        <p className="text-[11px] text-v5-subtext mb-2">
          Ranked by what your program currently trains least — not required, just a starting point you can fully edit after.
        </p>
        <div className="space-y-2">
          {ranked.map((focus) => (
            <Card key={focus.key} onClick={() => addFromFocus(focus.key)} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-v5-text">{focus.label}</div>
                <div className="text-[11px] text-v5-subtext">{focus.blurb}</div>
              </div>
              <ChevronRight size={14} className="text-v5-subtext shrink-0" />
            </Card>
          ))}
        </div>
      </div>
    </SlideInPanel>
  );
}

// ---------------- EDIT DAY ----------------
function ExerciseEditRow({ exercise, index, exMap, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const ex = exMap[exercise.exId];
  return (
    <Card className="flex items-start gap-2.5">
      <div className="shrink-0 flex flex-col -my-1">
        <button
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="p-1 text-v5-subtext/70 hover:text-v5-text disabled:opacity-20 disabled:pointer-events-none"
          aria-label={`Move ${ex?.name || exercise.exId} up`}
        >
          <ChevronUp size={15} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="p-1 text-v5-subtext/70 hover:text-v5-text disabled:opacity-20 disabled:pointer-events-none"
          aria-label={`Move ${ex?.name || exercise.exId} down`}
        >
          <ChevronDown size={15} />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-v5-text truncate">{ex?.name || exercise.exId}</div>
        <div className="text-[11px] text-v5-subtext">{ex?.muscle}</div>
        <div className="flex items-center gap-3 mt-1.5">
          <label className="flex items-center gap-1 text-[11px] text-v5-subtext">
            Sets
            <input
              type="number"
              min={1}
              max={10}
              value={exercise.sets}
              onChange={(e) => onChange(index, { sets: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
              className="w-12 bg-v5-elevated text-v5-text text-center rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-v5-red"
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-v5-subtext">
            Reps
            <input
              type="number"
              min={1}
              max={50}
              value={exercise.reps}
              onChange={(e) => onChange(index, { reps: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
              className="w-12 bg-v5-elevated text-v5-text text-center rounded px-1 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-v5-red"
            />
          </label>
          <span className="text-[11px] text-v5-subtext/60">{formatSetPrescription(exercise)}</span>
        </div>
      </div>
      <button onClick={() => onRemove(index)} className="shrink-0 p-1 text-v5-subtext hover:text-v5-red" aria-label="Remove exercise">
        <X size={15} />
      </button>
    </Card>
  );
}

function EditDayScreen({ program, dayId, state, updateState, exMap, allExercises, muscleGroups, onBack, persist }) {
  const [picking, setPicking] = useState(false);
  const day = program.days.find((d) => d.id === dayId);
  if (!day) return null;

  const patchExercise = (index, patch) => persist(updateExerciseInDay(program, dayId, index, patch));
  const removeExercise = (index) => persist(removeExerciseFromDay(program, dayId, index));
  const addExercise = (exId) => {
    persist(addExerciseToDay(program, dayId, { exId, sets: 3, reps: 10 }));
    setPicking(false);
  };
  // Move-up/move-down, not drag-and-drop — see DayRow's comment (UX audit Phase 1, item 3).
  const moveExercise = (index, delta) => {
    const toIndex = index + delta;
    if (toIndex < 0 || toIndex >= day.exercises.length) return;
    persist(reorderExercisesInDay(program, dayId, index, toIndex));
  };
  const handleDuplicateDay = () => {
    persist(duplicateDay(program, dayId));
    onBack();
  };
  const handleDeleteDay = () => {
    if (dayHasContent(day)) {
      if (!window.confirm(`Delete "${day.label}"? It has ${day.exercises.length} exercise${day.exercises.length === 1 ? "" : "s"} programmed — this can't be undone.`)) return;
    }
    persist(removeDay(program, dayId));
    onBack();
  };

  if (picking) {
    return (
      <AddExercisePicker
        allExercises={allExercises}
        state={state}
        updateState={updateState}
        muscleGroups={muscleGroups}
        onBack={() => setPicking(false)}
        onSelect={addExercise}
        subtitle="Added to this training day — edit sets/reps after adding"
      />
    );
  }

  return (
    <SlideInPanel title="Edit Training Day" onBack={onBack}>
      <div>
        <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Day Name</label>
        <input
          type="text"
          value={day.label}
          onChange={(e) => persist(renameDay(program, dayId, e.target.value))}
          className="w-full bg-v5-elevated text-v5-text rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel tone="muted">Exercises</SectionLabel>
          <ButtonText icon={Plus} onClick={() => setPicking(true)}>
            Add Exercise
          </ButtonText>
        </div>
        <div className="space-y-2">
          {day.exercises.map((e, i) => (
            <ExerciseEditRow
              key={i}
              exercise={e}
              index={i}
              exMap={exMap}
              onChange={patchExercise}
              onRemove={removeExercise}
              onMoveUp={() => moveExercise(i, -1)}
              onMoveDown={() => moveExercise(i, 1)}
              canMoveUp={i > 0}
              canMoveDown={i < day.exercises.length - 1}
            />
          ))}
          {day.exercises.length === 0 && <Card className="text-center py-5 text-sm text-v5-subtext">No exercises yet — tap "Add Exercise."</Card>}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <ButtonSecondary icon={Copy} onClick={handleDuplicateDay} className="flex-1">
          Duplicate Day
        </ButtonSecondary>
        <ButtonSecondary icon={Trash2} onClick={handleDeleteDay} className="flex-1">
          Delete Day
        </ButtonSecondary>
      </div>
    </SlideInPanel>
  );
}

// ---------------- WEEKLY SCHEDULE (scoped to this program) ----------------
// Delegates straight to ScheduleEditor — the ONE scheduling UI in the app (UX audit Phase 1, item
// 2). This used to be its own hand-rolled Mon-Sun picker with its own autosave behavior, separate
// from More > Weekly schedule's Fixed/Rolling editor with its explicit Save button — two different
// interfaces quietly editing the exact same state.weeklySchedule. Passing `program` is what makes
// ScheduleEditor offer this program's own days (by stable id) as the "workout" source instead of
// the generic currentProgram/plan/template list it shows everywhere else.
function ScheduleScreen({ program, state, updateState, onBack }) {
  return (
    <div className="space-y-4">
      <ScheduleEditor state={state} updateState={updateState} program={program} onBack={onBack} />
      <p className="text-[11px] text-v5-subtext/70 text-center">Workout reminders are set in More → Settings.</p>
    </div>
  );
}

// ---------------- ROOT ----------------
// `programId`: an existing state.customPrograms entry to edit. `startFrom`: a read-only template
// (built-in HERO_PROGRAMS entry, or any program object) to FORK into a new editable copy on
// first open — the template itself is never mutated (task: "the original program should act as a
// starting template, not a permanent restriction"). Exactly one of the two is normally passed.
//
// All edits persist immediately to state.customPrograms (task Part 10: "all program edits must
// persist locally immediately") — there is no local draft/unsaved state. "Done" is pure
// navigation, not a save gate, so a refresh or an interrupted session never loses anything (tests
// 10/11).
export default function ProgramBuilder({ state, updateState, exMap, allExercises, muscleGroups, programId, startFrom, onBack, onDone }) {
  const [view, setView] = useState("home"); // "home" | "addDay" | "editDay" | "schedule"
  const [activeDayId, setActiveDayId] = useState(null);

  // When opened with `startFrom` (a built-in template, or any read-only program object) rather
  // than an existing `programId`, fork a brand-new editable copy exactly once on mount — never
  // inside render (calling updateState synchronously while this component is still rendering
  // would update a different component mid-render, which React disallows). The fork is created
  // immediately so every subsequent edit has a real customPrograms id to persist against, and so
  // even closing the builder right away never loses the "I started customizing this" starting
  // point (task Part 10: persist immediately).
  const forkOnMountRef = useRef(false);
  const [localId, setLocalId] = useState(programId || null);
  useEffect(() => {
    if (localId || forkOnMountRef.current) return;
    forkOnMountRef.current = true;
    const forked = forkProgramForEditing(startFrom || { id: "blank", name: "New Program", days: [] });
    updateState((prev) => ({ ...prev, customPrograms: [...(prev.customPrograms || []), forked] }));
    setLocalId(forked.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fork exactly once per mount
  }, []);

  const rawProgram = useMemo(() => {
    if (!localId) return null;
    return (state.customPrograms || []).find((p) => p.id === localId) || null;
  }, [state.customPrograms, localId]);

  // Backfills day ids for a program that predates this feature (created via the older, simpler
  // copyProgramToCustom, or restored from a backup) and PERSISTS them immediately, once — ids
  // must be stable across renders the instant anything (a weekday assignment, an edit) might
  // reference one by value; generating them fresh on every render without saving would silently
  // break any reference made in between (the weekday picker below stores the exact id it was
  // shown, so it must still match next render).
  useEffect(() => {
    if (!rawProgram) return;
    const patched = ensureDayIds(rawProgram);
    if (patched !== rawProgram) {
      updateState((prev) => ({ ...prev, customPrograms: (prev.customPrograms || []).map((p) => (p.id === patched.id ? patched : p)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawProgram]);

  const program = rawProgram && (rawProgram.days || []).every((d) => d.id) ? rawProgram : null;

  const persist = (nextProgram) => {
    updateState((prev) => ({
      ...prev,
      customPrograms: (prev.customPrograms || []).map((p) => (p.id === nextProgram.id ? nextProgram : p)),
    }));
  };

  if (!program) {
    // localId unset means the fork-on-mount effect hasn't completed its first render yet (one
    // tick, not a real error state); localId set but no match means it genuinely doesn't exist.
    return (
      <SlideInPanel title="Program Builder" onBack={onBack}>
        <Card className="text-center py-6 text-sm text-v5-subtext">
          {localId ? "This program couldn't be found — it may have been deleted." : "Setting up…"}
        </Card>
      </SlideInPanel>
    );
  }

  if (view === "addDay") {
    return (
      <AddDaySheet
        program={program}
        state={state}
        exMap={exMap}
        allExercises={allExercises}
        persist={persist}
        onBack={() => setView("home")}
        onAdded={(dayId) => {
          setActiveDayId(dayId);
          setView("editDay");
        }}
      />
    );
  }
  if (view === "editDay") {
    return (
      <EditDayScreen
        program={program}
        dayId={activeDayId}
        state={state}
        updateState={updateState}
        exMap={exMap}
        allExercises={allExercises}
        muscleGroups={muscleGroups}
        persist={persist}
        onBack={() => setView("home")}
      />
    );
  }
  if (view === "schedule") {
    return <ScheduleScreen program={program} state={state} updateState={updateState} onBack={() => setView("home")} />;
  }

  return (
    <BuilderHome
      program={program}
      state={state}
      updateState={updateState}
      persist={persist}
      onEdit={(dayId) => {
        setActiveDayId(dayId);
        setView("editDay");
      }}
      onAddDay={() => setView("addDay")}
      onOpenSchedule={() => setView("schedule")}
      onClose={onDone || onBack}
    />
  );
}
