// Deterministic, explainable beginner program recommendation (Beginner Experience V2, Stage 2A
// item 3/4). No AI dependency — a small, testable mapping over the EXISTING program library
// (HERO_PROGRAMS, which already includes the 3-day starter programs and the Titan/Athena/Shape
// family variants via FAMILY_PROGRAMS — see App.jsx's `programs: HERO_PROGRAMS` state seed).
// Never invents a new program and never mutates the programs it reads.

// `prog_3day_full_body` is the one program in the existing library explicitly authored as
// "Beginner/intermediate-friendly, frequency-driven" (see its definition in App.jsx) — it's the
// closest existing match to a from-scratch beginner default, so it's used verbatim rather than
// inventing a new program, per the brief's "reuse compatible existing program templates" rule.
const THREE_DAY_BEGINNER_PROGRAM_ID = "prog_3day_full_body";

// Goal -> family mapping. Deterministic and documented, not a claim of exercise-science
// precision: Shape is the most equipment-accessible/general-physique family (its own tagline:
// "built with machines, cables, and dumbbells"), so it's the default for the two general goals.
// Titan leans compound-lift/strength-flavored (chest/back, V-taper). Athena leans lower-body,
// which pairs naturally with a "lose fat while improving fitness" goal that still needs a
// concrete, trainable focus (the copy below is careful not to promise fat loss from training
// alone — see explanationFor).
const GOAL_FAMILY = {
  muscle: "shape",
  strength: "titan",
  fitness: "shape",
  fatloss: "athena",
};

const GOAL_LABEL = {
  muscle: "build muscle",
  strength: "get stronger",
  fitness: "improve your overall fitness",
  fatloss: "stay consistent while you work on fat loss",
};

// Equipment is NOT a field anywhere in the current program/exercise data model (confirmed by a
// full-repo audit — no `equipment` key exists on any program or exercise). Rather than fabricate
// per-exercise equipment substitutions we can't verify, "home"/"minimal" honestly report a gap:
// every current recommendation assumes a full/commercial gym. See REQUIRED FIRST RESPONSE #7 and
// the QA report's Section 1 finding.
function equipmentGapFor(equipment) {
  if (equipment === "home" || equipment === "minimal") {
    return "We don't have a dedicated home-gym or minimal-equipment program yet — this is our closest full-gym recommendation. You can also build your own plan with whatever equipment you have.";
  }
  return null;
}

// `experience` is stored verbatim as a preference (never a judgment label) and, separately from
// program choice, decides the default logging detail level for the FIRST workout this plan
// starts: someone who already runs their own routine shouldn't be walked through a simplified
// logger they don't need. This never touches history or existing settings — see
// src/components/BeginnerOnboarding.jsx's acceptPlan for where it's actually written.
export function trainingDetailForExperience(experience) {
  return experience === "experienced" ? "advanced" : "simple";
}

/**
 * @param {{experience:string, goal:string, days:number, equipment:string}} answers
 * @param {{programs: Array}} opts
 * @returns {{program:Object|null, reasonLines:string[], equipmentGap:string|null, trainingDetail:string, gap:string|null}}
 */
export function recommendForBeginner(answers, { programs = [] } = {}) {
  const { goal, days } = answers;
  const trainingDetail = trainingDetailForExperience(answers.experience);
  const equipmentGap = equipmentGapFor(answers.equipment);

  let program = null;
  if (days === 3) {
    program = programs.find((p) => p.id === THREE_DAY_BEGINNER_PROGRAM_ID) || null;
  }
  if (!program) {
    const familyId = GOAL_FAMILY[goal] || "shape";
    program = programs.find((p) => p.familyId === familyId && p.trainingDays === days) || null;
  }
  // Last-resort fallback: closest available frequency in the same family, rather than showing
  // nothing. Still honestly explained (gap !== null) so the athlete knows it isn't an exact match.
  let gap = null;
  if (!program) {
    const familyId = GOAL_FAMILY[goal] || "shape";
    const familyMatches = programs
      .filter((p) => p.familyId === familyId && typeof p.trainingDays === "number")
      .sort((a, b) => Math.abs(a.trainingDays - days) - Math.abs(b.trainingDays - days));
    program = familyMatches[0] || programs.find((p) => p.id === THREE_DAY_BEGINNER_PROGRAM_ID) || null;
    if (program) {
      gap = `We don't have a ${days}-day version of this plan yet — here's the closest match (${program.trainingDays || "a different"} days/week). You can adjust your schedule any time.`;
    }
  }

  const reasonLines = [];
  if (program) {
    const goalLabel = GOAL_LABEL[goal] || "train consistently";
    reasonLines.push(`Based on your goal and schedule, we recommend ${program.name}.`);
    reasonLines.push(
      `${days} workout${days === 1 ? "" : "s"} per week, designed to help you ${goalLabel}.`
    );
  }

  return { program, reasonLines, equipmentGap, trainingDetail, gap };
}
