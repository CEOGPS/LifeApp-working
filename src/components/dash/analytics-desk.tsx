import { useState } from "react";
import type { Memory, StatRow } from "./memory";

type Update = (recipe: (prev: Memory) => Memory) => void;

function keyOf(data: Memory, name: string) {
  return data.keys.find((row) => row.name === name)?.value || "";
}

function saveKey(update: Update, name: string, value: string) {
  update((prev) => ({ ...prev, keys: [{ id: prev.keys.find((row) => row.name === name)?.id || crypto.randomUUID(), name, value }, ...prev.keys.filter((row) => row.name !== name)] }));
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((value, index) => `${(index / (points.length - 1)) * 96},${22 - ((value - min) / span) * 16}`).join(" ");
  return <svg width="96" height="24" aria-hidden><polyline points={d} fill="none" stroke="oklch(0.78 0.12 195)" strokeWidth="1.5" /></svg>;
}

export function AnalyticsDesk({ data, update }: { data: Memory; update: Update }) {
  const [property, setProperty] = useState(keyOf(data, "Google Analytics"));
  const [site, setSite] = useState(keyOf(data, "Search Console") || "https://ceogps.com/");
  const [bdSite, setBdSite] = useState(keyOf(data, "Brilliant Site"));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    setNote("Pulling…");
    saveKey(update, "Google Analytics", property.trim());
    saveKey(update, "Search Console", site.trim());
    saveKey(update, "Brilliant Site", bdSite.trim());
    const { readOauth, freshGoogleToken } = await import("@/lib/lifeos/oauth");
    const { pullAnalytics } = await import("@/lib/lifeos/sync");
    const result = await pullAnalytics({ data: {
      google: await freshGoogleToken() || readOauth().find((row) => row.provider === "google")?.token || "",
      property,
      site,
      facebook: readOauth().find((row) => row.provider === "facebook")?.token || "",
      x: keyOf(data, "X"),
      linkedin: keyOf(data, "LinkedIn"),
      tiktok: keyOf(data, "TikTok"),
      bdKey: keyOf(data, "Brilliant Directories"),
      bdSite,
      godaddy: keyOf(data, "GoDaddy"),
      godaddySecret: keyOf(data, "GoDaddy Secret"),
    } });
    if (result.rows.length) {
      update((prev) => {
        const incoming = result.rows as StatRow[];
        const kept = prev.stats.filter((row) => !incoming.some((item) => item.id === row.id));
        const stats = [...incoming.map((row) => {
          const prior = prev.stats.find((item) => item.id === row.id);
          const points = row.points.length ? row.points : [...(prior?.points || []), row.value].filter((point) => point > 0).slice(-14);
          return { ...row, points };
        }), ...kept];
        return { ...prev, stats };
      });
    }
    setNote(result.note || (result.rows.length ? "Pulled onto the board." : "Nothing came back."));
    setBusy(false);
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-36 flex-1 text-[10px] text-white/40">GA4 property
          <input className="mt-1 h-7 w-full rounded-full border border-line bg-black/40 px-3 text-xs" value={property} placeholder="123456789" onChange={(event) => setProperty(event.target.value)} />
        </label>
        <label className="min-w-36 flex-1 text-[10px] text-white/40">Search Console
          <input className="mt-1 h-7 w-full rounded-full border border-line bg-black/40 px-3 text-xs" value={site} onChange={(event) => setSite(event.target.value)} />
        </label>
        <label className="min-w-36 flex-1 text-[10px] text-white/40">Brilliant Directories
          <input className="mt-1 h-7 w-full rounded-full border border-line bg-black/40 px-3 text-xs" value={bdSite} placeholder="https://ceogps.com" onChange={(event) => setBdSite(event.target.value)} />
        </label>
        <button type="button" className="bg-blue" disabled={busy} onClick={() => void sync()}>{busy ? "Pulling" : "Sync"}</button>
      </div>
      {note ? <p className="text-xs text-white/60">{note}</p> : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
        {data.stats.map((row) => (
          <article key={row.id} className="module-card flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[10px] tracking-widest text-white/40">{row.label}</p>
              <p className="text-lg leading-tight">{row.value.toLocaleString()}</p>
            </div>
            <Spark points={row.points} />
          </article>
        ))}
      </div>
      {!data.stats.length ? <p className="text-sm text-white/40">Nothing pulled yet. Reconnect Google, then Sync.</p> : null}
    </div>
  );
}
