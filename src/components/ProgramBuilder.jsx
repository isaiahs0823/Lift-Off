import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, GripVertical, MoreHorizontal, Copy, Trash2, ChevronRight, Dumbbell, Calendar, X } from "lucide-react";
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
} from "../utils/programBuilder.js";
import { plannedWeeklyVolumeByMuscle } from "../utils/programProposal.js";
import { WEEKDAYS, WEEKDAY_LABELS, hasSchedule, suggestWeekdaysForProgramDays, defaultFixedDays, emptySlot } from "../utils/weeklySchedule.js";
import { getReminderSettings, DEFAULT_REMINDER_TIME } from "../utils/workoutReminders.js";

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
function DayRow({ day, index, state, programId, onEdit, onDuplicate, onDelete, dragHandleProps }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isRest = day.type === "rest";
  const assignedDays = weekdaysForDay(state, programId, day.id);
  return (
    <Card className="flex items-start gap-2.5">
      <span {...dragHandleProps} className="shrink-0 pt-1 text-v5-subtext/50 cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
        <GripVertical size={16} />
      </span>
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
  const [dragIndex, setDragIndex] = useState(null);

  const setDayCount = (next) => {
    const clamped = Math.max(MIN_DAYS, Math.min(MAX_DAYS, next));
    if (clamped === program.days.length) return;
    if (clamped > program.days.length) {
      persist(addBlankDay(program, `Day ${program.days.length + 1}`));
      return;
    }
    // Removing via the stepper always removes the LAST day — simplest, most predictable rule
    // (task: "never silently delete programmed exercises").
    const last = program.days[program.days.length - 1];
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

  const handleDrop = (toIndex) => {
    if (dragIndex == null || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    persist(reorderDays(program, dragIndex, toIndex));
    setDragIndex(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel tone="muted">Program Builder</SectionLabel>
        <input
          type="text"
          value={program.name}
          onChange={(e) => persist(renameProgram(program, e.target.value))}
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
            onClick={() => setDayCount(program.days.length - 1)}
            disabled={program.days.length <= MIN_DAYS}
            className="w-10 h-10 rounded-full bg-v5-surface flex items-center justify-center text-v5-text disabled:opacity-30"
            aria-label="Remove a training day"
          >
            <Minus size={18} />
          </button>
          <span className="text-3xl font-black text-v5-text tabular-nums w-10 text-center">{program.days.length}</span>
          <button
            onClick={() => setDayCount(program.days.length + 1)}
            disabled={program.days.length >= MAX_DAYS}
            className="w-10 h-10 rounded-full bg-v5-red flex items-center justify-center text-white disabled:opacity-30"
            aria-label="Add a training day"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel tone="muted">Training Days</SectionLabel>
          <ButtonText icon={Plus} onClick={onAddDay}>
            Add Day
          </ButtonText>
        </div>
        <div className="space-y-2">
          {program.days.map((day, i) => (
            <div
              key={day.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
            >
              <DayRow day={day} index={i} state={state} programId={program.id} onEdit={onEdit} onDuplicate={handleDuplicate} onDelete={handleDelete} />
            </div>
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
function ExerciseEditRow({ exercise, index, exMap, onChange, onRemove, dragHandleProps }) {
  const ex = exMap[exercise.exId];
  return (
    <Card className="flex items-start gap-2.5">
      <span {...dragHandleProps} className="shrink-0 pt-1 text-v5-subtext/50 cursor-grab active:cursor-grabbing">
        <GripVertical size={15} />
      </span>
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
  const [dragIndex, setDragIndex] = useState(null);
  const day = program.days.find((d) => d.id === dayId);
  if (!day) return null;

  const patchExercise = (index, patch) => persist(updateExerciseInDay(program, dayId, index, patch));
  const removeExercise = (index) => persist(removeExerciseFromDay(program, dayId, index));
  const addExercise = (exId) => {
    persist(addExerciseToDay(program, dayId, { exId, sets: 3, reps: 10 }));
    setPicking(false);
  };
  const handleDrop = (toIndex) => {
    if (dragIndex == null || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    persist(reorderExercisesInDay(program, dayId, dragIndex, toIndex));
    setDragIndex(null);
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
            <div key={i} draggable onDragStart={() => setDragIndex(i)} onDragOver={(ev) => ev.preventDefault()} onDrop={() => handleDrop(i)}>
              <ExerciseEditRow exercise={e} index={i} exMap={exMap} onChange={patchExercise} onRemove={removeExercise} />
            </div>
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
function WeekdayRow({ weekday, slot, program, onChange }) {
  const [open, setOpen] = useState(false);
  const label = slot.type === "rest" ? "Rest Day" : slot.label || "Unassigned";
  return (
    <div className="border-b border-white/[0.06] last:border-0 py-2.5">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <span className="text-sm font-bold text-v5-text w-12 text-left">{WEEKDAY_LABELS[weekday]}</span>
        <span className="flex-1 text-sm text-v5-subtext text-left">{label}</span>
        <ChevronRight size={14} className={`text-v5-subtext shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-14">
          <button
            onClick={() => {
              onChange(weekday, emptySlot("rest"));
              setOpen(false);
            }}
            className={`px-2.5 py-1.5 text-xs font-bold border rounded-lg ${
              slot.type === "rest" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
            }`}
          >
            Rest
          </button>
          {program.days
            .filter((d) => d.type !== "rest")
            .map((d) => {
              const active = slot.source?.kind === "programDay" && slot.source.dayId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    onChange(weekday, { type: "workout", source: { kind: "programDay", programId: program.id, dayId: d.id }, label: d.label });
                    setOpen(false);
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold border rounded-lg truncate max-w-[140px] ${
                    active ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

function ScheduleScreen({ program, state, updateState, onBack }) {
  const fixedDays = state.weeklySchedule?.mode === "fixed" ? state.weeklySchedule.fixedDays : defaultFixedDays();
  const reminderSettings = getReminderSettings(state);

  const setSlot = (weekday, slot) => {
    updateState((prev) => {
      const prevFixed = prev.weeklySchedule?.mode === "fixed" ? prev.weeklySchedule.fixedDays : defaultFixedDays();
      return {
        ...prev,
        weeklySchedule: { mode: "fixed", fixedDays: { ...prevFixed, [weekday]: slot }, createdAt: prev.weeklySchedule?.createdAt || new Date().toISOString() },
      };
    });
  };

  const applySuggestion = () => {
    const suggested = suggestWeekdaysForProgramDays(program);
    updateState((prev) => ({
      ...prev,
      weeklySchedule: { mode: "fixed", fixedDays: suggested, createdAt: prev.weeklySchedule?.createdAt || new Date().toISOString() },
    }));
  };

  const toggleReminders = () => {
    updateState((prev) => ({ ...prev, reminderSettings: { ...getReminderSettings(prev), enabled: !getReminderSettings(prev).enabled } }));
  };
  const setReminderTime = (time) => {
    updateState((prev) => ({ ...prev, reminderSettings: { ...getReminderSettings(prev), time } }));
  };

  return (
    <SlideInPanel title="Edit Schedule" subtitle="Assign your training days to specific weekdays — change this anytime" onBack={onBack}>
      <div>
        {WEEKDAYS.filter((w) => w !== "sun").concat("sun").map((weekday) => (
          <WeekdayRow key={weekday} weekday={weekday} slot={fixedDays[weekday] || emptySlot("rest")} program={program} onChange={setSlot} />
        ))}
      </div>

      <ButtonSecondary onClick={applySuggestion}>Suggest a schedule from this program</ButtonSecondary>

      <Card className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-v5-red" />
          <div className="text-sm font-bold text-v5-text">Schedule &amp; Reminders</div>
        </div>
        <p className="text-[11px] text-v5-subtext">Set workout reminders for your training days.</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-v5-text/90">Enable reminders</span>
          <button
            onClick={toggleReminders}
            className={`relative w-11 h-6 rounded-full transition-colors ${reminderSettings.enabled ? "bg-v5-red" : "bg-v5-muted"}`}
            aria-pressed={reminderSettings.enabled}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${reminderSettings.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
        {reminderSettings.enabled && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-v5-text/90">Reminder time</span>
            <input
              type="time"
              value={reminderSettings.time || DEFAULT_REMINDER_TIME}
              onChange={(e) => setReminderTime(e.target.value)}
              className="bg-v5-elevated border border-white/10 text-v5-text text-sm px-2.5 py-1.5 rounded focus:outline-none focus:border-v5-red/60"
            />
          </div>
        )}
      </Card>
    </SlideInPanel>
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
