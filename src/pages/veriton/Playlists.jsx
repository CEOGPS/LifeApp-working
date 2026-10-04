import { db } from "@/lib/veritonDb.ts";
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { Plus, Play, Music, Trash2, GripVertical } from "lucide-react";
import TiltCard from "@/pages/veriton/components/TiltCard.jsx";
import { usePlayer } from "@/pages/veriton/lib/PlayerContext.jsx";
import { motion, AnimatePresence } from "motion/react";

const PLAYLIST_COLORS = [
  "#DC143C",
  "#FF1A40",
  "#800020",
  "#B22222",
  "#C71585",
  "#8B0000",
];

export default function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [activePlaylist, setActivePlaylist] = useState(null);
  const { playTrack } = usePlayer();
  const navigate = useNavigate();

  const loadAll = useCallback(async () => {
    try {
      const [pls, trks] = await Promise.all([
        db.entities.Playlist.list("-created_date", 50).catch(() => []),
        db.entities.Track.list("-created_date", 100).catch(() => []),
      ]);
      setPlaylists(pls);
      setTracks(trks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    try {
      const pl = await db.entities.Playlist.create({
        name: newName,
        color: PLAYLIST_COLORS[playlists.length % PLAYLIST_COLORS.length],
        trackIds: [],
        coverMosaicUrls: [],
      });
      setPlaylists([pl, ...playlists]);
      setNewName("");
      setCreating(false);
    } catch (e) {
      console.error(e);
    }
  };

  const deletePlaylist = async (id) => {
    try {
      await db.entities.Playlist.delete(id);
      setPlaylists(playlists.filter((p) => p.id !== id));
      if (activePlaylist?.id === id) setActivePlaylist(null);
    } catch (e) {
      console.error(e);
    }
  };

  const removeTrack = async (plId, trackId) => {
    const pl = playlists.find((p) => p.id === plId);
    if (!pl) return;
    const newIds = (pl.trackIds || []).filter((id) => id !== trackId);
    await db.entities.Playlist.update(plId, { trackIds: newIds });
    setPlaylists(
      playlists.map((p) => (p.id === plId ? { ...p, trackIds: newIds } : p)),
    );
    if (activePlaylist?.id === plId)
      setActivePlaylist({ ...pl, trackIds: newIds });
  };

  const playlistTracks = (pl) =>
    (pl.trackIds || [])
      .map((id) => tracks.find((t) => t.id === id))
      .filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display font-bold crimson-text-gradient">
          Playlists
        </h1>
        <button
          onClick={() => setCreating(true)}
          className="crimson-gradient px-5 py-2.5 rounded-xl text-white font-semibold text-sm flex items-center gap-2 glow-pulse hover:scale-105 transition-transform"
        >
          <Plus className="w-4 h-4" /> New Playlist
        </button>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setCreating(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-strong p-8 w-full max-w-md"
              style={{ borderRadius: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-white mb-4">
                Create Playlist
              </h2>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
                placeholder="Playlist name (e.g. Chill Beats)"
                className="w-full px-4 py-3 glass rounded-xl text-white placeholder-gray-500 outline-none focus:border-crimson/30 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={createPlaylist}
                  className="flex-1 crimson-gradient py-3 rounded-xl text-white font-semibold"
                >
                  Create
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="px-6 glass rounded-xl text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlist grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="glass h-64 animate-pulse"
              style={{ borderRadius: 20 }}
            />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div
          className="glass-strong p-16 text-center"
          style={{ borderRadius: 24 }}
        >
          <Music className="w-16 h-16 text-crimson/50 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            No playlists yet
          </h2>
          <p className="text-gray-400 mb-6">
            Create folders to organize your tracks
          </p>
          <button
            onClick={() => setCreating(true)}
            className="crimson-gradient px-6 py-3 rounded-xl text-white font-semibold"
          >
            Create Your First Playlist
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {playlists.map((pl, i) => {
              const plsTracks = playlistTracks(pl);
              return (
                <TiltCard
                  key={pl.id}
                  className="p-5"
                  onClick={() => setActivePlaylist(pl)}
                >
                  <div
                    className="relative aspect-video rounded-2xl mb-4 overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${pl.color || "#DC143C"}55, #050505)`,
                    }}
                  >
                    <div className="grid grid-cols-2 gap-1 p-2 h-full">
                      {plsTracks.slice(0, 4).map((t, j) => (
                        <div
                          key={t.id}
                          className="rounded-lg flex items-center justify-center"
                          style={{
                            background: `hsl(${(j * 60 + i * 40) % 360}, 50%, 25%)`,
                          }}
                        >
                          <span className="text-white/40 font-bold text-lg">
                            {t.title?.[0]}
                          </span>
                        </div>
                      ))}
                      {plsTracks.length === 0 && (
                        <div className="flex items-center justify-center text-gray-600 text-xs col-span-2">
                          Empty playlist
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-white">{pl.name}</h3>
                      <p className="text-xs text-gray-500">
                        {plsTracks.length} tracks
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlaylist(pl.id);
                      }}
                      className="text-gray-500 hover:text-crimson p-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </TiltCard>
              );
            })}
          </div>

          {/* Active playlist detail */}
          <AnimatePresence>
            {activePlaylist && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-strong p-6 mb-8 overflow-hidden"
                style={{ borderRadius: 24 }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">
                    {activePlaylist.name}
                  </h2>
                  <button
                    onClick={() => setActivePlaylist(null)}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2">
                  {playlistTracks(activePlaylist).map((t, idx) => (
                    <div
                      key={t.id}
                      className="glass p-3 rounded-xl flex items-center gap-3 group"
                      style={{ borderRadius: 14 }}
                    >
                      <GripVertical className="w-4 h-4 text-gray-600 cursor-grab" />
                      <span className="text-gray-500 text-xs w-6">
                        {idx + 1}
                      </span>
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, hsl(${idx * 40}, 60%, 30%), #050505)`,
                        }}
                      >
                        <span className="text-white/40 font-bold text-sm">
                          {t.title?.[0]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white">
                          {t.title}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {t.genre} · {t.bpm} BPM
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          playTrack(t, playlistTracks(activePlaylist))
                        }
                        className="w-9 h-9 rounded-full crimson-gradient flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="w-4 h-4 ml-0.5" />
                      </button>
                      <button
                        onClick={() => removeTrack(activePlaylist.id, t.id)}
                        className="text-gray-500 hover:text-crimson p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {playlistTracks(activePlaylist).length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      Drag tracks here or add from your library
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
