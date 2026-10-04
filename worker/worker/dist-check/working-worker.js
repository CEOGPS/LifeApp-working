var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/itty-router/index.mjs
var t = /* @__PURE__ */ __name(({ base: e = "", routes: t2 = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: /* @__PURE__ */ __name((o3, r2, a, s) => (o4, ...n) => t2.push([r2.toUpperCase?.(), RegExp(`^${(s = (e + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>[^]+))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), n, s]) && a, "get") }), routes: t2, ...o2, async fetch(e2, ...r2) {
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
var o = /* @__PURE__ */ __name((e = "text/plain; charset=utf-8", t2) => (o2, r2 = {}) => {
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

// src/utils/cors.ts
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id",
    "Access-Control-Allow-Credentials": "true"
  };
}
__name(corsHeaders, "corsHeaders");
function withCors(response, origin) {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(origin);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withCors, "withCors");

// src/routes/oauth.ts
var router = t();
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
    const statuses = {};
    for (const cred of credentials) {
      const key = cred.oauth_provider || cred.integration_name;
      const isConnected = cred.status === "on" && !!cred.oauth_access_token;
      if (isConnected) {
        connected.push(key);
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
      statuses
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
router.get("/start", async (request, env) => {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  const accountEmail = url.searchParams.get("account_email");
  const userId = url.searchParams.get("user_id");
  const state = url.searchParams.get("state");
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!provider || !userId) {
    return Response.json({ error: "Missing provider or user_id" }, {
      status: 400,
      headers: corsHeaders()
    });
  }
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
    notion: "https://api.notion.com/v1/oauth/authorize"
  };
  const authUrl = oauthUrls[provider] || `https://${provider}.com/oauth/authorize`;
  const callbackUri = redirectUri || `${new URL(request.url).origin}/api/oauth/callback`;
  const params = new URLSearchParams({
    client_id: env[`${provider.toUpperCase()}_CLIENT_ID`] || "",
    redirect_uri: callbackUri,
    response_type: "code",
    scope: getScopes(provider),
    state: state || crypto.randomUUID(),
    access_type: "offline",
    prompt: "consent"
  });
  if (accountEmail && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      await fetch(`${env.SUPABASE_URL}/rest/v1/integrations_credentials`, {
        method: "POST",
        headers: {
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          user_id: userId,
          integration_name: provider,
          email: accountEmail,
          label: accountEmail,
          oauth_provider: provider,
          status: "pending",
          oauth_state: state,
          oauth_redirect_uri: callbackUri
        })
      });
    } catch (e) {
      console.warn("[oauth/start] Failed to store pending state:", e);
    }
  }
  return Response.redirect(`${authUrl}?${params.toString()}`, 302);
});
router.get("/callback", async (request, env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const provider = url.searchParams.get("provider");
  if (error) {
    return Response.redirect(`${new URL(request.url).origin}/integrations?oauth_error=${encodeURIComponent(error)}`, 302);
  }
  if (!code || !state) {
    return Response.json({ error: "Missing code or state" }, {
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
    const pendingResponse = await fetch(
      `${supabaseUrl}/rest/v1/integrations_credentials?oauth_state=eq.${encodeURIComponent(state)}&status=eq.pending&select=*`,
      {
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        }
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
    const redirectUri = pendingCred.oauth_redirect_uri || `${new URL(request.url).origin}/api/oauth/callback`;
    const tokenResponse = await exchangeCodeForToken(actualProvider, code, redirectUri, env);
    if (!tokenResponse.access_token) {
      throw new Error("Failed to obtain access token");
    }
    const updateData = {
      oauth_access_token: tokenResponse.access_token,
      oauth_refresh_token: tokenResponse.refresh_token || null,
      oauth_expires_at: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1e3).toISOString() : null,
      oauth_scope: tokenResponse.scope || getScopes(actualProvider),
      status: "on",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (tokenResponse.id_token) {
      updateData.oauth_id_token = tokenResponse.id_token;
    }
    const updateUrl = `${supabaseUrl}/rest/v1/integrations_credentials?id=eq.${pendingCred.id}`;
    await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(updateData)
    });
    return Response.redirect(`${new URL(request.url).origin}/integrations?oauth_success=${actualProvider}`, 302);
  } catch (e) {
    console.error("[oauth/callback] error:", e);
    return Response.redirect(`${new URL(request.url).origin}/integrations?oauth_error=${encodeURIComponent(e instanceof Error ? e.message : "OAuth failed")}`, 302);
  }
});
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
    const deleteUrl = `${supabaseUrl}/rest/v1/integrations_credentials?oauth_provider=eq.${encodeURIComponent(provider)}&email=eq.${encodeURIComponent(account_email)}`;
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
  const { code, provider, redirect_uri } = body;
  if (!code || !provider) {
    return Response.json({ error: "Missing code or provider" }, {
      status: 400,
      headers: corsHeaders()
    });
  }
  try {
    const tokenResponse = await exchangeCodeForToken(provider, code, redirect_uri, env);
    return Response.json(tokenResponse, { headers: corsHeaders() });
  } catch (e) {
    console.error("[oauth/token] error:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Token exchange failed" }, {
      status: 500,
      headers: corsHeaders()
    });
  }
});
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
      email,
      label: label || email,
      oauth_provider,
      oauth_access_token,
      oauth_refresh_token,
      oauth_expires_at,
      oauth_scope,
      status: "on",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const upsertUrl = `${supabaseUrl}/rest/v1/integrations_credentials`;
    const response = await fetch(upsertUrl, {
      method: "POST",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify(upsertData)
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
    notion: "https://api.notion.com/v1/oauth/token"
  };
  const tokenUrl = tokenUrls[provider];
  if (!tokenUrl) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const clientId = env[`${provider.toUpperCase()}_CLIENT_ID`] || "";
  const clientSecret = env[`${provider.toUpperCase()}_CLIENT_SECRET`] || "";
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
    notion: "read"
  };
  return scopes[provider] || "openid email profile";
}
__name(getScopes, "getScopes");

