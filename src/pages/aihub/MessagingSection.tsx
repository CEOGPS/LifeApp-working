// src/pages/aihub/MessagingSection.tsx
// ============================================================================
// AI Hub — Messaging bridges
//
// Manages Telegram, Google Voice, Messenger, Instagram bridges. Multiple
// bridges per platform are allowed — the user can run two Telegram bots, one
// bound to Erebus and one bound to Kranos, each with its own user_id and
// token (stored in Supabase platform_tokens, never locally).
//
// Worker routes consumed (from cloudflare-worker.js):
//   GET  /api/sync/{platform}?user_id=…
//   POST /api/tokens/store   { user_id, platform, access_token, … }
//
// If VITE_WORKER_URL is unset, section runs config-only. No fake status.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Plug, PlugZap, RefreshCcw, Copy } from "lucide-react";
import { C } from "@/lib/palette";
import type {
  Agent,
  MessagingBridge,
  MessagingPlatform,
} from "./types";
import {
  loadAgents,
  loadMessaging,
  upsertBridge,
  deleteBridge,
  makeBridge,
  newId,
} from "./storage";

// ── Env ──────────────────────────────────────────────────────────────────────

const WORKER_URL: string | undefined = (
  import.meta as ImportMeta & { env?: Record<string, string | undefined> }
).env?.VITE_WORKER_URL;

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

// ── Platform metadata ────────────────────────────────────────────────────────

interface PlatformMeta {
  label: string;
  icon: string;
  description: string;
}

const PLATFORMS: Record<MessagingPlatform, PlatformMeta> = {
  telegram: {
    label: "Telegram",
    icon: "✈",
    description: "Bot API — DM, groups, channels.",
  },
  "google-voice": {
    label: "Google Voice",
    icon: "☎",
    description: "SMS via Gmail polling (see cloudflare-worker.js).",
  },
  messenger: {
    label: "Messenger",
    icon: "◐",
    description: "Meta Graph API.",
  },
  instagram: {
    label: "Instagram",
    icon: "◑",
    description: "Meta Graph API (shares token with Messenger).",
  },
};

const PLATFORM_ORDER: MessagingPlatform[] = [
  "telegram",
  "google-voice",
  "messenger",
  "instagram",
];

// ── Connection probe (Worker route from cloudflare-worker.js) ────────────────

interface ProbeResult {
  status: "connected" | "disconnected" | "unknown";
  detail: string;
}

