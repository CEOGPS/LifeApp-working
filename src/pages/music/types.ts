// src/pages/music/types.ts
// Domain types for the Music Hub. Inferred from real usage — no `any`.

export type Tab = "library" | "playlists";

export const GENRES = [
  "Pop", "Rock", "Hip-Hop", "R&B", "Electronic", "Jazz", "Country", "Ambient",
] as const;
export type Genre = (typeof GENRES)[number];

export const MOODS = [
  "Uplifting", "Melancholic", "Energetic", "Chill", "Romantic", "Dark",
] as const;
export type Mood = (typeof MOODS)[number];

export const VOICES = ["Female", "Male", "Neutral"] as const;
export type Voice = (typeof VOICES)[number];

export type TrackStatus = "generating" | "ready" | "failed";

/** Row shape returned by GET /api/entities/Track. */
export interface DBTrack {
  id: string;
  title: string;
  lyrics?: string | null;
  genre?: string | null;
  mood?: string | null;
  gender?: string | null;
  bpm?: number | null;
  duration?: number | null;
  coverArtUrl?: string | null;
  audioFileUrl?: string | null;
  status?: string | null;
  playlistIds?: unknown;
  created_at?: string;
  play_count?: number | null;
  last_played_at?: string | null;
}

/** Row shape returned by GET /api/entities/Playlist. */
export interface DBPlaylist {
  id: string;
  name: string;
  trackIds?: unknown;
  color?: string | null;
  coverMosaicUrls?: unknown;
  created_at?: string;
}

/** Payload returned by GET /api/music/status/:id. */
export interface GeneratedSong {
  status: TrackStatus;
  title: string;
  lyrics?: string;
  genre?: string;
  mood?: string;
  voice?: string;
  bpm?: number;
  durationSec?: number;
  thumbnailUrl?: string;
  audioUrl?: string;
}

/** Normalized track shape used by the player. */
export interface PlayerTrack {
  id: string;
  title: string;
  audioFileUrl?: string;
  artist?: string;
  genre?: string;
  thumbnailUrl?: string;
  durationSec?: number;
}

export interface StreamingService {
  id: string;
  label: string;
  color: string;
  search: (title: string) => string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };