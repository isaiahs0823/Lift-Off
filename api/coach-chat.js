// ---------------- BRK COACH CHAT — serverless proxy ----------------
// Holds the LLM API key server-side (never shipped to the client) and owns model selection,
// system instructions, and request validation. BRK has no backend database, so this endpoint is
// stateless: it never touches "the athlete's data" itself. The client sends a compact context
// snapshot + tool schemas; if the model wants deeper data it requests a tool call, the client
// executes it locally (coachTools.js) and calls this endpoint again with the tool result
// appended. This endpoint's only job is talking to the model and making failures diagnosable.
import { buildCoachSystemPrompt } from "./_lib/coachPrompt.js";
import { streamChatCompletion, probeNonStreaming, probeStreaming } from "./_lib/coachAIProvider.js";
import { COACH_TOOL_SCHEMAS } from "../src/utils/coachToolSchemas.js";

// One id per request, included in every log line AND in every error response sent to the
// client — a reported production failure ("Coach couldn't respond, error ID brkcoach_xyz") can
// be matched to the exact Vercel log line instead of guessing from a timestamp.
function newRequestId() {
  return `brkcoach_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_MESSAGES = 60; // defense in depth — the client already trims before sending (see coachConversations.js)
const MAX_MESSAGE_CHARS = 6000; // a single message this long is almost certainly malformed/abusive, not a real chat turn
const MAX_CONTEXT_CHARS = 8000;
const VALID_ROLES = new Set(["system", "user", "assistant", "tool"]);
const VALID_STYLES = new Set(["supportive", "balanced", "direct", "hard"]);
// Current, low-cost OpenAI model with tool-calling support. Override with COACH_MODEL — do not
// assume this name stays valid forever; if OpenAI ever retires/renames it, classifyOpenAIError()
// maps the resulting 404/model_not_found straight to a clear client message and a specific
// server log line naming the exact model that failed, rather than a guess.
const DEFAULT_MODEL = "gpt-4o-mini";

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return "messages must be a non-empty array.";
  if (messages.length > MAX_MESSAGES) return `Too many messages (max ${MAX_MESSAGES}).`;
  for (const m of messages) {
    if (!m || typeof m !== "object") return "Each message must be an object.";
    if (!VALID_ROLES.has(m.role)) return `Invalid message role: ${m.role}`;
    if (m.content != null && typeof m.content !== "string") return "Message content must be a string.";
    if (typeof m.content === "string" && m.content.length > MAX_MESSAGE_CHARS) return `A message exceeds the ${MAX_MESSAGE_CHARS}-character limit.`;
  }
  return null;
}

// Section 6 — a malformed tool schema must never silently surface as the generic "couldn't
// respond" message. Validated once per request (cheap — the schema list is small and static)
// so a bad edit to coachToolSchemas.js is caught here, in a clearly-labeled log line naming the
// exact tool, rather than showing up as an opaque upstream 400.
export function validateToolSchemas(tools) {
  const problems = [];
  const seenNames = new Set();
  for (const t of tools) {
    const name = t?.function?.name;
    if (typeof name !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
      problems.push(`Tool has an invalid or missing name: ${JSON.stringify(name)}`);
      continue;
    }
    if (seenNames.has(name)) problems.push(`Duplicate tool name: ${name}`);
    seenNames.add(name);
    if (typeof t.function.description !== "string" || !t.function.description) problems.push(`Tool "${name}" is missing a description.`);
    const params = t.function.parameters;
    if (!params || params.type !== "object" || typeof params.properties !== "object" || params.properties === null) {
      problems.push(`Tool "${name}" has invalid parameters (must be a JSON Schema object with a properties map).`);
    }
  }
  return problems;
}

// Safe server-side log — every field here is either a status code, a provider-defined
// enum/code, the configured model name, or this request's own id. NEVER logs: the API key, the
// Authorization header, athlete context, or conversation content.
function logOpenAIError(requestId, details) {
  console.error("BRK Coach OpenAI error", {
    requestId,
    status: details.status ?? null,
    type: details.type ?? null,
    code: details.code ?? null,
    model: details.model ?? null,
    message: details.message ?? null,
    elapsedMs: details.elapsedMs ?? null,
  });
}

function mapUpstreamStatusForClient(status) {
  if (status === 429) return 429;
  return 502; // never mirror an upstream 401/404/etc. onto BRK's own response status — those are OpenAI's auth/routing, not a fact about this request
}

export default async function handler(req, res) {
  const requestId = newRequestId();

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", requestId });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.COACH_MODEL || DEFAULT_MODEL;
  // Section 3 — confirms configuration state on every request without ever printing the key
  // itself. Cheap enough to always log; the moment production starts failing, this line alone
  // tells you whether it's even worth looking further.
  console.log("BRK Coach config check", { requestId, OPENAI_API_KEY_configured: !!apiKey, COACH_MODEL: model });

  if (!apiKey) {
    res.status(503).json({ error: "AI Coach is not configured yet.", requestId });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Malformed request body.", requestId });
    return;
  }
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Malformed request body.", requestId });
    return;
  }

  // ---- AI CONNECTION TEST ----
  // A self-contained layered probe, exposed via Coach Settings' "Test Connection" button —
  // tests the SAME deployed backend and OPENAI_API_KEY the real chat pipeline uses, but through
  // neither the streaming-SSE-to-client path nor any BRK tool/context code. Non-streaming first
  // (rules provider/key/billing/model/request-format in or out on its own); only if that passes
  // does it test streaming (isolates the SSE event-translation layer specifically). Returns one
  // plain JSON result naming exactly which layer failed, if either did.
  if (body.connectionTest === true) {
    console.log("BRK Coach connection test starting", { requestId, model });
    const nonStream = await probeNonStreaming({ apiKey, model });
    if (!nonStream.ok) {
      console.error("BRK Coach connection test FAILED at the provider layer (non-streaming)", {
        requestId,
        model,
        status: nonStream.status,
        type: nonStream.type,
        code: nonStream.code,
        message: nonStream.message,
        elapsedMs: nonStream.elapsedMs,
      });
      res.status(200).json({ ok: false, layer: "provider", reason: nonStream.clientMessage, model, requestId });
      return;
    }
    console.log("BRK Coach connection test: provider layer OK", { requestId, model, elapsedMs: nonStream.elapsedMs, textMatched: (nonStream.text || "").includes("BRK_AI_OK") });

    const streaming = await probeStreaming({ apiKey, model });
    if (!streaming.ok) {
      console.error("BRK Coach connection test FAILED at the streaming layer", {
        requestId,
        model,
        status: streaming.status,
        type: streaming.type,
        code: streaming.code,
        message: streaming.message,
        elapsedMs: streaming.elapsedMs,
      });
      res.status(200).json({ ok: false, layer: "streaming", reason: "Streaming failed", model, requestId });
      return;
    }
    console.log("BRK Coach connection test PASSED", { requestId, model, elapsedMs: streaming.elapsedMs, unhandledEvents: streaming.unhandledEvents, textMatched: (streaming.text || "").includes("BRK_STREAM_OK") });
    res.status(200).json({ ok: true, model, requestId });
    return;
  }

  const { messages, context, specialty, coachingStyle, diagnostic } = body;
  const messageError = validateMessages(messages);
  if (messageError) {
    res.status(400).json({ error: messageError, requestId });
    return;
  }

  // Diagnostic mode — a plain request with `{ diagnostic: true, messages: [...] }` skips BRK
  // tools, athlete context, and the identity system prompt entirely, so a bare curl against the
  // production endpoint (e.g. "Say hello.") can confirm the API key/model/provider are working
  // in isolation, without the tool-schema or context pipeline able to hide or cause the failure.
  const isDiagnostic = diagnostic === true;

  let toolsToSend;
  let systemMessages;
  if (isDiagnostic) {
    console.log("BRK Coach diagnostic request (no tools, no context, no history)", { requestId, model });
    toolsToSend = undefined;
    systemMessages = [];
  } else {
    const toolProblems = validateToolSchemas(COACH_TOOL_SCHEMAS);
    if (toolProblems.length > 0) {
      console.error("BRK Coach tool schema validation failed", { requestId, toolProblems });
      res.status(500).json({ error: "AI Coach couldn't respond right now.", requestId });
      return;
    }
    toolsToSend = COACH_TOOL_SCHEMAS;

    const style = VALID_STYLES.has(coachingStyle) ? coachingStyle : "balanced";
    const specialtyId = typeof specialty === "string" && specialty ? specialty : "bodybuilding";

    let contextJson = "";
    try {
      contextJson = JSON.stringify(context || {});
    } catch {
      contextJson = "{}";
    }
    if (contextJson.length > MAX_CONTEXT_CHARS) contextJson = contextJson.slice(0, MAX_CONTEXT_CHARS) + "…(truncated)";

    systemMessages = [
      { role: "system", content: buildCoachSystemPrompt({ specialty: specialtyId, coachingStyle: style }) },
      { role: "system", content: `Current athlete context (compact — call a tool for anything more specific than this):\n${contextJson}` },
    ];
  }

  // Only the 45s ceiling aborts the upstream request now. This previously also aborted on the
  // request's "close" event to catch a genuine client disconnect, but in the Vercel/Node runtime
  // IncomingMessage can emit "close" once the request has simply finished being received — not
  // only on a real disconnect — which was killing the OpenAI fetch immediately after the POST
  // body finished arriving, before any response could stream back. Until a signal that reliably
  // tells "client actually disconnected" apart from "request finished normally" is confirmed for
  // this runtime, rely on the timeout alone rather than guess wrong again.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  const requestStartedAt = Date.now();

  try {
    const result = await streamChatCompletion(
      { apiKey, model, messages: [...systemMessages, ...messages], tools: toolsToSend, signal: controller.signal, requestId, diagnostic: isDiagnostic },
      res,
      { onUnhandledEvent: (event) => console.warn("BRK Coach: unrecognized Responses API stream event", { requestId, event, model }) }
    );
    clearTimeout(timeout);

    if (!result.ok) {
      logOpenAIError(requestId, result);
      if (!res.headersSent) {
        res.status(mapUpstreamStatusForClient(result.status)).json({ error: result.clientMessage, requestId });
      }
      return;
    }
    if (result.streamedFailure) {
      // Streaming had already started (200 sent) when this happened, so the client already
      // received a real HTTP response — this log is the only way the actual cause is visible.
      logOpenAIError(requestId, { status: null, type: result.streamedFailure.type, code: result.streamedFailure.code, message: result.streamedFailure.message, model });
    }
  } catch (e) {
    clearTimeout(timeout);
    const isAbort = e?.name === "AbortError";
    if (isAbort) {
      const elapsedMs = Date.now() - requestStartedAt;
      // The only thing that can abort the request now is the 45s timeout, so timedOut should
      // always be true here. If it's ever false, something other than the timeout is calling
      // controller.abort() and that needs investigating — this line is what would catch it.
      console.error("BRK Coach upstream aborted", { requestId, model, elapsedMs, timedOut: elapsedMs >= 44000, headersSentBeforeAbort: res.headersSent });
    }
    if (res.headersSent) {
      res.end();
      return;
    }
    console.error("BRK Coach request failed", { requestId, error: e?.message || String(e), model, aborted: isAbort });
    res.status(isAbort ? 504 : 502).json({ error: isAbort ? "AI Coach timed out." : "AI Coach couldn't respond right now.", requestId });
  }
}
