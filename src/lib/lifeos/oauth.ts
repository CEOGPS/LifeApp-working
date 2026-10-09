export const SUPABASE = "https://mhvcdstgkyplhzjptgfr.supabase.co";
export const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odmNkc3Rna3lwbGh6anB0Z2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDE3NzYsImV4cCI6MjA5NDI3Nzc3Nn0.DrwY7_a6OyNdKtA5UB62qrWkiaFe9xcAHLqXdfzf8W4";
export const WORKER = "https://lifeos1-api.ceogps.workers.dev";
export const APP_ORIGIN = "https://lifeos.ceogps.com";
const STORE = "lifeos.oauth";
const VERIFIER = "lifeos.pkce";

export const GMAIL_ACCOUNT = "chrisgr33ninc@gmail.com";
export const BOARD_EMAILS = ["chris@ceogps.com", "chrisgr33ninc@gmail.com", "cagednreality@icloud.com"] as const;

export function allowedEmail(email: string) {
  return BOARD_EMAILS.includes(email.trim().toLowerCase() as (typeof BOARD_EMAILS)[number]);
}
export type OauthProvider = "google" | "discord" | "facebook" | "spotify";
export type OauthSession = { provider: OauthProvider; name: string; email: string; token: string; refresh?: string; via?: "worker" };

const CARD: Record<OauthProvider, string> = { google: "Google", discord: "Discord", facebook: "Facebook", spotify: "Spotify" };

function isProvider(value: string): value is OauthProvider {
  return value === "google" || value === "discord" || value === "facebook" || value === "spotify";
}

function b64url(bytes: Uint8Array) {
  let text = "";
  bytes.forEach((byte) => { text += String.fromCharCode(byte); });
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function rawOauth(): OauthSession[] {
  try {
    const rows = JSON.parse(localStorage.getItem(STORE) || "[]");
    if (!Array.isArray(rows)) return [];
    const clean = rows.filter((row) => row?.provider && isProvider(row.provider)).map((row) => ({
      provider: row.provider,
      name: row.name || CARD[row.provider],
      email: row.email || "",
      token: "",
      via: "worker" as const,
    }));
    if (rows.some((row) => row?.token || row?.refresh)) localStorage.setItem(STORE, JSON.stringify(clean));
    return clean;
  } catch {
    return [];
  }
}

export function readOauth(): OauthSession[] {
  return rawOauth().filter((row) => row.token || row.via === "worker");
}

function saveOauth(row: OauthSession) {
  const clean: OauthSession = { provider: row.provider, name: row.name, email: row.email, token: "", via: "worker" };
  const rows = rawOauth().filter((item) => !(item.provider === clean.provider && item.email.toLowerCase() === clean.email.toLowerCase()));
  localStorage.setItem(STORE, JSON.stringify([clean, ...rows]));
}

export function disconnectOauth(provider: OauthProvider, email?: string) {
  const rows = rawOauth().filter((item) => item.provider !== provider || (email && item.email.toLowerCase() !== email.toLowerCase()));
  localStorage.setItem(STORE, JSON.stringify(rows));
}

function readSessionToken() {
  try {
    const parsed = JSON.parse(localStorage.getItem("sb-mhvcdstgkyplhzjptgfr-auth-token") || "{}") as { access_token?: string; currentSession?: { access_token?: string } };
    return parsed.access_token || parsed.currentSession?.access_token || "";
  } catch {
    return "";
  }
}

export function rememberLink(provider: OauthProvider, email?: string, name?: string) {
  const mailbox = (email || "").trim();
  const existing = rawOauth().find((item) => item.provider === provider && item.email.toLowerCase() === mailbox.toLowerCase());
  if (existing?.token) return existing;
  const row: OauthSession = { provider, name: name || CARD[provider], email: mailbox, token: existing?.token || "", via: "worker" };
  saveOauth(row);
  return row;
}

export async function pullWorkerLinks() {
  const token = readSessionToken();
  if (!token) return readOauth();
  const response = await fetch(`${WORKER}/api/oauth/status`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return readOauth();
  const body = await response.json() as { accounts?: { provider?: string; email?: string }[]; statuses?: Record<string, { connected?: boolean; email?: string }> };
  const linked = Array.isArray(body.accounts) ? body.accounts : [];
  if (linked.length) {
    for (const row of linked) {
      if (row.provider === "google" || row.provider === "discord" || row.provider === "facebook" || row.provider === "spotify") {
        rememberLink(row.provider, row.email || "");
      }
    }
    return readOauth();
  }
  for (const provider of ["google", "discord", "facebook", "spotify"] as const) {
    const status = body.statuses?.[provider];
    if (!status?.connected) continue;
    rememberLink(provider, status.email || "");
  }
  return readOauth();
}

export function catchReturn() {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get("connected");
  const error = params.get("oauth_error") || "";
  if (connected && isProvider(connected)) {
    const email = sessionStorage.getItem("lifeos.oauth.mailbox") || "";
    if (email) rememberLink(connected, email, CARD[connected]);
    sessionStorage.removeItem("lifeos.oauth.mailbox");
  }
  if (connected || error) {
    params.delete("connected");
    params.delete("oauth_error");
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
  }
  return { provider: connected && isProvider(connected) ? connected : "", error };
}

export async function startOAuth(provider: OauthProvider, email?: string) {
  const origin = window.location.origin || APP_ORIGIN;
  const picked = (email || "").trim().toLowerCase();
  if (!picked) throw new Error("Use the mailbox you clicked.");
  if (picked.endsWith("@icloud.com")) throw new Error("iCloud connects through Nylas, not OAuth.");
  if (provider === "google" && !allowedEmail(picked)) throw new Error("Pick one of the three Google mailboxes.");
  const token = readSessionToken();
  if (!token) throw new Error("Sign in first.");
  sessionStorage.setItem("lifeos.oauth.back", `${origin}/panel/integrations`);
  sessionStorage.setItem("lifeos.oauth.mailbox", picked);
  const response = await fetch(`${WORKER}/api/oauth/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ provider, account_email: picked, origin }),
  });
  const body = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error || "The worker refused the start.");
  window.location.assign(body.url);
}

export async function startNylas(email?: string) {
  const origin = window.location.origin || APP_ORIGIN;
  const account = (email || "").trim().toLowerCase();
  if (!account.endsWith("@icloud.com")) throw new Error("Nylas is for the iCloud mailbox.");
  const token = readSessionToken();
  if (!token) throw new Error("Sign in first.");
  sessionStorage.setItem("lifeos.oauth.mailbox", account);
  const response = await fetch(`${WORKER}/api/nylas/connect`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: account, origin }),
  });
  const body = await response.json().catch(() => ({})) as { url?: string; error?: string };
  if (!response.ok || !body.url) throw new Error(body.error || "Nylas did not start.");
  window.location.assign(body.url);
}

export async function finishOAuth(): Promise<OauthSession | null> {
  return null;
}

export async function freshGoogleToken(_email?: string) {
  return "";
}
