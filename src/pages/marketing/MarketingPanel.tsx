// src/panels/MarketingPanel.tsx
// ═══════════════════════════════════════════════════════════════════════════
// MARKETING PANEL — Single-file bundle
// SEO · CONTENT · LEAD GEN · KEYWORDS · LISTINGS · CAMPAIGNS · CRM · PEOPLE
// ═══════════════════════════════════════════════════════════════════════════
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  Globe2, Search, MapPin, TrendingUp, Loader2, ExternalLink, Zap, Sparkles,
  Copy, Check, Download, Flame, Clock, X, AlertCircle, Bookmark, BookmarkCheck,
  Trash2, Target, DollarSign, MessageSquare, Filter, Star, Plus, Upload, Mail,
  Phone, Save, ChevronDown, ChevronRight, RefreshCw, Shield, BarChart3,
  Wrench, PenSquare, Send, Reply, Inbox, Paperclip, Lock, Rocket, Award,
  Building2, FileText, Tag as TagIcon, Hash, Palette, Layers, TrendingDown,
  Gauge, Users, Calendar, Gift, ArrowRight, CircleDot,
} from "lucide-react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { lifeosApi } from "@/lib/api";
import { invokeLLM } from "@/lib/ai.js";
import { dbFetch } from "@/lib/supabase";
import { useUserEmail } from "@/hooks/useUserEmail";

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 0 — SHARED PRIMITIVES ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Config ── */

const ENV = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
const API_WORKER = ENV.VITE_WORKER_URL ?? "https://api.lifeos1.ceogps.com";
const API_TOKEN = ENV.VITE_API_TOKEN ?? "";
const RESEND_KEY = ENV.VITE_RESEND_KEY ?? "";
const SENDGRID_KEY = ENV.VITE_SENDGRID_KEY ?? "";

/* ── UI Primitives ── */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-xl border border-white/8 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="text-[13px] font-bold text-white-95">{title}</div>
      {hint && <div className="text-[11px] text-[#6aaedd] mt-0.5">{hint}</div>}
    </div>
  );
}

function Btn({
  children, onClick, color = "#4ab3f4", variant = "solid", disabled, loading, fullWidth, title, size = "md",
}: {
  children: React.ReactNode; onClick?: () => void; color?: string;
  variant?: "solid" | "ghost"; disabled?: boolean; loading?: boolean;
  fullWidth?: boolean; title?: string; size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-4 py-2 text-xs";
  const style: React.CSSProperties = variant === "solid"
    ? { background: color, color: "#0d0e17", border: `1px solid ${color}` }
    : { background: `${color}18`, color, border: `1px solid ${color}55` };
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      style={{ ...style, width: fullWidth ? "100%" : undefined }}
      className={`${pad} rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 hover:brightness-110`}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">{label.toUpperCase()}</div>
      {children}
      {hint && <div className="text-[10px] text-white-25 mt-1">{hint}</div>}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/50 ${props.className ?? ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 placeholder:text-white-25 focus:outline-none focus:border-[#4ab3f4]/50 resize-y leading-relaxed ${props.className ?? ""}`}
    />
  );
}

function Pill({ children, color = "#4ab3f4" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center text-[9px] font-bold tracking-wide px-2 py-0.5 rounded-full"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {children}
    </span>
  );
}

function Empty({ icon: Icon, title, hint }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; hint?: string }) {
  return (
    <div className="text-center py-10">
      <Icon size={28} className="text-white-15 mx-auto mb-3" />
      <div className="text-xs text-white-40 font-semibold">{title}</div>
      {hint && <div className="text-[10px] text-white-25 mt-1 leading-relaxed max-w-md mx-auto">{hint}</div>}
    </div>
  );
}

/* ── Toasts ── */

interface Toast { id: string; message: string; kind: "info" | "success" | "error" }
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
          {t.kind === "info" && <Zap size={12} />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100"><X size={10} /></button>
        </div>
      ))}
    </div>
  );
}

/* ── Storage helpers ── */

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`lifeos_marketing_${key}`);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  set<T>(key: string, value: T): void {
    try { localStorage.setItem(`lifeos_marketing_${key}`, JSON.stringify(value)); } catch { /* quota */ }
  },
};

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

/* ── LLM ── */

async function callLLM(prompt: string, opts: { system?: string; max?: number } = {}): Promise<string> {
  try {
    const result = await invokeLLM({
      prompt,
      systemPrompt: opts.system,
      max_tokens: opts.max,
    } as never);
    return typeof result === "string" ? result : String(result ?? "");
  } catch (e) {
    throw new Error(`LLM error: ${(e as Error).message}`);
  }
}

function parseJSONArray<T>(raw: string): T[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found");
  const opener = cleaned[start];
  const closer = opener === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closer);
  if (end === -1) throw new Error("Unterminated JSON");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [parsed];
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 1 — SEO TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

type SeoRunKind = "audit" | "technical" | "onpage" | "competitor" | "backlinks" | "local" | "schema";

const SEO_RUNS: { kind: SeoRunKind; label: string; color: string; hint: string }[] = [
  { kind: "audit",      label: "Full Audit",        color: "#8b7fff", hint: "Crawlability, content, local, authority" },
  { kind: "technical",  label: "Technical SEO",     color: "#4ab3f4", hint: "Speed, mobile, indexation, sitemaps" },
  { kind: "onpage",     label: "On-Page Analysis",  color: "#00c896", hint: "Titles, H1s, internal links, media" },
  { kind: "competitor", label: "Competitor",        color: "#ff8c42", hint: "Top rivals, keyword gaps" },
  { kind: "backlinks",  label: "Backlinks",         color: "#8b7fff", hint: "Sources to target, DA impact" },
  { kind: "local",      label: "Local SEO",         color: "#00c896", hint: "GBP, NAP, local citations" },
  { kind: "schema",     label: "Schema",            color: "#4ab3f4", hint: "JSON-LD snippets" },
];

