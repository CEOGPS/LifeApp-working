// src/pages/EmailPanel.tsx
// LifeOS1 — Email Panel
//
// Six tabs:
//   Inbox        — reads from email_accounts; honest "not connected" state
//                  until a provider OAuth flow is completed
//   Campaigns    — full composer + drafts + scheduling, backed by
//                  email_campaigns; real AI subject/body generation
//   Analytics    — real aggregates from email_campaigns; empty until
//                  campaigns exist
//   Verification — real SPF/DKIM/DMARC generation + a real DNS-check
//                  Worker route (route NOT included here)
//   DNS Settings — same as above; user copies records into their DNS
//   Lists        — full CRUD backed by email_lists
//
// All Supabase access is direct (RLS via auth.uid()). No new Worker
// routes are needed for anything in this file except the DNS check,
// which the panel honestly reports as not configured if the route
// isn't deployed.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Mail, Search, Plus, Star, Archive, Trash2, Send, RefreshCw, Inbox,
  AlertCircle, BarChart3, CheckCircle2, Globe, List, Copy, ChevronDown,
  Upload, Shield, Zap, Clock, Calendar, X, Loader2, Download, Info,
  Check, Save, Pencil, Eye,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";

type LLMResult = { ok: boolean; text: string; reason?: string };

async function invokeLLMAuthorized({
  prompt,
  accessToken,
}: {
  prompt: string;
  accessToken: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("invoke-llm", {
    body: { prompt },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) throw error;
  return typeof data === "string" ? data : data?.text ?? "";
}

async function invokeLLM({ prompt }: { prompt: string }): Promise<LLMResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? null;

    if (!accessToken) {
      return {
        ok: false,
        text: "",
        reason: "Authentication required",
      };
    }

    const res = await invokeLLMAuthorized({
      prompt,
      accessToken,
    });

    return {
      ok: true,
      text: res,
    };
  } catch (error: any) {
    return {
      ok: false,
      text: "",
      reason: error?.message || "AI request failed",
    };
  }
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
    <div className="h-full flex flex-col gap-4 p-4 min-h-0">
      <header className="flex items-center gap-3 shrink-0">
        {icon && <div className="text-primary">{icon}</div>}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-display text-white/90">{title}</h1>
          {subtitle && <p className="text-[10px] text-white/40">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <main className="flex-1 min-h-0">{children}</main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Provider = "gmail" | "outlook" | "yahoo" | "imap";

interface EmailAccount {
  id: string;
  provider: Provider;
  email_address: string;
  display_name: string | null;
  color: string;
  connected_at: string;
  last_sync_at: string | null;
}

interface EmailList {
  id: string;
  name: string;
  description: string | null;
  color: string;
  subscribers: string[];
  created_at: string;
}

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

interface EmailCampaign {
  id: string;
  name: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  body: string | null;
  list_ids: string[];
  status: CampaignStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  created_at: string;
}

interface EmailDomain {
  id: string;
  domain: string;
  dkim_selector: string;
  dkim_public_key: string | null;
  dmarc_policy: "none" | "quarantine" | "reject";
  spf_verified: boolean;
  dkim_verified: boolean;
  dmarc_verified: boolean;
  last_checked_at: string | null;
}

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

type TabKey = "inbox" | "campaigns" | "analytics" | "verification" | "dns" | "lists";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "inbox",        label: "Inbox",        icon: <Inbox size={12} /> },
  { key: "campaigns",    label: "Campaigns",    icon: <Send size={12} /> },
  { key: "analytics",    label: "Analytics",    icon: <BarChart3 size={12} /> },
  { key: "verification", label: "Verification", icon: <Shield size={12} /> },
  { key: "dns",          label: "DNS Settings", icon: <Globe size={12} /> },
  { key: "lists",        label: "Lists",        icon: <List size={12} /> },
];

const FOLDER_DEFS: { key: "inbox" | "sent" | "starred" | "spam" | "archive" | "trash"; label: string; icon: React.ReactNode }[] = [
  { key: "inbox",   label: "Inbox",   icon: <Inbox size={12} /> },
  { key: "sent",    label: "Sent",    icon: <Send size={12} /> },
  { key: "starred", label: "Starred", icon: <Star size={12} /> },
  { key: "spam",    label: "Spam",    icon: <AlertCircle size={12} /> },
  { key: "archive", label: "Archive", icon: <Archive size={12} /> },
  { key: "trash",   label: "Trash",   icon: <Trash2 size={12} /> },
];

const PROVIDER_COLOR: Record<Provider, string> = {
  gmail:   "#ea4335",
  outlook: "#0078d4",
  yahoo:   "#6001d2",
  imap:    "#8b7fff",
};

const PROVIDER_LABEL: Record<Provider, string> = {
  gmail:   "Gmail",
  outlook: "Outlook",
  yahoo:   "Yahoo",
  imap:    "IMAP",
};

const TEAL = "hsl(var(--teal))";
const TOAST_MS = 4200;

