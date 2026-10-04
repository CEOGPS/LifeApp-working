import { Router } from "itty-router";
import { corsHeaders, withCors } from "./utils/cors";

// Import route handlers
import { oauthRoutes } from "./routes/oauth";
import { llmRoutes } from "./routes/llm";
import { integrationsRoutes } from "./routes/integrations";
import { activityRoutes } from "./routes/activity";
import { kvRoutes } from "./routes/kv";
import { vaultRoutes } from "./routes/vault";
import { emailRoutes } from "./routes/email";
import { stripeRoutes } from "./routes/stripe";
import { githubRoutes } from "./routes/github";
import { slackRoutes } from "./routes/slack";
import { notionRoutes } from "./routes/notion";
import { calendarRoutes } from "./routes/calendar";
import { spotifyRoutes } from "./routes/spotify";
import { youtubeRoutes } from "./routes/youtube";
import { cloudflareRoutes } from "./routes/cloudflare";
import { nylasRoutes } from "./routes/nylas";
import { socialRoutes } from "./routes/social";
import { contactsRoutes } from "./routes/contacts";
import { agentsRoutes } from "./routes/agents";
import { tasksRoutes } from "./routes/tasks";
import { financeRoutes } from "./routes/finance";
import { projectsRoutes } from "./routes/projects";
import { browseRoutes } from "./routes/browse";
import { searchRoutes } from "./routes/search";
import { uploadRoutes } from "./routes/upload";
import { metaRoutes } from "./routes/meta";
import { xRoutes } from "./routes/x";
import { musicRoutes } from "./routes/music";
import { tagsRoutes } from "./routes/tags";
import { configRoutes } from "./routes/config";
import { aiRoutes, aiPreflight } from "./routes/ai"; // PATCH (worker-ai-route)
import { mapsRoutes } from "./routes/maps"; // PATCH (api-key-wiring)
import { keysStatus } from "./utils/serviceKeys"; // PATCH (api-key-wiring)

const router = Router();

// itty-router v5 has no `router.use()` for sub-routers (the Proxy turns it into
// a route for the HTTP method "USE", which never matches) and no `router.handle()`.
// Sub-routers define paths relative to their mount point (e.g. upload.ts uses
// "/" and "/object/*"), so strip the prefix and delegate to the sub-router's fetch.
type SubRouter = { fetch: (request: Request, ...args: any[]) => Promise<any> };
function mount(prefix: string, sub: SubRouter) {
  return (request: Request, env: any, ctx: any) => {
    const url = new URL(request.url);
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) return undefined;
    url.pathname = url.pathname.slice(prefix.length) || "/";
    return sub.fetch(new Request(url.toString(), request), env, ctx);
  };
}

// Health check (no auth) - MUST BE FIRST
router.get("/health", () => withCors(new Response(JSON.stringify({ status: "ok", service: "lifeos1-api" }), {
  headers: { "Content-Type": "application/json" }
})));

// Kept from the old src/index.ts entry point
router.get("/test", () => withCors(new Response(JSON.stringify({ message: "test works" }), {
  headers: { "Content-Type": "application/json" }
})));

// PATCH (worker-ai-route): AI routes answer preflight with their own origin allow-list
router.options("/api/ai/*", (request, env) => aiPreflight(request, env));
router.options("/api/llm/invoke", (request, env) => aiPreflight(request, env));

// PATCH (api-key-wiring): key-backed routes (worker secret, else Chris's forwarded saved key) answer
// preflight with the AI origin allow-list, which also allows the forwarded-key headers.
for (const p of ["/api/keys/*", "/api/github/*", "/api/slack/*", "/api/notion/*", "/api/stripe/*", "/api/cloudflare/*", "/api/youtube/*", "/api/x/*", "/api/meta/*", "/api/browse/*", "/api/maps/*", "/api/integrations/health", "/api/integrations/validate"]) {
  router.options(p, (request, env) => aiPreflight(request, env));
}

// CORS OPTIONS handler
router.options("*", (request) => new Response(null, {
  headers: corsHeaders(request.headers.get("Origin") || "*")
}));

// Public config (no auth)
router.all("/api/config*", mount("/api/config", configRoutes));

// Auth-required routes
router.all("/api/oauth/*", mount("/api/oauth", oauthRoutes));
router.all("/api/llm/*", mount("/api/llm", llmRoutes));
router.all("/api/ai/*", mount("/api/ai", aiRoutes)); // PATCH (worker-ai-route): Supabase auth + daily cap inside
router.get("/api/keys/status", (request, env) => keysStatus(request, env)); // PATCH (api-key-wiring): owner only, names/booleans only
router.all("/api/integrations/*", mount("/api/integrations", integrationsRoutes));
router.all("/api/activity/*", mount("/api/activity", activityRoutes));
router.all("/api/kv*", mount("/api", kvRoutes)); // kv.ts paths are "/kv", "/kv/:key"
router.all("/api/vault/*", mount("/api/vault", vaultRoutes));
router.all("/api/email/*", mount("/api/email", emailRoutes));
router.all("/api/stripe/*", mount("/api/stripe", stripeRoutes));
router.all("/api/github/*", mount("/api/github", githubRoutes));
router.all("/api/slack/*", mount("/api/slack", slackRoutes));
router.all("/api/notion/*", mount("/api/notion", notionRoutes));
router.all("/api/calendar/*", mount("/api/calendar", calendarRoutes));
router.all("/api/spotify/*", mount("/api/spotify", spotifyRoutes));
router.all("/api/youtube/*", mount("/api/youtube", youtubeRoutes));
router.all("/api/cloudflare/*", mount("/api/cloudflare", cloudflareRoutes));
router.all("/api/nylas/*", mount("/api/nylas", nylasRoutes));
router.all("/api/social/*", mount("/api/social", socialRoutes));
router.all("/api/contacts/*", mount("/api/contacts", contactsRoutes));
router.all("/api/agents/*", mount("/api/agents", agentsRoutes));
router.all("/api/tasks*", mount("/api/tasks", tasksRoutes));
router.all("/api/finance/*", mount("/api/finance", financeRoutes));
router.all("/api/projects/*", mount("/api/projects", projectsRoutes));
router.all("/api/browse*", mount("/api/browse", browseRoutes));
router.all("/api/search*", mount("/api/search", searchRoutes));
router.all("/api/upload*", mount("/api/upload", uploadRoutes));
router.all("/api/meta/*", mount("/api/meta", metaRoutes));
router.all("/api/x/*", mount("/api/x", xRoutes));
router.all("/api/music/*", mount("/api/music", musicRoutes));
router.all("/api/tags*", mount("/api/tags", tagsRoutes));
router.all("/api/maps/*", mount("/api/maps", mapsRoutes)); // PATCH (api-key-wiring): geocode + route

// 404 handler
router.all("*", () => withCors(new Response(JSON.stringify({ error: "Not found" }), {
  status: 404,
  headers: { "Content-Type": "application/json" }
})));

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const origin = request.headers.get("Origin") || undefined;
    try {
      return await router.fetch(request, env, ctx);
    } catch (err) {
      return withCors(new Response(JSON.stringify({ error: "Internal error", detail: String((err as Error)?.message || err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }), origin);
    }
  }
};
