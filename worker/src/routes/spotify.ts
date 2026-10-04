import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// GET /api/spotify/me - Get Spotify user
router.get("/me", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json({ 
    display_name: "", 
    followers: { total: 0 },
    images: []
  }, { headers: corsHeaders() });
});

export { router as spotifyRoutes };