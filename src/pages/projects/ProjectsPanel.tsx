// src/panels/ProjectsPanel.tsx
// LifeOS1 — Projects Panel (Batch 5)
// Path B: real CRUD against Worker /api/projects/*. Tasks are a real child table.
// Budget stored as integer cents. No fake "hours this week" — read from projects_hours.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  FolderKanban, Plus, BarChart3, ArrowRight, X, Search, Download,
  Copy, Sparkles, Loader2, AlertCircle, CheckCircle, Info, Trash2,
  Pencil, Clock, LayoutGrid, List as ListIcon, ChevronLeft, Users,
} from "lucide-react";
/** Small local API client kept here so this panel does not depend on a
 * missing path alias module. */
async function lifeosApi<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error: unknown }).error)
        : response.statusText || "Request failed";
    const error = new Error(message);
    if (init.signal?.aborted) error.name = "AbortError";
    throw error;
  }

  return payload as T;
}

interface LLMResponse {
  text?: string;
  content?: string;
}

async function invokeLLM(input: { prompt: string }): Promise<LLMResponse> {
  return lifeosApi<LLMResponse>("/api/llm", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored == null ? initialValue : JSON.parse(stored) as T;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore unavailable or restricted storage.
    }
  }, [key, value]);

  return [value, setValue];
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
    <section className="h-full flex flex-col min-h-0 p-4 gap-3">
      <header className="flex items-center gap-2 shrink-0">
        {icon && <span className="text-primary">{icon}</span>}
        <div className="min-w-0">
          <h1 className="text-base text-white/90 font-display truncate">{title}</h1>
          {subtitle && <p className="text-[10px] text-white/35 truncate">{subtitle}</p>}
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

type Stage = "Discovery" | "In Progress" | "Review" | "Complete" | "On Hold";
type View = "board" | "list" | "detail";

interface ProjectTask {
  id: string;
  project_id: string;
  text: string;
  done: boolean;
  position: number;
  due_date: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  contact_id: string | null;
  email: string | null;
  phone: string | null;
  status: Stage;
  budget_cents: number | null;
  deadline: string | null;      // YYYY-MM-DD
  description: string | null;
  notes: string | null;
  tags: string[] | null;
  site_lat: number | null;
  site_lng: number | null;
  site_address: string | null;
  created_at: string;
  updated_at: string;
  tasks?: ProjectTask[];
}

interface ContactLite {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

export const STAGES: Stage[] = ["Discovery", "In Progress", "Review", "Complete", "On Hold"];

const STAGE_COLORS: Record<Stage, string> = {
  Discovery:     "#ffb347",
  "In Progress": "#4a9eff",
  Review:        "#8b7fff",
  Complete:      "#3dd68c",
  "On Hold":     "#6aaedd",
};

const CURRENCY_FMT = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 2,
});

const LS = {
  view:    "lifeos_projects_view",
  status:  "lifeos_projects_status_filter",
  search:  "lifeos_projects_search",
  active:  "lifeos_projects_active_id",
};

