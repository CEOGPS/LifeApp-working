import { db } from "@/lib/veritonDb.ts";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Play, Plus, Search } from "lucide-react";
import TiltCard from "@/pages/veriton/components/TiltCard.jsx";
import GlowChip from "@/pages/veriton/components/GlowChip.jsx";
import { usePlayer } from "@/pages/veriton/lib/PlayerContext.jsx";
import { GENRES } from "@/pages/veriton/lib/generationStore.js";

export default function Library() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState(null);
  const { playTrack } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    db.entities.Track.list("-created_date", 100)
      .then(setTracks)
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tracks.filter((t) => {
    if (search && !t.title?.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (genreFilter && t.genre !== genreFilter) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-display font-bold crimson-text-gradient">
          Library
        </h1>
        <button
          onClick={() => navigate("/create")}
          className="crimson-gradient px-5 py-2.5 rounded-xl text-white font-semibold text-sm flex items-center gap-2 glow-pulse hover:scale-105 transition-transform"
        >
          <Plus className="w-4 h-4" /> New Track
        </button>
      </div>

      <div
        className="glass p-4 mb-6 flex items-center gap-3"
        style={{ borderRadius: 16 }}
      >
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your library..."
            className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-sm text-white placeholder-gray-500 outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {GENRES.slice(0, 5).map((g) => (
            <GlowChip
              key={g}
              label={g}
              selected={genreFilter === g}
              onClick={() => setGenreFilter(genreFilter === g ? null : g)}
            />
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="glass p-3 h-52 animate-pulse"
              style={{ borderRadius: 18 }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((track, i) => (
            <TiltCard
              key={track.id}
              className="p-3 group"
              onClick={() => navigate(`/track/${track.id}`)}
            >
              <div
                className="relative aspect-square rounded-xl mb-2 overflow-hidden flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${(i * 40) % 360}, 70%, 30%), #050505)`,
                }}
              >
                <span className="text-white/30 font-display font-bold text-4xl">
                  {track.title?.[0]?.toUpperCase()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playTrack(track, filtered);
                  }}
                  className="absolute bottom-2 right-2 w-9 h-9 rounded-full crimson-gradient flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Play className="w-4 h-4 ml-0.5" />
                </button>
              </div>
              <h3 className="font-semibold text-white text-xs truncate">
                {track.title}
              </h3>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>{track.genre}</span>
                <span>{track.bpm || 120} BPM</span>
              </div>
            </TiltCard>
          ))}
        </div>
      )}
    </div>
  );
}
