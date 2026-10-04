// src/pages/simulators/AlternateLifeExplorer.tsx
import { C } from "@/lib/palette";
import { useState, useCallback, useMemo, useEffect } from "react";
import { invokeLLM } from "@/lib/llm";
// import { useWorkerAuth } from "@/contexts/WorkerContext";  // No longer needed

// ── Types ────────────────────────────────────────────────────────────────────
type Verdict = "Likely Worth It" | "Risky But Possible" | "Not Worth It" | "Needs More Data";

interface LifeSnapshot {
  label: string;
  monthlyRevenue: number;
  happinessScore: number;
  freedomScore: number;
  familyScore: number;
  stressScore: number;
  summary: string;
}

interface TimelineRow {
  period: string;
  phase: string;
  emoji: string;
  currentEvents: string[];
  alternateEvents: string[];
  pivotMoment?: string;
}

interface RiskFlag {
  domain: string;
  severity: "high" | "medium" | "low";
  flag: string;
  mitigation: string;
}

interface TestDriveWeek {
  week: number;
  focus: string;
  actions: string[];
  metric: string;
}

interface TestDrive {
  title: string;
  hypothesis: string;
  protectedFamilyTime?: string;
  weeks: TestDriveWeek[];
  goSignal?: string;
  noGoSignal?: string;
}

interface Simulation {
  scenarioTitle: string;
  scenarioEmoji: string;
  verdict: Verdict;
  verdictReason: string;
  currentLife: LifeSnapshot;
  alternateLife: LifeSnapshot;
  timeline: TimelineRow[];
  riskFlags: RiskFlag[];
  testDrive: TestDrive;
  atlantaAngle?: string;
  familyImpact?: string;
  hiddenAdvantage?: string;
}

interface SavedSim {
  id: number;
  whatIf: string;
  title: string;
  verdict: Verdict;
  ts: string;
}

interface Props { onBack?: () => void; }

// ── CSS custom properties used (documentation; defined in index.css) ─────────
// --crimson-soft, --crimson-border
// --teal-soft, --teal-border
// --success, --success-soft, --success-border
// --warning, --warning-soft, --warning-border
// --danger, --danger-soft, --danger-border
// --card-alt, --border-soft, --border-strong
// --text-dim, --text-muted, --text-faint
// --grad-crimson

// ── AI prompt ────────────────────────────────────────────────────────────────
const SYSTEM = `You are the Alternate Life Explorer for LifeOS1. You run grounded, multi-domain alternate life simulations based on the user's real context.

Given a "what if" scenario and context, return ONLY valid JSON (no markdown):
{
  "scenarioTitle": "Short punchy name for the alternate path",
  "scenarioEmoji": "single emoji",
  "verdict": "one of: Likely Worth It | Risky But Possible | Not Worth It | Needs More Data",
  "verdictReason": "1-sentence honest summary",
  "currentLife": {
    "label": "Current Path",
    "monthlyRevenue": 8000,
    "happinessScore": 65,
    "freedomScore": 50,
    "familyScore": 70,
    "stressScore": 60,
    "summary": "2-sentence honest picture of where they are now"
  },
  "alternateLife": {
    "label": "Alternate Path name",
    "monthlyRevenue": 5000,
    "happinessScore": 80,
    "freedomScore": 85,
    "familyScore": 75,
    "stressScore": 45,
    "summary": "2-sentence vivid picture of the alternate path at 12 months"
  },
  "timeline": [
    { "period": "Month 1-2", "phase": "Transition", "emoji": "🚀", "currentEvents": ["what happens in current path"], "alternateEvents": ["what happens in alternate path"], "pivotMoment": "the key decision or milestone in this window" },
    { "period": "Month 3-4", "phase": "Adjustment", "emoji": "⚡", "currentEvents": ["..."], "alternateEvents": ["..."], "pivotMoment": "..." },
    { "period": "Month 5-8", "phase": "Stabilization", "emoji": "🏗️", "currentEvents": ["..."], "alternateEvents": ["..."], "pivotMoment": "..." },
    { "period": "Month 9-12", "phase": "New Normal", "emoji": "🌅", "currentEvents": ["..."], "alternateEvents": ["..."], "pivotMoment": "..." }
  ],
  "riskFlags": [
    { "domain": "Finances", "severity": "high", "flag": "specific risk description", "mitigation": "concrete mitigation step" },
    { "domain": "Family", "severity": "medium", "flag": "...", "mitigation": "..." },
    { "domain": "Health/Energy", "severity": "low", "flag": "...", "mitigation": "..." }
  ],
  "testDrive": {
    "title": "30-Day Micro-Experiment",
    "hypothesis": "If I do X for 30 days, I will learn Y",
    "protectedFamilyTime": "specific commitment to protect family time during the experiment",
    "weeks": [
      { "week": 1, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success" },
      { "week": 2, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success" },
      { "week": 3, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success" },
      { "week": 4, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success, go/no-go decision" }
    ],
    "goSignal": "what result would tell you to go all-in",
    "noGoSignal": "what result would tell you to stay the course"
  },
  "atlantaAngle": "specific Atlanta market opportunity or signal relevant to this alternate path",
  "familyImpact": "honest 2-sentence assessment of how this affects family life",
  "hiddenAdvantage": "one non-obvious advantage of the alternate path most people would miss"
}`;

