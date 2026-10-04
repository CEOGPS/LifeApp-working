// worker/src/utils/serviceKeys.ts
// PATCH (api-key-wiring): resolves the API key a worker route needs for one of Chris's services.
//
// Order:
//   1. Worker secret (wrangler secret put <NAME>), preferred. Names per service in SERVICE_ENV.
//   2. Chris's saved key from Supabase public.keys, forwarded by the browser in
//      X-LifeOS-Key (+ X-LifeOS-Key-Service naming the service). Those rows are
//      client-side encrypted with Chris's master password, so the worker cannot read
//      them itself; the unlocked browser decrypts one and forwards it over HTTPS for
//      that single request. The browser only forwards when GET /api/keys/status says
//      the worker has no secret for that service, and only after the owner check.
// Every route using this requires the LifeOS owner (requireUser in routes/ai.ts).
// Keys are never logged, stored or echoed back.
import { aiJson, requireUser } from "../routes/ai";

type Env = Record<string, any>;

export const FORWARD_HEADER = "X-LifeOS-Key";
export const FORWARD_SERVICE_HEADER = "X-LifeOS-Key-Service";

/** public.keys.service -> worker secret names (first set one wins). */
export const SERVICE_ENV: Record<string, string[]> = {
  airtable: ["AIRTABLE_API_TOKEN"],
  alibaba: ["ALIBABA_CODING_PLAN_API_KEY", "ALIBABA_CLOUD_ACCESS_KEY_ID", "ALIBABA_ACCESS_KEY_SECRET"],
  anthropic: ["ANTHROPIC_API_KEY"],
  brevo: ["BREVO_API_KEY", "BREVO_MCP_API_KEY"],
  clickup: ["CLICKUP_API_TOKEN"],
  cloudflare: ["VITE_CLOUDFLARE_API_TOKEN", "VITE_CLOUDFLARE_ACCOUNT_API_TOKEN", "VITE_CLOUDFLARE_GLOBAL_API_KEY", "CLOUDFLARE_API_TOKEN"],
  deepseek: ["DEEPSEEK_API_KEY"],
  discord: ["DISCORD_CLIENT_SECRET", "DISCORD_CLIENT_ID", "DISCORD_PUBLIC_KEY"],
  "elevenlabs-voice": ["VITE_ELEVENLABS_API_KEY", "ELEVENLABS_API_KEY"],
  exa: ["EXA_API_KEY"],
  facebook: ["META_PAGE_ACCESS_TOKEN", "META_APP_ACESS_TOKEN", "FACEBOOK_CLIENT_SECRET", "FACEBOOK_CLIENT_ID"],
  firebase: ["VITE_FIREBASE_BROWSER_API_KEY", "VITE_FIREBASE_PRIVATE_KEY"],
  github: ["GITHUB_PERSONAL_ACCESS_TOKEN", "GITHUB_CLIENT_SECRET", "GITHUB_OAUTH_CLIENT_SECRET"],
  "google-ai-gemini": ["GEMINI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY", "GOOGLE_API_KEY"],
  "google-maps": ["GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"],
  "grok-xai": ["XAI_API_KEY", "GROK_API_KEY"],
  groq: ["GROQ_API_KEY"],
  hermes: ["HERMES_LANGFUSE_SECRET_KEY", "HERMES_OAUTH_CLIENT_ID"],
  "hugging-face": ["HUGGING_FACE_API_KEY", "HF_TOKEN"],
  linkedin: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_CLIENT_SECRET"],
  luma: ["LUMA_API_KEY", "VITE_LUMA_API_KEY"],
  "make-integromat": ["MAKE_COM_API_KEY"],
  "meta-llama": ["METALLAMA_API_KEY"],
  notion: ["NOTION_API_KEY", "NOTION_CLIENT_SECRET"],
  "nvidia-nim": ["NVIDIA_API_KEY", "NVAPI_KEY"],
  nylas: ["NYLAS_API_KEY", "NYLAS_GRANT_KEY_CEOGPS", "NYLAS_GRANT_KEY_CAGEDNREALITY", "NYLAS_GRANT_KEY_CHRISGR33NINC"],
  "ollama-local": ["OLLAMA_API_KEY"],
  openai: ["OPENAI_API_KEY", "VOICE_TOOLS_OPENAI_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  pocketbase: ["POCKETBASE_API_KEY"],
  replicate: ["VITE_REPLICATE_API_KEY", "REPLICATE_API_TOKEN"],
  sendgrid: ["SENDGRID_API_KEY"],
  slack: ["SLACK_OAUTH_TOKEN", "SLACK_CLIENT_SECRET", "SLACK_BOT_TOKEN"],
  spotify: ["SPOTIFY_CLIENT_SECRET", "SPOTIFY_CLIENT_ID"],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
  supabase: ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY"],
  telegram: ["TELEGRAM_BOT_TOKEN"],
  tiktok: ["TIKTOK_CLIENT_SECRET", "TIKTOK_CLIENT_ID"],
  "twitter-x": ["X_BEARER_TOKEN", "X_API_TOKEN", "X_SECRET_KEY", "TWITTER_CLIENT_SECRET"],
  youtube: ["YOUTUBE_DATA_V3_API_KEY", "VITE_YOUTUBE_API_KEY"],
  zoom: ["ZOOM_CLIENT_SECRET", "ZOOM_CLIENT_ID"],
};

export function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function envValue(env: Env, names: string[]): string {
  for (const n of names) {
    const v = str(env?.[n]);
    if (v) return v;
  }
  return "";
}

function cleanForwarded(v: string | null): string {
  const s = str(v);
  return s && s.length <= 4096 && !/[\r\n\s]/.test(s) ? s : "";
}

export type KeySource = "worker-secret" | "saved-key";

/** Key for `service`: worker secret first, then the forwarded saved key (if it names this service). */
export function serviceKey(request: Request, env: Env, service: string): { key: string; source: KeySource } | null {
  const fromEnv = envValue(env, SERVICE_ENV[service] || []);
  if (fromEnv) return { key: fromEnv, source: "worker-secret" };
  const named = str(request.headers.get(FORWARD_SERVICE_HEADER)).toLowerCase();
  const fwd = cleanForwarded(request.headers.get(FORWARD_HEADER));
  if (fwd && named === service) return { key: fwd, source: "saved-key" };
  return null;
}

// (forwarded NVIDIA / Ollama keys: withForwardedAiKeys in routes/ai.ts)

export function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return aiJson(request, env, body, status);
}

