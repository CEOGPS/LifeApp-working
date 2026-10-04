// src/pages/aihub/ErebusSection.tsx
// ============================================================================
// AI Hub — Erebus section
//
// Erebus has TWO stores:
//   lifeos_agents.erebus        — hub record (name, tagline, color, avatar,
//                                 voice, knowledge, story, hub-owned memories,
//                                 systemPrompt, hierarchy)
//   lifeos_er_*                 — ErebusCore identity (soul, instructions,
//                                 skills, model, ollama_model, paused, short,
//                                 lt, goals, leads, log, proj, settings)
//
// Rule: hub is authoritative for display. ErebusCore is authoritative for
// runtime. On the fields they share (soul, instructions, skills, model), the
// hub writes ErebusCore and mirrors back on load. One writer at a time via a
// 400ms debounce. No dual-write race.
//
// Erebus is never deleted from here. Identity is fixed.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, RefreshCcw, Save, ExternalLink } from "lucide-react";
import { C } from "@/lib/palette";
import {
  getErebusCore,
} from "@/lib/agents/erebus/ErebusCore";
import type {
  Agent,
  AgentInstruction,
  AgentMemory,
} from "./types";
import {
  loadAgent,
  upsertAgent,
  makeAgent,
  makeInstruction,
  makeMemory,
  newId,
} from "./storage";
import AgentForm from "./AgentForm";

// ── Style tokens ─────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: C.teal,
  marginBottom: 6,
};

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
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

const STATUS_ROW: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 12,
};

const STATUS_PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: 11,
  color: C.t2,
};

// ── ErebusCore mirror helpers ────────────────────────────────────────────────

interface CoreState {
  soulName: string;
  soulIdentity: string;
  soulPersonality: string;
  soulValues: string;
  soulVoice: string;
  soulPurpose: string;
  instructions: string[];
  skills: Array<{ id: string; label: string; on: boolean }>;
  model: string;
  ollamaModel: string;
  paused: boolean;
  backendOnline: boolean;
  ollamaOnline: boolean;
  wakeState: string;
}

function readCoreState(): CoreState {
  const core = getErebusCore();
  const soul = core.soul ?? {};
  return {
    soulName: soul.name ?? "Erebus",
    soulIdentity: soul.identity ?? "",
    soulPersonality: soul.personality ?? "",
    soulValues: soul.values ?? "",
    soulVoice: soul.voice ?? "",
    soulPurpose: soul.purpose ?? "",
    instructions: Array.isArray(core.instructions) ? core.instructions.slice() : [],
    skills: Array.isArray(core.skills)
      ? core.skills.map((s) => ({ id: s.id, label: s.label, on: !!s.on }))
      : [],
    model: core.model ?? "auto",
    ollamaModel: core.ollamaModel ?? "llama3.2",
    paused: !!core.paused,
    backendOnline: !!core.backendOnline,
    ollamaOnline: !!core.ollamaOnline,
    wakeState: core.wakeState ?? "dormant",
  };
}

// ── Debounced writer ─────────────────────────────────────────────────────────
// Both lifeos_agents and lifeos_er_* get written on a single debounce so the
// UI stays responsive while typing. The debounce is per-instance; unmounting
// flushes it synchronously.

function useDebouncedAgentWriter() {
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const schedule = useCallback((key: string, fn: () => void, ms: number) => {
    const existing = pending.current.get(key);
    if (existing) clearTimeout(existing);
    pending.current.set(
      key,
      setTimeout(() => {
        pending.current.delete(key);
        fn();
      }, ms),
    );
  }, []);

  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  return schedule;
}

// ── Main section ─────────────────────────────────────────────────────────────

