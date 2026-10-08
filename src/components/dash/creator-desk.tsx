import { useEffect, useRef, useState } from "react";
import { EngineBar } from "./engine-bar";
import { newId, type Memory } from "./memory";
import { downloadFile, downloadText } from "./format";
import { VOICES } from "./voices";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Studio = "image" | "video" | "animate" | "wan" | "write" | "audio";
type Filter = "all" | Studio;
type Piece = "Image" | "Video" | "Animate" | "Wan" | "Script" | "Audio";

const LOOKS = ["Photo", "Poster", "Product", "Portrait", "Wide"];
const ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const FORMS = ["Script", "Post", "Blog", "Caption"];
const PREFIX: Record<Studio, Piece> = { image: "Image", video: "Video", animate: "Animate", wan: "Wan", write: "Script", audio: "Audio" };

function studioOf(title: string): Studio | null {
  if (title.startsWith("Image ·")) return "image";
  if (title.startsWith("Video ·")) return "video";
  if (title.startsWith("Animate ·")) return "animate";
  if (title.startsWith("Wan ·")) return "wan";
  if (title.startsWith("Script ·")) return "write";
  if (title.startsWith("Audio ·")) return "audio";
  return null;
}

const QUEUE_KEY = "lifeos.studio.queue";
type JobKind = "image" | "edit" | "motion";
type StudioJob = { id: string; kind: JobKind; prompt: string; source: string; status: "queued" | "running" | "done" | "failed"; tries: number; polls: number; ref: string; log: string };

function readQueue(): StudioJob[] {
  try {
    const rows = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as StudioJob[];
    return Array.isArray(rows) ? rows.slice(0, 40).map((row) => ({ ...row, polls: row.polls || 0, ref: row.ref || "" })) : [];
  } catch {
    return [];
  }
}

async function uploadMedia(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("https://lifeos1-api.ceogps.workers.dev/api/upload?type=media", { method: "POST", body: form });
  const body = await response.json() as { url?: string; file_url?: string };
  const url = body.url || body.file_url || "";
  if (!response.ok || !/^https?:\/\//i.test(url)) throw new Error("Upload did not return a link.");
  return url;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

async function editStill(src: string, mode: string) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(img.width, 1024);
  canvas.height = Math.round(canvas.width * (img.height / img.width));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.filter = mode === "blur" ? "blur(2px)" : mode === "contrast" ? "contrast(1.3)" : "brightness(1.25)";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function paintImage(src: string, tune: { bright: number; contrast: number; gray: boolean; turn: number; text: string }) {
  const img = await loadImage(src);
  const turn = ((tune.turn % 360) + 360) % 360;
  const swap = turn === 90 || turn === 270;
  const max = 1280;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((swap ? img.height : img.width) * scale);
  canvas.height = Math.round((swap ? img.width : img.height) * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.filter = `${tune.gray ? "grayscale(1) " : ""}brightness(${tune.bright}%) contrast(${tune.contrast}%)`;
  ctx.drawImage(img, -(img.width * scale) / 2, -(img.height * scale) / 2, img.width * scale, img.height * scale);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  if (tune.text.trim()) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tune.text.trim().slice(0, 60), canvas.width / 2, canvas.height - 28);
  }
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function motionClip(src: string) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const stream = canvas.captureStream(12);
  const type = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
  if (!type) throw new Error("recorder");
  const rec = new MediaRecorder(stream, { mimeType: type });
  const chunks: Blob[] = [];
  rec.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const done = new Promise<string>((resolve) => {
    rec.onstop = () => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(new Blob(chunks, { type }));
    };
  });
  rec.start();
  for (let frame = 0; frame < 48; frame += 1) {
    const scale = 1 + (frame / 48) * 0.16;
    const w = 640 * scale;
    const h = 360 * scale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 640, 360);
    ctx.drawImage(img, (640 - w) / 2, (360 - h) / 2, w, h);
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
  rec.stop();
  return done;
}

