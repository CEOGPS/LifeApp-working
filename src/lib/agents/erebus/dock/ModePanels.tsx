// src/lib/agents/erebus/dock/ModePanels.tsx
// Dock modes beyond quick chat. All real backends from Chris's stack:
//   Writer -> stackChat (Erebus backend -> Ollama -> NVIDIA)
//   Image  -> NVIDIA genai (FLUX.1-dev / schnell)
//   Sound  -> Kokoro TTS (downloadable WAV)
//   Video  -> no video backend in the stack yet: shows live status, never fakes
import { useEffect, useRef, useState } from "react";
import { Loader2, Copy, Download, Wand2, Volume2, Send, Film } from "lucide-react";
import { stackChat, stackImage, stackSpeech, probeVideoBackend } from "./erebusStack";
import { useDockStore } from "./dockStore";
import { KOKORO_VOICES } from "../hooks/useErebusVoice";

const box = "w-full rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-primary/50 p-2.5";
const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/25 text-white text-xs font-medium hover:bg-primary/40 disabled:opacity-40 disabled:cursor-not-allowed";
const ghostBtn = "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-white/60 hover:text-white hover:bg-white/10";

function ErrorNote({ text }: { text: string }) {
  return <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 whitespace-pre-wrap">{text}</div>;
}

const WRITER_TASKS: Record<string, string> = {
  draft: "Write a clear, well-structured draft for the request below.",
  rewrite: "Rewrite the provided text to be clearer and stronger. Keep the meaning.",
  summarize: "Summarize the provided text into tight bullet points.",
  expand: "Expand the provided notes into polished prose.",
  email: "Write a concise professional email for the request below.",
  social: "Write a punchy social media post (with a short hook) for the request below.",
};

