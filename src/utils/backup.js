// ---------------- BACKUP / EXPORT-IMPORT ----------------
// The only backup mechanism available, since everything lives in localStorage with no
// server. Export/import cover every piece of user-created data — logs, cardio logs,
// custom exercises, custom plans and programs, and which program is currently active —
// not just workout logs. Extracted from App.jsx (previously module-level consts/functions
// there) as a self-contained, closure-free module so SettingsTab.jsx can import it directly
// instead of relying on App.jsx's own top-level scope.

export const DEFAULT_REST_DEFAULTS = { compound: 150, isolation: 90, conditioning: 60, superset: 45 };

export const BACKUP_DATA_KEYS = [
  "logs",
  "cardioLogs",
  "customExercises",
  "customPlans",
  "customPrograms",
  "currentProgram",
  "photos",
  "completedPrograms",
  "settings",
  "exerciseNotes",
  "workoutSessions",
  "recoverySessions",
  "goals",
  "bodyweightLogs",
  "readinessLogs",
  "coachHistory",
  "weeklySchedule",
  "scheduleLog",
  "recoveryLogs",
  "athleteProfile",
  "coachMemories",
  "commitments",
  "specialtyInterest",
  "coachAccess",
  "coachOnboarding",
  "coachConversations",
  "nutritionProfile",
  "nutritionTargets",
  "foodLogs",
  "savedFoods",
  "savedMeals",
  "favoriteFoods",
  "nutritionMealPlan",
  "nutritionCheckIns",
  "nutritionCoachAdjustments",
  "developmentPriorities",
  "programSwapLog",
  "equipmentProfiles",
];

// Per-key fallback when a key is missing from state entirely (older saves) — objects default
// to {}, currentProgram/weeklySchedule/athleteProfile/coachAccess/coachOnboarding/
// nutritionProfile/nutritionTargets/nutritionMealPlan to null, everything else (arrays) to [].
export function backupKeyDefault(key) {
  if (
    key === "currentProgram" ||
    key === "weeklySchedule" ||
    key === "athleteProfile" ||
    key === "coachAccess" ||
    key === "coachOnboarding" ||
    key === "nutritionProfile" ||
    key === "nutritionTargets" ||
    key === "nutritionMealPlan" ||
    key === "developmentPriorities"
  )
    return null;
  if (key === "settings" || key === "exerciseNotes" || key === "specialtyInterest") return {};
  return [];
}

export function exportBackupFile(state) {
  const payload = {
    app: "BRK - Lift",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(BACKUP_DATA_KEYS.map((k) => [k, state[k] ?? backupKeyDefault(k)])),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `brk-lift-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Returns { ok: true, data } or { ok: false, error }. Never throws.
export function parseBackupFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed.data || parsed : null;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "That file doesn't look like a BRK - Lift backup." };
  }
  const hasKnownKey = BACKUP_DATA_KEYS.some((k) => k in data);
  if (!hasKnownKey) {
    return { ok: false, error: "That file doesn't contain any recognizable BRK - Lift data." };
  }
  return { ok: true, data };
}
