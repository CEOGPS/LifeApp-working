from pathlib import Path

backends = r'''/**
 * Creator Studio — pluggable backend settings + local probes.
 * Priority: ComfyUI (image/video) → LM Studio / Ollama (docs) → HF / NVIDIA.
 */
export type CreatorMode =
  | "img2vid"
  | "txt2vid"
  | "musicvideo"
  | "image"
  | "edit"
  | "music"
  | "voice"
  | "docs";

export interface BackendSettings {
  ollamaUrl: string;
  ollamaModel: string;
  lmStudioUrl: string;
  lmStudioModel: string;
  comfyUrl: string;
  a1111Url: string;
  kokoroUrl: string;
  preferLocal: boolean;
}

export interface EndpointStatus {
  id: string;
  label: string;
  url: string;
  online: boolean;
  detail?: string;
}

const LS_KEY = "lifeos_creator_backends";

export const DEFAULT_BACKENDS: BackendSettings = {
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaModel: "gemma4:e2b",
  lmStudioUrl: "http://127.0.0.1:1234",
  lmStudioModel: "",
  comfyUrl: "http://127.0.0.1:8188",
  a1111Url: "http://127.0.0.1:7860",
  kokoroUrl: "http://127.0.0.1:8880",
  preferLocal: true,
};

export function loadBackendSettings(): BackendSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_BACKENDS };
    const parsed = JSON.parse(raw) as Partial<BackendSettings>;
    return { ...DEFAULT_BACKENDS, ...parsed };
  } catch {
    return { ...DEFAULT_BACKENDS };
  }
}

export function saveBackendSettings(s: BackendSettings): void {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

async function probe(
  url: string,
  init?: RequestInit,
  timeoutMs = 2500,
): Promise<{ ok: boolean; detail?: string }> {
  try {
    const r = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) return { ok: false, detail: "HTTP " + r.status };
    return { ok: true };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
  }
}

function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export async function probeEndpoints(
  settings: BackendSettings,
): Promise<EndpointStatus[]> {
  const ollamaTags = stripSlash(settings.ollamaUrl) + "/api/tags";
  const lmModels = stripSlash(settings.lmStudioUrl) + "/v1/models";
  const comfy = stripSlash(settings.comfyUrl) + "/system_stats";
  const a1111 = stripSlash(settings.a1111Url) + "/sdapi/v1/sd-models";
  const kokoro = stripSlash(settings.kokoroUrl) + "/health";

  const [o, lm, c, a, k] = await Promise.all([
    probe(ollamaTags),
    probe(lmModels),
    probe(comfy),
    probe(a1111),
    probe(kokoro),
  ]);

  let ollamaDetail = o.detail;
  if (o.ok) {
    try {
      const r = await fetch(ollamaTags, { signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      const names = (data?.models || []).map((m: { name?: string }) => m.name).filter(Boolean);
      ollamaDetail = names.length ? String(names.length) + " models" : "online (no models)";
    } catch {
      ollamaDetail = "online";
    }
  }

  let lmDetail = lm.detail;
  if (lm.ok) {
    try {
      const r = await fetch(lmModels, { signal: AbortSignal.timeout(3000) });
      const data = await r.json();
      const n = (data?.data || []).length;
      lmDetail = n ? String(n) + " models" : "online";
    } catch {
      lmDetail = "online";
    }
  }

  return [
    { id: "comfy", label: "ComfyUI (image / img2vid)", url: settings.comfyUrl, online: c.ok, detail: c.detail },
    { id: "ollama", label: "Ollama (docs / LLM)", url: settings.ollamaUrl, online: o.ok, detail: ollamaDetail },
    { id: "lmstudio", label: "LM Studio (docs / LLM)", url: settings.lmStudioUrl, online: lm.ok, detail: lmDetail },
    { id: "a1111", label: "A1111 / Fooocus (image)", url: settings.a1111Url, online: a.ok, detail: a.detail },
    { id: "kokoro", label: "Kokoro TTS (local voice)", url: settings.kokoroUrl, online: k.ok, detail: k.detail },
  ];
}

export async function listOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const r = await fetch(stripSlash(baseUrl) + "/api/tags", {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data?.models || []).map((m: { name?: string }) => m.name).filter(Boolean);
  } catch {
    return [];
  }
}

export async function listLmStudioModels(baseUrl: string): Promise<string[]> {
  try {
    const r = await fetch(stripSlash(baseUrl) + "/v1/models", {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data?.data || []).map((m: { id?: string }) => m.id).filter(Boolean);
  } catch {
    return [];
  }
}
'''

