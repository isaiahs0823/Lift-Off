// ---------------- BRK COACH CHAT — serverless proxy ----------------
// Holds the LLM API key server-side (never shipped to the client) and owns model selection,
// system instructions, and request validation — see spec section 3/4. BRK has no backend
// database, so this endpoint is stateless: it never touches "the athlete's data" itself. The
// client sends a compact context snapshot + tool schemas; if the model wants deeper data it
// requests a tool call, the client executes it locally (coachTools.js) and calls this endpoint
// again with the tool result appended. This endpoint's only job is talking to the model.
import { buildCoachSystemPrompt } from "./_lib/coachPrompt.js";
import { streamChatCompletion } from "./_lib/coachAIProvider.js";
import { COACH_TOOL_SCHEMAS } from "../src/utils/coachToolSchemas.js";

const MAX_MESSAGES = 60; // defense in depth — the client already trims before sending (see coachConversations.js)
const MAX_MESSAGE_CHARS = 6000; // a single message this long is almost certainly malformed/abusive, not a real chat turn
const MAX_CONTEXT_CHARS = 8000;
const VALID_ROLES = new Set(["system", "user", "assistant", "tool"]);
const VALID_STYLES = new Set(["supportive", "balanced", "direct", "hard"]);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Never pretend Coach worked — a clear, honest error the client renders as a real failure
    // state, not a silent no-op (spec section 4).
    res.status(503).json({ error: "AI Coach is not configured on the server yet." });
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
    const upstream = await streamChatCompletion({
      apiKey,
      model: process.env.COACH_MODEL || "gpt-4o-mini",
      messages: [...systemMessages, ...messages],
      tools: COACH_TOOL_SCHEMAS,
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const status = upstream.status === 429 ? 429 : 502;
      res.status(status).json({ error: status === 429 ? "AI Coach is rate-limited right now — try again shortly." : "AI Coach couldn't respond right now." });
      return;
    }

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (e) {
    clearTimeout(timeout);
    if (res.headersSent) {
      res.end();
      return;
    }
    const isAbort = e?.name === "AbortError";
    res.status(isAbort ? 504 : 502).json({ error: isAbort ? "AI Coach timed out." : "AI Coach couldn't respond right now." });
    return;
  }
  clearTimeout(timeout);
}
