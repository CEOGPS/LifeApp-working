// src/pages/creator/CreatorWrapper.tsx
// Creator Studio (CreatorOS) — create/import assets and persist into Media / Music Hub.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Sparkles,
  Upload,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eraser,
  PenTool,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "@/lib/uploadFile";
import { uploadMusicFile } from "@/pages/music/api/music";
import { TrackEntity } from "@/pages/music/api/entities";

/* ------------------------------------------------------------------ */
/* Types / helpers matching Media panel local store                     */
/* ------------------------------------------------------------------ */

type MediaKind = "image" | "video" | "audio" | "document" | "other";
type StudioMode = "image" | "doc" | "audio" | "video";

interface MediaItem {
  id: string;
  album_id: string | null;
  kind: MediaKind;
  mime: string;
  filename: string;
  title: string;
  alt_text: string;
  url: string;
  thumb_url: string | null;
  size_bytes: number;
  tags: string[];
  vault: boolean;
  favorite: boolean;
  created_at: string;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

const MEDIA_ITEMS_KEY = "lifeos_media_items";
const CREATOR_RECENTS_KEY = "lifeos_creator_recents";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Same key MediaPanel's local usePersistentState uses (direct localStorage). */
function readMediaItems(): MediaItem[] {
  try {
    const raw = localStorage.getItem(MEDIA_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MediaItem[]) : [];
  } catch {
    return [];
  }
}

function writeMediaItems(items: MediaItem[]): void {
  localStorage.setItem(MEDIA_ITEMS_KEY, JSON.stringify(items));
}

function pushMediaItem(item: MediaItem): void {
  writeMediaItems([item, ...readMediaItems()]);
}

interface CreatorRecent {
  id: string;
  title: string;
  kind: StudioMode;
  dest: "media" | "music";
  created_at: string;
}

function readRecents(): CreatorRecent[] {
  try {
    const raw = localStorage.getItem(CREATOR_RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CreatorRecent[]).slice(0, 20) : [];
  } catch {
    return [];
  }
}

function pushRecent(r: CreatorRecent): void {
  const next = [r, ...readRecents().filter((x) => x.id !== r.id)].slice(0, 20);
  localStorage.setItem(CREATOR_RECENTS_KEY, JSON.stringify(next));
}

/** Encode AudioBuffer as a simple 16-bit mono WAV File. */
function audioBufferToWavFile(buffer: AudioBuffer, filename: string): File {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * 2;
  const ab = new ArrayBuffer(44 + dataLength);
  const view = new DataView(ab);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new File([ab], filename, { type: "audio/wav" });
}

async function makeToneWav(opts: {
  freq: number;
  seconds: number;
  title: string;
}): Promise<File> {
  const sampleRate = 44100;
  const length = Math.floor(sampleRate * opts.seconds);
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = opts.freq;
  gain.gain.setValueAtTime(0.0001, 0);
  gain.gain.exponentialRampToValueAtTime(0.35, 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(0.05, opts.seconds - 0.05));
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(0);
  osc.stop(opts.seconds);
  const rendered = await ctx.startRendering();
  const safe = (opts.title || "tone").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60) || "tone";
  return audioBufferToWavFile(rendered, `${safe}.wav`);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const MODES: { id: StudioMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "image", label: "Image", icon: <ImageIcon size={14} />, hint: "Draw or import → Media" },
  { id: "doc", label: "Document", icon: <FileText size={14} />, hint: "Write text → Media" },
  { id: "audio", label: "Audio / Music", icon: <Music size={14} />, hint: "Import or tone → Music Hub" },
  { id: "video", label: "Video", icon: <Video size={14} />, hint: "Import video → Media" },
];

