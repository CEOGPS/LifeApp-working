// PATCH (api-key-wiring): real Cloudflare summary via CLOUDFLARE_API_TOKEN / VITE_CLOUDFLARE_API_TOKEN worker secret
// (or Chris's saved "cloudflare" key). Owner only.
import { Router } from "itty-router";
import { envValue, guardService, json, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();
const CF = "https://api.cloudflare.com/client/v4";

// GET /api/cloudflare/summary - zones + Workers scripts for the account
router.get("/summary", async (request: Request, env: any) => {
  const g = await guardService(request, env, "cloudflare", "Cloudflare");
  if (!g.ok) return g.response;
  const get = (path: string) => upstream(`${CF}${path}`, { headers: { Authorization: `Bearer ${g.key}` } });
  const zones = await get("/zones?per_page=50");
  if (!zones.ok) return json(request, env, { error: upstreamError("Cloudflare", zones) }, 502);
  const notes: string[] = [];
  let accountId = envValue(env, ["CLOUDFLARE_ACCOUNT_ID", "VITE_CLOUDFLARE_ACCOUNT_ID"]);
  let accountName = "";
  if (!accountId) {
    const acc = await get("/accounts?per_page=5");
    accountId = acc.ok ? acc.data?.result?.[0]?.id || "" : "";
    accountName = acc.ok ? acc.data?.result?.[0]?.name || "" : "";
    if (!accountId) notes.push("account: not visible to this token");
  }
  let workers: number | null = null;
  let worker_scripts: Array<{ id: string; modified_on?: string }> = [];
  if (accountId) {
    const w = await get(`/accounts/${accountId}/workers/scripts`);
    if (w.ok) {
      const rows = w.data?.result || [];
      workers = rows.length;
      worker_scripts = rows.slice(0, 50).map((s: any) => ({
        id: s.id || s.name || "",
        modified_on: s.modified_on || s.created_on || undefined,
      })).filter((s: any) => s.id);
    } else notes.push(upstreamError("workers", w));
  }
  return json(request, env, {
    zones: Number(zones.data?.result_info?.total_count ?? (zones.data?.result || []).length),
    zone_names: (zones.data?.result || []).slice(0, 20).map((z: any) => z.name),
    workers,
    worker_scripts,
    ...(accountName ? { account: accountName } : {}),
    ...(notes.length ? { notes } : {}),
    key_source: g.source,
  });
});

export { router as cloudflareRoutes };