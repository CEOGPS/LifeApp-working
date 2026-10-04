// src/panels/CRMPanel.tsx
// LifeOS1 — CRM Panel (Path B: pipeline view over /api/contacts)
// Single-file strict TSX. All types/helpers/constants inline except shared SOCIALS/MESSAGING.
import { Table2 } from "lucide-react";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabaseClient";
import { uploadFile } from "../../lib/uploadFile";

// Keep this panel self-contained: some builds do not include the shared layout.
function PanelLayout({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-full p-4 text-zinc-100">
      <header className="mb-5 flex items-center gap-3">
        {icon && <span className="text-emerald-400">{icon}</span>}
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

// Keep this panel self-contained: some builds do not include the shared hook.
function useUserEmail(): string {
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? "");
    });
    return () => {
      active = false;
    };
  }, []);

  return email;
}

// Keep these options local: the Contacts page is not available in every build.
const SOCIALS = [
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
  "x",
  "tiktok",
  "youtube",
  "github",
  "other",
] as const;

const MESSAGING = [
  "whatsapp",
  "telegram",
  "signal",
  "messenger",
  "sms",
  "other",
] as const;

type ApiOptions = RequestInit;

const lifeosApi = {
  async request(method: string, url: string, body?: unknown, options: ApiOptions = {}) {
    const headers = new Headers(options.headers);
    const formData = body instanceof FormData;
    if (body !== undefined && !formData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
      ...options,
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : formData
            ? (body as FormData)
            : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(
        data?.error || data?.message || `Request failed (${response.status})`,
      ) as Error & { response?: { data?: unknown } };
      error.response = { data };
      throw error;
    }
    return data;
  },
  post(url: string, body?: unknown, options?: ApiOptions) {
    return this.request("POST", url, body, options);
  },
  patch(url: string, body?: unknown, options?: ApiOptions) {
    return this.request("PATCH", url, body, options);
  },
  delete(url: string, options?: ApiOptions) {
    return this.request("DELETE", url, undefined, options);
  },
};

async function invokeLLM({ prompt }: { prompt: string }): Promise<any> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      body?.error || body?.message || `LLM request failed (${response.status})`,
    );
  }
  return body?.data ?? body;
}

// ---------------------------------------------------------------------------
// Types (adapted to existing Supabase schema: flat contacts table + metadata JSONB)
// Pipeline fields (stage, tag, value, source) are stored in metadata JSONB
// ---------------------------------------------------------------------------

export type Stage =
  | "Lead"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost";

export type Tag = "Hot" | "Warm" | "New" | "Follow-up" | "VIP" | "Cold";

type SyncState = "clean" | "saving" | "error";

type Bucket = "phones" | "emails" | "websites" | "socials" | "messaging" | "extra";

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
// Pipeline fields (stage, tag, value, source) live in metadata.crm.*
export interface CRMContact {
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
  // Pipeline fields (from metadata.crm.*)
  stage: Stage;
  tag: Tag;
  value: string;
  source: string;
  // client-only
  _sync?: SyncState;
}

type AIActionKey = "intro" | "qualify" | "next" | "objections";

interface Toast {
  id: number;
  kind: "info" | "success" | "error" | "warn";
  message: string;
}

