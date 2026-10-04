// --- useErebusVoice ----------------------------------------------------------
// src/lib/agents/erebus/hooks/useErebusVoice.ts
//
// Gives Erebus a real voice.
//
//   say(text)  queue an utterance; utterances drain serially. The returned
//              promise resolves when that utterance has finished (or was
//              skipped because the hook is muted / stopped).
//   stop()     clear the queue, stop the face, cancel speechSynthesis.
//
// Per utterance:
//   1. POST {KOKORO_URL}/tts  { text, voice, speed }  ->  audio/wav blob
//   2. URL.createObjectURL(blob) -> faceRef.current.speak(url) -> revoke URL
//   3. If the POST fails or the server is offline -> window.speechSynthesis
//
// PATCH (erebus-dock-redesign): `volume` option (0..1) applied to Kokoro audio
// (GainNode in ErebusFace / <audio>.volume) and speechSynthesis; lang_code is
// derived from the voice id prefix (a = US, b = UK); KOKORO_VOICES lists the
// Kokoro voices for the dock's voice picker.
//
// KOKORO_URL comes from import.meta.env.VITE_KOKORO_URL
// (default http://localhost:8880). The server is probed once on mount with
// GET /health (1.5 s timeout); serverOnline is null until that probe returns.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ErebusFaceHandle } from "../ui/ErebusFace";

const DEFAULT_KOKORO_URL = "http://localhost:8880";

export const KOKORO_URL: string = String(
  import.meta.env?.VITE_KOKORO_URL || DEFAULT_KOKORO_URL,
).replace(/\/+$/, "");

/** Kokoro-82M voices (id prefix: a/b = US/UK English, f/m = female/male). */
export const KOKORO_VOICES: { id: string; label: string }[] = [
  { id: "af_heart", label: "Heart (US F)" },
  { id: "af_bella", label: "Bella (US F)" },
  { id: "af_nicole", label: "Nicole (US F)" },
  { id: "af_sarah", label: "Sarah (US F)" },
  { id: "af_sky", label: "Sky (US F)" },
  { id: "af_nova", label: "Nova (US F)" },
  { id: "am_adam", label: "Adam (US M)" },
  { id: "am_michael", label: "Michael (US M)" },
  { id: "am_onyx", label: "Onyx (US M)" },
  { id: "bf_emma", label: "Emma (UK F)" },
  { id: "bf_isabella", label: "Isabella (UK F)" },
  { id: "bm_george", label: "George (UK M)" },
  { id: "bm_lewis", label: "Lewis (UK M)" },
];

const HEALTH_TIMEOUT_MS = 1500;
// First request after the server starts loads the model; give it time.
const TTS_TIMEOUT_MS = 60000;
// When the server was found offline, re-probe at most this often.
const REPROBE_INTERVAL_MS = 15000;

export interface UseErebusVoiceOptions {
  faceRef: RefObject<ErebusFaceHandle | null>;
  voice?: string;
  speed?: number;
  /** 0..1 output volume. */
  volume?: number;
  onSpeakStart?: (text: string) => void;
  onSpeakEnd?: (text: string) => void;
  onError?: (error: unknown) => void;
}

export interface UseErebusVoiceResult {
  say: (text: string) => Promise<void>;
  stop: () => void;
  muted: boolean;
  setMuted: (value: boolean | ((prev: boolean) => boolean)) => void;
  isSpeaking: boolean;
  serverOnline: boolean | null;
  queued: number;
}

interface QueueItem {
  text: string;
  resolve: () => void;
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return (AbortSignal as typeof AbortSignal & {
      timeout: (ms: number) => AbortSignal;
    }).timeout(ms);
  }
  if (typeof AbortController === "undefined") return undefined;
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

