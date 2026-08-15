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
import { DAY_TYPE_LABEL, computeScheduleAdherence } from "../utils/weeklySchedule.js";
import { sessionPRCount } from "../utils/prSummary.js";

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
  const { recentWeightTrend, daysSinceLastSession, userGoal, schedule, readiness } = context;

  // A configured weekly schedule takes priority over the generic signals below — the whole
  // point of section 11 is that the coach should talk about *today's actual plan*, not just
  // trend-watch. Order matters: a repeated-miss pattern is worth naming before anything else,
  // then a single fresh miss, then whatever today itself is.
  if (schedule) {
    if (schedule.repeatedMiss) return { message: schedule.repeatedMiss.text };
    if (schedule.missed) {
      const label = schedule.missed.label || DAY_TYPE_LABEL[schedule.missed.type];
      return { message: `${label} was scheduled and didn't happen. One miss isn't the problem. Decide whether you're doing it today or moving it.` };
    }
    const today = schedule.today;
    if (today?.type === "rest") {
      if (readiness?.loggedToday && readiness.band === "green") {
        return { message: "Rest day. Feeling good doesn't mean you need to manufacture extra work." };
      }
      return { message: "Rest day. Training is handled this week. Recover and be ready for what's next." };
    }
    if (today?.type === "workout") {
      const label = today.label || "Training";
      if (readiness?.loggedToday && readiness.band === "red") {
        return { message: `${label} today. Readiness is poor. You can train, but reduce unnecessary volume and keep quality high.` };
      }
      if (readiness?.loggedToday) {
        return { message: `${label} today. Readiness is ${readiness.score}. Train as planned.` };
      }
      return { message: `${label} today.` };
    }
    if (today?.type === "conditioning") {
      return { message: `${today.label || "Conditioning"} today.` };
    }
    if (today?.type === "recovery") {
      return { message: `${today.label || "Active recovery"} today — walk, mobility, easy movement.` };
    }
  }

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
  const { perfDeltaPct, avgRir } = summary;
  // Counts by exercise, not raw PR-type occurrence — one improved set can trip weight + e1RM +
  // volume PRs at once, which is one meaningful event, not three (see utils/prSummary.js).
  const prCount = sessionPRCount(summary);
  const lines = [];
  if (prCount > 0) {
    lines.push(`${prCount} PR${prCount > 1 ? "s" : ""} this session. Strength is trending the right way.`);
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
  lines.push(lines.length > 1 || prCount > 0 ? "Leave it alone. Recover and repeat." : "Nothing to adjust. Recover and repeat.");
  return { message: lines.join(" ") };
}

// Compares the weakest scheduled category against the strongest one this week — only when
// there are at least two categories to actually compare, so a single-category week (e.g. no
// conditioning scheduled at all) doesn't produce a hollow "X is the weak point" against nothing.
function scheduleWeeklyLine(scheduleAdherence) {
  if (!scheduleAdherence) return null;
  const parts = [
    { label: "Strength work", v: scheduleAdherence.lifting },
    { label: "Conditioning", v: scheduleAdherence.conditioning },
    { label: "Recovery", v: scheduleAdherence.recovery },
  ]
    .filter((p) => p.v.scheduled > 0)
    .map((p) => ({ ...p, pct: Math.round((p.v.completed / p.v.scheduled) * 100) }));
  if (parts.length < 2) return null;
  const best = parts.reduce((a, b) => (b.pct > a.pct ? b : a));
  const worst = parts.reduce((a, b) => (b.pct < a.pct ? b : a));
  if (best.pct === worst.pct) return "Every part of the plan got equal attention this week.";
  return `${best.label} is consistent. ${worst.label} is the weak point this week.`;
}

// ---------- Weekly review ----------
// review: output of computeWeeklyReview(). scheduleAdherence: optional output of
// computeScheduleAdherence(state, 7) — adds a plan-breakdown line (section 12) when a weekly
// schedule is configured, on top of the existing goal/trend-based summary.
export function generateWeeklyReview(review, scheduleAdherence) {
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
  const scheduleLine = scheduleWeeklyLine(scheduleAdherence);
  if (scheduleLine) lines.push(scheduleLine);
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
  const style = context.athleteProfile?.coachingStyle || "balanced";
  if (context.adherence.overall >= 85 && (context.userGoal?.status === "ahead" || context.userGoal?.status === "on_track" || !context.userGoal)) {
    if (style === "hard") return { message: "Nothing. Everything is moving. Stop looking for problems and go train." };
    if (style === "supportive") return { message: "Nothing's wrong here — everything is moving in the right direction. No adjustment needed." };
    return { message: "Performance is improving. No adjustment needed." };
  }
  const weak = context.coachMemory?.[0];
  if (weak) return { message: weak.text };
  if (context.adherence.overall < 70) return { message: `Adherence is ${context.adherence.overall}% this week — that's the issue before anything about the training itself.` };
  return { message: "Nothing stands out as wrong. Keep executing." };
}

