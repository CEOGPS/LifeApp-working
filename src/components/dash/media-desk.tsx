import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { newId, type Memory } from "./memory";
import { fmtDate } from "./format";
import { playCut } from "./player";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Kind = "image" | "video" | "audio" | "document" | "other";
type Filter = "all" | "images" | "videos" | "audio" | "documents" | "favorites";
type SortKey = "newest" | "oldest" | "name" | "size";
type Album = { id: string; name: string; color: string; created_at: string };
type Item = {
  id: string;
  album_id: string | null;
  kind: Kind;
  mime: string;
  filename: string;
  title: string;
  alt_text: string;
  url: string;
  size_bytes: number;
  tags: string[];
  vault: boolean;
  favorite: boolean;
  created_at: string;
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All Media" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "documents", label: "Documents" },
  { id: "favorites", label: "Favorites" },
];

function kindOf(mime: string, name: string): Kind {
  if (/^image/i.test(name) || mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image";
  if (/^video/i.test(name) || mime.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(name)) return "video";
  if (/^audio/i.test(name) || mime.startsWith("audio/") || /\.(mp3|wav|m4a)$/i.test(name)) return "audio";
  if (mime === "application/pdf" || mime.startsWith("text/") || /\.(pdf|txt|md|csv)$/i.test(name)) return "document";
  return "other";
}

function Star({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.6 14.7 8.1l6.1.9-4.4 4.3 1 6.1L12 16.8 6.6 19.4l1-6.1L3.2 9l6.1-.9L12 2.6z" fill={on ? "#fbbf24" : "none"} stroke={on ? "#fbbf24" : "#fff"} strokeWidth="1.6" />
    </svg>
  );
}

function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1048576).toFixed(1)} MB`;
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lifeos-media", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("rows")) request.result.createObjectStore("rows");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLibrary(): Promise<{ items: Item[]; albums: Album[] } | null> {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const request = database.transaction("rows", "readonly").objectStore("rows").get("library");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function writeLibrary(items: Item[], albums: Album[]) {
  void openLibrary().then((database) => new Promise<void>((resolve, reject) => {
    const tx = database.transaction("rows", "readwrite");
    tx.objectStore("rows").put({ items, albums }, "library");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => undefined);
}

async function uploadFile(file: Blob, name: string) {
  const form = new FormData();
  form.append("file", file, name);
  const response = await fetch("https://lifeos1-api.ceogps.workers.dev/api/upload?type=media", { method: "POST", body: form });
  const body = await response.json() as { url?: string; file_url?: string };
  const url = body.url || body.file_url || "";
  if (!response.ok || !/^https?:\/\//i.test(url)) throw new Error("upload");
  return url;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

function grade(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Noticeable";
  return "Soft";
}

async function fitImage(src: string, edge: number, quality: number) {
  const img = await loadImage(src);
  const scale = Math.min(1, edge / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((file) => file ? resolve(file) : reject(new Error("blob")), "image/jpeg", quality));
  let score = Math.max(0, Math.min(100, Math.round(quality * 100 - (1 - scale) * 12)));
  try {
    const sample = document.createElement("canvas");
    sample.width = 32;
    sample.height = 32;
    const pen = sample.getContext("2d", { willReadFrequently: true });
    if (!pen) throw new Error("canvas");
    pen.drawImage(img, 0, 0, 32, 32);
    const orig = pen.getImageData(0, 0, 32, 32).data;
    const preview = URL.createObjectURL(blob);
    const back = await loadImage(preview);
    URL.revokeObjectURL(preview);
    pen.drawImage(back, 0, 0, 32, 32);
    const next = pen.getImageData(0, 0, 32, 32).data;
    let diff = 0;
    for (let index = 0; index < orig.length; index += 4) diff += Math.abs(orig[index] - next[index]) + Math.abs(orig[index + 1] - next[index + 1]) + Math.abs(orig[index + 2] - next[index + 2]);
    const mean = diff / (32 * 32 * 3);
    score = Math.max(0, Math.min(100, Math.round(100 - mean * 2.4)));
  } catch { /* remote pictures can block the pixel check; the size gauge still holds */ }
  return { blob, w, h, score, bytes: blob.size };
}

function shelfItem(row: { id: string; title: string; body: string; at: string }): Item | null {
  if (!row.title.startsWith("Shelf · ") || row.title === "Shelf · albums") return null;
  try {
    const body = JSON.parse(row.body) as Partial<Item> & { size?: number; album?: string | null };
    if (!body.url || !/^https?:\/\//i.test(body.url)) return null;
    return {
      id: row.id,
      album_id: body.album || null,
      kind: body.kind || "other",
      mime: body.mime || "",
      filename: body.filename || row.title,
      title: row.title.replace(/^Shelf · /, ""),
      alt_text: body.alt_text || "",
      url: body.url,
      size_bytes: body.size || body.size_bytes || 0,
      tags: Array.isArray(body.tags) ? body.tags : [],
      vault: Boolean(body.vault),
      favorite: Boolean(body.favorite),
      created_at: row.at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function remember(items: Item[], albums: Album[], update: Update) {
  const shelf = items.filter((item) => /^https?:\/\//i.test(item.url)).slice(0, 320).map((item) => ({
    id: item.id,
    title: `Shelf · ${(item.title || item.filename).slice(0, 80)}`,
    body: JSON.stringify({ url: item.url, kind: item.kind, mime: item.mime, filename: item.filename, size: item.size_bytes, tags: item.tags, favorite: item.favorite, album: item.album_id, alt_text: item.alt_text, vault: item.vault }),
    at: item.created_at,
  }));
  update((prev) => ({
    ...prev,
    media: [
      { id: "media-albums", title: "Shelf · albums", body: JSON.stringify(albums), at: new Date().toISOString() },
      ...shelf,
      ...prev.media.filter((row) => !row.title.startsWith("Shelf · ")),
    ].slice(0, 400),
  }));
}

export function YoutubeBox({ apiKey = "", query = "" }: { apiKey?: string; query?: string }) {
  const [q, setQ] = useState(query);
  const [hits, setHits] = useState<{ id: string; title: string; author: string }[]>([]);
  const [play, setPlay] = useState("");
  const [note, setNote] = useState("");
  async function search(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const pasted = text.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (pasted) {
      setPlay(pasted);
      setHits([{ id: pasted, title: "Pasted video", author: "" }]);
      setNote("");
      return;
    }
    setNote("Searching…");
    const { youtubeSearch } = await import("@/lib/lifeos/sync");
    const result = await youtubeSearch({ data: { query: text, key: apiKey } });
    setHits(result.videos);
    setPlay(result.videos[0]?.id || "");
    setNote(result.error || "");
  }
  useEffect(() => {
    if (query.trim()) void search(query).catch(() => setNote("YouTube search did not answer."));
  }, [query]);
  return (
    <div className="min-w-0">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void search(q).catch(() => setNote("YouTube search did not answer.")); }}>
        <input className="h-8 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Search YouTube" value={q} onChange={(event) => setQ(event.target.value)} />
        <button type="submit" className="quiet is-on">Search</button>
      </form>
      {play ? (
        <div className="relative mt-3">
          <iframe className="aspect-video min-h-80 w-full rounded-xl" src={`https://www.youtube-nocookie.com/embed/${play}?rel=0&modestbranding=1&iv_load_policy=3`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          <div className="absolute inset-x-0 top-0 h-14" />
        </div>
      ) : null}
      <div className="mt-2 grid min-w-0 gap-1">
        {hits.map((row) => (
          <button key={row.id} type="button" className={`menu yt-hit min-w-0 ${play === row.id ? "is-on" : ""}`} onClick={() => setPlay(row.id)}>
            <span className="block whitespace-normal break-words text-left text-sm leading-5">{row.title}</span>
            {row.author ? <span className="block whitespace-normal break-words text-left text-[11px] leading-4 text-white/40">{row.author}</span> : null}
          </button>
        ))}
      </div>
      {note ? <p className="mt-2 whitespace-normal break-words text-sm text-white/50">{note}</p> : null}
    </div>
  );
}

