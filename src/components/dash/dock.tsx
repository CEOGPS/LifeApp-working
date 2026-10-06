import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { newId, useMemory, type Memory } from "./memory";
import { soundPrefs } from "./sound";
import { defaultVoice, voiceId } from "./voices";
import { boardFacts } from "./facts";
import { matchedSkill, runAgentTool, skillBrief } from "./agent-tools";
import { YoutubeBox } from "./media-desk";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Mode = "chat" | "image" | "video" | "writer" | "code";

const SKINS = [
  { id: "nova", label: "Nova", src: "/agents/avatars/nova.mp4", video: true },
  { id: "nyx", label: "Nyx", src: "/agents/avatars/nyx.mp4", video: true },
  { id: "ember", label: "Ember", src: "/agents/avatars/ember.mp4", video: true },
];
const MODES: Mode[] = ["chat", "image", "video", "writer", "code"];

const MINDS = [
  { id: "grok", label: "Grok" },
  { id: "nvidia", label: "NVIDIA" },
  { id: "openai", label: "OpenAI" },
] as const;

function facts(data: Memory, question = "") {
  return boardFacts(data, question);
}

function browserVoice(text: string, volume: number, muted: boolean, onPulse: (level: number) => void, onEnd: () => void) {
  const prefs = soundPrefs();
  if (muted || prefs.muted || typeof window === "undefined" || !window.speechSynthesis) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const line = new SpeechSynthesisUtterance(text.slice(0, 500));
  line.volume = Math.min(volume, prefs.volume);
  line.onboundary = () => onPulse(0.35 + Math.random() * 0.65);
  line.onend = () => onEnd();
  line.onerror = () => onEnd();
  window.speechSynthesis.speak(line);
}

