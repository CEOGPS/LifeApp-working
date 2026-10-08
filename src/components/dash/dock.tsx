import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { newId, useMemory, type Memory } from "./memory";
import { soundPrefs } from "./sound";
import { defaultVoice, readClones, VOICES } from "./voices";
import { boardFacts } from "./facts";
import { matchedSkill, runAgentTool, skillBrief } from "./agent-tools";
import { YoutubeBox } from "./media-desk";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Mode = "chat" | "image" | "video" | "writer" | "code";

const SKINS = [
  { id: "nova", label: "Nova", src: "/agents/stills/nova.jpg" },
  { id: "nyx", label: "Nyx", src: "/agents/stills/nyx.jpg" },
  { id: "ember", label: "Ember", src: "/agents/stills/ember.jpg" },
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

function speakable(text: string) {
  const names: [string, string][] = [
    ["youtube.com", "YouTube"], ["youtu.be", "YouTube"], ["google.com", "Google"], ["gmail.com", "Gmail"],
    ["spotify.com", "Spotify"], ["instagram.com", "Instagram"], ["facebook.com", "Facebook"], ["x.com", "X"],
    ["twitter.com", "X"], ["linkedin.com", "LinkedIn"], ["tiktok.com", "TikTok"], ["github.com", "GitHub"],
  ];
  return text.replace(/https?:\/\/[^\s)]+/gi, (url) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return names.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || host.split(".")[0];
    } catch {
      return "a link";
    }
  }).replace(/\s+/g, " ").trim();
}

function browserVoice(text: string, volume: number, muted: boolean, onPulse: (level: number) => void, onEnd: () => void) {
  const prefs = soundPrefs();
  if (muted || prefs.muted || typeof window === "undefined" || !window.speechSynthesis) { onEnd(); return; }
  const speak = () => {
    window.speechSynthesis.cancel();
    const line = new SpeechSynthesisUtterance(text.slice(0, 500));
    const voices = window.speechSynthesis.getVoices();
    const female = voices.find((voice) => /female|woman|samantha|victoria|zira|sara|susan|karen|moira|aria|jenny|hazel|natasha|libby|sonia/i.test(voice.name))
      || voices.find((voice) => /en/i.test(voice.lang) && !/male|david|mark|daniel|guy|ryan|andrew|brian|eric|george|james/i.test(voice.name));
    if (female) line.voice = female;
    line.pitch = female ? 1.05 : 1.45;
    line.volume = Math.min(volume, prefs.volume);
    line.onboundary = () => onPulse(0.35 + Math.random() * 0.65);
    line.onend = () => onEnd();
    line.onerror = () => onEnd();
    window.speechSynthesis.speak(line);
  };
  if (window.speechSynthesis.getVoices().length) speak();
  else window.speechSynthesis.addEventListener("voiceschanged", () => speak(), { once: true });
}

