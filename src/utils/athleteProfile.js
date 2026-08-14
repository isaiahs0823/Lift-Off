// ---------------- ATHLETE PROFILE (Coach memory Layer 1) ----------------
// "Who the person says they are" — structured, user-owned, always overridable. Kept
// deliberately separate from Layer 2 (training data) and Layer 3 (coachMemoryStore.js's
// evolving observed/inferred memory) per the three-layer model: a stated preference here never
// gets silently overridden by an inference, and an inference never gets treated as a stated
// fact.

export const COACHING_STYLES = ["supportive", "balanced", "direct", "hard"];
export const COACHING_STYLE_LABEL = {
  supportive: "Supportive",
  balanced: "Balanced",
  direct: "Direct",
  hard: "Hard Accountability",
};
export const COACHING_STYLE_DESC = {
  supportive: "Positive, patient, encouraging. Still truthful.",
  balanced: "Direct when necessary, but generally measured.",
  direct: "Minimal sugar-coating. Calls out obvious inconsistencies.",
  hard: "Very direct. Challenges excuses and avoidance. Still respectful — never abusive.",
};

export const RESPONSE_LENGTHS = ["short", "standard", "detailed"];
export const RESPONSE_LENGTH_LABEL = { short: "Short", standard: "Standard", detailed: "Detailed" };

export const EXPERIENCE_LEVELS = ["new", "beginner", "intermediate", "advanced"];
export const EXPERIENCE_LABEL = { new: "Brand new", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

export function defaultAthleteProfile() {
  return {
    experience: null,
    preferredDays: null,
    preferredDuration: null,
    trainingStyle: "",
    equipment: [],
    gymType: null,
    likedCardio: [],
    dislikedCardio: [],
    favoriteExercises: [],
    dislikedExercises: [],
    motivation: "",
    constraints: [],
    coachingStyle: "balanced",
    responseLength: "short",
    learningEnabled: true,
    onboardedAt: null,
    updatedAt: null,
  };
}

export function hasProfile(state) {
  return !!state.athleteProfile?.onboardedAt;
}

// Fills in anything missing from an older/partial saved profile without discarding real user
// data — same defensive-merge pattern used for state.settings elsewhere in the app.
export function resolveProfile(state) {
  return { ...defaultAthleteProfile(), ...(state.athleteProfile || {}) };
}

export const KNOWLEDGE_LEVELS = ["learning", "developing", "established", "deep_history"];
export const KNOWLEDGE_LEVEL_LABEL = {
  learning: "Learning",
  developing: "Developing",
  established: "Established",
  deep_history: "Deep History",
};
export const KNOWLEDGE_LEVEL_DESC = {
  learning: "Still building a picture — give it consistent data.",
  developing: "Early patterns are starting to show.",
  established: "Enough history to compare trends with confidence.",
  deep_history: "Months of consistent data — the Coach has real context here.",
};

// Reflects available *data volume*, not a gamified level and not any claim of medical or
// psychological insight (section 45) — purely "how much has this athlete actually logged."
export function coachKnowledgeLevel(state) {
  const sessions = state.workoutSessions || [];
  if (sessions.length === 0) return "learning";
  const sorted = [...sessions].sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));
  const daysActive = Math.max(0, Math.round((Date.now() - new Date(sorted[0].finishedAt).getTime()) / 86400000));
  const count = sessions.length;
  if (daysActive >= 90 && count >= 30) return "deep_history";
  if (daysActive >= 42 && count >= 8) return "established";
  if (daysActive >= 14) return "developing";
  return "learning";
}
