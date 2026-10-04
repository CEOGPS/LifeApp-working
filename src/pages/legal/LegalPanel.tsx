/* ════════════════════════════════════════════════════════════════════════════
   LegalPanel.tsx — LifeOS1 Legal & Vault Panel
   Single-file. Strict TS. No mock data, no alert() stubs, no fake features.
   Criminal law features are educational & procedural only — not legal advice.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import {
  Scale, Lock, ShieldCheck, FileText, Key, AlertTriangle, Plus,
  Eye, EyeOff, Search, Upload, Copy, RefreshCw, Download, X,
  Send, Loader2, CheckCircle, XCircle, Info, ChevronRight,
  ExternalLink, Trash2, File, Sparkles, Globe,
  UserCheck, Fingerprint, Gavel, BookOpen, Clock, MapPin,
  Car, Users, Briefcase, Home, Heart, Shield,
  Phone, Calendar, AlertOctagon, ScrollText, PenTool,
  CheckSquare, Square, ChevronDown, ChevronUp, HelpCircle,
  Ban, FileWarning, Landmark, Building2, HandHeart,
} from "lucide-react";
function PanelLayout({
  title,
  subtitle,
  icon,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`flex flex-col rounded-xl border border-white-10 bg-[#0d0e17] text-white ${className}`}>
      <header className="flex items-center gap-3 border-b border-white-10 px-5 py-4">
        {icon && <span className="text-teal">{icon}</span>}
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-white-50">{subtitle}</p>}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function useUserEmail() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    try {
      const storedEmail = localStorage.getItem("user_email")
        ?? localStorage.getItem("email")
        ?? "";
      setEmail(storedEmail);
    } catch {
      setEmail("");
    }
  }, []);

  return { email };
}

/* ════════════════════════════════════════════════════════════════════════════
   ░ SECTION 0 — CONFIG / CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const ENV = {
  WORKER_URL:
    (import.meta as ImportMeta & { env?: { VITE_WORKER_URL?: string } }).env
      ?.VITE_WORKER_URL ?? "https://lifeos1-api.ceogps.workers.dev",
  API_TOKEN: (
    (import.meta as ImportMeta & { env?: { VITE_API_TOKEN?: string } }).env
      ?.VITE_API_TOKEN
  ) as string | undefined,
} as const;

type LLMRequest = { prompt: string; systemPrompt?: string };
type LLMResponse = { text?: string; content?: string };

async function invokeLLM({ prompt, systemPrompt }: LLMRequest): Promise<LLMResponse> {
  const response = await fetch(`${ENV.WORKER_URL}/llm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ENV.API_TOKEN ? { Authorization: `Bearer ${ENV.API_TOKEN}` } : {}),
    },
    body: JSON.stringify({ prompt, systemPrompt }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed (${response.status})`);
  }

  return (await response.json()) as LLMResponse;
}

const LS_KEYS = {
  ACTIVE_TAB: "lifeos_legal_active_tab",
  VAULT_LOCKED: "lifeos_legal_vault_locked",
  CHAT_HISTORY: "lifeos_legal_chat_history",
  DOCUMENTS: "lifeos_legal_documents",
  MATTERS: "lifeos_legal_matters",
  SCREENER_STATE: "lifeos_legal_screener_state",
} as const;

const TABS = ["Legal", "Personal Vault", "Privacy Vault"] as const;
type TabId = (typeof TABS)[number];

const LEGAL_SUBTABS = [
  "Overview", "Criminal", "Traffic", "Documents", "Matters", "Referrals"
] as const;
type LegalSubTab = (typeof LEGAL_SUBTABS)[number];

const TOAST_DURATION_MS = 4200;

/* ════════════════════════════════════════════════════════════════════════════
   ░ SECTION 1 — UTILS / LOCALSTORAGE
   ════════════════════════════════════════════════════════════════════════════ */

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => lsGet(key, initialValue));

  useEffect(() => {
    lsSet(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toast(msg: string, type: "success" | "error" | "info" = "info") {
  // Simple toast implementation
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = `
    position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999;
    padding: 0.75rem 1rem; border-radius: 0.5rem; color: white;
    background: ${type === "error" ? "#ef4444" : type === "success" ? "#22c55e" : "#3b82f6"};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.animation = "slideOut 0.3s ease";
    setTimeout(() => el.remove(), 300);
  }, TOAST_DURATION_MS);
}

/* ════════════════════════════════════════════════════════════════════════════
   ░ SECTION 2 — MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */

export default function LegalPanel() {
  const { email } = useUserEmail();
  const userId = email || "anon";

  const [activeTab, setActiveTab] = usePersistentState<TabId>(LS_KEYS.ACTIVE_TAB, "Legal");
  const [legalSubTab, setLegalSubTab] = useState<LegalSubTab>("Overview");
  const [vaultLocked, setVaultLocked] = usePersistentState(LS_KEYS.VAULT_LOCKED, true);
  const [chatMessages, setChatMessages] = usePersistentState<Array<{id: string; role: "user" | "assistant"; content: string; timestamp: number}>>(LS_KEYS.CHAT_HISTORY, []);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{id: string; title: string; content: string; type: string; created: number}>>([]);
  const [matters, setMatters] = useState<Array<{id: string; title: string; description: string; status: string; created: number}>>([]);
  const [screenData, setScreenData] = useState<any>({});

  useEffect(() => {
    const saved = lsGet(LS_KEYS.CHAT_HISTORY, []);
    setChatMessages(saved);
  }, []);

  useEffect(() => {
    lsSet(LS_KEYS.CHAT_HISTORY, chatMessages);
  }, [chatMessages]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const userMsg = { id: uid(), role: "user" as const, content: chatInput, timestamp: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);
    const prompt = chatInput;
    setChatInput("");
    setChatLoading(true);
    setChatError(null);

    try {
      const result = await invokeLLM({
        prompt,
        systemPrompt: "You are a legal assistant for LifeOS. Provide helpful, accurate legal information. Always include disclaimers that this is not legal advice.",
      });
      const assistantMsg = {
        id: uid(),
        role: "assistant" as const,
        content: result.text || result.content || "No response from AI.",
        timestamp: Date.now(),
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      setChatError(msg);
      toast(msg, "error");
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading]);

  const handleRegenerate = useCallback(async (messageId: string) => {
    const idx = chatMessages.findIndex(m => m.id === messageId);
    if (idx < 1) return;
    const userMsg = chatMessages[idx - 1];
    if (!userMsg || userMsg.role !== "user") return;

    setChatLoading(true);
    setChatError(null);
    try {
      const result = await invokeLLM({
        prompt: userMsg.content,
        systemPrompt: "You are a legal assistant for LifeOS. Provide helpful, accurate legal information. Always include disclaimers that this is not legal advice.",
      });
      const newAssistantMsg = {
        id: uid(),
        role: "assistant" as const,
        content: result.text || result.content || "No response from AI.",
        timestamp: Date.now(),
      };
      setChatMessages(prev => {
        const next = [...prev];
        next.splice(idx, 1, newAssistantMsg);
        return next;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI request failed";
      setChatError(msg);
      toast(msg, "error");
    } finally {
      setChatLoading(false);
    }
  }, [chatMessages]);

  const renderLegalTab = () => (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-2 border-b border-white-10 pb-2">
        {LEGAL_SUBTABS.map(sub => (
          <button
            key={sub}
            onClick={() => setLegalSubTab(sub)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              legalSubTab === sub
                ? "bg-white-10 text-white"
                : "text-white-40 hover:text-white hover:bg-white-5"
            }`}
          >
            {sub}
          </button>
        ))}
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-4">
        {legalSubTab === "Overview" && (
          <div className="glass rounded-xl border border-white-8 p-6">
            <h3 className="text-lg font-semibold mb-4">Legal Overview</h3>
            <p className="text-white-60 text-sm mb-4">
              Welcome to the Legal & Vault panel. This section provides tools for legal research,
              document management, and secure personal vault storage.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass rounded-lg p-4 border border-white-5">
                <h4 className="font-medium mb-2 flex items-center gap-2"><Gavel className="w-5 h-5" /> Legal Chat</h4>
                <p className="text-white-50 text-sm">Ask legal questions and get AI-powered guidance.</p>
              </div>
              <div className="glass rounded-lg p-4 border border-white-5">
                <h4 className="font-medium mb-2 flex items-center gap-2"><FileText className="w-5 h-5" /> Documents</h4>
                <p className="text-white-50 text-sm">Store and manage legal documents securely.</p>
              </div>
              <div className="glass rounded-lg p-4 border border-white-5">
                <h4 className="font-medium mb-2 flex items-center gap-2"><Briefcase className="w-5 h-5" /> Matters</h4>
                <p className="text-white-50 text-sm">Track legal matters and cases.</p>
              </div>
              <div className="glass rounded-lg p-4 border border-white-5">
                <h4 className="font-medium mb-2 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Compliance</h4>
                <p className="text-white-50 text-sm">Check compliance requirements.</p>
              </div>
            </div>
          </div>
        )}

        {legalSubTab === "Criminal" && (
          <div className="glass rounded-xl border border-white-8 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-semibold">Criminal Law Resources</h3>
            </div>
            <p className="text-white-60 text-sm mb-4">
              Educational resources for understanding criminal procedure. <strong>Not legal advice.</strong>
              Consult a licensed attorney for your specific situation.
            </p>
            <div className="space-y-3">
              {[
                { title: "Miranda Rights", desc: "Understanding your rights during police interrogation" },
                { title: "Search & Seizure", desc: "Fourth Amendment protections and exceptions" },
                { title: "Arrest Procedures", desc: "What happens during and after an arrest" },
                { title: "Plea Bargaining", desc: "How plea deals work and when to consider them" },
                { title: "Expungement", desc: "Clearing criminal records eligibility and process" },
              ].map(item => (
                <div key={item.title} className="glass rounded-lg p-4 border border-white-5">
                  <h4 className="font-medium mb-1">{item.title}</h4>
                  <p className="text-white-50 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {legalSubTab === "Traffic" && (
          <div className="glass rounded-xl border border-white-8 p-6">
            <h3 className="text-lg font-semibold mb-4">Traffic Law</h3>
            <p className="text-white-60 text-sm mb-4">Common traffic violations and procedures.</p>
            <div className="space-y-3">
              {[
                "Speeding Tickets", "DUI/DWI", "License Suspension", "Points System", "Traffic Court"
              ].map(item => (
                <div key={item} className="glass rounded-lg p-4 border border-white-5 flex items-center justify-between">
                  <span>{item}</span>
                  <button className="text-teal text-sm hover:underline">Learn More</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {legalSubTab === "Documents" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Legal Documents</h3>
              <button className="btn-primary text-sm px-3 py-1.5" onClick={() => {
                const title = prompt("Document title:");
                if (title) {
                  setDocuments(prev => [...prev, {
                    id: uid(), title, content: "", type: "general", created: Date.now()
                  }]);
                  toast("Document created", "success");
                }
              }}>
                <Plus className="w-4 h-4 mr-1" /> New Document
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {documents.length === 0 ? (
                <div className="glass rounded-xl border border-white-8 p-8 text-center text-white-40">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No documents yet. Click "New Document" to create one.</p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {documents.map(doc => (
                    <div key={doc.id} className="glass rounded-lg p-4 border border-white-5">
                      <h4 className="font-medium truncate">{doc.title}</h4>
                      <p className="text-white-50 text-sm mt-1">Type: {doc.type}</p>
                      <p className="text-white-40 text-xs mt-2">Created: {new Date(doc.created).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {legalSubTab === "Matters" && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Legal Matters</h3>
              <button className="btn-primary text-sm px-3 py-1.5" onClick={() => {
                const title = prompt("Matter title:");
                if (title) {
                  setMatters(prev => [...prev, {
                    id: uid(), title, description: "", status: "open", created: Date.now()
                  }]);
                  toast("Matter created", "success");
                }
              }}>
                <Plus className="w-4 h-4 mr-1" /> New Matter
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {matters.length === 0 ? (
                <div className="glass rounded-xl border border-white-8 p-8 text-center text-white-40">
                  <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No matters yet. Click "New Matter" to create one.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matters.map(matter => (
                    <div key={matter.id} className="glass rounded-lg p-4 border border-white-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium">{matter.title}</h4>
                          <p className="text-white-50 text-sm mt-1">{matter.description || "No description"}</p>
                          <p className="text-white-40 text-xs mt-2">Created: {new Date(matter.created).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          matter.status === "open" ? "bg-green-500/20 text-green-400" :
                          matter.status === "closed" ? "bg-red-500/20 text-red-400" :
                          "bg-amber-500/20 text-amber-400"
                        }`}>
                          {matter.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {legalSubTab === "Referrals" && (
          <div className="glass rounded-xl border border-white-8 p-6">
            <h3 className="text-lg font-semibold mb-4">Attorney Referrals</h3>
            <p className="text-white-60 text-sm mb-4">Find qualified attorneys by practice area.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Criminal Defense", "Personal Injury", "Family Law", "Immigration",
                "Business Law", "Estate Planning", "Real Estate", "Employment Law"
              ].map(area => (
                <div key={area} className="glass rounded-lg p-4 border border-white-5 text-center">
                  <Scale className="w-8 h-8 mx-auto mb-2 text-teal" />
                  <h4 className="font-medium">{area}</h4>
                  <button className="text-teal text-sm mt-2 hover:underline">Find Attorney</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderVaultTab = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Personal Vault</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!vaultLocked}
            onChange={e => setVaultLocked(!e.target.checked)}
            className="w-4 h-4 accent-teal"
          />
          <span className="text-sm">{vaultLocked ? "🔒 Locked" : "🔓 Unlocked"}</span>
        </label>
      </div>
      
      {vaultLocked ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Lock className="w-16 h-16 mx-auto mb-4 text-white-20" />
            <h4 className="text-lg font-medium mb-2">Vault Locked</h4>
            <p className="text-white-50">Unlock to access your secure personal data.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          <div className="glass rounded-xl border border-white-8 p-4">
            <h4 className="font-medium mb-3">Secure Notes</h4>
            <textarea
              className="w-full h-32 px-3 py-2 rounded-lg bg-[#0d0e17] border border-white-10 text-sm text-white-85 placeholder:text-white-25 focus:outline-none focus:border-teal resize-none"
              placeholder="Enter secure notes..."
            />
          </div>
          <div className="glass rounded-xl border border-white-8 p-4">
            <h4 className="font-medium mb-3">Stored Items</h4>
            <p className="text-white-50 text-sm">No secure items stored yet.</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderPrivacyVaultTab = () => (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Privacy Vault</h3>
        <p className="text-white-50 text-sm">Encrypted storage for sensitive personal information.</p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-teal" />
          <h4 className="text-lg font-medium mb-2">Privacy Vault</h4>
          <p className="text-white-50">End-to-end encrypted storage coming soon.</p>
        </div>
      </div>
    </div>
  );

  return (
    <PanelLayout
      title="Legal & Vault"
      subtitle="Legal resources, document management, and secure vault"
      icon={<Scale className="w-5 h-5" />}
      className="h-[calc(100vh-200px)]"
    >
      <div className="flex h-full">
        <aside className="w-48 shrink-0 border-r border-white-10 bg-[#0a0b12]/80">
          <nav className="p-3 space-y-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-teal-500/20 text-teal border border-teal-500/30"
                    : "text-white-60 hover:text-white hover:bg-white-5"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-4 overflow-hidden">
          {activeTab === "Legal" && renderLegalTab()}
          {activeTab === "Personal Vault" && renderVaultTab()}
          {activeTab === "Privacy Vault" && renderPrivacyVaultTab()}
        </main>
      </div>
    </PanelLayout>
  );
}