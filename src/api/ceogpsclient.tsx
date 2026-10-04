// src/api/ceogpsclient.tsx
// CEO GPS AI Client - Multi-model router with auth

import { supabase } from "../lib/supabaseClient";

const WORKER_URL =
  (import.meta as ImportMeta & { env?: { VITE_WORKER_URL?: string } }).env
    ?.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";

const SYSTEM =
  "You are AgentZero, the AI core of LifeOS1. Be direct, strategic, actionable.";

const MODEL_PREF_KEY = "lifeos1_preferred_model";

// ── Resolve current Supabase user id ─────────────────────────────────────────
async function currentUserId(userId?: string) {
  if (userId) return userId;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ── Model preference ─────────────────────────────────────────────────────────
export function getPreferredModel() {
  try {
    return localStorage.getItem(MODEL_PREF_KEY) || "auto";
  } catch {
    return "auto";
  }
}

export function setPreferredModel(model: string, userId?: string) {
  const next = (model || "auto").toLowerCase();
  try {
    localStorage.setItem(MODEL_PREF_KEY, next);
  } catch {}
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId) headers["X-User-Id"] = userId;
  try {
    fetch(`${WORKER_URL}/api/llm/preference`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: next }),
    }).catch(() => {});
  } catch {}
}

export async function refreshPreferredModelFromServer(userId?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userId) headers["X-User-Id"] = userId;
  try {
    const r = await fetch(`${WORKER_URL}/api/llm/preference`, { headers });
    if (!r.ok) return;
    const { preferred } = await r.json();
    if (preferred) {
      try {
        localStorage.setItem(MODEL_PREF_KEY, preferred);
      } catch {}
    }
  } catch {}
}

export const MODEL_OPTIONS = [
  { id: "auto", label: "Auto", icon: "✦", desc: "Smart fallback" },
  { id: "claude", label: "Claude", icon: "🤍", desc: "Sonnet 4" },
  { id: "gpt", label: "GPT-4o", icon: "🔷", desc: "OpenAI" },
  { id: "gemini", label: "Gemini", icon: "💎", desc: "Free tier" },
  { id: "deepseek", label: "DeepSeek", icon: "🌊", desc: "R1 · cheap" },
  { id: "copilot", label: "CoPilot", icon: "🪟", desc: "Microsoft" },
  { id: "grok", label: "Grok", icon: "✦", desc: "xAI" },
];

// ── Get API key for provider ─────────────────────────────────────────────────
async function getApiKey(provider: string, userId?: string, fallback = "") {
  const uid = await currentUserId(userId);
  if (!uid) return fallback;
  try {
    const { data } = await supabase
      .from("user_settings")
      .select("key_value")
      .eq("user_id", uid)
      .eq("key_name", `api_${provider.toLowerCase()}`)
      .maybeSingle();
    return data?.key_value || fallback;
  } catch {
    return fallback;
  }
}

// ── Invoke LLM via Worker ────────────────────────────────────────────────────
let _lastModelUsed: string | null = null;

export async function invokeLLMWithAuth({
  prompt,
  systemPrompt,
  model = "",
  accessToken,
}: {
  prompt: string | any[];
  systemPrompt?: string;
  model?: string;
  accessToken: string;
}) {
  if (!accessToken) {
    console.error("[LLM] No Supabase access token provided");
    return "[Authentication required. Please log in again.]";
  }
  const sys = systemPrompt || SYSTEM;
  const preferred = model || getPreferredModel();
  const messagesArg = Array.isArray(prompt) ? prompt : null;
  try {
    const response = await fetch(`${WORKER_URL}/api/llm/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(
        messagesArg
          ? { messages: messagesArg, system: sys, model: preferred }
          : { prompt, system: sys, model: preferred },
      ),
    });
    if (response.status === 401) {
      return "[Session expired. Please refresh and log in again.]";
    }
    const data = await response.json().catch(() => ({}));
    _lastModelUsed = data.model_used || null;
    if (data.text) return data.text;
    return data.text || "[AI temporarily unavailable. Check Integrations panel.]";
  } catch (error: any) {
    console.error("[LLM] Worker unreachable:", error.message);
    return "[AI router unreachable — Worker may be down.]";
  }
}

export function getLastModelUsed() {
  return _lastModelUsed;
}

export { invokeLLMWithAuth as invokeLLM };