interface EnrichResult {
  summary: string;
  source: "llm" | "llm+web";
  web_results_used: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STAGES: Stage[] = [
  "Lead",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export const TAGS: Tag[] = ["Hot", "Warm", "New", "Follow-up", "VIP", "Cold"];

export const TAG_COLORS: Record<Tag, string> = {
  Hot: "#ff4f5e",
  Warm: "#ff8c42",
  New: "#00d9b3",
  "Follow-up": "#4ab3f4",
  VIP: "#b366ff",
  Cold: "#a9a9a9",
};

export const STAGE_COLORS: Record<Stage, string> = {
  Lead: "#a9a9a9",
  Qualified: "#4ab3f4",
  Proposal: "#ff8c42",
  Negotiation: "#b366ff",
  "Closed Won": "#00d9b3",
  "Closed Lost": "#ff4f5e",
};

// Pipeline persistence keys inside contacts_extra
const EXTRA_STAGE = "crm.stage";
const EXTRA_TAG = "crm.tag";
const EXTRA_VALUE = "crm.value";
const EXTRA_SOURCE = "crm.source";

const CRM_EXTRA_KEYS = new Set([EXTRA_STAGE, EXTRA_TAG, EXTRA_VALUE, EXTRA_SOURCE]);

// localStorage
const LS_PAGE = "lifeos_crm_page";
const LS_LIMIT = "lifeos_crm_limit";
const LS_SEARCH = "lifeos_crm_search";
const LS_STAGE = "lifeos_crm_stage_filter";
const LS_TAG = "lifeos_crm_tag_filter";
const LS_SORT = "lifeos_crm_sort";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputCls =
  "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none";
const labelCls =
  "block text-xs font-medium uppercase tracking-wide text-zinc-400 mb-1";
const btnCls =
  "inline-flex items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed";
const btnPrimaryCls =
  "inline-flex items-center justify-center rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed";
const btnDangerCls =
  "inline-flex items-center justify-center rounded-md border border-red-700 bg-red-700/80 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed";
const btnGhostCls =
  "inline-flex items-center justify-center rounded-md border border-transparent px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

function formatPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 10);
  if (!d) return "";
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
  const s = (input || "").trim();
  if (!s) return null;
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

function displayName(c: CRMContact): string {
  if (c.full_name && c.full_name.trim()) return c.full_name.trim();
  const both = `${c.first_name || ""} ${c.last_name || ""}`.trim();
  return both || "(no name)";
}

function csvEscape(v: string): string {
  if (v == null) return "";
  const needs = /[",\n\r]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

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

function emptyContact(): CRMContact {
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
    // Pipeline fields (from metadata.crm.*)
    stage: "Lead",
    tag: "New",
    value: "",
    source: "",
  };
}

// Extract crm.* pipeline fields from metadata.crm.
function extractPipeline(meta: Record<string, any>): {
  stage: Stage;
  tag: Tag;
  value: string;
  source: string;
} {
  const crm = meta?.crm && typeof meta.crm === "object" ? meta.crm : {};
  let stage: Stage = "Lead";
  let tag: Tag = "New";
  let value = "";
  let source = "";
  if (crm.stage && STAGES.includes(crm.stage)) stage = crm.stage;
  if (crm.tag && TAGS.includes(crm.tag)) tag = crm.tag;
  if (crm.source) source = String(crm.source);
  return { stage, tag, value, source };
}

// Strip crm.* from metadata so they aren't shown as user-visible "extra" fields.
function userExtras(extra: ExtraRow[]): ExtraRow[] {
  return extra.filter((r) => !CRM_EXTRA_KEYS.has(r.key));
}

function normalizeContact(raw: any): CRMContact {
  const base = emptyContact();
  if (!raw || typeof raw !== "object") return base;
  const meta = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  const pipeline = extractPipeline(meta);
  const extra: ExtraRow[] = Array.isArray(raw.extra) ? raw.extra : [];
  return {
    ...base,
    ...raw,
    // Core DB fields
    full_name: raw.full_name ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    avatar_url: raw.avatar_url ?? null,
    company: raw.company ?? null,
    job_title: raw.job_title ?? null,
    linkedin_url: raw.linkedin_url ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    metadata: meta,
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
    // Derived from metadata
    first_name: meta.first_name ?? null,
    last_name: meta.last_name ?? null,
    address: meta.address ?? null,
    city: meta.city ?? null,
    state: meta.state ?? null,
    zip: meta.zip ?? null,
    birthday: meta.birthday ?? null,
    notes: meta.notes ?? null,
    image_upload: meta.image_upload ?? raw.avatar_url ?? null,
    color: meta.color ?? null,
    last_touch: meta.last_touch ?? null,
    phones: Array.isArray(meta.phones) ? meta.phones : [],
    emails: Array.isArray(meta.emails) ? meta.emails : [],
    websites: Array.isArray(meta.websites) ? meta.websites : [],
    socials: Array.isArray(meta.socials) ? meta.socials : [],
    messaging: Array.isArray(meta.messaging) ? meta.messaging : [],
    extra,
    // Pipeline fields
    stage: pipeline.stage,
    tag: pipeline.tag,
    value: pipeline.value,
    source: pipeline.source,
  };
}

// ---------------------------------------------------------------------------
// Toast bus (typed, 4.2s)
// ---------------------------------------------------------------------------

const toastListeners = new Set<(t: Toast) => void>();
let toastSeq = 0;
function toast(kind: Toast["kind"], message: string): void {
  const t: Toast = { id: ++toastSeq, kind, message };
  toastListeners.forEach((l) => l(t));
}

function useToasts() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const push = (t: Toast) => {
      setItems((p) => [...p, t]);
      window.setTimeout(() => {
        setItems((p) => p.filter((x) => x.id !== t.id));
      }, 4200);
    };
    toastListeners.add(push);
    return () => {
      toastListeners.delete(push);
    };
  }, []);
  const dismiss = useCallback((id: number) => {
    setItems((p) => p.filter((x) => x.id !== id));
  }, []);
  return { items, dismiss };
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  const colors: Record<Toast["kind"], string> = {
    info: "border-sky-700 bg-sky-900/90 text-sky-100",
    success: "border-emerald-700 bg-emerald-900/90 text-emerald-100",
    error: "border-red-700 bg-red-900/90 text-red-100",
    warn: "border-amber-700 bg-amber-900/90 text-amber-100",
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
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
      ))}
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
// AI prompts (kept from old file, unchanged)
// ---------------------------------------------------------------------------

const AI_PROMPTS: Record<AIActionKey, (c: CRMContact) => string> = {
  intro: (c) => `Write a short, warm intro email from a service provider to this lead.

Name: ${displayName(c)}
${c.company ? `Company: ${c.company}` : ""}
${c.job_title ? `Title: ${c.job_title}` : ""}
${c.stage ? `Stage: ${c.stage}` : ""}
${c.value ? `Deal value: ${c.value}` : ""}
${c.notes ? `Notes: ${c.notes}` : ""}

Requirements:
- 3 subject line options
- Body ≤120 words
- One clear CTA
- No jargon, no fake compliments`,
  qualify: (c) => `Assess this lead's qualification (BANT).

Name: ${displayName(c)}
${c.company ? `Company: ${c.company}` : ""}
${c.stage ? `Stage: ${c.stage}` : ""}
${c.value ? `Deal value: ${c.value}` : ""}
${c.notes ? `Notes: ${c.notes}` : ""}
${c.last_touch ? `Last contact: ${c.last_touch}` : ""}

Return:
- Score 0-100 with one-line justification
- BANT breakdown (High/Medium/Low per category)
- 3 qualifying questions to ask next
Be honest — if data is missing, say so.`,
  next: (c) => `Give a concrete next-step plan for this lead.

Name: ${displayName(c)}
${c.company ? `Company: ${c.company}` : ""}
${c.stage ? `Stage: ${c.stage}` : ""}
${c.value ? `Deal value: ${c.value}` : ""}
${c.notes ? `Notes: ${c.notes}` : ""}
${c.last_touch ? `Last contact: ${c.last_touch}` : ""}

Return a 3-step plan for the next 7 days.
Each step: action, timing, channel, and specific outcome.`,
  objections: (c) => `Predict the 3 most likely objections this lead will raise, and give one sharp response for each.

Name: ${displayName(c)}
${c.company ? `Company: ${c.company}` : ""}
${c.stage ? `Stage: ${c.stage}` : ""}
${c.notes ? `Notes: ${c.notes}` : ""}

Format each as: Objection → Response.
Under 60 words per response.`,
};

