// src/panels/TaskPanel.tsx
// LifeOS1 — Task Orchestration Panel (Batch 5)
// Path B: real CRUD against Worker /api/tasks/*.
// Two lists (queue/backlog) are a `list` column, not two stores.
// `source` is real ingestion provenance; null for manual tasks.

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  ListChecks, Plus, AlertCircle, CheckCircle, Info, Trash2, Loader2,
  Sparkles, Copy, X, ChevronUp, ChevronDown, ArrowRight, ArrowLeft,
  Download, Play, Pause, GripVertical, Check, Pencil, RefreshCw,
} from "lucide-react";
interface LLMResponse {
  text?: string;
  content?: string;
}

async function invokeLLM(options: { prompt: string; signal?: AbortSignal }): Promise<LLMResponse> {
  const response = await fetch("/api/llm", {
    method: "POST",
    signal: options.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: options.prompt }),
  });

  if (!response.ok) {
    let message = `LLM request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") message = body.error;
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      // Keep the HTTP status when the response is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<LLMResponse>;
}

function useUserEmail(): { email: string } {
  const [email, setEmail] = useState("");

  useEffect(() => {
    try {
      const storedEmail = window.localStorage.getItem("lifeos_user_email");
      if (storedEmail) setEmail(storedEmail);
    } catch {
      // User email is optional.
    }
  }, []);

  return { email };
}

function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initialValue : (JSON.parse(stored) as T);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Persistence is best effort.
    }
  }, [key, value]);

  return [value, setValue];
}

/** Tasks stay in this browser. /api/tasks was returning the website HTML. */
const TASKS_KEY = "lifeos_tasks_local";

function readLocalTasks(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalTasks(tasks: Array<Record<string, unknown>>) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

async function lifeosApi<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const tasks = readLocalTasks();
  const id = path.split("?")[0].split("/").pop() || "";

  if (method === "GET") {
    return { tasks } as T;
  }
  if (method === "POST" && path.split("?")[0] === "/api/tasks") {
    const body = JSON.parse(String(init?.body || "{}"));
    const task = {
      id: crypto.randomUUID(),
      notes: null,
      done: false,
      done_at: null,
      due_date: null,
      source: null,
      source_ref: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    };
    writeLocalTasks([...tasks, task]);
    return { task } as T;
  }
  if (method === "PATCH") {
    const body = JSON.parse(String(init?.body || "{}"));
    writeLocalTasks(
      tasks.map((t) => (t.id === id ? { ...t, ...body, updated_at: new Date().toISOString() } : t)),
    );
    return { ok: true } as T;
  }
  if (method === "DELETE") {
    writeLocalTasks(tasks.filter((t) => t.id !== id));
    return undefined as T;
  }
  if (method === "POST" && path.split("?")[0] === "/api/tasks/reorder") {
    const body = JSON.parse(String(init?.body || "{}"));
    const list = body.list;
    const ordered: string[] = Array.isArray(body.ordered_ids) ? body.ordered_ids : [];
    writeLocalTasks(
      tasks.map((t) => {
        if (t.list !== list) return t;
        const idx = ordered.indexOf(String(t.id));
        return idx === -1 ? t : { ...t, position: idx };
      }),
    );
    return { success: true } as T;
  }
  return { success: true } as T;
}

interface PanelLayoutProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

function PanelLayout({ title, subtitle, icon, actions, children }: PanelLayoutProps) {
  return (
    <section className="h-full flex flex-col min-h-0">
      <header className="flex items-center gap-3 px-1 pb-3 shrink-0">
        {icon && <div className="text-primary shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-sm font-display tracking-wider text-white/90">{title}</h1>
          {subtitle && <p className="text-[10px] text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="ml-auto">{actions}</div>}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TaskList = "queue" | "backlog";
type Priority = "high" | "medium" | "low";
type Module =
  | "CRM" | "Email" | "Finance" | "Calendar" | "Agent" | "Terminal"
  | "Projects" | "Contacts" | "Maps";
type Source =
  | "stripe" | "github" | "gmail" | "crm" | "agent" | "system"
  | "calendar" | "slack" | "contacts" | "projects" | "maps" | "webhook";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  module: Module;
  priority: Priority;
  list: TaskList;
  position: number;
  done: boolean;
  done_at: string | null;
  due_date: string | null;
  source: Source | null;
  source_ref: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const TASK_MODULES: Module[] = [
  "CRM", "Email", "Finance", "Calendar", "Agent", "Terminal",
  "Projects", "Contacts", "Maps",
];

export const TASK_PRIORITIES: Priority[] = ["high", "medium", "low"];

export const TASK_SOURCES: Source[] = [
  "stripe", "github", "gmail", "crm", "agent", "system",
  "calendar", "slack", "contacts", "projects", "maps", "webhook",
];

const PRIORITY_COLOR: Record<Priority, string> = {
  high:   "#ff4f5e",
  medium: "#ff8c42",
  low:    "#00c896",
};
const PRIORITY_BG: Record<Priority, string> = {
  high:   "rgba(255,79,94,0.12)",
  medium: "rgba(255,140,66,0.12)",
  low:    "rgba(0,200,150,0.12)",
};

const MODULE_COLOR: Record<Module, string> = {
  CRM:      "#ff8c42",
  Email:    "#ea4335",
  Terminal: "#f0ede8",
  Calendar: "#4285f4",
  Agent:    "#8b7fff",
  Finance:  "#00c896",
  Projects: "#4ab3f4",
  Contacts: "#ff6b9d",
  Maps:     "#dc2626",
};

const LS = {
  queue:  "lifeos_tasks_queue_cache",
  backlog:"lifeos_tasks_backlog_cache",
  ai:     "lifeos_tasks_ai_output",
};

const TOAST_MS = 4200;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n");
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function TaskPanel() {
  const { email } = useUserEmail();

  /* ---- data ---- */
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- new task form ---- */
  const [newTitle, setNewTitle] = useState("");
  const [newModule, setNewModule] = useState<Module>("CRM");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newList, setNewList] = useState<TaskList>("queue");
  const [adding, setAdding] = useState(false);

  /* ---- edit state ---- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  /* ---- delete confirm ---- */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* ---- AI ---- */
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOutput, setAiOutput] = usePersistentState<string>(LS.ai, "");
  const aiAbortRef = useRef<AbortController | null>(null);

  /* ---- toast ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  /* ---- load with AbortController ---- */
  const abortRef = useRef<AbortController | null>(null);
  const loadAll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await lifeosApi<{ tasks: Task[] }>("/api/tasks?limit=500", { signal: ac.signal });
      if (ac.signal.aborted) return;
      const sorted = (res.tasks || []).slice().sort((a, b) => a.position - b.position);
      setTasks(sorted);
      // Note: caching lists manually here is a legacy pattern;
      // we'll keep it for now to avoid breaking offline behavior,
      // but normally we'd use a persistent state hook.
      localStorage.setItem(LS.queue, JSON.stringify(sorted.filter((t) => t.list === "queue")));
      localStorage.setItem(LS.backlog, JSON.stringify(sorted.filter((t) => t.list === "backlog")));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Failed to load tasks");
      // offline fallback to cached lists (honest: banner still shows error)
      const cachedQ = JSON.parse(localStorage.getItem(LS.queue) || "[]");
      const cachedB = JSON.parse(localStorage.getItem(LS.backlog) || "[]");
      if (cachedQ.length || cachedB.length) {
        setTasks([...cachedQ, ...cachedB]);
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); return () => abortRef.current?.abort(); }, [loadAll]);

  /* ---- Esc cancels edit / delete confirm / AI ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmDeleteId) setConfirmDeleteId(null);
      else if (editingId) { setEditingId(null); setEditTitle(""); }
      else if (aiBusy) { aiAbortRef.current?.abort(); setAiBusy(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingId, confirmDeleteId, aiBusy]);

  /* ---- lists ---- */
  const queue = useMemo(() => tasks.filter((t) => t.list === "queue").sort((a, b) => a.position - b.position), [tasks]);
  const backlog = useMemo(() => tasks.filter((t) => t.list === "backlog").sort((a, b) => a.position - b.position), [tasks]);

  const stats = useMemo(() => ({
    queueTotal: queue.length,
    urgent: queue.filter((t) => !t.done && t.priority === "high").length,
    done: tasks.filter((t) => t.done).length,
    backlogTotal: backlog.length,
  }), [queue, backlog, tasks]);

  /* ---- CRUD ---- */
  const addTask = useCallback(async () => {
    if (!newTitle.trim() || adding) return;
    setAdding(true);
    try {
      const listTasks = newList === "queue" ? queue : backlog;
      const position = listTasks.length ? Math.max(...listTasks.map((t) => t.position)) + 1 : 0;
      await lifeosApi("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          module: newModule,
          priority: newPriority,
          list: newList,
          position,
        }),
      });
      setNewTitle("");
      pushToast("success", "Task added");
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to add task");
    } finally {
      setAdding(false);
    }
  }, [newTitle, newModule, newPriority, newList, queue, backlog, loadAll, pushToast, adding]);

  const toggleDone = useCallback(async (t: Task) => {
    try {
      await lifeosApi(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ done: !t.done }) });
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to update task");
    }
  }, [loadAll, pushToast]);

  const saveTitle = useCallback(async (id: string) => {
    const title = editTitle.trim();
    if (!title) { setEditingId(null); return; }
    try {
      await lifeosApi(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
      setEditingId(null);
      setEditTitle("");
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to rename task");
    }
  }, [editTitle, loadAll, pushToast]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await lifeosApi(`/api/tasks/${id}`, { method: "DELETE" });
      pushToast("success", "Task deleted");
      setConfirmDeleteId(null);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to delete task");
    }
  }, [loadAll, pushToast]);

  /* ---- reorder + list transfer (atomic) ---- */
  const reorderList = useCallback(async (list: TaskList, orderedIds: string[]) => {
    // optimistic local reorder
    setTasks((prev) => {
      const updated = prev.map((t) => {
        if (t.list !== list) return t;
        const idx = orderedIds.indexOf(t.id);
        return idx === -1 ? t : { ...t, position: idx };
      });
      return updated;
    });
    try {
      await lifeosApi("/api/tasks/reorder", {
        method: "POST",
        body: JSON.stringify({ list, ordered_ids: orderedIds }),
      });
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to save order");
      await loadAll();
    }
  }, [loadAll, pushToast]);

  const moveWithinList = useCallback((list: TaskList, id: string, dir: -1 | 1) => {
    const items = (list === "queue" ? queue : backlog).slice();
    const idx = items.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    void reorderList(list, items.map((t) => t.id));
  }, [queue, backlog, reorderList]);

  const transferTask = useCallback(async (t: Task, to: TaskList) => {
    const targetList = to === "queue" ? queue : backlog;
    const position = targetList.length ? Math.max(...targetList.map((x) => x.position)) + 1 : 0;
    try {
      await lifeosApi(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ list: to, position }) });
      pushToast("success", `Moved to ${to}`);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to move task");
    }
  }, [queue, backlog, loadAll, pushToast]);

  /* ---- HTML5 drag ---- */
  const dragRef = useRef<{ id: string; fromList: TaskList } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const onDragStart = useCallback((t: Task) => {
    dragRef.current = { id: t.id, fromList: t.list };
  }, []);

  const onDropOn = useCallback(async (target: Task) => {
    const src = dragRef.current;
    dragRef.current = null;
    setDragOverId(null);
    if (!src || src.id === target.id) return;

    if (src.fromList === target.list) {
      const items = (target.list === "queue" ? queue : backlog).slice();
      const fromIdx = items.findIndex((t) => t.id === src.id);
      const toIdx = items.findIndex((t) => t.id === target.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = items.splice(fromIdx, 1);
      items.splice(toIdx, 0, moved);
      await reorderList(target.list, items.map((t) => t.id));
    } else {
      // cross-list drop: move to end of target list, then reorder before target
      const srcTask = tasks.find((t) => t.id === src.id);
      if (!srcTask) return;
      await transferTask(srcTask, target.list);
      // after transfer, user can fine-tune with arrows; positional cross-list
      // reorder in one shot would require a heavier endpoint
    }
  }, [queue, backlog, tasks, reorderList, transferTask]);

  /* ---- AI ---- */
  const runAISchedule = useCallback(async () => {
    aiAbortRef.current?.abort();
    const ac = new AbortController();
    aiAbortRef.current = ac;
    setAiBusy(true);
    setAiOutput("");
    try {
      const activeQueue = queue.filter((t) => !t.done).slice(0, 15);
      const payload = activeQueue.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        module: t.module,
        due: t.due_date,
        source: t.source,
      }));

      const res = await invokeLLM({
        prompt:
          `You are scheduling today for ${email || "this user"}.\n` +
          "Given the JSON array of active queue tasks, propose an optimal execution order. " +
          "Group by context (calls, desk work, follow-ups, external dependencies). " +
          "Estimate time per task. Flag any that should be delegated or deferred. " +
          "Keep it under 180 words. Plain text, no markdown headers. " +
          "Do not invent tasks not in the list.\n\n" +
          JSON.stringify(payload, null, 2),
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      setAiOutput(res.text || res.content || "(no output)");
      pushToast("success", "Schedule ready");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      pushToast("error", e?.message || "AI schedule failed");
    } finally {
      if (!ac.signal.aborted) setAiBusy(false);
    }
  }, [queue, email, pushToast]);

  const aiSuggestTasks = useCallback(async () => {
    setAiBusy(true);
    try {
      const sample = tasks.slice(0, 20).map((t) => ({ title: t.title, module: t.module, done: t.done }));
      const res = await invokeLLM({
        prompt:
          "Based on these recent tasks, suggest 5 new tasks the user likely needs but hasn't written down. " +
          "Return ONLY a JSON array of objects: " +
          `[{"title":string,"module":"CRM"|"Email"|"Finance"|"Calendar"|"Agent"|"Terminal"|"Projects"|"Contacts"|"Maps","priority":"high"|"medium"|"low"}]. ` +
          "No prose, no code fences.\n\n" +
          JSON.stringify(sample),
      });
      const raw = (res.text || res.content || "").trim();
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let suggestions: { title: string; module: Module; priority: Priority }[] = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          suggestions = parsed.filter((x) =>
            x && typeof x.title === "string" &&
            TASK_MODULES.includes(x.module) &&
            TASK_PRIORITIES.includes(x.priority),
          );
        }
      } catch { /* fall through */ }

      if (!suggestions.length) {
        setAiOutput(raw || "(no parseable suggestions)");
        pushToast("info", "AI returned no usable suggestions — showing raw output");
        return;
      }
      for (const s of suggestions) {
        await lifeosApi("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title: s.title, module: s.module, priority: s.priority, list: "queue" }),
        });
      }
      pushToast("success", `Added ${suggestions.length} suggested tasks`);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "AI suggestions failed");
    } finally {
      setAiBusy(false);
    }
  }, [tasks, loadAll, pushToast]);

  const copyAI = useCallback(async () => {
    if (!aiOutput) return;
    try { await navigator.clipboard.writeText(aiOutput); pushToast("success", "Copied"); }
    catch { pushToast("error", "Clipboard blocked"); }
  }, [aiOutput, pushToast]);

  /* ---- CSV ---- */
  const exportCsv = useCallback(() => {
    const rows = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      list: t.list,
      module: t.module,
      priority: t.priority,
      done: t.done ? "yes" : "no",
      due_date: t.due_date ?? "",
      source: t.source ?? "",
      position: t.position,
      created_at: t.created_at,
      done_at: t.done_at ?? "",
      notes: t.notes ?? "",
    }));
    if (!rows.length) { pushToast("info", "Nothing to export"); return; }
    downloadCsv(`lifeos-tasks-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    pushToast("success", `Exported ${rows.length} tasks`);
  }, [tasks, pushToast]);

  /* ---- render ---- */
  return (
    <PanelLayout
      title="Task Orchestration"
      subtitle="Auto-ingested tasks · drag or use arrows to reorder · AI schedule"
      icon={<ListChecks size={18} />}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={runAISchedule}
            disabled={aiBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm transition-all disabled:opacity-40"
          >
            {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {aiBusy ? "SCHEDULING…" : "AI SCHEDULE DAY"}
          </button>
          <button
            onClick={aiSuggestTasks}
            disabled={aiBusy}
            title="Suggest new tasks"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary disabled:opacity-40"
          >
            <Sparkles size={12} />
          </button>
          <button
            onClick={exportCsv}
            title="Export CSV"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary"
          >
            <Download size={12} />
          </button>
          <button
            onClick={loadAll}
            title="Reload"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col gap-3 min-w-0">
        {/* ===================== ERROR BANNER ===================== */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={loadAll} className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display">
              RETRY
            </button>
          </div>
        )}

        {/* ===================== STATS ===================== */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "In Queue", value: stats.queueTotal, color: "oklch(0.72 0.15 230)" },
            { label: "Urgent", value: stats.urgent, color: PRIORITY_COLOR.high },
            { label: "Done", value: stats.done, color: PRIORITY_COLOR.low },
            { label: "Backlog", value: stats.backlogTotal, color: "oklch(0.7 0.1 240)" },
          ].map((s) => (
            <div key={s.label} className="glass rounded-xl border border-white/8 p-2 text-center">
              <div className="text-2xl font-display font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] text-white/40 font-display tracking-wider">{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* ===================== AI OUTPUT ===================== */}
        {(aiOutput || aiBusy) && (
          <div
            className="glass rounded-xl border p-3"
            style={{ borderColor: "rgba(139,127,255,0.25)", background: "rgba(139,127,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-display tracking-widest" style={{ color: "oklch(0.72 0.15 300)" }}>
                AGENT — DAILY SCHEDULE
              </div>
              <div className="flex gap-1">
                {aiBusy ? (
                  <button
                    onClick={() => { aiAbortRef.current?.abort(); setAiBusy(false); }}
                    className="px-2 py-0.5 rounded glass border border-white/10 text-white/60 hover:text-red-400 text-[10px] font-display flex items-center gap-1"
                  >
                    <Pause size={9} /> STOP
                  </button>
                ) : (
                  <>
                    <button
                      onClick={runAISchedule}
                      className="px-2 py-0.5 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                    >
                      <RefreshCw size={9} /> RE-RUN
                    </button>
                    <button
                      onClick={copyAI}
                      className="px-2 py-0.5 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                    >
                      <Copy size={9} /> COPY
                    </button>
                    <button
                      onClick={() => setAiOutput("")}
                      className="px-2 py-0.5 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                    >
                      <X size={9} /> CLEAR
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="text-[12px] text-white/75 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
              {aiBusy
                ? <span className="flex items-center gap-2 text-white/50"><Loader2 size={12} className="animate-spin" /> Building your schedule…</span>
                : aiOutput}
            </div>
            <div className="text-[9px] text-white/30 mt-2">
              AI suggestions are not auto-applied. Review before acting.
            </div>
          </div>
        )}

        {/* ===================== ADD TASK BAR ===================== */}
        <div className="glass rounded-xl border border-white/8 p-2 flex items-center gap-2 flex-wrap">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
            placeholder="Add task… (Enter to submit)"
            className="flex-1 min-w-[180px] h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/40"
          />
          <select
            value={newModule}
            onChange={(e) => setNewModule(e.target.value as Module)}
            className="h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
          >
            {TASK_MODULES.map((m) => <option key={m} value={m} style={{ background: "#0a0a0a" }}>{m}</option>)}
          </select>
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Priority)}
            className="h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
          >
            {TASK_PRIORITIES.map((p) => <option key={p} value={p} style={{ background: "#0a0a0a" }}>{p}</option>)}
          </select>
          <select
            value={newList}
            onChange={(e) => setNewList(e.target.value as TaskList)}
            className="h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
          >
            <option value="queue" style={{ background: "#0a0a0a" }}>Queue</option>
            <option value="backlog" style={{ background: "#0a0a0a" }}>Backlog</option>
          </select>
          <button
            onClick={addTask}
            disabled={!newTitle.trim() || adding}
            className="h-8 px-3 rounded-lg glass-crimson text-primary text-[11px] font-display disabled:opacity-40 flex items-center gap-1"
          >
            {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            ADD
          </button>
        </div>

        {/* ===================== LOADING ===================== */}
        {loading && tasks.length === 0 && (
          <div className="glass rounded-xl border border-white/8 p-10 text-center text-white/40 text-xs flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading tasks…
          </div>
        )}

        {/* ===================== TWO LISTS ===================== */}
        {!loading && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3 min-h-0">
            <TaskListColumn
              label="Priority Queue"
              accent="oklch(0.72 0.15 230)"
              list="queue"
              tasks={queue}
              onToggleDone={toggleDone}
              onMove={moveWithinList}
              onTransfer={(t) => transferTask(t, "backlog")}
              transferLabel="→ Backlog"
              transferIcon={<ArrowRight size={10} />}
              onDelete={(id) => setConfirmDeleteId(id)}
              onDragStart={onDragStart}
              onDropOn={onDropOn}
              dragOverId={dragOverId}
              setDragOverId={setDragOverId}
              editingId={editingId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              setEditingId={setEditingId}
              saveTitle={saveTitle}
              emptyHint="Drop tasks here or add manually above."
            />
            <TaskListColumn
              label="Backlog"
              accent="oklch(0.7 0.1 240)"
              list="backlog"
              tasks={backlog}
              onToggleDone={toggleDone}
              onMove={moveWithinList}
              onTransfer={(t) => transferTask(t, "queue")}
              transferLabel="↑ Queue"
              transferIcon={<ArrowUpSmall />}
              onDelete={(id) => setConfirmDeleteId(id)}
              onDragStart={onDragStart}
              onDropOn={onDropOn}
              dragOverId={dragOverId}
              setDragOverId={setDragOverId}
              editingId={editingId}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              setEditingId={setEditingId}
              saveTitle={saveTitle}
              emptyHint="Drag tasks here to defer them, or click → Backlog on a queue card."
            />
          </div>
        )}
        <div className="h-6" />
      </div>

      {/* ===================== DELETE CONFIRM ===================== */}
      {confirmDeleteId && (() => {
        const t = tasks.find((x) => x.id === confirmDeleteId);
        if (!t) return null;
        return (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            style={{ background: "oklch(0 0 0 / 75%)" }}
            onClick={() => setConfirmDeleteId(null)}
          >
            <div
              className="glass rounded-xl border border-red-500/30 w-full max-w-sm p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-red-400" />
                <div className="text-xs font-display text-white/80 tracking-wider">DELETE TASK</div>
              </div>
              <div className="text-[11px] text-white/60 mb-3">
                Delete <span className="text-white/85">"{t.title}"</span>? This cannot be undone.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => deleteTask(t.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-display"
                  style={{ background: "oklch(0.5 0.22 25 / 40%)", color: "oklch(0.85 0.15 25)", border: "1px solid oklch(0.6 0.25 25 / 50%)" }}
                >
                  DELETE
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===================== TOASTS ===================== */}
      <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto glass rounded-lg border px-3 py-2 text-[11px] flex items-center gap-2 max-w-sm"
            style={{
              borderColor:
                t.kind === "error" ? "oklch(0.6 0.25 25 / 50%)"
                : t.kind === "success" ? "oklch(0.7 0.18 150 / 50%)"
                : "oklch(0.7 0.15 220 / 50%)",
            }}
          >
            {t.kind === "error" && <AlertCircle size={12} className="text-red-400 shrink-0" />}
            {t.kind === "success" && <CheckCircle size={12} className="text-green-400 shrink-0" />}
            {t.kind === "info" && <Info size={12} className="text-sky-400 shrink-0" />}
            <span className="text-white/80">{t.text}</span>
          </div>
        ))}
      </div>
    </PanelLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ArrowUpSmall() {
  return <ChevronUp size={10} />;
}

interface TaskListColumnProps {
  label: string;
  accent: string;
  list: TaskList;
  tasks: Task[];
  onToggleDone: (t: Task) => void | Promise<void>;
  onMove: (list: TaskList, id: string, dir: -1 | 1) => void;
  onTransfer: (t: Task) => void | Promise<void>;
  transferLabel: string;
  transferIcon: React.ReactNode;
  onDelete: (id: string) => void;
  onDragStart: (t: Task) => void;
  onDropOn: (t: Task) => void | Promise<void>;
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;
  editingId: string | null;
  editTitle: string;
  setEditTitle: (s: string) => void;
  setEditingId: (id: string | null) => void;
  saveTitle: (id: string) => void | Promise<void>;
  emptyHint: string;
}

function TaskListColumn(props: TaskListColumnProps) {
  const {
    label, accent, list, tasks, onToggleDone, onMove, onTransfer,
    transferLabel, transferIcon, onDelete, onDragStart, onDropOn,
    dragOverId, setDragOverId, editingId, editTitle, setEditTitle,
    setEditingId, saveTitle, emptyHint,
  } = props;

  return (
    <div className="flex flex-col min-h-0 glass rounded-xl border border-white/8 p-2">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        <span className="text-[10px] font-display tracking-widest" style={{ color: accent }}>
          {label.toUpperCase()}
        </span>
        <span className="ml-auto text-[9px] text-white/30 glass px-1.5 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-[200px]">
        {tasks.length === 0 && (
          <div className="text-center text-white/25 text-[11px] py-8 italic">{emptyHint}</div>
        )}
        {tasks.map((t, idx) => {
          const isDragging = dragOverId === t.id;
          const isEditing = editingId === t.id;
          return (
            <div
              key={t.id}
              draggable={!isEditing}
              onDragStart={() => onDragStart(t)}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(t.id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => { e.preventDefault(); onDropOn(t); }}
              className={`glass rounded-lg p-2 border transition-colors ${isDragging ? "border-primary/40" : "border-white/6"}`}
              style={{
                opacity: t.done ? 0.55 : 1,
                borderLeftWidth: 2,
                borderLeftColor: PRIORITY_COLOR[t.priority],
              }}
            >
              <div className="flex items-start gap-2">
                <div className="text-white/20 cursor-grab pt-0.5 shrink-0">
                  <GripVertical size={12} />
                </div>
                <button
                  onClick={() => onToggleDone(t)}
                  className="shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center"
                  style={{
                    borderColor: t.done ? PRIORITY_COLOR.low : "oklch(1 0 0 / 20%)",
                    background: t.done ? PRIORITY_COLOR.low : "transparent",
                  }}
                  title={t.done ? "Mark not done" : "Mark done"}
                >
                  {t.done && <Check size={10} className="text-black" />}
                </button>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); saveTitle(t.id); }
                        if (e.key === "Escape") { setEditingId(null); setEditTitle(""); }
                      }}
                      onBlur={() => saveTitle(t.id)}
                      className="w-full h-6 px-1 text-[12px] rounded bg-white/5 border border-primary/30 text-white/90 focus:outline-none"
                    />
                  ) : (
                    <div
                      onDoubleClick={() => { setEditingId(t.id); setEditTitle(t.title); }}
                      className={`text-[12px] leading-snug ${t.done ? "line-through text-white/40" : "text-white/85"}`}
                      title="Double-click to rename"
                    >
                      {t.title}
                    </div>
                  )}
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-display"
                      style={{ background: PRIORITY_BG[t.priority], color: PRIORITY_COLOR[t.priority] }}
                    >
                      {t.priority.toUpperCase()}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-display"
                      style={{ background: (MODULE_COLOR[t.module] || "#4ab3f4") + "18", color: MODULE_COLOR[t.module] || "#4ab3f4" }}
                    >
                      {t.module}
                    </span>
                    {t.source && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-display glass text-white/50">
                        {t.source}
                      </span>
                    )}
                    {t.due_date && (
                      <span className="text-[9px] text-amber-300/80">due {fmtDate(t.due_date)}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => onMove(list, t.id, -1)}
                    disabled={idx === 0}
                    title="Move up"
                    className="p-0.5 rounded text-white/30 hover:text-primary disabled:opacity-20"
                  >
                    <ChevronUp size={11} />
                  </button>
                  <button
                    onClick={() => onMove(list, t.id, 1)}
                    disabled={idx === tasks.length - 1}
                    title="Move down"
                    className="p-0.5 rounded text-white/30 hover:text-primary disabled:opacity-20"
                  >
                    <ChevronDown size={11} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1 mt-1.5">
                <button
                  onClick={() => onTransfer(t)}
                  className="text-[9px] px-1.5 py-0.5 rounded font-display flex items-center gap-1"
                  style={{
                    background: "rgba(74,179,244,0.1)",
                    border: "0.5px solid rgba(74,179,244,0.25)",
                    color: "oklch(0.72 0.15 230)",
                  }}
                >
                  {transferIcon} {transferLabel}
                </button>
                <button
                  onClick={() => { setEditingId(t.id); setEditTitle(t.title); }}
                  className="ml-auto text-white/25 hover:text-primary p-0.5 rounded"
                  title="Rename"
                >
                  <Pencil size={10} />
                </button>
                <button
                  onClick={() => onDelete(t.id)}
                  className="text-white/25 hover:text-red-400 p-0.5 rounded"
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}