const TOAST_MS = 4200;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtCents(cents: number | null): string {
  if (cents == null) return "—";
  return CURRENCY_FMT.format(cents / 100);
}
function parseCents(input: string): number | null {
  if (!input.trim()) return null;
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
function fmtDateDisplay(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isoWeekStart(): string {
  const d = new Date();
  const day = d.getDay() || 7;             // Mon = 1
  d.setDate(d.getDate() - (day - 1));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

function projectProgress(p: Project): { done: number; total: number; pct: number } {
  const tasks = p.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ProjectsPanel() {
  /* ---- persisted UI state ---- */
  const [view, setView] = usePersistentState<View>(LS.view, "board");
  const [statusFilter, setStatusFilter] = usePersistentState<"All" | Stage>(LS.status, "All");
  const [searchRaw, setSearchRaw] = usePersistentState<string>(LS.search, "");
  const [search, setSearch] = useState(searchRaw);
  const [activeId, setActiveId] = usePersistentState<string | null>(LS.active, null);

  // 200ms debounce on search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  /* ---- data ---- */
  const [projects, setProjects] = useState<Project[]>([]);
  const [hoursThisWeek, setHoursThisWeek] = useState<number>(0);
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---- modals ---- */
  const [editModal, setEditModal] = useState<Partial<Project> | null>(null);
  const [editBudgetText, setEditBudgetText] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactPickerSearch, setContactPickerSearch] = useState("");

  const [taskInput, setTaskInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* ---- AI ---- */
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  /* ---- toast ---- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  /* ---- fetch with AbortController ---- */
  const abortRef = useRef<AbortController | null>(null);
  const loadAll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const [projRes, hoursRes, contactsRes] = await Promise.all([
        lifeosApi<{ projects: Project[] }>(`/api/projects?limit=500`, { signal: ac.signal }),
        lifeosApi<{ hours: number }>(`/api/projects/hours/week?since=${isoWeekStart()}`, { signal: ac.signal }).catch(() => ({ hours: 0 })),
        lifeosApi<{ contacts: ContactLite[] }>(`/api/contacts?limit=200`, { signal: ac.signal }).catch(() => ({ contacts: [] })),
      ]);
      if (ac.signal.aborted) return;
      setProjects(projRes.projects || []);
      setHoursThisWeek(typeof hoursRes.hours === "number" ? hoursRes.hours : 0);
      setContacts(contactsRes.contacts || []);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Failed to load projects");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); return () => abortRef.current?.abort(); }, [loadAll]);

  /* ---- Esc closes modals / picker ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (contactPickerOpen) setContactPickerOpen(false);
      else if (editModal) setEditModal(null);
      else if (confirmDeleteId) setConfirmDeleteId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editModal, contactPickerOpen, confirmDeleteId]);

  /* ---- active project (derived, always fresh) ---- */
  const activeProject = useMemo(
    () => (activeId ? projects.find((p) => p.id === activeId) || null : null),
    [activeId, projects],
  );

  /* ---- filtered ---- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.client_name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [projects, search, statusFilter]);

  const byStage = useMemo(() => {
    const map: Record<Stage, Project[]> = {
      Discovery: [], "In Progress": [], Review: [], Complete: [], "On Hold": [],
    };
    for (const p of filtered) map[p.status]?.push(p);
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status !== "Complete" && p.status !== "On Hold").length;
    const completed = projects.filter((p) => p.status === "Complete").length;
    const due = projects.filter((p) => p.status === "Review").length;
    return { active, completed, due, hours: hoursThisWeek };
  }, [projects, hoursThisWeek]);

  /* ---- CRUD: project ---- */
  const openNewProject = useCallback((initialStage: Stage = "Discovery") => {
    setEditModal({ status: initialStage, tags: [], tasks: [] });
    setEditBudgetText("");
  }, []);

  const openEditProject = useCallback((p: Project) => {
    setEditModal({ ...p });
    setEditBudgetText(p.budget_cents != null ? (p.budget_cents / 100).toFixed(2) : "");
  }, []);

  const saveProject = useCallback(async () => {
    if (!editModal) return;
    if (!editModal.name?.trim()) { pushToast("error", "Project name is required"); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({
        name: editModal.name.trim(),
        client_name: editModal.client_name?.trim() || null,
        contact_id: editModal.contact_id || null,
        email: editModal.email?.trim() || null,
        phone: editModal.phone?.trim() || null,
        status: editModal.status || "Discovery",
        budget_cents: parseCents(editBudgetText),
        deadline: editModal.deadline || null,
        description: editModal.description || null,
        notes: editModal.notes || null,
        tags: editModal.tags || [],
        site_lat: editModal.site_lat ?? null,
        site_lng: editModal.site_lng ?? null,
        site_address: editModal.site_address || null,
      });
      if (editModal.id) {
        await lifeosApi(`/api/projects/${editModal.id}`, { method: "PATCH", body });
        pushToast("success", "Project updated");
      } else {
        const res = await lifeosApi<{ project: Project }>("/api/projects", { method: "POST", body });
        if (res.project?.id) setActiveId(res.project.id);
        pushToast("success", "Project created");
      }
      setEditModal(null);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  }, [editModal, editBudgetText, loadAll, pushToast]);

  const deleteProject = useCallback(async (id: string, name: string) => {
    try {
      await lifeosApi(`/api/projects/${id}`, { method: "DELETE" });
      pushToast("success", `Deleted "${name}"`);
      if (activeId === id) { setActiveId(null); setView("board"); }
      setConfirmDeleteId(null);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to delete project");
    }
  }, [activeId, loadAll, pushToast]);

  const advanceStage = useCallback(async (p: Project) => {
    const idx = STAGES.indexOf(p.status);
    const next = STAGES[Math.min(idx + 1, 3)]; // never advances into On Hold; that's manual
    if (next === p.status) return;
    try {
      await lifeosApi(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      pushToast("success", `Moved to ${next}`);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to move project");
    }
  }, [loadAll, pushToast]);

  const changeStatus = useCallback(async (id: string, status: Stage) => {
    try {
      await lifeosApi(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to update status");
    }
  }, [loadAll, pushToast]);

  /* ---- CRUD: tasks ---- */
  const addTask = useCallback(async () => {
    if (!activeProject || !taskInput.trim()) return;
    try {
      await lifeosApi(`/api/projects/${activeProject.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({ text: taskInput.trim(), position: (activeProject.tasks?.length || 0) }),
      });
      setTaskInput("");
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to add task");
    }
  }, [activeProject, taskInput, loadAll, pushToast]);

  const toggleTask = useCallback(async (task: ProjectTask) => {
    try {
      await lifeosApi(`/api/projects/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: !task.done }),
      });
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to update task");
    }
  }, [loadAll, pushToast]);

  const deleteTask = useCallback(async (task: ProjectTask) => {
    try {
      await lifeosApi(`/api/projects/tasks/${task.id}`, { method: "DELETE" });
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to delete task");
    }
  }, [loadAll, pushToast]);

  /* ---- CRUD: hours ---- */
  const logHours = useCallback(async (projectId: string, hours: number) => {
    if (hours <= 0) return;
    try {
      await lifeosApi(`/api/projects/${projectId}/hours`, {
        method: "POST",
        body: JSON.stringify({ hours, logged_on: todayIso() }),
      });
      pushToast("success", `Logged ${hours}h`);
      await loadAll();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to log hours");
    }
  }, [loadAll, pushToast]);

  /* ---- contact picker ---- */
  const pickContact = useCallback((c: ContactLite) => {
    const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "";
    setEditModal((m) => m ? { ...m, contact_id: c.id, client_name: name } : m);
    setContactPickerOpen(false);
    setContactPickerSearch("");
  }, []);

  const filteredContacts = useMemo(() => {
    const q = contactPickerSearch.trim().toLowerCase();
    if (!q) return contacts.slice(0, 50);
    return contacts.filter((c) => {
      const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "";
      return name.toLowerCase().includes(q);
    }).slice(0, 50);
  }, [contacts, contactPickerSearch]);

  /* ---- AI actions ---- */
  const aiDraftBrief = useCallback(async () => {
    if (!activeProject) return;
    setAiBusy("brief");
    setAiOutput(null);
    try {
      const res = await invokeLLM({
        prompt:
          "You are drafting a concise internal project brief. " +
          "Return plain text (no markdown headers, no code fences). " +
          "Sections: Objective, Scope, Deliverables, Risks, Success Criteria. " +
          "Keep it under 250 words. Base it strictly on the JSON below; do not invent clients or numbers.\n\n" +
          JSON.stringify({
            name: activeProject.name,
            client: activeProject.client_name,
            status: activeProject.status,
            deadline: activeProject.deadline,
            budget_cents: activeProject.budget_cents,
            description: activeProject.description,
            tasks: (activeProject.tasks || []).map((t) => t.text),
          }, null, 2),
      });
      setAiOutput(res.text || res.content || "(no output)");
      pushToast("success", "Brief drafted");
    } catch (e: any) {
      pushToast("error", e?.message || "AI brief failed");
    } finally {
      setAiBusy(null);
    }
  }, [activeProject, pushToast]);

  const aiSuggestTasks = useCallback(async () => {
    if (!activeProject) return;
    setAiBusy("tasks");
    setAiOutput(null);
    try {
      const res = await invokeLLM({
        prompt:
          "Suggest 5–8 concrete tasks for this project's current stage. " +
          "Return ONLY a JSON array of strings, no prose, no code fences. " +
          "Each task should be actionable and start with a verb.\n\n" +
          JSON.stringify({
            name: activeProject.name,
            stage: activeProject.status,
            description: activeProject.description,
            existing_tasks: (activeProject.tasks || []).map((t) => t.text),
          }, null, 2),
      });
      const raw = (res.text || res.content || "").trim();
      // Strip accidental fences and parse
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let tasks: string[] = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) tasks = parsed.filter((x) => typeof x === "string");
      } catch {
        // fall through with empty
      }
      if (tasks.length) {
        for (let i = 0; i < tasks.length; i++) {
          await lifeosApi(`/api/projects/${activeProject.id}/tasks`, {
            method: "POST",
            body: JSON.stringify({ text: tasks[i], position: (activeProject.tasks?.length || 0) + i }),
          });
        }
        pushToast("success", `Added ${tasks.length} suggested tasks`);
        await loadAll();
      } else {
        setAiOutput(raw || "(no output)");
        pushToast("info", "AI returned no parseable tasks — showing raw output");
      }
    } catch (e: any) {
      pushToast("error", e?.message || "AI task suggestion failed");
    } finally {
      setAiBusy(null);
    }
  }, [activeProject, loadAll, pushToast]);

  const aiClientUpdate = useCallback(async () => {
    if (!activeProject) return;
    setAiBusy("update");
    setAiOutput(null);
    try {
      const res = await invokeLLM({
        prompt:
          "Write a short, professional client status update email body (greeting through sign-off). " +
          "Tone: warm, factual, no fluff, no emojis, no markdown. " +
          "Do NOT invent progress that isn't in the JSON. " +
          "End with a clear next step or a request for input if one is warranted.\n\n" +
          JSON.stringify({
            project: activeProject.name,
            client: activeProject.client_name,
            status: activeProject.status,
            deadline: activeProject.deadline,
            description: activeProject.description,
            tasks: (activeProject.tasks || []).map((t) => ({ text: t.text, done: t.done })),
          }, null, 2),
      });
      setAiOutput(res.text || res.content || "(no output)");
      pushToast("success", "Client update drafted");
    } catch (e: any) {
      pushToast("error", e?.message || "AI update failed");
    } finally {
      setAiBusy(null);
    }
  }, [activeProject, pushToast]);

  const copyOutput = useCallback(async () => {
    if (!aiOutput) return;
    try { await navigator.clipboard.writeText(aiOutput); pushToast("success", "Copied"); }
    catch { pushToast("error", "Clipboard blocked"); }
  }, [aiOutput, pushToast]);

  /* ---- CSV ---- */
  const exportCsv = useCallback(() => {
    const rows = filtered.map((p) => {
      const { done, total, pct } = projectProgress(p);
      return {
        id: p.id,
        name: p.name,
        client: p.client_name ?? "",
        status: p.status,
        budget_usd: p.budget_cents != null ? (p.budget_cents / 100).toFixed(2) : "",
        deadline: p.deadline ?? "",
        tasks_done: done,
        tasks_total: total,
        progress_pct: pct,
        tags: (p.tags || []).join("|"),
        created_at: p.created_at,
      };
    });
    if (!rows.length) { pushToast("info", "Nothing to export"); return; }
    downloadCsv(`lifeos-projects-${todayIso()}.csv`, toCsv(rows));
    pushToast("success", `Exported ${rows.length} projects`);
  }, [filtered, pushToast]);

  /* ---- render ---- */
  return (
    <PanelLayout
      title="Projects"
      subtitle="Client marketing projects and deliverables"
      icon={<FolderKanban size={18} />}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openNewProject("Discovery")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm transition-all"
          >
            <Plus size={12} /> NEW PROJECT
          </button>
          <button
            onClick={exportCsv}
            title="Export CSV"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary"
          >
            <Download size={12} />
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

        {/* ===================== HEADER BAR ===================== */}
        <div className="glass rounded-xl border border-white/8 p-2 flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="Search projects or clients…"
              className="h-7 pl-7 pr-2 w-56 text-[11px] rounded-lg text-white/80 placeholder:text-white/25 focus:outline-none"
              style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
            />
          </div>

          <div className="flex gap-1 flex-wrap">
            {(["All", ...STAGES] as const).map((s) => {
              const isActive = statusFilter === s;
              const color = s === "All" ? "hsl(var(--teal))" : STAGE_COLORS[s as Stage];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s as "All" | Stage)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-display transition-colors"
                  style={{
                    border: `1px solid ${isActive ? color : "oklch(1 0 0 / 8%)"}`,
                    background: isActive ? `${color}22` : "transparent",
                    color: isActive ? color : "oklch(1 0 0 / 50%)",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setView("board")}
              className={`px-2 py-1 rounded-lg text-[10px] font-display flex items-center gap-1 transition-colors
                ${view === "board" ? "glass-crimson text-primary" : "glass text-white/50 hover:text-white/80"}`}
            >
              <LayoutGrid size={11} /> BOARD
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-2 py-1 rounded-lg text-[10px] font-display flex items-center gap-1 transition-colors
                ${view === "list" ? "glass-crimson text-primary" : "glass text-white/50 hover:text-white/80"}`}
            >
              <ListIcon size={11} /> LIST
            </button>
          </div>
        </div>

        {/* ===================== STATS ===================== */}
        <div className="glass rounded-xl border border-white/8 p-3 flex items-center gap-4">
          <BarChart3 size={16} className="text-white/20 shrink-0" />
          <div className="flex-1 grid grid-cols-4 gap-4">
            {[
              ["Active Projects", stats.active],
              ["In Review", stats.due],
              ["Hours This Week", stats.hours ? `${stats.hours.toFixed(1)}h` : "0h"],
              ["Completed", stats.completed],
            ].map(([label, value]) => (
              <div key={label as string} className="text-center">
                <div className="text-[9px] text-white/20 font-display tracking-wider">{label}</div>
                <div className="text-lg text-white/60 font-display mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===================== LOADING ===================== */}
        {loading && projects.length === 0 && (
          <div className="glass rounded-xl border border-white/8 p-10 text-center text-white/40 text-xs flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading projects…
          </div>
        )}

        {/* ===================== BOARD VIEW ===================== */}
        {!loading && view === "board" && (
          <div className="grid grid-cols-5 gap-3">
            {STAGES.map((stage) => {
              const stageProjects = byStage[stage] || [];
              const color = STAGE_COLORS[stage];
              return (
                <div key={stage} className="glass rounded-xl border border-white/8 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-[10px] font-display tracking-wider text-white/60 truncate">
                        {stage.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[9px] text-white/30 glass px-1.5 py-0.5 rounded-full shrink-0">
                      {stageProjects.length}
                    </span>
                  </div>
                  <div className="p-2 flex-1 min-h-[240px] flex flex-col gap-1.5">
                    {stageProjects.length === 0 && (
                      <div className="text-[10px] text-white/20 italic px-2 py-1">Empty</div>
                    )}
                    {stageProjects.map((p) => {
                      const { done, total, pct } = projectProgress(p);
                      return (
                        <div
                          key={p.id}
                          onClick={() => { setActiveId(p.id); setView("detail"); }}
                          className="glass rounded-lg p-2 border border-white/6 group cursor-pointer hover:border-primary/25 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[11px] text-white/80 leading-snug">{p.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                              className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 shrink-0"
                              title="Delete"
                            >
                              <X size={10} />
                            </button>
                          </div>
                          {p.client_name && (
                            <div className="text-[10px] text-white/40 mt-0.5 truncate">{p.client_name}</div>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[9px]">
                            {p.budget_cents != null && (
                              <span style={{ color: "oklch(0.75 0.15 150)" }}>{fmtCents(p.budget_cents)}</span>
                            )}
                            {p.deadline && (
                              <span className="text-amber-300/80">{fmtDateDisplay(p.deadline)}</span>
                            )}
                          </div>
                          {total > 0 && (
                            <div className="mt-2 h-0.5 rounded-full bg-white/8 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          )}
                          {total > 0 && (
                            <div className="mt-1 text-[9px] text-white/30">{done}/{total} tasks</div>
                          )}
                          {stage !== "Complete" && stage !== "On Hold" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); advanceStage(p); }}
                              className="mt-1.5 flex items-center gap-1 text-[9px] text-primary/60 hover:text-primary"
                            >
                              <ArrowRight size={9} /> Advance
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={() => openNewProject(stage)}
                      className="w-full py-2 border border-dashed border-white/8 rounded-lg text-[10px] text-white/15 hover:border-primary/25 hover:text-primary/40 transition-colors font-display"
                    >
                      + ADD
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== LIST VIEW ===================== */}
        {!loading && view === "list" && (
          <div className="glass rounded-xl border border-white/8 overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-10 text-center">
                <FolderKanban size={32} className="mx-auto text-white/15 mb-3" />
                <div className="text-sm text-white/50 mb-1">
                  {projects.length === 0 ? "No projects yet" : "No projects match your filters"}
                </div>
                <div className="text-xs text-white/30 mb-4">
                  {projects.length === 0
                    ? "Create your first client project to track work, tasks, and notes."
                    : "Try clearing the search or status filter."}
                </div>
                {projects.length === 0 && (
                  <button
                    onClick={() => openNewProject("Discovery")}
                    className="px-4 py-2 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm"
                  >
                    + NEW PROJECT
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Project", "Client", "Status", "Budget", "Deadline", "Progress", ""].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-[9px] text-white/30 font-display tracking-wider">
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const { done, total, pct } = projectProgress(p);
                    const color = STAGE_COLORS[p.status];
                    return (
                      <tr
                        key={p.id}
                        onClick={() => { setActiveId(p.id); setView("detail"); }}
                        className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2 text-white/80">{p.name}</td>
                        <td className="px-3 py-2 text-white/50">{p.client_name || "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-display"
                            style={{ background: `${color}22`, color }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-3 py-2" style={{ color: "oklch(0.75 0.15 150)" }}>
                          {fmtCents(p.budget_cents)}
                        </td>
                        <td className="px-3 py-2 text-white/50">{fmtDateDisplay(p.deadline)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 rounded-full bg-white/8 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                            </div>
                            <span className="text-[10px] text-white/40">{done}/{total}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                            className="text-white/20 hover:text-red-400"
                          >
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ===================== DETAIL VIEW ===================== */}
        {!loading && view === "detail" && activeProject && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* LEFT */}
            <div className="flex flex-col gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setView("board")}
                  className="px-2.5 py-1 rounded-lg glass border border-white/8 text-white/50 hover:text-primary text-[10px] font-display flex items-center gap-1"
                >
                  <ChevronLeft size={11} /> BOARD
                </button>
                <div className="text-lg text-white/85 font-display truncate">{activeProject.name}</div>
                <select
                  value={activeProject.status}
                  onChange={(e) => changeStatus(activeProject.id, e.target.value as Stage)}
                  className="px-2 py-1 rounded-full text-[10px] font-display focus:outline-none"
                  style={{
                    border: `1px solid ${STAGE_COLORS[activeProject.status]}`,
                    background: `${STAGE_COLORS[activeProject.status]}22`,
                    color: STAGE_COLORS[activeProject.status],
                  }}
                >
                  {STAGES.map((s) => <option key={s} value={s} style={{ background: "#0a0a0a" }}>{s}</option>)}
                </select>
                <button
                  onClick={() => openEditProject(activeProject)}
                  className="ml-auto px-2.5 py-1 rounded-lg glass border border-white/8 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                >
                  <Pencil size={10} /> EDIT
                </button>
              </div>

              {/* Tasks */}
              <div className="glass rounded-xl border border-white/8 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-display tracking-wider text-white/50">TASKS</div>
                  <button
                    onClick={aiSuggestTasks}
                    disabled={aiBusy != null}
                    className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
                  >
                    {aiBusy === "tasks" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    SUGGEST
                  </button>
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTask(); } }}
                    placeholder="Add a task and press Enter…"
                    className="flex-1 h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={addTask}
                    disabled={!taskInput.trim()}
                    className="px-3 h-8 rounded-lg glass-crimson text-primary text-[11px] font-display disabled:opacity-40"
                  >
                    ADD
                  </button>
                </div>
                {(activeProject.tasks || []).length === 0 ? (
                  <div className="text-[11px] text-white/30 italic px-1 py-2">
                    No tasks yet. Add one above, or let AI suggest a breakdown.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {(activeProject.tasks || []).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-b-0 group">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => toggleTask(t)}
                          className="accent-primary shrink-0"
                        />
                        <span
                          className={`flex-1 text-[12px] ${t.done ? "text-white/30 line-through" : "text-white/80"}`}
                        >
                          {t.text}
                        </span>
                        {t.due_date && (
                          <span className="text-[9px] text-amber-300/70 shrink-0">{fmtDateDisplay(t.due_date)}</span>
                        )}
                        <button
                          onClick={() => deleteTask(t)}
                          className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 shrink-0"
                          title="Delete task"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="glass rounded-xl border border-white/8 p-3">
                <div className="text-[10px] font-display tracking-wider text-white/50 mb-2">NOTES</div>
                <textarea
                  value={activeProject.notes || ""}
                  onChange={(e) => {
                    setProjects((prev) => prev.map((x) => x.id === activeProject.id ? { ...x, notes: e.target.value } : x));
                  }}
                  onBlur={async (e) => {
                    try {
                      await lifeosApi(`/api/projects/${activeProject.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ notes: e.target.value }),
                      });
                      pushToast("success", "Notes saved");
                    } catch (err: any) {
                      pushToast("error", err?.message || "Failed to save notes");
                    }
                  }}
                  placeholder="Project notes, requirements, links…"
                  className="w-full min-h-[120px] px-2 py-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/40 resize-y leading-relaxed"
                />
              </div>
            </div>

            {/* RIGHT */}
            <div className="flex flex-col gap-3">
              {/* Client info */}
              <div className="glass rounded-xl border border-white/8 p-3">
                <div className="text-[10px] font-display tracking-wider text-white/50 mb-2">CLIENT</div>
                {[
                  ["Client", activeProject.client_name],
                  ["Email", activeProject.email],
                  ["Phone", activeProject.phone],
                  ["Budget", fmtCents(activeProject.budget_cents)],
                  ["Deadline", fmtDateDisplay(activeProject.deadline)],
                ].map(([k, v]) => v ? (
                  <div key={k as string} className="flex gap-2 mb-1.5">
                    <span className="text-[10px] text-white/40 w-16 shrink-0">{k}</span>
                    <span className="text-[11px] text-white/80 break-words">{v}</span>
                  </div>
                ) : null)}
                {activeProject.description && (
                  <div className="mt-2 text-[11px] text-white/60 leading-relaxed whitespace-pre-wrap">
                    {activeProject.description}
                  </div>
                )}
              </div>

              {/* Progress */}
              <div className="glass rounded-xl border border-white/8 p-3">
                <div className="text-[10px] font-display tracking-wider text-white/50 mb-2">PROGRESS</div>
                {(() => {
                  const { done, total, pct } = projectProgress(activeProject);
                  const color = STAGE_COLORS[activeProject.status];
                  return (
                    <>
                      <div className="text-2xl font-display mb-1" style={{ color }}>{pct}%</div>
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <div className="text-[10px] text-white/40">{done} of {total} tasks done</div>
                    </>
                  );
                })()}
              </div>

              {/* Log hours */}
              <div className="glass rounded-xl border border-white/8 p-3">
                <div className="text-[10px] font-display tracking-wider text-white/50 mb-2 flex items-center gap-1">
                  <Clock size={10} /> LOG HOURS
                </div>
                <div className="flex gap-2">
                  <input
                    type="number" step="0.25" min="0.25"
                    placeholder="1.5"
                    className="flex-1 h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                    onKeyDown={async (e) => {
                      if (e.key !== "Enter") return;
                      const val = Number((e.target as HTMLInputElement).value);
                      if (!Number.isFinite(val) || val <= 0) return;
                      await logHours(activeProject.id, val);
                      (e.target as HTMLInputElement).value = "";
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      const val = Number(input.value);
                      if (Number.isFinite(val) && val > 0) {
                        logHours(activeProject.id, val);
                        input.value = "";
                      }
                    }}
                    className="px-3 h-8 rounded-lg glass-crimson text-primary text-[10px] font-display"
                  >
                    LOG
                  </button>
                </div>
                <div className="text-[9px] text-white/30 mt-1.5">
                  Press Enter to log. Contributes to Hours This Week.
                </div>
              </div>

              {/* AI actions */}
              <div className="glass rounded-xl border border-white/8 p-3">
                <div className="text-[10px] font-display tracking-wider text-white/50 mb-2">AI ASSIST</div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={aiDraftBrief}
                    disabled={aiBusy != null}
                    className="px-2 py-1.5 rounded-lg glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    {aiBusy === "brief" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    DRAFT BRIEF
                  </button>
                  <button
                    onClick={aiClientUpdate}
                    disabled={aiBusy != null}
                    className="px-2 py-1.5 rounded-lg glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center justify-center gap-1"
                  >
                    {aiBusy === "update" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                    CLIENT UPDATE
                  </button>
                </div>
                {aiOutput && (
                  <>
                    <pre className="mt-2 text-[10px] text-white/70 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">{aiOutput}</pre>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={copyOutput}
                        className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                      >
                        <Copy size={10} /> COPY
                      </button>
                      <button
                        onClick={() => setAiOutput(null)}
                        className="px-2 py-1 rounded glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                      >
                        <X size={10} /> CLEAR
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="h-8" />
      </div>

      {/* ===================== EDIT / NEW MODAL ===================== */}
      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setEditModal(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-2xl p-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">
                {editModal.id ? "EDIT PROJECT" : "NEW PROJECT"}
              </div>
              <button onClick={() => setEditModal(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 block text-[10px] text-white/50">
                Project Name *
                <input
                  autoFocus
                  value={editModal.name || ""}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none focus:border-primary/40"
                />
              </label>

              <label className="block text-[10px] text-white/50">
                Client
                <div className="mt-1 flex gap-1">
                  <input
                    value={editModal.client_name || ""}
                    onChange={(e) => setEditModal({ ...editModal, client_name: e.target.value })}
                    className="flex-1 h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setContactPickerOpen(true)}
                    className="px-2 h-8 rounded-lg glass border border-white/10 text-white/60 hover:text-primary text-[10px] font-display flex items-center gap-1"
                    title="Pick from Contacts"
                  >
                    <Users size={10} /> PICK
                  </button>
                </div>
                {editModal.contact_id && (
                  <div className="text-[9px] text-white/30 mt-0.5">Linked to contact</div>
                )}
              </label>

              <label className="block text-[10px] text-white/50">
                Status
                <select
                  value={editModal.status || "Discovery"}
                  onChange={(e) => setEditModal({ ...editModal, status: e.target.value as Stage })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                >
                  {STAGES.map((s) => <option key={s} value={s} style={{ background: "#0a0a0a" }}>{s}</option>)}
                </select>
              </label>

              <label className="block text-[10px] text-white/50">
                Email
                <input
                  type="email"
                  value={editModal.email || ""}
                  onChange={(e) => setEditModal({ ...editModal, email: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>

              <label className="block text-[10px] text-white/50">
                Phone
                <input
                  type="tel"
                  value={editModal.phone || ""}
                  onChange={(e) => setEditModal({ ...editModal, phone: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>

              <label className="block text-[10px] text-white/50">
                Budget (USD)
                <input
                  inputMode="decimal"
                  value={editBudgetText}
                  onChange={(e) => setEditBudgetText(e.target.value)}
                  onBlur={(e) => {
                    const cents = parseCents(e.target.value);
                    setEditBudgetText(cents != null ? (cents / 100).toFixed(2) : "");
                  }}
                  placeholder="5000.00"
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>

              <label className="block text-[10px] text-white/50">
                Deadline
                <input
                  type="date"
                  value={editModal.deadline || ""}
                  onChange={(e) => setEditModal({ ...editModal, deadline: e.target.value || null })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>

              <label className="col-span-2 block text-[10px] text-white/50">
                Description
                <textarea
                  rows={3}
                  value={editModal.description || ""}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                  placeholder="Project overview, goals, scope…"
                  className="mt-1 w-full px-2 py-1 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none resize-none"
                />
              </label>

              <label className="col-span-2 block text-[10px] text-white/50">
                Tags (comma-separated)
                <input
                  value={(editModal.tags || []).join(", ")}
                  onChange={(e) => setEditModal({
                    ...editModal,
                    tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditModal(null)}
                className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
              >
                CANCEL
              </button>
              <button
                onClick={saveProject}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display hover:glow-crimson-sm disabled:opacity-40 flex items-center gap-1"
              >
                {saving && <Loader2 size={11} className="animate-spin" />}
                {editModal.id ? "SAVE CHANGES" : "CREATE PROJECT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CONTACT PICKER ===================== */}
      {contactPickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setContactPickerOpen(false)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-display text-white/80 tracking-wider">PICK CONTACT</div>
              <button onClick={() => setContactPickerOpen(false)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              value={contactPickerSearch}
              onChange={(e) => setContactPickerSearch(e.target.value)}
              placeholder="Search contacts…"
              className="w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none mb-2"
            />
            <div className="max-h-64 overflow-y-auto flex flex-col">
              {filteredContacts.length === 0 ? (
                <div className="text-[11px] text-white/30 italic p-3">
                  {contacts.length === 0 ? "No contacts loaded." : "No matches."}
                </div>
              ) : filteredContacts.map((c) => {
                const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "(unnamed)";
                return (
                  <button
                    key={c.id}
                    onClick={() => pickContact(c)}
                    className="text-left px-2 py-1.5 rounded-lg hover:bg-white/5 text-[11px] text-white/80"
                  >
                    {name}
                    {c.company && c.company !== name && (
                      <span className="text-white/30 ml-2">· {c.company}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRM ===================== */}
      {confirmDeleteId && (() => {
        const p = projects.find((x) => x.id === confirmDeleteId);
        if (!p) return null;
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
                <div className="text-xs font-display text-white/80 tracking-wider">DELETE PROJECT</div>
              </div>
              <div className="text-[11px] text-white/60 mb-3">
                Delete <span className="text-white/85">"{p.name}"</span> and all its tasks and hour entries? This cannot be undone.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => deleteProject(p.id, p.name)}
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