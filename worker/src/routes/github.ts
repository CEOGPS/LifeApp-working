// PATCH (api-key-wiring): real GitHub profile via GITHUB_PERSONAL_API_KEY (or Chris's saved "github" key). Owner only.
import { Router } from "itty-router";
import { guardService, json, upstream, upstreamError } from "../utils/serviceKeys";

const router = Router();

// GET /api/github/user - authenticated GitHub user
router.get("/user", async (request: Request, env: any) => {
  const g = await guardService(request, env, "github", "GitHub");
  if (!g.ok) return g.response;
  const res = await upstream("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${g.key}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "lifeos1-api",
    },
  });
  if (!res.ok) return json(request, env, { error: upstreamError("GitHub", res) }, 502);
  const u = res.data || {};
  const pub = Number(u.public_repos ?? 0);
  const priv = typeof u.total_private_repos === "number" ? u.total_private_repos : null;
  return json(request, env, {
    login: u.login || "",
    name: u.name || "",
    repos: pub + (priv ?? 0),
    public_repos: pub,
    private_repos: priv,
    followers: Number(u.followers ?? 0),
    avatar: u.avatar_url || "",
    url: u.html_url || "",
    key_source: g.source,
  });
});

export { router as githubRoutes };