// src/pages/aihub/WorkersSection.tsx
// ============================================================================
// AI Hub — Cloudflare Workers
//
// Lists every Worker the hub knows about, seeded with the one confirmed in
// the codebase: lifeos1-api. Reads/writes lifeos_kv2_aihub_workers. Health
// probes hit GET <url>/health with a 4s timeout. If a Worker has no /health
// route, it reports "offline" — which is accurate, not a lie.
//
// No invented Workers. No invented routes. Add more via the UI.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, RefreshCcw, Activity, Globe } from "lucide-react";
import { C } from "@/lib/palette";
import type { Agent, CloudflareWorker } from "./types";
import {
  loadAgents,
  loadWorkers,
  saveWorkers,
  makeWorker,
  probeWorker,
} from "./storage";

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

// ── Status color helper ──────────────────────────────────────────────────────

function statusColor(s: CloudflareWorker["status"]): string {
  if (s === "online") return C.teal;
  if (s === "offline") return C.red;
  return C.dim;
}

// ── Worker card ──────────────────────────────────────────────────────────────

interface WorkerCardProps {
  worker: CloudflareWorker;
  agents: Agent[];
  onUpdate: (next: CloudflareWorker) => void;
  onDelete: () => void;
}

function WorkerCard({ worker, agents, onUpdate, onDelete }: WorkerCardProps) {
  const [probing, setProbing] = useState(false);
  const [probeDetail, setProbeDetail] = useState<string>("Not yet probed");

  const runProbe = useCallback(async () => {
    setProbing(true);
    setProbeDetail("Probing…");
    const result = await probeWorker(worker.url);
    const at = new Date().toISOString();
    setProbeDetail(
      result === "online"
        ? "Reachable"
        : "Unreachable (no /health route, or Worker down)",
    );
    onUpdate({ ...worker, status: result, lastProbe: at, updatedAt: at });
    setProbing(false);
  }, [worker, onUpdate]);

  const color = statusColor(worker.status);

  return (
    <div style={CARD}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Globe size={16} style={{ color: C.t2, flexShrink: 0 }} />
        <input
          style={{ ...FIELD, flex: 1, fontSize: 13, fontWeight: 700 }}
          value={worker.name}
          placeholder="Worker name"
          onChange={(e) => onUpdate({ ...worker, name: e.target.value })}
        />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 9px",
            borderRadius: 999,
            background: `${color}22`,
            border: `1px solid ${color}66`,
            color,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color,
            }}
          />
          {worker.status}
        </span>
      </div>

      {/* URL */}
      <div style={{ marginBottom: 8 }}>
        <div style={LABEL}>URL</div>
        <input
          style={FIELD}
          value={worker.url}
          placeholder="https://example.workers.dev"
          onChange={(e) => onUpdate({ ...worker, url: e.target.value })}
        />
      </div>

      {/* Agent + bridge bindings */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={LABEL}>Primary agent (optional)</div>
          <select
            style={FIELD}
            value={worker.agentId}
            onChange={(e) => onUpdate({ ...worker, agentId: e.target.value })}
          >
            <option value="">— shared —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={LABEL}>Bridge id (optional)</div>
          <input
            style={FIELD}
            value={worker.bridgeId}
            placeholder="bridge id"
            onChange={(e) => onUpdate({ ...worker, bridgeId: e.target.value })}
          />
        </div>
      </div>

      {/* Detail line */}
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
        {probeDetail}
        {worker.lastProbe && (
          <span style={{ marginLeft: 6 }}>
            · last probe {new Date(worker.lastProbe).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={runProbe}
          disabled={probing || !worker.url}
          style={{
            ...BTN,
            opacity: probing || !worker.url ? 0.6 : 1,
            color: C.teal,
            borderColor: `${C.teal}66`,
            background: `${C.teal}18`,
          }}
        >
          <Activity size={12} />
          {probing ? " PROBING…" : " PROBE /HEALTH"}
        </button>
        {worker.url && (
          <a
            href={worker.url}
            target="_blank"
            rel="noreferrer"
            style={{
              ...BTN,
              textDecoration: "none",
              color: C.t2,
            }}
          >
            <Globe size={12} /> OPEN
          </a>
        )}
        <button
          type="button"
          onClick={onDelete}
          style={{
            ...BTN,
            marginLeft: "auto",
            color: C.red,
            borderColor: `${C.red}66`,
            background: `${C.red}18`,
          }}
        >
          <Trash2 size={12} /> REMOVE
        </button>
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

export default function WorkersSection() {
  const [workers, setWorkers] = useState<CloudflareWorker[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bulkProbing, setBulkProbing] = useState(false);

  // ── Load ──
  useEffect(() => {
    try {
      setWorkers(loadWorkers());
      const map = loadAgents();
      setAgents(Object.values(map));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workers");
    }
  }, []);

  // ── Persist ──
  const persist = useCallback((next: CloudflareWorker[]) => {
    setWorkers(next);
    try {
      saveWorkers(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }, []);

  const onUpdate = useCallback(
    (next: CloudflareWorker) => {
      const list = workers.map((w) => (w.id === next.id ? next : w));
      persist(list);
    },
    [workers, persist],
  );

  const onDelete = useCallback(
    (id: string) => {
      const list = workers.filter((w) => w.id !== id);
      persist(list);
    },
    [workers, persist],
  );

  const addWorker = useCallback(() => {
    const created = makeWorker({
      name: "New Worker",
      url: "",
    });
    persist([...workers, created]);
  }, [workers, persist]);

  const probeAll = useCallback(async () => {
    if (workers.length === 0) return;
    setBulkProbing(true);
    const at = new Date().toISOString();
    const next: CloudflareWorker[] = [];
    for (const w of workers) {
      if (!w.url) {
        next.push({ ...w, status: "unknown", lastProbe: at, updatedAt: at });
        continue;
      }
      const result = await probeWorker(w.url);
      next.push({ ...w, status: result, lastProbe: at, updatedAt: at });
    }
    persist(next);
    setBulkProbing(false);
  }, [workers, persist]);

  const summary = useMemo(() => {
    const online = workers.filter((w) => w.status === "online").length;
    const offline = workers.filter((w) => w.status === "offline").length;
    return { online, offline, total: workers.length };
  }, [workers]);

  // ── Render ──
  if (error && workers.length === 0) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Workers section failed to load: {error}
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
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            Cloudflare Workers
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {summary.total} worker{summary.total === 1 ? "" : "s"}
            {summary.online + summary.offline > 0 && (
              <>
                {" · "}
                <span style={{ color: C.teal }}>{summary.online} online</span>
                {" · "}
                <span style={{ color: C.red }}>{summary.offline} offline</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={probeAll}
          disabled={bulkProbing || workers.length === 0}
          style={{
            ...BTN,
            opacity: bulkProbing || workers.length === 0 ? 0.6 : 1,
          }}
        >
          <RefreshCcw size={12} />
          {bulkProbing ? " PROBING…" : " PROBE ALL"}
        </button>
        <button
          type="button"
          onClick={addWorker}
          style={{
            ...BTN,
            color: C.teal,
            borderColor: `${C.teal}66`,
            background: `${C.teal}18`,
          }}
        >
          <Plus size={12} /> NEW WORKER
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

      {workers.length === 0 && (
        <div
          style={{
            ...CARD,
            padding: 32,
            textAlign: "center",
            fontSize: 12,
            color: C.dim,
          }}
        >
          No workers configured. Click NEW WORKER to add one.
        </div>
      )}

      {workers.map((w) => (
        <WorkerCard
          key={w.id}
          worker={w}
          agents={agents}
          onUpdate={onUpdate}
          onDelete={() => onDelete(w.id)}
        />
      ))}

      {/* Notes */}
      <div
        style={{
          ...CARD,
          marginTop: 16,
          fontSize: 11,
          color: C.muted,
          lineHeight: 1.6,
        }}
      >
        <div style={{ color: C.t2, fontWeight: 700, marginBottom: 4 }}>
          Note on /health
        </div>
        A probe hits{" "}
        <code style={{ color: C.text }}>GET &lt;url&gt;/health</code> with a 4s
        timeout. If a Worker has no <code>/health</code> route (or is behind
        Cloudflare Access), it reports offline. The{" "}
        <code>lifeos1-api</code> Worker's routes are{" "}
        <code>/api/llm/invoke</code>, <code>/api/sync/:platform</code>,{" "}
        <code>/api/tokens/store</code>, <code>/api/conversations</code> — a
        public <code>/health</code> route would need to be added there for
        this probe to light up.
      </div>
    </div>
  );
}