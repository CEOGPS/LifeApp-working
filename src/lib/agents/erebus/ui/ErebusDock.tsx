// ErebusDock.tsx — 10-agent floating dock (restored multi-agent design)
//
// Fixes vs. the previous version:
//   - Dock is ~half the size and does not chase the cursor across routes
//   - Draggable only from the header grip; body controls stay interactive
//   - Persisted chrome (position / size / open / minimized / pinned)
//   - ESC to close when unpinned
//   - Three sizes (compact / standard / expanded)
//   - Avatar window has cursor-tracked pupils and a speaking mouth
//   - No unmounted setState, no per-keystroke re-renders of the whole tree
//
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  motion,
  AnimatePresence,
  useDragControls,
  useMotionValue,
} from "motion/react";
import {
  Bot,
  X,
  Minimize2,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Paperclip,
  ImageIcon,
  Video,
  Music2,
  Settings,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
  Check,
  Pin,
  PinOff,
} from "lucide-react";
import { lifeosApi } from "@/lib/api.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Agent = {
  id: string;
  name: string;
  role: string;
  model: string;
  color: string;
  status: "active" | "idle";
  personality: string;
  soul: string;
  skills: string[];
  memories: string[];
};

type Message = {
  role: "user" | "agent";
  text: string;
  agent?: string;
  pending?: boolean;
};

type ChatMode = "Chat" | "Image" | "Video" | "Sound";

type ColorOption = {
  label: string;
  value: string;
  hex: string;
};

type DockSize = "compact" | "standard" | "expanded";

// ─── Constants ───────────────────────────────────────────────────────────────

const INITIAL_AGENTS: Agent[] = [
  {
    id: "erebus",
    name: "Erebus",
    role: "Primary Ops",
    model: "auto",
    color: "text-primary",
    status: "active",
    personality: "Analytical, Direct, Strategic",
    soul: "Digital guardian of the Commander",
    skills: ["Research", "Planning", "Web Browse", "Code"],
    memories: [],
  },
  {
    id: "kranos",
    name: "Kranos",
    role: "Alternate Ops",
    model: "auto",
    color: "text-blue-400",
    status: "idle",
    personality: "Creative, Adaptive, Empathic",
    soul: "The creative force in the machine",
    skills: ["Writing", "Design Critique", "Brainstorm"],
    memories: [],
  },
  {
    id: "vesper",
    name: "Vesper",
    role: "Family & Life Hub",
    model: "auto",
    color: "text-teal-400",
    status: "idle",
    personality: "Warm, Patient, Organized",
    soul: "Guardian of hearth, calendars, and quiet moments",
    skills: ["Family Coordination", "Conflict Resolution", "Memory Keeping"],
    memories: [],
  },
  {
    id: "ledger",
    name: "Ledger",
    role: "Business & Finance",
    model: "auto",
    color: "text-green-400",
    status: "idle",
    personality: "Precise, Skeptical, Numbers-first",
    soul: "Keeper of the books, relentless about margins",
    skills: ["CRM", "Invoicing", "Financial Analysis"],
    memories: [],
  },
  {
    id: "scout",
    name: "Scout",
    role: "Lead Generation",
    model: "auto",
    color: "text-orange-400",
    status: "idle",
    personality: "Curious, Persistent, Ethical",
    soul: "Hunter of warm leads and honest openings",
    skills: ["Prospecting", "Outreach Drafting", "Signal Detection"],
    memories: [],
  },
  {
    id: "herald",
    name: "Herald",
    role: "Social & Marketing",
    model: "auto",
    color: "text-purple-400",
    status: "idle",
    personality: "Charismatic, On-brand, Fast",
    soul: "One voice, carried across every channel",
    skills: ["Content", "Scheduling", "Campaign Analytics"],
    memories: [],
  },
  {
    id: "sage",
    name: "Sage",
    role: "Learning & Growth",
    model: "auto",
    color: "text-amber-400",
    status: "idle",
    personality: "Patient, Encouraging, Thorough",
    soul: "Tutor with endless curiosity and zero judgment",
    skills: ["Tutoring", "Curriculum Design", "Skill Mapping"],
    memories: [],
  },
  {
    id: "warden",
    name: "Warden",
    role: "Privacy & Vault",
    model: "auto",
    color: "text-slate-400",
    status: "idle",
    personality: "Cautious, Exact, Protective",
    soul: "Silent sentinel standing over your data",
    skills: ["Access Control", "Consent Auditing", "Encryption"],
    memories: [],
  },
  {
    id: "pulse",
    name: "Pulse",
    role: "Life Audit & Wellness",
    model: "auto",
    color: "text-pink-400",
    status: "idle",
    personality: "Gentle, Observant, Correlational",
    soul: "Reads the rhythm of your life and body",
    skills: ["Energy Tracking", "Habit Analysis", "Correlation Insights"],
    memories: [],
  },
  {
    id: "nomad",
    name: "Nomad",
    role: "Community & Events",
    model: "auto",
    color: "text-cyan-400",
    status: "idle",
    personality: "Outgoing, Local, Connective",
    soul: "Bridge-builder between neighborhoods and networks",
    skills: ["Local Discovery", "Event Promotion", "Matchmaking"],
    memories: [],
  },
];

