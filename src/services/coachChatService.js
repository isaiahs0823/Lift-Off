// ---------------- COACH CHAT SERVICE (client side) ----------------
// Talks only to BRK's own /api/coach-chat proxy, never to the LLM provider directly. Parses
// the provider's SSE stream (OpenAI's own wire format, passed through unmodified by the
// server) and, when the model asks for a tool, hands control back to the caller to execute it
// locally and continue the conversation — see runCoachTurn(). This file has zero knowledge of
// which provider is behind the proxy; that's isolated to api/_lib/coachAIProvider.js.

async function streamOneCompletion({ messages, context, specialty, coachingStyle, signal, onContentDelta }) {
  const res = await fetch("/api/coach-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, context, specialty, coachingStyle }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.error || "Coach couldn't respond right now.");
    err.status = res.status;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCallsAcc = [];
  let finishReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (dataStr === "[DONE]") continue;
      let json;
      try {
        json = JSON.parse(dataStr);
      } catch {
        continue;
      }
      const choice = json.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) {
        content += delta.content;
        onContentDelta?.(delta.content, content);
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { id: tc.id || `call_${idx}`, name: "", arguments: "" };
          if (tc.id) toolCallsAcc[idx].id = tc.id;
          if (tc.function?.name) toolCallsAcc[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCallsAcc[idx].arguments += tc.function.arguments;
        }
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  const toolCalls = toolCallsAcc.filter(Boolean);
  if (finishReason === "tool_calls" && toolCalls.length > 0) {
    return {
      type: "tool_calls",
      toolCalls,
      assistantMessage: {
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.map((tc) => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: tc.arguments } })),
      },
    };
  }
  return { type: "message", content };
}

// Runs one full conversational turn: sends messages, streams the reply, and if the model
// requests tools, executes them (via the caller-supplied executeTool) and loops until a real
// text answer comes back or the hop limit is hit. Returns the new messages to append (assistant
// tool-call messages + tool results, if any, followed by the final assistant text message) so
// the caller can persist the whole turn.
export async function runCoachTurn({ messages, context, specialty, coachingStyle, signal, executeTool, onContentDelta, onToolCall, maxHops = 4 }) {
  const appended = [];
  let working = messages;

  for (let hop = 0; hop < maxHops; hop++) {
    const result = await streamOneCompletion({ messages: working, context, specialty, coachingStyle, signal, onContentDelta });
    if (result.type === "message") {
      const finalMessage = { role: "assistant", content: result.content };
      appended.push(finalMessage);
      return { appended, finalContent: result.content };
    }

    appended.push(result.assistantMessage);
    working = [...working, result.assistantMessage];

    for (const tc of result.toolCalls) {
      let args = {};
      try {
        args = tc.arguments ? JSON.parse(tc.arguments) : {};
      } catch {
        args = {};
      }
      onToolCall?.({ name: tc.name, args });
      const toolResult = await executeTool(tc.name, args);
      const toolMessage = { role: "tool", tool_call_id: tc.id, name: tc.name, content: JSON.stringify(toolResult ?? {}) };
      appended.push(toolMessage);
      working = [...working, toolMessage];
    }
  }

  throw new Error("Coach needed too many steps to answer that — try rephrasing.");
}
