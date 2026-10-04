// src/lib/AudioProvider.tsx
// Audio context provider for persistent audio across navigation

import React, { createContext, useContext, useRef, useEffect, type ReactNode } from "react";

interface AudioContextType {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playAudio: (src: string) => Promise<void>;
  pauseAudio: () => void;
  stopAudio: () => void;
  setVolume: (volume: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  seek: (time: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = async (src: string) => {
    if (audioRef.current) {
      audioRef.current.src = src;
      try {
        await audioRef.current.play();
      } catch (e) {
        console.error("Audio play failed:", e);
      }
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  };

  const getDuration = () => audioRef.current?.duration || 0;
  const getCurrentTime = () => audioRef.current?.currentTime || 0;
  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  return (
    <AudioContext.Provider value={{
      audioRef,
      playAudio,
      pauseAudio,
      stopAudio,
      setVolume,
      getDuration,
      getCurrentTime,
      seek,
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}