// worker/src/routes/browse.ts
// PATCH (api-key-wiring): /search is now a real web search via Exa (EXA_API_KEY worker secret, or
// Chris's saved "exa" key). Owner only. GET ?q=&limit= or POST { query, limit }.
// Returns { results: [{ title, url, snippet, publishedDate }] } (shape used by Community,
// Marketing lead-gen and Erebus tools). /fetch is unchanged.
import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";
import { guardService, json, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();

// GET /api/browse/fetch - Fetch URL (unchanged, not part of the key wiring)
router.get("/fetch", async (request, env) => {
  const userId = request.headers.get("X-User-Id");

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: corsHeaders()
    });
  }

  return Response.json({ html: "", title: "" }, { headers: corsHeaders() });
});

async function exaSearch(request: Request, env: any, query: string, limit: number) {
  const g = await guardService(request, env, "exa", "Web search (Exa)");
  if (!g.ok) return g.response;
  const q = query.trim().slice(0, 500);
  if (!q) return json(request, env, { error: "query required" }, 400);
  const res = await upstream(
    "https://api.exa.ai/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": g.key },
      body: JSON.stringify({ query: q, numResults: Math.min(25, Math.max(1, limit)), type: "auto", contents: { text: { maxCharacters: 400 } } }),
    },
    25000,
  );
  if (!res.ok) return json(request, env, { error: upstreamError("Exa", res) }, 502);
  const results = (res.data?.results || []).map((r: any) => ({
    title: r.title || r.url || "",
    url: r.url || "",
    snippet: String(r.text || r.summary || "").replace(/\s+/g, " ").trim().slice(0, 400),
    publishedDate: r.publishedDate || null,
  }));
  return json(request, env, { results, key_source: g.source });
}

router.get("/search", async (request: Request, env: any) => {
  const p = new URL(request.url).searchParams;
  return exaSearch(request, env, p.get("q") || p.get("query") || "", parseInt(p.get("limit") || "10", 10) || 10);
});

router.post("/search", async (request: Request, env: any) => {
  const body: any = await request.json().catch(() => null);
  return exaSearch(request, env, String(body?.query || body?.q || ""), parseInt(String(body?.limit ?? 10), 10) || 10);
});

export { router as browseRoutes };