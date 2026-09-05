import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Plus, Minus } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import { Card, SectionLabel, ButtonPrimary, ButtonSecondary, ButtonText, ProgressBar, Divider } from "./ui/Kit.jsx";
import { unlockAudio, playCompletionBeep, vibratePattern } from "../utils/timerAudio.js";

// ---------------- STANDALONE REST TIMER ----------------
// A pure training utility, deliberately decoupled from every workout-tracking concept — no
// `state`/`updateState` prop, no activeRun, no exercise, no session. This component cannot
// write to workoutSessions/PR history/progression/readiness/Coach history even by accident:
// it never receives a reference to app state in the first place. Someone coaching another
// person (the exact motivating case) can use this without starting or logging anything of
// their own.
//
// Timing follows the same drift-resistant pattern already proven by App.jsx's in-workout
// RestTimer: an absolute `endsAt` timestamp is the single source of truth, never a decrementing
// counter, so a throttled/backgrounded setInterval can never cause the displayed time to drift —
// visibilitychange/pageshow/focus force an immediate recompute against the real clock the
// instant the screen is active again. Persistence uses its own separate localStorage key
// ("brk-standalone-rest-timer") — distinct from the workout timer's "liftlog-rest-timer" key —
// so returning to this screen from elsewhere in the app shows the correct remaining time,
// without ever touching workout data. RESTS COMPLETED is intentionally plain useState (never
// persisted): it resets the moment this screen unmounts, exactly as the task requires.

const PRESETS = [30, 45, 60, 90, 120, 180];
const DONE_FLASH_MS = 1600;
const AUTO_REPEAT_RESTART_DELAY_MS = 900;
const MIN_DURATION = 5;
const MAX_DURATION = 1800;

const STORAGE_KEY = "brk-standalone-rest-timer";

function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function persist({ duration, endsAt, pausedRemainingMs, autoRepeat }) {
  try {
    if (endsAt != null || pausedRemainingMs != null) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ duration, endsAt, pausedRemainingMs, autoRepeat }));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable — timer still works, it just won't survive a tab switch/reload
  }
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