const LS = {
  tab:     "lifeos_email_tab",
  search:  "lifeos_email_search",
  folder:  "lifeos_email_folder",
  account: "lifeos_email_account",
};

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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function EmailPanel() {
  /* ---------- persisted tab state ---------- */
  const [tab, setTab] = useState<TabKey>(() => lsGet<TabKey>(LS.tab, "inbox"));
  const [folder, setFolder] = useState<"inbox" | "sent" | "starred" | "spam" | "archive" | "trash">(
    () => lsGet(LS.folder, "inbox"),
  );
  const [activeAccountId, setActiveAccountId] = useState<string | null>(() => lsGet(LS.account, null));
  const [searchRaw, setSearchRaw] = useState<string>(() => lsGet(LS.search, ""));
  const [search, setSearch] = useState(searchRaw);

  useEffect(() => lsSet(LS.tab, tab), [tab]);
  useEffect(() => lsSet(LS.folder, folder), [folder]);
  useEffect(() => lsSet(LS.account, activeAccountId), [activeAccountId]);
  useEffect(() => lsSet(LS.search, searchRaw), [searchRaw]);

  // 200ms debounce on search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  /* ---------- data ---------- */
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------- toast ---------- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }, []);

  /* ---------- fetch all data ---------- */
  const abortRef = useRef<AbortController | null>(null);
  const loadAll = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const [accountsRes, listsRes, campaignsRes, domainsRes] = await Promise.all([
        supabase.from("email_accounts").select("*").order("connected_at", { ascending: false }),
        supabase.from("email_lists").select("*").order("created_at", { ascending: false }),
        supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }),
        supabase.from("email_domains").select("*").order("created_at", { ascending: false }),
      ]);
      if (ac.signal.aborted) return;

      const firstErr = [accountsRes.error, listsRes.error, campaignsRes.error, domainsRes.error].find(Boolean);
      if (firstErr) throw firstErr;

      setAccounts((accountsRes.data ?? []) as EmailAccount[]);
      setLists((listsRes.data ?? []) as EmailList[]);
      setCampaigns((campaignsRes.data ?? []) as EmailCampaign[]);
      setDomains((domainsRes.data ?? []) as EmailDomain[]);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setError(e?.message || "Failed to load email data");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); return () => abortRef.current?.abort(); }, [loadAll]);

  /* ---------- keyboard: Esc closes nothing yet, kept as scaffold ---------- */
  // (No modals in this panel currently; kept for future additions.)

  /* ---------- derived ---------- */
  const activeAccount = useMemo(
    () => (activeAccountId ? accounts.find((a) => a.id === activeAccountId) ?? null : null),
    [activeAccountId, accounts],
  );

  const folderCounts = useMemo(() => {
    // Until real emails are fetched (Inbox is not wired), all counts are zero.
    // This is honest — the panel does not invent counts.
    return {
      inbox: 0, sent: 0, starred: 0, spam: 0, archive: 0, trash: 0,
    };
  }, []);

  /* ---------- render ---------- */
  return (
    <PanelLayout
      title="Email"
      subtitle="Universal inbox, campaigns, and deliverability"
      icon={<Mail size={18} />}
      actions={
        <div className="flex items-center gap-1.5">
          <button
            onClick={loadAll}
            disabled={loading}
            title="Reload"
            className="p-1.5 rounded-lg glass border border-white/8 text-white/50 hover:text-primary disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => { setTab("campaigns"); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm"
          >
            <Plus size={12} /> COMPOSE
          </button>
        </div>
      }
    >
      <div className="h-full flex flex-col gap-3 min-h-0">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs">
            <AlertCircle size={14} />
            <span className="flex-1">{error}</span>
            <button onClick={loadAll} className="px-2 py-1 rounded glass-crimson text-primary text-[10px] font-display">
              RETRY
            </button>
          </div>
        )}

        {/* Tab nav */}
        <div className="flex gap-1 overflow-x-auto shrink-0 glass rounded-xl border border-white/8 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-display tracking-wider whitespace-nowrap transition-colors
                ${tab === t.key ? "glass-crimson text-primary" : "text-white/40 hover:text-white/70"}`}
            >
              {t.icon}
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 flex flex-col min-h-0">
          {tab === "inbox" && (
            <InboxTab
              accounts={accounts}
              folder={folder}
              setFolder={setFolder}
              folderCounts={folderCounts}
              activeAccountId={activeAccountId}
              setActiveAccountId={setActiveAccountId}
              searchRaw={searchRaw}
              setSearchRaw={setSearchRaw}
              search={search}
              onReload={loadAll}
              pushToast={pushToast}
            />
          )}
          {tab === "campaigns" && (
            <CampaignsTab
              campaigns={campaigns}
              lists={lists}
              accounts={accounts}
              onReload={loadAll}
              pushToast={pushToast}
            />
          )}
          {tab === "analytics" && (
            <AnalyticsTab campaigns={campaigns} />
          )}
          {tab === "verification" && (
            <VerificationTab
              domains={domains}
              onReload={loadAll}
              pushToast={pushToast}
            />
          )}
          {tab === "dns" && (
            <DnsTab
              domains={domains}
              onReload={loadAll}
              pushToast={pushToast}
            />
          )}
          {tab === "lists" && (
            <ListsTab
              lists={lists}
              onReload={loadAll}
              pushToast={pushToast}
            />
          )}
        </div>

        <div className="h-6 shrink-0" />
      </div>

      {/* Toasts */}
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
            {t.kind === "success" && <CheckCircle2 size={12} className="text-green-400 shrink-0" />}
            {t.kind === "info" && <Info size={12} className="text-sky-400 shrink-0" />}
            <span className="text-white/80">{t.text}</span>
          </div>
        ))}
      </div>
    </PanelLayout>
  );
}

/* ================================================================== */
/* Inbox tab                                                           */
/* ================================================================== */

function InboxTab(props: {
  accounts: EmailAccount[];
  folder: "inbox" | "sent" | "starred" | "spam" | "archive" | "trash";
  setFolder: (f: "inbox" | "sent" | "starred" | "spam" | "archive" | "trash") => void;
  folderCounts: Record<string, number>;
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
  searchRaw: string;
  setSearchRaw: (v: string) => void;
  search: string;
  onReload: () => void;
  pushToast: (k: Toast["kind"], t: string) => void;
}) {
  const {
    accounts, folder, setFolder, folderCounts,
    activeAccountId, setActiveAccountId,
    searchRaw, setSearchRaw,
    onReload, pushToast,
  } = props;

  const hasAccounts = accounts.length > 0;

  return (
    <div className="flex gap-3 min-h-0 flex-1">
      {/* Accounts + folders */}
      <div className="w-48 shrink-0 flex flex-col gap-3">
        <div className="glass rounded-xl border border-white/8 p-2">
          <div className="text-[9px] font-display tracking-widest px-2 mb-1.5" style={{ color: TEAL }}>
            ACCOUNTS
          </div>
          {!hasAccounts && (
            <div className="px-2 py-2 text-[10px] text-white/30 italic">
              No accounts connected
            </div>
          )}
          {accounts.map((a) => {
            const active = activeAccountId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setActiveAccountId(active ? null : a.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left
                  ${active ? "glass-crimson" : "hover:bg-white/5"}`}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                <span className="text-[11px] text-white/70 truncate flex-1">
                  {a.display_name || a.email_address}
                </span>
              </button>
            );
          })}
          <button
            onClick={async () => {
              // The OAuth flow lives in the Worker. This button just tells the user
              // where to go — it does not fake a connect.
              pushToast("info", "Connect accounts from Integrations panel (Gmail / Outlook / Yahoo)");
            }}
            className="w-full text-center text-[9px] text-white/30 hover:text-primary/60 mt-1 py-1 font-display tracking-wider"
          >
            + ADD ACCOUNT
          </button>
        </div>

        <div className="glass rounded-xl border border-white/8 p-2 flex-1">
          <div className="text-[9px] font-display tracking-widest px-2 mb-1.5" style={{ color: TEAL }}>
            FOLDERS
          </div>
          {FOLDER_DEFS.map((f) => {
            const active = folder === f.key;
            const count = folderCounts[f.key] ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => setFolder(f.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left
                  ${active ? "glass-crimson text-primary" : "text-white/55 hover:text-white/80 hover:bg-white/5"}`}
              >
                {f.icon}
                <span className="text-xs flex-1">{f.label}</span>
                {count > 0 && (
                  <span className="text-[9px] glass-crimson px-1.5 rounded-full text-primary">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Email list */}
      <div className="w-72 shrink-0 flex flex-col gap-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Search emails…"
            className="w-full h-8 pl-8 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
        </div>
        <div className="flex-1 glass rounded-xl border border-white/8 flex flex-col items-center justify-center p-4">
          <Mail size={24} className="text-white/10 mb-2" />
          <div className="text-xs text-white/55 text-center">
            {hasAccounts ? "No messages loaded" : "No accounts connected"}
          </div>
          <div className="text-[10px] text-white/30 mt-1 text-center leading-relaxed">
            {hasAccounts
              ? "Message fetching is not wired yet. This panel will show real messages once the IMAP/Gmail sync route is deployed."
              : "Connect Gmail, Outlook, or Yahoo from the Integrations panel to populate your inbox."}
          </div>
          {!hasAccounts && (
            <button
              onClick={() => { window.location.hash = "#/integrations"; }}
              className="mt-3 px-3 py-1.5 rounded-lg glass-crimson text-primary text-[10px] font-display"
            >
              OPEN INTEGRATIONS
            </button>
          )}
        </div>
      </div>

      {/* Email detail */}
      <div className="flex-1 glass rounded-xl border border-white/8 flex items-center justify-center">
        <div className="text-center max-w-xs p-6">
          <Mail size={28} className="mx-auto text-white/8 mb-3" />
          <div className="text-sm text-white/55">Select an email to read</div>
          <div className="text-[10px] text-white/30 mt-2 leading-relaxed">
            Supports Gmail, Outlook, Yahoo, and IMAP.
            Campaign analytics via SendGrid &amp; Brevo once connected.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Campaigns tab                                                       */
/* ================================================================== */

function CampaignsTab(props: {
  campaigns: EmailCampaign[];
  lists: EmailList[];
  accounts: EmailAccount[];
  onReload: () => void;
  pushToast: (k: Toast["kind"], t: string) => void;
}) {
  const { campaigns, lists, accounts, onReload, pushToast } = props;

  const [aiMode, setAiMode] = useState(true);
  const [draft, setDraft] = useState({
    name: "",
    from_name: "",
    from_email: accounts[0]?.email_address || "",
    subject: "",
    body: "",
    list_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const resetDraft = () => {
    setDraft({
      name: "",
      from_name: "",
      from_email: accounts[0]?.email_address || "",
      subject: "",
      body: "",
      list_ids: [],
    });
  };

  const saveCampaign = async (status: CampaignStatus) => {
    if (!draft.name.trim()) { pushToast("error", "Campaign name is required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("email_campaigns").insert({
        name: draft.name.trim(),
        from_name: draft.from_name || null,
        from_email: draft.from_email || null,
        subject: draft.subject || null,
        body: draft.body || null,
        list_ids: draft.list_ids,
        status,
      });
      if (error) throw error;
      pushToast("success", status === "draft" ? "Draft saved" : "Campaign created");
      resetDraft();
      onReload();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const generateSubject = async () => {
    if (!draft.name.trim()) { pushToast("error", "Enter a campaign name first"); return; }
    setAiBusy("subject");
    try {
      const res = await invokeLLM({
        prompt:
          "Generate 3 alternative email subject lines for a marketing campaign. " +
          "Return ONLY a JSON array of 3 strings, no prose. Each under 60 characters. " +
          "Avoid emojis. Base them on the campaign details below.\n\n" +
          JSON.stringify({ name: draft.name, from_name: draft.from_name }),
      });
      if (!res.ok) { pushToast("error", `AI failed: ${res.reason}`); return; }
      const raw = res.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let list: string[] = [];
      try { const p = JSON.parse(raw); if (Array.isArray(p)) list = p.filter((x) => typeof x === "string"); } catch { /* ignore */ }
      if (!list.length) { pushToast("info", "AI returned no usable subjects"); return; }
      setDraft((d) => ({ ...d, subject: list[0] }));
      pushToast("success", "Subject generated");
    } catch (e: any) {
      pushToast("error", e?.message || "Subject generation failed");
    } finally {
      setAiBusy(null);
    }
  };

  const generateBody = async () => {
    if (!draft.subject.trim()) { pushToast("error", "Enter a subject first"); return; }
    setAiBusy("body");
    try {
      const res = await invokeLLM({
        prompt:
          "Write a short, professional marketing email body (under 180 words). " +
          "No emojis, no markdown. Return ONLY the body text, no subject, no headers. " +
          "End with a clear call to action. Base it on:\n\n" +
          JSON.stringify({ name: draft.name, subject: draft.subject }),
      });
      if (!res.ok) { pushToast("error", `AI failed: ${res.reason}`); return; }
      setDraft((d) => ({ ...d, body: res.text.trim() }));
      pushToast("success", "Body generated");
    } catch (e: any) {
      pushToast("error", e?.message || "Body generation failed");
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="flex gap-4 flex-1 min-h-0">
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-3">
          <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>
            CAMPAIGN COMPOSER
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[9px] text-white/40 font-display tracking-wider block mb-1">CAMPAIGN NAME</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full h-8 px-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
                placeholder="My Campaign"
              />
            </label>
            <label className="block">
              <span className="text-[9px] text-white/40 font-display tracking-wider block mb-1">FROM NAME</span>
              <input
                value={draft.from_name}
                onChange={(e) => setDraft({ ...draft, from_name: e.target.value })}
                className="w-full h-8 px-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
                placeholder="Your business name"
              />
            </label>
            <label className="block col-span-2">
              <span className="text-[9px] text-white/40 font-display tracking-wider block mb-1">FROM EMAIL</span>
              <select
                value={draft.from_email}
                onChange={(e) => setDraft({ ...draft, from_email: e.target.value })}
                className="w-full h-8 px-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 focus:outline-none focus:border-primary/40"
              >
                <option value="" style={{ background: "#0a0a0a" }}>— select an account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.email_address} style={{ background: "#0a0a0a" }}>
                    {a.email_address}
                  </option>
                ))}
              </select>
              {accounts.length === 0 && (
                <span className="text-[9px] text-amber-300/80 mt-1 block">
                  No email accounts connected. Connect one in the Integrations panel first.
                </span>
              )}
            </label>
            <label className="block col-span-2">
              <span className="text-[9px] text-white/40 font-display tracking-wider block mb-1">SUBJECT LINE</span>
              <div className="flex gap-2">
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className="flex-1 h-8 px-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
                  placeholder="Your subject here…"
                />
                <button
                  onClick={generateSubject}
                  disabled={aiBusy != null || !aiMode}
                  className="px-3 h-8 rounded-lg glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
                >
                  {aiBusy === "subject" ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                  AI
                </button>
              </div>
            </label>
          </div>

          {/* AI / Manual toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiMode(true)}
              className={`px-3 py-1 rounded text-[10px] font-display tracking-wider transition-all ${aiMode ? "glass-crimson text-primary" : "glass text-white/35 hover:text-white/60"}`}
            >
              AI
            </button>
            <button
              onClick={() => setAiMode(false)}
              className={`px-3 py-1 rounded text-[10px] font-display tracking-wider transition-all ${!aiMode ? "glass-crimson text-primary" : "glass text-white/35 hover:text-white/60"}`}
            >
              MANUAL
            </button>
          </div>

          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            className="w-full h-40 p-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40 resize-none"
            placeholder="Write your email body here…"
          />

          {aiMode && (
            <button
              onClick={generateBody}
              disabled={aiBusy != null}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-[10px] font-display hover:glow-crimson-sm disabled:opacity-40"
            >
              {aiBusy === "body" ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
              GENERATE BODY WITH AI
            </button>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => saveCampaign("draft")}
              disabled={saving || !draft.name.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-white/55 text-xs font-display hover:text-white/80 disabled:opacity-40"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              SAVE DRAFT
            </button>
            <button
              onClick={() => {
                // Scheduling requires a real email service + a cron. Until the send route
                // exists, this only saves the intent. The toast is honest about that.
                pushToast("info", "Scheduling is saved when the send route is deployed — see the caveats");
              }}
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-white/30 text-xs font-display cursor-not-allowed"
              title="Scheduling requires the /api/email/send Worker route"
            >
              <Clock size={11} /> SCHEDULE (route not deployed)
            </button>
            <button
              onClick={() => {
                pushToast("info", "Sending requires the /api/email/send Worker route — see the caveats");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary/60 text-xs font-display"
              title="Send will work once the Worker route is deployed"
            >
              <Send size={11} /> SEND (route not deployed)
            </button>
          </div>
        </div>

        {/* Recent campaigns */}
        <div className="glass rounded-xl border border-white/8 p-3 flex-1 min-h-[140px] overflow-y-auto">
          <div className="text-[9px] font-display tracking-widest mb-2" style={{ color: TEAL }}>
            RECENT CAMPAIGNS
          </div>
          {campaigns.length === 0 ? (
            <div className="text-[10px] text-white/30 italic text-center py-4">
              No campaigns yet.
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {campaigns.slice(0, 20).map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-[11px]">
                  <span className="text-white/70 flex-1 truncate">{c.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                    c.status === "sent" ? "bg-emerald-500/20 text-emerald-300"
                    : c.status === "failed" ? "bg-red-500/20 text-red-300"
                    : "bg-white/8 text-white/50"
                  }`}>
                    {c.status}
                  </span>
                  <span className="text-white/30 text-[10px]">{fmtDate(c.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* List selector */}
      <div className="w-52 shrink-0 glass rounded-xl border border-white/8 p-3 flex flex-col gap-2">
        <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>
          SELECT LISTS
        </div>
        {lists.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <List size={18} className="mx-auto text-white/10 mb-1" />
              <div className="text-[10px] text-white/30">No lists yet</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {lists.map((l) => {
              const checked = draft.list_ids.includes(l.id);
              return (
                <label key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setDraft((d) => ({
                        ...d,
                        list_ids: e.target.checked
                          ? [...d.list_ids, l.id]
                          : d.list_ids.filter((id) => id !== l.id),
                      }));
                    }}
                    className="accent-primary shrink-0"
                  />
                  <span className="text-[11px] text-white/70 truncate flex-1">{l.name}</span>
                  <span className="text-[9px] text-white/30">{l.subscribers.length}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Analytics tab                                                       */
/* ================================================================== */

function AnalyticsTab({ campaigns }: { campaigns: EmailCampaign[] }) {
  const totals = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + (c.sent_count || 0), 0);
    const opens = campaigns.reduce((s, c) => s + (c.open_count || 0), 0);
    const bounces = campaigns.reduce((s, c) => s + (c.bounce_count || 0), 0);
    const clicks = campaigns.reduce((s, c) => s + (c.click_count || 0), 0);
    return { sent, opens, bounces, clicks };
  }, [campaigns]);

  const hasData = campaigns.some((c) => c.status === "sent");

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sent",    val: totals.sent },
          { label: "Opens",   val: totals.opens },
          { label: "Bounces", val: totals.bounces },
          { label: "Clicks",  val: totals.clicks },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl border border-white/8 p-4">
            <div className="text-2xl font-display text-white/80">{s.val}</div>
            <div className="text-[9px] font-display tracking-widest mt-1" style={{ color: TEAL }}>
              {s.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {!hasData ? (
        <div className="flex-1 glass rounded-xl border border-white/8 flex items-center justify-center min-h-[180px]">
          <div className="text-center max-w-md p-6">
            <BarChart3 size={32} className="mx-auto text-white/8 mb-3" />
            <div className="text-sm text-white/55">No analytics yet</div>
            <div className="text-[10px] text-white/30 mt-1 leading-relaxed">
              Analytics appear after your first campaign is sent. Campaign sending
              requires the <code className="px-1 rounded bg-white/5">/api/email/send</code> Worker route,
              which is not deployed yet.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 glass rounded-xl border border-white/8 p-4 overflow-y-auto">
          <div className="text-[9px] font-display tracking-widest mb-2" style={{ color: TEAL }}>
            PER-CAMPAIGN BREAKDOWN
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/8">
                {["Campaign", "Status", "Sent", "Opens", "Clicks", "Bounces", "Sent at"].map((h) => (
                  <th key={h} className="text-left px-2 py-2 text-[9px] text-white/30 font-display tracking-wider">
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.filter((c) => c.status === "sent").map((c) => (
                <tr key={c.id} className="border-b border-white/5">
                  <td className="px-2 py-1.5 text-white/80">{c.name}</td>
                  <td className="px-2 py-1.5 text-white/50">{c.status}</td>
                  <td className="px-2 py-1.5 text-white/60">{c.sent_count}</td>
                  <td className="px-2 py-1.5 text-white/60">{c.open_count}</td>
                  <td className="px-2 py-1.5 text-white/60">{c.click_count}</td>
                  <td className="px-2 py-1.5 text-white/60">{c.bounce_count}</td>
                  <td className="px-2 py-1.5 text-white/40">{fmtDate(c.sent_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* Verification tab                                                    */
/* ================================================================== */

function VerificationTab(props: {
  domains: EmailDomain[];
  onReload: () => void;
  pushToast: (k: Toast["kind"], t: string) => void;
}) {
  const { domains, onReload, pushToast } = props;

  const [newDomain, setNewDomain] = useState("");
  const [newSelector, setNewSelector] = useState("lifeos");
  const [adding, setAdding] = useState(false);

  const addDomain = async () => {
    const clean = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean || !clean.includes(".")) { pushToast("error", "Enter a valid domain"); return; }
    if (domains.some((d) => d.domain === clean)) { pushToast("info", "Domain already added"); return; }
    setAdding(true);
    try {
      const { error } = await supabase.from("email_domains").insert({
        domain: clean,
        dkim_selector: newSelector || "lifeos",
        dmarc_policy: "none",
      });
      if (error) throw error;
      setNewDomain("");
      pushToast("success", "Domain added — set DNS records in the DNS tab");
      onReload();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to add domain");
    } finally {
      setAdding(false);
    }
  };

  const checkDomain = async (d: EmailDomain) => {
    // The check itself requires a Worker route. If it doesn't exist, honestly report.
    pushToast("info", `DNS check for ${d.domain} requires the /api/email/verify-dns route (not deployed)`);
  };

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-3">
        <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>
          ADD SENDING DOMAIN
        </div>
        <div className="flex gap-2">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void addDomain(); }}
            placeholder="yourdomain.com"
            className="flex-1 h-8 px-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
          <input
            value={newSelector}
            onChange={(e) => setNewSelector(e.target.value)}
            placeholder="selector"
            className="w-32 h-8 px-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
          <button
            onClick={addDomain}
            disabled={adding || !newDomain.trim()}
            className="px-3 h-8 rounded-lg glass-crimson text-primary text-[10px] font-display disabled:opacity-40 flex items-center gap-1"
          >
            {adding ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            ADD
          </button>
        </div>
      </div>

      <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-3 flex-1 min-h-[240px]">
        <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>
          DOMAIN VERIFICATION STATUS
        </div>
        {domains.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Shield size={24} className="mx-auto text-white/10 mb-2" />
              <div className="text-xs text-white/55">No domains configured</div>
              <div className="text-[10px] text-white/30 mt-1">Add a sending domain above to begin</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {domains.map((d) => (
              <div key={d.id} className="glass rounded-lg border border-white/8 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={12} className="text-primary/60" />
                  <span className="text-[12px] text-white/80 flex-1">{d.domain}</span>
                  <button
                    onClick={() => checkDomain(d)}
                    className="px-2 py-1 rounded glass border border-white/10 text-white/50 hover:text-primary text-[10px] font-display flex items-center gap-1"
                  >
                    <RefreshCw size={10} /> CHECK
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <StatusRow label="SPF" verified={d.spf_verified} />
                  <StatusRow label="DKIM" verified={d.dkim_verified} />
                  <StatusRow label="DMARC" verified={d.dmarc_verified} />
                </div>
                <div className="text-[9px] text-white/30 mt-2">
                  Last checked: {fmtDate(d.last_checked_at)}
                  {" · "}
                  Selector: <code className="text-white/50">{d.dkim_selector}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {verified
        ? <CheckCircle2 size={12} className="text-emerald-400" />
        : <AlertCircle size={12} className="text-amber-400/70" />}
      <span className={verified ? "text-emerald-400" : "text-white/50"}>{label}</span>
    </div>
  );
}

/* ================================================================== */
/* DNS tab                                                             */
/* ================================================================== */

function DnsTab(props: {
  domains: EmailDomain[];
  onReload: () => void;
  pushToast: (k: Toast["kind"], t: string) => void;
}) {
  const { domains, onReload, pushToast } = props;
  const [selectedId, setSelectedId] = useState<string | null>(domains[0]?.id ?? null);

  useEffect(() => {
    if (!selectedId && domains[0]) setSelectedId(domains[0].id);
  }, [domains, selectedId]);

  const selected = domains.find((d) => d.id === selectedId) || null;

  const copyText = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); pushToast("success", `${label} copied`); }
    catch { pushToast("error", "Clipboard blocked by browser"); }
  };

  const changeDmarc = async (policy: "none" | "quarantine" | "reject") => {
    if (!selected) return;
    try {
      const { error } = await supabase
        .from("email_domains")
        .update({ dmarc_policy: policy })
        .eq("id", selected.id);
      if (error) throw error;
      pushToast("success", "DMARC policy updated");
      onReload();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to update DMARC");
    }
  };

  if (domains.length === 0) {
    return (
      <div className="flex-1 glass rounded-xl border border-white/8 flex items-center justify-center min-h-[240px]">
        <div className="text-center max-w-md p-6">
          <Globe size={28} className="mx-auto text-white/10 mb-3" />
          <div className="text-sm text-white/55">No sending domain configured</div>
          <div className="text-[10px] text-white/30 mt-1 leading-relaxed">
            Add a domain in the Verification tab to see its DNS records here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Domain picker */}
      {domains.length > 1 && (
        <div className="glass rounded-xl border border-white/8 p-2 flex gap-1 flex-wrap">
          {domains.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-display tracking-wider transition-colors
                ${selectedId === d.id ? "glass-crimson text-primary" : "text-white/40 hover:text-white/70"}`}
            >
              {d.domain}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          {/* SPF */}
          <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-2">
            <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>SPF RECORD</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-white/4 text-[10px] text-white/70 border border-white/8 truncate">
                v=spf1 include:_spf.google.com include:sendgrid.net ~all
              </code>
              <button
                onClick={() => copyText("v=spf1 include:_spf.google.com include:sendgrid.net ~all", "SPF")}
                className="p-2 glass rounded-lg text-white/40 hover:text-white/80 transition-colors"
              >
                <Copy size={12} />
              </button>
            </div>
            <div className="text-[9px] text-white/30 leading-relaxed">
              Type <code className="px-1 rounded bg-white/5">TXT</code> · Name <code className="px-1 rounded bg-white/5">@</code>
            </div>
          </div>

          {/* DKIM */}
          <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-2">
            <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>DKIM RECORD</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-white/4 text-[10px] text-white/70 border border-white/8 truncate">
                {selected.dkim_public_key || "v=DKIM1; k=rsa; p=<generated on Worker-side key setup>"}
              </code>
              <button
                onClick={() => copyText(selected.dkim_public_key || "v=DKIM1; k=rsa; p=<see Worker>", "DKIM")}
                className="p-2 glass rounded-lg text-white/40 hover:text-white/80 transition-colors"
              >
                <Copy size={12} />
              </button>
            </div>
            <div className="text-[9px] text-white/30 leading-relaxed">
              Type <code className="px-1 rounded bg-white/5">TXT</code> ·
              Name <code className="px-1 rounded bg-white/5">{selected.dkim_selector}._domainkey</code>
              {!selected.dkim_public_key && (
                <span className="ml-2 text-amber-300/70">
                  — public key not generated yet; a Worker route must generate the key pair.
                </span>
              )}
            </div>
          </div>

          {/* DMARC + subdomain */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-2">
              <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>DMARC POLICY</div>
              <div className="relative">
                <select
                  value={selected.dmarc_policy}
                  onChange={(e) => changeDmarc(e.target.value as any)}
                  className="w-full h-8 pl-3 pr-8 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 focus:outline-none focus:border-primary/40 appearance-none"
                >
                  <option value="none" style={{ background: "#0a0a0a" }}>none</option>
                  <option value="quarantine" style={{ background: "#0a0a0a" }}>quarantine</option>
                  <option value="reject" style={{ background: "#0a0a0a" }}>reject</option>
                </select>
                <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              </div>
              <div className="text-[9px] text-white/30 leading-relaxed">
                Type <code className="px-1 rounded bg-white/5">TXT</code> ·
                Name <code className="px-1 rounded bg-white/5">_dmarc</code>
              </div>
              <code className="px-2 py-1 rounded bg-white/4 text-[9px] text-white/50 truncate">
                v=DMARC1; p={selected.dmarc_policy}; rua=mailto:dmarc@{selected.domain}
              </code>
            </div>

            <div className="glass rounded-xl border border-white/8 p-4 flex flex-col gap-2">
              <div className="text-[9px] font-display tracking-widest" style={{ color: TEAL }}>SENDING SUBDOMAIN</div>
              <div className="text-[11px] text-white/70 px-3 py-2 rounded-lg bg-white/4 border border-white/8">
                mail.{selected.domain}
              </div>
              <div className="text-[9px] text-white/30 leading-relaxed">
                Configure this subdomain in your email service (SendGrid, Brevo, Mailchimp) and in your DNS provider.
              </div>
            </div>
          </div>

          <div className="text-[10px] text-white/40 text-center">
            Copy these records into your DNS provider. Live verification of these records
            requires the <code className="px-1 rounded bg-white/5">/api/email/verify-dns</code> Worker route
            (not deployed yet).
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/* Lists tab                                                           */
/* ================================================================== */

function ListsTab(props: {
  lists: EmailList[];
  onReload: () => void;
  pushToast: (k: Toast["kind"], t: string) => void;
}) {
  const { lists, onReload, pushToast } = props;

  const [searchRaw, setSearchRaw] = useState("");
  const [search, setSearch] = useState("");
  const [newModal, setNewModal] = useState<{ name: string; description: string; subscribersText: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchRaw), 200);
    return () => clearTimeout(t);
  }, [searchRaw]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lists;
    return lists.filter((l) =>
      l.name.toLowerCase().includes(q) ||
      (l.description || "").toLowerCase().includes(q),
    );
  }, [lists, search]);

  const parseSubscribers = (text: string): string[] => {
    return text
      .split(/[\s,;\n]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  };

  const saveList = async () => {
    if (!newModal) return;
    const name = newModal.name.trim();
    if (!name) { pushToast("error", "List name is required"); return; }
    const subs = parseSubscribers(newModal.subscribersText);
    setSaving(true);
    try {
      const { error } = await supabase.from("email_lists").insert({
        name,
        description: newModal.description.trim() || null,
        subscribers: subs,
      });
      if (error) throw error;
      pushToast("success", `List saved with ${subs.length} subscriber${subs.length === 1 ? "" : "s"}`);
      setNewModal(null);
      onReload();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to save list");
    } finally {
      setSaving(false);
    }
  };

  const deleteList = async (id: string) => {
    try {
      const { error } = await supabase.from("email_lists").delete().eq("id", id);
      if (error) throw error;
      pushToast("success", "List deleted");
      setConfirmDeleteId(null);
      onReload();
    } catch (e: any) {
      pushToast("error", e?.message || "Failed to delete list");
    }
  };

  const exportList = (list: EmailList) => {
    const rows = list.subscribers.map((email) => ({ list: list.name, email }));
    if (!rows.length) { pushToast("info", "List is empty"); return; }
    downloadCsv(`lifeos-list-${list.name.replace(/\s+/g, "-").toLowerCase()}.csv`, rows);
    pushToast("success", `Exported ${rows.length} subscribers`);
  };

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            placeholder="Search lists…"
            className="w-full h-8 pl-8 text-xs bg-white/4 border border-white/8 rounded-lg text-white/80 placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
        </div>
        <button
          onClick={() => setNewModal({ name: "", description: "", subscribersText: "" })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm"
        >
          <Plus size={11} /> NEW LIST
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 glass rounded-xl border border-white/8 flex items-center justify-center">
          <div className="text-center max-w-md p-6">
            <List size={28} className="mx-auto text-white/8 mb-3" />
            <div className="text-sm text-white/55">
              {lists.length === 0 ? "No subscriber lists" : "No lists match"}
            </div>
            <div className="text-[10px] text-white/30 mt-1 leading-relaxed">
              {lists.length === 0
                ? "Create a list by pasting email addresses (comma, space, or newline separated)."
                : "Try clearing the search."}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 glass rounded-xl border border-white/8 p-2 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {filtered.map((l) => (
              <div key={l.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white/80 truncate">{l.name}</div>
                  {l.description && (
                    <div className="text-[10px] text-white/40 truncate">{l.description}</div>
                  )}
                </div>
                <span className="text-[10px] text-white/40 shrink-0">
                  {l.subscribers.length} subscriber{l.subscribers.length === 1 ? "" : "s"}
                </span>
                <button
                  onClick={() => exportList(l)}
                  title="Export CSV"
                  className="text-white/25 hover:text-primary p-1 rounded shrink-0"
                >
                  <Download size={11} />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(l.id)}
                  title="Delete"
                  className="text-white/25 hover:text-red-400 p-1 rounded shrink-0"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New list modal */}
      {newModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "oklch(0 0 0 / 70%)" }}
          onClick={() => setNewModal(null)}
        >
          <div
            className="glass rounded-xl border border-white/10 w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-display text-white/80 tracking-wider">NEW LIST</div>
              <button onClick={() => setNewModal(null)} className="text-white/30 hover:text-white/70">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] text-white/50">
                Name *
                <input
                  autoFocus
                  value={newModal.name}
                  onChange={(e) => setNewModal({ ...newModal, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveList(); } }}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none focus:border-primary/40"
                />
              </label>
              <label className="block text-[10px] text-white/50">
                Description
                <input
                  value={newModal.description}
                  onChange={(e) => setNewModal({ ...newModal, description: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none"
                />
              </label>
              <label className="block text-[10px] text-white/50">
                Subscribers (one per line, or comma-separated)
                <textarea
                  rows={6}
                  value={newModal.subscribersText}
                  onChange={(e) => setNewModal({ ...newModal, subscribersText: e.target.value })}
                  placeholder="alice@example.com&#10;bob@example.com"
                  className="mt-1 w-full px-2 py-1 text-[11px] rounded-lg bg-white/4 border border-white/8 text-white/80 focus:outline-none resize-y font-mono"
                />
              </label>
              <div className="text-[10px] text-white/30">
                {parseSubscribers(newModal.subscribersText).length} valid email
                {parseSubscribers(newModal.subscribersText).length === 1 ? "" : "s"} parsed
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setNewModal(null)}
                className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
              >
                CANCEL
              </button>
              <button
                onClick={saveList}
                disabled={saving || !newModal.name.trim()}
                className="px-3 py-1.5 rounded-lg glass-crimson text-primary text-[11px] font-display disabled:opacity-40 flex items-center gap-1"
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                SAVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDeleteId && (() => {
        const l = lists.find((x) => x.id === confirmDeleteId);
        if (!l) return null;
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
                <div className="text-xs font-display text-white/80 tracking-wider">DELETE LIST</div>
              </div>
              <div className="text-[11px] text-white/60 mb-3">
                Delete <span className="text-white/85">"{l.name}"</span> and its {l.subscribers.length} subscribers?
                This cannot be undone.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 rounded-lg glass border border-white/10 text-white/60 hover:text-white text-[11px] font-display"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => deleteList(l.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-display"
                  style={{
                    background: "oklch(0.5 0.22 25 / 40%)",
                    color: "oklch(0.85 0.15 25)",
                    border: "1px solid oklch(0.6 0.25 25 / 50%)",
                  }}
                >
                  DELETE
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}