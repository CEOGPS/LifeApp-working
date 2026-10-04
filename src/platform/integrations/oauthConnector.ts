// OAuth connector utilities for the browser (sole local user).
// Worker owns token exchange + storage; this only starts the flow and checks status.
// userId MUST be the stable owner UUID (getOwnerId), never a "connect as someone else" email.

import { getSupabaseClient } from "@/lib/supabaseClient";
import { getOwnerId } from "@/lib/owner";

const WORKER_BASE = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";
const OAUTH_CALLBACK_URI = `${WORKER_BASE.replace(/\/+$/, "")}/api/oauth/callback`;

export interface OAuthConfig {
  provider: string;
  /** Optional label for which of YOUR accounts (stored as account_email). */
  accountEmail?: string;
  /** Owner UUID. If omitted, resolved via getOwnerId(). */
  userId?: string;
  redirectUri?: string;
}

export interface OAuthState {
  provider: string;
  accountEmail: string;
  state: string;
  timestamp: number;
}

const OAUTH_STATES_KEY = "lifeos1_oauth_states";

function getStoredStates(): OAuthState[] {
  try {
    const data = localStorage.getItem(OAUTH_STATES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveStates(states: OAuthState[]): void {
  try {
    localStorage.setItem(OAUTH_STATES_KEY, JSON.stringify(states));
  } catch (e) {
    console.warn("[OAuth] Failed to save states:", e);
  }
}

function generateState(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function resolveOwnerId(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const owner = await getOwnerId();
  if (owner) return owner;
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("No local session. Reload the app.");
  return uid;
}

export async function startOAuth(config: OAuthConfig): Promise<{ url: string; state: string }> {
  const state = generateState();
  const redirectUri = config.redirectUri || OAUTH_CALLBACK_URI;
  const accountEmail = (config.accountEmail || "me").trim() || "me";
  const userId = await resolveOwnerId(config.userId);

  const states = getStoredStates();
  states.push({
    provider: config.provider,
    accountEmail,
    state,
    timestamp: Date.now(),
  });
  const cutoff = Date.now() - 10 * 60 * 1000;
  saveStates(states.filter((s) => s.timestamp > cutoff));

  const url =
    `${WORKER_BASE}/api/oauth/start?provider=${encodeURIComponent(config.provider)}` +
    `&account_email=${encodeURIComponent(accountEmail)}` +
    `&user_id=${encodeURIComponent(userId)}` +
    `&state=${encodeURIComponent(state)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return { url, state };
}

export function openOAuthPopup(url: string, provider: string): Window | null {
  const popup = window.open(url, `oauth_${provider}`, "width=600,height=700,noopener,noreferrer");
  if (!popup) {
    window.location.href = url;
    return null;
  }
  return popup;
}

export function verifyOAuthState(provider: string, accountEmail: string, state: string): boolean {
  const states = getStoredStates();
  const index = states.findIndex(
    (s) => s.provider === provider && s.accountEmail === accountEmail && s.state === state
  );
  if (index !== -1) {
    states.splice(index, 1);
    saveStates(states);
    return true;
  }
  return false;
}

export async function checkOAuthStatus(
  provider: string,
  accountEmail: string = "me",
  state?: string
): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    const userId = await resolveOwnerId();

    let url =
      `${WORKER_BASE}/api/oauth/status?provider=${encodeURIComponent(provider)}` +
      `&user_id=${encodeURIComponent(userId)}` +
      `&account_email=${encodeURIComponent(accountEmail || "me")}`;
    if (state) url += `&state=${encodeURIComponent(state)}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    });

    const data = await response.json().catch(() => ({}));
    const connected = Array.isArray(data.connected)
      ? data.connected.length > 0
      : !!(data.connected || data.ok || data.access_token || data.status === "connected");

    return { connected, error: data.error || data.message };
  } catch (e) {
    return { connected: false, error: e instanceof Error ? e.message : "Failed to check status" };
  }
}

export async function disconnectOAuth(provider: string, accountEmail: string = "me"): Promise<boolean> {
  try {
    const client = await getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();

    const response = await fetch(`${WORKER_BASE}/api/oauth/disconnect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ provider, account_email: accountEmail || "me" }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

export function listenForOAuthCompletion(
  state: string,
  onSuccess: () => void,
  onError: (error: string) => void,
  timeout = 5 * 60 * 1000
): () => void {
  const handleMessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg) return;
    if (msg.type === "oauth-complete" && msg.state === state) {
      if (msg.success) onSuccess();
      else onError(msg.error || "OAuth failed");
      window.removeEventListener("message", handleMessage);
    } else if (msg.type === "oauth_success" && msg.state === state) {
      onSuccess();
      window.removeEventListener("message", handleMessage);
    } else if (msg.type === "oauth_error" && msg.state === state) {
      onError(msg.error || "OAuth failed");
      window.removeEventListener("message", handleMessage);
    }
  };

  window.addEventListener("message", handleMessage);
  const timeoutId = setTimeout(() => {
    window.removeEventListener("message", handleMessage);
    onError("OAuth timeout");
  }, timeout);

  return () => {
    window.removeEventListener("message", handleMessage);
    clearTimeout(timeoutId);
  };
}
