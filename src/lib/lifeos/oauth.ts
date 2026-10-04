const SUPABASE = "https://mhvcdstgkyplhzjptgfr.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odmNkc3Rna3lwbGh6anB0Z2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDE3NzYsImV4cCI6MjA5NDI3Nzc3Nn0.DrwY7_a6OyNdKtA5UB62qrWkiaFe9xcAHLqXdfzf8W4";
const STORE = "lifeos.oauth";
const VERIFIER = "lifeos.pkce";

export type OauthProvider = "google" | "facebook" | "spotify";
export type OauthSession = { provider: OauthProvider; name: string; email: string; token: string };

const SCOPES: Record<OauthProvider, string> = {
  google: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
  facebook: "email public_profile",
  spotify: "user-read-email user-read-private user-top-read user-read-currently-playing",
};

function b64url(bytes: Uint8Array) {
  let text = "";
  bytes.forEach((byte) => { text += String.fromCharCode(byte); });
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function readOauth(): OauthSession[] {
  try {
    const rows = JSON.parse(localStorage.getItem(STORE) || "[]");
    return Array.isArray(rows) ? rows.filter((row) => row?.token && row?.provider) : [];
  } catch {
    return [];
  }
}

function saveOauth(row: OauthSession) {
  const rows = readOauth().filter((item) => item.provider !== row.provider);
  localStorage.setItem(STORE, JSON.stringify([row, ...rows]));
}

export async function startOAuth(provider: OauthProvider) {
  const settings = await fetch(`${SUPABASE}/auth/v1/settings`, { headers: { apikey: ANON } }).then((response) => response.json()).catch(() => null) as { external?: Record<string, boolean> } | null;
  if (settings?.external && settings.external[provider] === false) {
    throw new Error(`${provider} is turned off in Supabase Auth. Enable it under Authentication, then Providers.`);
  }
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = b64url(new Uint8Array(digest));
  sessionStorage.setItem(VERIFIER, verifier);
  const back = `${window.location.origin}/panel/integrations`;
  const url = new URL(`${SUPABASE}/auth/v1/authorize`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("redirect_to", back);
  url.searchParams.set("scopes", SCOPES[provider]);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");
  window.location.assign(url.toString());
}

export async function finishOAuth(): Promise<OauthSession | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return null;
  const verifier = sessionStorage.getItem(VERIFIER) || "";
  const response = await fetch(`${SUPABASE}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  });
  const body = await response.json() as { provider_token?: string; user?: { email?: string; app_metadata?: { provider?: string }; user_metadata?: { full_name?: string; name?: string } } };
  params.delete("code");
  params.delete("state");
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history.replaceState({}, "", next);
  if (!response.ok || !body.provider_token) return null;
  const raw = body.user?.app_metadata?.provider;
  const provider: OauthProvider = raw === "facebook" || raw === "spotify" ? raw : "google";
  const session: OauthSession = {
    provider,
    name: body.user?.user_metadata?.full_name || body.user?.user_metadata?.name || "",
    email: body.user?.email || "",
    token: body.provider_token,
  };
  saveOauth(session);
  sessionStorage.removeItem(VERIFIER);
  return session;
}
