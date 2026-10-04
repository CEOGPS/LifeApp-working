// src/panels/ContactsPanel.tsx
// LifeOS1 — Contacts Panel (Path B: child tables are the truth)
// Single-file strict TSX. All types/helpers/constants inline.
// No new dependencies. Known imports only.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUserEmail } from "../../hooks/useUserEmail";
import { supabase } from "../../lib/supabaseClient";
import { uploadFile } from "../../lib/uploadFile";

function PanelLayout({
  title,
  subtitle,
  children,
}: React.PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <main className="min-h-full p-4 text-zinc-100">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-zinc-400">{subtitle}</p> : null}
      </header>
      {children}
    </main>
  );
}

type ApiConfig = RequestInit;
type ApiResponse<T = any> = { data: T; status: number };

async function apiRequest<T = any>(
  method: string,
  url: string,
  body?: unknown,
  config?: ApiConfig,
): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    ...config,
    method,
    headers: {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(config?.headers || {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(data?.error || response.statusText || "Request failed") as Error & {
      response?: { data: any };
    };
    error.response = { data };
    throw error;
  }
  return { data, status: response.status };
}

const lifeosApi = {
  get: <T = any>(url: string, config?: ApiConfig) =>
    apiRequest<T>("GET", url, undefined, config),
  post: <T = any>(url: string, body?: unknown, config?: ApiConfig) =>
    apiRequest<T>("POST", url, body, config),
  patch: <T = any>(url: string, body?: unknown, config?: ApiConfig) =>
    apiRequest<T>("PATCH", url, body, config),
  delete: <T = any>(url: string, config?: ApiConfig) =>
    apiRequest<T>("DELETE", url, undefined, config),
};

async function invokeLLM<T = any>(options: { route: string; payload: unknown }): Promise<T> {
  const response = await lifeosApi.post<T>(options.route, options.payload);
  return response.data;
}

// ---------------------------------------------------------------------------
// Shared constants — must match Worker exactly
// ---------------------------------------------------------------------------

export const SOCIALS = [
  "x",
  "instagram",
  "facebook",
  "linkedin",
  "reddit",
  "snapchat",
  "tiktok",
  "discord",
  "youtube",
  "pinterest",
  "threads",
] as const;

export const MESSAGING = [
  "whatsapp",
  "telegram",
  "signal",
  "beeper",
  "google_messaging",
  "slack",
  "microsoft_teams",
  "messenger",
  "session",
  "briar",
] as const;

export type SocialPlatform = (typeof SOCIALS)[number];
export type MessagingPlatform = (typeof MESSAGING)[number];

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  snapchat: "Snapchat",
  tiktok: "TikTok",
  discord: "Discord",
  youtube: "YouTube",
  pinterest: "Pinterest",
  threads: "Threads",
};

const MESSAGING_LABELS: Record<MessagingPlatform, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  signal: "Signal",
  beeper: "Beeper",
  google_messaging: "Google Messages",
  slack: "Slack",
  microsoft_teams: "Microsoft Teams",
  messenger: "Messenger",
  session: "Session",
  briar: "Briar",
};

const SOCIAL_URL_BUILDERS: Record<SocialPlatform, (v: string) => string> = {
  x: (v) => (v.startsWith("http") ? v : `https://x.com/${v.replace(/^@/, "")}`),
  instagram: (v) => (v.startsWith("http") ? v : `https://instagram.com/${v.replace(/^@/, "")}`),
  facebook: (v) => (v.startsWith("http") ? v : `https://facebook.com/${v}`),
  linkedin: (v) => (v.startsWith("http") ? v : `https://linkedin.com/in/${v}`),
  reddit: (v) => (v.startsWith("http") ? v : `https://reddit.com/user/${v.replace(/^u\//, "")}`),
  snapchat: (v) => (v.startsWith("http") ? v : `https://snapchat.com/add/${v}`),
  tiktok: (v) => (v.startsWith("http") ? v : `https://tiktok.com/@${v.replace(/^@/, "")}`),
  discord: (v) => (v.startsWith("http") ? v : `https://discord.com/users/${v}`),
  youtube: (v) => (v.startsWith("http") ? v : `https://youtube.com/@${v.replace(/^@/, "")}`),
  pinterest: (v) => (v.startsWith("http") ? v : `https://pinterest.com/${v}`),
  threads: (v) => (v.startsWith("http") ? v : `https://threads.net/@${v.replace(/^@/, "")}`),
};

// ---------------------------------------------------------------------------
// Types (adapted to existing Supabase schema: flat contacts table + metadata JSONB)
// ---------------------------------------------------------------------------

interface PhoneRow {
  id: string;
  value: string;
  label: string | null;
  position: number;
}
interface EmailRow {
  id: string;
  value: string;
  position: number;
}
interface WebsiteRow {
  id: string;
  value: string;
  position: number;
}
interface SocialRow {
  id: string;
  platform: string;
  value: string;
}
interface MessagingRow {
  id: string;
  value: string;
  position: number;
}
interface ExtraRow {
  id: string;
  key: string;
  value: string;
}

// Matches the actual DB schema: flat contacts table with metadata JSONB for nested data
interface Contact {
  id: string;
  // Core fields from DB
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  tags: string[] | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
  updated_at: string | null;
  // Derived fields (from metadata)
  first_name: string | null;
  last_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  birthday: string | null;
  notes: string | null;
  image_upload: string | null;
  color: string | null;
  last_touch: string | null;
  phones: PhoneRow[];
  emails: EmailRow[];
  websites: WebsiteRow[];
  socials: SocialRow[];
  messaging: MessagingRow[];
  extra: ExtraRow[];
}

