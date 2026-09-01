import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Settings as SettingsIcon, ChevronRight, Apple, Send, RotateCcw, WifiOff, ListChecks, Sparkles, AlertCircle, Target, MessageCircle } from "lucide-react";
import { ScreenHeader, SectionLabel, Card, ListRow, ButtonPrimary, Pill, Divider } from "./ui/Kit.jsx";
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
    <div className="space-y-5">
      <ScreenHeader
        eyebrow="Coach"
        title="BRK Coach"
        subtitle={`Context: ${KNOWLEDGE_LEVEL_LABEL[knowledgeLevel]}`}
      />

      {/* Context card — what Coach is actually considering, so this reads as BRK's own coach
          rather than a bolted-on chatbot page (mockup section 9). Real fields only: specialty,
          declared phase, declared development priorities. */}
      <Card onClick={() => onNavigate?.("coachSettings")} className="space-y-1.5">
        <div className="flex items-center justify-between">
          <SectionLabel className="flex items-center gap-1.5">
            <MessageCircle size={12} /> {activeSpecialty?.label || "Coach"}
          </SectionLabel>
          <ChevronRight size={16} className="text-v5-subtext" />
        </div>
        <div className="text-sm text-v5-text/90">
          {phase ? PHYSIQUE_PHASE_LABEL[phase] || "General Hypertrophy" : "General Hypertrophy"}
        </div>
        {hasFocus && <div className="text-xs text-v5-subtext">Focus: {[priorities.primary, priorities.secondary].filter(Boolean).join(", ")}</div>}
      </Card>

      <div className="space-y-2">
        <ListRow icon={BookOpen} title="What Coach Knows About You" onClick={() => onNavigate?.("coachKnowledge")} />
        <ListRow icon={Target} title="Development Priorities" onClick={() => onNavigate?.("developmentPriorities")} />
        <ListRow icon={SettingsIcon} title="Coach Settings" onClick={() => onNavigate?.("coachSettings")} />
        <ListRow icon={Apple} title="Nutrition Plan" onClick={() => onNavigate?.("nutrition")} />
        <ListRow icon={ListChecks} title="Build a Program" onClick={() => setShowScheduleBuilder(true)} />
      </div>

      {openCommitments.length > 0 && (
        <Card className="space-y-2.5">
          <SectionLabel tone="muted">Active commitments</SectionLabel>
          <div className="space-y-1.5">
            {openCommitments.map((c) => {
              const progress = c.type !== "custom" ? commitmentProgress(state, c) : null;
              return (
                <div key={c.id} className="text-sm text-v5-text/90 flex items-center justify-between gap-2">
                  <span className="truncate">{c.text} — {c.period === "next_week" ? "next week" : "this week"}</span>
                  {progress != null && <span className="text-v5-subtext text-xs shrink-0 tabular-nums">{progress}/{c.target}</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {openContext?.label && (
        <div className="flex items-center gap-2">
          <Pill tone="outline">Referencing</Pill>
          <span className="text-xs text-v5-text/90 truncate">{openContext.label}</span>
        </div>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2.5">
          <WifiOff size={13} /> You're offline — Coach needs a connection to respond.
        </div>
      )}

      <div className="rounded-2xl bg-v5-surface flex flex-col h-[65vh] min-h-[420px] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {bubbles.length === 0 && !showThinking && !showStreaming && (
            <div className="text-sm text-v5-subtext text-center py-6">
              Ask about a workout, your progress, nutrition, or what to focus on today.
            </div>
          )}
          {bubbles.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-line ${m.role === "user" ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-text"}`}>
                {m.content}
                {m.role === "assistant" && m.metadata?.proposal && (
                  <CoachProposalCard proposal={m.metadata.proposal} updateState={updateState} exMap={exMap} allExercises={allExercises} onResolve={(status) => resolveProposal(m.id, status)} />
                )}
              </div>
            </div>
          ))}
          {showThinking && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm bg-v5-elevated text-v5-subtext italic">Coach is thinking…</div>
            </div>
          )}
          {showStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm bg-v5-elevated text-v5-text whitespace-pre-line">{streamingText}</div>
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
              <div className="w-full rounded-2xl bg-v5-elevated p-5 text-center space-y-2">
                <Sparkles size={18} className="mx-auto text-v5-red" />
                <SectionLabel>BRK AI Coach</SectionLabel>
                <div className="text-base font-bold text-v5-text">Coming Soon</div>
                <div className="text-sm text-v5-subtext max-w-xs mx-auto">
                  Personalized coaching built around your training, readiness, nutrition, and progress is being prepared for beta.
                </div>
                {errorRequestId && <div className="text-[10px] text-v5-subtext/50 pt-1">Ref: {errorRequestId}</div>}
              </div>
            </div>
          )}
          {error && errorStatus !== 503 && (
            <div className="flex justify-start w-full">
              <div className="w-full rounded-2xl bg-v5-red/[0.08] ring-1 ring-v5-red/25 p-5 text-center space-y-2">
                <AlertCircle size={18} className="mx-auto text-v5-red" />
                <SectionLabel>BRK AI Coach</SectionLabel>
                <div className="text-base font-bold text-v5-text">Temporarily unavailable</div>
                <div className="text-sm text-v5-subtext">Your training data is safe. Try again shortly.</div>
                <button
                  onClick={retry}
                  className="mx-auto flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-v5-red hover:opacity-80 pt-1"
                >
                  <RotateCcw size={12} /> Retry
                </button>
                {errorRequestId && <div className="text-[10px] text-v5-subtext/50">Ref: {errorRequestId}</div>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {bubbles.length === 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={sending || !isOnline || errorStatus === 503}
                className="px-2.5 py-1.5 rounded-full text-[11px] bg-v5-elevated text-v5-subtext hover:text-v5-red disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-white/[0.06] p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder="Ask your coach..."
            disabled={sending || !isOnline || errorStatus === 503}
            className="flex-1 min-w-0 bg-v5-elevated rounded-xl text-v5-text px-3.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-v5-red disabled:opacity-60 placeholder:text-v5-subtext/50"
          />
          <ButtonPrimary
            size="md"
            fullWidth={false}
            icon={Send}
            onClick={() => send(input)}
            disabled={sending || !isOnline || errorStatus === 503 || !input.trim()}
            className="shrink-0 px-4"
          >
            Send
          </ButtonPrimary>
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-2.5">
          <SectionLabel tone="muted">Earlier Coach notes</SectionLabel>
          <div className="space-y-3">
            {history.slice(0, 10).map((h, i) => (
              <React.Fragment key={h.id}>
                {i > 0 && <Divider />}
                <div>
                  <div className="text-[11px] text-v5-subtext/70">
                    {new Date(h.date).toLocaleString()}
                    {h.question ? ` — ${h.question}` : ""}
                  </div>
                  <div className="text-sm text-v5-text/90 mt-0.5 whitespace-pre-line">{h.message}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
