import React, { useState } from "react";
import { ClipboardList, Timer, Dumbbell, Plus, Play, RefreshCw, Map } from "lucide-react";
import { resolveTodayWorkout } from "../utils/programSchedule.js";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import ExerciseAnatomyRow from "./ExerciseAnatomyRow.jsx";
import SwapWorkoutSheet from "./SwapWorkoutSheet.jsx";
import { ScreenHeader, SectionLabel, Card, HeroCard, ButtonPrimary, ButtonText, StatTile, Pill, ListRow } from "./ui/Kit.jsx";

// Never auto-discards on age — a workout logged right up to midnight, or one left open for
// days, is still fully recoverable, just described differently: minutes/hours for something
// from the same stretch of time, a plain date once it's genuinely old (see the reliability
// spec's "Unfinished workout from Aug 22" example) rather than an ever-growing "loads of hours
// ago" that reads as more alarming than informative.
function elapsedLabel(startedAt) {
  const started = new Date(startedAt);
  const mins = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 20) {
    const rem = mins % 60;
    return `${hrs} hour${hrs === 1 ? "" : "s"}${rem ? ` ${rem} min` : ""} ago`;
  }
  return `on ${started.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

// Landing/menu for the Train section. Hierarchy when no workout is active: Current Program
// (if one exists) -> the single "Start Workout Today" CTA -> Programs -> Cardio -> secondary
// tools. "My plans" no longer gets its own preview list here — it's one tap away via Programs,
// and now also reachable through Start Workout Today -> Repeat Recent — so nothing about
// starting a saved plan is lost, it's just not competing for space on the landing screen.
//
// `activeRun` is only ever passed here already minimized (see LiftLog) — i.e. the athlete has an
// in-progress, not-yet-finished workout they stepped away from. When present it takes over the
// entire screen: "Resume workout" becomes the one thing to do here, matching the reliability
// spec's "primary CTA should be RESUME WORKOUT, not Start Workout — do not make them navigate
// through workout-selection flows again."
export default function TrainTab({ state, updateState, exMap, activeRun, onStartRun, onStartRecovery, onResumeWorkout, onDiscardWorkout, onNavigate }) {
  const programDay = resolveTodayWorkout(state);
  const [swapOpen, setSwapOpen] = useState(false);

  if (swapOpen && !activeRun) {
    return <SwapWorkoutSheet state={state} updateState={updateState} exMap={exMap} onClose={() => setSwapOpen(false)} onNavigate={onNavigate} />;
  }

  if (activeRun) {
    const totalExercises = activeRun.exercises.length;
    const loggedIndices = new Set((activeRun.sessionEntries || []).map((se) => se.index));
    const completedExercises = loggedIndices.size;
    const completedSets =
      (activeRun.sessionEntries || []).reduce((sum, se) => sum + (se.entry?.sets?.length || 0), 0) +
      Object.values(activeRun.draftByIndex || {}).reduce((sum, d) => sum + (d?.confirmedSets?.length || 0), 0);
    // The first not-yet-logged slot is "current" — same rule GuidedRunView uses to pick the
    // active exercise. Its draft (if the athlete had typed a weight/reps without saving) is what
    // "Unsaved set restored" below refers to.
    const currentIdx = activeRun.exercises.findIndex((_, idx) => !loggedIndices.has(idx));
    const currentDraft = currentIdx >= 0 ? activeRun.draftByIndex?.[currentIdx] : null;
    const hasUnsavedSet =
      !!currentDraft &&
      ((currentDraft.weight !== "" && currentDraft.weight !== 0 && currentDraft.weight != null) ||
        (currentDraft.reps !== "" && currentDraft.reps !== 0 && currentDraft.reps != null));
    const currentExName = currentIdx >= 0 ? exMap[activeRun.swaps?.[currentIdx] ?? activeRun.exercises[currentIdx].exId]?.name : null;

    return (
      <div className="space-y-5">
        <ScreenHeader eyebrow="Train" title="Resume workout" />

        <HeroCard>
          <div>
            <div className="text-xl font-black text-v5-text">{activeRun.planName}</div>
            <div className="text-sm text-v5-subtext">Started {elapsedLabel(activeRun.startedAt)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Exercises" value={`${completedExercises}${totalExercises ? ` / ${totalExercises}` : ""}`} />
            <StatTile label="Completed sets" value={completedSets} />
          </div>
          {hasUnsavedSet && (
            <div className="text-xs text-v5-red font-bold">
              Unsaved set restored{currentExName ? ` — ${currentExName}` : ""}
            </div>
          )}
          <ButtonPrimary size="lg" onClick={onResumeWorkout}>Resume workout</ButtonPrimary>
          <ButtonText tone="muted" onClick={onDiscardWorkout} className="w-full py-1">Discard workout</ButtonText>
        </HeroCard>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ScreenHeader eyebrow="Train" title="Choose your workout" />

      {programDay && !programDay.isComplete && (
        <HeroCard>
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Current program</SectionLabel>
            <ButtonText tone="muted" icon={RefreshCw} onClick={() => setSwapOpen(true)} aria-label="Swap workout">
              Swap workout
            </ButtonText>
          </div>
          {/* The headline always names the ACTUAL active program (from currentProgram itself,
              not today's resolved workout) — an outside-program override must never make this
              card read as if the active program changed; see resolveTodayWorkout's isOutsideProgram. */}
          <div className="text-xl font-black text-v5-text">{state.currentProgram?.programName}</div>
          {programDay.isRecoveryDay ? (
            <div className="text-sm text-v5-subtext">
              {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
              {programDay.dayLabel}
            </div>
          ) : programDay.isOutsideProgram ? (
            <div className="space-y-1">
              <Pill>{programDay.sourceType === "program" ? "Today: from another program" : "Today: custom workout"}</Pill>
              <div className="text-sm text-v5-subtext">
                {programDay.programName}
                {programDay.dayLabel ? ` — ${programDay.dayLabel}` : ""}
              </div>
              {programDay.plannedProgramName && (
                <div className="text-xs text-v5-subtext/60">
                  {programDay.plannedProgramName}
                  {programDay.plannedDayLabel ? ` — ${programDay.plannedDayLabel}` : ""} still pending, unaffected
                </div>
              )}
            </div>
          ) : programDay.isSwapped ? (
            <div className="space-y-1">
              <Pill>Swapped for today</Pill>
              <div className="text-sm text-v5-subtext">
                {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
                {programDay.dayLabel}
              </div>
              {programDay.plannedDayLabel && (
                <div className="text-xs text-v5-subtext/60">Originally planned: {programDay.plannedDayLabel}</div>
              )}
            </div>
          ) : (
            <div className="text-sm text-v5-subtext">
              {programDay.weekNumber ? `Week ${programDay.weekNumber} · ` : ""}
              Next: {programDay.dayLabel}
            </div>
          )}
          {programDay.isRecoveryDay ? (
            <>
              <div className="text-xs text-v5-subtext">
                {programDay.routine?.movements?.length ?? 0} movements · Est. {programDay.estMinutes} min
              </div>
              <ButtonPrimary size="lg" onClick={() => onStartRecovery(programDay.routine, programDay.programContext)}>
                Start Recovery Session
              </ButtonPrimary>
            </>
          ) : (
            <>
              {/* Day preview — same compact anatomy row used in My Plan/program detail, so the
                  athlete can see today's muscle emphasis before committing to Start. */}
              {programDay.plan?.exercises?.length > 0 && (
                <div className="rounded-xl bg-v5-elevated/60 px-1">
                  {programDay.plan.exercises.map((e, i) => (
                    <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
                  ))}
                </div>
              )}
              <ButtonPrimary size="lg" icon={Play} onClick={() => onStartRun(programDay.plan, programDay.programContext)}>
                Start
              </ButtonPrimary>
            </>
          )}
          <ButtonText tone="muted" icon={Map} onClick={() => onNavigate("programTimeline")} className="pt-1">
            Program Timeline
          </ButtonText>
        </HeroCard>
      )}

      <ButtonPrimary size="lg" icon={Play} onClick={() => onNavigate("startWorkout")} className="py-5 text-base shadow-[0_12px_32px_-10px_rgba(210,38,46,0.6)]">
        Start workout today
      </ButtonPrimary>

      <ListRow icon={ClipboardList} title="Programs" subtitle="All plans, hero programs, single-day templates" onClick={() => onNavigate("templates")} />
      <ListRow icon={Timer} title="Cardio / conditioning" subtitle="Runs, sleds, intervals" onClick={() => onNavigate("cardio")} />

      <div className="flex items-center gap-5 pt-1">
        <ButtonText icon={Plus} onClick={() => onNavigate("build")}>Create plan</ButtonText>
        <ButtonText tone="muted" icon={Dumbbell} onClick={() => onNavigate("log")}>Log a single exercise</ButtonText>
      </div>
    </div>
  );
}
