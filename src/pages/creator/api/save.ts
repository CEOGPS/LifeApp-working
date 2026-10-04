/**
 * Persist Creator outputs into Media (album "Creator") and Music Hub library.
 */
import { uploadFile } from "@/lib/uploadFile";
import { uploadMusicFile } from "@/pages/music/api/music";
import { TrackEntity } from "@/pages/music/api/entities";

export type MediaKind = "image" | "video" | "audio" | "document" | "other";

export interface MediaAlbum {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface MediaItem {
  id: string;
  album_id: string | null;
  kind: MediaKind;
  mime: string;
  filename: string;
  title: string;
  alt_text: string;
  url: string;
  thumb_url: string | null;
  size_bytes: number;
  tags: string[];
  vault: boolean;
  favorite: boolean;
  created_at: string;
}

const MEDIA_ITEMS_KEY = "lifeos_media_items";
const MEDIA_ALBUMS_KEY = "lifeos_media_albums";
export const CREATOR_ALBUM_NAME = "Creator";
export const CREATOR_ALBUM_COLOR = "#a78bfa";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Ensure a Media album named Creator exists; return its id. */
export function ensureCreatorAlbum(): string {
  const albums = readJson<MediaAlbum[]>(MEDIA_ALBUMS_KEY, []);
  const existing = albums.find(
    (a) => a.name.toLowerCase() === CREATOR_ALBUM_NAME.toLowerCase() || a.name.toLowerCase() === "creatoros",
  );
  if (existing) return existing.id;
  const album: MediaAlbum = {
    id: newId("alb"),
    name: CREATOR_ALBUM_NAME,
    color: CREATOR_ALBUM_COLOR,
    created_at: new Date().toISOString(),
  };
  writeJson(MEDIA_ALBUMS_KEY, [album, ...albums]);
  return album.id;
}

async function urlToFile(url: string, filename: string, mimeHint?: string): Promise<File> {
  if (url.startsWith("data:")) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeHint || blob.type || "application/octet-stream" });
  }
  if (url.startsWith("blob:")) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new File([blob], filename, { type: mimeHint || blob.type || "application/octet-stream" });
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download result (${res.status})`);
  const blob = await res.blob();
  return new File([blob], filename, { type: mimeHint || blob.type || "application/octet-stream" });
}

export async function saveToCreatorMedia(opts: {
  title: string;
  kind: MediaKind;
  mime: string;
  filename: string;
  /** Remote URL, blob URL, data URL, or already-uploaded URL */
  sourceUrl?: string;
  file?: File;
  tags?: string[];
  alt?: string;
}): Promise<MediaItem> {
  const albumId = ensureCreatorAlbum();
  let file = opts.file;
  if (!file) {
    if (!opts.sourceUrl) throw new Error("Nothing to save");
    // If already a durable http(s) URL (not blob), store directly without re-upload when possible
    if (/^https?:\/\//i.test(opts.sourceUrl) && !opts.sourceUrl.includes("blob:")) {
      const item: MediaItem = {
        id: newId("m"),
        album_id: albumId,
        kind: opts.kind,
        mime: opts.mime,
        filename: opts.filename,
        title: opts.title.trim() || opts.filename,
        alt_text: opts.alt || "Created in Creator Studio",
        url: opts.sourceUrl,
        thumb_url: opts.kind === "image" ? opts.sourceUrl : null,
        size_bytes: 0,
        tags: ["creator", ...(opts.tags || [])],
        vault: false,
        favorite: false,
        created_at: new Date().toISOString(),
      };
      const items = readJson<MediaItem[]>(MEDIA_ITEMS_KEY, []);
      writeJson(MEDIA_ITEMS_KEY, [item, ...items]);
      return item;
    }
    file = await urlToFile(opts.sourceUrl, opts.filename, opts.mime);
  }
  const up = await uploadFile(file, "media");
  const url = up.url || up.file_url;
  if (!url) throw new Error("Upload returned no URL");
  const item: MediaItem = {
    id: newId("m"),
    album_id: albumId,
    kind: opts.kind,
    mime: opts.mime || file.type || "application/octet-stream",
    filename: opts.filename || file.name,
    title: opts.title.trim() || file.name,
    alt_text: opts.alt || "Created in Creator Studio",
    url,
    thumb_url: up.thumb_url ?? (opts.kind === "image" ? url : null),
    size_bytes: file.size,
    tags: ["creator", ...(opts.tags || [])],
    vault: false,
    favorite: false,
    created_at: new Date().toISOString(),
  };
  const items = readJson<MediaItem[]>(MEDIA_ITEMS_KEY, []);
  writeJson(MEDIA_ITEMS_KEY, [item, ...items]);
  return item;
}

export async function saveAudioToMusicLibrary(opts: {
  title: string;
  file?: File;
  sourceUrl?: string;
  genre?: string;
  mood?: string;
}): Promise<{ id: string; title: string; audioFileUrl: string }> {
  let file = opts.file;
  if (!file) {
    if (!opts.sourceUrl) throw new Error("No audio to save");
    const safe = (opts.title || "creator-track").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
    file = await urlToFile(opts.sourceUrl, `${safe}.mp3`, "audio/mpeg");
  }
  const up = await uploadMusicFile(file);
  const audioUrl = up?.url;
  if (!audioUrl) throw new Error("Music upload returned no URL");
  const row = await TrackEntity.create({
    title: opts.title.trim() || file.name,
    genre: opts.genre || "Creator",
    mood: opts.mood || null,
    gender: "Creator Studio",
    audioFileUrl: audioUrl,
    status: "ready",
    playlistIds: [],
  });
  return { id: row.id, title: row.title, audioFileUrl: audioUrl };
}

export async function saveTextDocument(opts: {
  title: string;
  body: string;
}): Promise<MediaItem> {
  const text = opts.body;
  if (!text.trim()) throw new Error("Document is empty");
  const name = `${(opts.title || "creator-doc").replace(/[^a-zA-Z0-9._-]+/g, "_")}.txt`;
  const file = new File([text], name, { type: "text/plain" });
  return saveToCreatorMedia({
    title: opts.title || "Untitled doc",
    kind: "document",
    mime: "text/plain",
    filename: name,
    file,
    tags: ["document", "writer"],
  });
}
