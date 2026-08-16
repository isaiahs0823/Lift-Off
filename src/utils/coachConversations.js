// ---------------- COACH CONVERSATION STORAGE + CONTEXT WINDOW ----------------
// One primary ongoing thread for v1 (spec section 16 explicitly allows this) — stored as an
// array from day one so multiple threads / "New chat" is a later UI change, not a data
// migration. Persisted the same way every other BRK entity is (state.coachConversations,
// added to BACKUP_DATA_KEYS in App.jsx), not tied to any account — ready to sync later without
// a shape change.
function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createConversation(specialty) {
  const now = new Date().toISOString();
  return { id: newId("conv"), createdAt: now, updatedAt: now, specialty, messages: [] };
}

// The one active thread — most recently updated conversation, or a fresh one if none exists
// yet. Pure function; the caller persists via updateState if a new conversation was created.
export function getActiveConversation(state, specialty) {
  const conversations = state.coachConversations || [];
  if (conversations.length === 0) return { conversation: createConversation(specialty), isNew: true };
  const sorted = [...conversations].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return { conversation: sorted[0], isNew: false };
}

export function upsertConversation(state, conversation) {
  const conversations = state.coachConversations || [];
  const exists = conversations.some((c) => c.id === conversation.id);
  const next = exists ? conversations.map((c) => (c.id === conversation.id ? conversation : c)) : [conversation, ...conversations];
  return { ...state, coachConversations: next };
}

export function appendMessage(conversation, message) {
  const full = { id: newId("msg"), createdAt: new Date().toISOString(), ...message };
  return { ...conversation, updatedAt: full.createdAt, messages: [...conversation.messages, full] };
}

// Scans one turn's appended tool-result messages for a write-adjacent proposal (commitment /
// nutrition target change — see coachToolRunner.js) so the caller can attach it to the turn's
// final assistant message as metadata.proposal, which is what the chat UI renders an
// Accept/Modify/Decline card from. Returns null when the turn didn't touch a propose-* tool.
export function extractProposalFromToolResults(appendedMessages) {
  for (const m of appendedMessages) {
    if (m.role !== "tool") continue;
    let parsed;
    try {
      parsed = JSON.parse(m.content);
    } catch {
      continue;
    }
    if (parsed?.proposalType === "commitment") return { proposalType: "commitment", proposal: parsed.proposal, status: "pending" };
    if (parsed?.proposalType === "nutrition_target_change" && parsed.applicable) {
      return { proposalType: "nutrition_target_change", proposal: parsed.proposal, status: "pending" };
    }
  }
  return null;
}

// Marks a specific message's proposal as resolved (accepted/modified/declined) so its card
// stops offering the same buttons after the athlete has already acted on it.
export function resolveProposalOnMessage(conversation, messageId, status) {
  return {
    ...conversation,
    messages: conversation.messages.map((m) =>
      m.id === messageId && m.metadata?.proposal ? { ...m, metadata: { ...m.metadata, proposal: { ...m.metadata.proposal, status } } } : m
    ),
  };
}

// Visible chat bubbles only — raw tool-result messages are wire-protocol plumbing, not
// something a person should see rendered as a message.
export function visibleMessages(conversation) {
  return (conversation?.messages || []).filter((m) => m.role === "user" || m.role === "assistant");
}

// Groups the full message list into turns (one user message + everything up to the next user
// message) so the context window can drop whole turns rather than risk cutting an
// assistant-tool_calls message off from its tool results, which OpenAI's API rejects.
function groupIntoTurns(messages) {
  const turns = [];
  let current = null;
  for (const m of messages) {
    if (m.role === "user") {
      current = [m];
      turns.push(current);
    } else if (current) {
      current.push(m);
    } else {
      current = [m];
      turns.push(current);
    }
  }
  return turns;
}

const DEFAULT_MAX_MESSAGES = 24;
const DEFAULT_MAX_CHARS = 12000;

// Recent turns, kept whole, bounded by both a message count and a character budget (spec
// section 26) — no unlimited history growth, no mid-turn truncation that would desync a
// tool-calls/tool-result pair.
export function messagesForApi(conversation, { maxMessages = DEFAULT_MAX_MESSAGES, maxChars = DEFAULT_MAX_CHARS } = {}) {
  const turns = groupIntoTurns(conversation?.messages || []);
  const kept = [];
  let messageCount = 0;
  let charCount = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    const turnChars = turn.reduce((s, m) => s + (m.content?.length || 0), 0);
    if (kept.length > 0 && (messageCount + turn.length > maxMessages || charCount + turnChars > maxChars)) break;
    kept.unshift(turn);
    messageCount += turn.length;
    charCount += turnChars;
  }
  const trimmed = turns.length > kept.length;
  const flat = kept.flat();
  const apiMessages = flat.map((m) => {
    const base = { role: m.role, content: m.content ?? null };
    if (m.tool_calls) base.tool_calls = m.tool_calls;
    if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
    if (m.name) base.name = m.name;
    return base;
  });
  if (trimmed) {
    apiMessages.unshift({ role: "system", content: "Note: earlier conversation history was trimmed for length. Continue naturally from here." });
  }
  return apiMessages;
}
