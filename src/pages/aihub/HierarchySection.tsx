// src/pages/aihub/HierarchySection.tsx
// ============================================================================
// AI Hub — Hierarchy
//
// Renders the org tree from Agent.parentId. No separate store. All reads and
// writes go through lifeos_agents via storage.ts. Cycle-safe: a node cannot
// be re-parented to itself or to any of its descendants.
//
// Roles are free-form strings on Agent.hierarchyRole. Common values:
//   commander | primary | sub | skin
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Bot, Users } from "lucide-react";
import { C } from "@/lib/palette";
import type { Agent, AgentsMap, HierarchyNode } from "./types";
import { loadAgents, saveAgents } from "./storage";

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
  padding: "6px 9px",
  color: C.text,
  fontSize: 11,
  fontFamily: "inherit",
  outline: "none",
};

// ── Tree building ────────────────────────────────────────────────────────────

function buildTree(agents: AgentsMap): HierarchyNode[] {
  const byId = new Map<string, Agent>(Object.entries(agents));
  const childrenOf = new Map<string | null, Agent[]>();

  for (const a of byId.values()) {
    // If parentId points at a node that doesn't exist, treat as top-level.
    const parentId =
      a.parentId && byId.has(a.parentId) ? a.parentId : null;
    const list = childrenOf.get(parentId) ?? [];
    list.push(a);
    childrenOf.set(parentId, list);
  }

  const sortByName = (list: Agent[]): Agent[] =>
    list.slice().sort((x, y) => x.name.localeCompare(y.name));

  const make = (a: Agent): HierarchyNode => {
    const kids = sortByName(childrenOf.get(a.id) ?? []);
    return { agent: a, children: kids.map(make) };
  };

  const roots = sortByName(childrenOf.get(null) ?? []);
  return roots.map(make);
}

/** True if `candidateParentId` is `nodeId` itself or a descendant of `nodeId`. */
function isSelfOrDescendant(
  agents: AgentsMap,
  nodeId: string,
  candidateParentId: string,
): boolean {
  if (nodeId === candidateParentId) return true;
  let cur: string | null = candidateParentId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur === nodeId) return true;
    const parent: string | null = agents[cur]?.parentId ?? null;
    cur = parent;
  }
  return false;
}

// ── Tree node ────────────────────────────────────────────────────────────────

interface NodeRowProps {
  node: HierarchyNode;
  depth: number;
  agents: AgentsMap;
  allIds: string[];
  onChangeParent: (id: string, newParent: string | null) => void;
  onChangeRole: (id: string, newRole: string) => void;
}

