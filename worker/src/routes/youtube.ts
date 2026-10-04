// PATCH (api-key-wiring): real YouTube Data API v3 via YOUTUBE_DATA_V3_API_KEY (or Chris's saved "youtube" key). Owner only.
//   GET /api/youtube/channel[?id=UC...|?handle=@name]  (default: YOUTUBE_CHANNEL_ID worker secret/var)
//   GET /api/youtube/search?q=...&max=10               (server-side search; key never reaches the browser)
import { Router } from "itty-router";
import { envValue, guardService, json, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();
const YT = "https://www.googleapis.com/youtube/v3";

router.get("/channel", async (request: Request, env: any) => {
  const g = await guardService(request, env, "youtube", "YouTube");
  if (!g.ok) return g.response;
  const p = new URL(request.url).searchParams;
  const id = (p.get("id") || "").trim() || envValue(env, ["YOUTUBE_CHANNEL_ID"]);
  const handle = (p.get("handle") || "").trim().replace(/^@?/, "@");
  let sel = "";
  if (id && /^[A-Za-z0-9_-]{10,40}$/.test(id)) sel = `id=${encodeURIComponent(id)}`;
  else if (handle.length > 1 && /^@[A-Za-z0-9._-]{1,60}$/.test(handle)) sel = `forHandle=${encodeURIComponent(handle)}`;
  if (!sel) return json(request, env, { error: "No channel: pass ?id= or ?handle=, or set YOUTUBE_CHANNEL_ID on the worker" }, 400);
  const res = await upstream(`${YT}/channels?part=snippet,statistics&${sel}&key=${encodeURIComponent(g.key)}`, { headers: { Referer: "https://lifeos1.pages.dev/" } }); // PATCH: key is referer-restricted
  if (!res.ok) return json(request, env, { error: upstreamError("YouTube", res) }, 502);
  const c = res.data?.items?.[0];
  if (!c) return json(request, env, { error: "YouTube channel not found" }, 404);
  const s = c.statistics || {};
  return json(request, env, {
    id: c.id,
    title: c.snippet?.title || "",
    subscribers: s.hiddenSubscriberCount ? null : Number(s.subscriberCount ?? 0),
    videos: Number(s.videoCount ?? 0),
    views: Number(s.viewCount ?? 0),
    thumbnail: c.snippet?.thumbnails?.default?.url || "",
    key_source: g.source,
  });
});

router.get("/search", async (request: Request, env: any) => {
  const g = await guardService(request, env, "youtube", "YouTube");
  if (!g.ok) return g.response;
  const p = new URL(request.url).searchParams;
  const q = (p.get("q") || "").trim().slice(0, 200);
  if (!q) return json(request, env, { error: "q required" }, 400);
  const max = Math.min(25, Math.max(1, parseInt(p.get("max") || "10", 10) || 10));
  const res = await upstream(
    `${YT}/search?part=snippet&type=video&maxResults=${max}&q=${encodeURIComponent(q)}&key=${encodeURIComponent(g.key)}`,
    { headers: { Referer: "https://lifeos1.pages.dev/" } },
  );
  if (!res.ok) return json(request, env, { error: upstreamError("YouTube", res) }, 502);
  const results = (res.data?.items || [])
    .filter((it: any) => it?.id?.videoId)
    .map((it: any) => ({
      id: it.id.videoId,
      title: it.snippet?.title || "",
      channel: it.snippet?.channelTitle || "",
      thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || "",
      publishedAt: it.snippet?.publishedAt || "",
    }));
  return json(request, env, { results, key_source: g.source });
});

export { router as youtubeRoutes };