function ResizeBox({ item, onClose, onSave }: { item: Item; onClose: () => void; onSave: (blob: Blob, width: number, height: number) => void }) {
  const [edge, setEdge] = useState(1920);
  const [quality, setQuality] = useState(0.86);
  const [shot, setShot] = useState<{ w: number; h: number; score: number; bytes: number; blob: Blob } | null>(null);
  const [note, setNote] = useState("Checking the picture…");
  useEffect(() => {
    let live = true;
    void fitImage(item.url, edge, quality).then((result) => {
      if (!live) return;
      setShot(result);
      setNote(result.score >= 88 ? "Safe. The picture holds." : result.score >= 75 ? "Still good. Smaller, a little softer." : "This cut is visible. Move the sliders up.");
    }).catch(() => { if (live) setNote("This picture could not be measured."); });
    return () => { live = false; };
  }, [item.url, edge, quality]);
  async function best() {
    setNote("Looking for the smallest cut that stays sharp…");
    const img = await loadImage(item.url);
    const long = Math.max(img.width, img.height);
    const edges = [...new Set([long, 2560, 1920, 1600, 1280].filter((value) => value <= long))].sort((a, b) => b - a);
    let pick: { w: number; h: number; score: number; bytes: number; blob: Blob; edge: number } | null = null;
    for (const value of edges) {
      const result = await fitImage(item.url, value, 0.86);
      if (!pick || (result.score >= 88 && result.bytes < pick.bytes) || (pick.score < 88 && result.score > pick.score)) pick = { ...result, edge: value };
      if (result.score >= 88 && result.bytes < item.size_bytes * 0.7) break;
    }
    if (!pick) return;
    setEdge(pick.edge);
    setQuality(0.86);
    setShot(pick);
    setNote(`${pick.w}×${pick.h} at 86% is the best cut. ${grade(pick.score)}.`);
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={onClose}>
      <div className="module-card w-full max-w-lg p-4" onClick={(event) => event.stopPropagation()}>
        <p className="text-sm">Resize · {item.title || item.filename}</p>
        <p className="mt-1 text-[11px] text-white/40">Original {bytes(item.size_bytes)}</p>
        <label className="mt-3 block text-[11px] text-white/50">Longest side · {edge}px
          <input className="mt-1 w-full accent-emerald-300" type="range" min={640} max={3840} step={64} value={edge} onChange={(event) => setEdge(Number(event.target.value))} />
        </label>
        <label className="mt-2 block text-[11px] text-white/50">Quality · {Math.round(quality * 100)}%
          <input className="mt-1 w-full accent-emerald-300" type="range" min={0.6} max={0.95} step={0.01} value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
        </label>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-emerald-300/80" style={{ width: `${shot?.score || 0}%` }} />
        </div>
        <p className="mt-2 text-sm text-white/70">{shot ? `${grade(shot.score)} · ${shot.score} · ${shot.w}×${shot.h} · ${bytes(shot.bytes)}` : "Measuring…"}</p>
        <p className="text-[11px] text-white/40">{note}</p>
        <div className="mt-4 flex justify-end gap-3">
          <button type="button" className="quiet" onClick={onClose}>Cancel</button>
          <button type="button" className="quiet" onClick={() => void best()}>Best size</button>
          <button type="button" className="quiet is-on" disabled={!shot} onClick={() => shot && onSave(shot.blob, shot.w, shot.h)}>Save copy</button>
        </div>
      </div>
    </div>
  );
}

