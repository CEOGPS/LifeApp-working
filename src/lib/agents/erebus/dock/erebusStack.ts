// src/lib/agents/erebus/dock/erebusStack.ts
// Chris's AI stack only (no paid cloud AI):
//   chat/writer : Erebus backend (/chat, when it has a real model) -> Ollama -> NVIDIA
//   image       : NVIDIA genai (FLUX.1-dev, then FLUX.1-schnell)
//   sound       : Kokoro TTS (localhost:8880)
//   video       : no backend in the stack yet -> reported as unavailable
// NVIDIA calls:
//   dev  : Vite dev proxy (/nvidia-llm, /nvidia-genai) injects the key server-side (vite.config.ts)
//   prod : Cloudflare Worker /api/ai/chat + /api/ai/image (PATCH worker-ai-route), which needs
//          the user's Supabase access token; the worker falls back to hosted Ollama for chat.
// Local Erebus backend / Ollama are still tried first whenever they are reachable.
// Nothing here fakes a result: every function returns ok:false with the reasons when nothing answered.
import { KOKORO_URL } from "../hooks/useErebusVoice";
import { getAccessToken as getSharedAccessToken } from "@/lib/accessToken";
import { serviceKeyHeaders } from "@/lib/serviceKeyHeaders"; // PATCH (api-key-wiring)

const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const IS_DEV = !!(import.meta as any).env?.DEV;
const WORKER = (env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev").replace(/\/+$/, "");
const WORKER_AI = `${WORKER}/api/ai`;
// PATCH (worker-ai-route): prod used to point at the worker, which has no /chat, so the
// backend step could never answer there. Local Erebus is now probed in prod too.
export const EREBUS_BACKEND = env.VITE_EREBUS_BACKEND_URL ?? "http://localhost:8000";
export const OLLAMA_URL = env.VITE_EREBUS_OLLAMA_URL ?? "http://localhost:11434";
// Models verified on Chris's NVIDIA account 2026-09-29 (llama-3.3-70b is end-of-life,
// many others 404 for this account). Tried in order; override with VITE_NVIDIA_CHAT_MODEL.
// (The worker keeps the same list for production.)
const NVIDIA_CHAT_MODELS = [
  ...(env.VITE_NVIDIA_CHAT_MODEL ? [env.VITE_NVIDIA_CHAT_MODEL] : []),
  "openai/gpt-oss-20b",
  "deepseek-ai/deepseek-v4.1-flash",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
];

export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };
export type StackOk = { ok: true; text: string; via: string };
export type StackFail = { ok: false; error: string };
export type StackResult = StackOk | StackFail;

export interface StackStatus {
  backend: "real" | "pattern" | "offline";
  backendModel?: string;
  ollama: boolean;
  ollamaModel?: string;
  /** NVIDIA reachable: dev proxy in dev, the worker's /api/ai (signed in) in production. */
  nvidia: boolean;
  kokoro: boolean;
  checkedAt: number;
}

function timeout(ms: number): AbortSignal {
  const A = AbortSignal as any;
  if (A && typeof A.timeout === "function") return A.timeout(ms);
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

async function jsonOrNull(r: Response): Promise<any | null> {
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("json")) return null; // e.g. SPA index.html when the proxy is absent
  return r.json().catch(() => null);
}

/** Current Supabase access token (same session the rest of the app uses), or null. */
// PATCH (worker-ai-route r2): shared helper on the SupabaseAuthContext client (anonymous session included)
async function getAccessToken(): Promise<string | null> {
  return getSharedAccessToken();
}

