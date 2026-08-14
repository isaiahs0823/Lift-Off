import React, { useEffect, useState } from "react";
import { buildCoachContext } from "../utils/coachContext.js";
import { answerCoachQuestion } from "../services/coachService.js";
import { syncCoachMemory } from "../utils/coachMemory.js";

const QUICK_QUESTIONS = [
  "What should I do today?",
  "Should I increase weight?",
  "Why has my weight stalled?",
  "Should I train through soreness?",
  "How is my progress?",
  "What am I doing wrong?",
  "Am I on track?",
  "Review today's session.",
  "Review my last 30 days.",
];

export default function CoachTab({ state, updateState, exMap }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);

  // Promotes currently-detected patterns into persisted, evolving Coach memory (and ages out
  // ones that stopped recurring) — a no-op once already in sync for this data, so it's safe to
  // run on every mount. Respects the user's "learn from my data" toggle (section 14/40).
  useEffect(() => {
    if (state.athleteProfile && state.athleteProfile.learningEnabled === false) return;
    const next = syncCoachMemory(state);
    if (next !== state.coachMemories) {
      updateState((prev) => ({ ...prev, coachMemories: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workoutSessions, state.cardioLogs, state.logs, state.bodyweightLogs, state.readinessLogs, state.scheduleLog, state.weeklySchedule]);

  const ask = (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const context = buildCoachContext(state, exMap);
    const { message } = answerCoachQuestion(trimmed, context, state);
    setAnswer({ question: trimmed, message });
    updateState((prev) => ({
      ...prev,
      coachHistory: [
        { id: `coach_${Date.now()}`, date: new Date().toISOString(), type: "question", question: trimmed, message },
        ...(prev.coachHistory || []),
      ],
    }));
    setQuestion("");
  };

  const history = state.coachHistory || [];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
        <div className="text-xl font-bold text-white mt-1">Coach Me</div>
      </div>

      {answer && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">{answer.question}</div>
          <div className="text-base text-white whitespace-pre-line">{answer.message}</div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            className="px-3 py-2 text-xs border border-neutral-800 text-neutral-300 hover:border-red-700 hover:text-red-500"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(question)}
          placeholder="Ask the coach anything..."
          className="flex-1 bg-charcoal-panel border border-neutral-800 text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:border-red-700"
        />
        <button
          onClick={() => ask(question)}
          className="shrink-0 px-4 py-2 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600"
        >
          Ask
        </button>
      </div>

      {history.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Coach history</div>
          <div className="space-y-3">
            {history.slice(0, 30).map((h) => (
              <div key={h.id} className="border-b border-neutral-900 pb-2">
                <div className="text-[11px] text-neutral-600">
                  {new Date(h.date).toLocaleString()}
                  {h.question ? ` — ${h.question}` : ""}
                </div>
                <div className="text-sm text-neutral-300 mt-0.5 whitespace-pre-line">{h.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
