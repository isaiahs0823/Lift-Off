// ---------------- COMMITMENTS ----------------
// "The user says they'll do something specific this week; the Coach checks later." Detection
// is deliberately narrow — one well-defined phrasing pattern, not general free-text parsing —
// because a false-positive commitment (putting words in the user's mouth) is worse than
// missing a real one (section 23: "do not turn casual statements into commitments
// automatically"). Only "conditioning" and "workout" commitments can be auto-graded against
// real logged data; anything else is left for the user to judge for themselves.

const TYPE_KEYWORDS = {
  conditioning: /conditioning|cardio|runs?|running|intervals?|sled/i,
  workout: /workouts?|sessions?|lifts?|lifting|training\s*days?/i,
};
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
const MACRO_KEYWORDS = { protein: "protein", calories: "calories", carbs: "carbs", carbohydrates: "carbs", fat: "fat" };

function wordToNumber(numWord) {
  return NUMBER_WORDS[numWord.toLowerCase()] ?? parseInt(numWord, 10);
}

// Nutrition section 32: two additional narrow, well-defined phrasings — kept just as strict as
// the training patterns below, and just as gradable against real logged data (dailyTotals /
// foodLogs), not a general free-text nutrition-intent parser.
function detectNutritionCommitment(text) {
  const macroMatch = (text || "").match(
    /\b(?:i'?m|i will|i'?ll)\s+(?:hit|hitting|reach|reaching)\s+(?:at least\s+)?(\d+)\s*g?\s*(protein|calories|carbs|carbohydrates|fat)\s+(\d+|one|two|three|four|five|six|seven)\s+days?\s+(?:this|next)?\s*week\b/i
  );
  if (macroMatch) {
    const macroTarget = parseInt(macroMatch[1], 10);
    const macro = MACRO_KEYWORDS[macroMatch[2].toLowerCase()];
    const target = wordToNumber(macroMatch[3]);
    if (macroTarget > 0 && target >= 1 && target <= 7) {
      return { text: `hit ${macroTarget}g ${macro} ${target} days this week`, type: "nutrition_macro", target, macro, macroTarget, period: "this_week" };
    }
  }

  const logMatch = (text || "").match(/\b(?:i'?m|i will|i'?ll)\s+log(?:ging)?\s+(?:everything|my food|all my food)\s+(?:for\s+)?(\d+|one|two|three|four|five|six|seven)\s+days?\b/i);
  if (logMatch) {
    const target = wordToNumber(logMatch[1]);
    if (target >= 1 && target <= 14) {
      return { text: `log everything ${target} days`, type: "nutrition_logging", target, period: "this_week" };
    }
  }
  return null;
}

// Matches "I'm doing/I will do/I'll complete <N> <thing> this/next week" — case-insensitive,
// N as a digit or spelled-out word up to seven. Returns null for anything else, including
// vaguer statements like "I should train more this week."
export function detectCommitment(text) {
  const nutrition = detectNutritionCommitment(text);
  if (nutrition) return nutrition;

  const m = (text || "").match(
    /\b(?:i'?m|i will|i'?ll)\s+(?:doing|do|complete|completing)\s+(\d+|one|two|three|four|five|six|seven)\s+([a-z\s]+?)\s+(this|next)\s+week\b/i
  );
  if (!m) return null;
  const target = wordToNumber(m[1]);
  if (!target || target < 1 || target > 14) return null;
  const rawType = m[2].trim();
  let type = "custom";
  if (TYPE_KEYWORDS.conditioning.test(rawType)) type = "conditioning";
  else if (TYPE_KEYWORDS.workout.test(rawType)) type = "workout";
  const period = m[3].toLowerCase() === "next" ? "next_week" : "this_week";
  return { text: `${target} ${rawType}`.trim(), type, target, period };
}

function weekRange(period) {
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const start = period === "next_week" ? new Date(monday.getTime() + 7 * 86400000) : monday;
  const end = new Date(start.getTime() + 7 * 86400000 - 1);
  return { start, end };
}

