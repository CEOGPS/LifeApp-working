// src/pages/creator/CreatorWrapper.tsx
// Creator Studio — generation modes with pluggable local/cloud backends.
// Saves images/video/docs → Media album "Creator"; audio → Music Hub library.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Settings2,
  ExternalLink,
  Clapperboard,
  Wand2,
  Mic,
  Film,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  type CreatorMode,
  type BackendSettings,
  type EndpointStatus,
  loadBackendSettings,
  saveBackendSettings,
  probeEndpoints,
  listOllamaModels,
  listLmStudioModels,
  DEFAULT_BACKENDS,
} from "./api/backends";
import {
  MissingBackendError,
  generateDocument,
  runImageGen,
  runImageEdit,
  runTxt2Vid,
  runImg2Vid,
  runMusicVideo,
  runMusicGen,
  runVoice,
  runVoiceClone,
  type GenResult,
} from "./api/generate";
import { resolveCreativeKeys, SERVICE_CATALOG, type CreativeService } from "./api/keys";
import {
  saveToCreatorMedia,
  saveAudioToMusicLibrary,
  saveTextDocument,
  ensureCreatorAlbum,
} from "./api/save";

/* ------------------------------------------------------------------ */

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

interface CreatorRecent {
  id: string;
  title: string;
  kind: CreatorMode;
  dest: "media" | "music";
  created_at: string;
}

const CREATOR_RECENTS_KEY = "lifeos_creator_recents";

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

const MODES: {
  id: CreatorMode;
  label: string;
  icon: React.ReactNode;
  hint: string;
  priority: number;
}[] = [
  { id: "img2vid", label: "Image→Video", icon: <Clapperboard size={14} />, hint: "Animate a still via ComfyUI / Luma / Runway / Replicate", priority: 1 },
  { id: "txt2vid", label: "Text→Video", icon: <Film size={14} />, hint: "Prompt → video (Luma / Runway / Replicate or ComfyUI)", priority: 2 },
  { id: "musicvideo", label: "Music Video", icon: <Sparkles size={14} />, hint: "Image + prompt (+ optional song) → video", priority: 3 },
  { id: "image", label: "Image Gen", icon: <ImageIcon size={14} />, hint: "ComfyUI → Stability / Replicate / HF / NVIDIA", priority: 4 },
  { id: "edit", label: "Image Edit", icon: <Wand2 size={14} />, hint: "Edit / inpaint with Stability or Replicate", priority: 5 },
  { id: "music", label: "Music", icon: <Music size={14} />, hint: "HF MusicGen / Replicate → Music Hub", priority: 6 },
  { id: "voice", label: "Voice / Clone", icon: <Mic size={14} />, hint: "Kokoro local TTS or ElevenLabs clone", priority: 7 },
  { id: "docs", label: "Writer", icon: <FileText size={14} />, hint: "LM Studio / Ollama document writer → Media", priority: 8 },
];

/* ------------------------------------------------------------------ */

