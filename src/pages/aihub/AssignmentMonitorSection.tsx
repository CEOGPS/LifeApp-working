// src/pages/aihub/AssignmentMonitorSection.tsx
// ============================================================================
// AI Hub — Assignment monitor
//
// Tasks assigned to agents. Stored in lifeos_kv2_aihub_assignments. Every
// assignment has a status, priority, assignee, notes, optional due date.
// Filter by assignee, status, priority. Sort by due, priority, or created.
//
// Does NOT touch lifeos_tasks_queue. That key's shape is unverified in the
// handoff and coupling to it would be unsafe.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Circle,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { C } from "@/lib/palette";
import type {
  Agent,
  AgentAssignment,
  AssignmentPriority,
  AssignmentStatus,
} from "./types";
import {
  loadAgents,
  loadAssignments,
  upsertAssignment,
  deleteAssignment,
  makeAssignment,
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
  padding: "7px 9px",
  color: C.text,
  fontSize: 11,
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

// ── Status / priority meta ───────────────────────────────────────────────────

const STATUS_META: Record<
  AssignmentStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: { label: "Pending", color: C.amber, icon: <Circle size={11} /> },
  active: { label: "Active", color: C.teal, icon: <PlayCircle size={11} /> },
  blocked: { label: "Blocked", color: C.red, icon: <PauseCircle size={11} /> },
  done: { label: "Done", color: C.green, icon: <CheckCircle2 size={11} /> },
  cancelled: { label: "Cancelled", color: C.dim, icon: <XCircle size={11} /> },
};

const STATUS_ORDER: AssignmentStatus[] = [
  "pending",
  "active",
  "blocked",
  "done",
  "cancelled",
];

const PRIORITY_META: Record<AssignmentPriority, { label: string; color: string }> = {
  low: { label: "Low", color: C.muted },
  normal: { label: "Normal", color: C.t2 },
  high: { label: "High", color: C.amber },
  urgent: { label: "Urgent", color: C.red },
};

const PRIORITY_ORDER: AssignmentPriority[] = ["low", "normal", "high", "urgent"];

// ── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  a: AgentAssignment;
  agents: Agent[];
  onChange: (next: AgentAssignment) => void;
  onDelete: () => void;
}

