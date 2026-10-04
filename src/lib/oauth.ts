/**
 * OAuth connector helper. The Worker owns token exchange + storage.
 * Sole local user: pass owner UUID as user_id (see getOwnerId).
 */
const API_BASE =
  (import.meta as ImportMeta & { env?: { VITE_WORKER_URL?: string } }).env?.VITE_WORKER_URL ||
  "https://lifeos1-api.ceogps.workers.dev";

const START_PATH = (provider: string, userId: string, accountEmail = "me") =>
  `${API_BASE}/api/oauth/start?provider=${encodeURIComponent(provider)}` +
  `&user_id=${encodeURIComponent(userId)}` +
  `&account_email=${encodeURIComponent(accountEmail)}`;
const STATUS_PATH = (provider: string, userId: string, accountEmail = "me") =>
  `${API_BASE}/api/oauth/status?provider=${encodeURIComponent(provider)}` +
  `&user_id=${encodeURIComponent(userId)}` +
  `&account_email=${encodeURIComponent(accountEmail)}`;
const DISCONNECT_PATH = () => `${API_BASE}/api/oauth/disconnect`;

export type OAuthProvider =
  | "spotify"
  | "google"
  | "facebook"
  | "linkedin"
  | "twitter"
  | "github"
  | "microsoft"
  | "slack"
  | "instagram"
  | "notion";

/** Opens a popup to the Worker's OAuth start route, resolves true when the popup closes. */
export function connectProvider(
  provider: OAuthProvider,
  userId: string,
  accountEmail = "me",
): Promise<boolean> {
  return new Promise((resolve) => {
    const popup = window.open(
      START_PATH(provider, userId, accountEmail),
      `oauth_${provider}`,
      "width=520,height=640,noopener=no",
    );
    if (!popup) {
      resolve(false);
      return;
    }
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        resolve(true);
      }
    }, 500);
  });
}

export async function getConnectionStatus(
  provider: OAuthProvider,
  userId: string,
  accountEmail = "me",
): Promise<{ connected: boolean; expiresAt?: string }> {
  try {
    const res = await fetch(STATUS_PATH(provider, userId, accountEmail));
    if (!res.ok) return { connected: false };
    const data = await res.json();
    const connected = Array.isArray(data.connected)
      ? data.connected.length > 0
      : !!(data.connected || data.ok || data.status === "connected");
    return { connected, expiresAt: data.expiresAt };
  } catch {
    return { connected: false };
  }
}

export async function disconnectProvider(
  provider: OAuthProvider,
  accountEmail = "me",
): Promise<boolean> {
  try {
    const res = await fetch(DISCONNECT_PATH(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, account_email: accountEmail }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
