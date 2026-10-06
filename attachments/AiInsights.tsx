import { Brain, RefreshCw } from "lucide-react";

export default function AiInsights() {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {[1, 2].map((i) => (
          <div key={i} className="glass-crimson rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Brain size={12} className="text-primary/60 mt-0.5 shrink-0" />
              <div className="text-[11px] text-white/25 italic leading-relaxed">
                AI will surface cross-domain insights here once data sources are connected...
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-primary/15 text-[10px] text-white/20 hover:border-primary/35 hover:text-primary/60 transition-colors font-display tracking-wider">
        <RefreshCw size={11} /> ANALYZE
      </button>
    </div>
  );
}
