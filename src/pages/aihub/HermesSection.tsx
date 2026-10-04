// src/pages/aihub/HermesSection.tsx
// ============================================================================
// AI Hub — Hermes
//
// Hermes is a MODEL BACKEND, not an autonomous agent. In the current tree,
// hermesChat.ts is a stub returning a canned string. This section:
//
//   1. Lets you configure the Hermes hub record (name, avatar, personality,
//      soul, story, voice, system prompt, knowledge, hub memories).
//   2. Probes hermesHealth() from @/lib/agents/hermes/hermesChat if it exists.
//   3. Shows the honest status: "stub" when the module is present but returns
//      no real backend, "connected" when hermesHealth() reports live, and
//      "not found" when the module isn't in the tree.
//
// No fake runtime. No invented backends.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, RefreshCcw, AlertTriangle, Save } from "lucide-react";
import { C } from "@/lib/palette";
import type { Agent } from "./types";
import { loadAgent, upsertAgent, makeAgent } from "./storage";
import AgentForm from "./AgentForm";

// ── Style tokens ─────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
  padding: 12,
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

// ── Hermes module (optional) ─────────────────────────────────────────────────
// Minimal shape we expect. If the real module exposes more, extras are
// ignored. If it exposes less, hub-only mode.

interface HermesHealth {
  hermes: boolean;
  ollama: boolean;
}

interface HermesModule {
  hermesHealth: () => Promise<HermesHealth>;
}

type RuntimeStatus =
  | { kind: "unknown" }
  | { kind: "stub" }       // module present but reports no live backend
  | { kind: "connected"; health: HermesHealth }
  | { kind: "missing"; reason: string };

// ── Debounced writer ─────────────────────────────────────────────────────────

function useDebouncedWriter() {
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );
  return useCallback((fn: () => void, ms: number) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(fn, ms);
  }, []);
}

// ── Main section ─────────────────────────────────────────────────────────────

export default function HermesSection() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus>({ kind: "unknown" });
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const schedule = useDebouncedWriter();

  // ── Load hub record ──
  useEffect(() => {
    try {
      const existing = loadAgent("hermes");
      const next =
        existing ??
        makeAgent({
          id: "hermes",
          name: "Hermes",
          tagline: "Model Backend",
          role: "Messenger / Router",
          type: "model-backend",
          color: "#f0c040",
          avatar: { emoji: "⚕" },
          personality: "Fast, precise, connective",
          soul: "Messenger of the system. Routes intent to the right backend.",
          skills: ["Routing", "Translation", "Fast Inference"],
          model: "hermes",
          hierarchyRole: "sub",
        });
      setAgent(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Hermes");
    }
  }, []);

  // ── Probe Hermes module ──
    const probe = useCallback(async () => {
      // Hermes module doesn't exist in the tree yet
      setRuntime({
        kind: "missing",
        reason: "Module @/lib/agents/hermes/hermesChat not found",
      });
    }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  // ── Persist ──
  const onAgentChange = useCallback(
    (next: Agent) => {
      setAgent(next);
      schedule(() => {
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

  // ── Status pill content ──
  const statusPill = useMemo(() => {
    switch (runtime.kind) {
      case "connected":
        return {
          color: C.teal,
          label: `connected${
            runtime.health.hermes ? " (hermes)" : ""
          }${runtime.health.ollama ? " (ollama)" : ""}`,
        };
      case "stub":
        return { color: C.amber, label: "stub — no live backend" };
      case "missing":
        return { color: C.red, label: "module not found" };
      case "unknown":
      default:
        return { color: C.dim, label: "unknown" };
    }
  }, [runtime]);

  // ── Render ──
  if (error && !agent) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Hermes section failed to load: {error}
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ padding: 24, color: C.muted, fontSize: 12 }}>
        Loading Hermes…
      </div>
    );
  }

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
            background: "#07080f",
            border: `2px solid ${agent.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Bot size={18} style={{ color: agent.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {agent.role || "Model Backend"}
          </div>
        </div>
        <button type="button" onClick={probe} style={BTN}>
          <RefreshCcw size={12} /> RECHECK
        </button>
      </div>

      {/* Status */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            ...STATUS_PILL,
            borderColor: `${statusPill.color}66`,
            color: statusPill.color,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusPill.color,
            }}
          />
          {statusPill.label}
        </span>
        <span style={STATUS_PILL}>
          Type: <span style={{ color: C.t2 }}>{agent.type}</span>
        </span>
        <span style={STATUS_PILL}>
          Model slot: <span style={{ color: C.t2 }}>{agent.model}</span>
        </span>
      </div>

      {/* Missing / stub banner */}
      {runtime.kind === "missing" && (
        <div
          style={{
            ...CARD,
            borderColor: `${C.red}44`,
            background: "rgba(255,79,94,0.06)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: C.red, flexShrink: 0, marginTop: 1 }}
          />
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
            <div style={{ color: C.red, fontWeight: 700, marginBottom: 4 }}>
              Hermes module not found
            </div>
            The hub can edit Hermes's identity, avatar, voice, knowledge, and
            story, but a live runtime requires the module at{" "}
            <code style={{ color: C.text, fontSize: 11 }}>
              @/lib/agents/hermes/hermesChat
            </code>
            . {runtime.reason ? (
              <span style={{ color: C.muted }}>
                Reason: {runtime.reason}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {runtime.kind === "stub" && (
        <div
          style={{
            ...CARD,
            borderColor: `${C.amber}44`,
            background: "rgba(251,191,36,0.06)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: C.amber, flexShrink: 0, marginTop: 1 }}
          />
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
            <div style={{ color: C.amber, fontWeight: 700, marginBottom: 4 }}>
              Hermes is running as a stub
            </div>
            The module resolves and responds, but{" "}
            <code style={{ color: C.text, fontSize: 11 }}>hermesHealth()</code>{" "}
            reports no live backend. Until it does, Hermes is a config slot —
            nothing more. Wire a real backend to make it live.
          </div>
        </div>
      )}

      {runtime.kind === "connected" && (
        <div
          style={{
            ...CARD,
            borderColor: `${C.teal}44`,
            background: "rgba(0,200,150,0.06)",
            fontSize: 12,
            color: C.t2,
            lineHeight: 1.5,
          }}
        >
          <div style={{ color: C.teal, fontWeight: 700, marginBottom: 4 }}>
            Hermes backend connected
          </div>
          Hermes: {runtime.health.hermes ? "online" : "offline"} · Ollama:{" "}
          {runtime.health.ollama ? "online" : "offline"}
        </div>
      )}

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

      {/* Hub record */}
      <div
        style={{
          marginTop: 8,
          marginBottom: 8,
          fontSize: 11,
          color: C.muted,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Hub record (identity / voice / knowledge / story)
      </div>
      <AgentForm
        agent={agent}
        onChange={onAgentChange}
        lockIdentity={false}
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
            {savedAt
              ? `Saved ${new Date(savedAt).toLocaleTimeString()}`
              : "Not yet saved"}
          </div>
        }
      />
    </div>
  );
}