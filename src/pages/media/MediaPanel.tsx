// src/pages/MediaPanel.tsx
// LifeOS1 — Media Panel
//
// Metadata (title, album, tags, favorite, kind, size, created_at) is stored in
// `lifeos_media_items` / `lifeos_media_albums` via usePersistentState, which
// syncs to Supabase through the generic `user_data` table. No dedicated schema
// is required.
//
// File bytes go through POST /api/upload?type=media, which returns { url,
// thumb_url? }. That URL is stored in the metadata row.
//
// Vault-linked items do NOT keep their URL in this store — they store the
// sentinel "vault:deferred" and clicking the tile routes to the Vault panel.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon, Plus, Upload, Folder, Search, Film, FileText,
  Music, File as FileIcon, Grid3x3, List, Star, Trash2, Pencil, X,
  Loader2, AlertCircle, CheckCircle, Info, Download, Copy, Sparkles,
  RefreshCw, Eye, Lock, Check, Save, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "../../lib/uploadFile";

/** Local API adapter so this panel does not depend on an optional shared module. */
async function lifeosApi<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Local LLM adapter so this panel does not depend on the optional helper module. */
async function invokeLLM({ prompt }: { prompt: string }): Promise<{ text?: string }> {
  return lifeosApi<{ text?: string }>("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

/** Kept local because MediaPanel must also build in deployments that do not
 * include the optional shared PanelLayout component. */
function PanelLayout({
  title,
  subtitle,
  icon,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="h-full flex flex-col gap-4">
      <header className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h1 className="text-lg font-display text-white/90">{title}</h1>
            {subtitle && <p className="text-[11px] text-white/40">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type MediaKind = "image" | "video" | "audio" | "document" | "other";

interface MediaAlbum {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

interface MediaItem {
  id: string;
  album_id: string | null;
  kind: MediaKind;
  mime: string;
  filename: string;
  title: string;
  alt_text: string;
  // For vault items this is the sentinel "vault:deferred".
  url: string;
  thumb_url: string | null;
  size_bytes: number;
  tags: string[];
  vault: boolean;
  favorite: boolean;
  created_at: string;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

interface PersistentStateMeta {
  loaded: boolean;
  isSyncing: boolean;
}

/** Local fallback for the removed shared hook. Keeps the panel usable when
 * the optional persistence module is not present in a build. */
function usePersistentState<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>, PersistentStateMeta] {
  const [value, setValue] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Ignore malformed or unavailable local storage.
    } finally {
      setLoaded(true);
    }
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value, loaded]);

  return [value, setValue, { loaded, isSyncing: false }];
}

type SmartFilter = "all" | "images" | "videos" | "audio" | "documents" | "favorites";
type Selection = { type: "smart"; id: SmartFilter } | { type: "album"; id: string };

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const VAULT_SENTINEL = "vault:deferred";

const SMART_FILTERS: {
  id: SmartFilter;
  label: string;
  icon: React.ReactNode;
  match: (m: MediaItem) => boolean;
}[] = [
  { id: "all",       label: "All Media", icon: <Folder size={12} />,    match: () => true },
  { id: "images",    label: "Images",    icon: <ImageIcon size={12} />, match: (m) => m.kind === "image" },
  { id: "videos",    label: "Videos",    icon: <Film size={12} />,      match: (m) => m.kind === "video" },
  { id: "audio",     label: "Audio",     icon: <Music size={12} />,     match: (m) => m.kind === "audio" },
  { id: "documents", label: "Documents", icon: <FileText size={12} />,  match: (m) => m.kind === "document" },
  { id: "favorites", label: "Favorites", icon: <Star size={12} />,      match: (m) => m.favorite },
];

const KIND_ICON: Record<MediaKind, React.ReactNode> = {
  image:    <ImageIcon size={14} />,
  video:    <Film size={14} />,
  audio:    <Music size={14} />,
  document: <FileText size={14} />,
  other:    <FileIcon size={14} />,
};

const KIND_COLOR: Record<MediaKind, string> = {
  image:    "#4ab3f4",
  video:    "#ff8c42",
  audio:    "#8b7fff",
  document: "#00c896",
  other:    "#94a3b8",
};

const ACCEPTED_MIME_PREFIXES = [
  "image/", "video/", "audio/", "application/pdf", "text/",
];
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const TOAST_MS = 4200;
const PAGE_SIZE = 60;

const LS = {
  view:      "lifeos_media_view",
  search:    "lifeos_media_search",
  selection: "lifeos_media_selection",
  showVault: "lifeos_media_show_vault",
  sort:      "lifeos_media_sort",
};

type SortKey = "newest" | "oldest" | "name" | "size";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf" || mime.startsWith("text/")) return "document";
  return "other";
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n");
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function MediaPanel() {
  const navigate = useNavigate();

  /* ---------- persisted stores (Supabase-backed) ---------- */
  const [items, setItems, itemsMeta] = usePersistentState<MediaItem[]>(
    "lifeos_media_items",
    [],
  );
  const [albums, setAlbums, albumsMeta] = usePersistentState<MediaAlbum[]>(
    "lifeos_media_albums",
    [],
  );

  /* ---------- persisted UI prefs (local only) ---------- */
  const [view, setView] = useState<"grid" | "list">(() => lsGet(LS.view, "grid"));
  const [searchRaw, setSearchRaw] = useState<string>(() => lsGet(LS.search, ""));
  const [search, setSearch] = useState(searchRaw);
  const [selection, setSelection] = useState<Selection>(() => lsGet(LS.selection, { type: "smart", id: "all" }));
  const [showVault, setShowVault] = useState<boolean>(() => lsGet(LS.showVault, false));
  const [sort, setSort] = useState<SortKey>(() => lsGet(LS.sort, "newest"));
  const [page, setPage] = useState(0);

  useEffect(() => lsSet(LS.view, view), [view]);
  useEffect(() => lsSet(LS.search, searchRaw), [searchRaw]);
  useEffect(() => lsSet(LS.selection, selection), [selection]);
  useEffect(() => lsSet(LS.showVault, showVault), [showVault]);
  useEffect(() => lsSet(LS.sort, sort), [sort]);

  // 200ms debounce on search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  // Reset to page 0 on filter/sort change
  useEffect(() => { setPage(0); }, [selection, search, sort, showVault]);

  /* ---------- modals ---------- */
  const [albumModal, setAlbumModal] = useState<Partial<MediaAlbum> | null>(null);
  const [editModal, setEditModal] = useState<Partial<MediaItem> | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* ---------- upload ---------- */
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------- AI ---------- */
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  /* ---------- toast ---------- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  /* ---------- Esc ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (preview) setPreview(null);
      else if (confirmDeleteId) setConfirmDeleteId(null);
      else if (editModal) setEditModal(null);
      else if (albumModal) setAlbumModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, confirmDeleteId, editModal, albumModal]);

  /* ---------- derived list ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = items;

    if (selection.type === "smart") {
      const f = SMART_FILTERS.find((x) => x.id === selection.id);
      if (f) out = out.filter(f.match);
    } else {
      out = out.filter((m) => m.album_id === selection.id);
    }

    if (!showVault) out = out.filter((m) => !m.vault);

    if (q) {
      out = out.filter((m) =>
        m.filename.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.alt_text.toLowerCase().includes(q) ||
        m.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    out = out.slice();
    switch (sort) {
      case "newest": out.sort((a, b) => b.created_at.localeCompare(a.created_at)); break;
      case "oldest": out.sort((a, b) => a.created_at.localeCompare(b.created_at)); break;
      case "name":   out.sort((a, b) => (a.title || a.filename).localeCompare(b.title || b.filename)); break;
      case "size":   out.sort((a, b) => b.size_bytes - a.size_bytes); break;
    }
    return out;
  }, [items, selection, search, showVault, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  /* ---------- upload ---------- */
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;

    const valid: File[] = [];
    const rejected: string[] = [];
    for (const f of files) {
      const accepted = ACCEPTED_MIME_PREFIXES.some((p) => f.type.startsWith(p));
      if (!accepted) { rejected.push(`${f.name} (unsupported type ${f.type || "unknown"})`); continue; }
      if (f.size > MAX_FILE_BYTES) { rejected.push(`${f.name} (over ${MAX_FILE_BYTES / 1024 / 1024} MB)`); continue; }
      valid.push(f);
    }
    if (rejected.length) pushToast("error", `Rejected: ${rejected.join(", ")}`);
    if (!valid.length) return;

    setUploading(true);
    let succeeded = 0;
    for (const file of valid) {
      try {
        const up = await uploadFile(file, "media");
        const url = up.url || up.file_url;
        if (!url) throw new Error("Upload returned no URL");

        const item: MediaItem = {
          id: newId("m"),
          album_id: selection.type === "album" ? selection.id : null,
          kind: kindFromMime(file.type),
          mime: file.type || "application/octet-stream",
          filename: file.name,
          title: file.name.replace(/\.[^.]+$/, ""),
          alt_text: "",
          url,
          thumb_url: up.thumb_url ?? null,
          size_bytes: file.size,
          tags: [],
          vault: false,
          favorite: false,
          created_at: new Date().toISOString(),
        };
        setItems((prev) => [item, ...prev]);
        succeeded++;
      } catch (e: any) {
        pushToast("error", `Upload failed for ${file.name}: ${e?.message || "unknown error"}`);
      }
    }
    setUploading(false);
    if (succeeded) pushToast("success", `Uploaded ${succeeded} file${succeeded === 1 ? "" : "s"}`);
  }, [selection, setItems, pushToast]);

  const onFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    void uploadFiles(files);
  }, [uploadFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(e.dataTransfer.files || []));
  }, [uploadFiles]);

  /* ---------- albums ---------- */
  const saveAlbum = useCallback(() => {
    if (!albumModal) return;
    const name = (albumModal.name || "").trim();
    if (!name) { pushToast("error", "Album name required"); return; }
    if (albumModal.id) {
      setAlbums((prev) => prev.map((a) => a.id === albumModal.id ? { ...a, name, color: albumModal.color || a.color } : a));
      pushToast("success", "Album updated");
    } else {
      const album: MediaAlbum = {
        id: newId("a"),
        name,
        color: albumModal.color || "#4ab3f4",
        created_at: new Date().toISOString(),
      };
      setAlbums((prev) => [album, ...prev]);
      setSelection({ type: "album", id: album.id });
      pushToast("success", "Album created");
    }
    setAlbumModal(null);
  }, [albumModal, setAlbums, pushToast]);

  const deleteAlbum = useCallback((id: string, name: string) => {
    if (!confirm(`Delete album "${name}"? Items will move to All Media.`)) return;
    setAlbums((prev) => prev.filter((a) => a.id !== id));
    setItems((prev) => prev.map((m) => m.album_id === id ? { ...m, album_id: null } : m));
    if (selection.type === "album" && selection.id === id) setSelection({ type: "smart", id: "all" });
    pushToast("success", `Deleted "${name}"`);
  }, [selection, setAlbums, setItems, pushToast]);

  /* ---------- item mutations ---------- */
  const saveItem = useCallback(() => {
    if (!editModal?.id) return;
    setItems((prev) => prev.map((m) => m.id === editModal.id ? { ...m, ...editModal } as MediaItem : m));
    setEditModal(null);
    pushToast("success", "Updated");
  }, [editModal, setItems, pushToast]);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
    setConfirmDeleteId(null);
    pushToast("success", "Removed from library");
  }, [setItems, pushToast]);

  const toggleFavorite = useCallback((id: string) => {
    setItems((prev) => prev.map((m) => m.id === id ? { ...m, favorite: !m.favorite } : m));
  }, [setItems]);

  const toggleVault = useCallback((id: string) => {
    setItems((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const nextVault = !m.vault;
      return {
        ...m,
        vault: nextVault,
        // On marking vault: strip the URL from the media store.
        // The Vault panel is expected to hold the real URL.
        url: nextVault ? VAULT_SENTINEL : m.url,
        thumb_url: nextVault ? null : m.thumb_url,
      };
    }));
    pushToast("info", "Vault flag updated. Real encryption is the Vault panel's job.");
  }, [setItems, pushToast]);

  /* ---------- AI ---------- */
  const aiAutoTag = useCallback(async () => {
    const untagged = filtered.filter((m) => m.tags.length === 0).slice(0, 20);
    if (!untagged.length) { pushToast("info", "No untagged items in view"); return; }
    setAiBusy("tag");
    setAiOutput(null);
    try {
      const res = await invokeLLM({
        prompt:
          "For each item below, return up to 4 short lowercase tags that describe what it likely is, " +
          "based on filename, kind, and MIME type. Do not invent visual details. " +
          "Return ONLY valid JSON: {\"items\":[{\"id\":string,\"tags\":string[]}]}. No prose, no code fences.\n\n" +
          JSON.stringify(untagged.map((t) => ({ id: t.id, filename: t.filename, kind: t.kind, mime: t.mime }))),
      });
      if (!res.text) { pushToast("error", `AI failed: No output returned`); return; }
      const raw = res.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let parsed: { items?: { id: string; tags: string[] }[] } = {};
      try { parsed = JSON.parse(raw); } catch { /* ignore */ }
      const list = Array.isArray(parsed.items) ? parsed.items : [];
      const tagMap = new Map<string, string[]>();
      for (const p of list) {
        if (!p.id || !Array.isArray(p.tags)) continue;
        tagMap.set(p.id, p.tags.map((t) => String(t).toLowerCase()).slice(0, 4));
      }
      if (!tagMap.size) {
        setAiOutput(raw || "(no parseable tags)");
        pushToast("info", "AI returned no usable tags — showing raw output");
        return;
      }
      setItems((prev) => prev.map((m) => tagMap.has(m.id) ? { ...m, tags: tagMap.get(m.id)! } : m));
      pushToast("success", `Tagged ${tagMap.size} item${tagMap.size === 1 ? "" : "s"}`);
    } catch (e: any) {
      pushToast("error", e?.message || "AI tagging failed");
    } finally {
      setAiBusy(null);
    }
  }, [filtered, setItems, pushToast]);

  const aiSuggestAlbums = useCallback(async () => {
    const targets = filtered.slice(0, 25);
    if (targets.length < 3) { pushToast("info", "Need at least 3 items to suggest groupings"); return; }
    setAiBusy("album");
    setAiOutput(null);
    try {
      const res = await invokeLLM({
        prompt:
          "Suggest 3-5 logical album groupings for the following media items. " +
          "Return ONLY valid JSON: {\"albums\":[{\"name\":string,\"why\":string,\"item_ids\":string[]}]}. " +
          "No prose outside the JSON. Group by theme, not just file type.\n\n" +
          JSON.stringify(targets.map((t) => ({
            id: t.id, title: t.title, filename: t.filename, kind: t.kind, tags: t.tags,
          }))),
      });
      if (!res.text) { pushToast("error", `AI failed: No output returned`); return; }
      setAiOutput(res.text);
      pushToast("success", "Album suggestions ready");
    } catch (e: any) {
      pushToast("error", e?.message || "AI album suggestion failed");
    } finally {
      setAiBusy(null);
    }
  }, [filtered, pushToast]);

  const aiAltText = useCallback(async (item: MediaItem) => {
    if (item.kind !== "image") { pushToast("info", "Alt text is only for images"); return; }
    setAiBusy("alt");
    try {
      const res = await invokeLLM({
        prompt:
          "Write a concise, factual alt-text description for an image, under 25 words. " +
          "You do not have the pixels — base it strictly on the metadata and do not invent visual details. " +
          "If you can't describe it reliably, return a neutral fallback like 'Image: {filename}'. " +
          "Return ONLY the alt text, no quotes, no prefix.\n\n" +
          JSON.stringify({ filename: item.filename, title: item.title, tags: item.tags }),
      });
      if (!res.text) { pushToast("error", `AI failed: No output returned`); return; }
      const text = res.text.trim().replace(/^"|"$/g, "");
      if (!text) throw new Error("Empty alt text returned");
      setItems((prev) => prev.map((m) => m.id === item.id ? { ...m, alt_text: text } : m));
      pushToast("success", "Alt text saved");
    } catch (e: any) {
      pushToast("error", e?.message || "Alt text failed");
    } finally {
      setAiBusy(null);
    }
  }, [setItems, pushToast]);

  const copyAI = useCallback(async () => {
    if (!aiOutput) return;
    try { await navigator.clipboard.writeText(aiOutput); pushToast("success", "Copied"); }
    catch { pushToast("error", "Clipboard blocked"); }
  }, [aiOutput, pushToast]);

  /* ---------- CSV ---------- */
  const exportCsv = useCallback(() => {
    if (!filtered.length) { pushToast("info", "Nothing to export"); return; }
    const rows = filtered.map((m) => ({
      id: m.id,
      kind: m.kind,
      filename: m.filename,
      title: m.title,
      size_bytes: m.size_bytes,
      mime: m.mime,
      album_id: m.album_id ?? "",
      tags: m.tags.join("|"),
      vault: m.vault ? "yes" : "no",
      favorite: m.favorite ? "yes" : "no",
      url: m.url === VAULT_SENTINEL ? "(vault-deferred)" : m.url,
      created_at: m.created_at,
    }));
    downloadCsv(`lifeos-media-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    pushToast("success", `Exported ${rows.length} rows`);
  }, [filtered, pushToast]);

  /* ---------- render ---------- */
  const activeSmartLabel = selection.type === "smart"
    ? SMART_FILTERS.find((f) => f.id === selection.id)?.label
    : albums.find((a) => a.id === selection.id)?.name;

  const hydrating = !itemsMeta.loaded || !albumsMeta.loaded;
  const syncing = itemsMeta.isSyncing || albumsMeta.isSyncing;

  return (
    <PanelLayout
      title="Media"
      subtitle="Store, organize, and manage all your files"
      icon={<ImageIcon size={18} />}
      actions={
        <div className="flex gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-white/60 text-xs font-display hover:text-white/90 disabled:opacity-40"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "UPLOADING…" : "UPLOAD"}
          </button>
          <button
            onClick={() => setAlbumModal({ color: "#4ab3f4" })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm"
          >
            <Plus size={12} /> NEW ALBUM
          </button>
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.json"
        onChange={onFileInputChange}
        className="hidden"
      />

      <div
        className="h-full flex gap-4"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {/* ================= LEFT SIDEBAR ================= */}
        <div className="w-48 shrink-0 flex flex-col gap-3">
          <div className="glass rounded-xl border border-white/8 p-2 flex-1 overflow-y-auto">
            <div className="text-[9px] text-white/20 font-display tracking-widest px-2 mb-2">
              SMART FILTERS
            </div>
            {SMART_FILTERS.map((f) => {
              const active = selection.type === "smart" && selection.id === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setSelection({ type: "smart", id: f.id })}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors
                    ${active ? "glass-crimson text-primary" : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}
                >
                  {f.icon}
                  <span className="text-xs">{f.label}</span>
                </button>
              );
            })}

            <div className="text-[9px] text-white/20 font-display tracking-widest px-2 mt-3 mb-2 flex items-center justify-between">
              ALBUMS
              <button
                onClick={() => setAlbumModal({ color: "#4ab3f4" })}
                className="text-white/20 hover:text-primary text-[10px]"
              >
                +
              </button>
            </div>
            {albums.length === 0 && (
              <div className="px-2 py-1 text-[10px] text-white/20 italic">No albums yet</div>
            )}
            {albums.map((a) => {
              const active = selection.type === "album" && selection.id === a.id;
              return (
                <div
                  key={a.id}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                    ${active ? "glass-crimson text-primary" : "text-white/40 hover:bg-white/5 hover:text-white/70"}`}
                  onClick={() => setSelection({ type: "album", id: a.id })}
                >
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: a.color }} />
                  <span className="text-xs truncate flex-1">{a.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteAlbum(a.id, a.name); }}
                    className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 shrink-0"
                    title="Delete album"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}
          </div>

          <label className="glass rounded-xl border border-white/8 p-2 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showVault}
              onChange={(e) => setShowVault(e.target.checked)}
              className="accent-primary shrink-0"
            />
            <Lock size={11} className="text-white/40 shrink-0" />
            <span className="text-[10px] text-white/50">Show vault-linked</span>
          </label>
        </div>

        {/* ================= MAIN ================= */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Toolbar */}
          <div className="glass rounded-xl border border-white/8 p-2 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                placeholder="Search media…"
                className="w-full h-8 pl-8 pr-2 text-xs bg-white/4 border border-white/8 rounded-lg text-white/70 placeholder:text-white/20 focus:outline-none focus:border-primary/40"
              />
            </div>
            <span className="text-[10px] text-white/30">
              {activeSmartLabel} · {filtered.length} of {items.length}
              {syncing && <span className="ml-2 text-white/20">syncing…</span>}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-7 px-1 text-[10px] rounded bg-white/4 border border-white/8 text-white/70 focus:outline-none"
            >
              <option value="newest" style={{ background: "#0a0a0a" }}>Newest</option>
              <option value="oldest" style={{ background: "#0a0a0a" }}>Oldest</option>
              <option value="name"   style={{ background: "#0a0a0a" }}>Name</option>
              <option value="size"   style={{ background: "#0a0a0a" }}>Size</option>
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => setView("grid")}
                className={`p-1.5 rounded ${view === "grid" ? "glass-crimson text-primary" : "text-white/30 hover:text-white/60"}`}
                title="Grid view"
              >
                <Grid3x3 size={13} />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded ${view === "list" ? "glass-crimson text-primary" : "text-white/30 hover:text-white/60"}`}
                title="List view"
              >
                <List size={13} />
              </button>
            </div>
            <button
              onClick={aiAutoTag}
              disabled={aiBusy != null}
              title="Auto-tag untagged items with AI (metadata only — no vision)"
              className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
            >
              {aiBusy === "tag" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              AUTO-TAG
            </button>
            <button
              onClick={aiSuggestAlbums}
              disabled={aiBusy != null || filtered.length < 3}
              title="Suggest album groupings"
              className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
            >
              {aiBusy === "album" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              SUGGEST
            </button>
            <button
              onClick={exportCsv}
              title="Export metadata CSV"
              className="p-1.5 rounded glass border border-white/8 text-white/50 hover:text-primary"
            >
              <Download size={11} />
            </button>
            <button
              onClick={() => { setItems((prev) => [...prev]); setAlbums((prev) => [...prev]); }}
              title="Force persistence"
              className="p-1.5 rounded glass border border-white/8 text-white/50 hover:text-primary"
            >
              <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
            </button>
          </div>

          {/* AI output */}
          {aiOutput && (
            <div
              className="glass rounded-xl border p-3"
              style={{ borderColor: "rgba(139,127,255,0.25)", background: "rgba(139,127,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-display tracking-widest" style={{ color: "oklch(0.72 0.15 300)" }}>
                  AI OUTPUT
                </div>
                <div className="flex gap-1">
                  <button onClick={copyAI} className="px-2 py-0.5 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1">
                    <Copy size={9} /> COPY
                  </button>
                  <button onClick={() => setAiOutput(null)} className="px-2 py-0.5 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1">
                    <X size={9} /> CLEAR
                  </button>
                </div>
              </div>
              <pre className="text-[11px] text-white/70 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {aiOutput}
              </pre>
            </div>
          )}

          {/* Hydrating */}
          {hydrating && items.length === 0 && (
            <div className="glass rounded-xl border border-white/8 p-10 text-center text-white/40 text-xs flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading media…
            </div>
          )}

          {/* Empty */}
          {!hydrating && filtered.length === 0 && (
            <div
              className={`glass rounded-xl border flex flex-col items-center justify-center min-h-[240px] p-6 ${dragging ? "border-primary/50 bg-primary/5" : "border-white/8"}`}
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                <ImageIcon size={20} className="text-white/15" />
                <Film size={20} className="text-white/10" />
                <FileText size={20} className="text-white/8" />
              </div>
              <div className="text-sm text-white/30">
                {dragging ? "Drop files to upload" : items.length === 0 ? "No media yet" : "No items match"}
              </div>
              <div className="text-[10px] text-white/20 mt-1">
                {dragging
                  ? "Release to upload"
                  : "Drag files here, or click Upload. Images, videos, audio, PDFs, text."}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm"
              >
                <Upload size={11} /> UPLOAD FILES
              </button>
            </div>
          )}

          {/* Grid view */}
          {view === "grid" && pageItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {pageItems.map((m) => (
                <div
                  key={m.id}
                  className="group glass rounded-xl border border-white/8 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors relative"
                  onClick={() => setPreview(m)}
                >
                  <div className="aspect-square bg-black/40 flex items-center justify-center relative">
                    {m.kind === "image" && m.url !== VAULT_SENTINEL ? (
                      <img
                        src={m.thumb_url || m.url}
                        alt={m.alt_text || m.title || m.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : m.vault ? (
                      <Lock size={16} className="text-primary/60" />
                    ) : (
                      <span style={{ color: KIND_COLOR[m.kind] }}>{KIND_ICON[m.kind]}</span>
                    )}
                    {m.vault && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded glass-crimson text-primary text-[9px] flex items-center gap-1">
                        <Lock size={9} /> VAULT
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(m.id); }}
                      className="absolute top-1.5 right-1.5 p-1 rounded bg-black/50 text-white/70 opacity-0 group-hover:opacity-100"
                      title={m.favorite ? "Unfavorite" : "Favorite"}
                    >
                      <Star size={11} className={m.favorite ? "text-amber-300 fill-amber-300" : ""} />
                    </button>
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] text-white/80 truncate" title={m.title || m.filename}>
                      {m.title || m.filename}
                    </div>
                    <div className="text-[9px] text-white/30 mt-0.5 flex items-center justify-between">
                      <span style={{ color: KIND_COLOR[m.kind] }}>{m.kind}</span>
                      <span>{fmtBytes(m.size_bytes)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {view === "list" && pageItems.length > 0 && (
            <div className="glass rounded-xl border border-white/8 overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/8">
                    {["", "Name", "Kind", "Size", "Tags", "Album", "Added", ""].map((h) => (
                      <th key={h} className="text-left px-2 py-2 text-[9px] text-white/30 font-display tracking-wider">
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((m) => {
                    const album = albums.find((a) => a.id === m.album_id);
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-white/5 hover:bg-white/3 cursor-pointer"
                        onClick={() => setPreview(m)}
                      >
                        <td className="px-2 py-1.5">
                          <span style={{ color: KIND_COLOR[m.kind] }}>{KIND_ICON[m.kind]}</span>
                        </td>
                        <td className="px-2 py-1.5 text-white/80 truncate max-w-[220px]">
                          {m.title || m.filename}
                          {m.vault && <Lock size={10} className="inline ml-1 text-primary" />}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: KIND_COLOR[m.kind] }}>{m.kind}</td>
                        <td className="px-2 py-1.5 text-white/50">{fmtBytes(m.size_bytes)}</td>
                        <td className="px-2 py-1.5 text-white/40 truncate max-w-[140px]">{m.tags.join(", ")}</td>
                        <td className="px-2 py-1.5 text-white/50">{album?.name ?? "—"}</td>
                        <td className="px-2 py-1.5 text-white/40">{fmtDate(m.created_at)}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(m.id); }}
                              className="text-white/25 hover:text-amber-300"
                            >
                              <Star size={11} className={m.favorite ? "text-amber-300 fill-amber-300" : ""} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditModal(m); }}
                              className="text-white/25 hover:text-primary"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(m.id); }}
                              className="text-white/25 hover:text-red-400"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-[10px] text-white/50">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded glass border border-white/8 hover:text-primary disabled:opacity-30"
              >
                <ChevronLeft size={11} />
              </button>
              <span>Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded glass border border-white/8 hover:text-primary disabled:opacity-30"
              >
                <ChevronRight size={11} />
              </button>
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>

      {/* ================= PREVIEW MODAL ================= */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 85%)" }}
          onClick={() => setPreview(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-white/8">
              <div className="text-xs text-white/80 font-display truncate">
                {preview.title || preview.filename}
              </div>
              <button onClick={() => setPreview(null)} className="text-white/40 hover:text-white/80">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center bg-black/60 overflow-auto p-4">
              {preview.vault || preview.url === VAULT_SENTINEL ? (
                <div className="text-center text-white/60 text-sm">
                  <Lock size={32} className="mx-auto mb-2 text-primary/60" />
                  <div>Vault-linked item</div>
                  <div className="text-[11px] text-white/40 mt-1 max-w-xs">
                    The file URL is stored in the Vault, not here. Open the Vault to view it.
                  </div>
                  <button
                    onClick={() => { setPreview(null); navigate("/vault"); }}
                    className="inline-block mt-3 px-3 py-1.5 rounded glass-crimson text-primary text-xs font-display"
                  >
                    OPEN VAULT
                  </button>
                </div>
              ) : preview.kind === "image" ? (
                <img
                  src={preview.url}
                  alt={preview.alt_text || preview.title || preview.filename}
                  className="max-w-full max-h-[60vh] object-contain"
                />
              ) : preview.kind === "video" ? (
                <video src={preview.url} controls className="max-w-full max-h-[60vh]" />
              ) : preview.kind === "audio" ? (
                <audio src={preview.url} controls className="w-full max-w-md" />
              ) : (
                <div className="text-center text-white/60 text-sm">
                  <FileText size={32} className="mx-auto mb-2 text-white/20" />
                  <div>{preview.filename}</div>
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 px-3 py-1.5 rounded glass-crimson text-primary text-xs font-display"
                  >
                    OPEN FILE
                  </a>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-white/8 flex items-center gap-2 flex-wrap text-[11px] text-white/50">
              <span>{fmtBytes(preview.size_bytes)}</span>
              <span>·</span>
              <span>{preview.mime}</span>
              <span>·</span>
              <span>{fmtDate(preview.created_at)}</span>
              {preview.tags.length > 0 && (
                <>
                  <span>·</span>
                  <span>{preview.tags.join(", ")}</span>
                </>
              )}
              <div className="ml-auto flex items-center gap-1">
                {preview.kind === "image" && !preview.vault && (
                  <button
                    onClick={() => aiAltText(preview)}
                    disabled={aiBusy === "alt"}
                    className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
                  >
                    {aiBusy === "alt" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    ALT TEXT
                  </button>
                )}
                <button
                  onClick={() => { setEditModal(preview); setPreview(null); }}
                  className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                >
                  <Pencil size={10} /> EDIT
                </button>
                <button
                  onClick={() => setConfirmDeleteId(preview.id)}
                  className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-red-400 text-[10px] font-display flex items-center gap-1"
                >
                  <Trash2 size={10} /> DELETE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ALBUM MODAL ================= */}
      {albumModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setAlbumModal(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">
                {albumModal.id ? "EDIT ALBUM" : "NEW ALBUM"}
              </div>
              <button onClick={() => setAlbumModal(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Name *
                <input
                  autoFocus
                  value={albumModal.name || ""}
                  onChange={(e) => setAlbumModal({ ...albumModal, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveAlbum(); } }}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none focus:border-primary/40"
                />
              </label>
              <label className="block text-[10px] text-white/50">
                Color
                <input
                  type="color"
                  value={albumModal.color || "#4ab3f4"}
                  onChange={(e) => setAlbumModal({ ...albumModal, color: e.target.value })}
                  className="mt-1 w-full h-8 rounded-lg bg-white/4 border border-white/8"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAlbumModal(null)} className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display">
                CANCEL
              </button>
              <button
                onClick={saveAlbum}
                disabled={!albumModal.name?.trim()}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display disabled:opacity-40 flex items-center gap-1"
              >
                <Save size={11} />
                {albumModal.id ? "SAVE" : "CREATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= EDIT MODAL ================= */}
      {editModal && editModal.id && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setEditModal(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">EDIT ITEM</div>
              <button onClick={() => setEditModal(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Title
                <input
                  value={editModal.title || ""}
                  onChange={(e) => setEditModal({ ...editModal, title: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>
              <label className="block text-[10px] text-white/50">
                Album
                <select
                  value={editModal.album_id ?? ""}
                  onChange={(e) => setEditModal({ ...editModal, album_id: e.target.value || null })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                >
                  <option value="" style={{ background: "#0a0a0a" }}>— Unfiled —</option>
                  {albums.map((a) => (
                    <option key={a.id} value={a.id} style={{ background: "#0a0a0a" }}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] text-white/50">
                Alt text {editModal.kind !== "image" && <span className="text-white/25">(images only — will be ignored)</span>}
                <input
                  value={editModal.alt_text || ""}
                  onChange={(e) => setEditModal({ ...editModal, alt_text: e.target.value })}
                  disabled={editModal.kind !== "image"}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none disabled:opacity-40"
                />
              </label>
              <label className="block text-[10px] text-white/50">
                Tags (comma-separated)
                <input
                  value={(editModal.tags || []).join(", ")}
                  onChange={(e) => setEditModal({
                    ...editModal,
                    tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editModal.favorite ?? false}
                    onChange={(e) => setEditModal({ ...editModal, favorite: e.target.checked })}
                    className="accent-primary"
                  />
                  Favorite
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editModal.vault ?? false}
                    onChange={(e) => setEditModal({ ...editModal, vault: e.target.checked })}
                    className="accent-primary"
                  />
                  Vault-linked
                </label>
              </div>
              {(editModal.vault || (editModal.id && items.find((m) => m.id === editModal.id)?.vault)) && (
                <div className="text-[10px] text-amber-300/80 flex gap-1">
                  <Info size={10} className="shrink-0 mt-0.5" />
                  <span>
                    Marking vault-linked strips the URL from this panel. The Vault panel must hold
                    the real URL for this item to be viewable later.
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditModal(null)} className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display">
                CANCEL
              </button>
              <button
                onClick={saveItem}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display flex items-center gap-1"
              >
                <Check size={11} /> SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRM ================= */}
      {confirmDeleteId && (() => {
        const m = items.find((x) => x.id === confirmDeleteId);
        if (!m) return null;
        return (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: "oklch(0 0 0 / 75%)" }}
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              className="glass rounded-xl border border-red-500/30 w-full max-w-sm p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-red-400" />
                <div className="text-xs font-display text-white/80 tracking-wider">REMOVE FROM LIBRARY</div>
              </div>
              <div className="text-[11px] text-white/60 mb-3">
                Remove <span className="text-white/85">"{m.title || m.filename}"</span> from your library?
                The uploaded file stays on the server — this only removes the entry.
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display">
                  CANCEL
                </button>
                <button
                  onClick={() => deleteItem(m.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-display"
                  style={{ background: "oklch(0.5 0.22 25 / 40%)", color: "oklch(0.85 0.15 25)", border: "1px solid oklch(0.6 0.25 25 / 50%)" }}
                >
                  REMOVE
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= TOASTS ================= */}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto glass rounded-lg border px-3 py-2 text-[11px] flex items-center gap-2 max-w-sm"
            style={{
              borderColor:
                t.kind === "error" ? "oklch(0.6 0.25 25 / 50%)"
                : t.kind === "success" ? "oklch(0.7 0.18 150 / 50%)"
                : "oklch(0.7 0.15 220 / 50%)",
            }}
          >
            {t.kind === "error" && <AlertCircle size={12} className="text-red-400 shrink-0" />}
            {t.kind === "success" && <CheckCircle size={12} className="text-green-400 shrink-0" />}
            {t.kind === "info" && <Info size={12} className="text-sky-400 shrink-0" />}
            <span className="text-white/80">{t.text}</span>
          </div>
        ))}
      </div>
    </PanelLayout>
  );
}