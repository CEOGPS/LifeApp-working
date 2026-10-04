import { useEffect, useRef, useState, type FormEvent } from "react";
import { newId, type Memory } from "./memory";
import { soundPrefs } from "./sound";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Mode = "chat" | "image" | "video" | "writer" | "code";

const SKINS = [
  { id: "nyx", label: "Nyx", src: "/agents/nyx.jpg", video: false },
  { id: "nova", label: "Nova", src: "/agents/avatars/nova.mp4", video: true },
  { id: "ember", label: "Ember", src: "/agents/avatars/ember.mp4", video: true },
];
const MODES: Mode[] = ["chat", "image", "video", "writer", "code"];

function facts(data: Memory) {
  const net = data.accounts.reduce((sum, row) => sum + row.balance, 0);
  return [
    `Net balance ${net}.`,
    `Open tasks: ${data.tasks.filter((row) => !row.done).map((row) => row.title).join(", ") || "none"}.`,
    `Leads: ${data.leads.map((row) => row.name).join(", ") || "none"}.`,
    `Notes: ${data.notes.map((row) => row.title).join(", ") || "none"}.`,
  ].join(" ");
}

function speak(text: string, volume: number, muted: boolean) {
  const prefs = soundPrefs();
  if (muted || prefs.muted || typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const line = new SpeechSynthesisUtterance(text.slice(0, 400));
  line.volume = Math.min(volume, prefs.volume);
  window.speechSynthesis.speak(line);
}

export function ErebusDock({ data, update }: { data: Memory; update: Update }) {
  const [skin, setSkin] = useState(SKINS[0].id);
  const [mode, setMode] = useState<Mode>("chat");
  const [draft, setDraft] = useState("");
  const [mic, setMic] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [clip, setClip] = useState("LifeOS");
  const hear = useRef<{ stop: () => void } | null>(null);
  const face = SKINS.find((row) => row.id === skin) || SKINS[0];

  useEffect(() => () => hear.current?.stop(), []);

  function say(text: string) {
    speak(text, volume, muted);
  }

  function toggleMic() {
    if (mic) {
      hear.current?.stop();
      hear.current = null;
      setMic(false);
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
  }

  function run(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (mode === "chat") {
      const mine = { id: newId(), who: "You", text, mine: true };
      update((prev) => ({ ...prev, thread: [...prev.thread, mine] }));
      void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: text, facts: facts(data) } })).then((result) => {
        const reply = result.ok && result.text ? result.text : "I only answer from what is saved on the board.";
        update((prev) => ({ ...prev, thread: [...prev.thread, { id: newId(), who: face.label, text: reply, mine: false }] }));
        say(reply);
      }).catch(() => {
        const reply = "I only answer from what is saved on the board.";
        update((prev) => ({ ...prev, thread: [...prev.thread, { id: newId(), who: face.label, text: reply, mine: false }] }));
        say(reply);
      });
      return;
    }
    if (mode === "image") {
      update((prev) => ({ ...prev, media: [{ id: newId(), title: `Image · ${text}`, body: text, at: new Date().toISOString() }, ...prev.media] }));
      say("Image brief saved.");
      return;
    }
    if (mode === "video") {
      setClip(text);
      say("Video search updated.");
      return;
    }
    if (mode === "writer") {
      update((prev) => ({ ...prev, notes: [{ id: newId(), title: text.slice(0, 80), body: text }, ...prev.notes] }));
      say("Draft saved to notes.");
      return;
    }
    update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Code · ${text.slice(0, 48)}`, body: text }, ...prev.notes] }));
    say("Code note saved.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="agent-ring mx-auto h-48 w-40 overflow-hidden rounded-2xl">
        {face.video ? (
          <video key={face.src} src={face.src} className="h-full w-full object-cover" autoPlay muted loop playsInline />
        ) : (
          <img src={face.src} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="dock-bar flex justify-between">
        {MODES.map((row) => (
          <button key={row} type="button" className={mode === row ? "on" : ""} onClick={() => setMode(row)}>{row}</button>
        ))}
      </div>
      {mode === "chat" ? (
        <ul className="grid h-24 gap-1 overflow-y-auto">
          {data.thread.slice(-4).map((row) => <li key={row.id} className="text-sm leading-snug"><span className="text-muted">{row.who}: </span>{row.text}</li>)}
        </ul>
      ) : <div className="h-8" />}
      {mode === "video" && clip !== "LifeOS" ? <iframe title="Dock video" className="h-24 w-full rounded-lg" src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(clip)}`} allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" /> : null}
      <form className="flex items-center gap-2" onSubmit={run}>
        <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" style={{ caretColor: "transparent" }} value={draft} placeholder={mode === "chat" ? "Message" : mode} onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" className="dock-bar">Send</button>
      </form>
      <div className="dock-bar flex items-center justify-between gap-3">
        <button type="button" className={mic ? "on" : ""} onClick={toggleMic}>Mic</button>
        <button type="button" className={muted ? "on" : ""} onClick={() => { setMuted((value) => !value); window.speechSynthesis?.cancel(); }}>{muted ? "Muted" : "Sound"}</button>
        <input className="h-1 w-20 accent-violet-400" type="range" min={0} max={1} step={0.05} value={volume} aria-label="Volume" onChange={(event) => setVolume(Number(event.target.value))} />
        <select className="bg-transparent text-[10px] tracking-widest text-white/50 uppercase" value={skin} onChange={(event) => setSkin(event.target.value)}>
          {SKINS.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
        </select>
      </div>
    </div>
  );
}
