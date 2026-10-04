import { useMemo, useState } from "react";
import { C } from "@/lib/palette";
import { lifeosApi } from "@/lib/api";
import { callLLM, parseJsonArray } from "../llm";
import { getState, store } from "../store";
import { Button, Card, Field, SectionTitle, TextInput, Pill, Empty } from "../ui/primitives";
import type { OpportunityItem, OpportunityRun, Priority, Severity } from "../MarketingPanel.types";
import { diffSnapshots, gradeFromScore, scoreFromDiffs } from "../nap";

type Sub = "community" | "opportunities" | "scanner";

export function LeadGenTab() {
  const [sub, setSub] = useState<Sub>("community");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {([
          { id: "community",     label: "🌐 Community Feed" },
          { id: "opportunities", label: "🎯 Directory Opportunities" },
          { id: "scanner",       label: "🩺 NAP Inconsistency Scan" },
        ] as const).map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)}
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: sub === s.id ? `${C.blue}22` : "rgba(255,255,255,0.04)",
              border: `0.5px solid ${sub === s.id ? C.blue : "rgba(255,255,255,0.1)"}`,
              color: sub === s.id ? C.blue : "#6aaedd",
            }}>
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

/* ─── Community Feed ─────────────────────────────────────────── */

const COMMUNITY_SOURCES: { name: string; site: string; icon: string; weight: number }[] = [
  { name: "Facebook Groups", site: "facebook.com",   icon: "🔵", weight: 0.9 },
  { name: "Nextdoor",        site: "nextdoor.com",   icon: "🟢", weight: 1.0 },
  { name: "LinkedIn",        site: "linkedin.com",   icon: "💼", weight: 1.1 },
  { name: "Craigslist",      site: "craigslist.org", icon: "🔴", weight: 0.8 },
  { name: "Reddit",          site: "reddit.com",     icon: "🟠", weight: 0.9 },
  { name: "Thumbtack",       site: "thumbtack.com",  icon: "🔨", weight: 0.9 },
  { name: "Angi",            site: "angi.com",       icon: "🏠", weight: 0.8 },
];

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

const HIGH_INTENT = /\b(looking for|need|seeking|recommend|anyone know|hire|quote|estimate|ISO)\b/i;
const URGENT = /\b(asap|urgent|today|tomorrow|emergency|this week)\b/i;

