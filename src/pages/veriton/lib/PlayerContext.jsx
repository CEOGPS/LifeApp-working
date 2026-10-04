import React, { createContext, useContext, useState, useCallback } from "react";

const PlayerContext = createContext(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [trackList, setTrackList] = useState([]);

  const playTrack = useCallback((track, list = []) => {
    setCurrentTrack(track);
    if (list.length) setTrackList(list);
    else if (track) setTrackList([track]);
  }, []);

  const onNext = useCallback(() => {
    if (!currentTrack || trackList.length === 0) return;
    const idx = trackList.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (idx + 1) % trackList.length;
    setCurrentTrack(trackList[nextIdx]);
  }, [currentTrack, trackList]);

  const onPrev = useCallback(() => {
    if (!currentTrack || trackList.length === 0) return;
    const idx = trackList.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = (idx - 1 + trackList.length) % trackList.length;
    setCurrentTrack(trackList[prevIdx]);
  }, [currentTrack, trackList]);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        trackList,
        playTrack,
        onNext,
        onPrev,
        setCurrentTrack,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
