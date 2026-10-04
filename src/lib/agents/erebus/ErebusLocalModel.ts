// ErebusLocalModel.ts — Browser-embedded local AI (WebLLM via WebGPU)
//
// Fixes in this revision:
//   - WebGPU capability probe (fail fast on unsupported browsers)
//   - async unload that actually awaits engine teardown
//   - concurrent-load guard + safe model switching (unloads old engine)
//   - listener isolation (one bad listener can't break the rest)
//   - status transition validation (no late "ready" after error)
//   - progress NaN guard
//   - streaming chat helper
//   - isSupported() / dispose() exports for the UI
// ============================================================

let _engine: any = null;
let _status: "idle" | "loading" | "ready" | "error" = "idle"; // idle | loading | ready | error
let _progress = 0;
let _message = "";
let _modelId: string | null = null;
let _loadingPromise: Promise<any> | null = null;

interface LocalModelStatus {
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  message: string;
  model: string | null;
}

const _listeners = new Set<(snapshot: LocalModelStatus) => void>();

function normalizeModelId(modelId: string | string[] | null): string | null {
  if (Array.isArray(modelId)) return modelId.join(",");
  return modelId ?? null;
}

// ── Capability probe ─────────────────────────────────────────────────────────

/**
 * Returns true if the runtime can plausibly run WebLLM.
 * We check for navigator.gpu — the actual adapter request happens in load().
 */
export function isSupported() {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as any).gpu;
}

// ── Listener notification ────────────────────────────────────────────────────

function _snapshot(): LocalModelStatus {
  return {
    status: _status,
    progress: _progress,
    message: _message,
    model: _modelId,
  };
}

function _notify(): void {
  const snap = _snapshot();
  for (const fn of _listeners) {
    try {
      fn(snap);
    } catch {
      // A broken listener must not block the others.
    }
  }
}

/**
 * Subscribe to status changes.
 * Fires once immediately with the current snapshot, then on every change.
 * Returns an unsubscribe function.
 */
export function onLocalModelStatus(fn: (snapshot: LocalModelStatus) => void): () => boolean {
  if (typeof fn !== "function") return () => false;
  _listeners.add(fn);
  try {
    fn(_snapshot());
  } catch {
    // ignore subscriber error
  }
  return () => _listeners.delete(fn);
}

export function getLocalModelStatus() {
  return _snapshot();
}

// ── Model catalogue ──────────────────────────────────────────────────────────

export const LOCAL_MODELS = [
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    size: "0.8 GB",
    speed: "fastest",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    size: "2.2 GB",
    speed: "fast",
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi-3.5 Mini",
    size: "2.2 GB",
    speed: "fast",
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    label: "Gemma 2 2B",
    size: "1.5 GB",
    speed: "fast",
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 7B",
    size: "4.5 GB",
    speed: "medium",
  },
  {
    id: "DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC",
    label: "DeepSeek R1 7B",
    size: "4.5 GB",
    speed: "medium",
  },
];

// ── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load a model into the browser via WebLLM.
 *
 *   - If the requested model is already loaded, resolves immediately.
 *   - If a different model is loaded, unloads it first, then loads the new one.
 *   - If a load is already in flight, returns that same promise (no double init).
 *   - On failure, sets status to "error" with a readable message.
 *
 * @returns {Promise<object|null>} The engine instance, or null on failure.
 */
