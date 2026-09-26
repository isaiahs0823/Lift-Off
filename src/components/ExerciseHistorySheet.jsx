import React, { useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { profilesForExercise, equipmentDisplayLabel, sameEquipmentBucket, TEMPORARY_EQUIPMENT_CONTEXT, DEFAULT_MACHINE_LABEL } from "../utils/equipmentProfiles.js";
import { topSetOf } from "../utils/progression.js";

// Athlete-facing "every prior instance of this movement" (task: "BRK Workout History — Exercise
// History"). Reads state.logs directly by exId — the same durable history every progression/PR
// calculation already uses — never a reconstructed approximation. Rendered as a fixed overlay
// (task section 11: "open as a sheet/panel... without leaving the workout permanently") so the
// caller (TrainingExerciseCard's "History" link, or the exercise catalog) stays mounted
// underneath and nothing about an in-progress set gets lost.
export default function ExerciseHistorySheet({ exId, exMap, state, onClose }) {
  const exName = exMap[exId]?.name || exId;
  const profiles = profilesForExercise(state, exId);

  const allLogs = useMemo(
    () => (state.logs || []).filter((l) => l.exId === exId).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [state.logs, exId]
  );

  // Equipment filter tabs only appear once there's actually more than one machine in this
  // exercise's history to separate (task section 6: "do not combine machine histories into one
  // fake progression line" — but there's nothing to disambiguate for an exercise nobody has
  // ever touched the Equipment selector on).
  const hasMultipleBuckets =
    new Set(
      allLogs.map((l) => (l.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT ? `temp_${l.id}` : l.equipmentProfileId || "default"))
    ).size > 1;

  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "default" | <profileId>
  const filteredLogs =
    activeFilter === "all"
      ? allLogs
      : allLogs.filter((l) => sameEquipmentBucket(l, activeFilter === "default" ? null : activeFilter, null));

  const best = useMemo(() => {
    let bestSet = null;
    filteredLogs.forEach((log) => {
      const top = topSetOf(log.sets);
      if (top && (!bestSet || top.weight > bestSet.weight)) bestSet = top;
    });
    return bestSet;
  }, [filteredLogs]);

  return (
    <div className="fixed inset-0 z-40 bg-v5-bg overflow-y-auto">
      <div className="p-4 sm:p-6 space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-v5-subtext hover:text-v5-red p-1 -ml-1 shrink-0" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold">History</div>
            <div className="text-lg font-black text-v5-text truncate">{exName}</div>
          </div>
        </div>

        {hasMultipleBuckets && (
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveFilter("all")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold border ${
                activeFilter === "all" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              All Equipment
            </button>
            <button
              onClick={() => setActiveFilter("default")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold border ${
                activeFilter === "default" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              {DEFAULT_MACHINE_LABEL}
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveFilter(p.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-widest font-bold border ${
                  activeFilter === p.id ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {filteredLogs.length > 0 && (
          <div className="bg-v5-surface rounded-xl p-3 flex items-center justify-around text-center">
            <div>
              <div className="text-lg font-black text-v5-text tabular-nums">{best ? `${best.weight} × ${best.reps}` : "—"}</div>
              <div className="text-[11px] uppercase tracking-wide text-v5-subtext mt-0.5">Best set</div>
            </div>
            <div>
              <div className="text-lg font-black text-v5-text tabular-nums">{filteredLogs.length}</div>
              <div className="text-[11px] uppercase tracking-wide text-v5-subtext mt-0.5">Sessions</div>
            </div>
          </div>
        )}

        {filteredLogs.length === 0 ? (
          <div className="text-center text-sm text-v5-subtext py-10">
            {activeFilter === "all" ? "No history logged for this exercise yet." : "No history on this equipment yet."}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div key={log.id} className="border-t border-white/[0.06] pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[11px] uppercase tracking-widest text-v5-red font-bold">
                    {new Date(log.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                  {/* Equipment context stays visible per set-block (task section 5: "equipment
                      context must remain visible"), even when "All Equipment" is selected. */}
                  <div className="text-[11px] text-v5-subtext truncate">{equipmentDisplayLabel(state, log.equipmentProfileId, log.equipmentContext)}</div>
                </div>
                <div className="space-y-0.5">
                  {log.sets.map((s, i) => (
                    <div key={i} className="text-sm text-v5-text tabular-nums flex items-center gap-1.5">
                      <span>{s.weight} × {s.reps}</span>
                      {s.setType === "warmup" && <span className="text-[10px] uppercase tracking-wide text-v5-subtext/60">warm-up</span>}
                      {s.drops?.length > 0 && <span className="text-[10px] uppercase tracking-wide text-v5-subtext/60">+{s.drops.length} drop</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
