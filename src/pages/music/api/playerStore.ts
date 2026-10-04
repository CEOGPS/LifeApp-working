// src/pages/music/api/playerStore.ts
// Bridges Music Hub PlayerTrack shape → global MusicContext.
// Resolves idb:music/* URLs to object URLs before play.

import { useCallback, useMemo } from "react";
import { useMusic as useMusicContext } from "@/lib/MusicContext";
import { isIdbMusicUrl, resolvePlayableUrl } from "../lib/musicBlobStore";
import type { PlayerTrack } from "../types";

function toCtx(track: PlayerTrack, url: string) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist || "Music Hub",
    url,
    coverUrl: track.thumbnailUrl,
    duration: track.durationSec || 0,
  };
}

function fromCtx(track: {
  id: string;
  title: string;
  artist: string;
  url: string;
  coverUrl?: string;
  duration: number;
}): PlayerTrack {
  return {
    id: track.id,
    title: track.title,
    audioFileUrl: track.url,
    artist: track.artist,
    thumbnailUrl: track.coverUrl,
    durationSec: track.duration,
  };
}

async function resolveTrackUrl(track: PlayerTrack): Promise<string> {
  const raw = track.audioFileUrl || "";
  if (!raw) throw new Error("Track has no audio URL");
  if (isIdbMusicUrl(raw)) return resolvePlayableUrl(raw);
  return raw;
}

/** Drop-in for the old hook — full playback surface for HubPlayerBar + TrackRow. */
export function useMusic() {
  const ctx = useMusicContext();
  const {
    playlist,
    currentTrack: ctxCurrent,
    isPlaying,
    volume,
    currentTime,
    duration,
    play,
    pause,
    next,
    previous,
    setVolume,
    seek,
    setPlaylist,
    addToPlaylist,
    shuffle,
  } = ctx;

  const queue = useMemo(() => playlist.map(fromCtx), [playlist]);
  const currentTrack = ctxCurrent ? fromCtx(ctxCurrent) : null;

  const setTracks = useCallback(
    (tracks: PlayerTrack[]) => {
      setPlaylist(
        tracks
          .filter((t) => !!t.audioFileUrl)
          .map((t) => toCtx(t, t.audioFileUrl as string)),
      );
    },
    [setPlaylist],
  );

  const playTrack = useCallback(
    async (track: PlayerTrack) => {
      if (!track.audioFileUrl) return;
      try {
        const url = await resolveTrackUrl(track);
        play(toCtx(track, url));
      } catch (e) {
        console.error("[music] play resolve failed:", e);
      }
    },
    [play],
  );

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const addToQueue = useCallback(
    (track: PlayerTrack) => {
      if (!track.audioFileUrl) return;
      addToPlaylist([toCtx(track, track.audioFileUrl)]);
    },
    [addToPlaylist],
  );

  const applyPlaylist = useCallback(
    async (ids: string[]) => {
      const firstMeta = ids.map((id) => playlist.find((t) => t.id === id)).find(Boolean);
      if (!firstMeta) return;
      try {
        const url = isIdbMusicUrl(firstMeta.url)
          ? await resolvePlayableUrl(firstMeta.url)
          : firstMeta.url;
        play({ ...firstMeta, url });
      } catch (e) {
        console.error("[music] playlist play resolve failed:", e);
      }
    },
    [playlist, play],
  );

  return {
    queue,
    setTracks,
    currentTrack,
    playing: isPlaying,
    playTrack,
    togglePlay,
    addToQueue,
    applyPlaylist,
    next,
    previous,
    shuffle,
    volume,
    setVolume,
    currentTime,
    duration,
    seek,
  };
}