function parseJSON(raw: string): Simulation | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as Simulation) : null;
  } catch {
    return null;
  }
}

// ── Radar chart (SVG pentagon) ───────────────────────────────────────────────
function RadarChart({ current, alternate, size = 160 }: { current: LifeSnapshot; alternate: LifeSnapshot; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const labels = ["Revenue", "Happiness", "Freedom", "Family", "Low Stress"];
  const cVals = [current.monthlyRevenue / 200, current.happinessScore, current.freedomScore, current.familyScore, 100 - current.stressScore];
  const aVals = [alternate.monthlyRevenue / 200, alternate.happinessScore, alternate.freedomScore, alternate.familyScore, 100 - alternate.stressScore];
  const n = labels.length;

  function point(val: number, i: number, scale = 1) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const pct = Math.min(val, 100) / 100;
    return { x: cx + Math.cos(angle) * r * pct * scale, y: cy + Math.sin(angle) * r * pct * scale };
  }
  function labelPoint(i: number) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * (r + 20), y: cy + Math.sin(angle) * (r + 20) };
  }
  function polygon(vals: number[], scale = 1) {
    return vals.map((v, i) => { const p = point(v, i, scale); return `${p.x},${p.y}`; }).join(" ");
  }
  const rings = [0.25, 0.5, 0.75, 1].map(s =>
    Array.from({ length: n }, (_, i) => { const angle = (Math.PI * 2 * i) / n - Math.PI / 2; return `${cx + Math.cos(angle) * r * s},${cy + Math.sin(angle) * r * s}`; }).join(" ")
  );

  return (
    <svg width={size + 40} height={size + 40} style={{ overflow: "visible" }} viewBox={`-20 -20 ${size + 40} ${size + 40}`}>
      {rings.map((pts, i) => <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />)}
      {Array.from({ length: n }, (_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}
      <polygon points={polygon(cVals)} fill="var(--crimson-soft)" stroke={C.primary} strokeWidth={2} />
      <polygon points={polygon(aVals)} fill="var(--teal-soft)" stroke={C.teal} strokeWidth={2} strokeDasharray="4 2" />
      {labels.map((label, i) => {
        const lp = labelPoint(i);
        return <text key={label} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fill="var(--text-muted)" fontSize={9}>{label}</text>;
      })}
    </svg>
  );
}

// ── Score comparison row ─────────────────────────────────────────────────────
function ScoreRow({ label, current, alternate, invert = false }: { label: string; current: number; alternate: number; invert?: boolean }) {
  const better = invert ? alternate < current : alternate > current;
  const diff = alternate - current;
  const col = better ? "var(--success)" : diff === 0 ? "var(--text-muted)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: "var(--text-dim)", width: 90, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, position: "relative" }}>
        <div style={{ position: "absolute", height: "100%", width: `${Math.min(current, 100)}%`, background: C.primary, opacity: 0.55, borderRadius: 3 }} />
        <div style={{ position: "absolute", height: "100%", width: `${Math.min(alternate, 100)}%`, background: "var(--teal-soft)", borderRadius: 3, border: `1px dashed ${C.teal}` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: col, width: 44, textAlign: "right", flexShrink: 0 }}>
        {diff > 0 ? "+" : ""}{diff}
      </span>
    </div>
  );
}

