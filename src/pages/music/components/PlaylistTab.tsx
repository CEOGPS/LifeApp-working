// src/pages/music/tabs/PlaylistsTab.tsx
import { useCallback, useMemo, useState } from "react";
import { Plus, ListMusic, Loader2, Trash2, Play } from "lucide-react";
import { PlaylistEntity } from "../api/entities";
import { useMusic } from "../api/playerStore";
import { safeStringArray } from "../lib/format";
import { TrackRow } from "../components/TrackRow";
import { EmptyState } from "../components/EmptyState";
import type { DBTrack, DBPlaylist } from "../types";

interface Props {
  loading: boolean;
  playlists: DBPlaylist[];
  onPlaylistCreated: (p: DBPlaylist) => void;
  onPlaylistDeleted: (id: string) => void;
  onPlaylistUpdated: (p: DBPlaylist) => void;
  songs: DBTrack[];
  openPlaylistId: string | null;
  setOpenPlaylistId: (id: string | null) => void;
}

export function PlaylistsTab({
  loading, playlists, onPlaylistCreated, onPlaylistDeleted, onPlaylistUpdated,
  songs, openPlaylistId, setOpenPlaylistId,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { applyPlaylist } = useMusic();

  const openPlaylist = useMemo(
    () => playlists.find((p) => p.id === openPlaylistId) ?? null,
    [playlists, openPlaylistId],
  );

  const createPlaylist = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const row = await PlaylistEntity.create({ name, trackIds: [], coverMosaicUrls: [] });
      if (row) onPlaylistCreated(row);
    } catch (e) {
      console.warn("[music] create playlist failed:", e);
    }
    setNewName("");
    setCreating(false);
  }, [newName, onPlaylistCreated]);

  const deletePlaylist = useCallback(
    async (id: string) => {
      try {
        await PlaylistEntity.delete(id);
        onPlaylistDeleted(id);
        if (openPlaylistId === id) setOpenPlaylistId(null);
      } catch (e) {
        console.warn("[music] delete playlist failed:", e);
      }
      setConfirmDeleteId(null);
    },
    [onPlaylistDeleted, openPlaylistId, setOpenPlaylistId],
  );

  const updateTrackIds = useCallback(
    async (playlistId: string, ids: string[]) => {
      const pl = playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      onPlaylistUpdated({ ...pl, trackIds: ids });
      try {
        await PlaylistEntity.update(playlistId, { trackIds: ids });
      } catch (e) {
        console.warn("[music] update playlist failed:", e);
      }
    },
    [playlists, onPlaylistUpdated],
  );

  if (openPlaylist) {
    const ids = safeStringArray(openPlaylist.trackIds);
    const plTracks = ids
      .map((id) => songs.find((s) => s.id === id))
      .filter((s): s is DBTrack => !!s);

    return (
      <div className="flex-1 min-h-0 flex flex-col glass rounded-xl border border-white-8 overflow-hidden">
        <div className="p-3 border-b border-white-5 flex items-center gap-3">
          <button onClick={() => setOpenPlaylistId(null)} className="text-[11px] text-teal hover:text-white transition-colors">
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-display text-white-90 truncate">{openPlaylist.name}</div>
            <div className="text-[10px] text-white-30">{plTracks.length} tracks</div>
          </div>
          <button
            onClick={() => applyPlaylist(plTracks.map((t) => t.id))}
            disabled={plTracks.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider hover:glow-crimson-sm disabled:opacity-40 transition-all"
          >
            <Play size={11} /> PLAY PLAYLIST
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {plTracks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="text-sm text-white-30">Empty playlist. Add tracks from the Library tab.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {plTracks.map((t) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  playlists={playlists}
                  onRemoveFromPlaylist={() => updateTrackIds(openPlaylist.id, ids.filter((x) => x !== t.id))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col glass rounded-xl border border-white-8 overflow-hidden">
      <div className="p-3 border-b border-white-5 flex items-center">
        <span className="text-[10px] font-display tracking-widest text-teal uppercase">Playlists</span>
        <button
          onClick={() => setCreating(true)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider hover:glow-crimson-sm transition-all"
        >
          <Plus size={11} /> NEW PLAYLIST
        </button>
      </div>

      {creating && (
        <div className="px-3 py-2 border-b border-white-5 flex gap-2 items-center">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
            placeholder="Playlist name…"
            className="flex-1 h-8 px-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
          />
          <button onClick={createPlaylist} className="px-3 h-8 rounded-lg glass-crimson text-primary text-[11px] font-display">
            CREATE
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(""); }}
            className="px-3 h-8 rounded-lg glass text-white-50 text-[11px]"
          >
            CANCEL
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={20} className="animate-spin text-white-30" />
          </div>
        ) : playlists.length === 0 ? (
          <EmptyState icon={ListMusic} title="No playlists yet" hint='Click "New Playlist" to create one.' />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {playlists.map((p) => {
              const count = safeStringArray(p.trackIds).length;
              return (
                <div
                  key={p.id}
                  onClick={() => setOpenPlaylistId(p.id)}
                  className="glass rounded-xl border border-white-8 p-3 flex flex-col gap-2 hover:border-primary/30 transition-colors cursor-pointer group"
                >
                  <div className="aspect-square rounded-lg bg-[#0d0e17] flex items-center justify-center">
                    <ListMusic size={28} className="text-white-15" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white-85 truncate">{p.name}</div>
                      <div className="text-[10px] text-white-30">{count} tracks</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                      className="opacity-0 group-hover:opacity-100 text-white-30 hover:text-crimson transition-all"
                      aria-label="Delete playlist"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="glass rounded-xl border border-crimson/30 bg-[#0d0e17] p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm text-white-90 mb-2">Delete playlist?</div>
            <div className="text-[11px] text-white-40 mb-4">Songs are not deleted.</div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-3 py-1.5 rounded-lg glass text-white-55 text-[11px]"
              >
                CANCEL
              </button>
              <button
                onClick={() => deletePlaylist(confirmDeleteId)}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}