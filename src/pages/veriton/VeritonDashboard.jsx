import { db } from "@/lib/veritonDb.ts";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Search,
  Filter,
  Play,
  Pencil,
  TrendingUp,
  Clock,
  Music,
  Zap,
  Film,
  Loader2,
  CheckCircle2,
  Radio,
  Clapperboard,
  Plus,
  Disc3,
  Video,
} from "lucide-react";
import TiltCard from "@/pages/veriton/components/TiltCard.jsx";
import GlowChip from "@/pages/veriton/components/GlowChip.jsx";
import { usePlayer } from "@/pages/veriton/lib/PlayerContext.jsx";
import { GENRES, VOICE_TYPES } from "@/pages/veriton/lib/generationStore.js";
import { motion, AnimatePresence } from "motion/react";

const COVER_GRADIENTS = [
  "linear-gradient(135deg, #DC143C, #2A2A2A)",
  "linear-gradient(135deg, #FF1A40, #050505)",
  "linear-gradient(135deg, #800020, #1A0A0A)",
  "linear-gradient(135deg, #B22222, #2A2A2A)",
  "linear-gradient(135deg, #C71585, #0A0A0A)",
  "linear-gradient(135deg, #DC143C, #4A0A1A)",
];

const TRACK_STATUSES = {
  generating: {
    label: "Generating",
    icon: Loader2,
    color: "#FFD700",
    pulse: true,
    spin: true,
  },
  ready: { label: "Ready", icon: CheckCircle2, color: "#00E676", pulse: false },
  published: { label: "Published", icon: Radio, color: "#FF1A40", pulse: true },
};

const VIDEO_STATUSES = {
  rendering: {
    label: "Rendering",
    icon: Loader2,
    color: "#FFD700",
    pulse: true,
    spin: true,
  },
  ready: { label: "Ready", icon: CheckCircle2, color: "#00E676", pulse: false },
  published: { label: "Published", icon: Radio, color: "#FF1A40", pulse: true },
};

const MODE_LABELS = {
  "text-to-video": "Text→Video",
  "photo-animation": "Photo+Song",
  template: "Template",
  "auto-pilot": "Auto-Pilot",
};

