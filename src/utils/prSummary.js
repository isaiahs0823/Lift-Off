// ---------------- PR SESSION SUMMARIZATION ----------------
// Shared by App.jsx (Session Complete screen), coachService.js (post-workout message),
// shareCard.js (share cards), and TrainingCalendar.jsx (day detail) — a single source of
// truth for "how many PRs happened this session," so every surface agrees.
//
// detectPRs() can fire several PR *types* (weight, reps, e1RM, exercise volume) from one
// single improved set on one exercise — those are one meaningful event to a lifter, not four.
// Everything here counts/summarizes by *exercise*, not by raw PR-type occurrence.

const PR_TYPE_PRIORITY = { weight: 0, reps: 1, e1rm: 2, exerciseVolume: 3 };
export const PR_TYPE_LABEL = { weight: "Weight PR", reps: "Rep PR", e1rm: "Est. 1RM PR", exerciseVolume: "Volume PR" };

// Groups summary.prs by exercise, keeps only the single most notable PR type per exercise,
// then orders them with the exercise matching the session's own bestLift first (so the
// featured PR and the "Best lift" stat never disagree) and the more notable PR types next.
export function featuredAndOtherPRs(summary) {
  if (!summary?.prs?.length) return { featured: null, others: [] };
  const byExercise = new Map();
  summary.prs.forEach((pr) => {
    if (!byExercise.has(pr.exId)) byExercise.set(pr.exId, []);
    byExercise.get(pr.exId).push(pr);
  });
  const perExercise = [...byExercise.entries()].map(([exId, prs]) => ({
    exId,
    pr: [...prs].sort((a, b) => PR_TYPE_PRIORITY[a.type] - PR_TYPE_PRIORITY[b.type])[0],
  }));
  perExercise.sort((a, b) => {
    const aMatch = summary.bestLift && a.exId === summary.bestLift.exId ? 0 : 1;
    const bMatch = summary.bestLift && b.exId === summary.bestLift.exId ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return PR_TYPE_PRIORITY[a.pr.type] - PR_TYPE_PRIORITY[b.pr.type];
  });
  const [featured, ...others] = perExercise;
  return { featured, others };
}

// The number to show anywhere a session says "N PRs" — distinct exercises that set a record,
// not raw PR-type occurrences.
export function sessionPRCount(summary) {
  if (!summary?.prs?.length) return 0;
  return new Set(summary.prs.map((p) => p.exId)).size;
}

// Compact "+N" delta for the "Other PRs" list and share cards.
export function prDeltaLabel(pr) {
  if (pr.type === "weight") return `+${Math.round((pr.weight - pr.prev) * 10) / 10} lb`;
  if (pr.type === "reps") return `+${pr.reps - pr.prev} rep${pr.reps - pr.prev === 1 ? "" : "s"}`;
  if (pr.type === "e1rm") return `+${pr.value - pr.prev} lb`;
  if (pr.type === "exerciseVolume") return `+${(pr.value - pr.prev).toLocaleString()} lb`;
  return "";
}
export function prHeroLabel(pr) {
  if (pr.type === "exerciseVolume") return `${pr.value.toLocaleString()} lb`;
  return `${pr.weight} × ${pr.reps}`;
}
export function prPreviousLabel(pr) {
  if (pr.type === "weight") return `${pr.prev} lb`;
  if (pr.type === "reps") return `${pr.weight} × ${pr.prev}`;
  if (pr.type === "e1rm") return `${pr.prev} lb`;
  if (pr.type === "exerciseVolume") return `${pr.prev.toLocaleString()} lb`;
  return "";
}
