import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Check, ChevronRight, X } from "lucide-react";
import MuscleBodyOutline from "./MuscleBodyOutline.jsx";
import { resolveRoutineMovements } from "../utils/mobilitySession.js";
import { mobilityAnatomyExercise } from "../data/mobilityLibrary.js";

// Flattens a routine's prescription rows into one step per (set × side) occurrence — a movement
// prescribed "2 sets, per side" becomes 4 sequential steps (Set 1 Left, Set 1 Right, Set 2 Left,
// Set 2 Right), matching the task's own example ("Couch Stretch / Left Side / 00:45 / NEXT: Right
// Side"). A non-per-side movement just gets one step per set.
function buildSteps(routine) {
  const steps = [];
  resolveRoutineMovements(routine).forEach((row) => {
    const totalSets = row.sets || 1;
    for (let setIndex = 0; setIndex < totalSets; setIndex++) {
      const sides = row.movement.perSide ? ["Left", "Right"] : [null];
      sides.forEach((side) => {
        steps.push({
          key: `${row.movementId}-${setIndex}-${side || "both"}`,
          movementId: row.movementId,
          movement: row.movement,
          setIndex,
          totalSets,
          side,
          durationSeconds: row.durationSeconds ?? null,
          reps: row.reps ?? null,
        });
      });
    }
  });
  return steps;
}

// Timestamp-driven countdown (an absolute `endsAt` is the only source of truth, never a
// decremented counter) — same discipline as the app's other timers (RestTimer, the cardio
// interval engine) so a backgrounded/throttled tab can never cause drift; reconciling just means
// recomputing `remaining` from `Date.now()` on every tick.
function useCountdown(durationSeconds, resetKey, paused) {
  const [remaining, setRemaining] = useState(durationSeconds || 0);
  const endsAtRef = useRef(null);
  const pausedRemainingRef = useRef(durationSeconds || 0);

  useEffect(() => {
    if (!durationSeconds) return;
    pausedRemainingRef.current = durationSeconds;
    endsAtRef.current = Date.now() + durationSeconds * 1000;
    setRemaining(durationSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, durationSeconds]);

  useEffect(() => {
    if (!durationSeconds) return;
    if (paused) {
      if (endsAtRef.current != null) pausedRemainingRef.current = Math.max(0, (endsAtRef.current - Date.now()) / 1000);
      endsAtRef.current = null;
      return;
    }
    if (endsAtRef.current == null) endsAtRef.current = Date.now() + pausedRemainingRef.current * 1000;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setRemaining(left);
    }, 200);
    return () => clearInterval(id);
  }, [paused, durationSeconds, resetKey]);

  return remaining;
}

function formatClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// The mobility equivalent of GuidedRunView, deliberately much simpler: no persistence across a
// refresh (see App.jsx's comment on finishRecoverySession — this is an intentionally lightweight,
// ephemeral flow; "Log Recovery Session" from the library remains the always-available fallback
// if a session gets interrupted). Never touches state.logs/workoutSessions/activeRun — only
// App.jsx's finishRecoverySession, called once on completion, writes anything persisted.
export default function MobilitySessionRunner({ routine, onComplete, onExit }) {
  const steps = useMemo(() => buildSteps(routine), [routine]);
  const [stepIdx, setStepIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [completedKeys, setCompletedKeys] = useState(() => new Set());
  const startedAtRef = useRef(Date.now());

  const step = steps[stepIdx];
  const remaining = useCountdown(step?.durationSeconds, step?.key, paused);
  const isTimed = !!step?.durationSeconds;
  const isLastStep = stepIdx >= steps.length - 1;

  // A timed step auto-advances the instant it hits zero — no tap required to keep moving.
  useEffect(() => {
    if (isTimed && remaining === 0 && !paused) {
      const id = setTimeout(() => advance(true), 150);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, isTimed, paused]);

  const finish = (finalCompleted) => {
    const completedMovementIds = [...new Set(steps.filter((s) => finalCompleted.has(s.key)).map((s) => s.movementId))];
    onComplete({
      completedMovementIds,
      durationSec: (Date.now() - startedAtRef.current) / 1000,
    });
  };

  const advance = (markDone) => {
    const next = new Set(completedKeys);
    if (markDone && step) next.add(step.key);
    setCompletedKeys(next);
    if (isLastStep) {
      finish(next);
      return;
    }
    setStepIdx((i) => i + 1);
    setPaused(false);
  };

  if (!step) return null;
  const nextStep = steps[stepIdx + 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-v5-red">
            {routine.name} · {stepIdx + 1} / {steps.length}
          </div>
          <div className="text-xl font-bold text-white mt-1">{step.movement.name}</div>
        </div>
        <button onClick={onExit} className="text-v5-subtext hover:text-v5-red p-1" aria-label="Exit">
          <X size={20} />
        </button>
      </div>

      <div className="border-2 border-v5-red bg-v5-elevated p-6 space-y-4 text-center">
        <div className="flex items-center justify-center gap-4">
          <MuscleBodyOutline exercise={mobilityAnatomyExercise(step.movement)} size="detail" />
        </div>
        {step.side && <div className="text-sm uppercase tracking-widest text-v5-subtext">{step.side} side</div>}
        <div className="text-xs text-v5-subtext">
          Set {step.setIndex + 1} of {step.totalSets}
        </div>

        {isTimed ? (
          <>
            <div className="text-5xl font-bold text-white tabular-nums">{formatClock(remaining)}</div>
            <button
              onClick={() => setPaused((p) => !p)}
              className="mx-auto flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40"
            >
              {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Resume" : "Pause"}
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl font-bold text-white tabular-nums">{step.reps}</div>
            <div className="text-xs text-v5-subtext uppercase tracking-widest">reps</div>
            <button
              onClick={() => advance(true)}
              className="mx-auto flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest font-bold border bg-v5-red border-v5-red text-white hover:opacity-90"
            >
              <Check size={14} /> Done
            </button>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => advance(false)} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-text/90">
          Skip
        </button>
        <div className="text-xs text-v5-subtext/70 flex items-center gap-1.5">
          {isLastStep ? "Last movement" : (
            <>
              Next: {nextStep.movement.name}
              {nextStep.side ? ` — ${nextStep.side} side` : ""} <ChevronRight size={12} />
            </>
          )}
        </div>
      </div>

      {isTimed && (
        <button onClick={() => advance(true)} className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40">
          {isLastStep ? "Finish session" : "Next movement"}
        </button>
      )}
    </div>
  );
}
