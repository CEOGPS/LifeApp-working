import { useEffect, useMemo, useRef, useState } from "react";
import { newId, type Memory } from "./memory";
import { fmtDate } from "./format";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Kind = "image" | "video" | "audio" | "document" | "other";
type Filter = "all" | "images" | "videos" | "audio" | "documents" | "favorites";
type SortKey = "newest" | "oldest" | "name" | "size";
type Album = { id: string; name: string; created_at: string };
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
  favorite: boolean;
  created_at: string;
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All files" },
  { id: "images", label: "Images" },
  { id: "videos", label: "Videos" },
  { id: "audio", label: "Audio" },
  { id: "documents", label: "Documents" },
  { id: "favorites", label: "Favorites" },
];
const SALT = "lifeos.vault.salt";
const CHECK = "lifeos.vault.check";

function kindOf(mime: string, name: string): Kind {
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(name)) return "video";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a)$/i.test(name)) return "audio";
  if (mime === "application/pdf" || mime.startsWith("text/") || /\.(pdf|txt|md|csv)$/i.test(name)) return "document";
  return "other";
}

function bytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1048576).toFixed(1)} MB`;
}

function b64(bytesIn: Uint8Array) {
  let text = "";
  bytesIn.forEach((byte) => { text += String.fromCharCode(byte); });
  return btoa(text);
}

function fromB64(text: string) {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let index = 0; index < bin.length; index += 1) out[index] = bin.charCodeAt(index);
  return out;
}

async function derive(pin: string, salt: Uint8Array) {
  const copy = new Uint8Array(salt.byteLength);
  copy.set(salt);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: copy, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function seal(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text)));
  return `${b64(iv)}.${b64(cipher)}`;
}

async function unseal(key: CryptoKey, packed: string) {
  const [ivText, cipherText] = packed.split(".");
  const iv = fromB64(ivText);
  const cipher = fromB64(cipherText);
  const ivCopy = new Uint8Array(iv.byteLength);
  const cipherCopy = new Uint8Array(cipher.byteLength);
  ivCopy.set(iv);
  cipherCopy.set(cipher);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ivCopy }, key, cipherCopy);
  return new TextDecoder().decode(plain);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lifeos-secure-vault", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("rows")) request.result.createObjectStore("rows");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStore(): Promise<{ albums: string; files: { id: string; secret: string }[] } | null> {
  const database = await openDb();
  return new Promise((resolve, reject) => {
    const request = database.transaction("rows", "readonly").objectStore("rows").get("library");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function writeStore(payload: { albums: string; files: { id: string; secret: string }[] }) {
  void openDb().then((database) => new Promise<void>((resolve, reject) => {
    const tx = database.transaction("rows", "readwrite");
    tx.objectStore("rows").put(payload, "library");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  })).catch(() => undefined);
}

function Star({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2.6 14.7 8.1l6.1.9-4.4 4.3 1 6.1L12 16.8 6.6 19.4l1-6.1L3.2 9l6.1-.9L12 2.6z" fill={on ? "#fbbf24" : "none"} stroke={on ? "#fbbf24" : "#fff"} strokeWidth="1.6" />
    </svg>
  );
}

export function VaultDesk({ data, update }: { data: Memory; update: Update }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<CryptoKey | null>(null);
  const sealed = useRef(new Map<string, string>());
  const plain = useRef(new Map<string, string>());
  const [hasLock, setHasLock] = useState(false);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Item | null>(null);
  const [edit, setEdit] = useState<Item | null>(null);
  const [albumForm, setAlbumForm] = useState<Album | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const albumSeal = useRef("");

  useEffect(() => { setHasLock(Boolean(localStorage.getItem(CHECK))); }, []);

  async function persist(nextItems: Item[], nextAlbums: Album[]) {
    const key = keyRef.current;
    if (!key) return;
    const files: { id: string; secret: string }[] = [];
    for (const item of nextItems) {
      const json = JSON.stringify(item);
      let secret = sealed.current.get(item.id);
      if (!secret || plain.current.get(item.id) !== json) {
        secret = await seal(key, json);
        sealed.current.set(item.id, secret);
        plain.current.set(item.id, json);
      }
      files.push({ id: item.id, secret });
    }
    for (const id of [...sealed.current.keys()]) {
      if (!nextItems.some((item) => item.id === id)) { sealed.current.delete(id); plain.current.delete(id); }
    }
    const albumsJson = JSON.stringify(nextAlbums);
    if (albumSeal.current && plain.current.get("albums") === albumsJson) {
      writeStore({ albums: albumSeal.current, files });
      return;
    }
    const packed = await seal(key, albumsJson);
    albumSeal.current = packed;
    plain.current.set("albums", albumsJson);
    writeStore({ albums: packed, files });
  }

  async function unlock(nextPin: string, creating: boolean) {
    if (nextPin.trim().length < 4) { setNote("Use at least 4 characters."); return; }
    if (creating && nextPin !== again) { setNote("The two PINs do not match."); return; }
    let salt = fromB64(localStorage.getItem(SALT) || "");
    if (creating) {
      salt = crypto.getRandomValues(new Uint8Array(16));
      localStorage.setItem(SALT, b64(salt));
    }
    if (!salt.length) { setNote("Set a PIN first."); return; }
    const key = await derive(nextPin, salt);
    if (creating) localStorage.setItem(CHECK, await seal(key, "ok"));
    else {
      try { if (await unseal(key, localStorage.getItem(CHECK) || "") !== "ok") throw new Error("no"); }
      catch { setNote("Wrong PIN."); return; }
    }
    keyRef.current = key;
    const stored = await readStore().catch(() => null);
    const nextAlbums: Album[] = stored?.albums ? JSON.parse(await unseal(key, stored.albums)) : [];
    albumSeal.current = stored?.albums || "";
    plain.current.set("albums", JSON.stringify(nextAlbums));
    const nextItems: Item[] = [];
    for (const file of stored?.files || []) {
      const json = await unseal(key, file.secret);
      sealed.current.set(file.id, file.secret);
      plain.current.set(file.id, json);
      nextItems.push(JSON.parse(json) as Item);
    }
    if (data.vault.length) {
      for (const row of data.vault) {
        if (nextItems.some((item) => item.id === row.id)) continue;
        nextItems.unshift({ id: row.id, album_id: null, kind: "document", mime: "text/plain", filename: `${row.title}.txt`, title: row.title, alt_text: "", url: `data:text/plain,${encodeURIComponent(row.body)}`, size_bytes: row.body.length, tags: ["note"], favorite: false, created_at: row.at || new Date().toISOString() });
      }
      update((prev) => ({ ...prev, vault: [] }));
    }
    setAlbums(nextAlbums);
    setItems(nextItems);
    setOpen(true);
    setPin("");
    setAgain("");
    setNote("");
    if (data.vault.length) void persist(nextItems, nextAlbums);
  }

  function lock() {
    keyRef.current = null;
    sealed.current.clear();
    plain.current.clear();
    albumSeal.current = "";
    setItems([]);
    setAlbums([]);
    setPreview(null);
    setEdit(null);
    setOpen(false);
  }

  function change(nextItems: Item[], nextAlbums = albums) {
    setItems(nextItems);
    setAlbums(nextAlbums);
    void persist(nextItems, nextAlbums);
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = [...items];
    if (albumId) rows = rows.filter((item) => item.album_id === albumId);
    else if (filter === "images") rows = rows.filter((item) => item.kind === "image");
    else if (filter === "videos") rows = rows.filter((item) => item.kind === "video");
    else if (filter === "audio") rows = rows.filter((item) => item.kind === "audio");
    else if (filter === "documents") rows = rows.filter((item) => item.kind === "document");
    else if (filter === "favorites") rows = rows.filter((item) => item.favorite);
    if (needle) rows = rows.filter((item) => `${item.title} ${item.filename} ${item.tags.join(" ")}`.toLowerCase().includes(needle));
    rows.sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "name") return (a.title || a.filename).localeCompare(b.title || b.filename);
      if (sort === "size") return b.size_bytes - a.size_bytes;
      return b.created_at.localeCompare(a.created_at);
    });
    return rows;
  }, [items, filter, albumId, q, sort]);

  const pages = Math.max(1, Math.ceil(shown.length / 60));
  const pageRows = shown.slice(page * 60, page * 60 + 60);

  function addFiles(files: File[]) {
    const accepted = files.filter((file) => /^(image|video|audio|text)\//.test(file.type) || file.type === "application/pdf" || /\.(txt|md|csv|pdf)$/i.test(file.name));
    if (!accepted.length) { setNote("Use an image, video, audio, PDF, or text file."); return; }
    for (const file of accepted) {
      if (file.size > 12_000_000) { setNote(`${file.name} is over 12 MB.`); continue; }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        const item: Item = { id: newId(), album_id: albumId, kind: kindOf(file.type, file.name), mime: file.type || "application/octet-stream", filename: file.name, title: file.name.replace(/\.[^.]+$/, ""), alt_text: "", url: reader.result, size_bytes: file.size, tags: [], favorite: false, created_at: new Date().toISOString() };
        setItems((prev) => {
          const next = [item, ...prev];
          void persist(next, albums);
          return next;
        });
        setNote("Locked in this browser.");
      };
      reader.readAsDataURL(file);
    }
  }

  if (!open) {
    return (
      <section className="module-card mx-auto max-w-md p-6">
        <h1 className="text-2xl">Vault</h1>
        <p className="mt-1 text-sm text-white/50">{hasLock ? "Enter the PIN. Files stay encrypted on this computer." : "Set a PIN. Files are encrypted on this computer and are not synced."}</p>
        <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); void unlock(pin, !hasLock); }}>
          <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-sm" data-keep="off" type="password" autoComplete="new-password" placeholder="PIN" value={pin} onChange={(event) => setPin(event.target.value)} />
          {!hasLock ? <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-sm" data-keep="off" type="password" autoComplete="new-password" placeholder="Repeat PIN" value={again} onChange={(event) => setAgain(event.target.value)} /> : null}
          <button type="submit" className="bg-blue">{hasLock ? "Unlock" : "Create vault"}</button>
        </form>
        {note ? <p className="mt-3 text-sm text-white/50">{note}</p> : null}
      </section>
    );
  }

  return (
    <div className="grid gap-3" onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles([...event.dataTransfer.files]); }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">Vault</h1>
          <p className="text-sm text-white/50">Encrypted on this computer. Not synced.</p>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="quiet" onClick={lock}>Lock</button>
          <button type="button" className="bg-blue" onClick={() => fileRef.current?.click()}>Upload</button>
          <button type="button" className="link-add" onClick={() => setAlbumForm({ id: newId(), name: "", created_at: new Date().toISOString() })}>New album</button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[14rem_1fr]">
        <aside className="module-card h-fit p-3">
          <p className="mb-1 text-[10px] tracking-widest text-white/35">SMART FILTERS</p>
          {FILTERS.map((row) => <button key={row.id} type="button" className={`menu ${!albumId && filter === row.id ? "is-on" : ""}`} onClick={() => { setFilter(row.id); setAlbumId(null); setPage(0); }}>{row.label}</button>)}
          <p className="mb-1 mt-4 text-[10px] tracking-widest text-white/35">ALBUMS</p>
          {albums.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <button type="button" className={`menu ${albumId === row.id ? "is-on" : ""}`} onClick={() => { setAlbumId(row.id); setPage(0); }}>{row.name}</button>
              <button type="button" className="link-remove" onClick={() => change(items.map((item) => item.album_id === row.id ? { ...item, album_id: null } : item), albums.filter((item) => item.id !== row.id))}>Remove</button>
            </div>
          ))}
          {!albums.length ? <p className="text-[11px] text-white/30">No albums yet</p> : null}
        </aside>
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" data-keep="off" value={q} placeholder="Search vault" onChange={(event) => { setQ(event.target.value); setPage(0); }} />
            <span className="text-[11px] text-white/40">{shown.length} of {items.length}</span>
            <select className="h-8 rounded-full border border-line bg-black/40 px-2 text-xs" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <button type="button" className={`quiet ${view === "grid" ? "is-on" : ""}`} onClick={() => setView("grid")}>Grid</button>
            <button type="button" className={`quiet ${view === "list" ? "is-on" : ""}`} onClick={() => setView("list")}>List</button>
            <input ref={fileRef} className="sr-only" data-keep="off" type="file" multiple accept="image/*,video/*,audio/*,.pdf,.txt,.md,.csv" onChange={(event) => { addFiles([...(event.target.files || [])]); event.target.value = ""; }} />
          </div>
          {note ? <p className="mb-3 text-sm text-white/50">{note}</p> : null}
          {dragging ? <p className="mb-3 text-sm text-blue-2">Drop files to lock them in.</p> : null}
          {!shown.length ? <p className="text-sm text-white/40">No files yet. Drop images, videos, audio, or documents here.</p> : null}
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              {pageRows.map((item) => (
                <div key={item.id} className="module-card overflow-hidden">
                  <div className="relative">
                    <button type="button" className="menu" onClick={() => setPreview(item)}>
                      {item.kind === "image" && item.url ? <img src={item.url} alt="" className="h-36 w-full object-cover" /> : <span className="grid h-36 w-full place-items-center text-xs uppercase text-white/40">{item.kind}</span>}
                    </button>
                    <button type="button" className="icon absolute top-2 right-2" aria-label={item.favorite ? "Unstar" : "Star"} onClick={() => change(items.map((row) => row.id === item.id ? { ...row, favorite: !row.favorite } : row))}><Star on={item.favorite} /></button>
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
                <thead><tr className="text-left text-[10px] tracking-widest text-white/40"><th className="p-2" /><th>Name</th><th>Kind</th><th>Size</th><th>Added</th><th /></tr></thead>
                <tbody>
                  {pageRows.map((item) => (
                    <tr key={item.id} className="border-t border-white/10">
                      <td className="p-2"><button type="button" className="icon" onClick={() => change(items.map((row) => row.id === item.id ? { ...row, favorite: !row.favorite } : row))}><Star on={item.favorite} /></button></td>
                      <td><button type="button" className="quiet" onClick={() => setPreview(item)}>{item.title || item.filename}</button></td>
                      <td>{item.kind}</td>
                      <td>{bytes(item.size_bytes)}</td>
                      <td>{fmtDate(item.created_at)}</td>
                      <td className="space-x-2 p-2 text-right">
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
            <div className="mb-3 flex items-center justify-between"><p className="truncate">{preview.title || preview.filename}</p><button type="button" className="quiet" onClick={() => setPreview(null)}>Close</button></div>
            {preview.kind === "image" && preview.url ? <img src={preview.url} alt="" className="max-h-[60vh] w-full object-contain" /> : null}
            {preview.kind === "video" && preview.url ? <video src={preview.url} controls className="max-h-[60vh] w-full" /> : null}
            {preview.kind === "audio" && preview.url ? <audio src={preview.url} controls className="w-full" /> : null}
            {preview.kind === "document" && preview.url ? <a className="text-sm text-blue-2" href={preview.url} download={preview.filename}>Open file</a> : null}
            <p className="mt-3 text-[11px] text-white/40">{[preview.kind, bytes(preview.size_bytes), fmtDate(preview.created_at)].join(" · ")}</p>
            <button type="button" className="link-remove mt-3" onClick={() => setRemoveId(preview.id)}>Remove</button>
          </div>
        </div>
      ) : null}
      {edit ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setEdit(null)}>
          <div className="module-card w-full max-w-md p-4" onClick={(event) => event.stopPropagation()}>
            <p className="mb-3 text-sm">Edit file</p>
            <input className="mb-2 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" data-keep="off" value={edit.title} onChange={(event) => setEdit({ ...edit, title: event.target.value })} />
            <select className="mb-3 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={edit.album_id || ""} onChange={(event) => setEdit({ ...edit, album_id: event.target.value || null })}>
              <option value="">Unfiled</option>
              {albums.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <div className="flex justify-end gap-3">
              <button type="button" className="quiet" onClick={() => setEdit(null)}>Cancel</button>
              <button type="button" className="bg-blue" onClick={() => { change(items.map((row) => row.id === edit.id ? edit : row)); setEdit(null); }}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
      {albumForm ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setAlbumForm(null)}>
          <div className="module-card w-full max-w-sm p-4" onClick={(event) => event.stopPropagation()}>
            <p className="mb-3 text-sm">New album</p>
            <input className="h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" data-keep="off" value={albumForm.name} placeholder="Album name" onChange={(event) => setAlbumForm({ ...albumForm, name: event.target.value })} />
            <div className="mt-3 flex justify-end gap-3">
              <button type="button" className="quiet" onClick={() => setAlbumForm(null)}>Cancel</button>
              <button type="button" className="bg-blue" onClick={() => { if (!albumForm.name.trim()) return; change(items, [albumForm, ...albums]); setAlbumId(albumForm.id); setAlbumForm(null); }}>Create</button>
            </div>
          </div>
        </div>
      ) : null}
      {removeId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setRemoveId(null)}>
          <div className="module-card w-full max-w-sm p-4" onClick={(event) => event.stopPropagation()}>
            <p className="text-sm">Remove this file from the vault?</p>
            <div className="mt-3 flex justify-end gap-3">
              <button type="button" className="quiet" onClick={() => setRemoveId(null)}>Cancel</button>
              <button type="button" className="danger" onClick={() => { change(items.filter((row) => row.id !== removeId)); setPreview(null); setRemoveId(null); }}>Remove</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
