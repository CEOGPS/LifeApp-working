/**
 * Creator generation — ComfyUI → cloud (HF/NVIDIA/Replicate/Luma/Runway);
 * docs via LM Studio / Ollama. Never fakes success.
 */
import {
  generateImage as erebusImage,
  editImage as erebusEdit,
  generateMusic as erebusMusic,
  generateSpeech as erebusSpeech,
  generateVideo as erebusVideo,
  imageToVideo as erebusImg2Vid,
} from "@/lib/agents/erebus/ErebusMedia";
import { setErebusMediaKeys } from "@/lib/agents/erebus/ErebusMediaKeys";
import type { BackendSettings, EndpointStatus } from "./backends";
import { loadBackendSettings } from "./backends";
import { resolveCreativeKeys, missingKeyMessage, type CreativeService } from "./keys";

export class MissingBackendError extends Error {
  code: "local" | "cloud" | "both";
  services: string[];
  installHint?: string;
  constructor(
    message: string,
    opts: { code: "local" | "cloud" | "both"; services: string[]; installHint?: string },
  ) {
    super(message);
    this.name = "MissingBackendError";
    this.code = opts.code;
    this.services = opts.services;
    this.installHint = opts.installHint;
  }
}

export interface GenResult {
  url: string | null;
  text?: string;
  source: string;
  spoken?: boolean;
}

async function applyKeys(): Promise<Partial<Record<CreativeService, string>>> {
  const keys = await resolveCreativeKeys();
  setErebusMediaKeys({
    stability: keys.stability,
    elevenlabs: keys.elevenlabs,
    replicate: keys.replicate,
    luma: keys.luma,
    did: keys.did,
    hf: keys.huggingface,
    runway: keys.runway,
  });
  return keys;
}

function online(status: EndpointStatus[] | undefined, id: string): boolean {
  return !!status?.find((e) => e.id === id && e.online);
}

function settingsOrStored(s?: BackendSettings): BackendSettings {
  return s || loadBackendSettings();
}

/** OpenAI-compatible chat (LM Studio) */
async function lmStudioChat(
  baseUrl: string,
  model: string,
  system: string,
  prompt: string,
): Promise<string | null> {
  const r = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model || "local",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function ollamaChat(
  baseUrl: string,
  model: string,
  system: string,
  prompt: string,
): Promise<{ text: string | null; hardFail?: string }> {
  const r = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(180000),
  });
  if (r.ok) {
    const data = await r.json();
    return { text: data?.message?.content || data?.response || null };
  }
  const errBody = await r.text().catch(() => "");
  if (r.status >= 500) {
    return {
      text: null,
      hardFail: `Ollama HTTP ${r.status}${errBody ? `: ${errBody.slice(0, 160)}` : ""}`,
    };
  }
  return { text: null };
}

