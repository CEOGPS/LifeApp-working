// src/components/GlobalMusicPlayer.tsx
// LifeOS1 — persistent bottom music player.
// Reads all state from MusicContext. Renders only when a track is loaded.

import { useRef, useMemo } from "react";
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, Volume1, VolumeX, Music2,
} from "lucide-react";
import { useMusic } from "../lib/MusicContext";

const BAR_COUNT = 48;

export default function GlobalMusicPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    play,
    pause,
    next,
    setVolume,
  } = useMusic();

  const waveformRef = useRef<HTMLDivElement>(null);

  // Deterministic fake waveform. Same track always looks the same.
  const bars = useMemo(() => {
    const seed = currentTrack?.id ?? "none";
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const out: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      h = (h * 1103515245 + 12345) | 0;
      const v = Math.abs(h % 1000) / 1000;
      out.push(0.25 + v * 0.75);
    }
    return out;
  }, [currentTrack?.id]);

  if (!currentTrack) return null;

  const pct = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const playedCount = Math.floor(pct * BAR_COUNT);

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-4 px-4 py-2.5 border-t"
      style={{
        background: "oklch(0.08 0 0 / 92%)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderColor: "oklch(0.55 0.22 20 / 20%)",
      }}
    >
      {/* Track info */}
      <div className="flex items-center gap-3 w-64 shrink-0">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.55 0.22 20 / 40%), oklch(0.35 0.18 20 / 60%))",
          }}
        >
          <Music2 size={18} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white-90 truncate font-display tracking-wide">
            {currentTrack.title}
          </div>
          <div className="text-[10px] text-white-40 truncate">
            {currentTrack.artist || "—"}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => pause()}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white-50 hover:text-white-90 transition-colors"
        >
          <SkipBack size={15} />
        </button>
        <button
          onClick={isPlaying ? pause : () => play()}
          className="w-10 h-10 rounded-full flex items-center justify-center glass-crimson text-primary hover:glow-crimson-sm transition-all"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={next}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white-50 hover:text-white-90 transition-colors"
        >
          <SkipForward size={15} />
        </button>
      </div>

      {/* Waveform + times */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[10px] text-white-40 shrink-0 tabular-nums">
          {fmt(currentTime)}
        </span>
        <div
          ref={waveformRef}
          className="flex-1 h-8 flex items-center gap-[2px] group"
        >
          {bars.map((h, i) => {
            const played = i < playedCount;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors"
                style={{
                  height: `${h * 100}%`,
                  background: played
                    ? "oklch(0.55 0.22 20)"
                    : "oklch(1 0 0 / 0.08)",
                  boxShadow: played
                    ? "0 0 4px oklch(0.55 0.22 20 / 60%)"
                    : "none",
                }}
              />
            );
          })}
        </div>
        <span className="text-[10px] text-white-40 shrink-0 tabular-nums">
          {fmt(duration)}
        </span>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-2 w-40 shrink-0">
        <button
          onClick={() => setVolume(volume === 0 ? 1 : 0)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white-40 hover:text-white-70 transition-colors"
        >
          <VolumeIcon size={14} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-primary cursor-pointer"
        />
      </div>
    </div>
  );
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}