import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// GET /api/projects - Get projects
router.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json([], { headers: corsHeaders() });
});

export { router as projectsRoutes };