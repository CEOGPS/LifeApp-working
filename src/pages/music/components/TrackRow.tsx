// src/pages/music/components/TrackRow.tsx
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Play, Pause, Loader2, MoreHorizontal, ExternalLink, ListMusic, Plus, X, AlertCircle,
} from "lucide-react";
import { STREAMING_SERVICES } from "../constants";
import { useMusic } from "../api/playerStore";
import { fmtTime, safeStringArray } from "../lib/format";
import { PlaylistEntity } from "../api/entities";
import type { DBTrack, DBPlaylist } from "../types";

export interface TrackRowProps {
  track: DBTrack;
  playlists: DBPlaylist[];
  onRemoveFromPlaylist?: () => void;
  onPlaylistUpdated?: () => void;
}

function rowToPlayer(track: DBTrack) {
  return {
    id: track.id,
    title: track.title,
    audioFileUrl: track.audioFileUrl ?? undefined,
    artist: track.gender ?? undefined,
    genre: track.genre ?? undefined,
    thumbnailUrl: track.coverArtUrl ?? undefined,
    durationSec: track.duration ?? undefined,
  };
}

export const TrackRow = memo(function TrackRow({
  track, playlists, onRemoveFromPlaylist, onPlaylistUpdated,
}: TrackRowProps) {
  const { currentTrack, playing, playTrack, togglePlay, addToQueue } = useMusic();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrent = currentTrack?.id === track.id;
  const isThisPlaying = isCurrent && playing;
  const isGenerating = track.status === "generating";
  const isFailed = track.status === "failed";

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const handlePlay = useCallback(() => {
    if (!track.audioFileUrl || isGenerating || isFailed) return;
    if (isCurrent) togglePlay();
    else playTrack(rowToPlayer(track));
  }, [track, isCurrent, isGenerating, isFailed, playTrack, togglePlay]);

  const addToPlaylist = useCallback(
    async (playlistId: string) => {
      const pl = playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      const ids = safeStringArray(pl.trackIds);
      if (ids.includes(track.id)) { setMenuOpen(false); return; }
      try {
        await PlaylistEntity.update(playlistId, { trackIds: [...ids, track.id] });
        onPlaylistUpdated?.();
      } catch (e) {
        console.warn("[music] add to playlist failed:", e);
      }
      setMenuOpen(false);
    },
    [playlists, track.id, onPlaylistUpdated],
  );

  const handleAddToQueue = useCallback(() => {
    addToQueue(rowToPlayer(track));
    setMenuOpen(false);
  }, [addToQueue, track]);

  return (
    <div
      className={`flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors ${
        isCurrent ? "bg-crimson/8 border border-crimson/20" : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <button
        onClick={handlePlay}
        disabled={!track.audioFileUrl || isGenerating || isFailed}
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden disabled:opacity-40 transition-opacity"
        style={{
          background: track.coverArtUrl
            ? `url(${track.coverArtUrl}) center/cover`
            : isCurrent
              ? "linear-gradient(135deg, oklch(0.55 0.22 20 / 40%), oklch(0.35 0.18 20 / 60%))"
              : "oklch(1 0 0 / 0.04)",
        }}
        aria-label={isThisPlaying ? "Pause" : "Play"}
      >
        {isGenerating ? <Loader2 size={14} className="animate-spin text-primary" />
          : isFailed ? <AlertCircle size={14} className="text-crimson" />
          : isThisPlaying ? <Pause size={14} className="text-primary" />
          : <Play size={14} className={isCurrent ? "text-primary" : "text-white-50"} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-xs truncate ${isCurrent ? "text-primary" : "text-white-85"}`}>
          {track.title}
        </div>
        <div className="text-[10px] text-white-30 truncate">
          {isFailed ? "Generation failed" : track.genre || "—"}
          {!isFailed && track.bpm ? ` · ${track.bpm} BPM` : ""}
          {!isFailed && track.duration ? ` · ${fmtTime(track.duration)}` : ""}
        </div>
      </div>

      {track.duration && !isFailed ? (
        <div className="text-[10px] text-white-30 shrink-0">{fmtTime(track.duration)}</div>
      ) : null}

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white-30 hover:text-white-70 hover:bg-white/5 transition-colors"
          aria-label="More actions"
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-white-10 bg-[#0d0e17] shadow-xl overflow-hidden"
            style={{ backdropFilter: "blur(12px)" }}
          >
            <div className="px-3 py-2 text-[9px] font-display tracking-widest text-teal uppercase border-b border-white-5">
              Listen on
            </div>
            {STREAMING_SERVICES.map((svc) => (
              <a
                key={svc.id}
                href={svc.search(track.title)}
                target="_blank"
                rel="noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-white-70 hover:bg-white/5 transition-colors"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: svc.color }} />
                <span className="flex-1">{svc.label}</span>
                <ExternalLink size={10} className="text-white-30" />
              </a>
            ))}

            {playlists.length > 0 && (
              <>
                <div className="px-3 py-2 text-[9px] font-display tracking-widest text-teal uppercase border-y border-white-5">
                  Add to playlist
                </div>
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => addToPlaylist(pl.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white-70 hover:bg-white/5 transition-colors text-left"
                  >
                    <ListMusic size={10} className="text-white-30 shrink-0" />
                    <span className="flex-1 truncate">{pl.name}</span>
                  </button>
                ))}
              </>
            )}

            <div className="border-t border-white-5">
              <button
                onClick={handleAddToQueue}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white-70 hover:bg-white/5 transition-colors text-left"
              >
                <Plus size={10} className="text-white-30 shrink-0" /> Add to queue
              </button>
              {onRemoveFromPlaylist && (
                <button
                  onClick={() => { onRemoveFromPlaylist(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-crimson/90 hover:bg-crimson/8 transition-colors text-left"
                >
                  <X size={10} className="shrink-0" /> Remove from playlist
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});