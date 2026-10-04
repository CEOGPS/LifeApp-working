import React, { createContext, useContext, useState, useCallback } from "react";

interface YoutubeVideo {
  videoId: string;
  title: string;
}

interface MusicTrack {
  [key: string]: unknown;
}

interface GlobalPlaybackContextValue {
  youtube: YoutubeVideo | null;
  music: MusicTrack | null;
  playing: boolean;
  setYoutubeVideo: (videoId: string, title: string) => void;
  stopYoutube: () => void;
  playTrack: (track: MusicTrack) => void;
  stopMusic: () => void;
}

interface GlobalPlaybackProviderProps {
  children: React.ReactNode;
}

const GlobalPlaybackContext = createContext<GlobalPlaybackContextValue | null>(
  null,
);

export function GlobalPlaybackProvider({
  children,
}: GlobalPlaybackProviderProps) {
  const [youtube, setYoutube] = useState<YoutubeVideo | null>(null);
  const [music, setMusic] = useState<MusicTrack | null>(null);
  const [playing, setPlaying] = useState(false);

  const setYoutubeVideo = useCallback((videoId: string, title: string) => {
    setYoutube({ videoId, title });
    setPlaying(true);
  }, []);

  const stopYoutube = useCallback(() => {
    setYoutube(null);
    setPlaying(false);
  }, []);

  const playTrack = useCallback((track: MusicTrack) => {
    setMusic(track);
    setPlaying(true);
  }, []);

  const stopMusic = useCallback(() => {
    setMusic(null);
    setPlaying(false);
  }, []);

  return React.createElement(
    GlobalPlaybackContext.Provider,
    {
      value: {
        youtube,
        music,
        playing,
        setYoutubeVideo,
        stopYoutube,
        playTrack,
        stopMusic,
      },
    },
    children,
  );
}

export function useGlobalPlayback() {
  const context = useContext(GlobalPlaybackContext);
  if (!context) {
    throw new Error(
      "useGlobalPlayback must be used within a GlobalPlaybackProvider",
    );
  }
  return context;
}