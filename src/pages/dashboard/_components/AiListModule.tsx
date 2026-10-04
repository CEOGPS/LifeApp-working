// src/pages/dashboard/_components/AiListModule.tsx
// PATCH (home-page2): shared body for the home AI list modules (AI Money Tips,
// Life Hacks, AI Insights). Items persist (unifiedStorage -> Supabase app_settings)
// under the ORIGINAL store keys; `auto` regenerates when empty or older than a day.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { useHomeState } from "../_lib/useHomeState";
import { homeLlmList } from "../_lib/homeAi";

type Meta = { ts: number; via: string } | null;
const DAY = 24 * 60 * 60 * 1000;

export default function AiListModule({
  storeKey,
  buildPrompt,
  count,
  icon,
  buttonLabel,
  emptyText,
  auto = true,
  itemClassName = "glass rounded-lg p-3 border border-white/5",
}: {
  storeKey: string;
  buildPrompt: () => Promise<string> | string;
  count: number;
  icon: ReactNode;
  buttonLabel: string;
  emptyText: string;
  auto?: boolean;
  itemClassName?: string;
}) {
  const [items, setItems] = useHomeState<string[]>(storeKey, []);
  const [meta, setMeta] = useHomeState<Meta>(`${storeKey}_meta`, null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const prompt = await buildPrompt();
      const res = await homeLlmList(prompt, count);
      await setItems(res.items);
      await setMeta({ ts: Date.now(), via: res.via });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      console.warn(`[${storeKey}] generate failed:`, msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    const stale = !meta || Date.now() - meta.ts > DAY;
    if (!items.length || stale) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex-1 space-y-2 overflow-y-auto min-h-0 pr-1">
        {items.length === 0 && !loading && !error && (
          <div className="text-[11px] text-white/30 italic text-center pt-6">{emptyText}</div>
        )}
        {items.length === 0 && loading && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-white/40 pt-6">
            <Loader2 size={12} className="animate-spin" /> Generating…
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} className={itemClassName} data-ai-item="">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{icon}</span>
              <div className="text-[11px] text-white/75 leading-relaxed">{item}</div>
            </div>
          </div>
        ))}
        {error && (
          <div className="flex items-start gap-1.5 text-[10px] text-amber-300/70 p-2 rounded border border-amber-400/15 bg-amber-400/5" role="alert">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            <span className="break-words">No AI backend answered: {error}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-white/25 truncate" data-ai-via="" title={meta?.via || ""}>
          {meta ? `via ${meta.via} · ${new Date(meta.ts).toLocaleDateString([], { month: "short", day: "numeric" })}` : ""}
        </span>
        <button
          onClick={generate}
          disabled={loading}
          className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/10 text-[10px] text-white/50 hover:border-primary/30 hover:text-primary/70 transition-colors font-display tracking-wider disabled:opacity-50"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} {buttonLabel}
        </button>
      </div>
    </div>
  );
}