function NodeRow({
  node,
  depth,
  agents,
  allIds,
  onChangeParent,
  onChangeRole,
}: NodeRowProps) {
  const [open, setOpen] = useState(depth < 2);
  const a = node.agent;
  const hasChildren = node.children.length > 0;

  // Candidate parents: everyone except self and descendants.
  const parentOptions = useMemo(
    () =>
      allIds.filter(
        (id) => !isSelfOrDescendant(agents, a.id, id),
      ),
    [agents, allIds, a.id],
  );

  const initial = a.name.charAt(0).toUpperCase();

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 10px",
          marginLeft: depth * 18,
          borderRadius: 8,
          background:
            depth === 0 ? "rgba(255,255,255,0.03)" : "transparent",
          border: "1px solid rgba(255,255,255,0.04)",
          marginBottom: 4,
        }}
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => hasChildren && setOpen((v) => !v)}
          disabled={!hasChildren}
          style={{
            width: 16,
            height: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            padding: 0,
            cursor: hasChildren ? "pointer" : "default",
            color: hasChildren ? C.t2 : "transparent",
            flexShrink: 0,
          }}
          aria-label={hasChildren ? (open ? "Collapse" : "Expand") : ""}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )
          ) : null}
        </button>

        {/* Avatar */}
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#07080f",
            border: `1.5px solid ${a.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {a.avatar.img ? (
            <img
              src={a.avatar.img}
              alt={a.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: a.avatar.facePos ?? "50% 15%",
              }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
                if (el.parentElement) {
                  el.parentElement.innerHTML =
                    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;color:${a.color};font-weight:700">${initial}</div>`;
                }
              }}
            />
          ) : a.avatar.emoji ? (
            <span style={{ fontSize: 12, color: a.color }}>
              {a.avatar.emoji}
            </span>
          ) : (
            <Bot size={11} style={{ color: a.color }} />
          )}
        </div>

        {/* Name */}
        <div
          style={{
            minWidth: 120,
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={a.name}
        >
          {a.name}
        </div>

        {/* Role */}
        <div style={{ minWidth: 110 }}>
          <select
            style={FIELD}
            value={a.hierarchyRole}
            onChange={(e) => onChangeRole(a.id, e.target.value)}
          >
            <option value="commander">Commander</option>
            <option value="primary">Primary</option>
            <option value="sub">Sub</option>
            <option value="skin">Skin</option>
          </select>
        </div>

        {/* Parent */}
        <div style={{ flex: 1, minWidth: 160 }}>
          <select
            style={FIELD}
            value={a.parentId ?? ""}
            onChange={(e) =>
              onChangeParent(a.id, e.target.value || null)
            }
          >
            <option value="">— root —</option>
            {parentOptions.map((id) => (
              <option key={id} value={id}>
                {agents[id]?.name ?? id}
              </option>
            ))}
          </select>
        </div>

        {/* Type badge */}
        <span
          style={{
            fontSize: 9,
            padding: "2px 7px",
            borderRadius: 999,
            background: `${a.color}22`,
            border: `1px solid ${a.color}55`,
            color: a.color,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {a.type}
        </span>
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map((c) => (
            <NodeRow
              key={c.agent.id}
              node={c}
              depth={depth + 1}
              agents={agents}
              allIds={allIds}
              onChangeParent={onChangeParent}
              onChangeRole={onChangeRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

export default function HierarchySection() {
  const [agents, setAgents] = useState<AgentsMap>({});
  const [error, setError] = useState<string | null>(null);

  // ── Load ──
  useEffect(() => {
    try {
      setAgents(loadAgents());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agents");
    }
  }, []);

  const persist = useCallback((next: AgentsMap) => {
    setAgents(next);
    try {
      saveAgents(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }, []);

  const onChangeParent = useCallback(
    (id: string, newParent: string | null) => {
      const a = agents[id];
      if (!a) return;
      if (newParent && isSelfOrDescendant(agents, id, newParent)) return;
      persist({
        ...agents,
        [id]: {
          ...a,
          parentId: newParent,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [agents, persist],
  );

  const onChangeRole = useCallback(
    (id: string, newRole: string) => {
      const a = agents[id];
      if (!a) return;
      persist({
        ...agents,
        [id]: {
          ...a,
          hierarchyRole: newRole,
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [agents, persist],
  );

  const tree = useMemo(() => buildTree(agents), [agents]);
  const allIds = useMemo(() => Object.keys(agents), [agents]);
  const total = allIds.length;
  const roots = tree.length;

  // ── Render ──
  if (error && total === 0) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Hierarchy failed to load: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Users size={18} style={{ color: C.t2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
            Hierarchy
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {total} agent{total === 1 ? "" : "s"} · {roots} root
            {roots === 1 ? "" : "s"} · re-parent any node; cycles are
            rejected
          </div>
        </div>
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

      {total === 0 && (
        <div
          style={{
            ...CARD,
            padding: 32,
            textAlign: "center",
            fontSize: 12,
            color: C.dim,
          }}
        >
          No agents in the hub yet. Add one in the Agents section first.
        </div>
      )}

      {total > 0 && (
        <div>
          {tree.map((node) => (
            <NodeRow
              key={node.agent.id}
              node={node}
              depth={0}
              agents={agents}
              allIds={allIds}
              onChangeParent={onChangeParent}
              onChangeRole={onChangeRole}
            />
          ))}
        </div>
      )}

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
          How this works
        </div>
        Hierarchy is derived from <code style={{ color: C.text }}>parentId</code>{" "}
        on each agent. Nothing is stored separately. Re-parenting a node
        updates <code style={{ color: C.text }}>lifeos_agents[id].parentId</code>{" "}
        directly. The parent dropdown excludes the node itself and all of its
        descendants, so you cannot create a cycle. If a parent id points at a
        missing agent, the node is treated as a root.
      </div>
    </div>
  );
}