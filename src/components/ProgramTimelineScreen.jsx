import { useState } from "react";
import { ChevronDown, ChevronUp, ChevronRight, Check, X } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import ExerciseAnatomyRow from "./ExerciseAnatomyRow.jsx";
import { resolveProgramTimeline, programWeekAdherence, programTotalAdherence } from "../utils/programSchedule.js";
import { formatSetPrescription } from "../utils/exercisePrescription.js";
import { groupedPriorities, sanitizeDevelopmentPriorities, labelFor } from "../utils/developmentPriorities.js";

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Original BRK status glyphs — no bright multi-color system, restrained red for what actually
// needs attention (current), muted gray for everything not yet due, a distinct recovery mark
// rather than reusing the lifting checkmark for a different kind of session.
const STATUS_GLYPH = { completed: "✓", current: "→", upcoming: "○", missed: "×", swapped: "⇄" };
const STATUS_COLOR = {
  completed: "text-green-500",
  current: "text-v5-red",
  upcoming: "text-v5-subtext/70",
  missed: "text-red-700",
  swapped: "text-v5-subtext",
};

function DayRow({ day, onTap }) {
  const recoveryMark = day.isRecovery ? "◐" : null;
  return (
    <button
      onClick={() => onTap(day)}
      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left border-b border-white/[0.06] last:border-b-0 ${
        day.status === "current" ? "bg-v5-red/10" : ""
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className={`w-4 shrink-0 text-center font-bold ${STATUS_COLOR[day.status]}`}>{recoveryMark || STATUS_GLYPH[day.status]}</span>
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

function DayPreview({ day, weekNumber, programName, exMap, onBack, onViewWorkout }) {
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
    </SlideInPanel>
  );
}

// The "program map" (task Part 1) — a read-only, fully-derived view of state.currentProgram; it
// never writes anything (see resolveProgramTimeline's own header comment). Reads the single
// active program directly rather than taking an id prop, since there's only ever one at a time —
// every entry point (Train's Current Program card, Today's compact card) just navigates here.
export default function ProgramTimelineScreen({ state, exMap, onBack, onViewWorkout }) {
  const [openDay, setOpenDay] = useState(null); // { day, weekNumber } | null
  const timeline = resolveProgramTimeline(state);
  const weekAdherence = programWeekAdherence(state);
  const totalAdherence = programTotalAdherence(state);
  const priorities = sanitizeDevelopmentPriorities(state.developmentPriorities);
  const yourPriorityLabels = groupedPriorities(priorities).prioritize.map(labelFor);

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
      />
    );
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

      <div>
        <div className="text-2xl font-bold text-white">{timeline.programName}</div>
        <div className="text-sm text-v5-subtext mt-1">
          {timeline.totalWeeks ? `Week ${timeline.currentWeekNumber} of ${timeline.totalWeeks}` : `Week ${timeline.currentWeekNumber}`}
          {" · "}
          Day {timeline.currentDayIndex + 1} of {timeline.totalDaysPerCycle}
        </div>
        {(timeline.startDate || timeline.projectedCompletionDate) && (
          <div className="text-xs text-v5-subtext/70 mt-0.5">
            {timeline.startDate && `Started ${fmtDate(timeline.startDate)}`}
            {timeline.startDate && timeline.projectedCompletionDate && " · "}
            {timeline.projectedCompletionDate && `Projected completion ${fmtDate(timeline.projectedCompletionDate)}`}
          </div>
        )}
      </div>

      {(timeline.programFocus?.length > 0 || yourPriorityLabels.length > 0) && (
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
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
        </div>
      )}

      {(weekAdherence || totalAdherence) && (
        <div className="border border-white/10 bg-v5-elevated p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-v5-subtext">This week</div>
          {weekAdherence && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-v5-subtext">Strength</span>
                <span className="text-white font-bold">
                  {weekAdherence.lifting.completed} / {weekAdherence.lifting.scheduled}
                </span>
              </div>
              {weekAdherence.recovery.scheduled > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-v5-subtext">Recovery</span>
                  <span className="text-white font-bold">
                    {weekAdherence.recovery.completed} / {weekAdherence.recovery.scheduled}
                  </span>
                </div>
              )}
            </>
          )}
          {totalAdherence?.totalScheduled != null && (
            <div className="flex items-start justify-between gap-3 text-sm border-t border-white/[0.06] pt-2">
              <span className="text-v5-subtext shrink-0">Program</span>
              <span className="text-white font-bold text-right">
                {totalAdherence.totalCompleted} / {totalAdherence.totalScheduled} sessions completed
              </span>
            </div>
          )}
        </div>
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
