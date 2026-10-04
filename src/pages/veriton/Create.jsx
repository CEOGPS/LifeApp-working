import { db } from "@/lib/veritonDb.ts";
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import {
  Zap,
  Upload,
  Check,
  Sliders,
  ChevronDown,
  Waves,
  User,
  Volume2,
  Mic2,
  Music2,
  Gauge,
  Sparkles,
  Activity,
} from "lucide-react";
import {
  useGenerationStore,
  GENRES,
  MOODS,
  VOICE_TYPES,
  DELIVERIES,
} from "@/pages/veriton/lib/generationStore.js";
import TiltCard from "@/pages/veriton/components/TiltCard.jsx";
import GlowChip from "@/pages/veriton/components/GlowChip.jsx";
import ExplodingButton from "@/pages/veriton/components/ExplodingButton.jsx";
import { motion, AnimatePresence } from "motion/react";

export default function Create() {
  const navigate = useNavigate();
  const store = useGenerationStore();
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [consent, setConsent] = useState(false);
  const [uploadedVoice, setUploadedVoice] = useState(null);
  const [detectedBpm, setDetectedBpm] = useState(null);
  const fileRef = useRef(null);

  const handleVoiceUpload = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large (max 10MB)");
      return;
    }
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setUploadedVoice({ url: file_url, name: file.name });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDetectBpm = () => {
    const bpm = Math.floor(80 + Math.random() * 100);
    setDetectedBpm(bpm);
    store.setBpm(bpm);
  };

  const handleGenerate = async () => {
    if (!store.lyrics.trim()) {
      alert("Please enter some lyrics");
      return;
    }
    setGenerating(true);
    const title = store.lyrics.split("\n")[0].slice(0, 30) || "Untitled Track";
    try {
      const track = await db.entities.Track.create({
        title,
        lyrics: store.lyrics,
        genre: store.genre,
        genreSecondary: store.genreBlendActive ? store.genreSecondary : null,
        genreBlend: store.genreBlendActive ? store.genreBlend : 100,
        mood: store.mood,
        delivery: store.delivery,
        gender: store.gender,
        voiceTypes: store.voiceTypes,
        voiceBlend: store.voiceBlend,
        bpm: store.bpm,
        key: "C Major",
        duration: 180,
        status: "generating",
        coverArtUrl: null,
        audioFileUrl: null,
      });
      // Simulate generation completion
      setTimeout(async () => {
        try {
          await db.entities.Track.update(track.id, {
            status: "ready",
            duration: Math.floor(120 + Math.random() * 120),
          });
        } catch (e) {
          console.error(e);
        }
      }, 2000);
      navigate(`/track/${track.id}`);
    } catch (e) {
      console.error(e);
      alert("Generation failed. Please try again.");
      setGenerating(false);
    }
  };

  if (generating) return <GeneratingScreen />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-display font-bold crimson-text-gradient mb-2">
          Create
        </h1>
        <p className="text-gray-400">Transform your vision into sound</p>
      </div>

      {/* Mode toggle */}
      <div
        className="glass p-1.5 inline-flex rounded-2xl mb-6 mx-auto block"
        style={{ borderRadius: 18 }}
      >
        <div className="flex gap-1">
          {["standard", "advanced"].map((m) => (
            <button
              key={m}
              onClick={() => store.setMode(m)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 capitalize ${
                store.mode === m
                  ? "crimson-gradient text-white glow-pulse"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {m === "standard" ? (
                <Sliders className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {m} Mode
            </button>
          ))}
        </div>
      </div>

      {/* Main form */}
      <div className="glass-strong p-8" style={{ borderRadius: 24 }}>
        {/* Lyrics */}
        <Section icon={Mic2} title="Lyrics">
          <textarea
            value={store.lyrics}
            onChange={(e) => store.setLyrics(e.target.value)}
            placeholder="Write your lyrics here...&#10;[Verse 1]&#10;In the neon crimson light...&#10;[Chorus]&#10;..."
            rows={6}
            className="w-full px-4 py-3 glass rounded-xl text-white placeholder-gray-600 outline-none focus:border-crimson/30 resize-none font-mono text-sm leading-relaxed"
          />
        </Section>

        {/* Standard mode inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section icon={Music2} title="Genre">
            <select
              value={store.genre}
              onChange={(e) => store.setGenre(e.target.value)}
              className="w-full px-4 py-3 glass rounded-xl text-white outline-none focus:border-crimson/30 cursor-pointer appearance-none"
            >
              {GENRES.map((g) => (
                <option key={g} value={g} className="bg-[#0A0A0A]">
                  {g}
                </option>
              ))}
            </select>
          </Section>

          <Section icon={Sparkles} title="Mood">
            <div className="flex flex-wrap gap-2">
              {MOODS.slice(0, 6).map((m) => (
                <GlowChip
                  key={m}
                  label={m}
                  selected={store.mood === m}
                  onClick={() => store.setMood(m)}
                />
              ))}
            </div>
          </Section>
        </div>

        {/* Advanced mode */}
        <AnimatePresence>
          {store.mode === "advanced" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-white/10 mt-6 pt-6 space-y-6">
                {/* Voice Upload */}
                <Section icon={Upload} title="Voice Capture & Timbre Cloning">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleVoiceUpload(e.dataTransfer.files[0]);
                    }}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                      dragOver
                        ? "border-crimson glow-pulse bg-crimson/5"
                        : "border-white/15 hover:border-white/30"
                    }`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".wav,.mp3,.m4a"
                      className="hidden"
                      onChange={(e) => handleVoiceUpload(e.target.files[0])}
                    />
                    {uploadedVoice ? (
                      <div className="flex items-center justify-center gap-3">
                        <Check className="w-5 h-5 text-crimson" />
                        <span className="text-white text-sm">
                          {uploadedVoice.name}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">
                          Drag & drop voice sample or click to upload
                        </p>
                        <p className="text-gray-600 text-xs mt-1">
                          .wav, .mp3, .m4a · max 30s / 10MB
                        </p>
                      </>
                    )}
                  </div>
                  <label className="flex items-center gap-3 mt-4 cursor-pointer">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${consent ? "crimson-gradient border-crimson" : "border-white/20"}`}
                    >
                      {consent && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="hidden"
                    />
                    <span className="text-xs text-gray-400">
                      I own the rights to this voice and consent to AI
                      processing
                    </span>
                  </label>
                </Section>

                {/* Gender */}
                <Section icon={User} title="Gender">
                  <div className="flex gap-3">
                    {["Male", "Female", "Both"].map((g) => (
                      <button
                        key={g}
                        onClick={() => store.setGender(g)}
                        className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          store.gender === g
                            ? "crimson-gradient text-white glow-pulse"
                            : "glass text-gray-400 hover:text-white"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </Section>

                {/* Voice Types */}
                <Section icon={Waves} title="Voice Types (select up to 3)">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {VOICE_TYPES.map((vt) => (
                      <button
                        key={vt}
                        onClick={() => store.toggleVoiceType(vt)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          store.voiceTypes.includes(vt)
                            ? "crimson-gradient text-white glow-pulse"
                            : "glass text-gray-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        {vt}
                      </button>
                    ))}
                  </div>
                  {/* Blend sliders */}
                  {store.voiceTypes.length > 1 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs text-gray-500">Blend Weights</p>
                      {store.voiceTypes.map((vt) => (
                        <div key={vt} className="flex items-center gap-4">
                          <span className="text-xs text-gray-300 w-20">
                            {vt}
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={store.voiceBlend[vt] || 50}
                            onChange={(e) =>
                              store.setVoiceBlend(vt, Number(e.target.value))
                            }
                            className="crimson-slider flex-1"
                          />
                          <span className="text-xs text-crimson w-10 text-right">
                            {store.voiceBlend[vt] || 50}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Genre Blend */}
                <Section icon={Music2} title="Genre Blending">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() =>
                        store.setGenreBlendActive(!store.genreBlendActive)
                      }
                      className={`relative w-12 h-6 rounded-full transition-all ${store.genreBlendActive ? "crimson-gradient" : "bg-white/10"}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${store.genreBlendActive ? "left-7" : "left-1"}`}
                      />
                    </button>
                    <span className="text-sm text-gray-400">
                      Enable genre blending
                    </span>
                  </div>
                  {store.genreBlendActive && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={store.genre}
                          onChange={(e) => store.setGenre(e.target.value)}
                          className="px-4 py-3 glass rounded-xl text-white outline-none cursor-pointer"
                        >
                          {GENRES.map((g) => (
                            <option key={g} value={g} className="bg-[#0A0A0A]">
                              {g}
                            </option>
                          ))}
                        </select>
                        <select
                          value={store.genreSecondary}
                          onChange={(e) =>
                            store.setGenreSecondary(e.target.value)
                          }
                          className="px-4 py-3 glass rounded-xl text-white outline-none cursor-pointer"
                        >
                          {GENRES.map((g) => (
                            <option key={g} value={g} className="bg-[#0A0A0A]">
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-white w-16">
                          {store.genre} {store.genreBlend}%
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={store.genreBlend}
                          onChange={(e) =>
                            store.setGenreBlend(Number(e.target.value))
                          }
                          className="crimson-slider flex-1"
                        />
                        <span className="text-xs text-white w-16 text-right">
                          {100 - store.genreBlend}% {store.genreSecondary}
                        </span>
                      </div>
                    </div>
                  )}
                </Section>

                {/* Delivery + BPM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Section icon={Volume2} title="Delivery">
                    <select
                      value={store.delivery}
                      onChange={(e) => store.setDelivery(e.target.value)}
                      className="w-full px-4 py-3 glass rounded-xl text-white outline-none cursor-pointer"
                    >
                      {DELIVERIES.map((d) => (
                        <option key={d} value={d} className="bg-[#0A0A0A]">
                          {d}
                        </option>
                      ))}
                    </select>
                  </Section>

                  <Section icon={Gauge} title="BPM">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => store.setBpm(store.bpm - 1)}
                        className="w-10 h-10 glass rounded-xl text-white hover:border-crimson/30"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={store.bpm}
                        onChange={(e) => store.setBpm(Number(e.target.value))}
                        min="40"
                        max="240"
                        className="flex-1 px-4 py-3 glass rounded-xl text-white text-center outline-none"
                      />
                      <button
                        onClick={() => store.setBpm(store.bpm + 1)}
                        className="w-10 h-10 glass rounded-xl text-white hover:border-crimson/30"
                      >
                        +
                      </button>
                      <button
                        onClick={handleDetectBpm}
                        className="px-4 py-3 glass rounded-xl text-crimson text-sm font-medium hover:border-crimson/30 flex items-center gap-1"
                      >
                        <Activity className="w-4 h-4" /> Detect
                      </button>
                    </div>
                    {detectedBpm && (
                      <p className="text-xs text-crimson mt-2">
                        Detected: {detectedBpm} BPM
                      </p>
                    )}
                  </Section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate button */}
        <div className="mt-8 flex justify-center">
          <ExplodingButton
            icon={Zap}
            onClick={handleGenerate}
            className="crimson-gradient px-12 py-4 rounded-2xl text-white font-bold text-lg glow-pulse hover:scale-105 transition-transform"
          >
            Generate
          </ExplodingButton>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-crimson" />
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function GeneratingScreen() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-24 h-24 rounded-full border-4 border-crimson/20 border-t-crimson mb-8"
        style={{ boxShadow: "0 0 40px rgba(220,20,60,0.3)" }}
      />
      <h2 className="text-2xl font-display font-bold crimson-text-gradient mb-2">
        Generating...
      </h2>
      <p className="text-gray-400 mb-8">Analyzing crimson frequencies</p>
      {/* Spectrogram visualization */}
      <div className="flex items-end gap-1 h-24">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="w-2 rounded-full crimson-gradient"
            animate={{ height: [10, 40 + Math.random() * 60, 10] }}
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