function StudioQueue({ data, update }: { data: Memory; update: Update }) {
  const [jobs, setJobs] = useState<StudioJob[]>(() => (typeof localStorage === "undefined" ? [] : readQueue()));
  const [kind, setKind] = useState<JobKind>("image");
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState("");
  const lock = useRef(false);
  const account = data.keys.find((row) => row.name === "Cloudflare Account")?.value || "";
  const token = data.keys.find((row) => row.name === "Cloudflare Token")?.value || "";
  const xai = data.keys.find((row) => row.name === "xAI")?.value || "";
  const replicate = data.keys.find((row) => row.name === "Replicate")?.value || "";

  function write(job: StudioJob[]) {
    setJobs(job);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(job.map((row) => ({ ...row, log: row.log.slice(-500) }))));
  }

  function save(label: string, body: string) {
    update((prev) => ({ ...prev, media: [{ id: newId(), title: label, body, at: new Date().toISOString() }, ...prev.media] }));
  }

  useEffect(() => {
    const queued = jobs.find((row) => row.status === "queued");
    if (!queued || lock.current) return;
    const job = queued;
    lock.current = true;
    const mark = (patch: Partial<StudioJob>) => write(readQueue().map((row) => row.id === job.id ? { ...row, ...patch } : row));
    mark({ status: "running", tries: job.ref ? job.tries : job.tries + 1, log: `${job.log}\n${job.ref ? "Checking Wan." : "Running."}`.trim() });
    void (async () => {
      try {
        const { wanClip } = await import("@/lib/lifeos/sync");
        async function throughWan(image: string, prompt: string) {
          if (!/^https:\/\//.test(image)) return { url: "", id: "", state: "skip" as const, error: "Wan needs an https image." };
          const result = await wanClip({ data: { prompt, image, key: replicate, id: job.ref } });
          if (result.url) {
            save(`Animate · ${prompt.slice(0, 48) || "Wan"}`, result.url);
            mark({ status: "done", ref: "", log: `${job.log}\nWan clip saved.`.trim() });
            return { url: result.url, id: result.id, state: "done" as const, error: "" };
          }
          if (result.state === "dreaming" && result.id) {
            const polls = job.polls + 1;
            mark({ status: polls > 15 ? "failed" : "queued", ref: result.id, polls, log: `${job.log}\n${polls > 15 ? "Wan timed out." : "Wan is rendering."}`.trim() });
            return { url: "", id: result.id, state: "wait" as const, error: "" };
          }
          return { url: "", id: "", state: "fail" as const, error: result.error || "Wan did not return a clip." };
        }
        if (job.kind === "image") {
          const { freeImage, makePicture } = await import("@/lib/lifeos/sync");
          const free = job.ref ? { url: job.source, error: "" } : await freeImage({ data: { prompt: job.prompt, account, token } });
          const made = job.ref || free.url ? free : await makePicture({ data: { prompt: job.prompt, key: xai } });
          if (!made.url) throw new Error(made.error || "No image.");
          if (!job.ref) save(`Image · ${job.prompt.slice(0, 48)}`, made.url);
          const wan = await throughWan(made.url, job.prompt);
          if (wan.state === "done" || wan.state === "wait") return;
          mark({ status: "done", log: `${job.log}\nStill saved. ${wan.error}`.trim() });
          return;
        }
        if (!job.source) throw new Error("This job needs an image link.");
        if (job.kind === "edit") {
          save(`Image · edit ${job.prompt || "bright"}`, await editStill(job.source, job.prompt || "bright"));
          mark({ status: "done", log: `${job.log}\nEdited on this machine.`.trim() });
          return;
        }
        const wan = await throughWan(job.source, job.prompt || "subtle natural motion");
        if (wan.state === "done" || wan.state === "wait") return;
        save(`Video · motion`, await motionClip(job.source));
        mark({ status: "done", log: `${job.log}\n${wan.error} Local motion saved instead.`.trim() });
      } catch (error) {
        const failed = job.tries + 1 >= 2;
        mark({ status: failed ? "failed" : "queued", log: `${job.log}\n${error instanceof Error ? error.message : "Failed."}`.trim() });
      } finally {
        lock.current = false;
        setJobs(readQueue());
      }
    })();
  }, [jobs, account, token, xai, replicate, update]);

  return (
    <section className="module-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg">Studio queue</h2>
          <p className="text-sm text-white/50">Image jobs make a still, then Wan 2.2 moves it. Motion jobs send the still straight to Wan. Wan uses the Replicate key and an https image.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(["image", "edit", "motion"] as JobKind[]).map((name) => (
            <button key={name} type="button" className={`quiet ${kind === name ? "is-on" : ""}`} onClick={() => setKind(name)}>{name}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={prompt} placeholder={kind === "image" ? "Prompt" : kind === "edit" ? "bright, contrast, or blur" : "Motion note"} onChange={(event) => setPrompt(event.target.value)} />
        {kind !== "image" ? <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={source} placeholder="https:// image to edit or move" onChange={(event) => setSource(event.target.value)} /> : null}
        <button type="button" className="quiet is-on" onClick={() => {
          if (kind === "image" && !prompt.trim()) return;
          if (kind !== "image" && !source.trim()) return;
          write([{ id: newId(), kind, prompt: prompt.trim(), source: source.trim(), status: "queued", tries: 0, polls: 0, ref: "", log: "Queued." }, ...readQueue()]);
          setPrompt("");
        }}>Queue</button>
      </div>
      <ul className="mt-3 grid gap-1">
        {jobs.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline gap-3 text-sm">
            <span className="text-white/40">{row.status}</span>
            <span>{row.kind}</span>
            <span className="min-w-0 flex-1 truncate text-white/70">{row.prompt || row.source}</span>
            <span className="text-white/40">{row.log.split("\n").at(-1)}</span>
          </li>
        ))}
        {!jobs.length ? <li className="text-sm text-white/40">Nothing queued.</li> : null}
      </ul>
    </section>
  );
}

