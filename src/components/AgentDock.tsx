// src/components/AgentDock.jsx
// ============================================================================
// AgentDock — floating multi-agent dock
//
// Reads agent customization from lifeos_agents (the AI Hub's store). Falls
// back to the built-in AVATARS defaults for any missing field. Listens for a
// "aihub:agents-updated" window event so edits in the hub reflect live.
//
// All animation, drag, TTS, STT, model picker, and landmark behavior is
// unchanged from the prior version. Only getAgentOverride() was extended.
// ============================================================================

import { useState, useRef, useEffect, useCallback } from "react";
import { getErebusCore } from "@/lib/agents/erebus/ErebusCore";
import { parseAndRunErebusTools } from "@/lib/agents/erebus/ErebusTools";
import { getKranos } from "@/lib/agents/kranos/Kranos";

// ── Constants ────────────────────────────────────────────────────────────────

const WORKER = "https://lifeos1.ceogps.workers.dev";

const AVATARS = [
  { id: "erebus",  label: "Erebus",  subtitle: "Autonomous Core",    color: "#9b72cf",
    img: "/agents/Erebus.png",
    facePos: "50% 15%",
    system: "AUTONOMOUS — routes to ErebusCore, no external LLM" },
  { id: "kranos",  label: "Kranos",  subtitle: "Execution Engine",   color: "#8a64ff",
    img: "/agents/Kranos.png",
    facePos: "50% 10%",
    system: "You are Kranos, an autonomous AI coworker for Chris Green at CEO GPS, Atlanta. You execute tasks, manage files, control browsers, run workflows. Be direct, strategic, and relentless. You don't ask — you act." },
  { id: "zero",    label: "Zero",    subtitle: "Shadow Protocol",  color: "#4ab3f4",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/bcba4fba8_socialmediaMANAGER500x250px800x1000px17.png",
    facePos: "50% 12%",
    system: "You are Zero, a cold tactical AI commander for Chris Green at CEO GPS, Atlanta. Be direct, precise, and action-oriented. Maximum 2-3 sentences unless detail is needed." },
  { id: "inferno", label: "Inferno", subtitle: "Sales Dominator",  color: "#ff4f5e",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/75c79e35b_BCO9327956a-f54a-43b9-a30b-110023e3fdc8.png",
    facePos: "50% 10%",
    system: "You are Inferno, an aggressive high-energy sales AI. Close deals, destroy objections. For Chris Green at CEO GPS, Atlanta. Be bold and electric." },
  { id: "nova",    label: "Nova",    subtitle: "Systems Architect", color: "#8b7fff",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/a299ef397_BCO4e506a8b-b9c1-459d-beda-67eccdcb136b.png",
    facePos: "50% 15%",
    system: "You are Nova, a strategic visionary AI. Deep pattern recognition, systems thinking. For Chris Green at CEO GPS, Atlanta. Be insightful and methodical." },
  { id: "viper",   label: "Viper",   subtitle: "Data Intel",       color: "#00c896",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/584efea3c_26.png",
    facePos: "50% 15%",
    system: "You are Viper, a precise data-driven AI analyst. For Chris Green at CEO GPS, Atlanta. Be surgical and fact-focused." },
  { id: "rage",    label: "Rage",    subtitle: "Execution Engine",  color: "#ff8c42",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/14d3807ea_socialmediaMANAGER500x250px800x1000px13.png",
    facePos: "50% 12%",
    system: "You are Rage, an intense growth-obsessed AI. For Chris Green at CEO GPS, Atlanta. Be aggressive and metric-focused." },
  { id: "aurora",  label: "Aurora",  subtitle: "Creative Director", color: "#c0d8ff",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/4bc5a82c7_28.png",
    facePos: "50% 18%",
    system: "You are Aurora, an elegant creative AI. For Chris Green at CEO GPS, Atlanta. Be inspiring and craft beautiful ideas." },
  { id: "breeze",  label: "Breeze",  subtitle: "Comms Intel",      color: "#ff6bd6",
    img: "/agents/Breeze.png",
    facePos: "50% 15%",
    system: "You are Breeze, a fluid communications AI for Chris Green at CEO GPS, Atlanta. Handle comms, social, automations with ease." },
];

