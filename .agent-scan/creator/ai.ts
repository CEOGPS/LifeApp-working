// worker/src/routes/ai.ts
// PATCH (worker-ai-route): production AI routes for the Erebus dock.
// Mirrors the Vite dev proxy (vite.config.ts /nvidia-llm, /nvidia-genai) and the
// dock client (src/lib/agents/erebus/dock/erebusStack.ts):
//   POST /api/ai/chat   NVIDIA chat completions (gpt-oss-20b + 2 backups) -> hosted Ollama /api/chat
//   POST /api/ai/image  NVIDIA genai FLUX.1-dev -> FLUX.1-schnell
//   GET  /api/ai/status which upstreams are configured + today's usage (no cap consumed)
// Every route requires a valid Supabase session JWT (checked against
// ${SUPABASE_URL}/auth/v1/user; anonymous sessions are fine because the app signs in
// invisibly) whose user IS the LifeOS owner (AI_OWNER_ID), is linked to it in
// public.owner_links, OR (sole local) is a self-owner on localhost / when
// AI_ALLOW_SELF_OWNER=1 — no emailed owner code required. Capped per OWNER per
// UTC day (KV LIFEOS_KV, in-memory fallback). Keys stay server-side and are never echoed.
import { Router } from "itty-router";

type Env = Record<string, any>;
export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

const NVIDIA_LLM_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_GENAI_BASE = "https://ai.api.nvidia.com/v1/genai";
const DEFAULT_OLLAMA_BASE = "https://ollama.com";
const DEFAULT_OLLAMA_MODEL = "gpt-oss:20b";
const DEFAULT_SUPABASE_URL = "https://mhvcdstgkyplhzjptgfr.supabase.co";
// Chris's stable owner uid (override/extend with AI_OWNER_ID, comma-separated).
const DEFAULT_OWNER_ID = "0355fae3-863b-432c-bac8-968942681e1b";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same list/order as erebusStack.ts (verified on Chris's NVIDIA account 2026-09-29).
const NVIDIA_CHAT_MODELS = [
  "openai/gpt-oss-20b",
  "deepseek-ai/deepseek-v4.1-flash",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
];
const DEFAULT_ALLOWED_ORIGINS = [
  "https://lifeos1.pages.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];
const IMAGE_SIZES = [512, 576, 640, 704, 768, 832, 896, 960, 1024, 1088, 1152, 1216, 1280, 1344];
const MAX_MSG_CHARS = 16000;
const MAX_TOTAL_CHARS = 60000;
const MAX_PROMPT_CHARS = 2000;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function num(v: unknown, dflt: number): number {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : dflt;
}
function nvidiaKey(env: Env): string {
  return str(env.NVIDIA_API_KEY) || str(env.NVAPI_KEY);
}
function ollamaBase(env: Env): string {
  const b = str(env.OLLAMA_BASE_URL) || DEFAULT_OLLAMA_BASE;
  // The secret may hold the OpenAI-compatible base (https://ollama.com/v1); native /api/chat lives at the root.
  return b.replace(/\/+$/, "").replace(/\/(v1|api)$/, "").replace(/\/+$/, "");
}
function timeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}
async function jsonOrNull(r: Response): Promise<any | null> {
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("json")) return null;
  return r.json().catch(() => null);
}

// ---------------------------------------------------------------- CORS
export function isAllowedOrigin(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  const extra = str(env.AI_ALLOWED_ORIGINS)
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((s) => s && s !== "*");
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  // Cloudflare Pages preview/branch deployments: https://<hash>.lifeos1.pages.dev
  return /^https:\/\/[a-z0-9-]+\.lifeos1\.pages\.dev$/i.test(origin);
}

export function aiCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const h: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // PATCH (api-key-wiring): + X-User-Id and the forwarded saved-key headers (utils/serviceKeys.ts)
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-LifeOS-Key, X-LifeOS-Key-Service, X-LifeOS-Key-Nvidia, X-LifeOS-Key-Ollama",
    "Access-Control-Expose-Headers": "X-AI-Cap-Limit, X-AI-Cap-Remaining",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && isAllowedOrigin(origin, env)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export function aiPreflight(request: Request, env: Env): Response {
  return new Response(null, { status: 204, headers: aiCorsHeaders(request, env) });
}

export function aiJson(request: Request, env: Env, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...aiCorsHeaders(request, env), ...extra },
  });
}

// ---------------------------------------------------------------- Auth
type AuthOk = { ok: true; userId: string; ownerId: string; email?: string };
type AuthFail = { ok: false; status: number; error: string };
const tokenCache = new Map<string, { userId: string; ownerId: string; email?: string; until: number }>();
// member uid -> linked owner uid (null = not linked). Linked: 10 min, unlinked: 60 s.
const linkCache = new Map<string, { owner: string | null; until: number }>();

