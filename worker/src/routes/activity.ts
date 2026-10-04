import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// GET /api/activity/events - Get activity events
router.get("/events", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "200");
  const source = url.searchParams.get("source");
  const unread = url.searchParams.get("unread");

  // In production, fetch from Supabase/DB
  return Response.json({
    events: [],
    total: 0,
    has_more: false,
  }, { headers: corsHeaders() });
});

// POST /api/activity/events/mark-all-read - Mark all events as read
router.post("/events/mark-all-read", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  const body = await request.json().catch(() => ({}));
  
  // In production, update in Supabase/DB
  return Response.json({ marked: 0 }, { headers: corsHeaders() });
});

// POST /api/activity/events/:id/read - Mark single event as read
router.post("/events/:id/read", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  // In production, update in Supabase/DB
  return Response.json({ success: true }, { headers: corsHeaders() });
});

// POST /api/activity/events/:id/dismiss - Dismiss event
router.post("/events/:id/dismiss", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  // In production, update in Supabase/DB
  return Response.json({ success: true }, { headers: corsHeaders() });
});

export { router as activityRoutes };