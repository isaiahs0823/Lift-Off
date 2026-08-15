// ---------------- BODYBUILDING COACH ----------------
// The one functional Coach specialty. This module is the "brain" — priorities, terminology,
// and phase-aware framing consumed by coachContext.js / coachService.js /
// weeklyReview-style generators whenever state.athleteProfile.coachSpecialty ===
// "bodybuilding" (currently the only value that exists — see coachSpecialties/index.js).
//
// BRK Coach is rule-based, not a call to a hosted model (see coachService.js's own header
// comment) — nothing here is a literal LLM prompt. But it's written as the same "what this
// coach cares about, and in what order" contract a future hosted-model version would receive
// verbatim, per the architecture note in the spec: changing specialty should change what data
// gets prioritized and what counts as progress, not just wording sprinkled on top.

export const BODYBUILDING_PRIORITIES = [
  "Hypertrophy",
  "Muscular development",
  "Exercise execution",
  "Progressive overload",
  "Target-muscle stimulus",
  "Recoverable volume",
  "Symmetry / weak-point development",
  "Fatigue management",
  "Body-composition progress",
  "Strength as a tool for hypertrophy, not the goal itself",
];

export const BODYBUILDING_METHODOLOGY =
  "Evidence-informed bodybuilding coaching. A bench 1RM is not automatically the objective — " +
  "strength is a tool for hypertrophy, not the goal. Progress can come from load, reps, or " +
  "execution — reps climbing at the same load, or the same reps at meaningfully higher RIR, " +
  "count as real progress even with no weight PR. Weigh volume against recovery and actual " +
  "performance, never treat more sets as automatically better.";

// Phase-aware success criteria (section 6/7/9/26) — what "good" looks like changes with the
// phase, so the same data (e.g. bodyweight trending down) reads differently depending on it.
export function phaseFraming(phase) {
  switch (phase) {
    case "cut":
      return "cutting — judge success by strength/performance retention and adherence, not rate of scale loss alone";
    case "maintenance":
      return "maintaining — judge success by training performance and bodyweight stability";
    case "lean_gain":
      return "in a lean gain phase — judge success by progressive overload and a controlled bodyweight trend, not scale speed";
    case "mass":
      return "in a mass phase — judge success by progressive overload and recovery, not scale speed alone";
    case "recomposition":
      return "recomping — judge success by strength trend and bodyweight stability together";
    case "contest_prep":
      return "in contest/photoshoot prep — judge success by strength retention, adherence, and recovery under a fixed timeline";
    default:
      return "in a general hypertrophy phase — judge success by progressive overload and consistent execution";
  }
}

export const BODYBUILDING_QUICK_QUESTIONS = [
  "How was today's workout?",
  "Am I progressing?",
  "Should I add weight?",
  "Is my volume too high?",
  "What muscle group is falling behind?",
  "Should I change exercises?",
  "How is my cut going?",
  "Am I recovering?",
  "Review my week.",
];
