import type { Person, ScoredPerson, ScoreOverride } from "../MarketingPanel.types";

const tagWeights: Record<string, number> = {
  VIP: 20, Hot: 18, Warm: 10, Cold: -15, Referral: 12,
};

export function scorePerson(p: Person, override?: ScoreOverride): ScoredPerson {
  if (override) {
    return {
      ...p,
      capitalScore: override.score,
      scoreReason: override.reason ?? "Manual override",
      scoreBreakdown: [{ label: "Manual override", delta: override.score - 50 }],
    };
  }
  const breakdown: { label: string; delta: number }[] = [];
  let score = 50;

  const push = (label: string, delta: number) => {
    if (delta !== 0) breakdown.push({ label, delta });
    score += delta;
  };

  if (p.type === "Family") push("Family connection", 15);
  if (p.type === "Business") push("Business contact", 5);

  for (const tag of p.tags) {
    const w = tagWeights[tag];
    if (w) push(`Tag: ${tag}`, w);
  }

  const lc = p.lastContact ?? "";
  if (!lc || lc === "Never") push("Never contacted", -20);
  else if (/just now|today/i.test(lc)) push("Contacted today", 20);
  else if (/^\d+ day/i.test(lc) && parseInt(lc) < 3) push("Contacted recently", 15);
  else if (/week/i.test(lc) && parseInt(lc) < 2) push("Contacted this week", 8);
  else if (/month|2 weeks|ago/i.test(lc)) push("Overdue outreach", -10);

  if (p.kpi) {
    const avg = ((p.kpi.connect ?? 5) + (p.kpi.support ?? 5)) / 2;
    push("Relationship KPIs", Math.round((avg - 5) * 3));
  }

  if (p.stage) {
    const stage: Record<string, number> = {
      "Closed Won": 25, Negotiation: 18, Proposal: 12, Qualified: 8, "Closed Lost": -20,
    };
    if (stage[p.stage]) push(`Stage: ${p.stage}`, stage[p.stage]);
  }

  if (p.value) {
    const n = parseFloat(String(p.value).replace(/[^0-9.]/g, ""));
    if (n > 10000) push("High-value deal", 15);
    else if (n > 1000) push("Mid-value deal", 8);
  }

  if (p.notes) push("Has notes", 3);
  if (p.birthday) push("Birthday tracked", 5);

  return {
    ...p,
    capitalScore: Math.max(0, Math.min(100, Math.round(score))),
    scoreReason: breakdown.slice(0, 3).map((b) => b.label).join(" · "),
    scoreBreakdown: breakdown,
  };
}

export function scoreLabel(s: number): { label: string; color: string } {
  if (s >= 80) return { label: "🔥 Hot", color: "#ff4f5e" };
  if (s >= 65) return { label: "⚡ Active", color: "#ff8c42" };
  if (s >= 45) return { label: "🌡 Warm", color: "#4ab3f4" };
  return { label: "❄ Cold", color: "#6aaedd" };
}