function AssignmentRow({ a, agents, onChange, onDelete }: RowProps) {
  const status = STATUS_META[a.status];
  const priority = PRIORITY_META[a.priority];
  const assignee = agents.find((x) => x.id === a.assigneeId);
  const overdue =
    a.dueAt &&
    a.status !== "done" &&
    a.status !== "cancelled" &&
    new Date(a.dueAt).getTime() < Date.now();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 140px 90px 130px 36px",
        gap: 8,
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${overdue ? `${C.red}44` : "rgba(255,255,255,0.05)"}`,
        marginBottom: 6,
      }}
    >
      {/* Status */}
      <select
        value={a.status}
        onChange={(e) =>
          onChange({
            ...a,
            status: e.target.value as AssignmentStatus,
            updatedAt: new Date().toISOString(),
          })
        }
        style={{
          ...FIELD,
          color: status.color,
          borderColor: `${status.color}55`,
          background: `${status.color}11`,
          fontWeight: 700,
        }}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>

      {/* Title + notes */}
      <div style={{ minWidth: 0 }}>
        <input
          style={{
            ...FIELD,
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 3,
          }}
          value={a.title}
          placeholder="Title"
          onChange={(e) =>
            onChange({ ...a, title: e.target.value, updatedAt: new Date().toISOString() })
          }
        />
        <input
          style={{ ...FIELD, fontSize: 10, color: C.muted }}
          value={a.notes}
          placeholder="Notes…"
          onChange={(e) =>
            onChange({ ...a, notes: e.target.value, updatedAt: new Date().toISOString() })
          }
        />
      </div>

      {/* Assignee */}
      <select
        value={a.assigneeId}
        onChange={(e) =>
          onChange({
            ...a,
            assigneeId: e.target.value,
            updatedAt: new Date().toISOString(),
          })
        }
        style={FIELD}
      >
        <option value="">— unassigned —</option>
        {agents.map((ag) => (
          <option key={ag.id} value={ag.id}>
            {ag.name}
          </option>
        ))}
      </select>

      {/* Priority */}
      <select
        value={a.priority}
        onChange={(e) =>
          onChange({
            ...a,
            priority: e.target.value as AssignmentPriority,
            updatedAt: new Date().toISOString(),
          })
        }
        style={{
          ...FIELD,
          color: priority.color,
          borderColor: `${priority.color}55`,
        }}
      >
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>

      {/* Due */}
      <input
        type="date"
        value={a.dueAt ? a.dueAt.slice(0, 10) : ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            ...a,
            dueAt: v ? new Date(v).toISOString() : null,
            updatedAt: new Date().toISOString(),
          });
        }}
        style={{
          ...FIELD,
          color: overdue ? C.red : C.text,
          borderColor: overdue ? `${C.red}66` : "rgba(255,255,255,0.08)",
        }}
      />

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        title="Delete assignment"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: C.muted,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Trash2 size={13} />
      </button>

      {/* Tiny assignee avatar + status icon, drawn under the row via pseudo-grid */}
      <div
        style={{
          gridColumn: "1 / -1",
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: -2,
          fontSize: 9,
          color: C.dim,
        }}
      >
        <span style={{ color: status.color, display: "inline-flex", gap: 4, alignItems: "center" }}>
          {status.icon}
          {status.label}
        </span>
        {assignee && (
          <span>
            · assigned to{" "}
            <span style={{ color: assignee.color }}>{assignee.name}</span>
          </span>
        )}
        {a.dueAt && (
          <span style={{ color: overdue ? C.red : C.dim }}>
            · due {new Date(a.dueAt).toLocaleDateString()}
            {overdue ? " (overdue)" : ""}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          created {new Date(a.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────

type SortKey = "due" | "priority" | "created" | "status";

export default function AssignmentMonitorSection() {
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<AssignmentStatus | "">("");
  const [filterPriority, setFilterPriority] = useState<AssignmentPriority | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("due");

  // ── Load ──
  useEffect(() => {
    try {
      setAssignments(loadAssignments());
      const map = loadAgents();
      setAgents(Object.values(map));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assignments");
    }
  }, []);

  // ── Persist ──
  const persist = useCallback((list: AgentAssignment[]) => {
    setAssignments(list);
    try {
      for (const a of list) upsertAssignment(a);
      const ids = new Set(list.map((x) => x.id));
      const onDisk = loadAssignments();
      for (const old of onDisk) if (!ids.has(old.id)) deleteAssignment(old.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }, []);

  const onChange = useCallback(
    (next: AgentAssignment) => {
      const list = assignments.map((x) => (x.id === next.id ? next : x));
      persist(list);
    },
    [assignments, persist],
  );

  const onDelete = useCallback(
    (id: string) => {
      persist(assignments.filter((x) => x.id !== id));
    },
    [assignments, persist],
  );

  const addAssignment = useCallback(() => {
    const created = makeAssignment({
      title: "New assignment",
      assigneeId: agents[0]?.id ?? "",
      status: "pending",
      priority: "normal",
    });
    persist([created, ...assignments]);
  }, [assignments, agents, persist]);

  // ── Filter + sort ──
  const visible = useMemo(() => {
    let list = assignments.slice();
    if (filterAssignee) list = list.filter((a) => a.assigneeId === filterAssignee);
    if (filterStatus) list = list.filter((a) => a.status === filterStatus);
    if (filterPriority) list = list.filter((a) => a.priority === filterPriority);

    const cmp = (x: AgentAssignment, y: AgentAssignment): number => {
      switch (sortKey) {
        case "due": {
          const xd = x.dueAt ? new Date(x.dueAt).getTime() : Infinity;
          const yd = y.dueAt ? new Date(y.dueAt).getTime() : Infinity;
          return xd - yd;
        }
        case "priority": {
          return (
            PRIORITY_ORDER.indexOf(y.priority) -
            PRIORITY_ORDER.indexOf(x.priority)
          );
        }
        case "status": {
          return (
            STATUS_ORDER.indexOf(x.status) - STATUS_ORDER.indexOf(y.status)
          );
        }
        case "created":
        default:
          return (
            new Date(y.createdAt).getTime() -
            new Date(x.createdAt).getTime()
          );
      }
    };
    return list.sort(cmp);
  }, [assignments, filterAssignee, filterStatus, filterPriority, sortKey]);

  // ── Summary counts ──
  const counts = useMemo(() => {
    const c: Record<AssignmentStatus, number> = {
      pending: 0,
      active: 0,
      blocked: 0,
      done: 0,
      cancelled: 0,
    };
    for (const a of assignments) c[a.status] += 1;
    return c;
  }, [assignments]);

  // ── Render ──
  if (error && assignments.length === 0) {
    return (
      <div style={{ padding: 24, color: C.red, fontSize: 13 }}>
        Assignment monitor failed to load: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
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
            Assignment monitor
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            {assignments.length} assignment
            {assignments.length === 1 ? "" : "s"}
            {counts.active + counts.pending > 0 && (
              <>
                {" · "}
                <span style={{ color: C.teal }}>
                  {counts.active} active
                </span>{" "}
                ·{" "}
                <span style={{ color: C.amber }}>
                  {counts.pending} pending
                </span>
              </>
            )}
            {counts.blocked > 0 && (
              <>
                {" · "}
                <span style={{ color: C.red }}>
                  {counts.blocked} blocked
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={addAssignment}
          style={{
            ...BTN,
            color: C.teal,
            borderColor: `${C.teal}66`,
            background: `${C.teal}18`,
          }}
        >
          <Plus size={12} /> NEW ASSIGNMENT
        </button>
      </div>

      {/* Filters */}
      <div style={{ ...CARD, display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Filter size={12} style={{ color: C.muted }} />
          <span style={{ fontSize: 11, color: C.muted }}>Filter</span>
        </div>

        <div style={{ width: 160 }}>
          <div style={LABEL}>Assignee</div>
          <select
            style={FIELD}
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
          >
            <option value="">All</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: 130 }}>
          <div style={LABEL}>Status</div>
          <select
            style={FIELD}
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as AssignmentStatus | "")
            }
          >
            <option value="">All</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: 130 }}>
          <div style={LABEL}>Priority</div>
          <select
            style={FIELD}
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value as AssignmentPriority | "")
            }
          >
            <option value="">All</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: 140, marginLeft: "auto" }}>
          <div
            style={{
              ...LABEL,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <ArrowUpDown size={10} /> Sort
          </div>
          <select
            style={FIELD}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
            <option value="created">Recently created</option>
          </select>
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

      {assignments.length === 0 && (
        <div
          style={{
            ...CARD,
            padding: 32,
            textAlign: "center",
            fontSize: 12,
            color: C.dim,
          }}
        >
          No assignments yet. Click NEW ASSIGNMENT to create one.
        </div>
      )}

      {assignments.length > 0 && visible.length === 0 && (
        <div
          style={{
            ...CARD,
            padding: 24,
            textAlign: "center",
            fontSize: 12,
            color: C.dim,
          }}
        >
          Nothing matches the current filters.
        </div>
      )}

      {visible.map((a) => (
        <AssignmentRow
          key={a.id}
          a={a}
          agents={agents}
          onChange={onChange}
          onDelete={() => onDelete(a.id)}
        />
      ))}

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
          Storage
        </div>
        Assignments persist to{" "}
        <code style={{ color: C.text }}>lifeos_kv2_aihub_assignments</code> — the
        KV mirror namespace. This section does <em>not</em> touch{" "}
        <code style={{ color: C.text }}>lifeos_tasks_queue</code>, which is a
        separate store with an unverified shape. Overdue rows (due date in the
        past, status not done/cancelled) are outlined in red.
      </div>
    </div>
  );
}