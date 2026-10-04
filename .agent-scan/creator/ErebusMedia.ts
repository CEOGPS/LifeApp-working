// ErebusMedia.ts — Direct-API media generation for Erebus
//
// Fixes in this revision:
//   - D-ID poll now uses `Basic ${didKey}` (was `btoa(didKey)` — broken)
//   - Object URLs are tracked and revoked on pagehide / explicit cleanup
//   - Replicate `Prefer: wait` removed (was blocking long generations)
//   - poll() uses exponential backoff with jitter and a hard attempt cap
//   - signalTimeout() helper for older Safari
//   - Optional durable-URL callback: if VITE_MEDIA_UPLOAD_URL is set, blobs
//     are POSTed there and the durable URL is returned instead of a blob URL
// ============================================================

const env = (k: string): string =>
  ((import.meta as any)?.env ? (import.meta as any).env[k] : "") || "";

const KEY = {
  stability: () => env("VITE_STABILITY_AI_API_KEY"),
  elevenlabs: () => env("VITE_ELEVENLABS_API_KEY"),
  replicate: () => env("VITE_REPLICATE_API_KEY"),
  luma: () => env("VITE_LUMA_API_KEY"),
  did: () => env("VITE_DID_API_KEY"),
  hf: () => env("VITE_HUGGINGFACE_API_KEY"),
  uploadUrl: () => env("VITE_MEDIA_UPLOAD_URL"),
};

// ── signalTimeout fallback ───────────────────────────────────────────────────
function signalTimeout(ms: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return (AbortSignal as any).timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

// ── Blob URL lifetime management ─────────────────────────────────────────────
// Every URL.createObjectURL() is registered here and revoked on pagehide.
// Callers that want earlier cleanup can call revokeMediaUrl(url).
const _blobUrls = new Set<string>();

function trackBlob(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  _blobUrls.add(url);
  return url;
}

export function revokeMediaUrl(url: string): void {
  if (!_blobUrls.has(url)) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
  _blobUrls.delete(url);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const url of _blobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    _blobUrls.clear();
  });
}

