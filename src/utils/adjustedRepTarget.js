// ---------------- ADJUSTED REP TARGET ----------------
// When an athlete changes a working set's weight away from BRK's suggested weight for that set,
// this recomputes an equivalent rep target at the NEW load — "Aim for 7 reps" — so the suggested
// effort stays roughly consistent even though the suggested load no longer applies. Purely a
// read-only display cue: it never changes what the athlete actually types into Reps, never
// touches confirmedSets/workout history/the saved program, and is recomputed fresh on every call
// rather than stored anywhere.
//
// Reviewed BRK's existing strength-estimation math first — estimateOneRM (a plain Epley
// weight*(1+reps/30)) is duplicated locally across analytics.js, athleteRating.js, goalData.js,
// workoutShareCard.js, weeklyReview.js, and dataWorkbook.js. None of those support the INVERSE
// direction this needs (solve for reps at a new weight, holding effort constant) or account for a
// prescribed RIR, so this implements the inverse-Epley formula directly instead of reusing them.

// Epley-style %1RM estimation is widely considered unreliable much past ~12-15 reps; 30 is the
// formula's own constant (its denominator) and a generous outer bound past which a result is
// flagged "outside the model's supported range" rather than shown as if it were dependable.
const MODEL_MIN_REPS = 1;
const MODEL_MAX_REPS = 30;

// Epley with an RIR offset treats "reps + RIR" as the effective rep count toward the same
// estimated 1RM: 1RM ~ weight * (1 + (reps + rir) / 30). Holding that 1RM (and RIR) constant
// across a weight change and solving for the new rep count gives:
//   adjustedReps = (originalWeight / newWeight) * (30 + originalReps + targetRIR) - 30 - targetRIR
export function computeAdjustedRepTarget({ originalWeight, originalReps, newWeight, targetRIR }) {
  if (!(originalWeight > 0) || !(originalReps > 0) || !(newWeight > 0)) return null;
  const rir = targetRIR ?? 0;
  const raw = (originalWeight / newWeight) * (30 + originalReps + rir) - 30 - rir;
  if (!Number.isFinite(raw)) return null;
  // Round once, for display only — every recomputation (repeated weight changes, reverting to
  // the original weight) always starts back over from the untouched originalWeight/originalReps
  // inputs, never from a previously-rounded result, so rounding error can never compound and
  // landing back on the original weight always reproduces the original reps exactly (ratio = 1).
  const reps = Math.round(raw);
  return { reps, raw, outOfModelRange: reps < MODEL_MIN_REPS || reps > MODEL_MAX_REPS };
}

// Name-keyword heuristics for "does this rep-target math even apply to this exercise" — the same
// established convention equipmentProfiles.js's isMachineBasedExercise already uses (BRK's
// ~300-exercise names consistently flag these categories; no new field needed across the whole
// library). Deliberately conservative: a name is only treated as compatible when NONE of these
// match, since showing a nonsensical "aim for N reps" is worse than showing no cue at all.
const ASSISTED_KEYWORDS = ["assisted"];
// reps:1 is how BRK's own program data already represents these (see farmers_carry/plank's
// prescriptions in App.jsx) — the logged number isn't a rep count at all.
const TIMED_OR_CARRY_KEYWORDS = ["hold", "plank", "carry", "dead hang", "farmer"];
// Bodyweight-family movements — excluded even when the name says "weighted" (e.g. "Weighted
// pull-up", "Weighted chin-up", "Weighted dip" — the only three such naming variants in BRK's
// whole exercise library; "bodyweight_pullup"/"Pull-Up", "Wide-Grip Pull-Up", "Chest dip", etc.
// are the plain unweighted ones and were already excluded regardless). An earlier version of this
// file re-included the "weighted" variant, on the assumption its logged weight was the full load.
// It isn't: BRK's weight field for these logs ADDED resistance only (a belt plate, a held
// dumbbell), not the athlete's bodyweight-plus-load. The inverse-Epley ratio math assumes the
// weight field IS the full load, so +25 lb -> +35 lb reads as a ~40% jump even though the actual
// total load barely moved, producing a misleading rep target. Suppressed here until BRK models
// effective load (bodyweight + added resistance) for these — a separate change; normal weight/
// reps logging for these exercises is completely unaffected, only this cue is hidden.
const BODYWEIGHT_FAMILY_KEYWORDS = [
  "push-up",
  "pushup",
  "pull-up",
  "pullup",
  "chin-up",
  "chinup",
  "dip",
  "bodyweight",
  "pistol squat",
  "sissy squat",
  "nordic",
  "handstand",
  "inverted row",
  "ring row",
  "muscle-up",
  "l-sit",
];

