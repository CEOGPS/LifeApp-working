// src/pages/aihub/KranosSection.tsx
// ============================================================================
// AI Hub — Kranos section
//
// Kranos has TWO possible stores:
//   lifeos_agents.kranos     — hub record (always present)
//   Kranos runtime           — optional, loaded lazily from @/lib/agents/kranos
//
// We do NOT import @/lib/agents/kranos/Kranos statically, because the file
// may not exist in the tree. If it resolves at runtime (via dynamic import),
// we wire soul / instructions / skills / model. If not, hub-only mode with an
// honest status banner. No fake runtime.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, RefreshCcw, Save, ExternalLink, AlertTriangle } from "lucide-react";
import { C } from "@/lib/palette";
import type { Agent } from "./types";
import { loadAgent, upsertAgent, makeAgent } from "./storage";
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

// ── Kranos runtime (optional) ────────────────────────────────────────────────
// Minimal shape we expect from the Kranos runtime. If the real module exposes
// more, we ignore the extras. If it exposes less, hub-only mode.

interface KranosRuntime {
  soul?: {
    name?: string;
    identity?: string;
    personality?: string;
    values?: string;
    voice?: string;
    purpose?: string;
  };
  instructions?: string[];
  skills?: Array<{ id: string; label: string; on: boolean }>;
  model?: string;
  paused?: boolean;
  backendOnline?: boolean;
  wakeState?: string;
  saveSoul?: (soul: unknown) => void;
  saveInstructions?: (arr: unknown) => void;
  saveSkills?: (arr: unknown) => void;
  setModel?: (m: string) => void;
  setPaused?: (v: boolean) => void;
  wake?: () => Promise<unknown>;
}

interface RuntimeState {
  available: boolean;
  reason?: string;
  soulName: string;
  soulIdentity: string;
  soulPersonality: string;
  soulValues: string;
  soulVoice: string;
  soulPurpose: string;
  instructions: string[];
  skills: Array<{ id: string; label: string; on: boolean }>;
  model: string;
  paused: boolean;
  backendOnline: boolean;
  wakeState: string;
}

const EMPTY_RUNTIME: RuntimeState = {
  available: false,
  soulName: "",
  soulIdentity: "",
  soulPersonality: "",
  soulValues: "",
  soulVoice: "",
  soulPurpose: "",
  instructions: [],
  skills: [],
  model: "",
  paused: false,
  backendOnline: false,
  wakeState: "dormant",
};

function readRuntime(rt: KranosRuntime): RuntimeState {
  const soul = rt.soul ?? {};
  return {
    available: true,
    soulName: soul.name ?? "",
    soulIdentity: soul.identity ?? "",
    soulPersonality: soul.personality ?? "",
    soulValues: soul.values ?? "",
    soulVoice: soul.voice ?? "",
    soulPurpose: soul.purpose ?? "",
    instructions: Array.isArray(rt.instructions) ? rt.instructions.slice() : [],
    skills: Array.isArray(rt.skills)
      ? rt.skills.map((s) => ({ id: s.id, label: s.label, on: !!s.on }))
      : [],
    model: rt.model ?? "",
    paused: !!rt.paused,
    backendOnline: !!rt.backendOnline,
    wakeState: rt.wakeState ?? "dormant",
  };
}

// ── Debounced writer ─────────────────────────────────────────────────────────