// ── Durable-URL helper ───────────────────────────────────────────────────────
// If VITE_MEDIA_UPLOAD_URL is configured (a Cloudflare Worker route that
// accepts a multipart blob and returns { url }), upload the blob and return
// a durable URL instead of a short-lived object URL.
async function toDurableUrl(blob: Blob, contentType: string): Promise<string | null> {
  const upload = KEY.uploadUrl();
  if (!upload) return null;
  try {
    const form = new FormData();
    form.append("file", blob, "media." + (contentType.split("/")[1] || "bin"));
    const r = await fetch(upload, {
      method: "POST",
      body: form,
      signal: signalTimeout(60000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.url || null;
  } catch {
    return null;
  }
}

// Blob → preferred URL (durable if upload route exists, else object URL)
async function blobToUrl(blob: Blob, contentType: string): Promise<string> {
  const durable = await toDurableUrl(blob, contentType);
  if (durable) return durable;
  return trackBlob(blob);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Polling with exponential backoff + jitter ────────────────────────────────
async function poll(
  url: string,
  headers: Record<string, string>,
  doneTest: (data: any) => any | null,
  maxMs = 180000,
  initialIntervalMs = 2000,
): Promise<any> {
  const deadline = Date.now() + maxMs;
  let interval = initialIntervalMs;
  while (Date.now() < deadline) {
    const jitter = Math.floor(Math.random() * (interval * 0.3));
    await delay(interval + jitter);
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`Poll error: ${r.status}`);
    const data = await r.json();
    const result = doneTest(data);
    if (result !== null && result !== undefined) return result;
    interval = Math.min(interval * 1.5, 15000);
  }
  throw new Error(
    "Generation timed out after " + Math.round(maxMs / 1000) + "s",
  );
}

// ── Replicate ────────────────────────────────────────────────────────────────
// Poll always; do not use `Prefer: wait` (blocks past browser timeouts).
async function replicateRun(
  owner: string,
  name: string,
  input: Record<string, unknown>,
  maxMs = 180000,
): Promise<any> {
  const key = KEY.replicate();
  if (!key) throw new Error("VITE_REPLICATE_API_KEY not set");
  const hdrs = {
    Authorization: `Token ${key}`,
    "Content-Type": "application/json",
  };
  const r = await fetch(
    `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
    {
      method: "POST",
      headers: hdrs,
      body: JSON.stringify({ input }),
      signal: signalTimeout(30000),
    },
  );
  if (!r.ok) throw new Error(`Replicate error: ${r.status} ${await r.text()}`);
  let pred = await r.json();
  if (pred.status === "succeeded") return pred.output;
  if (pred.status === "failed")
    throw new Error(`Replicate: ${pred.error || "failed"}`);
  return poll(
    pred.urls.get,
    { Authorization: `Token ${key}` },
    (d) => {
      if (d.status === "succeeded") return d.output;
      if (d.status === "failed")
        throw new Error(`Replicate: ${d.error || "failed"}`);
      return null;
    },
    maxMs,
  );
}

// ── Image Generation ─────────────────────────────────────────────────────────
export async function generateImage(prompt: string, options: any = {}) {
  const { width = 1024, height = 1024 } = options;

  // 1. Stability AI
  const stabKey = KEY.stability();
  if (stabKey) {
    try {
      const form = new FormData();
      form.append("prompt", prompt);
      form.append("output_format", "webp");
      const ar = width === height ? "1:1" : width > height ? "16:9" : "9:16";
      form.append("aspect_ratio", ar);
      const r = await fetch(
        "https://api.stability.ai/v2beta/stable-image/generate/core",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${stabKey}`, Accept: "image/*" },
          body: form,
          signal: signalTimeout(60000),
        },
      );
      if (r.ok) {
        const blob = await r.blob();
        const url = await blobToUrl(blob, "image/webp");
        return { url, source: "Stability AI SD3", prompt };
      }
    } catch {
      /* fall through */
    }
  }

  // 2. Replicate FLUX
  if (KEY.replicate()) {
    try {
      const out = await replicateRun("black-forest-labs", "flux-schnell", {
        prompt,
        num_outputs: 1,
      });
      const url = Array.isArray(out) ? out[0] : out;
      if (url) return { url, source: "FLUX Schnell (Replicate)", prompt };
    } catch {
      /* fall through */
    }
  }

  // 3. HuggingFace FLUX.1-schnell
  const hfKey = KEY.hf();
  if (hfKey) {
    try {
      const r = await fetch(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: prompt }),
          signal: signalTimeout(60000),
        },
      );
      if (r.ok) {
        const blob = await r.blob();
        const url = await blobToUrl(blob, "image/webp");
        return { url, source: "HuggingFace FLUX", prompt };
      }
    } catch {
      /* fall through */
    }
  }

  // 4. Pollinations (always works, no key)
  const polUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=flux&nologo=true&enhance=true&seed=${Math.floor(Math.random() * 99999)}`;
  return { url: polUrl, source: "Pollinations.ai (free)", prompt };
}

// ── Image Editing ────────────────────────────────────────────────────────────
export async function editImage(imageUrl: string, editDescription: string) {
  const stabKey = KEY.stability();
  if (stabKey) {
    try {
      const imgRes = await fetch(imageUrl);
      const imgBlob = await imgRes.blob();
      const form = new FormData();
      form.append("image", imgBlob, "image.webp");
      form.append("prompt", editDescription);
      form.append("output_format", "webp");
      const r = await fetch(
        "https://api.stability.ai/v2beta/stable-image/edit/inpaint",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${stabKey}`, Accept: "image/*" },
          body: form,
          signal: signalTimeout(60000),
        },
      );
      if (r.ok) {
        const blob = await r.blob();
        const url = await blobToUrl(blob, "image/webp");
        return {
          url,
          source: "Stability AI Edit",
          prompt: editDescription,
          original: imageUrl,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return generateImage(editDescription);
}

// ── Music Generation ─────────────────────────────────────────────────────────
export async function generateMusic(prompt: string, options: any = {}) {
  const { duration = 60 } = options;

  if (KEY.replicate()) {
    try {
      const out = await replicateRun(
        "stability-ai",
        "stable-audio-open",
        {
          prompt,
          seconds_total: Math.min(duration, 90),
          seconds_start: 0,
        },
        300000,
      );
      const url =
        typeof out === "string" ? out : Array.isArray(out) ? out[0] : null;
      if (url) return { url, source: "Stable Audio (Replicate)", prompt };
    } catch {
      /* fall through */
    }
  }

  if (KEY.replicate()) {
    try {
      const out = await replicateRun(
        "meta",
        "musicgen",
        {
          prompt,
          duration: Math.min(duration, 60),
          model_version: "large",
          output_format: "mp3",
          normalization_strategy: "peak",
        },
        300000,
      );
      const url = typeof out === "string" ? out : null;
      if (url) return { url, source: "MusicGen Large (Replicate)", prompt };
    } catch {
      /* fall through */
    }
  }

  const hfKey = KEY.hf();
  if (hfKey) {
    try {
      const r = await fetch(
        "https://api-inference.huggingface.co/models/facebook/musicgen-large",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: { duration: Math.min(duration, 30) },
          }),
          signal: signalTimeout(120000),
        },
      );
      if (r.ok) {
        const blob = await r.blob();
        const url = await blobToUrl(blob, "audio/mpeg");
        return { url, source: "MusicGen (HuggingFace)", prompt };
      }
    } catch {
      /* fall through */
    }
  }

  throw new Error("No music generation available. Add VITE_REPLICATE_API_KEY.");
}