function ownerIds(env: Env): string[] {
  const ids = str(env.AI_OWNER_ID || DEFAULT_OWNER_ID)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => UUID_RE.test(s));
  return ids.length ? ids : [DEFAULT_OWNER_ID];
}


/** True when the browser is the local sole-user app (no owner-code email flow). */
function isLocalDevRequest(request: Request): boolean {
  const origin = (request.headers.get("Origin") || "").replace(/\/+$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  const ref = request.headers.get("Referer") || "";
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(ref);
}

function allowSelfAsOwner(request: Request, env: Env): boolean {
  const flag = str(env.AI_ALLOW_SELF_OWNER || env.LIFEOS_SOLE_LOCAL).toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on" || flag === "yes") return true;
  // Default for LifeOS local-only: localhost Origin/Referer may use the session as owner.
  return isLocalDevRequest(request);
}

/** Owner uid linked to `userId` in public.owner_links (null when not linked). */
async function lookupLinkedOwner(env: Env, base: string, publishable: string, userId: string, token: string): Promise<string | null> {
  const hit = linkCache.get(userId);
  if (hit && hit.until > Date.now()) return hit.owner;
  let owner: string | null | undefined;
  // 1) service role (bypasses RLS); new sb_secret_ keys go in apikey only, legacy JWT keys in both.
  const svc = str(env.SUPABASE_SERVICE_ROLE_KEY) || str(env.SUPABASE_SECRET_KEY);
  if (svc) {
    try {
      const r = await fetch(`${base}/rest/v1/owner_links?member_uid=eq.${userId}&select=owner_uid&limit=1`, {
        headers: { apikey: svc, Accept: "application/json", ...(svc.startsWith("sb_") ? {} : { Authorization: `Bearer ${svc}` }) },
        signal: timeout(8000),
      });
      const rows = r.ok ? await jsonOrNull(r) : null;
      if (Array.isArray(rows)) owner = rows[0]?.owner_uid ? String(rows[0].owner_uid).toLowerCase() : null;
    } catch {
      /* fall back to the user's own token */
    }
  }
  // 2) fallback: the user's own token; RLS lets a member read its own row via app_owner_id().
  if (owner === undefined) {
    const r = await fetch(`${base}/rest/v1/rpc/app_owner_id`, {
      method: "POST",
      headers: { apikey: publishable, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: "{}",
      signal: timeout(8000),
    });
    if (!r.ok) throw new Error(`owner lookup HTTP ${r.status}`);
    const v = await jsonOrNull(r);
    const id = typeof v === "string" ? v.toLowerCase() : "";
    owner = id && id !== userId ? id : null;
  }
  if (linkCache.size > 1000) linkCache.clear();
  linkCache.set(userId, { owner, until: Date.now() + (owner ? 10 * 60_000 : 60_000) });
  return owner;
}

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}
function jwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(b64urlDecode(parts[1]));
  } catch {
    return null;
  }
}
async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validates the Supabase session JWT in `Authorization: Bearer <token>`. */
export async function requireUser(request: Request, env: Env): Promise<AuthOk | AuthFail> {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") || "");
  const token = m?.[1]?.trim() || "";
  if (!token) return { ok: false, status: 401, error: "Sign in required (missing bearer token)" };
  const payload = jwtPayload(token);
  const now = Math.floor(Date.now() / 1000);
  // Anonymous sessions have role "authenticated" too; they are accepted (owner check below).
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now || payload.role !== "authenticated") {
    return { ok: false, status: 401, error: "Invalid or expired session token" };
  }
  const cacheKey = await sha256Hex(token);
  const hit = tokenCache.get(cacheKey);
  if (hit && hit.until > Date.now()) return { ok: true, userId: hit.userId, ownerId: hit.ownerId, email: hit.email };

  const base = (str(env.SUPABASE_URL) || str(env.SUPABASE_PROJECT_URL) || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
  const apikey =
    str(env.SUPABASE_PUBLISHABLE_KEY) || str(env.SUPABASE_ANON_KEY) ||
    str(env.VITE_SUPABASE_PUBLISHABLE_KEY) || str(env.VITE_SUPABASE_ANON_KEY);
  if (!apikey) return { ok: false, status: 500, error: "Worker is missing SUPABASE_PUBLISHABLE_KEY" };
  try {
    const r = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey, Authorization: `Bearer ${token}` },
      signal: timeout(8000),
    });
    if (r.status === 401 || r.status === 403) return { ok: false, status: 401, error: "Invalid or expired session token" };
    if (!r.ok) return { ok: false, status: 503, error: `Auth check failed (Supabase HTTP ${r.status})` };
    const u = await jsonOrNull(r);
    const userId = String(u?.id || "").toLowerCase();
    if (!UUID_RE.test(userId)) return { ok: false, status: 401, error: "Invalid session" };
    const owners = ownerIds(env);
    let ownerId: string | null = owners.includes(userId) ? userId : null;
    if (!ownerId) {
      try {
        const linked = await lookupLinkedOwner(env, base, apikey, userId, token);
        if (linked && owners.includes(linked)) {
          ownerId = linked;
        } else if (!linked && allowSelfAsOwner(request, env)) {
          // Sole local user: app_owner_id() is this session. No owner-code email needed.
          ownerId = userId;
        }
      } catch (e) {
        return { ok: false, status: 503, error: `Owner check failed: ${(e as Error).message}` };
      }
    }
    if (!ownerId) {
      return {
        ok: false,
        status: 403,
        error: "This session is not linked to the LifeOS owner",
      };
    }
    if (tokenCache.size > 500) tokenCache.clear();
    tokenCache.set(cacheKey, { userId, ownerId, email: u.email, until: Math.min(Date.now() + 5 * 60_000, payload.exp * 1000) });
    return { ok: true, userId, ownerId, email: u.email };
  } catch (e) {
    return { ok: false, status: 503, error: `Auth check failed: ${(e as Error).message}` };
  }
}

