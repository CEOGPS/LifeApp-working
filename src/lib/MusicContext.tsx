// Audio provider for global music playback

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";

interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  coverUrl?: string;
  duration: number;
}

interface MusicContextType {
  currentTrack: Track | null;
  playlist: Track[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  play: (track?: Track) => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  setVolume: (vol: number) => void;
  seek: (time: number) => void;
  addToPlaylist: (tracks: Track[]) => void;
  setPlaylist: (tracks: Track[]) => void;
  shuffle: () => void;
  toggleLoop: () => void;
  loopMode: "none" | "one" | "all";
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loopMode, setLoopMode] = useState<"none" | "one" | "all">("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentIndexRef = useRef(0);
  const playlistRef = useRef<Track[]>([]);
  const currentTrackRef = useRef<Track | null>(null);
  const loopModeRef = useRef(loopMode);

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { loopModeRef.current = loopMode; }, [loopMode]);

  const playSrc = useCallback((track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    void (async () => {
      let url = track.url;
      try {
        if (url.startsWith("idb:music/")) {
          const { resolvePlayableUrl } = await import("@/pages/music/lib/musicBlobStore");
          url = await resolvePlayableUrl(url);
        }
      } catch (e) {
        console.error("[Music] resolve playable URL failed:", e);
        setIsPlaying(false);
        return;
      }
      if (audio.src !== url) {
        audio.src = url;
      }
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        console.error("[Music] play failed:", e);
        setIsPlaying(false);
      }
    })();
  }, []);

  const next = useCallback(() => {
    const list = playlistRef.current;
    if (list.length === 0) return;
    currentIndexRef.current = (currentIndexRef.current + 1) % list.length;
    const nextTrack = list[currentIndexRef.current];
    setCurrentTrack(nextTrack);
    playSrc(nextTrack);
  }, [playSrc]);

  const previous = useCallback(() => {
    const list = playlistRef.current;
    if (list.length === 0) return;
    currentIndexRef.current = (currentIndexRef.current - 1 + list.length) % list.length;
    const prevTrack = list[currentIndexRef.current];
    setCurrentTrack(prevTrack);
    playSrc(prevTrack);
  }, [playSrc]);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = volume;
    audioRef.current = audio;

    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      if (loopModeRef.current === "one" && currentTrackRef.current) {
        audio.currentTime = 0;
        void audio.play().catch(console.error);
        return;
      }
      if (loopModeRef.current === "all" || currentIndexRef.current < playlistRef.current.length - 1) {
        next();
      } else {
        setIsPlaying(false);
      }
    };
    const onError = (e: Event) => {
      console.error("[Music] Audio error:", e);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback((track?: Track) => {
    if (track) {
      const list = playlistRef.current;
      let idx = list.findIndex((t) => t.id === track.id);
      if (idx === -1) {
        const nextList = [...list, track];
        playlistRef.current = nextList;
        setPlaylist(nextList);
        idx = nextList.length - 1;
      }
      currentIndexRef.current = idx;
      setCurrentTrack(track);
      playSrc(track);
      return;
    }

    const cur = currentTrackRef.current ?? playlistRef.current[0];
    if (!cur) return;
    if (!currentTrackRef.current) {
      currentIndexRef.current = 0;
      setCurrentTrack(cur);
    }
    playSrc(cur);
  }, [playSrc]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : (Number.isFinite(duration) && duration > 0 ? duration : time);
    audio.currentTime = Math.max(0, Math.min(time, max));
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const addToPlaylist = useCallback((tracks: Track[]) => {
    setPlaylist((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      const merged = [...prev, ...tracks.filter((t) => !ids.has(t.id))];
      playlistRef.current = merged;
      return merged;
    });
  }, []);

  const setPlaylistTracks = useCallback((tracks: Track[]) => {
    playlistRef.current = tracks;
    setPlaylist(tracks);
    currentIndexRef.current = 0;
  }, []);

  const shuffle = useCallback(() => {
    setPlaylist((prev) => {
      const next = [...prev].sort(() => Math.random() - 0.5);
      playlistRef.current = next;
      return next;
    });
  }, []);

  const toggleLoop = useCallback(() => {
    setLoopMode((prev) => {
      if (prev === "none") return "all";
      if (prev === "all") return "one";
      return "none";
    });
  }, []);

  return (
    <MusicContext.Provider value={{
      currentTrack,
      playlist,
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
      addToPlaylist,
      setPlaylist: setPlaylistTracks,
      shuffle,
      toggleLoop,
      loopMode,
    }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
}