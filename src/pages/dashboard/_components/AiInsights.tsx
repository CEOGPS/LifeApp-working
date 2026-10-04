// PATCH (home-page2): was a direct worker-only fetch (403 for unlinked sessions) and was
// replaced by a stub on the dashboard. Now persisted ("dashboard_ai_insights") and
// routed through homeAi (worker -> saved LLM keys -> Erebus stack). On-demand only.
import { Brain } from "lucide-react";
import AiListModule from "./AiListModule";
import { readHomeState } from "../_lib/useHomeState";

export default function AiInsights() {
  return (
    <AiListModule
      storeKey="dashboard_ai_insights"
      count={2}
      auto={false}
      icon={<Brain size={12} className="text-primary/70" />}
      buttonLabel="ANALYZE"
      emptyText="Click Analyze to surface cross-domain insights."
      itemClassName="glass-crimson rounded-lg p-3"
      buildPrompt={() => {
        const leads = readHomeState<unknown[]>("dashboard_leads")?.length ?? 0;
        const bills = readHomeState<unknown[]>("budget_bills")?.length ?? 0;
        const events = readHomeState<unknown[]>("calendar_events")?.length ?? 0;
        return `Give 2 short, punchy cross-domain business insights (each under 20 words) for a busy Atlanta plumbing/electrical business owner who also runs a marketing agency and builds software. Current dashboard data: ${leads} leads, ${bills} tracked bills, ${events} calendar events.`;
      }}
    />
  );
}
