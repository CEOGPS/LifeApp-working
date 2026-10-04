import { useState } from "react";
import { Search, Globe, ArrowRight } from "lucide-react";

export default function BrowserArea() {
  const [query, setQuery] = useState("");

  const search = () => {
    if (!query.trim()) return;
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      "_blank",
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Search bar */}
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Globe
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white-40"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search the web or enter URL..."
            className="w-full h-10 pl-10 pr-10 text-sm bg-white/4 border border-white/6 rounded-lg text-white-90 placeholder:text-white-30 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <button
          onClick={search}
          className="w-10 h-10 flex items-center justify-center rounded-lg glass-crimson text-primary hover:glow-crimson-sm transition-all"
        >
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Browsing area */}
      <div className="flex-1 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center min-h-[100px]">
        <div className="text-center px-4">
          <Globe size={28} className="mx-auto text-white-20 mb-3" />
          <div className="text-sm text-white-60">
            Search results will appear here
          </div>
          <div className="text-xs text-white-35 mt-1">
            OmniSearch connects 100+ sources
          </div>
        </div>
      </div>

      {/* Quick searches */}
      <div className="flex gap-2 flex-wrap border-t border-white/5 pt-2">
        {["News", "Stocks", "Weather", "Maps", "Images", "Videos"].map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuery(q);
              window.open(`https://www.google.com/search?q=${q}`, "_blank");
            }}
            className="text-xs px-3 py-1 rounded-full border border-white/8 text-white-50 hover:border-primary/30 hover:text-primary/70 transition-colors font-medium"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