// ── Verdict chip ─────────────────────────────────────────────────────────────
function VerdictChip({ verdict }: { verdict: Verdict }) {
  const map: Record<Verdict, { col: string; icon: string }> = {
    "Likely Worth It":    { col: "var(--success)", icon: "✅" },
    "Risky But Possible": { col: "var(--warning)", icon: "⚡" },
    "Not Worth It":       { col: "var(--danger)",  icon: "❌" },
    "Needs More Data":    { col: C.teal,           icon: "🔍" },
  };
  const { col, icon } = map[verdict] ?? { col: C.primary, icon: "🔮" };
  const bg = col.startsWith("var(--") ? `color-mix(in srgb, ${col} 14%, transparent)` : `${col}20`;
  const bd = col.startsWith("var(--") ? `color-mix(in srgb, ${col} 45%, transparent)` : `${col}50`;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: bg, border: `1px solid ${bd}`, color: col, fontSize: 12, fontWeight: 700 }}>
      {icon} {verdict}
    </span>
  );
}

// ── Risk flag card ───────────────────────────────────────────────────────────
function RiskCard({ risk }: { risk: RiskFlag }) {
  const [open, setOpen] = useState(false);
  const sev = { high: "var(--danger)", medium: "var(--warning)", low: "var(--success)" }[risk.severity];
  const sevBg = `color-mix(in srgb, ${sev} 10%, transparent)`;
  const sevBd = `color-mix(in srgb, ${sev} 30%, transparent)`;
  const sevIcon = { high: "🔴", medium: "🟡", low: "🟢" }[risk.severity];
  return (
    <div onClick={() => setOpen(o => !o)} style={{ background: sevBg, border: `1px solid ${sevBd}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>{sevIcon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: sev }}>{risk.domain}: {risk.flag}</span>
        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${sevBd}` }}>
          <div style={{ fontSize: 11, color: C.teal }}>✓ Mitigation: {risk.mitigation}</div>
        </div>
      )}
    </div>
  );
}

// ── Insights card (with copy) ────────────────────────────────────────────────
function InsightCard({ label, color, icon, body }: { label: string; color: string; icon: string; body: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard?.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const bg = `color-mix(in srgb, ${color} 10%, transparent)`;
  const bd = `color-mix(in srgb, ${color} 30%, transparent)`;
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 10, color, fontWeight: 700 }}>{icon} {label}</div>
        <button onClick={copy} style={{ background: "none", border: "none", color: copied ? C.teal : "var(--text-faint)", fontSize: 10, cursor: "pointer" }}>
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>{body}</div>
    </div>
  );
}

// ── PRESET SCENARIOS ────────────────────────────────────────────────────────
const PRESETS = [
  { icon: "🎮", label: "Full-time streaming + events", text: "What if I quit my day job and went full-time into game streaming and local gaming events in Atlanta?" },
  { icon: "🏠", label: "Remote work + relocate", text: "What if I switched to fully remote work and moved to a lower cost-of-living area outside Atlanta?" },
  { icon: "🍳", label: "Start a food business", text: "What if I launched a weekend pop-up food business using my cooking skills while keeping my current job?" },
  { icon: "📚", label: "Go back to school", text: "What if I went back to school part-time for an MBA while running my current business?" },
  { icon: "🤝", label: "Sell business, consult instead", text: "What if I sold my current business and pivoted to consulting in my industry?" },
  { icon: "✈️", label: "Semi-retire at 45", text: "What if I aggressively cut expenses and built passive income to semi-retire in 5 years?" },
];

type Phase = "input" | "loading" | "result";
type TabId = "compare" | "timeline" | "risks" | "testdrive" | "insights";