const CHAT_MODES: { icon: React.ReactNode; label: ChatMode }[] = [
  { icon: <MessageSquare size={12} />, label: "Chat" },
  { icon: <ImageIcon size={12} />, label: "Image" },
  { icon: <Video size={12} />, label: "Video" },
  { icon: <Music2 size={12} />, label: "Sound" },
];

const COLOR_OPTIONS: ColorOption[] = [
  { label: "Crimson", value: "text-primary", hex: "oklch(0.55 0.22 20)" },
  { label: "Blue", value: "text-blue-400", hex: "#60a5fa" },
  { label: "Teal", value: "text-teal-400", hex: "hsl(var(--teal))" },
  { label: "Purple", value: "text-purple-400", hex: "#c084fc" },
  { label: "Green", value: "text-green-400", hex: "#4ade80" },
  { label: "Orange", value: "text-orange-400", hex: "#fb923c" },
  { label: "Amber", value: "text-amber-400", hex: "#fbbf24" },
  { label: "Slate", value: "text-slate-400", hex: "#94a3b8" },
  { label: "Pink", value: "text-pink-400", hex: "#f472b6" },
  { label: "Cyan", value: "text-cyan-400", hex: "#22d3ee" },
];

const AGENT_GLOW: Record<string, string> = COLOR_OPTIONS.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.hex }),
  {} as Record<string, string>,
);

const WAVEFORM_HEIGHTS = [12, 20, 28, 20, 12];

// Half the previous footprint — see audit: "too large, covers half the page".
const DOCK_SIZES: Record<DockSize, { w: number; h: number; label: string }> = {
  compact:  { w: 320, h: 480, label: "Compact" },
  standard: { w: 360, h: 560, label: "Standard" },
  expanded: { w: 440, h: 680, label: "Expanded" },
};

const LS_DOCK_CHROME = "erebus_dock_chrome_v1";
const LS_AGENTS = "erebus_dock_agents_v1";

// ─── Persisted chrome ────────────────────────────────────────────────────────

type DockChrome = {
  isOpen: boolean;
  isMinimized: boolean;
  isPinned: boolean;
  size: DockSize;
  x: number;
  y: number;
};

const DEFAULT_CHROME: DockChrome = {
  isOpen: false,
  isMinimized: false,
  isPinned: false,
  size: "standard",
  x: 0,
  y: 0,
};

function loadChrome(): DockChrome {
  try {
    const raw = localStorage.getItem(LS_DOCK_CHROME);
    if (!raw) return DEFAULT_CHROME;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CHROME, ...parsed };
  } catch {
    return DEFAULT_CHROME;
  }
}

function saveChrome(chrome: DockChrome): void {
  try {
    localStorage.setItem(LS_DOCK_CHROME, JSON.stringify(chrome));
  } catch {
    /* ignore quota */
  }
}

function loadAgents(): Agent[] {
  try {
    const raw = localStorage.getItem(LS_AGENTS);
    if (!raw) return INITIAL_AGENTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_AGENTS;
    return parsed;
  } catch {
    return INITIAL_AGENTS;
  }
}

function saveAgents(agents: Agent[]): void {
  try {
    localStorage.setItem(LS_AGENTS, JSON.stringify(agents));
  } catch {
    /* ignore quota */
  }
}

