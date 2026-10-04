import {
  BarChart3,
  TrendingUp,
  Globe,
  Users,
  MousePointerClick,
} from "lucide-react";

const METRICS = [
  { label: "Sessions", icon: <Users size={11} />, val: "--" },
  { label: "Page Views", icon: <Globe size={11} />, val: "--" },
  { label: "Conversions", icon: <MousePointerClick size={11} />, val: "--" },
  { label: "Revenue", icon: <TrendingUp size={11} />, val: "$--" },
];

export default function MarketingAnalytics() {
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Metric row */}
      <div className="grid grid-cols-2 gap-1.5">
        {METRICS.map((m) => (
          <div
            key={m.label}
            className="glass rounded p-2 border border-white/5"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-white/25">{m.icon}</span>
              <span className="text-[9px] text-white/25 font-display tracking-wider">
                {m.label}
              </span>
            </div>
            <div className="text-sm text-white/50 font-display">{m.val}</div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="flex-1 rounded-lg bg-white/2 border border-white/5 flex items-center justify-center min-h-[70px]">
        <div className="text-center">
          <BarChart3 size={18} className="mx-auto text-white/10 mb-1" />
          <div className="text-[10px] text-white/15">
            Connect GA4, GSC, or Ads to load charts
          </div>
        </div>
      </div>

      {/* Campaign tags */}
      <div className="flex gap-1.5 flex-wrap border-t border-white/5 pt-2">
        {["Google Ads", "Meta Ads", "Email", "SEO", "Social"].map((c) => (
          <span
            key={c}
            className="text-[9px] px-2 py-0.5 rounded-full border border-white/8 text-white/25 cursor-pointer hover:border-primary/30 hover:text-primary/50 transition-colors"
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