/** POST to the worker's /api/ai/* with the user's Supabase token. */
async function workerAi(path: "/chat" | "/image", body: unknown, ms: number): Promise<{ status: number; data: any | null }> {
  const token = await getAccessToken();
  if (!token) return { status: 401, data: { ok: false, error: "sign in to use cloud AI" } };
  const r = await fetch(`${WORKER_AI}${path}`, {
    method: "POST",
    // PATCH (api-key-wiring): + saved nvidia-nim / ollama-local keys, only when the worker has no secret for them
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}`, ...(await serviceKeyHeaders(`/api/ai${path}`)) },
    body: JSON.stringify(body),
    signal: timeout(ms),
  });
  return { status: r.status, data: await jsonOrNull(r) };
}

async function probeCloud(): Promise<boolean> {
  if (IS_DEV) {
    return fetch(`/nvidia-llm/v1/models`, { signal: timeout(4000) })
      .then(async (r) => r.ok && !!(await jsonOrNull(r)))
      .catch(() => false);
  }
  const token = await getAccessToken();
  if (!token) return false;
  return fetch(`${WORKER_AI}/status`, { headers: { Authorization: `Bearer ${token}` }, signal: timeout(6000) })
    .then(jsonOrNull)
    .then((d) => !!(d?.ok && (d.nvidia || d.ollama)))
    .catch(() => false);
}

let statusCache: StackStatus | null = null;
let statusInflight: Promise<StackStatus> | null = null;

/** Probes each backend (cached 20 s). */
export function getStackStatus(force = false): Promise<StackStatus> {
  if (!force && statusCache && Date.now() - statusCache.checkedAt < 20000) return Promise.resolve(statusCache);
  if (statusInflight) return statusInflight;
  statusInflight = (async () => {
    const [backend, ollama, nvidia, kokoro] = await Promise.all([
      fetch(`${EREBUS_BACKEND}/health`, { signal: timeout(2500) })
        .then(jsonOrNull)
        .then((d) => {
          if (!d) return { state: "offline" as const };
          const models: string[] = Array.isArray(d.models_available) ? d.models_available : [];
          const real = models.filter((m) => !/pattern/i.test(m));
          return real.length
            ? { state: "real" as const, model: real[0] }
            : { state: "pattern" as const, model: models[0] };
        })
        .catch(() => ({ state: "offline" as const })),
      fetch(`${OLLAMA_URL}/api/tags`, { signal: timeout(2000) })
        .then(jsonOrNull)
        .then((d) => {
          const names: string[] = (d?.models || []).map((m: any) => m.name).filter(Boolean);
          if (!names.length) return { ok: false };
          const pick = names.find((n) => /llama|qwen|mistral|gemma|phi/i.test(n)) || names[0];
          return { ok: true, model: pick };
        })
        .catch(() => ({ ok: false })),
      probeCloud(),
      fetch(`${KOKORO_URL}/health`, { signal: timeout(1500) })
        .then((r) => r.ok)
        .catch(() => false),
    ]);
    statusCache = {
      backend: backend.state,
      backendModel: (backend as any).model,
      ollama: !!(ollama as any).ok,
      ollamaModel: (ollama as any).model,
      nvidia,
      kokoro,
      checkedAt: Date.now(),
    };
    statusInflight = null;
    return statusCache;
  })();
  return statusInflight;
}

/** One chat turn through the stack. `messages` excludes the system prompt. */
export async function stackChat(system: string, messages: ChatMsg[], opts: { maxTokens?: number } = {}): Promise<StackResult> {
  const st = await getStackStatus();
  const errors: string[] = [];
  const last = messages[messages.length - 1]?.content || "";
  const history = messages.slice(0, -1).slice(-16);

  if (st.backend !== "offline") {
    try {
      const r = await fetch(`${EREBUS_BACKEND}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: last, mode: "reasoning", history, system }),
        signal: timeout(45000),
      });
      const d = r.ok ? await jsonOrNull(r) : null;
      const text = d?.response || d?.text || "";
      if (text) return { ok: true, text, via: `Erebus backend (${d?.model || st.backendModel})` };
      errors.push(`Erebus backend HTTP ${r.status}`);
    } catch (e) {
      errors.push(`Erebus backend: ${(e as Error).message}`);
    }
  } else {
    errors.push(st.backend === "pattern" ? "Erebus backend has no LLM loaded (pattern-match only)" : "Erebus backend offline");
  }

  if (st.ollama && st.ollamaModel) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: st.ollamaModel,
          stream: false,
          messages: [{ role: "system", content: system }, ...messages.slice(-16)],
        }),
        signal: timeout(120000),
      });
      const d = r.ok ? await jsonOrNull(r) : null;
      const text = d?.message?.content || "";
      if (text) return { ok: true, text, via: `Ollama (${st.ollamaModel})` };
      errors.push(`Ollama HTTP ${r.status}`);
    } catch (e) {
      errors.push(`Ollama: ${(e as Error).message}`);
    }
  } else {
    errors.push("Ollama offline (localhost:11434)");
  }

  if (!IS_DEV) {
    // Production: the worker runs NVIDIA (gpt-oss-20b + 2 backups) -> hosted Ollama.
    try {
      const { status, data } = await workerAi(
        "/chat",
        { system, messages: messages.slice(-16), max_tokens: opts.maxTokens ?? 1024 },
        150000,
      );
      if (status === 200 && data?.ok && data.text) return { ok: true, text: data.text, via: `${data.via || "cloud"} via worker` };
      errors.push(`Cloud AI${status === 401 ? " (sign in required)" : status === 429 ? " (daily limit reached)" : ` HTTP ${status}`}: ${data?.error || "no reply"}`);
    } catch (e) {
      errors.push(`Cloud AI worker: ${(e as Error).message}`);
    }
    return { ok: false, error: errors.join(" \u00b7 ") };
  }

  for (const model of NVIDIA_CHAT_MODELS) {
    try {
      const r = await fetch(`/nvidia-llm/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...messages.slice(-16)],
          // reasoning models spend tokens before answering; keep headroom
          max_tokens: Math.max(900, opts.maxTokens ?? 1024),
          temperature: 0.6,
        }),
        signal: timeout(45000),
      });
      const d = await jsonOrNull(r);
      const text = d?.choices?.[0]?.message?.content || "";
      if (r.ok && text) return { ok: true, text, via: `NVIDIA (${model})` };
      if (!d) {
        errors.push("NVIDIA proxy unavailable (dev server only)");
        break;
      }
      errors.push(`NVIDIA ${model} HTTP ${r.status}${r.ok ? " (empty)" : ""}`);
      if (r.status === 401 || r.status === 403) break;
    } catch (e) {
      errors.push(`NVIDIA ${model}: ${(e as Error).message}`);
    }
  }

  return { ok: false, error: errors.join(" \u00b7 ") };
}

export type ImageResult = { ok: true; url: string; via: string } | StackFail;

/** Text-to-image via NVIDIA genai (FLUX.1-dev, then FLUX.1-schnell). */
export async function stackImage(prompt: string, size = 1024): Promise<ImageResult> {
  if (!IS_DEV) {
    // Production: same two FLUX attempts, run by the worker (/api/ai/image).
    try {
      const { status, data } = await workerAi("/image", { prompt, size }, 160000);
      if (status === 200 && data?.ok && data.url) return { ok: true, url: data.url, via: `${data.via} via worker` };
      return {
        ok: false,
        error: `Cloud image${status === 401 ? " (sign in required)" : status === 429 ? " (daily limit reached)" : ` HTTP ${status}`}: ${data?.error || "no image"}`,
      };
    } catch (e) {
      return { ok: false, error: `Cloud image worker: ${(e as Error).message}` };
    }
  }
  const errors: string[] = [];
  const seed = Math.floor(Math.random() * 2 ** 31);
  // FLUX.1-dev answers in ~2 s on this account; schnell is slow/queued; SDXL/SD3 are 404.
  const attempts: { path: string; label: string; body: any; ms: number }[] = [
    {
      path: "/nvidia-genai/v1/genai/black-forest-labs/flux.1-dev",
      label: "NVIDIA FLUX.1-dev",
      body: { prompt, mode: "base", cfg_scale: 3.5, width: size, height: size, seed, steps: 28 },
      ms: 90000,
    },
    {
      path: "/nvidia-genai/v1/genai/black-forest-labs/flux.1-schnell",
      label: "NVIDIA FLUX.1-schnell",
      body: { prompt, width: size, height: size, steps: 4, seed, mode: "base", cfg_scale: 0 },
      ms: 60000,
    },
  ];
  for (const a of attempts) {
    try {
      const r = await fetch(a.path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(a.body),
        signal: timeout(a.ms),
      });
      const d = await jsonOrNull(r);
      const b64 = d?.artifacts?.[0]?.base64 || d?.image || d?.data?.[0]?.b64_json;
      if (r.ok && b64) {
        const url = String(b64).startsWith("data:") ? String(b64) : `data:image/jpeg;base64,${b64}`;
        return { ok: true, url, via: a.label };
      }
      errors.push(d ? `${a.label} HTTP ${r.status}: ${d?.detail || d?.title || d?.error || "no image"}` : `${a.label}: proxy unavailable`);
    } catch (e) {
      errors.push(`${a.label}: ${(e as Error).message}`);
    }
  }
  return { ok: false, error: errors.join(" \u00b7 ") };
}

export type AudioResult = { ok: true; url: string; via: string } | StackFail;

/** Kokoro TTS -> object URL (caller revokes). */
export async function stackSpeech(text: string, voice: string, speed: number): Promise<AudioResult> {
  try {
    const r = await fetch(`${KOKORO_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, speed, lang_code: voice.charAt(0) || "a" }),
      signal: timeout(90000),
    });
    if (!r.ok) return { ok: false, error: `Kokoro HTTP ${r.status}` };
    const blob = await r.blob();
    if (!blob.size) return { ok: false, error: "Kokoro returned empty audio" };
    return { ok: true, url: URL.createObjectURL(blob), via: `Kokoro (${voice})` };
  } catch (e) {
    return { ok: false, error: `Kokoro offline (${KOKORO_URL}): ${(e as Error).message}` };
  }
}

/** Probes for a local video backend (ComfyUI). */
export async function probeVideoBackend(): Promise<{ comfy: boolean }> {
  const comfy = await fetch("http://localhost:8188/system_stats", { signal: timeout(1500) })
    .then((r) => r.ok)
    .catch(() => false);
  return { comfy };
}
