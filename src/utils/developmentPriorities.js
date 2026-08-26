// ---------------- DEVELOPMENT PRIORITIES ----------------
// Lets an athlete tell BRK which muscle groups matter most to them. Purely informational/coach-
// context input for now (task: "This is NOT permission to automatically rewrite curated BRK
// programs" / "store the athlete's priorities and surface them to Coach/context") — nothing here
// ever touches a program's own days or exercises. Pure functions only, no React/localStorage,
// matching programSchedule.js/mobilitySession.js's own discipline.

// Architecture supports future expansion (task section 11) — anything added to this array is
// automatically picked up by defaultDevelopmentPriorities/groupedPriorities/labelFor without
// touching the interaction code below.
export const MUSCLE_GROUPS = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "glutes", label: "Glutes" },
  { id: "calves", label: "Calves" },
];

export const PRIORITY_LEVELS = ["prioritize", "develop", "maintain"];
export const PRIORITY_LEVEL_LABEL = { prioritize: "Prioritize", develop: "Develop", maintain: "Maintain" };
// Original BRK copy (task section 16) — never the competitor phrasing this feature was
// deliberately kept separate from.
export const PRIORITY_LEVEL_EXPLANATION = {
  prioritize: "Give this area additional attention when your program and recovery allow it.",
  develop: "Train this area normally for consistent progress.",
  maintain: "Keep enough work to preserve what you've built while directing more resources elsewhere.",
};

export function labelFor(muscleId) {
  return MUSCLE_GROUPS.find((m) => m.id === muscleId)?.label || muscleId;
}

// New users default to DEVELOP for every muscle (task section 15: "Do NOT default every muscle
// to Prioritize") — rank starts as the catalog's own listed order, purely a starting point the
// athlete is free to rearrange.
export function defaultDevelopmentPriorities() {
  const out = {};
  MUSCLE_GROUPS.forEach((m, i) => {
    out[m.id] = { level: "develop", rank: i + 1 };
  });
  return out;
}

// Defends against a missing/partial/corrupted saved value the same way sanitizeActiveRun does
// for workouts — any muscle missing from a raw saved object gets the same DEVELOP default rather
// than the whole feature breaking on old/hand-edited data.
export function sanitizeDevelopmentPriorities(raw) {
  const base = defaultDevelopmentPriorities();
  if (!raw || typeof raw !== "object") return base;
  const merged = { ...base };
  MUSCLE_GROUPS.forEach((m) => {
    const entry = raw[m.id];
    if (entry && PRIORITY_LEVELS.includes(entry.level) && Number.isFinite(entry.rank)) {
      merged[m.id] = { level: entry.level, rank: entry.rank };
    }
  });
  return renumbered(merged);
}

// { prioritize: [muscleId, ...], develop: [...], maintain: [...] } — each level's array already
// sorted in rank order, exactly what the three-section UI iterates over directly.
export function groupedPriorities(priorities) {
  const groups = { prioritize: [], develop: [], maintain: [] };
  Object.entries(priorities).forEach(([id, entry]) => {
    if (groups[entry.level]) groups[entry.level].push({ id, rank: entry.rank });
  });
  PRIORITY_LEVELS.forEach((level) => groups[level].sort((a, b) => a.rank - b.rank));
  return {
    prioritize: groups.prioritize.map((e) => e.id),
    develop: groups.develop.map((e) => e.id),
    maintain: groups.maintain.map((e) => e.id),
  };
}

// Re-flattens rank to a clean 1..N sequence across all three levels in level order (Prioritize
// first, then Develop, then Maintain), each level internally still sorted by its old rank — the
// same "global rank position" the task's own example shows (Prioritize items numbered 1-3,
// Develop continuing 4-7, Maintain 8-9). Called after every mutation so ranks never drift or
// collide; nothing outside this file ever needs to renumber by hand.
function renumbered(priorities) {
  const grouped = groupedPriorities(priorities);
  const out = {};
  let rank = 1;
  PRIORITY_LEVELS.forEach((level) => {
    grouped[level].forEach((id) => {
      out[id] = { level, rank: rank++ };
    });
  });
  return out;
}

// Moves `muscleId` to `newLevel`, placed at the end of that level's current order — the
// tier-chip tap action. Reordering within a level is a separate, explicit action (see
// reorderMuscleBefore) so the two gestures never fight each other.
export function moveMuscleToLevel(priorities, muscleId, newLevel) {
  if (!PRIORITY_LEVELS.includes(newLevel) || !priorities[muscleId]) return priorities;
  const next = { ...priorities, [muscleId]: { level: newLevel, rank: priorities[muscleId].rank } };
  return renumbered(next);
}

// The "tap to select, tap to place" reorder gesture (task: an ORIGINAL BRK interaction, not a
// competitor's up/down-arrow modal): moves `muscleId` to sit immediately before `beforeMuscleId`
// within their shared level. Both must already be in the same level — moving between levels is
// moveMuscleToLevel's job, not this one's. `beforeMuscleId: null` means "move to the end of the
// level" (tapping past the last row).
export function reorderMuscleBefore(priorities, muscleId, beforeMuscleId) {
  const moving = priorities[muscleId];
  if (!moving) return priorities;
  if (beforeMuscleId && priorities[beforeMuscleId]?.level !== moving.level) return priorities;
  const grouped = groupedPriorities(priorities);
  const levelOrder = grouped[moving.level].filter((id) => id !== muscleId);
  const insertAt = beforeMuscleId ? levelOrder.indexOf(beforeMuscleId) : levelOrder.length;
  const safeIndex = insertAt === -1 ? levelOrder.length : insertAt;
  levelOrder.splice(safeIndex, 0, muscleId);

  const next = { ...priorities };
  levelOrder.forEach((id, i) => {
    next[id] = { level: moving.level, rank: i }; // temporary intra-level order; renumbered() below finalizes real ranks
  });
  return renumbered(next);
}

// Compact summary for Coach context (task section 21) — only muscles NOT at the default "develop
// with no stated opinion" position are worth mentioning; a user who never touched this screen
// contributes nothing extra to Coach's context, same "ambient, not noisy" discipline every other
// coachContext.js field already follows.
export function priorityCoachSummary(priorities) {
  const grouped = groupedPriorities(priorities);
  if (grouped.prioritize.length === 0 && grouped.maintain.length === 0) return null;
  return {
    prioritize: grouped.prioritize.map(labelFor),
    develop: grouped.develop.map(labelFor),
    maintain: grouped.maintain.map(labelFor),
  };
}