export async function generateDocument(
  prompt: string,
  settings: BackendSettings,
  opts?: { system?: string; endpoints?: EndpointStatus[] },
): Promise<GenResult> {
  const system =
    opts?.system ||
    "You are a skilled document writer inside LifeApp Creator Studio. Produce clear, well-structured prose.";
  const s = settingsOrStored(settings);
  const eps = opts?.endpoints;

  // 1) LM Studio (OpenAI-compatible local)
  if (s.preferLocal || online(eps, "lmstudio")) {
    try {
      const text = await lmStudioChat(s.lmStudioUrl, s.lmStudioModel, system, prompt);
      if (text) return { url: null, text, source: `LM Studio (${s.lmStudioModel || "local"})` };
    } catch {
      /* fall through */
    }
  }

  // 2) Ollama
  if (s.preferLocal || online(eps, "ollama")) {
    try {
      const { text, hardFail } = await ollamaChat(s.ollamaUrl, s.ollamaModel || "gemma4:e2b", system, prompt);
      if (text?.trim()) return { url: null, text, source: `Ollama (${s.ollamaModel || "local"})` };
      if (hardFail) {
        // Don't abort entirely — try worker next — but remember for final error
        (generateDocument as unknown as { _ollamaFail?: string })._ollamaFail = hardFail;
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Worker AI
  try {
    const worker = (
      (import.meta as ImportMeta & { env?: { VITE_WORKER_URL?: string } }).env?.VITE_WORKER_URL ||
      "https://lifeos1-api.ceogps.workers.dev"
    ).replace(/\/$/, "");
    const r = await fetch(`${worker}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (r.ok) {
      const data = await r.json();
      const text = data?.text || data?.message || data?.content || "";
      if (text.trim()) return { url: null, text, source: data?.via || "Worker AI" };
    }
  } catch {
    /* fall through */
  }

  const ollamaFail = (generateDocument as unknown as { _ollamaFail?: string })._ollamaFail;
  throw new MissingBackendError(
    ollamaFail
      ? `Document writer: ${ollamaFail}. LM Studio and worker chat also unavailable.`
      : "Document writer needs LM Studio, Ollama, or worker chat.",
    {
      code: "both",
      services: ["LM Studio", "Ollama"],
      installHint:
        "Start LM Studio local server (port 1234) or Ollama (11434). If Ollama /api/tags works but chat 500s, repair llama-server.",
    },
  );
}

/** ComfyUI: queue a minimal API prompt if /prompt accepts it; otherwise honest CTA. */
async function comfyQueuePrompt(
  comfyUrl: string,
  workflow: Record<string, unknown>,
): Promise<string | null> {
  const base = comfyUrl.replace(/\/$/, "");
  const r = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const promptId = data?.prompt_id;
  if (!promptId) return null;

  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, 2000));
    const h = await fetch(`${base}/history/${promptId}`, { signal: AbortSignal.timeout(10000) });
    if (!h.ok) continue;
    const hist = await h.json();
    const entry = hist?.[promptId];
    if (!entry) continue;
    const outputs = entry.outputs || {};
    for (const nodeId of Object.keys(outputs)) {
      const images = outputs[nodeId]?.images;
      if (images?.[0]) {
        const img = images[0];
        const view = `${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${encodeURIComponent(img.type || "output")}`;
        return view;
      }
      const gifs = outputs[nodeId]?.gifs || outputs[nodeId]?.videos;
      if (gifs?.[0]) {
        const g = gifs[0];
        return `${base}/view?filename=${encodeURIComponent(g.filename)}&subfolder=${encodeURIComponent(g.subfolder || "")}&type=${encodeURIComponent(g.type || "output")}`;
      }
    }
    if (entry.status?.completed === false && entry.status?.status_str === "error") {
      throw new Error("ComfyUI workflow failed");
    }
  }
  return null;
}

/**
 * Built-in minimal SD txt2img workflow for stock ComfyUI checkpoint installs.
 * Uses CheckpointLoaderSimple + KSampler; may fail if no checkpoint named — caller falls through.
 */
function minimalTxt2ImgWorkflow(prompt: string): Record<string, unknown> {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 1e9),
        steps: 20,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: "v1-5-pruned-emaonly.safetensors" },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width: 512, height: 512, batch_size: 1 },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: "ugly, blurry, low quality", clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "Creator", images: ["8", 0] },
    },
  };
}

export async function runImageGen(
  prompt: string,
  endpoints?: EndpointStatus[],
  settings?: BackendSettings,
): Promise<GenResult> {
  const s = settingsOrStored(settings);
  const keys = await applyKeys();

  // 1) ComfyUI
  if (online(endpoints, "comfy") || s.preferLocal) {
    try {
      const url = await comfyQueuePrompt(s.comfyUrl, minimalTxt2ImgWorkflow(prompt));
      if (url) return { url, source: "ComfyUI (local)" };
    } catch {
      /* fall through — often missing default checkpoint */
    }
  }

  // 2) A1111
  if (online(endpoints, "a1111")) {
    try {
      const r = await fetch(`${s.a1111Url.replace(/\/$/, "")}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, steps: 20, width: 1024, height: 1024 }),
        signal: AbortSignal.timeout(180000),
      });
      if (r.ok) {
        const data = await r.json();
        const b64 = data?.images?.[0];
        if (b64) return { url: `data:image/png;base64,${b64}`, source: "A1111 / Fooocus (local)" };
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Cloud: Stability / Replicate / HF via ErebusMedia
  if (keys.stability || keys.replicate || keys.huggingface) {
    const out = await erebusImage(prompt);
    return { url: out.url, source: out.source };
  }

  // 4) NVIDIA NIM SDXL (if keyed)
  if (keys.nvidia) {
    try {
      const r = await fetch("https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keys.nvidia}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt, weight: 1 }],
          cfg_scale: 5,
          sampler: "K_DPM_2_ANCESTRAL",
          steps: 25,
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (r.ok) {
        const data = await r.json();
        const b64 = data?.artifacts?.[0]?.base64 || data?.image;
        if (b64) return { url: `data:image/png;base64,${b64}`, source: "NVIDIA NIM SDXL" };
      }
    } catch {
      /* fall through */
    }
  }

  throw new MissingBackendError(
    "Image generation needs ComfyUI (preferred local), A1111/Fooocus, or a cloud key (Stability / Replicate / HF / NVIDIA).",
    {
      code: "both",
      services: ["ComfyUI", "Stability AI", "Replicate", "Hugging Face", "NVIDIA NIM"],
      installHint:
        "Install ComfyUI and set its URL in Creator → Backends (default http://127.0.0.1:8188), or connect Stability/Replicate/HF/NVIDIA in Integrations.",
    },
  );
}

export async function runImageEdit(imageUrl: string, instruction: string): Promise<GenResult> {
  const keys = await applyKeys();
  if (!keys.stability && !keys.replicate) {
    throw new MissingBackendError(missingKeyMessage("stability"), {
      code: "cloud",
      services: ["Stability AI", "Replicate"],
      installHint: "Or edit in ComfyUI with an inpaint workflow, then import the result.",
    });
  }
  const out = await erebusEdit(imageUrl, instruction);
  return { url: out.url, source: out.source };
}

export async function runTxt2Vid(prompt: string, endpoints?: EndpointStatus[]): Promise<GenResult> {
  const keys = await applyKeys();
  const s = loadBackendSettings();

  if (online(endpoints, "comfy")) {
    throw new MissingBackendError(
      "ComfyUI is online, but Creator has no stock txt2vid workflow graph yet.",
      {
        code: "local",
        services: ["ComfyUI"],
        installHint:
          "Load a Wan / SVD / AnimateDiff workflow in ComfyUI and export API format, or connect Luma / Replicate / Runway for cloud txt2vid.",
      },
    );
  }

  if (!keys.luma && !keys.replicate && !keys.runway) {
    throw new MissingBackendError(
      "Text-to-video needs Luma, Replicate, or Runway — or a ComfyUI video workflow.",
      {
        code: "both",
        services: ["ComfyUI", "Luma", "Replicate", "Runway"],
        installHint: `Start ComfyUI at ${s.comfyUrl} with a video model, or connect Luma/Replicate/Runway in Integrations.`,
      },
    );
  }
  if (keys.runway && !keys.luma && !keys.replicate) {
    return runRunwayTextToVideo(prompt, keys.runway);
  }
  const out = await erebusVideo(prompt);
  return { url: out.url, source: out.source };
}

export async function runImg2Vid(
  imageUrl: string,
  motionPrompt: string,
  endpoints?: EndpointStatus[],
): Promise<GenResult> {
  const keys = await applyKeys();
  const s = loadBackendSettings();

  if (online(endpoints, "comfy") && !keys.luma && !keys.replicate && !keys.runway) {
    throw new MissingBackendError(
      "ComfyUI is online — use an img2vid / SVD / Wan workflow there, or connect a cloud video API.",
      {
        code: "local",
        services: ["ComfyUI"],
        installHint: `Open ComfyUI at ${s.comfyUrl}, run your img2vid graph, then import the video here — or add Luma/Replicate/Runway keys.`,
      },
    );
  }

  if (!keys.luma && !keys.replicate && !keys.runway) {
    throw new MissingBackendError(
      "Image-to-video needs Luma, Replicate (SVD), Runway, or ComfyUI.",
      {
        code: "both",
        services: ["ComfyUI", "Luma", "Replicate", "Runway"],
        installHint: "Prefer ComfyUI for local img2vid. Cloud: connect Luma / Replicate / Runway in Integrations.",
      },
    );
  }
  if (keys.runway && !keys.luma) {
    return runRunwayImageToVideo(imageUrl, motionPrompt, keys.runway);
  }
  const out = await erebusImg2Vid(imageUrl, motionPrompt);
  return { url: out.url, source: out.source };
}

async function runRunwayTextToVideo(prompt: string, key: string): Promise<GenResult> {
  const r = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      promptText: prompt,
      model: "gen3a_turbo",
      duration: 5,
      ratio: "1280:768",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Runway HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const task = await r.json();
  if (!task?.id) throw new Error("Runway returned no task id");
  return { url: await pollRunway(task.id, key), source: "Runway Gen-3" };
}

async function runRunwayImageToVideo(
  imageUrl: string,
  prompt: string,
  key: string,
): Promise<GenResult> {
  const r = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      promptImage: imageUrl,
      promptText: prompt || "smooth cinematic motion",
      model: "gen3a_turbo",
      duration: 5,
      ratio: "1280:768",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Runway HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const task = await r.json();
  if (!task?.id) throw new Error("Runway returned no task id");
  return { url: await pollRunway(task.id, key), source: "Runway Image-to-Video" };
}

async function pollRunway(taskId: string, key: string): Promise<string> {
  const deadline = Date.now() + 300000;
  let interval = 3000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const r = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" },
    });
    if (!r.ok) throw new Error(`Runway poll HTTP ${r.status}`);
    const data = await r.json();
    if (data.status === "SUCCEEDED") {
      const out = data.output?.[0] || data.output;
      if (typeof out === "string") return out;
      throw new Error("Runway succeeded but returned no URL");
    }
    if (data.status === "FAILED") {
      throw new Error(`Runway failed: ${data.failure || data.failureCode || "unknown"}`);
    }
    interval = Math.min(interval * 1.3, 12000);
  }
  throw new Error("Runway timed out after 5 minutes");
}

export async function runMusicVideo(opts: {
  imageUrl: string;
  prompt: string;
  songUrl?: string;
  endpoints?: EndpointStatus[];
}): Promise<GenResult> {
  const motion =
    opts.prompt.trim() ||
    "cinematic music video motion, rhythmic camera moves, beat-synced energy";
  const vid = await runImg2Vid(opts.imageUrl, motion, opts.endpoints);
  return {
    url: vid.url,
    source: `${vid.source} (music video)${opts.songUrl ? " + song" : ""}`,
  };
}

export async function runMusicGen(prompt: string, duration = 30): Promise<GenResult> {
  const keys = await applyKeys();

  // HF MusicGen direct
  if (keys.huggingface) {
    try {
      const r = await fetch(
        "https://api-inference.huggingface.co/models/facebook/musicgen-small",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${keys.huggingface}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { max_new_tokens: Math.min(256, Math.floor(duration * 50)) },
          }),
          signal: AbortSignal.timeout(180000),
        },
      );
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size > 100) {
          return { url: URL.createObjectURL(blob), source: "Hugging Face MusicGen" };
        }
      }
    } catch {
      /* fall through */
    }
  }

  if (keys.replicate) {
    const out = await erebusMusic(prompt, { duration });
    return { url: out.url, source: out.source };
  }

  throw new MissingBackendError(
    "Music generation needs Hugging Face Inference or Replicate (MusicGen / Stable Audio). No local music server detected.",
    {
      code: "cloud",
      services: ["Hugging Face", "Replicate", "NVIDIA NIM"],
      installHint:
        "Connect Hugging Face or Replicate in Integrations. NVIDIA NIM music models can be added when an endpoint is configured.",
    },
  );
}

