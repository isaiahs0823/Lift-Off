// ---------------- PROGRAM BUILDER — data-model helpers ----------------
// Every function here is pure (state in, new state out) — the UI (ProgramBuilder.jsx) owns all
// confirmation dialogs and persistence; this file only knows how to reshape a program object.
//
// A BRK program (custom or forked from a built-in template) has the same shape everywhere it's
// consumed (programSchedule.js, Athlete Rating's Foundation evidence, Swap Workout, the program
// detail screen): { id, name, tagline?, programFocus?, weeks?, days: [...] }. The one thing this
// file ADDS on top of that existing shape is a stable `id` on each DAY (HERO_PROGRAMS' built-in
// templates don't have one — a day is just an array position there, which is fine for a read-only
// template but not for an editable program: weekday assignments need to keep pointing at the same
// day across reorders/renames, so every day created or forked through this module gets one).
let dayIdCounter = 0;
export function createDayId() {
  dayIdCounter += 1;
  return `day_${Date.now()}_${dayIdCounter}`;
}
export function createProgramId() {
  return `program_${Date.now()}`;
}

// Turns a read-only HERO_PROGRAMS template (or any existing custom program missing day ids — an
// athlete's program created before this feature existed) into a fully editable copy: new program
// id, every day gets a stable id, template days are deep-cloned so editing the copy can never
// mutate the shared template object. `createdFrom` records where it started (shown in the builder
// as "based on Upper Lower" — informational only, never re-synced).
export function forkProgramForEditing(program) {
  return {
    id: createProgramId(),
    name: program.name,
    tagline: program.tagline,
    programFocus: program.programFocus,
    weeks: program.weeks,
    isCustom: true,
    createdFrom: program.isCustom ? program.createdFrom ?? null : { kind: "template", templateId: program.id, name: program.name },
    days: (program.days || []).map((day) => ({
      ...day,
      id: day.id || createDayId(),
      exercises: (day.exercises || []).map((e) => ({ ...e })),
    })),
  };
}

// Ensures every day of an already-custom program has a stable id — a safety net for programs
// created before this feature existed (via the pre-existing copyProgramToCustom, or restored from
// an old backup), never touched for a program that already has ids on every day.
export function ensureDayIds(program) {
  let changed = false;
  const days = (program.days || []).map((day) => {
    if (day.id) return day;
    changed = true;
    return { ...day, id: createDayId() };
  });
  return changed ? { ...program, days } : program;
}

export function renameProgram(program, name) {
  return { ...program, name };
}

export function reorderDays(program, fromIndex, toIndex) {
  const days = [...program.days];
  const [moved] = days.splice(fromIndex, 1);
  days.splice(toIndex, 0, moved);
  return { ...program, days };
}

export function renameDay(program, dayId, label) {
  return { ...program, days: program.days.map((d) => (d.id === dayId ? { ...d, label } : d)) };
}

export function setDayFocus(program, dayId, focus) {
  return { ...program, days: program.days.map((d) => (d.id === dayId ? { ...d, focus } : d)) };
}

export function setDayExercises(program, dayId, exercises) {
  return { ...program, days: program.days.map((d) => (d.id === dayId ? { ...d, exercises } : d)) };
}

export function addExerciseToDay(program, dayId, exercise) {
  return {
    ...program,
    days: program.days.map((d) => (d.id === dayId ? { ...d, exercises: [...(d.exercises || []), exercise] } : d)),
  };
}

export function removeExerciseFromDay(program, dayId, index) {
  return {
    ...program,
    days: program.days.map((d) => (d.id === dayId ? { ...d, exercises: d.exercises.filter((_, i) => i !== index) } : d)),
  };
}

export function reorderExercisesInDay(program, dayId, fromIndex, toIndex) {
  return {
    ...program,
    days: program.days.map((d) => {
      if (d.id !== dayId) return d;
      const exercises = [...d.exercises];
      const [moved] = exercises.splice(fromIndex, 1);
      exercises.splice(toIndex, 0, moved);
      return { ...d, exercises };
    }),
  };
}

export function updateExerciseInDay(program, dayId, index, patch) {
  return {
    ...program,
    days: program.days.map((d) => {
      if (d.id !== dayId) return d;
      return { ...d, exercises: d.exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)) };
    }),
  };
}

// A blank day the athlete builds up themselves — the "+" button's default when no other mode is
// picked. Appended at the end of the day list; the athlete reorders/assigns a weekday afterward.
export function addBlankDay(program, label) {
  const day = { id: createDayId(), label: label || `Day ${program.days.length + 1}`, exercises: [] };
  return { ...program, days: [...program.days, day] };
}

export function addRestDay(program, label = "Rest") {
  const day = { id: createDayId(), label, type: "rest", exercises: [] };
  return { ...program, days: [...program.days, day] };
}

// Copies an existing day's exercises into a new day at the end of the list — "Duplicate Upper A
// and customize the duplicate" (acceptance test 5). The duplicate is fully independent: editing
// it never touches the original (exercises array + each entry are copied, not referenced).
export function duplicateDay(program, dayId) {
  const source = program.days.find((d) => d.id === dayId);
  if (!source) return program;
  const copy = { ...source, id: createDayId(), label: `${source.label} (Copy)`, exercises: source.exercises.map((e) => ({ ...e })) };
  return { ...program, days: [...program.days, copy] };
}