export function isAdjustedRepTargetCompatible(ex) {
  if (!ex?.name) return false;
  if (ex.type !== "compound" && ex.type !== "isolation") return false; // excludes conditioning/cardio-style entries
  const n = ex.name.toLowerCase();
  if (ASSISTED_KEYWORDS.some((k) => n.includes(k))) return false;
  if (TIMED_OR_CARRY_KEYWORDS.some((k) => n.includes(k))) return false;
  if (BODYWEIGHT_FAMILY_KEYWORDS.some((k) => n.includes(k))) return false;
  return true;
}

function rirRangeMid(rir) {
  if (!Array.isArray(rir) || rir.length !== 2) return null;
  return (rir[0] + rir[1]) / 2;
}
function formatRirLabel(rir) {
  if (!Array.isArray(rir) || rir.length !== 2) return null;
  const [lo, hi] = rir;
  const bothOne = lo === 1 && hi === 1;
  return `Leave ${lo === hi ? lo : `${lo}–${hi}`} rep${bothOne ? "" : "s"} in reserve`;
}

// The one entry point TrainingExerciseCard calls. `ex` is the exercise catalog entry (exMap[exId]
// — name/type, for compatibility), `exSlot` is the plan's prescribed slot for this exercise
// instance (sets/reps/repRange/rir — all optional beyond exId/sets), `originalWeight`/
// `originalReps` are BRK's own suggested weight/reps for this set (suggestNext's suggestion/
// targetReps — the SAME stable baseline "Use Suggested" already resets the fields to, never the
// currently-typed weight), and `newWeight` is whatever is currently typed into the Weight field.
// Returns null when the cue doesn't apply at all (wrong set type, incompatible exercise, no valid
// suggestion to calculate from yet, or no valid weight typed in); otherwise an
// { outOfRange: true, label } or { outOfRange: false, reps, isEstimate, label } cue to display.
export function adjustedRepTargetCue({ ex, exSlot, setType, originalWeight, originalReps, newWeight }) {
  if (setType && setType !== "working") return null; // warm-ups and any other non-working set type
  if (!isAdjustedRepTargetCompatible(ex)) return null;
  const nw = Number(newWeight);
  if (!(originalWeight > 0) || !(originalReps > 0) || !(nw > 0)) return null;

  const rirRange = Array.isArray(exSlot?.rir) ? exSlot.rir : null;
  const targetRIR = rirRangeMid(rirRange);
  const result = computeAdjustedRepTarget({ originalWeight, originalReps, newWeight: nw, targetRIR: targetRIR ?? 0 });
  if (!result) return null;

  const repRange = Array.isArray(exSlot?.repRange) ? exSlot.repRange : null;
  const outOfProgramRange = !!repRange && (result.reps < repRange[0] || result.reps > repRange[1]);
  if (result.outOfModelRange || outOfProgramRange) {
    return { outOfRange: true, label: "Outside the target rep range" };
  }

  const isEstimate = targetRIR == null;
  const rirLabel = rirRange ? formatRirLabel(rirRange) : null;
  const repsLabel = `Aim for ${result.reps} rep${result.reps === 1 ? "" : "s"}`;
  return {
    outOfRange: false,
    reps: result.reps,
    isEstimate,
    label: rirLabel ? `${repsLabel} · ${rirLabel}` : isEstimate ? `${repsLabel} (rough estimate)` : repsLabel,
  };
}
