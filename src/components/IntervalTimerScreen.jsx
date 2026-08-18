import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Pause, Play, Square } from "lucide-react";
import {
  reconcile,
  roundOf,
  completedRoundsOf,
  totalPhasesFor,
  phaseDurationSec,
  phaseNameFor,
  formatClock,
  validateConfig,
  INTERVAL_PRESETS,
  COUNTDOWN_WARNING_OPTIONS,
} from "../utils/intervalTimerEngine.js";
import { unlockAudio, playCompletionBeep, playCountdownTick, vibratePattern } from "../utils/timerAudio.js";

// Own, dedicated storage key — completely separate from the lifting Rest Timer's
// "liftlog-rest-timer". The two timers must never read or write each other's state; this is
// how that's enforced structurally, not just by convention.
const STORAGE_KEY = "liftlog-interval-timer";

function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function persist(data) {
  try {
    if (data) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — the session just won't survive a refresh/navigation
  }
}

const DEFAULT_CONFIG = {
  phase1Name: "Work",
  phase2Name: "Recovery",
  phase1Sec: 60,
  phase2Sec: 60,
  mode: "continuous", // "continuous" | "fixed"
  rounds: 8,
  countdownWarningSec: 0, // 0 | 3 | 5 | 10
};

function DurationInput({ label, totalSec, onChange }) {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={min}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 60 + sec)}
          className="w-16 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2.5 text-base text-center focus:outline-none focus:border-red-700"
          style={{ fontSize: 16 }}
          aria-label={`${label} minutes`}
        />
        <span className="text-neutral-600 text-sm">min</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="59"
          value={sec}
          onChange={(e) => onChange(min * 60 + Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
          className="w-16 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-2 py-2.5 text-base text-center focus:outline-none focus:border-red-700"
          style={{ fontSize: 16 }}
          aria-label={`${label} seconds`}
        />
        <span className="text-neutral-600 text-sm">sec</span>
      </div>
    </div>
  );
}

