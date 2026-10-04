// src/panels/ActivityFeedPanel.tsx
// LifeOS1 — Real-Time Activity Feed Panel (Batch 5)
// Path B: real events read from Worker /api/activity/*. 
// Ingestion is done by other Worker routes via /api/activity/events/ingest.
// The panel is a read / mark-read / dismiss / summarize surface.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// PATCH (home-page2): send the owner uid + bearer token (the worker 401s without X-User-Id).
import { ownerHeaders } from "./_lib/ownerHeaders";
import {
  hydrateHomeActivityFromStores,
  loadHomeActivity,
  markHomeActivityRead,
  markAllHomeActivityRead,
  dismissHomeActivity,
  subscribeHomeActivity,
  type HomeActivityEvent,
  type HomeActivitySource,
} from "./_lib/homeActivity";
import {
  Activity, RefreshCw, Download, Copy, Sparkles, Loader2, X,
  AlertCircle, CheckCircle, Info, Bell, BellOff, Filter, Wifi,
  WifiOff, CreditCard, GitBranch, Mail, Calendar as CalendarIcon,
  MessageSquare, Users, Cpu, Share2, FolderKanban, MapPin, Lock,
  DollarSign, Play, Pause, Eye, ArrowRight,
} from "lucide-react";
/** Local LLM adapter.  Keep this panel self-contained so it also builds in
 * deployments that do not expose the optional `@/lib/llm` module. */
interface LLMResponse {
  text?: string;
  content?: string;
}

