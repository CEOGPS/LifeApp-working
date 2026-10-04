import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// The one redirect URI registered in every provider console. Used verbatim by
// both /start and the token exchange (providers require an exact match).
const OAUTH_CALLBACK_URI = "https://lifeos1-api.ceogps.workers.dev/api/oauth/callback";
// Where the callback page's fallback link / no-opener redirect sends the user.
const APP_URL = "https://lifeos1.pages.dev";

// NOTE: these routes trust the user_id / account_email query params sent by the
// frontend (no auth check). Left as-is intentionally; see report.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// Small page shown in the OAuth popup: notifies the opener and closes itself.
function oauthResultPage(provider: string | null, success: boolean, state: string | null, error?: string): Response {
  const payload = JSON.stringify({
    type: "oauth-complete",
    provider: provider || null,
    success,
    state: state || null,
    error: success ? null : error || "OAuth failed",
  }).replace(/</g, "\\u003c");
  const title = success ? "Connected" : "Connection failed";
  const msg = success
    ? `${escapeHtml(provider || "Account")} connected. You can close this window.`
    : `${escapeHtml(provider || "OAuth")} error: ${escapeHtml(error || "OAuth failed")}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#0b0b10;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{max-width:480px;padding:24px;text-align:center}a{color:#8ab4ff}</style>
</head><body><div><h2>${title}</h2><p>${msg}</p><p><a href="${APP_URL}/">Return to LifeOS</a></p></div>
<script>
(function(){
  var data = ${payload};
  var hasOpener = false;
  try { if (window.opener && !window.opener.closed) { window.opener.postMessage(data, "*"); hasOpener = true; } } catch (e) {}
  if (hasOpener) { setTimeout(function(){ window.close(); }, ${success ? 300 : 4000}); }
  else if (data.success) { setTimeout(function(){ window.location.href = "${APP_URL}/"; }, 1500); }
})();
</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function base64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}


/** Resolve OAuth client id/secret with common .env alias names (sole-user local + worker secrets). */
function oauthEnvCreds(env: any, provider: string): { clientId: string; clientSecret: string } {
  const P = provider.toUpperCase();
  const idKeys: string[] = [`${P}_CLIENT_ID`];
  const secretKeys: string[] = [`${P}_CLIENT_SECRET`];
  if (P === "GOOGLE") {
    idKeys.push("GOOGLE_OAUTH_CLIENT_ID");
    secretKeys.push("GOOGLE_OAUTH_CLIENT_SECRET");
  } else if (P === "GITHUB") {
    idKeys.push("GITHUB_OAUTH_CLIENT_ID");
    secretKeys.push("GITHUB_OAUTH_CLIENT_SECRET");
  } else if (P === "MICROSOFT") {
    idKeys.push("AZURE_CLIENT_ID", "MICROSOFT_OAUTH_CLIENT_ID");
    secretKeys.push("AZURE_CLIENT_SECRET", "MICROSOFT_OAUTH_CLIENT_SECRET");
  } else if (P === "FACEBOOK") {
    idKeys.push("META_APP_ID", "META_CLIENT_ID");
    secretKeys.push("META_APP_SECRET", "META_CLIENT_SECRET");
  } else if (P === "INSTAGRAM") {
    idKeys.push("META_APP_ID", "INSTAGRAM_APP_ID");
    secretKeys.push("META_APP_SECRET", "INSTAGRAM_APP_SECRET");
  } else if (P === "TWITTER") {
    idKeys.push("TWITTER_OAUTH_CLIENT_ID");
    secretKeys.push("TWITTER_CLIENT_SECRET", "TWITTER_SECRET_KEY", "TWITTER_CONSUMER_SECRET", "TWITTER_OAUTH_CLIENT_SECRET");
  }
  let clientId = "";
  let clientSecret = "";
  for (const k of idKeys) {
    const v = typeof env[k] === "string" ? env[k].trim() : "";
    if (v) { clientId = v; break; }
  }
  for (const k of secretKeys) {
    const v = typeof env[k] === "string" ? env[k].trim() : "";
    if (v) { clientSecret = v; break; }
  }
  return { clientId, clientSecret };
}

// GET /api/oauth/status - Check OAuth connection status for multiple providers
router.get("/status", async (request, env) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const userId = url.searchParams.get("user_id");
  const accountEmail = url.searchParams.get("account_email");
  const state = url.searchParams.get("state");

  if (!userId) {
    return Response.json({ error: "Missing user_id" }, { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    // Query Supabase for actual OAuth credentials
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ 
        error: "Supabase not configured",
        connected: [],
        statuses: {}
      }, { headers: corsHeaders() });
    }

    let queryUrl = `${supabaseUrl}/rest/v1/integrations_credentials?user_id=eq.${encodeURIComponent(userId)}&select=id,integration_name,email,oauth_provider,oauth_access_token,status,updated_at`;
    
    if (provider) {
      queryUrl += `&oauth_provider=eq.${encodeURIComponent(provider)}`;
    }
    if (accountEmail) {
      queryUrl += `&email=eq.${encodeURIComponent(accountEmail)}`;
    }

    const response = await fetch(queryUrl, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`);
    }

    const credentials = await response.json();
    
    const connected: string[] = [];
    const statuses: Record<string, { connected: boolean; email?: string; lastSynced?: string }> = {};
    
    for (const cred of credentials) {
      const key = cred.oauth_provider || cred.integration_name;
      const isConnected = cred.status === "on" && !!cred.oauth_access_token;
      
      if (isConnected) {
        connected.push(key);
        if (!statuses[key] || !statuses[key].connected) {
          statuses[key] = {
            connected: true,
            email: cred.email,
            lastSynced: cred.updated_at,
          };
        }
      } else if (!statuses[key]) {
        statuses[key] = { connected: false };
      }
    }

    return Response.json({
      connected,
      statuses,
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error("[oauth/status] error:", e);
    return Response.json({
      error: "Failed to check OAuth status",
      connected: [],
      statuses: {},
    }, { headers: corsHeaders() });
  }
});

