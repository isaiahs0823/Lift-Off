import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Settings as SettingsIcon, ChevronRight, Apple, Send, RotateCcw, WifiOff, ListChecks, Sparkles, AlertCircle } from "lucide-react";
import { syncCoachMemory } from "../utils/coachMemory.js";
import { hasProfile, coachKnowledgeLevel, KNOWLEDGE_LEVEL_LABEL, KNOWLEDGE_LEVEL_DESC, PHYSIQUE_PHASE_LABEL } from "../utils/athleteProfile.js";
import { resolveDueCommitments, commitmentOutcomeMessage, commitmentProgress } from "../utils/commitments.js";
import { resolveCoachOnboarding } from "../utils/coachOnboarding.js";
import { BODYBUILDING_QUICK_QUESTIONS } from "../coachSpecialties/bodybuilding.js";
import { getSpecialty } from "../coachSpecialties/index.js";
import AthleteProfileForm from "./AthleteProfileForm.jsx";
import CoachSpecialtySelect from "./CoachSpecialtySelect.jsx";
import CoachProposalCard from "./CoachProposalCard.jsx";
import ScheduleBuilderPicker from "./ScheduleBuilderPicker.jsx";
import { buildCompactCoachContext } from "../utils/coachChatContext.js";
import { runCoachTurn } from "../services/coachChatService.js";
import { createToolRunner } from "../services/coachToolRunner.js";
import {
  getActiveConversation,
  upsertConversation,
  appendMessage,
  visibleMessages,
  messagesForApi,
  extractProposalFromToolResults,
  resolveProposalOnMessage,
  supersedePendingProposals,
} from "../utils/coachConversations.js";

const GENERAL_QUICK_QUESTIONS = [
  "How was my last workout?",
  "What should I focus on today?",
  "Am I recovering well?",
  "Should we adjust my calories?",
  "What is holding me back?",
  "How is my progression?",
];

