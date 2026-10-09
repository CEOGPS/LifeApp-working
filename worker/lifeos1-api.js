var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// attachments/working-worker.js
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var t = /* @__PURE__ */ __name2(({ base: e = "", routes: t2 = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: /* @__PURE__ */ __name2((o3, r2, a, s) => (o4, ...n) => t2.push([r2.toUpperCase?.(), RegExp(`^${(s = (e + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>[^]+))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), n, s]) && a, "get") }), routes: t2, ...o2, async fetch(e2, ...r2) {
  let a, s, n = new URL(e2.url), c = e2.query = { __proto__: null };
  for (let [e3, t3] of n.searchParams) c[e3] = c[e3] ? [].concat(c[e3], t3) : t3;
  e: try {
    for (let t3 of o2.before || []) if (null != (a = await t3(e2.proxy ?? e2, ...r2))) break e;
    t: for (let [o3, c2, l, i] of t2) if ((o3 == e2.method || "ALL" == o3) && (s = n.pathname.match(c2))) {
      e2.params = s.groups || {}, e2.route = i;
      for (let t3 of l) if (null != (a = await t3(e2.proxy ?? e2, ...r2))) break t;
    }
  } catch (t3) {
    if (!o2.catch) throw t3;
    a = await o2.catch(t3, e2.proxy ?? e2, ...r2);
  }
  try {
    for (let t3 of o2.finally || []) a = await t3(a, e2.proxy ?? e2, ...r2) ?? a;
  } catch (t3) {
    if (!o2.catch) throw t3;
    a = await o2.catch(t3, e2.proxy ?? e2, ...r2);
  }
  return a;
} }), "t");
var o = /* @__PURE__ */ __name2((e = "text/plain; charset=utf-8", t2) => (o2, r2 = {}) => {
  if (void 0 === o2 || o2 instanceof Response) return o2;
  const a = new Response(t2?.(o2) ?? o2, r2.url ? void 0 : r2);
  return a.headers.set("content-type", e), a;
}, "o");
var r = o("application/json; charset=utf-8", JSON.stringify);
var p = o("text/plain; charset=utf-8", String);
var f = o("text/html");
var u = o("image/jpeg");
var h = o("image/png");
var g = o("image/webp");
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Allow-Credentials": "true"
  };
}
__name(corsHeaders, "corsHeaders");
__name2(corsHeaders, "corsHeaders");
function withCors(response, origin) {
  const headers = new Headers(response.headers);
  const cors2 = corsHeaders(origin);
  Object.entries(cors2).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withCors, "withCors");
__name2(withCors, "withCors");
var OAUTH_CALLBACK = "https://lifeos1-api.ceogps.workers.dev/api/oauth/callback";
var NYLAS_CALLBACK = "https://lifeos1-api.ceogps.workers.dev/api/nylas/callback";
var OAUTH_ORIGINS = /* @__PURE__ */ new Set(["https://lifeos.ceogps.com", "https://lifeos1.ceogps.com"]);
var OAUTH_PROVIDERS = /* @__PURE__ */ new Set(["google", "microsoft", "github", "slack", "facebook", "instagram", "twitter", "linkedin", "spotify", "discord", "notion"]);
function oauthCallback(env) {
  const named = String(env.OAUTH_REDIRECT_URI || "").trim();
  return named === OAUTH_CALLBACK ? named : OAUTH_CALLBACK;
}
__name(oauthCallback, "oauthCallback");
__name2(oauthCallback, "oauthCallback");
function safeOrigin(value) {
  try {
    const origin = new URL(String(value || "")).origin;
    if (OAUTH_ORIGINS.has(origin)) return origin;
  } catch {
  }
  return "https://lifeos.ceogps.com";
}
__name(safeOrigin, "safeOrigin");
__name2(safeOrigin, "safeOrigin");
function originFromState(state) {
  const bar = String(state || "").indexOf("|");
  if (bar < 0) return "https://lifeos.ceogps.com";
  try {
    return safeOrigin(decodeURIComponent(state.slice(bar + 1)));
  } catch {
    return "https://lifeos.ceogps.com";
  }
}
__name(originFromState, "originFromState");
__name2(originFromState, "originFromState");
function issueState(origin) {
  return `${crypto.randomUUID()}|${encodeURIComponent(safeOrigin(origin))}`;
}
__name(issueState, "issueState");
__name2(issueState, "issueState");
async function nylasClientId(env) {
  if (env.NYLAS_CLIENT_ID) return env.NYLAS_CLIENT_ID;
  if (!env.NYLAS_API_KEY) return "";
  const listed = await fetch("https://api.us.nylas.com/v3/grants?limit=1", {
    headers: { Authorization: `Bearer ${env.NYLAS_API_KEY}`, Accept: "application/json" }
  });
  if (!listed.ok) return "";
  const body = await listed.json().catch(() => ({}));
  return body?.data?.[0]?.application_id || "";
}
__name(nylasClientId, "nylasClientId");
__name2(nylasClientId, "nylasClientId");
async function sessionUserId(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return "";
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return "";
  const user = await response.json();
  return user && typeof user.id === "string" ? user.id : "";
}
__name(sessionUserId, "sessionUserId");
__name2(sessionUserId, "sessionUserId");
function serviceHeaders(env, extra) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra || {}
  };
}
__name(serviceHeaders, "serviceHeaders");
__name2(serviceHeaders, "serviceHeaders");
async function putState(env, state, record) {
  if (!env.LIFEOS_KV || !state) return false;
  await env.LIFEOS_KV.put(`oauth:state:${state}`, JSON.stringify(record), { expirationTtl: 600 });
  return true;
}
__name(putState, "putState");
__name2(putState, "putState");
async function storePending(env, row) {
  const saved = await putState(env, row.oauth_state, {
    user_id: row.user_id,
    provider: row.oauth_provider,
    email: row.email || "",
    id: "",
    at: Date.now()
  });
  if (!saved) return null;
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/integrations_credentials`, {
    method: "POST",
    headers: serviceHeaders(env, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  });
  if (!response.ok) return { id: "", user_id: row.user_id, email: row.email || "", oauth_provider: row.oauth_provider };
  const rows = await response.json();
  const pending = Array.isArray(rows) ? rows[0] : null;
  if (pending?.id) {
    await putState(env, row.oauth_state, {
      user_id: row.user_id,
      provider: row.oauth_provider,
      email: row.email || "",
      id: pending.id,
      at: Date.now()
    });
  }
  return pending || { id: "", user_id: row.user_id, email: row.email || "", oauth_provider: row.oauth_provider };
}
__name(storePending, "storePending");
__name2(storePending, "storePending");
async function claimState(env, state, provider) {
  if (!state || !env.LIFEOS_KV) return null;
  const key = `oauth:state:${state}`;
  const raw = await env.LIFEOS_KV.get(key);
  if (!raw) return null;
  await env.LIFEOS_KV.delete(key);
  let row;
  try {
    row = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!row?.user_id || !row.provider) return null;
  if (provider && row.provider !== provider) return null;
  if (!row.at || Date.now() - row.at > 10 * 60 * 1e3) return null;
  return { id: row.id || "", user_id: row.user_id, email: row.email || "", oauth_provider: row.provider };
}
__name(claimState, "claimState");
__name2(claimState, "claimState");
var router = t();
router.get("/status", async (request, env) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const userId = await sessionUserId(request, env);
  const accountEmail = url.searchParams.get("account_email");
  if (!userId) {
    return Response.json({ error: "Sign in required" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  try {
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
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status}`);
    }
    const credentials = await response.json();
    const connected = [];
    const accounts = [];
    const statuses = {};
    for (const cred of credentials) {
      const key = cred.oauth_provider || cred.integration_name;
      const isConnected = cred.status === "on" && !!cred.oauth_access_token;
      if (isConnected) {
        connected.push(key);
        accounts.push({ provider: key, email: cred.email || "" });
        if (!statuses[key] || !statuses[key].connected) {
          statuses[key] = {
            connected: true,
            email: cred.email,
            lastSynced: cred.updated_at
          };
        }
      } else if (!statuses[key]) {
        statuses[key] = { connected: false };
      }
    }
    return Response.json({
      connected,
      statuses,
      accounts
    }, { headers: corsHeaders() });
  } catch (e) {
    console.error("[oauth/status] error:", e);
    return Response.json({
      error: "Failed to check OAuth status",
      connected: [],
      statuses: {}
    }, { headers: corsHeaders() });
  }
});
async function startOauth(request, env) {
  if (request.method !== "POST") {
    return Response.json({ error: "POST required" }, { status: 405, headers: corsHeaders() });
  }
  const posted = request.method === "POST" ? await request.json().catch(() => ({})) : null;
  const url = new URL(request.url);
  const provider = String(posted ? posted.provider : url.searchParams.get("provider") || "");
  const accountEmail = String(posted?.account_email || "").trim().toLowerCase();
  const userId = await sessionUserId(request, env);
  if (!userId) {
    return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders() });
  }
  if (!accountEmail) {
    return Response.json({ error: "Use the mailbox you clicked." }, { status: 400, headers: corsHeaders() });
  }
  if (accountEmail.endsWith("@icloud.com")) {
    return Response.json({ error: "iCloud connects through Nylas, not OAuth." }, { status: 400, headers: corsHeaders() });
  }
  if (provider === "google" && accountEmail !== "chris@ceogps.com" && accountEmail !== "chrisgr33ninc@gmail.com") {
    return Response.json({ error: "Use the mailbox you clicked." }, { status: 400, headers: corsHeaders() });
  }
  if (!OAUTH_PROVIDERS.has(provider)) {
    return Response.json({ error: "Unsupported provider" }, { status: 400, headers: corsHeaders() });
  }
  if (provider === "google" && !env.GOOGLE_CLIENT_ID) {
    return Response.json({ error: "GOOGLE_CLIENT_ID is not configured" }, { status: 500, headers: corsHeaders() });
  }
  const callbackUri = oauthCallback(env);
  const state = issueState(posted ? posted.origin : url.searchParams.get("origin"));
  const oauthUrls = {
    google: "https://accounts.google.com/o/oauth2/v2/auth",
    microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    github: "https://github.com/login/oauth/authorize",
    slack: "https://slack.com/oauth/v2/authorize",
    facebook: "https://www.facebook.com/v18.0/dialog/oauth",
    instagram: "https://api.instagram.com/oauth/authorize",
    twitter: "https://twitter.com/i/oauth2/authorize",
    linkedin: "https://www.linkedin.com/oauth/v2/authorization",
    spotify: "https://accounts.spotify.com/authorize",
    discord: "https://discord.com/api/oauth2/authorize",
    notion: "https://api.notion.com/v1/oauth/authorize"
  };
  const params = new URLSearchParams({
    client_id: provider === "google" ? env.GOOGLE_CLIENT_ID : env[`${provider.toUpperCase()}_CLIENT_ID`] || "",
    redirect_uri: callbackUri,
    response_type: "code",
    scope: getScopes(provider),
    state
  });
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
    if (accountEmail) params.set("login_hint", accountEmail);
  }
  const pending = await storePending(env, {
    user_id: userId,
    integration_name: provider,
    email: accountEmail,
    label: accountEmail,
    oauth_provider: provider,
    status: "pending",
    oauth_state: state,
    oauth_redirect_uri: callbackUri,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!pending) {
    return Response.json({ error: "Could not store OAuth state" }, { status: 500, headers: corsHeaders() });
  }
  const next = `${oauthUrls[provider]}?${params.toString()}`;
  if (request.method === "POST") return Response.json({ url: next }, { headers: corsHeaders() });
  return Response.redirect(next, 302);
}
__name(startOauth, "startOauth");
__name2(startOauth, "startOauth");
router.get("/start", startOauth);
router.post("/start", startOauth);
router.get("/callback", async (request, env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");
  const hinted = url.searchParams.get("provider") || "";
  const origin = originFromState(state);
  if (error) {
    return Response.redirect(`${origin}/panel/integrations?oauth_error=${encodeURIComponent(error)}`, 302);
  }
  if (!code || !state.includes("|")) {
    return Response.json({ error: "Missing code or state" }, { status: 400, headers: corsHeaders() });
  }
  try {
    const pending = await claimState(env, state, hinted);
    if (!pending) throw new Error("Invalid or expired OAuth state");
    const actualProvider = pending.oauth_provider;
    const tokenResponse = await exchangeCodeForToken(actualProvider, code, oauthCallback(env), env);
    if (!tokenResponse.access_token) throw new Error("Failed to obtain access token");
    const updateData = {
      oauth_access_token: tokenResponse.access_token,
      oauth_refresh_token: tokenResponse.refresh_token || null,
      oauth_expires_at: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1e3).toISOString() : null,
      oauth_scope: tokenResponse.scope || getScopes(actualProvider),
      status: "on",
      oauth_state: null,
      email: pending.email,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (tokenResponse.id_token) updateData.oauth_id_token = tokenResponse.id_token;
    const target = pending.id ? `${env.SUPABASE_URL}/rest/v1/integrations_credentials?id=eq.${encodeURIComponent(pending.id)}` : `${env.SUPABASE_URL}/rest/v1/integrations_credentials`;
    await fetch(target, {
      method: pending.id ? "PATCH" : "POST",
      headers: serviceHeaders(env, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify(pending.id ? updateData : {
        ...updateData,
        user_id: pending.user_id,
        integration_name: actualProvider,
        label: pending.email,
        oauth_provider: actualProvider
      })
    });
    return Response.redirect(`${origin}/panel/integrations?connected=${encodeURIComponent(actualProvider)}`, 302);
  } catch (e) {
    console.error("[oauth/callback] error:", e instanceof Error ? e.message : "OAuth failed");
    return Response.redirect(`${origin}/panel/integrations?oauth_error=${encodeURIComponent(e instanceof Error ? e.message : "OAuth failed")}`, 302);
  }
});
router.post("/disconnect", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { provider, account_email } = body;
  const userId = await sessionUserId(request, env);
  if (!userId) return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders() });
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
    const deleteUrl = `${supabaseUrl}/rest/v1/integrations_credentials?user_id=eq.${encodeURIComponent(userId)}&oauth_provider=eq.${encodeURIComponent(provider)}&email=eq.${encodeURIComponent(account_email)}`;
    await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
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
router.post("/token", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { code, provider, state } = body;
  const userId = await sessionUserId(request, env);
  if (!userId) return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders() });
  if (!code || !provider || !state) {
    return Response.json({ error: "Missing code, provider, or state" }, { status: 400, headers: corsHeaders() });
  }
  try {
    const pending = await claimState(env, state, provider);
    if (!pending || pending.user_id !== userId) {
      return Response.json({ error: "Invalid or expired OAuth state" }, { status: 400, headers: corsHeaders() });
    }
    const tokenResponse = await exchangeCodeForToken(provider, code, oauthCallback(env), env);
    await fetch(`${env.SUPABASE_URL}/rest/v1/integrations_credentials?id=eq.${encodeURIComponent(pending.id)}`, {
      method: "PATCH",
      headers: serviceHeaders(env, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({
        status: "on",
        oauth_access_token: tokenResponse.access_token,
        oauth_refresh_token: tokenResponse.refresh_token || null,
        oauth_state: null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      })
    });
    return Response.json({ ok: true, provider, email: pending.email || "" }, { headers: corsHeaders() });
  } catch (e) {
    console.error("[oauth/token] error:", e instanceof Error ? e.message : "Token exchange failed");
    return Response.json({ error: "Token exchange failed" }, { status: 500, headers: corsHeaders() });
  }
});
router.post("/token/save", async (request, env) => {
  const userId = await sessionUserId(request, env);
  if (!userId) return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders() });
  return Response.json({ error: "Tokens are saved by the callback" }, { status: 405, headers: corsHeaders() });
});
async function exchangeCodeForToken(provider, code, redirectUri, env) {
  const tokenUrls = {
    google: "https://oauth2.googleapis.com/token",
    microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    github: "https://github.com/login/oauth/access_token",
    slack: "https://slack.com/api/oauth.v2.access",
    facebook: "https://graph.facebook.com/v18.0/oauth/access_token",
    instagram: "https://api.instagram.com/oauth/access_token",
    twitter: "https://api.twitter.com/2/oauth2/token",
    linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
    spotify: "https://accounts.spotify.com/api/token",
    discord: "https://discord.com/api/oauth2/token",
    notion: "https://api.notion.com/v1/oauth/token"
  };
  const tokenUrl = tokenUrls[provider];
  if (!tokenUrl) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID || "" : env[`${provider.toUpperCase()}_CLIENT_ID`] || "";
  const clientSecret = provider === "google" ? env.GOOGLE_CLIENT_SECRET || "" : env[`${provider.toUpperCase()}_CLIENT_SECRET`] || "";
  if (!clientId || !clientSecret) {
    throw new Error(`Missing ${provider} client credentials`);
  }
  const params = new URLSearchParams();
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);
  params.set("code", code);
  params.set("redirect_uri", redirectUri);
  params.set("grant_type", "authorization_code");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    body: params.toString()
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  if (data.access_token) {
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_in: data.expires_in || 3600,
      token_type: data.token_type || "Bearer",
      scope: data.scope || getScopes(provider),
      id_token: data.id_token || null
    };
  }
  if (provider === "slack" && data.access_token) {
    return {
      access_token: data.access_token,
      refresh_token: null,
      expires_in: 3600,
      token_type: "Bearer",
      scope: data.scope || getScopes(provider)
    };
  }
  throw new Error("Invalid token response from provider");
}
__name(exchangeCodeForToken, "exchangeCodeForToken");
__name2(exchangeCodeForToken, "exchangeCodeForToken");
function getScopes(provider) {
  const scopes = {
    google: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly",
    microsoft: "User.Read Mail.ReadWrite Calendars.Read",
    github: "repo user:email",
    slack: "chat:write channels:read",
    facebook: "email public_profile pages_manage_posts",
    instagram: "instagram_content_publish",
    twitter: "tweet.read tweet.write users.read",
    linkedin: "r_liteprofile w_member_social",
    spotify: "user-read-private user-read-email playlist-read-private",
    discord: "identify email guilds",
    notion: "read"
  };
  return scopes[provider] || "openid email profile";
}
__name(getScopes, "getScopes");
__name2(getScopes, "getScopes");
var router2 = t();
router2.post("/invoke", async (request, env) => {
  try {
    const body = await request.json();
    const { prompt, systemPrompt, model = "auto", messages } = body;
    if (!prompt && !messages) {
      return Response.json({ error: "Missing prompt or messages" }, {
        status: 400,
        headers: corsHeaders()
      });
    }
    const responseText = typeof prompt === "string" ? `Mock response to: ${prompt.slice(0, 100)}...` : "Mock response to messages";
    return Response.json({
      text: responseText,
      model_used: model,
      usage: { prompt_tokens: 100, completion_tokens: 50 }
    }, { headers: corsHeaders() });
  } catch (e) {
    return Response.json({ error: "Invalid request" }, {
      status: 400,
      headers: corsHeaders()
    });
  }
});
router2.get("/preference", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  return Response.json({
    preferred: "auto"
  }, { headers: corsHeaders() });
});
router2.post("/preference", async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const { model } = body;
  if (!model) {
    return Response.json({ error: "Missing model" }, {
      status: 400,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true, model }, { headers: corsHeaders() });
});
var router3 = t();
router3.get("/health", async (request, env) => {
  const userId = await sessionUserId(request, env);
  if (!userId) return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders() });
  const wanted = new Set((new URL(request.url).searchParams.get("ids") || "").split(",").map((item) => item.trim()).filter(Boolean));
  let accounts = [];
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const listed = await fetch(`${env.SUPABASE_URL}/rest/v1/integrations_credentials?user_id=eq.${encodeURIComponent(userId)}&status=eq.on&select=oauth_provider,email,integration_name`, {
      headers: serviceHeaders(env)
    });
    if (listed.ok) accounts = await listed.json();
  }
  const providers = ["google", "discord", "facebook", "spotify", "nylas"];
  const integrations = providers.filter((provider) => !wanted.size || wanted.has(provider)).map((provider) => {
    const rows = (Array.isArray(accounts) ? accounts : []).filter((row) => (row.oauth_provider || row.integration_name) === provider);
    const emails = rows.map((row) => row.email || "").filter(Boolean);
    const clientSet = provider === "google" ? Boolean(env.GOOGLE_CLIENT_ID) : provider === "nylas" ? Boolean(env.NYLAS_API_KEY) : Boolean(env[`${provider.toUpperCase()}_CLIENT_ID`]);
    return {
      id: provider,
      kind: provider === "nylas" ? "both" : "oauth",
      status: emails.length ? "connected" : clientSet ? "not_configured" : "not_configured",
      reason: emails.length ? "Connected" : "Not connected",
      source: emails.length ? "worker-secret" : null,
      oauth: { provider, client_configured: clientSet, accounts: emails.length, expired: 0, emails }
    };
  });
  return Response.json({ integrations }, { headers: corsHeaders() });
});
router3.get("/credential", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({}, { headers: corsHeaders() });
});
router3.post("/credential", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const body = await request.json().catch(() => ({}));
  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});
router3.delete("/credential", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const integrationName = url.searchParams.get("integration_name");
  const label = url.searchParams.get("label");
  return Response.json({ success: true }, { headers: corsHeaders() });
});
var router4 = t();
router4.get("/events", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "200");
  const source = url.searchParams.get("source");
  const unread = url.searchParams.get("unread");
  return Response.json({
    events: [],
    total: 0,
    has_more: false
  }, { headers: corsHeaders() });
});
router4.post("/events/mark-all-read", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const body = await request.json().catch(() => ({}));
  return Response.json({ marked: 0 }, { headers: corsHeaders() });
});
router4.post("/events/:id/read", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
router4.post("/events/:id/dismiss", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
var router5 = t();
router5.get("/kv", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix");
  return Response.json({ keys: [] }, { headers: corsHeaders() });
});
router5.get("/kv/:key", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const key = request.params.key;
  return Response.json({ value: null }, { headers: corsHeaders() });
});
router5.post("/kv/:key", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const key = request.params.key;
  const body = await request.json().catch(() => ({}));
  const { value } = body;
  return Response.json({ success: true }, { headers: corsHeaders() });
});
router5.delete("/kv/:key", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const key = request.params.key;
  return Response.json({ success: true }, { headers: corsHeaders() });
});
var router6 = t();
router6.get("/status", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ locked: true, initialized: false }, { headers: corsHeaders() });
});
router6.post("/init", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
router6.post("/unlock", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
router6.post("/lock", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
router6.post("/change-password", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
router6.get("/items", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ items: [] }, { headers: corsHeaders() });
});
router6.post("/export", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ data: "{}" }, { headers: corsHeaders() });
});
router6.post("/purge", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
var router7 = t();
router7.get("/accounts", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
router7.post("/send", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});
router7.get("/campaigns", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
var router8 = t();
router8.get("/summary", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    revenue: 0,
    customers: 0,
    subscriptions: 0,
    charges: []
  }, { headers: corsHeaders() });
});
var router9 = t();
router9.get("/user", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    login: "",
    name: "",
    repos: 0,
    followers: 0
  }, { headers: corsHeaders() });
});
var router10 = t();
router10.get("/workspace", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    name: "",
    channels: 0,
    members: 0
  }, { headers: corsHeaders() });
});
var router11 = t();
router11.get("/me", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    name: "",
    workspace: ""
  }, { headers: corsHeaders() });
});
var router12 = t();
router12.get("/events", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
var router13 = t();
router13.get("/me", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    display_name: "",
    followers: { total: 0 },
    images: []
  }, { headers: corsHeaders() });
});
var router14 = t();
router14.get("/channel", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    title: "",
    subscribers: 0,
    videos: 0
  }, { headers: corsHeaders() });
});
var router15 = t();
router15.get("/summary", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    zones: 0,
    workers: 0,
    requests: 0
  }, { headers: corsHeaders() });
});
var router16 = t();
router16.post("/connect", async (request, env) => {
  const userId = await sessionUserId(request, env);
  if (!userId) return Response.json({ error: "Sign in required" }, { status: 401, headers: corsHeaders() });
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email.endsWith("@icloud.com")) {
    return Response.json({ error: "Nylas connect is for iCloud mail." }, { status: 400, headers: corsHeaders() });
  }
  const apiKey = env.NYLAS_API_KEY || "";
  const clientId = await nylasClientId(env);
  if (!apiKey || !clientId) {
    return Response.json({ error: "NYLAS_API_KEY and NYLAS_CLIENT_ID are required" }, { status: 500, headers: corsHeaders() });
  }
  const state = issueState(body.origin);
  const pending = await storePending(env, {
    user_id: userId,
    integration_name: "nylas",
    email,
    label: email,
    oauth_provider: "nylas",
    status: "pending",
    oauth_state: state,
    oauth_redirect_uri: NYLAS_CALLBACK,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!pending) return Response.json({ error: "Could not store OAuth state" }, { status: 500, headers: corsHeaders() });
  const response = await fetch("https://api.us.nylas.com/v3/connect/auth", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      redirect_uri: NYLAS_CALLBACK,
      provider: "icloud",
      login_hint: email,
      state,
      access_type: "offline",
      response_type: "code"
    })
  });
  const data = await response.json().catch(() => ({}));
  const next = data?.data?.url || data?.url || "";
  if (!response.ok || !next) {
    return Response.json({ error: "Nylas did not start iCloud auth" }, { status: 502, headers: corsHeaders() });
  }
  return Response.json({ url: next }, { headers: corsHeaders() });
});
router16.get("/callback", async (request, env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error") || "";
  const origin = originFromState(state);
  if (error || !code) {
    return Response.redirect(`${origin}/panel/integrations?oauth_error=${encodeURIComponent(error || "Nylas did not return a code")}`, 302);
  }
  const pending = await claimState(env, state, "nylas");
  if (!pending) {
    return Response.redirect(`${origin}/panel/integrations?oauth_error=${encodeURIComponent("Invalid or expired OAuth state")}`, 302);
  }
  const apiKey = env.NYLAS_API_KEY || "";
  const clientId = await nylasClientId(env);
  const exchanged = await fetch("https://api.us.nylas.com/v3/connect/token", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: apiKey,
      grant_type: "authorization_code",
      code,
      redirect_uri: NYLAS_CALLBACK
    })
  });
  const token = await exchanged.json().catch(() => ({}));
  if (!exchanged.ok || !(token.grant_id || token.access_token)) {
    return Response.redirect(`${origin}/panel/integrations?oauth_error=${encodeURIComponent("Nylas token exchange failed")}`, 302);
  }
  await fetch(`${env.SUPABASE_URL}/rest/v1/integrations_credentials?id=eq.${encodeURIComponent(pending.id)}`, {
    method: "PATCH",
    headers: serviceHeaders(env, { "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({
      status: "on",
      email: token.email || pending.email,
      oauth_access_token: token.access_token || "",
      oauth_refresh_token: token.grant_id ? `grant:${token.grant_id}` : null,
      oauth_state: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    })
  });
  return Response.redirect(`${origin}/panel/integrations?connected=nylas`, 302);
});
var router17 = t();
router17.post("/post", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});
router17.post("/schedule", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});
var router18 = t();
router18.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
var router19 = t();
router19.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
router19.post("/run", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true, runId: crypto.randomUUID() }, { headers: corsHeaders() });
});
router19.get("/status", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ running: [] }, { headers: corsHeaders() });
});
var router20 = t();
router20.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "500");
  return Response.json([], { headers: corsHeaders() });
});
router20.post("/reorder", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ success: true }, { headers: corsHeaders() });
});
var router21 = t();
router21.get("/balances", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    netWorth: 0,
    assets: 0,
    liabilities: 0
  }, { headers: corsHeaders() });
});
router21.get("/market", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    stocks: [],
    crypto: []
  }, { headers: corsHeaders() });
});
router21.get("/news", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
var router22 = t();
router22.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
var router23 = t();
router23.get("/fetch", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ html: "", title: "" }, { headers: corsHeaders() });
});
router23.get("/search", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ results: [] }, { headers: corsHeaders() });
});
var router24 = t();
router24.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ results: [] }, { headers: corsHeaders() });
});
var router25 = t();
function json(data, status = 200, origin) {
  return Response.json(data, {
    status,
    headers: corsHeaders(origin || "*")
  });
}
__name(json, "json");
__name2(json, "json");
function extFromFile(file) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  if (fromName) return fromName.slice(0, 12);
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "mp4";
  if (mime === "application/pdf") return "pdf";
  return "bin";
}
__name(extFromFile, "extFromFile");
__name2(extFromFile, "extFromFile");
function userIdFromRequest(request) {
  const headerId = request.headers.get("X-User-Id");
  if (headerId && headerId.trim()) return headerId.trim().slice(0, 128);
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ") && auth.length > 20) {
    return `tok_${auth.slice(7, 23)}`;
  }
  return "anonymous";
}
__name(userIdFromRequest, "userIdFromRequest");
__name2(userIdFromRequest, "userIdFromRequest");
router25.post("/", async (request, env) => {
  const origin = request.headers.get("Origin");
  const userId = userIdFromRequest(request);
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Invalid multipart body" }, 400, origin);
  }
  const file = formData.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return json({ error: "No file provided" }, 400, origin);
  }
  if (!env.LIFEOS_STORAGE) {
    return json(
      { error: "LIFEOS_STORAGE R2 binding is not configured on this worker" },
      503,
      origin
    );
  }
  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || "files").replace(/[^a-z0-9_-]/gi, "") || "files";
  const id = crypto.randomUUID();
  const key = `${type}/${userId}/${id}.${extFromFile(file)}`;
  await env.LIFEOS_STORAGE.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
      contentDisposition: `inline; filename="${(file.name || "file").replace(/"/g, "")}"`
    },
    customMetadata: {
      originalName: file.name || "",
      uploadedBy: userId,
      type
    }
  });
  const publicUrl = new URL(request.url);
  publicUrl.pathname = `/api/upload/object/${key}`;
  publicUrl.search = "";
  return json(
    {
      url: publicUrl.toString(),
      file_url: publicUrl.toString(),
      id,
      key
    },
    200,
    origin
  );
});
router25.get("/object/*", async (request, env) => {
  const origin = request.headers.get("Origin");
  if (!env.LIFEOS_STORAGE) {
    return json({ error: "LIFEOS_STORAGE R2 binding is not configured" }, 503, origin);
  }
  const url = new URL(request.url);
  const marker = "/object/";
  const idx = url.pathname.indexOf(marker);
  const key = idx >= 0 ? decodeURIComponent(url.pathname.slice(idx + marker.length)) : "";
  if (!key || key.includes("..")) {
    return json({ error: "Missing object key" }, 400, origin);
  }
  const obj = await env.LIFEOS_STORAGE.get(key);
  if (!obj) {
    return json({ error: "Not found" }, 404, origin);
  }
  const headers = new Headers(corsHeaders(origin || "*"));
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  if (obj.httpMetadata?.contentDisposition) {
    headers.set("Content-Disposition", obj.httpMetadata.contentDisposition);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  return new Response(obj.body, { status: 200, headers });
});
router25.get("/", async (request, env) => {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  return json(
    {
      ok: true,
      storage: Boolean(env.LIFEOS_STORAGE),
      type: type || "files",
      usage: "POST multipart field `file` to /api/upload?type=<kind>"
    },
    200,
    origin
  );
});
var router26 = t();
router26.get("/feed", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "8");
  return Response.json({ data: [], paging: {} }, { headers: corsHeaders() });
});
router26.get("/status", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({ connected: false }, { headers: corsHeaders() });
});
router26.get("/instagram/feed", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "10");
  return Response.json({ data: [], paging: {} }, { headers: corsHeaders() });
});
var router27 = t();
router27.get("/timeline", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle");
  const max = parseInt(url.searchParams.get("max") || "10");
  return Response.json({ data: [], meta: {} }, { headers: corsHeaders() });
});
router27.get("/user", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle");
  return Response.json({
    username: handle,
    name: "",
    followers: 0,
    following: 0
  }, { headers: corsHeaders() });
});
var router28 = t();
router28.post("/generate", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    trackId: crypto.randomUUID(),
    status: "generating"
  }, { headers: corsHeaders() });
});
router28.get("/playlists", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
router28.post("/polish", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json({
    trackId: crypto.randomUUID(),
    status: "polishing"
  }, { headers: corsHeaders() });
});
var router29 = t();
router29.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});
var router30 = t();
router30.get("/", async (request, env) => {
  return Response.json({
    supabaseUrl: env.SUPABASE_URL || "https://mhvcdstgkyplhzjptgfr.supabase.co",
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || ""
  }, { headers: corsHeaders() });
});
var router31 = t();
function mount(prefix, sub) {
  return (request, env, ctx) => {
    const url = new URL(request.url);
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) return void 0;
    url.pathname = url.pathname.slice(prefix.length) || "/";
    return sub.fetch(new Request(url.toString(), request), env, ctx);
  };
}
__name(mount, "mount");
__name2(mount, "mount");
router31.get("/health", () => withCors(new Response(JSON.stringify({ status: "ok", service: "lifeos1-api" }), {
  headers: { "Content-Type": "application/json" }
})));
router31.get("/test", () => withCors(new Response(JSON.stringify({ message: "test works" }), {
  headers: { "Content-Type": "application/json" }
})));
router31.options("*", (request) => new Response(null, {
  headers: corsHeaders(request.headers.get("Origin") || "*")
}));
router31.all("/api/config*", mount("/api/config", router30));
router31.all("/api/oauth/*", mount("/api/oauth", router));
router31.all("/api/llm/*", mount("/api/llm", router2));
router31.all("/api/integrations/*", mount("/api/integrations", router3));
router31.all("/api/activity/*", mount("/api/activity", router4));
router31.all("/api/kv*", mount("/api", router5));
router31.all("/api/vault/*", mount("/api/vault", router6));
router31.all("/api/email/*", mount("/api/email", router7));
router31.all("/api/stripe/*", mount("/api/stripe", router8));
router31.all("/api/github/*", mount("/api/github", router9));
router31.all("/api/slack/*", mount("/api/slack", router10));
router31.all("/api/notion/*", mount("/api/notion", router11));
router31.all("/api/calendar/*", mount("/api/calendar", router12));
router31.all("/api/spotify/*", mount("/api/spotify", router13));
router31.all("/api/youtube/*", mount("/api/youtube", router14));
router31.all("/api/cloudflare/*", mount("/api/cloudflare", router15));
router31.all("/api/nylas/*", mount("/api/nylas", router16));
router31.all("/api/social/*", mount("/api/social", router17));
router31.all("/api/contacts/*", mount("/api/contacts", router18));
router31.all("/api/agents/*", mount("/api/agents", router19));
router31.all("/api/tasks*", mount("/api/tasks", router20));
router31.all("/api/finance/*", mount("/api/finance", router21));
router31.all("/api/projects/*", mount("/api/projects", router22));
router31.all("/api/browse*", mount("/api/browse", router23));
router31.all("/api/search*", mount("/api/search", router24));
router31.all("/api/upload*", mount("/api/upload", router25));
router31.all("/api/meta/*", mount("/api/meta", router26));
router31.all("/api/x/*", mount("/api/x", router27));
router31.all("/api/music/*", mount("/api/music", router28));
router31.all("/api/tags*", mount("/api/tags", router29));
router31.all("*", () => withCors(new Response(JSON.stringify({ error: "Not found" }), {
  status: 404,
  headers: { "Content-Type": "application/json" }
})));
var working_worker_default = {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || void 0;
    try {
      return await router31.fetch(request, env, ctx);
    } catch (err) {
      return withCors(new Response(JSON.stringify({ error: "Internal error", detail: String(err?.message || err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }
  }
};

// worker/index.ts
function allowedOrigins(env) {
  const raw = String(env.CORS_ORIGINS || "https://lifeos.ceogps.com,https://lifeos1.ceogps.com");
  return new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
}
__name(allowedOrigins, "allowedOrigins");
function returnOrigin(state, allowed) {
  const fallback = allowed.has("https://lifeos.ceogps.com") ? "https://lifeos.ceogps.com" : [...allowed][0] || "https://lifeos.ceogps.com";
  const bar = state.indexOf("|");
  if (bar < 0) return fallback;
  try {
    const origin = decodeURIComponent(state.slice(bar + 1));
    if (allowed.has(origin)) return origin;
  } catch {
  }
  return fallback;
}
__name(returnOrigin, "returnOrigin");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const allowed = allowedOrigins(env);
    const response = await working_worker_default.fetch(request, env, ctx);
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return cors(new Response(null, { status: 204 }), request, allowed);
    }
    if (url.pathname.startsWith("/api/oauth/callback")) {
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get("Location") || "";
      let next;
      try {
        next = new URL(location);
      } catch {
        return response;
      }
      const provider = next.searchParams.get("oauth_success") || "";
      const error = next.searchParams.get("oauth_error") || "";
      const dest = new URL("/panel/integrations", returnOrigin(url.searchParams.get("state") || next.searchParams.get("state") || "", allowed));
      if (error) dest.searchParams.set("oauth_error", error);
      else if (provider) dest.searchParams.set("connected", provider);
      const headers = new Headers(response.headers);
      headers.set("Location", dest.toString());
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname.startsWith("/api/")) return cors(response, request, allowed);
    return response;
  }
};
function cors(response, request, allowed) {
  const origin = request.headers.get("Origin") || "";
  if (!allowed.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
__name(cors, "cors");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