export default function Dashboard() {
  const [tracks, setTracks] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState(null);
  const [voiceFilter, setVoiceFilter] = useState(null);
  const [dateFilter, setDateFilter] = useState(null);
  const [activeTab, setActiveTab] = useState("tracks");
  const { playTrack } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      db.entities.Track.list("-created_date", 50).catch(() => []),
      db.entities.VideoProject.list("-created_date", 50).catch(() => []),
    ])
      .then(([t, v]) => {
        setTracks(t);
        setVideos(v);
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh to catch status transitions (generating -> ready)
  useEffect(() => {
    const hasPending =
      tracks.some((t) => t.status === "generating") ||
      videos.some((v) => v.status === "rendering");
    if (!hasPending) return;
    const interval = setInterval(() => {
      Promise.all([
        db.entities.Track.list("-created_date", 50).catch(() => []),
        db.entities.VideoProject.list("-created_date", 50).catch(() => []),
      ]).then(([t, v]) => {
        setTracks(t);
        setVideos(v);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [tracks, videos]);

  const filteredTracks = useMemo(
    () =>
      tracks.filter((t) => {
        if (search && !t.title?.toLowerCase().includes(search.toLowerCase()))
          return false;
        if (genreFilter && t.genre !== genreFilter) return false;
        if (voiceFilter && !(t.voiceTypes || []).includes(voiceFilter))
          return false;
        if (dateFilter) {
          const d = new Date(t.created_date || Date.now());
          const now = new Date();
          const diff = (now - d) / (1000 * 60 * 60 * 24);
          if (dateFilter === "today" && diff > 1) return false;
          if (dateFilter === "week" && diff > 7) return false;
          if (dateFilter === "month" && diff > 30) return false;
        }
        return true;
      }),
    [tracks, search, genreFilter, voiceFilter, dateFilter],
  );

  const pendingTracks = filteredTracks.filter((t) => t.status === "generating");
  const readyTracks = filteredTracks.filter((t) => t.status !== "generating");
  const pendingVideos = videos.filter((v) => v.status === "rendering");
  const readyVideos = videos.filter((v) => v.status !== "rendering");

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero header */}
      <div className="glass-strong p-6 mb-6" style={{ borderRadius: 24 }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold crimson-text-gradient mb-1">
              Dashboard
            </h1>
            <p className="text-gray-400 text-sm">
              Your creative command center — live production status
            </p>
          </div>
          <div className="flex gap-6">
            <StatCard icon={Disc3} label="Total Tracks" value={tracks.length} />
            <StatCard
              icon={TrendingUp}
              label="Published"
              value={tracks.filter((t) => t.status === "published").length}
            />
            <StatCard
              icon={Video}
              label="Video Projects"
              value={videos.length}
            />
            <StatCard
              icon={Clock}
              label="In Production"
              value={pendingTracks.length + pendingVideos.length}
            />
          </div>
        </div>
      </div>

      {/* Generator CTA banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => navigate("/create")}
          className="glass-strong glass-hover p-5 flex items-center gap-4 group text-left"
          style={{ borderRadius: 20 }}
        >
          <div className="w-14 h-14 rounded-2xl crimson-gradient flex items-center justify-center glow-pulse shrink-0">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Generate Music</h3>
            <p className="text-xs text-gray-500">
              Lyrics → AI song with vocals, genre & BPM
            </p>
          </div>
          <Plus className="w-5 h-5 text-crimson group-hover:scale-125 transition-transform" />
        </button>
        <button
          onClick={() => navigate("/video-studio")}
          className="glass-strong glass-hover p-5 flex items-center gap-4 group text-left"
          style={{ borderRadius: 20 }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #800020, #050505)",
              boxShadow: "0 0 20px rgba(220,20,60,0.3)",
            }}
          >
            <Film className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-white">Create Video</h3>
            <p className="text-xs text-gray-500">
              Turn a track into a cinematic 4K music video
            </p>
          </div>
          <Plus className="w-5 h-5 text-crimson group-hover:scale-125 transition-transform" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("tracks")}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "tracks" ? "crimson-gradient text-white glow-pulse" : "glass text-gray-400 hover:text-white"}`}
        >
          <Music className="w-4 h-4" /> Tracks ({tracks.length})
        </button>
        <button
          onClick={() => setActiveTab("videos")}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "videos" ? "crimson-gradient text-white glow-pulse" : "glass text-gray-400 hover:text-white"}`}
        >
          <Clapperboard className="w-4 h-4" /> Video Projects ({videos.length})
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "tracks" ? (
          <motion.div
            key="tracks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Filters */}
            <div className="glass p-4 mb-6" style={{ borderRadius: 16 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tracks..."
                    className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-sm text-white placeholder-gray-500 outline-none focus:border-crimson/30"
                  />
                </div>
                <Filter className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex flex-wrap gap-2">
                {GENRES.slice(0, 6).map((g) => (
                  <GlowChip
                    key={g}
                    label={g}
                    selected={genreFilter === g}
                    onClick={() => setGenreFilter(genreFilter === g ? null : g)}
                  />
                ))}
                <span className="w-px h-8 bg-white/10 mx-1" />
                {VOICE_TYPES.slice(0, 4).map((v) => (
                  <GlowChip
                    key={v}
                    label={v}
                    selected={voiceFilter === v}
                    onClick={() => setVoiceFilter(voiceFilter === v ? null : v)}
                  />
                ))}
                <span className="w-px h-8 bg-white/10 mx-1" />
                {[
                  { k: "today", label: "Today" },
                  { k: "week", label: "This Week" },
                  { k: "month", label: "This Month" },
                ].map((d) => (
                  <GlowChip
                    key={d.k}
                    label={d.label}
                    selected={dateFilter === d.k}
                    onClick={() =>
                      setDateFilter(dateFilter === d.k ? null : d.k)
                    }
                  />
                ))}
              </div>
            </div>

            {/* In production section */}
            {pendingTracks.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-crimson animate-spin" /> In
                  Production
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {pendingTracks.map((track, i) => (
                    <TiltCard
                      key={track.id}
                      className="p-4"
                      onClick={() => navigate(`/track/${track.id}`)}
                    >
                      <div
                        className="relative aspect-square rounded-2xl mb-3 overflow-hidden flex items-center justify-center"
                        style={{
                          background:
                            COVER_GRADIENTS[i % COVER_GRADIENTS.length],
                        }}
                      >
                        <div className="absolute inset-0 animate-shimmer" />
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                      <h3 className="font-semibold text-white text-sm truncate">
                        {track.title}
                      </h3>
                      <StatusBadge
                        status={
                          TRACK_STATUSES[track.status] ||
                          TRACK_STATUSES.generating
                        }
                      />
                    </TiltCard>
                  ))}
                </div>
              </div>
            )}

            {/* Ready / published */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="glass p-4 h-72 animate-pulse"
                    style={{ borderRadius: 20 }}
                  />
                ))}
              </div>
            ) : readyTracks.length === 0 && pendingTracks.length === 0 ? (
              <EmptyState onCreate={() => navigate("/create")} />
            ) : (
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Library
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {readyTracks.map((track, i) => (
                    <TiltCard
                      key={track.id}
                      className="p-4 group"
                      onClick={() => navigate(`/track/${track.id}`)}
                    >
                      <div
                        className="relative aspect-square rounded-2xl mb-3 overflow-hidden flex items-center justify-center"
                        style={{
                          background:
                            COVER_GRADIENTS[i % COVER_GRADIENTS.length],
                        }}
                      >
                        <span className="text-white/30 font-display font-bold text-5xl">
                          {track.title?.[0]?.toUpperCase()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playTrack(track, readyTracks);
                          }}
                          className="absolute bottom-2 right-2 w-10 h-10 rounded-full crimson-gradient flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity glow-pulse"
                        >
                          <Play className="w-4 h-4 ml-0.5" />
                        </button>
                      </div>
                      <h3 className="font-semibold text-white text-sm truncate">
                        {track.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                        <span>{track.genre}</span>
                        <span>{track.bpm || 120} BPM</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <StatusBadge
                          status={
                            TRACK_STATUSES[track.status] || TRACK_STATUSES.ready
                          }
                          small
                        />
                        <span className="text-[10px] text-gray-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(
                            track.created_date || Date.now(),
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </TiltCard>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="videos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {videos.length === 0 ? (
              <div
                className="glass-strong p-16 text-center"
                style={{ borderRadius: 24 }}
              >
                <Clapperboard className="w-16 h-16 text-crimson/50 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">
                  No video projects yet
                </h2>
                <p className="text-gray-400 mb-6">
                  Turn your tracks into cinematic 4K videos
                </p>
                <button
                  onClick={() => navigate("/video-studio")}
                  className="crimson-gradient px-6 py-3 rounded-xl text-white font-semibold glow-pulse"
                >
                  Create Your First Video
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {pendingVideos.map((vp) => (
                  <TiltCard key={vp.id} className="p-5">
                    <div
                      className="relative aspect-video rounded-xl mb-3 overflow-hidden flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #800020, #050505)",
                      }}
                    >
                      <div className="absolute inset-0 animate-shimmer" />
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                    <h3 className="font-semibold text-white text-sm">
                      Video Project
                    </h3>
                    <div className="text-xs text-gray-500 mt-1">
                      {MODE_LABELS[vp.creationMode] || vp.creationMode} ·{" "}
                      {vp.aspectRatio} · {vp.fps}fps
                    </div>
                    <StatusBadge
                      status={
                        VIDEO_STATUSES[vp.status] || VIDEO_STATUSES.rendering
                      }
                      small
                    />
                  </TiltCard>
                ))}
                {readyVideos.map((vp, i) => (
                  <TiltCard
                    key={vp.id}
                    className="p-5 group"
                    onClick={() =>
                      navigate(`/video-studio?trackId=${vp.trackId}`)
                    }
                  >
                    <div
                      className="relative aspect-video rounded-xl mb-3 overflow-hidden flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, hsl(${(i * 50) % 360}, 60%, 25%), #050505)`,
                      }}
                    >
                      <Film className="w-10 h-10 text-white/40" />
                      <div className="absolute bottom-2 right-2 text-[10px] text-white/70 glass px-2 py-0.5 rounded">
                        {vp.resolution} · {vp.aspectRatio}
                      </div>
                    </div>
                    <h3 className="font-semibold text-white text-sm">
                      Video Project
                    </h3>
                    <div className="text-xs text-gray-500 mt-1">
                      {MODE_LABELS[vp.creationMode] || vp.creationMode} ·{" "}
                      {vp.fps}fps
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <StatusBadge
                        status={
                          VIDEO_STATUSES[vp.status] || VIDEO_STATUSES.ready
                        }
                        small
                      />
                      <span className="text-[10px] text-gray-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(
                          vp.created_date || Date.now(),
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </TiltCard>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status, small = false }) {
  const Icon = status.icon;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1 mt-2"} ${status.pulse ? "glow-pulse" : ""}`}
      style={{
        background: `${status.color}22`,
        border: `1px solid ${status.color}44`,
        color: status.color,
      }}
    >
      <Icon
        className={`${small ? "w-3 h-3" : "w-3.5 h-3.5"} ${status.spin ? "animate-spin" : ""}`}
      />
      {status.label}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 glass px-4 py-3 rounded-2xl">
      <div className="w-10 h-10 rounded-xl bg-crimson/15 flex items-center justify-center">
        <Icon className="w-5 h-5 text-crimson" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white leading-none">
          {value}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="glass-strong p-16 text-center" style={{ borderRadius: 24 }}>
      <div className="w-20 h-20 mx-auto rounded-full crimson-gradient flex items-center justify-center mb-6 glow-pulse">
        <Zap className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-display font-bold text-white mb-2">
        No tracks yet
      </h2>
      <p className="text-gray-400 mb-6">
        Start creating your first masterpiece
      </p>
      <button
        onClick={onCreate}
        className="crimson-gradient px-8 py-3 rounded-xl text-white font-semibold glow-pulse hover:scale-105 transition-transform"
      >
        Create Your First Track
      </button>
    </div>
  );
}
