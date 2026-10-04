import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Volume1,
  VolumeX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function GlobalMusicPlayer({
  currentTrack,
  onNext,
  onPrev,
  tracks,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(70);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [muted, setMuted] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isPlaying && currentTrack) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            if (repeat) return 0;
            onNext?.();
            return 0;
          }
          return p + 0.3;
        });
      }, 200);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, currentTrack, repeat, onNext]);

  useEffect(() => {
    if (currentTrack) {
      setProgress(0);
      setIsPlaying(true);
    }
  }, [currentTrack]);

  const fmt = (pct) => {
    if (!currentTrack) return "0:00";
    const dur = currentTrack.duration || 180;
    const sec = Math.floor((pct / 100) * dur);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const VolIcon =
    muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <div
      className="glass-strong fixed bottom-4 left-4 right-4 z-50 px-5 py-3 flex items-center gap-4"
      style={{ borderRadius: 20, boxShadow: "0 -4px 30px rgba(220,20,60,0.1)" }}
    >
      {/* Track info */}
      <div className="flex items-center gap-3 w-56 shrink-0">
        {currentTrack?.coverArtUrl ? (
          <img
            src={currentTrack.coverArtUrl}
            alt=""
            className="w-12 h-12 rounded-lg object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg crimson-gradient flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {currentTrack?.title?.[0] || "—"}
            </span>
          </div>
        )}
        <div className="overflow-hidden">
          <div className="text-sm font-semibold text-white truncate">
            {currentTrack?.title || "No track selected"}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {currentTrack?.genre || "Select a track from your library"}
          </div>
        </div>
      </div>

      {/* Center controls + waveform */}
      <div className="flex-1 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShuffle(!shuffle)}
            className={`transition-colors ${shuffle ? "text-crimson" : "text-gray-400 hover:text-white"}`}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            onClick={onPrev}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          <ExplodingPlayPause
            isPlaying={isPlaying}
            onToggle={() => setIsPlaying(!isPlaying)}
            disabled={!currentTrack}
          />
          <button
            onClick={onNext}
            className="text-gray-300 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
          <button
            onClick={() => setRepeat(!repeat)}
            className={`transition-colors ${repeat ? "text-crimson" : "text-gray-400 hover:text-white"}`}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>
        {/* Waveform + progress */}
        <div className="flex items-center gap-2 w-full max-w-2xl">
          <span className="text-[10px] text-gray-500 w-8 text-right">
            {fmt(progress)}
          </span>
          <div className="flex-1 h-8 flex items-center gap-[2px] overflow-hidden">
            {Array.from({ length: 60 }).map((_, i) => {
              const active = (i / 60) * 100 < progress;
              const h =
                20 + Math.abs(Math.sin(i * 0.8)) * 60 + Math.random() * 20;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-150"
                  style={{
                    height: `${h}%`,
                    background: active
                      ? "linear-gradient(180deg, #FF1A40, #DC143C)"
                      : "rgba(255,255,255,0.1)",
                    boxShadow: active ? "0 0 4px rgba(220,20,60,0.5)" : "none",
                  }}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-gray-500 w-8">{fmt(100)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 w-40 shrink-0 justify-end">
        <button
          onClick={() => setMuted(!muted)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <VolIcon className="w-5 h-5" />
        </button>
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            setMuted(false);
          }}
          className="crimson-slider flex-1"
        />
      </div>
    </div>
  );
}

function ExplodingPlayPause({ isPlaying, onToggle, disabled }) {
  const [particles, setParticles] = useState([]);

  const handleClick = () => {
    if (disabled) return;
    const newParticles = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2;
      return {
        id: Date.now() + i,
        x: Math.cos(angle) * 30,
        y: Math.sin(angle) * 30,
      };
    });
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 500);
    onToggle();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="relative w-12 h-12 rounded-full crimson-gradient flex items-center justify-center text-white glow-pulse hover:scale-110 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <AnimatePresence mode="wait">
        {isPlaying ? (
          <motion.div
            key="pause"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={{ duration: 0.2 }}
          >
            <Pause className="w-5 h-5" />
          </motion.div>
        ) : (
          <motion.div
            key="play"
            initial={{ scale: 0, rotate: 90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -90 }}
            transition={{ duration: 0.2 }}
          >
            <Play className="w-5 h-5 ml-0.5" />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-crimson pointer-events-none"
            style={{ boxShadow: "0 0 6px rgba(220,20,60,0.8)" }}
          />
        ))}
      </AnimatePresence>
    </button>
  );
}