export type Guarded =
  | { ok: true; key: string; source: KeySource; ownerId: string }
  | { ok: false; response: Response };

/** Owner check + key lookup for a service route. */
export async function guardService(request: Request, env: Env, service: string, label: string): Promise<Guarded> {
  const auth = await requireUser(request, env);
  if (!auth.ok) return { ok: false, response: json(request, env, { error: auth.error }, auth.status) };
  const k = serviceKey(request, env, service);
  if (!k) {
    const secret = (SERVICE_ENV[service] || [])[0] || service.toUpperCase();
    return {
      ok: false,
      response: json(
        request,
        env,
        { configured: false, error: `${label} is not configured: set worker secret ${secret} or unlock your saved "${service}" key` },
        503,
      ),
    };
  }
  return { ok: true, key: k.key, source: k.source, ownerId: auth.ownerId };
}

export type Upstream = { status: number; ok: boolean; data: any };

export async function upstream(url: string, init: RequestInit = {}, ms = 15000): Promise<Upstream> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("json") ? await r.json().catch(() => null) : null;
  return { status: r.status, ok: r.ok, data };
}

/** Short upstream error text (never includes the key). */
export function upstreamError(label: string, res: Upstream): string {
  const d = res.data || {};
  const raw =
    d?.error?.message || d?.errors?.[0]?.message || d?.errors?.[0]?.detail || d?.message || d?.error_message ||
    d?.detail || d?.title || (typeof d?.error === "string" ? d.error : "");
  return `${label} HTTP ${res.status}${raw ? `: ${String(raw).slice(0, 200)}` : ""}`;
}

/** GET /api/keys/status: which worker env names are set. Names only, never values. */
export async function keysStatus(_request: Request, env: Env): Promise<Response> {
  const worker_secrets: Record<string, boolean> = {};
  for (const [svc, names] of Object.entries(SERVICE_ENV)) worker_secrets[svc] = !!envValue(env, names);
  const env_names = Object.keys(env).filter((name) => {
    const value = env[name];
    return typeof value === "string" && value.trim().length > 0;
  });
  return json(_request, env, { ok: true, accepts_forwarded: true, worker_secrets, env_names });
}