async function invokeLLM(request: { prompt: string }): Promise<LLMResponse> {
  const response = await fetch("/api/llm", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status})`);
  }
  return response.json() as Promise<LLMResponse>;
}

function useActivityUserEmail(): { email: string } {
  const [email] = useState(() => {
    try {
      const candidates = ["lifeos_user_email", "user_email", "email"];
      for (const key of candidates) {
        const value = localStorage.getItem(key)?.trim();
        if (value) return value;
      }
    } catch {
      // localStorage may be unavailable in private or server-rendered contexts.
    }
    return "";
  });

  return { email };
}


const lifeosApi = {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json", ...(await ownerHeaders()) },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  },
  async post<T = unknown>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(await ownerHeaders()),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  },
};

interface PanelLayoutProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function PanelLayout({ title, subtitle, icon, actions, children }: PanelLayoutProps) {
  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <div className="shrink-0 text-primary">{icon}</div>}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-white">{title}</h1>
            {subtitle && <p className="truncate text-xs text-white/45">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Source =
  | "stripe" | "github" | "gmail" | "calendar" | "slack"
  | "crm" | "agent" | "system" | "social" | "projects"
  | "contacts" | "maps" | "vault" | "finance"
  | "tasks" | "notes";

interface ActivityEvent {
  id: string;
  source: Source;
  event_type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  ref_table: string | null;
  ref_id: string | null;
  url: string | null;
  read_at: string | null;
  dismissed_at: string | null;
  occurred_at: string;
  created_at: string;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

interface SourceConfig {
  label: string;
  color: string;
  icon: React.ReactNode;
}

const SOURCES: Record<Source, SourceConfig> = {
  stripe:   { label: "Stripe",   color: "#635bff", icon: <CreditCard size={13} /> },
  github:   { label: "GitHub",   color: "#c9d1d9", icon: <GitBranch size={13} /> },
  gmail:    { label: "Gmail",    color: "#ea4335", icon: <Mail size={13} /> },
  calendar: { label: "Calendar", color: "#4285f4", icon: <CalendarIcon size={13} /> },
  slack:    { label: "Slack",    color: "#a860d6", icon: <MessageSquare size={13} /> },
  crm:      { label: "CRM",      color: "#ff8c42", icon: <Users size={13} /> },
  agent:    { label: "Agent",    color: "#8b7fff", icon: <Cpu size={13} /> },
  system:   { label: "System",   color: "#00c896", icon: <Cpu size={13} /> },
  social:   { label: "Social",   color: "#4ab3f4", icon: <Share2 size={13} /> },
  projects: { label: "Projects", color: "#5ab0e0", icon: <FolderKanban size={13} /> },
  contacts: { label: "Contacts", color: "#ff6b9d", icon: <Users size={13} /> },
  maps:     { label: "Maps",     color: "#dc2626", icon: <MapPin size={13} /> },
  vault:    { label: "Vault",    color: "#c9a227", icon: <Lock size={13} /> },
  finance:  { label: "Finance",  color: "#3dd68c", icon: <DollarSign size={13} /> },
  tasks:    { label: "Tasks",    color: "#fbbf24", icon: <FolderKanban size={13} /> },
  notes:    { label: "Notes",    color: "#a3e635", icon: <MessageSquare size={13} /> },
};

const ALL_SOURCES: Source[] = [
  "stripe", "github", "gmail", "crm", "agent", "system",
  "social", "projects", "contacts", "calendar", "slack",
  "maps", "vault", "finance", "tasks", "notes",
];

type FilterKey = "all" | "unread" | Source;

const LS = {
  filter:      "lifeos_activity_filter",
  search:      "lifeos_activity_search",
  pollMs:      "lifeos_activity_poll_ms",
  paused:      "lifeos_activity_paused",
  aiOutput:    "lifeos_activity_ai_output",
};

const TOAST_MS = 4200;
const DEFAULT_POLL_MS = 15_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function fmtRelative(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[\",\n]/.test(s) ? `"${s.replace(/\"/g, '""')}"` : s;
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


/* Map local home-bus events into ActivityEvent shape */
function mapHomeSource(s: HomeActivitySource): Source {
  const allowed: Source[] = [
    "stripe","github","gmail","calendar","slack","crm","agent","system",
    "social","projects","contacts","maps","vault","finance","tasks","notes",
  ];
  return (allowed.includes(s as Source) ? s : "system") as Source;
}

function homeToActivity(e: HomeActivityEvent): ActivityEvent {
  return {
    id: e.id,
    source: mapHomeSource(e.source),
    event_type: e.event_type,
    title: e.title,
    body: e.body,
    payload: e.payload,
    ref_table: "home_activity",
    ref_id: e.id,
    url: null,
    read_at: e.read_at,
    dismissed_at: e.dismissed_at,
    occurred_at: e.occurred_at,
    created_at: e.created_at,
  };
}

function mergeActivity(remote: ActivityEvent[], local: ActivityEvent[]): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();
  for (const e of [...local, ...remote]) {
    if (e.dismissed_at) continue;
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
}

export default function ActivityFeedPanel() {
  const { email } = useActivityUserEmail();

  /* ---------- persisted UI prefs ---------- */
  const [filter, setFilter] = useState<FilterKey>(() => lsGet<FilterKey>(LS.filter, "all"));
  const [searchRaw, setSearchRaw] = useState<string>(() => lsGet<string>(LS.search, ""));
  const [search, setSearch] = useState(searchRaw);
  const [pollMs, setPollMs] = useState<number>(() => lsGet<number>(LS.pollMs, DEFAULT_POLL_MS));
  const [paused, setPaused] = useState<boolean>(() => lsGet<boolean>(LS.paused, false));

  useEffect(() => lsSet(LS.filter, filter), [filter]);
  useEffect(() => lsSet(LS.search, searchRaw), [searchRaw]);
  useEffect(() => lsSet(LS.pollMs, pollMs), [pollMs]);
  useEffect(() => lsSet(LS.paused, paused), [paused]);

  // 200ms debounce on search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  /* ---------- data ---------- */
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"ok" | "offline" | "error">("ok");
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  /* ---------- AI ---------- */
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOutput, setAiOutput] = useState<string>(() => lsGet<string>(LS.aiOutput, ""));
  const aiAbortRef = useRef<AbortController | null>(null);
  useEffect(() => lsSet(LS.aiOutput, aiOutput), [aiOutput]);

  /* ---------- toast ---------- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  /* ---------- fetch with AbortController ---------- */
  const abortRef = useRef<AbortController | null>(null);
  const fetchEvents = useCallback(async (opts?: { silent?: boolean }) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      // Local dashboard bus (calendar/tasks/notes/leads/assignments) — worker activity is stubbed empty.
      hydrateHomeActivityFromStores();
      let local = loadHomeActivity().map(homeToActivity);

      const params = new URLSearchParams({ limit: "200" });
      if (filter !== "all" && filter !== "unread") params.set("source", filter);
      if (filter === "unread") params.set("unread", "1");

      let remote: ActivityEvent[] = [];
      try {
        const res = await lifeosApi.get<{ events: ActivityEvent[]; total: number; has_more: boolean }>(
          `/api/activity/events?${params.toString()}`,
        );
        remote = res.events || [];
        setConnection("ok");
      } catch (remoteErr: any) {
        // Keep local feed even if worker activity fails/stubs out.
        setConnection(navigator.onLine ? "error" : "offline");
        if (!local.length) throw remoteErr;
      }

      if (ac.signal.aborted) return;
      let merged = mergeActivity(remote, local);
      if (filter === "unread") merged = merged.filter((e) => !e.read_at);
      else if (filter !== "all") merged = merged.filter((e) => e.source === filter);
      setEvents(merged);
      setLastSyncAt(Date.now());
      setError(null);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // Fallback: local-only
      const local = loadHomeActivity().map(homeToActivity);
      if (local.length) {
        let merged = local.filter((e) => !e.dismissed_at);
        if (filter === "unread") merged = merged.filter((e) => !e.read_at);
        else if (filter !== "all") merged = merged.filter((e) => e.source === filter);
        setEvents(merged);
        setError(null);
      } else {
        setError(e?.message || "Failed to load activity");
        setConnection(navigator.onLine ? "error" : "offline");
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [filter]);

  // initial + filter-change fetch
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Live updates from dashboard modules (calendar save, tasks, etc.)
  useEffect(() => subscribeHomeActivity(() => { void fetchEvents({ silent: true }); }), [fetchEvents]);

  // polling — silent so it doesn't flash the loading bar every 15s
  useEffect(() => {
    if (paused) return;
    if (pollMs <= 0) return;
    const t = window.setInterval(() => { void fetchEvents({ silent: true }); }, pollMs);
    return () => window.clearInterval(t);
  }, [fetchEvents, pollMs, paused]);

  // pause polling when the tab is hidden, resume + refresh when it comes back
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchEvents({ silent: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchEvents]);

  // browser online/offline tracking, so the pill is honest
  useEffect(() => {
    const on = () => setConnection("ok");
    const off = () => setConnection("offline");
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* ---------- derived list (search applies client-side on top of server filter) ---------- */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      return (
        e.title.toLowerCase().includes(q) ||
        (e.body || "").toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q)
      );
    });
  }, [events, search]);

  const unreadCount = useMemo(() => events.filter((e) => !e.read_at).length, [events]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.source] = (counts[e.source] || 0) + 1;
    return counts;
  }, [events]);

  /* ---------- mutations ---------- */
  const markRead = useCallback(async (id: string) => {
    const prev = events;
    setEvents((es) => es.map((e) => e.id === id ? { ...e, read_at: e.read_at || new Date().toISOString() } : e));
    markHomeActivityRead(id);
    try {
      await lifeosApi.post(`/api/activity/events/${id}/read`, {});
    } catch {
      /* local-only events / stub worker — keep optimistic local state */
    }
  }, [events]);

  const markAllRead = useCallback(async () => {
    setEvents((es) => es.map((e) => ({ ...e, read_at: e.read_at || new Date().toISOString() })));
    markAllHomeActivityRead();
    try {
      const scope = filter !== "all" && filter !== "unread" ? { source: filter } : {};
      const res = await lifeosApi.post<{ marked: number }>("/api/activity/events/mark-all-read", scope);
      pushToast("success", `Marked ${Math.max(res.marked ?? 0, events.length)} read`);
    } catch {
      pushToast("success", `Marked ${events.length} read`);
    }
  }, [events, filter, pushToast]);

  const dismissEvent = useCallback(async (id: string) => {
    setEvents((es) => es.filter((e) => e.id !== id));
    dismissHomeActivity(id);
    try {
      await lifeosApi.post(`/api/activity/events/${id}/dismiss`, {});
    } catch {
      /* local-only ok */
    }
  }, [events]);

  /* ---------- AI summary ---------- */
  const runAISummary = useCallback(async () => {
    aiAbortRef.current?.abort();
    const ac = new AbortController();
    aiAbortRef.current = ac;
    setAiBusy(true);
    setAiOutput("");
    try {
      const recent = events.slice(0, 10).map((e) => ({
        source: e.source,
        type: e.event_type,
        title: e.title,
        body: e.body,
        when: e.occurred_at,
        unread: !e.read_at,
      }));
      if (!recent.length) {
        pushToast("info", "Nothing to summarize — feed is empty");
        return;
      }
      const res = await invokeLLM({
        prompt:
          `You are analyzing a real-time business activity feed for ${email || "this user"}.\n` +
          "Given the JSON array of the most recent events below, write a 3-sentence executive summary:\n" +
          "1. What is happening across the business right now.\n" +
          "2. What needs immediate attention.\n" +
          "3. One concrete action to take in the next 10 minutes.\n" +
          "Be specific and reference actual sources/events. Do not invent events not in the list. Plain text.\n\n" +
          JSON.stringify(recent, null, 2),
      });
      if (ac.signal.aborted) return;
      setAiOutput(res.text || res.content || "(no output)");
      pushToast("success", "Summary ready");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      pushToast("error", e?.message || "AI summary failed");
    } finally {
      if (!ac.signal.aborted) setAiBusy(false);
    }
  }, [events, email, pushToast]);

  const copyAI = useCallback(async () => {
    if (!aiOutput) return;
    try { await navigator.clipboard.writeText(aiOutput); pushToast("success", "Copied"); }
    catch { pushToast("error", "Clipboard blocked"); }
  }, [aiOutput, pushToast]);

  /* ---------- CSV ---------- */
  const exportCsv = useCallback(() => {
    if (!visible.length) { pushToast("info", "Nothing to export"); return; }
    const rows = visible.map((e) => ({
      id: e.id,
      source: e.source,
      event_type: e.event_type,
      title: e.title,
      body: e.body ?? "",
      url: e.url ?? "",
      read: e.read_at ? "yes" : "no",
      occurred_at: e.occurred_at,
      ref_table: e.ref_table ?? "",
      ref_id: e.ref_id ?? "",
    }));
    downloadCsv(`lifeos-activity-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    pushToast("success", `Exported ${rows.length} events`);
  }, [visible, pushToast]);

  /* ---------- render ---------- */
  const connectionPill = (() => {
    if (connection === "offline") return { icon: <WifiOff size={11} />, label: "Offline", color: "oklch(0.7 0.15 70)" };
    if (connection === "error")   return { icon: <AlertCircle size={11} />, label: "Sync error", color: "oklch(0.65 0.22 25)" };
    if (loading && !lastSyncAt)   return { icon: <Loader2 size={11} className="animate-spin" />, label: "Loading…", color: "oklch(0.7 0.1 240)" };
    return { icon: <Wifi size={11} />, label: lastSyncAt ? `Synced ${fmtRelative(new Date(lastSyncAt).toISOString())}` : "Ready", color: "oklch(0.72 0.15 175)" };
  })();

  return (
    <PanelLayout
      title="Real-Time Activity Feed"
      subtitle="Cross-panel event stream · polling every 15s · AI executive summary"
      icon={<Activity size={18} />}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPaused((p) => !p)}
            title={paused ? "Resume polling" : "Pause polling"}
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary"
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            onClick={() => fetchEvents()}
            disabled={loading}
            title="Refresh now"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={exportCsv}
            title="Export CSV"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary"
          >
            <Download size={12} />
          </button>
          <button
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-white/8 text-white/60 hover:text-primary text-xs font-display disabled:opacity-40"
          >
            <BellOff size={12} /> MARK ALL READ
          </button>
          <button
            onClick={runAISummary}
            disabled={aiBusy || events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm disabled:opacity-40"
          >
            {aiBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {aiBusy ? "ANALYZING…" : "AI SUMMARY"}
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col gap-3 min-w-0">
        {/* ===================== ERROR ===================== */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={() => fetchEvents()} className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display">
              RETRY
            </button>
          </div>
        )}

        {/* ===================== STATUS ===================== */}
        <div className="glass rounded-xl border border-white/8 p-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-2">
            <span style={{ color: connectionPill.color }}>{connectionPill.icon}</span>
            <span className="text-[11px]" style={{ color: connectionPill.color }}>{connectionPill.label}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-white/40">Poll</span>
            <select
              value={pollMs}
              onChange={(e) => setPollMs(Number(e.target.value))}
              className="h-6 px-1 text-[10px] rounded bg-white/4 border border-white/8 text-white/70 focus:outline-none"
            >
              <option value={5_000} style={{ background: "#0a0a0a" }}>5s</option>
              <option value={15_000} style={{ background: "#0a0a0a" }}>15s</option>
              <option value={30_000} style={{ background: "#0a0a0a" }}>30s</option>
              <option value={60_000} style={{ background: "#0a0a0a" }}>60s</option>
              <option value={0} style={{ background: "#0a0a0a" }}>off</option>
            </select>
          </div>
          {paused && (
            <span className="text-[10px] text-amber-300/80 flex items-center gap-1">
              <BellOff size={10} /> polling paused
            </span>
          )}
          <div className="relative ml-auto min-w-[180px]">
            <Filter size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              placeholder="Search events…"
              className="w-full h-7 pl-7 pr-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 placeholder:text-white/25 focus:outline-none"
            />
          </div>
        </div>

        {/* ===================== FILTER PILLS ===================== */}
        <div className="glass rounded-xl border border-white/8 p-2 flex flex-wrap gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-full text-[10px] font-display transition-colors
              ${filter === "all" ? "glass-crimson text-primary" : "text-white/50 hover:text-white/80"}`}
          >
            ALL <span className="ml-1 text-white/40">{events.length}</span>
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-2.5 py-1 rounded-full text-[10px] font-display flex items-center gap-1 transition-colors
              ${filter === "unread" ? "glass-crimson text-primary" : "text-white/50 hover:text-white/80"}`}
          >
            <Bell size={10} /> UNREAD <span className="ml-1 text-white/40">{unreadCount}</span>
          </button>
          {ALL_SOURCES.map((s) => {
            const count = stats[s] || 0;
            if (count === 0 && filter !== s) return null; // only show sources with events
            const cfg = SOURCES[s];
            const active = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className="px-2.5 py-1 rounded-full text-[10px] font-display flex items-center gap-1 transition-colors"
                style={{
                  border: `1px solid ${active ? cfg.color : "oklch(1 0 0 / 8%)"}`,
                  background: active ? `${cfg.color}22` : "transparent",
                  color: active ? cfg.color : "oklch(1 0 0 / 50%)",
                }}
              >
                {cfg.icon}
                {cfg.label}
                <span className="text-white/40">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ===================== AI OUTPUT ===================== */}
        {(aiOutput || aiBusy) && (
          <div
            className="glass rounded-xl border p-3"
            style={{ borderColor: "rgba(139,127,255,0.25)", background: "rgba(139,127,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-display tracking-widest" style={{ color: "oklch(0.72 0.15 300)" }}>
                AGENT — ACTIVITY ANALYSIS
                <span className="ml-2 text-white/30">(last 10 events)</span>
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
                      onClick={runAISummary}
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
                ? <span className="flex items-center gap-2 text-white/50"><Loader2 size={12} className="animate-spin" /> Analyzing recent events…</span>
                : aiOutput}
            </div>
          </div>
        )}

        {/* ===================== LOADING / EMPTY ===================== */}
        {loading && events.length === 0 && (
          <div className="glass rounded-xl border border-white/8 p-10 text-center text-white/40 text-xs flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading activity…
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="glass rounded-xl border border-white/8 p-10 text-center">
            <Activity size={32} className="mx-auto text-white/15 mb-3" />
            <div className="text-sm text-white/50 mb-1">
              {events.length === 0 ? "No activity yet" : "No events match your filter"}
            </div>
            <div className="text-xs text-white/30">
              {events.length === 0
                ? "Dashboard actions (calendar, tasks, notes, leads, AI assignments) appear here. Integration webhooks join when the worker activity store is live."
                : "Try clearing the search or picking a different source."}
            </div>
          </div>
        )}

        {/* ===================== FEED ===================== */}
        {!loading && visible.length > 0 && (
          <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto pr-1">
            {visible.map((e) => {
              const cfg = SOURCES[e.source] || SOURCES.system;
              const isUnread = !e.read_at;
              return (
                <div
                  key={e.id}
                  className="glass rounded-lg border border-white/6 p-3 flex items-start gap-3 transition-colors hover:border-white/12"
                  style={{
                    opacity: isUnread ? 1 : 0.72,
                    borderLeftWidth: 2,
                    borderLeftColor: isUnread ? cfg.color : "oklch(1 0 0 / 8%)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${cfg.color}22`, color: cfg.color }}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[12px] ${isUnread ? "text-white/90 font-semibold" : "text-white/70"}`}>
                        {e.title}
                      </span>
                      {isUnread && <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />}
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-display ml-auto"
                        style={{ background: `${cfg.color}18`, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    {e.body && (
                      <div className="text-[11px] text-white/55 mt-0.5 break-words whitespace-pre-wrap line-clamp-3">
                        {e.body}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[9px] text-white/35">
                      <span>{fmtRelative(e.occurred_at)}</span>
                      <span className="text-white/25">{e.event_type}</span>
                      {e.url && (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary/60 hover:text-primary flex items-center gap-0.5"
                        >
                          Open <ArrowRight size={9} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => markRead(e.id)}
                        title="Mark read"
                        className="p-1 rounded text-white/30 hover:text-primary"
                      >
                        <Eye size={11} />
                      </button>
                    )}
                    <button
                      onClick={() => dismissEvent(e.id)}
                      title="Dismiss"
                      className="p-1 rounded text-white/25 hover:text-red-400"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="h-6" />
      </div>

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