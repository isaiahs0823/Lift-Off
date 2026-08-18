// ---------------- DATA WORKBOOK — EXPORT ----------------
// Turns the read-only aggregates from dataWorkbook.js into downloadable files. Uses the SheetJS
// community `xlsx` package (MIT) for real .xlsx generation — the only new dependency this
// feature adds. It's used strictly on the write path here (XLSX.utils.* + XLSX.write to build
// and serialize a workbook from BRK's own known-shape data); the two open advisories against
// this package (prototype pollution / ReDoS) are both in the *parsing* path (XLSX.read on an
// untrusted file), which this feature never calls.
//
// The browser-download mechanism (Blob -> URL.createObjectURL -> temporary <a download> ->
// click -> revoke) mirrors App.jsx's existing exportBackupFile exactly, so this reuses a
// pattern already proven in production rather than inventing a second one.
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// "BRK_Fitness_Data_2026.xlsx" for a calendar-year preset, "BRK_Fitness_Data_2026-01-01_to_2026-08-18.xlsx"
// for anything else (custom range, trailing-days presets, all time).
export function buildExportFilename(range, ext) {
  const dateKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  let core;
  if ((range.preset === "thisYear" || range.preset === "lastYear") && range.start) {
    core = String(range.start.getFullYear());
  } else if (range.preset === "allTime" || !range.start) {
    core = "All_Time";
  } else {
    core = `${dateKey(range.start)}_to_${dateKey(range.end)}`;
  }
  return `BRK_Fitness_Data_${core}.${ext}`;
}

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((row) => lines.push(headers.map((h) => csvEscape(row[h])).join(",")));
  return lines.join("\r\n");
}

// ---------------- CSV EXPORT ----------------
// One file, prioritizing performed-set history (the analysis-friendly raw export) over a ZIP
// of several files — nothing in this feature needs a second dataset badly enough to justify
// the added complexity of a ZIP library.
export function exportCsv(setRows, range) {
  const headers = ["date", "session", "exercise", "setNumber", "setType", "weight", "reps", "rir", "rpe", "volume", "pr", "notes"];
  const rows = setRows.map((r) => ({
    date: r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
    session: r.sessionName,
    exercise: r.exerciseName,
    setNumber: r.setNumber,
    setType: r.setType,
    weight: r.weight,
    reps: r.reps,
    rir: r.rir ?? "",
    rpe: r.rpe ?? "",
    volume: r.volume,
    pr: r.isPr ? "PR" : "",
    notes: "",
  }));
  const csv = toCsv(headers, rows);
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), buildExportFilename(range, "csv"));
}

// ---------------- JSON EXPORT ----------------
// Clean enough to hand to an AI tool and ask "analyze my training history" — flat, labeled,
// no internal ids beyond what's needed to relate a set back to its session.
export function exportJson(computed, range) {
  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    selectedRange: { preset: range.preset, start: range.start ? range.start.toISOString() : null, end: range.end.toISOString() },
    overview: computed.overview,
    workoutSessions: computed.sessionRows,
    performedSets: computed.setRows,
    exercisePerformance: computed.exerciseRows,
    bodyweight: computed.bodyweightRows,
    readiness: computed.readinessRows,
    nutrition: computed.nutritionRows,
  };
  const json = JSON.stringify(payload, null, 2);
  triggerDownload(new Blob([json], { type: "application/json" }), buildExportFilename(range, "json"));
}

