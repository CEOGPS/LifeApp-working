import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "@/lib/veritonDb.ts";
import {
  Image as ImageIcon,
  Type,
  Wand2,
  Play,
  Download,
  Check,
  ArrowLeft,
  Monitor,
  Smartphone,
  Layers,
  Palette,
  Zap,
} from "lucide-react";
import TiltCard from "@/pages/veriton/components/TiltCard.jsx";
import ExplodingButton from "@/pages/veriton/components/ExplodingButton.jsx";
import { motion } from "motion/react";
import { generateVideo } from "@/lib/videoGenerationService.js";

const CREATION_MODES = [
  {
    id: "text-to-video",
    label: "Text-to-Video",
    icon: Type,
    desc: "Describe scenes, characters & mood. AI generates a timestamped storyboard.",
  },
  {
    id: "photo-animation",
    label: "Photo + Song",
    icon: ImageIcon,
    desc: "Upload 1–5 photos. AI animates with panning/zoom & transitions.",
  },
  {
    id: "template",
    label: "Template Library",
    icon: Layers,
    desc: "Pick a pre-made visual template. AI maps audio frequencies to it.",
  },
  {
    id: "auto-pilot",
    label: "Auto-Pilot",
    icon: Wand2,
    desc: "No input needed. AI analyzes mood/BPM/genre for a fully autonomous video.",
  },
];

const TEMPLATES = [
  "Particle Wave",
  "Retro VHS",
  "Abstract Geometry",
  "Nature Slideshow",
  "Neon Synthwave",
  "Cinematic Film",
];
const FONTS = ["Inter", "Space Grotesk", "Roboto Mono", "Georgia", "Impact"];
const COLORS = ["#FF1A40", "#FFFFFF", "#FFD700", "#00FF88", "#00BFFF"];