export function WriterMode() {
  const [task, setTask] = useState("draft");
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState("");
  const [via, setVia] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const say = useDockStore((s) => s.say);
  const sendChat = useDockStore((s) => s.sendChat);

  const run = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setErr("");
    useDockStore.getState().setActivity("thinking");
    const res = await stackChat(
      `You are Erebus in Writer mode for Chris. ${WRITER_TASKS[task]} Output only the finished text, no preamble.`,
      [{ role: "user", content: prompt }],
      { maxTokens: 1500 },
    );
    useDockStore.getState().setActivity("idle");
    setBusy(false);
    if (res.ok) {
      setOut(res.text);
      setVia(res.via);
    } else setErr(res.error);
  };

  return (
    <div className="p-3 space-y-2" data-testid="mode-writer">
      <div className="flex flex-wrap gap-1">
        {Object.keys(WRITER_TASKS).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTask(t)}
            className={`px-2 py-1 rounded-md text-[11px] capitalize border ${task === t ? "bg-primary/25 border-primary/50 text-white" : "border-white/10 text-white/50 hover:text-white"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="What should Erebus write? Paste text to rewrite/summarize…" className={box} />
      <button type="button" className={primaryBtn} disabled={busy || !prompt.trim()} onClick={() => void run()}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Write
      </button>
      {err && <ErrorNote text={err} />}
      {out && (
        <div className="space-y-1">
          <div className="text-sm text-white/90 whitespace-pre-wrap bg-black/30 rounded-xl p-3 max-h-64 overflow-y-auto">{out}</div>
          <div className="flex items-center gap-1">
            <button type="button" className={ghostBtn} onClick={() => void navigator.clipboard?.writeText(out)}>
              <Copy size={11} /> Copy
            </button>
            <button type="button" className={ghostBtn} onClick={() => void say(out.slice(0, 900))}>
              <Volume2 size={11} /> Read aloud
            </button>
            <button type="button" className={ghostBtn} onClick={() => void sendChat(`Here is a draft, give me feedback:\n\n${out}`)}>
              <Send size={11} /> Discuss in chat
            </button>
            <span className="ml-auto text-[10px] text-white/30">{via}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ImageMode() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(1024);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [images, setImages] = useState<{ url: string; prompt: string; via: string }[]>([]);

  const run = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    setErr("");
    useDockStore.getState().setActivity("thinking");
    const res = await stackImage(prompt.trim(), size);
    useDockStore.getState().setActivity("idle");
    setBusy(false);
    if (res.ok) setImages((p) => [{ url: res.url, prompt: prompt.trim(), via: res.via }, ...p].slice(0, 8));
    else setErr(res.error);
  };

  return (
    <div className="p-3 space-y-2" data-testid="mode-image">
      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image…" className={box} />
      <div className="flex items-center gap-2">
        <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white/80" aria-label="Image size">
          <option value={768}>768²</option>
          <option value={1024}>1024²</option>
        </select>
        <button type="button" className={primaryBtn} disabled={busy || !prompt.trim()} onClick={() => void run()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Generate
        </button>
        <span className="text-[10px] text-white/30">NVIDIA FLUX</span>
      </div>
      {err && <ErrorNote text={err} />}
      <div className="grid grid-cols-2 gap-2">
        {images.map((im, i) => (
          <figure key={i} className="relative group rounded-lg overflow-hidden border border-white/10">
            <img src={im.url} alt={im.prompt} className="w-full aspect-square object-cover" />
            <a href={im.url} download={`erebus-${Date.now()}.jpg`} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white/80 opacity-0 group-hover:opacity-100" title="Download">
              <Download size={12} />
            </a>
            <figcaption className="text-[9px] text-white/40 px-1 py-0.5 truncate">{im.via}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function SoundMode() {
  const settings = useDockStore((s) => s.settings);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(settings.voice);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [clips, setClips] = useState<{ url: string; text: string; via: string }[]>([]);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr("");
    const res = await stackSpeech(text.trim(), voice, settings.speed);
    setBusy(false);
    if (res.ok) {
      urls.current.push(res.url);
      setClips((p) => [{ url: res.url, text: text.trim(), via: res.via }, ...p].slice(0, 6));
    } else setErr(res.error);
  };

  return (
    <div className="p-3 space-y-2" data-testid="mode-sound">
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to turn into a voice clip…" className={box} />
      <div className="flex items-center gap-2">
        <select value={voice} onChange={(e) => setVoice(e.target.value)} className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white/80" aria-label="Clip voice">
          {KOKORO_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="button" className={primaryBtn} disabled={busy || !text.trim()} onClick={() => void run()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />} Generate clip
        </button>
      </div>
      <div className="text-[10px] text-white/30">Kokoro TTS (local). Music/SFX need a local audio model; none is running yet.</div>
      {err && <ErrorNote text={err} />}
      {clips.map((c, i) => (
        <div key={i} className="rounded-lg border border-white/10 p-2 space-y-1">
          <div className="text-[11px] text-white/60 truncate">{c.text}</div>
          <audio controls src={c.url} className="w-full h-8" />
          <a href={c.url} download={`erebus-voice-${i}.wav`} className={ghostBtn}>
            <Download size={11} /> WAV · {c.via}
          </a>
        </div>
      ))}
    </div>
  );
}

export function VideoMode() {
  const [status, setStatus] = useState<{ comfy: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    probeVideoBackend().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="p-3 space-y-2 text-xs text-white/60" data-testid="mode-video">
      <div className="flex items-center gap-2 text-white/80">
        <Film size={14} /> Video generation
      </div>
      {status === null ? (
        <div className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Checking local video backends…
        </div>
      ) : status.comfy ? (
        <ErrorNote text="ComfyUI is running on localhost:8188, but no Erebus video workflow is wired yet. Next step: pick a video workflow (e.g. Wan / LTX) and I'll hook it here." />
      ) : (
        <ErrorNote text={"No video backend in your stack is running.\nErebus backend (:8000) and Ollama don't generate video, and the NVIDIA key has no video model wired. Start ComfyUI (localhost:8188) with a video workflow to enable this mode."} />
      )}
      <div className="text-[10px] text-white/30">Nothing is faked here: this mode stays disabled until a real backend answers.</div>
    </div>
  );
}
