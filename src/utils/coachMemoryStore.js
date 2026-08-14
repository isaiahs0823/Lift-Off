// ---------------- COACH MEMORY STORE (Coach memory Layer 3) ----------------
// "What BRK has learned through conversations and repeated patterns" — persisted, evolving,
// user-controllable. Distinct from src/utils/coachMemory.js, which computes ephemeral facts
// fresh from raw data on every render; this file is where those facts get *promoted* into
// standing records that accumulate evidence, gain or lose confidence, and can be corrected or
// deleted by the user. Every function here is a pure read or a pure array-transform — nothing
// touches React or localStorage, matching the rest of the app's utils.

export const MEMORY_CATEGORIES = [
  "goals",
  "preferences",
  "constraints",
  "motivations",
  "behavioralPatterns",
  "trainingInsights",
  "coachingPreferences",
  "commitments",
];
export const MEMORY_CATEGORY_LABEL = {
  goals: "Goals",
  preferences: "Training preferences",
  constraints: "Constraints",
  motivations: "Motivation",
  behavioralPatterns: "Patterns Coach has noticed",
  trainingInsights: "Training insights",
  coachingPreferences: "Coaching style",
  commitments: "Commitments",
};
export const MEMORY_SOURCE = { STATED: "stated", OBSERVED: "observed", INFERRED: "inferred" };
export const MEMORY_STATUS = { ACTIVE: "active", IMPROVING: "improving", RESOLVED: "resolved", OUTDATED: "outdated" };

function normalize(text) {
  return (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}
function tokenize(text) {
  return normalize(text).split(/\s+/).filter(Boolean);
}
// Crude but honest similarity check — shared-token overlap over the smaller set. Enough to
// catch "user dislikes running" vs. "user hates running" as the same idea (section 34) without
// pretending to be real NLP.
function textSimilarity(a, b) {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared++;
  });
  return shared / Math.min(ta.size, tb.size);
}

export function findSimilarMemory(memories, key, text) {
  if (key) {
    const byKey = memories.find((m) => m.key === key);
    if (byKey) return byKey;
  }
  return memories.find((m) => textSimilarity(m.text, text) >= 0.6) || null;
}

function newId() {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createMemory({ category, text, source, key = null, tags = [], confidence }) {
  const now = new Date().toISOString();
  return {
    id: newId(),
    category,
    text,
    source,
    key,
    tags,
    status: MEMORY_STATUS.ACTIVE,
    confidence: Math.min(1, Math.max(0, confidence ?? (source === MEMORY_SOURCE.STATED ? 1 : 0.5))),
    evidenceCount: 1,
    consecutiveMisses: 0,
    createdAt: now,
    lastConfirmedAt: now,
    updatedAt: now,
  };
}

// One occurrence should never read as certainty (section 12): confidence grows with repeated
// evidence but is capped short of 1.0 for anything short of a directly-stated fact.
export function confidenceForEvidence(evidenceCount) {
  return Math.min(0.95, 0.4 + evidenceCount * 0.15);
}
export function confidenceLabel(evidenceCount) {
  if (evidenceCount <= 1) return "low";
  if (evidenceCount <= 3) return "moderate";
  return "high";
}

// Upserts a detector-sourced observation for the current sync pass: re-detecting an existing
// pattern bumps its evidence/confidence and revives it from improving/resolved back to active
// (a pattern that comes back is active again, not a brand-new fact); nothing existing is
// duplicated (section 34).
export function upsertObservedMemory(memories, { category, text, source, key, tags = [] }) {
  const existing = findSimilarMemory(memories, key, text);
  const now = new Date().toISOString();
  if (existing) {
    const evidenceCount = existing.evidenceCount + 1;
    return memories.map((m) =>
      m.id === existing.id
        ? {
            ...m,
            text,
            status: MEMORY_STATUS.ACTIVE,
            evidenceCount,
            consecutiveMisses: 0,
            confidence: confidenceForEvidence(evidenceCount),
            lastConfirmedAt: now,
            updatedAt: now,
            tags: [...new Set([...(m.tags || []), ...tags])],
          }
        : m
    );
  }
  return [...memories, createMemory({ category, text, source, key, tags, confidence: confidenceForEvidence(1) })];
}

// Called once per sync for every detector key that did NOT fire this pass — ages a standing
// memory toward resolved instead of leaving a stale claim standing forever (section 16).
// active -> improving on the first miss, improving -> resolved after 3 consecutive misses.
export function decayMemory(memories, key) {
  const existing = memories.find((m) => m.key === key && m.status !== MEMORY_STATUS.RESOLVED && m.status !== MEMORY_STATUS.OUTDATED);
  if (!existing) return memories;
  const misses = existing.consecutiveMisses + 1;
  let status = existing.status;
  if (status === MEMORY_STATUS.ACTIVE) status = MEMORY_STATUS.IMPROVING;
  else if (status === MEMORY_STATUS.IMPROVING && misses >= 3) status = MEMORY_STATUS.RESOLVED;
  return memories.map((m) => (m.id === existing.id ? { ...m, consecutiveMisses: misses, status, updatedAt: new Date().toISOString() } : m));
}

// A user-stated fact (Athlete Profile free text, an explicit "remember this" add) — always
// full confidence, since it isn't an inference to begin with.
export function addStatedMemory(memories, { category, text, tags = [] }) {
  const existing = findSimilarMemory(memories, null, text);
  const now = new Date().toISOString();
  if (existing) {
    return memories.map((m) => (m.id === existing.id ? { ...m, text, status: MEMORY_STATUS.ACTIVE, updatedAt: now } : m));
  }
  return [...memories, createMemory({ category, text, source: MEMORY_SOURCE.STATED, tags, confidence: 1 })];
}

export function editMemory(memories, id, text) {
  return memories.map((m) => (m.id === id ? { ...m, text, updatedAt: new Date().toISOString() } : m));
}

export function deleteMemory(memories, id) {
  return memories.filter((m) => m.id !== id);
}

// "Correct Coach" (section 15): the user says an inference was wrong. Rather than pretending
// the Coach was right, this either removes the memory outright or marks it outdated with
// reduced confidence, depending on how wrong it was — the caller decides which via `remove`.
export function correctMemory(memories, id, { remove = false } = {}) {
  if (remove) return memories.filter((m) => m.id !== id);
  return memories.map((m) =>
    m.id === id ? { ...m, status: MEMORY_STATUS.OUTDATED, confidence: Math.max(0.1, m.confidence - 0.4), updatedAt: new Date().toISOString() } : m
  );
}

// Simple keyword-overlap retrieval (section 32) — no query returns the strongest currently-
// active memories (used for ambient context like the Today snapshot); a query scores every
// memory by shared tokens/tags and returns the top matches, so "why does my bench keep
// stalling" pulls press/recovery-related memories, not unrelated cardio notes.
export function retrieveRelevantMemories(memories, queryText, { limit = 3 } = {}) {
  const candidates = memories.filter((m) => m.status !== MEMORY_STATUS.OUTDATED);
  if (!queryText) {
    return candidates
      .filter((m) => m.status === MEMORY_STATUS.ACTIVE)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }
  const qTokens = new Set(tokenize(queryText));
  const scored = candidates
    .map((m) => {
      const mTokens = new Set([...tokenize(m.text), ...(m.tags || []).map((t) => t.toLowerCase())]);
      let score = 0;
      qTokens.forEach((t) => {
        if (mTokens.has(t)) score++;
      });
      return { m, score };
    })
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || b.m.confidence - a.m.confidence);
  return scored.slice(0, limit).map((x) => x.m);
}