export function CreatorDesk({ data, update }: { data: Memory; update: Update }) {
  const [studio, setStudio] = useState<Studio>("image");
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [look, setLook] = useState("Photo");
  const [aspect, setAspect] = useState("16:9");
  const [form, setForm] = useState("Script");
  const [voice, setVoice] = useState<string>(VOICES[0].id);
  const [still, setStill] = useState("");
  const [audience, setAudience] = useState("");
  const [points, setPoints] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState("");
  const [engine, setEngine] = useState<"luma" | "wan">("luma");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tune, setTune] = useState({ bright: 100, contrast: 100, gray: false, turn: 0, text: "" });
  const xai = data.keys.find((row) => row.name === "xAI")?.value || "";
  const luma = data.keys.find((row) => row.name === "Luma")?.value || "";
  const replicate = data.keys.find((row) => row.name === "Replicate")?.value || "";
  const eleven = data.keys.find((row) => row.name === "ElevenLabs")?.value || "";

  useEffect(() => {
    update((prev) => {
      const media = prev.media.filter((row) => !/^(image|video|audio|document|other)$/i.test(row.body.trim()));
      return media.length === prev.media.length ? prev : { ...prev, media };
    });
  }, []);

  const pieces = data.media.filter((row) => studioOf(row.title));
  const shown = pieces.filter((row) => filter === "all" || studioOf(row.title) === filter);
  const stills = data.media.filter((row) => /^https:\/\//.test(row.body) && (row.title.startsWith("Image ·") || /\.(png|jpe?g|webp)(\?|$)/i.test(row.body)));
  const open = pieces.find((row) => row.id === openId) || null;

  function savePiece(label: string, value: string) {
    const id = newId();
    update((prev) => ({ ...prev, media: [{ id, title: label, body: value, at: new Date().toISOString() }, ...prev.media] }));
    setOpenId(id);
  }

  async function run() {
    if (busy) return;
    const name = title.trim() || prompt.trim().slice(0, 48) || "Untitled";
    if (studio !== "animate" && !prompt.trim()) { setNote("Write a prompt first."); return; }
    setBusy(true);
    try {
      if (studio === "write") {
        setNote("Writing…");
        const { askNyx } = await import("@/lib/lifeos/sync");
        const question = form === "Blog"
          ? `Write a finished blog post of about 500 words. Title: ${title.trim() || name}. Audience: ${audience.trim() || "a general reader"}. Cover these points: ${points.trim() || prompt}. Direction: ${prompt}. No invented numbers, names, prices, or quotes. Plain text. First line is the title. Then a short intro. Then three sections, each with a label line and two paragraphs. Then a closing paragraph.`
          : `Write a ${form.toLowerCase()}. No invented facts. No markdown headings.\n${prompt}`;
        const result = await askNyx({ data: { question, facts: title } });
        savePiece(`Script · ${form} · ${name}`, result.text || "No model reply.");
        setNote("Saved in the library.");
        return;
      }
      if (studio === "audio") {
        setNote(eleven ? "Speaking…" : "No ElevenLabs key. Writing the line instead.");
        if (!eleven) {
          const { askNyx } = await import("@/lib/lifeos/sync");
          const result = await askNyx({ data: { question: `Write a short ${voice.toLowerCase()} line. No invented facts.\n${prompt}`, facts: title, name: "Erebus" } });
          savePiece(`Audio · ${voice} · ${name}`, result.text || "No line came back.");
          return;
        }
        const { speakVoice } = await import("@/lib/lifeos/sync");
        const spoken = await speakVoice({ data: { text: prompt.slice(0, 500), key: eleven, voice } });
        if (!spoken.ok || !spoken.audio) { setNote("ElevenLabs refused the line."); return; }
        savePiece(`Audio · ${voice} · ${name}`, `data:audio/mpeg;base64,${spoken.audio}`);
        setNote("Audio saved.");
        return;
      }
      if (studio === "image") {
        setNote("Making the image…");
        const { makePicture, freeImage } = await import("@/lib/lifeos/sync");
        const brief = `High detail ${look}, framed ${aspect}. ${prompt}. Sharp focus. No text unless the prompt asks for it.`;
        const made = await makePicture({ data: { prompt: brief, key: xai } });
        const backup = made.url ? made : await freeImage({ data: { prompt: brief, account: data.keys.find((row) => row.name === "Cloudflare Account")?.value || "", token: data.keys.find((row) => row.name === "Cloudflare Token")?.value || "" } });
        if (!backup.url) { setNote(made.error || backup.error || "No image came back."); return; }
        savePiece(`Image · ${name}`, backup.url);
        setNote("Image saved.");
        return;
      }
      if (studio === "wan") {
        if (!/^https:\/\//.test(still)) { setNote("Wan needs an https image. Paste a link or pick one already saved."); return; }
        setNote("Starting Wan…");
        const { wanClip } = await import("@/lib/lifeos/sync");
        const result = await wanClip({ data: { prompt, image: still, key: replicate, aspect: aspect === "9:16" || aspect === "1:1" ? aspect : "16:9" } });
        if (result.url) { savePiece(`Wan · ${name}`, result.url); setJob(""); setNote("Wan clip saved."); return; }
        if (result.id && result.state === "dreaming") { setJob(result.id); setEngine("wan"); setNote("Wan is rendering. Check again in a moment."); return; }
        setNote(result.error || "Wan did not start.");
        return;
      }
      if (studio === "animate" && still && !/^https:\/\//.test(still)) { setNote("Animate needs an https image. Paste a link or pick one already saved."); return; }
      setNote(studio === "animate" ? "Animating the still…" : "Starting the video…");
      const { makeClip } = await import("@/lib/lifeos/sync");
      const result = await makeClip({ data: { prompt: `Cinematic, sharp detail, natural motion. ${prompt}`, key: luma, aspect, image: studio === "animate" ? still : "", model: "ray-2", duration: "9s" } });
      const label = `${studio === "animate" ? "Animate" : "Video"} · ${name}`;
      if (result.url) { savePiece(label, result.url); setJob(""); setNote("Video saved."); return; }
      if (result.id && result.state === "dreaming") { setJob(result.id); setEngine("luma"); setNote("Luma is still rendering. Check again in a moment."); return; }
      setNote(result.error || "No video came back.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      <StudioQueue data={data} update={update} />
      <EngineBar panel="Creator" data={data} update={update} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Creator</h1>
          <p className="text-sm text-white/50">Images, 9 second video, and blogs. Music videos are in Music Einstein.</p>
        </div>
        <div className="flex gap-4">
          {(["image", "video", "animate", "wan", "audio", "write"] as Studio[]).map((name) => (
            <button key={name} type="button" className={`quiet ${studio === name ? "is-on" : ""}`} onClick={() => setStudio(name)}>{name === "wan" ? "Wan" : name[0].toUpperCase() + name.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-[22rem_1fr]">
        <section className="module-card p-4">
          <label className="block text-[11px] text-white/45">Title
            <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          {studio === "animate" || studio === "wan" ? (
            <label className="mt-3 block text-[11px] text-white/45">Image
              <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={still} placeholder="https:// image" onChange={(event) => setStill(event.target.value)} />
            </label>
          ) : null}
          {studio === "animate" || studio === "wan" || studio === "image" ? (
            <label className="mt-2 inline-flex">
              <span className="quiet">Upload image</span>
              <input className="hidden" type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setNote("Uploading image…");
                void uploadMedia(file).then((url) => { setStill(url); if (studio === "image") setPrompt((value) => value); setNote("Image ready."); }).catch(() => setNote("Image upload failed."));
              }} />
            </label>
          ) : null}
          {(studio === "animate" || studio === "wan") && stills.length ? (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {stills.slice(0, 8).map((row) => (
                <button key={row.id} type="button" className="quiet shrink-0" onClick={() => setStill(row.body)}><img src={row.body} alt="" className="h-12 w-12 rounded object-cover" /></button>
              ))}
            </div>
          ) : null}
          <label className="mt-3 block text-[11px] text-white/45">{studio === "write" ? "What to write" : studio === "animate" || studio === "wan" ? "How it should move" : "Prompt"}
            <textarea className="mt-1 min-h-36 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </label>
          {studio === "image" ? <div className="mt-3 flex flex-wrap gap-3">{LOOKS.map((name) => <button key={name} type="button" className={`quiet ${look === name ? "is-on" : ""}`} onClick={() => setLook(name)}>{name}</button>)}</div> : null}
          {studio === "write" && form === "Blog" ? (
            <div className="mt-3 grid gap-2">
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" value={audience} placeholder="Who it is for" onChange={(event) => setAudience(event.target.value)} />
              <textarea className="min-h-20 rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={points} placeholder="Points to cover, one per line" onChange={(event) => setPoints(event.target.value)} />
            </div>
          ) : null}
          {studio === "write" ? <div className="mt-3 flex flex-wrap gap-3">{FORMS.map((name) => <button key={name} type="button" className={`quiet ${form === name ? "is-on" : ""}`} onClick={() => setForm(name)}>{name}</button>)}</div> : null}
          {studio === "audio" ? <div className="mt-3 flex flex-wrap gap-3">{VOICES.map((item) => <button key={item.id} type="button" className={`quiet ${voice === item.id ? "is-on" : ""}`} onClick={() => setVoice(item.id)}>{item.name}</button>)}</div> : null}
          {studio === "image" || studio === "video" || studio === "animate" || studio === "wan" ? <div className="mt-3 flex flex-wrap gap-3">{ASPECTS.map((name) => <button key={name} type="button" className={`quiet ${aspect === name ? "is-on" : ""}`} onClick={() => setAspect(name)}>{name}</button>)}</div> : null}
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" className="quiet is-on" disabled={busy} onClick={() => void run()}>{busy ? "Working" : "Create"}</button>
            {job ? <button type="button" className="quiet" onClick={() => {
              setNote("Checking the video…");
              const check = engine === "wan"
                ? import("@/lib/lifeos/sync").then(({ wanClip }) => wanClip({ data: { key: replicate, id: job } }))
                : import("@/lib/lifeos/sync").then(({ makeClip }) => makeClip({ data: { prompt: "", key: luma, id: job } }));
              void check.then((result) => {
                if (result.url) { savePiece(`${PREFIX[studio]} · ${title.trim() || "clip"}`, result.url); setJob(""); setNote("Video saved."); return; }
                setNote(result.state === "dreaming" ? "Still rendering." : result.error || "Not ready.");
              }).catch(() => setNote("Could not check the video."));
            }}>Check video</button> : null}
          </div>
          <p className="mt-3 text-sm text-white/45">{studio === "image" ? "Images use xAI, then Cloudflare if that fails." : studio === "write" ? form === "Blog" ? "Blogs come back as a title, intro, three sections, and a close. Nothing is invented." : "Writing uses the board model." : studio === "audio" ? "Audio speaks with the ElevenLabs key. Without it, the line is saved as text." : studio === "wan" ? "Wan uses the Replicate key and the https still." : "Video uses Luma Ray 2 at 720p for 9 seconds."}</p>
          {note ? <p className="mt-2 text-sm text-white/70">{note}</p> : null}
        </section>
        <section className="grid gap-3">
          <div className="module-card p-3">
            <div className="mb-3 flex flex-wrap gap-4">
              {(["all", "image", "video", "animate", "wan", "audio", "write"] as Filter[]).map((name) => (
                <button key={name} type="button" className={`quiet ${filter === name ? "is-on" : ""}`} onClick={() => setFilter(name)}>{name === "wan" ? "Wan" : name[0].toUpperCase() + name.slice(1)} {name === "all" ? pieces.length : pieces.filter((row) => studioOf(row.title) === name).length}</button>
              ))}
            </div>
            {!shown.length ? <p className="text-sm text-white/40">Nothing in this library yet.</p> : null}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {shown.map((row) => {
                const kind = studioOf(row.title);
                const image = kind === "image" && /^https?:|^data:image/i.test(row.body);
                return (
                  <button key={row.id} type="button" className={`menu ${openId === row.id ? "is-on" : ""}`} onClick={() => setOpenId(row.id)}>
                    {image ? <img src={row.body} alt="" className="mb-2 h-28 w-full rounded-lg object-cover" /> : <span className="mb-2 grid h-28 place-items-center rounded-lg bg-black/40 text-[11px] uppercase tracking-widest text-white/40">{kind}</span>}
                    <span className="block truncate">{row.title.replace(/^(Image|Video|Animate|Wan|Script|Audio) · /, "")}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {open ? (
            <div className="module-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-4">
                <p className="min-w-0 flex-1 truncate text-lg">{open.title}</p>
                {/^https?:\/\//.test(open.body) ? <a className="quiet" href={open.body} target="_blank" rel="noreferrer">Open</a> : null}
                <button type="button" className="quiet" onClick={() => {
                  const kind = studioOf(open.title);
                  const base = open.title.replace(/^(Image|Video|Animate|Wan|Script|Audio) · /, "") || "file";
                  const ext = kind === "video" || kind === "animate" || kind === "wan" ? "mp4" : kind === "audio" ? "mp3" : kind === "image" ? "png" : "txt";
                  if (/^https?:|^data:/i.test(open.body)) downloadFile(`${base}.${ext}`, open.body);
                  else downloadText(`${base}.txt`, open.body);
                }}>Download</button>
                {studioOf(open.title) === "image" && /^https:\/\//.test(open.body) ? <button type="button" className="quiet" onClick={() => { setStudio("wan"); setStill(open.body); setTitle(open.title.replace(/^Image · /, "")); }}>Move with Wan</button> : null}
                <button type="button" className="link-remove" onClick={() => { update((prev) => ({ ...prev, media: prev.media.filter((row) => row.id !== open.id) })); setOpenId(null); }}>Remove</button>
              </div>
              {studioOf(open.title) === "video" || studioOf(open.title) === "animate" || studioOf(open.title) === "wan" ? (/^https?:\/\//.test(open.body) ? <video className="max-h-[50vh] w-full" controls src={open.body} /> : <p className="text-sm text-white/50">{open.body}</p>) : null}
              {studioOf(open.title) === "image" && /^https?:|^data:image/i.test(open.body) ? (
                <div>
                  <img src={open.body} alt="" className="max-h-[50vh] w-full object-contain" />
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <label>Bright <input type="range" min={50} max={160} value={tune.bright} onChange={(event) => setTune({ ...tune, bright: Number(event.target.value) })} /></label>
                    <label>Contrast <input type="range" min={50} max={180} value={tune.contrast} onChange={(event) => setTune({ ...tune, contrast: Number(event.target.value) })} /></label>
                    <button type="button" className={`quiet ${tune.gray ? "is-on" : ""}`} onClick={() => setTune({ ...tune, gray: !tune.gray })}>Gray</button>
                    <button type="button" className="quiet" onClick={() => setTune({ ...tune, turn: tune.turn + 90 })}>Turn</button>
                    <input className="h-8 w-40 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Caption" value={tune.text} onChange={(event) => setTune({ ...tune, text: event.target.value })} />
                    <button type="button" className="quiet is-on" onClick={() => {
                      setNote("Editing the still…");
                      void paintImage(open.body, tune).then((url) => {
                        savePiece(`Image · ${open.title.replace(/^Image · /, "")} edit`, url);
                        setNote("Edited still saved.");
                      }).catch(() => setNote("This image blocked the editor. Use one saved in the library."));
                    }}>Save look</button>
                    <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="What should change in the picture" value={editPrompt} onChange={(event) => setEditPrompt(event.target.value)} />
                    <button type="button" className="quiet is-on" onClick={() => {
                      if (!editPrompt.trim()) { setNote("Write what should change."); return; }
                      if (!/^https:\/\//.test(open.body)) { setNote("Prompt edits need a public https image."); return; }
                      setNote("Editing from the prompt…");
                      void import("@/lib/lifeos/sync").then(({ editPicture }) => editPicture({ data: { prompt: editPrompt, image: open.body, key: replicate } })).then((result) => {
                        if (result.url) { savePiece(`Image · ${open.title.replace(/^Image · /, "")} edit`, result.url); setNote("Edited image saved."); return; }
                        setNote(result.error || "The edit did not finish.");
                      }).catch(() => setNote("The edit did not finish."));
                    }}>Edit from prompt</button>
                  </div>
                </div>
              ) : null}
              {studioOf(open.title) === "write" || (studioOf(open.title) === "audio" && !open.body.startsWith("data:audio")) ? <p className="whitespace-pre-wrap text-base leading-7 text-white/80">{open.body}</p> : null}
              {studioOf(open.title) === "audio" && open.body.startsWith("data:audio") ? <audio className="w-full" controls src={open.body} /> : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
