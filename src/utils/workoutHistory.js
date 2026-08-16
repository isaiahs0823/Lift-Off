// ---------------- WORKOUT HISTORY LOOKUP ----------------
// Small shared helpers for finding a completed session by plan name — used everywhere a
// screen needs to say "has this specific workout already been done, and if so which session is
// it" (Today's completed card, the Program day list, ...). One implementation so every surface
// agrees on what counts as "the most recent completion of this plan."
export function findMostRecentSessionForPlan(sessions, planName) {
  if (!planName) return null;
  const matches = (sessions || [])
    .filter((s) => s.planName === planName)
    .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt));
  return matches[0] || null;
}

export function findTodaysSessionForPlan(sessions, planName) {
  const session = findMostRecentSessionForPlan(sessions, planName);
  if (!session) return null;
  const todayKey = new Date().toISOString().slice(0, 10);
  return session.finishedAt.slice(0, 10) === todayKey ? session : null;
}
