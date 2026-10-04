import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// GET /api/tasks - Get tasks
router.get("/", async (request, env) => {
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

// POST /api/tasks/reorder - Reorder tasks
router.post("/reorder", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json({ success: true }, { headers: corsHeaders() });
});

export { router as tasksRoutes };