export function VoiceClone({ data, update, onReady }: { data: Memory; update: Update; onReady?: (id: string) => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  async function clone(file: File) {
    if (file.size > 6_000_000) { setNote("Use a sample under 6 MB."); return; }
    setNote("Cloning…");
    const audio = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.readAsDataURL(file);
    });
    const label = name.trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Clone";
    const { cloneVoice } = await import("@/lib/lifeos/sync");
    const result = await cloneVoice({ data: { name: label, audio, type: file.type || "audio/mpeg", key: data.keys.find((row) => row.name === "ElevenLabs")?.value || "" } });
    if (!result.ok || !result.id) { setNote(result.text); return; }
    update((prev) => {
      const clones = readClones(prev.notes).filter((row) => row.id !== result.id);
      clones.push({ name: label, id: result.id });
      return { ...prev, notes: [{ id: newId(), title: "Voice · Clones", body: JSON.stringify(clones) }, ...prev.notes.filter((row) => row.title !== "Voice · Clones")] };
    });
    onReady?.(result.id);
    setNote(`${label} is ready. Pick it in Voice.`);
    setName("");
  }
  return (
    <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-2">
      <input className="h-8 w-28 rounded-full border border-white/15 bg-black/50 px-3 text-sm" placeholder="Clone name" value={name} onChange={(event) => setName(event.target.value)} />
      <label className="quiet">Clone voice
        <input className="hidden" type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void clone(file); event.target.value = ""; }} />
      </label>
      {note ? <span className="text-xs text-white/50">{note}</span> : null}
    </div>
  );
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
  const [voice, setVoice] = useState(() => {
    const stored = data.notes.find((row) => row.title === `Agent · ${agent}`)?.body.split("\n").find((line) => line.startsWith("Voice: "))?.slice(7).trim() || "";
    const clones = readClones(data.notes);
    return VOICES.some((row) => row.id === stored) || clones.some((row) => row.id === stored) ? stored : defaultVoice(agent);
  });
  const hear = useRef<{ stop: () => void } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const face = agent === "Kranos" ? SKINS[1] : (SKINS.find((row) => row.id === skin && row.id !== "nyx") || SKINS[0]);

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
    const spoken = speakable(text);
    const prefs = soundPrefs();
    if (muted || prefs.muted || !spoken) return;
    setStatus("Speaking");
    cancelAnimationFrame(frame.current);
    try {
      const { speakVoice } = await import("@/lib/lifeos/sync");
      const result = await speakVoice({ data: { text: spoken.slice(0, 500), voice, key: data.keys.find((row) => row.name === "ElevenLabs")?.value || "" } });
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
    browserVoice(spoken, volume, muted, (level) => paint(Array.from({ length: 28 }, () => 6 + level * 36)), () => {
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
      if (tool?.play) {
        setMode("video");
        setClip(tool.play);
        window.dispatchEvent(new CustomEvent("lifeos:youtube", { detail: tool.play }));
        update((prev) => ({ ...prev, thread: [...prev.thread, { id: newId(), who: agent, text: tool.text, mine: false, platform: tag }] }));
        say(tool.spoken || "Playing it on YouTube.");
        setStatus("Playing");
        return null;
      }
      const packed = [facts(data, text), skillBrief(), matchedSkill(text), tool ? `Tool result:\n${tool.text}` : ""].filter(Boolean).join("\n\n");
      return import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: text, facts: packed, mind, name: agent } })).then((result) => ({ result, tool }));
    }).then((payload) => {
      if (!payload) return;
      const { result, tool } = payload;
      const reply = [tool ? tool.text : "", result.ok && result.text ? result.text : ""].filter(Boolean).join("\n\n") || "None of the models answered. Switch intelligence and try again.";
      const via = MINDS.find((row) => row.id === result.mind)?.label || used;
      setUsed(via);
      update((prev) => ({ ...prev, thread: [...prev.thread, { id: newId(), who: `${agent} · ${via}`, text: reply, mine: false, platform: tag }] }));
      say(tool?.spoken || result.text || tool?.text || reply);
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
    <div className={`erebus-dock flex w-full min-h-0 flex-col overflow-hidden ${compact ? "h-full gap-1.5" : "module-card max-h-[calc(100dvh-5.5rem)] gap-2 p-3"}`}>
      <div className="flex shrink-0 items-center gap-3">
        <div className={`az-ring relative shrink-0 overflow-hidden rounded-full ${compact ? "h-14 w-14" : "h-24 w-24"}`}>
          <img key={face.src} src={face.src} alt="" className="h-full w-full object-cover" />
          <span className={`az-pip ${status.startsWith("Speaking") ? "is-talk" : mic ? "is-listen" : ""}`} />
        </div>
        <div className="min-w-0 text-left">
          <p className="font-display text-[11px] tracking-[0.22em]">{agent.toUpperCase()}</p>
          <p className="truncate text-xs text-white/70">{face.label} · {status}</p>
        </div>
      </div>
      <div className="flex h-6 shrink-0 items-end gap-1" aria-hidden>
        {levels.map((level, index) => <span key={index} className="az-bar w-1 rounded-full" style={{ height: Math.min(level, 24) }} />)}
      </div>
      {modes.length > 1 ? (
        <div className="flex shrink-0 flex-wrap justify-center gap-x-3 gap-y-1">
          {modes.map((row) => <button key={row} type="button" className={`quiet capitalize ${mode === row ? "is-on" : ""}`} onClick={() => setMode(row)}>{row}</button>)}
        </div>
      ) : null}
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {MINDS.map((row) => <button key={row.id} type="button" className={`quiet ${mind === row.id ? "is-on" : ""}`} onClick={() => setMind(row.id)}>{row.label}</button>)}
        <span className="text-xs text-white/45">{used}</span>
      </div>
      <div className="az-thread min-h-16 w-full min-w-0 flex-1 overflow-y-auto px-3 py-2 text-sm leading-5">
        {mode === "chat" ? lines.slice(-12).map((row) => <p key={row.id} className={`py-1 ${row.mine ? "text-right" : ""}`}><span className="text-white/45">{row.who}: </span>{row.text}</p>) : null}
        {!lines.length && mode === "chat" ? <p className="text-sm text-white/40">Ask about the board. I only use what is saved.</p> : null}
        {mode === "video" ? <YoutubeBox apiKey={data.keys.find((row) => row.name === "YouTube")?.value || ""} query={clip} /> : null}
        {mode === "image" ? <p className="text-white/70">{status}. The picture is saved on Media when the service returns a file.</p> : null}
        {mode === "writer" ? <p className="text-white/70">{status}. The draft is saved under Notes.</p> : null}
        {mode === "code" ? <p className="text-white/70">{status}. The snippet is saved as a note.</p> : null}
      </div>
      {compact ? (
        <div className="flex shrink-0 flex-wrap justify-center gap-x-3 gap-y-1">
          <button type="button" className="quiet" onClick={() => ask("What tasks are still open, and which one should I do first?")}>Tasks</button>
          <button type="button" className="quiet" onClick={() => ask("Which bills are unpaid, and what should I pay first?")}>Bills</button>
          <button type="button" className="quiet" onClick={() => ask("Which leads need a next step today?")}>Leads</button>
          <button type="button" className="quiet" onClick={() => { if (lastReply) void say(lastReply.text); }}>Speak</button>
          <button type="button" className="link-add" onClick={() => { if (!lastReply) return; update((prev) => ({ ...prev, notes: [{ id: newId(), title: `${agent} note`, body: lastReply.text }, ...prev.notes] })); setStatus("Saved to notes"); }}>Save</button>
          <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, thread: prev.thread.filter((row) => row.platform !== "erebus") }))}>Clear</button>
        </div>
      ) : null}
      <form className="flex w-full shrink-0 items-center gap-2" onSubmit={run}>
        <input className="h-9 min-w-0 flex-1 rounded-full border border-white/15 bg-black/50 px-4 text-sm" value={draft} placeholder={mode === "chat" ? `Message ${agent}` : mode} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" className="quiet is-on">Send</button>
      </form>
      <div className="flex w-full shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <button type="button" className={`quiet ${mic ? "is-on" : ""}`} onClick={toggleMic}>{mic ? "Mic on" : "Mic"}</button>
        <label className="text-xs text-white/50">Voice
          <select className="ml-2 h-8 rounded-full border border-white/15 bg-black px-2 text-sm text-white" value={voice} aria-label="Voice" onChange={(event) => {
            const next = event.target.value;
            setVoice(next);
            update((prev) => {
              const title = `Agent · ${agent}`;
              const current = prev.notes.find((row) => row.title === title)?.body || "";
              const body = /Voice: .*/.test(current) ? current.replace(/Voice: .*/, `Voice: ${next}`) : `Voice: ${next}\n${current}`.trim();
              return { ...prev, notes: [{ id: newId(), title, body }, ...prev.notes.filter((row) => row.title !== title)] };
            });
          }}>
            {[...VOICES, ...readClones(data.notes).filter((row) => !VOICES.some((voice) => voice.id === row.id))].map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <button type="button" className={`quiet ${muted ? "is-on" : ""}`} onClick={() => { setMuted((value) => !value); window.speechSynthesis?.cancel(); cancelAnimationFrame(frame.current); }}>{muted ? "Muted" : "Sound"}</button>
        <input className="h-1 w-20 accent-violet-300" type="range" min={0} max={1} step={0.05} value={volume} aria-label="Volume" onChange={(event) => setVolume(Number(event.target.value))} />
        {SKINS.map((row) => <button key={row.id} type="button" className={`quiet ${skin === row.id ? "is-on" : ""}`} onClick={() => setSkin(row.id)}>{row.label}</button>)}
      </div>
      <VoiceClone data={data} update={update} onReady={(id) => {
        setVoice(id);
        update((prev) => {
          const title = `Agent · ${agent}`;
          const current = prev.notes.find((row) => row.title === title)?.body || "";
          const body = /Voice: .*/.test(current) ? current.replace(/Voice: .*/, `Voice: ${id}`) : `Voice: ${id}\n${current}`.trim();
          return { ...prev, notes: [{ id: newId(), title, body }, ...prev.notes.filter((row) => row.title !== title)] };
        });
      }} />
    </div>
  );
}

