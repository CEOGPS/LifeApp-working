import { Router } from "itty-router";
import { corsHeaders, withCors } from "./utils/cors";
import { oauthRoutes } from "./routes/oauth";

const router = Router();

// Health check (no auth) - MUST BE FIRST
router.get("/health", () => withCors(new Response(JSON.stringify({ status: "ok", service: "lifeos1-api" }), {
  headers: { "Content-Type": "application/json" }
})));

// CORS OPTIONS handler
router.options("*", (request) => new Response(null, {
  headers: corsHeaders(request.headers.get("Origin") || "*")
}));

router.use("/api/oauth/*", oauthRoutes);

// 404 handler
router.all("*", () => withCors(new Response(JSON.stringify({ error: "Not found" }), {
  status: 404,
  headers: { "Content-Type": "application/json" }
})));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;