// PATCH (api-key-wiring): real Facebook Page + Instagram data via META_PAGE_ACCESS_TOKEN (+ META_PAGE_ID /
// META_IG_USER_ID when set), or Chris's saved "facebook" key. Owner only. Shapes match SocialPanel.tsx.
import { Router } from "itty-router";
import { requireUser } from "./ai";
import { envValue, guardService, json, serviceKey, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();
const G = "https://graph.facebook.com/v21.0";

function limitOf(request: Request, dflt: number): number {
  return Math.min(50, Math.max(1, parseInt(new URL(request.url).searchParams.get("limit") || String(dflt), 10) || dflt));
}
function pageRef(env: any): string {
  const id = envValue(env, ["META_PAGE_ID"]);
  return /^\d{5,30}$/.test(id) ? id : "me"; // a Page access token's "me" is the Page
}
const gget = (path: string, token: string) =>
  upstream(`${G}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`);

async function igUserId(env: any, token: string): Promise<string> {
  const id = envValue(env, ["META_IG_USER_ID"]);
  if (/^\d{5,30}$/.test(id)) return id;
  const r = await gget(`${pageRef(env)}?fields=instagram_business_account`, token);
  return r.ok ? String(r.data?.instagram_business_account?.id || "") : "";
}

// GET /api/meta/status - { connected, page, instagram }
router.get("/status", async (request: Request, env: any) => {
  const auth = await requireUser(request, env);
  if (!auth.ok) return json(request, env, { connected: false, error: auth.error }, auth.status);
  const k = serviceKey(request, env, "facebook");
  if (!k) return json(request, env, { connected: false, configured: false, error: "Set worker secret META_PAGE_ACCESS_TOKEN or unlock your saved facebook key" });
  const r = await gget(
    `${pageRef(env)}?fields=id,name,fan_count,followers_count,instagram_business_account{id,username,followers_count,media_count}`,
    k.key,
  );
  if (!r.ok) return json(request, env, { connected: false, error: upstreamError("Meta", r) }, 502);
  const d = r.data || {};
  const ig = d.instagram_business_account;
  return json(request, env, {
    connected: true,
    page: { id: d.id, name: d.name || "", followers: Number(d.followers_count ?? d.fan_count ?? 0) },
    ...(ig ? { instagram: { id: ig.id, username: ig.username || "", followers: Number(ig.followers_count ?? 0), posts: Number(ig.media_count ?? 0) } } : {}),
    key_source: k.source,
  });
});

// GET /api/meta/feed?limit= - Page posts
router.get("/feed", async (request: Request, env: any) => {
  const g = await guardService(request, env, "facebook", "Meta");
  if (!g.ok) return g.response;
  const r = await gget(
    `${pageRef(env)}/posts?fields=id,message,created_time,permalink_url,likes.summary(true).limit(0),comments.summary(true).limit(0)&limit=${limitOf(request, 8)}`,
    g.key,
  );
  if (!r.ok) return json(request, env, { error: upstreamError("Meta", r) }, 502);
  return json(request, env, { data: r.data?.data || [], key_source: g.source });
});

// GET /api/meta/instagram/feed?limit= - Instagram business media
router.get("/instagram/feed", async (request: Request, env: any) => {
  const g = await guardService(request, env, "facebook", "Meta");
  if (!g.ok) return g.response;
  const ig = await igUserId(env, g.key);
  if (!ig) return json(request, env, { error: "No Instagram business account linked to the Page (or set META_IG_USER_ID)" }, 404);
  const r = await gget(
    `${ig}/media?fields=id,caption,like_count,comments_count,media_url,thumbnail_url,permalink,timestamp&limit=${limitOf(request, 10)}`,
    g.key,
  );
  if (!r.ok) return json(request, env, { error: upstreamError("Instagram", r) }, 502);
  return json(request, env, { data: r.data?.data || [], key_source: g.source });
});

export { router as metaRoutes };