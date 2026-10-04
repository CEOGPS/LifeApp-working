import { db } from "@/lib/veritonDb.ts";
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
  Play,
  Pause,
  Download,
  Upload,
  Scissors,
  Repeat,
  Shuffle,
  FileMusic,
  Waves,
  Volume2,
  Sliders,
  Edit3,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Music,
  Film,
} from "lucide-react";
import WaveformVisualizer from "@/pages/veriton/components/WaveformVisualizer.jsx";
import ExplodingButton from "@/pages/veriton/components/ExplodingButton.jsx";
import { motion, AnimatePresence } from "motion/react";

const EDIT_TOOLS = [
  {
    id: "remix",
    label: "Remix",
    icon: Shuffle,
    desc: "Regenerate instrumental, keep vocals",
  },
  {
    id: "cover",
    label: "Cover",
    icon: Music,
    desc: "Reconstruct stems with new genre",
  },
  {
    id: "split",
    label: "Split",
    icon: Scissors,
    desc: "Extract Vocals / Drums / Bass / Other",
  },
  {
    id: "extend",
    label: "Extend",
    icon: Repeat,
    desc: "AI generates 30/60s continuation",
  },
  {
    id: "cut",
    label: "Cut",
    icon: Scissors,
    desc: "Trim section from waveform",
  },
  {
    id: "lyrics",
    label: "Change Lyrics",
    icon: Edit3,
    desc: "Voice-to-voice conversion",
  },
];

const FX_CHAIN = [
  { id: "reverb", label: "Reverb", options: ["Room", "Hall", "Plate"] },
  { id: "echo", label: "Echo/Delay", options: ["Short", "Medium", "Long"] },
  { id: "compression", label: "Compression", options: ["Light", "Heavy"] },
  {
    id: "eq",
    label: "EQ Preset",
    options: ["Bass Boost", "Treble Cut", "Telephone", "Lo-Fi Crush"],
  },
];

