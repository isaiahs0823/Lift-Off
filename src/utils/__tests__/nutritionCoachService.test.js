import { it, expect, describe } from "vitest";
import { diagnoseNutrition, generateAdjustmentProposal, applyAdjustment } from "../../services/nutritionCoachService.js";

// Nutrition P0, step 2 — baseline coverage of the existing diagnosis/adjustment rules (the
// plan-vs-execution reasoning that gates NutritionAdjustmentCard). Hand-constructed 21+ day
// synthetic histories — real evidence-threshold behavior, not mocked return values.
const targets = { calories: 2500, protein: 180, carbs: 250, fat: 70, history: [] };

function daysOfLogs(n, { calories, protein }) {
  const logs = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    logs.push({ date: d.toISOString().slice(0, 10), calories, protein, carbs: 0, fat: 0 });
  }
  return logs;
}
function flatBodyweight(days, weight) {
  const entries = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    entries.push({ date: d.toISOString(), weight: weight + (i % 2 === 0 ? 0.05 : -0.05) });
  }
  return entries;
}
function risingBodyweight(days, startWeight, lbPerWeek) {
  const entries = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    entries.push({ date: d.toISOString(), weight: startWeight + ((days - i) / 7) * lbPerWeek });
  }
  return entries;
}

describe("diagnoseNutrition — evidence-gated, never a snap judgment", () => {
  it("returns null with fewer than 7 logged days, regardless of how the numbers look", () => {
    const state = { nutritionTargets: targets, foodLogs: daysOfLogs(5, { calories: 2500, protein: 180 }), bodyweightLogs: flatBodyweight(28, 180) };
    expect(diagnoseNutrition(state)).toBeNull();
  });

  it("returns null with no targets at all", () => {
    expect(diagnoseNutrition({ nutritionTargets: null, foodLogs: daysOfLogs(10, { calories: 2500, protein: 180 }) })).toBeNull();
  });

  it("'plan_not_problem': overeating + low adherence — never proposes lowering the target here", () => {
    // Logging consistently ~250 kcal over target with protein also short -> low adherence.
    const state = {
      nutritionTargets: targets,
      foodLogs: daysOfLogs(10, { calories: 2750, protein: 120 }),
      bodyweightLogs: flatBodyweight(28, 180),
    };
    const diagnosis = diagnoseNutrition(state);
    expect(diagnosis?.kind).toBe("plan_not_problem");
  });

  it("'target_needs_adjustment': high adherence + 3-week flat bodyweight trend", () => {
    const state = {
      nutritionTargets: targets,
      foodLogs: daysOfLogs(21, { calories: 2500, protein: 180 }), // exactly on target every logged day
      bodyweightLogs: flatBodyweight(28, 180),
    };
    const diagnosis = diagnoseNutrition(state);
    expect(diagnosis?.kind).toBe("target_needs_adjustment");
  });

  it("'on_track': high adherence + real bodyweight movement — says so and proposes nothing", () => {
    const state = {
      nutritionTargets: { ...targets, calories: 2900 }, // muscle_gain-style surplus
      foodLogs: daysOfLogs(21, { calories: 2900, protein: 180 }),
      bodyweightLogs: risingBodyweight(28, 178, 0.5), // genuinely trending up
    };
    const diagnosis = diagnoseNutrition(state);
    expect(diagnosis?.kind).toBe("on_track");
  });

  it("a bodybuilding recomposition phase requires 5 flat weeks, not 3, before proposing a change", () => {
    const bbState = {
      nutritionTargets: targets,
      foodLogs: daysOfLogs(21, { calories: 2500, protein: 180 }),
      bodyweightLogs: flatBodyweight(28, 180), // only ~4 weeks of history, flat
      athleteProfile: { coachSpecialty: "bodybuilding", physiquePhase: "recomposition" },
    };
    // 4 weeks of flat data isn't enough for a 5-week-required recomp phase.
    expect(diagnoseNutrition(bbState)?.kind).not.toBe("target_needs_adjustment");
  });
});

