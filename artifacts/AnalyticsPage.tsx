import { useCallback, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const WORKER =
  (import.meta as ImportMeta & { env?: { VITE_WORKER_URL?: string } }).env?.VITE_WORKER_URL ||
  "https://lifeos1-api.ceogps.workers.dev";

const SITE = "https://www.ceogps.com";

type ZoneSummary = {
  zones?: number;
  zone_names?: string[];
  workers?: number | null;
  account?: string;
  error?: string;
  notes?: string[];
};

type MetaStatus = {
  connected?: boolean;
  error?: string;
  page?: { name?: string; followers?: number };
  instagram?: { username?: string; followers?: number; posts?: number };
};

type FbPost = { id: string; message?: string; created_time?: string; likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } } };
type IgPost = { id: string; caption?: string; like_count?: number; comments_count?: number; timestamp?: string };

async function workerGet(path: string) {
  const headers: Record<string, string> = { "X-User-Id": "lifeos-local" };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* no session */
  }
  const response = await fetch(`${WORKER}${path}`, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.message || `Worker returned ${response.status}`);
  }
  return body;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-sky-500/25 bg-black p-4">
      <h2 className="mb-3 text-lg text-white">{title}</h2>
      {children}
    </section>
  );
}

export default function AnalyticsPage() {
  const [site, setSite] = useState<ZoneSummary | null>(null);
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [posts, setPosts] = useState<FbPost[]>([]);
  const [ig, setIg] = useState<IgPost[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const problems: string[] = [];
    try {
      setSite(await workerGet("/api/cloudflare/summary"));
    } catch (e) {
      setSite(null);
      problems.push(`Website: ${e instanceof Error ? e.message : "failed"}`);
    }
    try {
      setMeta(await workerGet("/api/meta/status"));
    } catch (e) {
      setMeta(null);
      problems.push(`Social: ${e instanceof Error ? e.message : "failed"}`);
    }
    try {
      const feed = await workerGet("/api/meta/feed?limit=8");
      setPosts(Array.isArray(feed.data) ? feed.data : []);
    } catch {
      setPosts([]);
    }
    try {
      const feed = await workerGet("/api/meta/instagram/feed?limit=8");
      setIg(Array.isArray(feed.data) ? feed.data : []);
    } catch {
      setIg([]);
    }
    setError(problems.join(" "));
    setLoading(false);
  }, []);

  return (
    <main className="min-h-full space-y-4 bg-black p-4 text-sky-50">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="text-sm text-sky-200/60">CEO GPS website and connected social accounts. This is not the home AI Insights card.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="rounded bg-sky-600 px-4 py-2 text-sm text-white disabled:opacity-50">
          {loading ? "Pulling…" : "Pull now"}
        </button>
      </header>

      {error && <p className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</p>}

      <Card title="Website">
        <p className="text-base text-white">{SITE}</p>
        {site ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <div>Zones <span className="text-white">{site.zones ?? 0}</span></div>
            <div>Workers <span className="text-white">{site.workers ?? "—"}</span></div>
            <div>Account <span className="text-white">{site.account || "—"}</span></div>
            <div className="sm:col-span-3 text-sky-100">
              {(site.zone_names || []).length ? site.zone_names?.join(", ") : "No zone names returned."}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-sky-200/60">Press Pull now. The site list comes from the Cloudflare account on the worker, not from AI Insights.</p>
        )}
      </Card>

      <Card title="Facebook and Instagram">
        {meta?.connected ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>Page <span className="text-white">{meta.page?.name || "—"}</span> · {meta.page?.followers ?? 0} followers</div>
            <div>Instagram <span className="text-white">{meta.instagram?.username ? `@${meta.instagram.username}` : "not linked"}</span> · {meta.instagram?.followers ?? 0} followers · {meta.instagram?.posts ?? 0} posts</div>
          </div>
        ) : (
          <p className="text-sm text-sky-200/60">{meta?.error || "Not pulled yet. Facebook and Instagram use the Meta page token already stored on the worker."}</p>
        )}
        <div className="mt-4 space-y-2 text-sm">
          {posts.map((post) => (
            <div key={post.id} className="rounded border border-sky-500/15 p-2">
              <div className="text-sky-100">{post.message || "Facebook post"}</div>
              <div className="text-xs text-sky-200/50">{post.likes?.summary?.total_count ?? 0} likes · {post.comments?.summary?.total_count ?? 0} comments</div>
            </div>
          ))}
          {ig.map((post) => (
            <div key={post.id} className="rounded border border-sky-500/15 p-2">
              <div className="text-sky-100">{post.caption || "Instagram post"}</div>
              <div className="text-xs text-sky-200/50">{post.like_count ?? 0} likes · {post.comments_count ?? 0} comments</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Other social accounts">
        <p className="text-sm text-sky-200/70">X, TikTok, YouTube, and LinkedIn do not have a pull route on the worker yet, so this page will not invent their numbers. Facebook and Instagram are the accounts it can pull today.</p>
      </Card>
    </main>
  );
}
