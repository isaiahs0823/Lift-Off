import React, { useRef, useState } from "react";
import { ChevronRight, Upload, Download, AlertTriangle, Check, FileWarning } from "lucide-react";
import { parseImportFile, analyzeImport, applyImportPlan } from "../utils/workoutHistoryImport.js";
import { exportBackupFile } from "../utils/backup.js";

// ---------------- IMPORT WORKOUT HISTORY ----------------
// A separate, non-destructive workflow from Settings' "Restore Full Backup" (SettingsTab.jsx).
// That restore remains a full overwrite, unchanged, for its own purpose (moving this exact
// device's own prior export back onto itself). This screen instead MERGES a historical workout
// export — logs, workoutSessions, bodyweightLogs, readinessLogs, customExercises only — into
// whatever already exists, never touching the current program, custom plans/programs, settings,
// nutrition data, goals, photos, or equipment profiles (see workoutHistoryImport.js).
//
// Three-step UI, matching the three-step logic in workoutHistoryImport.js: choose file -> review
// the computed plan (nothing is written yet) -> download a safety backup, then confirm.
export default function ImportWorkoutHistoryScreen({ state, updateState, onBack }) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [plan, setPlan] = useState(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [result, setResult] = useState(null); // { imported, alreadySkipped }

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParseError(null);
    setPlan(null);
    setResult(null);
    setBackupDownloaded(false);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportFile(String(reader.result));
      if (!parsed.ok) {
        setParseError(parsed.error);
        return;
      }
      setPlan(analyzeImport(parsed.data, state));
    };
    reader.onerror = () => setParseError("Couldn't read that file.");
    reader.readAsText(file);
  };

  const handleDownloadSafetyBackup = () => {
    exportBackupFile(state);
    setBackupDownloaded(true);
  };

  const handleConfirmImport = () => {
    if (!plan) return;
    updateState((prev) => applyImportPlan(prev, plan));
    setResult({ imported: plan.summary.sessionsToImport, alreadySkipped: plan.summary.sessionsAlreadyImported });
    setPlan(null);
  };

  const startOver = () => {
    setFileName(null);
    setParseError(null);
    setPlan(null);
    setResult(null);
    setBackupDownloaded(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold text-white">Import Workout History</div>
        <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
          ← Back
        </button>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">About this import</div>
        <p className="text-xs text-v5-subtext leading-relaxed">
          This adds historical workouts, bodyweight, and readiness entries to what you already have — it never replaces or removes
          anything. Your current program, custom plans, settings, and nutrition data are never read from this file and are never
          changed. For a full device restore instead, use "Restore Full Backup" in Data Backup below.
        </p>
      </div>

      {!plan && !result && (
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
          <button
            onClick={handlePickFile}
            className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5"
          >
            <Upload size={14} /> Choose history file
          </button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileSelected} />
          {fileName && <div className="text-xs text-v5-subtext">{fileName}</div>}
          {parseError && (
            <div className="flex items-start gap-2 text-xs text-v5-red">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {parseError}
            </div>
          )}
        </div>
      )}

      {plan && (
        <>
          <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Preview — nothing has been imported yet</div>
            <Row label="Sessions to import" value={plan.summary.sessionsToImport} good />
            <Row label="Already present (will be skipped)" value={plan.summary.sessionsAlreadyImported} />
            <Row label="Potential conflicts (need your review)" value={plan.summary.potentialConflicts} warn={plan.summary.potentialConflicts > 0} />
            <Row label="New custom exercises" value={plan.summary.newCustomExercises} />
            <Row label="Aggregate-only sessions (no per-set detail available)" value={plan.summary.aggregateOnlySessions} />
            <Row label="Bodyweight entries to import" value={plan.summary.bodyweightToImport} />
            <Row label="Readiness entries to import" value={plan.summary.readinessToImport} />
            {plan.summary.unreconstructedDropVolume > 0 && (
              <Row label="Unverified drop-set volume included (not broken into individual sets)" value={`${Math.round(plan.summary.unreconstructedDropVolume).toLocaleString()} lb`} />
            )}
          </div>

          {plan.potentialConflicts.length > 0 && (
            <div className="border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                <FileWarning size={13} /> Review before continuing
              </div>
              <p className="text-xs text-v5-subtext">
                These import dates already have a session you logged yourself. They will NOT be imported automatically — resolve
                them yourself (in Workout History) if you want both, or neither, kept.
              </p>
              <div className="space-y-1.5">
                {plan.potentialConflicts.map((c, i) => (
                  <div key={i} className="text-xs text-v5-text border-t border-white/[0.06] pt-1.5">
                    {c.candidate.planName} — {String(c.candidate.startedAt).slice(0, 10)} ({c.reason})
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.aggregateOnlySessions.length > 0 && (
            <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Aggregate-only sessions</div>
              <p className="text-xs text-v5-subtext">
                These will show real date, duration, and volume, but no individual exercises — the source export never had per-set
                detail for them.
              </p>
              {plan.aggregateOnlySessions.map((s) => (
                <div key={s.id} className="text-xs text-v5-text">
                  {s.planName} — {String(s.startedAt).slice(0, 10)} · {s.workingSets} sets · {s.totalVolume.toLocaleString()} lb
                </div>
              ))}
            </div>
          )}

          <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-widest text-v5-red">Before you import</div>
            <p className="text-xs text-v5-subtext">Download a safety backup of what you have right now — just in case.</p>
            <button
              onClick={handleDownloadSafetyBackup}
              className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40 flex items-center justify-center gap-1.5"
            >
              <Download size={14} /> {backupDownloaded ? "Safety backup downloaded" : "Download safety backup"}
              {backupDownloaded && <Check size={14} className="text-v5-red" />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirmImport}
              disabled={!backupDownloaded || plan.summary.sessionsToImport === 0}
              className={`flex-1 py-3 text-xs uppercase tracking-widest font-bold border flex items-center justify-center gap-1.5 ${
                !backupDownloaded || plan.summary.sessionsToImport === 0
                  ? "border-white/10 bg-v5-muted/50 text-v5-subtext/60 cursor-not-allowed"
                  : "border-v5-red bg-v5-red text-white hover:opacity-90"
              }`}
            >
              Import {plan.summary.sessionsToImport} session{plan.summary.sessionsToImport === 1 ? "" : "s"}
            </button>
            <button onClick={startOver} className="px-5 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
              Cancel
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="border border-v5-red/40 bg-v5-red/10 p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-v5-red flex items-center gap-1.5">
            <Check size={14} /> Import complete
          </div>
          <p className="text-sm text-white">
            {result.imported} session{result.imported === 1 ? "" : "s"} imported.
            {result.alreadySkipped > 0 && ` ${result.alreadySkipped} already present, skipped.`}
          </p>
          <p className="text-xs text-v5-subtext">Your existing workouts, programs, and settings were not changed.</p>
          <button onClick={startOver} className="text-xs uppercase tracking-widest text-v5-red hover:opacity-90 flex items-center gap-1">
            Import another file <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, good, warn }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-v5-subtext">{label}</span>
      <span className={`font-bold ${warn ? "text-amber-400" : good ? "text-v5-red" : "text-v5-text"}`}>{value}</span>
    </div>
  );
}
