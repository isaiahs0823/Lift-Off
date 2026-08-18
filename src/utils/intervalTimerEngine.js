// ---------------- INTERVAL TIMER — PURE ENGINE ----------------
// Timestamp-driven phase-cycling math for the Cardio Interval Timer, kept entirely separate
// from the lifting Rest Timer (App.jsx's RestTimer) — different storage key, different
// component, no shared runtime state. Only the audio/vibration primitives (utils/timerAudio.js)
// are shared between the two.
//
// Mirrors the rest timer's core discipline: an absolute `phaseEndsAt` timestamp is the only
// source of truth, never a decremented counter, so background throttling/suspension can never
// cause drift. `reconcile()` below is the one place "how much real time actually passed"
// becomes "which phase/round are we really in now" — it walks forward through however many
// whole phases elapsed (not just one), so an athlete who backgrounds the app for 5 minutes on a
// pair of 1-minute phases lands on the correct phase, correct remaining time, and correct round
// the instant BRK becomes active again, exactly as if they'd watched every transition happen.
//
// Phases are indexed by a single running counter `seq` (0-based): even seq = phase 1, odd
// seq = phase 2. A "round" is one phase 1 + one phase 2, so round = floor(seq / 2) + 1, and the
// number of fully-completed rounds at any point is floor(seq / 2).

export function phaseDurationSec(config, phaseIndex) {
  return phaseIndex === 0 ? config.phase1Sec : config.phase2Sec;
}
export function phaseNameFor(config, phaseIndex) {
  return phaseIndex === 0 ? config.phase1Name : config.phase2Name;
}
export function roundOf(seq) {
  return Math.floor(seq / 2) + 1;
}
export function completedRoundsOf(seq) {
  return Math.floor(seq / 2);
}
// Continuous mode never ends on its own — Infinity is a deliberate sentinel, not a bug: every
// comparison against it below (`seq >= total`) is written to stay false forever for continuous
// sessions, so the "did fixed rounds run out" check simply never fires for them.
export function totalPhasesFor(config) {
  return config.mode === "fixed" ? Math.max(1, config.rounds) * 2 : Infinity;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function validateConfig(config) {
  const problems = [];
  if (!config.phase1Sec || config.phase1Sec <= 0 || !config.phase2Sec || config.phase2Sec <= 0) {
    problems.push("Set a duration for both intervals.");
  }
  if (config.mode === "fixed" && (!config.rounds || config.rounds < 1)) {
    problems.push("Enter at least 1 round.");
  }
  return problems;
}

const MAX_CATCHUP_ITERATIONS = 100000; // guards against a pathological config, not real usage

// Given a running `runtime` ({ status, seq, phaseEndsAt }) and the current real time, returns a
// NEW runtime object reconciled to however many whole phases have actually elapsed. Never
// mutates its input. If a fixed-rounds session would have finished during the elapsed gap,
// returns status:"complete" instead of a phase past the end — the caller treats that exactly
// like a manual Stop, just auto-triggered by real time having run out while backgrounded.
export function reconcile(config, runtime, now = Date.now()) {
  if (runtime.status !== "running" || runtime.phaseEndsAt == null) return runtime;
  let seq = runtime.seq;
  let phaseEndsAt = runtime.phaseEndsAt;
  const total = totalPhasesFor(config);
  let iterations = 0;
  while (now >= phaseEndsAt && iterations < MAX_CATCHUP_ITERATIONS) {
    iterations++;
    seq += 1;
    if (seq >= total) {
      return { ...runtime, seq: total, phaseEndsAt: null, status: "complete" };
    }
    const nextDurSec = phaseDurationSec(config, seq % 2);
    phaseEndsAt += nextDurSec * 1000;
  }
  if (seq === runtime.seq) return runtime; // nothing changed — avoid a needless new object
  return { ...runtime, seq, phaseEndsAt };
}

export const INTERVAL_PRESETS = [
  { label: "30s / 30s", phase1Sec: 30, phase2Sec: 30 },
  { label: "1m / 1m", phase1Sec: 60, phase2Sec: 60 },
  { label: "2m / 1m", phase1Sec: 120, phase2Sec: 60 },
  { label: "3m / 1m", phase1Sec: 180, phase2Sec: 60 },
];

export const COUNTDOWN_WARNING_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 3, label: "Last 3 sec" },
  { value: 5, label: "Last 5 sec" },
  { value: 10, label: "Last 10 sec" },
];
