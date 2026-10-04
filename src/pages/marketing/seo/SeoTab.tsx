import { useState } from "react";
import { C } from "@/lib/palette";
import { callLLM } from "../llm";
import { store, getState } from "../store";
import { Button, Card, Field, SectionTitle, TextInput, TextArea, Pill } from "../ui/primitives";

type RunKind = "audit" | "competitor" | "backlinks" | "technical" | "onpage" | "local" | "schema";

const RUNS: { kind: RunKind; label: string; icon: string; color: string; help: string }[] = [
  { kind: "audit",       label: "Full SEO Audit",        icon: "🔬", color: C.purple, help: "Crawlability, content, local, authority" },
  { kind: "technical",   label: "Technical SEO",         icon: "⚙️", color: C.blue,   help: "Speed, mobile, indexation, sitemaps" },
  { kind: "onpage",      label: "On-Page Analysis",      icon: "📄", color: C.teal,   help: "Titles, H1s, internal links, media" },
  { kind: "competitor",  label: "Competitor Analysis",   icon: "⚔️", color: C.orange, help: "Top rivals, keyword gaps" },
  { kind: "backlinks",   label: "Backlink Opportunities",icon: "🔗", color: C.purple, help: "Sources to target, DA impact" },
  { kind: "local",       label: "Local SEO",             icon: "📍", color: C.teal,   help: "GBP, NAP, local citations" },
  { kind: "schema",      label: "Schema Markup",         icon: "🧩", color: C.blue,   help: "JSON-LD snippets you can paste" },
];

export function SeoTab() {
  const target = getState().seoTarget;
  const [url, setUrl] = useState(target.website);
  const [running, setRunning] = useState<RunKind | null>(null);
  const [result, setResult] = useState<string>("");
  const [onPage, setOnPage] = useState<OnPageReport | null>(null);

  const ctx = describeTarget(target);

  async function run(kind: RunKind) {
    if (!target.company.trim()) return;
    setRunning(kind);
    setResult("");
    const prompt = PROMPTS[kind](target, ctx);
    try {
      const out = await callLLM(prompt, { system: "You are a senior SEO consultant. Be specific, tactical, and cite concrete actions. No fluff." });
      setResult(out);
      store.log({ icon: RUNS.find((r) => r.kind === kind)!.icon, label: `${RUNS.find((r) => r.kind === kind)!.label} — ${target.company}`, color: C.blue, meta: { kind } });
    } catch (e) {
      setResult(`⚠ Error: ${(e as Error).message}`);
    } finally {
      setRunning(null);
    }
  }

  async function runOnPage() {
    const u = (url || target.website).trim();
    if (!u) return;
    setRunning("onpage");
    setOnPage(null);
    try {
      const r = await fetch(`/api/browse/inspect?url=${encodeURIComponent(u)}`);
      if (!r.ok) throw new Error(`Inspector returned HTTP ${r.status}`);
      const data = (await r.json()) as OnPageReport;
      setOnPage(data);
      store.log({ icon: "📄", label: `On-page inspect: ${u}`, color: C.teal });
    } catch (e) {
      setOnPage({ error: (e as Error).message, url: u } as OnPageReport);
    } finally {
      setRunning(null);
    }
  }

  function exportMd() {
    const blob = new Blob([`# SEO — ${target.company}\n\n${result}`], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `seo-${target.company || "report"}-${Date.now()}.md`;
    a.click();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Target */}
      <Card style={{ background: "rgba(74,179,244,0.04)", border: `0.5px solid ${C.blue}33` }}>
        <SectionTitle hint="All tools below run against this target">🎯 Target</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          <Field label="Company">
            <TextInput value={target.company} onChange={(e) => store.setSeoTarget({ ...target, company: e.target.value })} placeholder="CEO GPS" />
          </Field>
          <Field label="Website">
            <TextInput value={target.website} onChange={(e) => store.setSeoTarget({ ...target, website: e.target.value })} placeholder="https://ceogps.com" />
          </Field>
          <Field label="Industry">
            <TextInput value={target.industry} onChange={(e) => store.setSeoTarget({ ...target, industry: e.target.value })} placeholder="Digital marketing" />
          </Field>
          <Field label="Location">
            <TextInput value={target.location} onChange={(e) => store.setSeoTarget({ ...target, location: e.target.value })} placeholder="Atlanta, GA" />
          </Field>
        </div>
      </Card>

      {/* On-page deterministic */}
      <Card>
        <SectionTitle hint="Fetches the URL and inspects meta tags, headings, and schema — no LLM guessing.">
          🔎 On-Page Inspector (deterministic)
        </SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <TextInput
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            onKeyDown={(e) => e.key === "Enter" && runOnPage()}
          />
          <Button onClick={runOnPage} color={C.teal} loading={running === "onpage"}>Inspect</Button>
        </div>
        {onPage && <OnPageResult report={onPage} />}
      </Card>

      {/* LLM runs */}
      <Card>
        <SectionTitle hint={target.company ? `Running against ${target.company}` : "Set a target company above first"}>
          🧠 AI SEO Analysis
        </SectionTitle>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {RUNS.map((r) => (
            <Button
              key={r.kind}
              color={r.color}
              variant="ghost"
              disabled={!target.company.trim()}
              loading={running === r.kind}
              onClick={() => run(r.kind)}
              title={r.help}
            >
              {r.icon} {r.label}
            </Button>
          ))}
          {result && <Button color={C.red} variant="ghost" onClick={() => setResult("")}>Clear</Button>}
          {result && <Button color={C.teal} variant="ghost" onClick={exportMd}>⬇ Export .md</Button>}
        </div>
      </Card>

      {result && (
        <Card>
          <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{result}</div>
        </Card>
      )}
    </div>
  );
}

