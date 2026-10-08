import { useRef, useState } from "react";
import { EngineBar } from "./engine-bar";
import { newId, type Memory, type SongIdea } from "./memory";
import { downloadFile, downloadText } from "./format";
import { playCut, togglePause, usePlayer } from "./player";

type Update = (recipe: (prev: Memory) => Memory) => void;
type View = "home" | "create" | "video" | "library" | "explore" | "search";
type Shelf = "all" | "liked" | "public";

const NAV: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "create", label: "Create" },
  { id: "video", label: "Video" },
  { id: "library", label: "Library" },
  { id: "explore", label: "Explore" },
  { id: "search", label: "Search" },
];
const STYLES = ["trip hop", "r&b", "lo-fi", "hip hop", "soul", "indie pop", "cinematic", "gospel", "afrobeats", "country"];

function cover(id: string) {
  const n = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = 180 + (n % 50);
  return `linear-gradient(160deg, oklch(0.42 0.08 ${hue}), oklch(0.18 0.04 ${hue + 30}))`;
}

function Art({ song }: { song: SongIdea }) {
  if (song.cover) return <img src={song.cover} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />;
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-[10px] text-white/70" style={{ background: cover(song.id) }}>—</span>;
}

function MusicCut({ video, audio }: { video: string; audio: string }) {
  const picture = useRef<HTMLVideoElement>(null);
  const song = useRef<HTMLAudioElement>(null);
  return (
    <div>
      <video ref={picture} className="max-h-72 w-full" src={video} loop muted playsInline />
      {audio ? <audio ref={song} src={audio} /> : null}
      <button type="button" className="quiet is-on mt-3" onClick={() => {
        const clip = picture.current;
        if (!clip) return;
        if (clip.paused) {
          if (song.current) song.current.currentTime = 0;
          void clip.play();
          void song.current?.play();
        } else {
          clip.pause();
          song.current?.pause();
        }
      }}>Play with song</button>
    </div>
  );
}

async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("https://lifeos1-api.ceogps.workers.dev/api/upload?type=media", { method: "POST", body: form });
  const body = await response.json() as { url?: string; file_url?: string };
  const url = body.url || body.file_url || "";
  if (!response.ok || !/^https?:\/\//i.test(url)) throw new Error("upload");
  return url;
}

async function storeSong(audio: string) {
  const binary = atob(audio);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return uploadFile(new File([bytes], "song.mp3", { type: "audio/mpeg" }));
}

function Row({ song, on, onOpen, onExtend, onPublic, onLike, onVideo, onPlay }: {
  song: SongIdea;
  on: boolean;
  onOpen: () => void;
  onExtend: () => void;
  onPublic: () => void;
  onLike: () => void;
  onVideo: () => void;
  onPlay: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 py-2">
      <button type="button" className="relative shrink-0" onClick={onPlay} aria-label={on ? "Pause" : "Play"}>
        <Art song={song} />
        <span className="absolute inset-0 grid place-items-center text-[11px] text-white">{song.audio ? (on ? "II" : "Play") : ""}</span>
      </button>
      <button type="button" className="menu min-w-0 flex-1" onClick={onOpen}>
        <span className="block truncate text-sm text-white">{song.title}</span>
        <span className="block truncate text-[11px] text-white/40">{song.note || "No style yet"}{song.video ? " · video" : ""}</span>
      </button>
      <button type="button" className="quiet" onClick={onExtend}>Extend</button>
      <button type="button" className={`quiet ${song.pub ? "is-on" : ""}`} onClick={onPublic}>{song.pub ? "Public" : "Private"}</button>
      <button type="button" className="icon" aria-label={song.liked ? "Unlike" : "Like"} onClick={onLike}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" fill={song.liked ? "#34d399" : "none"} stroke={song.liked ? "#34d399" : "#fff"} strokeWidth="1.6" /></svg>
      </button>
      <button type="button" className="quiet" onClick={onVideo}>Video</button>
    </div>
  );
}

