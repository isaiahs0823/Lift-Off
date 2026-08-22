// ---------------- CUSTOM EXERCISE HELPERS ----------------
// Custom exercises share the exact same { id, name, type, muscle } shape built-ins use (see
// state.customExercises in App.jsx) — these helpers only ever add optional fields on top
// (secondaryMuscles, equipment, movementCategory, brand, notes, archived, createdAt). Nothing
// here reads or writes state.logs/workoutSessions directly except the read-only usage check
// below, so progression, PRs, and exports keep working off exMap/allExercises exactly as they
// do for built-ins with zero extra wiring.

// No existing "equipment type" or "movement category" taxonomy exists anywhere in BRK's schema
// today, so these are defined fresh here, scoped only to custom exercises, using the exact
// enumerations the feature spec called for — not a general reclassification of the catalog.
export const EQUIPMENT_TYPES = [
  "Barbell",
  "Dumbbell",
  "Machine",
  "Plate Loaded",
  "Selectorized",
  "Cable",
  "Bodyweight",
  "Smith Machine",
  "Band",
  "Kettlebell",
  "Other",
];

export const MOVEMENT_CATEGORIES = [
  "Press",
  "Row",
  "Pulldown",
  "Fly",
  "Curl",
  "Extension",
  "Squat",
  "Hinge",
  "Lunge",
  "Raise",
  "Calf Raise",
  "Core",
  "Carry",
  "Other",
];

// A movement category that's typically loaded as one heavy multi-joint lift gets the built-in
// "compound" 5 lb progression increment; everything else (including no category picked at all)
// gets the more conservative 2.5 lb "isolation" increment. This only feeds the EXISTING
// increment() switch in progression.js — it doesn't add a new axis to the algorithm.
const COMPOUND_MOVEMENT_CATEGORIES = new Set(["Press", "Row", "Pulldown", "Squat", "Hinge", "Lunge"]);
export function inferExerciseType(movementCategory) {
  return COMPOUND_MOVEMENT_CATEGORIES.has(movementCategory) ? "compound" : "isolation";
}

// Name-decoupled: the ID never embeds the original name, so renaming later can never even
// tempt someone into regenerating it. Matches the brkcoach_* id pattern used elsewhere in BRK.
export function generateCustomExerciseId() {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeForCompare(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Exact match only (case/whitespace-insensitive) — deliberately NOT fuzzy. "Prime Incline
// Press" and "Prime Incline Press — Gym 2" are a real, intentional example of two exercises
// that must NOT be flagged as duplicates, so anything looser than exact-normalized-match would
// misfire on exactly the case the spec calls out.
export function findDuplicateExercise(name, allExercises) {
  const target = normalizeForCompare(name);
  if (!target) return null;
  return allExercises.find((ex) => normalizeForCompare(ex.name) === target) || null;
}

export function isArchived(ex) {
  return !!ex?.archived;
}

// Archived exercises drop out of normal browse/search/picker results but stay fully resolvable
// via exMap (built from the unfiltered list) for history, PRs, progression, and export — this
// filter is only ever applied at the picker/search UI layer, never to exMap itself.
export function selectableExercises(allExercises) {
  return allExercises.filter((ex) => !isArchived(ex));
}

export function matchesExerciseSearch(ex, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    ex.name.toLowerCase().includes(q) ||
    (ex.muscle || "").toLowerCase().includes(q) ||
    (ex.brand || "").toLowerCase().includes(q)
  );
}

// Everywhere a custom exercise's permanent ID could be referenced. Logs and workoutSessions
// cover history/PRs/progression (PRs are derived on the fly from logs, not a separate store);
// customPlans/customPrograms cover saved programs and workout templates. Built-in programs
// (state.programs) are fixed hero-program data that can never reference a custom exercise ID,
// so they're intentionally not scanned.
export function exerciseUsageCount(exId, state) {
  let count = 0;
  (state.logs || []).forEach((l) => {
    if (l.exId === exId) count++;
  });
  (state.workoutSessions || []).forEach((s) => {
    (s.entries || []).forEach((e) => {
      if (e.exId === exId) count++;
    });
  });
  (state.customPlans || []).forEach((p) => {
    (p.exercises || []).forEach((e) => {
      if (e.exId === exId) count++;
    });
  });
  (state.customPrograms || []).forEach((p) => {
    (p.days || []).forEach((d) => {
      (d.exercises || []).forEach((e) => {
        if (e.exId === exId) count++;
      });
    });
  });
  return count;
}

export function isExerciseUsedAnywhere(exId, state) {
  return exerciseUsageCount(exId, state) > 0;
}

// "Atlantis Pendulum Squat / Custom • Quads • Plate Loaded" — omits movement category/brand
// from the compact label; those stay one tap away rather than crowding every list row.
export function formatCustomLabel(ex) {
  const parts = ["Custom"];
  if (ex.muscle) parts.push(ex.muscle);
  if (ex.equipment) parts.push(ex.equipment);
  return parts.join(" • ");
}
