import { useEffect, useMemo, useState } from "react";

type Tab =
  | "seo"
  | "audit"
  | "ranks"
  | "keywords"
  | "competitors"
  | "automation"
  | "content"
  | "intel"
  | "assets"
  | "leads"
  | "tracker"
  | "listings";

type SeoJob = { id: string; company: string; website: string; city: string; focus: string; notes: string };
type Audit = { id: string; url: string; notes: string; checks: Record<string, boolean> };
type Rank = { id: string; keyword: string; url: string; position: string; checked: string };
type Keyword = { id: string; term: string; intent: string; volume: string; client: string };
type Competitor = { id: string; name: string; url: string; ranksFor: string; gap: string };
type Flow = { id: string; name: string; client: string; trigger: string; steps: string; active: boolean };
type Draft = { id: string; title: string; kind: string; client: string; body: string };
type Intel = { id: string; client: string; pains: string; objections: string; offer: string };
type Asset = { id: string; name: string; kind: string; client: string; url: string; tags: string };
type Client = { id: string; name: string; trade: string; city: string; services: string; website: string };
type FoundLead = { id: string; clientId: string; title: string; url: string; snippet: string; source: string; score: number; intent: string; saved: boolean };
type Listing = { id: string; client: string; directory: string; url: string; status: string; nap: string };
type TrackedLead = { id: string; name: string; phone: string; email: string; client: string; source: string; status: string; value: string; next: string; notes: string };

type Store = {
  seo: SeoJob[];
  audits: Audit[];
  ranks: Rank[];
  keywords: Keyword[];
  competitors: Competitor[];
  flows: Flow[];
  content: Draft[];
  intel: Intel[];
  assets: Asset[];
  clients: Client[];
  found: FoundLead[];
  tracked: TrackedLead[];
  listings: Listing[];
};

const KEY = "lifeos_marketing_suite_v2";
const WORKER =
  (import.meta as ImportMeta & { env?: { VITE_WORKER_URL?: string } }).env?.VITE_WORKER_URL ||
  "https://lifeos1-api.ceogps.workers.dev";

const TABS: { id: Tab; label: string }[] = [
  { id: "seo", label: "SEO Tools" },
  { id: "audit", label: "Site Audit" },
  { id: "ranks", label: "Rank Tracking" },
  { id: "keywords", label: "Keyword Tool" },
  { id: "competitors", label: "Competitor Analysis" },
  { id: "automation", label: "Marketing Automation" },
  { id: "content", label: "Content Creation" },
  { id: "intel", label: "Customer Intelligence" },
  { id: "assets", label: "Digital Assets" },
  { id: "leads", label: "AI Lead Generator" },
  { id: "tracker", label: "Lead Tracker" },
  { id: "listings", label: "Business Listings" },
];

const AUDIT_CHECKS = [
  "Unique title tag",
  "Meta description",
  "One H1",
  "HTTPS",
  "Mobile friendly",
  "Sitemap linked",
  "Page is indexable",
  "NAP on the page",
  "Local service pages",
  "Click-to-call",
];

const SOURCES = [
  { name: "Facebook Groups", site: "facebook.com" },
  { name: "Nextdoor", site: "nextdoor.com" },
  { name: "Reddit", site: "reddit.com" },
  { name: "Craigslist", site: "craigslist.org" },
  { name: "Thumbtack", site: "thumbtack.com" },
  { name: "Angi", site: "angi.com" },
  { name: "LinkedIn", site: "linkedin.com" },
];

const DIRECTORIES = ["Google Business", "Bing Places", "Apple Maps", "Yelp", "Facebook", "BBB", "Angi", "Nextdoor"];
const STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"];

function empty(): Store {
  return { seo: [], audits: [], ranks: [], keywords: [], competitors: [], flows: [], content: [], intel: [], assets: [], clients: [], found: [], tracked: [], listings: [] };
}

function load(): Store {
  try {
    return { ...empty(), ...(JSON.parse(localStorage.getItem(KEY) || "null") || {}) };
  } catch {
    return empty();
  }
}

function scoreText(text: string) {
  let score = 20;
  let intent = "low";
  if (/\b(looking for|need|hire|quote|asap|emergency)\b/i.test(text)) { score += 40; intent = "high"; }
  else if (/\b(recommend|best|anyone know)\b/i.test(text)) { score += 25; intent = "medium"; }
  if (/\$\s?\d/.test(text)) score += 10;
  return { score: Math.min(100, score), intent };
}