// "Coach with a spine" (section 8/28): pushes back on a program-change request when the data
// doesn't support one, instead of agreeing just because it was asked. Only agrees when there's
// a real, data-backed reason — a genuine stall, a goal that's actually behind, or adherence
// that's actually low — never manufactures a reason to say yes.
function answerProgramChange(context) {
  const style = context.athleteProfile?.coachingStyle || "balanced";
  const stallNote = context.coachMemory?.find((m) => m.key === "stalling_exercises");
  const adherence = context.adherence?.overall ?? null;
  const goalBehind = context.userGoal?.status === "behind";
  const legitReason = !!stallNote || goalBehind || (adherence != null && adherence < 60);
  if (!legitReason) {
    if (style === "hard") return { message: "No. Nothing in the data says the program is the problem. Finish what you started before you go looking for a new one." };
    if (style === "supportive") return { message: "I get wanting something new, but the data doesn't point to the program as the issue — what's actually feeling off?" };
    return { message: "Nothing in the data supports switching right now — strength and adherence are both holding. What specifically feels off?" };
  }
  const reason = stallNote ? stallNote.text : goalBehind ? `${context.userGoal.title} is behind pace.` : `Adherence is ${adherence}% — that's the real issue.`;
  if (style === "hard") return { message: `${reason} A program change is reasonable here — but only if execution stays the same, or it's just a new excuse.` };
  if (style === "supportive") return { message: `${reason} A change makes sense here — let's figure out what to adjust.` };
  return { message: `${reason} A program change is reasonable here.` };
}

// "Coach with a spine," other half: checks a stated claim about training against the actual
// log instead of just agreeing (section 8). Contradicts with real numbers when the data
// disagrees; confirms with real numbers when it doesn't.
function answerClaimCheck(context) {
  const style = context.athleteProfile?.coachingStyle || "balanced";
  const adherence = context.adherence?.overall ?? null;
  const daysSince = context.daysSinceLastSession;
  const contradicted = (adherence != null && adherence < 70) || (daysSince != null && daysSince >= 3);
  if (contradicted) {
    const detail = adherence != null ? `Adherence this week is ${adherence}%.` : daysSince != null ? `${daysSince} days since your last session.` : "The log doesn't back that up.";
    if (style === "hard") return { message: `That's not what the data shows. ${detail} Consistency means showing up, not intending to.` };
    if (style === "supportive") return { message: `The data tells a different story right now — ${detail} No judgment, just worth being honest about it so we can fix it.` };
    return { message: `${detail} That doesn't match "consistent." Worth being honest about it before anything else changes.` };
  }
  const detail = adherence != null ? `${adherence}% adherence this week backs it up.` : "The log backs it up.";
  if (style === "hard") return { message: `Correct. ${detail} Keep it that way.` };
  if (style === "supportive") return { message: `You're right, and it shows — ${detail} Keep going.` };
  return { message: `Accurate. ${detail}` };
}

// Response-length tone (section 28): "short" is the existing default voice and is left
// untouched to avoid regressing every message already tuned to be concise. "standard" adds one
// supporting sentence; "detailed" adds the full supplementary context. Never truncates —
// shortening an already-short message risks cutting the actual answer, not just flavor text.
function buildExtraDetail(context) {
  const mem = context.relevantMemories?.[0];
  if (mem) return mem.text;
  if (context.adherence) return `Adherence this week: ${context.adherence.overall}%.`;
  return null;
}
export function applyResponseLength(message, length, extra) {
  if (!extra) return message;
  if (length === "detailed") return `${message} ${extra}`;
  if (length === "standard") {
    const firstSentence = extra.split(/(?<=[.!?])\s+/)[0] || extra;
    return `${message} ${firstSentence}`;
  }
  return message;
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
  return generateWeeklyReview(review, context?.schedule?.weeklyAdherence ? computeScheduleAdherence(state, 30) : null);
}
function answerReviewWeek(context, state) {
  if (!state) return { message: "History not available." };
  const review = computeWeeklyReview(state, 7);
  return generateWeeklyReview(review, context?.schedule?.weeklyAdherence ? computeScheduleAdherence(state, 7) : null);
}

// ---------- Bodybuilding-specialty answers (section 24) ----------
// Bodybuilding is the only functional Coach specialty right now (see src/coachSpecialties) —
// these read directly from context.muscleVolume/muscleVolumeTrend (computed generically in
// coachContext.js) and context.athleteProfile's physiquePhase/physiquePriorities.

function answerVolumeCheck(context) {
  const volume = context.muscleVolume || {};
  const entries = Object.entries(volume).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { message: "No sets logged this week yet — nothing to judge volume against." };
  const summary = entries.map(([m, c]) => `${m} ${c}`).join(", ");
  return {
    message: `This week: ${summary}. Nothing here reads as excessive on its own — volume is only a problem if performance or recovery is actually suffering for it, and that's not showing up yet.`,
  };
}

