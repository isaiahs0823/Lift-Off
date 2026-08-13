// ---------------- ADHERENCE ----------------
// "Did what you said you'd do actually happen." Deliberately boring math — three simple
// ratios (strength sessions, cardio sessions, check-ins) averaged together, no streak
// bonuses, no compounding multipliers. A score you could recompute by hand from the log.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function inWindow(dateStr, days) {
  return new Date(dateStr).getTime() >= Date.now() - days * MS_PER_DAY;
}
function uniqueDayCount(dates) {
  return new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10))).size;
}

// days: the window size (7 for weekly, 30 for monthly). Strength target comes from an active
// "consistency" goal (train N days/week) if one exists, else defaults to 3/week so the score
// never divides by zero. Cardio only factors in if the user has set a cardio-frequency goal —
// otherwise there's nothing to hold it accountable to, so it's left out of the average rather
// than silently scored against an invented target.
export function computeAdherence(state, days = 7) {
  const consistencyGoal = (state.goals || []).find((g) => g.type === "consistency" && g.status === "active");
  const plannedPerWeek = consistencyGoal?.targetValue || 3;
  const plannedSessions = Math.max(1, Math.round((plannedPerWeek * days) / 7));

  const strengthDays = uniqueDayCount(
    (state.workoutSessions || []).filter((s) => inWindow(s.finishedAt, days)).map((s) => s.finishedAt)
  );
  const strengthPct = Math.min(100, Math.round((strengthDays / plannedSessions) * 100));

  const cardioGoal = (state.goals || []).find((g) => g.type === "cardio_frequency" && g.status === "active");
  let cardioPct = null;
  if (cardioGoal?.targetValue) {
    const cardioPlanned = Math.max(1, Math.round((cardioGoal.targetValue * days) / 7));
    const cardioDays = uniqueDayCount((state.cardioLogs || []).filter((c) => inWindow(c.date, days)).map((c) => c.date));
    cardioPct = Math.min(100, Math.round((cardioDays / cardioPlanned) * 100));
  }

  const checkinDays = uniqueDayCount((state.bodyweightLogs || []).filter((b) => inWindow(b.date, days)).map((b) => b.date));
  const checkinPct = Math.min(100, Math.round((checkinDays / days) * 100));

  const parts = [strengthPct, checkinPct, ...(cardioPct != null ? [cardioPct] : [])];
  const overall = Math.round(parts.reduce((s, p) => s + p, 0) / parts.length);

  return { overall, strengthPct, cardioPct, checkinPct, plannedSessions, strengthDays };
}