export default function VideoStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectTrackId = searchParams.get("trackId");
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [mode, setMode] = useState(null);
  const [textPrompt, setTextPrompt] = useState("");
  const [photos, setPhotos] = useState([]);
  const [template, setTemplate] = useState(null);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [fps, setFps] = useState(30);
  const [rendering, setRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [subtitleStyle, setSubtitleStyle] = useState({
    font: "Inter",
    size: 24,
    color: "#FF1A40",
  });
  const [transitionSpeed, setTransitionSpeed] = useState(1);
  const [postEdit, setPostEdit] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    db.entities.Track.list("-created_date", 50)
      .then((t) => {
        setTracks(t);
        if (preselectTrackId) {
          const found = t.find((tr) => tr.id === preselectTrackId);
          if (found) setSelectedTrack(found);
        }
      })
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, [preselectTrackId]);

  const handlePhotoUpload = async (files) => {
    const urls = [];
    for (const file of Array.from(files).slice(0, 5)) {
      try {
        const { file_url } = await db.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      } catch (e) {
        console.error(e);
      }
    }
    setPhotos([...photos, ...urls].slice(0, 5));
  };

  const handleRender = async () => {
    if (!selectedTrack) return;
    setRendering(true);
    setRenderProgress(0);
    try {
      // Build the visual source for the video: uploaded photos first,
      // otherwise the track's cover art, otherwise a plain dark slate.
      const imageSources = [];
      if (photos.length > 0) {
        photos.forEach((url) => imageSources.push({ url, name: "photo" }));
      } else if (selectedTrack.coverArtUrl) {
        imageSources.push({
          url: selectedTrack.coverArtUrl,
          name: "cover",
        });
      }
      // Always ensure at least one visual frame.
      if (imageSources.length === 0) {
        imageSources.push({ name: "frame", data: buildSlateFrame() });
      }

      const duration =
        mode === "text-to-video" || mode === "auto-pilot" ? 8 : 5;

      const result = await generateVideo(imageSources, {
        duration,
        transition:
          mode === "text-to-video" || mode === "auto-pilot"
            ? "zoom"
            : "fade",
        fps,
        textOverlay: textPrompt || selectedTrack.title || null,
        title: selectedTrack.title || "Veriton Music Video",
        onProgress: ({ percent }) => {
          setRenderProgress(Math.min(95, percent || 0));
        },
      });

      // Persist the video project record with the generated output.
      try {
        await db.entities.VideoProject.create({
          trackId: selectedTrack.id,
          creationMode: mode,
          inputData: { textPrompt, photos, template },
          status: "ready",
          aspectRatio,
          resolution: "4K",
          fps,
        });
      } catch (e) {
        console.warn("[video-studio] project record save failed:", e);
      }

      const url = URL.createObjectURL(result.blob);
      setVideoUrl(url);
      setRenderProgress(100);
      setVideoReady(true);
      setPostEdit(true);
    } catch (e) {
      console.error("[video-studio] render failed:", e);
      setRenderProgress(0);
      alert(
        "Rendering failed. Using the browser fallback needs at least one image — add a photo or pick a track with cover art, then try again.",
      );
    } finally {
      setRendering(false);
    }
  };

  // Dark slate data-URL used as a guaranteed fallback visual frame.
  function buildSlateFrame() {
    const c = document.createElement("canvas");
    c.width = 1280;
    c.height = 720;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = "#DC143C";
    ctx.font = "bold 72px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(selectedTrack?.title?.[0] || "♪", 640, 380);
    return c.toDataURL("image/png");
  }

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="glass p-2.5 rounded-xl text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-display font-bold crimson-text-gradient">
            Video Studio
          </h1>
          <p className="text-gray-400 text-sm">
            Create cinematic 4K music videos
          </p>
        </div>
      </div>

      {/* Step 1: Select track */}
      <Section number={1} title="Select a Track" active={!selectedTrack}>
        {loading ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="glass h-32 animate-pulse"
                style={{ borderRadius: 14 }}
              />
            ))}
          </div>
        ) : selectedTrack ? (
          <div
            className="glass glass-hover p-4 flex items-center gap-4 cursor-pointer"
            style={{ borderRadius: 16 }}
            onClick={() => setSelectedTrack(null)}
          >
            <div className="w-14 h-14 rounded-xl crimson-gradient flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {selectedTrack.title?.[0]}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold">
                {selectedTrack.title}
              </h3>
              <p className="text-xs text-gray-500">
                {selectedTrack.genre} · {selectedTrack.bpm} BPM ·{" "}
                {selectedTrack.mood}
              </p>
            </div>
            <Check className="w-5 h-5 text-crimson" />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {tracks.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrack(t)}
                className="glass glass-hover p-3 min-w-[140px] text-left shrink-0"
                style={{ borderRadius: 14 }}
              >
                <div
                  className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, hsl(${i * 40}, 60%, 30%), #050505)`,
                  }}
                >
                  <span className="text-white/30 font-bold text-2xl">
                    {t.title?.[0]}
                  </span>
                </div>
                <h4 className="text-xs text-white font-medium truncate">
                  {t.title}
                </h4>
                <p className="text-[10px] text-gray-500">
                  {t.genre} · {t.bpm} BPM
                </p>
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Step 2: Choose creation mode */}
      {selectedTrack && !mode && (
        <Section number={2} title="Creation Mode" active>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CREATION_MODES.map((m) => (
              <TiltCard
                key={m.id}
                className="p-5"
                onClick={() => setMode(m.id)}
              >
                <m.icon className="w-8 h-8 text-crimson mb-3" />
                <h3 className="font-semibold text-white mb-1">{m.label}</h3>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </TiltCard>
            ))}
          </div>
        </Section>
      )}

      {/* Step 3: Configure mode */}
      {mode && !rendering && !videoReady && (
        <Section
          number={3}
          title={`Configure: ${CREATION_MODES.find((m) => m.id === mode)?.label}`}
          active
        >
          {mode === "text-to-video" && (
            <textarea
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="Describe scenes, characters, mood...&#10;e.g. A lone figure walking through neon-lit rain at night, camera slowly panning up to a crimson sky..."
              rows={5}
              className="w-full px-4 py-3 glass rounded-xl text-white placeholder-gray-600 outline-none focus:border-crimson/30 resize-none"
            />
          )}
          {mode === "photo-animation" && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePhotoUpload(e.dataTransfer.files);
                }}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center cursor-pointer hover:border-crimson/30 transition-all"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoUpload(e.target.files)}
                />
                <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Upload 1–5 photos</p>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {photos.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      className="w-full aspect-square rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <textarea
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                placeholder="Describe the motion & transitions..."
                rows={3}
                className="w-full px-4 py-3 glass rounded-xl text-white placeholder-gray-600 outline-none mt-3 resize-none"
              />
            </>
          )}
          {mode === "template" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={`glass p-4 rounded-xl text-left transition-all ${template === t ? "border-crimson/40 glow-pulse" : "hover:border-white/20"}`}
                >
                  <Layers
                    className={`w-6 h-6 mb-2 ${template === t ? "text-crimson" : "text-gray-400"}`}
                  />
                  <span className="text-sm text-white">{t}</span>
                </button>
              ))}
            </div>
          )}
          {mode === "auto-pilot" && (
            <div className="glass p-6 text-center rounded-2xl">
              <Wand2 className="w-10 h-10 text-crimson mx-auto mb-3" />
              <p className="text-gray-300">
                AI will analyze the track's mood, BPM & genre to generate a
                fully autonomous 4K video with synced lyric subtitles.
              </p>
            </div>
          )}

          {/* Output specs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <label className="text-xs text-gray-500 mb-2 block">
                Aspect Ratio
              </label>
              <div className="flex gap-3">
                {[
                  { k: "16:9", label: "16:9", icon: Monitor },
                  { k: "9:16", label: "9:16", icon: Smartphone },
                ].map((a) => (
                  <button
                    key={a.k}
                    onClick={() => setAspectRatio(a.k)}
                    className={`flex-1 glass p-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all ${aspectRatio === a.k ? "border-crimson/40 text-crimson glow-pulse" : "text-gray-400"}`}
                  >
                    <a.icon className="w-4 h-4" /> {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-2 block">
                Frame Rate
              </label>
              <div className="flex gap-3">
                {[30, 60].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFps(f)}
                    className={`flex-1 glass p-3 rounded-xl text-sm transition-all ${fps === f ? "border-crimson/40 text-crimson glow-pulse" : "text-gray-400"}`}
                  >
                    {f} fps
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Render button */}
          <div className="flex justify-center mt-6">
            <ExplodingButton
              icon={Zap}
              onClick={handleRender}
              className="crimson-gradient px-10 py-4 rounded-2xl text-white font-bold text-lg glow-pulse hover:scale-105 transition-transform"
            >
              Render 4K
            </ExplodingButton>
          </div>
        </Section>
      )}

      {/* Rendering screen */}
      {rendering && (
        <div
          className="glass-strong p-12 text-center"
          style={{ borderRadius: 24 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 mx-auto rounded-full border-4 border-crimson/20 border-t-crimson mb-6"
            style={{ boxShadow: "0 0 40px rgba(220,20,60,0.3)" }}
          />
          <h2 className="text-xl font-bold crimson-text-gradient mb-2">
            Rendering 4K Video...
          </h2>
          <p className="text-gray-400 mb-6">
            {aspectRatio} · {fps}fps
          </p>
          <div className="max-w-md mx-auto">
            <div className="h-3 glass rounded-full overflow-hidden">
              <motion.div
                className="h-full crimson-gradient glow-pulse"
                style={{ width: `${renderProgress}%` }}
              />
            </div>
            <p className="text-crimson text-sm mt-2">{renderProgress}%</p>
          </div>
        </div>
      )}

      {/* Post-edit + result */}
      {postEdit && videoReady && (
        <Section number={4} title="Post-Edit & Export" active>
          {/* Video preview */}
          <div className="glass-strong p-4 mb-6" style={{ borderRadius: 20 }}>
            <div
              className="relative rounded-xl overflow-hidden flex items-center justify-center"
              style={{
                aspectRatio: aspectRatio === "16:9" ? "16/9" : "9/16",
                background: "linear-gradient(135deg, #DC143C, #050505)",
                maxHeight: 400,
                margin: "0 auto",
                maxWidth: aspectRatio === "16:9" ? "100%" : 225,
              }}
            >
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <Play className="w-16 h-16 text-white/70" />
                  <div
                    className="absolute bottom-4 left-0 right-0 text-center"
                    style={{
                      fontFamily: subtitleStyle.font,
                      fontSize: subtitleStyle.size,
                      color: subtitleStyle.color,
                    }}
                  >
                    Your lyrics appear here
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Subtitle style */}
          <div className="glass p-5 mb-4" style={{ borderRadius: 18 }}>
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-crimson" /> Lyric Subtitle Style
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Font</label>
                <select
                  value={subtitleStyle.font}
                  onChange={(e) =>
                    setSubtitleStyle({ ...subtitleStyle, font: e.target.value })
                  }
                  className="w-full px-3 py-2.5 glass rounded-xl text-white text-sm outline-none cursor-pointer"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f} className="bg-[#0A0A0A]">
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">
                  Size: {subtitleStyle.size}px
                </label>
                <input
                  type="range"
                  min="14"
                  max="48"
                  value={subtitleStyle.size}
                  onChange={(e) =>
                    setSubtitleStyle({
                      ...subtitleStyle,
                      size: Number(e.target.value),
                    })
                  }
                  className="crimson-slider w-full mt-3"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">
                  Color
                </label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setSubtitleStyle({ ...subtitleStyle, color: c })
                      }
                      className={`w-8 h-8 rounded-full border-2 transition-all ${subtitleStyle.color === c ? "border-white scale-110" : "border-white/20"}`}
                      style={{
                        background: c,
                        boxShadow:
                          subtitleStyle.color === c ? `0 0 10px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs text-gray-500 mb-2 block">
                Transition Speed: {transitionSpeed}x
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={transitionSpeed}
                onChange={(e) => setTransitionSpeed(Number(e.target.value))}
                className="crimson-slider w-full"
              />
            </div>
          </div>

          {/* Export */}
          <div className="flex justify-center gap-4">
            <ExplodingButton
              icon={Download}
              onClick={() => {
                if (!videoUrl) {
                  alert("No generated video yet.");
                  return;
                }
                const a = document.createElement("a");
                a.href = videoUrl;
                a.download = `${selectedTrack?.title || "veriton"}.webm`;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              className="crimson-gradient px-10 py-4 rounded-2xl text-white font-bold text-lg glow-pulse hover:scale-105 transition-transform"
            >
              Export Video
            </ExplodingButton>
            <button
              onClick={() => {
                setMode(null);
                setVideoReady(false);
                setPostEdit(false);
                setRenderProgress(0);
                setVideoUrl(null);
              }}
              className="glass px-6 py-4 rounded-2xl text-gray-400 hover:text-white"
            >
              Start Over
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ number, title, active, children }) {
  if (!active) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong p-6 mb-6"
      style={{ borderRadius: 24 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-full crimson-gradient flex items-center justify-center text-white font-bold text-sm glow-pulse">
          {number}
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}
