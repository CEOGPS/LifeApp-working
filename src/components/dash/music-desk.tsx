import { useEffect, useState } from "react";
import type { Track } from "@/lib/lifeos/board";
import { newId, type Memory } from "./memory";
import { playCut, seekTo, setPlayerMuted, setPlayerRepeat, setPlayerShuffle, setPlayerVolume, step, stopCut, togglePause, usePlayer } from "./player";

type Update = (recipe: (prev: Memory) => Memory) => void;

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function fromName(name: string) {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_]+/g, " ").trim();
  const parts = base.split(/\s+-\s+/);
  if (parts.length >= 2) return { artist: parts[0].slice(0, 80), title: parts.slice(1).join(" - ").slice(0, 120) };
  return { artist: "Local", title: base.slice(0, 120) || "Track" };
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

export function MusicDesk({ data, update }: { data: Memory; update: Update }) {
  const play = usePlayer();
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [hits, setHits] = useState<{ id: string; title: string; artist: string; album: string; url: string; preview: string; art: string }[]>([]);
  const [remote, setRemote] = useState<{ id: string; name: string; url: string }[]>([]);
  const [list, setList] = useState("Library");
  const [fresh, setFresh] = useState("");
  const [filter, setFilter] = useState("");
  const [showQueue, setShowQueue] = useState(false);
  const [duetOpen, setDuetOpen] = useState(false);
  const [duet, setDuet] = useState({ who: "", style: "Silly", setting: "Atlanta park", extra: "", lyrics: "" });
  const names = [...new Set(data.tracks.map((row) => row.playlist || "Library"))];
  const made = data.songs.filter((row) => row.audio).map((row) => ({
    id: row.id, title: row.title, artist: "Music Einstein", album: row.note || "Made", url: row.audio || "", page: "", playlist: "Made", art: row.cover || "",
  }));
  const source = list === "Made" ? made : list === "Liked" ? data.tracks.filter((row) => row.playlist === "Liked") : list === "Library" ? data.tracks : data.tracks.filter((row) => row.playlist === list);
  const needle = filter.trim().toLowerCase();
  const queue = source.filter((row) => !needle || `${row.title} ${row.artist} ${row.album}`.toLowerCase().includes(needle));
  const cuts = queue.map((row) => ({ id: row.id, title: row.title, artist: row.artist, album: row.album, url: row.url, page: row.page, art: row.art }));
  const playing = play.track;

  function addTracks(rows: Track[]) {
    if (!rows.length) return;
    update((prev) => ({ ...prev, tracks: [...rows, ...prev.tracks].slice(0, 400) }));
  }

  function saveHit(row: { title: string; artist: string; album: string; url: string; preview: string; art: string }, playlist: string) {
    addTracks([{ id: newId(), title: row.title, artist: row.artist, album: row.album, url: row.preview || "", page: row.url, playlist, art: row.art }]);
  }

  async function ask(action: "home" | "search", query = "") {
    setNote(action === "search" ? "Searching Spotify…" : "");
    const { readOauth } = await import("@/lib/lifeos/oauth");
    const token = readOauth().find((row) => row.provider === "spotify")?.token || "";
    const { spotifyHub } = await import("@/lib/lifeos/env-keys");
    const result = await spotifyHub({ data: { token, action, query } });
    setHits(result.tracks);
    if (action === "home") setRemote(result.playlists);
    setNote(result.error || "");
  }

  async function importFiles(files: FileList | null) {
    const batch = [...(files || [])].filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|flac|ogg|aac)$/i.test(file.name)).slice(0, 25);
    if (!batch.length) { setNote("Choose audio files. mp3, wav, m4a, flac, or ogg."); return; }
    const playlist = list === "Made" || list === "Liked" ? "Library" : list;
    const added: Track[] = [];
    for (const file of batch) {
      setNote(`Importing ${added.length + 1} of ${batch.length}…`);
      try {
        const url = await uploadFile(file);
        const meta = fromName(file.name);
        added.push({ id: newId(), title: meta.title, artist: meta.artist, album: playlist, url, page: "", playlist, art: "" });
      } catch {
        setNote(`${file.name} did not upload.`);
      }
    }
    addTracks(added);
    setNote(added.length ? `${added.length} saved to ${playlist}.` : "Nothing imported.");
  }

  useEffect(() => {
    void ask("home").catch(() => setNote("Spotify did not answer."));
  }, []);

  const playRows = () => { if (cuts[0]) playCut(cuts[0], cuts); };

  return (
    <div className="grid gap-3 lg:grid-cols-[13rem_1fr]" onKeyDown={(event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === "Space") { event.preventDefault(); togglePause(); }
      if (event.code === "ArrowRight") step(1);
      if (event.code === "ArrowLeft") step(-1);
    }}>
      <aside className="module-card h-fit p-3">
        <button type="button" className={`menu ${list === "Library" && !hits.length ? "is-on" : ""}`} onClick={() => { setList("Library"); setHits([]); }}>Library</button>
        <button type="button" className={`menu ${list === "Liked" ? "is-on" : ""}`} onClick={() => { setList("Liked"); setHits([]); }}>Liked</button>
        <button type="button" className={`menu ${list === "Made" ? "is-on" : ""}`} onClick={() => { setList("Made"); setHits([]); }}>Made</button>
        {names.filter((name) => name !== "Library" && name !== "Liked").map((name) => (
          <button key={name} type="button" className={`menu ${list === name ? "is-on" : ""}`} onClick={() => { setList(name); setHits([]); }}>{name}</button>
        ))}
        <div className="mt-3 flex gap-2">
          <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={fresh} placeholder="Playlist" onChange={(event) => setFresh(event.target.value)} />
          <button type="button" className="quiet" onClick={() => { const name = fresh.trim().slice(0, 40); if (!name) return; setList(name); setFresh(""); setHits([]); }}>Add</button>
        </div>
        {remote.length ? <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">SPOTIFY</p> : null}
        {remote.map((row) => <a key={row.id} className="menu block truncate" href={row.url} target="_blank" rel="noreferrer">{row.name}</a>)}
        <button type="button" className="quiet mt-4" onClick={() => setDuetOpen((value) => !value)}>Karaoke</button>
      </aside>
      <div className="min-w-0">
        <section className="module-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] tracking-widest text-white/35">{hits.length ? "SEARCH" : "PLAYLIST"}</p>
              <h1 className="text-2xl">{hits.length ? q || "Spotify" : list}</h1>
              <p className="text-sm text-white/45">{hits.length ? `${hits.length} results` : `${queue.length} songs`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="quiet is-on" onClick={playRows}>Play</button>
              <label className="quiet is-on">
                Import
                <input className="hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.aac" multiple onChange={(event) => { const files = event.target.files; event.target.value = ""; void importFiles(files); }} />
              </label>
              <button type="button" className="quiet" onClick={() => void import("@/lib/lifeos/oauth").then(({ startOAuth }) => startOAuth("spotify")).catch((error: unknown) => setNote(error instanceof Error ? error.message : "Spotify did not connect."))}>Spotify</button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <input className="h-8 min-w-40 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={filter} placeholder="Filter this list" onChange={(event) => setFilter(event.target.value)} />
            <input className="h-8 min-w-40 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={q} placeholder="Search Spotify" onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && q.trim()) void ask("search", q).catch(() => setNote("Spotify search did not answer.")); }} />
            <button type="button" className="quiet" onClick={() => { if (q.trim()) void ask("search", q).catch(() => setNote("Spotify search did not answer.")); }}>Search</button>
            {hits.length ? <button type="button" className="quiet" onClick={() => setHits([])}>Back</button> : null}
          </div>
          {note ? <p className="mt-3 text-sm text-white/50">{note}</p> : null}
        </section>
        <section className="module-card mt-3 max-h-[34rem] overflow-y-auto p-2">
          <div className="grid grid-cols-[2rem_1fr_8rem] gap-2 px-2 py-1 text-[10px] tracking-widest text-white/30">
            <span>#</span><span>Title</span><span className="text-right">Album</span>
          </div>
          {(hits.length ? hits : queue).map((row, index) => {
            const hit = "preview" in row ? row : null;
            const saved = "playlist" in row ? row : null;
            const art = row.art;
            const active = playing?.id === (hit ? hit.id : row.id);
            return (
              <div key={`${row.title}-${index}`} className={`grid grid-cols-[2rem_1fr_8rem] items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5 ${active ? "bg-white/5" : ""}`}>
                <button type="button" className="text-left text-[11px] text-white/40" onClick={() => {
                  if (saved) { playCut(cuts[index] || cuts[0], cuts); return; }
                  if (!hit) return;
                  const next = { id: hit.id || newId(), title: hit.title, artist: hit.artist, album: hit.album, url: hit.preview || "", page: hit.url, art: hit.art };
                  playCut(next, [next]);
                  saveHit(hit, "Library");
                }}>{active && !play.paused ? "▶" : index + 1}</button>
                <div className="flex min-w-0 items-center gap-2">
                  {art ? <img src={art} alt="" className="h-10 w-10 rounded-md object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-md bg-white/10 text-[10px] text-white/40">♪</span>}
                  <span className="min-w-0">
                    <span className="block truncate">{row.title}</span>
                    <span className="block truncate text-[11px] text-white/40">{row.artist || "Local"}</span>
                  </span>
                </div>
                <span className="flex items-center justify-end gap-2 truncate text-[11px] text-white/40">
                  <span className="truncate">{row.album}</span>
                  {hit ? <button type="button" className="link-add" onClick={() => saveHit(hit, "Liked")}>Like</button> : null}
                  {saved && list !== "Made" ? <button type="button" className="link-remove" onClick={() => update((prev) => ({ ...prev, tracks: prev.tracks.filter((item) => item.id !== saved.id) }))}>Remove</button> : null}
                </span>
              </div>
            );
          })}
          {!hits.length && !queue.length ? <p className="p-3 text-sm text-white/40">Import files, or search Spotify. Name files Artist - Title.mp3 and the player splits them.</p> : null}
        </section>
        {duetOpen ? (
          <section className="module-card mt-3 p-3">
            <div className="flex flex-wrap gap-2">
              <input className="h-8 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Singing with" value={duet.who} onChange={(event) => setDuet({ ...duet, who: event.target.value })} />
              {["Silly", "Heartfelt", "Roast"].map((style) => <button key={style} type="button" className={`quiet ${duet.style === style ? "is-on" : ""}`} onClick={() => setDuet({ ...duet, style })}>{style}</button>)}
              <button type="button" className="quiet is-on" onClick={() => {
                if (!duet.who.trim()) { setNote("Name who you are singing with."); return; }
                setNote("Writing an original duet…");
                void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { name: "Duet", prompt: "Write an original G-rated duet. No copyrighted lyrics. Verse for Chris, verse for the partner, chorus for both. Under 180 words.", facts: `Partner: ${duet.who}. Style: ${duet.style}. Setting: ${duet.setting}. Note: ${duet.extra || "none"}.`, question: "Write the duet." } })).then((result) => {
                  const lyrics = result.text || "No lyrics came back.";
                  setDuet((prev) => ({ ...prev, lyrics }));
                  update((prev) => ({ ...prev, notes: [{ id: newId(), title: `Duet · ${duet.who.trim()}`, body: lyrics }, ...prev.notes.filter((row) => row.title !== `Duet · ${duet.who.trim()}`)] }));
                  setNote("Duet saved.");
                }).catch(() => setNote("The duet did not come back."));
              }}>Write</button>
            </div>
            {duet.lyrics ? <p className="mt-3 whitespace-pre-wrap text-sm text-white/75">{duet.lyrics}</p> : null}
          </section>
        ) : null}
        <div className="module-card sticky bottom-2 mt-3 grid items-center gap-3 p-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-3">
            {playing?.art ? <img src={playing.art} alt="" className="h-12 w-12 rounded-md object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-md bg-white/10 text-white/40">♪</span>}
            <div className="min-w-0">
              <p className="truncate text-sm">{playing?.title || "Nothing playing"}</p>
              <p className="truncate text-[11px] text-white/40">{[playing?.artist, playing?.album].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="grid justify-items-center gap-1">
            <div className="flex items-center gap-3">
              <button type="button" className={`quiet ${play.shuffle ? "is-on" : ""}`} onClick={() => setPlayerShuffle(!play.shuffle)}>Shuffle</button>
              <button type="button" className="quiet" onClick={() => step(-1)}>Prev</button>
              <button type="button" className="quiet is-on" onClick={() => { if (playing) togglePause(); else playRows(); }}>{play.paused || !playing ? "Play" : "Pause"}</button>
              <button type="button" className="quiet" onClick={() => step(1)}>Next</button>
              <button type="button" className={`quiet ${play.repeat !== "off" ? "is-on" : ""}`} onClick={() => setPlayerRepeat(play.repeat === "off" ? "all" : play.repeat === "all" ? "one" : "off")}>{play.repeat === "one" ? "One" : "Repeat"}</button>
            </div>
            <div className="flex w-full min-w-56 items-center gap-2">
              <span className="w-8 text-[10px] text-white/40">{clock(play.progress)}</span>
              <input className="w-full accent-emerald-300" type="range" min={0} max={play.duration || 0} step={0.1} value={Math.min(play.progress, play.duration || 0)} aria-label="Seek" onChange={(event) => seekTo(Number(event.target.value))} />
              <span className="w-8 text-[10px] text-white/40">{clock(play.duration)}</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button type="button" className="quiet" onClick={() => setShowQueue((value) => !value)}>{showQueue ? "Hide" : "Queue"}</button>
            <button type="button" className="quiet" onClick={() => setPlayerMuted(!play.muted)}>{play.muted ? "Muted" : "Sound"}</button>
            <input className="w-20 accent-emerald-300" type="range" min={0} max={1} step={0.05} value={play.muted ? 0 : play.volume} aria-label="Volume" onChange={(event) => setPlayerVolume(Number(event.target.value))} />
            <button type="button" className="link-remove" onClick={stopCut}>Stop</button>
          </div>
          {showQueue ? <ul className="max-h-28 overflow-y-auto text-sm md:col-span-3">{queue.map((row) => <li key={row.id}><button type="button" className={playing?.id === row.id ? "text-blue-2" : ""} onClick={() => playCut({ id: row.id, title: row.title, artist: row.artist, album: row.album, url: row.url, page: row.page, art: row.art }, cuts)}>{row.title}</button></li>)}</ul> : null}
        </div>
      </div>
    </div>
  );
}
