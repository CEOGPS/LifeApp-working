import { C } from "@/lib/palette";
import { useState, useCallback, useMemo } from "react";
import { invokeLLM, type LLMResponse } from "@/lib/llm";

// ── Storage ──────────────────────────────────────────────────────────────────
const BUDGET_KEY = "lifeos1_shadow_budget";
const ORACLE_KEY = "lifeos1_oracle_insights";

function load<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return def;
    return JSON.parse(raw) as T;
  } catch {
    return def;
  }
}
function save(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota */
  }
}

const fmt = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);

// ── Types ────────────────────────────────────────────────────────────────────
interface Expense {
  id: number;
  label: string;
  amount: number;
  category: string;
  fixed: boolean;
}
interface Budget {
  income: number;
  expenses: Expense[];
}
interface Scenario {
  name: string;
  description: string;
  change: string;
  monthlyDelta: number;
  yearlyDelta: number;
  month3: number;
  month6: number;
  month9: number;
  month12: number;
  happinessDelta: number;
  familyDinnersDelta: number;
  insightLine: string;
}
interface OracleInsight {
  category: string;
  title: string;
  decision: string;
  ripple: string;
  shadowValue: string;
  happinessCorrelation: number;
  actionable: string;
  urgency: "low" | "medium" | "high";
}
interface OracleResult {
  insights: OracleInsight[];
  shadowSummary: string;
  freedomNumber: number;
  freedomNumberNote: string;
}
interface RippleResult {
  decision: string;
  immediateImpact: string;
  month3: number;
  month6: number;
  month12: number;
  year3: number;
  shadowCost: string;
  happinessROI: string;
  familyEquivalent: string;
  verdict: "Worth It" | "Skip It" | "Delay It" | "Negotiate It";
  verdictReason: string;
  alternativeChallenge: string;
}

// ── Default budget ───────────────────────────────────────────────────────────
const DEFAULT_BUDGET: Budget = {
  income: 8000,
  expenses: [
    { id: 1, label: "Rent/Mortgage",  amount: 1800, category: "Housing",   fixed: true  },
    { id: 2, label: "Groceries",      amount: 600,  category: "Food",      fixed: false },
    { id: 3, label: "Dining Out",     amount: 400,  category: "Food",      fixed: false },
    { id: 4, label: "Subscriptions",  amount: 200,  category: "Tech",      fixed: false },
    { id: 5, label: "Entertainment",  amount: 300,  category: "Lifestyle", fixed: false },
    { id: 6, label: "Savings",        amount: 500,  category: "Savings",   fixed: false },
    { id: 7, label: "Business Tools", amount: 350,  category: "Business",  fixed: false },
    { id: 8, label: "Family/Kids",    amount: 400,  category: "Family",    fixed: false },
  ],
};

// Per-simulator accent for this panel: purple.
const ACCENT = C.purple;
const SHADOW_COLORS = [C.purple, C.teal, C.orange] as const;
const SHADOW_NAMES = ["Shadow A", "Shadow B", "Shadow C"] as const;

// ── Prompts ──────────────────────────────────────────────────────────────────
const ORACLE_SYSTEM = `You are the Shadow Budget Oracle for LifeOS1. You analyze financial patterns and surface non-obvious long-term ripple effects of everyday decisions.

Given the user's budget and context, return ONLY valid JSON:
{
  "insights": [
    {
      "category": "one of: Ripple | Shadow | Pattern | Warning | Opportunity",
      "title": "Short punchy title",
      "decision": "The specific everyday decision being flagged",
      "ripple": "What happens over 1-3 years if this continues",
      "shadowValue": "The invisible cost or gain expressed compellingly (e.g. 24 family dinners / $2,880/yr)",
      "happinessCorrelation": 15,
      "actionable": "One specific change to make this week",
      "urgency": "low|medium|high"
    }
  ],
  "shadowSummary": "2-sentence meta-insight about the biggest invisible pattern in this budget",
  "freedomNumber": 3200,
  "freedomNumberNote": "What the freedom number means for this person"
}`;

