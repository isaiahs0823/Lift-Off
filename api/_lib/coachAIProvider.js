// ---------------- LLM PROVIDER (server side) ----------------
// The only file that knows which OpenAI API/wire-format BRK talks to. Uses the Responses API
// (OpenAI's current recommended interface) but re-emits its streaming events in the same
// Chat-Completions-delta shape the rest of BRK's pipeline already expects — api/coach-chat.js's
// pass-through and coachChatService.js's client-side parser (choices[0].delta.content /
// .tool_calls) never had to change. Swapping the wire protocol again later means rewriting only
// this file.
//
// KNOWN GAP: this translation was built from OpenAI's documented Responses API event shapes,
// not verified against a live call — this dev environment has no network path to
// api.openai.com. Every event type below that isn't explicitly recognized is reported via
// onUnhandledEvent (coach-chat.js logs it) rather than silently dropped, specifically so that if
// any field name has drifted from what's implemented here, that shows up as one obvious,
// specific line in Vercel logs instead of another silent "couldn't respond" dead end.
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

// BRK's internal message shape (role/content/tool_calls/tool_call_id/name — the Chat-Completions
// convention already used everywhere else in this codebase) converted into Responses API `input`
// items. A tool_calls-bearing assistant message becomes one function_call item per call; a
// role:"tool" result becomes a function_call_output item, correlated by call_id — exactly the
// pairing the client already builds and resends every hop (see coachConversations.js).
function toResponsesInput(messages) {
  const input = [];
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      if (m.content) input.push({ role: "assistant", content: m.content });
      for (const tc of m.tool_calls) {
        input.push({ type: "function_call", call_id: tc.id, name: tc.function?.name, arguments: tc.function?.arguments || "{}" });
      }
      continue;
    }
    if (m.role === "tool") {
      input.push({ type: "function_call_output", call_id: m.tool_call_id, output: m.content ?? "" });
      continue;
    }
    input.push({ role: m.role, content: m.content ?? "" });
  }
  return input;
}

// Chat-Completions tool shape ({type:"function", function:{name,description,parameters}}) ->
// Responses API's flatter shape ({type:"function", name, description, parameters}).
function toResponsesTools(tools) {
  return (tools || []).map((t) => ({ type: "function", name: t.function.name, description: t.function.description, parameters: t.function.parameters }));
}

// Turns an upstream HTTP/JSON error into (a) a safe, specific server log payload and (b) a
// client-safe message — never the raw provider message, which can echo request internals.
export function classifyOpenAIError(status, errBody, model) {
  const err = errBody?.error || {};
  const code = err.code || null;
  const type = err.type || null;
  const message = err.message || null;
  let clientMessage;
  if (status === 401) clientMessage = "AI Coach authentication failed.";
  else if (status === 404 || code === "model_not_found") clientMessage = "AI Coach model is unavailable.";
  else if (status === 400 && (code === "model_not_found" || /model/i.test(message || ""))) clientMessage = "AI Coach model is unavailable.";
  else if (status === 429) {
    clientMessage = type === "insufficient_quota" || code === "insufficient_quota" ? "AI Coach is temporarily unavailable — quota exceeded." : "AI Coach is busy right now. Try again shortly.";
  } else clientMessage = "AI Coach couldn't respond right now.";
  return { ok: false, status, code, type, message, model, clientMessage };
}

// One SSE "block" (text between blank lines) -> { event, data }. The Responses API sends both
// an explicit `event:` line and a `data:` line per chunk; data.type duplicates the event name in
// practice, so either is used as a fallback for the other.
function parseSSEBlock(block) {
  let event = null;
  const dataLines = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  let data;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return null;
  }
  return { event: event || data.type, data };
}