export default function CreatorWrapper() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<StudioMode>("image");
  const [title, setTitle] = useState("Untitled");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [recents, setRecents] = useState<CreatorRecent[]>(() =>
    typeof window !== "undefined" ? readRecents() : [],
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const noteRecent = useCallback((r: CreatorRecent) => {
    pushRecent(r);
    setRecents(readRecents());
  }, []);

  /* ---------- Image studio ---------- */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);
  const imageFileRef = useRef<HTMLInputElement | null>(null);

  const initCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0d0e17";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  useEffect(() => {
    if (mode === "image") initCanvas();
  }, [mode, initCanvas]);

  const canvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  };

  const onCanvasDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = canvasPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = canvasPos(e);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onCanvasUp = () => {
    drawing.current = false;
  };

  const clearCanvas = () => {
    initCanvas();
  };

  const onImportImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast("error", "Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    setTitle(file.name.replace(/\.[^.]+$/, "") || "Imported image");
    const img = new window.Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0d0e17";
      ctx.fillRect(0, 0, c.width, c.height);
      const scale = Math.min(c.width / img.width, c.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    };
    img.src = url;
  };

  const saveImageToMedia = async () => {
    const c = canvasRef.current;
    if (!c) return;
    setBusy(true);
    setStatus(null);
    try {
      const blob: Blob | null = await new Promise((resolve) =>
        c.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("Could not export canvas");
      const name = `${(title || "creator-image").replace(/[^a-zA-Z0-9._-]+/g, "_")}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const up = await uploadFile(file, "media");
      const url = up.url || up.file_url;
      if (!url) throw new Error("Upload returned no URL");
      const item: MediaItem = {
        id: newId("m"),
        album_id: null,
        kind: "image",
        mime: "image/png",
        filename: name,
        title: title.trim() || "Untitled image",
        alt_text: "Created in Creator Studio",
        url,
        thumb_url: up.thumb_url ?? null,
        size_bytes: file.size,
        tags: ["creator"],
        vault: false,
        favorite: false,
        created_at: new Date().toISOString(),
      };
      pushMediaItem(item);
      noteRecent({
        id: item.id,
        title: item.title,
        kind: "image",
        dest: "media",
        created_at: item.created_at,
      });
      setStatus(`Saved to Media: ${item.title}`);
      pushToast("success", "Image saved to Media panel");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setStatus(msg);
      pushToast("error", msg);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Document studio ---------- */
  const [docBody, setDocBody] = useState("");

  const saveDocToMedia = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const text = docBody;
      if (!text.trim()) throw new Error("Document is empty");
      const name = `${(title || "creator-doc").replace(/[^a-zA-Z0-9._-]+/g, "_")}.txt`;
      const file = new File([text], name, { type: "text/plain" });
      const up = await uploadFile(file, "media");
      const url = up.url || up.file_url;
      if (!url) throw new Error("Upload returned no URL");
      const item: MediaItem = {
        id: newId("m"),
        album_id: null,
        kind: "document",
        mime: "text/plain",
        filename: name,
        title: title.trim() || "Untitled doc",
        alt_text: "",
        url,
        thumb_url: null,
        size_bytes: file.size,
        tags: ["creator", "document"],
        vault: false,
        favorite: false,
        created_at: new Date().toISOString(),
      };
      pushMediaItem(item);
      noteRecent({
        id: item.id,
        title: item.title,
        kind: "doc",
        dest: "media",
        created_at: item.created_at,
      });
      setStatus(`Saved to Media: ${item.title}`);
      pushToast("success", "Document saved to Media panel");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setStatus(msg);
      pushToast("error", msg);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Audio / Music studio ---------- */
  const audioFileRef = useRef<HTMLInputElement | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [toneFreq, setToneFreq] = useState(440);
  const [toneSeconds, setToneSeconds] = useState(2);

  const onImportAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
      pushToast("error", "Please choose an audio file");
      return;
    }
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.[^.]+$/, "") || "Imported track");
  };

  const generateTone = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const file = await makeToneWav({
        freq: toneFreq,
        seconds: Math.min(10, Math.max(0.2, toneSeconds)),
        title: title || "tone",
      });
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioFile(file);
      setAudioPreviewUrl(URL.createObjectURL(file));
      setStatus(`Tone ready (${toneFreq} Hz, ${toneSeconds}s)`);
      pushToast("info", "Tone generated — click Save to Music Hub");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tone failed";
      pushToast("error", msg);
    } finally {
      setBusy(false);
    }
  };

  const saveAudioToMusicHub = async () => {
    if (!audioFile) {
      pushToast("error", "Import or generate audio first");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const up = await uploadMusicFile(audioFile);
      if (!up?.url) throw new Error("Local music save returned no URL");
      const row = await TrackEntity.create({
        title: title.trim() || audioFile.name.replace(/\.[^.]+$/, "") || "Untitled",
        genre: "Creator",
        status: "ready",
        audioFileUrl: up.url,
        lyrics: "",
        playlistIds: [],
        gender: "Creator Studio",
      });
      noteRecent({
        id: row.id,
        title: row.title,
        kind: "audio",
        dest: "music",
        created_at: row.created_at || new Date().toISOString(),
      });
      setStatus(`Saved to Music Hub: ${row.title}`);
      pushToast("success", "Track saved to Music Hub library");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setStatus(msg);
      pushToast("error", msg);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Video studio ---------- */
  const videoFileRef = useRef<HTMLInputElement | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  const onImportVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      pushToast("error", "Please choose a video file");
      return;
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.[^.]+$/, "") || "Imported video");
  };

  const saveVideoToMedia = async () => {
    if (!videoFile) {
      pushToast("error", "Import a video first");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const up = await uploadFile(videoFile, "media");
      const url = up.url || up.file_url;
      if (!url) throw new Error("Upload returned no URL");
      const item: MediaItem = {
        id: newId("m"),
        album_id: null,
        kind: "video",
        mime: videoFile.type || "video/mp4",
        filename: videoFile.name,
        title: title.trim() || "Untitled video",
        alt_text: "",
        url,
        thumb_url: up.thumb_url ?? null,
        size_bytes: videoFile.size,
        tags: ["creator", "video"],
        vault: false,
        favorite: false,
        created_at: new Date().toISOString(),
      };
      pushMediaItem(item);
      noteRecent({
        id: item.id,
        title: item.title,
        kind: "video",
        dest: "media",
        created_at: item.created_at,
      });
      setStatus(`Saved to Media: ${item.title}`);
      pushToast("success", "Video saved to Media panel");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setStatus(msg);
      pushToast("error", msg);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Save dispatcher ---------- */
  const onSave = () => {
    if (mode === "image") void saveImageToMedia();
    else if (mode === "doc") void saveDocToMedia();
    else if (mode === "audio") void saveAudioToMusicHub();
    else void saveVideoToMedia();
  };

  return (
    <PanelLayout
      title="Creator Studio"
      subtitle="Create or import assets — images/docs/videos → Media, audio → Music Hub"
      icon={<Sparkles className="text-crimson-400" />}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/media")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/70 hover:border-primary/30"
          >
            <ExternalLink size={12} /> Media
          </button>
          <button
            type="button"
            onClick={() => navigate("/music")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/70 hover:border-primary/30"
          >
            <ExternalLink size={12} /> Music Hub
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col gap-4 min-h-0">
        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setStatus(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                mode === m.id
                  ? "bg-primary/20 border-primary/40 text-white"
                  : "glass border-white/10 text-white/70 hover:border-white/20"
              }`}
            >
              {m.icon}
              <span className="font-medium">{m.label}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-white/40 shrink-0">
          {MODES.find((m) => m.id === mode)?.hint}
        </p>

        {/* Title + save */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 min-w-[160px] h-9 px-3 text-sm rounded-lg bg-[#0d0e17] border border-white/10 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary/80 hover:bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>

        {status && (
          <div className="text-xs text-emerald-400/90 flex items-center gap-1.5 shrink-0">
            <CheckCircle size={12} /> {status}
          </div>
        )}

        {/* Studio body */}
        <div className="flex-1 min-h-0 glass rounded-xl border border-white/5 p-4 overflow-auto">
          {mode === "image" && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => imageFileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80 hover:border-primary/30"
                >
                  <Upload size={12} /> Import image
                </button>
                <input
                  ref={imageFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onImportImage}
                />
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80"
                >
                  <Eraser size={12} /> Clear
                </button>
                <label className="flex items-center gap-1.5 text-xs text-white/60">
                  <PenTool size={12} />
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-7 h-7 rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-white/60">
                  Size
                  <input
                    type="range"
                    min={1}
                    max={32}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-24"
                  />
                </label>
              </div>
              <canvas
                ref={canvasRef}
                width={960}
                height={540}
                className="w-full max-w-3xl rounded-lg border border-white/10 cursor-crosshair bg-[#0d0e17] touch-none"
                onMouseDown={onCanvasDown}
                onMouseMove={onCanvasMove}
                onMouseUp={onCanvasUp}
                onMouseLeave={onCanvasUp}
              />
              <p className="text-[11px] text-white/35">
                Draw on the canvas or import an image, then Save to push into the Media panel.
              </p>
            </div>
          )}

          {mode === "doc" && (
            <div className="flex flex-col gap-3 h-full min-h-[320px]">
              <textarea
                value={docBody}
                onChange={(e) => setDocBody(e.target.value)}
                placeholder="Write your document…"
                className="flex-1 min-h-[280px] w-full p-3 text-sm rounded-lg bg-[#0d0e17] border border-white/10 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-primary/40 resize-y font-mono"
              />
              <p className="text-[11px] text-white/35">
                Saves as a .txt document into the Media panel (Documents filter).
              </p>
            </div>
          )}

          {mode === "audio" && (
            <div className="flex flex-col gap-4 max-w-xl">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => audioFileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80 hover:border-primary/30"
                >
                  <Upload size={12} /> Import audio
                </button>
                <input
                  ref={audioFileRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac"
                  className="hidden"
                  onChange={onImportAudio}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void generateTone()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80 hover:border-primary/30 disabled:opacity-50"
                >
                  <Music size={12} /> Generate tone
                </button>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-white/60">
                <label className="flex items-center gap-2">
                  Freq (Hz)
                  <input
                    type="number"
                    min={40}
                    max={4000}
                    value={toneFreq}
                    onChange={(e) => setToneFreq(Number(e.target.value) || 440)}
                    className="w-20 h-8 px-2 rounded bg-[#0d0e17] border border-white/10 text-white/85"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Seconds
                  <input
                    type="number"
                    min={0.2}
                    max={10}
                    step={0.1}
                    value={toneSeconds}
                    onChange={(e) => setToneSeconds(Number(e.target.value) || 2)}
                    className="w-20 h-8 px-2 rounded bg-[#0d0e17] border border-white/10 text-white/85"
                  />
                </label>
              </div>
              {audioPreviewUrl && (
                <audio controls src={audioPreviewUrl} className="w-full" />
              )}
              {audioFile && (
                <p className="text-[11px] text-white/45">
                  Ready: {audioFile.name} ({Math.round(audioFile.size / 1024)} KB)
                </p>
              )}
              <p className="text-[11px] text-white/35">
                Save uses Music Hub&apos;s IndexedDB path (uploadMusicFile + music_hub_tracks). Open Music Hub → Library to play.
              </p>
            </div>
          )}

          {mode === "video" && (
            <div className="flex flex-col gap-3 max-w-2xl">
              <button
                type="button"
                onClick={() => videoFileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80 hover:border-primary/30 w-fit"
              >
                <Upload size={12} /> Import video
              </button>
              <input
                ref={videoFileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={onImportVideo}
              />
              {videoPreviewUrl && (
                <video controls src={videoPreviewUrl} className="w-full max-h-[360px] rounded-lg border border-white/10" />
              )}
              {videoFile && (
                <p className="text-[11px] text-white/45">
                  Ready: {videoFile.name} ({Math.round(videoFile.size / 1024)} KB)
                </p>
              )}
              <p className="text-[11px] text-white/35">
                No built-in editor yet — import and Save to Media. Large files need worker/Supabase upload.
              </p>
            </div>
          )}
        </div>

        {/* Recents */}
        {recents.length > 0 && (
          <div className="shrink-0 glass rounded-xl border border-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Recent from Creator</div>
            <ul className="flex flex-col gap-1 max-h-28 overflow-y-auto">
              {recents.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 text-xs text-white/70 px-2 py-1 rounded hover:bg-white/5"
                >
                  <span className="truncate">
                    <span className="text-white/40 mr-2">{r.kind}</span>
                    {r.title}
                  </span>
                  <button
                    type="button"
                    className="text-primary/80 hover:text-primary shrink-0"
                    onClick={() => navigate(r.dest === "music" ? "/music" : "/media")}
                  >
                    Open {r.dest === "music" ? "Music" : "Media"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Toasts */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg text-xs border shadow-lg ${
                t.kind === "success"
                  ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-200"
                  : t.kind === "error"
                    ? "bg-red-950/90 border-red-500/30 text-red-200"
                    : "bg-slate-900/90 border-white/10 text-white/80"
              }`}
            >
              {t.kind === "error" ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
