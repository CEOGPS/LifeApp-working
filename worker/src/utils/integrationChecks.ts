// worker/src/utils/integrationChecks.ts
// PATCH (api-key-wiring): per-integration live health checks. Each check makes ONE cheap,
// read-only call to the real provider (whoami / account / model list / token verify).
// No paid AI generation calls. Results carry a sanitized reason and never the key.
// Ids are public.keys.service ids (= serviceIdOf(<Integrations card name>)).
import { str } from "./serviceKeys";

type Env = Record<string, any>;
export type HealthStatus = "connected" | "not_configured" | "auth_error" | "failing" | "no_check";
export interface HealthResult {
  id: string;
  name: string;
  kind: "apikey" | "oauth" | "both";
  status: HealthStatus;
  reason: string;
  source: "worker-secret" | "saved-key" | null;
  secret?: string; // NAME of the worker secret used (never its value)
  oauth?: { provider: string; client_configured: boolean; accounts: number; expired: number; refreshable: number };
  checked_at: string;
}

type Probe = { url: string; init?: RequestInit; ok?: (status: number, data: any) => boolean };
type Check = {
  id: string;
  name: string;
  env: string[]; // first set one is the key
  extra?: string[]; // other env the probe needs (names)
  oauth?: string; // worker OAuth provider slug (routes/oauth.ts)
  probe?: (key: string, env: Env) => Probe | Probe[] | null;
  note?: string;
};