type Bucket = "phones" | "emails" | "websites" | "socials" | "messaging" | "extra";

type ToastKind = "info" | "success" | "error" | "warn";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface EnrichResult {
  summary: string;
  source: "llm" | "llm+web";
  web_results_used: number;
}

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const LS_PAGE = "lifeos_contacts_page";
const LS_LIMIT = "lifeos_contacts_limit";
const LS_SEARCH = "lifeos_contacts_search";
const LS_SORT = "lifeos_contacts_sort";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

function formatPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function formatDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function parseDateInput(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Accept MM/DD/YYYY or YYYY-MM-DD
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return s;
  return null;
}

function displayName(c: Contact): string {
  if (c.full_name && c.full_name.trim()) return c.full_name.trim();
  const f = (c.first_name || "").trim();
  const l = (c.last_name || "").trim();
  const both = `${f} ${l}`.trim();
  return both || "(no name)";
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const needs = /[",\n\r]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function contactToCsvRow(c: Contact): string {
  const phones = (c.phones || []).map((p) => p.value).join("|");
  const emails = (c.emails || []).map((e) => e.value).join("|");
  const websites = (c.websites || []).map((w) => w.value).join("|");
  const socials = (c.socials || []).map((s) => `${s.platform}:${s.value}`).join("|");
  const messaging = (c.messaging || []).map((m) => m.value).join("|");
  const extra = (c.extra || []).map((e) => `${e.key}:${e.value}`).join("|");
  const tags = (c.tags || []).join("|");
  const cols = [
    c.id,
    c.first_name || "",
    c.last_name || "",
    c.full_name || "",
    c.company || "",
    c.job_title || "",
    c.address || "",
    c.city || "",
    c.state || "",
    c.zip || "",
    c.birthday || "",
    c.last_touch || "",
    tags,
    c.color || "",
    c.image_upload || "",
    phones,
    emails,
    websites,
    socials,
    messaging,
    extra,
    c.notes || "",
    c.created_at || "",
    c.updated_at || "",
  ];
  return cols.map(csvEscape).join(",");
}

const CSV_HEADER = [
  "id",
  "first_name",
  "last_name",
  "full_name",
  "company",
  "job_title",
  "address",
  "city",
  "state",
  "zip",
  "birthday",
  "last_touch",
  "tags",
  "color",
  "image_upload",
  "phones",
  "emails",
  "websites",
  "socials",
  "messaging",
  "extra",
  "notes",
  "created_at",
  "updated_at",
].join(",");

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function emptyContact(): Contact {
  return {
    id: "",
    // Core DB fields
    full_name: "",
    email: null,
    phone: null,
    avatar_url: null,
    company: "",
    job_title: "",
    linkedin_url: null,
    tags: [],
    metadata: {},
    created_at: null,
    updated_at: null,
    // Derived from metadata
    first_name: null,
    last_name: null,
    address: null,
    city: null,
    state: null,
    zip: null,
    birthday: null,
    notes: null,
    image_upload: null,
    color: null,
    last_touch: null,
    phones: [],
    emails: [],
    websites: [],
    socials: [],
    messaging: [],
    extra: [],
  };
}

// Fix mojibake (UTF-8 interpreted as Latin-1) - common pattern: smart apostrophe (')
function fixMojibake(s: string | null | undefined): string | null {
  if (s === undefined) return null;
  if (!s) return s;
  // Common mojibake patterns: UTF-8 smart apostrophe (') = \xE2\x80\x99
  // When interpreted as Latin-1: Ã¢â€šÂ¬Ã¢â€žÂ¢
  return s
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢/g, "'")  // Scott's -> Scott's
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â¢/g, "'")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€šÂ¬/g, "–")  // en-dash
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢/g, "—")  // em-dash
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡/g, "…")     // ellipsis
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢Å“Â¢/g, "“")   // left double quote
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢Å”Â¢/g, "”")   // right double quote
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢Å¸Â¢/g, "‘")   // left single quote
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢Å½Â¢/g, "’");  // right single quote
}

