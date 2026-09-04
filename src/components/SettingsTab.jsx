import React, { useRef, useState } from "react";
import { ChevronRight, Download, Upload, FileSpreadsheet } from "lucide-react";
import { DEFAULT_REST_DEFAULTS, BACKUP_DATA_KEYS, exportBackupFile, parseBackupFile } from "../utils/backup.js";

// ---------------- SETTINGS TAB ----------------
// Extracted from App.jsx as part of a safe, incremental decomposition pass — this component
// only ever depended on props (state/updateState/onNavigate) plus the backup helpers now in
// utils/backup.js, so moving it here changes nothing about its behavior.
function notificationPermissionState() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export default function SettingsTab({ state, updateState, onNavigate }) {
  const fileInputRef = useRef(null);
  const [importMessage, setImportMessage] = useState(null); // { type: "error" | "success", text }
  // Section 10 — tracked as real state (not read fresh every render) so requesting permission
  // from the Enable button updates this screen immediately without needing a remount.
  const [notifPermission, setNotifPermission] = useState(notificationPermissionState);
  const requestRestTimerAlerts = async () => {
    // Only ever called from this button's onClick — a direct user gesture, never on load
    // (section 6). Browsers refuse/ignore a requestPermission() call made outside one anyway.
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
    } catch {
      setNotifPermission(notificationPermissionState());
    }
  };

  const handleExport = () => {
    exportBackupFile(state);
    setImportMessage({ type: "success", text: "Backup downloaded." });
  };

  const handleImportClick = () => {
    setImportMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = parseBackupFile(String(reader.result));
      if (!result.ok) {
        setImportMessage({ type: "error", text: result.error });
        return;
      }
      const confirmed = window.confirm(
        "Importing this backup will overwrite all current data on this device — logs, cardio logs, custom exercises, custom plans and programs, and your active program. This can't be undone. Continue?"
      );
      if (!confirmed) return;

      updateState((prev) => {
        const next = { ...prev };
        BACKUP_DATA_KEYS.forEach((key) => {
          if (key in result.data) next[key] = result.data[key];
        });
        // hasSeenOnboarding isn't backup data (it's a local "is this device set up" flag), but
        // a deliberate restore is never a fresh install — without this, importing real history
        // into a blank browser profile would still show the welcome screen until the next
        // full page reload triggers the same retroactive check loadInitialState() runs.
        next.hasSeenOnboarding = true;
        return next;
      });
      setImportMessage({ type: "success", text: "Backup restored." });
    };
    reader.onerror = () => setImportMessage({ type: "error", text: "Couldn't read that file." });
    reader.readAsText(file);
  };

  const counts = {
    logs: (state.logs || []).length,
    cardioLogs: (state.cardioLogs || []).length,
    customExercises: (state.customExercises || []).length,
    customPlans: (state.customPlans || []).length,
    customPrograms: (state.customPrograms || []).length,
    photos: (state.photos || []).length,
    completedPrograms: (state.completedPrograms || []).length,
    goals: (state.goals || []).length,
    bodyweightLogs: (state.bodyweightLogs || []).length,
  };

  const settings = { rirSystem: "rir", restDefaults: DEFAULT_REST_DEFAULTS, barWeight: 45, ...(state.settings || {}) };
  const updateSettings = (patch) => updateState((prev) => ({ ...prev, settings: { ...(prev.settings || {}), ...patch } }));
  const updateRestDefault = (category, val) =>
    updateSettings({ restDefaults: { ...(settings.restDefaults || DEFAULT_REST_DEFAULTS), [category]: Number(val) || 0 } });

  return (
    <div className="space-y-6">
      <div className="border border-white/10 bg-v5-elevated p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Training</div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Effort tracking</label>
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings({ rirSystem: "rir" })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                settings.rirSystem !== "rpe" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              RIR
            </button>
            <button
              onClick={() => updateSettings({ rirSystem: "rpe" })}
              className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold border ${
                settings.rirSystem === "rpe" ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
              }`}
            >
              RPE
            </button>
          </div>
          <p className="text-xs text-v5-subtext/70 mt-1.5">Reps in reserve (0–5+) or rate of perceived exertion (6–10), logged per set.</p>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Rest timer defaults (seconds)</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["compound", "Compound"],
              ["isolation", "Isolation"],
              ["conditioning", "Conditioning"],
              ["superset", "Superset"],
            ].map(([key, label]) => (
              <div key={key}>
                <div className="text-[11px] text-v5-subtext/70 mb-1">{label}</div>
                <input
                  type="number"
                  value={(settings.restDefaults || DEFAULT_REST_DEFAULTS)[key]}
                  onChange={(e) => updateRestDefault(key, e.target.value)}
                  className="w-full bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-v5-subtext mb-1.5">Barbell weight</label>
          <div className="flex gap-2 items-center">
            {[45, 35].map((w) => (
              <button
                key={w}
                onClick={() => updateSettings({ barWeight: w })}
                className={`px-4 py-2 text-xs font-bold border ${
                  settings.barWeight === w ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"
                }`}
              >
                {w} lb
              </button>
            ))}
            <input
              type="number"
              value={settings.barWeight}
              onChange={(e) => updateSettings({ barWeight: Number(e.target.value) || 0 })}
              placeholder="Custom"
              className="w-24 bg-v5-surface border border-white/10 text-v5-text px-3 py-2 text-sm focus:outline-none focus:border-v5-red"
            />
          </div>
        </div>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Rest Timer Alerts</div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-v5-text/90">Rest timer sound</div>
            <div className="text-xs text-v5-subtext/70">Plays a beep when rest ends, while BRK is open.</div>
          </div>
          <div className="flex gap-1.5 shrink-0 ml-3">
            <button
              onClick={() => updateSettings({ restTimerSound: true })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerSound !== false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              ON
            </button>
            <button
              onClick={() => updateSettings({ restTimerSound: false })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerSound === false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              OFF
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-v5-text/90">Vibration</div>
          <div className="flex gap-1.5 shrink-0 ml-3">
            <button
              onClick={() => updateSettings({ restTimerVibration: true })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerVibration !== false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              ON
            </button>
            <button
              onClick={() => updateSettings({ restTimerVibration: false })}
              className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerVibration === false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
            >
              OFF
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-v5-text/90">Background alerts</div>
            {notifPermission === "granted" && (
              <div className="flex gap-1.5 shrink-0 ml-3">
                <button
                  onClick={() => updateSettings({ restTimerBackgroundAlerts: true })}
                  className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerBackgroundAlerts !== false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
                >
                  ON
                </button>
                <button
                  onClick={() => updateSettings({ restTimerBackgroundAlerts: false })}
                  className={`px-3 py-1.5 text-[11px] font-bold border ${settings.restTimerBackgroundAlerts === false ? "bg-v5-red border-v5-red text-white" : "border-white/10 text-v5-subtext hover:border-v5-red/40"}`}
                >
                  OFF
                </button>
              </div>
            )}
          </div>
          {notifPermission === "default" && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-v5-subtext">BRK can notify you when your rest timer ends while your phone is locked or you're using another app.</p>
              <button onClick={requestRestTimerAlerts} className="px-4 py-2 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90">
                Enable
              </button>
            </div>
          )}
          {notifPermission === "denied" && <p className="text-xs text-v5-subtext/70 mt-1">OFF — Notification permission denied</p>}
          {notifPermission === "unsupported" && <p className="text-xs text-v5-subtext/70 mt-1">Not supported in this browser. Foreground sound still works.</p>}
        </div>
      </div>

      <div className="border border-white/10 bg-v5-elevated p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Data &amp; Privacy</div>
        <button
          onClick={() => onNavigate?.("dataWorkbook")}
          className="w-full flex items-center justify-between border border-white/10 p-3 hover:border-v5-red/40"
        >
          <div className="text-left flex items-center gap-3">
            <FileSpreadsheet size={18} className="text-v5-subtext shrink-0" />
            <div>
              <div className="text-sm font-bold text-white">My Data Workbook</div>
              <div className="text-xs text-v5-subtext mt-0.5">Review, filter, and export the fitness data BRK has collected.</div>
            </div>
          </div>
          <ChevronRight size={18} className="text-v5-subtext/70 shrink-0" />
        </button>
      </div>

      <div className="border border-v5-red/25 bg-v5-elevated p-4 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">Data backup</div>
          <p className="text-xs text-v5-subtext mt-1">
            Everything is stored on this device only — there's no account or server. Export a backup before
            switching phones or clearing browser data, and import it to restore.
          </p>
        </div>

        <div className="text-xs text-v5-subtext space-y-1">
          <div>{counts.logs} lift logs</div>
          <div>{counts.cardioLogs} run / conditioning logs</div>
          <div>{counts.customExercises} custom exercises</div>
          <div>{counts.customPlans} custom plans</div>
          <div>{counts.customPrograms} custom programs</div>
          <div>{counts.photos} progress photos</div>
          <div>{counts.completedPrograms} completed programs</div>
          <div>{counts.goals} goals</div>
          <div>{counts.bodyweightLogs} bodyweight entries</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleExport}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-v5-red bg-v5-red text-white hover:opacity-90 flex items-center justify-center gap-1.5"
          >
            <Download size={14} /> Export data
          </button>
          <button
            onClick={handleImportClick}
            className="flex-1 py-3 text-xs uppercase tracking-widest font-bold border border-white/10 bg-v5-elevated text-v5-text/90 hover:border-v5-red/40 flex items-center justify-center gap-1.5"
          >
            <Upload size={14} /> Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {importMessage && (
          <div className={`text-xs ${importMessage.type === "error" ? "text-v5-red" : "text-green-500"}`}>
            {importMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}
