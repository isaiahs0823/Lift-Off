// ---------------- SHARED TIMER AUDIO / HAPTICS ----------------
// Extracted from App.jsx's RestTimer (where this Web Audio approach was built and proven) so
// the Cardio Interval Timer reuses the exact same iOS-suspend-safe unlock/resume handling
// instead of a second, divergent copy. Both timers call into this one module; neither owns it.
//
// ROOT CAUSE this already fixed once: iOS can auto-suspend an AudioContext after backgrounding
// or a period of inactivity. ctx.resume() returns a Promise — it must always be .catch()-handled,
// and unlockAudio() must be called synchronously from a real user-gesture call stack (a click
// handler), never from a useEffect reacting to a later state change, or iOS silently ignores it.
let sharedAudioCtx = null;
function getCtx() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function unlockAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

function playTones(tones) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const play = () => {
      const now = ctx.currentTime;
      tones.forEach(({ offset, freq, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.015);
        gain.gain.linearRampToValueAtTime(0, now + offset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + duration + 0.02);
      });
    };
    if (ctx.state === "suspended") ctx.resume().then(play).catch(() => {});
    else play();
  } catch {
    // Never let a beep failure take down the caller's completion flow.
  }
}

// The rest timer's original 3-beep completion cue — same tones/timings as before, just callable
// from anywhere now. Also used by the Interval Timer for a phase transition.
export function playCompletionBeep() {
  playTones([
    { offset: 0, freq: 880, duration: 0.165 },
    { offset: 0.22, freq: 880, duration: 0.165 },
    { offset: 0.44, freq: 880, duration: 0.165 },
  ]);
}

// A single short, quieter, lower-pitched tick for the Interval Timer's countdown warning
// (5-4-3-2-1) — deliberately distinct from the 3-beep transition cue so an athlete can tell
// "phase about to end" apart from "phase just changed" by ear alone, mid-run, without looking.
export function playCountdownTick() {
  playTones([{ offset: 0, freq: 660, duration: 0.09 }]);
}

export function vibratePattern(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // Some browsers throw if called outside a user gesture context — never fatal.
  }
}