export function ErebusDock({ data, update, agent = "Erebus", compact = false }: { data: Memory; update: Update; agent?: "Erebus" | "Kranos"; compact?: boolean }) {
  const [skin, setSkin] = useState(agent === "Kranos" ? "nyx" : "nova");
  const [mode, setMode] = useState<Mode>("chat");
  const [draft, setDraft] = useState("");
  const [mic, setMic] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [clip, setClip] = useState("");
  const [status, setStatus] = useState("Ready");
  const [mind, setMind] = useState<(typeof MINDS)[number]["id"]>("grok");
  const [used, setUsed] = useState("Grok");
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(6));
  const hear = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const face = SKINS.find((row) => row.id === skin) || SKINS[0];

  useEffect(() => () => {
    hear.current?.stop();
    cancelAnimationFrame(frame.current);
    void audioRef.current?.close();
    window.speechSynthesis?.cancel();
  }, []);

  function paint(next: number[]) {
    setLevels(next);
  }

  async function say(text: string) {
    const prefs = soundPrefs();
    if (muted || prefs.muted) return;
    setStatus("Speaking");
    cancelAnimationFrame(frame.current);
    try {
      const { speakVoice } = await import("@/lib/lifeos/sync");
      const saved = data.notes.find((row) => row.title === `Agent · ${agent}`)?.body || "";
      const picked = saved.split("\n").find((line) => line.startsWith("Voice: "))?.slice(7).trim() || defaultVoice(agent);
      const result = await speakVoice({ data: { text: text.slice(0, 500), voice: voiceId(picked), key: data.keys.find((row) => row.name === "ElevenLabs")?.value || "" } });
      if (result.ok && result.audio) {
        const ctx = audioRef.current && audioRef.current.state !== "closed" ? audioRef.current : new AudioContext();
        audioRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        const raw = Uint8Array.from(atob(result.audio), (char) => char.charCodeAt(0));
        const copy = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        const buffer = await ctx.decodeAudioData(copy);
        const source = ctx.createBufferSource();
        const analyser = ctx.createAnalyser();
        const gain = ctx.createGain();
        analyser.fftSize = 64;
        gain.gain.value = Math.min(volume, prefs.volume);
        source.buffer = buffer;
        source.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);
        const bins = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(bins);
          paint(Array.from({ length: 28 }, (_, index) => 6 + (bins[index % bins.length] / 255) * 42));
          frame.current = requestAnimationFrame(tick);
        };
        source.onended = () => {
          cancelAnimationFrame(frame.current);
          paint(Array(28).fill(6));
          setStatus("Ready");
        };
        source.start();
        tick();
        return;
      }
    } catch { /* browser voice below */ }
    browserVoice(text, volume, muted, (level) => paint(Array.from({ length: 28 }, () => 6 + level * 36)), () => {
      paint(Array(28).fill(6));
      setStatus("Ready");
    });
  }

  function toggleMic() {
    if (mic) {
      hear.current?.stop();
      hear.current = null;
      setMic(false);
      setStatus("Ready");
      return;
    }
    const host = window as unknown as { webkitSpeechRecognition?: new () => { start: () => void; stop: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null } };
    const Rec = host.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.onresult = (event) => setDraft(event.results[0][0].transcript);
    rec.start();
    hear.current = rec;
    setMic(true);
    setStatus("Listening");
  }

  function ask(text: string) {
    const tag = agent === "Kranos" ? "kranos" : "erebus";
    const mine = { id: newId(), who: "You", text, mine: true, platform: tag };
    update((prev) => ({ ...prev, thread: [...prev.thread, mine] }));
    setStatus("Checking tools");
    void runAgentTool(data, text).then((tool) => {
      if (tool?.task) update((prev) => ({ ...prev, tasks: [{ id: newId(), title: tool.task || "", done: false }, ...prev.tasks] }));
      if (tool?.noteTitle) update((prev) => ({ ...prev, notes: [{ id: newId(), title: tool.noteTitle || "Note", body: tool.noteBody || "" }, ...prev.notes] }));
      const packed = [facts(data, text), skillBrief(), matchedSkill(text), tool ? `Tool result:\n${tool.text}` : ""].filter(Boolean).join("\n\n");
      return import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: text, facts: packed, mind, name: agent } })).then((result) => ({ result, tool }));
    }).then(({ result, tool }) => {
      const reply = [tool ? tool.text : "", result.ok && result.text ? result.text : ""].filter(Boolean).join("\n\n") || "None of the models answered. Switch intelligence and try again.";
      const via = MINDS.find((row) => row.id === result.mind)?.label || used;
      setUsed(via);
      update((prev) => ({ ...prev, thread: [...prev.thread, { id: newId(), who: `${agent} · ${via}`, text: reply, mine: false, platform: tag }] }));
      say(result.text || tool?.text || reply);
      setStatus(result.ok ? `Speaking · ${via}` : tool ? "Tool only" : "No model answered");
    }).catch(() => {
      const reply = "I only answer from what is saved on the board.";
      update((prev) => ({ ...prev, thread: [...prev.thread, { id: newId(), who: agent, text: reply, mine: false, platform: tag }] }));
      say(reply);
    });
  }

  function run(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (mode === "chat") {
      ask(text);
      return;
    }
    if (mode === "image") {
      void import("@/lib/lifeos/sync").then(({ makePicture }) => makePicture({ data: { prompt: text, key: data.keys.find((row) => row.name === "xAI")?.value || "" } })).then((result) => {
        update((prev) => ({
          ...prev,
          media: [{ id: newId(), title: `Image · ${text}`, body: result.url || text, at: new Date().toISOString() }, ...prev.media],
          links: result.url ? [{ id: newId(), label: `Image · ${text.slice(0, 40)}`, href: result.url }, ...prev.links] : prev.links,
        }));
        setClip("");
      setStatus(result.ok ? "Image saved to Media" : "Image brief saved");
      say(result.ok ? "Image saved to Media." : "Image brief saved. The picture service did not return a file.");
      }).catch(() => say("Image brief saved."));
      return;
    }
    if (mode === "video") {
      setClip(text);
      update((prev) => ({
        ...prev,
        media: [{ id: newId(), title: `Video · ${text.slice(0, 48)}`, body: text, at: new Date().toISOString() }, ...prev.media],
      }));
      setStatus("Video search saved");
      say("Video search saved to Media.");
      return;
    }
    if (mode === "writer") {
      void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: `Write this as a finished note:\n${text}`, facts: facts(data, text), mind, name: agent } })).then((result) => {
        const body = result.ok && result.text ? result.text : text;
        update((prev) => ({ ...prev, notes: [{ id: newId(), title: text.slice(0, 80), body }, ...prev.notes] }));
        setStatus("Draft saved to notes");
        say("Draft saved to notes.");
      }).catch(() => {
        update((prev) => ({ ...prev, notes: [{ id: newId(), title: text.slice(0, 80), body: text }, ...prev.notes] }));
        setStatus("Draft saved to notes");
        say("Draft saved to notes.");
      });
      return;
    }
    update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Code · ${text.slice(0, 48)}`, body: text }, ...prev.notes] }));
    setStatus("Code note saved");
    say("Code note saved.");
  }

  const lines = data.thread.filter((row) => (agent === "Kranos" ? row.platform === "kranos" : row.platform !== "kranos"));
  const modes = agent === "Kranos" ? (["chat"] as Mode[]) : MODES;
  const lastReply = [...lines].reverse().find((row) => !row.mine);
  return (
    <div className={`erebus-dock flex w-full flex-col items-center gap-3 ${compact ? "" : "module-card p-4"}`}>
      <div className={`az-ring relative overflow-hidden rounded-full ${compact ? "h-36 w-36" : "h-48 w-48"}`}>
        <video key={face.src} src={face.src} className="h-full w-full object-cover" autoPlay muted loop playsInline />
        <span className={`az-pip ${status.startsWith("Speaking") ? "is-talk" : mic ? "is-listen" : ""}`} />
      </div>
      <div className="text-center">
        <p className="font-display text-[11px] tracking-[0.22em]">{agent.toUpperCase()}</p>
        <p className="text-sm text-white/70">{face.label} · {status}</p>
      </div>
      <div className="flex h-10 items-end gap-1" aria-hidden>
        {levels.map((level, index) => <span key={index} className="az-bar w-1 rounded-full" style={{ height: level }} />)}
      </div>
      {modes.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {modes.map((row) => <button key={row} type="button" className={`quiet capitalize ${mode === row ? "is-on" : ""}`} onClick={() => setMode(row)}>{row}</button>)}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {MINDS.map((row) => <button key={row.id} type="button" className={`quiet ${mind === row.id ? "is-on" : ""}`} onClick={() => setMind(row.id)}>{row.label}</button>)}
        <span className="text-sm text-white/45">Using {used}</span>
      </div>
      <div className={`az-thread w-full overflow-y-auto px-4 py-3 text-base leading-7 ${compact ? "h-44" : "h-56"}`}>
        {mode === "chat" ? lines.slice(-12).map((row) => <p key={row.id} className={`py-1 ${row.mine ? "text-right" : ""}`}><span className="text-white/45">{row.who}: </span>{row.text}</p>) : null}
        {!lines.length && mode === "chat" ? <p className="text-sm text-white/40">Ask about the board. I only use what is saved.</p> : null}
        {mode === "video" ? <YoutubeBox apiKey={data.keys.find((row) => row.name === "YouTube")?.value || ""} query={clip} /> : null}
        {mode === "image" ? <p className="text-white/70">{status}. The picture is saved on Media when the service returns a file.</p> : null}
        {mode === "writer" ? <p className="text-white/70">{status}. The draft is saved under Notes.</p> : null}
        {mode === "code" ? <p className="text-white/70">{status}. The snippet is saved as a note.</p> : null}
      </div>
      {compact ? (
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          <button type="button" className="quiet" onClick={() => ask("What tasks are still open, and which one should I do first?")}>Tasks</button>
          <button type="button" className="quiet" onClick={() => ask("Which bills are unpaid, and what should I pay first?")}>Bills</button>
          <button type="button" className="quiet" onClick={() => ask("Which leads need a next step today?")}>Leads</button>
          <button type="button" className="quiet" onClick={() => { if (lastReply) void say(lastReply.text); }}>Speak</button>
          <button type="button" className="link-add" onClick={() => { if (!lastReply) return; update((prev) => ({ ...prev, notes: [{ id: newId(), title: `${agent} note`, body: lastReply.text }, ...prev.notes] })); setStatus("Saved to notes"); }}>Save</button>
          <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, thread: prev.thread.filter((row) => row.platform !== "kranos") }))}>Clear</button>
        </div>
      ) : null}
      <form className="flex w-full items-center gap-3" onSubmit={run}>
        <input className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/50 px-4 text-base" value={draft} placeholder={mode === "chat" ? `Message ${agent}` : mode} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" className="quiet is-on">Send</button>
      </form>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <button type="button" className={`quiet ${mic ? "is-on" : ""}`} onClick={toggleMic}>{mic ? "Mic on" : "Mic"}</button>
        <button type="button" className={`quiet ${muted ? "is-on" : ""}`} onClick={() => { setMuted((value) => !value); window.speechSynthesis?.cancel(); cancelAnimationFrame(frame.current); }}>{muted ? "Muted" : "Sound"}</button>
        <input className="h-1 w-28 accent-violet-300" type="range" min={0} max={1} step={0.05} value={volume} aria-label="Volume" onChange={(event) => setVolume(Number(event.target.value))} />
        {SKINS.map((row) => <button key={row.id} type="button" className={`quiet ${skin === row.id ? "is-on" : ""}`} onClick={() => setSkin(row.id)}>{row.label}</button>)}
      </div>
    </div>
  );
}

export function AgentFloat() {
  const { data, update } = useMemory();
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState({ right: 6, bottom: 10 });
  const drag = useRef<{ x: number; y: number; right: number; bottom: number } | null>(null);
  function down(event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, right: spot.right, bottom: spot.bottom };
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current) return;
    setSpot({
      right: Math.max(4, drag.current.right - (event.clientX - drag.current.x)),
      bottom: Math.max(6, drag.current.bottom - (event.clientY - drag.current.y)),
    });
  }
  return (
    <div className="fixed z-40" style={{ right: spot.right, bottom: spot.bottom }} data-sound="off">
      {open ? (
        <div className="az-dock w-[23rem] max-h-[calc(100dvh-6rem)] overflow-y-auto">
          <div className="mb-3 flex items-center gap-3">
            <button type="button" className="az-mini" onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} aria-label="Drag dock">
              <img src="/agents/az.webp" alt="" width="54" height="54" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[11px] tracking-[0.22em]">KRANOS</p>
              <p className="text-xs text-white/50">Nyx stays with you. Drag the seal to move.</p>
            </div>
            <button type="button" className="quiet" onClick={() => setOpen(false)}>Hide</button>
          </div>
          <ErebusDock data={data} update={update} agent="Kranos" compact />
        </div>
      ) : (
        <button
          type="button"
          className="az-seal"
          aria-label="Open Kranos"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(event) => {
            const moved = drag.current && Math.abs(event.clientX - drag.current.x) + Math.abs(event.clientY - drag.current.y) > 6;
            drag.current = null;
            if (!moved) setOpen(true);
          }}
        >
          <img src="/agents/az.webp" alt="" width="82" height="82" />
          <span className="az-live" />
        </button>
      )}
    </div>
  );
}
