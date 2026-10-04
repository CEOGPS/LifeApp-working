// src/pages/music/api/entities.ts
// LOCAL-FIRST Track/Playlist store. create/list never await network.

import { unifiedSet } from "@/lib/unifiedStorage";
import type { DBTrack, DBPlaylist } from "../types";

export const TRACKS_KEY = "music_hub_tracks";
export const PLAYLISTS_KEY = "music_hub_playlists";

const LEGACY_TRACKS = "lifeos_music_tracks";
const LEGACY_PLAYLISTS = "lifeos_music_playlists";
const LS_PREFIX = "lifeos_unified_";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortRows<T extends { created_at?: string }>(rows: T[], sort?: string): T[] {
  const desc = !sort || sort.startsWith("-");
  return [...rows].sort((a, b) => {
    const av = a.created_at ?? "";
    const bv = b.created_at ?? "";
    return desc ? bv.localeCompare(av) : av.localeCompare(bv);
  });
}

function lsRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function lsWrite(key: string, val: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.warn("[music] localStorage write failed:", e);
    throw e instanceof Error ? e : new Error("localStorage write failed");
  }
}

function migrateLegacyOnce(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(LS_PREFIX + TRACKS_KEY) === null) {
      const raw = localStorage.getItem(LEGACY_TRACKS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const mapped: DBTrack[] = parsed
            .map((t: Record<string, unknown>) => {
              const url = (t.url || t.audioFileUrl) as string | undefined;
              if (!url) return null;
              return {
                id: String(t.id ?? newId("trk")),
                title: String(t.title ?? t.name ?? "Untitled"),
                audioFileUrl: url,
                gender: (t.artist as string) || null,
                genre: (t.genre as string) || "Uploaded",
                status: "ready",
                created_at: String(t.added ?? t.created_at ?? new Date().toISOString()),
                playlistIds: [],
              } as DBTrack;
            })
            .filter(Boolean) as DBTrack[];
          lsWrite(TRACKS_KEY, mapped);
        }
      }
    }
    if (localStorage.getItem(LS_PREFIX + PLAYLISTS_KEY) === null) {
      const raw = localStorage.getItem(LEGACY_PLAYLISTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const mapped: DBPlaylist[] = parsed.map((p: Record<string, unknown>) => ({
            id: String(p.id ?? newId("pl")),
            name: String(p.name ?? "Playlist"),
            trackIds: Array.isArray(p.tracks) ? p.tracks : Array.isArray(p.trackIds) ? p.trackIds : [],
            color: (p.color as string) || null,
            coverMosaicUrls: p.cover ? [p.cover] : [],
            created_at: String(p.created_at ?? new Date().toISOString()),
          }));
          lsWrite(PLAYLISTS_KEY, mapped);
        }
      }
    }
  } catch {
    /* ignore */
  }
}

function mirrorLegacyTracks(rows: DBTrack[]): void {
  try {
    localStorage.setItem(
      LEGACY_TRACKS,
      JSON.stringify(
        rows
          .filter((t) => !!t.audioFileUrl)
          .map((t) => ({
            id: t.id,
            name: t.title,
            artist: t.gender || "Music Hub",
            url: t.audioFileUrl as string,
            added: t.created_at,
          })),
      ),
    );
  } catch { /* ignore */ }
}

function mirrorLegacyPlaylists(rows: DBPlaylist[]): void {
  try {
    localStorage.setItem(
      LEGACY_PLAYLISTS,
      JSON.stringify(
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          cover: null,
          color: p.color || "#dc143c",
          tracks: Array.isArray(p.trackIds) ? p.trackIds : [],
        })),
      ),
    );
  } catch { /* ignore */ }
}

function readTracksSync(): DBTrack[] {
  migrateLegacyOnce();
  const local = lsRead<DBTrack[]>(TRACKS_KEY);
  return Array.isArray(local) ? local : [];
}

