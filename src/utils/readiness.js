// ---------------- READINESS ----------------
// A 0-100 daily readiness score from a handful of 1-5 self-ratings. Deliberately simple and
// transparent — an unweighted average of six 0-100 sub-scores, no hidden coefficients, no
// claim to medical precision. Resting heart rate is logged for the user's own reference/trend
// but intentionally left out of the score itself (one un-calibrated number from a phone
// sensor shouldn't silently swing a "train hard or don't" verdict).

// Higher input = better for these (1-5): sleepQuality, motivation, energy.
// Higher input = worse for these (1-5): soreness, stress — inverted below.
export function computeReadinessScore(inputs) {
  const { sleepQuality, sleepHours, soreness, stress, motivation, energy } = inputs;
  const scores = [];

  if (sleepQuality != null) scores.push((sleepQuality / 5) * 100);
  if (soreness != null) scores.push(((6 - soreness) / 5) * 100);
  if (stress != null) scores.push(((6 - stress) / 5) * 100);
  if (motivation != null) scores.push((motivation / 5) * 100);
  if (energy != null) scores.push((energy / 5) * 100);
  if (sleepHours != null && sleepHours !== "") {
    // Banded rather than linear — a simple, explainable "close to 8 hours is good" curve.
    const h = Number(sleepHours);
    let s;
    if (h < 5) s = 30;
    else if (h < 6) s = 55;
    else if (h < 7) s = 75;
    else if (h <= 9) s = 100;
    else if (h <= 10) s = 85;
    else s = 70;
    scores.push(s);
  }

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function readinessBand(score) {
  if (score == null) return null;
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export const READINESS_RECOMMENDATION = {
  green: "Train as planned. Push progression where performance allows.",
  yellow: "Train, but avoid unnecessary failure work. Maintain load and reduce accessory volume if performance drops.",
  red: "Recovery is poor. Reduce volume and intensity. Prioritize movement quality and recovery.",
};

export const BAND_LABEL = { green: "GREEN", yellow: "YELLOW", red: "RED" };

// One-word-sentence version for compact surfaces (the Today dashboard card) — the full
// READINESS_RECOMMENDATION text is for the check-in screen itself.
export const READINESS_SHORT = {
  green: "Train as planned.",
  yellow: "Train, ease off failure work.",
  red: "Recovery is poor — take it easy.",
};
