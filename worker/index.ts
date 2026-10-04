import { handleSignedUrl } from "./routes/signed-url.ts";

export interface Env {
  ENVIRONMENT: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OAUTH_STATE: OAuthStateNamespace;
}

interface OAuthStateNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expiration?: number; expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://zero.ceogps.com",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/health") {
      return json({ ok: true, env: env.ENVIRONMENT });
    }

    // OAuth start: /oauth/:provider/start
    const startMatch = url.pathname.match(/^\/oauth\/([a-z0-9_-]+)\/start$/);
    if (startMatch && request.method === "GET") {
      return handleOAuthStart(startMatch[1], url, env);
    }

    // OAuth callback: /oauth/:provider/callback
    const callbackMatch = url.pathname.match(/^\/oauth\/([a-z0-9_-]+)\/callback$/);
    if (callbackMatch && request.method === "GET") {
      return handleOAuthCallback(callbackMatch[1], url, env);
    }

    // Signed URLs for the `lifestor` bucket (was server.js): /api/storage/signed-url
    if (url.pathname === "/api/storage/signed-url") {
      return handleSignedUrl(request, env);
    }

    // Which providers are connected? Checks oauth_tokens via service-role
    // key server-side — the frontend can never read that table directly.
    if (url.pathname === "/api/integrations/status" && request.method === "GET") {
      return handleIntegrationsStatus(env);
    }

    // LLM router: /api/llm/invoke
    if (url.pathname === "/api/llm/invoke" && request.method === "POST") {
      return handleLLMInvoke(request, env);
    }

    return json({ error: "Not found" }, 404);
  },
};

async function handleLLMInvoke(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  // TODO: verify the Supabase JWT (authHeader token) against SUPABASE_URL,
  // then route to whichever model provider is configured (Workers AI,
  // OpenAI, Anthropic, etc.) using per-user keys from platform_tokens.
  return json({ error: "LLM routing not yet wired", providers_tried: [] }, 501);
}

async function handleOAuthStart(provider: string, url: URL, env: Env): Promise<Response> {
  // TODO: per-provider authorize URL construction (client_id/scope/redirect_uri),
  // store `state` in OAUTH_STATE KV keyed to the signed-in supabase user id.
  return json({ error: `OAuth start not yet wired for provider: ${provider}` }, 501);
}

async function handleOAuthCallback(provider: string, url: URL, env: Env): Promise<Response> {
  // TODO: exchange `code` for tokens, verify `state` against OAUTH_STATE KV,
  // upsert into Supabase `platform_tokens` table using the service-role key,
  // then redirect back to https://zero.ceogps.com/integrations?connected=<provider>
  return json({ error: `OAuth callback not yet wired for provider: ${provider}` }, 501);
}

async function handleIntegrationsStatus(env: Env): Promise<Response> {
  // TODO: query oauth_tokens with the service-role key:
  //   GET {SUPABASE_URL}/rest/v1/oauth_tokens?select=provider,expires_at
  //   headers: apikey/Authorization = SUPABASE_SERVICE_ROLE_KEY
  // then return { gmail: true, outlook: false, ... } — booleans only,
  // never the tokens themselves.
  return json({ error: "Integrations status not yet wired" }, 501);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
