const WORKER_BASE = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import("@/platform/supabase/client");
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (session?.user?.email) {
    headers["X-User-Id"] = session.user.email;
  }
  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${WORKER_BASE}${path}`, { headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${WORKER_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${WORKER_BASE}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function apiDelete<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${WORKER_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }
  return response.json();
}

export async function apiUpload(path: string, file: File, onProgress?: (progress: number) => void): Promise<{ url: string }> {
  const { supabase } = await import("@/platform/supabase/client");
  const { data: { session } } = await supabase.auth.getSession();
  
  const formData = new FormData();
  formData.append("file", file);
  
  const headers: Record<string, string> = {};
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (session?.user?.email) {
    headers["X-User-Id"] = session.user.email;
  }
  
  const response = await fetch(`${WORKER_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || `Upload failed: ${response.status}`);
  }
  return response.json();
}

// Convenience methods for common operations
export const api = {
  // LLM
  invokeLLM: (options: { prompt: string | unknown[]; systemPrompt?: string; model?: string; maxTokens?: number; temperature?: number }) =>
    apiPost("/api/llm/invoke", options),
  
  // OAuth
  oauthStart: async (provider: string, accountEmail: string, state: string) => {
    const { supabase } = await import("@/platform/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    return apiGet(`/api/oauth/start?provider=${encodeURIComponent(provider)}&account_email=${encodeURIComponent(accountEmail)}&user_id=${encodeURIComponent(session?.user?.email || "")}&state=${encodeURIComponent(state)}`);
  },
  oauthStatus: async (provider: string, accountEmail: string, state?: string) => {
    const { supabase } = await import("@/platform/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    return apiGet(`/api/oauth/status?provider=${encodeURIComponent(provider)}&user_id=${encodeURIComponent(session?.user?.email || "")}&account_email=${encodeURIComponent(accountEmail)}${state ? `&state=${encodeURIComponent(state)}` : ""}`);
  },
  oauthDisconnect: (provider: string, accountEmail: string) =>
    apiPost("/api/oauth/disconnect", { provider, account_email: accountEmail }),
  
  // Integrations
  saveCredential: (data: { user_email: string; integration_name: string; email?: string; api_key?: string; status?: string; label?: string; oauth_provider?: string }) =>
    apiPost("/api/integrations/credential", data),
  loadCredentials: (userEmail: string) =>
    apiGet(`/api/integrations/credentials?user_email=${encodeURIComponent(userEmail)}`),
  deleteCredential: (userEmail: string, integrationName: string, label: string) =>
    apiDelete(`/api/integrations/credential?user_email=${encodeURIComponent(userEmail)}&integration_name=${encodeURIComponent(integrationName)}&label=${encodeURIComponent(label)}`),
  
  // Finance
  getMarketData: () => apiGet("/api/finance/market"),
  getStockQuote: (symbol: string) => apiGet(`/api/finance/stock/${encodeURIComponent(symbol)}`),
  getCryptoQuote: (symbol: string) => apiGet(`/api/finance/crypto/${encodeURIComponent(symbol)}`),
  getFinancialNews: (symbols?: string[]) => apiPost("/api/finance/news", { symbols }),
  
  // Email
  getEmailAccounts: () => apiGet("/api/email/accounts"),
  sendEmail: (data: { to: string; subject: string; body: string; from?: string }) => apiPost("/api/email/send", data),
  getEmailCampaigns: () => apiGet("/api/email/campaigns"),
  
  // Social
  getSocialFeed: (platform: string) => apiGet(`/api/social/feed/${encodeURIComponent(platform)}`),
  postSocial: (data: { platform: string; content: string; media?: string[] }) => apiPost("/api/social/post", data),
  
  // Music
  getMusicPlaylists: () => apiGet("/api/music/playlists"),
  getMusicTracks: (playlistId: string) => apiGet(`/api/music/playlists/${encodeURIComponent(playlistId)}/tracks`),
  
  // Search
  search: (query: string, sources?: string[]) => apiPost("/api/search", { query, sources }),
  
  // Health check
  health: () => apiGet("/health"),
};

export { WORKER_BASE };