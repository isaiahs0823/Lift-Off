// ---------------- COACH AI TOOL SCHEMAS ----------------
// Pure, framework-agnostic tool definitions (OpenAI function-calling shape). Safe to import
// from both the Vercel serverless proxy (api/coach-chat.js, which sends these to the model)
// and the browser (src/utils/coachTools.js, which pairs each name with a real executor) — one
// source of truth for "what the AI Coach is allowed to ask BRK for," so the two sides can never
// drift out of sync.
//
// Everything here is either read-only (returns data already computed by an existing BRK util —
// no tool recomputes something another part of the app already calculates) or an explicit
// PROPOSAL (never mutates state itself; the client renders an Accept/Modify/Decline card and
// only the athlete's own tap calls the real mutation). saveMemory is the one tool that writes
// immediately — memory is low-stakes and already editable/deletable in "What Coach Knows About
// You," unlike a program, nutrition target, or commitment.
export const COACH_TOOL_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "getAthleteProfile",
      description: "Full athlete profile: experience, schedule, equipment, constraints, motivation, coaching style, physique phase and priorities.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getCurrentProgram",
      description: "The athlete's active training program, including every day and which day is next.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getRecentWorkouts",
      description: "Recent completed workout sessions with duration, working sets, volume, and PR counts.",
      parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20, description: "Max sessions to return, default 5." } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getWorkoutById",
      description: "One exact completed session by its id — every exercise, every set (weight/reps/RIR/set type), PRs, and the Coach review already generated for it. Use this for questions about a specific past workout.",
      parameters: { type: "object", properties: { sessionId: { type: "string" } }, required: ["sessionId"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getExerciseHistory",
      description: "Every logged set for one specific exercise, most recent first, plus BRK's current progression suggestion for it. Use this for 'how has X been progressing' questions.",
      parameters: { type: "object", properties: { exerciseName: { type: "string", description: "Exercise name as the athlete said it, e.g. 'incline press' or 'barbell row'." } }, required: ["exerciseName"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getRecentPRs",
      description: "Recent personal records across all exercises, with the previous value and the improvement.",
      parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20, description: "Default 5." } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getReadinessTrend",
      description: "Daily readiness check-in scores (sleep/soreness/stress/motivation/energy composite) over a recent window.",
      parameters: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 60, description: "Default 14." } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getBodyweightTrend",
      description: "Bodyweight log history, 7-day rolling average, and weekly rate of change.",
      parameters: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 180, description: "Default 30." } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getMuscleVolume",
      description: "This week's training volume (working sets) per muscle group, and whether each is trending up, flat, or down versus the prior week.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getProgressionSuggestion",
      description: "BRK's deterministic progression-engine suggestion for the next session of one exercise (the same number shown in Training Mode), with its reasoning.",
      parameters: { type: "object", properties: { exerciseName: { type: "string" } }, required: ["exerciseName"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getNutritionTargets",
      description: "Current calorie/protein/carb/fat targets and how they were calculated.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getNutritionAdherence",
      description: "How closely logged intake has matched targets over a recent window, and average macros.",
      parameters: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 60, description: "Default 7." } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getRecentFoodLogs",
      description: "Actual logged food entries over a recent window (what was eaten, when, which meal).",
      parameters: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 30, description: "Default 3." } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getCoachMemories",
      description: "Everything Coach has learned about this athlete — stated facts and observed/inferred behavioral patterns, each with a confidence level.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "getActiveCommitments",
      description: "Commitments the athlete currently has active, with progress toward each.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "saveMemory",
      description:
        "Record something worth remembering for future coaching — a stated fact the athlete told you directly, or a pattern you've observed with real evidence across multiple sessions. Do not save one-off remarks or anything already covered by an existing memory. Executes immediately (memory is low-stakes and the athlete can edit or delete it any time in 'What Coach Knows About You').",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["goals", "preferences", "constraints", "motivations", "behavioralPatterns", "trainingInsights", "coachingPreferences"] },
          text: { type: "string", description: "One clear sentence." },
          source: { type: "string", enum: ["stated", "observed", "inferred"], description: "'stated' = the athlete said this directly. 'observed'/'inferred' = a pattern you noticed — requires real evidence, not a single event." },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["category", "text", "source"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeCommitment",
      description:
        "Propose a new commitment for the athlete to accept. Does NOT create it — the athlete must explicitly accept the card this renders. Use only when the athlete is describing a real, recurring struggle (e.g. skipping cardio, missing protein), not for one-off requests.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Short human-readable description, e.g. '20 minutes of cardio, 3x this week'." },
          type: { type: "string", enum: ["conditioning", "workout", "custom", "nutrition_macro", "nutrition_logging"] },
          target: { type: "integer", description: "How many times this period." },
          period: { type: "string", enum: ["week"] },
          macro: { type: "string", enum: ["protein", "calories", "carbs", "fat"], description: "Only for type nutrition_macro." },
          macroTarget: { type: "number", description: "Gram/kcal threshold that counts as a hit that day — only for type nutrition_macro." },
        },
        required: ["text", "type", "target", "period"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "proposeNutritionTargetChange",
      description:
        "Check whether BRK's existing nutrition-adjustment logic recommends a calorie/macro target change right now, based on real bodyweight-trend-vs-adherence evidence. Returns the proposal for you to present — it does NOT apply anything. Only call this when the athlete is asking about their nutrition targets/progress, not proactively every turn.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

export const COACH_TOOL_NAMES = COACH_TOOL_SCHEMAS.map((t) => t.function.name);
