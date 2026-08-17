// ---------------- BRK COACH CHAT — serverless proxy ----------------
// Holds the LLM API key server-side (never shipped to the client) and owns model selection,
// system instructions, and request validation. BRK has no backend database, so this endpoint is
// stateless: it never touches "the athlete's data" itself. The client sends a compact context
// snapshot + tool schemas; if the model wants deeper data it requests a tool call, the client
// executes it locally (coachTools.js) and calls this endpoint again with the tool result
// appended. This endpoint's only job is talking to the model and making failures diagnosable.
import { buildCoachSystemPrompt } from "./_lib/coachPrompt.js";
import { streamChatCompletion } from "./_lib/coachAIProvider.js";
import { COACH_TOOL_SCHEMAS } from "../src/utils/coachToolSchemas.js";

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
// enum/code, or the configured model name. NEVER logs: the API key, the Authorization header,
// athlete context, or conversation content.
function logOpenAIError(details) {
  console.error("BRK Coach OpenAI error", {
    status: details.status ?? null,
    type: details.type ?? null,
    code: details.code ?? null,
    model: details.model ?? null,
    message: details.message ?? null,
  });
}

function mapUpstreamStatusForClient(status) {
  if (status === 429) return 429;
  return 502; // never mirror an upstream 401/404/etc. onto BRK's own response status — those are OpenAI's auth/routing, not a fact about this request
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.COACH_MODEL || DEFAULT_MODEL;
  // Section 3 — confirms configuration state on every request without ever printing the key
  // itself. Cheap enough to always log; the moment production starts failing, this line alone
  // tells you whether it's even worth looking further.
  console.log("BRK Coach config check", { OPENAI_API_KEY_configured: !!apiKey, COACH_MODEL: model });

  if (!apiKey) {
    res.status(503).json({ error: "AI Coach is not configured yet." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Malformed request body." });
    return;
  }
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Malformed request body." });
    return;
  }

  const { messages, context, specialty, coachingStyle } = body;
  const messageError = validateMessages(messages);
  if (messageError) {
    res.status(400).json({ error: messageError });
    return;
  }

  const toolProblems = validateToolSchemas(COACH_TOOL_SCHEMAS);
  if (toolProblems.length > 0) {
    console.error("BRK Coach tool schema validation failed", toolProblems);
    res.status(500).json({ error: "AI Coach couldn't respond right now." });
    return;
  }

  const style = VALID_STYLES.has(coachingStyle) ? coachingStyle : "balanced";
  const specialtyId = typeof specialty === "string" && specialty ? specialty : "bodybuilding";

  let contextJson = "";
  try {
    contextJson = JSON.stringify(context || {});
  } catch {
    contextJson = "{}";
  }
  if (contextJson.length > MAX_CONTEXT_CHARS) contextJson = contextJson.slice(0, MAX_CONTEXT_CHARS) + "…(truncated)";

  const systemMessages = [
    { role: "system", content: buildCoachSystemPrompt({ specialty: specialtyId, coachingStyle: style }) },
    { role: "system", content: `Current athlete context (compact — call a tool for anything more specific than this):\n${contextJson}` },
  ];

  const controller = new AbortController();
  req.on?.("close", () => controller.abort());
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const result = await streamChatCompletion(
      { apiKey, model, messages: [...systemMessages, ...messages], tools: COACH_TOOL_SCHEMAS, signal: controller.signal },
      res,
      { onUnhandledEvent: (event) => console.warn("BRK Coach: unrecognized Responses API stream event", { event, model }) }
    );
    clearTimeout(timeout);

    if (!result.ok) {
      logOpenAIError(result);
      if (!res.headersSent) {
        res.status(mapUpstreamStatusForClient(result.status)).json({ error: result.clientMessage });
      }
      return;
    }
    if (result.streamedFailure) {
      // Streaming had already started (200 sent) when this happened, so the client already
      // received a real HTTP response — this log is the only way the actual cause is visible.
      logOpenAIError({ status: null, type: result.streamedFailure.type, code: result.streamedFailure.code, message: result.streamedFailure.message, model });
    }
  } catch (e) {
    clearTimeout(timeout);
    if (res.headersSent) {
      res.end();
      return;
    }
    const isAbort = e?.name === "AbortError";
    console.error("BRK Coach request failed", { error: e?.message || String(e), model, aborted: isAbort });
    res.status(isAbort ? 504 : 502).json({ error: isAbort ? "AI Coach timed out." : "AI Coach couldn't respond right now." });
  }
}
