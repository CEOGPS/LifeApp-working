import worker from "../attachments/working-worker.js";

function allowedOrigins(env: WorkerEnv) {
  const raw = String(env.CORS_ORIGINS || "https://lifeos.ceogps.com,https://lifeos1.ceogps.com");
  return new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
}

type WorkerEnv = Record<string, unknown>;
type WorkerExport = {
  fetch: (request: Request, env: WorkerEnv, ctx: ExecutionContext) => Promise<Response> | Response;
};

function returnOrigin(state: string, allowed: Set<string>) {
  const fallback = allowed.has("https://lifeos.ceogps.com") ? "https://lifeos.ceogps.com" : [...allowed][0] || "https://lifeos.ceogps.com";
  const bar = state.indexOf("|");
  if (bar < 0) return fallback;
  try {
    const origin = decodeURIComponent(state.slice(bar + 1));
    if (allowed.has(origin)) return origin;
  } catch {
    /* keep the live site */
  }
  return fallback;
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const allowed = allowedOrigins(env);
    const response = await (worker as WorkerExport).fetch(request, env, ctx);
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return cors(new Response(null, { status: 204 }), request, allowed);
    }
    if (url.pathname.startsWith("/api/oauth/callback")) {
      if (response.status < 300 || response.status >= 400) return response;
      const location = response.headers.get("Location") || "";
      let next: URL;
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
  },
};

function cors(response: Response, request: Request, allowed: Set<string>) {
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
