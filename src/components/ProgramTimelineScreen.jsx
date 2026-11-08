import { useState, useRef } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Check, X, ArrowLeftRight, XCircle, Type, Play, RefreshCw, Calendar, TrendingUp } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import ExerciseAnatomyRow from "./ExerciseAnatomyRow.jsx";
import SwapWorkoutSheet from "./SwapWorkoutSheet.jsx";
import { Card, ProgressBar } from "./ui/Kit.jsx";
import { resolveProgramTimeline, programWeekAdherence, programTotalAdherence, applyProgramDaySwap } from "../utils/programSchedule.js";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import { groupedPriorities, sanitizeDevelopmentPriorities, labelFor } from "../utils/developmentPriorities.js";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Original BRK status glyphs — no bright multi-color system, restrained red for what actually
// needs attention (current), muted gray for everything not yet due, a distinct recovery mark
// rather than reusing the lifting checkmark for a different kind of session. Status computation
// (day.status/isRecovery/isDeload) is untouched — only the visual badge changed, to the V2
// reference board's filled-circle/outlined-circle language instead of text glyphs.
function DayStatusBadge({ day }) {
  const base = "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold";
  if (day.isRecovery) return <div className={`${base} border border-v5-subtext/40 text-v5-subtext`}>◐</div>;
  if (day.status === "completed") return <div className={`${base} bg-v5-success text-white`}><Check size={13} strokeWidth={3} /></div>;
  if (day.status === "current") return <div className={`${base} bg-v5-red text-white`}><Play size={10} strokeWidth={3} className="ml-0.5" /></div>;
  if (day.status === "missed") return <div className={`${base} bg-v5-red/20 text-v5-red border border-v5-red/40`}><X size={13} strokeWidth={3} /></div>;
  if (day.status === "swapped") return <div className={`${base} border border-v5-subtext/40 text-v5-subtext`}><RefreshCw size={11} /></div>;
  return <div className={`${base} border border-v5-subtext/40`} />; // upcoming — plain outlined circle, matching the reference
}