export function useErebusVoice({
  faceRef,
  voice = "af_heart",
  speed = 1.0,
  volume = 1,
  onSpeakStart,
  onSpeakEnd,
  onError,
}: UseErebusVoiceOptions): UseErebusVoiceResult {
  const [muted, setMutedState] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [serverOnline, setServerOnlineState] = useState<boolean | null>(null);
  const [queued, setQueued] = useState(0);

  const mountedRef = useRef(true);
  const mutedRef = useRef(false);
  const serverOnlineRef = useRef<boolean | null>(null);
  const lastProbeRef = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);
  const drainingRef = useRef(false);
  const generationRef = useRef(0);
  const plainAudioRef = useRef<HTMLAudioElement | null>(null);
  const plainFinishRef = useRef<(() => void) | null>(null);

  // Latest options, so say() can stay referentially stable.
  const optsRef = useRef({ voice, speed, volume, onSpeakStart, onSpeakEnd, onError });
  optsRef.current = { voice, speed, volume, onSpeakStart, onSpeakEnd, onError };

  const setServerOnline = useCallback((v: boolean) => {
    serverOnlineRef.current = v;
    if (mountedRef.current) setServerOnlineState(v);
  }, []);

  const reportError = useCallback((e: unknown) => {
    try {
      optsRef.current.onError?.(e);
    } catch {
      /* ignore */
    }
  }, []);

  const probe = useCallback(async (): Promise<boolean> => {
    lastProbeRef.current = Date.now();
    try {
      const r = await fetch(`${KOKORO_URL}/health`, {
        signal: timeoutSignal(HEALTH_TIMEOUT_MS),
      });
      const ok = r.ok;
      setServerOnline(ok);
      return ok;
    } catch {
      setServerOnline(false);
      return false;
    }
  }, [setServerOnline]);

  // Plain <audio> playback, used when the face isn't mounted (e.g. the
  // floating avatar was closed or is showing a video).
  const playPlain = useCallback((url: string) => {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (plainFinishRef.current === finish) plainFinishRef.current = null;
        if (plainAudioRef.current === audio) plainAudioRef.current = null;
        resolve();
      };
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, optsRef.current.volume ?? 1));
      plainAudioRef.current = audio;
      plainFinishRef.current = finish;
      audio.onended = finish;
      audio.onerror = finish;
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(finish);
    });
  }, []);

  const speakWithSynthesis = useCallback((text: string) => {
    return new Promise<void>((resolve) => {
      const synth =
        typeof window !== "undefined" ? window.speechSynthesis : undefined;
      if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        resolve();
      };
      // Some browsers never fire onend; don't let the queue hang.
      const safety = setTimeout(
        finish,
        Math.max(4000, text.length * 120),
      );
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = Math.max(0.5, Math.min(2, optsRef.current.speed || 1));
        u.volume = Math.max(0, Math.min(1, optsRef.current.volume ?? 1));
        u.onend = finish;
        u.onerror = finish;
        synth.speak(u);
      } catch (e) {
        reportError(e);
        finish();
      }
    });
  }, [reportError]);

  const speakWithEleven = useCallback(
    async (text: string, generation: number): Promise<boolean> => {
      let key = "";
      let voiceId = "";
      try {
        key = localStorage.getItem("lifeos_eleven_key") || "";
        voiceId = localStorage.getItem("lifeos_eleven_voice") || "";
      } catch { /* ignore */ }
      if (!key) {
        try {
          const { resolveSavedKey } = await import("@/pages/dashboard/_lib/savedKeys");
          const saved = await resolveSavedKey(["elevenlabs", "eleven-labs", "ElevenLabs"]);
          key = saved.key || "";
        } catch { /* locked or missing */ }
      }
      if (!key) return false;
      if (!voiceId) {
        const listed = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": key },
        });
        if (!listed.ok) return false;
        const body = await listed.json();
        voiceId = body?.voices?.[0]?.voice_id || "";
        if (voiceId) {
          try { localStorage.setItem("lifeos_eleven_voice", voiceId); } catch { /* ignore */ }
        }
      }
      if (!voiceId) return false;
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      if (!blob.size || generation !== generationRef.current) return false;
      const url = URL.createObjectURL(blob);
      try {
        const face = faceRef.current;
        if (face) await face.speak(url, optsRef.current.volume ?? 1);
        else await playPlain(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      return true;
    },
    [faceRef, playPlain],
  );

  const speakWithKokoro = useCallback(
    async (text: string, generation: number): Promise<void> => {
      const { voice: v, speed: s } = optsRef.current;
      const res = await fetch(`${KOKORO_URL}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: v, speed: s, lang_code: String(v || "a").charAt(0) || "a" }),
        signal: timeoutSignal(TTS_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Kokoro /tts ${res.status}`);
      const blob = await res.blob();
      if (!blob.size) throw new Error("Kokoro /tts returned empty audio");
      if (blob.type && !blob.type.startsWith("audio/")) {
        throw new Error(`Kokoro /tts returned ${blob.type}, expected audio/wav`);
      }
      if (generation !== generationRef.current) return; // stopped meanwhile
      const url = URL.createObjectURL(blob);
      try {
        const face = faceRef.current;
        if (face) await face.speak(url, optsRef.current.volume ?? 1);
        else await playPlain(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [faceRef, playPlain],
  );

  const speakOne = useCallback(
    async (text: string, generation: number) => {
      try {
        optsRef.current.onSpeakStart?.(text);
      } catch {
        /* ignore */
      }
      if (mountedRef.current) setIsSpeaking(true);
      try {
        let online = serverOnlineRef.current;
        if (
          online === false &&
          Date.now() - lastProbeRef.current > REPROBE_INTERVAL_MS
        ) {
          online = await probe();
        }
        let spoken = false;
        try {
          spoken = await speakWithEleven(text, generation);
        } catch {
          spoken = false;
        }
        if (!spoken && online !== false) {
          try {
            await speakWithKokoro(text, generation);
            spoken = true;
            if (serverOnlineRef.current !== true) setServerOnline(true);
          } catch (e) {
            reportError(e);
            setServerOnline(false);
          }
        }
        if (!spoken && generation === generationRef.current) {
          await speakWithSynthesis(text);
        }
      } catch (e) {
        reportError(e);
      } finally {
        if (mountedRef.current) setIsSpeaking(false);
        try {
          optsRef.current.onSpeakEnd?.(text);
        } catch {
          /* ignore */
        }
      }
    },
    [probe, reportError, setServerOnline, speakWithEleven, speakWithKokoro, speakWithSynthesis],
  );

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift()!;
        if (mountedRef.current) setQueued(queueRef.current.length);
        const generation = generationRef.current;
        if (!mutedRef.current && mountedRef.current) {
          await speakOne(item.text, generation);
        }
        item.resolve();
      }
    } finally {
      drainingRef.current = false;
    }
  }, [speakOne]);

  const say = useCallback(
    (text: string): Promise<void> => {
      const clean = String(text ?? "").trim();
      if (!clean || mutedRef.current || !mountedRef.current) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        queueRef.current.push({ text: clean, resolve });
        if (mountedRef.current) setQueued(queueRef.current.length);
        void drain();
      });
    },
    [drain],
  );

  const stop = useCallback(() => {
    generationRef.current += 1;
    const pending = queueRef.current.splice(0);
    pending.forEach((item) => item.resolve());
    try {
      faceRef.current?.stop();
    } catch {
      /* ignore */
    }
    const plain = plainAudioRef.current;
    if (plain) {
      try {
        plain.pause();
      } catch {
        /* ignore */
      }
    }
    plainFinishRef.current?.();
    try {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    if (mountedRef.current) {
      setQueued(0);
      setIsSpeaking(false);
    }
  }, [faceRef]);

  const setMuted = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next =
        typeof value === "function" ? value(mutedRef.current) : value;
      mutedRef.current = next;
      if (mountedRef.current) setMutedState(next);
    },
    [],
  );

  // Mount: probe the server. Unmount: stop everything.
  useEffect(() => {
    mountedRef.current = true;
    void probe();
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [probe, stop]);

  return { say, stop, muted, setMuted, isSpeaking, serverOnline, queued };
}

export default useErebusVoice;