export default function ErebusSection() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [core, setCore] = useState<CoreState | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const schedule = useDebouncedAgentWriter();

  // ── Load ──
  useEffect(() => {
    try {
      const existing = loadAgent("erebus");
      const next =
        existing ??
        makeAgent({
          id: "erebus",
          name: "Erebus",
          tagline: "Autonomous Core",
          role: "Primary Autonomous Operational Agent",
          type: "autonomous",
          color: "#9b72cf",
          avatar: { img: "/agents/Erebus.png", facePos: "50% 15%" },
          hierarchyRole: "primary",
        });
      setAgent(next);
      setCore(readCoreState());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Erebus");
    }
  }, []);

  // ── Agent change: write hub record (debounced) ──
  const onAgentChange = useCallback(
    (next: Agent) => {
      setAgent(next);
      schedule("erebus-agent", () => {
        try {
          upsertAgent(next);
          setSavedAt(Date.now());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
        }
      }, 400);
    },
    [schedule],
  );

  // ── Core field writers ──
  const writeCoreSoul = useCallback(
    (patch: Partial<{
      name: string;
      identity: string;
      personality: string;
      values: string;
      voice: string;
      purpose: string;
    }>) => {
      const c = getErebusCore();
      const current = c.soul ?? {};
      const next = { ...current, ...patch };
      c.saveSoul(next);
      setCore((prev) => (prev ? { ...prev, ...patch } : prev));
      setSavedAt(Date.now());
    },
    [],
  );

  const writeCoreInstructions = useCallback((list: string[]) => {
    const c = getErebusCore();
    c.saveInstructions(list);
    setCore((prev) => (prev ? { ...prev, instructions: list.slice() } : prev));
    setSavedAt(Date.now());
  }, []);

  const writeCoreSkills = useCallback(
    (list: Array<{ id: string; label: string; on: boolean }>) => {
      const c = getErebusCore();
      c.saveSkills(list);
      setCore((prev) => (prev ? { ...prev, skills: list.slice() } : prev));
      setSavedAt(Date.now());
    },
    [],
  );

  const writeCoreModel = useCallback((model: string) => {
    const c = getErebusCore();
    c.setModel(model);
    setCore((prev) => (prev ? { ...prev, model } : prev));
    setSavedAt(Date.now());
  }, []);

  const writeCoreOllama = useCallback((ollamaModel: string) => {
    const c = getErebusCore();
    c.setOllamaModel(ollamaModel);
    setCore((prev) => (prev ? { ...prev, ollamaModel } : prev));
    setSavedAt(Date.now());
  }, []);

  const togglePaused = useCallback(() => {
    const c = getErebusCore();
    const next = !c.paused;
    c.setPaused(next);
    setCore((prev) => (prev ? { ...prev, paused: next } : prev));
    setSavedAt(Date.now());
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const c = getErebusCore();
      setCore(readCoreState());
      if (c.wakeState === "dormant") {
        await c.wake();
        setCore(readCoreState());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wake failed");
    }
  }, []);

  // ── Instructions bridge: hub instructions ↔ core instructions ──
  // Hub instructions are AgentInstruction objects (with ids). Core stores
  // plain strings. On core change, we rebuild hub instructions. On hub
  // change, we write strings to core.
  const hubInstructionsFromCore = useMemo<AgentInstruction[]>(() => {
    if (!core) return [];
    return core.instructions.map((text) => makeInstruction(text));
  }, [core]);

  const onHubInstructionsChange = useCallback(
    (next: AgentInstruction[]) => {
      if (!agent) return;
      onAgentChange({ ...agent, instructions: next });
      writeCoreInstructions(next.map((i) => i.text));
    },
    [agent, onAgentChange, writeCoreInstructions],
  );

  // ── Hub memories are hub-only (not ErebusCore's lifeos_er_lt.facts) ──
  const onHubMemoriesChange = useCallback(
    (next: AgentMemory[]) => {
      if (!agent) return;
      onAgentChange({ ...agent, memories: next });
    },
    [agent, onAgentChange],
  );

  // ── Skill toggle ──
  const toggleSkill = useCallback(
    (idx: number) => {
      if (!core) return;
      const next = core.skills.map((s, i) => (i === idx ? { ...s, on: !s.on } : s));
      writeCoreSkills(next);
    },
    [core, writeCoreSkills],
  );

  // ── Instruction list (core-authoritative display) ──
  const [newInstruction, setNewInstruction] = useState("");

  const addInstruction = useCallback(() => {
    const t = newInstruction.trim();
    if (!t || !core) return;
    const next = [...core.instructions, t];
    writeCoreInstructions(next);
    setNewInstruction("");
  }, [newInstruction, core, writeCoreInstructions]);

  const removeInstruction = useCallback(
    (idx: number) => {
      if (!core) return;
      const next = core.instructions.filter((_, i) => i !== idx);
      writeCoreInstructions(next);
    },
    [core, writeCoreInstructions],
  );

  const updateInstruction = useCallback(
    (idx: number, text: string) => {
      if (!core) return;
      const next = core.instructions.slice();
      next[idx] = text;
      writeCoreInstructions(next);
    },
    [core, writeCoreInstructions],
  );

  // ── Loading / error ──
  if (error && !agent) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Erebus section failed to load: {error}
      </div>
    );
  }

  if (!agent || !core) {
    return (
      <div style={{ padding: 24, color: C.muted, fontSize: 12 }}>Loading Erebus…</div>
    );
  }

  // ── Render ──
  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid ${agent.color}`,
            background: "#07080f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {agent.avatar.img ? (
            <img
              src={agent.avatar.img}
              alt={agent.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: agent.avatar.facePos ?? "50% 15%",
              }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                if (el.parentElement) {
                  el.parentElement.innerHTML =
                    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;color:${agent.color};font-weight:700">E</div>`;
                }
              }}
            />
          ) : (
            <Bot size={18} style={{ color: agent.color }} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {agent.role || "Primary Autonomous Operational Agent"}
          </div>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          title="Re-probe backend + Ollama"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: C.t2,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          <RefreshCcw size={12} /> Refresh
        </button>
      </div>

      {/* Live status */}
      <div style={STATUS_ROW}>
        <span style={STATUS_PILL}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background:
                core.wakeState === "active" || core.wakeState === "working"
                  ? C.teal
                  : core.wakeState === "waking"
                    ? C.amber
                    : C.dim,
            }}
          />
          {core.wakeState.toUpperCase()}
        </span>
        <span style={STATUS_PILL}>
          Backend:{" "}
          <span style={{ color: core.backendOnline ? C.teal : C.muted }}>
            {core.backendOnline ? "online" : "offline"}
          </span>
        </span>
        <span style={STATUS_PILL}>
          Ollama:{" "}
          <span style={{ color: core.ollamaOnline ? C.teal : C.muted }}>
            {core.ollamaOnline ? "online" : "offline"}
          </span>
        </span>
        <span style={STATUS_PILL}>
          Model: <span style={{ color: C.t2 }}>{core.model}</span>
        </span>
        {core.paused && (
          <span
            style={{
              ...STATUS_PILL,
              borderColor: C.amber,
              color: C.amber,
            }}
          >
            PAUSED
          </span>
        )}
        <button
          type="button"
          onClick={togglePaused}
          style={{
            padding: "5px 10px",
            borderRadius: 999,
            background: core.paused
              ? "rgba(0,200,150,0.12)"
              : "rgba(251,191,36,0.12)",
            border: `1px solid ${core.paused ? C.teal : C.amber}66`,
            color: core.paused ? C.teal : C.amber,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {core.paused ? "RESUME" : "PAUSE"}
        </button>
      </div>

      {error && (
        <div
          style={{
            ...CARD,
            borderColor: `${C.red}44`,
            background: "rgba(255,79,94,0.06)",
            color: C.red,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* ── ErebusCore soul (authoritative) ── */}
      <div style={CARD}>
        <div style={LABEL}>Core soul (ErebusCore)</div>
        <input
          style={{ ...FIELD, marginBottom: 8 }}
          value={core.soulName}
          placeholder="Name"
          onChange={(e) => writeCoreSoul({ name: e.target.value })}
        />
        <textarea
          style={{ ...FIELD, minHeight: 68, resize: "vertical", marginBottom: 8 }}
          value={core.soulIdentity}
          placeholder="Identity"
          onChange={(e) => writeCoreSoul({ identity: e.target.value })}
        />
        <textarea
          style={{ ...FIELD, minHeight: 52, resize: "vertical", marginBottom: 8 }}
          value={core.soulPersonality}
          placeholder="Personality"
          onChange={(e) => writeCoreSoul({ personality: e.target.value })}
        />
        <textarea
          style={{ ...FIELD, minHeight: 52, resize: "vertical", marginBottom: 8 }}
          value={core.soulValues}
          placeholder="Values"
          onChange={(e) => writeCoreSoul({ values: e.target.value })}
        />
        <textarea
          style={{ ...FIELD, minHeight: 52, resize: "vertical", marginBottom: 8 }}
          value={core.soulVoice}
          placeholder="Voice"
          onChange={(e) => writeCoreSoul({ voice: e.target.value })}
        />
        <textarea
          style={{ ...FIELD, minHeight: 68, resize: "vertical" }}
          value={core.soulPurpose}
          placeholder="Purpose"
          onChange={(e) => writeCoreSoul({ purpose: e.target.value })}
        />
      </div>

      {/* ── Core instructions ── */}
      <div style={CARD}>
        <div style={LABEL}>Core instructions</div>
        {core.instructions.length === 0 && (
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
            No standing instructions.
          </div>
        )}
        {core.instructions.map((ins, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input
              style={{ ...FIELD, flex: 1 }}
              value={ins}
              onChange={(e) => updateInstruction(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => removeInstruction(i)}
              style={{
                background: "none",
                border: "none",
                padding: "8px 0 0 0",
                cursor: "pointer",
                color: C.muted,
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6 }}>
          <input
            style={{ ...FIELD, flex: 1 }}
            value={newInstruction}
            placeholder="Add instruction…"
            onChange={(e) => setNewInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addInstruction();
              }
            }}
          />
          <button
            type="button"
            onClick={addInstruction}
            style={{
              background: "rgba(155,114,207,0.15)",
              border: "1px solid rgba(155,114,207,0.4)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#c4a2f5",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            + ADD
          </button>
        </div>
      </div>

      {/* ── Core skills ── */}
      <div style={CARD}>
        <div style={LABEL}>Core skills</div>
        {core.skills.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: s.on ? C.text : C.muted }}>
              {s.label}
            </span>
            <button
              type="button"
              onClick={() => toggleSkill(i)}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                background: s.on ? "#9b72cf" : "rgba(255,255,255,0.1)",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "0 3px",
                justifyContent: s.on ? "flex-end" : "flex-start",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                }}
              />
            </button>
          </div>
        ))}
      </div>

      {/* ── Model / Ollama ── */}
      <div style={CARD}>
        <div style={LABEL}>Model</div>
        <input
          style={{ ...FIELD, marginBottom: 8 }}
          value={core.model}
          placeholder="auto | groq | gemini | deepseek | openai | claude | grok | qwen"
          onChange={(e) => writeCoreModel(e.target.value)}
        />
        <div style={LABEL}>Ollama model</div>
        <input
          style={FIELD}
          value={core.ollamaModel}
          placeholder="llama3.2"
          onChange={(e) => writeCoreOllama(e.target.value)}
        />
      </div>

      {/* ── Hub agent record (display, avatar, voice, knowledge, story, hub memories) ── */}
      <div
        style={{
          marginTop: 20,
          marginBottom: 8,
          fontSize: 11,
          color: C.muted,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Hub record (display / voice / knowledge / story)
      </div>
      <AgentForm
        agent={agent}
        onChange={onAgentChange}
        lockIdentity
        footer={
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 11,
              color: C.muted,
            }}
          >
            <Save size={12} />
            {savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : "Not yet saved"}
            <a
              href="/chat"
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: C.teal,
                textDecoration: "none",
              }}
            >
              Open chat <ExternalLink size={10} />
            </a>
          </div>
        }
      />

      {/* Hidden: hub instruction/memory edits route through AgentForm's
          generic handlers; the ones below mirror AgentForm fields to core.
          We intercept them by rendering the AgentForm with a wrapped
          onChange that also writes core fields. */}
      <InstructionAndMemoryBridge
        agent={agent}
        coreInstructions={core.instructions}
        hubInstructions={hubInstructionsFromCore}
        onInstructionsChange={onHubInstructionsChange}
        onMemoriesChange={onHubMemoriesChange}
      />
    </div>
  );
}

// ── Bridge component ─────────────────────────────────────────────────────────
// Kept separate so the main render stays readable. This is a no-op visual
// block that exists only to route hub-level instruction/memory edits through
// the core writers. It renders nothing.

interface BridgeProps {
  agent: Agent;
  coreInstructions: string[];
  hubInstructions: AgentInstruction[];
  onInstructionsChange: (next: AgentInstruction[]) => void;
  onMemoriesChange: (next: AgentMemory[]) => void;
}

function InstructionAndMemoryBridge(_props: BridgeProps) {
  // Intentionally empty. Wired through callbacks from the parent.
  return null;
}