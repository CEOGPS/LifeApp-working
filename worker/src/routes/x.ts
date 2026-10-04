// PATCH (api-key-wiring): real X (Twitter) API v2 via X_BEARER_TOKEN (or Chris's saved "twitter-x" key). Owner only.
// Shapes match src/pages/social/SocialPanel.tsx. Timeline reads need an X API tier that allows them;
// otherwise the upstream error is returned (no placeholder data).
import { Router } from "itty-router";
import { guardService, json, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();
const X = "https://api.twitter.com/2";
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

async function lookupUser(key: string, handle: string) {
  return upstream(
    `${X}/users/by/username/${handle}?user.fields=public_metrics,profile_image_url,name,verified`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
}

// GET /api/x/user?handle=
router.get("/user", async (request: Request, env: any) => {
  const g = await guardService(request, env, "twitter-x", "X");
  if (!g.ok) return g.response;
  const handle = (new URL(request.url).searchParams.get("handle") || "").replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return json(request, env, { error: "valid handle required" }, 400);
  const res = await lookupUser(g.key, handle);
  if (!res.ok || !res.data?.data) return json(request, env, { error: upstreamError("X", res) }, 502);
  const u = res.data.data;
  const m = u.public_metrics || {};
  return json(request, env, {
    id: u.id,
    handle: u.username,
    name: u.name || "",
    followers: Number(m.followers_count ?? 0),
    following: Number(m.following_count ?? 0),
    tweets: Number(m.tweet_count ?? 0),
    avatar: u.profile_image_url || "",
    key_source: g.source,
  });
});

// GET /api/x/timeline?handle=&max=
router.get("/timeline", async (request: Request, env: any) => {
  const g = await guardService(request, env, "twitter-x", "X");
  if (!g.ok) return g.response;
  const p = new URL(request.url).searchParams;
  const handle = (p.get("handle") || "").replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) return json(request, env, { error: "valid handle required" }, 400);
  const max = Math.min(100, Math.max(5, parseInt(p.get("max") || "10", 10) || 10));
  const u = await lookupUser(g.key, handle);
  if (!u.ok || !u.data?.data?.id) return json(request, env, { error: upstreamError("X", u) }, 502);
  const res = await upstream(
    `${X}/users/${u.data.data.id}/tweets?max_results=${max}&tweet.fields=created_at,public_metrics`,
    { headers: { Authorization: `Bearer ${g.key}` } },
  );
  if (!res.ok) return json(request, env, { error: upstreamError("X", res) }, 502);
  const tweets = (res.data?.data || []).map((t: any) => {
    const m = t.public_metrics || {};
    return {
      id: t.id,
      text: t.text || "",
      likes: Number(m.like_count ?? 0),
      replies: Number(m.reply_count ?? 0),
      retweets: Number(m.retweet_count ?? 0),
      impressions: Number(m.impression_count ?? 0),
      createdAt: t.created_at || "",
      url: `https://x.com/${u.data.data.username}/status/${t.id}`,
    };
  });
  return json(request, env, { tweets, key_source: g.source });
});

export { router as xRoutes };