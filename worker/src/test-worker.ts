import { Router } from "itty-router";
import { corsHeaders, handleCors } from "./utils/cors";

const router = Router();

// CORS preflight handler - must be first
router.all("*", handleCors);

// Health check (no auth)
router.get("/health", () => new Response(JSON.stringify({ status: "ok", service: "lifeos1-api-test" }), {
  headers: { "Content-Type": "application/json", ...corsHeaders() }
}));

// Test endpoint
router.get("/test", () => new Response(JSON.stringify({ message: "test works" }), {
  headers: { "Content-Type": "application/json", ...corsHeaders() }
}));

export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;