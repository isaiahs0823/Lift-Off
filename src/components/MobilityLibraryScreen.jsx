import { useMemo, useState } from "react";
import { ChevronRight, Search, X, Play, Check } from "lucide-react";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import {
  MOBILITY_LIBRARY,
  MOBILITY_TYPE_LABEL,
  MOBILITY_TYPE_FILTERS,
  RECOVERY_ROUTINES,
  mobilityAnatomyExercise,
} from "../data/mobilityLibrary.js";
import { estimateRoutineMinutes, findTodaysRecoverySessionForPlan, recoveryPlanName } from "../utils/mobilitySession.js";

// Region chips grouped down to the task's suggested top-level filter set (section 7) — the full
// 17-region taxonomy (MOBILITY_REGIONS) is still what each movement is tagged with for search/
// matching, this is just the compact primary filter row so the screen isn't a wall of chips.
const REGION_FILTERS = [
  { label: "All", test: null },
  { label: "Hips", test: (regions) => regions.some((r) => ["Hips", "Glutes", "Hip Flexors", "Adductors"].includes(r)) },
  { label: "Shoulders", test: (regions) => regions.includes("Shoulders") },
  { label: "Back", test: (regions) => regions.some((r) => ["Lats", "Upper Back", "Thoracic Spine", "Lower Back"].includes(r)) },
  { label: "Legs", test: (regions) => regions.some((r) => ["Quads", "Hamstrings", "Calves", "Ankles"].includes(r)) },
  { label: "Full Body", test: (regions) => regions.includes("Full Body") },
];

function prescriptionLabel(movement) {
  const side = movement.perSide ? " / side" : "";
  if (movement.durationRange) {
    const [lo, hi] = movement.durationRange;
    return `${lo === hi ? lo : `${lo}–${hi}`} sec${side}`;
  }
  if (movement.repsRange) {
    const [lo, hi] = movement.repsRange;
    return `${lo}–${hi} reps${side}`;
  }
  return "";
}

function MovementCard({ movement, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left border border-white/10 bg-v5-elevated p-3 flex items-center gap-3 hover:border-v5-red/40">
      <MuscleBodyOutline exercise={mobilityAnatomyExercise(movement)} size="compact" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white truncate">{movement.name}</div>
        <div className="text-[11px] text-v5-subtext mt-0.5 truncate">
          {movement.bodyRegion.join(", ")} · {MOBILITY_TYPE_LABEL[movement.type]}
        </div>
        <div className="text-[11px] text-v5-subtext/70 mt-0.5">{prescriptionLabel(movement)}</div>
      </div>
      <ChevronRight size={16} className="text-v5-subtext/70 shrink-0" />
    </button>
  );
}

function RoutineRow({ routine, state, onStart, onLogManual }) {
  const minutes = estimateRoutineMinutes(routine);
  const completedToday = findTodaysRecoverySessionForPlan(state, recoveryPlanName({ routine }));
  return (
    <div className="border border-white/10 bg-v5-elevated p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{routine.name}</div>
          <div className="text-[11px] text-v5-subtext mt-0.5">
            {routine.movements.length} movements · Est. {minutes} min
          </div>
        </div>
        {completedToday && (
          <span className="text-[11px] uppercase tracking-widest text-green-500 flex items-center gap-1 shrink-0">
            <Check size={10} /> Done today
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onStart(routine)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
        >
          <Play size={12} /> Start
        </button>
        <button
          onClick={() => onLogManual(routine)}
          className="px-3 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40"
        >
          Log Recovery Session
        </button>
      </div>
    </div>
  );
}

// The single entry point for BRK's mobility/stretching system — reached from More → Mobility &
// Stretching. Two sections: named recovery ROUTINES (the same ones a program's recovery day
// references — see mobilityLibrary.js) for "just run something," and the full movement library
// for browsing/searching individual stretches. Keeps the same search-then-filter-chips pattern
// SwapWorkoutSheet already established rather than inventing a new browse UX.
export default function MobilityLibraryScreen({ state, onSelectMovement, onStartRoutine, onLogManualRoutine }) {
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const region = REGION_FILTERS.find((r) => r.label === regionFilter);
    return MOBILITY_LIBRARY.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.bodyRegion.some((r) => r.toLowerCase().includes(q))) return false;
      if (region?.test && !region.test(m.bodyRegion)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      return true;
    });
  }, [search, regionFilter, typeFilter]);

  const browsing = !!(search.trim() || typeFilter || regionFilter !== "All");

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-v5-red">More</div>
        <div className="text-xl font-bold text-white mt-1">Mobility &amp; Stretching</div>
      </div>

      {!browsing && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Recovery routines</div>
          {RECOVERY_ROUTINES.map((routine) => (
            <RoutineRow key={routine.id} routine={routine} state={state} onStart={(r) => onStartRoutine(r, null)} onLogManual={(r) => onLogManualRoutine(r, null)} />
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-v5-subtext/70" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mobility…"
          className="w-full bg-v5-elevated border border-white/10 pl-8 pr-8 py-2.5 text-sm text-v5-text placeholder-neutral-600 focus:border-v5-red focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-v5-subtext/70 hover:text-v5-text/90" aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {REGION_FILTERS.map((r) => (
          <button
            key={r.label}
            onClick={() => setRegionFilter(r.label)}
            className={`shrink-0 px-2.5 py-1 text-[11px] uppercase tracking-widest font-bold border ${
              regionFilter === r.label ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {MOBILITY_TYPE_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter((cur) => (cur === t ? null : t))}
            className={`shrink-0 px-2.5 py-1 text-[11px] uppercase tracking-widest font-bold border ${
              typeFilter === t ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
            }`}
          >
            {MOBILITY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-sm text-v5-subtext/70 py-6 text-center">No movements match.</div>}
        {filtered.map((m) => (
          <MovementCard key={m.id} movement={m} onClick={() => onSelectMovement(m.id)} />
        ))}
      </div>
    </div>
  );
}
