import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bot,
  Circle,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  XCircle,
  Cloud,
  RefreshCw,
  Mail,
  Server,
} from "lucide-react";
import {
  loadAgents,
  loadAssignments,
  loadWorkers,
  ensureKnownWorkers,
  upsertWorker,
  makeWorker,
} from "@/pages/aihub/storage";
import type {
  Agent,
  AgentAssignment,
  AssignmentStatus,
  CloudflareWorker,
} from "@/pages/aihub/types";
import { isWorkerAgent } from "@/pages/aihub/types";
import { ownerHeaders } from "../_lib/ownerHeaders";
import { lifeosApi } from "@/lib/api";

// PATCH: home "AI Task Monitor" reads AI Hub assignments + agents, and surfaces
// Cloudflare workers assigned to roles (lifeos1-api → API, maildevil → mail, …).
// Also merges live /api/cloudflare/summary worker_scripts when the CF key works.

const STATUS_META: Record<
  AssignmentStatus,
  { label: string; color: string; icon: ReactNode }
> = {
  pending: { label: "Pending", color: "oklch(0.78 0.14 85)", icon: <Circle size={11} /> },
  active: { label: "Active", color: "oklch(0.78 0.12 200)", icon: <PlayCircle size={11} /> },
  blocked: { label: "Blocked", color: "oklch(0.7 0.18 25)", icon: <PauseCircle size={11} /> },
  done: { label: "Done", color: "oklch(0.75 0.15 155)", icon: <CheckCircle2 size={11} /> },
  cancelled: { label: "Cancelled", color: "oklch(0.55 0.02 240)", icon: <XCircle size={11} /> },
};

/** Known CF worker → role map (used when registry has no role yet). */
const KNOWN_ROLES: Record<string, { role: string; url?: string; icon: "api" | "mail" | "other" }> = {
  "lifeos1-api": { role: "API calls - LifeOS backend", url: "https://lifeos1-api.ceogps.workers.dev", icon: "api" },
  "lifeos1": { role: "API calls - legacy worker", url: "https://lifeos1.ceogps.workers.dev", icon: "api" },
  maildevil: { role: "Mail - inbound/outbound email", url: "https://maildevil.ceogps.workers.dev", icon: "mail" },
};

function progressPct(status: AssignmentStatus): number {
  switch (status) {
    case "pending": return 10;
    case "active": return 55;
    case "blocked": return 40;
    case "done": return 100;
    case "cancelled": return 0;
    default: return 0;
  }
}

function roleFor(w: CloudflareWorker): string {
  if (w.role?.trim()) return w.role.trim();
  const known = KNOWN_ROLES[w.name.toLowerCase()];
  return known?.role || "Unassigned role";
}

function roleIcon(name: string) {
  const k = KNOWN_ROLES[name.toLowerCase()]?.icon;
  if (k === "mail") return <Mail size={14} className="text-amber-300" />;
  if (k === "api") return <Server size={14} className="text-cyan-300" />;
  return <Cloud size={14} className="text-cyan-300/90" />;
}

function agentStatusLabel(agent: Agent | undefined, workers: CloudflareWorker[]) {
  if (!agent) return { label: "Unknown agent", color: "oklch(0.55 0.02 240)" };
  if (!agent.enabled) return { label: "Disabled", color: "oklch(0.55 0.02 240)" };
  if (isWorkerAgent(agent)) {
    const linked = workers.filter((w) => w.agentId === agent.id);
    const online = linked.find((w) => w.status === "online");
    if (online) return { label: `CF · ${online.name} · ${roleFor(online)}`, color: "oklch(0.75 0.15 155)" };
    if (linked.length) {
      const w = linked[0];
      return { label: `CF · ${w.name} · ${roleFor(w)}`, color: "oklch(0.78 0.12 200)" };
    }
    return { label: "Cloudflare worker agent", color: "oklch(0.78 0.12 200)" };
  }
  if (agent.type === "autonomous") return { label: "Autonomous · online", color: "oklch(0.75 0.15 155)" };
  return { label: agent.type, color: "oklch(0.7 0.08 240)" };
}

async function fetchLiveCfScripts(): Promise<string[]> {
  try {
    const headers = await ownerHeaders();
    const res = await lifeosApi<{
      worker_scripts?: Array<{ id: string }>;
      workers?: number | null;
      error?: string;
    }>("/api/cloudflare/summary", { headers });
    const names = (res.worker_scripts || []).map((s) => s.id).filter(Boolean);
    return names;
  } catch (e) {
    console.warn("[AgentMonitor] CF summary unavailable:", e);
    return [];
  }
}

