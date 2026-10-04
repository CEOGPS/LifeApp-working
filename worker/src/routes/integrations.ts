import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";
import { requireUser } from "./ai";
import { json } from "../utils/serviceKeys";
import { CHECKS, integrationHealth, runKeyCheck } from "../utils/integrationChecks"; // PATCH (api-key-wiring)

const router = Router();

// GET /api/integrations/credential - Get integration credentials
router.get("/credential", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  // In production, fetch from Supabase/DB
  return Response.json({}, { headers: corsHeaders() });
});

// POST /api/integrations/credential - Save integration credential
router.post("/credential", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  const body = await request.json().catch(() => ({}));
  
  // In production, save to Supabase/DB
  return Response.json({ success: true, id: crypto.randomUUID() }, { headers: corsHeaders() });
});

// DELETE /api/integrations/credential - Delete integration credential
router.delete("/credential", async (request, env) => {
  const userId = request.headers.get("X-User-Id");
  
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { 
      status: 401, 
      headers: corsHeaders() 
    });
  }

  const url = new URL(request.url);
  const integrationName = url.searchParams.get("integration_name");
  const label = url.searchParams.get("label");

  // In production, delete from Supabase/DB
  return Response.json({ success: true }, { headers: corsHeaders() });
});

// ---------------------------------------------------------------------------
// PATCH (api-key-wiring): real per-integration health + validate-before-save.
//   GET  /api/integrations/health[?ids=a,b&force=1] -> { ok, integrations: HealthResult[] }
//   POST /api/integrations/validate { service, key } -> HealthResult (key is tested, never stored/echoed)
// Owner only (Supabase session of the LifeOS owner). For LOCAL wrangler dev only, a random
// LOCAL_HEALTH_TOKEN in worker/.dev.vars may be sent as X-LifeOS-Local-Token instead; that
// variable is never set in production, so the bypass does not exist there.

async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function allowed(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const local = typeof env.LOCAL_HEALTH_TOKEN === "string" ? env.LOCAL_HEALTH_TOKEN.trim() : "";
  const sent = request.headers.get("X-LifeOS-Local-Token") || "";
  if (local.length >= 24 && sent && (await sha(sent)) === (await sha(local))) return { ok: true };
  const auth = await requireUser(request, env);
  return auth.ok ? { ok: true } : { ok: false, status: auth.status, error: auth.error };
}

router.get("/health", async (request: Request, env: any) => {
  const a = await allowed(request, env);
  if (!a.ok) return json(request, env, { ok: false, error: a.error }, a.status);
  const p = new URL(request.url).searchParams;
  const ids = (p.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 80);
  const results = await integrationHealth(env, ids, p.get("force") === "1");
  const summary: Record<string, number> = {};
  for (const r of results) summary[r.status] = (summary[r.status] || 0) + 1;
  return json(request, env, { ok: true, summary, integrations: results });
});

router.post("/validate", async (request: Request, env: any) => {
  const a = await allowed(request, env);
  if (!a.ok) return json(request, env, { ok: false, error: a.error }, a.status);
  const body: any = await request.json().catch(() => null);
  const service = String(body?.service || "").trim().toLowerCase();
  const key = String(body?.key || "").trim();
  const check = CHECKS.find((c) => c.id === service);
  if (!check) return json(request, env, { ok: false, error: `No live check for "${service}"` }, 404);
  if (!key || key.length > 4096 || /[\r\n]/.test(key)) return json(request, env, { ok: false, error: "key required" }, 400);
  const res = await runKeyCheck(check, env, key, "saved-key");
  return json(request, env, { ok: res.status === "connected", ...res });
});

export { router as integrationsRoutes };