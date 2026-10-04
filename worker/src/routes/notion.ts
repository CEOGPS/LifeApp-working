// PATCH (api-key-wiring): real Notion integration identity via NOTION_API_KEY (or Chris's saved "notion" key). Owner only.
import { Router } from "itty-router";
import { guardService, json, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();

// GET /api/notion/me - the integration's bot user + workspace
router.get("/me", async (request: Request, env: any) => {
  const g = await guardService(request, env, "notion", "Notion");
  if (!g.ok) return g.response;
  const res = await upstream("https://api.notion.com/v1/users/me", {
    headers: { Authorization: `Bearer ${g.key}`, "Notion-Version": "2022-06-28" },
  });
  if (!res.ok) return json(request, env, { error: upstreamError("Notion", res) }, 502);
  const u = res.data || {};
  return json(request, env, {
    name: u.name || "",
    workspace: u.bot?.workspace_name || "",
    type: u.type || "",
    key_source: g.source,
  });
});

export { router as notionRoutes };