// ---------------------------------------------------------------- Daily cap
export type CapKind = "chat" | "image";
export type CapResult = { ok: boolean; limit: number; used: number; remaining: number };
const memCounts = new Map<string, number>();

function capLimit(env: Env, kind: CapKind): number {
  return kind === "image" ? num(env.AI_DAILY_IMAGE_LIMIT, 25) : num(env.AI_DAILY_CHAT_LIMIT, 200);
}
function capKey(userId: string, kind: CapKind): string {
  return `ai-cap:${kind}:${userId}:${new Date().toISOString().slice(0, 10)}`; // UTC day
}

async function readCount(env: Env, key: string): Promise<number> {
  const kv = env.LIFEOS_KV;
  if (kv && typeof kv.get === "function") {
    try {
      return Math.max(parseInt((await kv.get(key)) || "0", 10) || 0, memCounts.get(key) || 0);
    } catch {
      /* fall through to memory */
    }
  }
  return memCounts.get(key) || 0;
}

/** Counts one request against the user's daily cap; ok:false when exhausted. */
export async function consumeCap(env: Env, userId: string, kind: CapKind): Promise<CapResult> {
  const limit = capLimit(env, kind);
  const key = capKey(userId, kind);
  const used = await readCount(env, key);
  if (used >= limit) return { ok: false, limit, used, remaining: 0 };
  const next = used + 1;
  memCounts.set(key, next);
  if (memCounts.size > 5000) memCounts.clear();
  const kv = env.LIFEOS_KV;
  if (kv && typeof kv.put === "function") {
    try {
      await kv.put(key, String(next), { expirationTtl: 60 * 60 * 48 });
    } catch {
      /* KV write limit hit: in-memory count still applies in this isolate */
    }
  }
  return { ok: true, limit, used: next, remaining: limit - next };
}

export async function peekCap(env: Env, userId: string, kind: CapKind): Promise<CapResult> {
  const limit = capLimit(env, kind);
  const used = await readCount(env, capKey(userId, kind));
  return { ok: used < limit, limit, used, remaining: Math.max(0, limit - used) };
}

function capHeaders(c: CapResult): Record<string, string> {
  return { "X-AI-Cap-Limit": String(c.limit), "X-AI-Cap-Remaining": String(c.remaining) };
}

// PATCH (api-key-wiring): Chris's saved "nvidia-nim" / "ollama-local" keys, forwarded by the unlocked
// browser, are used ONLY when the worker has no NVIDIA / Ollama secret. Never logged or echoed.
function fwdKey(request: Request, name: string): string {
  const s = str(request.headers.get(name));
  return s && s.length <= 4096 && !/[\r\n\s]/.test(s) ? s : "";
}
export function withForwardedAiKeys(request: Request, env: Env): Env {
  const out: Env = { ...env };
  if (!nvidiaKey(env)) {
    const k = fwdKey(request, "X-LifeOS-Key-Nvidia");
    if (k) out.NVIDIA_API_KEY = k;
  }
  if (!str(env.OLLAMA_API_KEY)) {
    const k = fwdKey(request, "X-LifeOS-Key-Ollama");
    if (k) out.OLLAMA_API_KEY = k;
  }
  return out;
}

