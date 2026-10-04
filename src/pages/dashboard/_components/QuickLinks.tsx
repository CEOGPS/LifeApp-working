import { useState } from "react";
import { Plus, ExternalLink, Trash2, Link2 } from "lucide-react";
// PATCH (home-page2): useHomeState = shared persistent store + migration of values saved
// under the legacy raw localStorage key (they vanished when the store gained a prefix).
import { useHomeState } from "../_lib/useHomeState";

type QuickLink = { id: string; label: string; url: string; icon?: string };

export default function QuickLinks() {
  const [links, setLinks] = useHomeState<QuickLink[]>("quick_links", []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", url: "" });

  const add = async () => {
    if (!form.label || !form.url) return;
    const url = form.url.startsWith("http") ? form.url : `https://${form.url}`;
    await setLinks((l) => [
      ...l,
      { id: Date.now().toString(), label: form.label, url },
    ]);
    setForm({ label: "", url: "" });
    setAdding(false);
  };

  const del = async (id: string) => await setLinks((l) => l.filter((x) => x.id !== id));

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 overflow-y-auto">
        {links.length === 0 ? (
          <div className="text-center pt-6">
            <Link2 size={22} className="mx-auto text-white-25 mb-2" />
            <div className="text-sm text-white-60">No quick links yet</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 glass rounded p-2 border border-white/5 group hover:border-primary/20 transition-colors"
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-0 flex items-center gap-2"
                >
                  <ExternalLink
                    size={12}
                    className="text-primary/50 shrink-0"
                  />
                  <span className="text-xs text-white-70 truncate">
                    {l.label}
                  </span>
                </a>
                <button
                  onClick={() => del(l.id)}
                  className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-destructive transition-all"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {adding ? (
        <div className="space-y-2 border-t border-white/5 pt-2">
          <input
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Link label..."
            className="w-full h-8 px-3 text-sm bg-white/4 border border-white/6 rounded text-white-90 placeholder:text-white-30 focus:outline-none focus:border-primary/40"
          />
          <input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="URL or file path..."
            className="w-full h-8 px-3 text-sm bg-white/4 border border-white/6 rounded text-white-90 placeholder:text-white-30 focus:outline-none focus:border-primary/40"
          />
          <div className="flex gap-2">
            <button
              onClick={add}
              className="flex-1 h-8 text-sm rounded glass-crimson text-primary font-display font-medium"
            >
              ADD
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex-1 h-8 text-sm rounded bg-white/5 text-white-50 font-display font-medium"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded border border-dashed border-white/10 text-xs text-white-40 hover:border-primary/30 hover:text-primary/60 transition-colors font-display tracking-wider"
        >
          <Plus size={12} /> ADD LINK
        </button>
      )}
    </div>
  );
}
