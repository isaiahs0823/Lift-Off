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

// The Responses API's role taxonomy replaced Chat Completions' "system" role with "developer"
// for instruction-priority input items — "system" was never guaranteed valid there. Sending it
// directly (as this file did before) is the leading suspect for a persistent 400
// invalid_request_error that the old error classification (which only mapped 400 to a specific
// message when it mentioned "model") would silently collapse into the fully generic "Coach
// couldn't respond right now." on every single request — exactly the reported symptom. This
// mapping is the fix; classifyOpenAIError below also now surfaces ANY 400 with a distinct,
// specific message instead of swallowing it, so if this hypothesis is wrong, the real cause is
// visible in the next log line instead of hidden again.
function toResponsesRole(role) {
  return role === "system" ? "developer" : role;
}

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
    input.push({ role: toResponsesRole(m.role), content: m.content ?? "" });
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
// Every status/code combination OpenAI can realistically return now maps to a distinct message
// (previously, any 400 that didn't happen to mention "model" fell all the way through to the
// fully generic message, indistinguishable from a network failure or an unclassified 5xx — this
// is exactly the kind of gap that turns a one-line log fix into a mystery).
export function classifyOpenAIError(status, errBody, model) {
  const err = errBody?.error || {};
  const code = err.code || null;
  const type = err.type || null;
  const message = err.message || null;
  let clientMessage;
  if (status === 401 || code === "invalid_api_key") clientMessage = "AI authentication failed.";
  else if (status === 404 || code === "model_not_found") clientMessage = "Configured AI model is unavailable.";
  else if (status === 400 && (code === "model_not_found" || /model/i.test(message || ""))) clientMessage = "Configured AI model is unavailable.";
  else if (status === 429) {
    clientMessage = type === "insufficient_quota" || code === "insufficient_quota" ? "AI billing/quota is unavailable." : "AI Coach is busy right now. Try again shortly.";
  } else if (status === 400) {
    // Any other 400 — malformed request shape, an invalid field value (e.g. a bad role), etc.
    // Distinct from the fully generic message specifically so this is never confused with an
    // unclassified upstream failure again.
    clientMessage = "BRK sent an invalid AI request.";
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

// ---------------- CONNECTION DIAGNOSTICS ----------------
// Two isolated probes, deliberately separate from the real chat pipeline and from each other —
// no BRK tools, no athlete context, no system/developer prompt, no `res` writing (self-contained,
// never touches the real chat UI's response stream). The point is to answer "which layer is
// actually broken" with evidence instead of guessing: probeNonStreaming rules provider/key/
// billing/model/request-format in or out on its own; only if that passes does probeStreaming test
// whether the SSE event translation itself is the problem. api/coach-chat.js's connectionTest
// mode runs them in that order and reports exactly which one failed.

// Pulls the plain text out of a non-streaming Responses API response body. The API's JSON
// includes a top-level `output_text` convenience field in current versions, but this also walks
// `output[]` directly (message items -> content[] -> output_text parts) so a probe never reports
// a false failure just because that convenience field is missing on some response.
function extractResponsesOutputText(json) {
  if (typeof json?.output_text === "string") return json.output_text;
  if (Array.isArray(json?.output)) {
    return json.output
      .filter((item) => item?.type === "message")
      .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
      .filter((part) => part?.type === "output_text" || part?.type === "text")
      .map((part) => part.text || "")
      .join("");
  }
  return "";
}

// Phase 4 of the incident spec — a minimal non-streaming request. If this fails, the problem is
// provider/key/billing/model/request-format, full stop; none of BRK's own streaming-translation
// or tool code is anywhere in the loop for this check.
export async function probeNonStreaming({ apiKey, model }) {
  const startedAt = Date.now();
  let upstream;
  try {
    upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: [{ role: "user", content: "Reply with exactly: BRK_AI_OK" }], stream: false, max_output_tokens: 20 }),
    });
  } catch (e) {
    return { ok: false, status: null, code: "network_error", type: "network_error", message: e?.message || String(e), model, clientMessage: "AI Coach couldn't respond right now.", elapsedMs: Date.now() - startedAt };
  }
  const elapsedMs = Date.now() - startedAt;
  if (!upstream.ok) {
    let errBody = null;
    try {
      errBody = await upstream.json();
    } catch {
      // not JSON — classifyOpenAIError handles a null body fine
    }
    return { ...classifyOpenAIError(upstream.status, errBody, model), elapsedMs };
  }
  let json = null;
  try {
    json = await upstream.json();
  } catch {
    return { ok: false, status: upstream.status, code: "bad_json", type: null, message: "Response body was not valid JSON.", model, clientMessage: "AI Coach couldn't respond right now.", elapsedMs };
  }
  return { ok: true, model, status: upstream.status, text: extractResponsesOutputText(json), elapsedMs };
}

