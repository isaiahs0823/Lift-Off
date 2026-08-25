// Formats a plan/program exercise slot's sets/reps for display. Shared by every screen that
// lists exercise rows (My Plan/program previews in App.jsx, the workout/day preview in
// TrainTab.jsx) so the format stays identical everywhere rather than being reimplemented per
// screen. `reps` stays the plain representative number every plan already stores; `repRange`/
// `rir` are optional richer-prescription fields (see HERO_PROGRAMS in App.jsx) that upgrade the
// display when present and fall back cleanly when they're not.
export function formatSetPrescription(e) {
  const reps = Array.isArray(e.repRange) ? `${e.repRange[0]}–${e.repRange[1]}` : e.reps;
  const rir = Array.isArray(e.rir) ? ` · RIR ${e.rir[0]}–${e.rir[1]}` : "";
  return `${e.sets} × ${reps}${rir}`;
}
