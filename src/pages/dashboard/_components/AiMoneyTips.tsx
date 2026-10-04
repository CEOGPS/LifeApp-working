// PATCH (home-page2): restored the Budget -> Money Tips link (reads the shared
// "budget_bills" store, as the original did; the regression read AI agents instead),
// persisted tips again ("dashboard_money_tips") and routed the call through homeAi
// (worker -> saved LLM keys -> Erebus stack).
import { Sparkles } from "lucide-react";
import AiListModule from "./AiListModule";
import { readHomeState } from "../_lib/useHomeState";

type Bill = { name: string; amount: string; paid: boolean };

function billsContext(): string {
  const bills = readHomeState<Bill[]>("budget_bills") || [];
  if (!bills.length) return "They have not entered any bills yet.";
  const total = bills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const unpaid = bills.filter((b) => !b.paid);
  const top = [...bills]
    .sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))
    .slice(0, 5)
    .map((b) => `${b.name} $${parseFloat(b.amount) || 0}`)
    .join(", ");
  return `They track ${bills.length} bills totalling $${total.toFixed(2)} (${unpaid.length} unpaid). Largest: ${top}.`;
}

export default function AiMoneyTips() {
  return (
    <AiListModule
      storeKey="dashboard_money_tips"
      count={3}
      icon={<Sparkles size={12} className="text-primary/70" />}
      buttonLabel="REFRESH TIPS"
      emptyText="Money tips will appear here."
      buildPrompt={() =>
        `Give 3 short, actionable money-making or money-saving tips (each under 22 words) for a business owner who runs a plumbing/electrical company and a marketing agency in Atlanta. ${billsContext()}`
      }
    />
  );
}