function answerWeakestMuscle(context) {
  const trend = context.muscleVolumeTrend || {};
  const declining = Object.entries(trend).filter(([, t]) => t === "down");
  const primary = context.athleteProfile?.physiquePriorities?.primary;
  if (primary) {
    const primaryVolume = (context.muscleVolume || {})[primary] || 0;
    if (primaryVolume === 0) return { message: `${primary} is your stated priority but hasn't been trained this week — that's the actual gap.` };
  }
  if (declining.length > 0) {
    return { message: `${declining.map(([m]) => m).join(", ")} volume dropped versus last week. That's the one worth watching.` };
  }
  return { message: "Nothing stands out as falling behind this week — volume is holding across the board." };
}

function answerChangeExercises(context) {
  const stalling = context.coachMemory?.find((m) => m.key === "stalling_exercises");
  if (stalling) return { message: `${stalling.text} That's worth swapping or adjusting — everything else is progressing, leave that alone.` };
  return { message: "Nothing here has stalled long enough to justify swapping it out. Keep executing before changing exercises." };
}

function answerPhaseCheck(context) {
  const phase = context.athleteProfile?.physiquePhase;
  if (phase !== "cut" && phase !== "contest_prep") {
    return { message: "You're not currently set to a Cut phase — set that in Coach Settings under Current Phase if you want cut-specific check-ins." };
  }
  const weeklyRate = context.recentWeightTrend?.weeklyRate;
  const adherence = context.adherence?.overall;
  const parts = [];
  if (weeklyRate != null) parts.push(`Bodyweight is trending ${weeklyRate < 0 ? "down" : "up"} ${Math.abs(weeklyRate).toFixed(1)} lb/week.`);
  if (adherence != null) parts.push(`Training adherence is ${adherence}%.`);
  if (weeklyRate != null && weeklyRate < 0 && adherence != null && adherence >= 80) {
    parts.push("Exactly where you want it. Weight is moving and training is holding. Don't change anything.");
  } else if (weeklyRate != null && weeklyRate >= 0) {
    parts.push("Weight isn't trending down — worth a look at adherence and intake before touching training.");
  }
  return { message: parts.length > 0 ? parts.join(" ") : "Log a few more bodyweight entries and I can grade the cut properly." };
}

function answerRecoveryCheck(context) {
  const readiness = context.readiness;
  if (!readiness?.loggedToday) return { message: "No readiness check-in today — log one and I can give you a real answer." };
  if (readiness.band === "red") return { message: `Readiness is RED (${readiness.score}). Recovery is behind — prioritize sleep and back off intensity today.` };
  if (readiness.band === "yellow") return { message: `Readiness is YELLOW (${readiness.score}). Recovering, but not fully. Fine to train, keep it controlled.` };
  return { message: `Readiness is GREEN (${readiness.score}). Recovery looks good.` };
}

export function answerCoachQuestion(question, context, state) {
  if (isSafetyDeflection(question)) return { message: SAFETY_RESPONSE };
  const q = (question || "").toLowerCase();

  let result;
  if (/what should i do today|what.*today/.test(q)) result = answerWhatToday(context);
  else if (/change (my |the )?program|switch program|new program|different program|should i switch/.test(q)) result = answerProgramChange(context);
  else if (/i'?ve been (training|working out|going)( to the gym)? (hard|consistently|every day|non-?stop)|i'?ve been consistent|i'?m doing everything right|haven'?t missed (a|any) (workout|session)/.test(q))
    result = answerClaimCheck(context);
  else if (/increase weight|add weight|more weight|heavier/.test(q)) result = answerIncreaseWeight(context);
  else if (/volume too high|too much volume|volume.*high/.test(q)) result = answerVolumeCheck(context);
  else if (/falling behind|muscle group.*behind|behind.*muscle/.test(q)) result = answerWeakestMuscle(context);
  else if (/change exercises|swap exercises|different exercises/.test(q)) result = answerChangeExercises(context);
  else if (/how is my cut|cut going|cutting.*going/.test(q)) result = answerPhaseCheck(context);
  else if (/am i recovering|recovering\?|recovery.*ok/.test(q)) result = answerRecoveryCheck(context);
  else if (/stall|plateau|stuck/.test(q)) result = answerStalled(context);
  else if (/sore/.test(q)) result = answerSoreness(context);
  else if (/last 30|30 days|past month/.test(q)) result = answerReview30(context, state);
  else if (/review my week|review this week/.test(q)) result = answerReviewWeek(context, state);
  else if (/how was today.*workout|review.*today|today.*session/.test(q)) result = answerReviewToday(context, state);
  else if (/doing wrong|what's wrong|going wrong/.test(q)) result = answerWhatWrong(context);
  else if (/progress|on track/.test(q)) result = answerProgress(context);
  else result = { message: `${fmtGoalLine(context.userGoal)} Adherence this week: ${context.adherence.overall}%. Ask about today's session, progress, or a specific lift for more.` };

  const length = context.athleteProfile?.responseLength || "short";
  if (length !== "short") {
    result = { message: applyResponseLength(result.message, length, buildExtraDetail(context)) };
  }
  return result;
}
