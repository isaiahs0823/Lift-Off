import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Timer, Scale, Camera, Award } from "lucide-react";
import { SlideInPanel } from "./SlideInPanel.jsx";
import { hasSchedule, getScheduleDay, DAY_TYPE_LABEL } from "../utils/weeklySchedule.js";

// Compact, mobile-safe glyphs for a narrow 7-column month grid — the spec's fuller "REST" /
// "MISSED" wording shows in the day-detail panel instead, where there's room for it.
const CAL_GLYPH = { completed: "✓", pending: "●", upcoming: "○", rest: "–", missed: "×", skipped: "×", moved_away: "·", none: "" };
const CAL_GLYPH_COLOR = {
  completed: "text-green-500",
  pending: "text-red-500",
  upcoming: "text-neutral-700",
  rest: "text-neutral-600",
  missed: "text-red-600",
  skipped: "text-red-600",
  moved_away: "text-neutral-700",
  none: "text-transparent",
};
const STATUS_WORD = {
  completed: "Completed",
  pending: "Scheduled today",
  upcoming: "Upcoming",
  rest: "Rest day",
  missed: "Missed",
  skipped: "Skipped",
  moved_away: "Moved to another day",
  none: "",
};

function dateKey(d) {
  return d.slice(0, 10);
}
function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// Groups everything the app knows about, by calendar day, for the given month. Deliberately
// only reports what actually happened (sessions/cardio/bodyweight/photos/PRs) — it does not
// try to guess which days were "supposed to" be training days, since the program model here
// is day-index based rather than tied to specific weekdays, and a wrong guess would be worse
// than no guess.
function buildMonthData(state, year, month) {
  const byDay = {};
  const ensure = (key) => (byDay[key] ||= { sessions: [], cardio: [], bodyweight: null, photos: 0, prCount: 0 });

  (state.workoutSessions || []).forEach((s) => {
    const key = dateKey(s.finishedAt);
    const d = new Date(s.finishedAt);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const day = ensure(key);
    day.sessions.push(s);
    day.prCount += (s.prs || []).length;
  });
  (state.cardioLogs || []).forEach((c) => {
    const key = dateKey(c.date);
    const d = new Date(c.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    ensure(key).cardio.push(c);
  });
  (state.bodyweightLogs || []).forEach((b) => {
    const key = dateKey(b.date);
    const d = new Date(b.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    ensure(key).bodyweight = b;
  });
  (state.photos || []).forEach((p) => {
    const key = dateKey(p.date);
    const d = new Date(p.date);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    ensure(key).photos += 1;
  });

  return byDay;
}

function DayDetail({ dateKeyStr, data, exMap, onBack, scheduleDay }) {
  const label = new Date(dateKeyStr + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return (
    <SlideInPanel title={label} onBack={onBack}>
      {scheduleDay && scheduleDay.status !== "none" && (
        <div className="border border-neutral-800 bg-charcoal-panel p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">Scheduled</div>
            <div className="text-sm text-white font-bold">{scheduleDay.label || DAY_TYPE_LABEL[scheduleDay.type]}</div>
          </div>
          <span className={`text-xs font-bold ${CAL_GLYPH_COLOR[scheduleDay.status]}`}>{STATUS_WORD[scheduleDay.status]}</span>
        </div>
      )}
      {data.sessions.length === 0 && data.cardio.length === 0 && !data.bodyweight && data.photos === 0 ? (
        <div className="text-sm text-neutral-500">Nothing logged this day.</div>
      ) : (
        <div className="space-y-3">
          {data.sessions.map((s) => (
            <div key={s.id} className="border border-neutral-800 bg-charcoal-panel p-3">
              <div className="flex items-center gap-1.5 text-sm text-white font-bold">
                <Dumbbell size={14} className="text-red-500" /> {s.planName}
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                {s.workingSets} working sets · {s.totalVolume.toLocaleString()} lb volume
                {s.prs?.length > 0 ? ` · ${s.prs.length} PR${s.prs.length > 1 ? "s" : ""}` : ""}
              </div>
            </div>
          ))}
          {data.cardio.map((c) => (
            <div key={c.id} className="border border-neutral-800 bg-charcoal-panel p-3">
              <div className="flex items-center gap-1.5 text-sm text-white font-bold">
                <Timer size={14} className="text-red-500" /> {exMap[c.exId]?.name || c.exId}
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                {c.distance != null ? `${c.distance} ${c.distanceUnit}` : ""}
                {c.duration != null ? ` · ${c.duration} min` : ""}
              </div>
            </div>
          ))}
          {data.bodyweight && (
            <div className="border border-neutral-800 bg-charcoal-panel p-3">
              <div className="flex items-center gap-1.5 text-sm text-white font-bold">
                <Scale size={14} className="text-red-500" /> Body log
              </div>
              <div className="text-xs text-neutral-400 mt-1">
                {data.bodyweight.weight != null ? `${data.bodyweight.weight} lb` : ""}
                {data.bodyweight.waist != null ? ` · ${data.bodyweight.waist} in waist` : ""}
                {data.bodyweight.bodyFat != null ? ` · ${data.bodyweight.bodyFat}% bf` : ""}
              </div>
            </div>
          )}
          {data.photos > 0 && (
            <div className="border border-neutral-800 bg-charcoal-panel p-3 flex items-center gap-1.5 text-sm text-white font-bold">
              <Camera size={14} className="text-red-500" /> {data.photos} progress photo{data.photos > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </SlideInPanel>
  );
}

export default function TrainingCalendar({ state, exMap }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const monthData = useMemo(() => buildMonthData(state, year, month), [state, year, month]);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const scheduled = hasSchedule(state);

  if (selectedDay) {
    return (
      <DayDetail
        dateKeyStr={selectedDay}
        data={monthData[selectedDay] || { sessions: [], cardio: [], bodyweight: null, photos: 0 }}
        exMap={exMap}
        onBack={() => setSelectedDay(null)}
        scheduleDay={scheduled ? getScheduleDay(state, selectedDay) : null}
      />
    );
  }

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date().toISOString());

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={goPrev} className="text-neutral-500 hover:text-red-500 p-1">
          <ChevronLeft size={18} />
        </button>
        <div className="text-sm font-bold text-white">{monthLabel(year, month)}</div>
        <button onClick={goNext} className="text-neutral-500 hover:text-red-500 p-1">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-neutral-600">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const data = monthData[key];
          const isToday = key === todayKey;
          const scheduleStatus = scheduled ? getScheduleDay(state, key).status : "none";
          const scheduleGlyph = CAL_GLYPH[scheduleStatus];
          const scheduleGlyphColor = CAL_GLYPH_COLOR[scheduleStatus];
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(key)}
              className={`aspect-square flex flex-col items-center justify-center border text-xs relative ${
                isToday ? "border-red-700" : "border-neutral-900"
              } ${data ? "bg-charcoal-panel" : ""} hover:border-neutral-600`}
            >
              {scheduleGlyph && (
                <span className={`absolute top-0.5 right-0.5 text-[9px] leading-none font-bold ${scheduleGlyphColor}`}>{scheduleGlyph}</span>
              )}
              <span className={isToday ? "text-red-500 font-bold" : "text-neutral-400"}>{d}</span>
              {data && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {data.sessions.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-600" />}
                  {data.cardio.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />}
                  {data.bodyweight && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  {data.prCount > 0 && <Award size={9} className="text-red-500" />}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" /> Trained
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" /> Cardio
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Check-in
        </span>
        <span className="flex items-center gap-1">
          <Award size={10} className="text-red-500" /> PR
        </span>
      </div>

      {scheduled && (
        <div className="flex items-center gap-3 text-[10px] text-neutral-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="text-green-500 font-bold">✓</span> Completed</span>
          <span className="flex items-center gap-1"><span className="text-red-500 font-bold">●</span> Scheduled</span>
          <span className="flex items-center gap-1"><span className="text-neutral-700 font-bold">○</span> Upcoming</span>
          <span className="flex items-center gap-1"><span className="text-neutral-600 font-bold">–</span> Rest</span>
          <span className="flex items-center gap-1"><span className="text-red-600 font-bold">×</span> Missed</span>
        </div>
      )}
    </div>
  );
}
