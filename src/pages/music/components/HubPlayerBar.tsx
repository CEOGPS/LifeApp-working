// src/pages/music/components/HubPlayerBar.tsx
// Bottom Music Hub player — cyberpunk neon controls wired to MusicContext.

import { useMemo, useState } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Volume2, VolumeX,
  Rewind, FastForward, Music2,
} from "lucide-react";
import { useMusic } from "../api/playerStore";
import { fmtTime } from "../lib/format";

const SEEK_STEP = 10;
const BAR_COUNT = 40;

export function HubPlayerBar() {
  const {
    currentTrack,
    playing,
    togglePlay,
    next,
    previous,
    shuffle,
    volume,
    setVolume,
    currentTime,
    duration,
    seek,
    queue,
  } = useMusic();

  const [shuffled, setShuffled] = useState(false);

  const bars = useMemo(() => {
    const seed = currentTrack?.id ?? "idle";
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    const out: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      h = (h * 1103515245 + 12345) | 0;
      out.push(0.2 + (Math.abs(h % 1000) / 1000) * 0.8);
    }
    return out;
  }, [currentTrack?.id]);

  const pct = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const playedBars = Math.floor(pct * BAR_COUNT);
  const hasTrack = !!currentTrack;
  const muted = volume <= 0.001;

  const handleShuffle = () => {
    shuffle();
    setShuffled((v) => !v);
  };

  const seekBack = () => seek(Math.max(0, currentTime - SEEK_STEP));
  const seekFwd = () => seek(Math.min(duration || currentTime + SEEK_STEP, currentTime + SEEK_STEP));

  const onSeekBar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seek(x * duration);
  };

  return (
    <div
      className="shrink-0 rounded-xl border overflow-hidden"
      style={{
        borderColor: "oklch(0.55 0.22 20 / 25%)",
        background:
          "linear-gradient(180deg, oklch(0.12 0.03 280 / 90%), oklch(0.08 0.02 20 / 95%))",
        boxShadow: "0 0 24px oklch(0.55 0.22 20 / 12%), inset 0 1px 0 oklch(1 0 0 / 4%)",
      }}
    >
      {/* Waveform / progress */}
      <div className="px-4 pt-3 pb-1">
        <div
          className="h-10 flex items-end gap-[2px] cursor-pointer group"
          onClick={onSeekBar}
          role="slider"
          aria-valuenow={Math.floor(currentTime)}
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration || 0)}
          aria-label="Seek"
        >
          {bars.map((h, i) => {
            const played = i < playedBars;
            const active = playing && Math.abs(i - playedBars) < 2;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors"
                style={{
                  height: `${h * 100}%`,
                  background: played
                    ? active
                      ? "oklch(0.75 0.18 195)"
                      : "oklch(0.55 0.22 20)"
                    : "oklch(1 0 0 / 0.08)",
                  boxShadow: played
                    ? `0 0 6px ${active ? "oklch(0.75 0.18 195 / 70%)" : "oklch(0.55 0.22 20 / 50%)"}`
                    : "none",
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-white-30 tabular-nums mt-1 px-0.5">
          <span>{fmtTime(currentTime)}</span>
          <span>{fmtTime(duration)}</span>
        </div>
      </div>

      {/* Title + controls */}
      <div className="px-4 pb-3 flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.55 0.22 20 / 45%), oklch(0.45 0.16 300 / 50%))",
            boxShadow: playing ? "0 0 14px oklch(0.55 0.22 20 / 40%)" : "none",
          }}
        >
          <Music2 size={18} className="text-primary" />
        </div>

        <div className="min-w-0 w-36 shrink-0">
          <div className="text-xs text-white-90 truncate font-display tracking-wide">
            {currentTrack?.title || "No track selected"}
          </div>
          <div className="text-[10px] text-white-40 truncate">
            {currentTrack?.artist || (queue.length ? `${queue.length} in queue` : "Pick a song from the library")}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2">
          <IconBtn
            label="Shuffle"
            active={shuffled}
            onClick={handleShuffle}
            disabled={!queue.length}
          >
            <Shuffle size={14} />
          </IconBtn>
          <IconBtn label="Previous" onClick={previous} disabled={!queue.length && !hasTrack}>
            <SkipBack size={16} />
          </IconBtn>
          <IconBtn label="Rewind 10s" onClick={seekBack} disabled={!hasTrack}>
            <Rewind size={15} />
          </IconBtn>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasTrack && !queue.length}
            aria-label={playing ? "Pause" : "Play"}
            className="w-11 h-11 rounded-full flex items-center justify-center glass-crimson text-primary hover:glow-crimson-sm transition-all disabled:opacity-40 shrink-0"
            style={{
              boxShadow: playing
                ? "0 0 18px oklch(0.55 0.22 20 / 55%), 0 0 4px oklch(0.75 0.18 195 / 40%)"
                : undefined,
            }}
          >
            {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          <IconBtn label="Forward 10s" onClick={seekFwd} disabled={!hasTrack}>
            <FastForward size={15} />
          </IconBtn>
          <IconBtn label="Next" onClick={next} disabled={!queue.length && !hasTrack}>
            <SkipForward size={16} />
          </IconBtn>
        </div>

        <div className="hidden sm:flex items-center gap-2 w-32 shrink-0">
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setVolume(muted ? 0.8 : 0)}
            className="text-white-40 hover:text-white-80 transition-colors"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-primary cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  disabled,
  label,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
        active ? "text-primary bg-primary/10" : "text-white-50 hover:text-white-90 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}