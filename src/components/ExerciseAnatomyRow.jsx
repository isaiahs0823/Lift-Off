import MuscleBodyOutline from "./MuscleBodyOutline.jsx";

// One shared row used everywhere a program/plan/workout-preview lists exercises: My Plan/program
// day detail, the workout/day preview, and anywhere else that needs the same
// [anatomy] name / muscle / sets-reps treatment. Keeping this in one component is what makes
// "same mapping logic everywhere" concrete — every caller passes the same `exercise` (an
// exMap[exId] entry, so custom exercises degrade the same way named ones do) into the same
// MuscleBodyOutline, rather than each screen deciding for itself how to size or highlight it.
//
// Hierarchy on purpose: exercise name is the only bold/dominant line; muscle label and
// prescription are both secondary (same size, muted) so the row stays scannable rather than
// competing headlines. The anatomy figure is supplemental, not the only way the target muscle is
// communicated — the muscle name is always printed as text alongside it.
export default function ExerciseAnatomyRow({ exercise, exId, name, prescription, group, size = "compact" }) {
  const displayName = name || exercise?.name || exId;
  const muscle = exercise?.muscle;

  return (
    <div className="flex items-center gap-3 py-1.5 border-t border-neutral-900">
      <MuscleBodyOutline exercise={exercise} size={size} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-neutral-200 truncate">
          {displayName}
          {group ? ` (${group})` : ""}
        </div>
        {muscle && <div className="text-[11px] text-neutral-500 truncate mt-0.5">{muscle}</div>}
        {prescription && <div className="text-[11px] text-neutral-600 mt-0.5">{prescription}</div>}
      </div>
    </div>
  );
}
