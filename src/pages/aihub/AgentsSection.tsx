// src/pages/aihub/AgentsSection.tsx
// ============================================================================
// AI Hub — Agents (skins) section
//
// Shows every agent in lifeos_agents except erebus and kranos. Supports
// add / edit / delete / duplicate, and "equip" — copying persona fields
// (personality, soul, story, voice, systemPrompt, knowledge) onto Erebus or
// Kranos without touching their runtime fields.
//
// Skins are NOT separate runtime agents. They are persona presets. Equipping
// writes to lifeos_agents[target]. Persona only. Runtime untouched.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Copy, Wand2, Bot } from "lucide-react";
import { C } from "@/lib/palette";
import type { Agent, AgentsMap } from "./types";
import {
  loadAgents,
  saveAgents,
  makeAgent,
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

const BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 8,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: C.t2,
};

// ── Persona snapshot (fields that get equipped) ──────────────────────────────

interface PersonaSnapshot {
  personality: string;
  soul: string;
  story: string;
  voice: Agent["voice"];
  systemPrompt: string;
  knowledge: Agent["knowledge"];
  color: string;
  avatar: Agent["avatar"];
  tagline: string;
}

function snapshotPersona(a: Agent): PersonaSnapshot {
  return {
    personality: a.personality,
    soul: a.soul,
    story: a.story,
    voice: { ...a.voice },
    systemPrompt: a.systemPrompt,
    knowledge: a.knowledge.map((k) => ({ ...k })),
    color: a.color,
    avatar: { ...a.avatar },
    tagline: a.tagline,
  };
}

function applyPersona(target: Agent, persona: PersonaSnapshot): Agent {
  return {
    ...target,
    personality: persona.personality,
    soul: persona.soul,
    story: persona.story,
    voice: { ...persona.voice },
    systemPrompt: persona.systemPrompt,
    knowledge: persona.knowledge.map((k) => ({ ...k })),
    // Display fields are deliberately kept — the target's identity stays.
    updatedAt: new Date().toISOString(),
  };
}

// ── Small agent card (list view) ─────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  selected: boolean;
  onSelect: () => void;
}

