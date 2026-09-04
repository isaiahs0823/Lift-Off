import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Settings as SettingsIcon, ChevronRight, Apple, Send, RotateCcw, WifiOff, ListChecks, Sparkles, AlertCircle, Target, MessageCircle, Wrench } from "lucide-react";
import { ButtonPrimary, Pill, Divider, ActionTile } from "./ui/Kit.jsx";
import { SlideInPanel } from "./SlideInPanel.jsx";
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

// Coach-local micro eyebrow — same role as the shared SectionLabel but a size smaller, so the
// visual-scale reduction is real and not fighting the shared primitive's fixed 11px.
function MiniLabel({ children, tone = "red", className = "" }) {
  return (
    <div className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tone === "red" ? "text-v5-red" : "text-v5-subtext"} ${className}`}>
      {children}
    </div>
  );
}

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
  const [showCoachTools, setShowCoachTools] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState(null);
  const [errorRequestId, setErrorRequestId] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const abortRef = useRef(null);
  const messagesContainerRef = useRef(null);

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

  // Container-scoped scroll, not scrollIntoView() — scrollIntoView walks up and can drag the
  // *page* viewport along with it (a visible jerk/jump on iOS Safari and installed PWAs,
  // especially with the on-screen keyboard open). Setting scrollTop directly on the chat's own
  // scroll container keeps the motion contained to the chat panel, never the outer page.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
  if (showCoachTools) {
    return (
      <SlideInPanel title="Coach Tools" subtitle="Knowledge, priorities, nutrition, program, settings" onBack={() => setShowCoachTools(false)}>
        <div className="grid grid-cols-2 gap-2">
          <ActionTile icon={BookOpen} label="Knowledge" onClick={() => onNavigate?.("coachKnowledge")} />
          <ActionTile icon={Target} label="Priorities" onClick={() => onNavigate?.("developmentPriorities")} />
          <ActionTile icon={Apple} label="Nutrition" onClick={() => onNavigate?.("nutrition")} />
          <ActionTile icon={ListChecks} label="Program" onClick={() => setShowScheduleBuilder(true)} />
          <ActionTile icon={SettingsIcon} label="Settings" onClick={() => onNavigate?.("coachSettings")} />
        </div>
      </SlideInPanel>
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
    <div className="space-y-2.5 -mx-1">
      {/* Compact local header — a real size drop (title 20px -> 18px), not just spacing. The
          context line rides inline next to the title instead of stacking as its own row. */}
      <div>
        <MiniLabel>Coach</MiniLabel>
        <div className="flex items-baseline justify-between gap-2 mt-0.5">
          <div className="text-lg font-black text-v5-text tracking-tight">BRK Coach</div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-v5-subtext/70 shrink-0" title={KNOWLEDGE_LEVEL_DESC[knowledgeLevel]}>
            {KNOWLEDGE_LEVEL_LABEL[knowledgeLevel]}
          </div>
        </div>
      </div>

      {/* Context card — what Coach is actually considering. A context selector, not a feature
          hero: smaller radius, smaller padding, smaller type than before. */}
      <button onClick={() => onNavigate?.("coachSettings")} className="w-full text-left bg-v5-surface rounded-xl p-2.5 space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-v5-red">
            <MessageCircle size={10} /> {activeSpecialty?.label || "Coach"}
          </span>
          <ChevronRight size={13} className="text-v5-subtext" />
        </div>
        <div className="text-xs text-v5-text/90">
          {phase ? PHYSIQUE_PHASE_LABEL[phase] || "General Hypertrophy" : "General Hypertrophy"}
        </div>
        {hasFocus && <div className="text-[11px] text-v5-subtext">Focus: {[priorities.primary, priorities.secondary].filter(Boolean).join(", ")}</div>}
      </button>

      {/* Coach Tools collapsed to one tap target instead of an always-open grid — Coach should
          read as "brief + conversation" first, with chat appearing right after the context
          card. Knowledge/Priorities/Nutrition/Program/Settings are unchanged, just one level of
          progressive disclosure deeper (a sheet, opened above), not gone. */}
      <button
        onClick={() => setShowCoachTools(true)}
        className="w-full flex items-center justify-between bg-v5-surface rounded-xl px-2.5 py-2"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-v5-subtext">
          <Wrench size={11} /> Coach Tools
        </span>
        <ChevronRight size={14} className="text-v5-subtext" />
      </button>

      {openCommitments.length > 0 && (
        <div className="bg-v5-surface rounded-xl p-2.5 space-y-1">
          <MiniLabel tone="muted">Active commitments</MiniLabel>
          <div className="space-y-1">
            {openCommitments.map((c) => {
              const progress = c.type !== "custom" ? commitmentProgress(state, c) : null;
              return (
                <div key={c.id} className="text-xs text-v5-text/90 flex items-center justify-between gap-2">
                  <span className="truncate">{c.text} — {c.period === "next_week" ? "next week" : "this week"}</span>
                  {progress != null && <span className="text-v5-subtext text-[11px] shrink-0 tabular-nums">{progress}/{c.target}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openContext?.label && (
        <div className="flex items-center gap-2">
          <Pill tone="outline">Referencing</Pill>
          <span className="text-[11px] text-v5-text/90 truncate">{openContext.label}</span>
        </div>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 text-[11px] text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-2">
          <WifiOff size={12} /> You're offline — Coach needs a connection to respond.
        </div>
      )}

      <div className="rounded-xl bg-v5-surface flex flex-col h-[65vh] min-h-[420px] overflow-hidden">
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {bubbles.length === 0 && !showThinking && !showStreaming && (
            <div className="text-xs text-v5-subtext text-center py-3">
              Ask about a workout, your progress, nutrition, or what to focus on today.
            </div>
          )}
          {bubbles.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[13px] whitespace-pre-line ${m.role === "user" ? "bg-v5-red text-white" : "bg-v5-elevated text-v5-text"}`}>
                {m.content}
                {m.role === "assistant" && m.metadata?.proposal && (
                  <CoachProposalCard proposal={m.metadata.proposal} updateState={updateState} exMap={exMap} allExercises={allExercises} onResolve={(status) => resolveProposal(m.id, status)} />
                )}
              </div>
            </div>
          ))}
          {showThinking && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3 py-2 rounded-xl text-[13px] bg-v5-elevated text-v5-subtext italic">Coach is thinking…</div>
            </div>
          )}
          {showStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3 py-2 rounded-xl text-[13px] bg-v5-elevated text-v5-text whitespace-pre-line">{streamingText}</div>
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
              <div className="w-full rounded-xl bg-v5-elevated p-4 text-center space-y-1.5">
                <Sparkles size={16} className="mx-auto text-v5-red" />
                <MiniLabel className="justify-center flex">BRK AI Coach</MiniLabel>
                <div className="text-sm font-bold text-v5-text">Coming Soon</div>
                <div className="text-xs text-v5-subtext max-w-xs mx-auto">
                  Personalized coaching built around your training, readiness, nutrition, and progress is being prepared for beta.
                </div>
                {errorRequestId && <div className="text-[11px] text-v5-subtext/50 pt-1">Ref: {errorRequestId}</div>}
              </div>
            </div>
          )}
          {error && errorStatus !== 503 && (
            <div className="flex justify-start w-full">
              <div className="w-full rounded-xl bg-v5-red/[0.08] ring-1 ring-v5-red/25 p-4 text-center space-y-1.5">
                <AlertCircle size={16} className="mx-auto text-v5-red" />
                <MiniLabel className="justify-center flex">BRK AI Coach</MiniLabel>
                <div className="text-sm font-bold text-v5-text">Temporarily unavailable</div>
                <div className="text-xs text-v5-subtext">Your training data is safe. Try again shortly.</div>
                <button
                  onClick={retry}
                  className="mx-auto flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-v5-red hover:opacity-80 pt-1"
                >
                  <RotateCcw size={11} /> Retry
                </button>
                {errorRequestId && <div className="text-[11px] text-v5-subtext/50">Ref: {errorRequestId}</div>}
              </div>
            </div>
          )}
        </div>

        {bubbles.length === 0 && (
          <div className="flex flex-wrap gap-1 px-2.5 pb-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={sending || !isOnline || errorStatus === 503}
                className="px-2 py-1 rounded-full text-[11px] bg-v5-elevated text-v5-subtext hover:text-v5-red disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-white/[0.06] p-2 flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder="Ask your coach..."
            disabled={sending || !isOnline || errorStatus === 503}
            className="flex-1 min-w-0 bg-v5-elevated rounded-lg text-v5-text px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-v5-red disabled:opacity-60 placeholder:text-v5-subtext/50"
          />
          <ButtonPrimary
            size="sm"
            fullWidth={false}
            icon={Send}
            onClick={() => send(input)}
            disabled={sending || !isOnline || errorStatus === 503 || !input.trim()}
            className="shrink-0 px-3.5"
          >
            Send
          </ButtonPrimary>
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-1.5">
          <MiniLabel tone="muted">Earlier Coach notes</MiniLabel>
          <div className="space-y-2">
            {history.slice(0, 10).map((h, i) => (
              <React.Fragment key={h.id}>
                {i > 0 && <Divider />}
                <div>
                  <div className="text-[11px] text-v5-subtext/70">
                    {new Date(h.date).toLocaleString()}
                    {h.question ? ` — ${h.question}` : ""}
                  </div>
                  <div className="text-xs text-v5-text/90 mt-0.5 whitespace-pre-line">{h.message}</div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
