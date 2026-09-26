// ---------------- LLM PROVIDER (server side) ----------------
// The only file that knows which LLM provider BRK talks to. Runs on Groq
// (https://groq.com) rather than a paid provider — Groq's free tier is generous enough for a
// coaching chat feature at BRK's current scale, and its API is intentionally
// OpenAI-Chat-Completions-compatible (same request shape, same `choices[0].delta.content` /
// `.tool_calls` streaming shape), so this file can talk to it almost natively rather than
// translating between two different wire formats. api/coach-chat.js's pass-through and
// coachChatService.js's client-side parser (choices[0].delta.content / .tool_calls) needed zero
// changes when this swapped from OpenAI's Responses API to Groq — that's the whole reason a
// Chat-Completions-shaped provider was chosen over another Responses-API-only one.
//
// Swapping providers again later means rewriting only this file, IF the next provider also
// speaks Chat Completions (Groq, OpenRouter, Together, Fireworks, self-hosted vLLM/Ollama all
// do) — point GROQ_BASE_URL/model at it and this file barely changes. A provider with a
// genuinely different wire format (OpenAI's own Responses API, Google's native Gemini API)
// would need a translation layer here again, the way this file used to have one.
//
// KNOWN GAP: this was built from Groq's documented OpenAI-compatibility docs, not verified
// against a live call — this dev environment has no network path to api.groq.com. Every
// unrecognized error shape is classified as generically as possible (classifyProviderError)
// rather than assumed, and any request that fails before streaming starts returns full
// status/body details in server logs (never to the client) so a real mismatch is diagnosable
// from Vercel logs on the first real failure instead of being another silent dead end.
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

// Turns an upstream HTTP/JSON error into (a) a safe, specific server log payload and (b) a
// client-safe message — never the raw provider message, which can echo request internals.
// Groq's error body follows the same {error:{message,type,code}} shape OpenAI-compatible APIs
// use, so this stays close to the classification that file used, generalized to not assume any
// one provider's exact code strings where those could plausibly differ.
export function classifyProviderError(status, errBody, model) {
  const err = errBody?.error || {};
  const code = err.code || null;
  const type = err.type || null;
  const message = err.message || null;
  let clientMessage;
  if (status === 401 || code === "invalid_api_key") clientMessage = "AI authentication failed.";
  else if (status === 404 || code === "model_not_found" || /model/i.test(message || "")) clientMessage = "Configured AI model is unavailable.";
  else if (status === 429) {
    clientMessage = type === "insufficient_quota" || code === "insufficient_quota" ? "AI usage limit reached for now." : "AI Coach is busy right now. Try again shortly.";
  } else if (status === 400) {
    // Any other 400 — malformed request shape, an invalid field value (e.g. a bad role), etc.
    // Distinct from the fully generic message specifically so this is never confused with an
    // unclassified upstream failure again (the exact bug this classification originally fixed).
    clientMessage = "BRK sent an invalid AI request.";
  } else clientMessage = "AI Coach couldn't respond right now.";
  return { ok: false, status, code, type, message, model, clientMessage };
}

// ---------------- CONNECTION DIAGNOSTICS ----------------
// Two isolated probes, deliberately separate from the real chat pipeline and from each other —
// no BRK tools, no athlete context, no system prompt, no `res` writing (self-contained, never
// touches the real chat UI's response stream). The point is to answer "which layer is actually
// broken" with evidence instead of guessing: probeNonStreaming rules provider/key/billing/
// model/request-format in or out on its own; only if that passes does probeStreaming test
// whether the streaming path itself is the problem. api/coach-chat.js's connectionTest mode
// runs them in that order and reports exactly which one failed.

