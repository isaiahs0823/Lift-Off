// ---------------- SESSION / EXERCISE COMPARISON ----------------
// Single source of truth for "was this actually progress" — consumed by the Auto Post-Workout
// Recap, the Session Complete "vs last workout" block, Coach's post-workout review, Full Recap,
// and the share-card volume line. Before this file existed, each of those computed its own
// answer (usually a flat session.totalVolume delta), which is exactly the bug this fixes: total
// tonnage swings constantly for reasons that have nothing to do with getting stronger —
// different exercises, different equipment, more/fewer warm-ups or drop sets, a bodyweight-heavy
// day vs a loaded one. See the header note on computeSessionConfidence for the actual principle.
//
// CORE PRINCIPLE: progression is judged primarily at EXERCISE + EQUIPMENT level, against the
// most recent exposure that shares both — never just "whatever was logged most recently" and
// never a different equipment bucket (sameEquipmentBucket, same rule suggestNext/PR detection
// already use). Session-level total volume is supporting context, gated by how structurally
// comparable this session actually was to whatever it's being measured against.

import { countedSets } from "./workoutSets.js";
import { topSetOf } from "./progression.js";
import { sameEquipmentBucket, TEMPORARY_EQUIPMENT_CONTEXT } from "./equipmentProfiles.js";
import { computeReadinessScore, readinessBand } from "./readiness.js";

// Categorizes one exercise entry against the MOST RECENT prior log sharing the same exercise +
// equipment bucket — not the most recent log overall, and not "last workout." This is what makes
// a Monday (Smith Machine A) -> Thursday (Hammer Strength) -> next Monday (Smith Machine A)
// sequence correctly compare next-Monday against the first Monday, skipping right past Thursday's
// different machine. `priorLogsAll` must already be filtered to strictly-before this session
// (every caller does this once, up front, rather than re-filtering per exercise).
export function matchExerciseEntry(entry, priorLogsAll) {
  const priorForEx = priorLogsAll
    .filter((l) => l.exId === entry.exId && sameEquipmentBucket(l, entry.equipmentProfileId ?? null, entry.equipmentContext ?? null))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const priorEntry = priorForEx[0] || null;
  return progressionStatusFor(entry, priorEntry);
}

// A set's "load" for comparison purposes is its weight — 0 for a pure bodyweight set (BRK only
// ever stores ADDED weight, never a fabricated bodyweight-plus-load total; see
// equipmentProfiles.js/entryVolume). When weight is 0 on both sides of a comparison, the
// meaningful signal is reps, not a "0 x 8 -> 0 x 10" line that reads like a data error — this
// renders it as a plain bodyweight-reps comparison instead.
function formatTopSetChange(priorTop, newTop) {
  if (priorTop.weight === 0 && newTop.weight === 0) {
    return `${priorTop.reps} reps → ${newTop.reps} reps (bodyweight)`;
  }
  return `${priorTop.weight} × ${priorTop.reps} → ${newTop.weight} × ${newTop.reps}`;
}

// RIR/RPE context (task: "may represent a different performance signal... do not overstate
// precision because RIR is subjective, but do not ignore meaningful effort differences"). Only
// returned when BOTH sides actually logged it — never inferred, never defaulted — and only
// surfaced when the gap is large enough to matter (2+ RIR), since a 1-point wobble is exactly the
// subjectivity the spec says not to overstate.
function topSetRir(s) {
  if (s.rir != null) return s.rir;
  if (s.rpe != null) return 10 - s.rpe;
  return null;
}
function rirContext(priorTop, newTop) {
  const priorRir = topSetRir(priorTop);
  const newRir = topSetRir(newTop);
  if (priorRir == null || newRir == null) return null;
  const delta = newRir - priorRir;
  if (Math.abs(delta) < 2) return null;
  return delta > 0 ? `with more in reserve this time (${priorRir} → ${newRir} RIR)` : `at noticeably less reserve this time (${priorRir} → ${newRir} RIR)`;
}

function progressionStatusFor(entry, priorEntry) {
  if (entry.equipmentContext === TEMPORARY_EQUIPMENT_CONTEXT) {
    return { status: "equipment_different", message: "Different equipment used — direct load comparison excluded.", priorEntry: null };
  }
  if (!priorEntry) {
    return entry.equipmentProfileId
      ? { status: "new_profile_no_history", message: "New equipment profile — no prior comparison yet.", priorEntry: null }
      : { status: "first_time", message: "First time logged.", priorEntry: null };
  }
  // A prior entry with zero counted (non-warmup) sets isn't usable comparison data — treat it
  // like no prior entry rather than evidence of decline (never a misleading "0 x 0 -> X x Y").
  if (countedSets(priorEntry.sets).length === 0) {
    return { status: "no_comparable_prior", message: "No comparable prior performance.", priorEntry: null };
  }
  const newTop = topSetOf(entry.sets);
  const priorTop = topSetOf(priorEntry.sets);
  const rir = rirContext(priorTop, newTop);

  if (newTop.weight > priorTop.weight) {
    return {
      status: "increased_load",
      message: `+${Math.round((newTop.weight - priorTop.weight) * 10) / 10} lb at ${newTop.reps} reps`,
      priorTop,
      newTop,
      priorEntry,
      rirNote: rir,
    };
  }
  if (newTop.weight === priorTop.weight && newTop.reps > priorTop.reps) {
    return {
      status: "increased_reps",
      message: `+${newTop.reps - priorTop.reps} rep${newTop.reps - priorTop.reps === 1 ? "" : "s"} at the same load`,
      priorTop,
      newTop,
      priorEntry,
      rirNote: rir,
    };
  }
  if (newTop.weight === priorTop.weight && newTop.reps === priorTop.reps) {
    return { status: "matched", message: "Matched last comparable exposure", priorTop, newTop, priorEntry, rirNote: rir };
  }
  return {
    status: "declined",
    message: formatTopSetChange(priorTop, newTop),
    priorTop,
    newTop,
    priorEntry,
    rirNote: rir,
  };
}

