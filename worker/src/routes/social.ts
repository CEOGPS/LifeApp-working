import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// POST /api/social/post - Post to social media
router.post("/post", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});

// POST /api/social/schedule - Schedule social media post
router.post("/schedule", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});

export { router as socialRoutes };