describe("generateAdjustmentProposal — conservative, protein-protecting, only when diagnosed", () => {
  it("returns null when diagnoseNutrition hasn't actually returned target_needs_adjustment", () => {
    const state = { nutritionTargets: targets, foodLogs: daysOfLogs(5, { calories: 2500, protein: 180 }) };
    expect(generateAdjustmentProposal(state)).toBeNull();
  });

  it("proposes a conservative +-150 kcal step, never a drastic jump, and holds protein fixed", () => {
    const state = {
      nutritionTargets: targets,
      foodLogs: daysOfLogs(21, { calories: 2500, protein: 180 }),
      bodyweightLogs: flatBodyweight(28, 180),
      nutritionProfile: { primaryGoal: "fat_loss" },
    };
    const proposal = generateAdjustmentProposal(state);
    expect(proposal).not.toBeNull();
    expect(Math.abs(proposal.toCalories - proposal.fromCalories)).toBeLessThanOrEqual(150);
    expect(proposal.toMacros.protein).toBe(proposal.fromMacros.protein); // never cuts protein to hit a calorie number
  });

  it("direction follows the athlete's goal (fat_loss moves calories down, muscle_gain moves them up)", () => {
    const baseState = {
      nutritionTargets: targets,
      foodLogs: daysOfLogs(21, { calories: 2500, protein: 180 }),
      bodyweightLogs: flatBodyweight(28, 180),
    };
    const cutProposal = generateAdjustmentProposal({ ...baseState, nutritionProfile: { primaryGoal: "fat_loss" } });
    const bulkProposal = generateAdjustmentProposal({ ...baseState, nutritionProfile: { primaryGoal: "muscle_gain" } });
    expect(cutProposal.toCalories).toBeLessThan(cutProposal.fromCalories);
    expect(bulkProposal.toCalories).toBeGreaterThan(bulkProposal.fromCalories);
  });
});

describe("applyAdjustment — explicit athlete choice, never silent", () => {
  const proposal = {
    fromCalories: 2500,
    toCalories: 2350,
    fromMacros: { protein: 180, carbs: 250, fat: 70 },
    toMacros: { protein: 180, carbs: 212, fat: 70 },
    reason: "test reason",
  };
  const state = { nutritionTargets: targets, nutritionCoachAdjustments: [] };

  it("'declined' records the decision but never touches nutritionTargets", () => {
    const patch = applyAdjustment(state, proposal, "declined");
    expect(patch.nutritionTargets).toBeUndefined();
    expect(patch.nutritionCoachAdjustments[0].status).toBe("declined");
  });

  it("'accepted' applies the proposed calories/macros exactly", () => {
    const patch = applyAdjustment(state, proposal, "accepted");
    expect(patch.nutritionTargets.calories).toBe(2350);
    expect(patch.nutritionTargets.protein).toBe(180);
  });

  // PRE-EXISTING DEFECT, found while writing this baseline test, OUT OF SCOPE for this P0
  // round (meal-plan generation totals only — see the task authorization) and NOT fixed here.
  // NutritionAdjustmentCard.jsx calls onResolve(proposal, "modified", value) (past tense), but
  // applyAdjustment's own check is `action === "modify"` (no "d") — so the athlete's typed
  // replacement number is silently discarded and the ORIGINAL proposed calories get applied
  // instead, every time "Modify" is used. This test documents the actual current behavior
  // rather than hiding it; flagged in the P0 delivery report as a concern for the next phase.
  it("DEFECT (documented, not fixed in this P0): 'modified' action string doesn't match applyAdjustment's 'modify' check, so the athlete's typed number is silently ignored", () => {
    const patch = applyAdjustment(state, proposal, "modified", 2400);
    expect(patch.nutritionTargets.calories).toBe(2350); // proposal.toCalories, NOT the athlete's 2400 — this is the bug
  });

  it("every application is recorded in history with a reason, for later audit", () => {
    const patch = applyAdjustment(state, proposal, "accepted");
    expect(patch.nutritionTargets.history[0].reason).toBe("test reason");
  });
});