const dashscope = (env: Env) => {
  const b = str(env.DASHSCOPE_BASE_URL);
  return (b && !b.includes("{") ? b : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1").replace(/\/+$/, "");
};
// YouTube keys restricted to the LifeOS site need its referer.
const APP_REFERER = { Referer: "https://lifeos1.pages.dev/" };
const bearer = (k: string, extra: Record<string, string> = {}) => ({ headers: { Authorization: `Bearer ${k}`, ...extra } });
const basic = (a: string, b: string) => `Basic ${btoa(`${a}:${b}`)}`;
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const CHECKS: Check[] = [
  // LLMs (model / account listing only)
  { id: "openai", name: "OpenAI", env: ["OPENAI_API_KEY"], probe: (k) => ({ url: "https://api.openai.com/v1/models", init: bearer(k) }) },
  { id: "anthropic", name: "Anthropic", env: ["ANTHROPIC_API_KEY"], probe: (k) => ({ url: "https://api.anthropic.com/v1/models?limit=1", init: { headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } } }) },
  { id: "google-ai-gemini", name: "Google AI (Gemini)", env: ["GEMINI_API_KEY", "GOOGLE_AI_STUDIO_API_KEY"], oauth: "google", probe: (k) => ({ url: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(k)}` }) },
  { id: "hugging-face", name: "Hugging Face", env: ["HUGGINGFACE_API_KEY", "HF_TOKEN"], probe: (k) => ({ url: "https://huggingface.co/api/whoami-v2", init: bearer(k) }) },
  { id: "ollama-local", name: "Ollama (local)", env: ["OLLAMA_API_KEY"], note: "ollama.com model list (hosted Ollama)", probe: (k, env) => ({ url: `${(str(env.OLLAMA_BASE_URL) || "https://ollama.com").replace(/\/+$/, "").replace(/\/(v1|api)$/, "")}/api/tags`, init: bearer(k) }) },
  { id: "groq", name: "Groq", env: ["GROQ_API_KEY"], probe: (k) => ({ url: "https://api.groq.com/openai/v1/models", init: bearer(k) }) },
  { id: "openrouter", name: "OpenRouter", env: ["OPENROUTER_API_KEY"], probe: (k) => ({ url: "https://openrouter.ai/api/v1/key", init: bearer(k) }) },
  { id: "grok-xai", name: "Grok (xAI)", env: ["XAI_API_KEY", "GROK_API_KEY"], probe: (k) => ({ url: "https://api.x.ai/v1/api-key", init: bearer(k) }) },
  { id: "deepseek", name: "DeepSeek", env: ["DEEPSEEK_API_KEY"], probe: (k) => ({ url: "https://api.deepseek.com/user/balance", init: bearer(k) }) },
  { id: "meta-llama", name: "Meta Llama", env: ["METALLAMA_API_KEY"], probe: (k) => ({ url: "https://api.llama.com/v1/models", init: bearer(k) }) },
  { id: "qwen", name: "Qwen", env: ["DASHSCOPE_API_KEY"], probe: (k, env) => ({ url: `${dashscope(env)}/models`, init: bearer(k) }) },
  { id: "alibaba", name: "Alibaba", env: ["DASHSCOPE_API_KEY"], note: "Alibaba Model Studio (DashScope) key", probe: (k, env) => ({ url: `${dashscope(env)}/models`, init: bearer(k) }) },
  { id: "nvidia-nim", name: "NVIDIA NIM", env: ["NVIDIA_API_KEY", "NVAPI_KEY"], probe: (k) => ({ url: "https://api.nvcf.nvidia.com/v2/nvcf/functions?visibility=authorized", init: bearer(k) }) },
  // Social
  { id: "twitter-x", name: "Twitter/X", env: ["X_BEARER_TOKEN", "TWITTER_BEARER_TOKEN"], oauth: "twitter", probe: (k) => ({ url: "https://api.twitter.com/2/users/by/username/X", init: bearer(k) }) },
  { id: "facebook", name: "Facebook", env: ["META_PAGE_ACCESS_TOKEN"], oauth: "facebook", probe: (k) => ({ url: `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(k)}` }) },
  { id: "instagram", name: "Instagram", env: ["META_PAGE_ACCESS_TOKEN"], extra: ["META_IG_USER_ID"], oauth: "instagram", probe: (k, env) => (str(env.META_IG_USER_ID) ? { url: `https://graph.facebook.com/v21.0/${encodeURIComponent(str(env.META_IG_USER_ID))}?fields=id,username&access_token=${encodeURIComponent(k)}` } : null) },
  { id: "linkedin", name: "LinkedIn", env: ["LINKEDIN_ACCESS_TOKEN"], oauth: "linkedin", probe: (k) => ({ url: "https://api.linkedin.com/v2/userinfo", init: bearer(k) }) },
  { id: "tiktok", name: "TikTok", env: ["TIKTOK_CLIENT_ID"], extra: ["TIKTOK_CLIENT_SECRET"], note: "client-credentials token", probe: (k, env) => (str(env.TIKTOK_CLIENT_SECRET) ? { url: "https://open.tiktokapis.com/v2/oauth/token/", init: { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form({ client_key: k, client_secret: str(env.TIKTOK_CLIENT_SECRET), grant_type: "client_credentials" }) }, ok: (s, d) => s === 200 && !!d?.access_token } : null) },
  { id: "youtube", name: "YouTube", env: ["YOUTUBE_DATA_V3_API_KEY", "YOUTUBE_API_KEY", "VITE_YOUTUBE_API_KEY"], oauth: "google", probe: (k) => ({ url: `https://www.googleapis.com/youtube/v3/i18nRegions?part=id&hl=en&key=${encodeURIComponent(k)}`, init: { headers: APP_REFERER } }) },
  { id: "discord", name: "Discord", env: ["DISCORD_CLIENT_ID"], extra: ["DISCORD_CLIENT_SECRET"], note: "client-credentials token", probe: (k, env) => (str(env.DISCORD_CLIENT_SECRET) ? { url: "https://discord.com/api/v10/oauth2/token", init: { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic(k, str(env.DISCORD_CLIENT_SECRET)) }, body: form({ grant_type: "client_credentials", scope: "identify" }) } } : null) },
  { id: "telegram", name: "Telegram", env: ["TELEGRAM_BOT_TOKEN"], probe: (k) => ({ url: `https://api.telegram.org/bot${k}/getMe`, ok: (s, d) => s === 200 && d?.ok === true }) },
  // Marketing / comms
  { id: "sendgrid", name: "SendGrid", env: ["SENDGRID_API_KEY"], probe: (k) => ({ url: "https://api.sendgrid.com/v3/scopes", init: bearer(k) }) },
  { id: "brevo", name: "Brevo", env: ["BREVO_API_KEY"], probe: (k) => ({ url: "https://api.brevo.com/v3/account", init: { headers: { "api-key": k, Accept: "application/json" } } }) },
  { id: "twilio", name: "Twilio", env: ["TWILIO_AUTH_TOKEN"], extra: ["TWILIO_ACCOUNT_SID"], probe: (k, env) => (str(env.TWILIO_ACCOUNT_SID) ? { url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(str(env.TWILIO_ACCOUNT_SID))}.json`, init: { headers: { Authorization: basic(str(env.TWILIO_ACCOUNT_SID), k) } } } : null) },
  { id: "nylas", name: "Nylas", env: ["NYLAS_API_KEY"], probe: (k) => ({ url: "https://api.us.nylas.com/v3/grants?limit=1", init: bearer(k) }) },
  { id: "clickup", name: "ClickUp", env: ["CLICKUP_API_TOKEN"], probe: (k) => ({ url: "https://api.clickup.com/api/v2/user", init: { headers: { Authorization: k } } }) },
  // Finance
  { id: "stripe", name: "Stripe", env: ["STRIPE_SECRET_KEY"], probe: (k) => ({ url: "https://api.stripe.com/v1/balance", init: bearer(k) }) },
  // Dev tools / infra
  { id: "cloudflare", name: "Cloudflare", env: ["CLOUDFLARE_API_TOKEN", "VITE_CLOUDFLARE_API_TOKEN", "VITE_CLOUDFLARE_ACCOUNT_API_TOKEN", "CLOUDFLARE_ACCOUNT_API_TOKEN"], probe: (k, env) => {
    const acct = str(env.CLOUDFLARE_ACCOUNT_ID) || str(env.VITE_CLOUDFLARE_ACCOUNT_ID);
    return [
      { url: "https://api.cloudflare.com/client/v4/user/tokens/verify", init: bearer(k), ok: (s, d) => s === 200 && d?.success === true },
      ...(acct ? [{ url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(acct)}/tokens/verify`, init: bearer(k), ok: (s: number, d: any) => s === 200 && d?.success === true }] : []),
    ];
  } },
  { id: "github", name: "GitHub", env: ["GITHUB_TOKEN", "GITHUB_PERSONAL_API_KEY", "GITHUB_PERSONAL_ACCESS_TOKEN"], oauth: "github", probe: (k) => ({ url: "https://api.github.com/user", init: bearer(k, { "User-Agent": "lifeos1-api", Accept: "application/vnd.github+json" }) }) },
  { id: "supabase", name: "Supabase", env: ["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"], probe: (k, env) => ({ url: `${(str(env.SUPABASE_URL) || "https://mhvcdstgkyplhzjptgfr.supabase.co").replace(/\/+$/, "")}/auth/v1/settings`, init: { headers: { apikey: k } } }) },
  { id: "firebase", name: "Firebase", env: ["FIREBASE_BROWSER_API_KEY", "VITE_FIREBASE_BROWSER_API_KEY"], probe: (k) => ({ url: `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${encodeURIComponent(k)}` }) },
  { id: "pocketbase", name: "PocketBase", env: ["POCKETBASE_URL"], note: "server health endpoint", probe: (u) => (/^https?:\/\//.test(u) ? { url: `${u.replace(/\/+$/, "")}/api/health` } : null) },
  { id: "dropbox", name: "Dropbox", env: ["DROPBOX_ACCESS_TOKEN"], probe: (k) => ({ url: "https://api.dropboxapi.com/2/users/get_current_account", init: { method: "POST", headers: { Authorization: `Bearer ${k}` } } }) },
  { id: "browserbase", name: "Browserbase", env: ["BROWSERBASE_API_KEY"], probe: (k) => ({ url: "https://api.browserbase.com/v1/projects", init: { headers: { "X-BB-API-Key": k } } }) },
  { id: "replicate", name: "Replicate", env: ["REPLICATE_API_KEY", "VITE_REPLICATE_API_KEY"], probe: (k) => ({ url: "https://api.replicate.com/v1/account", init: bearer(k) }) },
  // Productivity
  { id: "airtable", name: "Airtable", env: ["AIRTABLE_API_TOKEN"], probe: (k) => ({ url: "https://api.airtable.com/v0/meta/whoami", init: bearer(k) }) },
  { id: "notion", name: "Notion", env: ["NOTION_API_KEY"], oauth: "notion", probe: (k) => ({ url: "https://api.notion.com/v1/users/me", init: bearer(k, { "Notion-Version": "2022-06-28" }) }) },
  { id: "google-calendar", name: "Google Calendar", env: [], oauth: "google" },
  { id: "gmail-oauth", name: "Gmail (OAuth)", env: [], oauth: "google" },
  { id: "outlook", name: "Outlook", env: [], oauth: "microsoft" },
  { id: "outlook-calendar", name: "Outlook Calendar", env: [], oauth: "microsoft" },
  // AI media (account endpoints only, no generation)
  { id: "d-id-avatar", name: "D-ID (Avatar)", env: ["DID_API_KEY"], probe: (k) => ({ url: "https://api.d-id.com/credits", init: { headers: { Authorization: `Basic ${k}` } } }) },
  { id: "elevenlabs-voice", name: "ElevenLabs (Voice)", env: ["ELEVENLABS_API_KEY", "VITE_ELEVENLABS_API_KEY"], probe: (k) => ["https://api.elevenlabs.io/v1/user", "https://api.elevenlabs.io/v1/voices?page_size=1", "https://api.elevenlabs.io/v1/models"].slice(0, 1).map((url) => ({ url, init: { headers: { "xi-api-key": k } }, ok: (st: number, d: any) => st === 200 || d?.detail?.status === "missing_permissions" })), note: "a scoped key answers missing_permissions, which still proves it is valid" },
  { id: "stability-ai", name: "Stability AI", env: ["STABILITY_AI_API_KEY", "VITE_STABILITY_AI_API_KEY"], probe: (k) => ({ url: "https://api.stability.ai/v1/user/account", init: bearer(k) }) },
  { id: "runwav", name: "Runway", env: ["RUNWAY_API_KEY"], probe: (k) => ({ url: "https://api.dev.runwayml.com/v1/organization", init: bearer(k, { "X-Runway-Version": "2024-11-06" }) }) },
  { id: "luma", name: "Luma", env: ["LUMA_API_KEY"], probe: (k) => ({ url: "https://api.lumalabs.ai/dream-machine/v1/generations?limit=1", init: bearer(k) }) },
  // Browsers / search / maps
  { id: "exa", name: "Exa", env: ["EXA_API_KEY"], note: "1-result search (cheapest Exa call; Exa has no whoami)", probe: (k) => ({ url: "https://api.exa.ai/search", init: { method: "POST", headers: { "x-api-key": k, "Content-Type": "application/json" }, body: JSON.stringify({ query: "cloudflare workers", numResults: 1 }) } }) },
  { id: "google-maps", name: "Google Maps", env: ["GOOGLE_MAPS_API_KEY", "MAPS_API_KEY"], probe: (k) => ({ url: `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent("1600 Amphitheatre Pkwy, Mountain View, CA")}&key=${encodeURIComponent(k)}`, ok: (s, d) => s === 200 && d?.status === "OK" }) },
  // Music / more
  { id: "spotify", name: "Spotify", env: ["SPOTIFY_CLIENT_ID"], extra: ["SPOTIFY_CLIENT_SECRET"], oauth: "spotify", note: "client-credentials token", probe: (k, env) => (str(env.SPOTIFY_CLIENT_SECRET) ? { url: "https://accounts.spotify.com/api/token", init: { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic(k, str(env.SPOTIFY_CLIENT_SECRET)) }, body: form({ grant_type: "client_credentials" }) } } : null) },
  { id: "make-integromat", name: "Make (Integromat)", env: ["MAKE_COM_API_KEY"], probe: (k) => ["us1", "eu1", "us2", "eu2"].map((z) => ({ url: `https://${z}.make.com/api/v2/users/me`, init: { headers: { Authorization: `Token ${k}` } } })) },
  { id: "slack", name: "Slack", env: ["SLACK_BOT_TOKEN", "SLACK_OAUTH_TOKEN"], oauth: "slack", probe: (k) => ({ url: "https://slack.com/api/auth.test", init: bearer(k), ok: (s, d) => s === 200 && d?.ok === true }) },
  { id: "hermes", name: "Hermes", env: [], note: "no provider API known for this key (Hermes connector is a stub)" },
  { id: "brilliant-directories", name: "Brilliant Directories", env: ["BD_API_KEY"], extra: ["BD_URL"], probe: (k, env) => (str(env.BD_URL) ? { url: `${str(env.BD_URL).replace(/\/+$/, "")}/api/v2/token/verify`, init: { headers: { "X-Api-Key": k } } } : null) },
];