function SeoTab() {
  const [target, setTarget] = useState(() => store.get("seo_target", { company: "", website: "", industry: "", location: "" }));
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState<SeoRunKind | null>(null);
  const [result, setResult] = useState("");
  const [onPage, setOnPage] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { store.set("seo_target", target); }, [target]);

  const ctx = target.company
    ? `"${target.company}"${target.website ? ` (${target.website})` : ""}${target.industry ? `, a ${target.industry} business` : ""}${target.location ? ` in ${target.location}` : ""}`
    : "this business";

  async function run(kind: SeoRunKind) {
    if (!target.company.trim()) { toast("Set a target company first.", "error"); return; }
    setRunning(kind); setResult("");
    const prompts: Record<SeoRunKind, string> = {
      audit: `Perform a comprehensive SEO audit for ${ctx}. Cover: technical, on-page, content, local, authority. 3 quick wins this week. Concrete fixes only.`,
      technical: `Technical SEO deep-dive for ${ctx}. Crawlability, Core Web Vitals, mobile, canonical, structured data, sitemap, JS rendering. Prioritized.`,
      onpage: `On-page SEO review for ${ctx}. Titles, meta, headings, internal links, image alt, schema. Include 3 example page rewrites.`,
      competitor: `Competitor SEO analysis for ${ctx}. 5 likely competitors, their strengths, keyword gaps, 3 tactics to outrank in 90 days.`,
      backlinks: `Backlink strategy for ${ctx}. 10 specific targets with URLs, 3 tactics, guest-post opportunities, local citations.`,
      local: `Local SEO plan for ${ctx}. GBP optimization, NAP consistency, local citations, content ideas, reviews. 30-day plan.`,
      schema: `Generate ready-to-paste JSON-LD schema for ${ctx}: LocalBusiness, Organization, WebSite+SearchAction, BreadcrumbList. Each as a fenced code block.`,
    };
    try {
      const out = await callLLM(prompts[kind], { system: "You are a senior SEO consultant. Be specific and tactical. No fluff." });
      setResult(out);
      toast(`${SEO_RUNS.find((r) => r.kind === kind)?.label} complete.`, "success");
    } catch (e) {
      setResult(`⚠ ${(e as Error).message}`);
      toast("Analysis failed.", "error");
    } finally { setRunning(null); }
  }

  async function runOnPage() {
    const u = (url || target.website).trim();
    if (!u) { toast("Enter a URL to inspect.", "error"); return; }
    setRunning("onpage"); setOnPage(null);
    try {
      const r = await fetch(`/api/browse/inspect?url=${encodeURIComponent(u)}`);
      if (!r.ok) throw new Error(`Inspector returned HTTP ${r.status}`);
      const data = await r.json();
      setOnPage(data);
      toast("On-page inspection complete.", "success");
    } catch (e) {
      setOnPage({ error: (e as Error).message, url: u });
      toast("Inspector failed.", "error");
    } finally { setRunning(null); }
  }

  function exportMd() {
    const blob = new Blob([`# SEO — ${target.company}\n\n${result}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seo-${target.company || "report"}-${Date.now()}.md`;
    a.click();
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Toasts />
      <Card className="p-5 bg-[rgba(74,179,244,0.04)] border-[#4ab3f4]/20">
        <SectionTitle title="🎯 Target" hint="All tools below run against this target" />
        <div className="grid grid-cols-4 gap-2.5">
          <Field label="Company"><TextInput value={target.company} onChange={(e) => setTarget({ ...target, company: e.target.value })} placeholder="Acme Inc." /></Field>
          <Field label="Website"><TextInput value={target.website} onChange={(e) => setTarget({ ...target, website: e.target.value })} placeholder="https://…" /></Field>
          <Field label="Industry"><TextInput value={target.industry} onChange={(e) => setTarget({ ...target, industry: e.target.value })} placeholder="Marketing" /></Field>
          <Field label="Location"><TextInput value={target.location} onChange={(e) => setTarget({ ...target, location: e.target.value })} placeholder="Atlanta, GA" /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle title="🔎 On-Page Inspector" hint="Fetches the URL and inspects meta, headings, schema — deterministic, no LLM guessing." />
        <div className="flex gap-2">
          <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" onKeyDown={(e) => e.key === "Enter" && runOnPage()} />
          <Btn color="#00c896" onClick={runOnPage} loading={running === "onpage"}>Inspect</Btn>
        </div>
        {onPage && <OnPageResult report={onPage} />}
      </Card>

      <Card className="p-5">
        <SectionTitle title="🧠 AI SEO Analysis" hint={target.company ? `Running against ${target.company}` : "Set target above first"} />
        <div className="flex gap-2 flex-wrap">
          {SEO_RUNS.map((r) => (
            <Btn key={r.kind} color={r.color} variant="ghost" disabled={!target.company.trim()} loading={running === r.kind} onClick={() => run(r.kind)} title={r.hint}>
              {r.label}
            </Btn>
          ))}
          {result && <Btn color="#ff4f5e" variant="ghost" onClick={() => setResult("")}>Clear</Btn>}
          {result && <Btn color="#00c896" variant="ghost" onClick={exportMd}>⬇ Export</Btn>}
        </div>
      </Card>

      {result && <Card className="p-5"><pre className="text-xs text-white-75 leading-relaxed whitespace-pre-wrap font-sans">{result}</pre></Card>}
    </div>
  );
}

function OnPageResult({ report }: { report: Record<string, unknown> }) {
  if (report.error) {
    return <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">⚠ {String(report.error)}</div>;
  }
  const issues: string[] = [];
  const titleLength = Number(report.titleLength ?? 0);
  const descLength = Number(report.metaDescriptionLength ?? 0);
  const h1s = (report.h1 as string[] | undefined) ?? [];
  const wordCount = Number(report.wordCount ?? 0);
  if (titleLength > 60) issues.push(`Title is ${titleLength} chars (aim ≤60)`);
  if (titleLength > 0 && titleLength < 20) issues.push(`Title is only ${titleLength} chars`);
  if (!report.metaDescription) issues.push("Missing meta description");
  if (descLength > 155) issues.push(`Meta description ${descLength} chars (aim ≤155)`);
  if (!h1s.length) issues.push("No H1 found");
  if (h1s.length > 1) issues.push(`Multiple H1s (${h1s.length})`);
  if (wordCount > 0 && wordCount < 300) issues.push(`Thin content (${wordCount} words)`);
  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex gap-1.5 flex-wrap">
        <Pill color="#4ab3f4">Title {titleLength}c</Pill>
        <Pill color="#00c896">Desc {descLength}c</Pill>
        <Pill color="#8b7fff">H1 × {h1s.length}</Pill>
        <Pill color="#ff8c42">Words {wordCount}</Pill>
        <Pill color="#ff4f5e">Issues {issues.length}</Pill>
      </div>
      {issues.length > 0 && (
        <div className="p-3 rounded-lg bg-orange-500/8 border border-orange-500/30">
          {issues.map((i, k) => <div key={k} className="text-[11px] text-white-75 mb-1">• {i}</div>)}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 2 — CONTENT TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

type ContentKind = "blog" | "social" | "gbp" | "email" | "repurpose";

interface ContentDraft {
  id: string;
  kind: ContentKind;
  topic: string;
  output: string;
  createdAt: number;
}

const CONTENT_KINDS: { kind: ContentKind; label: string; icon: React.ReactNode; color: string }[] = [
  { kind: "blog",      label: "Blog Brief",   icon: <FileText size={11} />, color: "#4ab3f4" },
  { kind: "social",    label: "Social Posts", icon: <Hash size={11} />,     color: "#8b7fff" },
  { kind: "gbp",       label: "GBP Posts",    icon: <MapPin size={11} />,   color: "#00c896" },
  { kind: "email",     label: "Email Draft",  icon: <Mail size={11} />,     color: "#ff8c42" },
  { kind: "repurpose", label: "Repurpose",    icon: <Layers size={11} />,   color: "#4ab3f4" },
];

function ContentTab() {
  const [target] = useState(() => store.get("seo_target", { company: "", industry: "", location: "" }));
  const [kind, setKind] = useState<ContentKind>("blog");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("practical, friendly, expert");
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [drafts, setDrafts] = useState<ContentDraft[]>(() => store.get("content_drafts", []));

  useEffect(() => { store.set("content_drafts", drafts); }, [drafts]);

  const ctx = target.company ? `The business is "${target.company}"${target.industry ? ` (${target.industry})` : ""}${target.location ? ` in ${target.location}` : ""}.` : "";

  async function generate() {
    if (!topic.trim()) { toast("Add a topic.", "error"); return; }
    setRunning(true); setOutput("");
    const prompts: Record<ContentKind, string> = {
      blog: `${ctx}\nWrite a complete blog brief for: "${topic}". Audience: ${audience || "general"}. Tone: ${tone}.\nInclude: SEO title (≤60), meta description (≤155), target keyword + 5 secondary, H1-H3 outline, intro hook, FAQ (4 Q&A), linking suggestions, CTA. Markdown.`,
      social: `${ctx}\nWrite 5 social posts about: "${topic}". Audience: ${audience || "general"}. Tone: ${tone}.\nFor each: platform, hook, body, hashtags, CTA. ≤120 words each.`,
      gbp: `${ctx}\nWrite 4 GBP posts about: "${topic}". Each 80-120 words, plain text, one CTA, 1-2 emojis, no hashtags. Vary angles.`,
      email: `${ctx}\nWrite a marketing email about: "${topic}". Audience: ${audience || "customers"}. Tone: ${tone}.\nInclude: 3 subject line options, preview text, body (≤200 words), CTA.`,
      repurpose: `${ctx}\nRepurpose this source into 5 derivative assets (LinkedIn post, Twitter/X thread, IG caption, newsletter section, 30s video script).\nTopic: "${topic}"\nSource:\n"""\n${source || "(infer from topic)"}\n"""`,
    };
    try {
      const out = await callLLM(prompts[kind], { system: "You are a senior content strategist. Output clean markdown." });
      setOutput(out);
      const d: ContentDraft = { id: crypto.randomUUID(), kind, topic, output: out, createdAt: Date.now() };
      setDrafts((p) => [d, ...p].slice(0, 50));
      toast("Generated.", "success");
    } catch (e) {
      setOutput(`⚠ ${(e as Error).message}`);
      toast("Generation failed.", "error");
    } finally { setRunning(false); }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="p-5">
        <SectionTitle title="✍️ Content Generator" hint={target.company ? `Context: ${target.company}` : "Set SEO target for better context"} />
        <div className="flex gap-1.5 flex-wrap mb-3.5">
          {CONTENT_KINDS.map((k) => (
            <button
              key={k.kind}
              onClick={() => setKind(k.kind)}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition-all border flex items-center gap-1.5"
              style={{
                background: kind === k.kind ? `${k.color}22` : "rgba(255,255,255,0.04)",
                borderColor: kind === k.kind ? k.color : "rgba(255,255,255,0.1)",
                color: kind === k.kind ? k.color : "rgba(255,255,255,0.5)",
              }}
            >
              {k.icon} {k.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <Field label="Topic"><TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. 'How to spot a slab leak'" /></Field>
          <Field label="Audience"><TextInput value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Atlanta homeowners" /></Field>
          <Field label="Tone"><TextInput value={tone} onChange={(e) => setTone(e.target.value)} /></Field>
          <Field label="Source (optional)" hint="For repurposing"><TextInput value={source} onChange={(e) => setSource(e.target.value)} placeholder="Notes, transcript, URL" /></Field>
        </div>
        <Btn onClick={generate} color="#4ab3f4" loading={running} disabled={!topic.trim()} fullWidth>⚡ Generate</Btn>
      </Card>

      {output && (
        <Card className="p-5">
          <div className="flex justify-between items-center mb-3">
            <div className="text-xs font-bold text-white-90">Output</div>
            <div className="flex gap-1.5">
              <Btn color="#00c896" variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(output); toast("Copied.", "success"); }}>Copy</Btn>
              <Btn color="#ff4f5e" variant="ghost" size="sm" onClick={() => setOutput("")}>Clear</Btn>
            </div>
          </div>
          <TextArea value={output} onChange={(e) => setOutput(e.target.value)} className="min-h-[320px]" />
        </Card>
      )}

      <Card className="p-5">
        <SectionTitle title={`🗂 Drafts (${drafts.length})`} hint="Saved generations you can reopen or delete." />
        {drafts.length === 0 ? (
          <Empty icon={FileText} title="No drafts yet" hint="Generated content saves here automatically." />
        ) : (
          <div className="flex flex-col gap-1.5">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/6">
                <span className="text-white-50">{CONTENT_KINDS.find((k) => k.kind === d.kind)?.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white-90 truncate">{d.topic || "(untitled)"}</div>
                  <div className="text-[10px] text-[#6aaedd]">{CONTENT_KINDS.find((k) => k.kind === d.kind)?.label} · {new Date(d.createdAt).toLocaleString()}</div>
                </div>
                <Btn color="#4ab3f4" variant="ghost" size="sm" onClick={() => { setOutput(d.output); setTopic(d.topic); setKind(d.kind); }}>Open</Btn>
                <Btn color="#ff4f5e" variant="ghost" size="sm" onClick={() => setDrafts((p) => p.filter((x) => x.id !== d.id))}>Delete</Btn>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 3 — LEAD GEN TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

type LeadGenSub = "community" | "opportunities" | "scanner";

const COMMUNITY_SOURCES = [
  { name: "Facebook Groups", icon: "🔵", site: "facebook.com",   weight: 0.9 },
  { name: "Nextdoor",        icon: "🟢", site: "nextdoor.com",   weight: 1.0 },
  { name: "LinkedIn",        icon: "💼", site: "linkedin.com",   weight: 1.1 },
  { name: "Craigslist",      icon: "🔴", site: "craigslist.org", weight: 0.8 },
  { name: "Reddit",          icon: "🟠", site: "reddit.com",     weight: 0.9 },
  { name: "Thumbtack",       icon: "🔨", site: "thumbtack.com",  weight: 0.9 },
  { name: "Angi",            icon: "🏠", site: "angi.com",       weight: 0.8 },
];

const HIGH_INTENT = /\b(looking for|need|seeking|recommend|anyone know|hire|quote|estimate|ISO)\b/i;
const URGENCY_RE = /\b(asap|urgent|today|tomorrow|emergency|this week)\b/i;
const BUDGET_RE = /\$\s?([\d,]+(?:\.\d{1,2})?)(k)?/i;

interface CommunityLead {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  score: number;
  intent: "high" | "medium" | "low";
  tags: string[];
}

function LeadGenTab() {
  const [sub, setSub] = useState<LeadGenSub>("community");
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-1.5">
        {([
          { id: "community",     label: "🌐 Community Feed" },
          { id: "opportunities", label: "🎯 Directory Opportunities" },
          { id: "scanner",       label: "🩺 NAP Scanner" },
        ] as const).map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-all"
            style={{
              background: sub === s.id ? "rgba(74,179,244,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: sub === s.id ? "#4ab3f4" : "rgba(255,255,255,0.1)",
              color: sub === s.id ? "#4ab3f4" : "rgba(255,255,255,0.5)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === "community" && <CommunityFeed />}
      {sub === "opportunities" && <OpportunityFinder />}
      {sub === "scanner" && <NapScanner />}
    </div>
  );
}

function CommunityFeed() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["Reddit", "Nextdoor"]));
  const [location, setLocation] = useState("");
  const [leads, setLeads] = useState<CommunityLead[]>([]);
  const [scanning, setScanning] = useState(false);

  async function scan() {
    if (!selected.size) return;
    setScanning(true); setLeads([]);
    try {
      const sites = COMMUNITY_SOURCES.filter((s) => selected.has(s.name));
      const siteClause = sites.map((s) => `site:${s.site}`).join(" OR ");
      const r = await lifeosApi.post<{ results?: { title: string; url: string; snippet: string }[] }>(
        "/api/browse/search",
        { query: `(${siteClause}) (recommend OR "looking for" OR hire OR ISO) ${location.trim() || "near me"}`, limit: 25 }
      );
      const seen = new Set<string>();
      const mapped: CommunityLead[] = [];
      for (const item of r.results ?? []) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        const text = `${item.title} ${item.snippet}`;
        const intent: CommunityLead["intent"] = HIGH_INTENT.test(text) ? "high" : /recommend|best|trusted/i.test(text) ? "medium" : "low";
        const src = sites.find((s) => item.url.includes(s.site))?.name ?? "Mixed";
        const weight = sites.find((s) => s.name === src)?.weight ?? 0.9;
        let score = 40;
        if (intent === "high") score += 30;
        if (URGENCY_RE.test(text)) score += 15;
        if (BUDGET_RE.test(text)) score += 10;
        score = Math.min(100, Math.round(score * weight));
        const tags: string[] = [];
        if (URGENCY_RE.test(text)) tags.push("urgent");
        if (BUDGET_RE.test(text)) tags.push("budget");
        mapped.push({ id: item.url, title: item.title, url: item.url, snippet: item.snippet, source: src, score, intent, tags });
      }
      setLeads(mapped.sort((a, b) => b.score - a.score));
      toast(`Found ${mapped.length} leads.`, "success");
    } catch (e) {
      toast(`Scan failed: ${(e as Error).message}`, "error");
    } finally { setScanning(false); }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="p-5">
        <SectionTitle title="🌐 Community Feed Scan" hint="Queries selected sources for service-seeking posts." />
        <div className="flex gap-1.5 flex-wrap mb-3">
          {COMMUNITY_SOURCES.map((s) => {
            const on = selected.has(s.name);
            return (
              <button
                key={s.name}
                onClick={() => setSelected((p) => { const n = new Set(p); if (n.has(s.name)) n.delete(s.name); else n.add(s.name); return n; })}
                className="px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer border"
                style={{
                  background: on ? "rgba(74,179,244,0.15)" : "rgba(255,255,255,0.04)",
                  borderColor: on ? "#4ab3f4" : "rgba(255,255,255,0.1)",
                  color: on ? "#4ab3f4" : "rgba(255,255,255,0.5)",
                }}
              >
                {s.icon} {s.name}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Atlanta, GA)" />
          <Btn onClick={scan} loading={scanning} disabled={!selected.size}>Scan</Btn>
        </div>
      </Card>

      {leads.length > 0 && (
        <>
          <div className="flex gap-1.5">
            <Pill>Total {leads.length}</Pill>
            <Pill color="#ff4f5e">Hot {leads.filter((l) => l.score >= 70).length}</Pill>
          </div>
          <div className="flex flex-col gap-1.5">
            {leads.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer"
                className="flex gap-3 items-start px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/6 hover:border-[#4ab3f4]/30 transition-colors no-underline">
                <div className="w-10 text-center shrink-0">
                  <div className="text-base font-extrabold" style={{ color: l.score >= 70 ? "#ff4f5e" : l.score >= 50 ? "#ff8c42" : "#4ab3f4" }}>{l.score}</div>
                  <div className="text-[8px] text-white-40">{l.intent.toUpperCase()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white-90 font-semibold">{l.title}</div>
                  <div className="text-[11px] text-white-55 mt-0.5 leading-relaxed">{l.snippet}</div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <Pill>{l.source}</Pill>
                    {l.tags.map((t) => <Pill key={t} color={t === "urgent" ? "#ff4f5e" : t === "budget" ? "#00c896" : "#8b7fff"}>{t}</Pill>)}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface OpportunityItem {
  name: string;
  url: string;
  da?: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  reason: string;
  claimed?: boolean;
}

interface OpportunityRun {
  id: string;
  company: string;
  scannedAt: number;
  items: OpportunityItem[];
}

function priorityColor(p: string): string {
  return p === "Critical" ? "#ff4f5e" : p === "High" ? "#ff8c42" : p === "Medium" ? "#ffd166" : "#4ab3f4";
}

function OpportunityFinder() {
  const [runs, setRuns] = useState<OpportunityRun[]>(() => store.get("opportunities", []));
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { store.set("opportunities", runs); }, [runs]);
  const latest = runs[0];

  async function find() {
    if (!company.trim()) return;
    setLoading(true);
    try {
      const raw = await callLLM(`You are a citation expert. For "${company}"${website ? ` (${website})` : ""} in ${location || "Atlanta, GA"}, industry: ${industry || "services"}.\n\nReturn JSON array of up to 15 directory opportunities they're likely missing, ordered by impact: [{"name":"","url":"https://...","da":85,"priority":"Critical|High|Medium|Low","reason":""}]`, { system: "Return only valid JSON." });
      const items = parseJSONArray<OpportunityItem>(raw).map((i) => ({ ...i, priority: (i.priority || "Medium") as OpportunityItem["priority"] }));
      const run: OpportunityRun = { id: crypto.randomUUID(), company, scannedAt: Date.now(), items };
      setRuns((p) => [run, ...p].slice(0, 20));
      toast(`Found ${items.length} opportunities.`, "success");
    } catch (e) {
      toast(`Scan failed: ${(e as Error).message}`, "error");
    } finally { setLoading(false); }
  }

  function claim(runId: string, name: string, url: string) {
    setRuns((p) => p.map((r) => r.id !== runId ? r : { ...r, items: r.items.map((i) => i.name === name ? { ...i, claimed: true } : i) }));
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="p-5">
        <SectionTitle title="🎯 Directory Opportunity Finder" hint="Get the directories this business is missing." />
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
          <Field label="Website"><TextInput value={website} onChange={(e) => setWebsite(e.target.value)} /></Field>
          <Field label="Industry"><TextInput value={industry} onChange={(e) => setIndustry(e.target.value)} /></Field>
          <Field label="Location"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
        </div>
        <Btn onClick={find} color="#00c896" loading={loading} disabled={!company.trim()} fullWidth>Find →</Btn>
      </Card>

      {latest && (
        <Card className="p-5">
          <SectionTitle title={latest.company} hint={`Scanned ${new Date(latest.scannedAt).toLocaleString()} · ${latest.items.length} found`} />
          <div className="flex flex-col gap-1.5">
            {latest.items.map((i) => (
              <div key={i.name} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.025] border border-white/6 ${i.claimed ? "opacity-55" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white-90">{i.name}</div>
                  <div className="text-[10px] text-[#6aaedd] mt-0.5">{i.reason}</div>
                </div>
                <Pill color={priorityColor(i.priority)}>{i.priority}</Pill>
                {i.da && <span className="text-[10px] text-white-25">DA {i.da}</span>}
                <Btn color="#00c896" variant="ghost" size="sm" onClick={() => claim(latest.id, i.name, i.url)}>
                  {i.claimed ? "✓" : "Claim"}
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

interface NapDiff { field: string; listing: string; canonical: string; seen: string; severity: "Critical" | "High" | "Medium" | "Low" }

function NapScanner() {
  const [info] = useState(() => store.get("business_info", {
    businessName: "", category: "", phone: "", address: "", city: "", state: "", zip: "", website: "", hours: "", email: "", description: "", tagline: "",
  }));
  const [snapshots] = useState<{ listingName: string; name?: string; phone?: string; address?: string; website?: string; hours?: string }[]>(
    () => store.get("listing_snapshots", [])
  );
  const [narrative, setNarrative] = useState("");
  const [running, setRunning] = useState(false);

  const has = Boolean(info.businessName && info.phone && info.address);

  function normalizePhone(p: string): string {
    const d = p.replace(/\D/g, "");
    return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  }
  function normalizeAddress(a: string): string {
    return a.toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
  }
  function normalizeName(n: string): string {
    return n.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(inc|llc|co|corp|ltd)$/, "");
  }

  const diffs: NapDiff[] = useMemo(() => {
    if (!has) return [];
    const out: NapDiff[] = [];
    const canon = {
      name: normalizeName(info.businessName),
      phone: normalizePhone(info.phone),
      address: normalizeAddress(`${info.address} ${info.city} ${info.state} ${info.zip}`),
    };
    for (const s of snapshots) {
      if (s.name && normalizeName(s.name) !== canon.name) out.push({ field: "name", listing: s.listingName, canonical: info.businessName, seen: s.name, severity: "High" });
      if (s.phone && normalizePhone(s.phone) !== canon.phone) out.push({ field: "phone", listing: s.listingName, canonical: info.phone, seen: s.phone, severity: "Critical" });
      if (s.address && normalizeAddress(s.address) !== canon.address) out.push({ field: "address", listing: s.listingName, canonical: `${info.address}, ${info.city}`, seen: s.address, severity: "Critical" });
    }
    return out;
  }, [info, snapshots, has]);

  const score = has ? Math.max(0, 100 - diffs.reduce((s, d) => s + (d.severity === "Critical" ? 18 : 10), 0)) : 0;
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  async function runNarrative() {
    if (!has) return;
    setRunning(true);
    try {
      const out = await callLLM(`Audit NAP health for "${info.businessName}" (${info.address}, ${info.city}, ${info.state}).\nCanonical: phone ${info.phone}, website ${info.website}.\nDetected diffs: ${JSON.stringify(diffs)}\n\nProvide qualitative assessment, fix priority, next actions.`);
      setNarrative(out);
      toast("Narrative generated.", "success");
    } finally { setRunning(false); }
  }

  return (
    <div className="flex flex-col gap-3.5">
      {!has && (
        <Card className="p-5 bg-orange-500/8 border-orange-500/30">
          <div className="text-xs text-orange-300 font-bold">⚠ Set Business Info first (Listings → Business Info HQ)</div>
        </Card>
      )}
      <Card className="p-5">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-5xl font-black leading-none" style={{ color: score >= 80 ? "#00c896" : score >= 60 ? "#ffd166" : "#ff4f5e" }}>{grade}</div>
            <div className="text-[11px] text-[#6aaedd] mt-1">NAP Health</div>
            <div className="text-lg font-bold text-white-75">{score}/100</div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-white-90 mb-1.5">Deterministic diffs: {diffs.length} · Snapshots: {snapshots.length}</div>
            <div className="text-[11px] text-[#6aaedd] leading-relaxed">Score computed from real field mismatches. Capture snapshots in Listings → Sync & Push.</div>
            <div className="mt-3">
              <Btn onClick={runNarrative} color="#8b7fff" variant="ghost" disabled={!has} loading={running}>🧠 Narrative report</Btn>
            </div>
          </div>
        </div>
      </Card>

      {diffs.length > 0 && (
        <Card className="p-5">
          <SectionTitle title="Field Mismatches" />
          <div className="flex flex-col gap-1.5">
            {diffs.map((d, i) => (
              <div key={i} className="px-3 py-2.5 rounded-lg bg-white/[0.025]" style={{ borderLeft: `3px solid ${priorityColor(d.severity)}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-white-90">{d.listing} · {d.field}</span>
                  <Pill color={priorityColor(d.severity)}>{d.severity}</Pill>
                </div>
                <div className="text-[11px] text-white-75">
                  <span className="text-teal-400">Canonical:</span> {d.canonical}<br />
                  <span className="text-red-400">Seen:</span> {d.seen}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {narrative && <Card className="p-5"><pre className="text-xs text-white-75 whitespace-pre-wrap leading-relaxed font-sans">{narrative}</pre></Card>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 4 — KEYWORDS TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

interface KeywordRow {
  keyword: string;
  volume?: number;
  difficulty?: "Low" | "Medium" | "High";
  intent?: "Informational" | "Commercial" | "Transactional" | "Navigational";
  cluster?: string;
  position?: number;
}

function KeywordsTab() {
  const [target] = useState(() => store.get("seo_target", { company: "", industry: "", location: "", website: "" }));
  const [rows, setRows] = useState<KeywordRow[]>(() => store.get("keywords", []));
  const [seed, setSeed] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [loading, setLoading] = useState<"research" | "gaps" | "cluster" | null>(null);

  useEffect(() => { store.set("keywords", rows); }, [rows]);

  function mergeRows(existing: KeywordRow[], incoming: KeywordRow[]): KeywordRow[] {
    const map = new Map(existing.map((r) => [r.keyword.toLowerCase(), r]));
    for (const r of incoming) map.set(r.keyword.toLowerCase(), { ...(map.get(r.keyword.toLowerCase()) ?? {}), ...r });
    return [...map.values()];
  }

  async function research() {
    if (!seed.trim()) return;
    setLoading("research");
    try {
      const raw = await callLLM(`Keyword research for ${target.company || "a business"}${target.industry ? ` (${target.industry})` : ""}${target.location ? ` in ${target.location}` : ""}.\nSeed: "${seed}".\nReturn JSON: [{"keyword":"","volume":1234,"difficulty":"Low|Medium|High","intent":"Informational|Commercial|Transactional|Navigational"}]`, { system: "Return only valid JSON." });
      const parsed = parseJSONArray<KeywordRow>(raw);
      setRows((p) => mergeRows(p, parsed));
      toast(`Found ${parsed.length} keywords.`, "success");
    } catch (e) { toast(`Failed: ${(e as Error).message}`, "error"); }
    finally { setLoading(null); }
  }

  async function cluster() {
    if (!rows.length) return;
    setLoading("cluster");
    try {
      const raw = await callLLM(`Cluster into 5-8 semantic groups. Return JSON: [{"keyword":"","cluster":""}].\nKeywords: ${JSON.stringify(rows.map((r) => r.keyword))}`, { system: "Return only valid JSON." });
      const parsed = parseJSONArray<{ keyword: string; cluster: string }>(raw);
      const map = new Map(parsed.map((p) => [p.keyword.toLowerCase(), p.cluster]));
      setRows((p) => p.map((r) => ({ ...r, cluster: map.get(r.keyword.toLowerCase()) ?? r.cluster })));
      toast("Clustered.", "success");
    } catch (e) { toast(`Failed: ${(e as Error).message}`, "error"); }
    finally { setLoading(null); }
  }

  async function gapAnalysis() {
    if (!competitor.trim()) return;
    setLoading("gaps");
    try {
      const raw = await callLLM(`Keyword gaps. Target: ${target.company || "ours"}${target.industry ? ` (${target.industry})` : ""}${target.location ? ` in ${target.location}` : ""}. Competitor: ${competitor}.\nReturn JSON: [{"keyword":"","volume":1234,"difficulty":"Low|Medium|High","intent":"Informational|Commercial|Transactional|Navigational"}]`, { system: "Return only valid JSON." });
      const parsed = parseJSONArray<KeywordRow>(raw);
      setRows((p) => mergeRows(p, parsed));
      toast(`Found ${parsed.length} gaps.`, "success");
    } catch (e) { toast(`Failed: ${(e as Error).message}`, "error"); }
    finally { setLoading(null); }
  }

  async function checkRank(row: KeywordRow) {
    try {
      const r = await fetch(`/api/serp/rank?q=${encodeURIComponent(row.keyword)}&domain=${encodeURIComponent(target.website || "")}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { position?: number };
      setRows((p) => p.map((x) => x.keyword === row.keyword ? { ...x, position: data.position ?? 0 } : x));
      toast(`Rank checked.`, "success");
    } catch (e) { toast(`Rank check failed: ${(e as Error).message}`, "error"); }
  }

  function exportCsv() {
    const header = ["keyword", "volume", "difficulty", "intent", "cluster", "position"];
    const csv = [header, ...rows.map((r) => [r.keyword, r.volume ?? "", r.difficulty ?? "", r.intent ?? "", r.cluster ?? "", r.position ?? ""])]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `keywords-${Date.now()}.csv`;
    a.click();
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="p-5">
        <SectionTitle title="🔍 Keyword Research" hint={target.company ? `Context: ${target.company}` : "Set SEO target for better context"} />
        <div className="grid grid-cols-[2fr_auto] gap-2 mb-2.5">
          <TextInput value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Seed keyword" onKeyDown={(e) => e.key === "Enter" && research()} />
          <Btn onClick={research} loading={loading === "research"} disabled={!seed.trim()}>Research</Btn>
        </div>
        <div className="grid grid-cols-[2fr_auto] gap-2">
          <TextInput value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="Competitor domain" />
          <Btn onClick={gapAnalysis} color="#ff8c42" loading={loading === "gaps"} disabled={!competitor.trim()}>Gap Analysis</Btn>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex justify-between items-center mb-3">
          <SectionTitle title={`📊 Keyword Table (${rows.length})`} />
          <div className="flex gap-1.5">
            <Btn color="#8b7fff" variant="ghost" size="sm" onClick={cluster} loading={loading === "cluster"} disabled={!rows.length}>Cluster</Btn>
            <Btn color="#00c896" variant="ghost" size="sm" onClick={exportCsv} disabled={!rows.length}>CSV</Btn>
            <Btn color="#ff4f5e" variant="ghost" size="sm" onClick={() => setRows([])} disabled={!rows.length}>Clear</Btn>
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty icon={Search} title="No keywords yet" hint="Run research or gap analysis above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  {["Keyword", "Volume", "Difficulty", "Intent", "Cluster", "Pos", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-bold text-[#6aaedd] tracking-wider">{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.keyword} className="border-b border-white/[0.03]">
                    <td className="px-3 py-2 text-white-90">{r.keyword}</td>
                    <td className="px-3 py-2 text-white-75">{r.volume?.toLocaleString() ?? "—"}</td>
                    <td className="px-3 py-2"><Pill color={r.difficulty === "High" ? "#ff4f5e" : r.difficulty === "Medium" ? "#ff8c42" : "#00c896"}>{r.difficulty ?? "—"}</Pill></td>
                    <td className="px-3 py-2 text-[#6aaedd]">{r.intent ?? "—"}</td>
                    <td className="px-3 py-2 text-[#6aaedd]">{r.cluster ?? "—"}</td>
                    <td className="px-3 py-2 text-teal-400">{r.position && r.position > 0 ? `#${r.position}` : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => checkRank(r)} className="text-[10px] px-2 py-1 rounded bg-teal-500/12 border border-teal-500/30 text-teal-400 cursor-pointer hover:bg-teal-500/20">Check</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 5 — LISTINGS TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

interface ListingDef { name: string; icon: string; url: string; color: string; priority: "critical" | "high" | "medium" | "low" }
type ListingStatus = "Unclaimed" | "Claimed" | "Active" | "Needs Update";

const DEFAULT_LISTINGS: ListingDef[] = [
  { name: "Google My Business", icon: "🔍", url: "https://business.google.com", color: "#00c896", priority: "critical" },
  { name: "Yelp for Business",  icon: "⭐", url: "https://biz.yelp.com", color: "#ff8c42", priority: "high" },
  { name: "Bing Places",        icon: "🔷", url: "https://www.bingplaces.com", color: "#4ab3f4", priority: "high" },
  { name: "Apple Business",     icon: "🍎", url: "https://businessconnect.apple.com", color: "#aaa", priority: "high" },
  { name: "Facebook Business",  icon: "📘", url: "https://business.facebook.com", color: "#1877f2", priority: "high" },
  { name: "Angi Pro",           icon: "🏠", url: "https://pro.angi.com", color: "#4ab3f4", priority: "medium" },
  { name: "Thumbtack Pro",      icon: "📌", url: "https://www.thumbtack.com/pro", color: "#ff8c42", priority: "medium" },
  { name: "HomeAdvisor",        icon: "🔧", url: "https://www.homeadvisor.com/business-center", color: "#00c896", priority: "medium" },
  { name: "Nextdoor Business",  icon: "🏘️", url: "https://business.nextdoor.com", color: "#00b05c", priority: "medium" },
  { name: "BBB",                icon: "🏛️", url: "https://www.bbb.org/accreditation", color: "#4ab3f4", priority: "medium" },
  { name: "YP.com",             icon: "📒", url: "https://www.yp.com/claim", color: "#ff8c42", priority: "medium" },
  { name: "Foursquare",         icon: "📡", url: "https://business.foursquare.com", color: "#f94877", priority: "low" },
  { name: "Manta",              icon: "🌐", url: "https://www.manta.com/claim", color: "#0072c6", priority: "low" },
];

const EMPTY_BIZ_INFO = {
  businessName: "", category: "", phone: "", address: "", city: "", state: "", zip: "", website: "", hours: "Mon-Fri 9am-6pm", email: "", description: "", tagline: "",
};
type BusinessInfo = typeof EMPTY_BIZ_INFO;

function ListingsTab() {
  const [sub, setSub] = useState<"dashboard" | "bizinfo" | "sync">("dashboard");
  const [info, setInfo] = useState<BusinessInfo>(() => store.get("business_info", EMPTY_BIZ_INFO));
  const [listings, setListings] = useState<Record<string, ListingStatus>>(() => store.get("listing_statuses", {}));

  useEffect(() => { store.set("business_info", info); }, [info]);
  useEffect(() => { store.set("listing_statuses", listings); }, [listings]);

  const hasInfo = Boolean(info.businessName && info.phone && info.address);
  const activeCount = Object.values(listings).filter((s) => s === "Claimed" || s === "Active").length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-1.5">
        {([
          { id: "dashboard", label: "📋 Dashboard", count: `${activeCount}/${DEFAULT_LISTINGS.length}` },
          { id: "bizinfo",   label: "🏢 Business Info", badge: !hasInfo },
          { id: "sync",      label: "🔄 Sync & Push" },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border flex items-center gap-1.5"
            style={{
              background: sub === t.id ? "rgba(74,179,244,0.15)" : "rgba(255,255,255,0.04)",
              borderColor: sub === t.id ? "#4ab3f4" : "rgba(255,255,255,0.1)",
              color: sub === t.id ? "#4ab3f4" : "rgba(255,255,255,0.5)",
            }}>
            {t.label}
            {"count" in t && t.count && <span className="text-[9px] opacity-70">{t.count}</span>}
            {"badge" in t && t.badge && <span className="w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-extrabold">!</span>}
          </button>
        ))}
      </div>

      {sub === "dashboard" && (
        <>
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { label: "Active", val: activeCount, color: "#00c896" },
              { label: "Needs Work", val: Object.values(listings).filter((s) => s === "Needs Update").length, color: "#ff8c42" },
              { label: "Unclaimed", val: DEFAULT_LISTINGS.length - activeCount, color: "#ff4f5e" },
              { label: "Total", val: DEFAULT_LISTINGS.length, color: "#4ab3f4" },
            ].map((s) => (
              <Card key={s.label} className="p-3.5 text-center">
                <div className="text-2xl font-extrabold" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[10px] text-[#6aaedd]">{s.label}</div>
              </Card>
            ))}
          </div>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {DEFAULT_LISTINGS.map((l) => {
              const status = listings[l.name] ?? "Unclaimed";
              const statusColor = status === "Active" || status === "Claimed" ? "#00c896" : status === "Needs Update" ? "#ff8c42" : "#ff4f5e";
              return (
                <Card key={l.name} className="p-3.5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="text-2xl">{l.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white-90">{l.name}</div>
                      <div className="flex gap-1 mt-1">
                        <Pill color={statusColor}>{status}</Pill>
                        <Pill color={priorityColor(l.priority)}>{l.priority}</Pill>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <select
                      value={status}
                      onChange={(e) => setListings((p) => ({ ...p, [l.name]: e.target.value as ListingStatus }))}
                      className="flex-1 px-2 py-1.5 rounded-md bg-[#0d0e17] border border-white/10 text-[11px] text-white-75"
                    >
                      {["Unclaimed", "Claimed", "Active", "Needs Update"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <a href={l.url} target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 rounded-md text-[11px] no-underline"
                      style={{ background: `${l.color}20`, border: `1px solid ${l.color}44`, color: l.color }}>
                      Open ↗
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {sub === "bizinfo" && <BusinessInfoHQ info={info} setInfo={setInfo} hasInfo={hasInfo} />}
      {sub === "sync" && <SyncPush info={info} listings={listings} hasInfo={hasInfo} />}
    </div>
  );
}

function BusinessInfoHQ({ info, setInfo, hasInfo }: { info: BusinessInfo; setInfo: (i: BusinessInfo) => void; hasInfo: boolean }) {
  const [editing, setEditing] = useState(!hasInfo);

  function save() {
    store.set("business_info", info);
    toast("Business info saved.", "success");
    setEditing(false);
  }

  return (
    <Card className="p-5">
      <div className="flex justify-between items-start mb-3">
        <SectionTitle title="🏢 Business Info HQ" hint="Canonical source of truth used across SEO, Listings, and Lead Gen." />
        {hasInfo && !editing && <Btn color="#4ab3f4" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Btn>}
      </div>
      {!editing && hasInfo ? (
        <div className="grid grid-cols-2 gap-2.5">
          {([
            ["Business Name", info.businessName], ["Category", info.category],
            ["Phone", info.phone], ["Website", info.website],
            ["Address", info.address], ["City/State/Zip", `${info.city}, ${info.state} ${info.zip}`],
            ["Hours", info.hours], ["Email", info.email],
          ] as const).map(([l, v]) => (
            <div key={l} className="px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/6">
              <div className="text-[9px] text-[#6aaedd] font-bold tracking-wider mb-1">{l.toUpperCase()}</div>
              <div className="text-xs text-white-90">{v || <span className="text-white-25 italic">Not set</span>}</div>
            </div>
          ))}
          {info.description && (
            <div className="col-span-2 px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/6">
              <div className="text-[9px] text-[#6aaedd] font-bold tracking-wider mb-1">DESCRIPTION</div>
              <div className="text-xs text-white-75 leading-relaxed">{info.description}</div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              ["Business Name", "businessName", "text"], ["Category", "category", "text"],
              ["Phone", "phone", "tel"], ["Website", "website", "url"],
              ["Address", "address", "text"], ["City", "city", "text"],
              ["State", "state", "text"], ["Zip", "zip", "text"],
              ["Hours", "hours", "text"], ["Email", "email", "email"],
            ] as const).map(([label, key, type]) => (
              <Field key={key} label={label}>
                <TextInput type={type} value={info[key]} onChange={(e) => setInfo({ ...info, [key]: e.target.value })} />
              </Field>
            ))}
          </div>
          <div className="mt-2.5">
            <Field label="Description"><TextArea value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} className="min-h-[80px]" /></Field>
          </div>
          <div className="mt-2.5">
            <Field label="Tagline"><TextInput value={info.tagline} onChange={(e) => setInfo({ ...info, tagline: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2 mt-3.5">
            {hasInfo && <Btn color="#4ab3f4" variant="ghost" onClick={() => setEditing(false)}>Cancel</Btn>}
            <Btn color="#00c896" onClick={save} fullWidth>💾 Save</Btn>
          </div>
        </>
      )}
    </Card>
  );
}

function SyncPush({ info, listings, hasInfo }: { info: BusinessInfo; listings: Record<string, ListingStatus>; hasInfo: boolean }) {
  const [guide, setGuide] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  async function push(l: ListingDef) {
    if (!hasInfo) return;
    setLoading(l.name);
    try {
      const out = await callLLM(`Generate a step-by-step guide to update "${l.name}" (${l.url}).\n\nCanonical info:\nName: ${info.businessName}\nPhone: ${info.phone}\nAddress: ${info.address}, ${info.city}, ${info.state} ${info.zip}\nWebsite: ${info.website}\nHours: ${info.hours}\nCategory: ${info.category}\n\n3-5 steps to update. Common fields. Platform tips. Max 200 words.`, { system: "You are a listing-management expert." });
      setGuide((g) => ({ ...g, [l.name]: out }));
      toast(`Guide ready for ${l.name}.`, "success");
    } finally { setLoading(null); }
  }

  function captureSnapshot(l: ListingDef) {
    const current = store.get<{ listingName: string }[]>("listing_snapshots", []);
    const snap = {
      listingName: l.name,
      name: info.businessName,
      phone: info.phone,
      address: `${info.address}, ${info.city}, ${info.state} ${info.zip}`,
      website: info.website,
      hours: info.hours,
      capturedAt: Date.now(),
    };
    store.set("listing_snapshots", [snap, ...current].slice(0, 50));
    toast(`Snapshot captured for ${l.name}.`, "success");
  }

  return (
    <Card className="p-5">
      <SectionTitle title="🔄 Sync & Push" hint="Generate guides and capture snapshots for the NAP scanner." />
      {!hasInfo && <div className="text-[11px] text-orange-300 mb-2.5">⚠ Set Business Info first.</div>}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {DEFAULT_LISTINGS.map((l) => {
          const status = listings[l.name] ?? "Unclaimed";
          const statusColor = status === "Active" || status === "Claimed" ? "#00c896" : "#ff8c42";
          return (
            <Card key={l.name} className="p-3.5">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-xl">{l.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-white-90">{l.name}</div>
                  <Pill color={statusColor}>{status}</Pill>
                </div>
                <a href={l.url} target="_blank" rel="noreferrer"
                  className="px-2.5 py-1 rounded-md text-[10px] no-underline"
                  style={{ background: `${l.color}18`, border: `1px solid ${l.color}44`, color: l.color }}>
                  Open ↗
                </a>
              </div>
              <div className="flex gap-1.5">
                <Btn color="#4ab3f4" variant="ghost" size="sm" disabled={!hasInfo} onClick={() => captureSnapshot(l)} fullWidth>📸 Snapshot</Btn>
                <Btn color="#00c896" variant="ghost" size="sm" disabled={!hasInfo} loading={loading === l.name} onClick={() => push(l)} fullWidth>Push →</Btn>
              </div>
              {guide[l.name] && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-black/25 border border-teal-500/30">
                  <div className="text-[10px] text-teal-400 font-bold mb-1.5">📋 UPDATE GUIDE</div>
                  <div className="text-[11px] text-white-75 leading-relaxed whitespace-pre-wrap">{guide[l.name]}</div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 6 — CAMPAIGNS TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

type EmailProvider = "resend" | "sendgrid" | null;

function getEmailProvider(): EmailProvider {
  if (RESEND_KEY) return "resend";
  if (SENDGRID_KEY) return "sendgrid";
  return null;
}

async function sendEmail(args: {
  to: string; fromName: string; fromEmail: string; subject: string; html: string; text: string;
}): Promise<{ ok: boolean; provider: string; error?: string; messageId?: string }> {
  const provider = getEmailProvider();
  if (!provider) return { ok: false, provider: "none", error: "No provider configured" };
  if (provider === "resend") {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${args.fromName} <${args.fromEmail}>`,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    const d = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    return r.ok ? { ok: true, provider: "resend", messageId: d.id } : { ok: false, provider: "resend", error: d.message ?? `HTTP ${r.status}` };
  }
  // sendgrid
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${SENDGRID_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from: { email: args.fromEmail, name: args.fromName },
      subject: args.subject,
      content: [
        { type: "text/plain", value: args.text },
        { type: "text/html", value: args.html },
      ],
    }),
  });
  if (r.status === 202) return { ok: true, provider: "sendgrid", messageId: r.headers.get("x-message-id") ?? undefined };
  const err = (await r.json().catch(() => ({}))) as { errors?: { message: string }[] };
  return { ok: false, provider: "sendgrid", error: err.errors?.[0]?.message ?? `HTTP ${r.status}` };
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: "Draft" | "Sent" | "Failed";
  createdAt: number;
  sentAt?: number;
  fromName: string;
  fromEmail: string;
  recipients: string[];
  stats: { sent: number; failed: number };
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => store.get("campaigns", []));
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const provider = getEmailProvider();

  useEffect(() => { store.set("campaigns", campaigns); }, [campaigns]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <Btn color="#4ab3f4" onClick={() => setOpen(true)}><Plus size={12} /> New Campaign</Btn>
        <div className={`text-[11px] ${provider ? "text-[#6aaedd]" : "text-orange-300"}`}>
          {provider ? `Provider: ${provider}` : "⚠ No email provider — set VITE_RESEND_KEY or VITE_SENDGRID_KEY"}
        </div>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "320px 1fr" }}>
        <Card className="p-3">
          <SectionTitle title={`Campaigns (${campaigns.length})`} />
          {campaigns.length === 0 && <Empty icon={Send} title="No campaigns yet" />}
          <div className="flex flex-col gap-1.5">
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="text-left px-3 py-2.5 rounded-lg cursor-pointer transition-colors border"
                style={{
                  background: selectedId === c.id ? "rgba(74,179,244,0.12)" : "rgba(255,255,255,0.03)",
                  borderColor: selectedId === c.id ? "#4ab3f4" : "rgba(255,255,255,0.06)",
                }}
              >
                <div className="text-xs font-semibold text-white-90">{c.name}</div>
                <div className="flex gap-1.5 mt-1 items-center">
                  <Pill color={c.status === "Sent" ? "#00c896" : c.status === "Failed" ? "#ff4f5e" : "#666"}>{c.status}</Pill>
                  <span className="text-[10px] text-[#6aaedd]">{c.stats.sent} sent</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div>
          {selectedId ? (
            <CampaignEditor
              campaign={campaigns.find((c) => c.id === selectedId)!}
              onChange={(c) => setCampaigns((p) => p.map((x) => x.id === c.id ? c : x))}
              onDelete={() => { setCampaigns((p) => p.filter((x) => x.id !== selectedId)); setSelectedId(null); }}
              provider={provider}
            />
          ) : (
            <Card className="p-5"><Empty icon={Send} title="Select or create a campaign" /></Card>
          )}
        </div>
      </div>

      {open && (
        <NewCampaignModal
          onClose={() => setOpen(false)}
          onCreated={(id) => { setOpen(false); setSelectedId(id); }}
          onCreate={(c) => setCampaigns((p) => [c, ...p])}
        />
      )}
    </div>
  );
}

function NewCampaignModal({ onClose, onCreated, onCreate }: { onClose: () => void; onCreated: (id: string) => void; onCreate: (c: Campaign) => void }) {
  const info = store.get("business_info", EMPTY_BIZ_INFO);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fromName, setFromName] = useState(info.businessName || "");
  const [fromEmail, setFromEmail] = useState(info.email || "");

  function create() {
    if (!name.trim()) return;
    const id = crypto.randomUUID();
    onCreate({
      id, name, subject, body,
      status: "Draft", createdAt: Date.now(),
      fromName, fromEmail,
      recipients: [], stats: { sent: 0, failed: 0 },
    });
    toast(`Campaign created: ${name}`, "success");
    onCreated(id);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Card className="w-[520px] p-6 border border-[#4ab3f4]/30">
        <SectionTitle title="New Email Campaign" />
        <div className="flex flex-col gap-2.5">
          <Field label="Campaign Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Subject"><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="From Name"><TextInput value={fromName} onChange={(e) => setFromName(e.target.value)} /></Field>
            <Field label="From Email"><TextInput type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} /></Field>
          </div>
          <Field label="Body" hint="Supports {{first_name}}, {{company}}"><TextArea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[140px]" /></Field>
        </div>
        <div className="flex gap-2 mt-3.5">
          <Btn color="#4ab3f4" variant="ghost" onClick={onClose} fullWidth>Cancel</Btn>
          <Btn color="#00c896" onClick={create} disabled={!name.trim()} fullWidth>Create</Btn>
        </div>
      </Card>
    </div>
  );
}

function CampaignEditor({ campaign, onChange, onDelete, provider }: { campaign: Campaign; onChange: (c: Campaign) => void; onDelete: () => void; provider: EmailProvider }) {
  const [audienceText, setAudienceText] = useState(campaign.recipients.join("\n"));
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0 });

  const recipientList = useMemo(() => {
    return audienceText.split(/[\n,;]+/).map((e) => e.trim()).filter(Boolean);
  }, [audienceText]);

  async function sendNow() {
    if (!provider) { toast("No email provider configured.", "error"); return; }
    if (!campaign.subject.trim() || !campaign.body.trim()) { toast("Subject and body required.", "error"); return; }
    if (!recipientList.length) { toast("No recipients.", "error"); return; }
    if (!campaign.fromName || !campaign.fromEmail) { toast("From name/email missing.", "error"); return; }

    setSending(true);
    setProgress({ sent: 0, failed: 0 });
    let sent = 0, failed = 0;

    for (const to of recipientList) {
      const vars = { first_name: to.split("@")[0], email: to };
      const subject = renderTemplate(campaign.subject, vars);
      const html = renderTemplate(campaign.body, vars);
      try {
        const r = await sendEmail({
          to, fromName: campaign.fromName, fromEmail: campaign.fromEmail,
          subject, html, text: stripHtml(html),
        });
        if (r.ok) sent++; else failed++;
      } catch { failed++; }
      setProgress({ sent, failed });
    }

    onChange({
      ...campaign,
      recipients: recipientList,
      status: failed === recipientList.length ? "Failed" : "Sent",
      sentAt: Date.now(),
      stats: { sent, failed },
    });
    toast(`Campaign sent: ${sent} ok, ${failed} failed.`, failed ? "error" : "success");
    setSending(false);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="p-5">
        <div className="flex justify-between items-center mb-3">
          <SectionTitle title="✉️ Composer" />
          <div className="flex gap-1.5">
            <Btn color="#ff4f5e" variant="ghost" size="sm" onClick={onDelete}>Delete</Btn>
            <Btn color="#00c896" size="sm" onClick={sendNow} loading={sending} disabled={!provider}>Send Now</Btn>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Name"><TextInput value={campaign.name} onChange={(e) => onChange({ ...campaign, name: e.target.value })} /></Field>
          <Field label="Subject" hint="Supports {{first_name}}"><TextInput value={campaign.subject} onChange={(e) => onChange({ ...campaign, subject: e.target.value })} /></Field>
        </div>
        <div className="mt-2.5">
          <Field label="Body" hint="Supports {{first_name}}, {{company}}, {{email}}">
            <TextArea value={campaign.body} onChange={(e) => onChange({ ...campaign, body: e.target.value })} className="min-h-[220px]" />
          </Field>
        </div>
        {sending && <div className="text-[11px] text-[#6aaedd] mt-2.5">Sending… {progress.sent} ok / {progress.failed} failed</div>}
      </Card>

      <Card className="p-5">
        <SectionTitle title="🎯 Audience" hint={`${recipientList.length} recipients (one per line, comma or semicolon separated)`} />
        <TextArea value={audienceText} onChange={(e) => setAudienceText(e.target.value)} className="min-h-[140px] font-mono" placeholder="john@example.com&#10;jane@example.com" />
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 7 — CRM TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

type CRMStage = "Lead" | "Qualified" | "Proposal" | "Negotiation" | "Closed Won" | "Closed Lost";
type CRMTag = "Hot" | "Warm" | "New" | "Follow-up" | "VIP" | "Cold";

const CRM_STAGES: CRMStage[] = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
const CRM_TAGS: CRMTag[] = ["Hot", "Warm", "New", "Follow-up", "VIP", "Cold"];
const CRM_TAG_COLORS: Record<CRMTag, string> = { Hot: "#ff4f5e", Warm: "#ff8c42", New: "#00d9b3", "Follow-up": "#4ab3f4", VIP: "#b366ff", Cold: "#a9a9a9" };
const CRM_STAGE_COLORS: Record<CRMStage, string> = { Lead: "#a9a9a9", Qualified: "#4ab3f4", Proposal: "#ff8c42", Negotiation: "#b366ff", "Closed Won": "#00d9b3", "Closed Lost": "#ff4f5e" };

type SocialKey = "facebook" | "twitter" | "instagram" | "tiktok" | "snapchat" | "whatsapp" | "telegram" | "reddit" | "youtube" | "linkedin";
const SOCIALS: { key: SocialKey; label: string; emoji: string; color: string; base: string }[] = [
  { key: "facebook",  label: "Facebook",  emoji: "📘", color: "#1877f2", base: "https://facebook.com/" },
  { key: "twitter",   label: "X",         emoji: "🐦", color: "#1da1f2", base: "https://x.com/" },
  { key: "instagram", label: "Instagram", emoji: "📸", color: "#e1306c", base: "https://instagram.com/" },
  { key: "tiktok",    label: "TikTok",    emoji: "🎵", color: "#69c9d0", base: "https://tiktok.com/@" },
  { key: "snapchat",  label: "Snapchat",  emoji: "👻", color: "#fffc00", base: "https://snapchat.com/add/" },
  { key: "whatsapp",  label: "WhatsApp",  emoji: "💚", color: "#25d366", base: "https://wa.me/" },
  { key: "telegram",  label: "Telegram",  emoji: "✈️", color: "#0088cc", base: "https://t.me/" },
  { key: "reddit",    label: "Reddit",    emoji: "🟠", color: "#ff4500", base: "https://reddit.com/user/" },
  { key: "youtube",   label: "YouTube",   emoji: "▶️", color: "#ff0000", base: "https://youtube.com/@" },
  { key: "linkedin",  label: "LinkedIn",  emoji: "💼", color: "#0a66c2", base: "https://linkedin.com/in/" },
];

interface CRMContact {
  id: string;
  name: string;
  company: string;
  title: string;
  emails: string[];
  phones: string[];
  websites: string[];
  socials: Partial<Record<SocialKey, string[]>>;
  value: string;
  stage: CRMStage;
  tag: CRMTag;
  source: string;
  address: string;
  notes: string;
  birthday: string;
  lastContact: string;
  _sync?: "clean" | "saving" | "error";
}

const BLANK_CRM: CRMContact = {
  id: "", name: "", company: "", title: "",
  emails: [""], phones: [""], websites: [""], socials: {},
  value: "", stage: "Lead", tag: "New", source: "", address: "",
  notes: "", birthday: "", lastContact: "",
};

function formatPhone(raw: string): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  const local = d.length === 11 && d[0] === "1" ? d.slice(1) : d;
  if (local.length !== 10) return d;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}
function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (!d) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
function maskBirthday(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (!d) return "";
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
function normalizeBirthday(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length < 6) return "";
  let mm: number, dd: number, yyyy: number;
  if (d.length >= 8) { mm = parseInt(d.slice(0, 2), 10); dd = parseInt(d.slice(2, 4), 10); yyyy = parseInt(d.slice(4, 8), 10); }
  else { mm = parseInt(d.slice(0, 2), 10); dd = parseInt(d.slice(2, 4), 10); const yy = parseInt(d.slice(4, 6), 10); yyyy = yy > 30 ? 1900 + yy : 2000 + yy; }
  if (!mm || !dd || mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return "";
  return `${String(mm).padStart(2, "0")}/${String(dd).padStart(2, "0")}/${yyyy}`;
}

function migrateLegacyContact(row: Record<string, unknown>): CRMContact {
  if (Array.isArray(row.emails)) return row as unknown as CRMContact;
  const emails: string[] = [];
  const phones: string[] = [];
  const websites: string[] = [];
  const socials: Partial<Record<SocialKey, string[]>> = {};
  if (typeof row.email === "string" && row.email) emails.push(row.email);
  if (typeof row.phone === "string" && row.phone) phones.push(row.phone);
  if (typeof row.website === "string" && row.website) websites.push(row.website);
  for (let i = 1; i <= 12; i++) {
    const e = row[`email${i}`]; if (typeof e === "string" && e) emails.push(e);
    const p = row[`phone${i}`]; if (typeof p === "string" && p) phones.push(p);
  }
  for (let i = 2; i <= 11; i++) {
    const w = row[`website${i}`]; if (typeof w === "string" && w) websites.push(w);
  }
  for (const s of SOCIALS) {
    const arr: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const v = row[`${s.key}${i}`]; if (typeof v === "string" && v) arr.push(v);
    }
    if (arr.length) socials[s.key] = arr;
  }
  const extraPhones = Array.isArray(row.extraPhones) ? (row.extraPhones as string[]) : [];
  const extraEmails = Array.isArray(row.extraEmails) ? (row.extraEmails as string[]) : [];
  return {
    id: String(row.id ?? `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    name: String(row.name ?? ""),
    company: String(row.company ?? ""),
    title: String(row.title ?? row.jobTitle ?? ""),
    emails: [...emails, ...extraEmails].filter(Boolean).length ? [...emails, ...extraEmails] : [""],
    phones: [...phones, ...extraPhones].filter(Boolean).length ? [...phones, ...extraPhones] : [""],
    websites: websites.length ? websites : [""],
    socials,
    value: String(row.value ?? ""),
    stage: CRM_STAGES.includes(row.stage as CRMStage) ? (row.stage as CRMStage) : "Lead",
    tag: CRM_TAGS.includes(row.tag as CRMTag) ? (row.tag as CRMTag) : "New",
    source: String(row.source ?? ""),
    address: String(row.address ?? ""),
    notes: String(row.notes ?? ""),
    birthday: String(row.birthday ?? ""),
    lastContact: String(row.lastContact ?? ""),
  };
}

function CRMTab() {
  const userEmail = useUserEmail();
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState<CRMStage | "All">("All");
  const [filterTag, setFilterTag] = useState<CRMTag | "All">("All");
  const importRef = useRef<HTMLInputElement | null>(null);

  const loadLocal = useCallback((): CRMContact[] => {
    const raw = ls.get<unknown[]>("lifeos_crm", []);
    const migrated = raw.map((r) => migrateLegacyContact(r as Record<string, unknown>));
    return migrated;
  }, []);

  useEffect(() => {
    const local = loadLocal();
    if (local.length) { setContacts(local); setLoading(false); }
    (async () => {
      try {
        const path = userEmail
          ? `crm_contacts?user_email=eq.${encodeURIComponent(userEmail)}&order=created_at.desc&limit=1000`
          : "crm_contacts?order=created_at.desc&limit=1000";
        const data = (await dbFetch(path)) as unknown[];
        if (Array.isArray(data) && data.length) {
          const migrated = data.map((r) => migrateLegacyContact(r as Record<string, unknown>));
          setContacts(migrated);
          ls.set("lifeos_crm", migrated);
        }
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, [userEmail, loadLocal]);

  useEffect(() => {
    if (!loading) ls.set("lifeos_crm", contacts);
  }, [contacts, loading]);

  const selected = useMemo(() => contacts.find((c) => c.id === selectedId) ?? null, [contacts, selectedId]);
  const editContact = useMemo(() => contacts.find((c) => c.id === editId) ?? null, [contacts, editId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filterStage !== "All" && c.stage !== filterStage) return false;
      if (filterTag !== "All" && c.tag !== filterTag) return false;
      if (!q) return true;
      return [c.name, c.company, c.title, ...c.emails, ...c.phones, c.source, c.tag].join(" ").toLowerCase().includes(q);
    });
  }, [contacts, search, filterStage, filterTag]);

  const stats = useMemo(() => ({
    total: contacts.length,
    hot: contacts.filter((c) => c.tag === "Hot").length,
    value: contacts.reduce((s, c) => s + (parseFloat(String(c.value).replace(/[^\d.]/g, "")) || 0), 0),
  }), [contacts]);

  async function persist(contact: CRMContact): Promise<CRMContact | null> {
    setContacts((p) => p.map((c) => c.id === contact.id ? { ...contact, _sync: "saving" } : c));
    try {
      const { id, _sync, ...fields } = contact;
      const payload = { ...fields, user_email: userEmail || undefined };
      let saved: CRMContact | null = null;
      if (id && !id.startsWith("local_")) {
        saved = (await dbFetch(`crm_contacts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(payload), prefer: "return=representation" })) as CRMContact | null;
      } else {
        saved = (await dbFetch("crm_contacts", { method: "POST", body: JSON.stringify(payload), prefer: "return=representation" })) as CRMContact | null;
      }
      const merged: CRMContact = { ...contact, ...(saved ?? {}), _sync: "clean" };
      setContacts((p) => p.map((c) => c.id === contact.id ? merged : c));
      return merged;
    } catch {
      setContacts((p) => p.map((c) => c.id === contact.id ? { ...contact, _sync: "error" } : c));
      toast("Save failed — kept locally.", "error");
      return null;
    }
  }

  async function addContact(form: CRMContact) {
    if (!form.name.trim()) { toast("Name required.", "error"); return; }
    const cleaned: CRMContact = {
      ...form,
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      emails: form.emails.map((v) => v.trim()).filter(Boolean),
      phones: form.phones.map((v) => v.trim()).filter(Boolean),
      websites: form.websites.map((v) => v.trim()).filter(Boolean),
      birthday: normalizeBirthday(form.birthday),
      lastContact: "Just now",
      _sync: "saving",
    };
    if (!cleaned.emails.length) cleaned.emails = [""];
    if (!cleaned.phones.length) cleaned.phones = [""];
    if (!cleaned.websites.length) cleaned.websites = [""];
    setContacts((p) => [cleaned, ...p]);
    setAdding(false);
    const saved = await persist(cleaned);
    if (saved) toast(`${saved.name} added.`, "success");
  }

  async function deleteOne(id: string) {
    setContacts((p) => p.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (!id.startsWith("local_")) {
      try { await dbFetch(`crm_contacts?id=eq.${id}`, { method: "DELETE", prefer: "" }); }
      catch { toast("Server delete failed.", "error"); }
    }
  }

  function exportCsv() {
    const headers = ["name", "company", "title", "emails", "phones", "websites", ...SOCIALS.map((s) => s.key), "value", "stage", "tag", "source", "address", "notes", "birthday", "lastContact"];
    const rows = contacts.map((c) => [
      c.name, c.company, c.title, c.emails, c.phones, c.websites,
      ...SOCIALS.map((s) => c.socials[s.key] ?? []),
      c.value, c.stage, c.tag, c.source, c.address, c.notes, c.birthday, c.lastContact,
    ].map((v) => {
      const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `crm_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast(`Exported ${contacts.length}.`, "success");
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error("Empty CSV");
      const headers = lines[0].split(",").map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const fresh: CRMContact[] = [];
      const existing = new Set<string>();
      for (const c of contacts) {
        c.emails.forEach((e) => existing.add(e.toLowerCase()));
        c.phones.forEach((p) => existing.add(p.replace(/\D/g, "")));
        existing.add(c.name.toLowerCase());
      }
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(",").map((c) => c.replace(/^"|"$/g, "").trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { if (cells[idx]) row[h] = cells[idx]; });
        const name = (row.name ?? `${row.firstname ?? ""} ${row.lastname ?? ""}`.trim()).trim();
        if (!name) continue;
        const em = (row.email ?? "").toLowerCase();
        const ph = (row.phone ?? "").replace(/\D/g, "");
        if ((em && existing.has(em)) || (ph && existing.has(ph)) || existing.has(name.toLowerCase())) continue;
        if (em) existing.add(em);
        if (ph) existing.add(ph);
        existing.add(name.toLowerCase());
        fresh.push({
          ...BLANK_CRM,
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name,
          company: row.company ?? "",
          title: row.title ?? row.jobtitle ?? "",
          emails: em ? [row.email] : [""],
          phones: ph ? [formatPhone(row.phone)] : [""],
          websites: row.website ? [row.website] : [""],
          stage: CRM_STAGES.includes(row.stage as CRMStage) ? (row.stage as CRMStage) : "Lead",
          tag: CRM_TAGS.includes(row.tag as CRMTag) ? (row.tag as CRMTag) : "New",
          source: row.source || "Imported",
          value: row.value ?? "",
          notes: row.notes ?? "",
          birthday: normalizeBirthday(row.birthday ?? ""),
          lastContact: "Imported",
        });
      }
      if (!fresh.length) { toast("No new contacts.", "info"); return; }
      setContacts((p) => [...fresh, ...p]);
      await Promise.allSettled(fresh.map((c) => persist(c)));
      toast(`Imported ${fresh.length}.`, "success");
    } catch (err) {
      toast(`Import failed: ${(err as Error).message}`, "error");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex gap-1.5">
        <Btn color="#4ab3f4" onClick={exportCsv} variant="ghost" size="sm"><Download size={12} /> Export</Btn>
        <Btn color="#8b7fff" onClick={() => importRef.current?.click()} variant="ghost" size="sm"><Upload size={12} /> Import</Btn>
        <input ref={importRef} type="file" accept=".csv" onChange={importCsv} style={{ display: "none" }} />
        <div className="ml-auto">
          <Btn color="#00c896" onClick={() => { setAdding(true); setSelectedId(null); setEditId(null); }}><Plus size={12} /> Add Lead</Btn>
        </div>
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "320px 1fr" }}>
        <aside className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Leads", val: stats.total, color: "#ff8c42" },
              { label: "Hot", val: stats.hot, color: "#ff4f5e" },
              { label: "Pipeline", val: `$${(stats.value / 1000).toFixed(1)}k`, color: "#00d9b3" },
            ].map((s) => (
              <Card key={s.label} className="p-2.5 text-center">
                <div className="text-lg font-extrabold" style={{ color: s.color }}>{loading ? "…" : s.val}</div>
                <div className="text-[10px] text-[#6aaedd]">{s.label}</div>
              </Card>
            ))}
          </div>

          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />

          <div className="flex flex-wrap gap-1">
            {(["All", ...CRM_STAGES] as const).map((s) => (
              <button key={s} onClick={() => setFilterStage(s as CRMStage | "All")}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer border"
                style={{
                  background: filterStage === s ? "rgba(255,79,94,0.15)" : "rgba(255,255,255,0.04)",
                  borderColor: filterStage === s ? "#ff4f5e" : "rgba(255,255,255,0.08)",
                  color: filterStage === s ? "#ff4f5e" : "rgba(255,255,255,0.5)",
                }}>
                {s}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {(["All", ...CRM_TAGS] as const).map((t) => (
              <button key={t} onClick={() => setFilterTag(t as CRMTag | "All")}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer border"
                style={{
                  background: filterTag === t ? "rgba(255,140,66,0.15)" : "rgba(255,255,255,0.04)",
                  borderColor: filterTag === t ? "#ff8c42" : "rgba(255,255,255,0.08)",
                  color: filterTag === t ? "#ff8c42" : "rgba(255,255,255,0.5)",
                }}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 max-h-[60vh]">
            {loading ? (
              <div className="text-center py-8 text-xs text-white-25">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-xs text-white-25">No contacts.</div>
            ) : filtered.map((c) => {
              const initials = (c.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const active = selectedId === c.id;
              return (
                <button key={c.id} onClick={() => { setSelectedId(c.id); setAdding(false); setEditId(null); }}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer border text-left ${active ? "glass-crimson" : "glass"} border-white/8 hover:border-white/20`}>
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-black"
                    style={{ background: `linear-gradient(135deg,${CRM_TAG_COLORS[c.tag]},#ff8c42)` }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate ${active ? "text-[#ff4f5e]" : "text-white-85"}`}>{c.name}</div>
                    <div className="text-[10px] text-white-40 truncate">{c.company}{c.value ? ` · ${c.value}` : ""}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Pill color={CRM_TAG_COLORS[c.tag]}>{c.tag}</Pill>
                    {c._sync === "saving" && <Loader2 size={10} className="animate-spin text-white-40" />}
                    {c._sync === "error" && <AlertCircle size={10} className="text-red-400" />}
                    <button onClick={(e) => { e.stopPropagation(); deleteOne(c.id); }} className="text-red-400/40 hover:text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="glass rounded-2xl border border-white/8 p-5 overflow-y-auto max-h-[75vh]">
          {adding && <CRMForm mode="add" contact={BLANK_CRM} onSave={addContact} onCancel={() => setAdding(false)} />}
          {editContact && (
            <CRMForm mode="edit" contact={editContact}
              onSave={async (c) => { const cleaned = { ...c, birthday: normalizeBirthday(c.birthday) }; const saved = await persist(cleaned); setEditId(null); if (saved) toast("Saved.", "success"); }}
              onCancel={() => setEditId(null)} />
          )}
          {selected && !adding && !editId && (
            <CRMDetail contact={selected} onEdit={() => setEditId(selected.id)} onDelete={() => deleteOne(selected.id)} />
          )}
          {!selected && !adding && !editContact && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 min-h-[300px]">
              <Target size={40} className="mb-3" />
              <div className="text-xs font-display tracking-widest uppercase text-white-75">Select a lead or add one</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CRMForm({ mode, contact, onSave, onCancel }: { mode: "add" | "edit"; contact: CRMContact; onSave: (c: CRMContact) => void; onCancel: () => void }) {
  const [form, setForm] = useState<CRMContact>(contact);
  const [open, setOpen] = useState<Record<string, boolean>>({ identity: true, contact: true, pipeline: false, social: false, notes: false });

  const set = <K extends keyof CRMContact>(k: K, v: CRMContact[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setSocial = (k: SocialKey, v: string[]) => setForm((f) => ({ ...f, socials: { ...f.socials, [k]: v } }));

  function MultiValue({ label, values, onChange, type = "text", placeholder, formatValue, hrefFor }: {
    label: string; values: string[]; onChange: (v: string[]) => void; type?: string; placeholder: string;
    formatValue?: (v: string) => string; hrefFor?: (v: string) => string;
  }) {
    return (
      <div>
        <div className="text-[10px] font-bold text-[#6aaedd] tracking-wider mb-1">{label.toUpperCase()}</div>
        {values.map((v, i) => (
          <div key={i} className="flex gap-1.5 mb-1">
            {hrefFor && v ? (
              <a href={hrefFor(v)} target="_blank" rel="noreferrer" className="flex-1 px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-[11px] text-[#4ab3f4] no-underline truncate">
                {formatValue ? formatValue(v) : v}
              </a>
            ) : (
              <input type={type} value={formatValue ? formatValue(v) : v} placeholder={placeholder}
                onChange={(e) => { const n = [...values]; n[i] = e.target.value; onChange(n); }}
                className="flex-1 px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/8 text-[11px] text-white-85 focus:outline-none focus:border-[#4ab3f4]/50" />
            )}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 px-1">
              <X size={12} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...values, ""])} className="text-[10px] text-teal-400 hover:text-teal-300 mt-1">+ Add {label.toLowerCase()}</button>
      </div>
    );
  }

  function SectionBlock({ id, title, badge, children }: { id: string; title: string; badge?: number; children: React.ReactNode }) {
    const isOpen = open[id];
    return (
      <div className="border-t border-white/6">
        <button type="button" onClick={() => setOpen((p) => ({ ...p, [id]: !p[id] }))}
          className="flex items-center gap-2 w-full py-3 text-left text-[11px] font-display tracking-wider font-bold text-white-70 hover:text-white-95">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
          {typeof badge === "number" && badge > 0 && (
            <span className="ml-auto text-[9px] px-1.5 rounded-full bg-[#ff4f5e]/20 text-[#ff4f5e]">{badge}</span>
          )}
        </button>
        {isOpen && <div className="pb-4 flex flex-col gap-2.5">{children}</div>}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-display tracking-wider text-[#ff4f5e]">{mode === "add" ? "ADD LEAD" : "EDIT LEAD"}</h3>
        <button onClick={onCancel} className="text-white-40 hover:text-white-90"><X size={18} /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
        <SectionBlock id="identity" title="IDENTITY">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Name *"><TextInput value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
            <Field label="Company"><TextInput value={form.company} onChange={(e) => set("company", e.target.value)} /></Field>
            <Field label="Title"><TextInput value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
            <Field label="Source"><TextInput value={form.source} onChange={(e) => set("source", e.target.value)} /></Field>
          </div>
        </SectionBlock>

        <SectionBlock id="contact" title="CONTACT">
          <MultiValue label="Emails" type="email" placeholder="name@example.com" values={form.emails} onChange={(v) => set("emails", v)} />
          <MultiValue label="Phones" type="tel" placeholder="(555) 555-5555" values={form.phones} onChange={(v) => set("phones", v)} formatValue={formatPhoneInput} />
          <MultiValue label="Websites" placeholder="https://…" values={form.websites} onChange={(v) => set("websites", v)} hrefFor={(v) => v.startsWith("http") ? v : `https://${v}`} />
          <Field label="Address"><TextInput value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Birthday (MM/DD/YYYY)"><TextInput value={form.birthday} onChange={(e) => set("birthday", maskBirthday(e.target.value))} placeholder="MM/DD/YYYY" /></Field>
        </SectionBlock>

        <SectionBlock id="pipeline" title="PIPELINE">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Stage">
              <select value={form.stage} onChange={(e) => set("stage", e.target.value as CRMStage)} className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90">
                {CRM_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Tag">
              <select value={form.tag} onChange={(e) => set("tag", e.target.value as CRMTag)} className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90">
                {CRM_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Deal Value"><TextInput value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="$0" /></Field>
            <Field label="Last Contact"><TextInput value={form.lastContact} onChange={(e) => set("lastContact", e.target.value)} /></Field>
          </div>
        </SectionBlock>

        <SectionBlock id="social" title="SOCIAL" badge={Object.values(form.socials).filter((v) => v?.length).length}>
          {SOCIALS.map((s) => (
            <MultiValue key={s.key} label={s.label} placeholder="@username or URL"
              values={form.socials[s.key] ?? [""]}
              onChange={(v) => setSocial(s.key, v)}
              hrefFor={(v) => v.startsWith("http") ? v : `${s.base}${v.replace(/^@/, "")}`} />
          ))}
        </SectionBlock>

        <SectionBlock id="notes" title="NOTES">
          <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-[100px]" placeholder="Context, history, next steps…" />
        </SectionBlock>

        <div className="flex justify-end gap-2 pt-2">
          <Btn color="#4ab3f4" variant="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn color="#00c896" onClick={() => onSave(form)}><Save size={14} /> Save</Btn>
        </div>
      </form>
    </div>
  );
}

type AIAction = "intro" | "qualify" | "next" | "objections";
const AI_ACTIONS: { key: AIAction; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "intro",      label: "Draft intro",  icon: <Mail size={11} />,     color: "#4ab3f4" },
  { key: "qualify",    label: "Qualify",      icon: <Target size={11} />,   color: "#8b7fff" },
  { key: "next",       label: "Next steps",   icon: <ArrowRight size={11} />, color: "#00c896" },
  { key: "objections", label: "Objections",   icon: <Shield size={11} />,   color: "#ff8c42" },
];

function CRMDetail({ contact, onEdit, onDelete }: { contact: CRMContact; onEdit: () => void; onDelete: () => void }) {
  const [ai, setAi] = useState<{ action: AIAction | null; loading: boolean; result: string; error: string | null }>({ action: null, loading: false, result: "", error: null });
  const [enriching, setEnriching] = useState(false);

  const initials = (contact.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  async function enrich() {
    setEnriching(true);
    try {
      const r = await fetch("/api/enrich/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contact.emails[0], name: contact.name, company: contact.company }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      toast("Enriched.", "success");
    } catch (e) {
      toast(`Enrichment failed: ${(e as Error).message}`, "error");
    } finally { setEnriching(false); }
  }

  async function runAI(action: AIAction) {
    setAi({ action, loading: true, result: "", error: null });
    const digest = [
      `Name: ${contact.name}`,
      contact.company && `Company: ${contact.company}`,
      contact.title && `Title: ${contact.title}`,
      contact.stage && `Stage: ${contact.stage}`,
      contact.tag && `Tag: ${contact.tag}`,
      contact.value && `Deal value: ${contact.value}`,
      contact.notes && `Notes: ${contact.notes}`,
    ].filter(Boolean).join("\n");
    const prompts: Record<AIAction, string> = {
      intro: `Write a short warm intro email from a service provider to this lead.\n${digest}\n\nInclude: 3 subject options, body ≤120 words, one clear CTA.`,
      qualify: `Assess lead qualification (BANT).\n${digest}\n\nGive score 0-100, BANT breakdown, 3 qualifying questions.`,
      next: `Give a 3-step next-step plan for the next 7 days.\n${digest}\n\nEach step: action, timing, channel, target outcome.`,
      objections: `Predict 3 likely objections and give one response for each.\n${digest}\n\nFormat: Objection → Response. ≤60 words per response.`,
    };
    try {
      const out = await callLLM(prompts[action]);
      setAi({ action, loading: false, result: out, error: null });
    } catch (e) {
      setAi({ action, loading: false, result: "", error: (e as Error).message });
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-black"
            style={{ background: `linear-gradient(135deg,${CRM_TAG_COLORS[contact.tag]},#ff8c42)` }}>
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-display tracking-wide text-white-95">{contact.name}</h2>
            <p className="text-xs text-white-40 mt-0.5">{contact.title || "Lead"}{contact.company ? ` at ${contact.company}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onEdit} className="p-2 rounded-lg glass hover:glass-crimson"><Zap size={15} className="text-teal-400" /></button>
          <button onClick={enrich} disabled={enriching} className="p-2 rounded-lg glass hover:glass-crimson disabled:opacity-50">
            {enriching ? <Loader2 size={15} className="animate-spin text-yellow-400" /> : <Star size={15} className="text-yellow-400" />}
          </button>
          <button onClick={onDelete} className="p-2 rounded-lg glass hover:glass-crimson"><Trash2 size={15} className="text-red-400" /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <div className="text-[10px] font-display tracking-wider text-teal-400 mb-2.5">PIPELINE</div>
          {[
            ["Stage", contact.stage, CRM_STAGE_COLORS[contact.stage]],
            ["Tag", contact.tag, CRM_TAG_COLORS[contact.tag]],
            ["Value", contact.value || "—", "#4ab3f4"],
            ["Source", contact.source || "—", null],
            ["Last Contact", contact.lastContact || "—", null],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="flex justify-between py-1 text-[11px]">
              <span className="text-white-40">{l}</span>
              <span style={{ color: (c as string) ?? "rgba(255,255,255,0.6)" }}>{v}</span>
            </div>
          ))}
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-display tracking-wider text-teal-400 mb-2.5">CONTACT</div>
          {contact.emails.filter(Boolean).map((e, i) => (
            <div key={i} className="flex justify-between py-1 text-[11px]">
              <span className="text-white-40">{i === 0 ? "Email" : `Email ${i + 1}`}</span>
              <a href={`mailto:${e}`} className="text-[#4ab3f4] no-underline truncate max-w-[140px]">{e}</a>
            </div>
          ))}
          {contact.phones.filter(Boolean).map((p, i) => (
            <div key={i} className="flex justify-between py-1 text-[11px]">
              <span className="text-white-40">{i === 0 ? "Phone" : `Phone ${i + 1}`}</span>
              <a href={`tel:${p.replace(/\D/g, "")}`} className="text-[#4ab3f4] no-underline">{formatPhone(p)}</a>
            </div>
          ))}
          {contact.address && (
            <div className="flex justify-between py-1 text-[11px]">
              <span className="text-white-40">Address</span>
              <span className="text-white-60">{contact.address}</span>
            </div>
          )}
          {contact.birthday && (
            <div className="flex justify-between py-1 text-[11px]">
              <span className="text-white-40">Birthday</span>
              <span className="text-pink-300">{contact.birthday}</span>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-[10px] font-display tracking-wider text-teal-400 mb-2.5">SOCIAL</div>
          {SOCIALS.map((s) => {
            const values = (contact.socials[s.key] ?? []).filter(Boolean);
            if (!values.length) return null;
            return (
              <div key={s.key} className="mb-2">
                <div className="text-[10px] text-white-40 mb-0.5"><span style={{ color: s.color }}>{s.emoji}</span> {s.label}</div>
                {values.map((v, i) => (
                  <a key={i} href={v.startsWith("http") ? v : `${s.base}${v.replace(/^@/, "")}`} target="_blank" rel="noreferrer" className="block text-[10px] text-white-60 hover:text-white-95 truncate no-underline">
                    {v}
                  </a>
                ))}
              </div>
            );
          })}
          {!Object.values(contact.socials).some((v) => v?.filter(Boolean).length) && (
            <div className="text-[10px] text-white-25 italic">No socials on file.</div>
          )}
        </Card>
      </div>

      {contact.notes && (
        <Card className="p-4 mb-3.5 glass-crimson">
          <div className="text-[10px] font-display tracking-wider text-teal-400 mb-1.5">NOTES</div>
          <p className="text-xs text-white-75 leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={12} className="text-[#ff4f5e]" />
          <span className="text-[11px] font-display tracking-wider text-[#ff4f5e]">AI ASSISTANT</span>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-3">
          {AI_ACTIONS.map((a) => (
            <button key={a.key} onClick={() => runAI(a.key)} disabled={ai.loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border disabled:opacity-50"
              style={{ color: a.color, borderColor: `${a.color}55`, background: `${a.color}12` }}>
              {ai.loading && ai.action === a.key ? <Loader2 size={11} className="animate-spin" /> : a.icon}
              {a.label}
            </button>
          ))}
        </div>
        {ai.error && <div className="text-[11px] text-red-400 p-2 rounded bg-red-500/8"><AlertCircle size={11} className="inline mr-1" /> {ai.error}</div>}
        {ai.result && (
          <div className="p-3 rounded-lg bg-[#ff4f5e]/6 border border-[#ff4f5e]/20">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-display tracking-wider text-[#ff4f5e]">{AI_ACTIONS.find((a) => a.key === ai.action)?.label.toUpperCase()}</span>
              <div className="flex gap-1">
                <button onClick={() => { navigator.clipboard.writeText(ai.result); toast("Copied.", "success"); }} className="p-1 text-white-40 hover:text-white-90"><Copy size={11} /></button>
                <button onClick={() => ai.action && runAI(ai.action)} className="p-1 text-white-40 hover:text-white-90"><RefreshCw size={11} /></button>
                <button onClick={() => setAi({ action: null, loading: false, result: "", error: null })} className="p-1 text-white-40 hover:text-white-90"><X size={11} /></button>
              </div>
            </div>
            <pre className="text-xs text-white-85 whitespace-pre-wrap leading-relaxed font-sans m-0">{ai.result}</pre>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 8 — PEOPLE CAPITAL TAB ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

interface Person {
  id: string;
  name: string;
  type: "Family" | "Business" | "Personal";
  subtype: string;
  email?: string;
  phone?: string;
  company?: string;
  lastContact?: string;
  tags: string[];
  notes?: string;
  birthday?: string;
  stage?: string;
  value?: string;
  kpi?: { connect?: number; support?: number; milestone?: string };
  favorites?: { food?: string };
}

interface ScoredPerson extends Person {
  capitalScore: number;
  scoreReason: string;
}

function scorePerson(p: Person, override?: number): ScoredPerson {
  if (typeof override === "number") return { ...p, capitalScore: override, scoreReason: "Manual override" };
  const weights: Record<string, number> = { VIP: 20, Hot: 18, Warm: 10, Cold: -15, Referral: 12 };
  let score = 50;
  const reasons: string[] = [];
  if (p.type === "Family") { score += 15; reasons.push("Family"); }
  if (p.type === "Business") { score += 5; reasons.push("Business"); }
  for (const tag of p.tags) if (weights[tag]) { score += weights[tag]; reasons.push(tag); }
  const lc = p.lastContact ?? "";
  if (!lc || lc === "Never") { score -= 20; reasons.push("Never contacted"); }
  else if (/just now|today/i.test(lc)) { score += 20; reasons.push("Recent"); }
  else if (/^\d+ day/i.test(lc) && parseInt(lc) < 3) { score += 15; reasons.push("Recent"); }
  else if (/month|2 weeks|ago/i.test(lc)) { score -= 10; reasons.push("Overdue"); }
  if (p.kpi) {
    const avg = ((p.kpi.connect ?? 5) + (p.kpi.support ?? 5)) / 2;
    score += Math.round((avg - 5) * 3);
  }
  if (p.stage) {
    const stageWeight: Record<string, number> = { "Closed Won": 25, Negotiation: 18, Proposal: 12, Qualified: 8, "Closed Lost": -20 };
    if (stageWeight[p.stage]) score += stageWeight[p.stage];
  }
  if (p.value) {
    const v = parseFloat(p.value.replace(/[^\d.]/g, "")) || 0;
    if (v > 10000) { score += 15; reasons.push("High value"); }
    else if (v > 1000) score += 8;
  }
  if (p.notes) score += 3;
  if (p.birthday) { score += 5; reasons.push("Bday tracked"); }
  return { ...p, capitalScore: Math.max(0, Math.min(100, Math.round(score))), scoreReason: reasons.slice(0, 3).join(" · ") };
}

function scoreLabel(s: number): { label: string; color: string } {
  if (s >= 80) return { label: "🔥 Hot", color: "#ff4f5e" };
  if (s >= 65) return { label: "⚡ Active", color: "#ff8c42" };
  if (s >= 45) return { label: "🌡 Warm", color: "#4ab3f4" };
  return { label: "❄ Cold", color: "#6aaedd" };
}

type NudgeKind = "message" | "birthday" | "reconnect" | "referral" | "voicenote";

function PeopleCapitalTab() {
  const [people, setPeople] = useState<ScoredPerson[]>([]);
  const [selected, setSelected] = useState<ScoredPerson | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [nudge, setNudge] = useState("");
  const [nudgeKind, setNudgeKind] = useState<NudgeKind | null>(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>(() => store.get("capital_overrides", {}));

  useEffect(() => { store.set("capital_overrides", overrides); }, [overrides]);

  useEffect(() => {
    const crm = ls.get<Record<string, unknown>[]>("lifeos_crm", []);
    const contacts = ls.get<Record<string, unknown>[]>("lifeos_contacts", []);
    const family = ls.get<Record<string, unknown>[]>("family_members_v2", []);
    const merged: Person[] = [
      ...family.map((m) => ({
        id: `fam_${m.id}`,
        name: String(m.name ?? "Unknown"),
        type: "Family" as const,
        subtype: String(m.relation ?? "Family"),
        email: String(m.email ?? ""), phone: String(m.phone ?? ""),
        lastContact: m.reminders ? "Recent" : undefined,
        tags: (Array.isArray(m.tags) ? m.tags : []) as string[],
        notes: String(m.notes ?? ""),
        birthday: String(m.birthday ?? ""),
        kpi: m.kpi as Person["kpi"],
        favorites: m.favorites as Person["favorites"],
      })),
      ...contacts.map((c) => ({
        id: `con_${c.id}`,
        name: String(c.name ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()),
        type: "Personal" as const,
        subtype: String(c.group ?? "Contact"),
        email: String(c.email ?? ""), phone: String(c.phone ?? ""),
        lastContact: String(c.lastContact ?? ""),
        tags: (Array.isArray(c.tags) ? c.tags : []) as string[],
        notes: String(c.notes ?? c.note ?? ""),
        birthday: String(c.birthday ?? ""),
        company: String(c.company ?? ""),
      })),
      ...crm.map((c) => ({
        id: `crm_${c.id}`,
        name: String(c.name ?? "Unknown"),
        type: "Business" as const,
        subtype: String(c.tag ?? c.stage ?? "Lead"),
        email: String(c.email ?? ""), phone: String(c.phone ?? ""),
        lastContact: String(c.lastContact ?? ""),
        tags: [c.tag, c.stage].filter(Boolean) as string[],
        notes: String(c.notes ?? ""),
        birthday: String(c.birthday ?? ""),
        company: String(c.company ?? ""),
        stage: String(c.stage ?? ""),
        value: String(c.value ?? ""),
      })),
    ].filter((p) => p.name && p.name !== "Chris Green");

    const scored = merged.map((p) => scorePerson(p, overrides[p.id]));
    scored.sort((a, b) => b.capitalScore - a.capitalScore);
    setPeople(scored);
  }, [overrides]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return people.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.company ?? "").toLowerCase().includes(q)) return false;
      if (filter === "All") return true;
      if (filter === "Family") return p.type === "Family";
      if (filter === "Business") return p.type === "Business";
      if (filter === "Personal") return p.type === "Personal";
      if (filter === "🔥 Hot") return p.capitalScore >= 80;
      if (filter === "❄ Cold") return p.capitalScore < 45;
      if (filter === "Overdue") { const lc = p.lastContact ?? ""; return !lc || lc === "Never" || lc.includes("month"); }
      return true;
    });
  }, [people, search, filter]);

  const stats = useMemo(() => ({
    hot: people.filter((p) => p.capitalScore >= 80).length,
    warm: people.filter((p) => p.capitalScore >= 45 && p.capitalScore < 80).length,
    cold: people.filter((p) => p.capitalScore < 45).length,
    overdue: people.filter((p) => { const lc = p.lastContact ?? ""; return !lc || lc === "Never" || lc.includes("month"); }).length,
  }), [people]);

  async function generateNudge(person: ScoredPerson, kind: NudgeKind) {
    setNudgeKind(kind); setNudgeLoading(true); setNudge("");
    const prompts: Record<NudgeKind, string> = {
      message: `Write a warm outreach message (≤50 words) to ${person.name} (${person.type} — ${person.subtype}${person.company ? `, ${person.company}` : ""}).\nNotes: ${person.notes || "none"}\nLast contact: ${person.lastContact || "unknown"}`,
      birthday: `Write a birthday note (≤40 words) to ${person.name}.${person.favorites?.food ? `\nFav food: ${person.favorites.food}` : ""}`,
      reconnect: `Write a warm reconnection message (≤60 words) to ${person.name}. Last contact: ${person.lastContact || "long ago"}.`,
      referral: `Write a referral request (≤60 words) to ${person.name} (${person.subtype}). Ask naturally.`,
      voicenote: `Write a voice note SCRIPT (~30-45 seconds spoken) to ${person.name}. Warm, natural, brief.`,
    };
    try {
      const out = await callLLM(prompts[kind]);
      setNudge(out);
      toast("Nudge generated.", "success");
    } catch (e) {
      setNudge(`⚠ ${(e as Error).message}`);
    } finally { setNudgeLoading(false); }
  }

  return (
    <div className="flex gap-3.5" style={{ height: "calc(100vh - 180px)" }}>
      <div className="w-[340px] flex flex-col gap-2.5 shrink-0">
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { icon: "🔥", val: stats.hot, label: "Hot", color: "#ff4f5e" },
            { icon: "⚡", val: stats.warm, label: "Warm", color: "#ff8c42" },
            { icon: "❄", val: stats.cold, label: "Cold", color: "#4ab3f4" },
            { icon: "⏰", val: stats.overdue, label: "Overdue", color: "#8b7fff" },
          ].map((s) => (
            <Card key={s.label} className="p-2 text-center">
              <div className="text-base font-bold" style={{ color: s.color }}>{s.val}</div>
              <div className="text-[9px] text-white-25">{s.icon} {s.label}</div>
            </Card>
          ))}
        </div>

        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…" />

        <div className="flex gap-1 flex-wrap">
          {["All", "Family", "Business", "Personal", "🔥 Hot", "❄ Cold", "Overdue"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer"
              style={{
                background: filter === f ? "rgba(74,179,244,0.2)" : "rgba(255,255,255,0.05)",
                color: filter === f ? "#4ab3f4" : "rgba(255,255,255,0.4)",
              }}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-white-25">No contacts loaded. Add people in CRM, Contacts, or Family Hub.</div>
          ) : filtered.map((p) => {
            const sl = scoreLabel(p.capitalScore);
            const active = selected?.id === p.id;
            const initials = (p.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <button key={p.id} onClick={() => { setSelected(p); setNudge(""); setNudgeKind(null); }}
                className="text-left px-3 py-2.5 rounded-lg cursor-pointer border"
                style={{
                  background: active ? "rgba(74,179,244,0.08)" : "rgba(255,255,255,0.03)",
                  borderColor: active ? "rgba(74,179,244,0.4)" : "rgba(255,255,255,0.06)",
                }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-black"
                    style={{ background: `linear-gradient(135deg,${sl.color},#4ab3f4)` }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white-90 truncate">{p.name}</div>
                    <div className="text-[10px] text-white-40 truncate">{p.subtype}{p.company ? ` · ${p.company}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold" style={{ color: sl.color }}>{p.capitalScore}</div>
                    <div className="text-[8px]" style={{ color: sl.color }}>{sl.label}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <Card className="p-6 text-center">
            <Award size={40} className="mx-auto text-white-15 mb-3" />
            <div className="text-sm font-bold text-white-90 mb-2">People Capital Vault</div>
            <div className="text-xs text-white-40 leading-relaxed max-w-md mx-auto">
              Relationship health scores across family, clients, and prospects. Select anyone to generate personalized outreach.
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-3.5">
            <Card className="p-5">
              <div className="flex items-start gap-3.5 mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-black shrink-0"
                  style={{ background: `linear-gradient(135deg,${scoreLabel(selected.capitalScore).color},#4ab3f4)` }}>
                  {(selected.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-white-95">{selected.name}</div>
                  <div className="text-xs text-white-40 mt-0.5">{selected.subtype}{selected.company ? ` · ${selected.company}` : ""}</div>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {selected.tags.map((t) => <Pill key={t}>{t}</Pill>)}
                    {selected.birthday && <Pill color="#ff6b9d">🎂 {selected.birthday}</Pill>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold" style={{ color: scoreLabel(selected.capitalScore).color }}>{selected.capitalScore}</div>
                  <div className="text-[11px] font-semibold" style={{ color: scoreLabel(selected.capitalScore).color }}>{scoreLabel(selected.capitalScore).label}</div>
                  <button onClick={() => {
                    const v = prompt(`Override score for ${selected.name} (0-100):`, String(selected.capitalScore));
                    if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0 && n <= 100) setOverrides((p) => ({ ...p, [selected.id]: n })); }
                  }} className="text-[9px] text-white-25 hover:text-white-60 mt-1">✏ Override</button>
                </div>
              </div>
              {selected.scoreReason && (
                <div className="text-[11px] text-white-40 px-2.5 py-1.5 rounded bg-white/[0.02]">📊 {selected.scoreReason}</div>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle title="🎯 AI Nurture Nudges" hint={`Personalized outreach for ${selected.name.split(" ")[0]}`} />
              <div className="flex gap-1.5 flex-wrap mb-3">
                {([
                  { k: "message",   icon: "💬", label: "Quick Message",  color: "#00c896" },
                  { k: "birthday",  icon: "🎂", label: "Birthday Note",  color: "#ff6b9d" },
                  { k: "reconnect", icon: "🔄", label: "Reconnect",      color: "#4ab3f4" },
                  { k: "referral",  icon: "🤝", label: "Ask for Referral", color: "#ff8c42" },
                  { k: "voicenote", icon: "🎙", label: "Voice Note",     color: "#8b7fff" },
                ] as const).map((b) => (
                  <Btn key={b.k} color={b.color} variant="ghost" size="sm" loading={nudgeLoading && nudgeKind === b.k} onClick={() => generateNudge(selected, b.k)}>
                    {b.icon} {b.label}
                  </Btn>
                ))}
              </div>
              {nudge && (
                <div className="p-3.5 rounded-lg bg-[#4ab3f4]/6 border border-[#4ab3f4]/20">
                  <div className="text-[10px] text-[#4ab3f4] font-bold tracking-wider mb-2">◈ NUDGE — {nudgeKind?.toUpperCase()}</div>
                  <div className="text-xs text-white-85 leading-relaxed whitespace-pre-wrap">{nudge}</div>
                  <div className="flex gap-2 mt-3">
                    <Btn color="#4ab3f4" variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(nudge); toast("Copied.", "success"); }}>📋 Copy</Btn>
                    <Btn color="#8b7fff" variant="ghost" size="sm" onClick={() => nudgeKind && generateNudge(selected, nudgeKind)}>↻ Regenerate</Btn>
                  </div>
                </div>
              )}
            </Card>

            {selected.notes && (
              <Card className="p-4">
                <div className="text-[10px] text-[#6aaedd] font-bold tracking-wider mb-2">NOTES</div>
                <div className="text-xs text-white-75 leading-relaxed">{selected.notes}</div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░░ SECTION 9 — MAIN MARKETING PANEL ░░░
   ═══════════════════════════════════════════════════════════════════════════ */

const MARKETING_TABS = [
  { id: "seo",       label: "SEO" },
  { id: "content",   label: "CONTENT" },
  { id: "leadgen",   label: "LEAD GEN" },
  { id: "keywords",  label: "KEYWORDS" },
  { id: "listings",  label: "LISTINGS" },
  { id: "campaigns", label: "CAMPAIGNS" },
  { id: "crm",       label: "CRM" },
  { id: "people",    label: "PEOPLE" },
] as const;

type MarketingTab = (typeof MARKETING_TABS)[number]["id"];

export default function MarketingPanel() {
  const [tab, setTab] = useState<MarketingTab>(() => {
    try {
      const saved = sessionStorage.getItem("marketing_tab");
      return (MARKETING_TABS.some((t) => t.id === saved) ? saved : "seo") as MarketingTab;
    } catch { return "seo"; }
  });

  useEffect(() => {
    try { sessionStorage.setItem("marketing_tab", tab); } catch { /* ignore */ }
  }, [tab]);

  return (
    <PanelLayout
      title="Marketing"
      subtitle="SEO · Content · Lead Gen · Keywords · Listings · Campaigns · CRM · People"
      icon={<Rocket size={18} />}
    >
      <div className="h-full flex flex-col gap-3.5">
        <Toasts />
        <div className="flex gap-1 shrink-0 overflow-x-auto">
          {MARKETING_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-display tracking-wider font-bold cursor-pointer whitespace-nowrap transition-all
                ${tab === t.id ? "glass-crimson text-[#ff4f5e]" : "glass text-white-40 hover:text-white-85"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {tab === "seo"       && <SeoTab />}
          {tab === "content"   && <ContentTab />}
          {tab === "leadgen"   && <LeadGenTab />}
          {tab === "keywords"  && <KeywordsTab />}
          {tab === "listings"  && <ListingsTab />}
          {tab === "campaigns" && <CampaignsTab />}
          {tab === "crm"       && <CRMTab />}
          {tab === "people"    && <PeopleCapitalTab />}
        </div>
      </div>
    </PanelLayout>
  );
}