export function CommunityFeed() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["Reddit", "Nextdoor"]));
  const [location, setLocation] = useState("");
  const [leads, setLeads] = useState<CommunityLead[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    if (!selected.size) return;
    setScanning(true);
    setError(null);
    setLeads([]);
    try {
      const sites = COMMUNITY_SOURCES.filter((s) => selected.has(s.name));
      const loc = location.trim() || "near me";
      const siteClause = sites.map((s) => `site:${s.site}`).join(" OR ");
      const r = await lifeosApi.post<{ results: { title: string; url: string; snippet: string }[] }>(
        "/api/browse/search",
        { query: `(${siteClause}) (recommend OR "looking for" OR hire OR ISO) ${loc}`, limit: 25 }
      );
      const seen = new Set<string>();
      const mapped: CommunityLead[] = [];
      for (const item of r.results ?? []) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        const text = `${item.title} ${item.snippet}`;
        const intent = HIGH_INTENT.test(text) ? "high" : /recommend|best|trusted/i.test(text) ? "medium" : "low";
        const src = sites.find((s) => item.url.includes(s.site))?.name ?? "Mixed";
        const weight = sites.find((s) => s.name === src)?.weight ?? 0.9;
        let score = 40;
        if (intent === "high") score += 30;
        if (URGENT.test(text)) score += 15;
        if (/\$\d/.test(text)) score += 10;
        score = Math.min(100, Math.round(score * weight));
        const tags: string[] = [];
        if (URGENT.test(text)) tags.push("urgent");
        if (/\$\d/.test(text)) tags.push("budget");
        if (/hvac|plumb|roof|electric/i.test(text)) tags.push("trades");
        mapped.push({ id: item.url, title: item.title, url: item.url, snippet: item.snippet, source: src, score, intent, tags });
      }
      setLeads(mapped.sort((a, b) => b.score - a.score));
      store.log({ icon: "🌐", label: `Community scan: ${mapped.length} leads`, color: C.blue });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  }

  const hot = useMemo(() => leads.filter((l) => l.score >= 70).length, [leads]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <SectionTitle hint="Queries selected sources for service-seeking posts near your location.">🌐 Community Feed Scan</SectionTitle>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {COMMUNITY_SOURCES.map((s) => {
            const on = selected.has(s.name);
            return (
              <button key={s.name} onClick={() => setSelected((p) => { const n = new Set(p); n.has(s.name) ? n.delete(s.name) : n.add(s.name); return n; })}
                style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                  background: on ? `${C.blue}22` : "rgba(255,255,255,0.04)",
                  border: `0.5px solid ${on ? C.blue : "rgba(255,255,255,0.1)"}`,
                  color: on ? C.blue : "#6aaedd", fontWeight: 600,
                }}>
                {s.icon} {s.name}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (e.g. Atlanta, GA)" />
          <Button onClick={scan} color={C.blue} loading={scanning} disabled={!selected.size}>Scan</Button>
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 11, color: C.red }}>⚠ {error}</div>}
      </Card>

      {leads.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <Pill color={C.blue}>Total {leads.length}</Pill>
            <Pill color={C.red}>Hot {hot}</Pill>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {leads.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer"
                style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)", textDecoration: "none" }}>
                <div style={{ width: 40, textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: l.score >= 70 ? C.red : l.score >= 50 ? C.orange : C.blue }}>{l.score}</div>
                  <div style={{ fontSize: 8, color: "#666" }}>{l.intent.toUpperCase()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#f0ede8", fontWeight: 600 }}>{l.title}</div>
                  <div style={{ fontSize: 11, color: "#8a8a95", marginTop: 3, lineHeight: 1.5 }}>{l.snippet}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <Pill color={C.blue}>{l.source}</Pill>
                    {l.tags.map((t) => <Pill key={t} color={t === "urgent" ? C.red : t === "budget" ? C.teal : C.purple}>{t}</Pill>)}
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

/* ─── Directory Opportunity Finder ───────────────────────────── */

export function OpportunityFinder() {
  const runs = getState().opportunities;
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const latest = runs[0];

  async function find() {
    if (!company.trim()) return;
    setLoading(true);
    try {
      const prompt = `You are a local SEO citation expert. For "${company}"${website ? ` (${website})` : ""} in ${location || "Atlanta, GA"}, industry: ${industry || "services"}.

Return a JSON array of up to 15 directory/citation opportunities they are MOST LIKELY missing, ordered by impact:
[{"name":"...","url":"https://...","da":85,"priority":"Critical|High|Medium|Low","reason":"...","icon":"🔍"}]`;
      const raw = await callLLM(prompt, { json: true });
      const items = parseJsonArray<OpportunityItem>(raw).map((i) => ({ ...i, icon: i.icon ?? "🌐", priority: (i.priority || "Medium") as Priority }));
      const run: OpportunityRun = { id: crypto.randomUUID(), company, scannedAt: Date.now(), items };
      store.addOpportunityRun(run);
      store.log({ icon: "🎯", label: `Opportunity scan: ${company} (${items.length} found)`, color: C.teal });
    } catch (e) {
      store.log({ icon: "⚠️", label: `Opportunity scan failed: ${(e as Error).message}`, color: C.red });
    } finally {
      setLoading(false);
    }
  }

  function claim(runId: string, name: string, url: string) {
    store.markOpportunityClaimed(runId, name);
    window.open(url, "_blank", "noopener");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <SectionTitle hint="Enter a business — get the directories they're missing.">🎯 Directory Opportunity Finder</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label="Company"><TextInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Plumbing" /></Field>
          <Field label="Website"><TextInput value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." /></Field>
          <Field label="Industry"><TextInput value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Plumbing" /></Field>
          <Field label="Location"><TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Atlanta, GA" /></Field>
        </div>
        <Button onClick={find} color={C.teal} loading={loading} disabled={!company.trim()} fullWidth>Find Opportunities →</Button>
      </Card>

      {latest && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{latest.company}</div>
              <div style={{ fontSize: 10, color: "#6aaedd", marginTop: 2 }}>Scanned {new Date(latest.scannedAt).toLocaleString()} · {latest.items.length} found</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {latest.items.map((i) => (
              <div key={i.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)", opacity: i.claimed ? 0.55 : 1 }}>
                <span style={{ fontSize: 20 }}>{i.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8" }}>{i.name}</div>
                  <div style={{ fontSize: 10, color: "#6aaedd", marginTop: 1 }}>{i.reason}</div>
                </div>
                <Pill color={priorityColor(i.priority)}>{i.priority}</Pill>
                {i.da && <span style={{ fontSize: 10, color: "#444" }}>DA {i.da}</span>}
                <Button color={C.teal} variant="ghost" onClick={() => claim(latest.id, i.name, i.url)}>
                  {i.claimed ? "✓ Claimed" : "Claim ↗"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      {!latest && <Empty icon="🎯" title="No opportunities scanned yet" hint="Enter a business above to reveal missing directories." />}
    </div>
  );
}

function priorityColor(p: Priority | Severity) {
  return p === "Critical" ? C.red : p === "High" ? C.orange : p === "Medium" ? C.amber : C.blue;
}

/* ─── NAP Scanner ────────────────────────────────────────────── */

export function NapScanner() {
  const info = getState().businessInfo;
  const listings = getState().listings;
  const has = info.businessName && info.phone && info.address;
  const [llmReport, setLlmReport] = useState<string>("");
  const [running, setRunning] = useState(false);

  const snapshots = useMemo(() => {
    const out: { listingName: string; name?: string; phone?: string; address?: string; website?: string; hours?: string }[] = [];
    for (const rec of Object.values(listings)) {
      const s = rec.snapshots[0];
      if (s) out.push({ ...s, listingName: s.listingName || rec.name });
    }
    return out;
  }, [listings]);

  const diffs = useMemo(() => has ? diffSnapshots(info, snapshots) : [], [info, snapshots, has]);
  const score = has ? scoreFromDiffs(diffs) : 0;
  const grade = gradeFromScore(score);

  async function runNarrative() {
    if (!has) return;
    setRunning(true);
    try {
      const prompt = `Business canonical info:
Name: ${info.businessName}
Phone: ${info.phone}
Address: ${info.address}, ${info.city}, ${info.state} ${info.zip}
Website: ${info.website}
Hours: ${info.hours}
Category: ${info.category}
Description: ${info.description || "(none)"}

Detected deterministic diffs (canonical vs. per-listing snapshots):
${JSON.stringify(diffs.slice(0, 20), null, 2)}

Provide: (1) qualitative assessment of NAP/listing health, (2) prioritized fix order, (3) specific next actions. Be concise and tactical.`;
      const out = await callLLM(prompt, { system: "You are a citation consistency auditor." });
      setLlmReport(out);
      store.log({ icon: "🩺", label: `NAP narrative: ${info.businessName}`, color: C.purple });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {!has && (
        <Card style={{ background: "rgba(255,140,66,0.05)", border: `0.5px solid ${C.orange}44` }}>
          <div style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>⚠ Set your Business Info first (Listings → Business Info HQ)</div>
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: score >= 80 ? C.teal : score >= 60 ? C.amber : C.red }}>{grade}</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginTop: 2 }}>NAP Health</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#c8c8d0" }}>{score}/100</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8", marginBottom: 6 }}>
              Deterministic diffs: {diffs.length} · Snapshots: {snapshots.length}
            </div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>
              The score is computed from real field mismatches between your canonical info and captured listing snapshots. Capture snapshots from Listings → Sync & Push.
            </div>
            <div style={{ marginTop: 12 }}>
              <Button onClick={runNarrative} color={C.purple} variant="ghost" disabled={!has} loading={running}>
                🧠 Generate narrative report
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {diffs.length > 0 && (
        <Card>
          <SectionTitle>Field Mismatches</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {diffs.map((d, i) => (
              <div key={i} style={{ padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.025)", borderLeft: `3px solid ${priorityColor(d.severity)}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8" }}>{d.listing} · {d.field}</span>
                  <Pill color={priorityColor(d.severity)}>{d.severity}</Pill>
                </div>
                <div style={{ fontSize: 11, color: "#c8c8d0" }}>
                  <span style={{ color: C.teal }}>Canonical:</span> {d.canonical || "—"}<br />
                  <span style={{ color: C.red }}>Seen:</span> {d.seen || "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {llmReport && (
        <Card>
          <SectionTitle>AI Narrative</SectionTitle>
          <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{llmReport}</div>
        </Card>
      )}
    </div>
  );
}