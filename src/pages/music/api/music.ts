// src/pages/music/api/music.ts
// IMPORT critical path is LOCAL ONLY (IndexedDB). No fetch, no Supabase, no uploadFile.
// Remote sync is optional and never called from uploadMusicFile.

import { lifeosApi } from "./client";
import { putMusicBlob, toIdbMusicUrl } from "../lib/musicBlobStore";
import type { GeneratedSong, Genre, Mood, Voice } from "../types";

export interface GenerateInput {
  prompt: string;
  lyrics: string;
  genre: Genre;
  mood: Mood;
  voice: Voice;
  bpm: number;
}

export function generateSong(input: GenerateInput, signal?: AbortSignal) {
  return lifeosApi<{ id: string }>("/api/music/generate", {
    method: "POST",
    body: input,
    signal,
  });
}

export function pollSongStatus(id: string, signal?: AbortSignal) {
  return lifeosApi<GeneratedSong>(`/api/music/status/${encodeURIComponent(id)}`, { signal });
}

export interface PolishResult {
  ok: boolean;
  text: string;
  detail?: string;
}

export function polishLyrics(lyrics: string, genre: Genre, bpm: number, signal?: AbortSignal) {
  return lifeosApi<PolishResult>("/api/music/polish", {
    method: "POST",
    body: { lyrics, genre, bpm },
    signal,
  });
}

/**
 * Music Hub import — IndexedDB only.
 * Never calls uploadFile / getSupabaseClient / fetch.
 * Returns a durable idb:music/<key> URL for playback via musicBlobStore.
 */
export async function uploadMusicFile(file: File, _signal?: AbortSignal) {
  if (!file) throw new Error("No file provided");
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB unavailable in this browser");
  }

  const key = `blob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Hard cap so a stuck IDB request cannot leave IMPORT spinning.
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Local save timed out (IndexedDB)")),
      8000,
    );
    putMusicBlob(key, file).then(
      () => { window.clearTimeout(timer); resolve(); },
      (e) => { window.clearTimeout(timer); reject(e instanceof Error ? e : new Error(String(e))); },
    );
  });

  return {
    ok: true as const,
    url: toIdbMusicUrl(key),
    source: "indexeddb" as const,
  };
}