const SCENARIO_SYSTEM = `You are the Shadow Budget Oracle. Generate 3 shadow budget scenarios — parallel financial realities based on small changes.

Return ONLY valid JSON:
{
  "scenarios": [
    {
      "name": "Shadow A name (3-4 words)",
      "description": "1-sentence premise of this shadow reality",
      "change": "The single key spending change",
      "monthlyDelta": -200,
      "yearlyDelta": -2400,
      "month3": 1200,
      "month6": 2800,
      "month9": 4500,
      "month12": 6500,
      "happinessDelta": 8,
      "familyDinnersDelta": 12,
      "insightLine": "The non-obvious payoff of this scenario (specific, vivid)"
    },
    { "name":"...","description":"...","change":"...","monthlyDelta":0,"yearlyDelta":0,"month3":0,"month6":0,"month9":0,"month12":0,"happinessDelta":0,"familyDinnersDelta":0,"insightLine":"..." },
    { "name":"...","description":"...","change":"...","monthlyDelta":0,"yearlyDelta":0,"month3":0,"month6":0,"month9":0,"month12":0,"happinessDelta":0,"familyDinnersDelta":0,"insightLine":"..." }
  ]
}`;

const RIPPLE_SYSTEM = `You are the Shadow Budget Oracle analyzing a specific purchasing decision.

Return ONLY valid JSON:
{
  "decision": "restated decision",
  "immediateImpact": "What happens to this month's budget",
  "month3": -500,
  "month6": -1200,
  "month12": -2400,
  "year3": -7500,
  "shadowCost": "What $X over 3 years could instead have become (specific alternative use)",
  "happinessROI": "honest 1-sentence happiness return on this decision",
  "familyEquivalent": "equivalent in family experiences (e.g. '18 weekend day-trips')",
  "verdict": "Worth It | Skip It | Delay It | Negotiate It",
  "verdictReason": "1-sentence honest rationale",
  "alternativeChallenge": "A creative alternative that achieves 80% of the benefit at 30% of the cost"
}`;

// ── JSON parse ───────────────────────────────────────────────────────────────
function parseJSON<T>(raw: string): T | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? (JSON.parse(m[0]) as T) : null;
  } catch {
    return null;
  }
}

// Extract usable text from an LLMResponse
function textOf(res: LLMResponse): string {
  return res.ok ? res.text : "";
}

// ── Ripple SVG chart ─────────────────────────────────────────────────────────
interface RippleChartProps {
  current: Budget;
  scenarios: Scenario[];
  width?: number;
  height?: number;
}

