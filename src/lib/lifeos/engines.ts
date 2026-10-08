import { createServerFn } from "@tanstack/react-start";
import { ENGINES } from "./engine-list";
import { envValue } from "./env-keys";

async function baseOf(id: string, fallback: string) {
  const name = `${id.toUpperCase().replace(/-/g, "_")}_URL`;
  return (process.env[name] || (await envValue(name)) || fallback).replace(/\/$/, "");
}

async function hit(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  const text = await response.text();
  return { ok: response.ok, text: text.replace(/\s+/g, " ").slice(0, 700) };
}

export const checkEngines = createServerFn({ method: "POST" })
  .validator((input: { panel?: string }) => ({ panel: String(input?.panel || "").slice(0, 40) }))
  .handler(async ({ data }) => {
    const rows = ENGINES.filter((row) => row.panels.includes(data.panel));
    const checked = await Promise.all(rows.map(async (row) => {
      if (row.mode === "board") return { id: row.id, text: "On" };
      if (row.mode === "skip") return { id: row.id, text: "Not beside Erebus" };
      if (row.mode === "key") {
        const saved = process.env[row.key || ""] || (await envValue(row.key || ""));
        return { id: row.id, text: saved ? "On" : "Key missing" };
      }
      try {
        const root = await baseOf(row.id, row.url);
        const result = await hit(`${root}${row.health}`);
        return { id: row.id, text: result.ok ? "On" : "Down" };
      } catch {
        return { id: row.id, text: "Down" };
      }
    }));
    return { rows: checked };
  });

export const runEngine = createServerFn({ method: "POST" })
  .validator((input: { id?: string; query?: string }) => ({
    id: String(input?.id || "").slice(0, 40),
    query: String(input?.query || "").trim().slice(0, 500),
  }))
  .handler(async ({ data }) => {
    const row = ENGINES.find((item) => item.id === data.id);
    if (!row) return { ok: false, text: "That service is not on the list." };
    if (row.mode === "board") return { ok: true, text: "Saved on the board. Erebus and Kranos read these facts with the rest of the dashboard." };
    if (row.mode === "skip") return { ok: false, text: row.note };
    if (row.mode === "key") {
      const saved = process.env[row.key || ""] || (await envValue(row.key || ""));
      return saved
        ? { ok: true, text: `${row.name} is already on its button. ${row.note}` }
        : { ok: false, text: `${row.name} needs ${row.key}.` };
    }
    const root = await baseOf(row.id, row.url);
    try {
      if (row.id === "crawl4ai") {
        if (!/^https?:\/\//i.test(data.query)) return { ok: false, text: "Paste a full http page URL." };
        const result = await hit(`${root}/crawl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: [data.query] }) });
        return { ok: result.ok, text: result.ok ? result.text : "Crawl4AI did not return the page." };
      }
      if (row.id === "n8n") {
        const hook = process.env.N8N_WEBHOOK_URL || (await envValue("N8N_WEBHOOK_URL"));
        if (!hook) return { ok: false, text: "n8n is the runner. Set N8N_WEBHOOK_URL to the approved workflow." };
        const result = await hit(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: data.query }) });
        return { ok: result.ok, text: result.ok ? result.text || "n8n accepted the job." : "n8n did not accept the job." };
      }
      if (row.id === "postiz") return { ok: true, text: "Postiz is only the scheduler. Publish from the Social composer." };
      const result = await hit(`${root}${row.health}`);
      return { ok: result.ok, text: result.ok ? `${row.name} answered. ${row.note}` : `${row.name} is not running at ${root}.` };
    } catch {
      return { ok: false, text: `${row.name} is not running at ${root}.` };
    }
  });