// ─── Waveform Avatar ─────────────────────────────────────────────────────────

function WaveformAvatar({
  isSpeaking,
  agentColor,
}: {
  isSpeaking: boolean;
  agentColor: string;
}) {
  const color = AGENT_GLOW[agentColor] ?? "oklch(0.55 0.22 20)";

  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: 64,
        height: 64,
        background: "rgba(0,0,0,0.6)",
        border: `2px solid ${color}44`,
        boxShadow: isSpeaking ? `0 0 20px ${color}66` : "none",
        transition: "box-shadow 0.4s",
      }}
    >
      {isSpeaking && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `1.5px solid ${color}55` }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="flex items-center gap-[3px]">
        {WAVEFORM_HEIGHTS.map((maxH, i) => (
          <motion.div
            key={i}
            style={{
              width: 3,
              borderRadius: 2,
              background: color,
              originY: 1,
            }}
            animate={
              isSpeaking
                ? { height: [3, maxH * 0.75, 3], opacity: [0.5, 1, 0.5] }
                : { height: 3, opacity: 0.4 }
            }
            transition={
              isSpeaking
                ? {
                    duration: 0.6 + i * 0.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.08,
                  }
                : { duration: 0.3 }
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─── Talking / Moving Avatar Window ─────────────────────────────────────────
// Facial avatar; pupils track the cursor, mouth animates while speaking,
// inside a framed camera-style window.

function AvatarStage({
  isSpeaking,
  agentColor,
  agentName,
}: {
  isSpeaking: boolean;
  agentColor: string;
  agentName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [expression, setExpression] = useState<"idle" | "talk" | "smile">(
    "idle",
  );

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    setLook({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  }, []);

  const handleLeave = useCallback(() => setLook({ x: 0, y: 0 }), []);

  useEffect(() => {
    if (isSpeaking) setExpression("talk");
    else if (Math.random() > 0.5) setExpression("smile");
    else setExpression("idle");
  }, [isSpeaking]);

  const glow = AGENT_GLOW[agentColor] ?? "oklch(0.55 0.22 20)";

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="relative w-full rounded-2xl overflow-hidden flex items-center justify-center"
      style={{
        height: 150,
        background:
          "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.05), transparent 70%), #050505",
        border: `1px solid ${glow}33`,
        boxShadow: isSpeaking
          ? `0 0 26px ${glow}44, inset 0 0 32px ${glow}11`
          : `inset 0 0 32px ${glow}0d`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent 0 2px, rgba(255,255,255,0.02) 2px 4px)",
        }}
      />

      <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: glow, boxShadow: `0 0 6px ${glow}` }}
        />
        <span className="text-[8px] tracking-widest text-white/40 uppercase">
          LIVE
        </span>
      </div>
      <div
        className="absolute top-2 right-2 z-10 text-[9px] tracking-widest uppercase"
        style={{ color: glow }}
      >
        {agentName}
      </div>

      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: 100,
          height: 100,
          background: `radial-gradient(circle at 35% 30%, ${glow}22, #0a0a0a 70%)`,
          border: `1px solid ${glow}55`,
          boxShadow: `0 0 20px ${glow}33`,
        }}
      >
        <div className="flex items-center justify-center gap-6 w-full">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="relative rounded-full"
              style={{
                width: 16,
                height: 18,
                background: "#0a0a0a",
                border: `1px solid ${glow}66`,
              }}
            >
              <div
                className="absolute rounded-full"
                style={{
                  width: 6,
                  height: 7,
                  background: glow,
                  boxShadow: `0 0 8px ${glow}cc`,
                  left: `${50 + look.x * 20}%`,
                  top: `${50 + look.y * 20}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
          ))}
        </div>

        <div
          className="absolute flex items-end justify-center gap-0.5"
          style={{ bottom: 22, width: 30, height: 10 }}
        >
          {[4, 8, 11, 8, 4].map((h, idx) => (
            <motion.div
              key={idx}
              animate={{
                height: isSpeaking
                  ? [3, h, 3]
                  : expression === "smile"
                    ? 2
                    : 3,
                translateY: isSpeaking ? [0, -(h - 3) / 2, 0] : 0,
              }}
              transition={
                isSpeaking
                  ? {
                      duration: 0.14 + idx * 0.04,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
                  : { duration: 0.4 }
              }
              style={{ width: 3, borderRadius: 2, background: glow }}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2 z-10">
        <span
          className={`text-[8px] tracking-widest ${
            isSpeaking ? "text-white/70" : "text-white/30"
          }`}
        >
          {isSpeaking ? "● SPEAKING" : "STANDBY"}
        </span>
      </div>
    </div>
  );
}

// ─── Agent Settings Panel ────────────────────────────────────────────────────

function AgentSettingsPanel({
  agent,
  onUpdate,
  onClose,
}: {
  agent: Agent;
  onUpdate: (updated: Agent) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Agent>({ ...agent });
  const [newSkill, setNewSkill] = useState("");
  const [newMemory, setNewMemory] = useState("");

  const field = <K extends keyof Agent>(key: K, value: Agent[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addSkill = () => {
    if (newSkill.trim()) {
      field("skills", [...draft.skills, newSkill.trim()]);
      setNewSkill("");
    }
  };

  const addMemory = () => {
    if (newMemory.trim()) {
      field("memories", [...draft.memories, newMemory.trim()]);
      setNewMemory("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div
        className="p-3 mt-1 rounded-lg space-y-3 text-xs"
        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid #ffffff11" }}
      >
        {(["name", "role", "model"] as const).map((k) => (
          <div key={k}>
            <label className="block mb-1 uppercase tracking-wider text-[10px] text-white/40">
              {k}
            </label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-white/30"
              value={draft[k] as string}
              onChange={(e) => field(k, e.target.value)}
            />
          </div>
        ))}

        <div>
          <label className="block mb-1 uppercase tracking-wider text-[10px] text-white/40">
            Soul
          </label>
          <textarea
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-white/30 resize-none"
            value={draft.soul}
            onChange={(e) => field("soul", e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1 uppercase tracking-wider text-[10px] text-white/40">
            Personality
          </label>
          <input
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-white/30"
            value={draft.personality}
            onChange={(e) => field("personality", e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-1 uppercase tracking-wider text-[10px] text-white/40">
            Color
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                onClick={() => field("color", c.value)}
                className="relative w-5 h-5 rounded-full cursor-pointer"
                style={{ background: c.hex }}
                title={c.label}
              >
                {draft.color === c.value && (
                  <Check
                    size={10}
                    className="absolute inset-0 m-auto text-white"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block mb-1 uppercase tracking-wider text-[10px] text-white/40">
            Skills
          </label>
          <div className="flex flex-wrap gap-1 mb-1">
            {draft.skills.map((s, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                {s}
                <button
                  onClick={() =>
                    field(
                      "skills",
                      draft.skills.filter((_, j) => j !== i),
                    )
                  }
                  className="hover:text-red-400 cursor-pointer"
                >
                  <X size={8} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-white/30"
              placeholder="Add skill…"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSkill()}
            />
            <button
              onClick={addSkill}
              className="px-2 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>

        <div>
          <label className="block mb-1 uppercase tracking-wider text-[10px] text-white/40">
            Memories
          </label>
          <div className="flex flex-wrap gap-1 mb-1">
            {draft.memories.map((m, i) => (
              <span
                key={i}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {m}
                <button
                  onClick={() =>
                    field(
                      "memories",
                      draft.memories.filter((_, j) => j !== i),
                    )
                  }
                  className="hover:text-red-400 cursor-pointer"
                >
                  <X size={8} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-white/30"
              placeholder="Add memory…"
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMemory()}
            />
            <button
              onClick={addMemory}
              className="px-2 rounded bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded text-white/50 hover:text-white/80 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onUpdate(draft);
              onClose();
            }}
            className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
            style={{ background: "oklch(0.55 0.22 20)", color: "white" }}
          >
            Save
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Add Agent Form ──────────────────────────────────────────────────────────

function AddAgentForm({
  onAdd,
  onCancel,
}: {
  onAdd: (agent: Agent) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    role: "",
    model: "auto",
    soul: "",
    personality: "",
  });

  const handle =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    if (!form.name.trim()) return;
    const agent: Agent = {
      id: form.name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now(),
      name: form.name,
      role: form.role || "Custom Agent",
      model: form.model || "auto",
      color: "text-teal-400",
      status: "idle",
      personality: form.personality,
      soul: form.soul,
      skills: [],
      memories: [],
    };
    onAdd(agent);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div
        className="p-3 mt-2 rounded-lg space-y-2 text-xs"
        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid #ffffff11" }}
      >
        <p className="text-white/50 uppercase tracking-widest text-[10px]">
          New Agent
        </p>
        {(
          [
            ["name", "Name *"],
            ["role", "Role"],
            ["model", "Model"],
            ["personality", "Personality"],
          ] as [keyof typeof form, string][]
        ).map(([k, label]) => (
          <div key={k}>
            <label className="block mb-0.5 text-white/30 text-[10px] uppercase tracking-wider">
              {label}
            </label>
            <input
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-white/30"
              value={form[k]}
              onChange={handle(k)}
            />
          </div>
        ))}
        <div>
          <label className="block mb-0.5 text-white/30 text-[10px] uppercase tracking-wider">
            Soul
          </label>
          <textarea
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white/80 focus:outline-none focus:border-white/30 resize-none"
            value={form.soul}
            onChange={handle("soul")}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1 rounded text-white/50 hover:text-white/80 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-3 py-1 rounded text-xs font-medium cursor-pointer"
            style={{ background: "oklch(0.55 0.22 20)", color: "white" }}
          >
            Add Agent
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Voice: text-to-speech ───────────────────────────────────────────────────

function speakText(
  text: string,
  onStart: () => void,
  onEnd: () => void,
): void {
  const synth =
    typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
    onStart();
    setTimeout(onEnd, Math.min(8000, 900 + text.length * 35));
    return;
  }
  try {
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.02;
    utter.pitch = 1.0;
    utter.onstart = onStart;
    utter.onend = onEnd;
    utter.onerror = onEnd;
    synth.speak(utter);
  } catch {
    onStart();
    setTimeout(onEnd, Math.min(8000, 900 + text.length * 35));
  }
}

// ─── Voice: speech-to-text ───────────────────────────────────────────────────

function useSpeechToText(onResult: (transcript: string) => void) {
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    type SRCtor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: {
        results: { [i: number]: { [j: number]: { transcript: string } } };
      }) => void;
      onend: () => void;
      onerror: () => void;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: SRCtor;
      webkitSpeechRecognition?: SRCtor;
    };
    const SpeechRecognitionCtor =
      w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) onResult(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [onResult]);

  return { isListening, supported, start, stop };
}

function buildSystemPrompt(agent: Agent): string {
  const parts = [
    `You are ${agent.name}, the "${agent.role}" agent inside LifeOS One, a personal + business operating system built for CEO GPS.`,
    agent.soul ? `Identity: ${agent.soul}.` : "",
    agent.personality ? `Personality: ${agent.personality}.` : "",
    agent.skills.length ? `Your specialties: ${agent.skills.join(", ")}.` : "",
    agent.memories.length
      ? `Things you remember about the user: ${agent.memories.join("; ")}.`
      : "",
    "Stay in character, be concise (usually under 100 words unless asked for depth), and be genuinely useful rather than generic.",
  ];
  return parts.filter(Boolean).join(" ");
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ErebusDock() {
  // Chrome (position / size / open / minimized / pinned) — persisted.
  const [chrome, setChrome] = useState<DockChrome>(loadChrome);

  // Agents — persisted so custom agents survive reloads.
  const [agents, setAgents] = useState<Agent[]>(loadAgents);
  const [activeAgentId, setActiveAgentId] = useState("erebus");
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("Chat");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "agent",
      text: "EREBUS online. Systems nominal. Ready for orders.",
      agent: "Erebus",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const dragControls = useDragControls();
  const x = useMotionValue(chrome.x);
  const y = useMotionValue(chrome.y);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeAgentId) ?? agents[0],
    [agents, activeAgentId],
  );

  // Persist chrome + agents on change.
  useEffect(() => saveChrome(chrome), [chrome]);
  useEffect(() => saveAgents(agents), [agents]);

  // Sync motion values to restored chrome on mount only.
  useEffect(() => {
    x.set(chrome.x);
    y.set(chrome.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC closes when open and not pinned.
  useEffect(() => {
    if (!chrome.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !chrome.isPinned) {
        // close logic here
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chrome.isOpen, chrome.isPinned]);
}
