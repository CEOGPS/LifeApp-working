// src/lib/agents/erebus/dock/useSpeechInput.ts
// Push-to-talk speech input using the browser's SpeechRecognition (Chrome/Edge).
// start() on press, stop() on release; onFinal(text) fires with the transcript.
import { useCallback, useEffect, useRef, useState } from "react";

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getCtor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useSpeechInput(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Rec | null>(null);
  const textRef = useRef("");
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;
  const supported = !!getCtor();

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      setError("Speech input needs Chrome or Edge");
      return;
    }
    if (recRef.current) return;
    setError(null);
    textRef.current = "";
    setInterim("");
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let finalText = "";
      let inter = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else inter += r[0].transcript;
      }
      textRef.current = finalText || textRef.current;
      setInterim((finalText + " " + inter).trim());
    };
    rec.onerror = (e: any) => {
      if (e?.error && e.error !== "aborted" && e.error !== "no-speech") setError(`Mic: ${e.error}`);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      const text = (textRef.current || "").trim();
      setInterim("");
      if (text) cbRef.current(text);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      recRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
