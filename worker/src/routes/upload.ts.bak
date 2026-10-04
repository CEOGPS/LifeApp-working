import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// POST /api/upload - Upload file
router.post("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  
  if (!file) {
    return Response.json({ error: "No file provided" }, { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  // In production, upload to R2/S3
  return Response.json({ 
    url: `https://uploads.lifeos1.com/${file.name}`,
    id: crypto.randomUUID()
  }, { headers: corsHeaders() });
});

// GET /api/upload - Handle type query param
router.get("/", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  return Response.json({ message: `Upload endpoint for ${type || "files"}` }, { headers: corsHeaders() });
});

export { router as uploadRoutes };