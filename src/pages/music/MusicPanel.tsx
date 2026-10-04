// src/pages/music/MusicPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Music2, ExternalLink } from "lucide-react";
import { PanelLayout } from "./components/PanelLayout";
import { ErrorBanner } from "./components/ErrorBanner";
import { LibraryTab } from "./components/LibraryTab";
import { PlaylistsTab } from "./components/PlaylistTab";
import { TrackEntity, PlaylistEntity } from "./api/entities";
import { useMusic } from "./api/playerStore";
import { MUSIC_APP_LINKS } from "./constants";
import { HubPlayerBar } from "./components/HubPlayerBar";
import type { Tab, DBTrack, DBPlaylist } from "./types";

const TABS: Tab[] = ["library", "playlists"];

export default function MusicPanel() {
  const [tab, setTab] = useState<Tab>("library");
  const [songs, setSongs] = useState<DBTrack[]>([]);
  const [playlists, setPlaylists] = useState<DBPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback((): Promise<void> => {
    // Local-only list — completes in the same turn. Always clear loading.
    setLoading(true);
    setError(null);
    return Promise.resolve()
      .then(async () => {
        const [rawTracks, rawPlaylists] = await Promise.all([
          TrackEntity.list("-created_at", 300),
          PlaylistEntity.list("-created_at", 300),
        ]);
        if (!mountedRef.current) return;
        setSongs(Array.isArray(rawTracks) ? rawTracks : []);
        setPlaylists(Array.isArray(rawPlaylists) ? rawPlaylists : []);
      })
      .catch((e) => {
        if (mountedRef.current) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Feed the global player queue whenever the library changes.
  const { setTracks } = useMusic();
  useEffect(() => {
    const playable = songs
      .filter((s) => !!s.audioFileUrl)
      .map((s) => ({
        id: s.id,
        title: s.title,
        audioFileUrl: s.audioFileUrl ?? undefined,
        artist: s.gender ?? undefined,
        genre: s.genre ?? undefined,
        thumbnailUrl: s.coverArtUrl ?? undefined,
        durationSec: s.duration ?? undefined,
      }));
    setTracks(playable);
  }, [songs, setTracks]);

  const addTrack = useCallback((t: DBTrack) => {
    setSongs((prev) => prev.some((x) => x.id === t.id) ? prev : [t, ...prev]);
  }, []);
  const addPlaylist = useCallback((p: DBPlaylist) => {
    setPlaylists((prev) => prev.some((x) => x.id === p.id) ? prev : [p, ...prev]);
  }, []);
  const removePlaylist = useCallback((id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setOpenPlaylistId((cur) => (cur === id ? null : cur));
  }, []);
  const updatePlaylist = useCallback((p: DBPlaylist) => {
    setPlaylists((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  }, []);

  const tabActions = useMemo(() => (
    <div className="flex gap-1.5">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => { setTab(t); setOpenPlaylistId(null); }}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-display tracking-wider transition-colors ${
            tab === t ? "glass-crimson text-primary" : "glass text-white-40 hover:text-white-80"
          }`}
        >
          {t.toUpperCase()}
        </button>
      ))}
    </div>
  ), [tab]);

  return (
    <PanelLayout
      title="Music Hub"
      subtitle="Library · Playlists · Apps"
      icon={<Music2 size={18} />}
      actions={tabActions}
    >
      <div className="h-full flex flex-col min-h-0 gap-3">
        {error && <ErrorBanner message={error} onRetry={refresh} />}

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[9px] font-display tracking-widest text-white-30 uppercase mr-1">Apps</span>
          {MUSIC_APP_LINKS.map((app) => (
            <a
              key={app.id}
              href={app.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white-8 text-[10px] text-white-55 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: app.color }} />
              {app.label}
              <ExternalLink size={9} className="opacity-50" />
            </a>
          ))}
        </div>

        {tab === "library" && (
          <LibraryTab
            loading={loading}
            songs={songs}
            onTrackAdded={addTrack}
            playlists={playlists}
            onRefresh={refresh}
          />
        )}

        {tab === "playlists" && (
          <PlaylistsTab
            loading={loading}
            playlists={playlists}
            onPlaylistCreated={addPlaylist}
            onPlaylistDeleted={removePlaylist}
            onPlaylistUpdated={updatePlaylist}
            songs={songs}
            openPlaylistId={openPlaylistId}
            setOpenPlaylistId={setOpenPlaylistId}
          />
        )}

        <HubPlayerBar />
      </div>
    </PanelLayout>
  );
}