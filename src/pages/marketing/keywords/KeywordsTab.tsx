import { useState } from "react";
import { C } from "@/lib/palette";
import { callLLM, parseJsonArray } from "../llm";
import { getState, store } from "../store";
import { Button, Card, Field, SectionTitle, TextInput, Pill, Empty } from "../ui/primitives";

interface KeywordRow {
  keyword: string;
  volume?: number;
  difficulty?: "Low" | "Medium" | "High";
  intent?: "Informational" | "Commercial" | "Transactional" | "Navigational";
  cluster?: string;
  position?: number;
  url?: string;
}

const KEYS_STORAGE = "keywords_table_v1";
function loadRows(): KeywordRow[] { try { return JSON.parse(localStorage.getItem(KEYS_STORAGE) ?? "[]") as KeywordRow[]; } catch { return []; } }
function saveRows(rows: KeywordRow[]) { localStorage.setItem(KEYS_STORAGE, JSON.stringify(rows)); }

export function KeywordsTab() {
  const target = getState().seoTarget;
  const [rows, setRows] = useState<KeywordRow[]>(loadRows);
  const [seed, setSeed] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [loading, setLoading] = useState<"research" | "gaps" | "cluster" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function persist(next: KeywordRow[]) { setRows(next); saveRows(next); }

  async function research() {
    if (!seed.trim()) return;
    setLoading("research"); setError(null);
    try {
      const prompt = `Keyword research for ${target.company || "a business"}${target.industry ? ` (${target.industry})` : ""}${target.location ? ` in ${target.location}` : ""}.
Seed: "${seed}".
Return JSON array of 20 keywords, each: {"keyword":"...","volume":1234,"difficulty":"Low|Medium|High","intent":"Informational|Commercial|Transactional|Navigational"}`;
      const parsed = parseJsonArray<KeywordRow>(await callLLM(prompt, { json: true }));
      persist(mergeRows(rows, parsed));
      store.log({ icon: "🔍", label: `Keyword research: "${seed}" (${parsed.length} keywords)`, color: C.blue });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(null); }
  }

  async function cluster() {
    if (!rows.length) return;
    setLoading("cluster");
    try {
      const prompt = `Cluster these keywords into 5-8 semantic groups. Return JSON array of {"keyword":"...","cluster":"..."} only.
Keywords: ${JSON.stringify(rows.map((r) => r.keyword))}`;
      const parsed = parseJsonArray<{ keyword: string; cluster: string }>(await callLLM(prompt, { json: true }));
      const map = new Map(parsed.map((p) => [p.keyword.toLowerCase(), p.cluster]));
      persist(rows.map((r) => ({ ...r, cluster: map.get(r.keyword.toLowerCase()) ?? r.cluster })));
      store.log({ icon: "🧩", label: `Keyword clustering complete (${parsed.length} tagged)`, color: C.purple });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(null); }
  }

  async function gapAnalysis() {
    if (!competitor.trim()) return;
    setLoading("gaps");
    try {
      const prompt = `Competitor keyword-gap analysis.
Target: ${target.company || "our business"}${target.industry ? ` (${target.industry})` : ""}${target.location ? ` in ${target.location}` : ""}
Competitor: ${competitor}
Return JSON array of 15 keywords the competitor likely ranks for that the target likely does not, each:
{"keyword":"...","volume":1234,"difficulty":"Low|Medium|High","intent":"Informational|Commercial|Transactional|Navigational"}`;
      const parsed = parseJsonArray<KeywordRow>(await callLLM(prompt, { json: true }));
      persist(mergeRows(rows, parsed));
      store.log({ icon: "⚔️", label: `Keyword gaps vs ${competitor} (${parsed.length})`, color: C.orange });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(null); }
  }

  async function checkRank(row: KeywordRow) {
    try {
      const r = await fetch(`/api/serp/rank?q=${encodeURIComponent(row.keyword)}&domain=${encodeURIComponent(target.website || "")}`);
      if (!r.ok) throw new Error(`SERP check failed (${r.status})`);
      const data = (await r.json()) as { position?: number; url?: string };
      persist(rows.map((x) => x.keyword === row.keyword ? { ...x, position: data.position ?? 0, url: data.url } : x));
      store.log({ icon: "📈", label: `Rank check: "${row.keyword}" → ${data.position ?? "not ranked"}`, color: C.teal });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function exportCsv() {
    const header = ["keyword", "volume", "difficulty", "intent", "cluster", "position", "url"];
    const csv = [header, ...rows.map((r) => [r.keyword, r.volume ?? "", r.difficulty ?? "", r.intent ?? "", r.cluster ?? "", r.position ?? "", r.url ?? ""])]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `keywords-${Date.now()}.csv`;
    a.click();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <SectionTitle hint={target.company ? `Context: ${target.company}` : "Set SEO target for better context"}>🔍 Keyword Research</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "2fr auto", gap: 8 }}>
          <TextInput value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Seed keyword or topic" onKeyDown={(e) => e.key === "Enter" && research()} />
          <Button onClick={research} color={C.blue} loading={loading === "research"} disabled={!seed.trim()}>Research</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr auto", gap: 8, marginTop: 10 }}>
          <TextInput value={competitor} onChange={(e) => setCompetitor(e.target.value)} placeholder="Competitor domain (e.g. competitor.com)" />
          <Button onClick={gapAnalysis} color={C.orange} loading={loading === "gaps"} disabled={!competitor.trim()}>Gap Analysis</Button>
        </div>
        {error && <div style={{ marginTop: 10, fontSize: 11, color: C.red }}>⚠ {error}</div>}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <SectionTitle hint={`${rows.length} keywords`}>📊 Keyword Table</SectionTitle>
          <div style={{ display: "flex", gap: 6 }}>
            <Button color={C.purple} variant="ghost" onClick={cluster} loading={loading === "cluster"} disabled={!rows.length}>🧩 Cluster</Button>
            <Button color={C.teal} variant="ghost" onClick={exportCsv} disabled={!rows.length}>⬇ CSV</Button>
            <Button color={C.red} variant="ghost" onClick={() => persist([])} disabled={!rows.length}>Clear</Button>
          </div>
        </div>
        {rows.length === 0 ? (
          <Empty icon="🔍" title="No keywords yet" hint="Run a research or gap analysis above." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
                  {["Keyword", "Volume", "Difficulty", "Intent", "Cluster", "Position", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 10, color: "#6aaedd", fontWeight: 700, letterSpacing: ".06em" }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.keyword} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 12px", color: "#f0ede8" }}>{r.keyword}</td>
                    <td style={{ padding: "8px 12px", color: "#c8c8d0" }}>{r.volume?.toLocaleString() ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}><Pill color={diffColor(r.difficulty)}>{r.difficulty ?? "—"}</Pill></td>
                    <td style={{ padding: "8px 12px", color: "#6aaedd" }}>{r.intent ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#6aaedd" }}>{r.cluster ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: r.position && r.position > 0 ? C.teal : "#444" }}>{r.position && r.position > 0 ? `#${r.position}` : "—"}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      <button onClick={() => checkRank(r)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, background: "rgba(0,200,150,0.12)", color: C.teal, border: `0.5px solid ${C.teal}44`, cursor: "pointer" }}>
                        Check rank
                      </button>
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

function diffColor(d?: KeywordRow["difficulty"]) {
  return d === "High" ? C.red : d === "Medium" ? C.orange : C.teal;
}
function mergeRows(existing: KeywordRow[], incoming: KeywordRow[]): KeywordRow[] {
  const map = new Map(existing.map((r) => [r.keyword.toLowerCase(), r]));
  for (const r of incoming) {
    const k = r.keyword.toLowerCase();
    map.set(k, { ...(map.get(k) ?? {}), ...r });
  }
  return [...map.values()];
}