/**
 * Creator Studio — pluggable backend settings + local probes.
 * Priority: Wan / ComfyUI (video) → LM Studio / Ollama (docs) → cloud keys.
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
  wanUrl: string;
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
  wanUrl: "http://127.0.0.1:7861",
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
  const wanBase = stripSlash(settings.wanUrl);
  const a1111 = stripSlash(settings.a1111Url) + "/sdapi/v1/sd-models";
  const kokoro = stripSlash(settings.kokoroUrl) + "/health";

  const [o, lm, c, w, a, k] = await Promise.all([
    probe(ollamaTags),
    probe(lmModels),
    probe(comfy),
    probe(wanBase + "/health").then((h) => (h.ok ? h : probe(wanBase + "/"))),
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
    { id: "wan", label: "Wan (local video)", url: settings.wanUrl, online: w.ok, detail: w.detail },
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
