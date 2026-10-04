// src/pages/aihub/components/AgentForm.tsx
// ============================================================================
// AI Hub — AgentForm
//
// Shared editor for every agent. Used by Erebus, Kranos, and the Agents
// section. Writes only through the onChange callback; no persistence here.
// Inline styles only. C from @/lib/palette. Radius 12 cards / 16 outer.
// ============================================================================

import { useState, useRef, useCallback } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { C } from "@/lib/palette";
import type {
  Agent,
  AgentAvatar,
  AgentInstruction,
  AgentKnowledge,
  AgentMemory,
  AgentType,
} from "./types";
import {
  makeInstruction,
  makeKnowledge,
  makeMemory,
} from "./storage";

// ── Shared style tokens ──────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.teal,
  marginBottom: 6,
};

const FIELD: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "8px 10px",
  color: C.text,
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
};

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
};

const ROW: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
};

// ── Avatar picker ────────────────────────────────────────────────────────────
// Three modes: emoji character, Lucide icon name, image URL. Exactly one is
// the "active" mode at a time. No uploads — localStorage quota.

type AvatarMode = "emoji" | "icon" | "img";

interface AvatarPickerProps {
  value: AgentAvatar;
  onChange: (next: AgentAvatar) => void;
  accent: string;
}

function AvatarPicker({ value, onChange, accent }: AvatarPickerProps) {
  const [mode, setMode] = useState<AvatarMode>(
    value.img ? "img" : value.emoji ? "emoji" : "icon",
  );

  const setModeAndClear = useCallback(
    (m: AvatarMode) => {
      setMode(m);
      if (m === "emoji") onChange({ emoji: value.emoji || "◈", facePos: value.facePos });
      else if (m === "icon") onChange({ iconName: value.iconName || "Bot", facePos: value.facePos });
      else onChange({ img: value.img || "", facePos: value.facePos || "50% 15%" });
    },
    [onChange, value.emoji, value.iconName, value.img, value.facePos],
  );

  return (
    <div>
      <div style={{ ...LABEL }}>Avatar</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["emoji", "icon", "img"] as AvatarMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModeAndClear(m)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
              background: mode === m ? `${accent}22` : "rgba(255,255,255,0.03)",
              border: `1px solid ${mode === m ? accent : "rgba(255,255,255,0.08)"}`,
              color: mode === m ? accent : C.muted,
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "emoji" && (
        <input
          style={FIELD}
          value={value.emoji ?? ""}
          placeholder="◈"
          maxLength={4}
          onChange={(e) => onChange({ ...value, emoji: e.target.value, img: undefined, iconName: undefined })}
        />
      )}

      {mode === "icon" && (
        <input
          style={FIELD}
          value={value.iconName ?? ""}
          placeholder="Bot, Sparkles, Zap…"
          onChange={(e) => onChange({ ...value, iconName: e.target.value, img: undefined, emoji: undefined })}
        />
      )}

      {mode === "img" && (
        <>
          <input
            style={FIELD}
            value={value.img ?? ""}
            placeholder="/agents/Erebus.png or https://…"
            onChange={(e) => onChange({ ...value, img: e.target.value, emoji: undefined, iconName: undefined })}
          />
          <input
            style={{ ...FIELD, marginTop: 6 }}
            value={value.facePos ?? ""}
            placeholder="50% 15%  (object-position)"
            onChange={(e) => onChange({ ...value, facePos: e.target.value })}
          />
        </>
      )}
    </div>
  );
}

// ── List editors: skills, knowledge, memories, instructions ──────────────────

interface TagListProps {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  accent: string;
}

