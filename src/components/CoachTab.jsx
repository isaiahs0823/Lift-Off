import React, { useEffect, useState } from "react";
import { BookOpen, Settings as SettingsIcon, ChevronRight } from "lucide-react";
import { buildCoachContext } from "../utils/coachContext.js";
import { answerCoachQuestion } from "../services/coachService.js";
import { syncCoachMemory } from "../utils/coachMemory.js";
import {
  hasProfile,
  coachKnowledgeLevel,
  KNOWLEDGE_LEVEL_LABEL,
  KNOWLEDGE_LEVEL_DESC,
  resolveProfile,
  PHYSIQUE_PHASE_LABEL,
} from "../utils/athleteProfile.js";
import { detectCommitment, createCommitment, resolveDueCommitments, commitmentOutcomeMessage, commitmentProgress } from "../utils/commitments.js";
import { resolveCoachOnboarding, isExistingCoachUser } from "../utils/coachOnboarding.js";
import { BODYBUILDING_QUICK_QUESTIONS } from "../coachSpecialties/bodybuilding.js";
import { getSpecialty } from "../coachSpecialties/index.js";
import AthleteProfileForm from "./AthleteProfileForm.jsx";
import CoachSpecialtySelect from "./CoachSpecialtySelect.jsx";

const GENERAL_QUICK_QUESTIONS = [
  "What should I do today?",
  "Should I increase weight?",
  "Why has my weight stalled?",
  "Should I train through soreness?",
  "How is my progress?",
  "What is holding me back?",
  "Am I on track?",
  "Review today's session.",
  "Review my last 30 days.",
  "Should I switch programs?",
];