function DayRow({ day, onTap }) {
  return (
    <button
      onClick={() => onTap(day)}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left border-b border-white/[0.06] last:border-b-0 ${
        day.status === "current" ? "bg-v5-red/10" : ""
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <DayStatusBadge day={day} />
        <span className={`text-sm truncate ${day.status === "current" ? "text-white font-bold" : "text-v5-text/90"}`}>{day.label}</span>
        {day.isRecovery && <span className="text-[11px] uppercase tracking-widest text-v5-subtext border border-white/10 px-1 py-0.5 shrink-0">Recovery</span>}
        {day.isDeload && <span className="text-[11px] uppercase tracking-widest text-v5-red border border-v5-red/40 px-1 py-0.5 shrink-0">Deload</span>}
        {day.status === "swapped" && (
          <span className="text-[11px] uppercase tracking-widest text-v5-subtext border border-white/10 px-1 py-0.5 shrink-0">Swapped</span>
        )}
      </span>
      <ChevronRight size={14} className="text-v5-subtext/40 shrink-0" />
    </button>
  );
}

function WeekBlock({ week, defaultOpen, onTapDay }) {
  const [open, setOpen] = useState(defaultOpen);
  const completedCount = week.days.filter((d) => d.status === "completed").length;
  return (
    <div className="border border-white/10 bg-v5-elevated">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-3 text-left">
        <span className="flex items-center gap-2">
          <span className={`text-xs uppercase tracking-widest font-bold ${week.isCurrentWeek ? "text-v5-red" : "text-v5-subtext"}`}>
            Week {week.weekNumber}
            {week.isCurrentWeek ? " — Current" : ""}
          </span>
          {week.isDeloadWeek && <span className="text-[11px] uppercase tracking-widest text-v5-red border border-v5-red/40 px-1.5 py-0.5">Deload</span>}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-v5-subtext/70">
          {completedCount}/{week.days.length}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {open && (
        <div className="border-t border-white/[0.06]">
          {week.days.map((day) => (
            <DayRow key={day.dayIndex} day={day} onTap={onTapDay} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayPreview({ day, weekNumber, programName, exMap, onBack, onViewWorkout, onStart }) {
  // "Start this workout" (item 1 of the check-off/swap feedback) — any day that isn't already
  // completed and isn't a recovery day (recovery has its own Start Recovery Session entry point
  // elsewhere, out of scope here) can be logged for real, right from its own preview. onStart
  // (built by the parent) already knows whether this is literally today's planned day — if it
  // isn't, it quietly swaps today to this day first (the same programDayOverride mechanism Swap
  // Workout uses) before starting, so tapping an upcoming/missed day here is one tap, not two.
  const canStart = !day.isRecovery && day.status !== "completed" && !!onStart;
  return (
    <SlideInPanel title={`Week ${weekNumber} — ${day.label}`} subtitle={programName} onBack={onBack}>
      {day.status === "completed" && day.completedSession && (
        <div className="flex items-center gap-2 text-green-500 font-bold text-sm">
          <Check size={16} /> Completed {fmtDate(day.completedSession.finishedAt)}
        </div>
      )}
      {day.status === "missed" && (
        <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
          <X size={16} /> Unresolved — not completed that week
        </div>
      )}
      {day.status === "swapped" && (
        <div className="flex items-center gap-2 text-v5-subtext font-bold text-sm">
          <span aria-hidden="true">⇄</span> Swapped — rescheduled to a different workout that week
        </div>
      )}
      {day.isRecovery ? (
        <div className="space-y-2">
          <div className="text-xs text-v5-subtext">
            {day.routine?.movements?.length ?? 0} movements · Est. {day.estMinutes} min
          </div>
          {(day.routine?.movements || []).map((m, i) => (
            <div key={i} className="text-sm text-v5-text/90 border-t border-white/[0.06] pt-1.5">
              {m.movementId.replace(/_/g, " ")}
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="text-xs text-v5-subtext mb-1">
            {(day.exercises || []).length} exercises · Est. {day.estMinutes} min
          </div>
          {(day.exercises || []).map((e, i) => (
            <ExerciseAnatomyRow key={i} exercise={exMap[e.exId]} exId={e.exId} prescription={formatSetPrescription(e)} />
          ))}
        </div>
      )}
      {day.completedSession && !day.isRecovery && onViewWorkout && (
        <button
          onClick={() => onViewWorkout(day.completedSession.id)}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold border border-v5-red text-v5-red hover:bg-v5-red/30"
        >
          View Session
        </button>
      )}
      {canStart && (
        <button
          onClick={() => onStart(day)}
          className="w-full py-3 text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:bg-v5-red/90 flex items-center justify-center gap-1.5"
        >
          <Play size={14} /> Start This Workout
        </button>
      )}
    </SlideInPanel>
  );
}

// The "program map" (task Part 1) — a read-only, fully-derived view of state.currentProgram; it
// never writes anything (see resolveProgramTimeline's own header comment). Reads the single
// active program directly rather than taking an id prop, since there's only ever one at a time —
// every entry point (Train's Current Program card, Today's compact card) just navigates here.
export default function ProgramTimelineScreen({ state, updateState, exMap, onBack, onViewWorkout, onSwitchProgram, onEndProgram, onRenameProgram, onStartRun, onBeforeStart, onNavigate }) {
  const [openDay, setOpenDay] = useState(null); // { day, weekNumber } | null
  // "Swap Workout" (item 2 — swap which day, not Switch Program's swap which PROGRAM) opens the
  // exact same sheet Today/Train already use, so picking a different day of this same program to
  // run today behaves identically everywhere it's offered.
  const [swapOpen, setSwapOpen] = useState(false);
  // Inline "rename the program I'm actually running" (same expand-in-place pattern already used
  // for custom programs' own detail screen) — this was the one obvious place in the app with no
  // path to renaming at all: an athlete looking at THIS screen, the one built for managing their
  // active program, had nowhere to do it short of backing out to Train and finding their program's
  // card again (and no path whatsoever if it was a built-in they hadn't already forked). The actual
  // state transition (including the built-in-forks-to-a-named-copy case) lives in
  // applyActiveProgramRename in programActivation.js; this component only owns the input's open/
  // closed state and a brief "Saved" flash.
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeoutRef = useRef(null);
  const timeline = resolveProgramTimeline(state);
  const weekAdherence = programWeekAdherence(state);
  const totalAdherence = programTotalAdherence(state);
  const priorities = sanitizeDevelopmentPriorities(state.developmentPriorities);
  const yourPriorityLabels = groupedPriorities(priorities).prioritize.map(labelFor);

  const startRenaming = () => {
    setDraft(timeline.programName);
    setRenaming(true);
  };
  const cancelRenaming = () => setRenaming(false);
  const saveRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== timeline.programName) {
      onRenameProgram?.(trimmed);
      clearTimeout(savedTimeoutRef.current);
      setJustSaved(true);
      savedTimeoutRef.current = setTimeout(() => setJustSaved(false), 2500);
    }
    setRenaming(false);
  };

  // "Start This Workout" from a day's own preview (item 1). day.status === "current" means this
  // IS the day already up next — just start it, same single-tap convenience Today/Train give.
  // Anything else (an upcoming day later that week, a missed day, another week's row entirely)
  // first swaps today to point at it via applyProgramDaySwap — the exact same mechanism Swap
  // Workout uses — then starts it, so logging a non-default day is one tap here instead of a
  // separate swap-then-go-to-Today round trip.
  const startDay = (day) => {
    if (day.isRecovery || !onStartRun) return;
    // Resume before applying a day swap; a blocked Start must not alter program progress.
    if (onBeforeStart && !onBeforeStart()) return;
    const plan = { name: `${timeline.programName} — ${day.label}`, exercises: day.exercises };
    const programContext = { programId: timeline.programId, programName: timeline.programName, source: timeline.source, dayIndex: day.dayIndex, totalDays: timeline.totalDaysPerCycle };
    if (day.status !== "current" && updateState) {
      const row = {
        sourceType: "program",
        programId: timeline.programId,
        source: timeline.source,
        dayIndex: day.dayIndex,
        programName: timeline.programName,
        dayLabel: day.label,
        exercises: day.exercises,
      };
      updateState((prev) => applyProgramDaySwap(prev, row));
    }
    setOpenDay(null);
    onStartRun(plan, programContext);
  };

  if (!timeline) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-bold text-white">Program Timeline</div>
          {onBack && (
            <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
              ← Back
            </button>
          )}
        </div>
        <div className="text-sm text-v5-subtext">No active program.</div>
        {onSwitchProgram && (
          <button
            onClick={onSwitchProgram}
            className="w-full py-2.5 text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:bg-v5-red/90 flex items-center justify-center gap-1.5"
          >
            <ArrowLeftRight size={14} /> Choose a Program
          </button>
        )}
      </div>
    );
  }

  if (openDay) {
    return (
      <DayPreview
        day={openDay.day}
        weekNumber={openDay.weekNumber}
        programName={timeline.programName}
        exMap={exMap}
        onBack={() => setOpenDay(null)}
        onViewWorkout={onViewWorkout}
        onStart={startDay}
      />
    );
  }

  if (swapOpen && updateState) {
    return <SwapWorkoutSheet state={state} updateState={updateState} exMap={exMap} onClose={() => setSwapOpen(false)} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-widest text-v5-red">Current Program</div>
        {onBack && (
          <button onClick={onBack} className="text-xs uppercase tracking-widest text-v5-subtext hover:text-v5-red">
            ← Back
          </button>
        )}
      </div>

      {/* Program hero card — V2 reference board's diagonal-accent program card. weekPct is only
          computed (and the bar only shown) for a fixed-length program with a real totalWeeks;
          a rolling/open-ended program has no natural "% through" to show, so none is fabricated. */}
      <Card tone="accent" padding="p-4 sm:p-5" className="relative overflow-hidden space-y-3">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-v5-red/20 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-v5-red flex items-center justify-center shrink-0 shadow-[0_4px_14px_-4px_rgba(232,16,29,0.6)]">
            <Calendar size={16} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename();
                    if (e.key === "Escape") cancelRenaming();
                  }}
                  autoFocus
                  className="w-full bg-v5-elevated text-white text-xl font-bold rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-v5-red"
                />
                <div className="flex gap-2">
                  <button
                    onClick={cancelRenaming}
                    className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:text-v5-text/90"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveRename}
                    disabled={!draft.trim()}
                    className="flex-1 py-2 text-xs uppercase tracking-widest font-bold bg-v5-red text-white hover:bg-v5-red/90 disabled:opacity-40"
                  >
                    Save name
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={startRenaming} className="flex items-center gap-2 text-left group min-w-0">
                <span className="font-brk-display text-xl text-white truncate">{timeline.programName}</span>
                <Type size={14} className="text-v5-subtext/50 group-hover:text-v5-red shrink-0" />
              </button>
            )}
            {justSaved && (
              <div className="text-xs text-v5-text/70 flex items-center gap-1.5 mt-1">
                <Check size={12} className="text-v5-red" /> Name saved
              </div>
            )}
          </div>
        </div>

        <div className="relative flex items-center justify-between text-sm">
          <span className="text-v5-subtext">
            {timeline.totalWeeks ? `Week ${timeline.currentWeekNumber} of ${timeline.totalWeeks}` : `Week ${timeline.currentWeekNumber}`}
            {" · "}
            Day {timeline.currentDayIndex + 1} of {timeline.totalDaysPerCycle}
          </span>
          {timeline.totalWeeks > 0 && (
            <span className="font-bold text-white tabular-nums">
              {Math.round(((timeline.currentWeekNumber - 1) / timeline.totalWeeks) * 100)}%
            </span>
          )}
        </div>
        {timeline.totalWeeks > 0 && (
          <ProgressBar pct={((timeline.currentWeekNumber - 1) / timeline.totalWeeks) * 100} className="relative" />
        )}

        {/* "Swap Workout" (do a different day of THIS program today) — deliberately distinct from
            "Switch Program" below (which replaces the whole active program). */}
        {updateState && (
          <button onClick={() => setSwapOpen(true)} className="relative flex items-center gap-1.5 text-xs text-v5-subtext hover:text-v5-red">
            <RefreshCw size={12} /> Swap workout
          </button>
        )}
        {(timeline.startDate || timeline.projectedCompletionDate) && (
          <div className="relative text-xs text-v5-subtext/70">
            {timeline.startDate && `Started ${fmtDate(timeline.startDate)}`}
            {timeline.startDate && timeline.projectedCompletionDate && " · "}
            {timeline.projectedCompletionDate && `Projected completion ${fmtDate(timeline.projectedCompletionDate)}`}
          </div>
        )}
      </Card>

      {/* Obvious program-management actions (active-program-management fix, items 1/2) — this
          screen was previously entirely read-only, with no way to stop or change the running
          program short of the Templates/Builder detail screens' own "Start This Program," which
          nothing here ever pointed to. Switch is pure navigation: the program library's own
          "Start This Program" already confirms the replacement and activates (see activateProgram
          in App.jsx). End is the new action — its confirmation + what it actually does to state
          live in App.jsx's endCurrentProgram. */}
      {(onSwitchProgram || onEndProgram) && (
        <div className="flex gap-2">
          {onSwitchProgram && (
            <button
              onClick={onSwitchProgram}
              className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-text/90 hover:border-v5-red/40 flex items-center justify-center gap-1.5"
            >
              <ArrowLeftRight size={13} /> Switch Program
            </button>
          )}
          {onEndProgram && (
            <button
              onClick={onEndProgram}
              className="flex-1 py-2.5 text-xs uppercase tracking-widest font-bold border border-white/10 text-v5-subtext hover:border-v5-red/40 hover:text-v5-red flex items-center justify-center gap-1.5"
            >
              <XCircle size={13} /> End Program
            </button>
          )}
        </div>
      )}

      {(timeline.programFocus?.length > 0 || yourPriorityLabels.length > 0) && (
        <Card padding="p-4" className="space-y-2">
          {timeline.programFocus?.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Program focus</div>
              <div className="text-sm text-v5-text/90 mt-0.5">{timeline.programFocus.join(" · ")}</div>
            </div>
          )}
          {yourPriorityLabels.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-v5-subtext">Your priorities</div>
              <div className="text-sm text-v5-text/90 mt-0.5">{yourPriorityLabels.join(" · ")}</div>
            </div>
          )}
        </Card>
      )}

      {(weekAdherence || totalAdherence) && (
        <Card padding="p-4" className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-v5-red" />
            <span className="text-[11px] uppercase tracking-widest text-v5-subtext">Program Progress</span>
          </div>
          {weekAdherence && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-v5-subtext">This week — Strength</span>
                <span className="text-white font-bold tabular-nums">
                  {weekAdherence.lifting.completed} / {weekAdherence.lifting.scheduled}
                </span>
              </div>
              {weekAdherence.recovery.scheduled > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-v5-subtext">This week — Recovery</span>
                  <span className="text-white font-bold tabular-nums">
                    {weekAdherence.recovery.completed} / {weekAdherence.recovery.scheduled}
                  </span>
                </div>
              )}
            </div>
          )}
          {/* Real session-based progress — not a fabricated "N weeks complete" figure, since a
              rolling-schedule program doesn't cleanly map to that the way a fixed-length one does.
              This is the same totalAdherence the plain-text version above already computed. */}
          {totalAdherence?.totalScheduled > 0 && (
            <div className="space-y-1.5 border-t border-white/[0.06] pt-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-v5-subtext">Sessions complete</span>
                <span className="text-white font-bold tabular-nums">
                  {totalAdherence.totalCompleted} / {totalAdherence.totalScheduled} ·{" "}
                  {Math.round((totalAdherence.totalCompleted / totalAdherence.totalScheduled) * 100)}%
                </span>
              </div>
              <ProgressBar pct={(totalAdherence.totalCompleted / totalAdherence.totalScheduled) * 100} />
            </div>
          )}
        </Card>
      )}

      <div className="space-y-2">
        {timeline.weeks.map((week) => (
          <WeekBlock
            key={week.weekNumber}
            week={week}
            defaultOpen={week.isCurrentWeek}
            onTapDay={(day) => setOpenDay({ day, weekNumber: week.weekNumber })}
          />
        ))}
      </div>
    </div>
  );
}
