import { useEffect, useMemo, useState } from "react";
import { Music2, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, ListMusic, Check, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useMusic } from "@/lib/MusicContext";
import { usePersistentState } from "@/lib/usePersistentState";
import { TRACKS_KEY, PLAYLISTS_KEY } from "@/pages/music/api/entities";
import type { DBTrack, DBPlaylist } from "@/pages/music/types";
import { safeStringArray } from "@/pages/music/lib/format";

type PlayerTrack = { id: string; title: string; artist: string; url: string; duration: number };

const APP_LINKS = [
  { label: "Music Hub", path: "/music", external: false },
  { label: "Spotify", path: "https://open.spotify.com/", external: true },
  { label: "SoundCloud", path: "https://soundcloud.com/", external: true },
  { label: "Amazon Music", path: "https://music.amazon.com/", external: true },
  { label: "Apple Music", path: "https://music.apple.com/", external: true },
  { label: "Suno", path: "https://suno.com/", external: true },
];

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function toPlayerTrack(t: DBTrack): PlayerTrack | null {
  if (!t.audioFileUrl) return null;
  return {
    id: t.id,
    title: t.title,
    artist: t.gender || "Music Hub",
    url: t.audioFileUrl,
    duration: t.duration || 0,
  };
}

export default function MusicPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    play,
    pause,
    next,
    previous,
    setVolume,
    setPlaylist,
  } = useMusic();

  const [hubTracks] = usePersistentState<DBTrack[]>(TRACKS_KEY, []);
  const [hubPlaylists] = usePersistentState<DBPlaylist[]>(PLAYLISTS_KEY, []);
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [index, setIndex] = useState(0);

  const tracks = useMemo(
    () => hubTracks.map(toPlayerTrack).filter((t): t is PlayerTrack => !!t),
    [hubTracks],
  );

  const playlists = useMemo(
    () =>
      hubPlaylists.filter((pl) => safeStringArray(pl.trackIds).length > 0),
    [hubPlaylists],
  );

  // Keep global queue synced with Music Hub library.
  useEffect(() => {
    if (tracks.length) setPlaylist(tracks);
  }, [tracks, setPlaylist]);

  const track = tracks[index] ?? null;

  const applyPlaylist = (pl: DBPlaylist) => {
    const ids = safeStringArray(pl.trackIds);
    const order = new Map(ids.map((id, i) => [id, i]));
    const queued = tracks
      .filter((t) => order.has(t.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    if (queued.length > 0) {
      setPlaylist(queued);
      setIndex(0);
      play(queued[0]);
    }
    setActivePlaylist(pl.name);
    setShowPlaylists(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      pause();
      return;
    }
    if (currentTrack) {
      play();
      return;
    }
    if (track) play(track);
  };

  const pickNext = () => {
    if (shuffled && tracks.length) {
      const i = Math.floor(Math.random() * tracks.length);
      setIndex(i);
      play(tracks[i]);
      return;
    }
    if (tracks.length) {
      const i = (index + 1) % tracks.length;
      setIndex(i);
      play(tracks[i]);
      return;
    }
    next();
  };

  const pickPrev = () => {
    if (tracks.length) {
      const i = (index - 1 + tracks.length) % tracks.length;
      setIndex(i);
      play(tracks[i]);
      return;
    }
    previous();
  };

  const displayTitle = track?.title || currentTrack?.title || "No track loaded";
  const displayArtist = track?.artist || currentTrack?.artist || "Import tracks in Music Hub";

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg glass-crimson flex items-center justify-center shrink-0 glow-crimson-sm">
          <Music2 size={18} className="text-primary/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white/70 font-medium truncate">{displayTitle}</div>
          <div className="text-[10px] text-white/30 truncate">{displayArtist}</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-white/20">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => setShuffled((s) => !s)}
          className={`transition-colors ${shuffled ? "text-primary" : "text-white/20 hover:text-white/50"}`}
        >
          <Shuffle size={13} />
        </button>
        <button
          onClick={pickPrev}
          disabled={!tracks.length && !currentTrack}
          className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-30"
        >
          <SkipBack size={16} />
        </button>
        <button
          onClick={handleTogglePlay}
          disabled={!track && !currentTrack}
          className="w-9 h-9 rounded-full glass-crimson flex items-center justify-center text-primary hover:glow-crimson-sm transition-all disabled:opacity-40"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={pickNext}
          disabled={!tracks.length && !currentTrack}
          className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-30"
        >
          <SkipForward size={16} />
        </button>
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
          className="text-white/20 hover:text-white/50 transition-colors"
        >
          {volume > 0 ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2">
        <div className="text-[8px] text-white/25 font-display tracking-widest">
          {activePlaylist ? `PLAYING: ${activePlaylist.toUpperCase()}` : "SOURCES"}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {APP_LINKS.map((s) =>
            s.external ? (
              <a
                key={s.label}
                href={s.path}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border border-white/8 text-white/25 hover:border-primary/30 hover:text-primary/50 transition-colors"
              >
                {s.label}
                <ExternalLink size={8} />
              </a>
            ) : (
              <Link
                key={s.label}
                to={s.path}
                className="text-[9px] px-2 py-0.5 rounded-full border border-white/8 text-white/25 hover:border-primary/30 hover:text-primary/50 transition-colors"
              >
                {s.label}
              </Link>
            ),
          )}
          {playlists.length > 0 && (
            <span
              onClick={() => setShowPlaylists((v) => !v)}
              className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                showPlaylists
                  ? "glass-crimson border-primary/40 text-primary"
                  : "border-white/8 text-white/25 hover:border-primary/30 hover:text-primary/50"
              }`}
            >
              <ListMusic size={9} /> PLAYLISTS
            </span>
          )}
        </div>
        {showPlaylists && playlists.length > 0 && (
          <div className="flex flex-col gap-1 max-h-28 overflow-y-auto mt-1">
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => applyPlaylist(pl)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-white/50 hover:bg-white/5 hover:text-white/80 transition-colors text-left"
              >
                {activePlaylist === pl.name && <Check size={9} className="text-primary shrink-0" />}
                {pl.name}
                <span className="ml-auto text-[8px] text-white/25">{safeStringArray(pl.trackIds).length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}