function writeTracksSync(rows: DBTrack[]): void {
  lsWrite(TRACKS_KEY, rows);
  mirrorLegacyTracks(rows);
  // Background only — never awaited by callers.
  try {
    void unifiedSet(TRACKS_KEY, rows);
  } catch { /* ignore */ }
}

function readPlaylistsSync(): DBPlaylist[] {
  migrateLegacyOnce();
  const local = lsRead<DBPlaylist[]>(PLAYLISTS_KEY);
  return Array.isArray(local) ? local : [];
}

function writePlaylistsSync(rows: DBPlaylist[]): void {
  lsWrite(PLAYLISTS_KEY, rows);
  mirrorLegacyPlaylists(rows);
  try {
    void unifiedSet(PLAYLISTS_KEY, rows);
  } catch { /* ignore */ }
}

export const TrackEntity = {
  list: async (sort?: string, limit?: number, _signal?: AbortSignal): Promise<DBTrack[]> => {
    const rows = sortRows(readTracksSync(), sort);
    return limit !== undefined ? rows.slice(0, limit) : rows;
  },
  /** Sync-local create. Resolves in the same tick after localStorage write. */
  create: async (body: Record<string, unknown>): Promise<DBTrack> => {
    const rows = readTracksSync();
    const row: DBTrack = {
      id: newId("trk"),
      title: String(body.title ?? "Untitled"),
      lyrics: (body.lyrics as string) ?? "",
      genre: (body.genre as string) ?? null,
      mood: (body.mood as string) ?? null,
      gender: (body.gender as string) ?? null,
      bpm: typeof body.bpm === "number" ? body.bpm : null,
      duration: typeof body.duration === "number" ? body.duration : null,
      coverArtUrl: (body.coverArtUrl as string) ?? null,
      audioFileUrl: (body.audioFileUrl as string) ?? null,
      status: (body.status as string) ?? "ready",
      playlistIds: Array.isArray(body.playlistIds) ? body.playlistIds : [],
      created_at: new Date().toISOString(),
      play_count: 0,
      last_played_at: null,
    };
    writeTracksSync([row, ...rows]);
    return row;
  },
  update: async (id: string, body: Record<string, unknown>): Promise<DBTrack> => {
    const rows = readTracksSync();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`Track not found: ${id}`);
    const next = { ...rows[idx], ...body, id } as DBTrack;
    const copy = [...rows];
    copy[idx] = next;
    writeTracksSync(copy);
    return next;
  },
  delete: async (id: string): Promise<void> => {
    writeTracksSync(readTracksSync().filter((r) => r.id !== id));
  },
};

export const PlaylistEntity = {
  list: async (sort?: string, limit?: number, _signal?: AbortSignal): Promise<DBPlaylist[]> => {
    const rows = sortRows(readPlaylistsSync(), sort);
    return limit !== undefined ? rows.slice(0, limit) : rows;
  },
  create: async (body: Record<string, unknown>): Promise<DBPlaylist> => {
    const rows = readPlaylistsSync();
    const row: DBPlaylist = {
      id: newId("pl"),
      name: String(body.name ?? "Playlist"),
      trackIds: Array.isArray(body.trackIds) ? body.trackIds : [],
      color: (body.color as string) ?? null,
      coverMosaicUrls: Array.isArray(body.coverMosaicUrls) ? body.coverMosaicUrls : [],
      created_at: new Date().toISOString(),
    };
    writePlaylistsSync([row, ...rows]);
    return row;
  },
  update: async (id: string, body: Record<string, unknown>): Promise<DBPlaylist> => {
    const rows = readPlaylistsSync();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error(`Playlist not found: ${id}`);
    const next = { ...rows[idx], ...body, id } as DBPlaylist;
    const copy = [...rows];
    copy[idx] = next;
    writePlaylistsSync(copy);
    return next;
  },
  delete: async (id: string): Promise<void> => {
    writePlaylistsSync(readPlaylistsSync().filter((r) => r.id !== id));
  },
};