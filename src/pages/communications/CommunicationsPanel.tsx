// src/panels/CommunicationsPanel.tsx
// ═══════════════════════════════════════════════════════════════════════════
// COMMUNICATIONS PANEL — Single-file TSX bundle
// Unified inbox · Multi-platform · AI draft · CRM bridge · Contact intel
// ═══════════════════════════════════════════════════════════════════════════
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import { useMessaging } from "@/hooks/useMessaging";
import {
  MessageSquare, Search, Phone, Video, MoreVertical, Smile, Paperclip,
  Send, Bookmark, Trash2, Users, CreditCard, Loader2, X, AlertCircle,
  Check, Sparkles, RefreshCw, Mail, ExternalLink, Copy, Star, Download,
  Plus, Inbox, Filter, Lock, Wand2,
} from "lucide-react";

async function invokeLLM({ prompt }: { prompt: string }): Promise<{ text?: string; content?: string }> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);
  const result = await response.json() as { text?: string; content?: string; response?: string };
  return { text: result.text ?? result.response, content: result.content };
}

// Keep this panel self-contained when the optional shared user hook is not
// available in the current build.
function PanelLayout({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="h-full flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-1 pb-3 shrink-0">
        {icon && <span className="text-teal-400">{icon}</span>}
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
        </div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ OPTIONAL IMPORTS — degrade gracefully if not present ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

interface MessagingState {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  loading: boolean;
  sendMessage: (convId: string, platform: string, text: string) => Promise<void>;
  fetchConversationMessages: (convId: string) => Promise<void> | void;
  syncPlatform?: (platform: string) => Promise<void>;
}

// Electron browser-view bridge — no-op on web
const electron: {
  isElectron: boolean;
  openPlatform?: (id: string, accountIndex: number, bounds: DOMRect) => Promise<void>;
  hidePlatform?: () => void;
  resizePlatform?: (id: string, accountIndex: number, bounds: DOMRect) => void;
  navigatePlatform?: (id: string, accountIndex: number, action: "back" | "forward" | "reload" | "home") => void;
  clearPlatformSession?: (id: string, accountIndex: number) => void;
  getCredentials?: (id: string, accountIndex: number) => Promise<{ username?: string; hasSavedPassword?: boolean } | null>;
  saveCredentials?: (id: string, accountIndex: number, username: string, password: string) => Promise<void>;
  deleteCredentials?: (id: string, accountIndex: number) => Promise<void>;
  triggerAutofill?: (id: string, accountIndex: number) => Promise<{ ok: boolean; error?: string }>;
} = typeof window !== "undefined" && (window as unknown as { electronAPI?: unknown }).electronAPI
  ? {
      isElectron: true,
      ...((window as unknown as { electronAPI: Record<string, unknown> }).electronAPI as Record<string, unknown>),
    } as never
  : { isElectron: false };

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ TYPES ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

type PlatformId =
  | "sms" | "messenger" | "instagram" | "tiktok" | "telegram"
  | "signal" | "whatsapp" | "snapchat" | "google-voice" | "email";
interface Platform {
  id: PlatformId;
  icon: string;
  label: string;
  color: string;
  webUrl?: string;
  noWeb?: boolean;
}

interface Conversation {
  id: string;
  contact_name: string;
  contact_initials?: string;
  contact_email?: string;
  contact_phone?: string;
  is_group?: boolean;
  platforms?: string[];
  unread_count?: number;
  lastMessage?: string;
  lastTime?: number;
}

interface ChatMessage {
  id?: string;
  sender_type: "me" | "them";
  content: string;
  time?: string;
  date?: string;
  platform?: string;
}

interface Toast { id: string; message: string; kind: "info" | "success" | "error" }

interface CRMContact {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  birthday?: string;
  tag?: string;
  stage?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ CONSTANTS ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

const PLATFORMS: Platform[] = [
  { id: "sms",          icon: "📱", label: "SMS",         color: "#00c896" },
  { id: "google-voice", icon: "📞", label: "Google Voice",color: "#4285f4", webUrl: "https://voice.google.com/u/0/messages" },
  { id: "messenger",    icon: "💬", label: "Messenger",   color: "#0084ff", webUrl: "https://www.messenger.com" },
  { id: "instagram",    icon: "📷", label: "Instagram",   color: "#e1306c", webUrl: "https://www.instagram.com/direct/inbox/" },
  { id: "tiktok",       icon: "🎬", label: "TikTok",      color: "#69c9d0", webUrl: "https://www.tiktok.com/messages" },
  { id: "telegram",     icon: "✈️", label: "Telegram",    color: "#2ca5e0", webUrl: "https://web.telegram.org/k/" },
  { id: "signal",       icon: "🔐", label: "Signal",      color: "#3a76f0", noWeb: true },
  { id: "whatsapp",     icon: "💚", label: "WhatsApp",    color: "#25d366", webUrl: "https://web.whatsapp.com" },
  { id: "snapchat",     icon: "👻", label: "Snapchat",    color: "#fffc00", webUrl: "https://web.snapchat.com" },
  { id: "email",        icon: "✉️", label: "Email",       color: "#4ab3f4" },
];

const CHANNEL_LIST = PLATFORMS.map((p) => ({
  id: p.id,
  name: p.label,
  icon: p.icon,
  color: p.color,
}));

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ STORAGE ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

// Using usePersistentState for UI states, but keeping these helpers for
// buildFallbackConversations which runs outside the React render loop.
const ls = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  set<T>(key: string, value: T): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ TOASTS ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

const toastListeners = new Set<(t: Toast) => void>();
let toastSeq = 0;
function toast(message: string, kind: Toast["kind"] = "info"): void {
  const t: Toast = { id: `t${++toastSeq}`, message, kind };
  toastListeners.forEach((l) => l(t));
}
function useToasts() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const push = (t: Toast) => {
      setItems((p) => [...p, t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 4200);
    };
    toastListeners.add(push);
    return () => { toastListeners.delete(push); };
  }, []);
  const dismiss = useCallback((id: string) => setItems((p) => p.filter((x) => x.id !== id)), []);
  return { items, dismiss };
}

function Toasts() {
  const { items, dismiss } = useToasts();
  if (!items.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 max-w-sm pointer-events-none">
      {items.map((t) => (
        <div key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg text-xs backdrop-blur-xl border
            ${t.kind === "success" ? "border-teal-400/40 text-teal-300 bg-black/85" :
              t.kind === "error" ? "border-red-400/50 text-red-300 bg-black/85" :
              "border-white/15 text-white-80 bg-black/85"}`}>
          {t.kind === "success" && <Check size={12} />}
          {t.kind === "error" && <AlertCircle size={12} />}
          {t.kind === "info" && <Sparkles size={12} />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100"><X size={10} /></button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ HELPERS ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

function initialsFor(name: string): string {
  return (name || "?").split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

function relTime(ms?: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function platformFor(id: string | undefined): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

/* ── CRM lookup by name/email/phone ── */

function findCrmMatch(conversation: Conversation): CRMContact | null {
  try {
    const crm = ls.get<CRMContact[]>("lifeos_crm", []);
    const name = conversation.contact_name?.toLowerCase() ?? "";
    const email = conversation.contact_email?.toLowerCase() ?? "";
    const phone = (conversation.contact_phone ?? "").replace(/\D/g, "");
    return crm.find((c) => {
      if (email && c.email?.toLowerCase() === email) return true;
      if (phone && c.phone?.replace(/\D/g, "") === phone) return true;
      if (name && c.name?.toLowerCase() === name) return true;
      return false;
    }) ?? null;
  } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ MAIN PANEL ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CommunicationsPanel() {
  const hookState = useMessaging();

  const [localMessages, setLocalMessages] = useState<Record<string, ChatMessage[]>>({});

  const conversations: Conversation[] = hookState.conversations;

  const messages: Record<string, ChatMessage[]> = useMemo(() => {
    return { ...(hookState?.messages ?? {}), ...localMessages };
  }, [hookState?.messages, localMessages]);

  const usingHook = !!hookState;

  /* Selection + filters */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<PlatformId | "all">("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  /* Compose */
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendPlatform, setSendPlatform] = useState<PlatformId | "auto">("auto");
  const fileAttachRef = useRef<HTMLInputElement | null>(null);

  /* AI */
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiSummarizing, setAiSummarizing] = useState(false);

  /* Sync */
  const [syncing, setSyncing] = useState<string | null>(null);

  /* Right panel */
  const [showContactPanel, setShowContactPanel] = useState(true);

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activeMessages = active ? (messages[active.id] ?? []) : [];
  const crmMatch = active ? findCrmMatch(active) : null;
  const primaryPlatform = (active?.platforms?.[0] as PlatformId | undefined) ?? "email";

  /* Auto-select first conversation */
  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  /* Fetch messages on selection */
  useEffect(() => {
    if (activeId && hookState?.fetchConversationMessages) {
      try { void hookState.fetchConversationMessages(activeId); } catch { /* ignore */ }
    }
  }, [activeId, hookState]);

  /* Filtered conversations */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (showUnreadOnly && !(c.unread_count && c.unread_count > 0)) return false;
      if (filterPlatform !== "all" && !(c.platforms ?? []).includes(filterPlatform)) return false;
      if (!q) return true;
      return (c.contact_name ?? "").toLowerCase().includes(q)
        || (c.lastMessage ?? "").toLowerCase().includes(q);
    });
  }, [conversations, search, filterPlatform, showUnreadOnly]);

  /* Send */
  const send = useCallback(async () => {
    if (!input.trim() || !active || sending) return;
    const platform: PlatformId = sendPlatform === "auto" ? primaryPlatform : sendPlatform;
    setSending(true);

    try {
      if (hookState?.sendMessage) {
        await hookState.sendMessage(active.id, platform, input.trim());
      } else {
      setLocalMessages((prev) => {
        const list = prev[active.id] ?? [];
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          sender_type: "me",
          content: input.trim(),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          date: new Date().toISOString(),
          platform,
        };
        return { ...prev, [active.id]: [...list, msg] };
      });
      }
      setInput("");
      toast("Message sent.", "success");
    } catch (e) {
      toast(`Send failed: ${(e as Error).message}`, "error");
    } finally {
      setSending(false);
    }
  }, [input, active, sending, sendPlatform, primaryPlatform, hookState]);

  /* AI draft */
  const draftAIReply = useCallback(async () => {
    if (!active || aiDrafting) return;
    setAiDrafting(true);
    try {
      const history = activeMessages.slice(-6).map((m) =>
        `${m.sender_type === "me" ? "Me" : active.contact_name}: ${m.content}`
      ).join("\n") || "(no history yet)";
      const platformLabel = platformFor(primaryPlatform)?.label ?? "message";

      const res = await invokeLLM({
        prompt: `Draft a short, professional ${platformLabel} reply to ${active.contact_name}.
Recent conversation:
${history}

Reply only — no greeting line labels, no markdown. Under 60 words.`,
      });
      const text = res.text || res.content || "";
      setInput(text.trim());
      toast("AI draft ready.", "success");
    } catch (e) {
      toast(`AI draft failed: ${(e as Error).message}`, "error");
    } finally {
      setAiDrafting(false);
    }
  }, [active, activeMessages, primaryPlatform, aiDrafting]);

  /* AI summarize */
  const summarizeThread = useCallback(async () => {
    if (!active || !activeMessages.length || aiSummarizing) return;
    setAiSummarizing(true);
    try {
      const history = activeMessages.map((m) =>
        `${m.sender_type === "me" ? "Me" : active.contact_name}: ${m.content}`
      ).join("\n");
      const res = await invokeLLM({
        prompt: `Summarize this conversation in 2-3 sentences. Then list 2 concrete next actions.
LConversation with ${active.contact_name}:
${history}`,
      });
      setAiSummary(res.text || res.content || "");
    } catch (e) {
      toast(`Summarize failed: ${(e as Error).message}`, "error");
    } finally {
      setAiSummarizing(false);
    }
  }, [active, activeMessages, aiSummarizing]);

  /* Sync a platform */
  const syncOne = useCallback(async (platform: string) => {
    if (!hookState?.syncPlatform) {
      toast(`Sync not available — ${platform} isn't connected.`, "error");
      return;
    }
    setSyncing(platform);
    try {
      await hookState.syncPlatform(platform);
      toast(`Synced ${platform}.`, "success");
    } catch (e) {
      toast(`Sync failed: ${(e as Error).message}`, "error");
    } finally { setSyncing(null); }
  }, [hookState]);

  /* Contact intel */
  const saveToCrm = useCallback(() => {
    if (!active) return;
    try {
      const crm = ls.get<CRMContact[]>("lifeos_crm", []);
      const match = findCrmMatch(active);
      if (match) { toast("Already in CRM.", "info"); return; }
      const contact: CRMContact = {
        id: `local_${Date.now()}`,
        name: active.contact_name,
        email: active.contact_email,
        phone: active.contact_phone,
        tag: "New",
        stage: "Lead",
      };
      ls.set("lifeos_crm", [contact, ...crm]);
      toast(`${active.contact_name} added to CRM.`, "success");
    } catch (e) {
      toast(`Save to CRM failed: ${(e as Error).message}`, "error");
    }
  }, [active]);

  const openPlatformInTab = useCallback((platformId: PlatformId) => {
    const p = platformFor(platformId);
    if (!p) { toast("Unknown platform.", "error"); return; }
    if (p.noWeb || !p.webUrl) {
      toast(`${p.label} has no web interface.`, "info");
      return;
    }
    window.open(p.webUrl, "_blank", "noopener");
  }, []);

  /* Export */
  const exportHistory = useCallback(() => {
    const rows: string[][] = [["conversation", "sender", "timestamp", "content", "platform"]];
    for (const c of conversations) {
      for (const m of messages[c.id] ?? []) {
        rows.push([
          c.contact_name,
          m.sender_type === "me" ? "Me" : c.contact_name,
          m.date ?? "",
          m.content.replace(/[\r\n]+/g, " "),
          m.platform ?? "",
        ]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `messages-${Date.now()}.csv`;
    a.click();
    toast(`Exported ${rows.length - 1} messages.`, "success");
  }, [conversations, messages]);

  return (
    <PanelLayout
      title="Messages"
      subtitle="Text and calls"
      icon={<MessageSquare size={18} />}
    >
      <Toasts />
      <div className="h-full flex gap-3 overflow-hidden">
        {/* ══════════ LEFT RAIL — Channels + Accounts ══════════ */}
        <aside className="w-52 shrink-0 flex flex-col gap-2.5">
          <div className="glass rounded-xl border border-white/8 p-3 flex-1 flex flex-col overflow-hidden">
            <div className="text-[9px] font-display tracking-widest text-teal-400 mb-2 px-1">CHANNELS</div>
            <div className="flex-1 overflow-y-auto space-y-0.5">
              <button
                onClick={() => setFilterPlatform("all")}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left
                  ${filterPlatform === "all" ? "bg-[#4ab3f4]/15 text-[#4ab3f4]" : "text-white-55 hover:bg-white/5"}`}
              >
                <Inbox size={11} />
                <span className="text-[11px] flex-1">All Channels</span>
                <span className="text-[9px] opacity-60">{conversations.length}</span>
              </button>
              {CHANNEL_LIST.map((c) => {
                const count = conversations.filter((x) => (x.platforms ?? []).includes(c.id)).length;
                const on = filterPlatform === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setFilterPlatform(c.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left
                      ${on ? "bg-white/8" : "hover:bg-white/5"}`}
                  >
                    <span className="text-sm">{c.icon}</span>
                    <span className="text-[11px] flex-1" style={{ color: on ? c.color : "rgba(255,255,255,0.5)" }}>
                      {c.name}
                    </span>
                    {count > 0 && <span className="text-[9px] text-white-40">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/5 pt-2 mt-2 flex flex-col gap-1">
              <button
                onClick={() => setShowUnreadOnly((v) => !v)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-display tracking-wider
                  ${showUnreadOnly ? "text-[#ff4f5e] bg-[#ff4f5e]/10" : "text-white-40 hover:text-white-70"}`}
              >
                <Filter size={10} /> {showUnreadOnly ? "SHOWING UNREAD" : "UNREAD ONLY"}
              </button>
              <button
                onClick={exportHistory}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-white-40 hover:text-white-70 font-display tracking-wider"
              >
                <Download size={10} /> EXPORT CSV
              </button>
              {(["telegram", "messenger", "instagram", "google-voice"] as PlatformId[]).map((p) => {
                const pf = platformFor(p);
                if (!pf) return null;
                return (
                  <button
                    key={p}
                    onClick={() => syncOne(p)}
                    disabled={syncing === p}
                    className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-[#8b7fff] hover:bg-[#8b7fff]/10 disabled:opacity-50 transition-colors"
                    title={`Sync ${pf.label}`}
                  >
                    {syncing === p ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                    Sync {pf.label}
                  </button>
                );
              })}
              <button
                onClick={() => openPlatformInTab(primaryPlatform)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] text-white-40 hover:text-white-70 transition-colors"
              >
                <ExternalLink size={10} /> Open in browser
              </button>
            </div>
          </div>

          {!usingHook && (
            <div className="glass rounded-xl border border-orange-500/30 bg-orange-500/5 p-2.5 text-[10px] text-orange-300 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <AlertCircle size={10} /> Limited mode
              </div>
              Text and calls stay in this panel. CRM contacts stay on the CRM page.
            </div>
          )}
        </aside>

        {/* ══════════ MIDDLE — Conversation list ══════════ */}
        <section className="w-72 shrink-0 flex flex-col gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white-30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full h-8 pl-8 pr-3 text-xs bg-white/4 border border-white/8 rounded-lg text-white-80 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/40"
            />
          </div>
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void hookState.startChat(newName, "sms").then((id) => {
                if (id) setActiveId(id);
                setNewName("");
              });
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New text or call"
              className="h-8 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
            />
            <button type="submit" className="h-8 rounded-lg bg-sky-400/80 px-2 text-[11px] text-black">Start</button>
          </form>

          <div className="flex-1 glass rounded-xl border border-white/8 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="text-center">
                  <MessageSquare size={22} className="mx-auto text-white-15 mb-2" />
                  <div className="text-xs text-white-55">
                    {conversations.length === 0 ? "No texts or calls yet" : "No matches"}
                  </div>
                  <div className="text-[10px] text-white-25 mt-1">
                    {conversations.length === 0 ? "Connect a channel or send your first message" : "Try clearing filters"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {filtered.map((conv) => {
                  const selected = activeId === conv.id;
                  const pf = platformFor(conv.platforms?.[0]);
                  const unread = conv.unread_count && conv.unread_count > 0;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveId(conv.id)}
                      className={`w-full text-left p-2.5 rounded-lg transition-colors
                        ${selected ? "glass-crimson border-[#ff4f5e]/30" : "hover:bg-white/5 border border-transparent"}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-black"
                          style={{ background: `linear-gradient(135deg,${pf?.color ?? "#4ab3f4"},#ff8c42)` }}
                        >
                          {conv.contact_initials || initialsFor(conv.contact_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-white-90 font-medium truncate flex-1">
                              {conv.contact_name}
                            </span>
                            {conv.lastTime ? (
                              <span className="text-[9px] text-white-30 shrink-0">{relTime(conv.lastTime)}</span>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-white-40 truncate mt-0.5">
                            {conv.lastMessage || "No messages yet"}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {(conv.platforms ?? []).slice(0, 4).map((pid) => {
                              const p = platformFor(pid);
                              if (!p) return null;
                              return (
                                <span key={pid} className="text-[10px]" style={{ color: p.color }} title={p.label}>
                                  {p.icon}
                                </span>
                              );
                            })}
                            {unread && (
                              <span className="ml-auto w-4 h-4 rounded-full bg-[#4ab3f4] text-[#0d0e17] text-[9px] flex items-center justify-center font-bold">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ══════════ RIGHT — Chat window ══════════ */}
        <section className="flex-1 flex gap-3 min-w-0">
          <div className="flex-1 flex flex-col glass rounded-xl border border-white/8 overflow-hidden min-w-0">
            {active ? (
              <>
                {/* Header */}
                <header className="p-3 border-b border-white/5 flex items-center gap-2.5 shrink-0">
                  <div
                    className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold text-black"
                    style={{ background: `linear-gradient(135deg,${platformFor(primaryPlatform)?.color ?? "#4ab3f4"},#ff8c42)` }}
                  >
                    {active.contact_initials || initialsFor(active.contact_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white-90 font-semibold truncate flex items-center gap-1.5">
                      {active.contact_name}
                      {active.is_group && <span className="text-[9px] text-[#6aaedd]">👥 group</span>}
                    </div>
                    <div className="text-[10px] text-white-40 flex items-center gap-1.5">
                      {(active.platforms ?? []).length === 0 ? (
                        <span>No channel connected</span>
                      ) : (
                        (active.platforms ?? []).map((pid) => {
                          const p = platformFor(pid);
                          if (!p) return null;
                          return <span key={pid} style={{ color: p.color }}>{p.icon} {p.label}</span>;
                        })
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        const phone = (active.contact_phone ?? "").trim();
                        if (phone) window.open(`tel:${phone.replace(/[^\d+]/g, "")}`);
                        void hookState.sendMessage(
                          active.id,
                          "call",
                          phone ? `Voice call · ${phone}` : "Voice call",
                        );
                      }}
                      className="p-1.5 text-white-30 hover:text-white-70 transition-colors"
                      title={active.contact_phone ? `Call ${active.contact_phone}` : "Log a voice call"}
                    >
                      <Phone size={13} />
                    </button>
                    <button
                      onClick={() => toast("Video call — not connected in web mode.", "info")}
                      className="p-1.5 text-white-30 hover:text-white-70 transition-colors"
                      title="Video call"
                    >
                      <Video size={13} />
                    </button>
                    <button
                      onClick={() => setShowContactPanel((v) => !v)}
                      className={`p-1.5 transition-colors ${showContactPanel ? "text-[#4ab3f4]" : "text-white-30 hover:text-white-70"}`}
                      title="Toggle contact panel"
                    >
                      <CreditCard size={13} />
                    </button>
                    <button
                      onClick={() => toast("More options coming soon.", "info")}
                      className="p-1.5 text-white-30 hover:text-white-70 transition-colors"
                      title="More"
                    >
                      <MoreVertical size={13} />
                    </button>
                  </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {activeMessages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <MessageSquare size={26} className="text-white-10 mb-2" />
                      <div className="text-xs text-white-40">No messages yet</div>
                      <div className="text-[10px] text-white-25 mt-1">Send the first message below</div>
                    </div>
                  ) : (
                    activeMessages.map((m, i) => (
                      m.platform === "call" ? (
                        <div key={m.id ?? i} className="flex justify-center">
                          <div className="rounded-full border border-sky-300/30 bg-black/50 px-3 py-1 text-[11px] text-sky-100">
                            {m.content}{m.time ? ` · ${m.time}` : ""}
                          </div>
                        </div>
                      ) : (
                      <div key={m.id ?? i} className={`flex ${m.sender_type === "me" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-xs leading-relaxed
                          ${m.sender_type === "me" ? "glass-crimson text-white-85" : "glass text-white-75"}`}>
                          {m.content}
                          {m.time && (
                            <div className="text-[9px] text-white-30 mt-0.5 text-right">{m.time}</div>
                          )}
                        </div>
                      </div>
                      )
                    ))
                  )}

                  {aiSummary && (
                    <div className="glass rounded-lg border border-[#8b7fff]/30 p-3 mt-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={10} className="text-[#8b7fff]" />
                        <span className="text-[9px] font-display tracking-wider text-[#8b7fff]">AI SUMMARY</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(aiSummary); toast("Copied.", "success"); }}
                          className="ml-auto p-0.5 text-white-30 hover:text-white-70"
                          title="Copy"
                        >
                          <Copy size={10} />
                        </button>
                        <button
                          onClick={() => setAiSummary("")}
                          className="p-0.5 text-white-30 hover:text-white-70"
                          title="Close"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <div className="text-[11px] text-white-75 whitespace-pre-wrap leading-relaxed">{aiSummary}</div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-3 border-t border-white/5 shrink-0">
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    <select
                      value={sendPlatform}
                      onChange={(e) => setSendPlatform(e.target.value as PlatformId | "auto")}
                      className="px-2 py-1 rounded text-[10px] bg-[#0d0e17] border border-white/10 text-white-60 focus:outline-none"
                    >
                      <option value="auto">Auto ({platformFor(primaryPlatform)?.label ?? "—"})</option>
                      {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <button
                      onClick={draftAIReply}
                      disabled={aiDrafting || !activeMessages.length}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[#8b7fff]/12 border border-[#8b7fff]/30 text-[#8b7fff] hover:bg-[#8b7fff]/20 disabled:opacity-50 transition-colors"
                    >
                      {aiDrafting ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                      AI Reply
                    </button>
                    <button
                      onClick={summarizeThread}
                      disabled={aiSummarizing || !activeMessages.length}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[#00c896]/12 border border-[#00c896]/30 text-[#00c896] hover:bg-[#00c896]/20 disabled:opacity-50 transition-colors"
                    >
                      {aiSummarizing ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      Summarize
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileAttachRef.current?.click()}
                      className="p-1.5 text-white-30 hover:text-white-70 transition-colors"
                      title="Attach file"
                    >
                      <Paperclip size={14} />
                    </button>
                    <input
                      ref={fileAttachRef}
                      type="file"
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const count = e.target.files?.length ?? 0;
                        if (count) toast(`${count} file${count === 1 ? "" : "s"} selected (attachment send not wired).`, "info");
                      }}
                    />
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
                      }}
                      placeholder={`Message via ${platformFor(sendPlatform === "auto" ? primaryPlatform : sendPlatform)?.label ?? "…"}`}
                      className="flex-1 h-9 px-3 text-xs bg-white/4 border border-white/6 rounded-full text-white-85 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/40"
                    />
                    <button
                      onClick={() => toast("Emoji picker coming soon.", "info")}
                      className="p-1.5 text-white-30 hover:text-white-70 transition-colors"
                      title="Emoji"
                    >
                      <Smile size={14} />
                    </button>
                    <button
                      onClick={send}
                      disabled={sending || !input.trim()}
                      className="w-9 h-9 rounded-full glass-crimson flex items-center justify-center text-[#ff4f5e] hover:glow-crimson-sm transition-all disabled:opacity-50"
                      title="Send"
                    >
                      {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={13} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare size={32} className="mx-auto text-white-10 mb-3" />
                  <div className="text-sm text-white-55 mb-1">No conversation selected</div>
                  <div className="text-[11px] text-white-25">
                    Pick someone from the list or connect a channel on the left
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ══════════ CONTACT INTEL PANEL ══════════ */}
          {active && showContactPanel && (
            <aside className="w-64 shrink-0 glass rounded-xl border border-white/8 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center gap-2.5 mb-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-black shrink-0"
                    style={{ background: `linear-gradient(135deg,${platformFor(primaryPlatform)?.color ?? "#4ab3f4"},#ff8c42)` }}
                  >
                    {active.contact_initials || initialsFor(active.contact_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white-95 font-semibold truncate">{active.contact_name}</div>
                    {crmMatch?.company && (
                      <div className="text-[10px] text-white-40 truncate">{crmMatch.company}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  {active.contact_email && (
                    <a
                      href={`mailto:${active.contact_email}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-[#4ab3f4] no-underline hover:bg-white/[0.06] transition-colors"
                    >
                      <Mail size={11} /> <span className="truncate">{active.contact_email}</span>
                    </a>
                  )}
                  {active.contact_phone && (
                    <a
                      href={`tel:${active.contact_phone.replace(/\D/g, "")}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-[#00c896] no-underline hover:bg-white/[0.06] transition-colors"
                    >
                      <Phone size={11} /> {active.contact_phone}
                    </a>
                  )}
                </div>

                {crmMatch ? (
                  <div className="space-y-2.5">
                    <div className="text-[9px] font-display tracking-widest text-teal-400">CRM RECORD</div>
                    {[
                      ["Tag", crmMatch.tag],
                      ["Stage", crmMatch.stage],
                      ["Company", crmMatch.company],
                      ["Birthday", crmMatch.birthday],
                    ].filter(([, v]) => v).map(([l, v]) => (
                      <div key={l} className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-[10px] text-white-40">{l}</span>
                        <span className="text-[11px] text-white-75">{v}</span>
                      </div>
                    ))}
                    {crmMatch.notes && (
                      <div className="mt-2">
                        <div className="text-[9px] font-display tracking-widest text-teal-400 mb-1">NOTES</div>
                        <div className="text-[11px] text-white-70 leading-relaxed">{crmMatch.notes}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="text-[9px] font-display tracking-widest text-teal-400">NOT IN CRM</div>
                    <div className="text-[11px] text-white-40 leading-relaxed">
                      Add this contact to your CRM to track deals, notes, and history.
                    </div>
                    <button
                      onClick={saveToCrm}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#4ab3f4]/12 border border-[#4ab3f4]/40 text-[#4ab3f4] text-[11px] font-bold hover:bg-[#4ab3f4]/20 transition-colors"
                    >
                      <Plus size={11} /> Add to CRM
                    </button>
                  </div>
                )}

                <div className="mt-5 space-y-2.5">
                  <div className="text-[9px] font-display tracking-widest text-teal-400">QUICK ACTIONS</div>
                  <button
                    onClick={() => toast("Marked as unread.", "success")}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white-60 hover:bg-white/[0.06] transition-colors"
                  >
                    <Bookmark size={11} /> Mark unread
                  </button>
                  <button
                    onClick={() => {
                      if (!active) return;
                      setActiveId(null);
                      toast("Conversation archived locally.", "success");
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-[11px] text-white-60 hover:bg-white/[0.06] transition-colors"
                  >
                    <Star size={11} /> Archive
                  </button>
                  <button
                    onClick={() => toast("Delete requires confirmation in a future build.", "info")}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20 text-[11px] text-red-300 hover:bg-red-500/15 transition-colors"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>

                <div className="mt-5 space-y-2.5">
                  <div className="text-[9px] font-display tracking-widest text-teal-400">CHANNELS</div>
                  {PLATFORMS.map((p) => {
                    const connected = (active.platforms ?? []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => openPlatformInTab(p.id)}
                        disabled={!p.webUrl}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors
                          ${connected
                            ? "border-white/12 bg-white/[0.04] text-white-80"
                            : "border-white/6 bg-transparent text-white-30"}
                          ${p.webUrl ? "hover:bg-white/[0.06] cursor-pointer" : "cursor-not-allowed"}`}
                      >
                        <span>{p.icon}</span>
                        <span className="flex-1 text-left">{p.label}</span>
                        {connected ? (
                          <Check size={10} className="text-teal-400" />
                        ) : p.webUrl ? (
                          <ExternalLink size={10} className="opacity-50" />
                        ) : (
                          <Lock size={10} className="opacity-30" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}
        </section>
      </div>
    </PanelLayout>
  );
}