export default function CreatorWrapper() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<CreatorMode>("img2vid");
  const [title, setTitle] = useState("Untitled");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installHint, setInstallHint] = useState<string | null>(null);
  const [ctaServices, setCtaServices] = useState<string[]>([]);
  const [result, setResult] = useState<GenResult | null>(null);
  const [docBody, setDocBody] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [backends, setBackends] = useState<BackendSettings>(() =>
    typeof window !== "undefined" ? loadBackendSettings() : DEFAULT_BACKENDS,
  );
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([]);
  const [probing, setProbing] = useState(false);
  const [keyStatus, setKeyStatus] = useState<Partial<Record<CreativeService, boolean>>>({});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [lmModels, setLmModels] = useState<string[]>([]);
  const [recents, setRecents] = useState<CreatorRecent[]>(() =>
    typeof window !== "undefined" ? readRecents() : [],
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  // Mode-specific uploads
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [songFile, setSongFile] = useState<File | null>(null);
  const [songPreview, setSongPreview] = useState<string | null>(null);
  const [refAudioFile, setRefAudioFile] = useState<File | null>(null);
  const [refAudioUrl, setRefAudioUrl] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState("My Voice");

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const songInputRef = useRef<HTMLInputElement | null>(null);
  const refAudioInputRef = useRef<HTMLInputElement | null>(null);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refreshProbes = useCallback(async () => {
    setProbing(true);
    try {
      const eps = await probeEndpoints(backends);
      setEndpoints(eps);
      const [om, lm, keys] = await Promise.all([
        listOllamaModels(backends.ollamaUrl),
        listLmStudioModels(backends.lmStudioUrl),
        resolveCreativeKeys(),
      ]);
      setOllamaModels(om);
      setLmModels(lm);
      const ks: Partial<Record<CreativeService, boolean>> = {};
      (Object.keys(SERVICE_CATALOG) as CreativeService[]).forEach((s) => {
        ks[s] = !!keys[s];
      });
      setKeyStatus(ks);
      ensureCreatorAlbum();
    } finally {
      setProbing(false);
    }
  }, [backends]);

  useEffect(() => {
    void refreshProbes();
  }, [refreshProbes]);

  useEffect(() => {
    saveBackendSettings(backends);
  }, [backends]);

  const modeMeta = useMemo(() => MODES.find((m) => m.id === mode)!, [mode]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      pushToast("error", "Choose an image file");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    const url = URL.createObjectURL(f);
    setImageFile(f);
    setImagePreview(url);
    if (!title || title === "Untitled") setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const onPickSong = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (songPreview) URL.revokeObjectURL(songPreview);
    setSongFile(f);
    setSongPreview(URL.createObjectURL(f));
  };

  const onPickRefAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (refAudioUrl) URL.revokeObjectURL(refAudioUrl);
    setRefAudioFile(f);
    setRefAudioUrl(URL.createObjectURL(f));
  };

  const clearJobState = () => {
    setError(null);
    setInstallHint(null);
    setCtaServices([]);
    setProgress(null);
  };

  const handleMissing = (err: unknown) => {
    if (err instanceof MissingBackendError) {
      setError(err.message);
      setInstallHint(err.installHint || null);
      setCtaServices(err.services);
      pushToast("error", err.message);
      return;
    }
    const msg = err instanceof Error ? err.message : "Generation failed";
    setError(msg);
    pushToast("error", msg);
  };

  /* ---------- Generate ---------- */
  const onGenerate = async () => {
    clearJobState();
    setResult(null);
    setBusy(true);
    setProgress("Starting…");
    try {
      let out: GenResult;

      if (mode === "docs") {
        if (!prompt.trim() && !docBody.trim()) throw new Error("Enter a writing prompt");
        setProgress("Writing with LM Studio / Ollama…");
        out = await generateDocument(prompt.trim() || docBody.trim(), backends, {
          endpoints,
          system: prompt.trim()
            ? undefined
            : "Expand and polish the following draft into a finished document.",
        });
        if (out.text) setDocBody(out.text);
        setResult(out);
        setProgress(`Done via ${out.source}`);
        pushToast("success", `Draft ready (${out.source})`);
        return;
      }

      if (mode === "image") {
        if (!prompt.trim()) throw new Error("Enter an image prompt");
        setProgress("Generating image (ComfyUI → cloud)…");
        out = await runImageGen(prompt.trim(), endpoints, backends);
      } else if (mode === "edit") {
        if (!imagePreview) throw new Error("Import an image to edit");
        if (!prompt.trim()) throw new Error("Describe the edit");
        setProgress("Editing image…");
        out = await runImageEdit(imagePreview, prompt.trim());
      } else if (mode === "img2vid") {
        if (!imagePreview) throw new Error("Import a source image");
        setProgress("Image→video (may take a few minutes)…");
        out = await runImg2Vid(imagePreview, prompt.trim() || "smooth cinematic motion", endpoints);
      } else if (mode === "txt2vid") {
        if (!prompt.trim()) throw new Error("Enter a video prompt");
        setProgress("Text→video (may take a few minutes)…");
        out = await runTxt2Vid(prompt.trim(), endpoints);
      } else if (mode === "musicvideo") {
        if (!imagePreview) throw new Error("Import a cover / still image");
        setProgress("Building music video…");
        out = await runMusicVideo({
          imageUrl: imagePreview,
          prompt: prompt.trim(),
          songUrl: songPreview || undefined,
          endpoints,
        });
      } else if (mode === "music") {
        if (!prompt.trim()) throw new Error("Describe the music");
        setProgress("Generating music…");
        out = await runMusicGen(prompt.trim());
      } else if (mode === "voice") {
        if (!prompt.trim()) throw new Error("Enter text to speak");
        setProgress(refAudioUrl ? "Cloning voice…" : "Synthesizing speech…");
        out = refAudioUrl
          ? await runVoiceClone({
              text: prompt.trim(),
              referenceAudioUrl: refAudioUrl,
              voiceName: cloneName,
            })
          : await runVoice(prompt.trim(), { endpoints, settings: backends });
      } else {
        throw new Error("Unknown mode");
      }

      setResult(out);
      setProgress(`Done via ${out.source}`);
      pushToast("success", `Generated via ${out.source}`);
    } catch (err) {
      setProgress(null);
      handleMissing(err);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- Save ---------- */
  const onSave = async () => {
    clearJobState();
    setBusy(true);
    setProgress("Saving…");
    try {
      if (mode === "docs") {
        const item = await saveTextDocument({ title, body: docBody });
        pushRecent({
          id: item.id,
          title: item.title,
          kind: "docs",
          dest: "media",
          created_at: item.created_at,
        });
        setRecents(readRecents());
        pushToast("success", "Saved to Media → Creator album");
        setProgress("Saved document");
        return;
      }

      // Audio modes → Music Hub
      if (mode === "music" || mode === "voice") {
        if (!result?.url) throw new Error("Generate audio first");
        const track = await saveAudioToMusicLibrary({
          title,
          sourceUrl: result.url,
          genre: mode === "voice" ? "Voice" : "Creator",
        });
        pushRecent({
          id: track.id,
          title: track.title,
          kind: mode,
          dest: "music",
          created_at: new Date().toISOString(),
        });
        setRecents(readRecents());
        pushToast("success", "Saved to Music Hub library");
        setProgress("Saved audio");
        return;
      }

      // Optional song companion for music video
      if (mode === "musicvideo" && songFile) {
        await saveAudioToMusicLibrary({
          title: title + " (track)",
          file: songFile,
          genre: "Creator",
        });
      }

      if (!result?.url) throw new Error("Generate something first");
      const isVideo = mode === "img2vid" || mode === "txt2vid" || mode === "musicvideo";
      const ext = isVideo ? "mp4" : "png";
      const mime = isVideo ? "video/mp4" : "image/png";
      const item = await saveToCreatorMedia({
        title,
        kind: isVideo ? "video" : "image",
        mime,
        filename: (title || "creator").replace(/[^a-zA-Z0-9._-]+/g, "_") + "." + ext,
        sourceUrl: result.url,
        tags: [mode, result.source],
      });
      pushRecent({
        id: item.id,
        title: item.title,
        kind: mode,
        dest: "media",
        created_at: item.created_at,
      });
      setRecents(readRecents());
      pushToast("success", "Saved to Media → Creator album");
      setProgress("Saved");
    } catch (err) {
      handleMissing(err);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const onlineCount = endpoints.filter((e) => e.online).length;
  const keyedCount = Object.values(keyStatus).filter(Boolean).length;

  return (
    <PanelLayout
      title="Creator Studio"
      subtitle="Generate image, video, music, voice & docs — local first, cloud when keyed"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshProbes()}
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-lg border border-white/10 text-white/70 hover:border-white/25"
            title="Re-probe local backends"
          >
            <RefreshCw size={12} className={probing ? "animate-spin" : ""} />
            {onlineCount} local · {keyedCount} keys
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className={`flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-lg border ${
              showSettings ? "border-primary/40 bg-primary/15 text-white" : "border-white/10 text-white/70"
            }`}
          >
            <Settings2 size={12} /> Backends
          </button>
          <button
            type="button"
            onClick={() => navigate("/media")}
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-lg border border-white/10 text-white/70"
          >
            <ExternalLink size={12} /> Media
          </button>
          <button
            type="button"
            onClick={() => navigate("/music")}
            className="flex items-center gap-1.5 h-8 px-2.5 text-xs rounded-lg border border-white/10 text-white/70"
          >
            <ExternalLink size={12} /> Music
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col gap-3 min-h-0 relative">
        {/* Mode tabs */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                clearJobState();
                setResult(null);
                setProgress(null);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                mode === m.id
                  ? "bg-primary/20 border-primary/40 text-white"
                  : "glass border-white/10 text-white/65 hover:border-white/20"
              }`}
            >
              {m.icon}
              <span className="font-medium">{m.label}</span>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-white/40 shrink-0">{modeMeta.hint}</p>

        {/* Backend settings panel */}
        {showSettings && (
          <div className="shrink-0 glass rounded-xl border border-white/10 p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-white/45">Pluggable backends</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {(
                [
                  ["comfyUrl", "ComfyUI URL (image / img2vid)"],
                  ["lmStudioUrl", "LM Studio URL (docs)"],
                  ["ollamaUrl", "Ollama URL (docs)"],
                  ["a1111Url", "A1111 / Fooocus URL"],
                  ["kokoroUrl", "Kokoro TTS URL"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-white/60">
                  {label}
                  <input
                    value={backends[key]}
                    onChange={(e) => setBackends((b) => ({ ...b, [key]: e.target.value }))}
                    className="h-8 px-2 rounded-lg bg-[#0d0e17] border border-white/10 text-white/85"
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-white/60">
                Ollama model
                <select
                  value={backends.ollamaModel}
                  onChange={(e) => setBackends((b) => ({ ...b, ollamaModel: e.target.value }))}
                  className="h-8 px-2 rounded-lg bg-[#0d0e17] border border-white/10 text-white/85"
                >
                  {[backends.ollamaModel, ...ollamaModels].filter((v, i, a) => v && a.indexOf(v) === i).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-white/60">
                LM Studio model
                <select
                  value={backends.lmStudioModel}
                  onChange={(e) => setBackends((b) => ({ ...b, lmStudioModel: e.target.value }))}
                  className="h-8 px-2 rounded-lg bg-[#0d0e17] border border-white/10 text-white/85"
                >
                  <option value="">(default loaded)</option>
                  {lmModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input
                type="checkbox"
                checked={backends.preferLocal}
                onChange={(e) => setBackends((b) => ({ ...b, preferLocal: e.target.checked }))}
                className="accent-primary"
              />
              Prefer local endpoints when online
            </label>
            <div className="flex flex-wrap gap-2">
              {endpoints.map((e) => (
                <span
                  key={e.id}
                  className={`text-[10px] px-2 py-1 rounded-full border ${
                    e.online ? "border-emerald-500/40 text-emerald-300" : "border-white/10 text-white/35"
                  }`}
                  title={e.url}
                >
                  {e.online ? "●" : "○"} {e.label}
                  {e.detail ? ` — ${e.detail}` : ""}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SERVICE_CATALOG) as CreativeService[]).map((s) => (
                <span
                  key={s}
                  className={`text-[10px] px-2 py-1 rounded-full border ${
                    keyStatus[s] ? "border-sky-500/40 text-sky-300" : "border-white/10 text-white/35"
                  }`}
                >
                  {keyStatus[s] ? "●" : "○"} {SERVICE_CATALOG[s].catalogName}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => navigate("/integrations")}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink size={11} /> Open Integrations to unlock / save API keys
            </button>
          </div>
        )}

        {/* Title + actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 min-w-[140px] h-9 px-3 text-sm rounded-lg bg-[#0d0e17] border border-white/10 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGenerate()}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary/80 hover:bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            {busy && !progress?.startsWith("Saved") && !progress?.startsWith("Saving") ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Generate
          </button>
          <button
            type="button"
            disabled={busy || (mode !== "docs" && !result?.url && !docBody.trim())}
            onClick={() => void onSave()}
            className="flex items-center gap-2 h-9 px-4 rounded-lg border border-white/15 text-white/85 text-sm hover:border-primary/40 disabled:opacity-50"
          >
            {busy && progress?.startsWith("Sav") ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Save
          </button>
        </div>

        {/* Progress / error */}
        {progress && !error && (
          <div className="text-xs text-emerald-400/90 flex items-center gap-1.5 shrink-0">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
            {progress}
          </div>
        )}
        {error && (
          <div className="shrink-0 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 space-y-2">
            <div className="text-xs text-rose-200 flex items-start gap-1.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {installHint && <p className="text-[11px] text-white/50 pl-5">{installHint}</p>}
            <div className="flex flex-wrap gap-2 pl-5">
              {ctaServices.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/integrations")}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30"
                >
                  Connect in Integrations
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="text-[11px] px-2.5 py-1 rounded-md border border-white/15 text-white/70"
              >
                Backend URLs
              </button>
            </div>
          </div>
        )}

        {/* Studio body */}
        <div className="flex-1 min-h-0 glass rounded-xl border border-white/5 p-4 overflow-auto">
          <div className="flex flex-col lg:flex-row gap-4 min-h-full">
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {/* Image upload for modes that need it */}
              {(mode === "img2vid" || mode === "musicvideo" || mode === "edit") && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80 hover:border-primary/30"
                  >
                    <Upload size={12} /> {imageFile ? "Replace image" : "Import image"}
                  </button>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                  {imageFile && (
                    <span className="text-[11px] text-white/45">{imageFile.name}</span>
                  )}
                </div>
              )}

              {mode === "musicvideo" && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => songInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80"
                  >
                    <Upload size={12} /> {songFile ? "Replace song" : "Attach song (optional)"}
                  </button>
                  <input
                    ref={songInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                    className="hidden"
                    onChange={onPickSong}
                  />
                  {songPreview && <audio controls src={songPreview} className="h-8 max-w-xs" />}
                </div>
              )}

              {mode === "voice" && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => refAudioInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/80"
                  >
                    <Mic size={12} /> {refAudioFile ? "Replace clone sample" : "Clone sample (ElevenLabs)"}
                  </button>
                  <input
                    ref={refAudioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.m4a"
                    className="hidden"
                    onChange={onPickRefAudio}
                  />
                  {refAudioFile && (
                    <input
                      value={cloneName}
                      onChange={(e) => setCloneName(e.target.value)}
                      placeholder="Clone voice name"
                      className="h-8 px-2 text-xs rounded-lg bg-[#0d0e17] border border-white/10 text-white/85"
                    />
                  )}
                </div>
              )}

              {mode === "docs" ? (
                <>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Writing brief — e.g. 'Blog post about local AI pipelines, 400 words, friendly tone'"
                    className="w-full min-h-[80px] p-3 text-sm rounded-lg bg-[#0d0e17] border border-white/10 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-primary/40 resize-y"
                  />
                  <textarea
                    value={docBody}
                    onChange={(e) => setDocBody(e.target.value)}
                    placeholder="Document body (Generate fills this from LM Studio / Ollama)…"
                    className="flex-1 min-h-[280px] w-full p-3 text-sm rounded-lg bg-[#0d0e17] border border-white/10 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-primary/40 resize-y font-mono leading-relaxed"
                  />
                </>
              ) : (
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === "voice"
                      ? "Text to speak…"
                      : mode === "edit"
                        ? "Describe the edit / inpaint…"
                        : mode === "music"
                          ? "Describe the track — genre, mood, instruments…"
                          : "Prompt…"
                  }
                  className="w-full min-h-[100px] p-3 text-sm rounded-lg bg-[#0d0e17] border border-white/10 text-white/90 placeholder:text-white/30 focus:outline-none focus:border-primary/40 resize-y"
                />
              )}
            </div>

            {/* Preview column */}
            <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-2">
              <div className="text-[10px] uppercase tracking-widest text-white/40">Preview</div>
              <div className="rounded-lg border border-white/10 bg-[#0d0e17] min-h-[200px] flex items-center justify-center overflow-hidden p-2">
                {imagePreview && (mode === "img2vid" || mode === "musicvideo" || mode === "edit") && !result?.url && (
                  <img src={imagePreview} alt="source" className="max-h-[280px] max-w-full object-contain rounded" />
                )}
                {result?.url && (mode === "image" || mode === "edit") && (
                  <img src={result.url} alt="result" className="max-h-[320px] max-w-full object-contain rounded" />
                )}
                {result?.url && (mode === "img2vid" || mode === "txt2vid" || mode === "musicvideo") && (
                  <video controls src={result.url} className="max-h-[320px] w-full rounded" />
                )}
                {result?.url && (mode === "music" || mode === "voice") && (
                  <audio controls src={result.url} className="w-full" />
                )}
                {result?.spoken && !result.url && (
                  <p className="text-xs text-white/50 p-3 text-center">Spoken via Web Speech (no file). Connect ElevenLabs or Kokoro to save audio.</p>
                )}
                {!result?.url && !imagePreview && mode !== "docs" && (
                  <p className="text-xs text-white/30 p-4 text-center">Output appears here after Generate</p>
                )}
                {mode === "docs" && docBody && (
                  <p className="text-[11px] text-white/55 p-2 max-h-[300px] overflow-auto whitespace-pre-wrap w-full">
                    {docBody.slice(0, 800)}
                    {docBody.length > 800 ? "…" : ""}
                  </p>
                )}
              </div>
              {result?.source && (
                <p className="text-[10px] text-white/40">Source: {result.source}</p>
              )}
            </div>
          </div>
        </div>

        {/* Recents */}
        {recents.length > 0 && (
          <div className="shrink-0 glass rounded-xl border border-white/5 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Recent from Creator</div>
            <ul className="flex flex-col gap-1 max-h-24 overflow-y-auto">
              {recents.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-xs text-white/70">
                  <span className="text-white/35 w-20 shrink-0">{r.kind}</span>
                  <span className="truncate flex-1">{r.title}</span>
                  <span className="text-white/30">{r.dest}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Toasts */}
        <div className="pointer-events-none absolute bottom-3 right-3 flex flex-col gap-2 z-20">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto text-xs px-3 py-2 rounded-lg border shadow-lg ${
                t.kind === "success"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                  : t.kind === "error"
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-200"
                    : "bg-white/10 border-white/20 text-white/80"
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </PanelLayout>
  );
}