const MATCHED_STATUSES = new Set(["increased_load", "increased_reps", "matched", "declined"]);

// Whole-session roll-up: HIGH/MODERATE/LOW confidence that total-session numbers (volume, set
// count) mean anything, derived from the SAME per-exercise matches above rather than a separate
// whole-session diff — if most of today's exercises found a real same-equipment comparison, the
// session's shape is by definition close to its comparison point; if few did, it isn't, whatever
// the reason (substitutions, equipment changes, a bodyweight-heavy day, a different program).
// avgStructureDelta catches the remaining case: same exercises/equipment, but working-set counts
// swung a lot (e.g. 2 sets today vs 5 last time) — that's still a real structural difference even
// though every exercise "matched."
export function computeSessionConfidence(perExercise) {
  const total = perExercise.length;
  if (total === 0) return { level: "low", matchedCount: 0, totalCount: 0, matchRatioPct: 0 };

  const matched = perExercise.filter((e) => MATCHED_STATUSES.has(e.progression.status));
  const matchedCount = matched.length;
  const matchRatio = matchedCount / total;

  const structureDeltas = matched
    .map((e) => {
      const priorCount = e.progression.priorEntry ? countedSets(e.progression.priorEntry.sets).length : 0;
      if (priorCount === 0) return null;
      return Math.abs(e.workingSetCount - priorCount) / priorCount;
    })
    .filter((d) => d != null);
  const avgStructureDelta = structureDeltas.length > 0 ? structureDeltas.reduce((a, b) => a + b, 0) / structureDeltas.length : 0;

  let level;
  if (matchRatio >= 0.8) level = avgStructureDelta > 0.35 ? "moderate" : "high";
  else if (matchRatio >= 0.4) level = "moderate";
  else level = "low";

  return { level, matchedCount, totalCount: total, matchRatioPct: Math.round(matchRatio * 100), avgStructureDelta };
}

// Supporting context for a decline — ONLY ever built from data actually stored for this session
// (exercise position, logged readiness), never invented. Returns [] when neither applies, which
// callers should treat as "no supporting context available," not as license to guess one.
export function declineContext({ entryIndex, totalEntries, state, sessionDateKey }) {
  const notes = [];
  if (totalEntries > 1 && entryIndex >= Math.ceil(totalEntries / 2)) {
    notes.push("this movement came later in today's session");
  }
  const readinessEntry = (state?.readinessLogs || []).find((r) => (r.date || "").slice(0, 10) === sessionDateKey);
  if (readinessEntry) {
    const band = readinessBand(computeReadinessScore(readinessEntry));
    if (band === "red") notes.push("readiness was lower today");
  }
  return notes;
}

// Descriptive-only volume line (task: "the metric itself is not bad, the interpretation is the
// problem") — never claims increased tonnage proves strength progress, never implies decreased
// tonnage is regression. Wording tiers with session confidence; always includes the real number.
export function describeSessionVolume({ perfDeltaPct, planName, confidence }) {
  if (perfDeltaPct == null || !confidence) return null;
  const pct = `${perfDeltaPct >= 0 ? "+" : ""}${perfDeltaPct}%`;
  const direction = perfDeltaPct >= 0 ? "increased" : "decreased";

  if (confidence.level === "high") {
    return `Total working volume ${direction} ${Math.abs(perfDeltaPct)}% with a similar exercise lineup and set structure to last ${planName}.`;
  }
  if (confidence.level === "moderate") {
    return `Total volume ${pct} vs last ${planName} — today's mix was mostly similar, so treat this as rough context alongside the lifts below, not a verdict on its own.`;
  }
  return `Total tonnage ${pct}, but today's exercise mix differed enough from last ${planName} that volume isn't directly comparable.`;
}

// Short "label: before -> after" lines for genuinely matched exercises, for UI lists and share
// cards. Caps at `limit` so a long session doesn't produce an unreadable wall of lines; callers
// should sort/filter perExercise by whatever's most relevant first (recent wins, PRs, etc.).
export function matchedExerciseLines(perExercise, limit = 3) {
  return perExercise
    .filter((e) => (e.progression.status === "increased_load" || e.progression.status === "increased_reps") && e.progression.priorTop && e.progression.newTop)
    .slice(0, limit)
    .map((e) => ({
      name: e.name,
      equipmentLabel: e.equipmentLabel,
      change: formatTopSetChange(e.progression.priorTop, e.progression.newTop),
      deltaLabel: e.progression.message,
    }));
}
