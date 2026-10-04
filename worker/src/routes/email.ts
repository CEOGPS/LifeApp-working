import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// GET /api/email/accounts - Get email accounts
router.get("/accounts", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json([], { headers: corsHeaders() });
});

// POST /api/email/send - Send email
router.post("/send", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});

// GET /api/email/campaigns - Get email campaigns
router.get("/campaigns", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json([], { headers: corsHeaders() });
});

export { router as emailRoutes };