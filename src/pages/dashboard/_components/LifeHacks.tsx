// PATCH (home-page2): same store key ("dashboard_life_hacks"); now auto-loads and uses
// homeAi (worker -> saved LLM keys -> Erebus stack) instead of a worker-only call.
import { Lightbulb } from "lucide-react";
import AiListModule from "./AiListModule";

export default function LifeHacks() {
  return (
    <AiListModule
      storeKey="dashboard_life_hacks"
      count={3}
      icon={<Lightbulb size={12} className="text-yellow-400/60" />}
      buttonLabel="NEW HACKS"
      emptyText="Life hacks will appear here."
      itemClassName="p-2.5 glass rounded-lg border border-white/5"
      buildPrompt={() =>
        "Give 3 short, practical daily life hacks (each under 18 words) useful for a busy business owner balancing family, running a plumbing/electrical company, and a marketing agency."
      }
    />
  );
}
