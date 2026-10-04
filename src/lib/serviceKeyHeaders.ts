// src/lib/serviceKeyHeaders.ts
// PATCH (api-key-wiring): forwards one of Chris's saved API keys (public.keys, decrypted in memory
// only after the master password is entered) to the LifeOS worker, and ONLY when the worker reports
// (GET /api/keys/status, owner only) that it has no secret of its own for that service. Worker
// secrets always win. Nothing is forwarded while keys are locked, or to a worker that does not
// advertise support (older deploys would reject the extra headers in CORS preflight).
// Read-only: never writes key rows. Values are never logged or rendered.
import { authHeaders } from "./accessToken";
import { getDecryptedKey, isKeyEncryptionUnlocked } from "@/platform/integrations/integrationsSupabase";

const API_BASE = (
  ((import.meta as ImportMeta & { env?: { VITE_WORKER_URL?: string } }).env?.VITE_WORKER_URL as string | undefined) ??
  "https://lifeos1-api.ceogps.workers.dev"
).replace(/\/+$/, "");

/** Worker path -> public.keys.service it needs. */
const PATH_SERVICE: Array<[RegExp, string]> = [
  [/^\/api\/github\//, "github"],
  [/^\/api\/slack\//, "slack"],
  [/^\/api\/notion\//, "notion"],
  [/^\/api\/stripe\//, "stripe"],
  [/^\/api\/cloudflare\//, "cloudflare"],
  [/^\/api\/youtube\//, "youtube"],
  [/^\/api\/x\//, "twitter-x"],
  [/^\/api\/meta\//, "facebook"],
  [/^\/api\/browse\/search/, "exa"],
  [/^\/api\/maps\/(geocode|route)/, "google-maps"],
];
const AI_PATH = /^\/api\/(ai\/(chat|image|status)|llm\/invoke)/;

type WorkerKeyStatus = { forward: boolean; secrets: Record<string, boolean>; at: number };
const TTL = 5 * 60_000;
let cached: WorkerKeyStatus | null = null;
let inflight: Promise<WorkerKeyStatus> | null = null;

async function workerKeyStatus(): Promise<WorkerKeyStatus> {
  if (cached && Date.now() - cached.at < TTL) return cached;
  if (!inflight) {
    inflight = (async (): Promise<WorkerKeyStatus> => {
      try {
        const auth = await authHeaders();
        // no session yet: retry in ~15 s
        if (!auth.Authorization) return { forward: false, secrets: {}, at: Date.now() - TTL + 15_000 };
        const r = await fetch(`${API_BASE}/api/keys/status`, { headers: auth, signal: AbortSignal.timeout(8000) });
        const d = r.ok ? await r.json().catch(() => null) : null;
        return { forward: !!d?.accepts_forwarded, secrets: (d?.worker_secrets as Record<string, boolean>) || {}, at: Date.now() };
      } catch {
        return { forward: false, secrets: {}, at: Date.now() - TTL + 60_000 };
      }
    })().then((s) => {
      cached = s;
      inflight = null;
      return s;
    });
  }
  return inflight;
}

async function savedKey(service: string): Promise<string | null> {
  const k = (await getDecryptedKey(service).catch(() => null))?.trim();
  return k && !/[\r\n]/.test(k) ? k : null;
}

/** Extra request headers for a worker `path` (empty unless a saved key is needed and unlocked). */
export async function serviceKeyHeaders(path: string): Promise<Record<string, string>> {
  if (!isKeyEncryptionUnlocked()) return {};
  const p = path.split("?")[0];
  const ai = AI_PATH.test(p);
  const hit = ai ? undefined : PATH_SERVICE.find(([re]) => re.test(p));
  if (!ai && !hit) return {};
  try {
    const st = await workerKeyStatus();
    if (!st.forward) return {};
    if (ai) {
      const out: Record<string, string> = {};
      if (st.secrets["nvidia-nim"] === false) {
        const k = await savedKey("nvidia-nim");
        if (k) out["X-LifeOS-Key-Nvidia"] = k;
      }
      if (st.secrets["ollama-local"] === false) {
        const k = await savedKey("ollama-local");
        if (k) out["X-LifeOS-Key-Ollama"] = k;
      }
      return out;
    }
    const service = hit![1];
    if (st.secrets[service] !== false) return {};
    const k = await savedKey(service);
    return k ? { "X-LifeOS-Key": k, "X-LifeOS-Key-Service": service } : {};
  } catch {
    return {};
  }
}