const AI_ACTIONS: { key: AIActionKey; label: string }[] = [
  { key: "intro", label: "Draft intro" },
  { key: "qualify", label: "Qualify" },
  { key: "next", label: "Next steps" },
  { key: "objections", label: "Objections" },
];

// ---------------------------------------------------------------------------
// CSV header for export
// ---------------------------------------------------------------------------

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
  "stage",
  "tag",
  "value",
  "source",
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

function contactToCsvRow(c: CRMContact): string {
  const phones = c.phones.map((p) => p.value).join("|");
  const emails = c.emails.map((e) => e.value).join("|");
  const websites = c.websites.map((w) => w.value).join("|");
  const socials = c.socials.map((s) => `${s.platform}:${s.value}`).join("|");
  const messaging = c.messaging.map((m) => m.value).join("|");
  const extra = userExtras(c.extra)
    .map((e) => `${e.key}:${e.value}`)
    .join("|");
  const tags = (c.tags || []).join("|");
  return [
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
    c.stage,
    c.tag,
    c.value || "",
    c.source || "",
    phones,
    emails,
    websites,
    socials,
    messaging,
    extra,
    c.notes || "",
    c.created_at || "",
    c.updated_at || "",
  ]
    .map(csvEscape)
    .join(",");
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function CRMPanel(): React.JSX.Element {
  const userEmail = useUserEmail();

  // Toast bus wiring
  const { items: toasts, dismiss: dismissToast } = useToasts();

  // List state
  const [contacts, setContacts] = useState<CRMContact[]>([]);
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
  const [searchInput, setSearchInput] = useState<string>(
    () => window.localStorage.getItem(LS_SEARCH) || "",
  );
  const [searchDebounced, setSearchDebounced] = useState<string>(searchInput);
  const [stageFilter, setStageFilter] = useState<Stage | "All">(() => {
    const v = window.localStorage.getItem(LS_STAGE);
    return v && (v === "All" || STAGES.includes(v as Stage)) ? (v as Stage | "All") : "All";
  });
  const [tagFilter, setTagFilter] = useState<Tag | "All">(() => {
    const v = window.localStorage.getItem(LS_TAG);
    return v && (v === "All" || TAGS.includes(v as Tag)) ? (v as Tag | "All") : "All";
  });
  const [sortKey, setSortKey] = useState<string>(
    () => window.localStorage.getItem(LS_SORT) || "updated_at_desc",
  );

  // Selection / modal state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CRMContact | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // AI enrich
  const [enriching, setEnriching] = useState<boolean>(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // AI actions (per detail view)
  const [aiAction, setAiAction] = useState<AIActionKey | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<string>("");
  const [aiError, setAiError] = useState<string | null>(null);

  // Image upload
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Abort controller
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
    window.localStorage.setItem(LS_STAGE, stageFilter);
  }, [stageFilter]);
  useEffect(() => {
    window.localStorage.setItem(LS_TAG, tagFilter);
  }, [tagFilter]);
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
        .select("*", { count: "exact" });

      if (searchDebounced.trim()) {
        const q = searchDebounced.trim();
        query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`);
      }

      const range = { from: page * limit, to: (page + 1) * limit - 1 };
      const { data, count, error: sbError } = await query.range(range.from, range.to);

      if (sbError) throw sbError;

      const list: CRMContact[] = (data || []).map(normalizeContact);
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
  }, [limit, page, searchDebounced]);

  useEffect(() => {
    fetchList();
    return () => {
      if (listAbortRef.current) listAbortRef.current.abort();
    };
  }, [fetchList]);

  // -------------------------------------------------------------------------
  // Derived list (client-side filter for stage/tag over the current page)
  // Note: stage/tag filter is applied client-side because pipeline fields live
  // in contacts_extra — the Worker's list endpoint does not filter on them.
  // This means "Page N of M" counts the full server-filtered set (by q), and
  // stage/tag refines the visible page. Honest caveat surfaced in the UI.
  // -------------------------------------------------------------------------

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (stageFilter !== "All" && c.stage !== stageFilter) return false;
      if (tagFilter !== "All" && c.tag !== tagFilter) return false;
      return true;
    });
  }, [contacts, stageFilter, tagFilter]);

  const stats = useMemo(() => {
    const totalValue = contacts.reduce((s, c) => {
      const n = parseFloat(String(c.value || "").replace(/[^\d.]/g, "")) || 0;
      return s + n;
    }, 0);
    return {
      leads: total,
      hot: contacts.filter((c) => c.tag === "Hot").length,
      pipeline: totalValue,
    };
  }, [contacts, total]);

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  const openContact = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setEnrichResult(null);
      setEnrichError(null);
      setAiAction(null);
      setAiResult("");
      setAiError(null);
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
    [],
  );

  const startCreate = useCallback(() => {
    setEditing(emptyContact());
    setCreating(true);
    setSelectedId(null);
    setEnrichResult(null);
    setEnrichError(null);
    setAiAction(null);
    setAiResult("");
    setAiError(null);
  }, []);

  const closeModal = useCallback(() => {
    setEditing(null);
    setCreating(false);
  }, []);

  // Esc to close
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
  // Save
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
        kind: "crm",
        // Pipeline fields under crm.*
        crm: {
          stage: editing.stage,
          tag: editing.tag,
          value: editing.value,
          source: editing.source,
        },
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
        toast("success", "Lead created");
      } else {
        const { error: sbError } = await supabase
          .from("contacts")
          .update(scalar)
          .eq("id", editing.id);
        if (sbError) throw sbError;
        toast("success", "Lead saved");
      }

      closeModal();
      await fetchList();
    } catch (e: any) {
      const msg = e?.message || "Save failed";
      toast("error", String(msg));
    } finally {
      setSaving(false);
    }
  }, [editing, creating, closeModal, fetchList]);

  async function reconcileBucket<T extends { id: string }>(
    contactId: string,
    bucket: Bucket,
    serverRows: T[],
    clientRows: T[],
    toPayload: (r: T) => Record<string, any>,
  ): Promise<void> {
    // Extra is upsert-by-key on the Worker, so we can send directly.
    // For other buckets, diff by id.
    if (bucket === "extra") {
      for (const c of clientRows) {
        await (lifeosApi as any).post(
          `/api/contacts/${encodeURIComponent(contactId)}/extra`,
          toPayload(c),
        );
      }
      // Delete server extras that aren't in the desired set
      const desiredKeys = new Set(clientRows.map((r: any) => r.key));
      for (const s of serverRows) {
        const key = (s as any).key;
        if (!desiredKeys.has(key)) {
          await (lifeosApi as any).delete(
            `/api/contacts/${encodeURIComponent(contactId)}/extra/${encodeURIComponent(s.id)}`,
          );
        }
      }
      return;
    }

    const clientById = new Map(clientRows.filter((r) => r.id).map((r) => [r.id, r]));
    const serverById = new Map(serverRows.map((r) => [r.id, r]));

    for (const s of serverRows) {
      if (!clientById.has(s.id)) {
        await (lifeosApi as any).delete(
          `/api/contacts/${encodeURIComponent(contactId)}/${bucket}/${encodeURIComponent(s.id)}`,
        );
      }
    }
    for (const c of clientRows) {
      if (c.id && serverById.has(c.id)) {
        const prev = serverById.get(c.id)!;
        if (JSON.stringify(prev) !== JSON.stringify(c)) {
          await (lifeosApi as any).patch(
            `/api/contacts/${encodeURIComponent(contactId)}/${bucket}/${encodeURIComponent(c.id)}`,
            toPayload(c),
          );
        }
      } else {
        await (lifeosApi as any).post(
          `/api/contacts/${encodeURIComponent(contactId)}/${bucket}`,
          toPayload(c),
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  const deleteOne = useCallback(
    async (id: string) => {
      const target = contacts.find((c) => c.id === id);
      if (!window.confirm(`Delete "${displayName(target ?? emptyContact())}"? Cascades all child rows.`)) {
        return;
      }
      try {
        const { error: sbError } = await supabase
          .from("contacts")
          .delete()
          .eq("id", id);
        if (sbError) throw sbError;
        toast("success", "Lead deleted");
        if (selectedId === id) setSelectedId(null);
        await fetchList();
      } catch (e: any) {
        const msg = e?.message || "Delete failed";
        toast("error", String(msg));
      }
    },
    [contacts, selectedId, fetchList],
  );

  const deleteAllLoaded = useCallback(async () => {
    if (contacts.length === 0) return;
    if (
      !window.confirm(
        `Delete all ${contacts.length} loaded contact(s)? This cascades all child rows.`,
      )
    ) {
      return;
    }
    const ids = contacts.map((c) => c.id);
    try {
      const { error: sbError } = await supabase
        .from("contacts")
        .delete()
        .in("id", ids);
      if (sbError) throw sbError;
      toast("success", `Deleted ${ids.length} contact(s)`);
      setSelectedId(null);
      await fetchList();
    } catch (e: any) {
      const msg = e?.message || "Bulk delete failed";
      toast("error", String(msg));
    }
  }, [contacts, fetchList]);

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
      toast("success", "All contacts deleted");
      await fetchList();
    } catch (e: any) {
      toast("error", e?.message || "Delete all failed");
    }
  }, [fetchList, toast]);

  // -------------------------------------------------------------------------
  // Export / import
  // -------------------------------------------------------------------------

  const exportCsv = useCallback(() => {
    if (contacts.length === 0) {
      toast("warn", "Nothing to export on this page.");
      return;
    }
    const rows = contacts.map(contactToCsvRow);
    const content = [CSV_HEADER, ...rows].join("\n");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(`crm-${stamp}.csv`, content);
    toast("success", `Exported ${contacts.length} contact(s)`);
  }, [contacts]);

  const importRef = useRef<HTMLInputElement | null>(null);

  const importContacts = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const isCSV = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
      try {
        const rows = isCSV ? parseCSV(text) : parseJSONRows(text);

        const existing = new Set<string>();
        for (const c of contacts) {
          c.emails.forEach((em) => existing.add(em.value.toLowerCase()));
          c.phones.forEach((ph) => existing.add(onlyDigits(ph.value)));
          existing.add(displayName(c).toLowerCase());
        }

        let imported = 0;
        let skipped = 0;

        for (const row of rows) {
          const fn = cell(row, ["firstname", "givenname"], ["given"]);
          const ln = cell(row, ["lastname", "familyname", "surname"], ["family", "surname"]);
          const name = cell(row, ["name", "fullname", "displayname"], []) || `${fn} ${ln}`.trim();
          if (!name) {
            skipped++;
            continue;
          }
          const email = cell(row, ["email", "emailaddress", "email1value", "primaryemail"], ["email"]);
          const phone = cell(row, ["phone", "phonenumber", "phone1value", "mobilephone", "mobile"], ["phone", "mobile"]);
          const company = cell(row, ["company", "organization", "organization1name"], ["organization", "company"]);
          const title = cell(row, ["title", "jobtitle", "job"], ["job"]);
          const image = cell(row, ["image", "imageurl", "photourl", "avatar", "avatarurl", "picture", "photo1value"], ["image", "photo", "avatar", "picture"]);
          const keyE = email.toLowerCase();
          const keyP = onlyDigits(phone);
          if (
            (keyE && existing.has(keyE)) ||
            (keyP && existing.has(keyP)) ||
            existing.has(name.toLowerCase())
          ) {
            skipped++;
            continue;
          }

          const { data: created, error: insertError } = await supabase
            .from("contacts")
            .insert({
              full_name: name,
              email,
              phone,
              company,
              job_title: title,
              avatar_url: image || null,
              metadata: {
                kind: "crm",
                first_name: fn,
                last_name: ln,
                image_upload: image || null,
                address: cell(row, ["address", "address1"], ["address"]),
                city: cell(row, ["city"], ["city"]),
                state: cell(row, ["state", "region"], ["state"]),
                zip: cell(row, ["zip", "zipcode", "postalcode"], ["zip", "postal"]),
                birthday: parseDateInput(cell(row, ["birthday"], ["birthday"])) || null,
                notes: cell(row, ["notes", "note"], ["note"]),
                emails: email ? [{ id: "e0", value: email, position: 0 }] : [],
                phones: phone ? [{ id: "p0", value: phone, label: null, position: 0 }] : [],
                crm: {
                  stage: STAGES.includes(row.stage as Stage) ? row.stage : "Lead",
                  tag: TAGS.includes(row.tag as Tag) ? row.tag : "New",
                  value: row.value ? String(row.value) : "",
                  source: row.source ? String(row.source) : "",
                },
              },
            })
            .select("id")
            .single();
          if (insertError || !created?.id) {
            skipped++;
            continue;
          }

          existing.add(keyE);
          if (keyP) existing.add(keyP);
          existing.add(name.toLowerCase());
          imported++;
        }

        if (imported === 0) {
          toast("info", `No new contacts (skipped ${skipped}).`);
        } else {
          toast("success", `Imported ${imported} (${skipped} skipped).`);
          await fetchList();
        }
      } catch (err: any) {
        toast("error", `Import failed: ${err?.message || "unknown error"}`);
      } finally {
        if (importRef.current) importRef.current.value = "";
      }
    },
    [contacts, fetchList],
  );

  // -------------------------------------------------------------------------
  // Image upload (same gate as ContactsPanel)
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
        const result = await uploadFile(file, "crm");
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
    [],
  );

  // -------------------------------------------------------------------------
  // AI enrich (detail)
  // -------------------------------------------------------------------------

  const enrichContact = useCallback(async () => {
    if (!editing) return;
    setEnriching(true);
    setEnrichError(null);
    setEnrichResult(null);
    try {
      const res = await invokeLLM({
        prompt: `Enrich this contact: ${displayName(editing)}.
        Company: ${editing.company}
        Job Title: ${editing.job_title}
        City: ${editing.city}
        State: ${editing.state}
        Notes: ${editing.notes}
        Socials: ${JSON.stringify(editing.socials)}
        Websites: ${JSON.stringify(editing.websites)}`,
      });
      const data = res;
      const summary: string =
        typeof data?.text === "string"
          ? data.text
          : typeof data?.content === "string"
            ? data.content
            : "";
      if (!summary) throw new Error("Enrich returned no summary");
      setEnrichResult({
        summary,
        source: "llm",
        web_results_used: 0,
      });
      toast("success", "Enrichment ready");
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Enrichment failed";
      setEnrichError(String(msg));
      toast("error", String(msg));
    } finally {
      setEnriching(false);
    }
  }, [editing]);

  const copyEnrich = useCallback(async () => {
    if (!enrichResult) return;
    try {
      await navigator.clipboard.writeText(enrichResult.summary);
      toast("success", "Copied to clipboard");
    } catch {
      toast("error", "Clipboard unavailable");
    }
  }, [enrichResult]);

  // -------------------------------------------------------------------------
  // AI actions (per selected contact)
  // -------------------------------------------------------------------------

  const runAIAction = useCallback(
    async (action: AIActionKey) => {
      if (!selected) return;
      setAiAction(action);
      setAiLoading(true);
      setAiResult("");
      setAiError(null);
      try {
        const prompt = AI_PROMPTS[action](selected);
        const out = await invokeLLM({ prompt });
        const text =
          typeof out === "string"
            ? out
            : typeof out?.text === "string"
              ? out.text
              : typeof out?.content === "string"
                ? out.content
                : JSON.stringify(out);
        setAiResult(text);
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.message || "AI action failed";
        setAiError(String(msg));
        toast("error", String(msg));
      } finally {
        setAiLoading(false);
      }
    },
    [selected],
  );

  const copyAI = useCallback(async () => {
    if (!aiResult) return;
    try {
      await navigator.clipboard.writeText(aiResult);
      toast("success", "Copied to clipboard");
    } catch {
      toast("error", "Clipboard unavailable");
    }
  }, [aiResult]);

  // -------------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------------

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(1, limit))),
    [total, limit],
  );
  const canPrev = page > 0;
  const canNext = hasMore;

  // -------------------------------------------------------------------------
  // Edit-form child helpers
  // -------------------------------------------------------------------------

  const updateField = useCallback(
    <K extends keyof CRMContact>(key: K, value: CRMContact[K]) => {
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
      if (
        bucket === "phones" ||
        bucket === "emails" ||
        bucket === "websites" ||
        bucket === "messaging"
      ) {
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
    <PanelLayout
      title="CRM"
      subtitle="Pipeline & deal management (Path B)"
      icon={<Table2 size={18} />}
    >
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* SECTION: toolbar */}
      <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto">
        <input
          className={cn(inputCls, "!w-52 shrink-0")}
          placeholder="Search name, email, phone, company…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search contacts"
        />
        <div className="flex flex-nowrap items-center gap-2">
        <select
          className={cn(inputCls, "!w-24 shrink-0 py-1 text-xs")}
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
          className={cn(inputCls, "!w-36 shrink-0 py-1 text-xs")}
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
          <button
            type="button"
            className={btnCls}
            onClick={exportCsv}
            disabled={contacts.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            className={btnCls}
            onClick={() => importRef.current?.click()}
          >
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".csv,.json"
            onChange={importContacts}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className={btnDangerCls}
            onClick={deleteAllLoaded}
            disabled={contacts.length === 0}
          >
            Clear loaded
          </button>
          <button type="button" className={btnDangerCls} onClick={() => void deleteAll()}>
            Delete all
          </button>
          <button type="button" className={btnPrimaryCls} onClick={startCreate}>
            + New Lead
          </button>
        </div>
      </div>

      {/* SECTION: stats */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Leads</div>
          <div className="text-lg font-semibold text-zinc-100">{total}</div>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            Hot (this page)
          </div>
          <div className="text-lg font-semibold text-red-400">{stats.hot}</div>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-center">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">
            Pipeline (this page)
          </div>
          <div className="text-lg font-semibold text-emerald-400">
            ${(stats.pipeline / 1000).toFixed(1)}k
          </div>
        </div>
      </div>

      {/* SECTION: filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Stage</span>
        {(["All", ...STAGES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStageFilter(s as Stage | "All")}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              stageFilter === s
                ? "border-red-600 bg-red-900/40 text-red-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {s}
          </button>
        ))}
        <span className="ml-3 text-[10px] uppercase tracking-wide text-zinc-500">Tag</span>
        {(["All", ...TAGS] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTagFilter(t as Tag | "All")}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              tagFilter === t
                ? "border-amber-600 bg-amber-900/40 text-amber-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* SECTION: pagination */}
      <div className="mb-3 flex items-center gap-3 text-sm text-zinc-400">
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

      {/* SECTION: error */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-100">
          <span>{error}</span>
          <button type="button" className={btnGhostCls} onClick={fetchList}>
            Retry
          </button>
        </div>
      )}

      {/* SECTION: list + detail */}
      <div className="flex gap-4 overflow-hidden" style={{ height: "calc(100vh - 320px)" }}>
        {/* LEFT LIST */}
        <aside className="w-80 shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">
          {loading && contacts.length === 0 && !error && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
              <Spinner className="mr-2" /> Loading leads…
            </div>
          )}

          {!loading && !error && contacts.length === 0 && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
              <p className="mb-3">
                {total === 0 ? "No leads yet." : "No leads match filters."}
              </p>
              {total === 0 && (
                <button type="button" className={btnPrimaryCls} onClick={startCreate}>
                  + Create your first lead
                </button>
              )}
            </div>
          )}

          {filtered.length === 0 && contacts.length > 0 && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
              No leads on this page match the stage/tag filters.
            </div>
          )}

          {filtered.map((c) => {
            const active = selectedId === c.id;
            const initials = displayName(c)
              .split(" ")
              .map((n) => n[0])
              .filter(Boolean)
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setCreating(false);
                  setEditing(null);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                  active
                    ? "border-red-600/50 bg-red-900/20"
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700",
                )}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                  style={{
                    background: `linear-gradient(135deg,${TAG_COLORS[c.tag]},#ff8c42)`,
                  }}
                >
                  {initials || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate text-xs font-medium",
                      active ? "text-red-200" : "text-zinc-100",
                    )}
                  >
                    {displayName(c)}
                  </div>
                  <div className="truncate text-[10px] text-zinc-500">
                    {c.company || "—"}
                    {c.value ? ` · ${c.value}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{
                      background: `${TAG_COLORS[c.tag]}22`,
                      color: TAG_COLORS[c.tag],
                      border: `1px solid ${TAG_COLORS[c.tag]}44`,
                    }}
                  >
                    {c.tag}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteOne(c.id);
                    }}
                    className="text-[10px] text-red-400/60 hover:text-red-300"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </aside>

        {/* RIGHT DETAIL */}
        <section className="flex-1 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/30 p-6">
          {selected && !editing && (
            <ContactDetail
              contact={selected}
              onEdit={() => openContact(selected.id)}
              onDelete={() => deleteOne(selected.id)}
              onRunAI={runAIAction}
              aiLoading={aiLoading}
              aiAction={aiAction}
              aiResult={aiResult}
              aiError={aiError}
              onCopyAI={copyAI}
              onClearAI={() => {
                setAiAction(null);
                setAiResult("");
                setAiError(null);
              }}
            />
          )}

          {!selected && (
            <div className="flex h-full flex-col items-center justify-center text-center opacity-30">
              <div className="text-sm uppercase tracking-widest">
                Select a lead or click New Lead
              </div>
            </div>
          )}
        </section>
      </div>

      {/* SECTION: edit / create modal */}
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
                {creating ? "New Lead" : `Edit — ${displayName(editing)}`}
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

              {/* SECTION: pipeline */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Stage</label>
                  <select
                    className={inputCls}
                    value={editing.stage}
                    onChange={(e) => updateField("stage", e.target.value as Stage)}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tag</label>
                  <select
                    className={inputCls}
                    value={editing.tag}
                    onChange={(e) => updateField("tag", e.target.value as Tag)}
                  >
                    {TAGS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Deal value</label>
                  <input
                    className={inputCls}
                    value={editing.value}
                    onChange={(e) => updateField("value", e.target.value)}
                    placeholder="$0"
                  />
                </div>
                <div>
                  <label className={labelCls}>Source</label>
                  <input
                    className={inputCls}
                    value={editing.source}
                    onChange={(e) => updateField("source", e.target.value)}
                    placeholder="Referral, website, etc."
                  />
                </div>
              </section>

              {/* SECTION: image */}
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
                  <input
                    className={inputCls}
                    placeholder="Image URL"
                    value={editing.image_upload || ""}
                    onChange={(e) => {
                      updateField("image_upload", e.target.value || null);
                      updateField("avatar_url", e.target.value || null);
                    }}
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
                      onChange={(e) =>
                        updateChild("phones", idx, { label: e.target.value })
                      }
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
                      onChange={(e) =>
                        updateChild("emails", idx, { value: e.target.value })
                      }
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
                      onChange={(e) =>
                        updateChild("websites", idx, { value: e.target.value })
                      }
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
                          {p}
                        </option>
                      ))}
                    </select>
                    <input
                      className={inputCls}
                      value={row.value}
                      onChange={(e) =>
                        updateChild("socials", idx, { value: e.target.value })
                      }
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
                      onChange={(e) =>
                        updateChild("messaging", idx, { value: e.target.value })
                      }
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

              {/* SECTION: user extras (crm.* rows hidden) */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200">Extra</h3>
                  <button
                    type="button"
                    className={btnGhostCls}
                    onClick={() =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              extra: [
                                ...prev.extra,
                                { id: "", key: "", value: "" },
                              ],
                            }
                          : prev,
                      )
                    }
                  >
                    + Add
                  </button>
                </div>
                {userExtras(editing.extra).length === 0 ? (
                  <p className="text-xs text-zinc-500">None yet.</p>
                ) : (
                  <div className="space-y-2">
                    {editing.extra.map((row, idx) =>
                      CRM_EXTRA_KEYS.has(row.key) ? null : (
                        <div key={row.id || `new-${idx}`} className="flex items-center gap-2">
                          <input
                            className={cn(inputCls, "w-40")}
                            value={row.key}
                            onChange={(e) =>
                              updateChild("extra", idx, { key: e.target.value })
                            }
                            placeholder="key"
                          />
                          <input
                            className={inputCls}
                            value={row.value}
                            onChange={(e) =>
                              updateChild("extra", idx, { value: e.target.value })
                            }
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
                      ),
                    )}
                  </div>
                )}
              </section>

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
                      title={!editing.id ? "Save the lead first" : undefined}
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
                    Enrichment runs against a saved lead. Save first, then enrich.
                  </p>
                )}
                {enrichError && <p className="text-sm text-red-300">{enrichError}</p>}
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
                <button
                  type="button"
                  className={btnCls}
                  onClick={closeModal}
                  disabled={saving}
                >
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
    </PanelLayout>
  );
}

// ---------------------------------------------------------------------------
// ContactDetail — read-only view of a selected lead
// ---------------------------------------------------------------------------

function ContactDetail({
  contact,
  onEdit,
  onDelete,
  onRunAI,
  aiLoading,
  aiAction,
  aiResult,
  aiError,
  onCopyAI,
  onClearAI,
}: {
  contact: CRMContact;
  onEdit: () => void;
  onDelete: () => void;
  onRunAI: (a: AIActionKey) => void;
  aiLoading: boolean;
  aiAction: AIActionKey | null;
  aiResult: string;
  aiError: string | null;
  onCopyAI: () => void;
  onClearAI: () => void;
}) {
  const name = displayName(contact);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const emails = contact.emails.map((e) => e.value).filter(Boolean);
  const phones = contact.phones.map((p) => p.value).filter(Boolean);
  const websites = contact.websites.map((w) => w.value).filter(Boolean);
  const socials = contact.socials.filter((s) => s.value);
  const extras = userExtras(contact.extra);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-black"
            style={{
              background: `linear-gradient(135deg,${TAG_COLORS[contact.tag]},#ff8c42)`,
            }}
          >
            {contact.image_upload ? (
              <img
                src={contact.image_upload}
                alt=""
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              initials || "?"
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-wide text-zinc-100">{name}</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {contact.job_title || "Lead"}
              {contact.company ? ` at ${contact.company}` : ""}
            </p>
            {contact.birthday && (
              <p className="mt-1 text-[11px] text-pink-300">
                🎂 {formatDateDisplay(contact.birthday)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className={btnGhostCls}
            title="Edit"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={btnGhostCls}
            title="Delete"
          >
            Delete
          </button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2.5 text-[10px] uppercase tracking-wide text-emerald-400">
            Pipeline
          </div>
          {[
            ["Stage", contact.stage, STAGE_COLORS[contact.stage]],
            ["Tag", contact.tag, TAG_COLORS[contact.tag]],
            ["Value", contact.value || "—", "#4ab3f4"],
            ["Source", contact.source || "—", null],
            ["Last touch", formatDateDisplay(contact.last_touch) || "—", null],
            ["Birthday", formatDateDisplay(contact.birthday) || "—", contact.birthday ? "#ff6b9d" : null],
          ].map(([l, v, c]) => (
            <div key={l as string} className="flex justify-between py-1 text-[11px]">
              <span className="text-zinc-500">{l}</span>
              <span style={{ color: (c as string) ?? "rgba(255,255,255,0.7)" }}>
                {v}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2.5 text-[10px] uppercase tracking-wide text-emerald-400">
            Contact
          </div>
          {emails.length === 0 && phones.length === 0 && websites.length === 0 && (
            <div className="text-[11px] italic text-zinc-500">
              No contact info on file.
            </div>
          )}
          {emails.map((e, i) => (
            <div key={`e${i}`} className="flex justify-between gap-2 py-1 text-[11px]">
              <span className="shrink-0 text-zinc-500">
                {i === 0 ? "Email" : `Email ${i + 1}`}
              </span>
              <a
                href={`mailto:${e}`}
                className="truncate text-sky-400 no-underline hover:underline"
              >
                {e}
              </a>
            </div>
          ))}
          {phones.map((p, i) => (
            <div key={`p${i}`} className="flex justify-between gap-2 py-1 text-[11px]">
              <span className="shrink-0 text-zinc-500">
                {i === 0 ? "Phone" : `Phone ${i + 1}`}
              </span>
              <a
                href={`tel:${onlyDigits(p)}`}
                className="text-sky-400 no-underline hover:underline"
              >
                {formatPhone(p)}
              </a>
            </div>
          ))}
          {websites.map((w, i) => (
            <div key={`w${i}`} className="flex justify-between gap-2 py-1 text-[11px]">
              <span className="shrink-0 text-zinc-500">
                {i === 0 ? "Website" : `Website ${i + 1}`}
              </span>
              <a
                href={w.startsWith("http") ? w : `https://${w}`}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sky-400 no-underline hover:underline"
              >
                {w}
              </a>
            </div>
          ))}
          {(contact.address || contact.city || contact.state || contact.zip) && (
            <div className="flex justify-between gap-2 py-1 text-[11px]">
              <span className="shrink-0 text-zinc-500">Address</span>
              <span className="text-right text-zinc-300">
                {[contact.address, contact.city, contact.state, contact.zip]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2.5 text-[10px] uppercase tracking-wide text-emerald-400">
            Social
          </div>
          {socials.length === 0 && (
            <div className="text-[11px] italic text-zinc-500">No socials on file.</div>
          )}
          {socials.map((s, i) => (
            <div key={`s${i}`} className="mb-1.5">
              <div className="text-[10px] text-zinc-500">{s.platform}</div>
              <a
                href={s.value.startsWith("http") ? s.value : `https://${s.value}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-[10px] text-zinc-300 no-underline hover:text-zinc-100"
              >
                {s.value}
              </a>
            </div>
          ))}
          {extras.length > 0 && (
            <>
              <div className="mt-3 mb-2 text-[10px] uppercase tracking-wide text-emerald-400">
                Extra
              </div>
              {extras.map((e, i) => (
                <div key={`x${i}`} className="flex justify-between gap-2 py-0.5 text-[11px]">
                  <span className="shrink-0 text-zinc-500">{e.key}</span>
                  <span className="truncate text-zinc-300">{e.value}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {contact.notes && (
        <div className="mb-3.5 rounded-md border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-emerald-400">
            Notes
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">
            {contact.notes}
          </p>
        </div>
      )}

      {/* AI actions */}
      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 text-[11px] uppercase tracking-wide text-red-400">
          AI Assistant
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => onRunAI(a.key)}
              disabled={aiLoading}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                aiAction === a.key
                  ? "border-red-600 bg-red-900/40 text-red-200"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-zinc-100",
                aiLoading && "opacity-50",
              )}
            >
              {aiLoading && aiAction === a.key ? "…" : a.label}
            </button>
          ))}
        </div>

        {aiError && (
          <div className="mb-2 rounded border border-red-800 bg-red-900/30 p-2 text-[11px] text-red-200">
            {aiError}
          </div>
        )}

        {aiResult && (
          <div className="rounded-md border border-red-800/40 bg-red-950/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-red-300">
                {AI_ACTIONS.find((a) => a.key === aiAction)?.label ?? "Result"}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={onCopyAI}
                  className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => aiAction && onRunAI(aiAction)}
                  disabled={aiLoading}
                  className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={onClearAI}
                  className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  Clear
                </button>
              </div>
            </div>
            <pre className="m-0 whitespace-pre-wrap font-sans text-xs leading-relaxed text-zinc-200">
              {aiResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChildSection (same as ContactsPanel)
// ---------------------------------------------------------------------------

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
// CSV parsing (kept from old file, trimmed)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === "," && !inQ) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

interface ParsedRow {
  [key: string]: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      if (cells[idx]) row[h] = cells[idx];
    });
    rows.push(row);
  }
  return rows;
}

function cell(row: ParsedRow, exact: string[], loose: string[]): string {
  for (const key of exact) {
    const value = row[key]?.trim();
    if (value) return value;
  }
  for (const [key, value] of Object.entries(row)) {
    const text = value?.trim();
    if (!text) continue;
    if (key.endsWith("type") || key.endsWith("label")) continue;
    if (loose.some((part) => key.includes(part))) return text;
  }
  return "";
}

function parseJSONRows(text: string): ParsedRow[] {
  const parsed = JSON.parse(text);
  return (Array.isArray(parsed) ? parsed : [parsed]) as ParsedRow[];
}

// ---------------------------------------------------------------------------
// Re-exports for other panels
// ---------------------------------------------------------------------------

export { SOCIALS as CRM_SOCIALS, MESSAGING as CRM_MESSAGING };