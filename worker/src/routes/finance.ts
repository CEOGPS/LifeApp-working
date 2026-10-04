import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

// GET /api/finance/balances - Get finance balances
router.get("/balances", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json({ 
    netWorth: 0,
    assets: 0,
    liabilities: 0
  }, { headers: corsHeaders() });
});

// GET /api/finance/market - Get market data
router.get("/market", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json({ 
    stocks: [],
    crypto: []
  }, { headers: corsHeaders() });
});

// GET /api/finance/news - Get finance news
router.get("/news", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  return Response.json([], { headers: corsHeaders() });
});

export { router as financeRoutes };