interface OnPageReport {
  url: string;
  error?: string;
  title?: string;
  titleLength?: number;
  metaDescription?: string;
  metaDescriptionLength?: number;
  h1?: string[];
  h2?: string[];
  canonical?: string;
  robotsMeta?: string;
  viewport?: string;
  openGraph?: Record<string, string>;
  twitter?: Record<string, string>;
  schema?: string[];
  imagesMissingAlt?: number;
  wordCount?: number;
  loadMs?: number;
}

function OnPageResult({ report }: { report: OnPageReport }) {
  if (report.error) {
    return <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(255,79,94,0.08)", border: `0.5px solid ${C.red}44`, fontSize: 12, color: C.red }}>⚠ {report.error}</div>;
  }
  const issues: string[] = [];
  if (report.titleLength && report.titleLength > 60) issues.push(`Title is ${report.titleLength} chars (aim ≤60)`);
  if (report.titleLength && report.titleLength < 20) issues.push(`Title is only ${report.titleLength} chars`);
  if (!report.metaDescription) issues.push("Missing meta description");
  if (report.metaDescriptionLength && report.metaDescriptionLength > 155) issues.push(`Meta description ${report.metaDescriptionLength} chars (aim ≤155)`);
  if (!report.h1 || report.h1.length === 0) issues.push("No H1 found");
  if (report.h1 && report.h1.length > 1) issues.push(`Multiple H1s (${report.h1.length})`);
  if (!report.canonical) issues.push("No canonical tag");
  if (report.imagesMissingAlt) issues.push(`${report.imagesMissingAlt} images missing alt text`);
  if ((report.wordCount ?? 0) < 300) issues.push(`Thin content (${report.wordCount} words)`);

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill color={C.blue}>Title {report.titleLength ?? 0}c</Pill>
        <Pill color={C.teal}>Desc {report.metaDescriptionLength ?? 0}c</Pill>
        <Pill color={C.purple}>H1 × {report.h1?.length ?? 0}</Pill>
        <Pill color={C.orange}>Words {report.wordCount ?? 0}</Pill>
        <Pill color={C.blue}>Schema {report.schema?.length ?? 0}</Pill>
        <Pill color={C.red}>Issues {issues.length}</Pill>
      </div>
      {issues.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,140,66,0.06)", border: `0.5px solid ${C.orange}33` }}>
          {issues.map((i, k) => <div key={k} style={{ fontSize: 11, color: "#c8c8d0", marginBottom: 3 }}>• {i}</div>)}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <SmallField label="Title" value={report.title ?? "—"} />
        <SmallField label="Canonical" value={report.canonical ?? "—"} />
        <SmallField label="Robots" value={report.robotsMeta ?? "—"} />
        <SmallField label="Viewport" value={report.viewport ?? "—"} />
      </div>
    </div>
  );
}

function SmallField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.06)" }}>
      <div style={{ fontSize: 9, color: "#6aaedd", fontWeight: 700, letterSpacing: ".06em", marginBottom: 3 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 11, color: "#c8c8d0", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function describeTarget(t: { company: string; website: string; industry: string; location: string }) {
  return t.company
    ? `"${t.company}"${t.website ? ` (${t.website})` : ""}${t.industry ? `, a ${t.industry} business` : ""}${t.location ? ` in ${t.location}` : ""}`
    : "this business";
}

const PROMPTS: Record<RunKind, (t: { company: string; website: string; industry: string; location: string }, ctx: string) => string> = {
  audit: (_, c) => `Perform a comprehensive SEO audit for ${c}. Cover: technical SEO, on-page, content depth, local SEO, authority/backlinks, and 3 quick wins this week. Each fix must be concrete and specific.`,
  technical: (_, c) => `Technical SEO deep-dive for ${c}. Analyze: crawlability & indexation, Core Web Vitals, mobile parity, canonical strategy, structured data, sitemap/robots, JS rendering risk. Give prioritized fixes.`,
  onpage: (_, c) => `On-page SEO review for ${c}. Audit: title tags, meta descriptions, H1-H3 hierarchy, internal linking, image alt, content-to-intent fit, schema. Give a checklist with specific rewrites for 3 example pages.`,
  competitor: (t, c) => `Competitor SEO analysis for ${c}. Identify 5 likely direct competitors in ${t.location || "their market"}, summarize their strengths, list keyword gaps they likely rank for that ${t.company} does not, and give 3 tactics to outrank them in 90 days.`,
  backlinks: (t, c) => `Backlink strategy for ${c}. Give: 10 specific websites/directories to target with URLs, 3 link-building tactics that fit their industry, guest-post opportunities in their niche, and local citation sources for ${t.location || "their metro"}.`,
  local: (t, c) => `Local SEO plan for ${c}. Cover Google Business Profile optimization, NAP consistency, local citation building for ${t.location || "their city"}, local content ideas, and review-generation tactics. Give a week-by-week 30-day plan.`,
  schema: (_, c) => `Generate ready-to-paste JSON-LD schema markup for ${c}. Provide: LocalBusiness, Organization, WebSite+SearchAction, and BreadcrumbList. Return each as a fenced code block labeled with its type.`,
};