export default function IntervalTimerScreen({ updateState, allExercises, onBack }) {
  const persisted = loadPersisted();
  const [config, setConfig] = useState(persisted?.config ?? DEFAULT_CONFIG);
  // "setup" while idle/configuring, "active" while running/paused, "summary" right after Stop.
  const [screen, setScreen] = useState(persisted?.runtime?.status === "running" || persisted?.runtime?.status === "paused" ? "active" : "setup");
  const [runtime, setRuntime] = useState(persisted?.runtime ?? { status: "idle" });
  const [summary, setSummary] = useState(null);
  const [validationMsg, setValidationMsg] = useState(null);
  const [, forceTick] = useState(0);

  // Dedup guards for audio — mirrors RestTimer's alertedForRef pattern, but split in two:
  // alertedSeqRef prevents the SAME phase-transition from ever alerting twice (an interval tick
  // and a visibility-reconcile racing on return-from-background), while lastWarnedSecondRef
  // prevents a single countdown-tick second from firing more than once for the same reason.
  const alertedSeqRef = useRef(persisted?.runtime?.alertedSeq ?? null);
  const lastWarnedSecondRef = useRef(null);
  const lastWarnedPhaseEndsAtRef = useRef(null);

  useEffect(() => {
    if (runtime.status === "idle" || runtime.status === "complete") persist(null);
    else persist({ config, runtime: { ...runtime, alertedSeq: alertedSeqRef.current } });
  }, [config, runtime]);

  // The one place a phase transition is ever handled. `silent` is true for the catch-up walk
  // that runs on mount/visibility-return — however many phases were actually missed while
  // backgrounded are applied at once, but never replayed as a burst of stacked beeps; only a
  // transition crossed by the LIVE per-second tick (i.e. actually happening in real time while
  // BRK is foregrounded) plays a sound. This is what keeps "5 minutes backgrounded on 1-minute
  // phases" from turning into 5 beeps firing at once the moment the athlete looks at the phone.
  const applyReconcile = useCallback(
    (silent) => {
      setRuntime((prev) => {
        if (prev.status !== "running") return prev;
        const next = reconcile(config, prev, Date.now());
        if (next === prev) return prev;
        if (!silent && next.seq !== prev.seq && alertedSeqRef.current !== next.seq) {
          alertedSeqRef.current = next.seq;
          playCompletionBeep();
          vibratePattern([250, 100, 250]);
        } else if (silent) {
          // A catch-up jump — mark it as already-alerted so the next live tick doesn't think a
          // brand-new transition just happened and fire a retroactive sound for it.
          alertedSeqRef.current = next.seq;
        }
        if (next.status === "complete" && prev.status !== "complete") {
          playCompletionBeep();
          vibratePattern([250, 100, 250, 100, 250]);
        }
        return next;
      });
    },
    [config]
  );

  // Silent catch-up on mount and whenever BRK becomes active again — the exact same
  // visibilitychange/pageshow/focus reconciliation strategy as RestTimer, applied here with its
  // own independent state.
  useEffect(() => {
    applyReconcile(true);
    const reconcileVisible = () => {
      forceTick((t) => t + 1);
      applyReconcile(true);
    };
    document.addEventListener("visibilitychange", reconcileVisible);
    window.addEventListener("pageshow", reconcileVisible);
    window.addEventListener("focus", reconcileVisible);
    return () => {
      document.removeEventListener("visibilitychange", reconcileVisible);
      window.removeEventListener("pageshow", reconcileVisible);
      window.removeEventListener("focus", reconcileVisible);
    };
    // Re-registers whenever applyReconcile changes (i.e. whenever config changes) so these
    // listeners always close over the CURRENT config, never a stale one. An empty dependency
    // array here was a real bug: it froze the listeners to whatever config existed at mount
    // (before the athlete ever touched Start), so any background/visibility reconciliation
    // would silently use the wrong phase durations and the wrong continuous-vs-fixed mode —
    // caught by testing a fixed-rounds session actually finishing while backgrounded.
  }, [applyReconcile]);

  // Live per-second tick — only runs while genuinely running. Drives both the visible countdown
  // and the audible countdown-warning ticks; phase-transition sound is handled by applyReconcile.
  useEffect(() => {
    if (runtime.status !== "running") return;
    const id = setInterval(() => {
      forceTick((t) => t + 1);
      // Countdown warning check happens BEFORE reconcile so it reads the still-current phase's
      // remaining time, not the just-transitioned one.
      if (config.countdownWarningSec > 0 && runtime.phaseEndsAt != null) {
        const remaining = Math.ceil((runtime.phaseEndsAt - Date.now()) / 1000);
        if (remaining >= 1 && remaining <= config.countdownWarningSec) {
          if (lastWarnedPhaseEndsAtRef.current !== runtime.phaseEndsAt) lastWarnedSecondRef.current = null;
          if (lastWarnedSecondRef.current !== remaining) {
            lastWarnedSecondRef.current = remaining;
            lastWarnedPhaseEndsAtRef.current = runtime.phaseEndsAt;
            playCountdownTick();
          }
        }
      }
      applyReconcile(false);
    }, 1000);
    return () => clearInterval(id);
  }, [runtime.status, runtime.phaseEndsAt, config.countdownWarningSec, applyReconcile]);

  useEffect(() => {
    if (runtime.status === "complete") {
      setSummary(buildSummary());
      setScreen("summary");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime.status]);

  function buildSummary() {
    const elapsedMs = Math.max(0, Date.now() - (runtime.startedAt ?? Date.now()));
    return {
      elapsedSec: Math.round(elapsedMs / 1000),
      completedRounds: completedRoundsOf(runtime.seq ?? 0),
      config,
    };
  }

  const start = () => {
    const problems = validateConfig(config);
    if (problems.length > 0) {
      setValidationMsg(problems[0]);
      return;
    }
    setValidationMsg(null);
    unlockAudio(); // real click-handler call stack — the reliable place iOS honors resume()
    const now = Date.now();
    alertedSeqRef.current = 0;
    lastWarnedSecondRef.current = null;
    setRuntime({ status: "running", seq: 0, phaseEndsAt: now + config.phase1Sec * 1000, startedAt: now });
    setScreen("active");
  };

  const togglePause = () => {
    setRuntime((prev) => {
      if (prev.status === "paused") {
        return { ...prev, status: "running", phaseEndsAt: Date.now() + prev.pausedRemainingMs, pausedRemainingMs: null };
      }
      if (prev.status === "running") {
        return { ...prev, status: "paused", pausedRemainingMs: Math.max(0, prev.phaseEndsAt - Date.now()), phaseEndsAt: null };
      }
      return prev;
    });
  };

  const stop = () => {
    setRuntime((prev) => {
      const elapsedMs = Math.max(0, Date.now() - (prev.startedAt ?? Date.now()));
      setSummary({ elapsedSec: Math.round(elapsedMs / 1000), completedRounds: completedRoundsOf(prev.seq ?? 0), config });
      return { status: "idle" };
    });
    setScreen("summary");
  };

  const restartSameConfig = () => {
    setSummary(null);
    start();
  };

  const doneToSetup = () => {
    setSummary(null);
    setRuntime({ status: "idle" });
    setScreen("setup");
  };

  // ---------------- SETUP SCREEN ----------------
  if (screen === "setup") {
    return (
      <div className="space-y-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-red-600">Cardio &amp; Conditioning</div>
            <div className="text-xl font-bold text-white mt-1">Interval Timer</div>
          </div>
          {onBack && (
            <button onClick={onBack} className="text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500 flex items-center gap-1 shrink-0">
              <ChevronLeft size={14} /> Back
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {INTERVAL_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setConfig((c) => ({ ...c, phase1Sec: p.phase1Sec, phase2Sec: p.phase2Sec }))}
              className="py-2.5 text-xs font-bold border border-neutral-800 text-neutral-300 hover:border-neutral-600"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="border-2 border-red-800 bg-charcoal-panel p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-red-600">Phase 1</div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Name</label>
            <input
              type="text"
              value={config.phase1Name}
              onChange={(e) => setConfig((c) => ({ ...c, phase1Name: e.target.value }))}
              placeholder="Work"
              className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-base focus:outline-none focus:border-red-700"
              style={{ fontSize: 16 }}
            />
          </div>
          <DurationInput label="Duration" totalSec={config.phase1Sec} onChange={(v) => setConfig((c) => ({ ...c, phase1Sec: v }))} />
        </div>

        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Phase 2</div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Name</label>
            <input
              type="text"
              value={config.phase2Name}
              onChange={(e) => setConfig((c) => ({ ...c, phase2Name: e.target.value }))}
              placeholder="Recovery"
              className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-base focus:outline-none focus:border-red-700"
              style={{ fontSize: 16 }}
            />
          </div>
          <DurationInput label="Duration" totalSec={config.phase2Sec} onChange={(v) => setConfig((c) => ({ ...c, phase2Sec: v }))} />
        </div>

        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white">Repeat Until Stopped</div>
              <div className="text-xs text-neutral-500 mt-0.5">Cycles Phase 1 / Phase 2 continuously until you tap Stop.</div>
            </div>
            <button
              onClick={() => setConfig((c) => ({ ...c, mode: c.mode === "continuous" ? "fixed" : "continuous" }))}
              className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${config.mode === "continuous" ? "bg-red-700" : "bg-neutral-800"}`}
              aria-label="Toggle Repeat Until Stopped"
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${config.mode === "continuous" ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {config.mode === "fixed" && (
            <div>
              <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">Rounds</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={config.rounds}
                onChange={(e) => setConfig((c) => ({ ...c, rounds: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-20 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-base text-center focus:outline-none focus:border-red-700"
                style={{ fontSize: 16 }}
              />
              <span className="text-xs text-neutral-500 ml-2">
                Total: {formatClock((config.phase1Sec + config.phase2Sec) * Math.max(0, config.rounds))}
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Countdown warning</label>
          <div className="grid grid-cols-4 gap-1.5">
            {COUNTDOWN_WARNING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setConfig((c) => ({ ...c, countdownWarningSec: opt.value }))}
                className={`py-2 text-[11px] font-bold border ${
                  config.countdownWarningSec === opt.value ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {validationMsg && <div className="text-sm text-red-500">{validationMsg}</div>}

        <button
          onClick={start}
          className="w-full py-4 text-sm uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
        >
          Start Interval Timer
        </button>
      </div>
    );
  }

  // ---------------- ACTIVE SCREEN ----------------
  if (screen === "active") {
    const paused = runtime.status === "paused";
    const seq = runtime.seq ?? 0;
    const phaseIdx = seq % 2;
    const remainingMs = paused ? runtime.pausedRemainingMs ?? 0 : Math.max(0, (runtime.phaseEndsAt ?? Date.now()) - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);
    const nextPhaseIdx = phaseIdx === 0 ? 1 : 0;
    const total = totalPhasesFor(config);
    const isLastPhase = seq + 1 >= total;
    const round = roundOf(seq);
    const isPhase1 = phaseIdx === 0;

    return (
      <div className="space-y-6 pb-4">
        <div
          className={`p-6 space-y-4 text-center transition-colors ${
            isPhase1 ? "border-2 border-red-700 bg-red-950/10" : "border border-neutral-700 bg-charcoal-panel"
          }`}
        >
          <div className={`text-[13px] uppercase tracking-[0.2em] font-bold ${isPhase1 ? "text-red-500" : "text-neutral-400"}`}>
            {phaseNameFor(config, phaseIdx)}
          </div>
          <div className={`text-7xl font-bold tabular-nums leading-none ${paused ? "text-neutral-500" : "text-white"}`}>
            {formatClock(remainingSec)}
          </div>
          {paused && <div className="text-[11px] uppercase tracking-widest text-neutral-500">Paused</div>}
          {!isLastPhase ? (
            <div className="text-xs text-neutral-500">
              Next: <span className="text-neutral-300 font-bold">{phaseNameFor(config, nextPhaseIdx).toUpperCase()}</span> —{" "}
              {formatClock(phaseDurationSec(config, nextPhaseIdx))}
            </div>
          ) : (
            <div className="text-xs text-neutral-500">Final phase</div>
          )}
          <div className="text-[11px] uppercase tracking-widest text-neutral-600">
            Round {round}
            {config.mode === "fixed" ? ` of ${Math.max(1, config.rounds)}` : " · Continuous"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={togglePause}
            aria-label={paused ? "Resume interval timer" : "Pause interval timer"}
            className="flex-1 py-5 text-sm uppercase tracking-widest font-bold border border-neutral-700 bg-charcoal-panel text-neutral-200 hover:border-neutral-500 flex items-center justify-center gap-2"
          >
            {paused ? <Play size={18} /> : <Pause size={18} />} {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={stop}
            aria-label="Stop interval timer"
            className="flex-1 py-5 text-sm uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600 flex items-center justify-center gap-2"
          >
            <Square size={18} /> Stop
          </button>
        </div>
      </div>
    );
  }

  // ---------------- SUMMARY SCREEN ----------------
  const conditioningExercises = (allExercises || []).filter((ex) => ex.muscle === "Conditioning");
  return <IntervalSummaryScreen summary={summary} conditioningExercises={conditioningExercises} updateState={updateState} onDone={doneToSetup} onRestart={restartSameConfig} />;
}

// Split out so the hooks it needs (useState for the save-confirmation flow) don't have to live
// conditionally inside the parent component, which would break React's rules of hooks given the
// parent already early-returns for the setup/active screens above.
function IntervalSummaryScreen({ summary, conditioningExercises, updateState, onDone, onRestart }) {
  const [saved, setSaved] = useState(false);
  const [selectedExId, setSelectedExId] = useState(conditioningExercises[0]?.id || "");

  if (!summary) return null;
  const { config, elapsedSec, completedRounds } = summary;

  const saveAsCardioLog = () => {
    if (!selectedExId) return;
    const modeLabel = config.mode === "continuous" ? "Repeat Until Stopped" : `${Math.max(1, config.rounds)} rounds (fixed)`;
    const notes = `Interval: ${config.phase1Name} ${formatClock(config.phase1Sec)} / ${config.phase2Name} ${formatClock(config.phase2Sec)} — ${completedRounds} completed rounds — ${modeLabel}`;
    const entry = {
      id: `cardio_${Date.now()}`,
      exId: selectedExId,
      date: new Date().toISOString(),
      distance: null,
      distanceUnit: "mi",
      duration: Math.round(elapsedSec / 60),
      load: null,
      notes,
    };
    updateState((prev) => ({ ...prev, cardioLogs: [entry, ...(prev.cardioLogs || [])], hasSeenOnboarding: true }));
    setSaved(true);
  };

  return (
    <div className="space-y-6 pb-4">
      <div className="text-center space-y-1 pt-4">
        <div className="text-[11px] uppercase tracking-widest text-red-600">Interval Session Complete</div>
        <div className="text-4xl font-bold text-white">{formatClock(elapsedSec)}</div>
        <div className="text-sm text-neutral-500">total</div>
      </div>

      <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3 text-center">
        <div className="text-3xl font-bold text-white">
          {completedRounds} completed round{completedRounds === 1 ? "" : "s"}
        </div>
        <div className="text-sm text-neutral-400 space-y-0.5">
          <div>
            {config.phase1Name} — {formatClock(config.phase1Sec)}
          </div>
          <div>
            {config.phase2Name} — {formatClock(config.phase2Sec)}
          </div>
        </div>
      </div>

      {conditioningExercises.length > 0 && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-3">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Save as cardio log (optional)</div>
          {saved ? (
            <div className="text-sm text-green-500">Saved to Cardio / conditioning.</div>
          ) : (
            <>
              <select
                value={selectedExId}
                onChange={(e) => setSelectedExId(e.target.value)}
                className="w-full bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2.5 text-sm focus:outline-none focus:border-red-700"
              >
                {conditioningExercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <button
                onClick={saveAsCardioLog}
                className="w-full py-2.5 text-xs uppercase tracking-widest font-bold border border-neutral-700 text-neutral-200 hover:border-neutral-500"
              >
                Save as Cardio Log
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onRestart}
          className="flex-1 py-4 text-sm uppercase tracking-widest font-bold border border-neutral-700 bg-charcoal-panel text-neutral-200 hover:border-neutral-500"
        >
          Restart
        </button>
        <button
          onClick={onDone}
          className="flex-1 py-4 text-sm uppercase tracking-widest font-bold border border-red-700 bg-red-700 text-white hover:bg-red-600"
        >
          Done
        </button>
      </div>
    </div>
  );
}