export default function CoachTab({ state, updateState, exMap, onNavigate }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(!hasProfile(state));
  const [pendingCommitment, setPendingCommitment] = useState(null);

  const existingCoachUser = isExistingCoachUser(state);
  const [showSpecialtySelect, setShowSpecialtySelect] = useState(
    !resolveCoachOnboarding(state).specialtySelected && !existingCoachUser
  );

  // Existing users (real profile/history/memory already on file) never had a chance to see the
  // "Select Your Coach" screen — it didn't exist yet. Rather than force them through it,
  // silently assign them the only specialty that was ever functional (bodybuilding, already
  // their default) and surface a one-time notice instead (section 9).
  useEffect(() => {
    const onboarding = resolveCoachOnboarding(state);
    if (!onboarding.specialtySelected && existingCoachUser) {
      updateState((prev) => ({
        ...prev,
        coachOnboarding: {
          ...resolveCoachOnboarding(prev),
          specialtySelected: true,
          specialty: resolveProfile(prev).coachSpecialty || "bodybuilding",
          confirmedAt: new Date().toISOString(),
          migrationNoticeShown: false,
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Closes out any commitment whose week has ended and grades it against real logged data
  // (section 22/23) — commitments are the user's own stated intent, so this always runs
  // regardless of the "learn from my data" toggle, which only gates inferred behavioral
  // patterns. Naturally idempotent: once a commitment's status flips off "active", a later pass
  // over the same data no longer counts it as newly resolved, so no duplicate history entries.
  useEffect(() => {
    const { commitments, resolved } = resolveDueCommitments(state);
    if (resolved.length === 0) return;
    const style = state.athleteProfile?.coachingStyle || "balanced";
    updateState((prev) => ({
      ...prev,
      commitments,
      coachHistory: [
        ...resolved.map((c) => ({
          id: `coach_${Date.now()}_${c.id}`,
          date: new Date().toISOString(),
          type: "commitment_result",
          question: c.text,
          message: commitmentOutcomeMessage(c, style),
        })),
        ...(prev.coachHistory || []),
      ],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.commitments, state.cardioLogs, state.workoutSessions]);

  const ask = (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const detected = detectCommitment(trimmed);
    if (detected) {
      setPendingCommitment({ ...detected, rawText: trimmed });
      setQuestion("");
      return;
    }
    const context = buildCoachContext(state, exMap, trimmed);
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

  const confirmCommitment = (accept) => {
    if (!pendingCommitment) return;
    if (accept) {
      const c = createCommitment(pendingCommitment);
      const message = `Locked in: ${c.text}, ${c.period === "next_week" ? "next week" : "this week"}. I'll check in when the week's up.`;
      updateState((prev) => ({
        ...prev,
        commitments: [...(prev.commitments || []), c],
        coachHistory: [
          { id: `coach_${Date.now()}`, date: new Date().toISOString(), type: "commitment", question: pendingCommitment.rawText, message },
          ...(prev.coachHistory || []),
        ],
      }));
      setAnswer({ question: pendingCommitment.rawText, message });
    } else {
      setAnswer({ question: pendingCommitment.rawText, message: "Not tracked as a commitment." });
    }
    setPendingCommitment(null);
  };

  const history = state.coachHistory || [];
  const openCommitments = (state.commitments || []).filter((c) => c.status === "active");
  const knowledgeLevel = coachKnowledgeLevel(state);
  const QUICK_QUESTIONS = state.athleteProfile?.coachSpecialty === "bodybuilding" ? BODYBUILDING_QUICK_QUESTIONS : GENERAL_QUICK_QUESTIONS;
  const onboardingState = resolveCoachOnboarding(state);

  // First-time selection must happen before Athlete Profile even opens (section 1/6): who's
  // coaching you, then tell that coach about you. Existing users are migrated straight past
  // this in the effect above, so they only ever land here on a genuinely first-ever visit.
  if (showSpecialtySelect) {
    return (
      <CoachSpecialtySelect
        state={state}
        updateState={updateState}
        mode="onboarding"
        onSelectComplete={() => setShowSpecialtySelect(false)}
      />
    );
  }

  if (showOnboarding) {
    return <AthleteProfileForm state={state} updateState={updateState} mode="onboarding" onDone={() => setShowOnboarding(false)} onSkip={() => setShowOnboarding(false)} />;
  }

  const activeSpecialty = getSpecialty(state.athleteProfile?.coachSpecialty || "bodybuilding");
  const phase = state.athleteProfile?.physiquePhase;
  const priorities = state.athleteProfile?.physiquePriorities;
  const hasFocus = priorities?.primary || priorities?.secondary;
  const showMigrationNotice = existingCoachUser && onboardingState.specialtySelected && !onboardingState.migrationNoticeShown;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
        <div className="text-xl font-bold text-white mt-1">BRK Coach</div>
      </div>
      {/* Reflects data volume only — not a gamified level or any claim of insight (section 45). */}
      <div className="flex items-center gap-1.5 -mt-4">
        <span className="text-[10px] uppercase tracking-widest text-neutral-600" title={KNOWLEDGE_LEVEL_DESC[knowledgeLevel]}>
          Coach Context: {KNOWLEDGE_LEVEL_LABEL[knowledgeLevel]}
        </span>
      </div>
      <p className="text-xs text-neutral-500 -mt-3">Knows your training. Learns your patterns. Holds you to the plan.</p>

      {showMigrationNotice && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-white">Bodybuilding Coach is now active</div>
            <div className="text-xs text-neutral-500 mt-0.5">You can change your Coach at any time in Coach Settings.</div>
          </div>
          <button
            onClick={() =>
              updateState((prev) => ({ ...prev, coachOnboarding: { ...resolveCoachOnboarding(prev), migrationNoticeShown: true } }))
            }
            className="shrink-0 text-xs uppercase tracking-widest text-neutral-500 hover:text-red-500"
          >
            Dismiss
          </button>
        </div>
      )}

      <button
        onClick={() => onNavigate?.("coachSettings")}
        className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 space-y-1 hover:border-red-700"
      >
        <div className="text-[11px] uppercase tracking-widest text-neutral-500">{activeSpecialty?.label || "Coach"}</div>
        <div className="text-sm text-neutral-300">
          {phase ? PHYSIQUE_PHASE_LABEL[phase] || "General Hypertrophy" : "General Hypertrophy"}
          {hasFocus ? ` · Focus: ${[priorities.primary, priorities.secondary].filter(Boolean).join(", ")}` : ""}
        </div>
      </button>

      <div className="border border-neutral-800 divide-y divide-neutral-900">
        <button onClick={() => onNavigate?.("coachKnowledge")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-panel">
          <span className="flex items-center gap-2 text-sm text-neutral-200">
            <BookOpen size={16} className="text-neutral-500" /> What Coach Knows About You
          </span>
          <ChevronRight size={16} className="text-neutral-600" />
        </button>
        <button onClick={() => onNavigate?.("coachSettings")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-panel">
          <span className="flex items-center gap-2 text-sm text-neutral-200">
            <SettingsIcon size={16} className="text-neutral-500" /> Coach Settings
          </span>
          <ChevronRight size={16} className="text-neutral-600" />
        </button>
      </div>

      {openCommitments.length > 0 && (
        <div className="border border-neutral-800 bg-charcoal-panel p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500">Active Commitments</div>
          {openCommitments.map((c) => {
            const progress = c.type !== "custom" ? commitmentProgress(state, c) : null;
            return (
              <div key={c.id} className="text-sm text-neutral-300 flex items-center justify-between">
                <span>{c.text} — {c.period === "next_week" ? "next week" : "this week"}</span>
                {progress != null && <span className="text-neutral-500 text-xs shrink-0 ml-2">{progress}/{c.target}</span>}
              </div>
            );
          })}
        </div>
      )}

      {pendingCommitment && (
        <div className="border border-red-900/40 bg-charcoal-panel p-4 space-y-3">
          <div className="text-sm text-white">Hold you to that? {pendingCommitment.text}, {pendingCommitment.period === "next_week" ? "next week" : "this week"}.</div>
          <div className="flex gap-2">
            <button onClick={() => confirmCommitment(true)} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600">
              Yes
            </button>
            <button onClick={() => confirmCommitment(false)} className="flex-1 py-2 text-xs uppercase tracking-widest font-bold border border-neutral-800 text-neutral-400 hover:border-neutral-600">
              No
            </button>
          </div>
        </div>
      )}

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