// ── Text-to-Speech ───────────────────────────────────────────────────────────
const EL_VOICES: Record<string, string> = {
  default: "21m00Tcm4TlvDq8ikWAM",
  male: "IKne3meq5aSn9XLyUdCD",
  british: "N2lVS1w4EtoT3dr4eOWO",
};

export async function generateSpeech(text: string, options: any = {}) {
  const { voiceKey = "default" } = options;
  const voiceId = EL_VOICES[voiceKey] || EL_VOICES.default;

  const elKey = KEY.elevenlabs();
  if (elKey) {
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.85,
              style: 0.2,
              use_speaker_boost: true,
            },
          }),
          signal: signalTimeout(60000),
        },
      );
      if (r.ok) {
        const blob = await r.blob();
        const url = await blobToUrl(blob, "audio/mpeg");
        return { url, source: "ElevenLabs", text };
      }
    } catch {
      /* fall through */
    }
  }

  // Browser WebSpeech
  if (typeof window !== "undefined" && window.speechSynthesis) {
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    window.speechSynthesis.speak(utt);
    return { url: null, source: "WebSpeech", text, spoken: true };
  }

  throw new Error("No TTS available. Add VITE_ELEVENLABS_API_KEY.");
}

// ── Video Generation ─────────────────────────────────────────────────────────
export async function generateVideo(prompt: string, options: any = {}) {
  const { aspectRatio = "16:9" } = options;

  const lumaKey = KEY.luma();
  if (lumaKey) {
    try {
      const r = await fetch(
        "https://api.lumalabs.ai/dream-machine/v1/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lumaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            aspect_ratio: aspectRatio,
            loop: false,
          }),
          signal: signalTimeout(30000),
        },
      );
      if (r.ok) {
        const gen = await r.json();
        const videoUrl = await poll(
          `https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}`,
          { Authorization: `Bearer ${lumaKey}` },
          (d) => {
            if (d.state === "completed") return d.assets?.video;
            if (d.state === "failed")
              throw new Error(`Luma: ${d.failure_reason || "failed"}`);
            return null;
          },
          300000,
          3000,
        );
        return { url: videoUrl, source: "Luma Dream Machine", prompt };
      }
    } catch {
      /* fall through */
    }
  }

  if (KEY.replicate()) {
    try {
      const out = await replicateRun(
        "anotherjesse",
        "zeroscope-v2-xl",
        {
          prompt,
          num_frames: 24,
          fps: 8,
          num_inference_steps: 40,
        },
        300000,
      );
      const url = Array.isArray(out) ? out[0] : out;
      if (url) return { url, source: "Zeroscope (Replicate)", prompt };
    } catch {
      /* fall through */
    }
  }

  throw new Error(
    "No video generation available. Add VITE_LUMA_API_KEY or VITE_REPLICATE_API_KEY.",
  );
}