function AgentCard({ agent, selected, onSelect }: AgentCardProps) {
  const initial = agent.name.charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 10,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        background: selected
          ? `linear-gradient(135deg, ${agent.color}22, rgba(255,255,255,0.02))`
          : "rgba(255,255,255,0.02)",
        border: selected
          ? `1px solid ${agent.color}88`
          : "1px solid rgba(255,255,255,0.06)",
        width: "100%",
        boxShadow: selected ? `0 0 12px ${agent.color}44` : "none",
        transition: "all .15s",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          overflow: "hidden",
          background: "#07080f",
          border: `1.5px solid ${agent.color}`,
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
                  `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;color:${agent.color};font-weight:700">${initial}</div>`;
              }
            }}
          />
        ) : agent.avatar.emoji ? (
          <span style={{ fontSize: 16, color: agent.color }}>
            {agent.avatar.emoji}
          </span>
        ) : (
          <Bot size={14} style={{ color: agent.color }} />
        )}
      </div>

      {/* Meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {agent.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: C.muted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {agent.tagline || agent.role || agent.type}
        </div>
      </div>

      {/* Status dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: agent.enabled ? C.teal : C.dim,
          flexShrink: 0,
        }}
      />
    </button>
  );
}

// ── Equip panel ──────────────────────────────────────────────────────────────

interface EquipPanelProps {
  source: Agent;
  targets: Agent[];
  onEquip: (targetId: string, persona: PersonaSnapshot) => void;
}

function EquipPanel({ source, targets, onEquip }: EquipPanelProps) {
  const persona = useMemo(() => snapshotPersona(source), [source]);

  return (
    <div style={{ ...CARD, marginTop: 12 }}>
      <div style={LABEL}>Equip persona</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
        Copies personality, soul, story, voice, system prompt, and knowledge
        from <strong style={{ color: C.t2 }}>{source.name}</strong> onto a
        target. The target's name, color, avatar, skills, model, and
        instructions stay untouched.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {targets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              const ok = window.confirm(
                `Equip "${source.name}" persona onto "${t.name}"? This overwrites the target's personality, soul, story, voice, system prompt, and knowledge.`,
              );
              if (ok) onEquip(t.id, persona);
            }}
            style={{
              ...BTN,
              background: `${t.color}22`,
              border: `1px solid ${t.color}66`,
              color: t.color,
            }}
          >
            <Wand2 size={12} /> {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

export default function AgentsSection() {
  const [agents, setAgents] = useState<AgentsMap>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load ──
  useEffect(() => {
    try {
      const map = loadAgents();
      setAgents(map);
      // Default select first non-primary agent, if any.
      const firstSkin = Object.values(map).find(
        (a) => a.id !== "erebus" && a.id !== "kranos",
      );
      setSelectedId(firstSkin?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    }
  }, []);

  const skins = useMemo(
    () =>
      Object.values(agents).filter(
        (a) => a.id !== "erebus" && a.id !== "kranos",
      ),
    [agents],
  );

  const targets = useMemo(
    () =>
      [agents.erebus, agents.kranos].filter(
        (a): a is Agent => Boolean(a),
      ),
    [agents],
  );

  const selected = selectedId ? agents[selectedId] ?? null : null;

  // ── Persist ──
  const persist = useCallback((next: AgentsMap) => {
    setAgents(next);
    try {
      saveAgents(next);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }, []);

  // ── Agent edit ──
  const onSelectedChange = useCallback(
    (next: Agent) => {
      if (!selectedId) return;
      const updated: AgentsMap = {
        ...agents,
        [selectedId]: { ...next, updatedAt: new Date().toISOString() },
      };
      persist(updated);
    },
    [agents, selectedId, persist],
  );

  // ── Add ──
  const addAgent = useCallback(() => {
    const id = newId("agt");
    const created = makeAgent({
      id,
      name: "New Agent",
      tagline: "Unassigned",
      role: "Custom",
      type: "worker",
      color: "#4ab3f4",
      avatar: { emoji: "◈" },
      personality: "",
      soul: "",
      story: "",
      skills: [],
      knowledge: [],
      memories: [],
      instructions: [],
      hierarchyRole: "skin",
      parentId: null,
    });
    const next: AgentsMap = { ...agents, [id]: created };
    persist(next);
    setSelectedId(id);
  }, [agents, persist]);

  // ── Delete ──
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const next: AgentsMap = { ...agents };
    delete next[selectedId];
    persist(next);
    const remaining = Object.values(next).filter(
      (a) => a.id !== "erebus" && a.id !== "kranos",
    );
    setSelectedId(remaining[0]?.id ?? null);
  }, [agents, selectedId, persist]);

  // ── Duplicate ──
  const duplicateSelected = useCallback(() => {
    if (!selected) return;
    const id = newId("agt");
    const copy = makeAgent({
      ...selected,
      id,
      name: `${selected.name} (copy)`,
      createdAt: new Date().toISOString(),
    });
    const next: AgentsMap = { ...agents, [id]: copy };
    persist(next);
    setSelectedId(id);
  }, [agents, selected, persist]);

  // ── Equip ──
  const equip = useCallback(
    (targetId: string, persona: PersonaSnapshot) => {
      const target = agents[targetId];
      if (!target) return;
      const updated = applyPersona(target, persona);
      const next: AgentsMap = { ...agents, [targetId]: updated };
      persist(next);
    },
    [agents, persist],
  );

  // ── Error state ──
  if (error && Object.keys(agents).length === 0) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Agents section failed to load: {error}
      </div>
    );
  }

  // ── Render ──
  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            Agent roster
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {skins.length} skin{skins.length === 1 ? "" : "s"} · persona
            presets you can equip onto Erebus or Kranos
          </div>
        </div>
        <button type="button" onClick={addAgent} style={{ ...BTN, color: C.teal, borderColor: `${C.teal}66`, background: `${C.teal}18` }}>
          <Plus size={12} /> NEW AGENT
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
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left: list */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {skins.length === 0 && (
              <div style={{ fontSize: 11, color: C.dim, padding: 12 }}>
                No skins yet. Click NEW AGENT to add one.
              </div>
            )}
            {skins.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                selected={a.id === selectedId}
                onSelect={() => setSelectedId(a.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: editor */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selected ? (
            <>
              {/* Actions row */}
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginBottom: 12,
                  flexWrap: "wrap",
                }}
              >
                <button type="button" onClick={duplicateSelected} style={BTN}>
                  <Copy size={12} /> DUPLICATE
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  style={{
                    ...BTN,
                    color: C.red,
                    borderColor: `${C.red}66`,
                    background: `${C.red}18`,
                  }}
                >
                  <Trash2 size={12} /> DELETE
                </button>
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    color: C.muted,
                    alignSelf: "center",
                  }}
                >
                  {savedAt
                    ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
                    : "Not yet saved"}
                </div>
              </div>

              {/* Form */}
              <AgentForm
                agent={selected}
                onChange={onSelectedChange}
                onDelete={deleteSelected}
              />

              {/* Equip */}
              {targets.length > 0 && (
                <EquipPanel
                  source={selected}
                  targets={targets}
                  onEquip={equip}
                />
              )}
            </>
          ) : (
            <div
              style={{
                ...CARD,
                padding: 40,
                textAlign: "center",
                fontSize: 12,
                color: C.dim,
              }}
            >
              Select an agent to edit, or add a new one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}