export async function loadLocalModel(modelId: string | string[] | null) {
  const normalizedModelId = normalizeModelId(modelId);

  // Same model already ready → return current engine.
  if (_status === "ready" && _modelId === normalizedModelId && _engine) {
    return _engine;
  }

  // Load in flight → hand back the same promise.
  if (_status === "loading" && _loadingPromise) {
    return _loadingPromise;
  }

  // Capability gate.
  if (!isSupported()) {
    _status = "error";
    _modelId = normalizedModelId;
    _progress = 0;
    _message =
      "WebGPU not available in this browser. Use Chrome or Edge 113+ (desktop).";
    _notify();
    return null;
  }

  // Switching models? Unload the current engine first so we don't leak VRAM.
  if (_engine && _modelId !== normalizedModelId) {
    try {
      await unloadLocalModel();
    } catch {
      // ignore — we're about to overwrite everything anyway
    }
  }

  _status = "loading";
  _modelId = normalizedModelId;
  _progress = 0;
  _message = "Initializing WebGPU…";
  _notify();

  // Capture this attempt so a stale resolution can't flip status later.
  const attemptModelId = normalizedModelId;

  if (!attemptModelId) {
    _status = "error";
    _message = "No model selected.";
    _progress = 0;
    _notify();
    _loadingPromise = null;
    return null;
  }

  _loadingPromise = (async () => {
    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(attemptModelId, {
        initProgressCallback: ({ progress, text }) => {
          // Ignore late callbacks from a superseded load attempt.
          if (_modelId !== attemptModelId) return;
          const p =
            typeof progress === "number" && Number.isFinite(progress)
              ? progress
              : 0;
          _progress = Math.max(0, Math.min(100, Math.round(p * 100)));
          _message = typeof text === "string" && text ? text : "Loading…";
          _notify();
        },
      });

      // If this attempt was superseded (user clicked a different model),
      // discard the engine we just built.
      if (_modelId !== attemptModelId) {
        try {
          await engine?.unload?.();
        } catch {
          /* ignore */
        }
        return null;
      }

      _engine = engine;
      _status = "ready";
      _progress = 100;
      _message = "Ready";
      _notify();
      return _engine;
    } catch (e: any) {
      if (_modelId === attemptModelId) {
        _status = "error";
        _message =
          (e && e.message) || "Failed to load model. Check WebGPU support.";
        _progress = 0;
        _notify();
      }
      _engine = null;
      return null;
    } finally {
      if (_modelId === attemptModelId) {
        _loadingPromise = null;
      }
    }
  })();

  return _loadingPromise;
}

// ── Unload ───────────────────────────────────────────────────────────────────

/**
 * Unload the current model and free GPU memory.
 * Awaits the engine's own teardown before clearing state.
 */
export async function unloadLocalModel() {
  const engine = _engine;
  _engine = null;

  // Any in-flight load should be considered cancelled.
  _loadingPromise = null;

  if (engine) {
    try {
      await engine.unload?.();
    } catch {
      // Engine teardown failures aren't fatal — we're dropping the ref.
    }
  }

  _status = "idle";
  _progress = 0;
  _message = "";
  _modelId = null;
  _notify();
}

// ── Chat (non-streaming) ─────────────────────────────────────────────────────

const MIN_TOKENS = 16;
const MAX_TOKENS = 8192;

type LocalChatMessage = {
  role: string;
  content?: string | null;
  [key: string]: unknown;
};

function clampTokens(n: number): number {
  if (!Number.isFinite(n)) return 1200;
  return Math.max(MIN_TOKENS, Math.min(MAX_TOKENS, Math.floor(n)));
}

/**
 * Single-turn chat against the loaded local model.
 * Returns the assistant text, or null if the engine isn't ready or the call fails.
 */
export async function localModelChat(
  system: string,
  messages: LocalChatMessage[],
  maxTokens = 1200,
): Promise<string | null> {
  if (!_engine || _status !== "ready") return null;
  try {
    const reply = await _engine.chat.completions.create({
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: clampTokens(maxTokens),
      temperature: 0.7,
    });
    return reply?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ── Chat (streaming) ─────────────────────────────────────────────────────────
// Optional helper. Callers pass an onDelta(chunk) callback and get the final
// text back when the stream ends. Errors yield null and stop iteration.

export async function localModelChatStream(
  system: string,
  messages: LocalChatMessage[],
  onDelta?: (chunk: string) => void,
  maxTokens = 1200,
): Promise<string | null> {
  if (!_engine || _status !== "ready") return null;
  let final = "";
  try {
    const stream = await _engine.chat.completions.create({
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: clampTokens(maxTokens),
      temperature: 0.7,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk?.choices?.[0]?.delta?.content || "";
      if (!delta) continue;
      final += delta;
      try {
        onDelta?.(delta);
      } catch {
        // A throwing consumer must not kill the stream.
      }
    }
    return final;
  } catch {
    return null;
  }
}

// ── Dispose ──────────────────────────────────────────────────────────────────

/**
 * Full teardown: unload the engine and clear listeners.
 * Call on app unmount / hot reload to avoid leaking GPU memory.
 */
export async function dispose() {
  await unloadLocalModel();
  _listeners.clear();
}