import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";
import { aiJson, consumeCap, normalizeMessages, requireUser, runChatChain, withForwardedAiKeys, type ChatMsg } from "./ai";

const router = Router();

// POST /api/llm/invoke - Invoke LLM with prompt
// PATCH (worker-ai-route): was a mock. Now runs the real chain (NVIDIA gpt-oss-20b +
// 2 backups -> hosted Ollama) behind Supabase auth + the daily chat cap shared with
// /api/ai/chat. Response shape kept: { text, model_used, usage } (+ `via`).
router.post("/invoke", async (request, env) => {
  const auth = await requireUser(request, env);
  if (!auth.ok) return aiJson(request, env, { error: auth.error }, auth.status);
  env = withForwardedAiKeys(request, env); // PATCH (api-key-wiring)

  let body: any;
  try {
    body = await request.json();
  } catch {
    return aiJson(request, env, { error: "Invalid request" }, 400);
  }
  const { prompt, systemPrompt, system, messages } = body || {};

  if (!prompt && !messages) {
    return aiJson(request, env, { error: "Missing prompt or messages" }, 400);
  }

  // Accept messages[], prompt as a messages array, or prompt as a string/object.
  let msgs: ChatMsg[] = normalizeMessages(messages);
  if (!msgs.length && Array.isArray(prompt)) msgs = normalizeMessages(prompt);
  if (!msgs.length && prompt) {
    const text = typeof prompt === "string" ? prompt : JSON.stringify(prompt);
    msgs = normalizeMessages([{ role: "user", content: text }]);
  }
  if (!msgs.length) return aiJson(request, env, { error: "Missing prompt or messages" }, 400);

  const cap = await consumeCap(env, auth.ownerId, "chat");
  if (!cap.ok) return aiJson(request, env, { error: `Daily AI chat limit reached (${cap.limit}/day)` }, 429);

  const res = await runChatChain(env, {
    system: typeof systemPrompt === "string" ? systemPrompt : typeof system === "string" ? system : undefined,
    messages: msgs,
    maxTokens: body.max_tokens ?? body.maxTokens,
  });
  if (!res.ok) return aiJson(request, env, { error: res.error }, 502);

  return aiJson(request, env, {
    text: res.text,
    model_used: res.model,
    via: res.via,
    usage: res.usage,
  });
});

// GET /api/llm/preference - Get user's preferred model
router.get("/preference", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  // In production, fetch from KV/DB
  return Response.json({
    preferred: "auto",
  }, { headers: corsHeaders() });
});

// POST /api/llm/preference - Set user's preferred model
router.post("/preference", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { model } = body;

  if (!model) {
    return Response.json({ error: "Missing model" }, { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  // In production, save to KV/DB
  return Response.json({ success: true, model }, { headers: corsHeaders() });
});

export { router as llmRoutes };
