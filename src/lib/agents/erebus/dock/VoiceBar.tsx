// src/lib/agents/erebus/dock/VoiceBar.tsx
// Voice controls: mute, Kokoro voice, speed, volume, test. (Push-to-talk lives
// on the avatar controls so it also works on the stage and in PiP.)
import { Volume2, VolumeX, Play } from "lucide-react";
import { KOKORO_VOICES } from "../hooks/useErebusVoice";
import { useDockStore } from "./dockStore";

export default function VoiceBar({ kokoroOnline }: { kokoroOnline: boolean | null }) {
  const s = useDockStore((st) => st.settings);
  const update = useDockStore((st) => st.update);
  const say = useDockStore((st) => st.say);
  return (
    <div className="px-3 py-2 border-b border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-white/60" data-testid="erebus-voice-bar">
      <button
        type="button"
        onClick={() => update({ muted: !s.muted })}
        className="p-1 rounded-md hover:bg-white/10 text-white/70"
        aria-label={s.muted ? "Unmute voice" : "Mute voice"}
        title={s.muted ? "Unmute" : "Mute"}
      >
        {s.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      <label className="flex items-center gap-1">
        <span className="sr-only">Voice</span>
        <select
          value={s.voice}
          onChange={(e) => update({ voice: e.target.value })}
          className="bg-black/40 border border-white/10 rounded-md px-1.5 py-0.5 text-white/80 outline-none"
          aria-label="Voice"
        >
          {KOKORO_VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1" title="Speed">
        <span>Speed</span>
        <input
          type="range"
          min={0.6}
          max={1.6}
          step={0.05}
          value={s.speed}
          onChange={(e) => update({ speed: Number(e.target.value) })}
          className="w-16 accent-primary"
          aria-label="Speed"
        />
        <span className="w-7 tabular-nums">{s.speed.toFixed(2)}</span>
      </label>
      <label className="flex items-center gap-1" title="Volume">
        <span>Vol</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.volume}
          onChange={(e) => update({ volume: Number(e.target.value) })}
          className="w-16 accent-primary"
          aria-label="Volume"
        />
      </label>
      <button
        type="button"
        onClick={() => void say("Erebus online. Voice check.")}
        disabled={s.muted}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-white/10 hover:bg-white/10 disabled:opacity-40"
        title="Test voice"
      >
        <Play size={11} /> Test
      </button>
      <span className="flex items-center gap-1 ml-auto" title="Kokoro TTS at localhost:8880 (falls back to browser voice)">
        <span className={`w-1.5 h-1.5 rounded-full ${kokoroOnline ? "bg-emerald-400" : kokoroOnline === false ? "bg-amber-400" : "bg-white/30"}`} />
        {kokoroOnline ? "Kokoro" : kokoroOnline === false ? "Browser voice" : "…"}
      </span>
    </div>
  );
}
