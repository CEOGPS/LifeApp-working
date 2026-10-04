// PATCH (api-key-wiring): real Slack workspace info via SLACK_BOT_TOKEN / SLACK_OAUTH_TOKEN (or Chris's saved "slack" key). Owner only.
import { Router } from "itty-router";
import { guardService, json, upstream } from "../utils/serviceKeys";

const router = Router();

// GET /api/slack/workspace - workspace name + public channel / member counts
router.get("/workspace", async (request: Request, env: any) => {
  const g = await guardService(request, env, "slack", "Slack");
  if (!g.ok) return g.response;
  const call = (method: string, qs = "") =>
    upstream(`https://slack.com/api/${method}${qs}`, { headers: { Authorization: `Bearer ${g.key}` } });
  const auth = await call("auth.test");
  if (!auth.ok || !auth.data?.ok) {
    return json(request, env, { error: `Slack auth.test failed: ${auth.data?.error || `HTTP ${auth.status}`}` }, 502);
  }
  const [ch, us] = await Promise.all([
    call("conversations.list", "?types=public_channel&exclude_archived=true&limit=1000").catch(() => null),
    call("users.list", "?limit=1000").catch(() => null),
  ]);
  const notes: string[] = [];
  const channels = ch?.data?.ok ? (ch.data.channels || []).length : null;
  if (channels === null) notes.push(`channels: ${ch?.data?.error || "unavailable"}`);
  const members = us?.data?.ok
    ? (us.data.members || []).filter((m: any) => !m.deleted && !m.is_bot && m.id !== "USLACKBOT").length
    : null;
  if (members === null) notes.push(`members: ${us?.data?.error || "unavailable"}`);
  return json(request, env, {
    name: auth.data.team || "",
    team_id: auth.data.team_id || "",
    url: auth.data.url || "",
    channels,
    members,
    ...(notes.length ? { notes } : {}),
    key_source: g.source,
  });
});

export { router as slackRoutes };