async function probeBridge(b: MessagingBridge): Promise<ProbeResult> {
  if (!WORKER_URL) {
    return { status: "unknown", detail: "VITE_WORKER_URL not set" };
  }
  if (!b.userId) {
    return { status: "disconnected", detail: "No user_id configured" };
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const url = `${WORKER_URL.replace(/\/$/, "")}/api/sync/${encodeURIComponent(b.platform)}?user_id=${encodeURIComponent(b.userId)}`;
    const r = await fetch(url, { method: "GET", signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) {
      return { status: "disconnected", detail: `Worker returned ${r.status}` };
    }
    const data = (await r.json()) as {
      success?: boolean;
      count?: number;
      error?: string;
    };
    if (data.error) {
      return { status: "disconnected", detail: data.error };
    }
    if (data.success) {
      return {
        status: "connected",
        detail: `${data.count ?? 0} messages synced`,
      };
    }
    return { status: "disconnected", detail: "Unexpected Worker response" };
  } catch (e) {
    return {
      status: "disconnected",
      detail: e instanceof Error ? e.message : "Probe failed",
    };
  }
}

// ── Token store (Worker /api/tokens/store) ───────────────────────────────────

interface StoreTokenParams {
  userId: string;
  platform: MessagingPlatform;
  accessToken: string;
  refreshToken: string;
  platformUserId: string;
}

async function storeToken(
  p: StoreTokenParams,
): Promise<{ ok: boolean; error?: string }> {
  if (!WORKER_URL) {
    return { ok: false, error: "VITE_WORKER_URL not set" };
  }
  try {
    const r = await fetch(`${WORKER_URL.replace(/\/$/, "")}/api/tokens/store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: p.userId,
        platform: p.platform,
        access_token: p.accessToken,
        refresh_token: p.refreshToken,
        platform_user_id: p.platformUserId,
      }),
    });
    if (!r.ok) return { ok: false, error: `Worker returned ${r.status}` };
    const data = (await r.json()) as { success?: boolean; error?: string };
    if (data.error) return { ok: false, error: data.error };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Store failed",
    };
  }
}

// ── Bridge card ──────────────────────────────────────────────────────────────

interface BridgeCardProps {
  bridge: MessagingBridge;
  agents: Agent[];
  onUpdate: (next: MessagingBridge) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function BridgeCard({
  bridge,
  agents,
  onUpdate,
  onDuplicate,
  onDelete,
}: BridgeCardProps) {
  const meta = PLATFORMS[bridge.platform];
  const [probe, setProbe] = useState<ProbeResult>({
    status: bridge.status === "connected" ? "connected" : "unknown",
    detail: "Not yet probed",
  });
  const [probing, setProbing] = useState(false);
  const [showTokenEntry, setShowTokenEntry] = useState(false);
  const [tokenDraft, setTokenDraft] = useState("");
  const [refreshDraft, setRefreshDraft] = useState("");
  const [platformUserDraft, setPlatformUserDraft] = useState("");
  const [storeMsg, setStoreMsg] = useState<string | null>(null);

  const runProbe = useCallback(async () => {
    setProbing(true);
    const r = await probeBridge(bridge);
    setProbe(r);
    setProbing(false);
    if (r.status !== bridge.status) {
      onUpdate({
        ...bridge,
        status: r.status,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [bridge, onUpdate]);

  const commitToken = useCallback(async () => {
    setStoreMsg(null);
    if (!bridge.userId) {
      setStoreMsg("Set a Supabase user_id first.");
      return;
    }
    if (!tokenDraft) {
      setStoreMsg("Access token is required.");
      return;
    }
    const res = await storeToken({
      userId: bridge.userId,
      platform: bridge.platform,
      accessToken: tokenDraft,
      refreshToken: refreshDraft,
      platformUserId: platformUserDraft,
    });
    if (res.ok) {
      setStoreMsg("Token stored via Worker. Probing…");
      setTokenDraft("");
      setRefreshDraft("");
      setPlatformUserDraft("");
      setShowTokenEntry(false);
      await runProbe();
    } else {
      setStoreMsg(`Store failed: ${res.error ?? "unknown"}`);
    }
  }, [bridge, tokenDraft, refreshDraft, platformUserDraft, runProbe]);

  const statusColor =
    probe.status === "connected"
      ? C.teal
      : probe.status === "disconnected"
        ? C.red
        : C.dim;

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
        <span
          style={{
            fontSize: 18,
            color: C.t2,
            minWidth: 22,
            textAlign: "center",
          }}
        >
          {meta.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            style={{ ...FIELD, fontSize: 13, fontWeight: 700 }}
            value={bridge.label}
            placeholder={`${meta.label} bridge`}
            onChange={(e) => onUpdate({ ...bridge, label: e.target.value })}
          />
          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
            {meta.description}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 9px",
            borderRadius: 999,
            background: `${statusColor}22`,
            border: `1px solid ${statusColor}66`,
            color: statusColor,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {probe.status}
        </span>
      </div>

      {/* Row: agent + user_id */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={LABEL}>Backing agent</div>
          <select
            style={FIELD}
            value={bridge.agentId}
            onChange={(e) => onUpdate({ ...bridge, agentId: e.target.value })}
          >
            <option value="">— select —</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={LABEL}>Supabase user_id</div>
          <input
            style={FIELD}
            value={bridge.userId}
            placeholder="uuid from Supabase auth"
            onChange={(e) => onUpdate({ ...bridge, userId: e.target.value })}
          />
        </div>
      </div>

      {/* Active toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: C.t2,
          cursor: "pointer",
          marginBottom: 10,
        }}
      >
        <input
          type="checkbox"
          checked={bridge.active}
          onChange={(e) => onUpdate({ ...bridge, active: e.target.checked })}
        />
        Active
      </label>

      {/* Detail line */}
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 10 }}>
        {probe.detail}
        {!WORKER_URL && (
          <span style={{ color: C.amber, marginLeft: 6 }}>
            · set VITE_WORKER_URL to enable live probes
          </span>
        )}
      </div>

      {/* Token entry (collapsed by default) */}
      {showTokenEntry && (
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <div style={LABEL}>
            Access token (sent to Worker, never stored locally)
          </div>
          <input
            style={{ ...FIELD, marginBottom: 6 }}
            type="password"
            value={tokenDraft}
            placeholder="bot token / OAuth access token"
            onChange={(e) => setTokenDraft(e.target.value)}
          />
          <div style={LABEL}>Refresh token (optional)</div>
          <input
            style={{ ...FIELD, marginBottom: 6 }}
            type="password"
            value={refreshDraft}
            placeholder="refresh token"
            onChange={(e) => setRefreshDraft(e.target.value)}
          />
          <div style={LABEL}>Platform user id (optional)</div>
          <input
            style={{ ...FIELD, marginBottom: 8 }}
            value={platformUserDraft}
            placeholder="telegram chat_id / google account id"
            onChange={(e) => setPlatformUserDraft(e.target.value)}
          />
          {storeMsg && (
            <div
              style={{
                fontSize: 11,
                color: storeMsg.startsWith("Token stored") ? C.teal : C.red,
                marginBottom: 6,
              }}
            >
              {storeMsg}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={commitToken}
              style={{
                ...BTN,
                color: C.teal,
                borderColor: `${C.teal}66`,
                background: `${C.teal}18`,
              }}
            >
              <PlugZap size={12} /> STORE TOKEN
            </button>
            <button
              type="button"
              onClick={() => {
                setShowTokenEntry(false);
                setStoreMsg(null);
                setTokenDraft("");
                setRefreshDraft("");
                setPlatformUserDraft("");
              }}
              style={BTN}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Action row */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={runProbe}
          disabled={probing}
          style={{
            ...BTN,
            opacity: probing ? 0.6 : 1,
          }}
        >
          <RefreshCcw size={12} />
          {probing ? " PROBING…" : " PROBE"}
        </button>
        <button
          type="button"
          onClick={() => setShowTokenEntry((v) => !v)}
          style={{
            ...BTN,
            color: C.t2,
            borderColor: "rgba(255,255,255,0.14)",
          }}
        >
          <Plug size={12} /> {showTokenEntry ? "HIDE TOKEN" : "SET TOKEN"}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          style={BTN}
          title="Create another bridge for the same platform"
        >
          <Copy size={12} /> DUPLICATE
        </button>
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

export default function MessagingSection() {
  const [bridges, setBridges] = useState<MessagingBridge[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Load ──
  useEffect(() => {
    try {
      setBridges(loadMessaging());
      const map = loadAgents();
      setAgents(Object.values(map));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messaging");
    }
  }, []);

  // ── Persist ──
  // Write every bridge in the list. Then remove any on disk that isn't in the
  // list anymore (deletes). Simpler and safer than diffing per-operation.
  const persist = useCallback((next: MessagingBridge[]) => {
    setBridges(next);
    try {
      for (const b of next) upsertBridge(b);
      const ids = new Set(next.map((b) => b.id));
      const onDisk = loadMessaging();
      for (const old of onDisk) {
        if (!ids.has(old.id)) deleteBridge(old.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }, []);

  const onUpdate = useCallback(
    (next: MessagingBridge) => {
      const list = bridges.map((b) => (b.id === next.id ? next : b));
      persist(list);
    },
    [bridges, persist],
  );

  const onDelete = useCallback(
    (id: string) => {
      const list = bridges.filter((b) => b.id !== id);
      persist(list);
    },
    [bridges, persist],
  );

  const onDuplicate = useCallback(
    (id: string) => {
      const src = bridges.find((b) => b.id === id);
      if (!src) return;
      const copy: MessagingBridge = {
        ...src,
        id: newId("brg"),
        label: `${src.label} (copy)`,
        userId: "", // do not copy user_id — the second bot may belong to a different user
        status: "unknown",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persist([...bridges, copy]);
    },
    [bridges, persist],
  );

  const addBridge = useCallback(
    (platform: MessagingPlatform) => {
      const meta = PLATFORMS[platform];
      const b = makeBridge({
        platform,
        label: `${meta.label} bridge`,
        agentId: agents[0]?.id ?? "",
      });
      persist([...bridges, b]);
    },
    [bridges, agents, persist],
  );

  // ── Counts per platform (for the add row) ──
  const counts = useMemo(() => {
    const c: Record<MessagingPlatform, number> = {
      telegram: 0,
      "google-voice": 0,
      messenger: 0,
      instagram: 0,
    };
    for (const b of bridges) c[b.platform] += 1;
    return c;
  }, [bridges]);

  // ── Render ──
  if (error && bridges.length === 0) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Messaging section failed to load: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
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
            Messaging bridges
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Telegram, Google Voice, Messenger, Instagram. Add as many bridges
            as you need — two Telegram bots, one per agent, is fine. Tokens
            live in Supabase; the hub only stores which user_id they belong to.
          </div>
        </div>
      </div>

      {!WORKER_URL && (
        <div
          style={{
            ...CARD,
            borderColor: `${C.amber}44`,
            background: "rgba(251,191,36,0.06)",
            fontSize: 12,
            color: C.t2,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: C.amber }}>VITE_WORKER_URL not set.</strong>{" "}
          Bridge configs will save locally, but PROBE and STORE TOKEN are
          disabled. Set the env var to point at your Worker and reload.
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

      {bridges.length === 0 && (
        <div
          style={{
            ...CARD,
            padding: 32,
            textAlign: "center",
            fontSize: 12,
            color: C.dim,
          }}
        >
          No bridges configured. Add one below.
        </div>
      )}

      {bridges.map((b) => (
        <BridgeCard
          key={b.id}
          bridge={b}
          agents={agents}
          onUpdate={onUpdate}
          onDuplicate={() => onDuplicate(b.id)}
          onDelete={() => onDelete(b.id)}
        />
      ))}

      {/* Add bridge — one button per platform, always available, with count badge */}
      <div style={{ ...CARD, marginTop: 16 }}>
        <div style={LABEL}>Add bridge</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PLATFORM_ORDER.map((p) => {
            const meta = PLATFORMS[p];
            const n = counts[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => addBridge(p)}
                style={{
                  ...BTN,
                  color: C.teal,
                  borderColor: `${C.teal}66`,
                  background: `${C.teal}18`,
                }}
                title={
                  n > 0
                    ? `Add another ${meta.label} bridge (${n} already configured)`
                    : `Add a ${meta.label} bridge`
                }
              >
                <Plus size={12} /> {meta.icon} {meta.label}
                {n > 0 && (
                  <span
                    style={{
                      marginLeft: 4,
                      padding: "0 5px",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.3)",
                      fontSize: 9,
                      color: C.teal,
                    }}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.dim,
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          Every bridge is independent — its own token, its own Supabase
          user_id, its own agent binding. Duplicate an existing bridge to
          spin up a second bot for the same platform without retyping.
        </div>
      </div>
    </div>
  );
}