// Removing a day never silently drops programmed exercises (task: "never silently delete
// programmed exercises") — the caller is responsible for confirming with the athlete FIRST when
// `dayHasContent` (below) is true; this function itself just performs the removal once approved.
export function removeDay(program, dayId) {
  return { ...program, days: program.days.filter((d) => d.id !== dayId) };
}
export function dayHasContent(day) {
  return !!day && day.type !== "rest" && (day.exercises || []).length > 0;
}

// Appends a suggested day (see SUGGESTED_DAY_FOCUSES below) built from a focus template.
export function addSuggestedDay(program, focusKey) {
  const focus = SUGGESTED_DAY_FOCUSES.find((f) => f.key === focusKey);
  if (!focus) return program;
  const day = { id: createDayId(), label: focus.label, focus: focus.label, exercises: focus.exercises.map((e) => ({ ...e })) };
  return { ...program, days: [...program.days, day] };
}

// ---------------- suggested day focuses ----------------
// A small, deliberately conservative starter exercise list per focus — "sensible choices," never
// a maxed-out volume dump (task: "do not automatically add excessive training volume"). These are
// STARTING points; every exercise/set/rep is immediately editable once the day is added, same as
// any other day. Rule-based, not a live model call — see suggestDayFocusesForProgram below for how
// the ranking uses the program's own current weekly volume (task: "use the current program... and
// existing weekly volume to recommend a reasonable day" — the "reasonable" part this codebase can
// do today without new AI infrastructure; a true generative suggestion is a larger, separate
// feature, flagged in the final report rather than faked here).
export const SUGGESTED_DAY_FOCUSES = [
  {
    key: "arms_shoulders",
    label: "Arms & Shoulders",
    blurb: "Great for a 5th day",
    targetMuscles: ["Arms", "Shoulders"],
    exercises: [
      { exId: "db_shoulder_press", sets: 3, reps: 10 },
      { exId: "cable_lat_raise", sets: 3, reps: 15 },
      { exId: "barbell_curl", sets: 3, reps: 10 },
      { exId: "tricep_pushdown", sets: 3, reps: 12 },
      { exId: "hammer_curl", sets: 3, reps: 12 },
      { exId: "overhead_tricep_ext", sets: 3, reps: 12 },
    ],
  },
  {
    key: "upper_accessories",
    label: "Upper Accessories",
    blurb: "Chest, back, arms, shoulders",
    targetMuscles: ["Chest", "Back", "Shoulders", "Arms"],
    exercises: [
      { exId: "cable_fly", sets: 3, reps: 12 },
      { exId: "seated_row", sets: 3, reps: 12 },
      { exId: "lat_raise", sets: 3, reps: 15 },
      { exId: "face_pull", sets: 3, reps: 15 },
      { exId: "cable_curl", sets: 3, reps: 12 },
      { exId: "tricep_pushdown", sets: 3, reps: 12 },
    ],
  },
  {
    key: "lower_accessories",
    label: "Lower Accessories",
    blurb: "Hamstrings, glutes, calves",
    targetMuscles: ["Legs"],
    exercises: [
      { exId: "leg_curl_lying", sets: 3, reps: 12 },
      { exId: "hip_thrust", sets: 3, reps: 12 },
      { exId: "bulgarian_split_squat", sets: 3, reps: 10 },
      { exId: "leg_extension", sets: 3, reps: 12 },
      { exId: "calf_raise_standing", sets: 4, reps: 15 },
    ],
  },
  {
    key: "weak_point",
    label: "Weak-Point Training",
    blurb: "Target specific muscle groups",
    targetMuscles: ["Shoulders", "Legs"],
    exercises: [
      { exId: "rear_delt_fly", sets: 3, reps: 15 },
      { exId: "face_pull", sets: 3, reps: 15 },
      { exId: "hip_thrust", sets: 3, reps: 12 },
      { exId: "calf_raise_standing", sets: 4, reps: 15 },
      { exId: "cable_lat_raise", sets: 3, reps: 15 },
    ],
  },
  {
    key: "full_body",
    label: "Full Body",
    blurb: "Balanced total body workout",
    targetMuscles: ["Chest", "Back", "Legs", "Shoulders"],
    exercises: [
      { exId: "squat", sets: 3, reps: 8 },
      { exId: "bench", sets: 3, reps: 8 },
      { exId: "barbell_row", sets: 3, reps: 8 },
      { exId: "ohp", sets: 2, reps: 10 },
      { exId: "rdl", sets: 2, reps: 10 },
    ],
  },
];

// Ranks SUGGESTED_DAY_FOCUSES by how little the program currently trains each focus's target
// muscles — reuses programProposal.js's plannedWeeklyVolumeByMuscle (the same volume accounting
// BRK's own program-proposal validator uses) rather than inventing a second one. A program heavy
// on upper work and light on legs sees "Lower Accessories" surface first, not because of a theme
// name match but because of its actual current set volume.
export function suggestDayFocusesForProgram(program, ctx, plannedWeeklyVolumeByMuscle) {
  const volumeByMuscle = plannedWeeklyVolumeByMuscle({ days: program.days }, ctx);
  const maxVolume = Math.max(1, ...Object.values(volumeByMuscle));
  return SUGGESTED_DAY_FOCUSES.map((focus) => {
    const covered = focus.targetMuscles.reduce((sum, m) => sum + (volumeByMuscle[m] || 0), 0);
    const avgCoverage = covered / focus.targetMuscles.length / maxVolume;
    return { ...focus, coverageScore: avgCoverage };
  }).sort((a, b) => a.coverageScore - b.coverageScore);
}