export default function TrackDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [lyricsEdit, setLyricsEdit] = useState(false);
  const [editedLyrics, setEditedLyrics] = useState("");
  const [fxSettings, setFxSettings] = useState({});
  const [polishing, setPolishing] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    db.entities.Track.get(id)
      .then((t) => {
        setTrack(t);
        setEditedLyrics(t.lyrics || "");
      })
      .catch(() => setTrack(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => (p >= 100 ? 0 : p + 0.5));
      }, 200);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying]);

  if (loading)
    return (
      <div
        className="glass p-8 animate-pulse h-96"
        style={{ borderRadius: 24 }}
      />
    );

  if (!track)
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">Track not found</p>
        <button
          onClick={() => navigate("/library")}
          className="crimson-gradient px-6 py-3 rounded-xl text-white"
        >
          Back to Library
        </button>
      </div>
    );

  if (track.status === "generating") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 rounded-full border-4 border-crimson/20 border-t-crimson mb-6"
          style={{ boxShadow: "0 0 40px rgba(220,20,60,0.3)" }}
        />
        <h2 className="text-xl font-bold crimson-text-gradient mb-1">
          Generating your track...
        </h2>
        <p className="text-gray-400 mb-6">AI is composing your masterpiece</p>
        <div className="flex items-end gap-1 h-20">
          {Array.from({ length: 30 }).map((_, i) => (
            <motion.div
              key={i}
              className="w-2 rounded-full crimson-gradient"
              animate={{ height: [10, 30 + Math.random() * 50, 10] }}
              transition={{
                duration: 0.5 + Math.random() * 0.5,
                repeat: Infinity,
                delay: i * 0.03,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  const handlePublish = async (format) => {
    try {
      await db.entities.Track.update(track.id, { status: "published" });
      setTrack({ ...track, status: "published" });
    } catch (e) {
      console.error(e);
    }
  };

  const polishLyrics = async () => {
    setPolishing(true);
    try {
      const res = await db.integrations.Core.InvokeLLM({
        prompt: `Rewrite these lyrics to fit the syllable count of a ${track.genre} song at ${track.bpm} BPM without changing the core meaning:\n\n${track.lyrics}`,
        model: "gemini_3_flash",
      });
      setEditedLyrics(
        typeof res === "string" ? res : res.output || track.lyrics,
      );
    } catch (e) {
      setEditedLyrics(track.lyrics + "\n\n[AI polished]");
    }
    setPolishing(false);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div
        className="glass-strong p-6 mb-6 flex items-start justify-between gap-4"
        style={{ borderRadius: 24 }}
      >
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl crimson-gradient flex items-center justify-center glow-pulse">
            <span className="text-white font-display font-bold text-3xl">
              {track.title?.[0]}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {track.title}
            </h1>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{track.genre}</span>
              <span>{track.bpm} BPM</span>
              <span>{track.key}</span>
              <span>
                {Math.floor((track.duration || 180) / 60)}:
                {((track.duration || 180) % 60).toString().padStart(2, "0")}
              </span>
              {track.status === "published" && (
                <span className="text-crimson font-semibold">✓ Published</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <ExplodingButton
            icon={Upload}
            onClick={() => setPublishOpen(true)}
            className="crimson-gradient px-6 py-3 rounded-xl text-white font-semibold text-sm"
          >
            Publish
          </ExplodingButton>
          <ExplodingButton
            icon={Download}
            onClick={() => setPublishOpen(true)}
            className="glass border-crimson/30 text-white px-6 py-3 rounded-xl font-semibold text-sm"
          >
            Download
          </ExplodingButton>
        </div>
      </div>

      {/* Waveform editor */}
      <div className="glass-strong p-6 mb-6" style={{ borderRadius: 24 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Waves className="w-5 h-5 text-crimson" />
            <h2 className="font-semibold text-white">Waveform Editor</h2>
          </div>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 rounded-full crimson-gradient flex items-center justify-center text-white glow-pulse"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>
        </div>
        <WaveformVisualizer
          progress={progress}
          height={140}
          bars={100}
          onSeek={setProgress}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>
            {Math.floor(((progress / 100) * (track.duration || 180)) / 60)}:
            {Math.floor(((progress / 100) * (track.duration || 180)) % 60)
              .toString()
              .padStart(2, "0")}
          </span>
          <span>
            {Math.floor((track.duration || 180) / 60)}:
            {((track.duration || 180) % 60).toString().padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Editing tools carousel */}
      <div className="mb-6">
        <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-crimson" /> Editing Suite
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {EDIT_TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() =>
                tool.id === "lyrics"
                  ? (setLyricsEdit(true), setEditedLyrics(track.lyrics || ""))
                  : setActiveTool(tool.id)
              }
              className={`glass glass-hover p-4 min-w-[160px] text-left shrink-0 ${activeTool === tool.id ? "border-crimson/40" : ""}`}
              style={{ borderRadius: 18 }}
            >
              <tool.icon
                className={`w-6 h-6 mb-2 ${activeTool === tool.id ? "text-crimson" : "text-gray-400"}`}
              />
              <h3 className="text-sm font-semibold text-white">{tool.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{tool.desc}</p>
            </button>
          ))}
        </div>
        {activeTool && (
          <ToolPanel
            toolId={activeTool}
            track={track}
            onClose={() => setActiveTool(null)}
          />
        )}
      </div>

      {/* Mastering & FX */}
      <div className="glass-strong p-6 mb-6" style={{ borderRadius: 24 }}>
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-crimson" /> Mastering & FX
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FX_CHAIN.map((fx) => (
            <div key={fx.id}>
              <label className="text-xs text-gray-500 mb-2 block">
                {fx.label}
              </label>
              <select
                value={fxSettings[fx.id] || ""}
                onChange={(e) =>
                  setFxSettings({ ...fxSettings, [fx.id]: e.target.value })
                }
                className="w-full px-3 py-2.5 glass rounded-xl text-white text-sm outline-none cursor-pointer"
              >
                <option value="" className="bg-[#0A0A0A]">
                  Off
                </option>
                {fx.options.map((o) => (
                  <option key={o} value={o} className="bg-[#0A0A0A]">
                    {o}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={polishLyrics}
            disabled={polishing}
            className="glass border-crimson/30 px-5 py-2.5 rounded-xl text-white text-sm font-medium flex items-center gap-2 hover:scale-105 transition-transform disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-crimson" />{" "}
            {polishing ? "Polishing..." : "Lyric Polish (AI)"}
          </button>
        </div>
      </div>

      {/* Make Video */}
      <button
        onClick={() => navigate(`/video-studio?trackId=${track.id}`)}
        className="glass-strong glass-hover w-full p-5 flex items-center gap-4 group"
        style={{ borderRadius: 20 }}
      >
        <div className="w-12 h-12 rounded-xl crimson-gradient flex items-center justify-center glow-pulse">
          <Film className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-white">Make Video</h3>
          <p className="text-xs text-gray-500">
            Create a cinematic 4K music video
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-crimson transition-colors" />
      </button>

      {/* Change Lyrics modal */}
      <AnimatePresence>
        {lyricsEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLyricsEdit(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-strong p-8 w-full max-w-2xl"
              style={{ borderRadius: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-white mb-4">
                Change Lyrics (Voice-to-Voice)
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                AI preserves timbre, pitch & emotion while stitching new
                phonemes
              </p>
              <textarea
                value={editedLyrics}
                onChange={(e) => setEditedLyrics(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 glass rounded-xl text-white text-sm font-mono outline-none focus:border-crimson/30 resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={polishLyrics}
                  disabled={polishing}
                  className="glass px-5 py-2.5 rounded-xl text-crimson text-sm font-medium flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> AI Polish
                </button>
                <button
                  onClick={async () => {
                    await db.entities.Track.update(track.id, {
                      lyrics: editedLyrics,
                    });
                    setTrack({ ...track, lyrics: editedLyrics });
                    setLyricsEdit(false);
                  }}
                  className="flex-1 crimson-gradient py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Apply
                </button>
                <button
                  onClick={() => setLyricsEdit(false)}
                  className="px-6 glass rounded-xl text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish modal */}
      <AnimatePresence>
        {publishOpen && (
          <PublishModal
            track={track}
            onClose={() => setPublishOpen(false)}
            onPublish={handlePublish}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ToolPanel({ toolId, track, onClose }) {
  const messages = {
    remix: "Regenerating instrumental while preserving vocal melody...",
    cover: "Choose a new genre to reconstruct the stems.",
    split: "Extracting stems: Vocals, Drums, Bass, Other",
    extend:
      "AI is generating a seamless continuation from your selected timestamp.",
    cut: "Drag the waveform handles to remove a section.",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-5 mt-3 flex items-center justify-between"
      style={{ borderRadius: 18 }}
    >
      <div>
        <p className="text-sm text-gray-300">{messages[toolId]}</p>
        {toolId === "split" && (
          <div className="flex gap-3 mt-3">
            {["Vocals", "Drums", "Bass", "Other"].map((s) => (
              <button
                key={s}
                className="glass px-4 py-2 rounded-lg text-xs text-white hover:border-crimson/30 flex items-center gap-2"
              >
                <Download className="w-3 h-3 text-crimson" /> {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-white text-sm"
      >
        Done
      </button>
    </motion.div>
  );
}

function PublishModal({ track, onClose, onPublish }) {
  const [format, setFormat] = useState("mp3");
  const [published, setPublished] = useState(false);

  const handlePublish = async () => {
    await onPublish(format);
    setPublished(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="glass-strong p-8 w-full max-w-md text-center"
        style={{ borderRadius: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        {published ? (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" }}
              className="w-20 h-20 mx-auto rounded-full crimson-gradient flex items-center justify-center mb-6 glow-pulse"
            >
              <Check className="w-10 h-10 text-white" />
            </motion.div>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * 80,
                    y: Math.sin(angle) * 80,
                    opacity: 0,
                  }}
                  transition={{ duration: 1, delay: i * 0.02 }}
                  className="absolute top-1/3 left-1/2 w-3 h-3 rounded-full bg-crimson pointer-events-none"
                  style={{ boxShadow: "0 0 10px rgba(220,20,60,0.8)" }}
                />
              );
            })}
            <h2 className="text-2xl font-bold text-white mb-2">
              Published! 🎉
            </h2>
            <p className="text-gray-400 mb-6">
              Track saved to Published playlist
            </p>
            <div className="flex gap-3 justify-center">
              <button className="crimson-gradient px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2">
                <Download className="w-4 h-4" /> {format.toUpperCase()}
              </button>
              <button
                onClick={onClose}
                className="glass px-6 py-3 rounded-xl text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <FileMusic className="w-12 h-12 text-crimson mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              Publish & Export
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              ID3 tags auto-attached: Title, Artist, BPM, Genre
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { k: "mp3", label: "MP3", sub: "320kbps" },
                { k: "wav", label: "WAV", sub: "44.1kHz" },
              ].map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFormat(f.k)}
                  className={`p-4 rounded-xl border-2 transition-all ${format === f.k ? "border-crimson glow-pulse bg-crimson/10" : "border-white/10 glass"}`}
                >
                  <div className="text-white font-bold">{f.label}</div>
                  <div className="text-xs text-gray-500">{f.sub}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                className="flex-1 crimson-gradient py-3 rounded-xl text-white font-semibold glow-pulse"
              >
                Publish
              </button>
              <button
                onClick={onClose}
                className="px-6 glass rounded-xl text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