// GET /api/oauth/start - Initiate OAuth flow
router.get("/start", async (request, env) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const accountEmail = url.searchParams.get("account_email");
  const userId = url.searchParams.get("user_id");
  // One state value, used both in the provider URL and the stored pending row.
  const state = url.searchParams.get("state") || crypto.randomUUID();

  if (!provider || !userId) {
    return Response.json({ error: "Missing provider or user_id" }, { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  const oauthUrls: Record<string, string> = {
    google: "https://accounts.google.com/o/oauth2/v2/auth",
    microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    github: "https://github.com/login/oauth/authorize",
    slack: "https://slack.com/oauth/v2/authorize",
    facebook: "https://www.facebook.com/v18.0/dialog/oauth",
    instagram: "https://www.instagram.com/oauth/authorize",
    twitter: "https://twitter.com/i/oauth2/authorize",
    linkedin: "https://www.linkedin.com/oauth/v2/authorization",
    spotify: "https://accounts.spotify.com/authorize",
    notion: "https://api.notion.com/v1/oauth/authorize",
  };

  const authUrl = oauthUrls[provider];
  if (!authUrl) {
    return oauthResultPage(provider, false, state, `Unsupported OAuth provider: ${provider}`);
  }

  const { clientId } = oauthEnvCreds(env, provider);
  if (!clientId) {
    return oauthResultPage(provider, false, state, `Missing ${provider.toUpperCase()}_CLIENT_ID worker secret`);
  }

  // Always the fixed worker callback (a caller-supplied redirect_uri is ignored).
  const callbackUri = OAUTH_CALLBACK_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUri,
    response_type: "code",
    state,
  });
  const scope = getScopes(provider);
  if (scope) params.set("scope", scope);
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  if (provider === "notion") {
    params.set("owner", "user");
  }

  // Twitter/X OAuth 2.0 requires PKCE. The verifier is kept server-side in the
  // pending integrations_credentials row and used in the token exchange.
  let codeVerifier: string | null = null;
  if (provider === "twitter") {
    const pkce = await createPkcePair();
    codeVerifier = pkce.verifier;
    params.set("code_challenge", pkce.challenge);
    params.set("code_challenge_method", "S256");
  }

  // PATCH (api-key-wiring): LOCAL wrangler dev only - `preview=1` with the X-LifeOS-Local-Token
  // header returns the provider redirect WITHOUT writing the pending row (used to verify the
  // start redirect without touching Supabase). LOCAL_HEALTH_TOKEN is never set in production.
  const localTok = typeof env.LOCAL_HEALTH_TOKEN === "string" ? env.LOCAL_HEALTH_TOKEN.trim() : "";
  if (url.searchParams.get("preview") === "1" && localTok.length >= 24 && request.headers.get("X-LifeOS-Local-Token") === localTok) {
    return Response.redirect(`${authUrl}?${params.toString()}`, 302);
  }
  // Store the pending OAuth state in Supabase for verification on callback
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return oauthResultPage(provider, false, state, "Supabase not configured on the worker");
  }
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/integrations_credentials?on_conflict=user_id,integration_name,email`,
      {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          user_id: userId,
          integration_name: provider,
          email: accountEmail || null,
          label: accountEmail || null,
          oauth_provider: provider,
          status: "pending",
          oauth_state: state,
          oauth_redirect_uri: callbackUri,
          oauth_code_verifier: codeVerifier,
          updated_at: new Date().toISOString(),
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`Supabase insert failed: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    console.error("[oauth/start] Failed to store pending state:", e);
    return oauthResultPage(provider, false, state, "Could not save pending OAuth state");
  }
  
  return Response.redirect(`${authUrl}?${params.toString()}`, 302);
});

