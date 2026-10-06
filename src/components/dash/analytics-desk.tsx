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
  const d = points.map((value, index) => `${(index / (points.length - 1)) * 220},${36 - ((value - min) / span) * 28}`).join(" ");
  return <svg width="220" height="40" aria-hidden><polyline points={d} fill="none" stroke="oklch(0.78 0.12 195)" strokeWidth="1.5" /></svg>;
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
    const { readOauth } = await import("@/lib/lifeos/oauth");
    const { pullAnalytics } = await import("@/lib/lifeos/sync");
    const result = await pullAnalytics({ data: {
      google: readOauth().find((row) => row.provider === "google")?.token || "",
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
    <div className="grid gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Analytics</h1>
          <p className="text-sm text-white/50">Website, search, and the connected social accounts. Same numbers as the home module.</p>
        </div>
        <button type="button" className="bg-blue" disabled={busy} onClick={() => void sync()}>{busy ? "Pulling" : "Sync"}</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-[11px] text-white/40">GA4 property ID
          <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={property} placeholder="123456789" onChange={(event) => setProperty(event.target.value)} />
        </label>
        <label className="text-[11px] text-white/40">Search Console site
          <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={site} onChange={(event) => setSite(event.target.value)} />
        </label>
        <label className="text-[11px] text-white/40">Brilliant Directories site
          <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={bdSite} placeholder="https://ceogps.com" onChange={(event) => setBdSite(event.target.value)} />
        </label>
      </div>
      {note ? <p className="text-sm text-white/60">{note}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.stats.map((row) => (
          <article key={row.id} className="module-card p-4">
            <p className="text-[10px] tracking-widest text-white/40">{row.label}</p>
            <p className="mt-1 text-2xl">{row.value.toLocaleString()}</p>
            <Spark points={row.points} />
          </article>
        ))}
      </div>
      {!data.stats.length ? <p className="text-sm text-white/40">Nothing pulled yet. Reconnect Google, then Sync.</p> : null}
    </div>
  );
}
