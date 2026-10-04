// src/pages/music/tabs/CreateTab.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Music2, Loader2, Sparkles } from "lucide-react";
import { GENRES, MOODS, VOICES, type Genre, type Mood, type Voice, type DBTrack } from "../types";
import { generateSong, polishLyrics } from "../api/music";
import { TrackEntity } from "../api/entities";
import { useGenerationPoll } from "../hooks/useGenerationPoll";
import { TrackRow } from "../components/TrackRow";
import { EmptyState } from "../components/EmptyState";

interface Props {
  songs: DBTrack[];
  onTrackCreated: (track: DBTrack) => void;
  onCommitted: () => void;
}

export function CreateTab({ songs, onTrackCreated, onCommitted }: Props) {
  const [lyrics, setLyrics] = useState("");
  const [genre, setGenre] = useState<Genre>(GENRES[0]);
  const [mood, setMood] = useState<Mood>(MOODS[0]);
  const [voice, setVoice] = useState<Voice>(VOICES[0]);
  const [bpm, setBpm] = useState(120);
  const [busy, setBusy] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const { poll } = useGenerationPoll();

  useEffect(() => () => { mountedRef.current = false; }, []);

  const recent = useMemo(() => songs.slice(0, 10), [songs]);

  const handleGenerate = useCallback(async () => {
    if (!lyrics.trim()) { setMsg("Enter lyrics or a description first."); return; }
    setBusy(true);
    setMsg(null);
    try {
      const { id: stubId } = await generateSong({
        prompt: lyrics.trim(),
        lyrics: lyrics.trim(),
        genre, mood, voice, bpm,
      });

      const song = await poll(stubId);
      if (!mountedRef.current) return;

      if (!song) { setMsg("Generation timed out."); return; }
      if (song.status === "failed") { setMsg("Generation failed."); return; }
      if (song.status === "ready" && song.audioUrl) {
        const inserted = await TrackEntity.create({
          title: song.title,
          lyrics: song.lyrics ?? "",
          genre: song.genre,
          mood: song.mood,
          gender: song.voice,
          bpm: song.bpm,
          duration: song.durationSec,
          coverArtUrl: song.thumbnailUrl ?? null,
          audioFileUrl: song.audioUrl,
          status: "ready",
          playlistIds: [],
        });
        if (!mountedRef.current) return;
        if (inserted) onTrackCreated(inserted);
        setMsg(`“${song.title}” is ready.`);
        onCommitted();
      }
    } catch (e) {
      if (mountedRef.current) setMsg(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [lyrics, genre, mood, voice, bpm, poll, onTrackCreated, onCommitted]);

  const handlePolish = useCallback(async () => {
    if (!lyrics.trim()) { setMsg("Write something to polish first."); return; }
    setPolishing(true);
    setMsg(null);
    try {
      const res = await polishLyrics(lyrics, genre, bpm);
      if (!mountedRef.current) return;
      if (res.ok) setLyrics(res.text);
      else setMsg(`Polish failed: ${res.detail ?? "unknown"}`);
    } catch (e) {
      if (mountedRef.current) setMsg(e instanceof Error ? e.message : "Polish failed.");
    } finally {
      if (mountedRef.current) setPolishing(false);
    }
  }, [lyrics, genre, bpm]);

  return (
    <div className="flex flex-1 min-h-0 gap-3">
      <div className="w-[420px] shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
        <div className="glass rounded-xl border border-white-8 p-3 flex flex-col gap-3">
          <div className="text-[9px] font-display tracking-widest text-teal uppercase">New Song</div>

          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="Write lyrics, or describe the song you want…"
            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white-10 text-xs text-white-85 placeholder:text-white-25 focus:outline-none resize-y min-h-[180px] leading-relaxed font-mono"
          />

          <div className="grid grid-cols-2 gap-2">
            <Field label="Genre">
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as Genre)}
                className="w-full px-2 py-1.5 rounded-lg bg-[#0d0e17] border border-white-10 text-xs text-white-85 focus:outline-none"
              >
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Mood">
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as Mood)}
                className="w-full px-2 py-1.5 rounded-lg bg-[#0d0e17] border border-white-10 text-xs text-white-85 focus:outline-none"
              >
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Voice">
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value as Voice)}
                className="w-full px-2 py-1.5 rounded-lg bg-[#0d0e17] border border-white-10 text-xs text-white-85 focus:outline-none"
              >
                {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label={`BPM: ${bpm}`}>
              <input
                type="range" min={40} max={220} step={1} value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </Field>
          </div>

          {msg && <div className="text-[11px] text-crimson/90">{msg}</div>}

          <div className="flex gap-2">
            <button
              onClick={handlePolish}
              disabled={polishing || busy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg glass text-teal text-[11px] font-display tracking-wider hover:text-white disabled:opacity-50 transition-colors"
            >
              {polishing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              POLISH
            </button>
            <button
              onClick={handleGenerate}
              disabled={busy}
              className="flex-[2] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider hover:glow-crimson-sm disabled:opacity-50 transition-all"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Music2 size={11} />}
              GENERATE
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col glass rounded-xl border border-white-8 overflow-hidden">
        <div className="px-3 py-2 border-b border-white-5 flex items-center">
          <span className="text-[10px] font-display tracking-widest text-teal uppercase">Recent</span>
          <span className="ml-auto text-[10px] text-white-30">{recent.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {recent.length === 0 ? (
            <EmptyState icon={Music2} title="Nothing yet." hint="Write something and hit Generate." />
          ) : (
            <div className="flex flex-col gap-1">
              {recent.map((s) => <TrackRow key={s.id} track={s} playlists={[]} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-display tracking-widest text-teal uppercase mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}