// ── Image-to-Video ───────────────────────────────────────────────────────────
export async function imageToVideo(
  imageUrl: string,
  motionPrompt = "smooth cinematic motion",
) {
  const lumaKey = KEY.luma();
  if (lumaKey) {
    try {
      const r = await fetch(
        "https://api.lumalabs.ai/dream-machine/v1/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lumaKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: motionPrompt,
            keyframes: { frame0: { type: "image", url: imageUrl } },
          }),
          signal: signalTimeout(30000),
        },
      );
      if (r.ok) {
        const gen = await r.json();
        const videoUrl = await poll(
          `https://api.lumalabs.ai/dream-machine/v1/generations/${gen.id}`,
          { Authorization: `Bearer ${lumaKey}` },
          (d) => {
            if (d.state === "completed") return d.assets?.video;
            if (d.state === "failed")
              throw new Error(`Luma: ${d.failure_reason || "failed"}`);
            return null;
          },
          300000,
          3000,
        );
        return {
          url: videoUrl,
          source: "Luma Image-to-Video",
          imageUrl,
          prompt: motionPrompt,
        };
      }
    } catch {
      /* fall through */
    }
  }

  if (KEY.replicate()) {
    try {
      const out = await replicateRun(
        "stability-ai",
        "stable-video-diffusion",
        {
          input_image: imageUrl,
          video_length: "25_frames_with_svd_xt",
          sizing_strategy: "maintain_aspect_ratio",
          frames_per_second: 6,
          decoding_t: 4,
        },
        300000,
      );
      const url = Array.isArray(out) ? out[0] : out;
      if (url)
        return { url, source: "Stable Video Diffusion (Replicate)", imageUrl };
    } catch {
      /* fall through */
    }
  }

  throw new Error("No image-to-video API. Add VITE_LUMA_API_KEY.");
}

// ── Talking Avatar (D-ID) ────────────────────────────────────────────────────
// PUBLIC DEMO AVATAR — replace via options.sourceUrl if the user has a
// custom avatar image.
const DEFAULT_AVATAR = "https://d-id-public-bucket.s3.amazonaws.com/alice.jpg";

export async function generateAvatar(script: string, options: any = {}) {
  const {
    sourceUrl = DEFAULT_AVATAR,
    voiceId = "en-US-JennyNeural",
    provider = "microsoft",
  } = options;

  const didKey = KEY.did();
  if (!didKey) throw new Error("VITE_DID_API_KEY not set in .env.local");

  // CRITICAL FIX: D-ID expects `Basic <raw_key>`, NOT base64-of-key. The
  // previous poll call wrapped the key in btoa() and 401'd every time.
  const authHeader = `Basic ${didKey}`;

  const r = await fetch("https://api.d-id.com/talks", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      source_url: sourceUrl,
      script: {
        type: "text",
        input: script,
        provider: { type: provider, voice_id: voiceId },
      },
      config: { fluent: true, pad_audio: 0.0 },
    }),
    signal: signalTimeout(30000),
  });

  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`D-ID ${r.status}: ${msg}`);
  }
  const talk = await r.json();

  const videoUrl = await poll(
    `https://api.d-id.com/talks/${talk.id}`,
    { Authorization: authHeader }, // same header, raw key
    (d) => {
      if (d.status === "done") return d.result_url;
      if (d.status === "error")
        throw new Error(`D-ID: ${d.error?.description || "failed"}`);
      return null;
    },
    120000,
    2000,
  );

  return { url: videoUrl, source: "D-ID Avatar", talkId: talk.id, script };
}