function useDebouncedWriter() {
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

export default function KranosSection() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [runtime, setRuntime] = useState<RuntimeState>(EMPTY_RUNTIME);
  const [runtimeObj, setRuntimeObj] = useState<KranosRuntime | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newInstruction, setNewInstruction] = useState("");
  const schedule = useDebouncedWriter();

  // ── Load hub record + try runtime ──
  useEffect(() => {
    let cancelled = false;
    try {
      const existing = loadAgent("kranos");
      const next =
        existing ??
        makeAgent({
          id: "kranos",
          name: "Kranos",
          tagline: "Execution Engine",
          role: "Alternate Operations Agent",
          type: "autonomous",
          color: "#8a64ff",
          avatar: { img: "/agents/Kranos.png", facePos: "50% 10%" },
          hierarchyRole: "primary",
        });
      setAgent(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Kranos");
    }

    // Dynamic import: if the module exists, use it. If not, stay hub-only.
    // Vite resolves the specifier at build time. If it can't, the promise
    // rejects and we fall back cleanly.
    (async () => {
      try {
        const mod = (await import(
          /* @vite-ignore */ "@/lib/agents/kranos/Kranos"
        )) as { getKranos?: () => KranosRuntime };
        if (cancelled) return;
        if (typeof mod.getKranos === "function") {
          const rt = mod.getKranos();
          setRuntimeObj(rt);
          setRuntime(readRuntime(rt));
        } else {
          setRuntime({
            ...EMPTY_RUNTIME,
            available: false,
            reason: "getKranos export not found",
          });
        }
      } catch (e) {
        if (cancelled) return;
        const reason =
          e instanceof Error ? e.message : "Runtime module not found";
        setRuntime({ ...EMPTY_RUNTIME, available: false, reason });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Hub agent writes (debounced) ──
  const onAgentChange = useCallback(
    (next: Agent) => {
      setAgent(next);
      schedule("kranos-agent", () => {
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

  // ── Runtime writers (no-ops if runtime not available) ──
  const writeSoul = useCallback(
    (patch: Partial<{
      name: string;
      identity: string;
      personality: string;
      values: string;
      voice: string;
      purpose: string;
    }>) => {
      const rt = runtimeObj;
      if (!rt || typeof rt.saveSoul !== "function") return;
      const current = rt.soul ?? {};
      const next = { ...current, ...patch };
      rt.saveSoul(next);
      setRuntime((prev) => ({ ...prev, ...patchSoulToRuntime(patch) }));
      setSavedAt(Date.now());
    },
    [runtimeObj],
  );

  const writeInstructions = useCallback(
    (list: string[]) => {
      const rt = runtimeObj;
      if (!rt || typeof rt.saveInstructions !== "function") return;
      rt.saveInstructions(list);
      setRuntime((prev) => ({ ...prev, instructions: list.slice() }));
      setSavedAt(Date.now());
    },
    [runtimeObj],
  );

  const writeSkills = useCallback(
    (list: Array<{ id: string; label: string; on: boolean }>) => {
      const rt = runtimeObj;
      if (!rt || typeof rt.saveSkills !== "function") return;
      rt.saveSkills(list);
      setRuntime((prev) => ({ ...prev, skills: list.slice() }));
      setSavedAt(Date.now());
    },
    [runtimeObj],
  );

  const writeModel = useCallback(
    (model: string) => {
      const rt = runtimeObj;
      if (!rt || typeof rt.setModel !== "function") return;
      rt.setModel(model);
      setRuntime((prev) => ({ ...prev, model }));
      setSavedAt(Date.now());
    },
    [runtimeObj],
  );

  const togglePaused = useCallback(() => {
    const rt = runtimeObj;
    if (!rt || typeof rt.setPaused !== "function") return;
    const next = !rt.paused;
    rt.setPaused(next);
    setRuntime((prev) => ({ ...prev, paused: next }));
    setSavedAt(Date.now());
  }, [runtimeObj]);

  const refreshStatus = useCallback(async () => {
    const rt = runtimeObj;
    if (!rt) return;
    try {
      if (typeof rt.wake === "function" && rt.wakeState === "dormant") {
        await rt.wake();
      }
      setRuntime(readRuntime(rt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wake failed");
    }
  }, [runtimeObj]);

  // ── Instruction editors ──
  const addInstruction = useCallback(() => {
    const t = newInstruction.trim();
    if (!t) return;
    writeInstructions([...runtime.instructions, t]);
    setNewInstruction("");
  }, [newInstruction, runtime.instructions, writeInstructions]);

  const removeInstruction = useCallback(
    (idx: number) => {
      writeInstructions(runtime.instructions.filter((_, i) => i !== idx));
    },
    [runtime.instructions, writeInstructions],
  );

  const updateInstruction = useCallback(
    (idx: number, text: string) => {
      const next = runtime.instructions.slice();
      next[idx] = text;
      writeInstructions(next);
    },
    [runtime.instructions, writeInstructions],
  );

  // ── Loading / error ──
  if (error && !agent) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Kranos section failed to load: {error}
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ padding: 24, color: C.muted, fontSize: 12 }}>Loading Kranos…</div>
    );
  }

  // ── Render ──
  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
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
                objectPosition: agent.avatar.facePos ?? "50% 10%",
              }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                if (el.parentElement) {
                  el.parentElement.innerHTML =
                    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:18px;color:${agent.color};font-weight:700">K</div>`;
                }
              }}
            />
          ) : (
            <Bot size={18} style={{ color: agent.color }} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {agent.role || "Alternate Operations Agent"}
          </div>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          disabled={!runtime.available}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: runtime.available ? C.t2 : C.dim,
            fontSize: 11,
            cursor: runtime.available ? "pointer" : "not-allowed",
          }}
        >
          <RefreshCcw size={12} /> Refresh
        </button>
      </div>

      {/* Runtime status */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={STATUS_PILL}>
          Runtime:{" "}
          <span style={{ color: runtime.available ? C.teal : C.amber }}>
            {runtime.available ? "connected" : "not wired"}
          </span>
        </span>
        {runtime.available && (
          <>
            <span style={STATUS_PILL}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    runtime.wakeState === "active" || runtime.wakeState === "working"
                      ? C.teal
                      : runtime.wakeState === "waking"
                        ? C.amber
                        : C.dim,
                }}
              />
              {runtime.wakeState.toUpperCase()}
            </span>
            <span style={STATUS_PILL}>
              Backend:{" "}
              <span style={{ color: runtime.backendOnline ? C.teal : C.muted }}>
                {runtime.backendOnline ? "online" : "offline"}
              </span>
            </span>
            {runtime.model && (
              <span style={STATUS_PILL}>
                Model: <span style={{ color: C.t2 }}>{runtime.model}</span>
              </span>
            )}
            {runtime.paused && (
              <span style={{ ...STATUS_PILL, borderColor: C.amber, color: C.amber }}>
                PAUSED
              </span>
            )}
            <button
              type="button"
              onClick={togglePaused}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                background: runtime.paused
                  ? "rgba(0,200,150,0.12)"
                  : "rgba(251,191,36,0.12)",
                border: `1px solid ${runtime.paused ? C.teal : C.amber}66`,
                color: runtime.paused ? C.teal : C.amber,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {runtime.paused ? "RESUME" : "PAUSE"}
            </button>
          </>
        )}
      </div>

      {/* Runtime not wired banner */}
      {!runtime.available && (
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
          <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
            <div style={{ color: C.amber, fontWeight: 700, marginBottom: 4 }}>
              Kranos runtime not wired
            </div>
            The hub can edit Kranos's identity, avatar, voice, knowledge, story,
            and hub-level memories, but soul / instructions / skills / model
            require the runtime module at{" "}
            <code style={{ color: C.text, fontSize: 11 }}>
              @/lib/agents/kranos/Kranos
            </code>
            .{" "}
            {runtime.reason ? (
              <span style={{ color: C.muted }}>
                Reason: {runtime.reason}
              </span>
            ) : null}
          </div>
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

      {/* ── Runtime soul (if available) ── */}
      {runtime.available && (
        <div style={CARD}>
          <div style={LABEL}>Core soul (Kranos runtime)</div>
          <input
            style={{ ...FIELD, marginBottom: 8 }}
            value={runtime.soulName}
            placeholder="Name"
            onChange={(e) => writeSoul({ name: e.target.value })}
          />
          <textarea
            style={{ ...FIELD, minHeight: 68, resize: "vertical", marginBottom: 8 }}
            value={runtime.soulIdentity}
            placeholder="Identity"
            onChange={(e) => writeSoul({ identity: e.target.value })}
          />
          <textarea
            style={{ ...FIELD, minHeight: 52, resize: "vertical", marginBottom: 8 }}
            value={runtime.soulPersonality}
            placeholder="Personality"
            onChange={(e) => writeSoul({ personality: e.target.value })}
          />
          <textarea
            style={{ ...FIELD, minHeight: 52, resize: "vertical", marginBottom: 8 }}
            value={runtime.soulValues}
            placeholder="Values"
            onChange={(e) => writeSoul({ values: e.target.value })}
          />
          <textarea
            style={{ ...FIELD, minHeight: 52, resize: "vertical", marginBottom: 8 }}
            value={runtime.soulVoice}
            placeholder="Voice"
            onChange={(e) => writeSoul({ voice: e.target.value })}
          />
          <textarea
            style={{ ...FIELD, minHeight: 68, resize: "vertical" }}
            value={runtime.soulPurpose}
            placeholder="Purpose"
            onChange={(e) => writeSoul({ purpose: e.target.value })}
          />
        </div>
      )}

      {/* ── Runtime instructions (if available) ── */}
      {runtime.available && (
        <div style={CARD}>
          <div style={LABEL}>Core instructions</div>
          {runtime.instructions.length === 0 && (
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
              No standing instructions.
            </div>
          )}
          {runtime.instructions.map((ins, i) => (
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
                background: "rgba(138,100,255,0.15)",
                border: "1px solid rgba(138,100,255,0.4)",
                borderRadius: 8,
                padding: "8px 12px",
                color: "#b7a6ff",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              + ADD
            </button>
          </div>
        </div>
      )}

      {/* ── Runtime skills (if available) ── */}
      {runtime.available && runtime.skills.length > 0 && (
        <div style={CARD}>
          <div style={LABEL}>Core skills</div>
          {runtime.skills.map((s, i) => (
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
                onClick={() => {
                  const next = runtime.skills.map((sk, j) =>
                    j === i ? { ...sk, on: !sk.on } : sk,
                  );
                  writeSkills(next);
                }}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: s.on ? "#8a64ff" : "rgba(255,255,255,0.1)",
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
      )}

      {/* ── Runtime model (if available) ── */}
      {runtime.available && (
        <div style={CARD}>
          <div style={LABEL}>Model</div>
          <input
            style={FIELD}
            value={runtime.model}
            placeholder="auto | groq | gemini | deepseek | openai | claude | grok | qwen"
            onChange={(e) => writeModel(e.target.value)}
          />
        </div>
      )}

      {/* ── Hub agent record ── */}
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
              href="/agents"
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: C.teal,
                textDecoration: "none",
              }}
            >
              Open dock <ExternalLink size={10} />
            </a>
          </div>
        }
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function patchSoulToRuntime(patch: Partial<{
  name: string;
  identity: string;
  personality: string;
  values: string;
  voice: string;
  purpose: string;
}>): Partial<RuntimeState> {
  const out: Partial<RuntimeState> = {};
  if (patch.name !== undefined) out.soulName = patch.name;
  if (patch.identity !== undefined) out.soulIdentity = patch.identity;
  if (patch.personality !== undefined) out.soulPersonality = patch.personality;
  if (patch.values !== undefined) out.soulValues = patch.values;
  if (patch.voice !== undefined) out.soulVoice = patch.voice;
  if (patch.purpose !== undefined) out.soulPurpose = patch.purpose;
  return out;
}