export function createCommitment({ text, type, target, period, macro, macroTarget }) {
  const { start, end } = weekRange(period);
  const now = new Date().toISOString();
  return {
    id: `commit_${Date.now()}`,
    text,
    type,
    target,
    period,
    macro, // "protein" | "calories" | "carbs" | "fat" — only set for type "nutrition_macro"
    macroTarget, // gram/kcal threshold that counts as "hit" that day
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    status: "active",
    createdAt: now,
    resolvedAt: null,
    outcome: null,
    actualCount: null,
  };
}

function countActuals(state, commitment) {
  const start = new Date(commitment.startDate).getTime();
  const end = new Date(commitment.endDate).getTime();
  const inRange = (dateStr) => {
    const t = new Date(dateStr).getTime();
    return t >= start && t <= end;
  };
  if (commitment.type === "conditioning") {
    return (state.cardioLogs || []).filter((c) => inRange(c.date)).length;
  }
  if (commitment.type === "workout") {
    return (state.workoutSessions || []).filter((s) => inRange(s.finishedAt)).length;
  }
  if (commitment.type === "nutrition_macro") {
    const byDate = {};
    (state.foodLogs || []).forEach((f) => {
      if (!inRange(f.date)) return;
      byDate[f.date] = (byDate[f.date] || 0) + (f[commitment.macro] || 0);
    });
    return Object.values(byDate).filter((v) => v >= commitment.macroTarget).length;
  }
  if (commitment.type === "nutrition_logging") {
    const daysLogged = new Set((state.foodLogs || []).filter((f) => inRange(f.date)).map((f) => f.date));
    return daysLogged.size;
  }
  return null;
}

// Resolves every active commitment whose window has closed — returns the full updated
// commitments array plus the subset that just resolved this pass, so the caller can surface a
// coach message for each. "custom"-type commitments (couldn't be matched to a measurable
// activity) are left active indefinitely rather than guessed at.
export function resolveDueCommitments(state) {
  const commitments = state.commitments || [];
  const now = Date.now();
  const resolved = [];
  const next = commitments.map((c) => {
    if (c.status !== "active" || c.type === "custom" || new Date(c.endDate).getTime() > now) return c;
    const actualCount = countActuals(state, c);
    const outcome = actualCount >= c.target ? "completed" : "missed";
    const updated = { ...c, status: outcome, outcome, actualCount, resolvedAt: new Date().toISOString() };
    resolved.push(updated);
    return updated;
  });
  return { commitments: next, resolved };
}

// style defaults to "balanced" so every existing call site (and the unit tests written against
// it) keeps its original text unchanged — only "supportive" and "hard" get distinct framing,
// matching the two extremes the coaching-style spec calls out by name (section 9/28).
export function commitmentOutcomeMessage(c, style = "balanced") {
  if (c.outcome === "completed") {
    if (style === "hard") return `You said ${c.target}. You did ${c.actualCount}. Good — now do it again. Once isn't a pattern yet.`;
    if (style === "supportive") return `You said ${c.target} and got ${c.actualCount} done. That's real follow-through — nice work.`;
    return `You said ${c.target}. You did ${c.actualCount}. That's execution.`;
  }
  if (style === "hard") return `You said ${c.target}. You did ${c.actualCount}. That's a broken commitment, not bad luck. Fix it or stop setting targets you don't intend to hit.`;
  if (style === "supportive") return `You aimed for ${c.target} and got ${c.actualCount} in. That's alright — what's one thing that would make next week easier?`;
  return `You committed to ${c.text}. You completed ${c.actualCount}. What needs to change?`;
}

// Live progress-so-far for an active, gradable commitment — used by the UI to show "1/3" while
// the week is still in progress, without waiting for resolveDueCommitments to close it out.
export function commitmentProgress(state, commitment) {
  return countActuals(state, commitment);
}
