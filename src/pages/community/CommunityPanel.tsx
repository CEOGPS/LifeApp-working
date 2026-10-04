import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Globe2, Search, MapPin, TrendingUp, Loader2, ExternalLink, Zap, Sparkles,
  Copy, Check, Download, Flame, Clock, X, AlertCircle, Bookmark,
  BookmarkCheck, Trash2, Target, DollarSign, MessageSquare, Filter,
} from "lucide-react";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { lifeosApi } from "@/lib/api.ts";

/* ─────────────────────────── Types ─────────────────────────── */

type Intent = "high" | "medium" | "low";
type Category =
  | "contractor" | "cleaning" | "landscaping" | "legal" | "tech"
  | "wellness" | "moving" | "auto" | "other";

interface SourceConfig {
  name: string;
  icon: string;
  site: string;
  weight: number;
  keywords: string[];
}

interface Lead {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  intent: Intent;
  score: number;
  category: Category;
  tags: string[];
  postedAt?: number;
  budget?: number;
  contactMethod?: "dm" | "comment" | "email" | "phone" | "unknown";
  saved: boolean;
}

interface Opportunity {
  name: string;
  need: string;
  angle: string;
  channel: string;
  urgency?: "high" | "medium" | "low";
  estimatedValue?: string;
  score?: number;
}

interface RawResult { title: string; url: string; snippet: string }

/* ─────────────────────────── Config ─────────────────────────── */

const SOURCES: SourceConfig[] = [
  { name: "Facebook Groups", icon: "🔵", site: "facebook.com",   weight: 0.9, keywords: ["recommendations", "looking for"] },
  { name: "Nextdoor",        icon: "🟢", site: "nextdoor.com",   weight: 1.0, keywords: ["recommend", "anyone know"] },
  { name: "LinkedIn",        icon: "💼", site: "linkedin.com",   weight: 1.1, keywords: ["hiring", "seeking"] },
  { name: "Craigslist",      icon: "🔴", site: "craigslist.org", weight: 0.8, keywords: ["gig", "wanted"] },
  { name: "Reddit",          icon: "🟠", site: "reddit.com",     weight: 0.9, keywords: ["recommendations", "ISO"] },
  { name: "Thumbtack",       icon: "🔨", site: "thumbtack.com",  weight: 0.9, keywords: ["request", "quote"] },
  { name: "Angi",            icon: "🏠", site: "angi.com",       weight: 0.8, keywords: ["hire", "quote"] },
];

const INTENT_PATTERNS: { re: RegExp; weight: number; intent: Intent }[] = [
  { re: /\b(looking for|need|seeking|searching for|in search of|iso)\b/i, weight: 30, intent: "high" },
  { re: /\b(recommend(?:ations?)?|any(?:one|body) know|suggestions?)\b/i, weight: 22, intent: "high" },
  { re: /\b(hire|hiring|book|schedule|quote|estimate)\b/i, weight: 25, intent: "high" },
  { re: /\b(who do you|where can i|know a guy)\b/i, weight: 20, intent: "medium" },
  { re: /\b(best|top rated|reliable|trustworthy)\b/i, weight: 12, intent: "medium" },
  { re: /\b(maybe|thinking about|considering|eventually)\b/i, weight: 6, intent: "low" },
];

const URGENCY_RE = /\b(asap|urgent|today|tomorrow|this week|emergency|now)\b/i;
const BUDGET_RE = /\$\s?([\d,]+(?:\.\d{1,2})?)(k)?/i;
const CONTACT_PATTERNS: { re: RegExp; m: NonNullable<Lead["contactMethod"]> }[] = [
  { re: /\bdm\b|\bmessage me\b|\bpm me\b/i, m: "dm" },
  { re: /\bcomment below\b|\breply here\b/i, m: "comment" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]+/, m: "email" },
  { re: /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/, m: "phone" },
];

const CATEGORY_PATTERNS: { cat: Category; re: RegExp }[] = [
  { cat: "contractor",  re: /\b(contractor|roof|plumb|electric|remodel|drywall|hvac)\b/i },
  { cat: "cleaning",    re: /\b(clean(?:er|ing)|maid|housekeep)\b/i },
  { cat: "landscaping", re: /\b(landscap|lawn|garden|tree (?:service|trim)|mow)\b/i },
  { cat: "legal",       re: /\b(attorney|lawyer|legal|paralegal)\b/i },
  { cat: "tech",        re: /\b(developer|web ?site|seo|it support|software|app)\b/i },
  { cat: "wellness",    re: /\b(therapist|massage|yoga|trainer|nutrition|coach)\b/i },
  { cat: "moving",      re: /\b(mov(?:er|ing)|haul|junk removal|storage)\b/i },
  { cat: "auto",        re: /\b(mechanic|auto repair|detail(?:ing)?|tire)\b/i },
];