const input = "rounded border border-sky-500/30 bg-black px-3 py-2 text-sm text-white";
const btn = "rounded bg-sky-600 px-3 py-2 text-sm text-white";

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>("seo");
  const [store, setStore] = useState<Store>(load);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<string[]>(["Nextdoor", "Reddit", "Facebook Groups"]);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(store)); }, [store]);

  const set = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const field = (key: string, placeholder: string) => (
    <input className={input} value={draft[key] || ""} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
  );
  const add = <K extends keyof Store>(key: K, row: Store[K][number], required?: string) => {
    if (required !== undefined && !required.trim()) return;
    setStore((s) => ({ ...s, [key]: [row, ...s[key]] }));
  };
  const remove = (key: keyof Store, id: string) => {
    setStore((s) => ({ ...s, [key]: (s[key] as { id: string }[]).filter((row) => row.id !== id) }));
  };

  const client = store.clients.find((c) => c.id === draft.clientId) || store.clients[0];
  const clientLeads = store.found.filter((lead) => !client || lead.clientId === client.id);

  const queries = useMemo(() => {
    if (!client) return [];
    const city = client.city || "Atlanta";
    const services = client.services.split(",").map((s) => s.trim()).filter(Boolean);
    const seeds = services.length ? services : [client.trade || "contractor"];
    const active = SOURCES.filter((s) => sources.includes(s.name));
    return seeds.flatMap((service) => active.map((source) => ({
      source: source.name,
      q: `site:${source.site} ("looking for" OR recommend OR hire) "${service}" ${city}`,
    })));
  }, [client, sources]);

  async function scan() {
    if (!client) { setScanNote("Set up a client first."); return; }
    setScanning(true);
    setScanNote("Scanning the sources for this client…");
    const found: FoundLead[] = [];
    try {
      for (const query of queries.slice(0, 8)) {
        const response = await fetch(`${WORKER}/api/browse/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": "lifeos-local" },
          body: JSON.stringify({ query: query.q, limit: 5 }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `Search returned ${response.status}`);
        for (const row of body.results || []) {
          const text = `${row.title || ""} ${row.snippet || ""}`;
          const scored = scoreText(text);
          found.push({
            id: crypto.randomUUID(),
            clientId: client.id,
            title: row.title || query.q,
            url: row.url || "",
            snippet: row.snippet || "",
            source: query.source,
            score: scored.score,
            intent: scored.intent,
            saved: false,
          });
        }
      }
      setStore((s) => ({ ...s, found: [...found, ...s.found] }));
      setScanNote(found.length ? `Added ${found.length} leads for ${client.name}.` : "The search ran and returned no leads.");
    } catch (error) {
      setScanNote(error instanceof Error ? error.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <main className="min-h-full bg-black p-4 text-sky-50">
      <h1 className="text-2xl font-semibold text-white">Marketing</h1>
      <p className="mb-3 text-sm text-sky-200/60">Every tool below is on this page. Click a tab to open it. Work is saved in this browser.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded px-3 py-2 text-sm ${tab === item.id ? "bg-sky-600 text-white" : "border border-sky-500/30 text-sky-100"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "seo" && (
        <section className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("seoCompany", "Company")}
            {field("seoSite", "Website")}
            {field("seoCity", "City")}
            {field("seoFocus", "Focus: local, technical, content")}
            <button type="button" className={btn} onClick={() => add("seo", { id: crypto.randomUUID(), company: draft.seoCompany || "", website: draft.seoSite || "", city: draft.seoCity || "", focus: draft.seoFocus || "", notes: "" }, draft.seoCompany || "")}>Save SEO job</button>
          </div>
          {store.seo.map((job) => (
            <div key={job.id} className="rounded border border-sky-500/25 p-3">
              <div className="font-medium text-white">{job.company} · {job.website} · {job.city}</div>
              <div className="text-sky-200/70">Focus: {job.focus || "general"}</div>
              <textarea className={`${input} mt-2 w-full`} placeholder="Plan, fixes, and next actions" value={job.notes} onChange={(e) => setStore((s) => ({ ...s, seo: s.seo.map((row) => row.id === job.id ? { ...row, notes: e.target.value } : row) }))} />
              <button type="button" className="mt-2 text-red-300" onClick={() => remove("seo", job.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "audit" && (
        <section className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("auditUrl", "https://www.ceogps.com")}
            <button type="button" className={btn} onClick={() => {
              const checks: Record<string, boolean> = {};
              AUDIT_CHECKS.forEach((c) => { checks[c] = false; });
              add("audits", { id: crypto.randomUUID(), url: draft.auditUrl || "", notes: "", checks }, draft.auditUrl || "");
            }}>Start audit</button>
          </div>
          {store.audits.map((audit) => {
            const done = Object.values(audit.checks).filter(Boolean).length;
            return (
              <div key={audit.id} className="rounded border border-sky-500/25 p-3">
                <div className="mb-2 flex justify-between"><span>{audit.url}</span><span>{done}/{AUDIT_CHECKS.length}</span></div>
                <div className="flex flex-wrap gap-3">
                  {AUDIT_CHECKS.map((check) => (
                    <label key={check} className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={!!audit.checks[check]} onChange={(e) => setStore((s) => ({ ...s, audits: s.audits.map((row) => row.id === audit.id ? { ...row, checks: { ...row.checks, [check]: e.target.checked } } : row) }))} />
                      {check}
                    </label>
                  ))}
                </div>
                <textarea className={`${input} mt-2 w-full`} placeholder="What failed and the fix" value={audit.notes} onChange={(e) => setStore((s) => ({ ...s, audits: s.audits.map((row) => row.id === audit.id ? { ...row, notes: e.target.value } : row) }))} />
                <button type="button" className="mt-2 text-red-300" onClick={() => remove("audits", audit.id)}>Delete</button>
              </div>
            );
          })}
        </section>
      )}

      {tab === "ranks" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("rankKw", "Keyword")}
            {field("rankUrl", "URL that ranks")}
            {field("rankPos", "Position")}
            <button type="button" className={btn} onClick={() => add("ranks", { id: crypto.randomUUID(), keyword: draft.rankKw || "", url: draft.rankUrl || "", position: draft.rankPos || "", checked: new Date().toLocaleDateString() }, draft.rankKw || "")}>Log rank</button>
          </div>
          {store.ranks.map((row) => (
            <div key={row.id} className="flex flex-wrap gap-3 rounded border border-sky-500/20 p-2">
              <span className="min-w-40 flex-1">{row.keyword}</span><span>#{row.position || "—"}</span><span className="text-sky-200/60">{row.url}</span><span>{row.checked}</span>
              <button type="button" className="text-red-300" onClick={() => remove("ranks", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "keywords" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("kw", "Keyword")}
            {field("kwIntent", "Intent")}
            {field("kwVol", "Volume")}
            {field("kwClient", "Client")}
            <button type="button" className={btn} onClick={() => add("keywords", { id: crypto.randomUUID(), term: draft.kw || "", intent: draft.kwIntent || "", volume: draft.kwVol || "", client: draft.kwClient || "" }, draft.kw || "")}>Add keyword</button>
          </div>
          {store.keywords.map((row) => (
            <div key={row.id} className="flex flex-wrap gap-3 rounded border border-sky-500/20 p-2">
              <span className="flex-1">{row.term}</span><span>{row.intent}</span><span>{row.volume}</span><span>{row.client}</span>
              <button type="button" className="text-red-300" onClick={() => remove("keywords", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "competitors" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("cName", "Competitor")}
            {field("cUrl", "Website")}
            {field("cRanks", "What they rank for")}
            {field("cGap", "Gap you can take")}
            <button type="button" className={btn} onClick={() => add("competitors", { id: crypto.randomUUID(), name: draft.cName || "", url: draft.cUrl || "", ranksFor: draft.cRanks || "", gap: draft.cGap || "" }, draft.cName || "")}>Add competitor</button>
          </div>
          {store.competitors.map((row) => (
            <div key={row.id} className="rounded border border-sky-500/20 p-2">
              <div className="font-medium text-white">{row.name}</div>
              <div>{row.url}</div>
              <div>Ranks for: {row.ranksFor}</div>
              <div>Gap: {row.gap}</div>
              <button type="button" className="text-red-300" onClick={() => remove("competitors", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "automation" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("flowName", "Automation name")}
            {field("flowClient", "Client")}
            {field("flowTrigger", "Trigger")}
            {field("flowSteps", "Steps separated by |")}
            <button type="button" className={btn} onClick={() => add("flows", { id: crypto.randomUUID(), name: draft.flowName || "", client: draft.flowClient || "", trigger: draft.flowTrigger || "", steps: draft.flowSteps || "", active: true }, draft.flowName || "")}>Add automation</button>
          </div>
          {store.flows.map((row) => (
            <div key={row.id} className="rounded border border-sky-500/20 p-2">
              <button type="button" className={row.active ? "text-emerald-300" : "text-sky-200/50"} onClick={() => setStore((s) => ({ ...s, flows: s.flows.map((x) => x.id === row.id ? { ...x, active: !x.active } : x) }))}>{row.active ? "Active" : "Paused"}</button>
              <div className="font-medium text-white">{row.name} · {row.client}</div>
              <div>Trigger: {row.trigger}</div>
              <div>{row.steps}</div>
              <button type="button" className="text-red-300" onClick={() => remove("flows", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "content" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("draftTitle", "Title")}
            {field("draftKind", "Blog, email, ad, script, GBP post")}
            {field("draftClient", "Client")}
          </div>
          <textarea className={`${input} min-h-36 w-full`} placeholder="Write the piece" value={draft.draftBody || ""} onChange={(e) => set("draftBody", e.target.value)} />
          <button type="button" className={btn} onClick={() => add("content", { id: crypto.randomUUID(), title: draft.draftTitle || "", kind: draft.draftKind || "draft", client: draft.draftClient || "", body: draft.draftBody || "" }, draft.draftTitle || "")}>Save content</button>
          {store.content.map((row) => (
            <div key={row.id} className="rounded border border-sky-500/20 p-2">
              <div className="font-medium text-white">{row.title} · {row.kind} · {row.client}</div>
              <pre className="whitespace-pre-wrap text-sky-100/80">{row.body}</pre>
              <button type="button" className="text-red-300" onClick={() => remove("content", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "intel" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("intelClient", "Client")}
            {field("intelPains", "Pains")}
            {field("intelObj", "Objections")}
            {field("intelOffer", "Offer")}
            <button type="button" className={btn} onClick={() => add("intel", { id: crypto.randomUUID(), client: draft.intelClient || "", pains: draft.intelPains || "", objections: draft.intelObj || "", offer: draft.intelOffer || "" }, draft.intelClient || "")}>Save profile</button>
          </div>
          {store.intel.map((row) => (
            <div key={row.id} className="rounded border border-sky-500/20 p-2">
              <div className="font-medium text-white">{row.client}</div>
              <div>Pains: {row.pains}</div>
              <div>Objections: {row.objections}</div>
              <div>Offer: {row.offer}</div>
              <button type="button" className="text-red-300" onClick={() => remove("intel", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "assets" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("assetName", "Asset name")}
            {field("assetKind", "Logo, photo, video, ad, doc")}
            {field("assetClient", "Client")}
            {field("assetUrl", "Link or file path")}
            {field("assetTags", "Tags")}
            <button type="button" className={btn} onClick={() => add("assets", { id: crypto.randomUUID(), name: draft.assetName || "", kind: draft.assetKind || "", client: draft.assetClient || "", url: draft.assetUrl || "", tags: draft.assetTags || "" }, draft.assetName || "")}>Add asset</button>
          </div>
          {store.assets.map((row) => (
            <div key={row.id} className="rounded border border-sky-500/20 p-2">
              <div className="font-medium text-white">{row.name} · {row.kind} · {row.client}</div>
              <div>{row.tags}</div>
              <div className="text-sky-200/60">{row.url}</div>
              <button type="button" className="text-red-300" onClick={() => remove("assets", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}

      {tab === "leads" && (
        <section className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("leadName", "Client business")}
            {field("leadTrade", "Trade")}
            {field("leadCity", "City")}
            {field("leadServices", "Services, comma separated")}
            {field("leadSite", "Website")}
            <button type="button" className={btn} onClick={() => {
              const id = crypto.randomUUID();
              add("clients", { id, name: draft.leadName || "", trade: draft.leadTrade || "", city: draft.leadCity || "", services: draft.leadServices || "", website: draft.leadSite || "" }, draft.leadName || "");
              set("clientId", id);
            }}>Set up client</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {store.clients.map((row) => (
              <button key={row.id} type="button" className={`rounded px-3 py-1 ${client?.id === row.id ? "bg-sky-600" : "border border-sky-500/30"}`} onClick={() => set("clientId", row.id)}>{row.name}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((source) => (
              <button key={source.name} type="button" className={`rounded px-2 py-1 ${sources.includes(source.name) ? "bg-sky-700" : "border border-sky-500/20"}`} onClick={() => setSources((list) => list.includes(source.name) ? list.filter((n) => n !== source.name) : [...list, source.name])}>{source.name}</button>
            ))}
          </div>
          <button type="button" className={btn} disabled={scanning} onClick={scan}>{scanning ? "Scanning…" : "Scan for this client"}</button>
          {scanNote && <p className="text-amber-100">{scanNote}</p>}
          {!!queries.length && (
            <div className="rounded border border-sky-500/20 p-3">
              <div className="mb-1 text-white">Queries for {client?.name}</div>
              {queries.slice(0, 8).map((query) => <div key={query.q} className="text-sky-200/70">{query.source}: {query.q}</div>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {field("manualTitle", "Paste a lead title")}
            {field("manualUrl", "Link")}
            {field("manualSnippet", "What they said")}
            <button type="button" className={btn} onClick={() => {
              if (!client || !draft.manualTitle?.trim()) return;
              const scored = scoreText(`${draft.manualTitle} ${draft.manualSnippet || ""}`);
              add("found", { id: crypto.randomUUID(), clientId: client.id, title: draft.manualTitle.trim(), url: draft.manualUrl || "", snippet: draft.manualSnippet || "", source: "Manual", score: scored.score, intent: scored.intent, saved: true });
            }}>Add lead</button>
          </div>
          {clientLeads.map((lead) => (
            <div key={lead.id} className="rounded border border-sky-500/20 p-2">
              <div className="font-medium text-white">{lead.title}</div>
              <div>{lead.source} · {lead.intent} · score {lead.score}</div>
              <div className="text-sky-200/70">{lead.snippet}</div>
              <button type="button" className="text-red-300" onClick={() => remove("found", lead.id)}>Delete</button>
            </div>
          ))}
          {client && <button type="button" className="text-red-300" onClick={() => remove("clients", client.id)}>Remove this client setup</button>}
        </section>
      )}

      {tab === "tracker" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("trackName", "Lead name")}
            {field("trackPhone", "Phone")}
            {field("trackEmail", "Email")}
            {field("trackClient", "Client")}
            {field("trackSource", "Source")}
            {field("trackValue", "Value")}
            {field("trackNext", "Next step")}
            <select className={input} value={draft.trackStatus || "New"} onChange={(e) => set("trackStatus", e.target.value)}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            <button type="button" className={btn} onClick={() => add("tracked", { id: crypto.randomUUID(), name: draft.trackName || "", phone: draft.trackPhone || "", email: draft.trackEmail || "", client: draft.trackClient || "", source: draft.trackSource || "", status: draft.trackStatus || "New", value: draft.trackValue || "", next: draft.trackNext || "", notes: "" }, draft.trackName || "")}>Add to tracker</button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {STATUSES.map((status) => (
              <div key={status} className="rounded border border-sky-500/25 p-2">
                <div className="mb-2 font-medium text-white">{status}</div>
                {store.tracked.filter((row) => row.status === status).map((row) => (
                  <div key={row.id} className="mb-2 rounded border border-sky-500/15 p-2">
                    <div className="text-white">{row.name}</div>
                    <div>{row.phone} {row.email}</div>
                    <div className="text-sky-200/70">{row.client} · {row.source} · {row.value}</div>
                    <div>Next: {row.next}</div>
                    <select className={`${input} mt-1 w-full`} value={row.status} onChange={(e) => setStore((s) => ({ ...s, tracked: s.tracked.map((item) => item.id === row.id ? { ...item, status: e.target.value } : item) }))}>
                      {STATUSES.map((option) => <option key={option}>{option}</option>)}
                    </select>
                    <button type="button" className="text-red-300" onClick={() => remove("tracked", row.id)}>Delete</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "listings" && (
        <section className="space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            {field("listClient", "Client")}
            <select className={input} value={draft.dir || DIRECTORIES[0]} onChange={(e) => set("dir", e.target.value)}>
              {DIRECTORIES.map((dir) => <option key={dir}>{dir}</option>)}
            </select>
            {field("dirUrl", "Listing URL")}
            {field("dirStatus", "Claimed, pending, or missing")}
            {field("dirNap", "Name, address, phone")}
            <button type="button" className={btn} onClick={() => add("listings", { id: crypto.randomUUID(), client: draft.listClient || "", directory: draft.dir || DIRECTORIES[0], url: draft.dirUrl || "", status: draft.dirStatus || "missing", nap: draft.dirNap || "" }, draft.listClient || "x")}>Add listing</button>
          </div>
          {store.listings.map((row) => (
            <div key={row.id} className="rounded border border-sky-500/20 p-2">
              <div className="font-medium text-white">{row.client} · {row.directory} · {row.status}</div>
              <div>{row.nap}</div>
              <div className="text-sky-200/60">{row.url}</div>
              <button type="button" className="text-red-300" onClick={() => remove("listings", row.id)}>Delete</button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
