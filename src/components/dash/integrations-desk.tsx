import { useEffect, useState } from "react";
import { newId, type Memory } from "./memory";
import { disconnectOauth, type OauthProvider } from "@/lib/lifeos/oauth";

type Update = (recipe: (prev: Memory) => Memory) => void;
type Account = { provider: string; name: string; email: string };

type Row =
  | { name: string; kind: "oauth"; id: OauthProvider }
  | { name: string; kind: "key" };

const ROWS: Row[] = ([
  { name: "Anthropic", kind: "key" },
  { name: "Bing", kind: "key" },
  { name: "Brave", kind: "key" },
  { name: "Brevo", kind: "key" },
  { name: "Brilliant Directories", kind: "key" },
  { name: "Cloudflare Account", kind: "key" },
  { name: "Cloudflare Token", kind: "key" },
  { name: "Discord", kind: "oauth", id: "discord" },
  { name: "Dogpile", kind: "key" },
  { name: "ElevenLabs", kind: "key" },
  { name: "Facebook", kind: "oauth", id: "facebook" },
  { name: "Facebook App ID", kind: "key" },
  { name: "GoDaddy", kind: "key" },
  { name: "Google Analytics", kind: "key" },
  { name: "Google", kind: "oauth", id: "google" },
  { name: "Google Maps", kind: "key" },
  { name: "Instagram", kind: "key" },
  { name: "LinkedIn", kind: "key" },
  { name: "Luma", kind: "key" },
  { name: "NVIDIA", kind: "key" },
  { name: "Nylas", kind: "key" },
  { name: "OpenAI", kind: "key" },
  { name: "Replicate", kind: "key" },
  { name: "Reddit", kind: "key" },
  { name: "SendGrid", kind: "key" },
  { name: "Search Console", kind: "key" },
  { name: "Snapchat", kind: "key" },
  { name: "Spotify", kind: "oauth", id: "spotify" },
  { name: "Stripe", kind: "key" },
  { name: "Supabase", kind: "key" },
  { name: "Telegram", kind: "key" },
  { name: "TikTok", kind: "key" },
  { name: "xAI", kind: "key" },
  { name: "X", kind: "key" },
  { name: "Yahoo", kind: "key" },
  { name: "YouTube", kind: "key" },
] satisfies Row[]).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