/* ─────────────────────────── Helpers ─────────────────────────── */

const uid = (s: string) => s.replace(/\W+/g, "").slice(0, 40) + Math.random().toString(36).slice(2, 7);

function detectIntent(text: string): { intent: Intent; pts: number } {
  let pts = 0;
  let best: Intent = "low";
  for (const p of INTENT_PATTERNS) {
    if (p.re.test(text)) {
      pts += p.weight;
      if (p.intent === "high") best = "high";
      else if (p.intent === "medium" && best !== "high") best = "medium";
    }
  }
  if (URGENCY_RE.test(text)) pts += 18;
  return { intent: best, pts };
}

function detectCategory(text: string): Category {
  for (const c of CATEGORY_PATTERNS) if (c.re.test(text)) return c.cat;
  return "other";
}

function parseBudget(text: string): number | undefined {
  const m = text.match(BUDGET_RE);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isNaN(n) ? undefined : m[2] ? n * 1000 : n;
}

function detectContact(text: string): NonNullable<Lead["contactMethod"]> {
  for (const c of CONTACT_PATTERNS) if (c.re.test(text)) return c.m;
  return "unknown";
}

function scoreLead(text: string, sourceWeight: number, intentPts: number): number {
  let s = intentPts * 0.9;
  if (URGENCY_RE.test(text)) s += 15;
  if (BUDGET_RE.test(text)) s += 12;
  s *= sourceWeight;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function relTime(ms?: number): string {
  if (!ms) return "";
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function parseLLMJson(text: string): Opportunity[] {
  const cleaned = (text || "").replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr.map((o) =>
      typeof o === "string"
        ? { name: "", need: o, angle: "", channel: "" }
        : (o as Opportunity),
    );
  } catch { return []; }
}

function toLead(r: RawResult, source: string, weight: number): Lead {
  const text = `${r.title} ${r.snippet}`;
  const { intent, pts } = detectIntent(text);
  const category = detectCategory(text);
  const tags: string[] = [];
  if (URGENCY_RE.test(text)) tags.push("urgent");
  if (BUDGET_RE.test(text)) tags.push("budget");
  if (category !== "other") tags.push(category);
  return {
    id: uid(r.url || r.title),
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    source,
    intent,
    score: scoreLead(text, weight, pts),
    category,
    tags,
    budget: parseBudget(text),
    contactMethod: detectContact(text),
    saved: false,
  };
}

/* ─────────────────── Persistence ─────────────────── */

const LS_KEY = "community-hub:v1";
interface Persisted {
  selectedSources: string[];
  savedLeads: Lead[];
  dismissedIds: string[];
  sourceKeywords: Record<string, string[]>;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    selectedSources: ["Reddit", "Nextdoor", "LinkedIn"],
    savedLeads: [], dismissedIds: [], sourceKeywords: {},
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Persisted>) } : fallback;
  } catch { return fallback; }
}

function savePersisted(p: Persisted) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

/* ─────────────────── API ─────────────────── */

async function searchWeb(query: string, limit: number, signal?: AbortSignal): Promise<RawResult[]> {
  // lifeosApi.post() is (path, body) only; pass AbortSignal via the callable client.
  const res = await lifeosApi<{ results?: RawResult[] }>("/api/browse/search", {
    method: "POST",
    body: JSON.stringify({ query, limit }),
    signal,
  });
  return res.results ?? [];
}

/* ─────────────────────────── Main ─────────────────────────── */

