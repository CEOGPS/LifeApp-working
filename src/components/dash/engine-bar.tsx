import { useEffect, useState } from "react";
import { ENGINES } from "@/lib/lifeos/engine-list";
import { newId, type Memory } from "./memory";

type Update = (recipe: (prev: Memory) => Memory) => void;

export function EngineBar({ panel, data, update }: { panel: string; data: Memory; update: Update }) {
  const rows = ENGINES.filter((row) => row.panels.includes(panel));
  const [pick, setPick] = useState(rows[0]?.id || "");
  const [status, setStatus] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const chosen = rows.find((row) => row.id === pick) || rows[0];

  useEffect(() => {
    void import("@/lib/lifeos/engines").then(({ checkEngines }) => checkEngines({ data: { panel } })).then((result) => {
      const next: Record<string, string> = {};
      for (const row of result.rows) next[row.id] = row.text;
      setStatus(next);
    }).catch(() => setNote("Could not check the services."));
  }, [panel]);

  if (!rows.length) return null;

  return (
    <section className="module-card p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {rows.map((row) => (
          <button key={row.id} type="button" className={`text-xs ${pick === row.id ? "text-white" : "text-white/45"}`} onClick={() => { setPick(row.id); setNote(row.note); }}>
            <i className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${status[row.id] === "On" ? "bg-green" : "bg-white/30"}`} />
            {row.name}
          </button>
        ))}
      </div>
      <form className="mt-2 flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!chosen) return;
        setNote("Checking…");
        void import("@/lib/lifeos/engines").then(({ runEngine }) => runEngine({ data: { id: chosen.id, query } })).then((result) => {
          setNote(result.text);
          setStatus((prev) => ({ ...prev, [chosen.id]: result.ok ? "On" : prev[chosen.id] || "Down" }));
          if (!result.text) return;
          update((prev) => ({
            ...prev,
            facts: [{ id: newId(), text: result.text.slice(0, 500), source: chosen.name, at: new Date().toISOString() }, ...(prev.facts || [])].slice(0, 200),
          }));
        }).catch(() => setNote("The service did not answer."));
      }}>
        <input className="h-8 min-w-48 flex-1 rounded-full border border-line bg-black/40 px-3 text-sm" value={query} placeholder={chosen?.note || "Job"} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit" className="quiet is-on">Run</button>
      </form>
      {note ? <p className="mt-2 text-xs text-white/50">{note}</p> : null}
      <p className="mt-1 text-[11px] text-white/35">{(data.facts || []).filter((row) => row.source === chosen?.name).length} saved from {chosen?.name}</p>
    </section>
  );
}