function normalizeContact(raw: any): Contact {
  const base = emptyContact();
  if (!raw || typeof raw !== "object") return base;
  const meta = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  return {
    ...base,
    ...raw,
    // Core DB fields
    full_name: fixMojibake(raw.full_name ?? null),
    email: fixMojibake(raw.email ?? null),
    phone: fixMojibake(raw.phone ?? null),
    avatar_url: raw.avatar_url ?? null,
    company: fixMojibake(raw.company ?? null),
    job_title: fixMojibake(raw.job_title ?? null),
    linkedin_url: raw.linkedin_url ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    metadata: meta,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
    // Derived from metadata
    first_name: fixMojibake(meta.first_name ?? null),
    last_name: fixMojibake(meta.last_name ?? null),
    address: fixMojibake(meta.address ?? null),
    city: fixMojibake(meta.city ?? null),
    state: fixMojibake(meta.state ?? null),
    zip: fixMojibake(meta.zip ?? null),
    birthday: meta.birthday ?? null,
    notes: fixMojibake(meta.notes ?? null),
    image_upload: meta.image_upload ?? raw.avatar_url ?? null,
    color: meta.color ?? null,
    last_touch: meta.last_touch ?? null,
    phones: Array.isArray(meta.phones) && meta.phones.length
      ? meta.phones
      : raw.phone
        ? [{ id: "p0", value: String(raw.phone), label: null, position: 0 }]
        : [],
    emails: Array.isArray(meta.emails) && meta.emails.length
      ? meta.emails
      : raw.email
        ? [{ id: "e0", value: String(raw.email), position: 0 }]
        : [],
    websites: Array.isArray(meta.websites) ? meta.websites : [],
    socials: Array.isArray(meta.socials) ? meta.socials : [],
    messaging: Array.isArray(meta.messaging) ? meta.messaging : [],
    extra: Array.isArray(meta.extra) ? meta.extra : [],
  };
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------

const inputCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none";
const labelCls = "block text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1";
const btnCls =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimaryCls =
  "inline-flex items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed";
const btnDangerCls =
  "inline-flex items-center justify-center rounded-md border border-red-700 bg-red-700/80 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhostCls =
  "inline-flex items-center justify-center rounded-md border border-transparent px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800";

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const colors: Record<ToastKind, string> = {
          info: "border-sky-700 bg-sky-900/90 text-sky-100",
          success: "border-emerald-700 bg-emerald-900/90 text-emerald-100",
          error: "border-red-700 bg-red-900/90 text-red-100",
          warn: "border-amber-700 bg-amber-900/90 text-amber-100",
        };
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm shadow-lg",
              colors[t.kind],
            )}
            role="status"
          >
            <span className="flex-1 whitespace-pre-wrap">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-xs opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function ContactsPanel(): React.ReactElement {
  const userEmail = useUserEmail();

  // Toast system
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++toastIdRef.current;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    [],
  );

  // List state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(() => {
    const v = window.localStorage.getItem(LS_PAGE);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [limit, setLimit] = useState<number>(() => {
    const v = window.localStorage.getItem(LS_LIMIT);
    const n = v ? parseInt(v, 10) : 50;
    return [25, 50, 100, 200].includes(n) ? n : 50;
  });
  const [searchInput, setSearchInput] = useState<string>(() => {
    return window.localStorage.getItem(LS_SEARCH) || "";
  });
  const [searchDebounced, setSearchDebounced] = useState<string>(searchInput);
  const [sortKey, setSortKey] = useState<string>(() => {
    return window.localStorage.getItem(LS_SORT) || "updated_at_desc";
  });

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Detail / edit modal
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // AI enrich
  const [enriching, setEnriching] = useState<boolean>(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Image upload
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Abort controller for list fetch
  const listAbortRef = useRef<AbortController | null>(null);

  // Persist UI state
  useEffect(() => {
    window.localStorage.setItem(LS_PAGE, String(page));
  }, [page]);
  useEffect(() => {
    window.localStorage.setItem(LS_LIMIT, String(limit));
  }, [limit]);
  useEffect(() => {
    window.localStorage.setItem(LS_SEARCH, searchDebounced);
  }, [searchDebounced]);
  useEffect(() => {
    window.localStorage.setItem(LS_SORT, sortKey);
  }, [sortKey]);

  // 200ms debounce on search
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchDebounced(searchInput);
      setPage(0);
    }, 200);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // -------------------------------------------------------------------------
  // List fetch
  // -------------------------------------------------------------------------

  const fetchList = useCallback(async () => {
    if (listAbortRef.current) listAbortRef.current.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("contacts")
        .select("*", { count: "exact" })
        .filter("metadata->>kind", "eq", "personal");

      if (searchDebounced.trim()) {
        const q = searchDebounced.trim();
        query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`);
      }

      const range = { from: page * limit, to: (page + 1) * limit - 1 };
      const { data, count, error: sbError } = await query.range(range.from, range.to);

      if (sbError) throw sbError;

      const list: Contact[] = (data || []).map(normalizeContact);
      setContacts(list);
      setTotal(count || 0);
      setHasMore(Boolean(count && count > (page + 1) * limit));
    } catch (e: any) {
      if (e?.name === "AbortError" || e?.code === "ERR_CANCELED") return;
      const msg = e?.message || "Failed to load contacts";
      setError(String(msg));
      setContacts([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      if (listAbortRef.current === ctrl) {
        setLoading(false);
        listAbortRef.current = null;
      }
    }
  }, [limit, page, searchDebounced, sortKey]);

  useEffect(() => {
    fetchList();
    return () => {
      if (listAbortRef.current) listAbortRef.current.abort();
    };
  }, [fetchList]);

  // -------------------------------------------------------------------------
  // Detail load
  // -------------------------------------------------------------------------

  const openContact = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setEnrichResult(null);
      setEnrichError(null);
      try {
        const { data, error: sbError } = await supabase
          .from("contacts")
          .select("*")
          .eq("id", id)
          .single();

        if (sbError) throw sbError;
        const c = normalizeContact(data);
        setEditing(c);
        setCreating(false);
      } catch (e: any) {
        const msg = e?.message || "Failed to load contact";
        toast("error", msg);
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  const startCreate = useCallback(() => {
    setEditing(emptyContact());
    setCreating(true);
    setEnrichResult(null);
    setEnrichError(null);
  }, []);

  const closeModal = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setEnrichResult(null);
    setEnrichError(null);
  }, []);

  // -------------------------------------------------------------------------
  // Esc to close modal
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, closeModal]);

  // -------------------------------------------------------------------------
  // Save (create or patch)
  // -------------------------------------------------------------------------

  const saveContact = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Build metadata object with all nested/derived fields
      const metadata: Record<string, any> = {
        first_name: editing.first_name || "",
        last_name: editing.last_name || "",
        address: editing.address || "",
        city: editing.city || "",
        state: editing.state || "",
        zip: editing.zip || "",
        birthday: editing.birthday || null,
        notes: editing.notes || "",
        image_upload: editing.image_upload || editing.avatar_url || null,
        color: editing.color || null,
        last_touch: editing.last_touch || null,
        phones: editing.phones || [],
        emails: editing.emails || [],
        websites: editing.websites || [],
        socials: editing.socials || [],
        messaging: editing.messaging || [],
        extra: editing.extra || [],
        kind: "personal",
      };

      // Only write columns that exist in the actual DB schema
      const scalar: Record<string, any> = {
        full_name: editing.full_name || "",
        email: editing.email || editing.emails[0]?.value || "",
        phone: editing.phone || editing.phones[0]?.value || "",
        avatar_url: editing.avatar_url || editing.image_upload || null,
        company: editing.company || "",
        job_title: editing.job_title || "",
        linkedin_url: editing.linkedin_url || "",
        tags: editing.tags || [],
        metadata,
      };

      let contactId = editing.id;

      if (creating) {
        const { data, error: sbError } = await supabase
          .from("contacts")
          .insert(scalar)
          .select()
          .single();
        if (sbError) throw sbError;
        contactId = data.id;
        toast("success", "Contact created");
      } else {
        const { error: sbError } = await supabase
          .from("contacts")
          .update(scalar)
          .eq("id", editing.id);
        if (sbError) throw sbError;
        toast("success", "Contact saved");
      }

      closeModal();
      await fetchList();
    } catch (e: any) {
      const msg = e?.message || "Save failed";
      toast("error", String(msg));
    } finally {
      setSaving(false);
    }
  }, [editing, creating, toast, closeModal, fetchList]);

  // Reconcile one bucket: delete removed, patch changed, add new.
  async function reconcileBucket<T extends { id: string }>(
    contactId: string,
    bucket: Bucket,
    serverRows: T[],
    clientRows: T[],
    toPayload: (r: T) => Record<string, any>,
  ): Promise<void> {
    const clientById = new Map(clientRows.filter((r) => r.id).map((r) => [r.id, r]));
    const serverById = new Map(serverRows.map((r) => [r.id, r]));

    // Deletes
    for (const s of serverRows) {
      if (!clientById.has(s.id)) {
        await lifeosApi.delete(
          `/api/contacts/${encodeURIComponent(contactId)}/${bucket}/${encodeURIComponent(s.id)}`,
        );
      }
    }
    // Patches + adds
    for (const c of clientRows) {
      if (c.id && serverById.has(c.id)) {
        const prev = serverById.get(c.id)!;
        if (JSON.stringify(prev) !== JSON.stringify(c)) {
          await lifeosApi.patch(
            `/api/contacts/${encodeURIComponent(contactId)}/${bucket}/${encodeURIComponent(c.id)}`,
            toPayload(c),
          );
        }
      } else {
        await lifeosApi.post(
          `/api/contacts/${encodeURIComponent(contactId)}/${bucket}`,
          toPayload(c),
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bulk delete
  // -------------------------------------------------------------------------

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} contact(s)? This cascades all child rows.`)) return;
    try {
      const { error: sbError } = await supabase
        .from("contacts")
        .delete()
        .in("id", ids);
      if (sbError) throw sbError;
      toast("success", `Deleted ${ids.length} contact(s)`);
      setSelectedIds(new Set());
      await fetchList();
    } catch (e: any) {
      const msg = e?.message || "Bulk delete failed";
      toast("error", String(msg));
    }
  }, [selectedIds, toast, fetchList]);

  const selected = contacts.find((c) => c.id === selectedId) ?? null;

  const deleteOne = useCallback(async (id: string) => {
    if (!window.confirm("Delete this contact?")) return;
    const { error: sbError } = await supabase.from("contacts").delete().eq("id", id);
    if (sbError) {
      toast("error", sbError.message);
      return;
    }
    if (selectedId === id) setSelectedId(null);
    toast("success", "Contact deleted");
    await fetchList();
  }, [fetchList, selectedId, toast]);

  const deleteAll = useCallback(async () => {
    if (!window.confirm("Delete every contact in Contacts and CRM? This cannot be undone.")) return;
    try {
      for (;;) {
        const { data, error: readError } = await supabase.from("contacts").select("id").limit(500);
        if (readError) throw readError;
        if (!data?.length) break;
        const { error: deleteError } = await supabase.from("contacts").delete().in("id", data.map((row) => row.id));
        if (deleteError) throw deleteError;
        if (data.length < 500) break;
      }
      setSelectedId(null);
      setSelectedIds(new Set());
      toast("success", "All contacts deleted");
      await fetchList();
    } catch (e: any) {
      toast("error", e?.message || "Delete all failed");
    }
  }, [fetchList, toast]);

  // -------------------------------------------------------------------------
  // CSV export
  // -------------------------------------------------------------------------

  const exportCsv = useCallback(async () => {
    try {
      // Export the currently loaded page (honest: not a silent full-table pull).
      const rows = contacts.map(contactToCsvRow);
      const content = [CSV_HEADER, ...rows].join("\n");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadCsv(`contacts-${stamp}.csv`, content);
      toast("success", `Exported ${contacts.length} contact(s)`);
    } catch (e: any) {
      toast("error", e?.message || "CSV export failed");
    }
  }, [contacts, toast]);

  const importRef = useRef<HTMLInputElement | null>(null);
  const importCsv = useCallback(async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      toast("error", "That file has no rows");
      return;
    }
    const split = (line: string) => {
      const out: string[] = [];
      let cur = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
          else quoted = !quoted;
        } else if (ch === "," && !quoted) {
          out.push(cur.trim());
          cur = "";
        } else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };
    const headers = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    let saved = 0;
    for (let i = 1; i < lines.length; i++) {
      const cells = split(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { if (cells[idx]) row[h] = cells[idx]; });
      const values = (parts: string[]) => Object.entries(row)
        .filter(([key, value]) => value && parts.some((part) => key.includes(part)) && !key.endsWith("type") && !key.endsWith("label"))
        .map(([, value]) => value.trim());
      const first = row.firstname || row.givenname || "";
      const last = row.lastname || row.familyname || row.surname || "";
      const name = row.name || row.fullname || `${first} ${last}`.trim();
      if (!name) continue;
      const emails = values(["email"]);
      const phones = values(["phone", "mobile"]);
      const company = row.company || row.organization || row.organization1name || "";
      const { error: sbError } = await supabase.from("contacts").insert({
        full_name: name,
        email: emails[0] || "",
        phone: phones[0] || "",
        company,
        job_title: row.jobtitle || row.title || row.organization1title || "",
        metadata: {
          kind: "personal",
          first_name: first,
          last_name: last,
          notes: row.notes || row.note || "",
          emails: emails.map((value, index) => ({ id: `e${index}`, value, position: index })),
          phones: phones.map((value, index) => ({ id: `p${index}`, value, label: null, position: index })),
        },
      });
      if (!sbError) saved++;
    }
    toast("success", `Imported ${saved} contacts`);
    await fetchList();
  }, [fetchList, toast]);

  // -------------------------------------------------------------------------
  // AI enrich
  // -------------------------------------------------------------------------

  const enrichContact = useCallback(async () => {
    if (!editing) return;
    setEnriching(true);
    setEnrichError(null);
    setEnrichResult(null);
    try {
      const payload = {
        contact: {
          id: editing.id,
          first_name: editing.first_name,
          last_name: editing.last_name,
          full_name: editing.full_name,
          company: editing.company,
          job_title: editing.job_title,
          city: editing.city,
          state: editing.state,
          notes: editing.notes,
          socials: editing.socials,
          websites: editing.websites,
        },
      };
      const res = await invokeLLM({
        route: "/api/enrich/contact",
        payload,
      });
      const data = res?.data ?? res;
      const summary: string =
        typeof data?.summary === "string"
          ? data.summary
          : typeof data?.text === "string"
            ? data.text
            : typeof data?.content === "string"
              ? data.content
              : "";
      if (!summary) throw new Error("Enrich returned no summary");
      setEnrichResult({
        summary,
        source: data?.source === "llm+web" ? "llm+web" : "llm",
        web_results_used:
          typeof data?.web_results_used === "number" ? data.web_results_used : 0,
      });
      toast("success", "Enrichment ready");
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Enrichment failed";
      setEnrichError(String(msg));
      toast("error", String(msg));
    } finally {
      setEnriching(false);
    }
  }, [editing, toast]);

  const copyEnrich = useCallback(async () => {
    if (!enrichResult) return;
    try {
      await navigator.clipboard.writeText(enrichResult.summary);
      toast("success", "Copied to clipboard");
    } catch {
      toast("error", "Clipboard unavailable");
    }
  }, [enrichResult, toast]);

  // -------------------------------------------------------------------------
  // Image upload
  // -------------------------------------------------------------------------

  const onPickImage = useCallback(
    async (file: File) => {
      if (!file) return;
      const okMime = file.type === "image/jpeg" || file.type === "image/png";
      const okExt = /\.(jpe?g|png)$/i.test(file.name);
      if (!okMime || !okExt) {
        toast("error", "Only .jpg, .jpeg, and .png images are allowed.");
        return;
      }
      setUploading(true);
      try {
        // Do NOT set Content-Type on FormData (breaks multipart boundary).
        // uploadFile hits Worker R2, then Supabase, then data-URL — never stub hosts.
        const result = await uploadFile(file, "contacts");
        const url = result.url;
        if (!url) throw new Error("Upload returned no URL");
        setEditing((prev) => (prev ? { ...prev, image_upload: url } : prev));
        toast("success", `Image uploaded (${result.source})`);
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.message || "Upload failed";
        toast("error", String(msg));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [toast],
  );

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const pageCount = useMemo(() => {
    if (limit <= 0) return 1;
    return Math.max(1, Math.ceil(total / limit));
  }, [total, limit]);

  const canPrev = page > 0;
  const canNext = hasMore;

  // -------------------------------------------------------------------------
  // Child-array helpers for the edit form
  // -------------------------------------------------------------------------

  const updateField = useCallback(
    <K extends keyof Contact>(key: K, value: Contact[K]) => {
      setEditing((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const addChild = useCallback((bucket: Bucket) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (bucket === "phones") {
        next.phones = [
          ...prev.phones,
          { id: "", value: "", label: null, position: prev.phones.length },
        ];
      } else if (bucket === "emails") {
        next.emails = [
          ...prev.emails,
          { id: "", value: "", position: prev.emails.length },
        ];
      } else if (bucket === "websites") {
        next.websites = [
          ...prev.websites,
          { id: "", value: "", position: prev.websites.length },
        ];
      } else if (bucket === "socials") {
        next.socials = [...prev.socials, { id: "", platform: "x", value: "" }];
      } else if (bucket === "messaging") {
        next.messaging = [
          ...prev.messaging,
          { id: "", value: "", position: prev.messaging.length },
        ];
      } else if (bucket === "extra") {
        next.extra = [...prev.extra, { id: "", key: "", value: "" }];
      }
      return next;
    });
  }, []);

  const updateChild = useCallback(
    (bucket: Bucket, idx: number, patch: Record<string, any>) => {
      setEditing((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        const arr = [...(next[bucket] as any[])];
        arr[idx] = { ...arr[idx], ...patch };
        (next as any)[bucket] = arr;
        return next;
      });
    },
    [],
  );

  const removeChild = useCallback((bucket: Bucket, idx: number) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const arr = [...(next[bucket] as any[])];
      arr.splice(idx, 1);
      // Re-number positions for ordered buckets
      if (bucket === "phones" || bucket === "emails" || bucket === "websites" || bucket === "messaging") {
        arr.forEach((r, i) => {
          r.position = i;
        });
      }
      (next as any)[bucket] = arr;
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <PanelLayout title="Contacts" subtitle="Path B — child tables are the truth">
      {/* SECTION: toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className={cn(inputCls, "min-w-[12rem] flex-1")}
          placeholder="Search contacts…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search contacts"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
        <select
          className={cn(inputCls, "w-24 py-1 text-xs")}
          value={limit}
          onChange={(e) => {
            setLimit(parseInt(e.target.value, 10));
            setPage(0);
          }}
          aria-label="Page size"
        >
          {[25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
        <select
          className={cn(inputCls, "w-32 py-1 text-xs")}
          value={sortKey}
          onChange={(e) => {
            setSortKey(e.target.value);
            setPage(0);
          }}
          aria-label="Sort"
        >
          <option value="updated_at_desc">Updated ↓</option>
          <option value="updated_at_asc">Updated ↑</option>
          <option value="last_name_asc">Last name ↑</option>
          <option value="last_name_desc">Last name ↓</option>
          <option value="created_at_desc">Created ↓</option>
          <option value="created_at_asc">Created ↑</option>
        </select>
          <button type="button" className={btnCls} onClick={() => importRef.current?.click()}>
            Import CSV
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importCsv(file);
              e.target.value = "";
            }}
          />
          <button type="button" className={btnCls} onClick={exportCsv} disabled={contacts.length === 0}>
            Export CSV
          </button>
          <button type="button" className={btnDangerCls} onClick={() => void deleteAll()}>
            Delete all
          </button>
          <button type="button" className={btnPrimaryCls} onClick={startCreate}>
            + New Contact
          </button>
        </div>
      </div>

      {/* SECTION: pagination */}
      <div className="mb-4 flex items-center gap-3 text-sm text-zinc-400">
        <button
          type="button"
          className={btnGhostCls}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={!canPrev || loading}
        >
          ‹ Prev
        </button>
        <span>
          Page {page + 1} of {pageCount} · {total} total
        </span>
        <button
          type="button"
          className={btnGhostCls}
          onClick={() => setPage((p) => p + 1)}
          disabled={!canNext || loading}
        >
          Next ›
        </button>
        {loading && <Spinner />}
      </div>

      {/* SECTION: error banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-100">
          <span>{error}</span>
          <button type="button" className={btnGhostCls} onClick={fetchList}>
            Retry
          </button>
        </div>
      )}

      {/* SECTION: list / empty / loading */}
      {loading && contacts.length === 0 && !error && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          <Spinner className="mr-2" /> Loading contacts…
        </div>
      )}

      {!loading && !error && contacts.length === 0 && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          <p className="mb-3">No contacts found.</p>
          <button type="button" className={btnPrimaryCls} onClick={startCreate}>
            + Create your first contact
          </button>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="flex gap-4 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
          <aside className="flex w-80 shrink-0 flex-col gap-2 overflow-y-auto pr-1">
            {contacts.map((c) => {
              const active = selectedId === c.id;
              const initials = displayName(c).split(" ").map((n) => n[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
              return (
                <div
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setCreating(false); setEditing(null); }}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5",
                    active ? "border-sky-600/50 bg-sky-900/20" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-500 text-[11px] font-bold text-black">
                    {c.image_upload ? <img src={c.image_upload} alt="" className="h-full w-full object-cover" /> : initials || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-xs font-medium", active ? "text-sky-200" : "text-zinc-100")}>{displayName(c)}</div>
                    <div className="truncate text-[10px] text-zinc-500">{c.company || c.emails[0]?.value || c.email || "—"}</div>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); void deleteOne(c.id); }} className="text-[10px] text-red-400/60 hover:text-red-300" aria-label="Delete">✕</button>
                </div>
              );
            })}
          </aside>
          <section className="flex-1 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/30 p-6">
            {selected ? (
              <PersonDetail contact={selected} onEdit={() => openContact(selected.id)} onDelete={() => void deleteOne(selected.id)} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm uppercase tracking-widest text-zinc-500">Select a contact</div>
            )}
          </section>
        </div>
      )}

      {/* SECTION: detail / edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={closeModal}
        >
          <div
            className="my-8 w-full max-w-3xl rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                {creating ? "New Contact" : `Edit — ${displayName(editing)}`}
              </h2>
              <div className="flex items-center gap-2">
                {detailLoading && <Spinner />}
                <button type="button" className={btnGhostCls} onClick={closeModal}>
                  Close
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveContact();
              }}
              className="space-y-6"
            >
              {/* SECTION: scalars */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>First name</label>
                  <input
                    className={inputCls}
                    value={editing.first_name || ""}
                    onChange={(e) => updateField("first_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last name</label>
                  <input
                    className={inputCls}
                    value={editing.last_name || ""}
                    onChange={(e) => updateField("last_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Full name (display)</label>
                  <input
                    className={inputCls}
                    value={editing.full_name || ""}
                    onChange={(e) => updateField("full_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Company</label>
                  <input
                    className={inputCls}
                    value={editing.company || ""}
                    onChange={(e) => updateField("company", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Job title</label>
                  <input
                    className={inputCls}
                    value={editing.job_title || ""}
                    onChange={(e) => updateField("job_title", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tags (comma separated)</label>
                  <input
                    className={inputCls}
                    value={(editing.tags || []).join(", ")}
                    onChange={(e) =>
                      updateField(
                        "tags",
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </div>
                <div>
                  <label className={labelCls}>Address</label>
                  <input
                    className={inputCls}
                    value={editing.address || ""}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input
                    className={inputCls}
                    value={editing.city || ""}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input
                    className={inputCls}
                    value={editing.state || ""}
                    onChange={(e) => updateField("state", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>ZIP</label>
                  <input
                    className={inputCls}
                    value={editing.zip || ""}
                    onChange={(e) => updateField("zip", e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelCls}>Birthday</label>
                  <input
                    className={inputCls}
                    placeholder="MM/DD/YYYY"
                    defaultValue={formatDateDisplay(editing.birthday)}
                    onBlur={(e) => {
                      const iso = parseDateInput(e.target.value);
                      updateField("birthday", iso);
                      e.target.value = formatDateDisplay(iso);
                    }}
                  />
                </div>
                <div>
                  <label className={labelCls}>Last touch</label>
                  <input
                    className={inputCls}
                    placeholder="MM/DD/YYYY"
                    defaultValue={formatDateDisplay(editing.last_touch)}
                    onBlur={(e) => {
                      const iso = parseDateInput(e.target.value);
                      updateField("last_touch", iso);
                      e.target.value = formatDateDisplay(iso);
                    }}
                  />
                </div>
                <div>
                  <label className={labelCls}>Color</label>
                  <input
                    className={inputCls}
                    value={editing.color || ""}
                    onChange={(e) => updateField("color", e.target.value)}
                    placeholder="#rrggbb or name"
                  />
                </div>
              </section>

              {/* SECTION: image upload */}
              <section>
                <label className={labelCls}>Image</label>
                <div className="flex items-center gap-3">
                  {editing.image_upload ? (
                    <img
                      src={editing.image_upload}
                      alt=""
                      className="h-16 w-16 rounded object-cover"
                    />
                  ) : (
                    <span className="inline-block h-16 w-16 rounded bg-zinc-800" />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onPickImage(f);
                    }}
                    className="text-sm text-zinc-300"
                  />
                  {uploading && <Spinner />}
                  {editing.image_upload && (
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => updateField("image_upload", null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </section>

              {/* SECTION: phones */}
              <ChildSection
                title="Phones"
                onAdd={() => addChild("phones")}
                rows={editing.phones}
                render={(row, idx) => (
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      placeholder="(###) ###-####"
                      value={formatPhone(row.value)}
                      onChange={(e) =>
                        updateChild("phones", idx, { value: onlyDigits(e.target.value) })
                      }
                      onBlur={(e) => {
                        const formatted = formatPhone(e.target.value);
                        e.target.value = formatted;
                        updateChild("phones", idx, { value: onlyDigits(formatted) });
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData("text");
                        const formatted = formatPhone(text);
                        updateChild("phones", idx, { value: onlyDigits(formatted) });
                      }}
                    />
                    <input
                      className={cn(inputCls, "w-32")}
                      placeholder="Label"
                      value={row.label || ""}
                      onChange={(e) => updateChild("phones", idx, { label: e.target.value })}
                    />
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => removeChild("phones", idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              />

              {/* SECTION: emails */}
              <ChildSection
                title="Emails"
                onAdd={() => addChild("emails")}
                rows={editing.emails}
                render={(row, idx) => (
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      type="email"
                      value={row.value}
                      onChange={(e) => updateChild("emails", idx, { value: e.target.value })}
                    />
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => removeChild("emails", idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              />

              {/* SECTION: websites */}
              <ChildSection
                title="Websites"
                onAdd={() => addChild("websites")}
                rows={editing.websites}
                render={(row, idx) => (
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      value={row.value}
                      onChange={(e) => updateChild("websites", idx, { value: e.target.value })}
                      placeholder="https://"
                    />
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => removeChild("websites", idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              />

              {/* SECTION: socials */}
              <ChildSection
                title="Socials"
                onAdd={() => addChild("socials")}
                rows={editing.socials}
                render={(row, idx) => (
                  <div className="flex items-center gap-2">
                    <select
                      className={cn(inputCls, "w-40")}
                      value={row.platform}
                      onChange={(e) =>
                        updateChild("socials", idx, { platform: e.target.value })
                      }
                    >
                      {SOCIALS.map((p) => (
                        <option key={p} value={p}>
                          {SOCIAL_LABELS[p]}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputCls}
                      value={row.value}
                      onChange={(e) => updateChild("socials", idx, { value: e.target.value })}
                      placeholder="handle or URL"
                    />
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => removeChild("socials", idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              />

              {/* SECTION: messaging */}
              <ChildSection
                title="Messaging (raw values)"
                onAdd={() => addChild("messaging")}
                rows={editing.messaging}
                render={(row, idx) => (
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      value={row.value}
                      onChange={(e) => updateChild("messaging", idx, { value: e.target.value })}
                      placeholder="handle, number, or link"
                    />
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => removeChild("messaging", idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              />

              {/* SECTION: extra */}
              <ChildSection
                title="Extra"
                onAdd={() => addChild("extra")}
                rows={editing.extra}
                render={(row, idx) => (
                  <div className="flex items-center gap-2">
                    <input
                      className={cn(inputCls, "w-40")}
                      value={row.key}
                      onChange={(e) => updateChild("extra", idx, { key: e.target.value })}
                      placeholder="key"
                    />
                    <input
                      className={inputCls}
                      value={row.value}
                      onChange={(e) => updateChild("extra", idx, { value: e.target.value })}
                      placeholder="value"
                    />
                    <button
                      type="button"
                      className={btnGhostCls}
                      onClick={() => removeChild("extra", idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              />

              {/* SECTION: notes */}
              <section>
                <label className={labelCls}>Notes</label>
                <textarea
                  className={cn(inputCls, "min-h-[80px]")}
                  value={editing.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                />
              </section>

              {/* SECTION: AI enrich */}
              <section className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200">AI Enrichment</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={btnCls}
                      onClick={enrichContact}
                      disabled={enriching || !editing.id}
                      title={!editing.id ? "Save the contact first" : undefined}
                    >
                      {enriching ? <Spinner className="mr-2" /> : null}
                      {enrichResult ? "Regenerate" : "Enrich"}
                    </button>
                    {enrichResult && (
                      <button type="button" className={btnGhostCls} onClick={copyEnrich}>
                        Copy
                      </button>
                    )}
                  </div>
                </div>
                {!editing.id && (
                  <p className="text-xs text-zinc-500">
                    Enrichment runs against a saved contact. Save first, then enrich.
                  </p>
                )}
                {enrichError && (
                  <p className="text-sm text-red-300">{enrichError}</p>
                )}
                {enrichResult && (
                  <div className="space-y-2">
                    <p className="whitespace-pre-wrap text-sm text-zinc-200">
                      {enrichResult.summary}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Source: {enrichResult.source}
                      {enrichResult.web_results_used > 0
                        ? ` · ${enrichResult.web_results_used} web result(s)`
                        : " · no web results"}
                    </p>
                  </div>
                )}
              </section>

              {/* SECTION: modal actions */}
              <div className="flex items-center justify-end gap-2">
                <button type="button" className={btnCls} onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={btnPrimaryCls} disabled={saving}>
                  {saving ? <Spinner className="mr-2" /> : null}
                  {creating ? "Create" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SECTION: toasts */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </PanelLayout>
  );
}

// ---------------------------------------------------------------------------
// Child section component (generic list wrapper)
// ---------------------------------------------------------------------------

function PersonDetail({ contact, onEdit, onDelete }: { contact: Contact; onEdit: () => void; onDelete: () => void }) {
  const name = displayName(contact);
  const initials = name.split(" ").map((n) => n[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
  const emails = contact.emails.map((e) => e.value).filter(Boolean);
  const phones = contact.phones.map((p) => p.value).filter(Boolean);
  if (!emails.length && contact.email) emails.push(contact.email);
  if (!phones.length && contact.phone) phones.push(contact.phone);
  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-sky-500 text-xl font-bold text-black">
            {contact.image_upload ? <img src={contact.image_upload} alt="" className="h-full w-full object-cover" /> : initials || "?"}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{name}</h2>
            <p className="mt-0.5 text-xs text-zinc-400">{contact.job_title || "Contact"}{contact.company ? ` at ${contact.company}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={btnGhostCls} onClick={onEdit}>Edit</button>
          <button type="button" className={btnGhostCls} onClick={onDelete}>Delete</button>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2.5 text-[10px] uppercase tracking-wide text-sky-400">Contact</div>
          {emails.length === 0 && phones.length === 0 && <div className="text-[11px] italic text-zinc-500">No contact info on file.</div>}
          {emails.map((e, i) => (
            <div key={e + i} className="flex justify-between gap-2 py-1 text-[11px]">
              <span className="text-zinc-500">{i === 0 ? "Email" : `Email ${i + 1}`}</span>
              <a href={`mailto:${e}`} className="truncate text-sky-400">{e}</a>
            </div>
          ))}
          {phones.map((p, i) => (
            <div key={p + i} className="flex justify-between gap-2 py-1 text-[11px]">
              <span className="text-zinc-500">{i === 0 ? "Phone" : `Phone ${i + 1}`}</span>
              <a href={`tel:${onlyDigits(p)}`} className="text-sky-400">{formatPhone(p)}</a>
            </div>
          ))}
          {(contact.address || contact.city) && (
            <div className="flex justify-between gap-2 py-1 text-[11px]">
              <span className="text-zinc-500">Address</span>
              <span className="text-right text-zinc-300">{[contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(", ")}</span>
            </div>
          )}
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2.5 text-[10px] uppercase tracking-wide text-sky-400">Notes</div>
          <p className="whitespace-pre-wrap text-xs text-zinc-300">{contact.notes || "No notes."}</p>
        </div>
      </div>
    </div>
  );
}

function ChildSection<T extends { id: string }>({
  title,
  rows,
  onAdd,
  render,
}: {
  title: string;
  rows: T[];
  onAdd: () => void;
  render: (row: T, idx: number) => React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        <button type="button" className={btnGhostCls} onClick={onAdd}>
          + Add
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500">None yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={row.id || `new-${idx}`}>{render(row, idx)}</div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Re-exports for other panels (Social, CRM)
// ---------------------------------------------------------------------------

export { SOCIAL_LABELS, MESSAGING_LABELS, SOCIAL_URL_BUILDERS };