// ── Main component ───────────────────────────────────────────────────────────
export default function AlternateLifeExplorer({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [whatIf, setWhatIf] = useState("");
  const [context, setContext] = useState({ finances: "", family: "", energy: "", skills: "", location: "Atlanta, GA" });
  const [sim, setSim] = useState<Simulation | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("compare");
  const [savedSims, setSavedSims] = useState<SavedSim[]>(() => {
    try { return JSON.parse(localStorage.getItem("lifeos1_alt_sims") || "[]") as SavedSim[]; } catch { return []; }
  });
  const [doneActions, setDoneActions] = useState<Record<string, boolean>>({});

  const run = useCallback(async () => {
    if (!whatIf.trim()) return;

    // const token = await getToken();  // No longer needed - invokeLLM handles auth internally
    // if (!token) {
    //   setError("Please log in to run life simulations.");
    //   return;
    // }

    setPhase("loading");
    setError("");

    try {
      const prompt = [
        `What-if scenario: ${whatIf}`,
        context.finances && `Current finances: ${context.finances}`,
        context.family && `Family situation: ${context.family}`,
        context.energy && `Energy/schedule: ${context.energy}`,
        context.skills && `Skills/background: ${context.skills}`,
        `Location: ${context.location}. I'm a marketing business owner.`,
      ].filter(Boolean).join("\n");

      const result = await invokeLLM({
        systemPrompt: SYSTEM,
        prompt,
      });

      const raw = result.text || result.content || "";
      const parsed = parseJSON(raw);
      if (!parsed) {
        setError("Simulation failed to parse. Try rephrasing.");
        setPhase("input");
        return;
      }
      setSim(parsed);
      setDoneActions({});
      setPhase("result");
      setActiveTab("compare");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Simulation failed.";
      setError(msg);
      setPhase("input");
    }
  }, [whatIf, context]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && phase === "input" && whatIf.trim()) {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, whatIf, run]);

  function saveSim() {
    if (!sim) return;
    const entry: SavedSim = { id: Date.now(), whatIf, title: sim.scenarioTitle, verdict: sim.verdict, ts: new Date().toISOString() };
    const next = [entry, ...savedSims].slice(0, 10);
    setSavedSims(next);
    localStorage.setItem("lifeos1_alt_sims", JSON.stringify(next));
  }

  function deleteSim(id: number) {
    const next = savedSims.filter(s => s.id !== id);
    setSavedSims(next);
    localStorage.setItem("lifeos1_alt_sims", JSON.stringify(next));
  }

  const riskCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    (sim?.riskFlags ?? []).forEach(r => { counts[r.severity]++; });
    return counts;
  }, [sim]);

  const compareSummary = useMemo(() => {
    if (!sim) return null;
    const c = sim.currentLife, a = sim.alternateLife;
    const deltas = [
      { key: "Happiness", v: a.happinessScore - c.happinessScore },
      { key: "Freedom", v: a.freedomScore - c.freedomScore },
      { key: "Family", v: a.familyScore - c.familyScore },
      { key: "Stress", v: c.stressScore - a.stressScore },
    ];
    const best = [...deltas].sort((x, y) => y.v - x.v)[0];
    const worst = [...deltas].sort((x, y) => x.v - y.v)[0];
    const revDelta = a.monthlyRevenue - c.monthlyRevenue;
    return { best, worst, revDelta };
  }, [sim]);

  const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 };
  const inp = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg1, fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box" as const, width: "100%" };

  // ── INPUT ────────────────────────────────────────────────────────────────
  if (phase === "input") return (
    <div style={{ height: "100%", overflowY: "auto", padding: 28 }}>
      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>← Back</button>
      )}

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🌍</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.primary, marginBottom: 6 }}>Alternate Life Explorer</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
          Ask any "what if" life question. Get a multi-month simulation grounded in your real finances, family, energy, and Atlanta market signals — plus a 30-day test drive plan.
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 8, letterSpacing: ".08em" }}>QUICK SCENARIOS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => setWhatIf(p.text)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px solid ${whatIf === p.text ? C.primary : C.border}`, background: whatIf === p.text ? "var(--crimson-soft)" : "transparent", color: whatIf === p.text ? C.primary : "var(--text-dim)", cursor: "pointer", textAlign: "left", fontSize: 11 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...card, border: "1px solid var(--crimson-border)", marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: C.primary, fontWeight: 700, display: "block", marginBottom: 8 }}>🌍 YOUR "WHAT IF" QUESTION</label>
          <textarea value={whatIf} onChange={e => setWhatIf(e.target.value)}
            placeholder={`e.g. "What if I quit plumbing and went full-time into game streaming + local events in Atlanta?"`}
            style={{ ...inp, minHeight: 88, resize: "vertical", lineHeight: 1.6 }} />
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6, textAlign: "right" }}>⌘/Ctrl + Enter to run</div>
        </div>

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, marginBottom: 12, letterSpacing: ".08em" }}>CONTEXT — makes simulation more accurate</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {([
              { key: "finances" as const, label: "💰 Finances", ph: "e.g. $6k/mo income, $3k expenses, $20k savings" },
              { key: "family" as const, label: "👨‍👩‍👧 Family", ph: "e.g. Married, 2 kids, partner works part-time" },
              { key: "energy" as const, label: "⚡ Energy/Schedule", ph: "e.g. Mornings sharp, low by 6pm, weekends free" },
              { key: "skills" as const, label: "🎯 Skills", ph: "e.g. 10yrs marketing, decent content creator" },
            ]).map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input value={context[f.key]} onChange={e => setContext(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
              </div>
            ))}
          </div>
        </div>

        {savedSims.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 8, letterSpacing: ".08em" }}>SAVED SIMULATIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {savedSims.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 14 }}>🌍</span>
                  <button onClick={() => setWhatIf(s.whatIf)}
                    style={{ flex: 1, background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", textAlign: "left", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title || s.whatIf}
                  </button>
                  <span style={{ fontSize: 10, color: "var(--text-faint)", flexShrink: 0 }}>{s.verdict}</span>
                  <button onClick={() => deleteSim(s.id)} title="Delete"
                    style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: "var(--danger)", fontSize: 12, padding: "8px 12px", background: "var(--danger-soft)", borderRadius: 8, marginBottom: 12 }}>{error}</div>}

        <button onClick={run} disabled={!whatIf.trim()}
          style={{ width: "100%", padding: 14, borderRadius: 12, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: whatIf.trim() ? "pointer" : "not-allowed", opacity: whatIf.trim() ? 1 : 0.4 }}>
          🌍 Run Life Simulation
        </button>
      </div>
    </div>
  );

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (phase === "loading") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 56, animation: "altSpin 4s linear infinite" }}>🌍</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>Simulating alternate timeline...</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 340, textAlign: "center", lineHeight: 1.6 }}>
        Running multi-domain simulation across finances, family, energy, and Atlanta market data...
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 360 }}>
        {["Finances", "Family", "Energy", "Market", "Timeline", "Risk Flags", "Test Drive"].map((s, i) => (
          <div key={s} style={{ padding: "4px 12px", borderRadius: 20, background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", fontSize: 10, color: C.primary, animation: `altPulse 1.8s ease-in-out ${i * 0.25}s infinite` }}>{s}</div>
        ))}
      </div>
      <style>{`
        @keyframes altSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes altPulse { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>
    </div>
  );

  // ── RESULT ───────────────────────────────────────────────────────────────
  if (!sim) return null;

  const TABS: { id: TabId; label: string }[] = [
    { id: "compare", label: "⚖️ Compare" },
    { id: "timeline", label: "📅 Timeline" },
    { id: "risks", label: "⚠️ Risks" },
    { id: "testdrive", label: "🚗 Test Drive" },
    { id: "insights", label: "💡 Insights" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      <div style={{ background: `linear-gradient(135deg, var(--crimson-soft), rgba(0,148,136,0.05))`, borderBottom: "1px solid var(--crimson-border)", padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <button onClick={() => setPhase("input")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
              <span style={{ color: C.border }}>|</span>
              <span style={{ fontSize: 18 }}>{sim.scenarioEmoji || "🌍"}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>{sim.scenarioTitle}</span>
              <VerdictChip verdict={sim.verdict} />
            </div>
            {sim.verdictReason && <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, maxWidth: 580 }}>{sim.verdictReason}</div>}
            {compareSummary && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>Revenue Δ: <b style={{ color: compareSummary.revDelta >= 0 ? "var(--success)" : "var(--danger)" }}>{compareSummary.revDelta >= 0 ? "+" : ""}${compareSummary.revDelta.toLocaleString()}/mo</b></span>
                <span>Best win: <b style={{ color: "var(--success)" }}>{compareSummary.best.key} {compareSummary.best.v >= 0 ? "+" : ""}{compareSummary.best.v}</b></span>
                <span>Worst loss: <b style={{ color: "var(--danger)" }}>{compareSummary.worst.key} {compareSummary.worst.v >= 0 ? "+" : ""}{compareSummary.worst.v}</b></span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={saveSim} style={{ padding: "6px 12px", borderRadius: 8, background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", color: C.primary, fontSize: 11, cursor: "pointer" }}>
              Save
            </button>
            <button onClick={() => { setSim(null); setPhase("input"); }}
              style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: "1px solid var(--crimson-border)", color: C.primary, fontSize: 11, cursor: "pointer" }}>
              New Sim
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "var(--card-alt)", borderBottom: "1px solid var(--border-soft)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? "var(--crimson-soft)" : "transparent", color: activeTab === t.id ? C.primary : "var(--text-muted)", border: "none", borderBottom: activeTab === t.id ? `2px solid ${C.primary}` : "2px solid transparent" }}>
            {t.label}
            {t.id === "risks" && sim.riskFlags?.length > 0 && (
              <span style={{ marginLeft: 4, background: "var(--danger)", color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9 }}>{sim.riskFlags.length}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {activeTab === "compare" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {([
                { data: sim.currentLife, col: C.primary, bg: "var(--crimson-soft)", bd: "var(--crimson-border)", label: "Current Path" },
                { data: sim.alternateLife, col: C.teal, bg: "var(--teal-soft)", bd: "var(--teal-border)", label: "Alternate Path" },
              ]).map(({ data, col, bg, bd, label }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 6 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 4 }}>{data.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 10 }}>{data.summary}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: col }}>${data.monthlyRevenue.toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)" }}>/mo</span></div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ background: "var(--card-alt)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 8 }}>
                  <span style={{ color: C.primary }}>─</span> Current &nbsp; <span style={{ color: C.teal }}>╌</span> Alternate
                </div>
                <RadarChart current={sim.currentLife} alternate={sim.alternateLife} />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 12 }}>Score Shifts</div>
                <ScoreRow label="Happiness" current={sim.currentLife.happinessScore} alternate={sim.alternateLife.happinessScore} />
                <ScoreRow label="Freedom" current={sim.currentLife.freedomScore} alternate={sim.alternateLife.freedomScore} />
                <ScoreRow label="Family Time" current={sim.currentLife.familyScore} alternate={sim.alternateLife.familyScore} />
                <ScoreRow label="Stress" current={sim.currentLife.stressScore} alternate={sim.alternateLife.stressScore} invert />
                <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-faint)" }}>
                  <span style={{ color: C.primary }}>█</span> Current &nbsp; <span style={{ color: C.teal }}>▒</span> Alternate
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Side-by-Side Timeline</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>How both paths unfold month by month</div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div />
              <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, textAlign: "center" }}>CURRENT PATH</div>
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, textAlign: "center" }}>ALTERNATE PATH</div>
            </div>

            {(sim.timeline || []).map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{row.emoji}</div>
                  <div style={{ fontSize: 9, color: C.primary, fontWeight: 700, textAlign: "center" }}>{row.period}</div>
                  <div style={{ fontSize: 8, color: "var(--text-faint)", textAlign: "center" }}>{row.phase}</div>
                </div>
                <div style={{ background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 10, padding: "10px 12px" }}>
                  {(row.currentEvents || []).map((e, j) => (
                    <div key={j} style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 5, marginBottom: 4 }}>
                      <span style={{ color: C.primary, flexShrink: 0 }}>▸</span>{e}
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--teal-soft)", border: "1px solid var(--teal-border)", borderRadius: 10, padding: "10px 12px" }}>
                  {(row.alternateEvents || []).map((e, j) => (
                    <div key={j} style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 5, marginBottom: 4 }}>
                      <span style={{ color: C.teal, flexShrink: 0 }}>▸</span>{e}
                    </div>
                  ))}
                </div>
                {row.pivotMoment && (
                  <div style={{ gridColumn: "1 / -1", fontSize: 11, padding: "6px 12px", borderRadius: 8, background: "var(--warning-soft)", border: "1px solid var(--warning-border)", color: "var(--warning)" }}>
                    ⚡ Pivot: {row.pivotMoment}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "risks" && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Risk Flags</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>Tap each flag to reveal the mitigation strategy</div>

            {sim.riskFlags?.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {riskCounts.high > 0 && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "var(--danger-soft)", border: "1px solid var(--danger-border)", color: "var(--danger)" }}>🔴 {riskCounts.high} high</span>}
                {riskCounts.medium > 0 && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "var(--warning-soft)", border: "1px solid var(--warning-border)", color: "var(--warning)" }}>🟡 {riskCounts.medium} medium</span>}
                {riskCounts.low > 0 && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 20, background: "var(--success-soft)", border: "1px solid var(--success-border)", color: "var(--success)" }}>🟢 {riskCounts.low} low</span>}
              </div>
            )}

            {(!sim.riskFlags || sim.riskFlags.length === 0) ? (
              <div style={{ textAlign: "center", padding: 40, color: C.teal }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div>No major risks flagged for this alternate path.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.riskFlags.map((r, i) => <RiskCard key={i} risk={r} />)}
              </div>
            )}
          </div>
        )}

        {activeTab === "testdrive" && sim.testDrive && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>30-Day Test Drive</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>A micro-experiment to validate the alternate path before committing</div>

            <div style={{ background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 6 }}>HYPOTHESIS</div>
              <div style={{ fontSize: 13, color: C.white, lineHeight: 1.6, fontStyle: "italic" }}>"{sim.testDrive.hypothesis}"</div>
            </div>

            {sim.testDrive.protectedFamilyTime && (
              <div style={{ background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 4 }}>👨‍👩‍👧 PROTECTED FAMILY TIME</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{sim.testDrive.protectedFamilyTime}</div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 10 }}>Week-by-Week Plan</div>
              {(sim.testDrive.weeks || []).map((w, i) => {
                const wCol = [C.primary, C.teal, C.amber, C.pink][i % 4];
                return (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `color-mix(in srgb, ${wCol} 20%, transparent)`, border: `2px solid ${wCol}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: wCol }}>{w.week}</div>
                      {i < (sim.testDrive.weeks.length - 1) && <div style={{ width: 2, flex: 1, background: `color-mix(in srgb, ${wCol} 25%, transparent)`, minHeight: 16 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: wCol, marginBottom: 4 }}>{w.focus}</div>
                      {(w.actions || []).map((a, j) => {
                        const key = `${i}-${j}`;
                        const done = !!doneActions[key];
                        return (
                          <div key={j} onClick={() => setDoneActions(d => ({ ...d, [key]: !d[key] }))}
                            style={{ fontSize: 11, color: done ? "var(--text-faint)" : "var(--text-dim)", display: "flex", gap: 6, marginBottom: 3, cursor: "pointer", textDecoration: done ? "line-through" : "none" }}>
                            <span style={{ color: wCol, flexShrink: 0 }}>{done ? "☑" : "☐"}</span>{a}
                          </div>
                        );
                      })}
                      {w.metric && (
                        <div style={{ marginTop: 6, fontSize: 10, padding: "3px 10px", borderRadius: 8, background: `color-mix(in srgb, ${wCol} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${wCol} 30%, transparent)`, color: wCol, display: "inline-block" }}>
                          📊 {w.metric}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {sim.testDrive.goSignal && (
                <div style={{ background: "var(--success-soft)", border: "1px solid var(--success-border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "var(--success)", fontWeight: 700, marginBottom: 4 }}>✅ GO SIGNAL</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{sim.testDrive.goSignal}</div>
                </div>
              )}
              {sim.testDrive.noGoSignal && (
                <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger-border)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "var(--danger)", fontWeight: 700, marginBottom: 4 }}>🛑 NO-GO SIGNAL</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{sim.testDrive.noGoSignal}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 16 }}>Deep Insights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sim.atlantaAngle && <InsightCard label="ATLANTA MARKET ANGLE" color={C.amber} icon="🏙️" body={sim.atlantaAngle} />}
              {sim.familyImpact && <InsightCard label="FAMILY IMPACT" color={C.pink} icon="👨‍👩‍👧" body={sim.familyImpact} />}
              {sim.hiddenAdvantage && <InsightCard label="HIDDEN ADVANTAGE" color={C.teal} icon="💎" body={sim.hiddenAdvantage} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}