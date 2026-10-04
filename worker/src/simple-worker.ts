import { Router } from "itty-router";
import { corsHeaders, handleCors, withCors } from "./utils/cors";
import { oauthRoutes } from "./routes/oauth";

const router = Router();

// CORS preflight handler - must be first
router.all("*", handleCors);

// Health check (no auth)
router.get("/health", () => withCors(new Response(JSON.stringify({ status: "ok", service: "lifeos1-api" }), {
  headers: { "Content-Type": "application/json" }
})));

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