export default function AgentMonitor() {
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [workers, setWorkers] = useState<CloudflareWorker[]>([]);
  const [liveCf, setLiveCf] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      let list = ensureKnownWorkers(loadWorkers());
      // Merge live CF script names into the registry (with known roles when possible)
      const scripts = await fetchLiveCfScripts();
      setLiveCf(scripts);
      if (scripts.length) {
        const byName = new Map(list.map((w) => [w.name.toLowerCase(), w]));
        for (const name of scripts) {
          const key = name.toLowerCase();
          if (byName.has(key)) continue;
          const known = KNOWN_ROLES[key];
          const created = makeWorker({
            name,
            url: known?.url || `https://${name}.ceogps.workers.dev`,
            role: known?.role || "Cloudflare Workers script",
            status: "unknown",
          });
          list = upsertWorker(created);
          byName.set(key, created);
        }
        // Fill missing roles on existing rows from KNOWN_ROLES
        for (const w of list) {
          if (!w.role && KNOWN_ROLES[w.name.toLowerCase()]) {
            w.role = KNOWN_ROLES[w.name.toLowerCase()].role;
            list = upsertWorker(w);
          }
        }
      }
      setWorkers(ensureKnownWorkers(list));
      setAssignments(loadAssignments());
      setAgents(loadAgents());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.warn("[AgentMonitor] failed to load:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const onStorage = (ev: StorageEvent) => {
      if (!ev.key) return;
      if (
        ev.key.includes("aihub_assignments") ||
        ev.key === "lifeos_agents" ||
        ev.key.includes("aihub_workers")
      ) {
        void refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    const t = window.setInterval(() => void refresh(), 20000);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(t);
    };
  }, []);

  const agentList = useMemo(() => Object.values(agents), [agents]);
  const workerAgents = useMemo(() => agentList.filter(isWorkerAgent), [agentList]);

  const activeish = useMemo(
    () =>
      [...assignments].sort((a, b) => {
        const order: Record<AssignmentStatus, number> = {
          active: 0, blocked: 1, pending: 2, done: 3, cancelled: 4,
        };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      }),
    [assignments],
  );

  const counts = useMemo(() => {
    const c = { pending: 0, active: 0, blocked: 0, done: 0, cancelled: 0 };
    for (const a of assignments) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [assignments]);

  return (
    <div className="flex flex-col gap-3 h-full min-h-0" data-testid="ai-task-monitor">
      {/* CF workers assigned to roles — always visible */}
      <div className="shrink-0 space-y-1.5" data-testid="cf-worker-roles">
        <div className="flex items-center gap-2">
          <Cloud size={12} className="text-cyan-300/80" />
          <span className="text-[10px] font-display tracking-widest text-cyan-200/80 uppercase">
            Cloudflare workers · role assignments
          </span>
          {liveCf.length > 0 && (
            <span className="text-[9px] text-emerald-400/80 ml-auto">{liveCf.length} live from CF API</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
          {(loading ? [] : workers).map((w) => {
            const role = roleFor(w);
            const linked = w.agentId ? agents[w.agentId] : null;
            return (
              <div
                key={w.id}
                className="flex items-start gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-2"
              >
                <div className="w-7 h-7 rounded-full glass-crimson flex items-center justify-center shrink-0">
                  {roleIcon(w.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-white/90 truncate">{w.name}</span>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        w.status === "online"
                          ? "text-emerald-400 bg-emerald-400/10"
                          : w.status === "offline"
                            ? "text-red-400 bg-red-400/10"
                            : "text-white/35 bg-white/5"
                      }`}
                    >
                      {w.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-200/90 mt-0.5 truncate" title={role}>
                    → {role}
                  </div>
                  {linked && (
                    <div className="text-[9px] text-white/35 mt-0.5 truncate">
                      Agent: <span style={{ color: linked.color }}>{linked.name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!loading && workers.length === 0 && (
            <div className="text-[11px] text-white/35 col-span-full py-2">
              No Cloudflare workers registered yet.
            </div>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 border-t border-white/5 pt-2">
        <span className="text-[10px] font-display tracking-widest text-white/45 uppercase">
          {assignments.length} tasks · {agentList.length} agents
          {workerAgents.length ? ` · ${workerAgents.length} CF agents` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {(["active", "pending", "blocked", "done"] as AssignmentStatus[]).map((s) => (
            <span
              key={s}
              className="text-[9px] px-1.5 py-0.5 rounded border border-white/8"
              style={{ color: STATUS_META[s].color }}
            >
              {STATUS_META[s].label} {counts[s] ?? 0}
            </span>
          ))}
          <button
            type="button"
            onClick={() => void refresh()}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
            title="Refresh"
            aria-label="Refresh AI Task Monitor"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-red-400 shrink-0" role="alert">{error}</div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass rounded-lg p-3 border border-white/5 h-16 animate-pulse" />
          ))
        ) : activeish.length === 0 ? (
          <div className="text-center py-6 text-[11px] text-white/35 space-y-2">
            <div>No AI Hub task assignments yet — CF worker roles above still apply.</div>
            <div className="text-white/25">
              Create assignments in AI Hub → Assignments to track agent progress here.
            </div>
          </div>
        ) : (
          activeish.map((task) => {
            const agent = agents[task.assigneeId];
            const meta = STATUS_META[task.status];
            const pct = progressPct(task.status);
            const agentSt = agentStatusLabel(agent, workers);
            const isCf = agent ? isWorkerAgent(agent) : false;
            return (
              <div
                key={task.id}
                className="glass rounded-lg p-3 border border-white/5 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full glass-crimson flex items-center justify-center shrink-0"
                    style={agent?.color ? { boxShadow: `0 0 10px ${agent.color}55` } : undefined}
                  >
                    {isCf ? <Cloud size={14} className="text-cyan-300/90" /> : <Bot size={14} className="text-primary/80" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-white/85 font-medium truncate">{task.title}</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] shrink-0" style={{ color: meta.color }}>
                        {meta.icon}
                        {meta.label}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/40 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>
                        Agent:{" "}
                        <span style={{ color: agent?.color || "rgba(255,255,255,0.7)" }}>
                          {agent?.name ?? (task.assigneeId || "unassigned")}
                        </span>
                        {isCf && <span className="ml-1 text-cyan-300/70">· CF</span>}
                      </span>
                      <span style={{ color: agentSt.color }}>{agentSt.label}</span>
                      {task.dueAt && <span>Due {new Date(task.dueAt).toLocaleDateString()}</span>}
                    </div>
                    {task.notes && (
                      <div className="mt-1 text-[10px] text-white/30 truncate">{task.notes}</div>
                    )}
                    <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