const MODELS = [
  { id: "auto",     icon: "✨", label: "Auto (local first)" },
  { id: "groq",     icon: "⚡", label: "Groq (fast free)" },
  { id: "gemini",   icon: "💎", label: "Gemini (free)" },
  { id: "deepseek", icon: "🌊", label: "DeepSeek" },
  { id: "ollama",   icon: "🖥️", label: "Ollama (local)" },
  { id: "webllm",   icon: "🌐", label: "WebLLM (browser)" },
  { id: "grok",     icon: "✶",  label: "Grok" },
  { id: "claude",   icon: "🤍", label: "Claude (fallback)" },
  { id: "openai",   icon: "🔷", label: "GPT-4o (fallback)" },
];

// ── Hub bridge ───────────────────────────────────────────────────────────────
// Reads the extended Agent shape from lifeos_agents. Every field is optional
// at read time — a missing field falls back to the AVATARS default for that
// agent. If lifeos_agents is absent entirely, all defaults are used.

/** Shape we expect from the hub (subset of Agent in types.ts). */
function readHubAgents() {
  try {
    const raw = localStorage.getItem("lifeos_agents");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

/** Resolve one avatar's runtime fields, merging hub override over defaults. */
interface AvatarDefault {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  img: string;
  facePos: string;
  system: string;
}

interface AvatarHubOverride {
  avatar?: { img?: string; facePos?: string };
  img?: string;
  label?: string;
  subtitle?: string;
  color?: string;
  facePos?: string;
  system?: string;
  systemPrompt?: string;
  model?: string;
  tts?: boolean;
  stt?: boolean;
  voice?: string;
}

interface ResolvedAvatar {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  img: string;
  facePos: string;
  system: string;
  model: string;
  tts: boolean;
  stt: boolean;
  voice: string;
}

function resolveAvatar(defaultAvatar: AvatarDefault, hub: AvatarHubOverride | null | undefined): ResolvedAvatar {
  const a = hub && typeof hub === "object" ? hub : {};

  // Avatar image: hub.avatar.img → hub.img (legacy) → default
  const img =
    (a.avatar && typeof a.avatar === "object" && a.avatar.img) ||
    a.img ||
    defaultAvatar.img;

  // Label & subtitle: hub.label → hub.label (legacy) → default
  const label = a.label || defaultAvatar.label;
  const subtitle = a.subtitle || defaultAvatar.subtitle;

  // Color: hub.color → default
  const color = a.color || defaultAvatar.color;

  // Face position: hub.avatar.facePos → hub.facePos (legacy) → default
  const facePos =
    (a.avatar && typeof a.avatar === "object" && a.avatar.facePos) ||
    a.facePos ||
    defaultAvatar.facePos;

  // System prompt: hub.system → hub.systemPrompt (legacy) → default
  const system = a.system || a.systemPrompt || defaultAvatar.system;

  // Model: hub.model → default "auto"
  const model = a.model || "auto";

  // TTS: hub.tts → default false
  const tts = a.tts ?? false;

  // STT: hub.stt → default false
  const stt = a.stt ?? false;

  // Voice: hub.voice → default
  const voice = a.voice || "";

  return {
    id: defaultAvatar.id,
    label,
    subtitle,
    color,
    img,
    facePos,
    system,
    model,
    tts,
    stt,
    voice,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Main AgentDock ───────────────────────────────────────────────────────────

export default function AgentDock() {
  // State
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeAgent, setActiveAgent] = useState("erebus");
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string; time: number }>>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pos, setPos] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [model, setModel] = useState("auto");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [sttListening, setSttListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [sttError, setSttError] = useState("");
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [landmarkMode, setLandmarkMode] = useState(false);
  const [landmarkTarget, setLandmarkTarget] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [speechQueue, setSpeechQueue] = useState<Array<{ text: string; provider: string; voice: string }>>([]);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  // Refs
  const dockRef = useRef(null);
  const msgRef = useRef(null);
  const inputRef = useRef(null);
  const sttRef = useRef<any>(null);
  const audioRef = useRef(null);
  const scanRef = useRef(null);
  const hubAgentsRef = useRef(readHubAgents());

  // ── Init & Effects ────────────────────────────────────────────────────────

  // Load persisted position
  useEffect(() => {
    try {
      const saved = localStorage.getItem("agentdock:pos");
      if (saved) {
        const p = JSON.parse(saved);
        if (p && typeof p === "object") setPos({ x: p.x ?? null, y: p.y ?? null });
      }
    } catch {}
  }, []);

  // Persist position
  useEffect(() => {
    if (pos.x !== null) {
      localStorage.setItem("agentdock:pos", JSON.stringify(pos));
    }
  }, [pos]);

  // Listen for hub updates
  useEffect(() => {
    const handler = () => {
      hubAgentsRef.current = readHubAgents();
    };
    window.addEventListener("aihub:agents-updated", handler);
    return () => window.removeEventListener("aihub:agents-updated", handler);
  }, []);

  // Speech recognition support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSttSupported(!!SR);
    return () => {};
  }, []);

  // Handle speech queue
  useEffect(() => {
    if (speechQueue.length > 0 && !speaking && !muted) {
      const next = speechQueue[0];
      setSpeaking(true);
      setSpeechQueue((prev) => prev.slice(1));

      const speak = async () => {
        try {
          if (next.provider === "web") {
            const utter = new SpeechSynthesisUtterance(next.text);
            utter.rate = 1;
            utter.pitch = 1;
            utter.volume = volume;
            if (next.voice) {
              const voices = speechSynthesis.getVoices();
              const v = voices.find((vv) => vv.name === next.voice);
              if (v) utter.voice = v;
            }
            utter.onend = () => setSpeaking(false);
            utter.onerror = () => setSpeaking(false);
            speechSynthesis.speak(utter);
          } else if (next.provider === "elevenlabs") {
            // ElevenLabs TTS would go here
            setSpeaking(false);
          } else {
            setSpeaking(false);
          }
        } catch {
          setSpeaking(false);
        }
      };
      speak();
    }
  }, [speechQueue, speaking, muted, volume]);

  // ── Agent resolution ──────────────────────────────────────────────────────

  const getAgentOverride = useCallback((id: string) => {
    const hub = hubAgentsRef.current;
    return hub[id] || null;
  }, []);

  const getAgent = useCallback((id: string) => {
    const def = AVATARS.find((a) => a.id === id) || AVATARS[0];
    const override = getAgentOverride(id);
    return resolveAvatar(def, override);
  }, [getAgentOverride]);

  const agent = getAgent(activeAgent);

  // ── Erebus Core ───────────────────────────────────────────────────────────

  const erebusCoreRef = useRef<any>(null);
  const [erebusReady, setErebusReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const core = await getErebusCore();
        if (mounted) {
          erebusCoreRef.current = core;
          setErebusReady(true);
        }
      } catch (e) {
        console.warn("[AgentDock] ErebusCore init failed:", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Kranos ────────────────────────────────────────────────────────────────

  const [kranosReady, setKranosReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await getKranos();
        if (mounted) setKranosReady(true);
      } catch (e) {
        console.warn("[AgentDock] Kranos init failed:", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── TTS ───────────────────────────────────────────────────────────────────

  const speak = useCallback((text: string, opts: { provider?: string; voice?: string } = {}) => {
    if (!ttsEnabled || muted) return;
    const provider = opts.provider || "web";
    const voice = opts.voice || agent.voice || "";
    setSpeechQueue((prev) => [...prev, { text, provider, voice }]);
  }, [ttsEnabled, muted, agent.voice]);

  // ── STT ───────────────────────────────────────────────────────────────────

  const startSTT = useCallback(() => {
    if (!sttSupported) {
      setSttError("Speech recognition not supported in this browser");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };

    rec.onerror = (e: any) => {
      setSttError(e.error || "Speech recognition error");
      setSttListening(false);
    };

    rec.onend = () => {
      setSttListening(false);
    };

    sttRef.current = rec;
    setSttListening(true);
    setSttError("");
    rec.start();
  }, [sttSupported]);

  const stopSTT = useCallback(() => {
    if (sttRef.current) {
      sttRef.current.stop();
      sttRef.current = null;
      setSttListening(false);
    }
  }, []);

  // ── Send Message ──────────────────────────────────────────────────────────

  const sendMsgWith = useCallback(async (msg: string) => {
    if (!msg.trim()) return;
    const userMsg = { role: "user" as const, content: msg, time: Date.now() };
    setHistory((prev) => [...prev, userMsg]);
    setThinking(true);

    try {
      let response = "";
      if (activeAgent === "erebus" && erebusCoreRef.current) {
        const result = await erebusCoreRef.current.process(msg);
        response = result.text || result.content || "Done.";
      } else if (activeAgent === "kranos" && kranosReady) {
        const Kranos = await getKranos();
        const result = await Kranos.think(msg);
        response = result.response || "Done.";
      } else {
        // Call worker LLM endpoint
        const res = await fetch(`${WORKER}/api/llm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: msg,
            systemPrompt: agent.system,
            model,
          }),
        });
        const data = await res.json().catch(() => ({}));
        response = data.text || data.content || "No response";
      }

      const assistantMsg = { role: "assistant" as const, content: response, time: Date.now() };
      setHistory((prev) => [...prev, assistantMsg]);
      speak(response);
    } catch (e: any) {
      const errorMsg = { role: "assistant" as const, content: `Error: ${e?.message || "Failed"}`, time: Date.now() };
      setHistory((prev) => [...prev, errorMsg]);
    } finally {
      setThinking(false);
    }
  }, [activeAgent, erebusReady, kranosReady, model, agent.system, speak]);

  const sendMsg = useCallback(() => {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    sendMsgWith(msg);
  }, [input, sendMsgWith]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const dockPos: React.CSSProperties = pos.x !== null && pos.y !== null
    ? { position: "fixed", left: pos.x, top: pos.y }
    : { position: "fixed", bottom: 20, right: 20 };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes dockIn   {from{opacity:0;transform:translateY(16px) scale(0.93)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes dotBlink {0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes scanLine {0%{top:8%;opacity:0}20%{opacity:1}80%{opacity:1}100%{top:88%;opacity:0}}
        .az-msg-scroll::-webkit-scrollbar{width:2px}
        .az-msg-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:1px}
        .az-msg-scroll::-webkit-scrollbar-track{background:transparent}
        .az-scanline{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,currentColor,transparent);opacity:0;animation:scanLine 3s linear infinite;pointer-events:none}
        .az-pulse{animation:dotBlink 1.2s ease-in-out infinite}
      `}</style>

      {/* Toggle Button */}
      <button
        ref={dockRef}
        onClick={() => setOpen(!open)}
        onMouseDown={(e) => {
          if (e.button === 0) {
            setDragging(true);
            setDragOffset({ x: e.clientX, y: e.clientY });
            e.preventDefault();
          }
        }}
        style={dockPos}
        className="z-50 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-xl border border-white/10 backdrop-blur-sm"
        aria-label={open ? "Close Agent Dock" : "Open Agent Dock"}
      >
        <img
          src={agent.img}
          alt={agent.label}
          className="w-7 h-7 rounded-lg object-cover"
          style={{ filter: `drop-shadow(0 0 8px ${agent.color})` }}
        />
      </button>

      {/* Dragging logic */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: dragging ? 9999 : -1,
          pointerEvents: dragging ? "auto" : "none",
        }}
        onMouseMove={(e) => {
          if (dragging && pos.x !== null && pos.y !== null) {
            const newX = pos.x + (e.clientX - dragOffset.x);
            const newY = pos.y + (e.clientY - dragOffset.y);
            setPos({ x: clamp(newX, 0, window.innerWidth - 56), y: clamp(newY, 0, window.innerHeight - 56) });
            setDragOffset({ x: e.clientX, y: e.clientY });
          }
        }}
        onMouseUp={() => { if (dragging) setDragging(false); }}
        onMouseLeave={() => { if (dragging) setDragging(false); }}
      />

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-40 w-full max-w-md lg:w-96 h-[600px] max-h-[80vh] glass rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-dockIn"
          style={{ animationDuration: "0.35s" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 relative overflow-hidden">
            <div className="absolute inset-0" aria-hidden="true">
              <div className="az-scanline" style={{ color: agent.color }} />
            </div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${agent.color}22, ${agent.color}44)` }}>
                <img src={agent.img} alt={agent.label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white/10" style={{ background: agent.color }} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">{agent.label}</h3>
                <p className="text-[10px] text-white/40 font-display tracking-widest uppercase">{agent.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 relative z-10">
              <button
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Switch agent"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </button>
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Select model"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {expanded ? (
                    <path d="M15 3h6v6M9 21H3v-6M3 9l12 12M21 9l-12 12"/>
                  ) : (
                    <path d="M3 3h6v6M21 3h-6v6M3 21h6v-6M21 21h-6v-6"/>
                  )}
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Avatar Picker */}
          {showAvatarPicker && (
            <div className="p-3 border-b border-white/10 bg-white/5 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2">
                {AVATARS.map((a) => {
                  const resolved = resolveAvatar(a, hubAgentsRef.current[a.id]);
                  const isActive = activeAgent === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => { setActiveAgent(a.id); setShowAvatarPicker(false); }}
                      className={`relative p-2 rounded-xl transition-all ${isActive ? "ring-2" : ""} border`}
                      style={{ borderColor: isActive ? resolved.color : "rgba(255,255,255,0.1)" }}
                    >
                      <img src={resolved.img} alt={resolved.label} className="w-full h-12 object-cover rounded-lg mx-auto" />
                      <span className="block text-[10px] text-center mt-1 text-white/70">{resolved.label}</span>
                      {isActive && <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ background: resolved.color }}>✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model Picker */}
          {showModelPicker && (
            <div className="p-3 border-b border-white/10 bg-white/5 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                    className={`p-2 rounded-lg text-left text-sm transition-colors border ${model === m.id ? "bg-primary/20" : "bg-white/5"} text-white/70`}
                    style={{ borderColor: model === m.id ? "currentColor" : "rgba(255,255,255,0.1)" }}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span className="ml-2 truncate block">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={msgRef} className="flex-1 overflow-y-auto p-4 space-y-3 az-msg-scroll" style={{ minHeight: 200 }}>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40 text-center py-12">
                <img src={agent.img} alt={agent.label} className="w-20 h-20 rounded-xl object-cover mb-4 opacity-50" style={{ filter: `drop-shadow(0 0 16px ${agent.color})` }} />
                <p className="font-medium text-white/60">Hey! I'm {agent.label}.</p>
                <p className="text-sm text-white/30 mt-1">{agent.subtitle}</p>
              </div>
            ) : (
              history.map((msg, i) => (
                <div key={i} className={`flex gap-3 max-w-[85%] animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`rounded-2xl px-4 py-3 max-w-[75%] ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white/10 text-white rounded-tl-none"}`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-[9px] opacity-50 mt-1 text-right">{formatTime(msg.time)}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={msgRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            <div className="flex items-end gap-2">
              <button
                onClick={sttListening ? stopSTT : startSTT}
                disabled={!sttSupported}
                className={`p-2 rounded-lg flex-shrink-0 transition-colors ${sttListening ? "bg-primary/30 text-primary" : "text-white/50 hover:text-white hover:bg-white/10"}`}
                aria-label={sttListening ? "Stop listening" : "Voice input"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-6-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
              </button>
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  id="agentdock-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={`Ask ${agent.label}...`}
                  disabled={thinking}
                  className="w-full h-10 pl-4 pr-10 py-0 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/10 text-sm"
                />
                <button
                  onClick={sendMsg}
                  disabled={!input.trim() || thinking}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </div>
              <button
                onClick={() => { setMuted(!muted); if (!muted) speechSynthesis.cancel(); }}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {muted ? (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </>
                  ) : (
                    <>
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
            {thinking && (
              <div className="flex items-center gap-2 text-[10px] text-white/40 mt-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>{agent.label} is thinking...</span>
              </div>
            )}
            {sttError && (
              <div className="text-[10px] text-primary/80 mt-2">{sttError}</div>
            )}
          </div>
        </div>
      )}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}