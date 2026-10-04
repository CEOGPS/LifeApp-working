// src/pages/simulators/DreamForgeSimulator.tsx
import { C } from "@/lib/palette";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { invokeLLM } from "@/lib/llm";
// import { getErebusCore } from "@/lib/agents/erebus/ErebusCore";  // Excluded from build

// ── Types ────────────────────────────────────────────────────────────────────
interface LifeOSContext {
  goals: string[];
  tasks: string[];
  calendar: string[];
  crm: string[];
  contacts: string[];
}

interface Phase {
  months: string;
  title: string;
  emoji: string;
  tasks: string[];
  milestone: string;
  risk: string;
}

interface Revenue {
  month3: number;
  month6: number;
  month9: number;
  month12: number;
  currency: string;
  assumptions: string[];
}

interface Conflict {
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
  resolution: string;
}

interface Scenario {
  name: string;
  description: string;
  monthlyRevenue12: number;
  color: string;
}

interface ActionDraft {
  type: "outreach" | "grant";
  title: string;
  body: string;
}

interface Simulation {
  vision: string;
  tagline: string;
  moodKeywords: string[];
  phases: Phase[];
  revenue: Revenue;
  conflicts: Conflict[];
  scenarios: Scenario[];
  actions: ActionDraft[];
  energyTip?: string;
  familyTie?: string;
}

interface Props { onBack?: () => void; }

// ── CSS custom properties used (documentation; defined in index.css) ─────────
// --crimson-soft, --crimson-border, --grad-crimson
// --teal-soft, --teal-border
// --success, --success-soft, --success-border
// --warning, --warning-soft, --warning-border
// --danger, --danger-soft, --danger-border
// --card-alt, --surface-strong, --border-soft, --border-strong
// --text-dim, --text-muted, --text-faint

// Load real LifeOS data for grounded simulations (closed-loop ecosystem)
function loadLifeOSContext(): LifeOSContext {
  try {
    const goals = (JSON.parse(localStorage.getItem("lifeos_dash_projects") || "[]") as Array<{ text: string; done?: boolean }>)
      .filter(g => !g.done).map(g => g.text);
    const tasks = (JSON.parse(localStorage.getItem("lifeos_tasks_queue") || "[]") as Array<{ title: string; done?: boolean }>)
      .filter(t => !t.done).slice(0, 5).map(t => t.title);
    const calendar = (JSON.parse(localStorage.getItem("lifeos_calendar") || "[]") as Array<{ date: string; name: string }>)
      .slice(0, 5).map(e => `${e.date} ${e.name}`);
    const crm = (JSON.parse(localStorage.getItem("lifeos_crm") || "[]") as Array<{ name?: string; fullName?: string; company?: string }>)
      .slice(0, 5).map(c => `${c.name || c.fullName || "Unknown"} (${c.company || ""})`);
    const contacts = (JSON.parse(localStorage.getItem("lifeos_contacts") || "[]") as Array<{ name: string }>)
      .slice(0, 3).map(c => c.name);
    return { goals, tasks, calendar, crm, contacts };
  } catch { return { goals: [], tasks: [], calendar: [], crm: [], contacts: [] }; }
}

const DREAM_SYSTEM_PROMPT = `You are the DreamForge Simulator — an AI that turns life visions into data-grounded 6–12 month reality simulations.

Given the user's dream and context, return ONLY valid JSON (no markdown, no prose outside JSON) in this exact structure:

{
  "vision": "2-3 sentence poetic but grounded vision statement",
  "tagline": "4-6 word essence of the dream",
  "moodKeywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "phases": [
    {"months":"1-2","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"},
    {"months":"3-4","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"},
    {"months":"5-6","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"},
    {"months":"7-12","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"}
  ],
  "revenue": {
    "month3": 1500,
    "month6": 4500,
    "month9": 9000,
    "month12": 18000,
    "currency": "USD",
    "assumptions": ["assumption1","assumption2","assumption3"]
  },
  "conflicts": [
    {"title":"Conflict title","detail":"1-sentence detail","severity":"high|medium|low","resolution":"quick fix suggestion"},
    {"title":"Conflict title","detail":"1-sentence detail","severity":"high|medium|low","resolution":"quick fix suggestion"}
  ],
  "scenarios": [
    {"name":"Conservative","description":"What happens if you do the minimum — outcome description","monthlyRevenue12":0,"color":"#4ab3f4"},
    {"name":"On-Plan","description":"What happens if you follow the playbook — outcome description","monthlyRevenue12":0,"color":"#00c896"},
    {"name":"Breakout","description":"What happens if you go all-in — outcome description","monthlyRevenue12":0,"color":"#ffd700"}
  ],
  "actions": [
    {"type":"outreach","title":"Action title","body":"Full draft text ready to send or submit"},
    {"type":"grant","title":"Grant or resource title","body":"Full draft application paragraph"}
  ],
  "energyTip": "One specific tip about protecting energy during this build",
  "familyTie": "One specific way to involve or protect family during this journey"
}

Be specific, data-grounded, and actionable. Revenue numbers should be realistic for the described business. Conflicts should reference specifics the user mentioned.`;