// ---------------------------------------------------------------- Chat chain
function contentToText(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((p: any) => (typeof p === "string" ? p : p?.type === "text" || typeof p?.text === "string" ? String(p.text ?? "") : ""))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Sanitises client messages: valid roles, string content, last 16, size-capped. */
export function normalizeMessages(input: unknown): ChatMsg[] {
  if (!Array.isArray(input)) return [];
  const out: ChatMsg[] = [];
  for (const m of input as any[]) {
    const role = m?.role;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    const content = contentToText(m?.content).slice(0, MAX_MSG_CHARS);
    if (content.trim()) out.push({ role, content });
  }
  const recent = out.slice(-16);
  let total = 0;
  const kept: ChatMsg[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    total += recent[i].content.length;
    if (total > MAX_TOTAL_CHARS && kept.length) break;
    kept.unshift(recent[i]);
  }
  return kept;
}

export type ChainOk = { ok: true; text: string; via: string; model: string; usage: { prompt_tokens: number; completion_tokens: number } };
export type ChainFail = { ok: false; error: string };

export async function runChatChain(
  env: Env,
  input: { system?: string; messages: ChatMsg[]; maxTokens?: number },
): Promise<ChainOk | ChainFail> {
  const errors: string[] = [];
  const system = str(input.system).slice(0, MAX_MSG_CHARS);
  const msgs: ChatMsg[] = [...(system ? [{ role: "system" as const, content: system }] : []), ...input.messages.slice(-16)];
  const requested = Number.isFinite(input.maxTokens as number) ? Number(input.maxTokens) : 1024;
  // reasoning models spend tokens before answering; keep headroom (same as the dev client)
  const maxTokens = Math.max(900, Math.min(requested, 4096));

  const key = nvidiaKey(env);
  if (key) {
    const models = [...(str(env.NVIDIA_CHAT_MODEL) ? [str(env.NVIDIA_CHAT_MODEL)] : []), ...NVIDIA_CHAT_MODELS];
    for (const model of models) {
      try {
        const r = await fetch(`${NVIDIA_LLM_BASE}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: msgs, max_tokens: maxTokens, temperature: 0.6 }),
          signal: timeout(45000),
        });
        const d = await jsonOrNull(r);
        const text = d?.choices?.[0]?.message?.content || "";
        if (r.ok && text) {
          return {
            ok: true,
            text,
            via: `NVIDIA (${model})`,
            model,
            usage: { prompt_tokens: d?.usage?.prompt_tokens ?? 0, completion_tokens: d?.usage?.completion_tokens ?? 0 },
          };
        }
        errors.push(`NVIDIA ${model} HTTP ${r.status}${r.ok ? " (empty)" : ""}`);
        if (r.status === 401 || r.status === 403) break;
      } catch (e) {
        errors.push(`NVIDIA ${model}: ${(e as Error).message}`);
      }
    }
  } else {
    errors.push("NVIDIA key not configured on the worker");
  }

  const oKey = str(env.OLLAMA_API_KEY);
  const oModel = str(env.OLLAMA_MODEL) || DEFAULT_OLLAMA_MODEL;
  if (oKey || str(env.OLLAMA_BASE_URL)) {
    try {
      const r = await fetch(`${ollamaBase(env)}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(oKey ? { Authorization: `Bearer ${oKey}` } : {}) },
        body: JSON.stringify({ model: oModel, stream: false, messages: msgs }),
        signal: timeout(90000),
      });
      const d = await jsonOrNull(r);
      const text = d?.message?.content || "";
      if (r.ok && text) {
        return {
          ok: true,
          text,
          via: `Ollama (${oModel})`,
          model: oModel,
          usage: { prompt_tokens: d?.prompt_eval_count ?? 0, completion_tokens: d?.eval_count ?? 0 },
        };
      }
      errors.push(`Ollama ${oModel} HTTP ${r.status}${r.ok ? " (empty)" : ""}`);
    } catch (e) {
      errors.push(`Ollama ${oModel}: ${(e as Error).message}`);
    }
  } else {
    errors.push("Ollama not configured on the worker");
  }
  return { ok: false, error: errors.join(" \u00b7 ") };
}

// ---------------------------------------------------------------- Image chain
export type ImageOk = { ok: true; url: string; via: string };

