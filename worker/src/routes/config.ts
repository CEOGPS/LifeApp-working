import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// GET /api/config - Get public configuration for frontend
router.get("/", async (request, env) => {
  return Response.json({
    supabaseUrl: env.SUPABASE_URL || "https://mhvcdstgkyplhzjptgfr.supabase.co",
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || "",
  }, { headers: corsHeaders() });
});

export { router as configRoutes };