function RippleChart({ current, scenarios, width = 340, height = 160 }: RippleChartProps) {
  const months = ["M3", "M6", "M9", "M12"];

  const baseMonthly = current.income - current.expenses.reduce((s, e) => s + e.amount, 0);
  const basePoints = [baseMonthly * 3, baseMonthly * 6, baseMonthly * 9, baseMonthly * 12];

  const allVals = [
    ...basePoints,
    ...scenarios.flatMap((s) => [s.month3, s.month6, s.month9, s.month12]),
  ].filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  // Bug fix from original: empty allVals produced Infinity/-Infinity.
  const minV = allVals.length > 0 ? Math.min(...allVals, 0) : 0;
  const maxV = allVals.length > 0 ? Math.max(...allVals, 1000) : 1000;
  const range = maxV - minV || 1;

  const PAD = { t: 16, r: 16, b: 28, l: 52 };
  const W = width - PAD.l - PAD.r;
  const H = height - PAD.t - PAD.b;
  const xStep = W / 3;

  const toY = (v: number) => PAD.t + H - ((v - minV) / range) * H;
  const toX = (i: number) => PAD.l + i * xStep;
  const pointsForLine = (arr: number[]) => arr.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");

  const basePts = pointsForLine(basePoints);

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = PAD.t + H * (1 - pct);
        const val = minV + pct * range;
        return (
          <g key={pct}>
            <line x1={PAD.l} x2={PAD.l + W} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fill="#4a5568" fontSize={9}>
              {val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${Math.round(val)}`}
            </text>
          </g>
        );
      })}
      {months.map((m, i) => (
        <text key={m} x={toX(i)} y={height - 4} textAnchor="middle" fill="#6aaedd" fontSize={10}>
          {m}
        </text>
      ))}
      {minV < 0 && (
        <line
          x1={PAD.l}
          x2={PAD.l + W}
          y1={toY(0)}
          y2={toY(0)}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}
      <polyline points={basePts} fill="none" stroke={C.blue} strokeWidth={2} />
      {basePoints.map((v, i) => (
        <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={C.blue} />
      ))}
      {scenarios.map((s, si) => {
        const pts = pointsForLine([s.month3, s.month6, s.month9, s.month12]);
        const col = SHADOW_COLORS[si % SHADOW_COLORS.length];
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={col} strokeWidth={2} strokeDasharray="5 3" />
            {[s.month3, s.month6, s.month9, s.month12].map((v, i) => (
              <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={col} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── Urgency badge ────────────────────────────────────────────────────────────
function UrgencyBadge({ urgency }: { urgency: OracleInsight["urgency"] }) {
  const map: Record<OracleInsight["urgency"], string> = {
    high: C.red,
    medium: C.orange,
    low: C.teal,
  };
  const col = map[urgency] ?? C.teal;
  return (
    <span
      style={{
        fontSize: 9,
        padding: "1px 7px",
        borderRadius: 10,
        background: `${col}20`,
        color: col,
        fontWeight: 700,
        border: `1px solid ${col}30`,
      }}
    >
      {urgency}
    </span>
  );
}

// ── Verdict chip ─────────────────────────────────────────────────────────────
function VerdictChip({ verdict }: { verdict: RippleResult["verdict"] }) {
  const map: Record<RippleResult["verdict"], string> = {
    "Worth It": C.teal,
    "Skip It": C.red,
    "Delay It": C.orange,
    "Negotiate It": C.purple,
  };
  const col = map[verdict] ?? C.purple;
  return (
    <span
      style={{
        fontSize: 11,
        padding: "3px 12px",
        borderRadius: 20,
        background: `${col}20`,
        color: col,
        fontWeight: 700,
        border: `1px solid ${col}40`,
      }}
    >
      {verdict}
    </span>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
interface ShadowBudgetOracleProps {
  onBack: () => void;
}

type TabId = "shadow" | "ripple" | "decision" | "oracle";

export default function ShadowBudgetOracle({ onBack }: ShadowBudgetOracleProps) {
  const [activeTab, setActiveTab] = useState<TabId>("shadow");

  const [budget, setBudget] = useState<Budget>(() => load(BUDGET_KEY, DEFAULT_BUDGET));
  const [editingBudget, setEditingBudget] = useState(false);
  const [newExpense, setNewExpense] = useState({ label: "", amount: "", category: "Lifestyle" });

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenLoading, setScenLoading] = useState(false);

  const [oracle, setOracle] = useState<OracleResult | null>(() => load(ORACLE_KEY, null as OracleResult | null));
  const [oracleLoad, setOracleLoad] = useState(false);

  const [decision, setDecision] = useState("");
  const [decisionAmt, setDecisionAmt] = useState("");
  const [ripple, setRipple] = useState<RippleResult | null>(null);
  const [rippleLoad, setRippleLoad] = useState(false);

  const totalExpenses = useMemo(
    () => budget.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [budget],
  );
  const monthlySurplus = useMemo(
    () => (Number(budget.income) || 0) - totalExpenses,
    [budget.income, totalExpenses],
  );

  const saveBudget = useCallback((b: Budget) => {
    setBudget(b);
    save(BUDGET_KEY, b);
  }, []);

  const updateExpense = useCallback(
    (id: number, field: keyof Expense, val: string | number) => {
      saveBudget({
        ...budget,
        expenses: budget.expenses.map((e) =>
          e.id === id
            ? { ...e, [field]: field === "amount" ? Number(val) || 0 : val }
            : e,
        ),
      });
    },
    [budget, saveBudget],
  );

  const removeExpense = useCallback(
    (id: number) => {
      saveBudget({ ...budget, expenses: budget.expenses.filter((e) => e.id !== id) });
    },
    [budget, saveBudget],
  );

  const addExpense = useCallback(() => {
    if (!newExpense.label.trim() || !newExpense.amount) return;
    const next: Budget = {
      ...budget,
      expenses: [
        ...budget.expenses,
        {
          id: Date.now(),
          label: newExpense.label.trim(),
          amount: Number(newExpense.amount),
          category: newExpense.category,
          fixed: false,
        },
      ],
    };
    saveBudget(next);
    setNewExpense({ label: "", amount: "", category: "Lifestyle" });
  }, [budget, newExpense, saveBudget]);

  const genScenarios = useCallback(async () => {
    setScenLoading(true);
    setScenarios([]);
    const prompt = [
      `Monthly income: ${fmt(budget.income)}`,
      `Monthly surplus: ${fmt(monthlySurplus)}`,
      `Expenses: ${budget.expenses.map((e) => `${e.label}: ${fmt(e.amount)}`).join(", ")}`,
      `Location: Atlanta, GA. Marketing business owner, family-oriented.`,
    ].join("\n");
    const res = await invokeLLM({ systemPrompt: SCENARIO_SYSTEM, prompt });
    const parsed = parseJSON<{ scenarios: Scenario[] }>(textOf(res));
    if (parsed?.scenarios) setScenarios(parsed.scenarios);
    setScenLoading(false);
  }, [budget, monthlySurplus]);

  const runOracle = useCallback(async () => {
    setOracleLoad(true);
    setOracle(null);
    const prompt = [
      `Monthly income: ${fmt(budget.income)}, surplus: ${fmt(monthlySurplus)}`,
      `Expenses: ${budget.expenses.map((e) => `${e.label}: ${fmt(e.amount)} (${e.category})`).join(", ")}`,
      `Atlanta marketing business owner, family man, gamer.`,
    ].join("\n");
    const res = await invokeLLM({ systemPrompt: ORACLE_SYSTEM, prompt });
    const parsed = parseJSON<OracleResult>(textOf(res));
    if (parsed) {
      setOracle(parsed);
      save(ORACLE_KEY, parsed);
    }
    setOracleLoad(false);
  }, [budget, monthlySurplus]);

  const scanDecision = useCallback(async () => {
    if (!decision.trim()) return;
    setRippleLoad(true);
    setRipple(null);
    const prompt = [
      `Decision: ${decision}${decisionAmt ? ` — cost: $${decisionAmt}` : ""}`,
      `Current monthly surplus: ${fmt(monthlySurplus)}`,
      `Monthly income: ${fmt(budget.income)}`,
      `Atlanta family-focused marketing entrepreneur.`,
    ].join("\n");
    const res = await invokeLLM({ systemPrompt: RIPPLE_SYSTEM, prompt });
    setRipple(parseJSON<RippleResult>(textOf(res)));
    setRippleLoad(false);
  }, [decision, decisionAmt, budget, monthlySurplus]);

  const card = {
    background: "#11131f",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
  };
  const inp = {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0a0b12",
    fontSize: 12,
    color: "#f0ede8",
    outline: "none",
    boxSizing: "border-box" as const,
    width: "100%",
  };
  const btnS = (col: string) => ({
    padding: "6px 14px",
    borderRadius: 8,
    background: `${col}15`,
    border: `1px solid ${col}40`,
    color: col,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  });
  const btnP = (col: string) => ({
    padding: "10px 20px",
    borderRadius: 10,
    background: `linear-gradient(135deg, ${col}, ${col}90)`,
    border: "none",
    color: "#0a0b12",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  });

  const TABS: { id: TabId; label: string }[] = [
    { id: "shadow",   label: "🌑 Shadow View" },
    { id: "ripple",   label: "📊 Ripple Chart" },
    { id: "decision", label: "⚡ Decision Scanner" },
    { id: "oracle",   label: "🔮 Oracle Feed" },
  ];

  const CATEGORIES = [
    "Housing", "Food", "Tech", "Lifestyle", "Business",
    "Family", "Savings", "Transport", "Health", "Other",
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${ACCENT}15, ${C.blue}10)`,
          borderBottom: `1px solid ${ACCENT}25`,
          padding: "14px 20px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}
          >
            ← Back
          </button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>🔮</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>Shadow Budget Oracle</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>
              Parallel financial realities · Ripple effects of everyday decisions
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: monthlySurplus >= 0 ? C.teal : C.red,
                }}
              >
                {fmt(monthlySurplus)}
              </div>
              <div style={{ fontSize: 9, color: "#4a5568" }}>Monthly Surplus</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>
                {fmt(monthlySurplus * 12)}
              </div>
              <div style={{ fontSize: 9, color: "#4a5568" }}>Yearly Potential</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "6px 14px",
          background: "#0f1120",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "6px 13px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: activeTab === t.id ? `${ACCENT}20` : "transparent",
              color: activeTab === t.id ? ACCENT : "#6aaedd",
              borderBottom: activeTab === t.id ? `2px solid ${ACCENT}` : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SHADOW VIEW ── */}
      {activeTab === "shadow" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Budget editor sidebar */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: "1px solid rgba(255,255,255,0.06)",
              overflowY: "auto",
              padding: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700 }}>CURRENT BUDGET</div>
              <button onClick={() => setEditingBudget((e) => !e)} style={btnS(ACCENT)}>
                {editingBudget ? "Done" : "Edit"}
              </button>
            </div>

            <div
              style={{
                marginBottom: 12,
                padding: "10px 12px",
                background: `${C.teal}08`,
                border: `1px solid ${C.teal}20`,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginBottom: 4 }}>MONTHLY INCOME</div>
              {editingBudget ? (
                <input
                  type="number"
                  value={budget.income}
                  onChange={(e) => saveBudget({ ...budget, income: Number(e.target.value) || 0 })}
                  style={{
                    ...inp,
                    fontSize: 16,
                    fontWeight: 800,
                    color: C.teal,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                  }}
                />
              ) : (
                <div style={{ fontSize: 18, fontWeight: 800, color: C.teal }}>{fmt(budget.income)}</div>
              )}
            </div>

            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>EXPENSES</div>
            {budget.expenses.map((e) => (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                  padding: "6px 8px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                {editingBudget ? (
                  <>
                    <input
                      value={e.label}
                      onChange={(ev) => updateExpense(e.id, "label", ev.target.value)}
                      style={{ ...inp, flex: 1, fontSize: 11, padding: "4px 8px" }}
                    />
                    <input
                      type="number"
                      value={e.amount}
                      onChange={(ev) => updateExpense(e.id, "amount", ev.target.value)}
                      style={{ ...inp, width: 70, fontSize: 11, padding: "4px 8px" }}
                    />
                    <button
                      onClick={() => removeExpense(e.id)}
                      style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, flexShrink: 0 }}
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 11,
                        color: "#c8c8d0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#f0ede8", flexShrink: 0 }}>
                      {fmt(e.amount)}
                    </span>
                  </>
                )}
              </div>
            ))}

            {editingBudget && (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  background: `${ACCENT}08`,
                  borderRadius: 10,
                  border: `1px solid ${ACCENT}20`,
                }}
              >
                <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, marginBottom: 6 }}>ADD EXPENSE</div>
                <input
                  value={newExpense.label}
                  onChange={(e) => setNewExpense((n) => ({ ...n, label: e.target.value }))}
                  placeholder="Label"
                  style={{ ...inp, marginBottom: 6, fontSize: 11 }}
                />
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense((n) => ({ ...n, amount: e.target.value }))}
                    placeholder="Amount"
                    style={{ ...inp, flex: 1, fontSize: 11 }}
                  />
                  <select
                    value={newExpense.category}
                    onChange={(e) => setNewExpense((n) => ({ ...n, category: e.target.value }))}
                    style={{ ...inp, flex: 1, fontSize: 11, appearance: "none" }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <button onClick={addExpense} style={{ ...btnS(ACCENT), width: "100%" }}>
                  Add
                </button>
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: `${monthlySurplus >= 0 ? C.teal : C.red}08`,
                border: `1px solid ${monthlySurplus >= 0 ? C.teal : C.red}20`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: monthlySurplus >= 0 ? C.teal : C.red,
                  fontWeight: 700,
                  marginBottom: 2,
                }}
              >
                MONTHLY SURPLUS
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: monthlySurplus >= 0 ? C.teal : C.red,
                }}
              >
                {fmt(monthlySurplus)}
              </div>
              <div style={{ fontSize: 10, color: "#6aaedd", marginTop: 2 }}>
                = {fmt(monthlySurplus * 12)}/yr
              </div>
            </div>
          </div>

          {/* Scenarios main */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Shadow Budget Scenarios</div>
                <div style={{ fontSize: 11, color: "#6aaedd" }}>
                  3 parallel financial realities from small changes to your current budget
                </div>
              </div>
              <button onClick={genScenarios} disabled={scenLoading} style={btnP(ACCENT)}>
                {scenLoading ? "Simulating..." : "🌑 Generate Shadows"}
              </button>
            </div>

            {scenarios.length === 0 && !scenLoading && (
              <div style={{ textAlign: "center", padding: 60, color: "#4a5568" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🌑</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
                  Generate shadow scenarios to see 3 alternate financial realities based on small
                  changes to your current budget.
                </div>
              </div>
            )}

            {scenLoading && (
              <div style={{ textAlign: "center", padding: 40, color: ACCENT }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🔮</div>
                <div>Simulating parallel financial realities...</div>
              </div>
            )}

            {scenarios.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div
                  style={{
                    background: `${C.blue}08`,
                    border: `1px solid ${C.blue}25`,
                    borderRadius: 12,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 10px",
                        borderRadius: 10,
                        background: `${C.blue}20`,
                        color: C.blue,
                        fontWeight: 700,
                      }}
                    >
                      CURRENT REALITY
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Status Quo Path</span>
                  </div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 9, color: "#4a5568" }}>Monthly surplus</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmt(monthlySurplus)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "#4a5568" }}>12-month savings</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmt(monthlySurplus * 12)}</div>
                    </div>
                  </div>
                </div>

                {scenarios.map((s, i) => {
                  const col = SHADOW_COLORS[i % SHADOW_COLORS.length];
                  return (
                    <div key={i} style={{ background: `${col}06`, border: `1px solid ${col}25`, borderRadius: 12, padding: 16 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 10,
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "2px 10px",
                                borderRadius: 10,
                                background: `${col}20`,
                                color: col,
                                fontWeight: 700,
                              }}
                            >
                              {SHADOW_NAMES[i]}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{s.name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 6 }}>{s.description}</div>
                          <div
                            style={{
                              fontSize: 11,
                              padding: "5px 10px",
                              borderRadius: 8,
                              background: `${col}10`,
                              border: `1px solid ${col}20`,
                              color: col,
                              display: "inline-block",
                            }}
                          >
                            🔄 Change: {s.change}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 9, color: "#4a5568", marginBottom: 2 }}>Monthly delta</div>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 800,
                              color: s.monthlyDelta >= 0 ? C.teal : C.red,
                            }}
                          >
                            {s.monthlyDelta >= 0 ? "+" : ""}
                            {fmt(s.monthlyDelta)}
                          </div>
                          <div style={{ fontSize: 10, color: "#6aaedd" }}>{fmt(s.yearlyDelta)}/yr</div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        {([
                          ["M3", s.month3],
                          ["M6", s.month6],
                          ["M9", s.month9],
                          ["M12", s.month12],
                        ] as const).map(([label, val]) => (
                          <div
                            key={label}
                            style={{ textAlign: "center", padding: "6px 4px", background: `${col}10`, borderRadius: 8 }}
                          >
                            <div style={{ fontSize: 9, color: "#4a5568" }}>{label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{fmt(val)}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                        {s.happinessDelta !== 0 && (
                          <span
                            style={{
                              fontSize: 11,
                              color: s.happinessDelta > 0 ? C.teal : C.red,
                              fontWeight: 600,
                            }}
                          >
                            😊 {s.happinessDelta > 0 ? "+" : ""}
                            {s.happinessDelta}% happiness
                          </span>
                        )}
                        {s.familyDinnersDelta !== 0 && (
                          <span style={{ fontSize: 11, color: C.pink, fontWeight: 600 }}>
                            🍽️ +{s.familyDinnersDelta} family dinners/yr
                          </span>
                        )}
                      </div>

                      {s.insightLine && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "#c8c8d0",
                            padding: "6px 10px",
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 8,
                            fontStyle: "italic",
                          }}
                        >
                          💡 {s.insightLine}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RIPPLE CHART ── */}
      {activeTab === "ripple" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>
            12-Month Ripple Projection
          </div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>
            Cumulative savings across your current budget and shadow scenarios
          </div>

          {scenarios.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
              <div>Generate shadow scenarios first to see the ripple chart.</div>
              <button onClick={() => setActiveTab("shadow")} style={{ ...btnS(ACCENT), marginTop: 12 }}>
                Go to Shadow View
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: C.blue }} />
                  <span style={{ fontSize: 11, color: C.blue }}>Current</span>
                </div>
                {scenarios.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 20, height: 2, background: SHADOW_COLORS[i % SHADOW_COLORS.length] }} />
                    <span style={{ fontSize: 11, color: SHADOW_COLORS[i % SHADOW_COLORS.length] }}>
                      {s.name}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: "#0f1120",
                  borderRadius: 14,
                  padding: "20px 16px",
                  marginBottom: 20,
                  overflowX: "auto",
                }}
              >
                <RippleChart current={budget} scenarios={scenarios} width={Math.max(340, 560)} height={200} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 10,
                }}
              >
                <div style={{ ...card, padding: 14, border: `1px solid ${C.blue}25` }}>
                  <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, marginBottom: 4 }}>
                    Current Path (M12)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{fmt(monthlySurplus * 12)}</div>
                </div>
                {scenarios.map((s, i) => {
                  const col = SHADOW_COLORS[i % SHADOW_COLORS.length];
                  return (
                    <div key={i} style={{ ...card, padding: 14, border: `1px solid ${col}25` }}>
                      <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 4 }}>
                        {s.name} (M12)
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: col }}>{fmt(s.month12)}</div>
                      <div
                        style={{
                          fontSize: 10,
                          color: s.month12 > monthlySurplus * 12 ? C.teal : C.red,
                          marginTop: 2,
                          fontWeight: 600,
                        }}
                      >
                        {s.month12 > monthlySurplus * 12 ? "▲" : "▼"}{" "}
                        {fmt(Math.abs(s.month12 - monthlySurplus * 12))} vs current
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DECISION SCANNER ── */}
      {activeTab === "decision" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Decision Scanner</div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>
            Enter any spending decision — see its 3-year ripple, family equivalent, and verdict
          </div>

          <div style={{ maxWidth: 600 }}>
            <div style={{ ...card, padding: 16, marginBottom: 14, border: `1px solid ${C.orange}25` }}>
              <label
                style={{
                  fontSize: 10,
                  color: C.orange,
                  fontWeight: 700,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                ⚡ THE DECISION
              </label>
              <input
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                placeholder="e.g. Buy a new $800 gaming setup, upgrade MacBook for $2,400, subscribe to another SaaS at $150/mo..."
                style={{ ...inp, marginBottom: 10 }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>
                    Cost (if not mentioned above)
                  </label>
                  <input
                    type="number"
                    value={decisionAmt}
                    onChange={(e) => setDecisionAmt(e.target.value)}
                    placeholder="$"
                    style={inp}
                  />
                </div>
                <button
                  onClick={scanDecision}
                  disabled={rippleLoad || !decision.trim()}
                  style={{
                    ...btnP(C.orange),
                    alignSelf: "flex-end",
                    whiteSpace: "nowrap",
                    opacity: decision.trim() ? 1 : 0.4,
                  }}
                >
                  {rippleLoad ? "Scanning..." : "⚡ Scan Ripple"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {[
                "New gaming setup $800",
                "MacBook upgrade $2,400",
                "SaaS subscription $150/mo",
                "Family vacation $3,500",
                "Business coach $500/mo",
              ].map((p) => (
                <button
                  key={p}
                  onClick={() => setDecision(p)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent",
                    color: "#8892a4",
                    fontSize: 10,
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            {ripple && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: "#11131f",
                    borderRadius: 12,
                  }}
                >
                  <VerdictChip verdict={ripple.verdict} />
                  <span style={{ fontSize: 12, color: "#c8c8d0" }}>{ripple.verdictReason}</span>
                </div>

                <div style={{ ...card, padding: 16 }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 10 }}>
                    CUMULATIVE COST RIPPLE
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {([
                      ["3 Months", ripple.month3],
                      ["6 Months", ripple.month6],
                      ["12 Months", ripple.month12],
                      ["3 Years", ripple.year3],
                    ] as const).map(([label, val]) => (
                      <div
                        key={label}
                        style={{ textAlign: "center", padding: 8, background: `${C.red}08`, borderRadius: 8 }}
                      >
                        <div style={{ fontSize: 9, color: "#4a5568" }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: val < 0 ? C.red : C.teal }}>
                          {fmt(val)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {ripple.shadowCost && (
                    <div style={{ ...card, padding: 14, border: `1px solid ${ACCENT}20` }}>
                      <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, marginBottom: 4 }}>
                        🌑 SHADOW COST
                      </div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{ripple.shadowCost}</div>
                    </div>
                  )}
                  {ripple.familyEquivalent && (
                    <div style={{ ...card, padding: 14, border: `1px solid ${C.pink}20` }}>
                      <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 4 }}>
                        👨‍👩‍👧 FAMILY EQUIVALENT
                      </div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>
                        {ripple.familyEquivalent}
                      </div>
                    </div>
                  )}
                </div>

                {ripple.happinessROI && (
                  <div style={{ ...card, padding: 12, border: `1px solid ${C.gold}20` }}>
                    <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>
                      😊 HAPPINESS ROI
                    </div>
                    <div style={{ fontSize: 12, color: "#c8c8d0" }}>{ripple.happinessROI}</div>
                  </div>
                )}

                {ripple.alternativeChallenge && (
                  <div style={{ ...card, padding: 12, border: `1px solid ${C.teal}20` }}>
                    <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginBottom: 4 }}>
                      💡 ALTERNATIVE CHALLENGE
                    </div>
                    <div style={{ fontSize: 12, color: "#c8c8d0" }}>{ripple.alternativeChallenge}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ORACLE FEED ── */}
      {activeTab === "oracle" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Oracle Insight Feed</div>
            <button onClick={runOracle} disabled={oracleLoad} style={btnP(ACCENT)}>
              {oracleLoad ? "Reading shadows..." : "🔮 Run Oracle"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>
            Proactive ripple flags — tiny decisions with outsized long-term consequences
          </div>

          {!oracle && !oracleLoad && (
            <div style={{ textAlign: "center", padding: 60, color: "#4a5568" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔮</div>
              <div style={{ fontSize: 13, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
                The Oracle scans your budget for invisible patterns and flags everyday decisions
                with outsized long-term ripple effects.
              </div>
            </div>
          )}

          {oracleLoad && (
            <div style={{ textAlign: "center", padding: 40, color: ACCENT }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔮</div>
              <div>The Oracle is reading your shadow patterns...</div>
            </div>
          )}

          {oracle && (
            <div style={{ maxWidth: 640 }}>
              {oracle.freedomNumber > 0 && (
                <div
                  style={{
                    background: `${C.gold}08`,
                    border: `1px solid ${C.gold}30`,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>
                    🔮 YOUR FREEDOM NUMBER
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.gold, marginBottom: 4 }}>
                    {fmt(oracle.freedomNumber)}
                  </div>
                  <div style={{ fontSize: 12, color: "#c8c8d0" }}>{oracle.freedomNumberNote}</div>
                </div>
              )}

              {oracle.shadowSummary && (
                <div style={{ ...card, padding: 14, marginBottom: 16, borderLeft: `3px solid ${ACCENT}` }}>
                  <div style={{ fontSize: 10, color: ACCENT, fontWeight: 700, marginBottom: 4 }}>
                    🌑 SHADOW PATTERN SUMMARY
                  </div>
                  <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.7 }}>
                    {oracle.shadowSummary}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(oracle.insights ?? []).map((ins, i) => {
                  const catColors: Record<string, string> = {
                    Ripple: ACCENT,
                    Shadow: C.blue,
                    Pattern: C.orange,
                    Warning: C.red,
                    Opportunity: C.teal,
                  };
                  const col = catColors[ins.category] ?? ACCENT;
                  return (
                    <div key={i} style={{ background: `${col}06`, border: `1px solid ${col}20`, borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 9px",
                            borderRadius: 10,
                            background: `${col}20`,
                            color: col,
                            fontWeight: 700,
                          }}
                        >
                          {ins.category}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{ins.title}</span>
                        <UrgencyBadge urgency={ins.urgency} />
                      </div>

                      {ins.decision && (
                        <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 6 }}>
                          Decision: <span style={{ color: "#c8c8d0" }}>{ins.decision}</span>
                        </div>
                      )}

                      {ins.ripple && (
                        <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.6, marginBottom: 8 }}>
                          {ins.ripple}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        {ins.shadowValue && (
                          <div
                            style={{
                              fontSize: 11,
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: `${col}12`,
                              border: `1px solid ${col}20`,
                              color: col,
                            }}
                          >
                            🌑 {ins.shadowValue}
                          </div>
                        )}
                        {ins.happinessCorrelation !== 0 && (
                          <div
                            style={{
                              fontSize: 11,
                              padding: "4px 10px",
                              borderRadius: 8,
                              background: `${C.pink}10`,
                              border: `1px solid ${C.pink}20`,
                              color: C.pink,
                            }}
                          >
                            😊 {ins.happinessCorrelation > 0 ? "+" : ""}
                            {ins.happinessCorrelation}% happiness
                          </div>
                        )}
                      </div>

                      {ins.actionable && (
                        <div
                          style={{
                            fontSize: 11,
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: `${C.teal}08`,
                            border: `1px solid ${C.teal}20`,
                            color: C.teal,
                          }}
                        >
                          ▸ This week: {ins.actionable}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}