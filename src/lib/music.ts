// src/lib/music.ts
// LifeOS1 Music — generation interface + streaming link helpers.
// Real generation is stubbed behind an interface so a provider can drop in
// later without touching the panel. Streaming links are static search URLs.

import { api } from "./api";
import { invokeLLM } from "./llm";

/* ═══════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════ */

export type SongStatus = "generating" | "ready" | "failed";

export interface GeneratedSong {
  id: string;
  title: string;
  prompt: string;
  lyrics?: string;
  genre: string;
  mood: string;
  voice: string;
  bpm: number;
  durationSec: number;
  status: SongStatus;
  audioUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  playCount?: number;
}

export interface GenerateOptions {
  prompt: string;
  lyrics?: string;
  genre: string;
  mood: string;
  voice: string;
  bpm: number;
  durationSec?: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Generation — interface + stub
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Which backend to use for generation. This is the ONE place a real provider
 * gets wired in. Today: stub. Tomorrow: set to "worker" and add the route.
 */
type Backend = "stub" | "worker";
const BACKEND: Backend = "stub";

const STUB_LATENCY_MS = 12000;

/**
 * Start generation. Returns immediately with an id and status "generating".
 * The panel then polls `pollSongStatus(id)` until status is "ready".
 */
export async function generateSong(
  opts: GenerateOptions,
): Promise<{ id: string; status: SongStatus }> {
  if (BACKEND === "worker") {
    const res = await api.post<{ id: string; status: SongStatus }>(
      "/api/music/generate",
      opts,
    );
    return res;
  }
  // Stub: return an id immediately. pollSongStatus will flip it to "ready".
  const id = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  queueStubReady(id, opts);
  return { id, status: "generating" };
}

/**
 * Poll the status of a generation. On success returns a GeneratedSong with
 * a real audioUrl.
 */
export async function pollSongStatus(id: string): Promise<GeneratedSong> {
  if (BACKEND === "worker") {
    return api.get<GeneratedSong>(`/api/music/status/${encodeURIComponent(id)}`);
  }
  return getStubSong(id);
}

/* ── Stub internals ── */

const stubSongs = new Map<string, GeneratedSong>();
const stubReadyAt = new Map<string, number>();

function queueStubReady(id: string, opts: GenerateOptions): void {
  const now = new Date().toISOString();
  stubSongs.set(id, {
    id,
    title: deriveTitle(opts),
    prompt: opts.prompt,
    lyrics: opts.lyrics,
    genre: opts.genre,
    mood: opts.mood,
    voice: opts.voice,
    bpm: opts.bpm,
    durationSec: opts.durationSec ?? 180,
    status: "generating",
    createdAt: now,
    playCount: 0,
  });
  stubReadyAt.set(id, Date.now() + STUB_LATENCY_MS);
}

function getStubSong(id: string): GeneratedSong {
  const song = stubSongs.get(id);
  if (!song) {
    return {
      id,
      title: "Unknown",
      prompt: "",
      genre: "unknown",
      mood: "unknown",
      voice: "unknown",
      bpm: 120,
      durationSec: 180,
      status: "failed",
      createdAt: new Date().toISOString(),
    };
  }
  const readyAt = stubReadyAt.get(id);
  if (song.status === "generating" && readyAt && Date.now() >= readyAt) {
    const updated: GeneratedSong = {
      ...song,
      status: "ready",
      audioUrl: pickDemoAudioUrl(id),
      thumbnailUrl: pickDemoThumbnailUrl(id),
    };
    stubSongs.set(id, updated);
    return updated;
  }
  return song;
}

/**
 * Deterministic demo audio — a public sample URL. Real provider replaces this.
 */
function pickDemoAudioUrl(_id: string): string {
  // SoundHelix royalty-free sample loops. Replace when a real provider is wired.
  const DEMO = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  ];
  return DEMO[Math.floor(Math.random() * DEMO.length)];
}