function TagList({ items, onChange, placeholder, accent }: TagListProps) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, t]);
    setDraft("");
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {items.map((it, i) => (
          <span
            key={`${it}-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 11,
              color: C.t2,
            }}
          >
            {it}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: C.muted,
                display: "inline-flex",
              }}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span style={{ fontSize: 11, color: C.dim }}>None yet</span>
        )}
      </div>
      <div style={ROW}>
        <input
          style={{ ...FIELD, flex: 1 }}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button
          type="button"
          onClick={commit}
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}66`,
            borderRadius: 8,
            padding: "8px 10px",
            color: accent,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

interface KnowledgeListProps {
  items: AgentKnowledge[];
  onChange: (next: AgentKnowledge[]) => void;
  accent: string;
}

function KnowledgeList({ items, onChange, accent }: KnowledgeListProps) {
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");

  const commit = () => {
    const l = label.trim();
    const c = content.trim();
    if (!l && !c) return;
    onChange([...items, makeKnowledge(l || "Untitled", c)]);
    setLabel("");
    setContent("");
  };

  return (
    <div>
      {items.map((k) => (
        <div
          key={k.id}
          style={{
            display: "flex",
            gap: 8,
            padding: "6px 8px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            marginBottom: 6,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 700 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.4, wordBreak: "break-word" }}>
              {k.content}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.id !== k.id))}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.muted }}
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <input
        style={{ ...FIELD, marginBottom: 6 }}
        value={label}
        placeholder="Label (e.g. Company address)"
        onChange={(e) => setLabel(e.target.value)}
      />
      <textarea
        style={{ ...FIELD, minHeight: 54, resize: "vertical", marginBottom: 6 }}
        value={content}
        placeholder="Content"
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        type="button"
        onClick={commit}
        style={{
          background: `${accent}22`,
          border: `1px solid ${accent}66`,
          borderRadius: 8,
          padding: "6px 12px",
          color: accent,
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + ADD KNOWLEDGE
      </button>
    </div>
  );
}

interface MemoryListProps {
  items: AgentMemory[];
  onChange: (next: AgentMemory[]) => void;
  accent: string;
}

function MemoryList({ items, onChange, accent }: MemoryListProps) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, makeMemory(t)]);
    setDraft("");
  };

  return (
    <div>
      {items.length === 0 && (
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
          No memories stored
        </div>
      )}
      {items.map((m) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            padding: "6px 8px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            marginBottom: 6,
          }}
        >
          <span style={{ flex: 1, fontSize: 11, color: C.t2, lineHeight: 1.5, wordBreak: "break-word" }}>
            {m.text}
          </span>
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.id !== m.id))}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.muted }}
          >
            <X size={11} />
          </button>
        </div>
      ))}
      <div style={ROW}>
        <input
          style={{ ...FIELD, flex: 1 }}
          value={draft}
          placeholder="Add memory…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button
          type="button"
          onClick={commit}
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}66`,
            borderRadius: 8,
            padding: "8px 10px",
            color: accent,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

interface InstructionListProps {
  items: AgentInstruction[];
  onChange: (next: AgentInstruction[]) => void;
  accent: string;
}

function InstructionList({ items, onChange, accent }: InstructionListProps) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, makeInstruction(t)]);
    setDraft("");
  };

  return (
    <div>
      {items.map((ins, i) => (
        <div key={ins.id} style={{ ...ROW, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: C.dim, minWidth: 18, marginTop: 9 }}>
            {i + 1}.
          </span>
          <input
            style={{ ...FIELD, flex: 1 }}
            value={ins.text}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === ins.id ? { ...x, text: e.target.value } : x)))
            }
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.id !== ins.id))}
            style={{
              background: "none",
              border: "none",
              padding: "8px 0 0 0",
              cursor: "pointer",
              color: C.muted,
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <div style={ROW}>
        <input
          style={{ ...FIELD, flex: 1 }}
          value={draft}
          placeholder="Add instruction…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button
          type="button"
          onClick={commit}
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}66`,
            borderRadius: 8,
            padding: "8px 10px",
            color: accent,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Color palette (mirrors COLOR_OPTIONS in ErebusDock.tsx) ──────────────────
// Do not extend. If a new color is needed, add it in AgentDock.tsx first.

interface ColorOpt { label: string; hex: string }

