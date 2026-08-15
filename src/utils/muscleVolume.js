// ---------------- MUSCLE-GROUP VOLUME ----------------
// Weekly working-sets-per-muscle-group tracking — the backbone of Bodybuilding Coach's volume
// reasoning (section 15/19/26 of the spec), but written as a general-purpose utility (not
// specialty-coupled) since any future specialty could reasonably want it too.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Sums working sets (warm-ups excluded, matching the app-wide countedSets convention) by
// muscle group for every log whose date falls in [startMs, endMs).
export function muscleVolumeInRange(state, exMap, startMs, endMs) {
  const counts = {};
  (state.logs || []).forEach((l) => {
    const t = new Date(l.date).getTime();
    if (t < startMs || t >= endMs) return;
    const muscle = exMap[l.exId]?.muscle;
    if (!muscle) return;
    const workingSets = (l.sets || []).filter((s) => s.setType !== "warmup").length;
    counts[muscle] = (counts[muscle] || 0) + workingSets;
  });
  return counts;
}

export function weeklyMuscleVolume(state, exMap, days = 7) {
  const now = Date.now();
  return muscleVolumeInRange(state, exMap, now - days * MS_PER_DAY, now);
}

// This week vs. the week before, per muscle — "up"/"down"/"flat" for a weekly-review arrow.
// A muscle with zero sets in both windows is omitted rather than reported as "flat."
export function muscleVolumeTrend(state, exMap) {
  const now = Date.now();
  const thisWeek = muscleVolumeInRange(state, exMap, now - 7 * MS_PER_DAY, now);
  const lastWeek = muscleVolumeInRange(state, exMap, now - 14 * MS_PER_DAY, now - 7 * MS_PER_DAY);
  const muscles = new Set([...Object.keys(thisWeek), ...Object.keys(lastWeek)]);
  const trend = {};
  muscles.forEach((m) => {
    const a = thisWeek[m] || 0;
    const b = lastWeek[m] || 0;
    if (a === 0 && b === 0) return;
    trend[m] = a > b ? "up" : a < b ? "down" : "flat";
  });
  return trend;
}
