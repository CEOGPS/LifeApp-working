import { useEffect, useState } from "react";
import { newId, type Memory } from "./memory";
import { disconnectOauth, readOauth, BOARD_EMAILS, catchReturn, confirmSignIn, requestSignIn, sessionToken, signOutSession, startNylas, startOAuth, type OauthProvider } from "@/lib/lifeos/oauth";
import { sheetKeys } from "@/lib/lifeos/sheet-keys";

const WORKER = (import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev").replace(/\/$/, "");
const WORKER_OAUTH = new Set(["google", "facebook", "spotify", "discord"]);
function maskKey(value: string) {
  const clean = value.trim();
  if (clean.length <= 8) return "saved";
  return `${clean.slice(0, 3)}····${clean.slice(-4)}`;
}
const CARD: Record<OauthProvider, string> = { google: "Google", discord: "Discord", facebook: "Facebook", spotify: "Spotify" };
const MARKS = "lifeos.integration.marks";

function asAccounts(rows: { provider: string; name: string; email: string }[]) {
  return rows.map((row) => ({ provider: row.provider, name: row.name, email: row.email }));
}
type Mark = { state: "connected" | "error" | "saved"; text: string };

function readMarks(): Record<string, Mark> {
  try {
    const parsed = JSON.parse(localStorage.getItem(MARKS) || "{}") as Record<string, Mark>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
type Account = { provider: string; name: string; email: string };
type Update = (recipe: (prev: Memory) => Memory) => void;

type Row =
  | { name: string; kind: "oauth"; id: OauthProvider }
  | { name: string; kind: "key" };

const ROWS: Row[] = ([
  { name: "Ahrefs", kind: "key" },
  { name: "Airtable", kind: "key" },
  { name: "Alibaba", kind: "key" },
  { name: "Alignable", kind: "key" },
  { name: "Anthropic", kind: "key" },
  { name: "Antigravity", kind: "key" },
  { name: "Anyscale", kind: "key" },
  { name: "Apple iCloud", kind: "key" },
  { name: "Apple Maps", kind: "key" },
  { name: "Asana", kind: "key" },
  { name: "AWS S3", kind: "key" },
  { name: "Azure AI", kind: "key" },
  { name: "Azure Storage", kind: "key" },
  { name: "Base44", kind: "key" },
  { name: "Bing", kind: "key" },
  { name: "Blackforest Labs", kind: "key" },
  { name: "Brevo", kind: "key" },
  { name: "Brex", kind: "key" },
  { name: "Brilliant Directories", kind: "key" },
  { name: "Browserbase", kind: "key" },
  { name: "Calendly", kind: "key" },
  { name: "Canva", kind: "key" },
  { name: "Cash App", kind: "key" },
  { name: "CEO GPS", kind: "key" },
  { name: "Chase", kind: "key" },
  { name: "ClickUp", kind: "key" },
  { name: "Cloudflare", kind: "key" },
  { name: "Cloudflare Account", kind: "key" },
  { name: "Cloudflare Token", kind: "key" },
  { name: "Cohere", kind: "key" },
  { name: "Copilot (Microsoft)", kind: "key" },
  { name: "Credit Karma", kind: "key" },
  { name: "Cron", kind: "key" },
  { name: "Crypto.com", kind: "key" },
  { name: "D-ID (avatar)", kind: "key" },
  { name: "DeepSeek", kind: "key" },
  { name: "Digits", kind: "key" },
  { name: "Discord", kind: "oauth", id: "discord" },
  { name: "Docker", kind: "key" },
  { name: "Dogpile", kind: "key" },
  { name: "DraftKings", kind: "key" },
  { name: "Dropbox", kind: "key" },
  { name: "ElevenLabs", kind: "key" },
  { name: "Exa", kind: "key" },
  { name: "Experian", kind: "key" },
  { name: "Facebook", kind: "oauth", id: "facebook" },
  { name: "Facebook App ID", kind: "key" },
  { name: "Firebase", kind: "key" },
  { name: "Firefox", kind: "key" },
  { name: "Fish.Audio", kind: "key" },
  { name: "Gemma", kind: "key" },
  { name: "Genies", kind: "key" },
  { name: "GitHub", kind: "key" },
  { name: "GitLab", kind: "key" },
  { name: "Gmail (OAuth)", kind: "key" },
  { name: "GoDaddy", kind: "key" },
  { name: "Google", kind: "oauth", id: "google" },
  { name: "Google AI (Gemini)", kind: "key" },
  { name: "Google Analytics", kind: "key" },
  { name: "Google Calendar", kind: "key" },
  { name: "Google Maps", kind: "key" },
  { name: "Google Voice", kind: "key" },
  { name: "Grok (xAI)", kind: "key" },
  { name: "Groq", kind: "key" },
  { name: "Gumloop", kind: "key" },
  { name: "Hercules", kind: "key" },
  { name: "Hermes", kind: "key" },
  { name: "HubSpot", kind: "key" },
  { name: "Hugging Face", kind: "key" },
  { name: "iCloud Calendar", kind: "key" },
  { name: "Instagram", kind: "key" },
  { name: "Jotform", kind: "key" },
  { name: "Klaviyo", kind: "key" },
  { name: "Kling", kind: "key" },
  { name: "Kraken", kind: "key" },
  { name: "Krea", kind: "key" },
  { name: "Linear", kind: "key" },
  { name: "LinkedIn", kind: "key" },
  { name: "Luma", kind: "key" },
  { name: "Lumin", kind: "key" },
  { name: "LunarCrush", kind: "key" },
  { name: "Mailchimp", kind: "key" },
  { name: "Make (Integromat)", kind: "key" },
  { name: "Malwarebytes", kind: "key" },
  { name: "Mercury", kind: "key" },
  { name: "Meta LLaMA", kind: "key" },
  { name: "Mistral", kind: "key" },
  { name: "Monday.com", kind: "key" },
  { name: "Moondream2", kind: "key" },
  { name: "MorningStar", kind: "key" },
  { name: "MOZ", kind: "key" },
  { name: "Nextdoor", kind: "key" },
  { name: "Notion", kind: "key" },
  { name: "NVIDIA", kind: "key" },
  { name: "NVIDIA NIM", kind: "key" },
  { name: "Nylas", kind: "key" },
  { name: "Ollama (local)", kind: "key" },
  { name: "OpenAI", kind: "key" },
  { name: "OpenRouter", kind: "key" },
  { name: "Opera", kind: "key" },
  { name: "Otter.ai", kind: "key" },
  { name: "Outlook", kind: "key" },
  { name: "Outlook Calendar", kind: "key" },
  { name: "Pandora", kind: "key" },
  { name: "PayPal", kind: "key" },
  { name: "Pinterest", kind: "key" },
  { name: "Plaid", kind: "key" },
  { name: "Plain", kind: "key" },
  { name: "PocketBase", kind: "key" },
  { name: "Postman", kind: "key" },
  { name: "Prisma", kind: "key" },
  { name: "Proton Mail", kind: "key" },
  { name: "QuarkAI", kind: "key" },
  { name: "Qwen", kind: "key" },
  { name: "Reddit", kind: "key" },
  { name: "Replicate", kind: "key" },
  { name: "Ring", kind: "key" },
  { name: "Runwav", kind: "key" },
  { name: "Search Console", kind: "key" },
  { name: "SendGrid", kind: "key" },
  { name: "Shutterstock", kind: "key" },
  { name: "ShowMeLocal", kind: "key" },
  { name: "Signal", kind: "key" },
  { name: "Slack", kind: "key" },
  { name: "Snapchat", kind: "key" },
  { name: "SoFi", kind: "key" },
  { name: "Spotify", kind: "oauth", id: "spotify" },
  { name: "Stability AI", kind: "key" },
  { name: "Stripe", kind: "key" },
  { name: "Suno (music)", kind: "key" },
  { name: "Supabase", kind: "key" },
  { name: "Telegram", kind: "key" },
  { name: "Temu", kind: "key" },
  { name: "Tenstrip", kind: "key" },
  { name: "Threads", kind: "key" },
  { name: "TikTok", kind: "key" },
  { name: "TikTok Shop", kind: "key" },
  { name: "Todoist", kind: "key" },
  { name: "Trello", kind: "key" },
  { name: "Trivago", kind: "key" },
  { name: "Twilio", kind: "key" },
  { name: "Twitter/X", kind: "key" },
  { name: "Venmo", kind: "key" },
  { name: "Vimeo", kind: "key" },
  { name: "VS Code", kind: "key" },
  { name: "Wan-AI", kind: "key" },
  { name: "WhatsApp", kind: "key" },
  { name: "WordPress", kind: "key" },
  { name: "X", kind: "key" },
  { name: "xAI", kind: "key" },
  { name: "Yahoo", kind: "key" },
  { name: "Yelp", kind: "key" },
  { name: "YouTube", kind: "key" },
  { name: "YP.com", kind: "key" },
  { name: "Zoominfo", kind: "key" },
  { name: "Firecrawl", kind: "key" },
  { name: "GLM", kind: "key" },
  { name: "Kimi", kind: "key" },
  { name: "Meta", kind: "key" },
  { name: "Microsoft", kind: "key" },
  { name: "Parallel", kind: "key" },
  { name: "Weather", kind: "key" },
  { name: "Xiaomi", kind: "key" },
  { name: "Zoom", kind: "key" },
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
  const [paste, setPaste] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState("");
  const [sheetNote, setSheetNote] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [open, setOpen] = useState("");
  const [checked, setChecked] = useState<Record<string, string>>({});
  const [machine, setMachine] = useState<string[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [signed, setSigned] = useState(() => Boolean(sessionToken()));
  const [inbox, setInbox] = useState<(typeof BOARD_EMAILS)[number]>("chris@ceogps.com");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => { setMarks(readMarks()); }, []);
  useEffect(() => {
    const back = catchReturn();
    if (back.provider) {
      const email = readOauth().find((row) => row.provider === back.provider)?.email || "";
      stamp(CARD[back.provider], "connected", email ? `Connected · ${email}` : "Connected");
    }
    if (back.error) {
      setNote(back.error);
    }
    setAccounts([]);
    const token = sessionToken();
    if (!token) return;
    void fetch(`${WORKER}/api/integrations/health`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { integrations?: { id?: string; status?: string; oauth?: { provider?: string; emails?: string[] } }[] };
      const rows: Account[] = [];
      for (const item of body.integrations || []) {
        if (item.status !== "connected" || !item.oauth?.provider) continue;
        const emails = item.oauth.emails?.length ? item.oauth.emails : [""];
        for (const email of emails) rows.push({ provider: item.oauth.provider, name: item.id || item.oauth.provider, email });
        stamp(CARD[item.oauth.provider as OauthProvider] || item.id || "Account", "connected", emails.filter(Boolean).join(", ") || "Connected");
      }
      setAccounts(rows);
    }).catch(() => undefined);
  }, [setAccounts, setNote, signed]);

  function stamp(name: string, state: Mark["state"], text: string) {
    setMarks((prev) => {
      const next = { ...prev, [name]: { state, text } };
      try { localStorage.setItem(MARKS, JSON.stringify(next)); } catch { /* the mark still shows */ }
      return next;
    });
  }

  function connect(provider: OauthProvider, name: string, email?: string) {
    setNote("");
    if (!WORKER_OAUTH.has(provider)) {
      const text = `${name} is not on the worker yet.`;
      stamp(name, "error", text);
      setNote(text);
      return;
    }
    if ((email || "").toLowerCase().endsWith("@icloud.com")) {
      void startNylas(email).catch((error: unknown) => {
        const text = error instanceof Error ? error.message : "Nylas did not start.";
        stamp(name, "error", text);
        setNote(text);
      });
      return;
    }
    void startOAuth(provider, email).catch((error: unknown) => {
      const text = error instanceof Error ? error.message : `${name} did not start.`;
      stamp(name, "error", text);
      setNote(text);
    });
  }

  function disconnect(provider: OauthProvider, email?: string) {
    disconnectOauth(provider, email);
    stamp(CARD[provider], "saved", "Disconnected");
    setAccounts(asAccounts(readOauth()));
    void fetch(`${WORKER}/api/oauth/disconnect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider, account_email: email || "" }),
    }).catch(() => undefined);
  }

  function putKey(name: string, value: string) {
    const names = name === "xAI" || name === "Grok (xAI)" ? ["xAI", "Grok (xAI)"] : [name];
    update((prev) => ({ ...prev, keys: [...names.map((item) => ({ id: newId(), name: item, value })), ...prev.keys.filter((item) => !names.includes(item.name))] }));
  }

  async function checkAccount(name: string, service: "search-console" | "google-analytics" | "godaddy" | "brilliant") {
    setBusy((prev) => ({ ...prev, [name]: true }));
    stamp(name, "saved", "Checking now…");
    setNote(`Checking ${name}…`);
    const finish = (ok: boolean, text: string) => {
      stamp(name, ok ? "connected" : "error", text);
      setNote(`${name}: ${text}`);
      setBusy((prev) => ({ ...prev, [name]: false }));
    };
    try {
      const { readOauth, freshGoogleToken } = await import("@/lib/lifeos/oauth");
      const sessions = readOauth().filter((row) => row.provider === "google" && row.token && row.email.toLowerCase() === "chrisgr33ninc@gmail.com");
      const tokens = sessions.length ? sessions : [{ email: "", token: "" }];
      let result: { ok: boolean; text: string; site?: string } = { ok: false, text: "Connect Google as chrisgr33ninc@gmail.com.", site: "" };
      const lines: string[] = [];
      for (const session of tokens) {
        const google = session.token ? await freshGoogleToken(session.email) || session.token : "";
        const response = await fetch("/api/keys/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service,
            token: google,
            key: service === "google-analytics" ? paste[name] || data.keys.find((row) => row.name === "Google Analytics")?.value || "" : service === "godaddy" ? paste[name] || data.keys.find((row) => row.name === "GoDaddy")?.value || "" : service === "brilliant" ? paste[name] || data.keys.find((row) => row.name === "Brilliant Directories")?.value || "" : "",
            secret: service === "godaddy" ? extra[name] || data.keys.find((row) => row.name === "GoDaddy Secret")?.value || "" : "",
            site: service === "brilliant" ? extra[name] || data.keys.find((row) => row.name === "Brilliant Site")?.value || "" : "",
          }),
          signal: AbortSignal.timeout(12000),
        });
        const next = await response.json().catch(() => ({ ok: false, text: `The check returned HTTP ${response.status}.`, site: "" })) as { ok: boolean; text: string; site?: string };
        if (service === "godaddy" || service === "brilliant") { result = next; break; }
        lines.push(`${session.email || "Google"}: ${next.text}`);
        if (next.ok) result = next;
      }
      if (service !== "godaddy" && service !== "brilliant") result = { ...result, text: lines.join(" · ") || result.text };
      if (result.ok && service === "search-console" && result.site) putKey("Search Console", result.site);
      if (result.ok && service === "google-analytics" && result.site) putKey("Google Analytics", result.site);
      if (result.ok && service === "godaddy") {
        const key = paste[name] || data.keys.find((row) => row.name === "GoDaddy")?.value || "";
        const secret = extra[name] || data.keys.find((row) => row.name === "GoDaddy Secret")?.value || "";
        if (key) putKey("GoDaddy", key);
        if (secret) putKey("GoDaddy Secret", secret);
      }
      if (result.ok && service === "brilliant") {
        const key = paste[name] || data.keys.find((row) => row.name === "Brilliant Directories")?.value || "";
        const site = extra[name] || data.keys.find((row) => row.name === "Brilliant Site")?.value || "";
        if (key) putKey("Brilliant Directories", key);
        if (site) putKey("Brilliant Site", site);
      }
      setChecked((prev) => ({ ...prev, [service]: result.text }));
      finish(result.ok, result.text || "No answer from the check.");
      setOpen("");
    } catch (error) {
      finish(false, error instanceof Error ? error.message : "The check failed.");
    }
  }

  async function verify(name: string, keyOverride?: string) {
    const own = (keyOverride ?? data.keys.find((item) => item.name === name)?.value ?? "").trim();
    const twin = name === "Grok (xAI)" || name === "xAI"
      ? (data.keys.find((item) => item.name === "xAI")?.value || data.keys.find((item) => item.name === "Grok (xAI)")?.value || "").trim()
      : "";
    const value = own || twin;
    const cloudflare = name === "Cloudflare" || name === "Cloudflare Token" || name === "Cloudflare Account";
    if (!value && !cloudflare) {
      stamp(name, "error", "No key is saved on this card.");
      setNote(`${name}: no key is saved.`);
      return;
    }
    setBusy((prev) => ({ ...prev, [name]: true }));
    stamp(name, "saved", "Checking now…");
    setNote(`Checking ${name}…`);
    const finish = (state: Mark["state"], text: string) => {
      stamp(name, state, text);
      setNote(`${name}: ${text}`);
      setBusy((prev) => ({ ...prev, [name]: false }));
    };
    try {
      const response = await fetch("/api/keys/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          key: value,
          email: /^(Google|Gmail|YouTube|Search Console|Firebase)/.test(name) ? "chrisgr33ninc@gmail.com" : name === "Grok (xAI)" || name === "xAI" ? "chris@ceogps.com" : "",
        }),
        signal: AbortSignal.timeout(15000),
      });
      const row = await response.json().catch(() => ({})) as { ok?: boolean; checked?: boolean; status?: string; reason?: string; error?: string; text?: string };
      const text = String(row.text || row.reason || row.error || `The check returned HTTP ${response.status}.`);
      if (row.ok || row.status === "connected") finish("connected", text);
      else if (row.checked === false) finish("saved", text);
      else finish("error", text);
    } catch (error) {
      finish("error", error instanceof Error ? error.message : "The check failed.");
    }
  }

  function checkLabel(name: string) {
    if (busy[name]) return "Checking";
    const state = marks[name]?.state;
    if (state === "error") return "Failed — check again";
    if (state === "connected") return "Connected";
    if (state === "saved") return "Saved";
    return "Check";
  }

  function emails(name?: string) {
    const label = name || "";
    const google = /^(Google|Gmail|YouTube|Search Console|Firebase)/.test(label);
    const grok = /^grok|^xai$/i.test(label);
    const list = grok ? ["chris@ceogps.com"] : google ? ["chrisgr33ninc@gmail.com"] : [...BOARD_EMAILS];
    return <p className="mt-2 text-sm leading-5 text-[oklch(0.82_0.13_220)]">{list.join(" · ")}</p>;
  }

  function statusLine(name: string, fallback: { state: Mark["state"] | "idle"; text: string }) {
    const mark = marks[name];
    const state = mark?.state || fallback.state;
    const text = mark?.text || fallback.text;
    const tone = state === "connected" ? "text-green" : state === "error" ? "text-rose-300" : "text-white/55";
    const dot = state === "connected" ? "bg-green shadow-[0_0_8px_#34d399]" : state === "error" ? "bg-rose-400 shadow-[0_0_8px_#fb7185]" : "bg-white/30";
    const label = state === "connected" ? "Connected" : state === "error" ? "Error" : state === "saved" ? "Saved" : "Not connected";
    return (
      <p className={`mt-2 inline-flex max-w-full items-start gap-2 rounded-full border border-white/15 px-3 py-1 text-sm ${tone}`}>
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        <span>{label}{text ? ` · ${text}` : ""}</span>
      </p>
    );
  }

  function applySheet(text: string) {
    try {
      const found = sheetKeys(text, ROWS.filter((row) => row.kind === "key").map((row) => row.name));
      if (!found.length) {
        setSheetNote("Nothing matched a card. Paste two columns, name and value, or lines like OPENAI_API_KEY=...");
        return;
      }
      update((prev) => ({
        ...prev,
        keys: [
          ...found.map((row) => ({ id: newId(), name: row.name, value: row.value })),
          ...prev.keys.filter((row) => !found.some((item) => item.name === row.name)),
        ],
      }));
      const message = `Filled ${found.length} keys: ${found.map((row) => row.name).slice(0, 14).join(", ")}${found.length > 14 ? "…" : ""}.`;
      setSheetNote(message);
      setNote(message);
      for (const row of found) stamp(row.name, "saved", maskKey(row.value));
    } catch (error) {
      setSheetNote(error instanceof Error ? error.message : "That paste could not be read.");
    }
  }

  return (
    <div>
      <div className="module-card mb-4 grid gap-3 p-4">
        {signed ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/70">Signed in. Connect uses this Supabase session.</p>
            <button type="button" className="quiet" onClick={() => { signOutSession(); setSigned(false); setAccounts([]); setNote("Signed out."); }}>Sign out</button>
          </div>
        ) : (
          <form className="grid gap-2" onSubmit={(event) => {
            event.preventDefault();
            if (!codeSent) {
              void requestSignIn(inbox).then(() => { setCodeSent(true); setNote(`Code sent to ${inbox}.`); }).catch((error: unknown) => setNote(error instanceof Error ? error.message : "Supabase did not send a code."));
              return;
            }
            void confirmSignIn(inbox, code).then(() => { setSigned(true); setCode(""); setNote("Signed in. Connect the mailbox again."); }).catch((error: unknown) => setNote(error instanceof Error ? error.message : "That code was refused."));
          }}>
            <p className="text-sm text-white/70">Sign in before Connect. Supabase emails a code. There is no other login on this page.</p>
            <div className="flex flex-wrap gap-2">
              <select className="h-9 rounded-full border border-line bg-black/40 px-3 text-sm" value={inbox} onChange={(event) => setInbox(event.target.value as (typeof BOARD_EMAILS)[number])}>
                {BOARD_EMAILS.map((email) => <option key={email} value={email}>{email}</option>)}
              </select>
              {codeSent ? <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-sm" inputMode="numeric" autoComplete="one-time-code" placeholder="Email code" value={code} onChange={(event) => setCode(event.target.value)} /> : null}
              <button type="submit" className="quiet is-on">{codeSent ? "Sign in" : "Email me a code"}</button>
            </div>
          </form>
        )}
      </div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Integrations</h1>
          <p className="text-base text-white/60">{machine.length ? `Loaded from this computer: ${machine.join(", ")}.` : "Paste a key sheet or add a key on a card."}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="quiet" onClick={() => {
            const names = ROWS.filter((row) => row.kind === "key").map((row) => row.name);
            const csv = `name,value\n${names.map((name) => `${name},`).join("\n")}\n`;
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "lifeos-api-keys.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}>Key sheet</button>
          <label className="quiet">Upload key sheet
            <input className="hidden" type="file" accept=".env,.txt,.csv,.json,.toml,.vars,text/plain" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then((text) => applySheet(text));
            }} />
          </label>
          <button type="button" className="quiet is-on" onClick={() => {
            const named = data.keys.filter((row) => row.value).map((row) => row.name);
            if (!named.length) { setNote("No keys are saved to check."); return; }
            void (async () => {
              for (const name of named) await verify(name);
            })();
          }}>Check saved keys</button>
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
      </div>
      <form className="module-card mb-4 grid gap-2 p-4" onSubmit={(event) => { event.preventDefault(); applySheet(sheet); }}>
        <label className="text-sm text-white/60" htmlFor="key-sheet">Paste the key sheet</label>
        <textarea id="key-sheet" className="min-h-28 rounded-2xl border border-line bg-black/40 px-3 py-2 font-mono text-sm" placeholder={"name\tvalue\nOpenAI\tsk-...\nElevenLabs\tsk_..."} value={sheet} onChange={(event) => setSheet(event.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="quiet is-on" disabled={!sheet.trim()} onClick={() => applySheet(sheet)}>Import pasted keys</button>
          {sheetNote ? <p className="text-sm text-white/70">{sheetNote}</p> : null}
        </div>
      </form>
      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {ROWS.map((row) => {
          if (row.kind === "oauth") {
            const account = accounts.find((item) => item.provider === row.id);
            return (
              <article key={row.name} className="module-card p-4">
                <p className="text-lg">{row.name}</p>
                {row.id === "google" ? null : emails(row.name)}
                <p className="mt-1 text-sm text-white/45">{row.id === "spotify" ? "Spotify returns through https://lifeos1-api.ceogps.workers.dev/api/oauth/callback and lands on lifeos.ceogps.com." : "Each mailbox connects on its own. Sign-in is required."}</p>
                <div className="mt-3 grid gap-2">
                  {BOARD_EMAILS.map((email) => {
                    const linked = accounts.find((item) => item.provider === row.id && item.email.toLowerCase() === email);
                    return (
                      <div key={email} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-white/75">{email}</span>
                        {linked ? <button type="button" className="link-remove" onClick={() => disconnect(row.id, email)}>Disconnect</button> : <button type="button" className="quiet check-btn" onClick={() => connect(row.id, row.name, email)}>{email.endsWith("@icloud.com") ? "Nylas" : row.id === "google" ? "Connect" : "Authorize"}</button>}
                      </div>
                    );
                  })}
                </div>
                {account ? statusLine(row.name, { state: "connected", text: account.email || account.name }) : statusLine(row.name, { state: "idle", text: "Pick one of the three emails." })}
                {row.id === "google" ? <button type="button" className="quiet check-btn mt-3" onClick={() => {
                  setBusy((prev) => ({ ...prev, Google: true }));
                  void import("@/lib/lifeos/oauth").then(async ({ freshGoogleToken }) => {
                    const token = await freshGoogleToken("chrisgr33ninc@gmail.com");
                    if (!token) {
                      stamp("Google", "error", "Connect chrisgr33ninc@gmail.com.");
                      setBusy((prev) => ({ ...prev, Google: false }));
                      return;
                    }
                    const response = await fetch("/api/keys/account", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ service: "search-console", token, key: "", secret: "", site: "" }),
                    });
                    const checked = await response.json().catch(() => ({ ok: false, text: "Google did not answer." })) as { ok?: boolean; text?: string };
                    stamp("Google", checked.ok ? "connected" : "error", checked.text || "Google did not answer.");
                    setBusy((prev) => ({ ...prev, Google: false }));
                  }).catch((error) => {
                    stamp("Google", "error", error instanceof Error ? error.message : "Google did not answer.");
                    setBusy((prev) => ({ ...prev, Google: false }));
                  });
                }}>{checkLabel("Google")}</button> : null}
              </article>
            );
          }
          const saved = data.keys.find((item) => item.name === row.name && item.value);
          const on = ready.includes(row.name) || Boolean(saved);
          if (row.name === "Search Console" || row.name === "Google Analytics" || row.name === "GoDaddy" || row.name === "Brilliant Directories") {
            const service = row.name === "Search Console" ? "search-console" : row.name === "Google Analytics" ? "google-analytics" : row.name === "GoDaddy" ? "godaddy" : "brilliant";
            const google = accounts.find((item) => item.provider === "google");
            const oneClick = service === "search-console";
            const status = checked[service] || (service === "google-analytics" || oneClick ? saved?.value || "" : "");
            const linked = service === "google-analytics" ? Boolean(google) : oneClick ? Boolean(google && saved) : on;
            return (
              <article key={row.name} className="module-card p-4">
                <p className="text-lg">{row.name}</p>
              {emails(row.name)}
                {statusLine(row.name, linked ? { state: "saved", text: status || "Not checked yet" } : { state: "idle", text: "No key saved." })}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {oneClick && !google ? <button type="button" className="quiet is-on" onClick={() => connect("google", "Google")}>Connect Google</button> : open === row.name || (service === "google-analytics" && google) ? (
                    <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); void checkAccount(row.name, service); }}>
                      {service === "google-analytics" ? <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={paste[row.name] || ""} placeholder="GA4 property ID" onChange={(event) => setPaste((prev) => ({ ...prev, [row.name]: event.target.value }))} /> : <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={paste[row.name] || ""} placeholder="API key" onChange={(event) => setPaste((prev) => ({ ...prev, [row.name]: event.target.value }))} />}
                      {row.name === "GoDaddy" ? <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={extra[row.name] || ""} placeholder="API secret" onChange={(event) => setExtra((prev) => ({ ...prev, [row.name]: event.target.value }))} /> : null}
                      {row.name === "Brilliant Directories" ? <input className="h-9 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" value={extra[row.name] || ""} placeholder="https://ceogps.com" onChange={(event) => setExtra((prev) => ({ ...prev, [row.name]: event.target.value }))} /> : null}
                      <button type="submit" className="quiet check-btn">{busy[row.name] ? "Checking" : "Check"}</button>
                    </form>
                  ) : <button type="button" className="quiet is-on" onClick={() => { setOpen(row.name); setPaste((prev) => ({ ...prev, [row.name]: saved?.value || "" })); setExtra((prev) => ({ ...prev, [row.name]: data.keys.find((item) => item.name === (row.name === "GoDaddy" ? "GoDaddy Secret" : "Brilliant Site"))?.value || "" })); }}>Edit</button>}
                  <button type="button" className="quiet check-btn" onClick={() => void checkAccount(row.name, service)}>{checkLabel(row.name)}</button>
                </div>
              </article>
            );
          }
          return (
            <article key={row.name} className="module-card p-4">
              <p className="text-lg">{row.name}</p>
              {emails(row.name)}
              {statusLine(row.name, on ? { state: "saved", text: saved ? maskKey(saved.value) : "Not checked with the service yet." } : { state: "idle", text: "No key saved." })}
              {saved ? <p className="mt-1 text-xs text-white/45">Key on file · {maskKey(saved.value)}</p> : null}
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className="quiet check-btn" onClick={() => void verify(row.name)}>{checkLabel(row.name)}</button>
                {open === row.name ? (
                  <form className="flex min-w-0 flex-1 gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    const value = String(new FormData(event.currentTarget).get("value") || "").trim();
                    if (!value) {
                      setNote(`${row.name} was not changed. The saved key is still there.`);
                      return;
                    }
                    update((prev) => ({ ...prev, keys: [{ id: newId(), name: row.name, value }, ...prev.keys.filter((item) => item.name !== row.name)] }));
                    stamp(row.name, "saved", maskKey(value));
                    setOpen("");
                    setNote(`${row.name} saved.`);
                    void verify(row.name, value);
                  }}>
                    <input name="value" key={`${row.name}-${saved?.id || "new"}`} className="h-9 min-w-0 flex-1 rounded-full border border-line bg-black/40 px-3 text-base" autoComplete="off" defaultValue={saved?.value || ""} placeholder="Paste key" />
                    <button type="submit" className="quiet is-on">Save</button>
                  </form>
                ) : <button type="button" className="quiet" onClick={() => setOpen(row.name)}>{on ? "Replace" : "Add key"}</button>}
              </div>
            </article>
          );
        })}
      </div>
      {note ? <p className="mt-3 text-base text-white/60">{note}</p> : null}
    </div>
  );
}
