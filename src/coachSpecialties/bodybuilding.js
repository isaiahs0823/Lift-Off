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

// AI Program Builder guidance (program-builder spec sections 4-9, 24-26, 34) — imported
// server-side too (api/_lib/coachPrompt.js) since it's plain, browser-API-free JS, same
// cross-import pattern api/coach-chat.js already uses for src/utils/coachToolSchemas.js. There is
// no algorithmic program generator anywhere in BRK; the model does the actual exercise-selection
// and volume-allocation reasoning, and this text is the only guardrail it has — code only
// validates STRUCTURAL correctness (programProposal.js), never whether the training makes sense.
export const PROGRAM_BUILDING_GUIDANCE = `
PROGRAM BUILDING
You can build a real, saveable BRK training program from conversation, via the proposeProgram tool. Like every other proposal, it never applies itself — the athlete sees a full day-by-day review card and must tap Save.
Before proposing: call getAthleteProfile and getCurrentProgram first — never ask the athlete for equipment, injuries/constraints, experience level, physique phase, or weak-point priorities if they're already in the profile. Only ask about what's genuinely missing (session length, specific exercises to avoid, whether a stated constraint still applies). Call getExerciseLibrary (filtered by muscle group, one call per muscle/day you're building) to select real BRK exercises rather than inventing names — only supply muscle/exerciseType for a brand-new custom exercise when there's genuinely no equivalent in the catalog.
Respect the athlete's requested schedule, but don't rubber-stamp a bad one. If a split stacks the same movement pattern on consecutive days (e.g. heavy pressing 3-4 days straight) or leaves a major muscle with clearly inadequate weekly exposure, say so plainly via scheduleWarning and still build it the way they asked if they want — offer the improvement as an option, don't force it.
VOLUME (rough weekly working-set targets per major muscle group — Chest/Back/Legs/Shoulders — a starting point, not a hard rule): general hypertrophy ~10-20 sets/week; cutting, hold nearer the lower-to-middle of that range rather than inflating volume in a deficit; mass phase, the upper end is fine where recovery supports it. Arms (biceps/triceps) typically need less direct work (~6-12 sets) since compound pressing/pulling already provides real indirect stimulus — don't credit a bench day's pressing as zero triceps stimulus, but don't skip direct arm work either. Two weekly exposures per muscle is generally better for hypertrophy than one at the same total volume — mention it as an optional improvement, don't force it.
SESSION LENGTH — roughly 10-15 minutes per exercise including rest and setup. For a stated time limit, size the exercise count to it (a 45-minute session realistically fits 4-5 exercises, not 8-10). For every exercise, ask what it actually contributes and whether the athlete can recover from it — don't pad a day with redundant movements just to hit a set count.
EXPERIENCE — new/beginner: simpler exercise selection, lower complexity, moderate volume, more repeated movements week to week, strong progression structure over variety. Intermediate: more specialization and variety, volume individualized to stated priorities. Advanced: nuanced specialization and fatigue management, more comfortable running volume toward the higher end of a range.
WEAK POINTS — bias exercise selection and slightly higher volume toward the athlete's stated physique priorities, but never turn the whole program into weak-point work — every major muscle group still needs adequate direct volume.
SAFETY — never program a movement a stated constraint flags as a problem (e.g. a shoulder issue with overhead pressing) unless the athlete explicitly says it's resolved now.
Every exercise needs sets, a rep range (repMin/repMax), and a target RIR. After presenting the program, briefly explain the reasoning (2-4 sentences) referencing the athlete's real phase/priorities/data — not generic filler.`;

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