export const OAUTH_PROVIDERS = ["google", "microsoft", "github", "slack", "facebook", "instagram", "twitter", "linkedin", "spotify", "notion"];

function firstEnv(env: Env, names: string[]): { name: string; value: string } | null {
  for (const n of names) {
    const v = str(env?.[n]);
    if (v) return { name: n, value: v };
  }
  return null;
}

function allEnv(env: Env, names: string[]): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const n of names) {
    const v = str(env?.[n]);
    if (v && !out.some((o) => o.value === v)) out.push({ name: n, value: v });
  }
  return out;
}

/** Removes any occurrence of `secret` (and long token-looking strings) from `s`. */
export function sanitize(s: string, secrets: string[]): string {
  let out = String(s || "");
  for (const k of secrets) if (k && k.length >= 6) out = out.split(k).join("***");
  return out.replace(/[A-Za-z0-9_\-]{32,}/g, "***").slice(0, 220);
}

async function runProbe(p: Probe): Promise<{ status: number; data: any; text: string }> {
  const r = await fetch(p.url, { ...(p.init || {}), signal: AbortSignal.timeout(12000) });
  const text = await r.text().catch(() => "");
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: r.status, data, text };
}

function errText(d: any, text: string): string {
  const raw =
    d?.error?.message || d?.error_description || d?.errors?.[0]?.message || d?.errors?.[0]?.detail || d?.detail?.message ||
    (typeof d?.detail === "string" ? d.detail : "") || d?.message || d?.error_message || d?.title || d?.description ||
    (typeof d?.error === "string" ? d.error : "") || text.replace(/<[^>]+>/g, " ").trim();
  return String(raw || "").replace(/\s+/g, " ").trim();
}