// Phase 5 of the incident spec — streaming, still with no tools/context, isolating the SSE
// event-translation layer specifically now that probeNonStreaming has already confirmed the
// provider/key/model layer independently. Reuses the same event names streamChatCompletion
// handles below, so a translation bug shows up here identically to how it'd show up in real
// Coach chat — but without ever touching a real client-facing response.
export async function probeStreaming({ apiKey, model }) {
  const startedAt = Date.now();
  let upstream;
  try {
    upstream = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: [{ role: "user", content: "Reply with exactly: BRK_STREAM_OK" }], stream: true, max_output_tokens: 20 }),
    });
  } catch (e) {
    return { ok: false, status: null, code: "network_error", type: "network_error", message: e?.message || String(e), model, clientMessage: "AI Coach couldn't respond right now.", elapsedMs: Date.now() - startedAt };
  }
  if (!upstream.ok) {
    let errBody = null;
    try {
      errBody = await upstream.json();
    } catch {
      // not JSON
    }
    return { ...classifyOpenAIError(upstream.status, errBody, model), elapsedMs: Date.now() - startedAt };
  }
  if (!upstream.body) {
    return { ok: false, status: upstream.status, code: null, type: null, message: "Upstream returned no response body.", model, clientMessage: "AI Coach couldn't respond right now.", elapsedMs: Date.now() - startedAt };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let sawCompleted = false;
  let sawFailure = null;
  const unhandledEvents = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      if (!block.trim()) continue;
      const parsed = parseSSEBlock(block);
      if (!parsed) continue;
      const { event, data } = parsed;
      if (event === "response.output_text.delta") text += data.delta ?? "";
      else if (event === "response.completed") sawCompleted = true;
      else if (event === "response.failed" || event === "error") sawFailure = data.response?.error || data.error || { message: "Unknown streaming failure." };
      else if (!KNOWN_NOOP_EVENTS.has(event)) unhandledEvents.push(event || "(event with no type)");
    }
  }

  const elapsedMs = Date.now() - startedAt;
  if (sawFailure) {
    return { ok: false, status: null, code: sawFailure.code || null, type: sawFailure.type || null, message: sawFailure.message || null, model, clientMessage: "AI Coach couldn't respond right now.", elapsedMs };
  }
  return { ok: true, model, text, sawCompleted, unhandledEvents, elapsedMs };
}

// Fetches a streaming Responses API completion and writes it to `res` as Chat-Completions-delta
// SSE, exactly like api/coach-chat.js already wrote when piping Chat Completions directly.
// Returns { ok: true, streamedFailure? } once the response has been fully written and res.end()
// called, or { ok: false, ...classifyOpenAIError() } WITHOUT having touched `res` at all (so the
// caller can still send a normal JSON error response) when the request fails before streaming
// starts.
export async function streamChatCompletion({ apiKey, model, messages, tools, signal, requestId, diagnostic }, res, { onUnhandledEvent } = {}) {
  console.log("BRK Coach upstream request starting", { requestId, model, diagnostic: !!diagnostic, toolsEnabled: !!tools?.length, aborted: signal?.aborted === true });

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
      console.error("BRK Coach upstream fetch aborted", { requestId, model });
    }
    throw e;
  }

  console.log("BRK Coach upstream response received", { requestId, model, status: upstream.status, ok: upstream.ok });

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
