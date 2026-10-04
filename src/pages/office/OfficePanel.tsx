// src/pages/office/OfficePanel.tsx
// LifeOS1 — Office Panel
// Files · KPI Analytics · Web Sheets · AI
// Merged from OfficePanelUI.jsx, page.tsx, KPI module components,
// and the truncated OfficePanel.tsx. Uses @/lib/api, @/lib/llm,
// and Supabase for durable state. No localStorage for user data.

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import {
  FileSpreadsheet, Plus, FileText, Table2, Presentation, Folder,
  Search, Download, Upload, FolderOpen, Trash2, X, Check,
  Loader2, CheckCircle, XCircle, Info, Sparkles, TrendingUp,
  TrendingDown, ExternalLink, DollarSign, Heart, Globe, Save,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env;
const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

const api = {
  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(path, {
      method: "POST",
      headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Request failed (${response.status})`;
      throw new ApiError(message, response.status);
    }
    return payload as T;
  },
};

type LlmRequest = {
  prompt: string;
  systemPrompt?: string;
};

type LlmResponse = {
  text?: string;
};

async function invokeLLM(request: LlmRequest): Promise<LlmResponse> {
  return api.post<LlmResponse>("/api/llm", request);
}

function useOfficeUser(): { user: User | null } {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (mounted) setUser(data.user);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
      if (mounted) setUser(session?.user ?? null);
      },
    );

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { user };
}

function PanelLayout({
  title,
  subtitle,
  icon,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="h-full min-h-0 flex flex-col p-4 md:p-6">
      <header className="flex items-center gap-3 mb-4 shrink-0">
        {icon && <div className="text-primary">{icon}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-display text-white-90">{title}</h1>
          {subtitle && <p className="text-[11px] text-white-40 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type TopTab = "Files" | "KPI Analytics" | "Web Sheets";
type ModuleId = "financial" | "social" | "website" | "health";
type FileType = "document" | "spreadsheet" | "presentation" | "csv";

interface Toast {
  id: string;
  type: "info" | "success" | "error";
  message: string;
}

interface OfficeFileRow {
  id: string;
  user_id: string;
  name: string;
  type: FileType;
  body: string | null;
  file_url: string | null;
  size: number | null;
  folder: string | null;
  created_at: string;
  updated_at: string;
}

interface KpiValueRow {
  id: string;
  user_id: string;
  module: ModuleId;
  kpi_id: string;
  name: string;
  unit: string;
  target: number;
  higher_is_better: boolean;
  value: number;
  trend: number;
  updated_at: string;
}

interface KpiHistoryRow {
  id: string;
  user_id: string;
  module: ModuleId;
  kpi_id: string;
  value: number;
  at: string;
}

interface WebSheetRow {
  id: string;
  user_id: string;
  name: string;
  module: ModuleId;
  google_sheets_id: string | null;
  excel_url: string | null;
  created_at: string;
}

interface KpiState {
  id: string;
  name: string;
  unit: string;
  target: number;
  higherIsBetter: boolean;
  value: number;
  trend: number;
}

interface KpiDef {
  id: string;
  name: string;
  unit: string;
  target: number;
  higherIsBetter: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const TOP_TABS: TopTab[] = ["Files", "KPI Analytics", "Web Sheets"];

const KPI_MODULES: {
  id: ModuleId;
  name: string;
  desc: string;
  icon: React.ReactNode;
  className: string;
}[] = [
  { id: "financial", name: "Financial", desc: "Revenue, costs, margin", icon: <DollarSign size={16} />, className: "text-teal" },
  { id: "social", name: "Social", desc: "Followers, engagement", icon: <TrendingUp size={16} />, className: "text-pink" },
  { id: "website", name: "Website", desc: "Traffic, conversions", icon: <Globe size={16} />, className: "text-blue-info" },
  { id: "health", name: "Health", desc: "Sleep, exercise, stress", icon: <Heart size={16} />, className: "text-orange" },
];

const KPI_DEFS: Record<ModuleId, KpiDef[]> = {
  financial: [
    { id: "revenue", name: "Revenue", unit: "$", target: 20000, higherIsBetter: true },
    { id: "costs", name: "Costs", unit: "$", target: 8000, higherIsBetter: false },
    { id: "profit", name: "Gross Profit", unit: "$", target: 12000, higherIsBetter: true },
    { id: "margin", name: "Margin", unit: "%", target: 60, higherIsBetter: true },
  ],
  social: [
    { id: "followers", name: "Followers", unit: "", target: 10000, higherIsBetter: true },
    { id: "engagement", name: "Engagement", unit: "%", target: 5, higherIsBetter: true },
    { id: "reach", name: "Monthly Reach", unit: "", target: 50000, higherIsBetter: true },
    { id: "posts", name: "Posts / Month", unit: "", target: 20, higherIsBetter: true },
  ],
  website: [
    { id: "traffic", name: "Monthly Visitors", unit: "", target: 20000, higherIsBetter: true },
    { id: "conversions", name: "Conversion Rate", unit: "%", target: 3, higherIsBetter: true },
    { id: "bounce", name: "Bounce Rate", unit: "%", target: 40, higherIsBetter: false },
    { id: "avgTime", name: "Avg Time", unit: "s", target: 120, higherIsBetter: true },
  ],
  health: [
    { id: "sleep", name: "Avg Sleep", unit: "h", target: 8, higherIsBetter: true },
    { id: "exercise", name: "Weekly Exercise", unit: "m", target: 150, higherIsBetter: true },
    { id: "water", name: "Daily Water", unit: "cups", target: 8, higherIsBetter: true },
    { id: "stress", name: "Stress Level", unit: "/10", target: 3, higherIsBetter: false },
  ],
};

const FILE_TEMPLATES: { name: string; type: FileType; body: string }[] = [
  { name: "Invoice Template", type: "document", body: "INVOICE\n\nFrom:\nTo:\nDate:\n\nItems:\n1.\n2.\n\nTotal:" },
  { name: "Budget Tracker", type: "spreadsheet", body: "Category,Planned,Actual\nHousing,,\nFood,,\nTransport,,\nUtilities,," },
  { name: "Client Proposal", type: "document", body: "PROPOSAL\n\nClient:\nDate:\n\nScope:\nDeliverables:\nTimeline:\nPrice:" },
  { name: "Meeting Notes", type: "document", body: "MEETING NOTES\n\nDate:\nAttendees:\n\nAgenda:\n1.\n\nDecisions:\n\nAction items:" },
  { name: "Content Calendar", type: "spreadsheet", body: "Date,Channel,Title,Status\n,,Draft,\n,,Draft," },
  { name: "KPI Dashboard", type: "spreadsheet", body: "KPI,Target,Actual,Status\n,,," },
];

const TOAST_DURATION_MS = 4200;

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

function uid(): string {
  return crypto.randomUUID();
}

function fmtBytes(n: number | null): string {
  if (!n || n <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length - 1);
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function kpiStatus(kpi: KpiState): "on-track" | "at-risk" | "off-track" {
  if (kpi.target === 0) return "on-track";
  if (kpi.higherIsBetter) {
    const r = kpi.value / kpi.target;
    if (r >= 0.9) return "on-track";
    if (r >= 0.6) return "at-risk";
    return "off-track";
  }
  if (kpi.value <= kpi.target) return "on-track";
  if (kpi.value <= kpi.target * 1.25) return "at-risk";
  return "off-track";
}

function kpiStatusClass(s: ReturnType<typeof kpiStatus>): string {
  if (s === "on-track") return "text-green border-green/30 bg-green/10";
  if (s === "at-risk") return "text-yellow border-yellow/30 bg-yellow/10";
  return "text-crimson border-crimson/30 bg-crimson/10";
}

function kpiAccentClass(s: ReturnType<typeof kpiStatus>): string {
  if (s === "on-track") return "text-green";
  if (s === "at-risk") return "text-yellow";
  return "text-crimson";
}

function buildGoogleSheetsUrl(id: string): string {
  const m = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = m ? m[1] : id;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOASTS
   ═══════════════════════════════════════════════════════════════════════════ */

function ToastContainer({
  toasts, onDismiss,
}: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const icons = {
    info: <Info size={14} className="text-blue-info" />,
    success: <CheckCircle size={14} className="text-green" />,
    error: <XCircle size={14} className="text-crimson" />,
  };
  const borders = {
    info: "border-blue-info/30",
    success: "border-green/30",
    error: "border-crimson/30",
  };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id}
          className={`glass rounded-lg border ${borders[t.type]} px-4 py-3 flex items-start gap-3`}>
          <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
          <span className="text-xs text-white-90 flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)}
            className="text-white-40 hover:text-white-80 shrink-0">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════════════════════════════════ */

function KpiCard({
  kpi, onUpdate, history,
}: {
  kpi: KpiState;
  onUpdate: (id: string, value: number) => void;
  history: { kpi_id: string; value: number; at: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const status = kpiStatus(kpi);
  const accent = kpiAccentClass(status);
  const pct = kpi.target > 0 ? Math.min((kpi.value / kpi.target) * 100, 100) : 0;

  const myHistory = useMemo(
    () => history.filter((h) => h.kpi_id === kpi.id).slice(-20),
    [history, kpi.id],
  );

  const sparkPoints = useMemo(() => {
    if (myHistory.length < 2) return "";
    const vals = myHistory.map((h) => h.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return myHistory
      .map((h, i) =>
        `${(i / (myHistory.length - 1)) * 100},${100 - ((h.value - min) / range) * 100}`,
      )
      .join(" ");
  }, [myHistory]);

  const commit = () => {
    const v = parseFloat(draft);
    if (Number.isFinite(v)) onUpdate(kpi.id, v);
    setEditing(false);
  };

  return (
    <div className="glass rounded-xl border border-white-8 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-white-85 font-medium">{kpi.name}</div>
          <div className="text-[10px] text-white-40 mt-0.5">
            Target: {kpi.target} {kpi.unit}
          </div>
        </div>
        <span className={`text-[9px] px-2 py-0.5 rounded-full font-display tracking-wider uppercase border ${kpiStatusClass(status)}`}>
          {status.replace("-", " ")}
        </span>
      </div>

      <button
        onClick={() => { setEditing(true); setDraft(String(kpi.value)); }}
        className={`text-left p-3 rounded-lg bg-white-4 border transition-colors ${
          editing ? "border-primary/40" : "border-white-8 hover:border-white-20"
        }`}
      >
        {editing ? (
          <input
            type="number"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className={`w-full bg-transparent border-0 text-2xl font-display outline-none ${accent}`}
          />
        ) : (
          <div className={`text-2xl font-display ${accent}`}>
            {kpi.value}
            {kpi.unit && <span className="text-sm ml-1 text-white-40">{kpi.unit}</span>}
          </div>
        )}
      </button>

      <div>
        <div className="flex justify-between text-[10px] text-white-40 mb-1">
          <span>Progress</span>
          <span className={accent}>{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white-8 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              status === "on-track" ? "bg-green" : status === "at-risk" ? "bg-yellow" : "bg-crimson"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {sparkPoints && (
        <div>
          <div className="text-[9px] text-white-30 mb-1">Last {myHistory.length} snapshots</div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8">
            <polyline
              points={sparkPoints}
              fill="none"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              className={accent}
              style={{ stroke: "currentColor" }}
            />
          </svg>
        </div>
      )}

      {kpi.trend !== 0 && (
        <div className={`flex items-center justify-center gap-1 text-[10px] ${kpi.trend > 0 ? "text-green" : "text-crimson"}`}>
          {kpi.trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(kpi.trend)}% vs last update
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FILE EDITOR
   ═══════════════════════════════════════════════════════════════════════════ */

function FileEditor({
  file, onUpdate, onDelete, onClose,
}: {
  file: OfficeFileRow;
  onUpdate: (id: string, patch: Partial<OfficeFileRow>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(file.body ?? "");
  const [name, setName] = useState(file.name);
  const dirty = draft !== (file.body ?? "") || name !== file.name;

  return (
    <div className="flex-1 flex flex-col glass rounded-xl border border-white-8 overflow-hidden min-h-0">
      <div className="p-3 border-b border-white-5 flex items-center gap-2">
        <button onClick={onClose}
          className="text-[11px] text-teal hover:text-white transition-colors">
          ← BACK
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 h-7 px-2 text-xs rounded-lg bg-transparent border-0 text-white-90 focus:outline-none"
        />
        <span className="text-[10px] text-white-30">
          {fmtBytes(new Blob([draft]).size)}
        </span>
        {dirty && (
          <button
            onClick={() => {
              onUpdate(file.id, { name, body: draft });
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider"
          >
            <Save size={11} /> SAVE
          </button>
        )}
        <button
          onClick={() => onDelete(file.id)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg glass text-crimson text-[11px] font-display"
        >
          <Trash2 size={11} />
        </button>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="flex-1 w-full p-4 bg-[#0d0e17] border-0 text-xs text-white-85 font-mono resize-none focus:outline-none leading-relaxed"
        spellCheck={false}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

export default function OfficePanel() {
  const { user } = useOfficeUser();
  const userId = user?.id ?? null;

  const [topTab, setTopTab] = useState<TopTab>("Files");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  const dismissToast = useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  /* ═════════════════════════════════════════════════════════════════════════
     FILES
     ═════════════════════════════════════════════════════════════════════════ */

  const [files, setFiles] = useState<OfficeFileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [fileSearch, setFileSearch] = useState("");
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType | "all">("all");
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    if (!user?.id) { setFiles([]); setFilesLoading(false); return; }
    setFilesLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from("office_files")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (qErr) throw new Error(qErr.message);
      setFiles((data as OfficeFileRow[] | null) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setFilesLoading(false);
    }
  }, [user]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const editingFile = useMemo(
    () => files.find((f) => f.id === editingFileId) ?? null,
    [files, editingFileId],
  );

  const visibleFiles = useMemo(() => {
    let list = files;
    if (fileTypeFilter !== "all") list = list.filter((f) => f.type === fileTypeFilter);
    const q = fileSearch.trim().toLowerCase();
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q));
    return list;
  }, [files, fileTypeFilter, fileSearch]);

  const createFile = useCallback(
    async (type: FileType, name: string, body: string) => {
      if (!user?.id) return;
      try {
        const { data, error: iErr } = await supabase
          .from("office_files")
          .insert([{
            user_id: user.id,
            name: name.trim() || `Untitled ${type}`,
            type,
            body,
            file_url: null,
            size: new Blob([body]).size,
            folder: "root",
          }])
          .select()
          .single();
        if (iErr) throw new Error(iErr.message);
        if (data) {
          setFiles((prev) => [data as OfficeFileRow, ...prev]);
          setEditingFileId((data as OfficeFileRow).id);
        }
        setNewFileOpen(false);
        addToast("success", `Created ${name || type}`);
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Create failed");
      }
    },
    [user, addToast],
  );

  const updateFile = useCallback(
    async (id: string, patch: Partial<OfficeFileRow>) => {
      if (!user?.id) return;
      try {
        const body = patch.body;
        const next: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
        if (body !== undefined && body !== null) next.size = new Blob([body]).size;
        const { data, error: uErr } = await supabase
          .from("office_files")
          .update(next)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();
        if (uErr) throw new Error(uErr.message);
        if (data) setFiles((prev) => prev.map((f) => (f.id === id ? (data as OfficeFileRow) : f)));
        addToast("success", "Saved");
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Save failed");
      }
    },
    [user, addToast],
  );

  const deleteFile = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      if (!window.confirm("Delete this file?")) return;
      try {
        const { error: dErr } = await supabase
          .from("office_files")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);
        if (dErr) throw new Error(dErr.message);
        setFiles((prev) => prev.filter((f) => f.id !== id));
        if (editingFileId === id) setEditingFileId(null);
        addToast("info", "Deleted");
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Delete failed");
      }
    },
    [user, editingFileId, addToast],
  );

  const handleImport = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0 || !userId) return;
      for (const f of Array.from(list)) {
        try {
          const type: FileType =
            f.name.endsWith(".csv") ? "csv"
            : /\.(md|txt)$/i.test(f.name) ? "document"
            : "document";
          // Small text files: store body inline.
          if (f.size < 512 * 1024 && type !== "csv") {
            const text = await f.text();
            await createFile(type, f.name, text);
          } else {
            // Large or binary: upload to Worker R2, store URL.
            const form = new FormData();
            form.append("file", f);
            form.append("type", "office");
            const up = await api.post<{ ok: boolean; url: string; key: string }>("/api/upload", form);
            if (!up?.url) {
              addToast("error", `${f.name}: upload returned no URL`);
              continue;
            }
            const { data } = await supabase
              .from("office_files")
              .insert([{
                user_id: userId,
                name: f.name,
                type,
                body: null,
                file_url: up.url,
                size: f.size,
                folder: "root",
              }])
              .select()
              .single();
            if (data) setFiles((prev) => [data as OfficeFileRow, ...prev]);
          }
        } catch (e) {
          const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Import failed";
          addToast("error", `${f.name}: ${msg}`);
        }
      }
      if (importRef.current) importRef.current.value = "";
    },
    [userId, createFile, addToast],
  );

  const exportFilesIndex = useCallback(() => {
    if (files.length === 0) { addToast("error", "No files to export"); return; }
    downloadCsv(
      `lifeos-office-index-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Name", "Type", "Size", "URL", "Created", "Updated"],
        ...files.map((f) => [
          f.name, f.type, fmtBytes(f.size), f.file_url ?? "",
          f.created_at, f.updated_at,
        ]),
      ],
    );
    addToast("success", "Index exported");
  }, [files, addToast]);

  /* ═════════════════════════════════════════════════════════════════════════
     KPI
     ═════════════════════════════════════════════════════════════════════════ */

  const [kpiValues, setKpiValues] = useState<KpiValueRow[]>([]);
  const [kpiHistory, setKpiHistory] = useState<KpiHistoryRow[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<ModuleId>("financial");
  const [aiRecs, setAiRecs] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const loadKpis = useCallback(async () => {
    if (!user?.id) { setKpiValues([]); setKpiHistory([]); setKpiLoading(false); return; }
    setKpiLoading(true);
    try {
      const [vals, hist] = await Promise.all([
        supabase.from("office_kpi_values").select("*").eq("user_id", user.id).limit(1000),
        supabase.from("office_kpi_history").select("*").eq("user_id", user.id).order("at", { ascending: false }).limit(5000),
      ]);
      if (vals.error) throw new Error(vals.error.message);
      if (hist.error) throw new Error(hist.error.message);
      setKpiValues((vals.data as KpiValueRow[] | null) ?? []);
      setKpiHistory((hist.data as KpiHistoryRow[] | null) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KPIs");
    } finally {
      setKpiLoading(false);
    }
  }, [user]);

  useEffect(() => { loadKpis(); }, [loadKpis]);

  // Merge defs + stored values for the current module.
  const currentKpis: KpiState[] = useMemo(() => {
    const defs = KPI_DEFS[activeModule];
    return defs.map((d) => {
      const stored = kpiValues.find((v) => v.module === activeModule && v.kpi_id === d.id);
      return {
        id: d.id,
        name: d.name,
        unit: d.unit,
        target: d.target,
        higherIsBetter: d.higherIsBetter,
        value: stored?.value ?? 0,
        trend: stored?.trend ?? 0,
      };
    });
  }, [activeModule, kpiValues]);

  const updateKpi = useCallback(
    async (kpiId: string, newValue: number) => {
      if (!user?.id) return;
      const def = KPI_DEFS[activeModule].find((d) => d.id === kpiId);
      if (!def) return;
      const existing = kpiValues.find((v) => v.module === activeModule && v.kpi_id === kpiId);
      const oldVal = existing?.value ?? 0;
      const trend = oldVal !== 0 ? Math.round(((newValue - oldVal) / oldVal) * 100) : 0;
      const payload = {
        user_id: user.id,
        module: activeModule,
        kpi_id: kpiId,
        name: def.name,
        unit: def.unit,
        target: def.target,
        higher_is_better: def.higherIsBetter,
        value: newValue,
        trend,
        updated_at: new Date().toISOString(),
      };
      try {
        const { data, error: uErr } = await supabase
          .from("office_kpi_values")
          .upsert(payload, { onConflict: "user_id,module,kpi_id" })
          .select()
          .single();
        if (uErr) throw new Error(uErr.message);
        if (data) {
          setKpiValues((prev) => {
            const exists = prev.find((v) => v.module === activeModule && v.kpi_id === kpiId);
            if (exists) return prev.map((v) => (v.id === exists.id ? (data as KpiValueRow) : v));
            return [...prev, data as KpiValueRow];
          });
        }
        const histRow = {
          user_id: user.id,
          module: activeModule,
          kpi_id: kpiId,
          value: newValue,
          at: new Date().toISOString(),
        };
        const { data: hData } = await supabase
          .from("office_kpi_history")
          .insert([histRow])
          .select()
          .single();
        if (hData) setKpiHistory((prev) => [hData as KpiHistoryRow, ...prev].slice(0, 5000));
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "KPI update failed");
      }
    },
    [user, activeModule, kpiValues, addToast],
  );

  const runKpiAi = useCallback(async () => {
    setAiLoading(true);
    setAiRecs("");
    setAiError(null);
    const lines = currentKpis.map((k) => {
      const s = kpiStatus(k);
      return `${k.name}: ${k.value} ${k.unit} (target ${k.target}, ${s})`;
    }).join("\n");
    const moduleName = KPI_MODULES.find((m) => m.id === activeModule)?.name ?? activeModule;
const res = await invokeLLM({
      prompt:
        `Analyze these ${moduleName} KPIs and give 3-5 specific, actionable recommendations. ` +
        `Focus on the ones that are off-track or at-risk. Give concrete next steps, not generic advice.\n\n${lines}`,
      systemPrompt: "You are a business and life analytics advisor. Be concrete and concise.",
    });
    if (!res.text) {
      setAiError(`AI failed to return a response`);
    } else {
      setAiRecs(res.text);
    }
    setAiLoading(false);
  }, [currentKpis, activeModule]);

  const exportKpisCsv = useCallback(() => {
    downloadCsv(
      `lifeos-kpi-${activeModule}-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["KPI", "Value", "Unit", "Target", "Status", "Trend %"],
        ...currentKpis.map((k) => [k.name, k.value, k.unit, k.target, kpiStatus(k), k.trend]),
      ],
    );
    addToast("success", "KPI exported");
  }, [currentKpis, activeModule, addToast]);

  /* ═════════════════════════════════════════════════════════════════════════
     WEB SHEETS
     ═════════════════════════════════════════════════════════════════════════ */

  const [sheets, setSheets] = useState<WebSheetRow[]>([]);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [sheetForm, setSheetForm] = useState({
    name: "",
    googleSheetsId: "",
    excelUrl: "",
    module: "financial" as ModuleId,
  });

  const loadSheets = useCallback(async () => {
    if (!user?.id) { setSheets([]); setSheetsLoading(false); return; }
    setSheetsLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from("office_web_sheets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (qErr) throw new Error(qErr.message);
      setSheets((data as WebSheetRow[] | null) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sheets");
    } finally {
      setSheetsLoading(false);
    }
  }, [user]);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  const addSheet = useCallback(async () => {
    if (!user?.id || !sheetForm.name.trim()) {
      addToast("error", "Sheet name is required");
      return;
    }
    try {
      const { data, error: iErr } = await supabase
        .from("office_web_sheets")
        .insert([{
          user_id: user.id,
          name: sheetForm.name.trim(),
          module: sheetForm.module,
          google_sheets_id: sheetForm.googleSheetsId.trim() || null,
          excel_url: sheetForm.excelUrl.trim() || null,
        }])
        .select()
        .single();
      if (iErr) throw new Error(iErr.message);
      if (data) setSheets((prev) => [data as WebSheetRow, ...prev]);
      setSheetForm({ name: "", googleSheetsId: "", excelUrl: "", module: activeModule });
      addToast("success", "Sheet saved");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Save failed");
    }
  }, [user, sheetForm, activeModule, addToast]);

  const deleteSheet = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      try {
        const { error: dErr } = await supabase
          .from("office_web_sheets")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);
        if (dErr) throw new Error(dErr.message);
        setSheets((prev) => prev.filter((s) => s.id !== id));
        addToast("info", "Sheet removed");
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Delete failed");
      }
    },
    [user, addToast],
  );

  const openSheet = useCallback(
    (s: WebSheetRow) => {
      const url = s.google_sheets_id ? buildGoogleSheetsUrl(s.google_sheets_id) : s.excel_url;
      if (!url) { addToast("error", "No URL saved"); return; }
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [addToast],
  );

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════════ */

  return (
    <PanelLayout
      title="Office"
      subtitle="Files, KPI analytics, web sheets"
      icon={<FileSpreadsheet size={18} />}
      actions={
        <div className="flex gap-1">
          {TOP_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTopTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-display tracking-wider transition-colors ${
                topTab === t
                  ? "glass-crimson text-primary"
                  : "glass text-white-35 hover:text-white-70"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      }
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {error && (
        <div className="glass rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 mb-3 text-[11px] text-crimson flex items-center gap-2">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-crimson/70 hover:text-crimson">
            <X size={11} />
          </button>
        </div>
      )}

      {/* ═══ FILES ═══ */}
      {topTab === "Files" && (
        <div className="flex-1 flex gap-3 min-h-0">
          <div className="w-80 shrink-0 flex flex-col glass rounded-xl border border-white-8 overflow-hidden">
            <div className="p-3 border-b border-white-5 flex flex-col gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white-25" />
                <input
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Search files…"
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                <button
                  onClick={() => setFileTypeFilter("all")}
                  className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                    fileTypeFilter === "all" ? "glass-crimson text-primary" : "glass text-white-40 hover:text-white-70"
                  }`}
                >
                  ALL
                </button>
                {(["document", "spreadsheet", "presentation", "csv"] as FileType[]).map((ft) => (
                  <button
                    key={ft}
                    onClick={() => setFileTypeFilter(ft)}
                    className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
                      fileTypeFilter === ft ? "glass-crimson text-primary" : "glass text-white-40 hover:text-white-70"
                    }`}
                  >
                    {ft.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setNewFileOpen((v) => !v)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg glass-crimson text-primary text-[10px] font-display tracking-wider hover:glow-crimson-sm transition-all"
                >
                  <Plus size={10} /> NEW
                </button>
                <button
                  onClick={exportFilesIndex}
                  disabled={files.length === 0}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg glass text-white-50 text-[10px] font-display tracking-wider hover:text-white-85 disabled:opacity-40 transition-colors"
                >
                  <Download size={10} />
                </button>
                <input
                  ref={importRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImport(e.target.files)}
                />
                <button
                  onClick={() => importRef.current?.click()}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg glass text-white-50 text-[10px] font-display tracking-wider hover:text-white-85 transition-colors"
                >
                  <Upload size={10} />
                </button>
              </div>
            </div>

            {newFileOpen && (
              <div className="p-3 border-b border-white-5 grid grid-cols-2 gap-2">
                {FILE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.name}
                    onClick={() => createFile(tpl.type, tpl.name, tpl.body)}
                    className="glass rounded-lg p-2 border border-white-8 hover:border-primary/25 transition-colors text-left"
                  >
                    <Folder size={11} className="text-primary/60 mb-1" />
                    <div className="text-[10px] text-white-70">{tpl.name}</div>
                  </button>
                ))}
                <button
                  onClick={() => createFile("document", "Untitled Document", "")}
                  className="glass rounded-lg p-2 border border-white-8 hover:border-primary/25 transition-colors text-left"
                >
                  <FileText size={11} className="text-primary/60 mb-1" />
                  <div className="text-[10px] text-white-70">Blank Document</div>
                </button>
                <button
                  onClick={() => createFile("spreadsheet", "Untitled Spreadsheet", "")}
                  className="glass rounded-lg p-2 border border-white-8 hover:border-primary/25 transition-colors text-left"
                >
                  <Table2 size={11} className="text-primary/60 mb-1" />
                  <div className="text-[10px] text-white-70">Blank Sheet</div>
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-2">
              {filesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={18} className="animate-spin text-white-30" />
                </div>
              ) : visibleFiles.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center p-4">
                  <div>
                    <FolderOpen size={26} className="mx-auto text-white-10 mb-2" />
                    <div className="text-xs text-white-30">
                      {files.length === 0 ? "No files yet." : "No matches."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {visibleFiles.map((f) => {
                    const isActive = editingFileId === f.id;
                    const Icon = f.type === "spreadsheet" ? Table2
                      : f.type === "presentation" ? Presentation
                      : f.type === "csv" ? FileSpreadsheet
                      : FileText;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setEditingFileId(f.id)}
                        className={`flex items-center gap-2 text-left px-2.5 py-2 rounded-lg transition-colors ${
                          isActive
                            ? "bg-crimson/10 border border-crimson/25"
                            : "hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <Icon size={12} className="text-white-40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs truncate ${isActive ? "text-primary" : "text-white-85"}`}>
                            {f.name}
                          </div>
                          <div className="text-[9px] text-white-30">
                            {f.type} · {fmtBytes(f.size)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {editingFile ? (
            <FileEditor
              file={editingFile}
              onUpdate={updateFile}
              onDelete={deleteFile}
              onClose={() => setEditingFileId(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center glass rounded-xl border border-white-8">
              <div className="text-center">
                <FolderOpen size={40} className="mx-auto text-white-10 mb-3" />
                <div className="text-sm text-white-30 mb-1">No file open</div>
                <div className="text-[11px] text-white-20">
                  Pick a file from the list, or create a new one.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ KPI ANALYTICS ═══ */}
      {topTab === "KPI Analytics" && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
          <div className="flex gap-1 flex-wrap items-center">
            {KPI_MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveModule(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-display tracking-wider transition-colors ${
                  activeModule === m.id
                    ? "glass-crimson text-primary"
                    : "glass text-white-40 hover:text-white-70"
                }`}
              >
                <span className={activeModule === m.id ? "text-primary" : m.className}>
                  {m.icon}
                </span>
                {m.name.toUpperCase()}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={exportKpisCsv}
              disabled={currentKpis.length === 0}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg glass text-white-50 text-[10px] font-display tracking-wider hover:text-white-85 disabled:opacity-40 transition-colors"
            >
              <Download size={10} /> CSV
            </button>
            <button
              onClick={runKpiAi}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-teal text-[11px] font-display tracking-wider hover:text-white disabled:opacity-40 transition-colors"
            >
              {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              AI INSIGHT
            </button>
          </div>

          {kpiLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={22} className="animate-spin text-white-30" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {currentKpis.map((k) => (
                <KpiCard
                  key={k.id}
                  kpi={k}
                  onUpdate={updateKpi}
                  history={kpiHistory.filter((h) => h.module === activeModule)}
                />
              ))}
            </div>
          )}

          {aiError && (
            <div className="glass rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-[11px] text-crimson flex items-center gap-2">
              <XCircle size={12} />
              <span className="flex-1">{aiError}</span>
              <button onClick={runKpiAi} className="underline">Retry</button>
            </div>
          )}

          {aiRecs && (
            <div className="glass rounded-xl border border-primary/15 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={12} className="text-primary/80" />
                <span className="text-[9px] font-display tracking-widest text-primary/90 uppercase">
                  AI Recommendations
                </span>
              </div>
              <p className="text-[11px] text-white-60 leading-relaxed whitespace-pre-wrap">
                {aiRecs}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ WEB SHEETS ═══ */}
      {topTab === "Web Sheets" && (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
          <div className="glass rounded-xl border border-white-8 p-4 flex flex-col gap-3">
            <div className="text-[9px] font-display tracking-widest text-teal uppercase">
              New Sheet
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                placeholder="Sheet name"
                value={sheetForm.name}
                onChange={(e) => setSheetForm((f) => ({ ...f, name: e.target.value }))}
                className="h-8 px-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
              />
              <input
                placeholder="Google Sheets ID or URL"
                value={sheetForm.googleSheetsId}
                onChange={(e) => setSheetForm((f) => ({ ...f, googleSheetsId: e.target.value }))}
                className="h-8 px-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
              />
              <input
                placeholder="Excel / OneDrive URL"
                value={sheetForm.excelUrl}
                onChange={(e) => setSheetForm((f) => ({ ...f, excelUrl: e.target.value }))}
                className="h-8 px-3 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-85 placeholder:text-white-25 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={sheetForm.module}
                onChange={(e) => setSheetForm((f) => ({ ...f, module: e.target.value as ModuleId }))}
                className="h-8 px-2 text-xs rounded-lg bg-[#0d0e17] border border-white-10 text-white-70 focus:outline-none"
              >
                {KPI_MODULES.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button
                onClick={addSheet}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display tracking-wider hover:glow-crimson-sm transition-all"
              >
                <Plus size={11} /> SAVE
              </button>
            </div>
          </div>

          {sheetsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={22} className="animate-spin text-white-30" />
            </div>
          ) : sheets.length === 0 ? (
            <div className="glass rounded-xl border border-white-8 p-10 text-center">
              <Table2 size={32} className="mx-auto text-white-10 mb-3" />
              <div className="text-sm text-white-30">No web sheets yet</div>
              <div className="text-[11px] text-white-20 mt-1">
                Save a Google Sheets ID or Excel URL to open it from here.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sheets.map((s) => (
                <div
                  key={s.id}
                  className="glass rounded-xl border border-white-8 p-4 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-white-85 flex-1 truncate">{s.name}</div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-crimson/12 text-crimson font-display tracking-wider uppercase">
                      {s.module}
                    </span>
                  </div>
                  {s.google_sheets_id && (
                    <div className="text-[10px] text-white-40">
                      <strong>Google Sheets:</strong>{" "}
                      {s.google_sheets_id.slice(0, 24)}…
                    </div>
                  )}
                  {s.excel_url && (
                    <div className="text-[10px] text-white-40 truncate">
                      <strong>Excel:</strong> {s.excel_url}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => openSheet(s)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass text-blue-info text-[10px] font-display tracking-wider"
                    >
                      <ExternalLink size={10} /> OPEN
                    </button>
                    <button
                      onClick={() => deleteSheet(s.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass text-crimson text-[10px] font-display tracking-wider"
                    >
                      <Trash2 size={10} /> DELETE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PanelLayout>
  );
}