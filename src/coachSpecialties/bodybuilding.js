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

// Nutrition section 38 — how the Bodybuilding Coach reads nutrition data specifically depends
// on physique phase, same "what counts as good" reasoning as phaseFraming() above but applied
// to the nutrition side (weight trend + adherence) instead of the training side.
export function nutritionPhaseFraming(phase) {
  switch (phase) {
    case "cut":
    case "contest_prep":
      return {
        emphasis: "fat_loss_retention",
        text: "Cutting: judged on fat loss while holding onto muscle and training performance — not just how fast the scale drops.",
      };
    case "lean_gain":
    case "mass":
      return {
        emphasis: "controlled_gain",
        text: "Building: judged on muscle gain with a controlled, deliberate bodyweight trend — not how fast the scale climbs.",
      };
    case "recomposition":
      return {
        emphasis: "long_horizon_composition",
        text: "Recomping: judged on performance and body-composition trends over a longer horizon — week-to-week scale movement is expected to be noisy.",
      };
    case "maintenance":
      return { emphasis: "stability", text: "Maintaining: judged on bodyweight stability and training performance." };
    default:
      return { emphasis: "general", text: "General hypertrophy: judged on progressive overload with a stable-to-slightly-favorable bodyweight trend." };
  }
}

// Compares the top comparable set between two sessions of the same exercise and classifies
// what actually happened — bodybuilding-specific because it treats reps-at-the-same-load and
// RIR movement as real signal, not just the weight on the bar (sections 10-14). A powerlifting
// coach would weight this differently; that's the point of specialty-specific reasoning.
export function interpretSetProgression(prev, curr) {
  if (!prev || !curr) return null;
  if (curr.weight > prev.weight) {
    return { kind: "load_progress", message: `Added load: ${prev.weight} → ${curr.weight} lb.` };
  }
  if (curr.weight === prev.weight && curr.reps > prev.reps) {
    return { kind: "rep_progress", message: `Reps climbed at the same load: ${prev.reps} → ${curr.reps} at ${curr.weight} lb.` };
  }
  if (curr.weight === prev.weight && curr.reps === prev.reps) {
    if (curr.rir != null && prev.rir != null) {
      if (curr.rir > prev.rir) {
        return {
          kind: "effort_progress",
          message: `Same ${curr.weight} lb × ${curr.reps}, but with more in the tank than last time (${prev.rir} → ${curr.rir} RIR) — that's real improvement, even with no new weight or reps.`,
        };
      }
      if (curr.rir < prev.rir) {
        return {
          kind: "effort_regress",
          message: `Same ${curr.weight} lb × ${curr.reps}, but it took more effort to get there (${prev.rir} → ${curr.rir} RIR) — that's not clearly progress, even though the numbers match.`,
        };
      }
    }
    return { kind: "flat", message: `Repeated ${curr.weight} lb × ${curr.reps} at the same effort.` };
  }
  if (curr.weight < prev.weight || curr.reps < prev.reps) {
    return { kind: "regressed", message: `Dropped from ${prev.weight} lb × ${prev.reps} to ${curr.weight} lb × ${curr.reps}.` };
  }
  return { kind: "flat", message: "No clear change from last time." };
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
  "What is holding me back?",
];
