// ---------------- PROGRAM SCHEDULE ----------------
// Resolves state.currentProgram into the actual program/day data, or null if the program was
// deleted (custom program removed) or none is active. Pure function of state — no React,
// hence its own file rather than living in App.jsx (also used by the coach context engine).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// When the program has a weeks field and enough real time has elapsed since startDate,
// returns an isComplete result instead of a day to run.
export function resolveCurrentProgramDay(state) {
  const cp = state.currentProgram;
  if (!cp) return null;
  const list = cp.source === "custom" ? state.customPrograms || [] : state.programs || [];
  const prog = list.find((p) => p.id === cp.programId);

  // dayIndex advances the instant a workout finishes (see finishRun in App.jsx), so by itself
  // it always points at the *next* day to start. Without this, the Today card would jump
  // straight to tomorrow's workout the moment today's is logged, instead of staying on today's
  // day for the rest of the calendar day. lastCompletedAt/lastCompletedDayIndex record what was
  // actually finished and when, so the resolved day only moves forward once the real date does.
  const todayStr = new Date().toISOString().slice(0, 10);
  const completedToday = !!(cp.lastCompletedAt && cp.lastCompletedAt.slice(0, 10) === todayStr);
  const effectiveDayIndex = completedToday && cp.lastCompletedDayIndex != null ? cp.lastCompletedDayIndex : cp.dayIndex;

  if (!prog || !prog.days || !prog.days[effectiveDayIndex]) return null;

  const totalWeeks = prog.weeks || null;
  let weekNumber = null;
  if (cp.startDate && totalWeeks) {
    const daysElapsed = Math.max(0, Math.floor((Date.now() - new Date(cp.startDate).getTime()) / MS_PER_DAY));
    weekNumber = Math.floor(daysElapsed / 7) + 1;
  }

  const programContext = {
    programId: prog.id,
    programName: prog.name,
    source: cp.source,
    dayIndex: effectiveDayIndex,
    totalDays: prog.days.length,
  };

  if (weekNumber !== null && weekNumber > totalWeeks) {
    return { isComplete: true, programName: prog.name, totalWeeks, programContext };
  }

  const day = prog.days[effectiveDayIndex];
  return {
    isComplete: false,
    completedToday,
    programName: prog.name,
    dayLabel: day.label,
    dayIndex: effectiveDayIndex,
    totalDays: prog.days.length,
    weekNumber,
    totalWeeks,
    plan: { name: `${prog.name} — ${day.label}`, exercises: day.exercises },
    programContext,
  };
}