/** Runs one key check. `key` overrides the worker secret (validate-before-save). */
export async function runKeyCheck(c: Check, env: Env, key?: string, source?: HealthResult["source"]): Promise<Omit<HealthResult, "oauth">> {
  const base = { id: c.id, name: c.name, kind: (c.oauth ? (c.env.length ? "both" : "oauth") : "apikey") as HealthResult["kind"], checked_at: new Date().toISOString() };
  const candidates = key ? [{ name: "", value: key }] : allEnv(env, c.env);
  if (candidates.length > 1 && c.probe) {
    let first: Omit<HealthResult, "oauth"> | null = null;
    for (const cand of candidates) {
      const r = await runKeyCheck({ ...c, env: [cand.name] }, env);
      if (r.status === "connected") return candidates.length > 1 ? { ...r, reason: `${r.reason} (${cand.name}; ${candidates.length} candidates)` } : r;
      first = first || r;
    }
    return { ...first!, reason: `${first!.reason} (${candidates.length} secrets tried: ${candidates.map((x) => x.name).join(", ")})` };
  }
  const found = candidates[0] || null;
  if (!c.probe) return { ...base, status: c.env.length ? "no_check" : "not_configured", reason: c.note || (c.env.length ? "no live check for this service" : "OAuth only"), source: found ? source || "worker-secret" : null };
  if (!found) return { ...base, status: "not_configured", reason: `set worker secret ${c.env[0]}${c.extra?.length ? ` (+ ${c.extra.join(", ")})` : ""}`, source: null };
  const secrets = [found.value, ...(c.extra || []).map((n) => str(env[n]))];
  const probes = c.probe(found.value, env);
  if (!probes) return { ...base, status: "not_configured", reason: `also needs ${(c.extra || []).join(", ")}`, source: source || "worker-secret", secret: found.name || undefined };
  const list = Array.isArray(probes) ? probes : [probes];
  let last = { status: 0, reason: "" };
  for (const p of list) {
    try {
      const r = await runProbe(p);
      const good = p.ok ? p.ok(r.status, r.data) : r.status >= 200 && r.status < 300;
      if (good) {
        return { ...base, status: "connected", reason: `HTTP ${r.status}${c.note ? ` (${c.note})` : ""}`, source: source || "worker-secret", secret: found.name || undefined };
      }
      last = { status: r.status, reason: sanitize(`HTTP ${r.status}: ${errText(r.data, r.text)}`, secrets) };
    } catch (e) {
      last = { status: 0, reason: sanitize(`request failed: ${(e as Error).message}`, secrets) };
    }
  }
  const auth = last.status === 401 || last.status === 403 || /invalid|unauthori|expired|revoked|forbidden|incorrect api key/i.test(last.reason);
  return { ...base, status: auth ? "auth_error" : "failing", reason: last.reason, source: source || "worker-secret", secret: found.name || undefined };
}