const COLOR_OPTIONS: ColorOpt[] = [
  { label: "Crimson", hex: "#dc143c" },
  { label: "Blue", hex: "#4ab3f4" },
  { label: "Teal", hex: "#00c896" },
  { label: "Purple", hex: "#8b7fff" },
  { label: "Green", hex: "#3dd68c" },
  { label: "Orange", hex: "#ff8c42" },
  { label: "Amber", hex: "#fbbf24" },
  { label: "Slate", hex: "#94a3b8" },
  { label: "Pink", hex: "#ff6bd6" },
  { label: "Cyan", hex: "#22d3ee" },
];

// ── Main form ────────────────────────────────────────────────────────────────

export interface AgentFormProps {
  agent: Agent;
  onChange: (next: Agent) => void;
  /**
   * When true, the id / type / hierarchy fields are locked. Used by the
   * Erebus and Kranos sections where the identity is fixed.
   */
  lockIdentity?: boolean;
  /** Optional delete handler. If provided, a Delete button renders at the bottom. */
  onDelete?: () => void;
  /** Optional extra content rendered under the action row. */
  footer?: React.ReactNode;
}

export default function AgentForm({
  agent,
  onChange,
  lockIdentity = false,
  onDelete,
  footer,
}: AgentFormProps) {
  const accent = agent.color || "#9b72cf";
  const set = <K extends keyof Agent>(key: K, value: Agent[K]) =>
    onChange({ ...agent, [key]: value });

  const setAvatar = (next: AgentAvatar) => set("avatar", next);
  const setVoice = (patch: Partial<Agent["voice"]>) =>
    set("voice", { ...agent.voice, ...patch });

  const confirmDelete = useRef<() => void>(() => {});
  confirmDelete.current = () => {
    if (!onDelete) return;
    const ok = window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`);
    if (ok) onDelete();
  };

  return (
    <div style={{ ...CARD, borderRadius: 16, padding: 16 }}>
      {/* ── Identity ── */}
      <div style={CARD}>
        <div style={LABEL}>Identity</div>
        <input
          style={{ ...FIELD, marginBottom: 8, opacity: lockIdentity ? 0.5 : 1 }}
          value={agent.name}
          placeholder="Name"
          readOnly={lockIdentity}
          onChange={(e) => set("name", e.target.value)}
        />
        <input
          style={{ ...FIELD, marginBottom: 8 }}
          value={agent.tagline}
          placeholder="Tagline (e.g. Autonomous Core)"
          onChange={(e) => set("tagline", e.target.value)}
        />
        <input
          style={{ ...FIELD, marginBottom: 8 }}
          value={agent.role}
          placeholder="Role (e.g. Primary Operational Agent)"
          onChange={(e) => set("role", e.target.value)}
        />
        {!lockIdentity && (
          <select
            style={{ ...FIELD, marginBottom: 8 }}
            value={agent.type}
            onChange={(e) => set("type", e.target.value as AgentType)}
          >
            <option value="autonomous">Autonomous (own runtime)</option>
            <option value="worker">Worker (Cloudflare /api/llm/invoke)</option>
            <option value="model-backend">Model backend (Hermes / Qwen style)</option>
          </select>
        )}
        <input
          style={{ ...FIELD }}
          value={agent.model}
          placeholder="Model (auto, groq, gemini, deepseek…)"
          onChange={(e) => set("model", e.target.value)}
        />
      </div>

      {/* ── Avatar + color ── */}
      <div style={CARD}>
        <AvatarPicker value={agent.avatar} onChange={setAvatar} accent={accent} />

        <div style={{ ...LABEL, marginTop: 12 }}>Color</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => set("color", c.hex)}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: c.hex,
                border:
                  agent.color === c.hex
                    ? "2px solid #fff"
                    : "2px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                boxShadow:
                  agent.color === c.hex ? `0 0 10px ${c.hex}88` : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Personality / soul / story ── */}
      <div style={CARD}>
        <div style={LABEL}>Personality</div>
        <input
          style={{ ...FIELD, marginBottom: 10 }}
          value={agent.personality}
          placeholder="Analytical, Direct, Strategic"
          onChange={(e) => set("personality", e.target.value)}
        />

        <div style={LABEL}>Soul</div>
        <textarea
          style={{ ...FIELD, minHeight: 72, resize: "vertical", marginBottom: 10 }}
          value={agent.soul}
          placeholder="Define this agent's soul…"
          onChange={(e) => set("soul", e.target.value)}
        />

        <div style={LABEL}>Brief story</div>
        <textarea
          style={{ ...FIELD, minHeight: 60, resize: "vertical", marginBottom: 10 }}
          value={agent.story}
          placeholder="Backstory, origin, why this agent exists…"
          onChange={(e) => set("story", e.target.value)}
        />

        <div style={LABEL}>System prompt</div>
        <textarea
          style={{ ...FIELD, minHeight: 72, resize: "vertical" }}
          value={agent.systemPrompt}
          placeholder="Sent to the LLM as the system message…"
          onChange={(e) => set("systemPrompt", e.target.value)}
        />
      </div>

      {/* ── Skills ── */}
      <div style={CARD}>
        <div style={LABEL}>Skills</div>
        <TagList
          items={agent.skills}
          onChange={(next) => set("skills", next)}
          placeholder="Add skill…"
          accent={accent}
        />
      </div>

      {/* ── Knowledge ── */}
      <div style={CARD}>
        <div style={LABEL}>Knowledge</div>
        <KnowledgeList
          items={agent.knowledge}
          onChange={(next) => set("knowledge", next)}
          accent={accent}
        />
      </div>

      {/* ── Memories ── */}
      <div style={CARD}>
        <div style={LABEL}>Memories</div>
        <MemoryList
          items={agent.memories}
          onChange={(next) => set("memories", next)}
          accent={accent}
        />
      </div>

      {/* ── Instructions ── */}
      <div style={CARD}>
        <div style={LABEL}>Instructions</div>
        <InstructionList
          items={agent.instructions}
          onChange={(next) => set("instructions", next)}
          accent={accent}
        />
      </div>

      {/* ── Voice ── */}
      <div style={CARD}>
        <div style={LABEL}>Voice</div>
        <input
          style={{ ...FIELD, marginBottom: 6 }}
          value={agent.voice.tone}
          placeholder="Tone descriptor (deep, controlled, warm…)"
          onChange={(e) => setVoice({ tone: e.target.value })}
        />
        <input
          style={{ ...FIELD, marginBottom: 6 }}
          value={agent.voice.ttsVoiceId}
          placeholder="ElevenLabs voice ID (optional)"
          onChange={(e) => setVoice({ ttsVoiceId: e.target.value })}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
              Rate ({agent.voice.rate.toFixed(2)})
            </div>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={agent.voice.rate}
              onChange={(e) => setVoice({ rate: parseFloat(e.target.value) })}
              style={{ width: "100%", accentColor: accent }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
              Pitch ({agent.voice.pitch.toFixed(2)})
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={agent.voice.pitch}
              onChange={(e) => setVoice({ pitch: parseFloat(e.target.value) })}
              style={{ width: "100%", accentColor: accent }}
            />
          </div>
        </div>
      </div>

      {/* ── Hierarchy + status ── */}
      {!lockIdentity && (
        <div style={CARD}>
          <div style={LABEL}>Hierarchy</div>
          <input
            style={{ ...FIELD, marginBottom: 6 }}
            value={agent.parentId ?? ""}
            placeholder="Parent agent id (leave blank for top-level)"
            onChange={(e) => set("parentId", e.target.value.trim() || null)}
          />
          <select
            style={{ ...FIELD, marginBottom: 6 }}
            value={agent.hierarchyRole}
            onChange={(e) => set("hierarchyRole", e.target.value)}
          >
            <option value="commander">Commander</option>
            <option value="primary">Primary</option>
            <option value="sub">Sub</option>
            <option value="skin">Skin</option>
          </select>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: C.t2,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={agent.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
            />
            Enabled
          </label>
        </div>
      )}

      {/* ── Delete ── */}
      {onDelete && (
        <button
          type="button"
          onClick={() => confirmDelete.current?.()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(255,79,94,0.1)",
            border: "1px solid rgba(255,79,94,0.35)",
            borderRadius: 8,
            padding: "7px 12px",
            color: C.red,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Trash2 size={12} /> DELETE AGENT
        </button>
      )}

      {footer}
    </div>
  );
}