function copyStyles(target: Document) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    target.head.appendChild(node.cloneNode(true));
  });
  for (const sheet of document.styleSheets) {
    try {
      const style = target.createElement("style");
      style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      target.head.appendChild(style);
    } catch { /* a cross-origin sheet cannot be copied */ }
  }
  target.documentElement.style.height = "100%";
  target.body.style.margin = "0";
  target.body.style.height = "100%";
  target.body.style.background = "#000";
  target.body.style.color = "#fff";
}

export function AgentFloat() {
  const { data, update } = useMemory();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [floatNote, setFloatNote] = useState("");
  const [spot, setSpot] = useState({ right: 6, bottom: 10 });
  const drag = useRef<{ x: number; y: number; right: number; bottom: number } | null>(null);
  const pipRef = useRef<Window | null>(null);

  useEffect(() => () => { pipRef.current?.close(); }, []);

  async function floatOut() {
    const api = (window as unknown as { documentPictureInPicture?: { requestWindow: (options: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
    if (!api) {
      setOpen(true);
      setFloatNote("Chrome or Edge can keep this dock on top of other programs. This browser cannot.");
      return;
    }
    try {
      const pip = pipRef.current && !pipRef.current.closed ? pipRef.current : await api.requestWindow({ width: 360, height: 640 });
      if (!pip.document.getElementById("lifeos-dock-root")) {
        copyStyles(pip.document);
        const root = pip.document.createElement("div");
        root.id = "lifeos-dock-root";
        root.style.height = "100%";
        pip.document.body.appendChild(root);
        setHost(root);
      }
      pipRef.current = pip;
      setOpen(true);
      setFloatNote("");
      pip.addEventListener("pagehide", () => {
        pipRef.current = null;
        setHost(null);
      }, { once: true });
    } catch {
      setOpen(true);
      setFloatNote("The desktop window did not open. The dock stayed in the dashboard.");
    }
  }

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
  const panel = (
    <div className={host ? "flex h-full flex-col bg-black p-3" : "az-dock flex h-[min(34rem,calc(100dvh-1rem))] w-[22rem] flex-col overflow-hidden"}>
      <div className="mb-2 flex shrink-0 items-center gap-3" onPointerDown={host ? undefined : down} onPointerMove={host ? undefined : move} onPointerUp={() => { drag.current = null; }}>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] tracking-[0.22em]">EREBUS</p>
          <p className="text-xs text-white/50">{host ? "On top of the desktop. Drag this bar to move." : "Drag this bar to move."}</p>
        </div>
        {host ? null : <button type="button" className="quiet" onClick={() => void floatOut()} onPointerDown={(event) => event.stopPropagation()}>Desktop</button>}
        <button type="button" className="quiet" onClick={() => { pipRef.current?.close(); setHost(null); setOpen(false); }} onPointerDown={(event) => event.stopPropagation()}>Hide</button>
      </div>
      {floatNote ? <p className="mb-2 text-xs text-white/50">{floatNote}</p> : null}
      <div className="min-h-0 flex-1">
        <ErebusDock data={data} update={update} agent="Erebus" compact />
      </div>
    </div>
  );

  if (host) return createPortal(panel, host);

  return (
    <div className="fixed z-40" style={{ right: spot.right, bottom: spot.bottom }} data-sound="off">
      {open ? panel : (
        <button
          type="button"
          className="az-seal"
          aria-label="Open Erebus"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(event) => {
            const moved = drag.current && Math.abs(event.clientX - drag.current.x) + Math.abs(event.clientY - drag.current.y) > 6;
            drag.current = null;
            if (!moved) void floatOut();
          }}
        >
          <img src="/agents/stills/nova.jpg" alt="" width="82" height="82" />
          <span className="az-live" />
        </button>
      )}
    </div>
  );
}