// ---------------- EXCEL EXPORT ----------------
// One worksheet per dataset, added only when that dataset actually has rows — a user with no
// nutrition history doesn't get a blank Nutrition tab. Summary is always present.
// The xlsx library (~280KB gzipped) is only ever needed once someone actually taps "Export
// Excel" — dynamically imported here so it never inflates the main bundle every other BRK
// screen has to load on first paint. Vite/Rollup splits it into its own chunk automatically.
export async function exportXlsx(computed, range) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const o = computed.overview;

  const summaryRows = [
    ["Export date", new Date().toISOString().slice(0, 10)],
    ["Selected range", range.label],
    ["Date range", range.sublabel],
    ["Workouts completed", o.workoutsCompleted],
    ["Training days", o.trainingDays],
    ["Total exercises performed", o.totalExercises],
    ["Total working sets", o.totalWorkingSets],
    ["Total reps", o.totalReps],
    ["Total training volume (lb)", o.totalVolume ?? "N/A"],
    ["Total workout duration (avg, per session)", o.avgDurationLabel ?? "N/A"],
    ["PR count", o.prCount],
    ["Average readiness", o.avgReadiness ?? "N/A"],
    ["Starting bodyweight", o.startingBodyweight ?? "N/A"],
    ["Ending bodyweight", o.endingBodyweight ?? "N/A"],
    ["Bodyweight change", o.bodyweightChange ?? "N/A"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  if (computed.sessionRows.length) {
    const headers = ["Date", "Workout", "Duration", "Body Parts", "Exercises", "Working Sets", "Volume", "Avg RIR", "PRs"];
    const rows = computed.sessionRows.map((r) => [
      r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      r.planName,
      r.durationLabel,
      r.bodyParts,
      r.exerciseCount ?? "",
      r.workingSets ?? "",
      r.volume ?? "",
      r.avgRir ?? "",
      r.prCount,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Workout Sessions");
  }

  if (computed.setRows.length) {
    const headers = ["Date", "Session", "Exercise", "Set #", "Type", "Weight", "Reps", "RIR", "RPE", "Volume", "PR"];
    const rows = computed.setRows.map((r) => [
      r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      r.sessionName,
      r.exerciseName,
      r.setNumber,
      r.setType,
      r.weight,
      r.reps,
      r.rir ?? "",
      r.rpe ?? "",
      r.volume,
      r.isPr ? "PR" : "",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Exercise Performance");
  }

  if (computed.exerciseRows.length) {
    const headers = ["Exercise", "First Performed", "Most Recent", "Best Weight", "Best Reps @ Best Weight", "Best Est. 1RM", "Total Sets", "Total Reps", "Total Volume", "Sessions"];
    const rows = computed.exerciseRows.map((r) => [
      r.name,
      r.firstDate ? new Date(r.firstDate).toISOString().slice(0, 10) : "",
      r.lastDate ? new Date(r.lastDate).toISOString().slice(0, 10) : "",
      r.bestWeight ?? "",
      r.bestWeightReps ?? "",
      r.bestE1RM ?? "",
      r.totalSets,
      r.totalReps,
      r.totalVolume,
      r.sessionCount,
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Exercise Progress");
  }

  if (computed.bodyweightRows.length) {
    const headers = ["Date", "Weight", "Waist", "Body Fat %", "Notes"];
    const rows = computed.bodyweightRows.map((r) => [
      r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      r.weight ?? "",
      r.waist ?? "",
      r.bodyFat ?? "",
      r.notes || "",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Bodyweight");
  }

  if (computed.readinessRows.length) {
    const headers = ["Date", "Sleep Quality", "Sleep Hours", "Soreness", "Stress", "Energy", "Readiness Score", "Notes"];
    const rows = computed.readinessRows.map((r) => [
      r.date ? new Date(r.date).toISOString().slice(0, 10) : "",
      r.sleepQuality ?? "",
      r.sleepHours ?? "",
      r.soreness ?? "",
      r.stress ?? "",
      r.energy ?? "",
      r.score ?? "",
      r.notes || "",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Readiness");
  }

  if (computed.nutritionRows.length) {
    const headers = ["Date", "Calories", "Protein", "Carbs", "Fat", "Calorie Target", "Protein Target", "Carb Target", "Fat Target"];
    const rows = computed.nutritionRows.map((r) => [
      r.date,
      r.calories,
      r.protein,
      r.carbs,
      r.fat,
      r.calorieTarget ?? "",
      r.proteinTarget ?? "",
      r.carbTarget ?? "",
      r.fatTarget ?? "",
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Nutrition");
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(new Blob([wbout], { type: "application/octet-stream" }), buildExportFilename(range, "xlsx"));
}
