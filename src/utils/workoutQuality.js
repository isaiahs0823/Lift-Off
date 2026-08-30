// ---------------- SET-QUALITY & PAIN/JOINT FLAGS ----------------
// Optional, per-set context an athlete can attach in a couple of taps — never required. This is
// training context, not a medical record: a body area, a 1-10 severity, and a short free-text
// note at most. Nothing here diagnoses a condition; see coachContext.js/coachTools.js for the
// explicit "never diagnose" framing passed to Coach.
//
// Lives entirely on the existing set object (`quality`) and log entry (`pain` on a set, or
// `jointNote` on the whole entry for discomfort that isn't tied to one specific rep) — no new
// top-level state, no second "sets" schema. A set/entry with neither field is exactly what BRK
// has always saved.

export const SET_QUALITY_LEVELS = ["clean", "grind", "form_breakdown", "pain"];
export const SET_QUALITY_LABEL = {
  clean: "Clean",
  grind: "Grind",
  form_breakdown: "Form Breakdown",
  pain: "Pain",
};
// Short glyphs for the quick in-workout picker — no icon library dependency, and distinct at a
// glance from the app's existing ✓ (PR/completed) and × (missed) glyphs.
export const SET_QUALITY_GLYPH = {
  clean: "✓",
  grind: "⚠",
  form_breakdown: "△",
  pain: "!",
};

export const PAIN_BODY_AREAS = ["Shoulder", "Elbow", "Wrist", "Back", "Hip", "Knee", "Ankle", "Other"];

// A set/entry whose quality should make BRK cautious about suggesting more load — task section
// 14/15: "If the best set was marked FORM BREAKDOWN or PAIN, BRK should avoid aggressive
// progression recommendations." Grind is a softer signal (surfaced in recap/reasons, not a hard
// block) — it still counts as real, intentional effort, just not clean technical evidence.
export function isConcerningQuality(quality) {
  return quality === "form_breakdown" || quality === "pain";
}

export function sanitizeQuality(raw) {
  return SET_QUALITY_LEVELS.includes(raw) ? raw : null;
}

export function sanitizePainInfo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const bodyArea = PAIN_BODY_AREAS.includes(raw.bodyArea) ? raw.bodyArea : null;
  const severity = Number.isFinite(raw.severity) ? Math.min(10, Math.max(1, Math.round(raw.severity))) : null;
  const note = typeof raw.note === "string" ? raw.note.slice(0, 200) : null;
  if (!bodyArea && severity == null && !note) return null;
  return { bodyArea, severity, note };
}

// A concise one-line label for a set's quality — used in the recap's ATTENTION section and
// history rows. Only rendered when there's something worth mentioning (never for "clean" or
// unflagged sets, which are the silent default).
export function qualityAttentionLabel(quality) {
  if (quality === "grind") return "Grind";
  if (quality === "form_breakdown") return "Form breakdown";
  if (quality === "pain") return "Pain";
  return null;
}

// "Reported in N of the last M sessions" per body area for one exercise — the pattern-detection
// piece behind task section 13 ("PAIN TREND") and the Coach-context "RECENT TRAINING FLAGS"
// (section 16). `logs` must already be filtered to one exId, most-recent first. Counts by LOG
// ENTRY (one per exercise per session), not by individual set, since "N of last M sessions" is
// the unit the task's own copy uses. Looks at both a set-level `pain` flag and the entry-level
// `jointNote` (task section 12) — either counts as "this session reported discomfort here."
export function painTrendForExercise(logsForExercise, { windowSessions = 4 } = {}) {
  const recent = logsForExercise.slice(0, windowSessions);
  if (recent.length === 0) return [];
  const byArea = new Map(); // bodyArea -> count of sessions reporting it
  recent.forEach((entry) => {
    const areasThisSession = new Set();
    (entry.sets || []).forEach((s) => {
      const area = s.pain?.bodyArea;
      if (area) areasThisSession.add(area);
    });
    if (entry.jointNote?.bodyArea) areasThisSession.add(entry.jointNote.bodyArea);
    areasThisSession.forEach((area) => byArea.set(area, (byArea.get(area) || 0) + 1));
  });
  return [...byArea.entries()]
    .map(([bodyArea, sessionsWithPain]) => ({ bodyArea, sessionsWithPain, sessionsWindow: recent.length }))
    .sort((a, b) => b.sessionsWithPain - a.sessionsWithPain);
}

// Recent-flags summary across every exercise — feeds Coach context (task section 16) and stays
// small/ambient like the app's other Coach-context pieces: only exercises with something to
// report appear at all.
export function recentTrainingFlags(logs, exMap, { windowSessions = 4, exerciseLimit = 5 } = {}) {
  const byExercise = new Map();
  (logs || []).forEach((l) => {
    if (!byExercise.has(l.exId)) byExercise.set(l.exId, []);
    byExercise.get(l.exId).push(l);
  });
  const results = [];
  byExercise.forEach((entries, exId) => {
    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    const trend = painTrendForExercise(sorted, { windowSessions });
    const mostRecent = sorted[0];
    const mostRecentTop = (mostRecent?.sets || []).reduce(
      (best, s) => (!best || (s.weight ?? 0) >= (best.weight ?? 0) ? s : best),
      null
    );
    const lastSetQuality = mostRecentTop?.quality && mostRecentTop.quality !== "clean" ? mostRecentTop.quality : null;
    if (trend.length === 0 && !lastSetQuality) return;
    results.push({
      exId,
      exerciseName: exMap?.[exId]?.name || exId,
      painTrend: trend,
      lastSetQuality,
    });
  });
  return results.slice(0, exerciseLimit);
}