export async function runImageChain(env: Env, input: { prompt: string; size?: number }): Promise<ImageOk | ChainFail> {
  const key = nvidiaKey(env);
  if (!key) return { ok: false, error: "NVIDIA key not configured on the worker" };
  const prompt = str(input.prompt).slice(0, MAX_PROMPT_CHARS);
  const size = IMAGE_SIZES.includes(Number(input.size)) ? Number(input.size) : 1024;
  const seed = Math.floor(Math.random() * 2 ** 31);
  const errors: string[] = [];
  // Same attempts/bodies as erebusStack.ts stackImage().
  const attempts: { path: string; label: string; body: any; ms: number }[] = [
    {
      path: "/black-forest-labs/flux.1-dev",
      label: "NVIDIA FLUX.1-dev",
      body: { prompt, mode: "base", cfg_scale: 3.5, width: size, height: size, seed, steps: 28 },
      ms: 90000,
    },
    {
      path: "/black-forest-labs/flux.1-schnell",
      label: "NVIDIA FLUX.1-schnell",
      body: { prompt, width: size, height: size, steps: 4, seed, mode: "base", cfg_scale: 0 },
      ms: 60000,
    },
  ];
  for (const a of attempts) {
    try {
      const r = await fetch(`${NVIDIA_GENAI_BASE}${a.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(a.body),
        signal: timeout(a.ms),
      });
      const d = await jsonOrNull(r);
      const b64 = d?.artifacts?.[0]?.base64 || d?.image || d?.data?.[0]?.b64_json;
      if (r.ok && b64) {
        const url = String(b64).startsWith("data:") ? String(b64) : `data:image/jpeg;base64,${b64}`;
        return { ok: true, url, via: a.label };
      }
      const detail = d?.detail || d?.title || d?.error;
      errors.push(`${a.label} HTTP ${r.status}: ${typeof detail === "string" ? detail.slice(0, 200) : "no image"}`);
    } catch (e) {
      errors.push(`${a.label}: ${(e as Error).message}`);
    }
  }
  return { ok: false, error: errors.join(" \u00b7 ") };
}

// ---------------------------------------------------------------- Routes
const router = Router();

router.get("/status", async (request: Request, env: Env) => {
  const auth = await requireUser(request, env);
  if (!auth.ok) return aiJson(request, env, { ok: false, error: auth.error }, auth.status);
  env = withForwardedAiKeys(request, env); // PATCH (api-key-wiring)
  const [chat, image] = await Promise.all([peekCap(env, auth.ownerId, "chat"), peekCap(env, auth.ownerId, "image")]);
  return aiJson(request, env, {
    ok: true,
    nvidia: !!nvidiaKey(env),
    ollama: !!(str(env.OLLAMA_API_KEY) || str(env.OLLAMA_BASE_URL)),
    caps: { chat, image },
  });
});

router.post("/chat", async (request: Request, env: Env) => {
  const auth = await requireUser(request, env);
  if (!auth.ok) return aiJson(request, env, { ok: false, error: auth.error }, auth.status);
  env = withForwardedAiKeys(request, env); // PATCH (api-key-wiring)
  const body: any = await request.json().catch(() => null);
  const messages = normalizeMessages(body?.messages);
  if (!messages.length) return aiJson(request, env, { ok: false, error: "messages[] required" }, 400);
  const cap = await consumeCap(env, auth.ownerId, "chat"); // cap per owner (all linked sessions share it)
  if (!cap.ok) return aiJson(request, env, { ok: false, error: `Daily AI chat limit reached (${cap.limit}/day)` }, 429, capHeaders(cap));
  const res = await runChatChain(env, { system: body?.system, messages, maxTokens: body?.max_tokens ?? body?.maxTokens });
  if (!res.ok) return aiJson(request, env, res, 502, capHeaders(cap));
  return aiJson(request, env, { ok: true, text: res.text, via: res.via, model: res.model, usage: res.usage }, 200, capHeaders(cap));
});

router.post("/image", async (request: Request, env: Env) => {
  const auth = await requireUser(request, env);
  if (!auth.ok) return aiJson(request, env, { ok: false, error: auth.error }, auth.status);
  env = withForwardedAiKeys(request, env); // PATCH (api-key-wiring)
  const body: any = await request.json().catch(() => null);
  const prompt = str(body?.prompt);
  if (!prompt) return aiJson(request, env, { ok: false, error: "prompt required" }, 400);
  const cap = await consumeCap(env, auth.ownerId, "image");
  if (!cap.ok) return aiJson(request, env, { ok: false, error: `Daily image limit reached (${cap.limit}/day)` }, 429, capHeaders(cap));
  const res = await runImageChain(env, { prompt, size: body?.size });
  return aiJson(request, env, res, res.ok ? 200 : 502, capHeaders(cap));
});

router.all("*", (request: Request, env: Env) => aiJson(request, env, { ok: false, error: "Not found" }, 404));

export { router as aiRoutes };