// src/routes/llm.ts
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

// src/routes/integrations.ts
var router3 = t();
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

// src/routes/activity.ts
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

// src/routes/kv.ts
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

// src/routes/vault.ts
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

// src/routes/email.ts
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

// src/routes/stripe.ts
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

// src/routes/github.ts
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

// src/routes/slack.ts
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

// src/routes/notion.ts
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

// src/routes/calendar.ts
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

// src/routes/spotify.ts
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

// src/routes/youtube.ts
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

// src/routes/cloudflare.ts
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

// src/routes/nylas.ts
var router16 = t();
router16.get("/accounts", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }
  return Response.json([], { headers: corsHeaders() });
});

// src/routes/social.ts
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

// src/routes/contacts.ts
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

// src/routes/agents.ts
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

// src/routes/tasks.ts
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

// src/routes/finance.ts
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

// src/routes/projects.ts
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

// src/routes/browse.ts
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

// src/routes/search.ts
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

// src/routes/upload.ts
var router25 = t();
function json(data, status = 200, origin) {
  return Response.json(data, {
    status,
    headers: corsHeaders(origin || "*")
  });
}
__name(json, "json");
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

// src/routes/meta.ts
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

// src/routes/x.ts
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

// src/routes/music.ts
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

// src/routes/tags.ts
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

// src/routes/config.ts
var router30 = t();
router30.get("/", async (request, env) => {
  return Response.json({
    supabaseUrl: env.SUPABASE_URL || "https://mhvcdstgkyplhzjptgfr.supabase.co",
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || ""
  }, { headers: corsHeaders() });
});

// src/working-worker.ts
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
export {
  working_worker_default as default
};
//# sourceMappingURL=working-worker.js.map