keys = r'''/**
 * Resolve creative API keys: Integrations vault (unlocked) first, then VITE_ env.
 */
import {
  getDecryptedKey,
  isKeyEncryptionUnlocked,
  serviceIdOf,
} from "@/platform/integrations/integrationsSupabase";

export type CreativeService =
  | "replicate"
  | "stability"
  | "elevenlabs"
  | "runway"
  | "luma"
  | "did"
  | "huggingface"
  | "openai"
  | "nvidia";

export const SERVICE_CATALOG: Record<
  CreativeService,
  { catalogName: string; envVite: string[]; vaultIds: string[] }
> = {
  replicate: {
    catalogName: "Replicate",
    envVite: ["VITE_REPLICATE_API_KEY"],
    vaultIds: ["replicate"],
  },
  stability: {
    catalogName: "Stability AI",
    envVite: ["VITE_STABILITY_AI_API_KEY"],
    vaultIds: ["stability-ai", "stability"],
  },
  elevenlabs: {
    catalogName: "ElevenLabs",
    envVite: ["VITE_ELEVENLABS_API_KEY"],
    vaultIds: ["elevenlabs", "elevenlabs-voice"],
  },
  runway: {
    catalogName: "Runway",
    envVite: ["VITE_RUNWAY_API_KEY"],
    vaultIds: ["runway", "runwav"],
  },
  luma: {
    catalogName: "Luma",
    envVite: ["VITE_LUMA_API_KEY"],
    vaultIds: ["luma", "luma-ai"],
  },
  did: {
    catalogName: "D-ID",
    envVite: ["VITE_DID_API_KEY"],
    vaultIds: ["d-id", "did"],
  },
  huggingface: {
    catalogName: "Hugging Face",
    envVite: ["VITE_HUGGINGFACE_API_KEY", "VITE_HF_TOKEN"],
    vaultIds: ["hugging-face", "huggingface"],
  },
  openai: {
    catalogName: "OpenAI",
    envVite: ["VITE_OPENAI_API_KEY"],
    vaultIds: ["openai"],
  },
  nvidia: {
    catalogName: "NVIDIA NIM",
    envVite: ["VITE_NVIDIA_API_KEY", "VITE_NVAPI_KEY"],
    vaultIds: ["nvidia-nim", "nvidia", "nvapi"],
  },
};

function envKey(names: string[]): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
  for (const n of names) {
    const v = (env[n] || "").trim();
    if (v) return v;
  }
  return "";
}

export async function resolveKey(service: CreativeService): Promise<{
  key: string | null;
  source: "vault" | "env" | null;
}> {
  const meta = SERVICE_CATALOG[service];
  if (isKeyEncryptionUnlocked()) {
    for (const id of meta.vaultIds) {
      const k = (await getDecryptedKey(id).catch(() => null))?.trim();
      if (k) return { key: k, source: "vault" };
    }
    const slug = serviceIdOf(meta.catalogName);
    const k2 = (await getDecryptedKey(slug).catch(() => null))?.trim();
    if (k2) return { key: k2, source: "vault" };
  }
  const fromEnv = envKey(meta.envVite);
  if (fromEnv) return { key: fromEnv, source: "env" };
  return { key: null, source: null };
}

export async function resolveCreativeKeys(): Promise<
  Partial<Record<CreativeService, string>>
> {
  const out: Partial<Record<CreativeService, string>> = {};
  await Promise.all(
    (Object.keys(SERVICE_CATALOG) as CreativeService[]).map(async (s) => {
      const { key } = await resolveKey(s);
      if (key) out[s] = key;
    }),
  );
  return out;
}

export function missingKeyMessage(service: CreativeService): string {
  const name = SERVICE_CATALOG[service].catalogName;
  const envName = SERVICE_CATALOG[service].envVite[0];
  return (
    "Connect " +
    name +
    " in Integrations (unlock vault + save API key), or set " +
    envName +
    " for local dev."
  );
}
'''

Path(r"D:\dev\LifeApp\src\pages\creator\api\backends.ts").write_text(backends, encoding="utf-8")
Path(r"D:\dev\LifeApp\src\pages\creator\api\keys.ts").write_text(keys, encoding="utf-8")
print("backends ok", len(backends))
print("keys ok", len(keys))
# sanity
b = Path(r"D:\dev\LifeApp\src\pages\creator\api\backends.ts").read_text(encoding="utf-8")
assert "\\HTTP" not in b
assert 'stripSlash(settings.ollamaUrl) + "/api/tags"' in b
print("sanity pass")