/** OAuth side: client credentials present + connected account rows (read-only Supabase select). */
export async function oauthInfo(env: Env, provider: string): Promise<NonNullable<HealthResult["oauth"]>> {
  const P = provider.toUpperCase();
  const client_configured = !!(str(env[`${P}_CLIENT_ID`]) && str(env[`${P}_CLIENT_SECRET`]));
  const out = { provider, client_configured, accounts: 0, expired: 0, refreshable: 0 };
  const url = str(env.SUPABASE_URL);
  const svc = str(env.SUPABASE_SERVICE_ROLE_KEY) || str(env.SUPABASE_SECRET_KEY);
  if (!url || !svc) return out;
  try {
    const r = await fetch(
      `${url.replace(/\/+$/, "")}/rest/v1/integrations_credentials?oauth_provider=eq.${encodeURIComponent(provider)}&status=eq.on&select=oauth_expires_at,oauth_refresh_token`,
      { headers: { apikey: svc, ...(svc.startsWith("sb_") ? {} : { Authorization: `Bearer ${svc}` }) }, signal: AbortSignal.timeout(8000) },
    );
    const rows = r.ok ? ((await r.json().catch(() => [])) as any[]) : [];
    const now = Date.now();
    for (const row of rows || []) {
      out.accounts++;
      if (row.oauth_expires_at && new Date(row.oauth_expires_at).getTime() < now) out.expired++;
      if (row.oauth_refresh_token) out.refreshable++;
    }
  } catch {
    /* leave counts at 0 */
  }
  return out;
}