export default function CommunityPanel() {
  const [tab, setTab] = useState<"scan" | "opportunity">("scan");
  const persistedRef = useRef(loadPersisted());

  const [selected, setSelected] = useState<Set<string>>(new Set(persistedRef.current.selectedSources));
  const [sourceKeywords, setSourceKeywords] = useState<Record<string, string[]>>(persistedRef.current.sourceKeywords);
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");

  const [location, setLocation] = useState("");
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [intentFilter, setIntentFilter] = useState<Intent | "all">("all");
  const [minScore, setMinScore] = useState(0);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [saved, setSaved] = useState<Lead[]>(persistedRef.current.savedLeads);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set(persistedRef.current.dismissedIds));

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    savePersisted({
      selectedSources: [...selected],
      savedLeads: saved,
      dismissedIds: [...dismissed],
      sourceKeywords,
    });
  }, [selected, saved, dismissed, sourceKeywords]);

  /* ── Derived ── */
  const visible = useMemo(() => {
    const f = filter.toLowerCase();
    return leads
      .filter((l) => {
        if (dismissed.has(l.id)) return false;
        if (showSavedOnly && !l.saved) return false;
        if (intentFilter !== "all" && l.intent !== intentFilter) return false;
        if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
        if (l.score < minScore) return false;
        if (f && !(l.title.toLowerCase().includes(f) || l.snippet.toLowerCase().includes(f))) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [leads, dismissed, filter, intentFilter, categoryFilter, minScore, showSavedOnly]);

  const stats = useMemo(() => {
    const all = leads.filter((l) => !dismissed.has(l.id));
    return {
      total: all.length,
      high: all.filter((l) => l.intent === "high").length,
      avg: all.length ? Math.round(all.reduce((s, l) => s + l.score, 0) / all.length) : 0,
    };
  }, [leads, dismissed]);

  const categoriesPresent = useMemo(() => {
    const set = new Set<Category>();
    leads.forEach((l) => l.category !== "other" && set.add(l.category));
    return [...set];
  }, [leads]);

  /* ── Handlers ── */
  const toggleSource = useCallback((name: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name); else n.add(name);
      return n;
    });
  }, []);

  const saveKeyword = useCallback((source: string) => {
    const k = keywordDraft.trim();
    if (!k) return;
    setSourceKeywords((prev) => ({
      ...prev,
      [source]: [...new Set([...(prev[source] ?? []), k])].slice(0, 8),
    }));
    setKeywordDraft("");
  }, [keywordDraft]);

  const removeKeyword = useCallback((source: string, k: string) => {
    setSourceKeywords((prev) => ({ ...prev, [source]: (prev[source] ?? []).filter((x) => x !== k) }));
  }, []);

  const toggleSave = useCallback((lead: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, saved: !l.saved } : l)));
    setSaved((prev) => {
      const exists = prev.find((l) => l.id === lead.id);
      return exists ? prev.filter((l) => l.id !== lead.id) : [...prev, { ...lead, saved: true }];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  }, []);

  /* ── Scan ── */
  const startScan = useCallback(async () => {
    if (!selected.size || scanning) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setScanning(true);
    setError(null);
    setLeads([]);
    setProgress("Building queries…");

    try {
      const active = SOURCES.filter((s) => selected.has(s.name));
      const loc = location.trim() || "near me";
      const siteClause = active.map((s) => `site:${s.site}`).join(" OR ");

      const queries: { q: string; source: string; weight: number }[] = [
        { q: `(${siteClause}) (recommend OR "looking for" OR hire OR ISO) ${loc}`, source: "Mixed", weight: 0.9 },
      ];
      for (const s of active) {
        const kws = [...(sourceKeywords[s.name] ?? []), ...s.keywords].slice(0, 2);
        for (const k of kws) queries.push({ q: `site:${s.site} ${k} ${loc}`, source: s.name, weight: s.weight });
      }

      const collected: Lead[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < queries.length; i += 3) {
        if (ctrl.signal.aborted) break;
        const batch = queries.slice(i, i + 3);
        setProgress(`Scanning ${i + 1}–${Math.min(i + 3, queries.length)} of ${queries.length}…`);
        const settled = await Promise.allSettled(
          batch.map((b) => searchWeb(b.q, 10, ctrl.signal).then((rs) => rs.map((r) => toLead(r, b.source, b.weight)))),
        );
        for (const s of settled) {
          if (s.status !== "fulfilled") continue;
          for (const l of s.value) {
            if (seen.has(l.url)) continue;
            seen.add(l.url);
            collected.push(l);
          }
        }
        setLeads([...collected].sort((a, b) => b.score - a.score));
      }
    } catch (e) {
      const err = e as Error;
      if (err.name !== "AbortError") setError(err.message || "Scan failed.");
    } finally {
      setScanning(false);
      setProgress("");
    }
  }, [selected, scanning, location, sourceKeywords]);

  const cancelScan = () => { abortRef.current?.abort(); setScanning(false); setProgress(""); };

  /* ── Opportunity Engine ── */
  const runOpportunityEngine = useCallback(async () => {
    setAnalyzing(true);
    setOpportunities([]);
    setError(null);
    try {
      let base = leads.filter((l) => !dismissed.has(l.id));
      if (!base.length) {
        const rs = await searchWeb(`site:nextdoor.com OR site:reddit.com (recommend OR "looking for") near me`, 8);
        base = rs.map((r) => toLead(r, "Mixed", 0.9));
        setLeads(base.sort((a, b) => b.score - a.score));
      }
      const payload = base.slice(0, 10).map((l) => ({
        title: l.title, snippet: l.snippet.slice(0, 200),
        source: l.source, intent: l.intent, score: l.score, category: l.category,
      }));
      const prompt = `You are a lead-gen analyst. From the community mentions below, identify the 3–5 WARMEST service leads.
For each return JSON: {"name":"", "need":"", "angle":"", "channel":"dm|comment|email|phone", "urgency":"high|medium|low", "estimatedValue":"", "score":0}
Return ONLY a JSON array. Mentions: ${JSON.stringify(payload)}`;

      const data = await lifeosApi.post<{ text?: string }>("/api/llm/invoke", { prompt, max_tokens: 600 })
        .catch(() => ({ text: "[]" }));
      setOpportunities(parseLLMJson(data.text ?? "[]"));
    } catch (e) {
      setError((e as Error).message || "Opportunity engine failed.");
    } finally {
      setAnalyzing(false);
    }
  }, [leads, dismissed]);

  /* ── Export ── */
  const exportCsv = useCallback(() => {
    const rows: (string | number)[][] = [
      ["score", "intent", "category", "source", "title", "url", "snippet", "budget", "contact"],
      ...visible.map((l) => [l.score, l.intent, l.category, l.source, l.title, l.url, l.snippet.replace(/\n/g, " "), l.budget ?? "", l.contactMethod ?? ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `community-leads-${Date.now()}.csv`;
    a.click();
  }, [visible]);

  const copyOpp = useCallback((o: Opportunity, i: number) => {
    const text = `${o.name || "Lead"} — ${o.need}\nAngle: ${o.angle}\nChannel: ${o.channel}` +
      (o.estimatedValue ? `\nEst. value: ${o.estimatedValue}` : "");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }, []);

  /* ─────────────────────── Render ─────────────────────── */

  return (
    <PanelLayout
      title="Leads"
      subtitle="Community leads and the opportunity engine"
      icon={<Globe2 size={18} />}
    >
      <div className="cp-root">
        <style>{COMMUNITY_CSS}</style>
        {/* Tabs */}
        <div className="cp-tabs">
          {([
            { id: "scan", label: "Lead Scanner", icon: <Search size={11} /> },
            { id: "opportunity", label: "Opportunity Engine", icon: <Zap size={11} /> },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`cp-tab ${tab === t.id ? "cp-tab--active" : ""}`}
            >
              {t.icon} {t.label.toUpperCase()}
            </button>
          ))}
          {tab === "scan" && leads.length > 0 && (
            <button onClick={exportCsv} className="cp-tab cp-tab--ghost cp-ml-auto">
              <Download size={11} /> EXPORT CSV
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="cp-error">
            <AlertCircle size={12} />
            <span className="cp-error__msg">{error}</span>
            <button onClick={() => setError(null)} className="cp-icon-btn" aria-label="Dismiss">
              <X size={12} />
            </button>
          </div>
        )}

        {tab === "opportunity" ? (
          <OpportunityPanel
            analyzing={analyzing}
            opportunities={opportunities}
            copiedIdx={copiedIdx}
            contextCount={leads.length}
            onRun={runOpportunityEngine}
            onCopy={copyOpp}
          />
        ) : (
          <div className="cp-grid">
            <Sidebar
              sources={SOURCES}
              selected={selected}
              onToggle={toggleSource}
              sourceKeywords={sourceKeywords}
              editingSource={editingSource}
              setEditingSource={setEditingSource}
              keywordDraft={keywordDraft}
              setKeywordDraft={setKeywordDraft}
              onSaveKeyword={saveKeyword}
              onRemoveKeyword={removeKeyword}
              location={location}
              setLocation={setLocation}
              scanning={scanning}
              progress={progress}
              onScan={startScan}
              onCancel={cancelScan}
              stats={stats}
            />

            <section className="cp-results">
              <ResultsToolbar
                filter={filter} setFilter={setFilter}
                intentFilter={intentFilter} setIntentFilter={setIntentFilter}
                categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
                categoriesPresent={categoriesPresent}
                minScore={minScore} setMinScore={setMinScore}
                showSavedOnly={showSavedOnly} setShowSavedOnly={setShowSavedOnly}
              />

              {visible.length === 0 ? (
                <EmptyState scanning={scanning} hasLeads={leads.length > 0} />
              ) : (
                <div className="cp-list">
                  {visible.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      sourceIcon={SOURCES.find((s) => s.name === l.source)?.icon ?? "🌐"}
                      onSave={() => toggleSave(l)}
                      onDismiss={() => dismiss(l.id)}
                    />
                  ))}
                </div>
              )}

              {visible.length > 0 && (
                <footer className="cp-footer">
                  <span>{visible.length} shown</span>
                  <span className="cp-dot">·</span>
                  <span>{stats.total} total</span>
                  <span className="cp-dot">·</span>
                  <span className="cp-footer__hot">{stats.high} hot</span>
                </footer>
              )}
            </section>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}

const COMMUNITY_CSS = `
.cp-root{color:#e4e4e7;font-size:13px}
.cp-tabs{display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.cp-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid #27272a;background:#09090b;color:#a1a1aa;border-radius:999px;padding:6px 12px;font-size:11px;letter-spacing:.08em}
.cp-tab--active{border-color:#0284c7;background:#082f49;color:#e0f2fe}
.cp-tab--ghost{background:transparent}
.cp-ml-auto{margin-left:auto}
.cp-error{display:flex;align-items:center;gap:8px;border:1px solid #7f1d1d;background:#450a0a;color:#fecaca;border-radius:8px;padding:8px 10px;margin-bottom:12px}
.cp-error__msg{flex:1}
.cp-grid{display:grid;grid-template-columns:280px 1fr;gap:14px;align-items:start}
@media(max-width:900px){.cp-grid{grid-template-columns:1fr}}
.cp-sidebar{display:flex;flex-direction:column;gap:10px}
.cp-card{border:1px solid #27272a;background:rgba(24,24,27,.72);border-radius:12px;padding:12px}
.cp-card--fill{min-height:420px}
.cp-card__head{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.14em;color:#71717a;margin-bottom:8px}
.cp-card__count{color:#7dd3fc}
.cp-source{border-top:1px solid #27272a}
.cp-source__row{width:100%;display:flex;align-items:center;gap:8px;background:transparent;color:inherit;border:0;padding:8px 0;text-align:left;cursor:pointer}
.cp-source__name{flex:1;color:#a1a1aa}
.cp-source__name--on{color:#f4f4f5}
.cp-source__gear{color:#52525b;font-size:12px}
.cp-dot-indicator{width:8px;height:8px;border-radius:99px;background:#3f3f46}
.cp-dot-indicator--on{background:#38bdf8;box-shadow:0 0 8px #38bdf8}
.cp-source__editor{padding:0 0 8px 28px}
.cp-chip-row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.cp-chip{display:inline-flex;align-items:center;gap:4px;background:#082f49;color:#bae6fd;border-radius:99px;padding:2px 8px;font-size:11px}
.cp-chip__x{background:none;border:0;color:#7dd3fc;cursor:pointer}
.cp-input{width:100%;background:#000;border:1px solid #3f3f46;border-radius:8px;color:#f4f4f5;padding:6px 8px}
.cp-input--tiny{font-size:12px}
.cp-input--bare{border:0;background:transparent;padding:4px}
.cp-row{display:flex;align-items:center;gap:6px}
.cp-row--tight{gap:6px}
.cp-icon-accent{color:#38bdf8}
.cp-icon-muted{color:#71717a}
.cp-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;border-radius:8px;padding:8px 10px;font-size:11px;letter-spacing:.08em;border:1px solid #27272a;cursor:pointer}
.cp-btn--primary{background:#0369a1;border-color:#0284c7;color:#fff}
.cp-btn--primary:disabled{opacity:.4;cursor:not-allowed}
.cp-btn--danger{background:#450a0a;border-color:#7f1d1d;color:#fecaca}
.cp-progress{font-size:11px;color:#7dd3fc}
.cp-stat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.cp-stat{text-align:center}
.cp-stat__value{font-size:18px;color:#f4f4f5}
.cp-stat__value--accent{color:#38bdf8}
.cp-stat__label{font-size:10px;letter-spacing:.08em;color:#71717a}
.cp-results{min-width:0}
.cp-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.cp-toolbar__search{display:flex;align-items:center;gap:6px;flex:1;min-width:180px;border:1px solid #27272a;border-radius:8px;padding:0 8px;background:#09090b}
.cp-select{background:#09090b;color:#e4e4e7;border:1px solid #27272a;border-radius:8px;padding:6px 8px}
.cp-range{accent-color:#0284c7}
.cp-range__value{font-size:11px;color:#7dd3fc;width:24px}
.cp-toggle{border:1px solid #27272a;background:#09090b;color:#a1a1aa;border-radius:999px;padding:6px 10px;font-size:11px}
.cp-toggle--on{border-color:#0284c7;color:#e0f2fe;background:#082f49}
.cp-list{display:flex;flex-direction:column;gap:8px}
.cp-lead{display:flex;gap:10px;border:1px solid #27272a;background:rgba(9,9,11,.8);border-radius:12px;padding:12px}
.cp-lead:hover{border-color:#0369a1}
.cp-lead__main{display:flex;gap:10px;flex:1;min-width:0}
.cp-lead__icon{font-size:18px}
.cp-lead__body{flex:1;min-width:0}
.cp-lead__top{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.cp-lead__title{color:#f4f4f5;text-decoration:none;font-weight:600}
.cp-lead__title:hover{color:#7dd3fc}
.cp-lead__snippet{color:#a1a1aa;margin:6px 0}
.cp-lead__tags{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.cp-lead__source,.cp-lead__time,.cp-lead__contact{font-size:11px;color:#71717a}
.cp-lead__actions{display:flex;flex-direction:column;gap:6px}
.cp-badge{font-size:10px;border-radius:999px;padding:2px 6px;border:1px solid #3f3f46;color:#d4d4d8}
.cp-badge--intent-high,.cp-badge--urgency-high,.cp-badge--urgent{border-color:#b91c1c;color:#fca5a5}
.cp-badge--intent-medium,.cp-badge--urgency-medium{border-color:#a16207;color:#fde68a}
.cp-badge--intent-low,.cp-badge--urgency-low{border-color:#166534;color:#86efac}
.cp-badge--score{border-color:#0369a1;color:#7dd3fc}
.cp-badge--budget{border-color:#047857;color:#6ee7b7}
.cp-icon-btn{background:transparent;border:1px solid #27272a;color:#a1a1aa;border-radius:8px;padding:6px;cursor:pointer}
.cp-icon-btn--active{color:#38bdf8;border-color:#0284c7}
.cp-icon-btn--danger:hover{color:#fca5a5}
.cp-footer{display:flex;gap:8px;margin-top:10px;font-size:11px;color:#71717a}
.cp-footer__hot{color:#fca5a5}
.cp-empty,.cp-opp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:240px;color:#71717a;text-align:center}
.cp-empty__title{color:#e4e4e7}
.cp-empty__icon{color:#334155}
.cp-spin{animation:cp-spin 1s linear infinite}
@keyframes cp-spin{to{transform:rotate(360deg)}}
.cp-opp-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.cp-opp-header__title{letter-spacing:.12em;font-size:11px}
.cp-opp-header__context{color:#71717a;font-size:11px}
.cp-opp-header .cp-btn{width:auto}
.cp-opp{display:flex;gap:10px;border:1px solid #27272a;border-radius:12px;padding:12px;margin-bottom:8px;background:#09090b}
.cp-opp__body{flex:1}
.cp-opp__top{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.cp-opp__name{font-weight:600}
.cp-opp__need{margin:6px 0;color:#d4d4d8}
.cp-opp__angle{color:#7dd3fc;font-size:12px}
.cp-opp__foot{display:flex;justify-content:space-between;align-items:center;color:#71717a;font-size:11px}
.cp-opp__copy{background:transparent;border:0;color:#7dd3fc;cursor:pointer}
.cp-opp__icon{color:#38bdf8}
`;

/* ─────────────────── Subcomponents ─────────────────── */

function Sidebar({
  sources, selected, onToggle,
  sourceKeywords, editingSource, setEditingSource,
  keywordDraft, setKeywordDraft, onSaveKeyword, onRemoveKeyword,
  location, setLocation,
  scanning, progress, onScan, onCancel,
  stats,
}: {
  sources: SourceConfig[];
  selected: Set<string>;
  onToggle: (n: string) => void;
  sourceKeywords: Record<string, string[]>;
  editingSource: string | null;
  setEditingSource: (s: string | null) => void;
  keywordDraft: string;
  setKeywordDraft: (s: string) => void;
  onSaveKeyword: (s: string) => void;
  onRemoveKeyword: (s: string, k: string) => void;
  location: string;
  setLocation: (s: string) => void;
  scanning: boolean;
  progress: string;
  onScan: () => void;
  onCancel: () => void;
  stats: { total: number; high: number; avg: number };
}) {
  return (
    <aside className="cp-sidebar">
      <div className="cp-card">
        <div className="cp-card__head">
          <span>SCAN SOURCES</span>
          <span className="cp-card__count">{selected.size}/{sources.length}</span>
        </div>
        {sources.map((s) => {
          const on = selected.has(s.name);
          const editing = editingSource === s.name;
          return (
            <div key={s.name} className="cp-source">
              <button className="cp-source__row" onClick={() => onToggle(s.name)}>
                <span className="cp-source__icon">{s.icon}</span>
                <span className={`cp-source__name ${on ? "cp-source__name--on" : ""}`}>{s.name}</span>
                <span
                  className="cp-source__gear"
                  onClick={(e) => { e.stopPropagation(); setEditingSource(editing ? null : s.name); }}
                  role="button"
                  aria-label="Edit keywords"
                >⚙</span>
                <span className={`cp-dot-indicator ${on ? "cp-dot-indicator--on" : ""}`} />
              </button>
              {editing && (
                <div className="cp-source__editor">
                  <div className="cp-chip-row">
                    {(sourceKeywords[s.name] ?? []).map((k) => (
                      <span key={k} className="cp-chip">
                        {k}
                        <button className="cp-chip__x" onClick={() => onRemoveKeyword(s.name, k)}>×</button>
                      </span>
                    ))}
                  </div>
                  <input
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSaveKeyword(s.name)}
                    placeholder="add keyword…"
                    className="cp-input cp-input--tiny"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="cp-card">
        <div className="cp-card__head">LOCATION</div>
        <div className="cp-row">
          <MapPin size={11} className="cp-icon-accent" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or zip…"
            className="cp-input cp-input--bare"
          />
        </div>
      </div>

      {scanning ? (
        <button onClick={onCancel} className="cp-btn cp-btn--danger">
          <X size={12} /> CANCEL SCAN
        </button>
      ) : (
        <button onClick={onScan} disabled={!selected.size} className="cp-btn cp-btn--primary">
          <Search size={12} /> START SCAN
        </button>
      )}
      {scanning && progress && <div className="cp-progress">{progress}</div>}

      {stats.total > 0 && (
        <div className="cp-card">
          <div className="cp-card__head">SIGNAL</div>
          <div className="cp-stat-grid">
            <Stat label="Leads" value={stats.total} />
            <Stat label="Hot" value={stats.high} accent />
            <Stat label="Avg" value={stats.avg} />
          </div>
        </div>
      )}
    </aside>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="cp-stat">
      <div className={`cp-stat__value ${accent ? "cp-stat__value--accent" : ""}`}>{value}</div>
      <div className="cp-stat__label">{label}</div>
    </div>
  );
}

function ResultsToolbar(props: {
  filter: string; setFilter: (s: string) => void;
  intentFilter: Intent | "all"; setIntentFilter: (s: Intent | "all") => void;
  categoryFilter: Category | "all"; setCategoryFilter: (s: Category | "all") => void;
  categoriesPresent: Category[];
  minScore: number; setMinScore: (n: number) => void;
  showSavedOnly: boolean; setShowSavedOnly: (b: boolean) => void;
}) {
  const {
    filter, setFilter, intentFilter, setIntentFilter,
    categoryFilter, setCategoryFilter, categoriesPresent,
    minScore, setMinScore, showSavedOnly, setShowSavedOnly,
  } = props;

  return (
    <div className="cp-toolbar">
      <div className="cp-toolbar__search">
        <Search size={12} className="cp-icon-muted" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter results…"
          className="cp-input cp-input--bare"
        />
      </div>

      <select value={intentFilter} onChange={(e) => setIntentFilter(e.target.value as Intent | "all")} className="cp-select">
        <option value="all">All intents</option>
        <option value="high">High intent</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as Category | "all")} className="cp-select">
        <option value="all">All categories</option>
        {categoriesPresent.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <div className="cp-row cp-row--tight">
        <Flame size={11} className="cp-icon-accent" />
        <input
          type="range" min={0} max={100} value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="cp-range"
        />
        <span className="cp-range__value">{minScore}</span>
      </div>

      <button
        onClick={() => setShowSavedOnly(!showSavedOnly)}
        className={`cp-toggle ${showSavedOnly ? "cp-toggle--on" : ""}`}
      >
        <Bookmark size={10} /> saved
      </button>
    </div>
  );
}

function LeadCard({
  lead, sourceIcon, onSave, onDismiss,
}: {
  lead: Lead;
  sourceIcon: string;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <article className="cp-lead">
      <div className="cp-lead__main">
        <span className="cp-lead__icon">{sourceIcon}</span>
        <div className="cp-lead__body">
          <div className="cp-lead__top">
            <a href={lead.url} target="_blank" rel="noreferrer" className="cp-lead__title">
              {lead.title}
            </a>
            <ExternalLink size={9} className="cp-icon-muted" />
            <span className={`cp-badge cp-badge--intent-${lead.intent}`}>{lead.intent.toUpperCase()}</span>
            <span className="cp-badge cp-badge--score">{lead.score}</span>
            {lead.postedAt && (
              <span className="cp-lead__time">
                <Clock size={8} /> {relTime(lead.postedAt)}
              </span>
            )}
          </div>
          <p className="cp-lead__snippet">{lead.snippet}</p>
          <div className="cp-lead__tags">
            <span className="cp-lead__source">{lead.source}</span>
            {lead.category !== "other" && <span className="cp-badge cp-badge--category">{lead.category}</span>}
            {lead.tags.includes("urgent") && <span className="cp-badge cp-badge--urgent">urgent</span>}
            {lead.budget !== undefined && (
              <span className="cp-badge cp-badge--budget">
                <DollarSign size={8} />{lead.budget}
              </span>
            )}
            {lead.contactMethod && lead.contactMethod !== "unknown" && (
              <span className="cp-lead__contact">via {lead.contactMethod}</span>
            )}
          </div>
        </div>
        <div className="cp-lead__actions">
          <button
            onClick={onSave}
            aria-label={lead.saved ? "Unsave" : "Save"}
            className={`cp-icon-btn ${lead.saved ? "cp-icon-btn--active" : ""}`}
          >
            {lead.saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
          </button>
          <button onClick={onDismiss} aria-label="Dismiss" className="cp-icon-btn cp-icon-btn--danger">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </article>
  );
}

function OpportunityPanel({
  analyzing, opportunities, copiedIdx, contextCount, onRun, onCopy,
}: {
  analyzing: boolean;
  opportunities: Opportunity[];
  copiedIdx: number | null;
  contextCount: number;
  onRun: () => void;
  onCopy: (o: Opportunity, i: number) => void;
}) {
  return (
    <section className="cp-card cp-card--fill">
      <header className="cp-opp-header">
        <Zap size={13} className="cp-icon-accent" />
        <span className="cp-opp-header__title">OPPORTUNITY ENGINE</span>
        <span className="cp-opp-header__context">
          {contextCount ? `${contextCount} leads in context` : "will scan first"}
        </span>
        <button onClick={onRun} disabled={analyzing} className="cp-btn cp-btn--primary cp-ml-auto">
          {analyzing ? <Loader2 size={11} className="cp-spin" /> : <Sparkles size={11} />}
          {analyzing ? "ANALYZING…" : "SURFACE WARM LEADS"}
        </button>
      </header>

      <div className="cp-opp-body">
        {analyzing && <div className="cp-opp-empty">Scoring community mentions & drafting outreach angles…</div>}

        {!analyzing && opportunities.length === 0 && (
          <div className="cp-empty">
            <Zap size={24} className="cp-empty__icon" />
            <div className="cp-empty__title">AI surfaces warm leads from local chatter</div>
            <div className="cp-empty__hint">Run the engine to get scored opportunities with outreach angles</div>
          </div>
        )}

        {opportunities.map((o, i) => (
          <article key={i} className="cp-opp">
            <Sparkles size={13} className="cp-opp__icon" />
            <div className="cp-opp__body">
              <div className="cp-opp__top">
                {o.name && <span className="cp-opp__name">{o.name}</span>}
                {o.urgency && <span className={`cp-badge cp-badge--urgency-${o.urgency}`}>{o.urgency.toUpperCase()}</span>}
                {typeof o.score === "number" && <span className="cp-badge cp-badge--score">{o.score}</span>}
                {o.estimatedValue && (
                  <span className="cp-opp__value"><DollarSign size={9} />{o.estimatedValue}</span>
                )}
              </div>
              <p className="cp-opp__need">{o.need}</p>
              {o.angle && (
                <div className="cp-opp__angle">
                  <Target size={10} /> <span>{o.angle}</span>
                </div>
              )}
              <div className="cp-opp__foot">
                {o.channel && <span className="cp-opp__channel"><MessageSquare size={9} /> via {o.channel}</span>}
                <button onClick={() => onCopy(o, i)} className="cp-opp__copy">
                  {copiedIdx === i ? <><Check size={10} /> copied</> : <><Copy size={10} /> copy</>}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ scanning, hasLeads }: { scanning: boolean; hasLeads: boolean }) {
  return (
    <div className="cp-empty">
      {scanning ? (
        <>
          <Loader2 size={22} className="cp-empty__icon cp-spin" />
          <div className="cp-empty__title">Scanning sources…</div>
        </>
      ) : (
        <>
          <TrendingUp size={24} className="cp-empty__icon" />
          <div className="cp-empty__title">{hasLeads ? "No leads match filters" : "No scan results yet"}</div>
          <div className="cp-empty__hint">
            {hasLeads ? "Loosen score/category filters" : "Pick sources and run a scan"}
          </div>
        </>
      )}
    </div>
  );
}

export { Filter };