export default function StandaloneRestTimer({ onBack }) {
  const initial = loadPersisted();
  const [duration, setDuration] = useState(initial?.duration ?? 90);
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState(initial?.pausedRemainingMs ?? null);
  const [autoRepeat, setAutoRepeat] = useState(initial?.autoRepeat ?? false);
  const [justFinished, setJustFinished] = useState(false);
  const [restsCompleted, setRestsCompleted] = useState(0); // in-memory only — never persisted, never touches workout history
  const [customInput, setCustomInput] = useState("");
  const [, forceTick] = useState(0);

  const alertedForRef = useRef(initial?.alertedFor ?? null);
  const wakeLockRef = useRef(null);

  const isPaused = pausedRemainingMs != null;
  const remaining = isPaused
    ? Math.ceil(pausedRemainingMs / 1000)
    : endsAt != null
    ? Math.ceil((endsAt - Date.now()) / 1000)
    : duration;
  const isRunning = endsAt != null && remaining > 0;
  const isDone = endsAt != null && remaining <= 0;
  const displayState = isDone ? "DONE" : isPaused ? "PAUSED" : isRunning ? "RESTING" : "READY";
  const progressFrac = duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;

  // ---- Screen Wake Lock (section 7) — best-effort, fails silently where unsupported ----
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Unsupported, denied, or thrown outside a user gesture in some browsers — never fatal.
    }
  }, []);
  const releaseWakeLock = useCallback(() => {
    try {
      wakeLockRef.current?.release();
    } catch {
      // already released or unsupported
    }
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    // The browser itself auto-releases a wake lock when the tab is hidden — reacquire it the
    // instant this screen is visible again, but only if a countdown is still actually running.
    const reacquire = () => {
      if (document.visibilityState === "visible" && endsAt != null && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", reacquire);
    return () => document.removeEventListener("visibilitychange", reacquire);
  }, [endsAt, requestWakeLock]);

  useEffect(() => () => releaseWakeLock(), [releaseWakeLock]);

  // ---- persistence (section 13) ----
  useEffect(() => {
    persist({ duration, endsAt, pausedRemainingMs, autoRepeat });
  }, [duration, endsAt, pausedRemainingMs, autoRepeat]);

  // ---- completion (section 5/6) ----
  const fireCompletionIfDue = useCallback(() => {
    if (endsAt == null) return;
    if (Date.now() < endsAt) return;
    if (alertedForRef.current === endsAt) return;
    const completedEndsAt = endsAt;
    alertedForRef.current = completedEndsAt;

    if (document.visibilityState === "visible") {
      playCompletionBeep();
      vibratePattern([300, 150, 300, 150, 300]);
    }
    setRestsCompleted((c) => c + 1);
    setJustFinished(true);
    setTimeout(() => setJustFinished(false), DONE_FLASH_MS);

    if (autoRepeat) {
      setTimeout(() => {
        unlockAudio();
        setEndsAt((prev) => (prev === completedEndsAt ? Date.now() + duration * 1000 : prev));
        alertedForRef.current = null;
      }, AUTO_REPEAT_RESTART_DELAY_MS);
    } else {
      setTimeout(() => {
        setEndsAt((prev) => (prev === completedEndsAt ? null : prev));
        releaseWakeLock();
      }, DONE_FLASH_MS);
    }
  }, [endsAt, duration, autoRepeat, releaseWakeLock]);

  useEffect(() => {
    fireCompletionIfDue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => {
      forceTick((t) => t + 1);
      fireCompletionIfDue();
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt, fireCompletionIfDue]);

  useEffect(() => {
    const reconcile = () => {
      forceTick((t) => t + 1);
      fireCompletionIfDue();
    };
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("pageshow", reconcile);
    window.addEventListener("focus", reconcile);
    return () => {
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("pageshow", reconcile);
      window.removeEventListener("focus", reconcile);
    };
  }, [fireCompletionIfDue]);

  // ---- controls ----
  const startWithDuration = (secs) => {
    unlockAudio(); // must be called synchronously from this click handler for iOS to honor it
    requestWakeLock();
    setDuration(secs);
    setEndsAt(Date.now() + secs * 1000);
    setPausedRemainingMs(null);
    alertedForRef.current = null;
  };
  const togglePause = () => {
    if (isPaused) {
      unlockAudio();
      setEndsAt(Date.now() + pausedRemainingMs);
      setPausedRemainingMs(null);
      requestWakeLock();
    } else if (endsAt != null) {
      setPausedRemainingMs(Math.max(0, endsAt - Date.now()));
      setEndsAt(null);
      releaseWakeLock();
    }
  };
  const reset = () => {
    setEndsAt(null);
    setPausedRemainingMs(null);
    alertedForRef.current = null;
    releaseWakeLock();
  };
  const addSeconds = (n) => {
    if (isPaused) {
      setPausedRemainingMs((r) => Math.max(1000, (r ?? 0) + n * 1000));
    } else if (endsAt != null) {
      setEndsAt((prev) => Math.max(Date.now() + 1000, (prev ?? Date.now()) + n * 1000));
    } else {
      setDuration((d) => Math.min(MAX_DURATION, Math.max(MIN_DURATION, d + n)));
    }
  };
  const applyCustom = () => {
    const secs = Math.round(Number(customInput));
    if (!Number.isFinite(secs) || secs <= 0) return;
    const clamped = Math.min(MAX_DURATION, Math.max(MIN_DURATION, secs));
    setCustomInput("");
    startWithDuration(clamped);
  };

  const STATE_COLOR = {
    READY: "text-v5-subtext",
    RESTING: "text-v5-text",
    PAUSED: "text-v5-subtext",
    DONE: "text-v5-red",
  };

  return (
    <SlideInPanel title="Rest Timer" subtitle="Standalone — nothing is logged" onBack={onBack}>
      <Card padding="p-5" className="space-y-5">
        <div className="text-center space-y-1">
          <div className={`text-[11px] font-bold uppercase tracking-[0.2em] ${STATE_COLOR[displayState]} ${justFinished ? "animate-rest-flash" : ""}`}>
            {displayState}
          </div>
          <div className={`text-7xl font-bold tabular-nums leading-none ${isPaused ? "text-v5-subtext" : displayState === "DONE" ? "text-v5-red" : "text-v5-text"}`}>
            {formatTime(remaining)}
          </div>
        </div>

        <ProgressBar pct={progressFrac * 100} />

        <div className="flex items-center justify-center gap-2">
          <ButtonSecondary fullWidth={false} size="sm" icon={Minus} onClick={() => addSeconds(-15)} className="px-5">
            15s
          </ButtonSecondary>
          <ButtonPrimary
            size="lg"
            icon={isRunning ? Pause : Play}
            onClick={isRunning || isPaused ? togglePause : () => startWithDuration(duration)}
            className="flex-1"
          >
            {isRunning ? "Pause" : isPaused ? "Resume" : "Start"}
          </ButtonPrimary>
          <ButtonSecondary fullWidth={false} size="sm" icon={Plus} onClick={() => addSeconds(15)} className="px-5">
            15s
          </ButtonSecondary>
        </div>

        <ButtonText tone="muted" icon={RotateCcw} onClick={reset} className="w-full justify-center py-1">
          Reset
        </ButtonText>

        <div>
          <SectionLabel tone="muted" className="mb-2">Presets</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((secs) => (
              <button
                key={secs}
                onClick={() => startWithDuration(secs)}
                className={`py-2.5 rounded-lg text-sm font-bold tabular-nums ${
                  duration === secs && !isRunning && !isPaused ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext hover:text-v5-text"
                }`}
              >
                {formatTime(secs)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card padding="p-4" className="space-y-4">
        <div>
          <SectionLabel tone="muted" className="mb-1.5">Custom duration</SectionLabel>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_DURATION}
              max={MAX_DURATION}
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyCustom()}
              placeholder="Seconds"
              className="flex-1 bg-v5-elevated rounded-lg text-v5-text px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-v5-red placeholder:text-v5-subtext/50"
            />
            <ButtonSecondary fullWidth={false} onClick={applyCustom} className="px-5">
              Set
            </ButtonSecondary>
          </div>
        </div>

        <Divider />

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-v5-text/90 font-bold">Auto repeat</div>
            <div className="text-[11px] text-v5-subtext/70">Restarts automatically when it ends</div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => setAutoRepeat(true)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${autoRepeat ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext"}`}
            >
              ON
            </button>
            <button
              onClick={() => setAutoRepeat(false)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg ${!autoRepeat ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-subtext"}`}
            >
              OFF
            </button>
          </div>
        </div>

        <Divider />

        <div className="flex items-center justify-between">
          <SectionLabel tone="muted">Rests completed</SectionLabel>
          <div className="text-sm font-bold text-v5-text tabular-nums">{restsCompleted}</div>
        </div>
      </Card>
    </SlideInPanel>
  );
}