export async function runVoice(
  text: string,
  opts?: { endpoints?: EndpointStatus[]; voice?: string; settings?: BackendSettings },
): Promise<GenResult> {
  const s = settingsOrStored(opts?.settings);
  if (online(opts?.endpoints, "kokoro")) {
    try {
      const r = await fetch(`${s.kokoroUrl.replace(/\/$/, "")}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: opts?.voice || "af_heart", speed: 1.0 }),
        signal: AbortSignal.timeout(60000),
      });
      if (r.ok) {
        const blob = await r.blob();
        return { url: URL.createObjectURL(blob), source: "Kokoro TTS (local)" };
      }
    } catch {
      /* fall through */
    }
  }

  const keys = await applyKeys();

  // NVIDIA Magpie / FastPitch style TTS if available via NIM — honest skip if not
  if (keys.elevenlabs) {
    const out = await erebusSpeech(text);
    if (!out.url && out.spoken) return { url: null, source: out.source, spoken: true, text };
    return { url: out.url, source: out.source };
  }

  if (keys.huggingface) {
    try {
      const r = await fetch(
        "https://api-inference.huggingface.co/models/espnet/kan-bayashi_ljspeech_vits",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${keys.huggingface}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: text }),
          signal: AbortSignal.timeout(120000),
        },
      );
      if (r.ok) {
        const blob = await r.blob();
        if (blob.size > 100) return { url: URL.createObjectURL(blob), source: "Hugging Face TTS" };
      }
    } catch {
      /* fall through */
    }
  }

  throw new MissingBackendError(
    "Voice needs Kokoro (local :8880), ElevenLabs, or Hugging Face TTS.",
    {
      code: "both",
      services: ["Kokoro", "ElevenLabs", "Hugging Face"],
      installHint:
        "Run `python kokoro-server.py` (port 8880), or connect ElevenLabs / Hugging Face in Integrations.",
    },
  );
}

export async function runVoiceClone(opts: {
  text: string;
  referenceAudioUrl?: string;
  voiceName?: string;
}): Promise<GenResult> {
  const keys = await applyKeys();
  if (!keys.elevenlabs) {
    throw new MissingBackendError(missingKeyMessage("elevenlabs"), {
      code: "cloud",
      services: ["ElevenLabs"],
      installHint:
        "Voice cloning uses ElevenLabs IVC. Local RVC is not wired yet — connect ElevenLabs in Integrations.",
    });
  }
  if (!opts.referenceAudioUrl) {
    const out = await erebusSpeech(opts.text);
    return { url: out.url, source: `${out.source} (no clone sample — standard TTS)` };
  }
  const refRes = await fetch(opts.referenceAudioUrl);
  const refBlob = await refRes.blob();
  const form = new FormData();
  form.append("name", opts.voiceName || `Creator Clone ${Date.now()}`);
  form.append("files", refBlob, "reference.wav");
  const create = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": keys.elevenlabs },
    body: form,
    signal: AbortSignal.timeout(120000),
  });
  if (!create.ok) {
    throw new Error(`ElevenLabs clone HTTP ${create.status}: ${(await create.text()).slice(0, 200)}`);
  }
  const voice = await create.json();
  const voiceId = voice?.voice_id;
  if (!voiceId) throw new Error("ElevenLabs returned no voice_id");
  const tts = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": keys.elevenlabs,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: opts.text, model_id: "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(60000),
  });
  if (!tts.ok) throw new Error(`ElevenLabs TTS HTTP ${tts.status}`);
  const blob = await tts.blob();
  return { url: URL.createObjectURL(blob), source: `ElevenLabs clone (${voiceId.slice(0, 8)}…)` };
}