export function MediaDesk({ data, update }: { data: Memory; update: Update }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(0);
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Item | null>(null);
  const [edit, setEdit] = useState<Item | null>(null);
  const [resize, setResize] = useState<Item | null>(null);
  const [albumForm, setAlbumForm] = useState<Album | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [showVault, setShowVault] = useState(false);

  useEffect(() => {
    void readLibrary().then((saved) => {
      const local = saved?.items || [];
      const cloud = data.media.map(shelfItem).filter((row): row is Item => Boolean(row));
      let nextAlbums = saved?.albums || [];
      const albumRow = data.media.find((row) => row.title === "Shelf · albums");
      if (albumRow) {
        try {
          const parsed = JSON.parse(albumRow.body) as Album[];
          if (Array.isArray(parsed) && parsed.length) nextAlbums = parsed;
        } catch { /* keep local albums */ }
      }
      const map = new Map<string, Item>();
      for (const row of cloud) map.set(row.id, row);
      for (const row of local) {
        const previous = map.get(row.id);
        map.set(row.id, previous && /^https?:\/\//i.test(previous.url) && row.url.startsWith("data:") ? previous : row);
      }
      setItems([...map.values()]);
      setAlbums(nextAlbums);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeLibrary(items, albums);
    remember(items, albums, update);
  }, [items, albums, ready]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = items.filter((item) => showVault || !item.vault);
    if (albumId) rows = rows.filter((item) => item.album_id === albumId);
    else if (filter === "images") rows = rows.filter((item) => item.kind === "image");
    else if (filter === "videos") rows = rows.filter((item) => item.kind === "video");
    else if (filter === "audio") rows = rows.filter((item) => item.kind === "audio");
    else if (filter === "documents") rows = rows.filter((item) => item.kind === "document");
    else if (filter === "favorites") rows = rows.filter((item) => item.favorite);
    if (needle) rows = rows.filter((item) => `${item.title} ${item.filename} ${item.alt_text} ${item.tags.join(" ")}`.toLowerCase().includes(needle));
    rows = [...rows].sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "name") return (a.title || a.filename).localeCompare(b.title || b.filename);
      if (sort === "size") return b.size_bytes - a.size_bytes;
      return b.created_at.localeCompare(a.created_at);
    });
    return rows;
  }, [items, filter, albumId, q, sort, showVault]);

  const pages = Math.max(1, Math.ceil(shown.length / 60));
  const pageRows = shown.slice(page * 60, page * 60 + 60);

  async function addFiles(files: File[]) {
    const accepted = files.filter((file) => /^(image|video|audio|text)\//.test(file.type) || file.type === "application/pdf");
    if (!accepted.length) { setNote("Use an image, video, audio, PDF, or text file."); return; }
    for (const file of accepted.slice(0, 20)) {
      if (file.size > 80_000_000) { setNote(`${file.name} is over 80 MB.`); continue; }
      setNote(`Saving ${file.name}…`);
      try {
        const url = await uploadFile(file, file.name);
        const item: Item = {
          id: newId(),
          album_id: albumId,
          kind: kindOf(file.type, file.name),
          mime: file.type,
          filename: file.name,
          title: file.name.replace(/\.[^.]+$/, ""),
          alt_text: "",
          url,
          size_bytes: file.size,
          tags: [],
          vault: false,
          favorite: false,
          created_at: new Date().toISOString(),
        };
        setItems((prev) => [item, ...prev]);
        setNote(`${file.name} is stored.`);
      } catch {
        setNote(`${file.name} did not upload. It was not kept, so it cannot disappear later.`);
      }
    }
  }

  function saveAlbum() {
    if (!albumForm?.name.trim()) return;
    setAlbums((prev) => albumForm.id && prev.some((row) => row.id === albumForm.id) ? prev.map((row) => row.id === albumForm.id ? albumForm : row) : [albumForm, ...prev]);
    setAlbumId(albumForm.id);
    setAlbumForm(null);
  }

  async function autoTag() {
    const open = shown.filter((item) => item.tags.length === 0).slice(0, 8);
    if (!open.length) { setNote("Nothing in view needs tags."); return; }
    setNote("Tagging from the file names…");
    const { askNyx } = await import("@/lib/lifeos/sync");
    const result = await askNyx({ data: { question: "Return JSON only: {items:[{id,tags:string[]}]}. Up to 4 lowercase tags from the filename and kind. Do not invent what the picture shows.", facts: JSON.stringify(open.map((item) => ({ id: item.id, filename: item.filename, kind: item.kind }))) } });
    if (!result.ok || !result.text) { setNote("Tagging needs the xAI key on the server."); return; }
    try {
      const parsed = JSON.parse(result.text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as { items?: { id: string; tags: string[] }[] };
      const map = new Map((parsed.items || []).map((row) => [row.id, row.tags.slice(0, 4)]));
      setItems((prev) => prev.map((item) => map.has(item.id) ? { ...item, tags: map.get(item.id) || item.tags } : item));
      setNote(`Tagged ${map.size}.`);
    } catch {
      setNote(result.text);
    }
  }

  function exportCsv() {
    const header = "title,kind,filename,size,album,tags,favorite,created,url\n";
    const body = shown.map((item) => [item.title, item.kind, item.filename, String(item.size_bytes), albums.find((row) => row.id === item.album_id)?.name || "", item.tags.join("|"), item.favorite ? "yes" : "no", fmtDate(item.created_at), item.url].map((cell) => /[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "lifeos-media.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function toggleStar(id: string) {
    setItems((prev) => prev.map((row) => row.id === id ? { ...row, favorite: !row.favorite } : row));
  }

  return (
    <div className="grid gap-3" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles([...event.dataTransfer.files]); }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Media</h1>
          <p className="text-sm text-white/50">Files upload and stay. The catalog syncs with the board.</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="bg-blue" onClick={() => fileRef.current?.click()}>Upload</button>
          <button type="button" className="link-add" onClick={() => setAlbumForm({ id: newId(), name: "", color: "#5eead4", created_at: new Date().toISOString() })}>New album</button>
        </div>
      </div>
      <div className="module-card p-3">
        <YoutubeBox apiKey={data.keys.find((row) => row.name === "YouTube")?.value || ""} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[14rem_1fr]">
        <aside className="module-card h-fit p-3">
          <p className="mb-1 text-[10px] tracking-widest text-white/35">SMART FILTERS</p>
          {FILTERS.map((row) => (
            <button key={row.id} type="button" className={`menu ${!albumId && filter === row.id ? "is-on" : ""}`} onClick={() => { setFilter(row.id); setAlbumId(null); setPage(0); }}>{row.label}</button>
          ))}
          <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">ALBUMS</p>
          {albums.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <button type="button" className={`menu ${albumId === row.id ? "is-on" : ""}`} onClick={() => { setAlbumId(row.id); setPage(0); }}>{row.name}</button>
              <button type="button" className="link-remove" onClick={() => { setAlbums((prev) => prev.filter((item) => item.id !== row.id)); setItems((prev) => prev.map((item) => item.album_id === row.id ? { ...item, album_id: null } : item)); if (albumId === row.id) setAlbumId(null); }}>Remove</button>
            </div>
          ))}
          {!albums.length ? <p className="px-0 text-[11px] text-white/30">No albums yet</p> : null}
          <label className="mt-4 flex items-center gap-2 text-[11px] text-white/50">
            <input type="checkbox" checked={showVault} onChange={(event) => setShowVault(event.target.checked)} /> Show vault-linked
          </label>
        </aside>
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={q} placeholder="Search media" onChange={(event) => { setQ(event.target.value); setPage(0); }} />
            <span className="text-[11px] text-white/40">{shown.length} of {items.length}</span>
            <select className="h-8 rounded-full border border-line bg-black/40 px-2 text-xs" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <button type="button" className={`quiet ${view === "grid" ? "is-on" : ""}`} onClick={() => setView("grid")}>Grid</button>
            <button type="button" className={`quiet ${view === "list" ? "is-on" : ""}`} onClick={() => setView("list")}>List</button>
            <button type="button" className="quiet" onClick={() => void autoTag()}>Auto-tag</button>
            <button type="button" className="quiet" onClick={exportCsv}>Export</button>
            <input ref={fileRef} className="sr-only" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.txt,.md,.csv" onChange={(event) => { void addFiles([...(event.target.files || [])]); event.target.value = ""; }} />
          </div>
          {note ? <p className="mb-3 text-sm text-white/50">{note}</p> : null}
          {dragging ? <p className="mb-3 text-sm text-blue-2">Drop files to upload.</p> : null}
          {!shown.length ? <p className="text-sm text-white/40">No media yet. Drop images, videos, audio, or documents here.</p> : null}
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {pageRows.map((item) => (
                <div key={item.id} className="module-card overflow-hidden">
                  <div className="relative">
                    <button type="button" className="menu" onClick={() => setPreview(item)}>
                      {item.kind === "image" && !item.vault && item.url ? <img src={item.url} alt={item.alt_text || item.title} className="h-36 w-full object-cover" /> : <span className="grid h-36 w-full place-items-center text-xs uppercase text-white/40">{item.vault ? "Vault" : item.kind}</span>}
                    </button>
                    <button type="button" className="icon absolute top-2 right-2" aria-label={item.favorite ? "Unstar" : "Star"} onClick={() => toggleStar(item.id)}><Star on={item.favorite} /></button>
                  </div>
                  <div className="px-2 py-2">
                    <p className="truncate text-sm">{item.title || item.filename}</p>
                    <p className="text-[11px] text-white/40">{item.kind} · {bytes(item.size_bytes)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="module-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[10px] tracking-widest text-white/40"><th className="p-2"></th><th>Name</th><th>Kind</th><th>Size</th><th>Tags</th><th>Added</th><th></th></tr></thead>
                <tbody>
                  {pageRows.map((item) => (
                    <tr key={item.id} className="border-t border-white/10">
                      <td className="p-2"><button type="button" className="icon" aria-label={item.favorite ? "Unstar" : "Star"} onClick={() => toggleStar(item.id)}><Star on={item.favorite} /></button></td>
                      <td><button type="button" className="quiet" onClick={() => setPreview(item)}>{item.title || item.filename}</button></td>
                      <td>{item.kind}</td>
                      <td>{bytes(item.size_bytes)}</td>
                      <td className="max-w-40 truncate">{item.tags.join(", ")}</td>
                      <td>{fmtDate(item.created_at)}</td>
                      <td className="space-x-2 p-2 text-right">
                        {item.kind === "image" ? <button type="button" className="link-add" onClick={() => setResize(item)}>Resize</button> : null}
                        <button type="button" className="link-add" onClick={() => setEdit(item)}>Edit</button>
                        <button type="button" className="link-remove" onClick={() => setRemoveId(item.id)}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 ? <div className="mt-3 flex items-center justify-center gap-4 text-sm"><button type="button" className="quiet" onClick={() => setPage((value) => Math.max(0, value - 1))}>Prev</button><span>{page + 1} / {pages}</span><button type="button" className="quiet" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}>Next</button></div> : null}
        </section>
      </div>
      {preview ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setPreview(null)}>
          <div className="module-card max-h-[90vh] w-full max-w-3xl overflow-auto p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="truncate">{preview.title || preview.filename}</p>
              <span className="flex items-center gap-3">
                <button type="button" className="icon" aria-label={preview.favorite ? "Unstar" : "Star"} onClick={() => { toggleStar(preview.id); setPreview({ ...preview, favorite: !preview.favorite }); }}><Star on={preview.favorite} /></button>
                <button type="button" className="quiet" onClick={() => setPreview(null)}>Close</button>
              </span>
            </div>
            {preview.vault ? <p className="text-sm text-white/60">This file is flagged for the Vault. <Link to="/panel/$slug" params={{ slug: "vault" }} className="text-blue-2">Open Vault</Link></p> : null}
            {!preview.vault && preview.kind === "image" && preview.url ? <img src={preview.url} alt={preview.alt_text || preview.title} className="max-h-[60vh] w-full object-contain" /> : null}
            {!preview.vault && preview.kind === "video" && preview.url ? <video src={preview.url} controls className="max-h-[60vh] w-full" /> : null}
            {!preview.vault && preview.kind === "audio" && preview.url ? <button type="button" className="quiet is-on" onClick={() => playCut({ id: preview.id, title: preview.title || preview.filename, artist: "Media", album: "", url: preview.url, page: "", art: "" })}>Play</button> : null}
            {!preview.vault && preview.kind === "document" && preview.url ? <a className="text-sm text-blue-2" href={preview.url} target="_blank" rel="noreferrer">Open file</a> : null}
            <p className="mt-3 text-[11px] text-white/40">{[preview.kind, preview.mime, bytes(preview.size_bytes), fmtDate(preview.created_at), preview.tags.join(", ")].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex gap-3">
              {preview.kind === "image" ? <button type="button" className="link-add" onClick={() => { setResize(preview); setPreview(null); }}>Resize</button> : null}
              <button type="button" className="link-add" onClick={() => { setEdit(preview); setPreview(null); }}>Edit</button>
              <button type="button" className="link-remove" onClick={() => setRemoveId(preview.id)}>Remove</button>
            </div>
          </div>
        </div>
      ) : null}
      {resize ? (
        <ResizeBox item={resize} onClose={() => setResize(null)} onSave={(blob, width, height) => {
          const name = `${(resize.title || "image").replace(/\s+/g, "-")}-${width}.jpg`;
          setNote("Saving the resized copy…");
          void uploadFile(blob, name).then((url) => {
            setItems((prev) => [{ ...resize, id: newId(), filename: name, title: `${resize.title} ${width}`, url, mime: "image/jpeg", size_bytes: blob.size, created_at: new Date().toISOString() }, ...prev]);
            setNote(`Copy saved at ${width}×${height}. The original is still here.`);
            setResize(null);
          }).catch(() => setNote("The resized copy did not upload."));
        }} />
      ) : null}
      {edit ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setEdit(null)}>
          <div className="module-card w-full max-w-md p-4" onClick={(event) => event.stopPropagation()}>
            <p className="mb-3 text-sm">Edit item</p>
            <label className="mb-2 block text-[11px] text-white/50">Title<input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} /></label>
            <label className="mb-2 block text-[11px] text-white/50">Album<select className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={edit.album_id || ""} onChange={(event) => setEdit({ ...edit, album_id: event.target.value || null })}><option value="">Unfiled</option>{albums.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="mb-2 block text-[11px] text-white/50">Alt text<input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={edit.alt_text} onChange={(event) => setEdit({ ...edit, alt_text: event.target.value })} /></label>
            <label className="mb-2 block text-[11px] text-white/50">Tags<input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={edit.tags.join(", ")} onChange={(event) => setEdit({ ...edit, tags: event.target.value.split(",").map((part) => part.trim()).filter(Boolean) })} /></label>
            <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.favorite} onChange={(event) => setEdit({ ...edit, favorite: event.target.checked })} /> Favorite</label>
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.vault} onChange={(event) => setEdit({ ...edit, vault: event.target.checked })} /> Vault-linked</label>
            <div className="flex justify-end gap-3">
              <button type="button" className="quiet" onClick={() => setEdit(null)}>Cancel</button>
              <button type="button" className="bg-blue" onClick={() => { setItems((prev) => prev.map((row) => row.id === edit.id ? edit : row)); setEdit(null); }}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
      {albumForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setAlbumForm(null)}>
          <div className="module-card w-full max-w-sm p-4" onClick={(event) => event.stopPropagation()}>
            <p className="mb-3 text-sm">New album</p>
            <input className="h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={albumForm.name} placeholder="Album name" onChange={(event) => setAlbumForm({ ...albumForm, name: event.target.value })} />
            <div className="mt-3 flex justify-end gap-3">
              <button type="button" className="quiet" onClick={() => setAlbumForm(null)}>Cancel</button>
              <button type="button" className="bg-blue" onClick={saveAlbum}>Create</button>
            </div>
          </div>
        </div>
      ) : null}
      {removeId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setRemoveId(null)}>
          <div className="module-card w-full max-w-sm p-4" onClick={(event) => event.stopPropagation()}>
            <p className="text-sm">Remove this file from the library?</p>
            <div className="mt-3 flex justify-end gap-3">
              <button type="button" className="quiet" onClick={() => setRemoveId(null)}>Cancel</button>
              <button type="button" className="danger" onClick={() => { setItems((prev) => prev.filter((row) => row.id !== removeId)); setPreview(null); setRemoveId(null); }}>Remove</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
