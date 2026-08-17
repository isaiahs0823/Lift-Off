import React, { useState } from "react";
import { SlideInPanel } from "./SlideInPanel.jsx";

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const WEEKDAY_LABEL = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const BODY_PARTS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core"];

// Optional structured alternative to typing a schedule out in chat (program-builder spec
// section 2) — deliberately produces the exact same free-text entry point plain chat already
// handles ("Monday — Chest, Tuesday — Back...") rather than a second parallel data path. The
// picker and the chat therefore always feed the same proposeProgram pipeline.
export default function ScheduleBuilderPicker({ onBack, onSubmit }) {
  const [dayParts, setDayParts] = useState({}); // { mon: ["Chest", "Arms"], ... } — a day with no parts selected is a rest day

  function toggleBodyPart(day, part) {
    setDayParts((prev) => {
      const current = prev[day] || [];
      const next = current.includes(part) ? current.filter((p) => p !== part) : [...current, part];
      return { ...prev, [day]: next };
    });
  }

  const hasAnyDay = WEEKDAY_ORDER.some((d) => (dayParts[d] || []).length > 0);

  function buildSummary() {
    const lines = WEEKDAY_ORDER.map((d) => `${WEEKDAY_LABEL[d]} — ${(dayParts[d] || []).length ? dayParts[d].join(" + ") : "Rest"}`);
    return `This is my schedule:\n\n${lines.join("\n")}\n\nBuild me a bodybuilding plan around that.`;
  }

  return (
    <SlideInPanel title="Build a Program" subtitle="Pick body parts per day, then hand it to Coach" onBack={onBack}>
      <div className="space-y-3">
        {WEEKDAY_ORDER.map((day) => (
          <div key={day} className="border border-neutral-800 bg-charcoal-panel p-3 space-y-2">
            <div className="text-xs font-bold text-white">{WEEKDAY_LABEL[day]}</div>
            <div className="flex flex-wrap gap-1.5">
              {BODY_PARTS.map((part) => {
                const active = (dayParts[day] || []).includes(part);
                return (
                  <button
                    key={part}
                    type="button"
                    onClick={() => toggleBodyPart(day, part)}
                    className={`px-2.5 py-1.5 text-[11px] border ${
                      active ? "bg-red-700 border-red-700 text-white" : "border-neutral-800 text-neutral-400 hover:border-red-700 hover:text-red-500"
                    }`}
                  >
                    {part}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSubmit(buildSummary())}
        disabled={!hasAnyDay}
        className="w-full py-3 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600 disabled:opacity-40"
      >
        Build Program With Coach
      </button>
    </SlideInPanel>
  );
}