function pickDemoThumbnailUrl(_id: string): string {
  // Placeholder gradient is rendered client-side; no external image needed.
  return "";
}

function deriveTitle(opts: GenerateOptions): string {
  const first = (opts.lyrics || opts.prompt || "").trim().split(/\r?\n/)[0];
  if (!first) return "Untitled";
  return first.slice(0, 48).trim();
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI lyric polish — uses the canonical LLM client
   ═══════════════════════════════════════════════════════════════════════════ */

export async function polishLyrics(
  lyrics: string,
  genre: string,
  bpm: number,
): Promise<{ ok: true; text: string } | { ok: false; detail: string }> {
  const res = await invokeLLM({
    prompt:
      `Rewrite these lyrics to fit the syllable count and structure of a ` +
      `${genre} song at ${bpm} BPM, without changing the core meaning. ` +
      `Return ONLY the rewritten lyrics.\n\n${lyrics}`,
    systemPrompt: "You are a professional songwriter. Return only lyrics.",
    maxTokens: 800,
  });
  if (!res.ok) return { ok: false, detail: `${res.reason}: ${res.detail}` };
  return { ok: true, text: res.text.trim() };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Streaming links — outbound search on 6 services
   ═══════════════════════════════════════════════════════════════════════════ */

export interface StreamingService {
  id: string;
  label: string;
  /** Builds a search URL for a given track title + optional artist. */
  search: (title: string, artist?: string) => string;
  /** Brand color for icon tinting. */
  color: string;
}

export const STREAMING_SERVICES: StreamingService[] = [
  {
    id: "spotify",
    label: "Spotify",
    color: "#1DB954",
    search: (t, a) =>
      `https://open.spotify.com/search/${encodeURIComponent([t, a].filter(Boolean).join(" "))}`,
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    color: "#ff5500",
    search: (t, a) =>
      `https://soundcloud.com/search?q=${encodeURIComponent([t, a].filter(Boolean).join(" "))}`,
  },
  {
    id: "apple",
    label: "Apple Music",
    color: "#FA243C",
    search: (t, a) =>
      `https://music.apple.com/us/search?term=${encodeURIComponent([t, a].filter(Boolean).join(" "))}`,
  },
  {
    id: "amazon",
    label: "Amazon Music",
    color: "#00A8E1",
    search: (t, a) =>
      `https://music.amazon.com/search/${encodeURIComponent([t, a].filter(Boolean).join(" "))}`,
  },
  {
    id: "pandora",
    label: "Pandora",
    color: "#3668FF",
    search: (t, a) =>
      `https://www.pandora.com/search/${encodeURIComponent([t, a].filter(Boolean).join(" "))}/all`,
  },
  {
    id: "audiomack",
    label: "AudioMack",
    color: "#FFA200",
    search: (t, a) =>
      `https://audiomack.com/search?q=${encodeURIComponent([t, a].filter(Boolean).join(" "))}`,
  },
];

export function streamLink(
  serviceId: string,
  title: string,
  artist?: string,
): string | null {
  const svc = STREAMING_SERVICES.find((s) => s.id === serviceId);
  return svc ? svc.search(title, artist) : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Constants used by the panel
   ═══════════════════════════════════════════════════════════════════════════ */

export const GENRES = [
  "Pop", "Rock", "Hip-Hop", "Country", "R&B", "Electronic",
  "Reggae", "Blues", "Soul", "Synthwave", "Jazz", "Lo-Fi",
  "Indie", "Metal", "Folk",
] as const;

export const MOODS = [
  "Uplifting", "Melancholy", "Aggressive", "Chill", "Dreamy",
  "Dark", "Nostalgic", "Romantic", "Energetic", "Reflective",
] as const;

export const VOICES = [
  "Male", "Female", "Duet", "Choir", "Instrumental",
] as const;

export type Genre = (typeof GENRES)[number];
export type Mood = (typeof MOODS)[number];
export type Voice = (typeof VOICES)[number];