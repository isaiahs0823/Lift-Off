// ---------------- LLM PROVIDER (server side) ----------------
// The only file that knows what "OpenAI" means. api/coach-chat.js calls streamChatCompletion()
// with a provider-neutral shape (messages/tools/model/apiKey) and gets back a raw upstream
// SSE stream to pipe through — swapping providers later means rewriting this one function, not
// the endpoint, not coachChatService.js, not the chat UI (spec section 39).
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Returns the upstream fetch Response (already stream:true) so the caller pipes response.body
// straight through to its own client — this file does no SSE parsing itself, just the request.
export async function streamChatCompletion({ apiKey, model, messages, tools, signal }) {
  return fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      tools: tools && tools.length ? tools : undefined,
      tool_choice: tools && tools.length ? "auto" : undefined,
      stream: true,
      max_tokens: 700,
      temperature: 0.4,
    }),
    signal,
  });
}