function parseSimulation(raw: string): Simulation | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as Simulation) : null;
  } catch {
    return null;
  }
}

// ── Revenue chart (pure SVG) ──────────────────────────────────────────────────
function RevenueChart({ data, multiplier }: { data: Revenue; multiplier: number }) {
  const months = [
    { label: "M3",  value: data.month3  * multiplier },
    { label: "M6",  value: data.month6  * multiplier },
    { label: "M9",  value: data.month9  * multiplier },
    { label: "M12", value: data.month12 * multiplier },
  ];
  const max = Math.max(...months.map(m => m.value), 1);
  const W = 320, H = 140, PAD = 32, BAR_W = 44;
  const spacing = (W - PAD * 2) / months.length;

  return (
    <svg width={W} height={H + 28} style={{ overflow: "visible" }}>
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={PAD} x2={W - PAD} y1={PAD + H * (1 - pct)} y2={PAD + H * (1 - pct)}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      {months.map((m, i) => {
        const x = PAD + i * spacing + spacing / 2 - BAR_W / 2;
        const barH = (m.value / max) * (H - PAD);
        const y = PAD + H - barH;
        const grad = `dfBarGrad${i}`;
        return (
          <g key={m.label}>
            <defs>
              <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.primary} stopOpacity={0.9} />
                <stop offset="100%" stopColor={C.primaryDark} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={6} fill={`url(#${grad})`}>
              <title>${Math.round(m.value).toLocaleString()}</title>
            </rect>
            <text x={x + BAR_W / 2} y={y - 6} textAnchor="middle" fill={C.primary} fontSize={11} fontWeight={700}>
              ${m.value >= 1000 ? (m.value / 1000).toFixed(1) + "k" : Math.round(m.value)}
            </text>
            <text x={x + BAR_W / 2} y={PAD + H + 18} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Conflict badge ────────────────────────────────────────────────────────────
function ConflictBadge({ conflict }: { conflict: Conflict }) {
  const [open, setOpen] = useState(false);
  const sev = { high: "var(--danger)", medium: "var(--warning)", low: "var(--success)" }[conflict.severity];
  const sevBg = `color-mix(in srgb, ${sev} 10%, transparent)`;
  const sevBd = `color-mix(in srgb, ${sev} 30%, transparent)`;
  const sevIcon = { high: "⚠️", medium: "🔶", low: "ℹ️" }[conflict.severity];
  return (
    <div style={{ background: sevBg, border: `1px solid ${sevBd}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}
      onClick={() => setOpen(o => !o)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{sevIcon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: sev }}>{conflict.title}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${sevBd}` }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 6 }}>{conflict.detail}</div>
          <div style={{ fontSize: 11, color: C.teal }}>✓ Fix: {conflict.resolution}</div>
        </div>
      )}
    </div>
  );
}

// ── Action draft card ─────────────────────────────────────────────────────────
function ActionCard({ action }: { action: ActionDraft }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isGrant = action.type === "grant";
  const col = isGrant ? C.amber : C.teal;
  const bg = `color-mix(in srgb, ${col} 10%, transparent)`;
  const bd = `color-mix(in srgb, ${col} 30%, transparent)`;

  function copy() {
    void navigator.clipboard?.writeText(action.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}
        onClick={() => setExpanded(o => !o)}>
        <span style={{ fontSize: 15 }}>{isGrant ? "🏛️" : "✉️"}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: col }}>{action.title}</span>
        <span style={{ fontSize: 10, color: "var(--text-faint)", background: `color-mix(in srgb, ${col} 15%, transparent)`, padding: "2px 8px", borderRadius: 10 }}>
          {isGrant ? "Grant" : "Outreach"}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ background: C.bg1, borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 8 }}>
            {action.body}
          </div>
          <button onClick={copy}
            style={{ padding: "6px 16px", borderRadius: 8, background: copied ? "var(--success-soft)" : `color-mix(in srgb, ${col} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${copied ? "var(--success)" : col} 40%, transparent)`, color: copied ? "var(--success)" : col, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
            {copied ? "✓ Copied!" : "Copy Draft"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type Phase3 = "input" | "loading" | "result";
type TabId = "timeline" | "revenue" | "conflicts" | "scenarios" | "actions";

interface ToastState { msg: string; col: string; }

export default function DreamForgeSimulator({ onBack }: Props) {
  const [phase, setPhase] = useState<Phase3>("input");
  const [dream, setDream] = useState("");
  const [context, setContext] = useState({ energy: "", family: "", finances: "", skills: "" });
  const [sim, setSim] = useState<Simulation | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("timeline");
  const [multiplier, setMultiplier] = useState(1);
  const [activeScenario, setActiveScenario] = useState(1);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<number | null>(null);

  const [lifeOSData] = useState<LifeOSContext>(() => loadLifeOSContext());

  const run = useCallback(async () => {
    if (!dream.trim()) return;
    setPhase("loading");
    setError("");
    try {
      const contextStr = [
        context.energy   && `Energy/schedule context: ${context.energy}`,
        context.family   && `Family situation: ${context.family}`,
        context.finances && `Current finances: ${context.finances}`,
        context.skills   && `Skills/experience: ${context.skills}`,
      ].filter(Boolean).join("\n");

      const realDataStr = [
        lifeOSData.goals.length    && `Active goals: ${lifeOSData.goals.slice(0, 4).join("; ")}`,
        lifeOSData.tasks.length    && `Open tasks: ${lifeOSData.tasks.slice(0, 4).join("; ")}`,
        lifeOSData.calendar.length && `Upcoming calendar: ${lifeOSData.calendar.slice(0, 3).join("; ")}`,
        lifeOSData.crm.length      && `Recent CRM/contacts: ${lifeOSData.crm.slice(0, 3).join("; ")}`,
      ].filter(Boolean).join("\n");

      const prompt = `Dream/Goal: ${dream}${contextStr ? "\n\n" + contextStr : ""}${realDataStr ? "\n\nREAL LIFEOS DATA (use to ground the simulation in actual life): " + realDataStr : ""}`;
      const result = await invokeLLM({ systemPrompt: DREAM_SYSTEM_PROMPT, prompt });
      const raw = result.text || result.content || "";
      const parsed = parseSimulation(raw);
      if (!parsed) { setError("Simulation parse failed. Try rephrasing your dream."); setPhase("input"); return; }
      setSim(parsed);
      setDoneTasks({});
      setPhase("result");
      setActiveTab("timeline");
      setMultiplier(1);
      setActiveScenario(1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Simulation failed. Check your AI key in Integrations.";
      setError(msg);
      setPhase("input");
    }
  }, [dream, context, lifeOSData]);

  useEffect(() => {
    if (lifeOSData.goals.length || lifeOSData.tasks.length) {
      setContext(prev => ({
        ...prev,
        family: prev.family || (lifeOSData.contacts.length ? `Family/friends: ${lifeOSData.contacts.join(", ")}` : prev.family),
        skills: prev.skills || (lifeOSData.goals.length ? `Current goals: ${lifeOSData.goals.slice(0, 3).join("; ")}` : prev.skills),
      }));
    }
  }, [lifeOSData]);

  function flashToast(msg: string, col: string) {
    setToast({ msg, col });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && phase === "input" && dream.trim()) {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, dream, run]);

  const sortedConflicts = useMemo(() => {
    if (!sim) return [];
    const order: Record<Conflict["severity"], number> = { high: 0, medium: 1, low: 2 };
    return [...sim.conflicts].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [sim]);

  function exportPlaybook() {
    if (!sim) return;
    const lines: string[] = [];
    lines.push(`# DreamForge: ${sim.tagline}`);
    lines.push("");
    lines.push(sim.vision);
    lines.push("");
    sim.phases.forEach(ph => {
      lines.push(`## ${ph.emoji} ${ph.title} (Months ${ph.months})`);
      ph.tasks.forEach(t => lines.push(`- [ ] ${t}`));
      if (ph.milestone) lines.push(`- 🏆 Milestone: ${ph.milestone}`);
      if (ph.risk) lines.push(`- ⚡ Risk: ${ph.risk}`);
      lines.push("");
    });
    lines.push("## Revenue Projection");
    lines.push(`- M3: $${sim.revenue.month3.toLocaleString()}`);
    lines.push(`- M6: $${sim.revenue.month6.toLocaleString()}`);
    lines.push(`- M9: $${sim.revenue.month9.toLocaleString()}`);
    lines.push(`- M12: $${sim.revenue.month12.toLocaleString()}`);
    void navigator.clipboard?.writeText(lines.join("\n"));
    flashToast("Playbook copied to clipboard", C.teal);
  }

  // ── INPUT PHASE ──────────────────────────────────────────────────────────
  if (phase === "input") return (
    <div style={{ height: "100%", overflowY: "auto", padding: 28 }}>
      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>
          ← Back to Simulators
        </button>
      )}

      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🌙</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.primary, marginBottom: 6 }}>DreamForge Simulator</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
          Simulates 6-12 month branching realities with visual mood boards, playbooks, revenue projections. (Ecosystem: data from your LifeOS fuels personalized outcomes that improve business, community, and personal life.)
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: C.card, border: "1px solid var(--crimson-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.primary, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
            🌙 Your Dream or Vision
          </label>
          <textarea
            value={dream}
            onChange={e => setDream(e.target.value)}
            placeholder={`e.g. "Help me design my dream Atlanta micro-bakery that lets me spend more time with my family and generate $10k/month by next year."`}
            style={{ width: "100%", minHeight: 100, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--crimson-border)", background: C.bg1, fontSize: 13, color: C.text, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6, textAlign: "right" }}>⌘/Ctrl + Enter to run</div>
        </div>

        <div style={{ background: "var(--card-alt)", border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14 }}>
            Context (optional — makes simulation more accurate)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {([
              { key: "energy" as const,   label: "⚡ Energy & Schedule",  ph: "e.g. mornings free, low energy by 3pm" },
              { key: "family" as const,   label: "👨‍👩‍👧 Family Situation", ph: "e.g. 2 kids, soccer season in spring" },
              { key: "finances" as const, label: "💰 Current Finances",   ph: "e.g. $8k savings, $3k/mo expenses" },
              { key: "skills" as const,   label: "🎯 Skills & Experience", ph: "e.g. 5 yrs baking, Instagram marketing" },
            ]).map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 5, fontWeight: 600 }}>{f.label}</label>
                <input
                  value={context[f.key]}
                  onChange={e => setContext(c => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg1, fontSize: 12, color: C.text, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Ecosystem readout */}
        {(lifeOSData.goals.length || lifeOSData.tasks.length || lifeOSData.calendar.length || lifeOSData.crm.length || lifeOSData.contacts.length) > 0 && (
          <div style={{ background: "var(--teal-soft)", border: "1px solid var(--teal-border)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginBottom: 8, letterSpacing: ".06em" }}>🔗 LIFEOS DATA GROUNDING THIS SIM</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "var(--text-dim)" }}>
              <span>Goals: <b style={{ color: C.teal }}>{lifeOSData.goals.length}</b></span>
              <span>Tasks: <b style={{ color: C.teal }}>{lifeOSData.tasks.length}</b></span>
              <span>Calendar: <b style={{ color: C.teal }}>{lifeOSData.calendar.length}</b></span>
              <span>CRM: <b style={{ color: C.teal }}>{lifeOSData.crm.length}</b></span>
              <span>Contacts: <b style={{ color: C.teal }}>{lifeOSData.contacts.length}</b></span>
            </div>
          </div>
        )}

        {error && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 12, padding: "8px 14px", background: "var(--danger-soft)", borderRadius: 8 }}>{error}</div>}

        <button onClick={run} disabled={!dream.trim()}
          style={{ width: "100%", padding: "14px", borderRadius: 12, background: "var(--grad-crimson)", border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: dream.trim() ? "pointer" : "not-allowed", opacity: dream.trim() ? 1 : 0.4, letterSpacing: ".03em" }}>
          🔮 Forge My Reality Simulation
        </button>
      </div>
    </div>
  );

  // ── LOADING PHASE ────────────────────────────────────────────────────────
  if (phase === "loading") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 52, animation: "dfSpin 3s linear infinite" }}>🔮</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>Forging your reality...</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
        Simulating 6–12 month branching timelines, projecting revenue, scanning for conflicts...
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {["Timeline", "Revenue", "Conflicts", "Actions"].map((step, i) => (
          <div key={step} style={{ padding: "4px 12px", borderRadius: 20, background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", fontSize: 10, color: C.primary, animation: `dfPulse 1.5s ease-in-out ${i * 0.3}s infinite` }}>
            {step}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes dfSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes dfPulse { 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>
    </div>
  );

  // ── RESULT PHASE ─────────────────────────────────────────────────────────
  if (!sim) return null;

  const TABS: { id: TabId; label: string }[] = [
    { id: "timeline",  label: "📅 Timeline" },
    { id: "revenue",   label: "💰 Revenue" },
    { id: "conflicts", label: "⚠️ Conflicts" },
    { id: "scenarios", label: "🔀 Scenarios" },
    { id: "actions",   label: "✉️ Actions" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      <div style={{ background: `linear-gradient(135deg, var(--crimson-soft), rgba(0,148,136,0.06))`, borderBottom: "1px solid var(--crimson-border)", padding: "16px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>🌙</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>DreamForge</span>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: "var(--success-soft)", border: "1px solid var(--success-border)", color: "var(--success)", fontWeight: 600 }}>
                Simulation Complete
              </span>
            </div>
            {sim.tagline && <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>"{sim.tagline}"</div>}
            {sim.vision && <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 600 }}>{sim.vision}</div>}
            {sim.moodKeywords && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {sim.moodKeywords.map(kw => (
                  <span key={kw} style={{ fontSize: 10, padding: "2px 10px", borderRadius: 20, background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", color: C.primary }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={exportPlaybook}
              style={{ padding: "6px 14px", borderRadius: 8, background: "var(--teal-soft)", border: "1px solid var(--teal-border)", color: C.teal, fontSize: 11, cursor: "pointer" }}>
              📤 Export Playbook
            </button>
            <button onClick={() => { setPhase("input"); setSim(null); }}
              style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: "1px solid var(--crimson-border)", color: C.primary, fontSize: 11, cursor: "pointer" }}>
              New Dream
            </button>
          </div>
        </div>

        {/* Ecosystem effects */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button onClick={() => {
            const existing = JSON.parse(localStorage.getItem("lifeos_tasks_queue") || "[]") as unknown[];
            const newTasks = (sim.phases || []).flatMap((ph, i) => (ph.tasks || []).map((t, j) => ({ id: Date.now() + i * 100 + j, title: `[DreamForge] ${ph.title}: ${t}`, done: false, source: "dreamforge" })));
            localStorage.setItem("lifeos_tasks_queue", JSON.stringify([...existing, ...newTasks]));
            flashToast(`+${newTasks.length} tasks → TaskOrchestration`, C.teal);
          }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: "var(--teal-soft)", border: "1px solid var(--teal-border)", color: C.teal, cursor: "pointer" }}>
            📋 Create Tasks from Playbook
          </button>
          <button onClick={() => {
            const existing = JSON.parse(localStorage.getItem("lifeos_crm") || "[]") as unknown[];
            const newLeads = (sim.conflicts || []).slice(0, 2).map((c, i) => ({ id: "df" + Date.now() + i, name: c.title, status: "opportunity", notes: c.detail + " | Resolution: " + c.resolution, source: "dreamforge" }));
            localStorage.setItem("lifeos_crm", JSON.stringify([...existing, ...newLeads]));
            flashToast(`+${newLeads.length} opportunities → CRM`, C.amber);
          }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: "var(--warning-soft)", border: "1px solid var(--warning-border)", color: "var(--warning)", cursor: "pointer" }}>
            🎯 Log Opportunities in CRM
          </button>
          <button onClick={() => {
            const existing = JSON.parse(localStorage.getItem("lifeos_calendar") || "[]") as unknown[];
            const newEvents = (sim.phases || []).slice(0, 2).map((ph, i) => ({ id: Date.now() + i, name: `[Dream] ${ph.title}`, date: new Date(Date.now() + (i + 1) * 30 * 864e5).toISOString().split("T")[0], icon: "🌙", tag: "Business" }));
            localStorage.setItem("lifeos_calendar", JSON.stringify([...existing, ...newEvents]));
            flashToast(`+${newEvents.length} milestones → Calendar`, C.blue);
          }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: `color-mix(in srgb, ${C.blue} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${C.blue} 30%, transparent)`, color: C.blue, cursor: "pointer" }}>
            📅 Schedule Milestones
          </button>
          <button onClick={() => {
            try {
              // const erebus = getErebusCore();  // Excluded from build
              // void erebus.reason(`Run DreamForge routine for: ${dream}. Apply playbook and monitor.`);
              flashToast("Erebus integration pending (excluded from build)", "var(--warning)");
            } catch {
              flashToast("Erebus unavailable", "var(--danger)");
            }
          }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", color: C.primary, cursor: "pointer" }}>
            🤖 Run as Erebus Autonomous Routine
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 2, padding: "8px 16px", background: "var(--card-alt)", borderBottom: "1px solid var(--border-soft)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", border: "none",
              background: activeTab === t.id ? "var(--crimson-soft)" : "transparent",
              color: activeTab === t.id ? C.primary : "var(--text-muted)",
              borderBottom: activeTab === t.id ? `2px solid ${C.primary}` : "2px solid transparent" }}>
            {t.label}
            {t.id === "conflicts" && sim.conflicts?.length > 0 && (
              <span style={{ marginLeft: 5, background: "var(--danger)", color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9 }}>
                {sim.conflicts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {activeTab === "timeline" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 16 }}>6–12 Month Playbook</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(sim.phases || []).map((ph, i) => {
                const colors = [C.primary, C.teal, C.amber, C.blue];
                const col = colors[i % colors.length];
                return (
                  <div key={i} style={{ display: "flex", gap: 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `color-mix(in srgb, ${col} 22%, transparent)`, border: `2px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, zIndex: 1 }}>
                        {ph.emoji || "📍"}
                      </div>
                      {i < (sim.phases.length - 1) && <div style={{ width: 2, flex: 1, background: `color-mix(in srgb, ${col} 30%, transparent)`, minHeight: 24 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 20, paddingLeft: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: col, fontWeight: 700, background: `color-mix(in srgb, ${col} 15%, transparent)`, padding: "2px 8px", borderRadius: 10 }}>
                          Months {ph.months}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{ph.title}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                        {(ph.tasks || []).map((task, j) => {
                          const key = `${i}-${j}`;
                          const done = !!doneTasks[key];
                          return (
                            <div key={j} onClick={() => setDoneTasks(d => ({ ...d, [key]: !d[key] }))}
                              style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: done ? "var(--text-faint)" : "var(--text-dim)", cursor: "pointer", textDecoration: done ? "line-through" : "none" }}>
                              <span style={{ color: col, flexShrink: 0 }}>{done ? "☑" : "▸"}</span>
                              {task}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {ph.milestone && (
                          <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "var(--success-soft)", border: "1px solid var(--success-border)", color: "var(--success)" }}>
                            🏆 {ph.milestone}
                          </div>
                        )}
                        {ph.risk && (
                          <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: "var(--warning-soft)", border: "1px solid var(--warning-border)", color: "var(--warning)" }}>
                            ⚡ Risk: {ph.risk}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {(sim.energyTip || sim.familyTie) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                {sim.energyTip && (
                  <div style={{ background: `color-mix(in srgb, ${C.blue} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${C.blue} 25%, transparent)`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, marginBottom: 4 }}>⚡ ENERGY TIP</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{sim.energyTip}</div>
                  </div>
                )}
                {sim.familyTie && (
                  <div style={{ background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 4 }}>👨‍👩‍👧 FAMILY TIE-IN</div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{sim.familyTie}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "revenue" && sim.revenue && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Revenue Projection</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 20 }}>Adjust the slider to model different effort levels</div>

            <div style={{ background: "var(--card-alt)", borderRadius: 12, padding: "20px 16px", marginBottom: 16, display: "inline-block" }}>
              <RevenueChart data={sim.revenue} multiplier={multiplier} />
            </div>

            <div style={{ background: C.card, border: "1px solid var(--crimson-border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>📊 Effort Multiplier</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{multiplier.toFixed(1)}x</span>
              </div>
              <input type="range" min={0.5} max={3} step={0.1} value={multiplier}
                onChange={e => setMultiplier(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: C.primary }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)", marginTop: 4 }}>
                <span>0.5x (minimal effort)</span>
                <span>3x (full-send)</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Month 3",  val: sim.revenue.month3  },
                { label: "Month 6",  val: sim.revenue.month6  },
                { label: "Month 9",  val: sim.revenue.month9  },
                { label: "Month 12", val: sim.revenue.month12 },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: "var(--crimson-soft)", border: "1px solid var(--crimson-border)", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>
                    ${Math.round(val * multiplier).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {sim.revenue.assumptions?.length > 0 && (
              <div style={{ background: "var(--card-alt)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 700, marginBottom: 8 }}>PROJECTION ASSUMPTIONS</div>
                {sim.revenue.assumptions.map((a, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: C.primary }}>•</span>{a}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "conflicts" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Reality Checks & Conflict Warnings</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>Issues detected between your dream and your current life</div>
            {sortedConflicts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: C.teal }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 13 }}>No major conflicts detected. Clear path ahead.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sortedConflicts.map((c, i) => <ConflictBadge key={i} conflict={c} />)}
              </div>
            )}
          </div>
        )}

        {activeTab === "scenarios" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Branching Realities</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>Three possible versions of your 12-month outcome</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(sim.scenarios || []).map((s, i) => {
                // Ignore AI-supplied color; fall back to crimson/teal/green by index for on-brand consistency
                const paletteCol = [C.teal, C.primary, C.green][i] ?? C.primary;
                const active = activeScenario === i;
                return (
                  <button key={i} onClick={() => setActiveScenario(i)}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${active ? paletteCol : C.border}`, background: active ? `color-mix(in srgb, ${paletteCol} 12%, transparent)` : "transparent", color: active ? paletteCol : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    {s.name}
                  </button>
                );
              })}
            </div>
            {sim.scenarios?.[activeScenario] && (() => {
              const s = sim.scenarios[activeScenario];
              const col = [C.teal, C.primary, C.green][activeScenario] ?? C.primary;
              return (
                <div style={{ background: `color-mix(in srgb, ${col} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 25%, transparent)`, borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: col, marginBottom: 10 }}>
                    {s.name} Path
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 16 }}>
                    {s.description}
                  </div>
                  {s.monthlyRevenue12 > 0 && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `color-mix(in srgb, ${col} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 30%, transparent)`, borderRadius: 10, padding: "8px 16px" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Month 12 revenue:</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: col }}>
                        ${s.monthlyRevenue12.toLocaleString()}/mo
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {sim.scenarios?.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 10 }}>At a glance</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${sim.scenarios.length}, 1fr)`, gap: 10 }}>
                  {sim.scenarios.map((s, i) => {
                    const col = [C.teal, C.primary, C.green][i] ?? C.primary;
                    return (
                      <div key={i} style={{ background: "var(--card-alt)", border: `1px solid color-mix(in srgb, ${col} 25%, transparent)`, borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 6 }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.5, marginBottom: 8 }}>{s.description.slice(0, 100)}{s.description.length > 100 ? "…" : ""}</div>
                        {s.monthlyRevenue12 > 0 && (
                          <div style={{ fontSize: 13, fontWeight: 800, color: col }}>${s.monthlyRevenue12.toLocaleString()}<span style={{ fontSize: 9, fontWeight: 400, color: "var(--text-muted)" }}>/mo M12</span></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "actions" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 4 }}>Ready-to-Send Action Drafts</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>AI-drafted outreach and grant applications — click to expand and copy</div>
            {(!sim.actions || sim.actions.length === 0) ? (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-faint)" }}>No action drafts generated.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.actions.map((a, i) => <ActionCard key={i} action={a} />)}
              </div>
            )}
          </div>
        )}

      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, padding: "10px 16px", borderRadius: 10, background: "var(--surface-strong)", border: `1px solid color-mix(in srgb, ${toast.col} 40%, transparent)`, color: toast.col, fontSize: 12, fontWeight: 600, zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes dfSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}