export function IntegrationsDesk({ data, update, accounts, setAccounts, note, setNote }: {
  data: Memory;
  update: Update;
  accounts: Account[];
  setAccounts: (rows: Account[]) => void;
  note: string;
  setNote: (value: string) => void;
}) {
  const [ready, setReady] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [extra, setExtra] = useState("");
  const [open, setOpen] = useState("");
  const [checked, setChecked] = useState<Record<string, string>>({});

  useEffect(() => {
    void import("@/lib/lifeos/env-keys").then(({ loadEnvKeys }) => loadEnvKeys()).then((rows) => {
      setReady(rows.map((row) => row.name));
      update((prev) => {
        const names = new Set(prev.keys.map((row) => row.name));
        const fresh = rows.filter((row) => row.value && !names.has(row.name));
        if (!fresh.length) return prev;
        return { ...prev, keys: [...fresh.map((row) => ({ id: newId(), name: row.name, value: row.value })), ...prev.keys] };
      });
    }).catch(() => undefined);
  }, []);

  function connect(provider: OauthProvider) {
    setNote("");
    void import("@/lib/lifeos/oauth").then(({ startOAuth }) => startOAuth(provider)).catch((error) => setNote(error instanceof Error ? error.message : "Connect failed."));
  }

  function disconnect(provider: OauthProvider) {
    disconnectOauth(provider);
    setAccounts(accounts.filter((row) => row.provider !== provider));
  }

  function putKey(name: string, value: string) {
    update((prev) => ({ ...prev, keys: [{ id: newId(), name, value }, ...prev.keys.filter((item) => item.name !== name)] }));
  }

  async function checkAccount(service: "search-console" | "google-analytics" | "godaddy" | "brilliant") {
    setNote("Checking…");
    const { readOauth } = await import("@/lib/lifeos/oauth");
    const { connectAccount } = await import("@/lib/lifeos/env-keys");
    const google = readOauth().find((row) => row.provider === "google")?.token || "";
    const result = await connectAccount({ data: {
      service,
      token: google,
      key: service === "godaddy" ? paste || data.keys.find((row) => row.name === "GoDaddy")?.value || "" : service === "brilliant" ? paste || data.keys.find((row) => row.name === "Brilliant Directories")?.value || "" : "",
      secret: service === "godaddy" ? extra || data.keys.find((row) => row.name === "GoDaddy Secret")?.value || "" : "",
      site: service === "brilliant" ? extra || data.keys.find((row) => row.name === "Brilliant Site")?.value || "" : "",
    } });
    if (result.ok && service === "search-console" && result.site) putKey("Search Console", result.site);
    if (result.ok && service === "google-analytics" && result.site) putKey("Google Analytics", result.site);
    if (result.ok && service === "godaddy") {
      const key = paste || data.keys.find((row) => row.name === "GoDaddy")?.value || "";
      const secret = extra || data.keys.find((row) => row.name === "GoDaddy Secret")?.value || "";
      if (key) putKey("GoDaddy", key);
      if (secret) putKey("GoDaddy Secret", secret);
    }
    if (result.ok && service === "brilliant") {
      const key = paste || data.keys.find((row) => row.name === "Brilliant Directories")?.value || "";
      const site = extra || data.keys.find((row) => row.name === "Brilliant Site")?.value || "";
      if (key) putKey("Brilliant Directories", key);
      if (site) putKey("Brilliant Site", site);
    }
    setChecked((prev) => ({ ...prev, [service]: result.text }));
    setOpen("");
    setPaste("");
    setExtra("");
    setNote(result.text);
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Integrations</h1>
          <p className="text-base text-white/60">Alphabetical. Connect an account, or the key stays on this machine.</p>
        </div>
        <button type="button" className="quiet" onClick={() => {
          void Promise.all([import("@/lib/lifeos/oauth"), import("@/lib/lifeos/env-keys")]).then(async ([{ readOauth }, { pullProvider }]) => {
            const linked = readOauth();
            if (!linked.length) { setNote("Nothing is connected yet."); return; }
            for (const account of linked) {
              const result = await pullProvider({ data: { provider: account.provider, token: account.token } });
              update((prev) => {
                let next = { ...prev, notifs: [{ id: newId(), text: `${account.provider}: ${result.text}`, source: account.provider, seen: false }, ...prev.notifs] };
                if ("events" in result && Array.isArray(result.events)) {
                  const events = result.events.map((item) => ({ id: newId(), day: item.when ? new Date(item.when).getDay() : new Date().getDay(), date: item.when?.slice(0, 10), title: item.title }));
                  next = { ...next, events: [...events, ...next.events] };
                }
                if ("tracks" in result && Array.isArray(result.tracks)) {
                  const links = result.tracks.filter((item) => item.url).map((item) => ({ id: newId(), label: `Spotify · ${item.title}`, href: item.url }));
                  next = { ...next, links: [...links, ...next.links] };
                }
                return next;
              });
            }
            setNote("Pulled the connected accounts.");
          }).catch(() => setNote("Could not pull the connected accounts."));
        }}>Pull accounts</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ROWS.map((row) => {
          if (row.kind === "oauth") {
            const account = accounts.find((item) => item.provider === row.id);
            return (
              <article key={row.name} className="module-card p-4">
                <p className="text-lg">{row.name}</p>
                <p className={`mt-1 text-base ${account ? "text-green" : "text-white/50"}`}>{account ? (account.email || account.name || "Connected") : "Not connected"}</p>
                <div className="mt-3">
                  {account ? <button type="button" className="link-remove" onClick={() => disconnect(row.id)}>Disconnect</button> : <button type="button" className="quiet is-on" onClick={() => connect(row.id)}>Connect</button>}
                </div>
              </article>
            );
          }
          const saved = data.keys.find((item) => item.name === row.name && item.value);
          const on = ready.includes(row.name) || Boolean(saved);
          if (row.name === "Search Console" || row.name === "Google Analytics" || row.name === "GoDaddy" || row.name === "Brilliant Directories") {
            const service = row.name === "Search Console" ? "search-console" : row.name === "Google Analytics" ? "google-analytics" : row.name === "GoDaddy" ? "godaddy" : "brilliant";
            const google = accounts.find((item) => item.provider === "google");
            const oneClick = service === "search-console" || service === "google-analytics";
            const status = checked[service] || (oneClick ? saved?.value || "" : "");
            const linked = oneClick ? Boolean(google && saved) : on;
            return (
              <article key={row.name} className="module-card p-4">
                <p className="text-lg">{row.name}</p>
                <p className={`mt-1 text-base ${linked ? "text-green" : "text-white/50"}`}>{status || (linked ? "Saved" : "Not connected")}</p>
                <div className="mt-3">
                  {oneClick && !google ? <button type="button" className="quiet is-on" onClick={() => connect("google")}>Connect Google</button> : open === row.name ? (
                    <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); void checkAccount(service); }}>
                      <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={paste} placeholder="API key" onChange={(event) => setPaste(event.target.value)} />
                      {row.name === "GoDaddy" ? <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={extra} placeholder="API secret" onChange={(event) => setExtra(event.target.value)} /> : null}
                      {row.name === "Brilliant Directories" ? <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={extra} placeholder="https://your-site.com" onChange={(event) => setExtra(event.target.value)} /> : null}
                      <button type="submit" className="quiet is-on">Connect</button>
                    </form>
                  ) : <button type="button" className="quiet is-on" onClick={() => { if (oneClick) { void checkAccount(service); return; } setOpen(row.name); setPaste(saved?.value || ""); setExtra(data.keys.find((item) => item.name === (row.name === "GoDaddy" ? "GoDaddy Secret" : "Brilliant Site"))?.value || ""); }}>Connect</button>}
                </div>
              </article>
            );
          }
          return (
            <article key={row.name} className="module-card p-4">
              <p className="text-lg">{row.name}</p>
              <p className={`mt-1 text-base ${on ? "text-green" : "text-white/50"}`}>{on ? "Ready" : "Not set"}</p>
              <div className="mt-3">
                {on ? <span className="text-base text-white/40">Saved on this machine</span> : open === row.name ? (
                  <form className="flex gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    if (!paste.trim()) return;
                    update((prev) => ({ ...prev, keys: [{ id: newId(), name: row.name, value: paste.trim() }, ...prev.keys.filter((item) => item.name !== row.name)] }));
                    setPaste("");
                    setOpen("");
                    setNote(`${row.name} saved.`);
                  }}>
                    <input className="h-9 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={paste} placeholder="Paste key" onChange={(event) => setPaste(event.target.value)} />
                    <button type="submit" className="quiet is-on">Save</button>
                  </form>
                ) : <button type="button" className="quiet" onClick={() => { setOpen(row.name); setPaste(""); }}>Add key</button>}
              </div>
            </article>
          );
        })}
      </div>
      {note ? <p className="mt-3 text-base text-white/60">{note}</p> : null}
    </div>
  );
}
