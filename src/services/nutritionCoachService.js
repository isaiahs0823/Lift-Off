// ---------------- NUTRITION COACH REASONING ----------------
// The core distinction the whole nutrition spec is built around: is the PLAN the problem, or
// is EXECUTION the problem? Both diagnoses require real evidence over real time — never a
// single bad day, one restaurant meal, or one high weigh-in (section 37). Every threshold here
// exists to keep Coach from over-reacting to noise.

import { resolveNutritionProfile } from "../utils/nutrition.js";
import { rollingNutritionAdherence } from "../utils/nutritionAdherence.js";
import { weeklyRateOfChange, isFlatTrend } from "../utils/bodyweightMath.js";

const MIN_LOGGED_DAYS = 7; // at least a week of real logs before Coach will draw any conclusion
const OVER_TARGET_KCAL_THRESHOLD = 150;
const LOW_ADHERENCE_PCT = 70;
const HIGH_ADHERENCE_PCT = 85;
const FLAT_TREND_WEEKS = 3;

// Section 38 — a Bodybuilding Coach recomp phase is explicitly judged over a longer horizon
// than a cut/mass phase; short-term scale noise is expected and shouldn't trigger a target
// change as readily. Every other phase uses the standard 3-week flat-trend window.
function flatTrendWeeksForPhase(state) {
  if (state.athleteProfile?.coachSpecialty === "bodybuilding" && state.athleteProfile?.physiquePhase === "recomposition") return 5;
  return FLAT_TREND_WEEKS;
}

// Section 18/19/24 — the single most important nutrition-coach behavior. Returns null when
// there isn't enough evidence yet rather than forcing an opinion on thin data.
export function diagnoseNutrition(state, days = 21) {
  const targets = state.nutritionTargets;
  if (!targets) return null;

  const adherence = rollingNutritionAdherence(state, days);
  if (adherence.loggedDays < MIN_LOGGED_DAYS) return null;

  const bwEntries = state.bodyweightLogs || [];
  const weeklyRate = weeklyRateOfChange(bwEntries, "weight");
  const flatWeeks = flatTrendWeeksForPhase(state);
  const flat = isFlatTrend(bwEntries, flatWeeks);

  const overTarget = adherence.avgCalories != null && adherence.avgCalories - targets.calories > OVER_TARGET_KCAL_THRESHOLD;
  const underAdherence = adherence.pct != null && adherence.pct < LOW_ADHERENCE_PCT;
  const highAdherence = adherence.pct != null && adherence.pct >= HIGH_ADHERENCE_PCT;

  // The plan isn't the problem yet — logged intake is running well above target while
  // adherence is genuinely low. Lowering the target here would just create a second target
  // the athlete also won't hit.
  if (overTarget && underAdherence) {
    const over = Math.round(adherence.avgCalories - targets.calories);
    return {
      kind: "plan_not_problem",
      message: `Your target isn't the problem yet. You're averaging roughly ${over} calories above it, and adherence is ${adherence.pct}%. Cutting the target lower won't fix adherence — we need to make the current plan easier to execute.`,
    };
  }

  // The plan may actually be the problem — execution has been real (high adherence) for
  // weeks, but the scale hasn't moved. This is the one condition where re-estimating the
  // target is the right call.
  if (highAdherence && flat && weeklyRate != null) {
    return {
      kind: "target_needs_adjustment",
      message: `You're executing the plan — adherence is ${adherence.pct}% — and bodyweight hasn't moved in ${flatWeeks} weeks. This isn't an adherence problem anymore. It's time to adjust the target.`,
    };
  }

  // Nothing to flag — high adherence and real movement. Section 24: say so, and stop.
  if (highAdherence && weeklyRate != null && !flat) {
    return {
      kind: "on_track",
      message: `Adherence is ${adherence.pct}% and bodyweight is trending. Everything is working — don't change anything.`,
    };
  }

  return null;
}

const DIRECTION_BY_GOAL = { fat_loss: -1, muscle_gain: 1, recomposition: -1, maintenance: 0, performance: 0 };
const ADJUSTMENT_STEP_KCAL = 150;

// Section 36 — never an unexplained algorithmic change. Only called when diagnoseNutrition
// actually returned "target_needs_adjustment"; the caller is responsible for surfacing this
// as an explicit Accept/Modify/Decline card, never applying it silently.
export function generateAdjustmentProposal(state) {
  const targets = state.nutritionTargets;
  const profile = resolveNutritionProfile(state);
  const diagnosis = diagnoseNutrition(state);
  if (!targets || diagnosis?.kind !== "target_needs_adjustment") return null;

  const direction = DIRECTION_BY_GOAL[profile.primaryGoal] ?? -1;
  const step = direction === 0 ? -ADJUSTMENT_STEP_KCAL : direction * ADJUSTMENT_STEP_KCAL;
  const toCalories = Math.max(1200, targets.calories + step);
  // Hold protein fixed (muscle protection matters most through any target change); absorb the
  // calorie change through carbs so the macro set still reconciles.
  const proteinCalories = targets.protein * 4;
  const fatCalories = targets.fat * 9;
  const toCarbs = Math.max(0, Math.round((toCalories - proteinCalories - fatCalories) / 4));

  return {
    fromCalories: targets.calories,
    toCalories,
    fromMacros: { protein: targets.protein, carbs: targets.carbs, fat: targets.fat },
    toMacros: { protein: targets.protein, carbs: toCarbs, fat: targets.fat },
    reason: diagnosis.message,
  };
}

