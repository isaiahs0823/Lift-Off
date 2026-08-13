// ---------------- COACH SERVICE ----------------
// The one place "AI coach" behavior lives. It is NOT a call to a hosted language model —
// this is a static app with no backend, and putting a provider API key in client-side code
// would expose it to anyone who opens devtools (see spec section 24/26). So this is a
// deterministic, rule-based layer that reasons over the same structured context a real model
// would get (see coachContext.js), in the same direct/disciplined voice the spec asks for.
// If a real server-side proxy is ever stood up, everything above this file (the UI) can stay
// exactly the same — only these function bodies would change to fetch() a hosted model.
//
// Tone rules followed throughout: direct, concise, disciplined, practical. Encouraging only
// when the data actually earns it. Never fake-positive, never insulting. Sometimes the
// correct output is just "no adjustment needed" — every generator below is willing to say
// that instead of manufacturing a reason to comment.

import { computeWeeklyReview } from "../utils/weeklyReview.js";

const SAFETY_PATTERN =
  /\b(injur(y|ed|ies)|hurt|sharp pain|numb(ness)?|tingling|dizzy|dizziness|chest pain|can'?t breathe|shortness of breath|medication|prescri|steroid|anabolic|\bpeds?\b|sarms?|hgh|clenbuterol|starv(e|ing)|purg(e|ing)|dehydrat)\b/i;

const SAFETY_RESPONSE =
  "That's outside what this coach can weigh in on safely. If something hurts, feels wrong, or involves your health or medication, get it checked by a qualified professional before you keep training through it.";

export function isSafetyDeflection(text) {
  return SAFETY_PATTERN.test(text || "");
}

// ---------- Today snapshot ----------
// One short line for the Today dashboard's coach card — distinct from the morning check-in
// (which is specifically about readiness) and from Coach Me's answers (which are
// question-driven). Priority order: a missed-session streak worth naming, then a moving
// bodyweight trend, then goal progress, then a plain "nothing to report yet."
export function generateTodaySnapshot(context) {
  const { recentWeightTrend, daysSinceLastSession, userGoal } = context;
  if (daysSinceLastSession != null && daysSinceLastSession >= 3) {
    return {
      message: `${daysSinceLastSession} days since your last session. One missed session means nothing. Don't turn it into a habit — get today's workout done.`,
    };
  }
  if (recentWeightTrend?.weeklyRate != null && Math.abs(recentWeightTrend.weeklyRate) >= 0.1) {
    const dir = recentWeightTrend.weeklyRate < 0 ? "down" : "up";
    return { message: `Weight trend is moving ${dir} and strength is holding. Don't change anything.` };
  }
  if (userGoal) {
    return { message: `${userGoal.title}: ${userGoal.progressPct}% there. Keep executing.` };
  }
  return { message: "Log today's session and I'll start giving you real feedback." };
}

// ---------- Morning check-in ----------
// After a readiness check-in: interpretation, today's training expectation, one focus point.
export function generateMorningCheckIn(context) {
  const { readiness, todayWorkout } = context;
  if (!readiness || !readiness.loggedToday) {
    return { message: "No readiness check-in logged yet today. Do that first — every suggestion after it gets sharper for it." };
  }
  const { score, band } = readiness;
  const workoutNote = todayWorkout ? ` Today: ${todayWorkout.planName}.` : "";
  let line;
  if (band === "green") {
    line = `Train as planned. Push progression where performance allows.${workoutNote}`;
  } else if (band === "yellow") {
    line = `Train, but keep compounds around 1-2 RIR today. Don't turn a mediocre recovery day into a bad training day by chasing numbers.${workoutNote}`;
  } else {
    line = `Recovery is poor. Reduce volume and intensity, and prioritize movement quality today.${todayWorkout ? " If you train, keep it light." : ""}`;
  }
  return { message: `Readiness is ${score}.\n\n${line}` };
}

// ---------- Pre-workout ----------
// focus: { name, lastWeight, lastReps, suggestedWeight, suggestedReps } for the session's
// headline lift (usually the first exercise). Optional — still returns a readiness-only line
// if there's nothing to preview yet.
export function generatePreWorkoutAdvice(context, focus) {
  const band = context.readiness?.band;
  if (!focus) {
    if (band === "red") return { message: "Readiness is poor today. Reduce volume and intensity, and prioritize movement quality." };
    return { message: "No prior session for today's lead exercise yet — today sets the baseline." };
  }
  const increased = focus.suggestedWeight > focus.lastWeight;
  let line;
  if (band === "red") {
    line = "Readiness is poor today. Hit your working sets with control — this isn't the day to chase a number.";
  } else if (increased) {
    line = "You've earned the increase. Hit clean reps. Don't sacrifice position just to say you moved more weight.";
  } else {
    line = "Repeat it clean. Beat last time on quality, not just the number.";
  }
  return { message: line };
}

// ---------- Post-workout ----------
// summary: a state.workoutSessions record (see buildSessionSummary in App.jsx).
export function generatePostWorkoutReview(summary) {
  if (!summary) return { message: "Session data not found." };
  const { prs = [], perfDeltaPct, avgRir } = summary;
  const lines = [];
  if (prs.length > 0) {
    lines.push(`${prs.length} PR${prs.length > 1 ? "s" : ""} this session. Strength is trending the right way.`);
  }
  if (perfDeltaPct != null) {
    if (perfDeltaPct > 5) lines.push(`Volume is up ${perfDeltaPct}% versus last time on this plan. Real progress, not noise.`);
    else if (perfDeltaPct < -10)
      lines.push(`Volume dropped ${Math.abs(perfDeltaPct)}% versus last time. Worth a look — check readiness, sleep, and whether the plan needs adjusting.`);
    else lines.push("Performance held steady versus last time on this plan. That's a fine outcome on its own.");
  }
  if (avgRir != null && avgRir <= 0.5) {
    lines.push("Average effort was right at failure across the board — fine occasionally, not every session.");
  }
  if (lines.length === 0) {
    lines.push("Session logged. No prior comparable session yet to grade it against — that baseline starts now.");
  }
  lines.push(lines.length > 1 || prs.length > 0 ? "Leave it alone. Recover and repeat." : "Nothing to adjust. Recover and repeat.");
  return { message: lines.join(" ") };
}

// ---------- Weekly review ----------
// review: output of computeWeeklyReview().
export function generateWeeklyReview(review) {
  const lines = [];
  if (review.plannedSessions != null) {
    lines.push(
      review.sessionsMissed === 0
        ? `${review.sessionsCompleted}/${review.plannedSessions} sessions completed. Training is on target.`
        : `${review.sessionsCompleted}/${review.plannedSessions} sessions completed — ${review.sessionsMissed} missed.`
    );
  } else {
    lines.push(`${review.sessionsCompleted} session${review.sessionsCompleted === 1 ? "" : "s"} completed this week.`);
  }
  if (review.strengthTrend === "improving") lines.push("Strength is trending up.");
  else if (review.strengthTrend === "declining") lines.push("Strength dipped this week — not a crisis after one week, but worth watching if it continues.");
  if (review.prCount > 0) lines.push(`${review.prCount} PR${review.prCount > 1 ? "s" : ""} logged.`);
  if (review.weakestArea && review.weakestArea.pct < 70) {
    lines.push(`${review.weakestArea.label} is where you're slipping (${review.weakestArea.pct}%). Next week, that's the focus — not more intensity elsewhere.`);
  } else {
    lines.push("No weak spot standing out this week. Keep executing the same plan.");
  }
  return { message: lines.join(" ") };
}

// ---------- Coach Me ----------
// Canned question handlers, matched by keyword. A question is never made up on the model's
// behalf — anything that doesn't match a known intent gets an honest status summary instead
// of a guessed answer.
function fmtGoalLine(g) {
  if (!g) return "No primary goal set — add one on the Mission tab so there's something to point this at.";
  const statusWord = { ahead: "ahead of pace", on_track: "on pace", behind: "behind pace", no_data: "not enough data yet to judge pace" }[g.status];
  return `${g.title}: ${g.progressPct}% there, ${statusWord}.`;
}

function answerWhatToday(context) {
  const parts = [];
  if (context.readiness?.loggedToday) {
    parts.push(generateMorningCheckIn(context).message);
  } else if (context.todayWorkout) {
    parts.push(`Today's session is ${context.todayWorkout.planName}. Log a readiness check-in first — it sharpens everything else.`);
  } else {
    parts.push("No program day queued up. Pick something from Templates or Build Plan.");
  }
  return { message: parts.join(" ") };
}

function answerIncreaseWeight(context) {
  if (!context.userGoal) return { message: "Open the exercise you mean — the Recommended box there factors in your last session and RIR automatically." };
  return {
    message:
      "Depends on the exercise — check its Recommended box: hitting target reps with 2+ RIR to spare means add load, grinding it out at 0-1 RIR means repeat it clean first.",
  };
}

function answerStalled(context) {
  const stallNote = context.coachMemory?.find((m) => m.key === "stalling_exercises");
  const weightNote = context.coachMemory?.find((m) => m.key === "bodyweight_plateau");
  if (stallNote) return { message: `${stallNote.text} Strength is holding, so training volume isn't automatically the issue — check sleep, stress, and whether the target reps need adjusting.` };
  if (weightNote && context.userGoal?.type === "weight") {
    return { message: `${weightNote.text} Your ${context.userGoal.title} goal hasn't moved for two weeks. Training isn't necessarily the issue — tighten execution outside the gym before changing the plan.` };
  }
  return { message: "Nothing's stalling by the data so far. If it feels stalled anyway, log a few more sessions — one week isn't a trend." };
}

function answerSoreness(context) {
  const band = context.readiness?.band;
  if (!context.readiness?.loggedToday) return { message: "Log today's readiness check-in — soreness is one of the inputs, and the app will factor it in automatically." };
  if (band === "red") return { message: "Readiness is RED today. Train light or take the day — soreness this high with everything else down too is a recovery signal, not a toughness test." };
  if (band === "yellow") return { message: "Moderate. Train, but drop optional accessory work if it's genuinely limiting range of motion or form." };
  return { message: "Readiness is GREEN — soreness alone isn't a reason to back off today." };
}

function answerProgress(context) {
  const lines = [fmtGoalLine(context.userGoal)];
  if (context.recentWeightTrend?.weeklyRate != null) {
    lines.push(`Bodyweight: ${context.recentWeightTrend.weeklyRate >= 0 ? "+" : ""}${context.recentWeightTrend.weeklyRate.toFixed(1)} lb/week.`);
  }
  lines.push(`Adherence this week: ${context.adherence.overall}%.`);
  return { message: lines.join(" ") };
}

function answerWhatWrong(context) {
  if (context.adherence.overall >= 85 && (context.userGoal?.status === "ahead" || context.userGoal?.status === "on_track" || !context.userGoal)) {
    return { message: "Performance is improving. No adjustment needed." };
  }
  const weak = context.coachMemory?.[0];
  if (weak) return { message: weak.text };
  if (context.adherence.overall < 70) return { message: `Adherence is ${context.adherence.overall}% this week — that's the issue before anything about the training itself.` };
  return { message: "Nothing stands out as wrong. Keep executing." };
}

function answerReviewToday(context, state) {
  if (!state) return { message: "Session data not available." };
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = (state.workoutSessions || []).find((s) => s.finishedAt.slice(0, 10) === todayKey);
  if (!today) return { message: "No session logged yet today." };
  return generatePostWorkoutReview(today);
}

function answerReview30(context, state) {
  if (!state) return { message: "History not available." };
  const review = computeWeeklyReview(state, 30);
  return generateWeeklyReview(review);
}

export function answerCoachQuestion(question, context, state) {
  if (isSafetyDeflection(question)) return { message: SAFETY_RESPONSE };
  const q = (question || "").toLowerCase();

  if (/what should i do today|what.*today/.test(q)) return answerWhatToday(context);
  if (/increase weight|add weight|more weight|heavier/.test(q)) return answerIncreaseWeight(context);
  if (/stall|plateau|stuck/.test(q)) return answerStalled(context);
  if (/sore/.test(q)) return answerSoreness(context);
  if (/last 30|30 days|past month/.test(q)) return answerReview30(context, state);
  if (/review.*today|today.*session/.test(q)) return answerReviewToday(context, state);
  if (/doing wrong|what's wrong|going wrong/.test(q)) return answerWhatWrong(context);
  if (/progress|on track/.test(q)) return answerProgress(context);

  return { message: `${fmtGoalLine(context.userGoal)} Adherence this week: ${context.adherence.overall}%. Ask about today's session, progress, or a specific lift for more.` };
}