// The real multi-turn AI chat (spec's core deliverable) — everything above the chat panel
// (specialty card, knowledge/settings/nutrition nav, active commitments) is the same
// functionality CoachTab always had, just no longer the dominant thing on screen. Chat is now
// the central experience; those stay one tap away, exactly as before.
export default function CoachTab({ state, updateState, exMap, allExercises, onNavigate, openContext }) {
  const [showOnboarding, setShowOnboarding] = useState(!hasProfile(state));
  const [showSpecialtySelect, setShowSpecialtySelect] = useState(!resolveCoachOnboarding(state).specialtySelected);
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState(null);
  const [errorRequestId, setErrorRequestId] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Cancel any in-flight request the instant this screen goes away — never leave a streaming
  // fetch running after the user has navigated off Coach (spec section 24).
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (state.athleteProfile && state.athleteProfile.learningEnabled === false) return;
    const next = syncCoachMemory(state);
    if (next !== state.coachMemories) {
      updateState((prev) => ({ ...prev, coachMemories: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.workoutSessions, state.cardioLogs, state.logs, state.bodyweightLogs, state.readinessLogs, state.scheduleLog, state.weeklySchedule]);

  useEffect(() => {
    const { commitments, resolved } = resolveDueCommitments(state);
    if (resolved.length === 0) return;
    const style = state.athleteProfile?.coachingStyle || "balanced";
    updateState((prev) => ({
      ...prev,
      commitments,
      coachHistory: [
        ...resolved.map((c) => ({ id: `coach_${Date.now()}_${c.id}`, date: new Date().toISOString(), type: "commitment_result", question: c.text, message: commitmentOutcomeMessage(c, style) })),
        ...(prev.coachHistory || []),
      ],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.commitments, state.cardioLogs, state.workoutSessions]);

  const specialty = state.athleteProfile?.coachSpecialty || "bodybuilding";
  const coachingStyle = state.athleteProfile?.coachingStyle || "balanced";
  const { conversation } = getActiveConversation(state, specialty);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.messages.length, streamingText]);

  const runTurn = async (convoWithUserMessage) => {
    setSending(true);
    setStreamingText("");
    setError(null);
    setErrorRequestId(null);
    setErrorStatus(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const compactContext = buildCompactCoachContext(state, exMap, [...convoWithUserMessage.messages].reverse().find((m) => m.role === "user")?.content || "");
    if (openContext?.type === "workout" && openContext.sessionId) compactContext.referencedWorkoutSessionId = openContext.sessionId;
    if (openContext?.type === "nutrition" && openContext.dateKey) compactContext.referencedDate = openContext.dateKey;

    const executeTool = createToolRunner({ state, updateState, exMap, allExercises });

    try {
      const result = await runCoachTurn({
        messages: messagesForApi(convoWithUserMessage),
        context: compactContext,
        specialty,
        coachingStyle,
        signal: controller.signal,
        executeTool,
        onContentDelta: (_delta, full) => setStreamingText(full),
      });

      const proposal = extractProposalFromToolResults(result.appended);
      let finalConvo = proposal?.proposalType === "program" ? supersedePendingProposals(convoWithUserMessage, "program") : convoWithUserMessage;
      for (const m of result.appended) {
        const isFinalAssistantText = m.role === "assistant" && !!m.content;
        finalConvo = appendMessage(finalConvo, isFinalAssistantText && proposal ? { ...m, metadata: { proposal } } : m);
      }
      updateState((prev) => upsertConversation(prev, finalConvo));
    } catch (e) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Coach couldn't respond right now.");
        setErrorRequestId(e?.requestId || null);
        setErrorStatus(e?.status ?? null);
      }
    } finally {
      setSending(false);
      setStreamingText("");
      abortRef.current = null;
    }
  };

  const send = (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed || sending) return;
    setInput("");
    const convoWithUserMessage = appendMessage(conversation, { role: "user", content: trimmed });
    updateState((prev) => upsertConversation(prev, convoWithUserMessage));
    runTurn(convoWithUserMessage);
  };

  const retry = () => {
    // The failed turn's user message is already persisted (never lost) — just re-run the model
    // call against the same conversation state, no new user message appended.
    runTurn(conversation);
  };

  const resolveProposal = (messageId, status) => {
    updateState((prev) => upsertConversation(prev, resolveProposalOnMessage(getActiveConversation(prev, specialty).conversation, messageId, status)));
  };

  const history = state.coachHistory || [];
  const openCommitments = (state.commitments || []).filter((c) => c.status === "active");
  const knowledgeLevel = coachKnowledgeLevel(state);
  const QUICK_QUESTIONS = specialty === "bodybuilding" ? BODYBUILDING_QUICK_QUESTIONS : GENERAL_QUICK_QUESTIONS;

  if (showSpecialtySelect) {
    return <CoachSpecialtySelect state={state} updateState={updateState} mode="onboarding" onSelectComplete={() => setShowSpecialtySelect(false)} />;
  }
  if (showOnboarding) {
    return <AthleteProfileForm state={state} updateState={updateState} mode="onboarding" onDone={() => setShowOnboarding(false)} onSkip={() => setShowOnboarding(false)} />;
  }
  if (showScheduleBuilder) {
    return (
      <ScheduleBuilderPicker
        onBack={() => setShowScheduleBuilder(false)}
        onSubmit={(text) => {
          setShowScheduleBuilder(false);
          send(text);
        }}
      />
    );
  }

  const activeSpecialty = getSpecialty(specialty);
  const phase = state.athleteProfile?.physiquePhase;
  const priorities = state.athleteProfile?.physiquePriorities;
  const hasFocus = priorities?.primary || priorities?.secondary;

  const bubbles = visibleMessages(conversation).filter((m) => m.content);
  const showThinking = sending && streamingText === "";
  const showStreaming = sending && streamingText !== "";

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-red-600">Coach</div>
        <div className="text-xl font-bold text-white mt-1">BRK Coach</div>
      </div>
      <div className="flex items-center gap-1.5 -mt-4">
        <span className="text-[10px] uppercase tracking-widest text-neutral-600" title={KNOWLEDGE_LEVEL_DESC[knowledgeLevel]}>
          Coach Context: {KNOWLEDGE_LEVEL_LABEL[knowledgeLevel]}
        </span>
      </div>

      <button onClick={() => onNavigate?.("coachSettings")} className="w-full text-left border border-neutral-800 bg-charcoal-panel p-4 space-y-1 hover:border-red-700">
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
        <button onClick={() => onNavigate?.("nutrition")} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-panel">
          <span className="flex items-center gap-2 text-sm text-neutral-200">
            <Apple size={16} className="text-neutral-500" /> Nutrition Plan
          </span>
          <ChevronRight size={16} className="text-neutral-600" />
        </button>
        <button onClick={() => setShowScheduleBuilder(true)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-charcoal-panel">
          <span className="flex items-center gap-2 text-sm text-neutral-200">
            <ListChecks size={16} className="text-neutral-500" /> Build a Program
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
                <span>
                  {c.text} — {c.period === "next_week" ? "next week" : "this week"}
                </span>
                {progress != null && (
                  <span className="text-neutral-500 text-xs shrink-0 ml-2">
                    {progress}/{c.target}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {openContext?.label && (
        <div className="text-xs text-neutral-500 border border-neutral-800 bg-charcoal-panel px-3 py-2">
          Referencing: <span className="text-neutral-300">{openContext.label}</span>
        </div>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 text-xs text-amber-500 border border-amber-900/40 bg-charcoal-panel px-3 py-2">
          <WifiOff size={13} /> You're offline — Coach needs a connection to respond.
        </div>
      )}

      <div className="border border-neutral-800 bg-charcoal-panel flex flex-col h-[65vh] min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {bubbles.length === 0 && !showThinking && !showStreaming && (
            <div className="text-sm text-neutral-500 text-center py-6">
              Ask about a workout, your progress, nutrition, or what to focus on today.
            </div>
          )}
          {bubbles.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-3.5 py-2.5 text-sm whitespace-pre-line ${m.role === "user" ? "bg-red-700 text-white" : "bg-charcoal-deep border border-neutral-800 text-neutral-200"}`}>
                {m.content}
                {m.role === "assistant" && m.metadata?.proposal && (
                  <CoachProposalCard proposal={m.metadata.proposal} updateState={updateState} exMap={exMap} allExercises={allExercises} onResolve={(status) => resolveProposal(m.id, status)} />
                )}
              </div>
            </div>
          ))}
          {showThinking && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 text-sm bg-charcoal-deep border border-neutral-800 text-neutral-500 italic">Coach is thinking…</div>
            </div>
          )}
          {showStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 text-sm bg-charcoal-deep border border-neutral-800 text-neutral-200 whitespace-pre-line">{streamingText}</div>
            </div>
          )}
          {/* Two distinct fallback states, not a raw provider error dropped into the chat log.
              503 ("AI Coach is not configured yet.") means there is currently no provider to
              retry against at all — a permanent-feeling "Coming Soon" panel with no Retry button,
              since retrying can't help. Everything else (quota/billing, upstream failure, model
              issue, timeout, network) is a working-but-currently-failing provider, so it gets a
              visually distinct "temporarily unavailable" panel with Retry — the case the spec
              calls out as needing an actual retry path rather than a dead end. Neither panel ever
              shows the raw provider name, status code, or error body to the athlete; that detail
              still reaches Coach Settings' diagnostics via errorRequestId, matched to the exact
              server log line, for admin/dev use only. */}
          {error && errorStatus === 503 && (
            <div className="flex justify-start w-full">
              <div className="w-full border border-neutral-800 bg-charcoal-panel p-5 text-center space-y-2">
                <Sparkles size={18} className="mx-auto text-red-600" />
                <div className="text-[11px] uppercase tracking-widest text-red-600 font-bold">BRK AI Coach</div>
                <div className="text-base font-bold text-white">Coming Soon</div>
                <div className="text-sm text-neutral-400 max-w-xs mx-auto">
                  Personalized coaching built around your training, readiness, nutrition, and progress is being prepared for beta.
                </div>
                {errorRequestId && <div className="text-[10px] text-neutral-700 pt-1">Ref: {errorRequestId}</div>}
              </div>
            </div>
          )}
          {error && errorStatus !== 503 && (
            <div className="flex justify-start w-full">
              <div className="w-full border border-red-900/40 bg-charcoal-panel p-5 text-center space-y-2">
                <AlertCircle size={18} className="mx-auto text-red-600" />
                <div className="text-[11px] uppercase tracking-widest text-red-600 font-bold">BRK AI Coach</div>
                <div className="text-base font-bold text-white">Temporarily unavailable</div>
                <div className="text-sm text-neutral-400">Your training data is safe. Try again shortly.</div>
                <button
                  onClick={retry}
                  className="mx-auto flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-red-500 hover:text-red-400 pt-1"
                >
                  <RotateCcw size={12} /> Retry
                </button>
                {errorRequestId && <div className="text-[10px] text-neutral-700">Ref: {errorRequestId}</div>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {bubbles.length === 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={sending || !isOnline || errorStatus === 503} className="px-2.5 py-1.5 text-[11px] border border-neutral-800 text-neutral-400 hover:border-red-700 hover:text-red-500 disabled:opacity-40">
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-neutral-800 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder="Ask your coach..."
            disabled={sending || !isOnline || errorStatus === 503}
            className="flex-1 min-w-0 bg-charcoal-deep border border-neutral-800 text-neutral-100 px-3 py-2.5 text-base focus:outline-none focus:border-red-700 disabled:opacity-60"
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !isOnline || errorStatus === 503 || !input.trim()}
            className="shrink-0 px-4 py-2.5 text-xs uppercase tracking-widest font-bold border bg-red-700 border-red-700 text-white hover:bg-red-600 disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send size={14} /> Send
          </button>
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">Earlier Coach notes</div>
          <div className="space-y-3">
            {history.slice(0, 10).map((h) => (
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