// Applies (or discards) a proposal the athlete has been shown — always an explicit choice
// (section 35's ADVISE/ASSIST/COACH ME levels all converge on this same accept/modify/decline
// gate for anything that touches calories/macros).
export function applyAdjustment(state, proposal, action, modifiedCalories) {
  const record = {
    id: `nutradj_${Date.now()}`,
    date: new Date().toISOString(),
    fromCalories: proposal.fromCalories,
    toCalories: action === "modify" && modifiedCalories != null ? modifiedCalories : proposal.toCalories,
    fromMacros: proposal.fromMacros,
    toMacros: proposal.toMacros,
    reason: proposal.reason,
    status: action, // "accepted" | "modified" | "declined"
  };
  if (action === "declined") {
    return { nutritionCoachAdjustments: [record, ...(state.nutritionCoachAdjustments || [])] };
  }
  const targets = state.nutritionTargets;
  const finalCalories = record.toCalories;
  const proteinCalories = proposal.toMacros.protein * 4;
  const fatCalories = proposal.toMacros.fat * 9;
  const carbs = Math.max(0, Math.round((finalCalories - proteinCalories - fatCalories) / 4));
  return {
    nutritionCoachAdjustments: [record, ...(state.nutritionCoachAdjustments || [])],
    nutritionTargets: {
      ...targets,
      calories: finalCalories,
      protein: proposal.toMacros.protein,
      carbs,
      fat: proposal.toMacros.fat,
      updatedAt: new Date().toISOString(),
      history: [
        ...(targets.history || []),
        { date: new Date().toISOString(), calories: finalCalories, protein: proposal.toMacros.protein, carbs, fat: proposal.toMacros.fat, reason: proposal.reason },
      ],
    },
  };
}

// Section 21/22 — weekly check-in. Difficulty score matters as much as the numbers: good
// results rated "unsustainable" are still a problem, just not the results problem.
export function interpretCheckIn(checkIn, adherence) {
  const lines = [];
  if (checkIn.difficulty >= 4) {
    if (adherence?.pct != null && adherence.pct >= 85) {
      lines.push(
        `Results are good, but you're rating this a ${checkIn.difficulty}/5 on difficulty. I care about whether you can still execute this four weeks from now — let's make it easier before adherence breaks.`
      );
    } else {
      lines.push(`This is rating as ${checkIn.difficulty}/5 — hard to sustain. Let's simplify the structure rather than push through it.`);
    }
  } else if (checkIn.canRepeat === false) {
    lines.push("You said you couldn't realistically repeat this week. That matters more than the numbers — let's change something structural, not just grind through it.");
  } else if (adherence?.pct != null && adherence.pct >= 85 && checkIn.difficulty <= 2) {
    lines.push("Solid week, and it's not costing you much effort. Keep this structure.");
  }
  return lines.length ? lines.join(" ") : null;
}

// Section 3/4 — "Reality Check": turns stated barriers into concrete structural suggestions,
// not a lecture about discipline. Deliberately plain-text guidance the UI can just render;
// actually rebuilding the meal plan around these lives in mealPlanGenerator.js.
const BARRIER_ADVICE = {
  too_much_cooking: "Fewer from-scratch meals — lean on simple prep, pre-cooked proteins, or grab-and-go options.",
  too_many_meals: "Fewer, larger meals instead of spreading targets across many small ones.",
  work_schedule: "Build around what's portable and doesn't need a kitchen mid-shift.",
  family_meals: "Fit your targets around what the household is already eating instead of a separate menu.",
  eating_out: "Keep a small set of reliable restaurant orders that roughly hit your numbers.",
  hunger: "Shift more volume/protein earlier or add a higher-volume, lower-calorie food to key meals.",
  food_preferences: "Rebuild the plan around foods you actually want to eat repeatedly.",
  cost: "Prioritize cheaper staple proteins and carbs over specialty items.",
  travel: "Plan for hotel/road-trip realistic options instead of a home-kitchen structure.",
  weekend_lifestyle: "Give weekends a looser structure and adjust weekday targets to compensate.",
  training_schedule: "Anchor meals around training time rather than a fixed clock schedule.",
};

export function realityCheckAdvice(barriers) {
  return (barriers || []).map((b) => ({ barrier: b, advice: BARRIER_ADVICE[b] })).filter((x) => x.advice);
}