export function EinsteinDesk({ data, update }: { data: Memory; update: Update }) {
  const [view, setView] = useState<View>("create");
  const [mode, setMode] = useState<"simple" | "custom">("simple");
  const [instrumental, setInstrumental] = useState(false);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [style, setStyle] = useState("");
  const [q, setQ] = useState("");
  const [shelf, setShelf] = useState<Shelf>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [engine, setEngine] = useState<"eleven" | "ace">("eleven");
  const [job, setJob] = useState("");
  const [still, setStill] = useState("");
  const [motion, setMotion] = useState("");
  const [clipId, setClipId] = useState("");
  const [videoJob, setVideoJob] = useState("");
  const playing = usePlayer();
  const open = data.songs.find((row) => row.id === openId) || null;
  const needle = q.trim().toLowerCase();
  const xai = data.keys.find((row) => row.name === "xAI")?.value || "";
  const luma = data.keys.find((row) => row.name === "Luma")?.value || "";
  const voice = data.keys.find((row) => row.name === "ElevenLabs")?.value || "";
  const replicate = data.keys.find((row) => row.name === "Replicate")?.value || "";
  const listed = data.songs.filter((row) => {
    if (shelf === "liked" && !row.liked) return false;
    if (shelf === "public" && !row.pub) return false;
    return !needle || `${row.title} ${row.note} ${row.lyrics || ""}`.toLowerCase().includes(needle);
  });

  function patch(id: string, next: Partial<SongIdea>) {
    update((prev) => ({ ...prev, songs: prev.songs.map((row) => row.id === id ? { ...row, ...next } : row) }));
  }

  function extend(song: SongIdea) {
    setMode("custom");
    setTitle(`${song.title} extended`);
    setStyle(song.note);
    setLyrics(song.lyrics || "");
    setView("create");
  }

  async function makeCover(song: SongIdea) {
    setStatus("Making the cover…");
    const { makePicture } = await import("@/lib/lifeos/sync");
    const result = await makePicture({ data: { prompt: `Album cover, no words, ${song.note || "music"}. ${song.title}`, key: xai } });
    if (!result.url) { setStatus(result.error || "No cover came back."); return ""; }
    patch(song.id, { cover: result.url });
    return result.url;
  }

  async function makeVocal(song: SongIdea) {
    const text = (song.lyrics || song.note || song.title).replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 450);
    if (!text) { setStatus("Add lyrics before a read-through."); return; }
    setStatus("Reading the lyrics. This is speech, not the song.");
    const { speakVoice } = await import("@/lib/lifeos/sync");
    const result = await speakVoice({ data: { text, key: voice } });
    if (!result.audio) { setStatus("No vocal came back. Check the ElevenLabs key."); return; }
    patch(song.id, { audio: `data:audio/mpeg;base64,${result.audio}` });
    setStatus("Spoken read saved. Create makes the sung track.");
  }

  function openVideo(song: SongIdea) {
    setClipId(song.id);
    setStill(song.cover?.startsWith("https://") ? song.cover : "");
    setMotion(song.note || "");
    setVideoJob("");
    setView("video");
  }

  async function makeVideo(song: SongIdea) {
    const image = still.startsWith("https://") ? still : song.cover?.startsWith("https://") ? song.cover : "";
    if (!image) { setStatus("Add an https image, or make a cover first."); return; }
    if (!song.audio) { setStatus("Create the song first so the video has audio."); return; }
    setStatus("Starting a 9 second picture…");
    const { makeClip } = await import("@/lib/lifeos/sync");
    const result = await makeClip({
      data: {
        prompt: `Music video, cinematic, sharp, the picture moves with the song. ${motion || song.note || song.title}. ${(song.lyrics || "").slice(0, 180)}`,
        key: luma,
        aspect: "16:9",
        image,
        model: "ray-2",
        duration: "9s",
        id: videoJob,
      },
    });
    if (result.url) { patch(song.id, { video: result.url }); setVideoJob(""); setStatus("Music video saved. Play it with the song."); return; }
    if (result.id && result.state === "dreaming") { setVideoJob(result.id); setStatus("The picture is rendering. Press Make video again in a moment."); return; }
    setStatus(result.error || "The music video did not start.");
  }

  async function create() {
    if (busy) return;
    const styleLine = (mode === "custom" ? style : description).trim();
    const name = (mode === "custom" ? title : description).trim().slice(0, 80) || "Untitled";
    if (!styleLine && !lyrics.trim()) { setStatus("Add a description, or lyrics and a style."); return; }
    setBusy(true);
    try {
      let words = instrumental ? "" : lyrics.trim();
      if (!instrumental && !words) {
        setStatus("Writing a verse and chorus…");
        const { askNyx } = await import("@/lib/lifeos/sync");
        const result = await askNyx({ data: { question: `Write singable song lyrics only. Use [Verse], [Chorus], and [Verse] tags. Short lines. No brands or invented facts. Theme: ${name}. Style: ${styleLine || "modern pop"}.`, facts: "" } });
        words = result.text || "";
      }
      setStatus(engine === "ace" ? "ACE-Step is recording…" : "Recording the song…");
      const { composeSong } = await import("@/lib/lifeos/sync");
      const made = await composeSong({ data: { title: name, style: styleLine, lyrics: words, instrumental, key: voice, engine, replicate, job } });
      if (made.job && !made.audio) { setJob(made.job); setStatus(made.error || "Still recording. Press Create again."); return; }
      setJob("");
      let audio = "";
      if (made.audio) {
        try { audio = await storeSong(made.audio); } catch { audio = `data:audio/mpeg;base64,${made.audio.slice(0, 280000)}`; }
      }
      const song: SongIdea = { id: newId(), title: name.split("\n")[0].slice(0, 80) || "Untitled", note: styleLine.slice(0, 240), lyrics: words.slice(0, 4000), liked: false, pub: false, audio };
      update((prev) => ({ ...prev, songs: [song, ...prev.songs] }));
      setOpenId(song.id);
      setClipId(song.id);
      setDescription("");
      setStatus(audio ? "Song saved." : made.error || "Lyrics saved. The song engine did not return audio.");
      await makeCover(song);
    } finally {
      setBusy(false);
    }
  }

  function songs(rows: SongIdea[]) {
    return rows.map((song) => (
      <Row
        key={song.id}
        song={song}
        on={playing.track?.id === song.id && !playing.paused}
        onOpen={() => setOpenId(song.id)}
        onExtend={() => extend(song)}
        onPublic={() => patch(song.id, { pub: !song.pub })}
        onLike={() => patch(song.id, { liked: !song.liked })}
        onVideo={() => openVideo(song)}
        onPlay={() => {
          if (!song.audio) { setOpenId(song.id); return; }
          if (playing.track?.id === song.id) togglePause();
          else playCut({ id: song.id, title: song.title, artist: "Music Einstein", album: song.note || "", url: song.audio, page: "", art: song.cover || "" });
        }}
      />
    ));
  }

  return (
    <div className="grid min-h-[36rem] gap-3 lg:grid-cols-[11rem_1fr]">
      <aside className="module-card h-fit p-3">
        <p className="px-0 text-sm tracking-wide">Music Einstein</p>
        <div className="mt-3">
          {NAV.map((item) => (
            <button key={item.id} type="button" className={`menu ${view === item.id ? "is-on" : ""}`} onClick={() => setView(item.id)}>{item.label}</button>
          ))}
        </div>
      </aside>
      <div className="grid gap-3">
        <EngineBar panel="Music Einstein" data={data} update={update} />
        {view === "home" ? (
          <section className="module-card p-3">
            <p className="px-1 text-sm text-white/50">Recent</p>
            {!data.songs.length ? <p className="p-3 text-sm text-white/40">Songs you create show up here.</p> : null}
            {songs(data.songs.slice(0, 8))}
            <p className="mt-4 px-1 text-sm text-white/50">Liked</p>
            {songs(data.songs.filter((row) => row.liked).slice(0, 8))}
          </section>
        ) : null}
        {view === "create" ? (
          <div className="grid gap-3">
            <section className="module-card mx-auto w-full max-w-4xl p-4">
              <div className="flex flex-wrap items-center gap-4">
                <button type="button" className={`quiet ${mode === "simple" ? "is-on" : ""}`} onClick={() => setMode("simple")}>Simple</button>
                <button type="button" className={`quiet ${mode === "custom" ? "is-on" : ""}`} onClick={() => setMode("custom")}>Custom</button>
                <button type="button" className={`quiet ${instrumental ? "is-on" : ""}`} onClick={() => setInstrumental((value) => !value)}>Instrumental</button>
                <span className="ml-auto flex gap-3">
                  <button type="button" className={`quiet ${engine === "eleven" ? "is-on" : ""}`} onClick={() => { setEngine("eleven"); setJob(""); }}>Eleven Music</button>
                  <button type="button" className={`quiet ${engine === "ace" ? "is-on" : ""}`} onClick={() => { setEngine("ace"); setJob(""); }}>ACE-Step</button>
                </span>
              </div>
              {mode === "simple" ? (
                <textarea className="mt-4 min-h-28 w-full rounded-2xl border border-line bg-black/40 px-3 py-3 text-sm" value={description} placeholder="A slow r&b song about a late drive" onChange={(event) => setDescription(event.target.value)} />
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                  <label className="text-[11px] text-white/45">Lyrics
                    <textarea className="mt-1 min-h-64 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={lyrics} placeholder={"[Verse]\n\n[Chorus]\n\n[Verse]\n\n[Chorus]"} onChange={(event) => setLyrics(event.target.value)} />
                  </label>
                  <div className="grid content-start gap-3">
                    <label className="text-[11px] text-white/45">Style of music
                      <textarea className="mt-1 min-h-24 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={style} placeholder="r&b, slow, warm vocal, 80 bpm" onChange={(event) => setStyle(event.target.value)} />
                    </label>
                    <label className="text-[11px] text-white/45">Title
                      <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {STYLES.map((name) => <button key={name} type="button" className="quiet" onClick={() => setStyle((value) => value.toLowerCase().includes(name) ? value : `${value}${value ? ", " : ""}${name}`)}>{name}</button>)}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-white/35">{engine === "ace" ? "ACE-Step on Replicate. Open weights, about 48 seconds." : "Eleven Music. Closest sung quality on a key you already have."}</p>
                <button type="button" className="quiet is-on" disabled={busy} onClick={() => void create()}>{busy ? "Working" : job ? "Check song" : "Create"}</button>
              </div>
              {status ? <p className="mt-3 text-sm text-white/50">{status}</p> : null}
            </section>
            <section className="module-card p-3">
              {!data.songs.length ? <p className="p-3 text-sm text-white/40">Songs land here, like a workspace. Press the cover to play.</p> : null}
              {songs(data.songs)}
            </section>
          </div>
        ) : null}
        {view === "video" ? (
          <section className="module-card grid gap-3 p-4">
            <div>
              <h2 className="text-lg">Music video</h2>
              <p className="text-sm text-white/50">Image, song, and a prompt. Luma makes a 9 second picture and it loops under the full song.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.songs.map((song) => (
                <button key={song.id} type="button" className={`quiet ${clipId === song.id ? "is-on" : ""}`} onClick={() => openVideo(song)}>{song.title}</button>
              ))}
            </div>
            <label className="text-[11px] text-white/45">Image
              <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={still} placeholder="https:// image" onChange={(event) => setStill(event.target.value)} />
            </label>
            <label className="inline-flex">
              <span className="quiet">Upload image</span>
              <input className="hidden" type="file" accept="image/*" onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setStatus("Uploading image…");
                void uploadFile(file).then((url) => { setStill(url); setStatus("Image ready."); }).catch(() => setStatus("Image upload failed."));
              }} />
            </label>
            <label className="text-[11px] text-white/45">How the picture should move
              <textarea className="mt-1 min-h-24 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={motion} onChange={(event) => setMotion(event.target.value)} />
            </label>
            <button type="button" className="quiet is-on w-fit" onClick={() => {
              const song = data.songs.find((row) => row.id === clipId);
              if (!song) { setStatus("Pick a song."); return; }
              void makeVideo(song);
            }}>{videoJob ? "Check video" : "Make video"}</button>
            {status ? <p className="text-sm text-white/50">{status}</p> : null}
            {data.songs.find((row) => row.id === clipId)?.video ? <MusicCut video={data.songs.find((row) => row.id === clipId)?.video || ""} audio={data.songs.find((row) => row.id === clipId)?.audio || ""} /> : null}
          </section>
        ) : null}
        {view === "explore" ? (
          <section className="module-card p-4">
            <p className="text-sm text-white/50">Pick a style. It opens Custom with that sound filled in.</p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {STYLES.map((name) => (
                <button key={name} type="button" className="quiet" onClick={() => { setMode("custom"); setStyle(name); setView("create"); }}>{name}</button>
              ))}
            </div>
            <div className="mt-6 grid gap-2">
              {data.songs.filter((row) => row.pub).map((song) => (
                <button key={song.id} type="button" className="menu" onClick={() => setOpenId(song.id)}>
                  <span className="block">{song.title}</span>
                  <span className="block text-white/40">{song.note || "Public"}</span>
                </button>
              ))}
              {!data.songs.some((row) => row.pub) ? <p className="text-sm text-white/40">Public songs show here.</p> : null}
            </div>
          </section>
        ) : null}
        {view === "library" || view === "search" ? (
          <section className="module-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={q} placeholder="Search by song, style, or lyrics" onChange={(event) => setQ(event.target.value)} />
              {(["all", "liked", "public"] as Shelf[]).map((name) => (
                <button key={name} type="button" className={`quiet ${shelf === name ? "is-on" : ""}`} onClick={() => setShelf(name)}>{name[0].toUpperCase() + name.slice(1)}</button>
              ))}
            </div>
            {!listed.length ? <p className="p-3 text-sm text-white/40">No songs match.</p> : null}
            {songs(listed)}
          </section>
        ) : null}
        {open ? (
          <section className="module-card grid gap-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Art song={open} />
              <div className="min-w-0 flex-1">
                <input className="h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={open.title} onChange={(event) => patch(open.id, { title: event.target.value.slice(0, 80) })} />
                <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={open.note} placeholder="Style" onChange={(event) => patch(open.id, { note: event.target.value.slice(0, 240) })} />
              </div>
              <button type="button" className="quiet" onClick={() => void makeCover(open)}>Cover</button>
              <button type="button" className="quiet" onClick={() => void makeVocal(open)}>Read</button>
              <button type="button" className="quiet" onClick={() => openVideo(open)}>Video</button>
              <button type="button" className="link-remove" onClick={() => { update((prev) => ({ ...prev, songs: prev.songs.filter((row) => row.id !== open.id) })); setOpenId(null); }}>Delete</button>
              <button type="button" className="quiet" onClick={() => setOpenId(null)}>Close</button>
            </div>
            {open.audio ? <button type="button" className="quiet is-on" onClick={() => { if (playing.track?.id === open.id) togglePause(); else playCut({ id: open.id, title: open.title, artist: "Music Einstein", album: open.note || "", url: open.audio || "", page: "", art: "" }); }}>{playing.track?.id === open.id && !playing.paused ? "Pause vocal" : "Play vocal"}</button> : null}
            {open.audio ? <button type="button" className="quiet" onClick={() => downloadFile(`${open.title || "song"}.mp3`, open.audio || "")}>Download song</button> : null}
            {open.video ? <button type="button" className="quiet" onClick={() => downloadFile(`${open.title || "video"}.mp4`, open.video || "")}>Download video</button> : null}
            {open.lyrics ? <button type="button" className="quiet" onClick={() => downloadText(`${open.title || "lyrics"}.txt`, open.lyrics || "")}>Download lyrics</button> : null}
            {open.video && open.audio ? <MusicCut video={open.video} audio={open.audio} /> : open.video ? <video className="max-h-64 w-full" controls src={open.video} /> : null}
            <textarea className="min-h-40 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={open.lyrics || ""} onChange={(event) => patch(open.id, { lyrics: event.target.value.slice(0, 4000) })} />
            {status ? <p className="text-sm text-white/50">{status}</p> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