const cache = new Map<string, { at: number; value: HealthResult }>();

/** Health for `ids` (all when empty). Cached 60 s per id. */
export async function integrationHealth(env: Env, ids: string[], force = false): Promise<HealthResult[]> {
  const list = CHECKS.filter((c) => !ids.length || ids.includes(c.id));
  const oauthCache = new Map<string, Promise<NonNullable<HealthResult["oauth"]>>>();
  return Promise.all(
    list.map(async (c) => {
      const hit = cache.get(c.id);
      if (!force && hit && Date.now() - hit.at < 60_000) return hit.value;
      const res: HealthResult = await runKeyCheck(c, env);
      if (c.oauth) {
        if (!oauthCache.has(c.oauth)) oauthCache.set(c.oauth, oauthInfo(env, c.oauth));
        res.oauth = await oauthCache.get(c.oauth)!;
        // OAuth-only cards are "connected" when an account row is live.
        if (res.status === "not_configured" && !c.env.length) {
          if (res.oauth.accounts > res.oauth.expired || res.oauth.refreshable > 0) {
            res.status = "connected";
            res.reason = `${res.oauth.accounts} OAuth account(s)`;
          } else {
            res.reason = res.oauth.client_configured ? "OAuth client ready - click Add connector to sign in" : `set worker secrets ${c.oauth.toUpperCase()}_CLIENT_ID / ${c.oauth.toUpperCase()}_CLIENT_SECRET`;
          }
        }
      }
      cache.set(c.id, { at: Date.now(), value: res });
      return res;
    }),
  );
}