function sseLine(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// Event types that are expected/valid but carry nothing our delta-shaped pipe needs to forward
// (bookkeeping/lifecycle events, or "done" events whose data was already streamed via deltas).
const KNOWN_NOOP_EVENTS = new Set([
  "response.created",
  "response.in_progress",
  "response.output_item.done",
  "response.content_part.added",
  "response.content_part.done",
  "response.output_text.done",
  "response.function_call_arguments.done",
]);

// Fetches a streaming Responses API completion and writes it to `res` as Chat-Completions-delta
// SSE, exactly like api/coach-chat.js already wrote when piping Chat Completions directly.
// Returns { ok: true, streamedFailure? } once the response has been fully written and res.end()
// called, or { ok: false, ...classifyOpenAIError() } WITHOUT having touched `res` at all (so the
// caller can still send a normal JSON error response) when the request fails before streaming
// starts.
export async function streamChatCompletion({ apiKey, model, messages, tools, signal }, res, { onUnhandledEvent } = {}) {
  console.log("BRK Coach upstream request starting", { model, aborted: signal?.aborted === true });

  let upstream;
  try {
    upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: toResponsesInput(messages),
        tools: tools && tools.length ? toResponsesTools(tools) : undefined,
        tool_choice: tools && tools.length ? "auto" : undefined,
        stream: true,
        max_output_tokens: 700,
        temperature: 0.4,
      }),
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") {
      // signal.aborted is necessarily true by the time an AbortError is thrown — the useful
      // signal is whether it was ALREADY aborted before this function even started (a bug
      // aborting too early) vs. aborted during the fetch call itself (the 45s ceiling in
      // coach-chat.js, the only legitimate source now that req "close" no longer aborts).
      console.error("BRK Coach upstream fetch aborted", { model });
    }
    throw e;
  }

  console.log("BRK Coach upstream response received", { model, status: upstream.status, ok: upstream.ok });

  if (!upstream.ok) {
    let errBody = null;
    try {
      errBody = await upstream.json();
    } catch {
      // upstream error body wasn't JSON — classifyOpenAIError handles a null errBody fine
    }
    return classifyOpenAIError(upstream.status, errBody, model);
  }
  if (!upstream.body) {
    return { ok: false, status: upstream.status, code: null, type: null, message: "Upstream returned no response body.", model, clientMessage: "AI Coach couldn't respond right now." };
  }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const indexByItemId = new Map();
  let nextIndex = 0;
  let sawFunctionCall = false;
  let sawCompleted = false;
  let sawFailure = null;

  const handleEvent = (event, data) => {
    if (event === "response.output_text.delta") {
      res.write(sseLine({ choices: [{ delta: { content: data.delta ?? "" }, finish_reason: null }] }));
      return;
    }
    if (event === "response.output_item.added" && data.item?.type === "function_call") {
      const idx = nextIndex++;
      indexByItemId.set(data.item.id, idx);
      sawFunctionCall = true;
      res.write(
        sseLine({
          choices: [{ delta: { tool_calls: [{ index: idx, id: data.item.call_id, type: "function", function: { name: data.item.name || "", arguments: "" } }] }, finish_reason: null }],
        })
      );
      return;
    }
    if (event === "response.function_call_arguments.delta") {
      const idx = indexByItemId.get(data.item_id);
      if (idx == null) {
        onUnhandledEvent?.(`function_call_arguments.delta referenced an unknown item_id (${data.item_id})`);
        return;
      }
      res.write(sseLine({ choices: [{ delta: { tool_calls: [{ index: idx, function: { arguments: data.delta ?? "" } }] }, finish_reason: null }] }));
      return;
    }
    if (event === "response.completed") {
      sawCompleted = true;
      return;
    }
    if (event === "response.failed" || event === "error") {
      sawFailure = data.response?.error || data.error || { message: "Unknown streaming failure." };
      return;
    }
    if (!KNOWN_NOOP_EVENTS.has(event)) onUnhandledEvent?.(event || "(event with no type)");
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        if (!block.trim()) continue;
        const parsed = parseSSEBlock(block);
        if (parsed) handleEvent(parsed.event, parsed.data);
      }
    }
  } finally {
    if (!sawCompleted && !sawFailure) onUnhandledEvent?.("stream ended without a response.completed or response.failed event");
    res.write(sseLine({ choices: [{ delta: {}, finish_reason: sawFunctionCall ? "tool_calls" : "stop" }] }));
    res.write("data: [DONE]\n\n");
    res.end();
  }

  return { ok: true, model, streamedFailure: sawFailure };
}
