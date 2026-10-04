// src/pages/dashboard/_lib/homeAi.ts
// PATCH (home-page2, api-key-wiring): one LLM call path for the home AI modules
// (AI Money Tips, Life Hacks, AI Insights).
//
// Chris's AI stack only, no paid cloud AI. (api-key-wiring removed the direct browser calls
// that used the saved openai / groq / openrouter / google-ai-gemini / deepseek keys.)
//   1. The Erebus stack (stackChat): Erebus backend -> local Ollama -> NVIDIA
//      (dev: Vite /nvidia-llm proxy, key server-side; production: worker /api/ai/chat,
//      which runs NVIDIA -> hosted Ollama with server-side keys).
//   2. Dev server only: worker /api/llm/invoke (same NVIDIA -> hosted Ollama chain) as a last
//      resort; production already reached the worker in step 1. Skipped for sessions that
//      are not the LifeOS owner (the worker would answer 403).
// The saved "nvidia-nim" / "ollama-local" keys are forwarded to the worker by
// src/lib/serviceKeyHeaders.ts only when the worker has no secret for them.
import { lifeosApi } from "@/lib/api";
import { getOwnerId } from "@/lib/owner";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { stackChat } from "@/lib/agents/erebus/dock/erebusStack";

/** Saved keys (public.keys.service) the home AI modules can use, through the worker. */
export const LLM_KEY_SERVICES = ["nvidia-nim", "ollama-local"];
const OWNER_UID = "0355fae3-863b-432c-bac8-968942681e1b";
const IS_DEV = !!(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;

export interface HomeLlmResult {
  items: string[];
  via: string;
}

/** Pulls a JSON string array out of an LLM reply (tolerates code fences / prose / lists). */
export function parseList(text: string, count: number): string[] | null {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  const m = cleaned.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) {
        const out = arr.map((x) => (typeof x === "string" ? x : typeof x === "object" && x ? String(Object.values(x)[0] ?? "") : String(x))).map((s) => s.trim()).filter(Boolean);
        if (out.length) return out.slice(0, count);
      }
    } catch {
      /* fall through */
    }
  }
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*\u2022\u00b7\u2013]|\d+[.)])\s*/, "").replace(/^"|"$/g, "").trim())
    .filter((l) => l.length > 12 && !/^(here|sure)/i.test(l));
  return lines.length >= Math.min(2, count) ? lines.slice(0, count) : null;
}

async function viaWorker(prompt: string): Promise<string | null> {
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  const uid = data.session?.user?.id;
  const owner = await getOwnerId();
  if (!uid || owner !== OWNER_UID) return null; // worker would answer 403
  const res = await lifeosApi.post<{ text?: string }>("/api/llm/invoke", { prompt, max_tokens: 400 });
  return res?.text || null;
}

/** Asks for `count` short items; returns them with the backend that answered. */
export async function homeLlmList(prompt: string, count: number): Promise<HomeLlmResult> {
  const errors: string[] = [];
  const full = `${prompt}\nReturn ONLY a JSON array of ${count} strings, no markdown, no numbering.`;

  const res = await stackChat("You are a concise assistant. Follow the output format exactly.", [{ role: "user", content: full }], {
    maxTokens: 700,
  });
  if (res.ok) {
    const items = parseList(res.text, count);
    if (items) return { items, via: res.via };
    errors.push(`${res.via}: unparseable reply`);
  } else {
    errors.push(res.error);
  }

  if (IS_DEV) {
    try {
      const t = await viaWorker(full);
      const items = t ? parseList(t, count) : null;
      if (items) return { items, via: "LifeOS worker" };
      if (t) errors.push("worker: unparseable reply");
    } catch (e) {
      errors.push(`worker: ${(e as Error).message}`);
    }
  }

  throw new Error(errors.join(" \u00b7 "));
}