// GET /api/oauth/callback - Handle OAuth callback from providers
router.get("/callback", async (request, env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  let provider = url.searchParams.get("provider"); // Some providers pass this back

  if (error) {
    return oauthResultPage(provider, false, state, errorDescription ? `${error}: ${errorDescription}` : error);
  }

  if (!code || !state) {
    return oauthResultPage(provider, false, state, "Missing code or state");
  }

  try {
    // Look up the pending OAuth state in Supabase
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase not configured");
    }

    // Find the pending credential by state
    const pendingResponse = await fetch(
      `${supabaseUrl}/rest/v1/integrations_credentials?oauth_state=eq.${encodeURIComponent(state)}&status=eq.pending&select=*`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!pendingResponse.ok) {
      throw new Error("Failed to find pending OAuth state");
    }

    const pendingCreds = await pendingResponse.json();
    
    if (!pendingCreds || pendingCreds.length === 0) {
      throw new Error("Invalid or expired OAuth state");
    }

    const pendingCred = pendingCreds[0];
    const actualProvider = provider || pendingCred.oauth_provider;
    provider = actualProvider;

    // Exchange code for access token (same redirect_uri as /start)
    const tokenResponse = await exchangeCodeForToken(
      actualProvider,
      code,
      OAUTH_CALLBACK_URI,
      env,
      pendingCred.oauth_code_verifier || undefined
    );
    
    if (!tokenResponse.access_token) {
      throw new Error("Failed to obtain access token");
    }

    // Update the credential with tokens
    const updateData: Record<string, any> = {
      oauth_access_token: tokenResponse.access_token,
      oauth_refresh_token: tokenResponse.refresh_token || null,
      oauth_expires_at: tokenResponse.expires_in 
        ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() 
        : null,
      oauth_scope: tokenResponse.scope || getScopes(actualProvider),
      oauth_code_verifier: null,
      status: "on",
      updated_at: new Date().toISOString(),
    };

    if (tokenResponse.id_token) {
      updateData.oauth_id_token = tokenResponse.id_token;
    }

    const updateUrl = `${supabaseUrl}/rest/v1/integrations_credentials?id=eq.${pendingCred.id}`;
    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(updateData),
    });
    if (!updateRes.ok) {
      throw new Error(`Failed to save tokens (${updateRes.status})`);
    }

    return oauthResultPage(actualProvider, true, state);
    
  } catch (e) {
    console.error("[oauth/callback] error:", e);
    return oauthResultPage(provider, false, state, e instanceof Error ? e.message : "OAuth failed");
  }
});