export async function probeNonStreaming({ apiKey, model }) {
  const startedAt = Date.now();
  let upstream;
  try {
    upstream = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly: BRK_AI_OK" }], stream: false, max_tokens: 20 }),
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
      // not JSON — classifyProviderError handles a null body fine
    }
    return { ...classifyProviderError(upstream.status, errBody, model), elapsedMs };
  }
  let json = null;
  try {
    json = await upstream.json();
  } catch {
    return { ok: false, status: upstream.status, code: "bad_json", type: null, message: "Response body was not valid JSON.", model, clientMessage: "AI Coach couldn't respond right now.", elapsedMs };
  }
  return { ok: true, model, status: upstream.status, text: json?.choices?.[0]?.message?.content || "", elapsedMs };
}

export async function probeStreaming({ apiKey, model }) {
  const startedAt = Date.now();
  let upstream;
  try {
    upstream = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly: BRK_STREAM_OK" }], stream: true, max_tokens: 20 }),
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
    return { ...classifyProviderError(upstream.status, errBody, model), elapsedMs: Date.now() - startedAt };
  }
  if (!upstream.body) {
    return { ok: false, status: upstream.status, code: null, type: null, message: "Upstream returned no response body.", model, clientMessage: "AI Coach couldn't respond right now.", elapsedMs: Date.now() - startedAt };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let sawDone = false;
  const unhandledLines = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (!line.startsWith("data:")) {
        unhandledLines.push(line);
        continue;
      }
      const dataStr = line.slice(5).trim();
      if (dataStr === "[DONE]") {
        sawDone = true;
        continue;
      }
      let json;
      try {
        json = JSON.parse(dataStr);
      } catch {
        continue;
      }
      text += json?.choices?.[0]?.delta?.content ?? "";
    }
  }

  const elapsedMs = Date.now() - startedAt;
  return { ok: true, model, text, sawDone, unhandledLines, elapsedMs };
}

// Fetches a streaming Chat Completions response and pipes it to `res` as SSE. Groq's stream
// already arrives in the exact `choices[0].delta.content` / `.tool_calls` / `finish_reason`
// shape coachChatService.js parses client-side, so each frame is forwarded essentially
// unchanged rather than translated — there is no separate event-type/role vocabulary to map the
// way the old OpenAI-Responses-API version of this file needed.
// Returns { ok: true } once the response has been fully written and res.end() called, or
// { ok: false, ...classifyProviderError() } WITHOUT having touched `res` at all (so the caller
// can still send a normal JSON error response) when the request fails before streaming starts.
export async function streamChatCompletion({ apiKey, model, messages, tools, signal, requestId }, res, { onUnhandledEvent } = {}) {
  console.log("BRK Coach upstream request starting", { requestId, model, toolsEnabled: !!tools?.length, aborted: signal?.aborted === true });

  let upstream;
  try {
    upstream = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        tools: tools && tools.length ? tools : undefined,
        tool_choice: tools && tools.length ? "auto" : undefined,
        stream: true,
        max_tokens: 700,
        temperature: 0.8,
      }),
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") {
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
      // upstream error body wasn't JSON — classifyProviderError handles a null errBody fine
    }
    return classifyProviderError(upstream.status, errBody, model);
  }
  if (!upstream.body) {
    return { ok: false, status: upstream.status, code: null, type: null, message: "Upstream returned no response body.", model, clientMessage: "AI Coach couldn't respond right now." };
  }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  let sawFinishReason = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (!line.startsWith("data:")) {
          onUnhandledEvent?.(`non-SSE line from upstream: ${line.slice(0, 120)}`);
          continue;
        }
        const dataStr = line.slice(5).trim();
        if (dataStr === "[DONE]") {
          sawDone = true;
          continue;
        }
        // Pass the frame through unchanged — already the exact shape the client expects.
        res.write(`data: ${dataStr}\n\n`);
        try {
          const parsed = JSON.parse(dataStr);
          const fr = parsed?.choices?.[0]?.finish_reason;
          if (fr) sawFinishReason = fr;
        } catch {
          // best-effort only — forwarding above already happened regardless
        }
      }
    }
  } finally {
    if (!sawDone) onUnhandledEvent?.("stream ended without a [DONE] sentinel");
    res.write("data: [DONE]\n\n");
    res.end();
  }

  return { ok: true, model, streamedFailure: null, finishReason: sawFinishReason };
}