// POST /api/oauth/disconnect - Disconnect OAuth provider
router.post("/disconnect", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { provider, account_email } = body;
  
  if (!provider || !account_email) {
    return Response.json({ error: "Missing provider or account_email" }, { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase not configured");
    }

    // Delete or mark as disconnected
    const deleteUrl = `${supabaseUrl}/rest/v1/integrations_credentials?oauth_provider=eq.${encodeURIComponent(provider)}&email=eq.${encodeURIComponent(account_email)}`;
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });

    return Response.json({ success: true, message: `Disconnected ${provider}` }, {
      headers: corsHeaders()
    });
  } catch (e) {
    console.error("[oauth/disconnect] error:", e);
    return Response.json({ error: "Failed to disconnect" }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// POST /api/oauth/token - Exchange code for token
router.post("/token", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { code, provider, redirect_uri, code_verifier } = body;

  if (!code || !provider) {
    return Response.json({ error: "Missing code or provider" }, { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    const tokenResponse = await exchangeCodeForToken(provider, code, redirect_uri || OAUTH_CALLBACK_URI, env, code_verifier);
    return Response.json(tokenResponse, { headers: corsHeaders() });
  } catch (e) {
    console.error("[oauth/token] error:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Token exchange failed" }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

// POST /api/oauth/token/save - Save token to storage
router.post("/token/save", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { user_id, integration_name, email, oauth_provider, oauth_access_token, oauth_refresh_token, oauth_expires_at, oauth_scope, label } = body;
  
  if (!user_id || !integration_name || !oauth_access_token) {
    return Response.json({ error: "Missing required fields" }, { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase not configured");
    }

    const upsertData = {
      user_id,
      integration_name,
      email: email || null,
      label: label || email,
      oauth_provider,
      oauth_access_token,
      oauth_refresh_token,
      oauth_expires_at,
      oauth_scope,
      status: "on",
      updated_at: new Date().toISOString(),
    };

    const upsertUrl = `${supabaseUrl}/rest/v1/integrations_credentials?on_conflict=user_id,integration_name,email`;
    const response = await fetch(upsertUrl, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify(upsertData),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase upsert failed: ${error}`);
    }

    return Response.json({ success: true }, { headers: corsHeaders() });
  } catch (e) {
    console.error("[oauth/token/save] error:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Failed to save token" }, { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});

async function exchangeCodeForToken(
  provider: string,
  code: string,
  redirectUri: string,
  env: any,
  codeVerifier?: string
): Promise<any> {
  const tokenUrls: Record<string, string> = {
    google: "https://oauth2.googleapis.com/token",
    microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    github: "https://github.com/login/oauth/access_token",
    slack: "https://slack.com/api/oauth.v2.access",
    facebook: "https://graph.facebook.com/v18.0/oauth/access_token",
    instagram: "https://api.instagram.com/oauth/access_token",
    twitter: "https://api.twitter.com/2/oauth2/token",
    linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
    spotify: "https://accounts.spotify.com/api/token",
    notion: "https://api.notion.com/v1/oauth/token",
  };

  const tokenUrl = tokenUrls[provider];
  if (!tokenUrl) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const { clientId, clientSecret } = oauthEnvCreds(env, provider);

  if (!clientId || !clientSecret) {
    throw new Error(`Missing ${provider} client credentials`);
  }

  const basicAuth = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  let response: Response;

  if (provider === "notion") {
    // Notion: HTTP Basic auth + JSON body.
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Authorization": basicAuth,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    });
  } else {
    const params = new URLSearchParams();
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("grant_type", "authorization_code");

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    };

    if (provider === "twitter" || provider === "spotify") {
      // Confidential clients authenticate with HTTP Basic auth.
      headers["Authorization"] = basicAuth;
      if (provider === "twitter") {
        if (!codeVerifier) throw new Error("Missing PKCE code_verifier for twitter");
        params.set("code_verifier", codeVerifier);
        params.set("client_id", clientId);
      }
    } else {
      params.set("client_id", clientId);
      params.set("client_secret", clientSecret);
    }

    response = await fetch(tokenUrl, {
      method: "POST",
      headers,
      body: params.toString(),
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText.slice(0, 300)}`);
  }

  const data: any = await response.json();

  // Slack (and some others) answer HTTP 200 with an error payload.
  if (data && data.ok === false) {
    throw new Error(`Token exchange failed: ${data.error || "unknown error"}`);
  }
  if (data && data.error && !data.access_token) {
    throw new Error(`Token exchange failed: ${data.error_description || data.error}`);
  }
  
  // Normalize response - some providers return different field names
  if (data.access_token) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      // null when the provider issues non-expiring tokens (GitHub, Slack, Notion)
      expires_in: data.expires_in || null,
      token_type: data.token_type || "Bearer",
      scope: data.scope || getScopes(provider),
      id_token: data.id_token || null,
    };
  }

  throw new Error("Invalid token response from provider");
}

function getScopes(provider: string): string {
  const scopes: Record<string, string> = {
    google: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly",
    microsoft: "offline_access User.Read Mail.ReadWrite Calendars.Read",
    github: "repo user:email",
    slack: "chat:write channels:read",
    facebook: "email,public_profile,pages_show_list,pages_manage_posts",
    instagram: "instagram_business_basic,instagram_business_content_publish",
    twitter: "tweet.read tweet.write users.read offline.access",
    linkedin: "openid profile email w_member_social",
    spotify: "user-read-private user-read-email playlist-read-private",
    notion: "", // Notion has no scope parameter; access is chosen by the user.
  };
  return provider in scopes ? scopes[provider] : "openid email profile";
}

// PATCH (api-key-wiring): token refresh. POST /api/oauth/refresh { provider } (LifeOS owner only)
// refreshes every live row for that provider that has a refresh_token and is expired or
// expires within 10 minutes, and stores the new tokens. Returns counts only (never tokens).
const REFRESH_URLS: Record<string, string> = {
  google: "https://oauth2.googleapis.com/token",
  microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  twitter: "https://api.twitter.com/2/oauth2/token",
  linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
  spotify: "https://accounts.spotify.com/api/token",
  slack: "https://slack.com/api/oauth.v2.access",
  facebook: "https://graph.facebook.com/v18.0/oauth/access_token",
};

async function refreshOne(provider: string, refreshToken: string, env: any): Promise<any> {
  const P = provider.toUpperCase();
  const { clientId, clientSecret } = oauthEnvCreds(env, provider);
  if (!clientId || !clientSecret) throw new Error(`Missing ${P}_CLIENT_ID / ${P}_CLIENT_SECRET`);
  const params = new URLSearchParams();
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (provider === "facebook") {
    // Meta has no refresh_token grant; long-lived tokens are re-exchanged.
    params.set("grant_type", "fb_exchange_token");
    params.set("fb_exchange_token", refreshToken);
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
  } else {
    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);
    if (provider === "twitter" || provider === "spotify") {
      headers["Authorization"] = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
      if (provider === "twitter") params.set("client_id", clientId);
    } else {
      params.set("client_id", clientId);
      params.set("client_secret", clientSecret);
    }
  }
  const r = await fetch(REFRESH_URLS[provider], { method: "POST", headers, body: params.toString() });
  const data: any = await r.json().catch(() => null);
  if (!r.ok || !data?.access_token || data?.ok === false) {
    throw new Error(`refresh failed: HTTP ${r.status} ${String(data?.error_description || data?.error || "").slice(0, 120)}`);
  }
  return data;
}

router.post("/refresh", async (request, env) => {
  const { requireUser } = await import("./ai");
  const auth = await requireUser(request, env);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status, headers: corsHeaders(request.headers.get("Origin") || undefined) });
  const body: any = await request.json().catch(() => ({}));
  const provider = String(body?.provider || "");
  if (!REFRESH_URLS[provider]) {
    return Response.json({ error: `No refresh flow for "${provider}" (GitHub / Notion tokens do not expire)` }, { status: 400, headers: corsHeaders() });
  }
  const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Supabase not configured on the worker" }, { status: 500, headers: corsHeaders() });
  const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const rows: any[] = await fetch(
    `${url}/rest/v1/integrations_credentials?oauth_provider=eq.${encodeURIComponent(provider)}&status=eq.on&oauth_refresh_token=not.is.null&select=id,oauth_expires_at,oauth_refresh_token`,
    { headers: h },
  ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
  let refreshed = 0, skipped = 0;
  const errors: string[] = [];
  for (const row of rows) {
    const exp = row.oauth_expires_at ? new Date(row.oauth_expires_at).getTime() : 0;
    if (exp && exp - Date.now() > 10 * 60_000) { skipped++; continue; }
    try {
      const t = await refreshOne(provider, row.oauth_refresh_token, env);
      const upd = await fetch(`${url}/rest/v1/integrations_credentials?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { ...h, Prefer: "return=minimal" },
        body: JSON.stringify({
          oauth_access_token: t.access_token,
          oauth_refresh_token: t.refresh_token || row.oauth_refresh_token,
          oauth_expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!upd.ok) throw new Error(`save failed (${upd.status})`);
      refreshed++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return Response.json({ provider, accounts: rows.length, refreshed, skipped, errors }, { headers: corsHeaders(request.headers.get("Origin") || undefined) });
});

export { router as oauthRoutes };
