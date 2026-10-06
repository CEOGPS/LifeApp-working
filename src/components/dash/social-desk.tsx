import { useEffect, useRef, useState } from "react";
import { newId, type Memory, type SocialAccount, type SocialPost } from "./memory";

type PlatformId = SocialAccount["id"];

const START: SocialAccount[] = [
  { id: "instagram", name: "Instagram", handle: "@yourhandle", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
  { id: "facebook", name: "Facebook", handle: "Your page", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
  { id: "x", name: "X", handle: "@yourhandle", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
  { id: "tiktok", name: "TikTok", handle: "@yourhandle", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
  { id: "linkedin", name: "LinkedIn", handle: "Chris Green", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
  { id: "youtube", name: "YouTube", handle: "@yourhandle", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
  { id: "reddit", name: "Reddit", handle: "u/yourhandle", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
  { id: "snapchat", name: "Snapchat", handle: "@yourhandle", bio: "", followers: 0, following: 0, likes: 0, comments: 0, views: 0, connected: false, history: [] },
];
const LIMITS: Record<PlatformId, number> = { instagram: 2200, facebook: 63206, x: 280, tiktok: 2200, linkedin: 3000, youtube: 5000, reddit: 40000, snapchat: 250 };
const TEMPLATES = [
  { label: "Launch", text: "Exciting news. We just launched [feature]. Here is what you need to know." },
  { label: "Tip", text: "Pro tip: [your insight]. Save this for later." },
  { label: "Announce", text: "Big announcement: [what is happening]." },
  { label: "Question", text: "Quick question: [question]?" },
  { label: "Results", text: "In the last 30 days we [result]. Here is how." },
];
const TAGS = ["#marketing", "#smallbusiness", "#entrepreneur", "#growth"];
const LINKS = [
  ["Meta Business Suite", "https://business.facebook.com"],
  ["Ads Manager", "https://adsmanager.facebook.com"],
  ["YouTube Studio", "https://studio.youtube.com"],
  ["X Analytics", "https://analytics.twitter.com"],
  ["TikTok Creator Center", "https://www.tiktok.com/creator-center"],
];
const GROUPS = [
  ["Facebook Groups", "https://facebook.com/groups"],
  ["LinkedIn Groups", "https://linkedin.com/groups"],
  ["Reddit", "https://reddit.com/subreddits"],
];
const KEY = "lifeos_social_v1";

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as { platforms?: SocialAccount[]; posts?: SocialPost[]; profiles?: Record<string, { bio?: string }> } | null;
    if (!raw?.platforms?.length) return { platforms: [] as SocialAccount[], posts: [] as SocialPost[], profiles: {} as Record<string, { bio?: string }> };
    return { platforms: raw.platforms, posts: raw.posts || [], profiles: raw.profiles || {} };
  } catch {
    return { platforms: [] as SocialAccount[], posts: [] as SocialPost[], profiles: {} as Record<string, { bio?: string }> };
  }
}

function seriesFrom(rows: SocialAccount[]) {
  return rows.filter((row) => row.followers || row.views).map((row) => ({ id: `soc-${row.id}`, label: row.name, points: row.history.length ? row.history : [row.followers] }));
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n || 0);
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="text-[10px] text-white/30">—</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((value, index) => `${(index / (points.length - 1)) * 64},${18 - ((value - min) / span) * 14}`).join(" ");
  return <svg width="64" height="20" aria-hidden><polyline points={d} fill="none" stroke="oklch(0.82 0.13 220)" strokeWidth="1.5" /></svg>;
}

export function SocialDesk({ data, update }: { data: Memory; update: (recipe: (prev: Memory) => Memory) => void }) {
  const accounts = data.socialAccounts.length ? data.socialAccounts : START;
  const posts = data.socialPosts;
  const [selected, setSelected] = useState<PlatformId>("facebook");
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<PlatformId[]>(["facebook"]);
  const [when, setWhen] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [subreddit, setSubreddit] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<PlatformId | "all">("all");
  const once = useRef(false);

  useEffect(() => {
    if (once.current || data.socialAccounts.length) return;
    once.current = true;
    const local = load();
    const moved = (local.platforms.length ? local.platforms : START).map((row) => {
      const base = START.find((item) => item.id === row.id) || START[0];
      return { ...base, ...row, name: base.name, bio: row.bio || local.profiles[row.id]?.bio || "" };
    });
    update((prev) => prev.socialAccounts.length ? prev : { ...prev, socialAccounts: moved, socialPosts: local.posts, social: seriesFrom(moved) });
  }, [data.socialAccounts.length, update]);

  function write(recipe: (prev: Memory) => { accounts: SocialAccount[]; posts?: SocialPost[] }) {
    update((prev) => {
      const next = recipe(prev);
      return { ...prev, socialAccounts: next.accounts, socialPosts: next.posts ?? prev.socialPosts, social: seriesFrom(next.accounts) };
    });
  }

  async function sync() {
    setNote("Syncing accounts…");
    const { readOauth } = await import("@/lib/lifeos/oauth");
    const facebook = readOauth().find((row) => row.provider === "facebook")?.token || "";
    const youtube = data.keys.find((row) => row.name === "YouTube")?.value || "";
    const youtubeHandle = accounts.find((row) => row.id === "youtube")?.handle || "";
    const reddit = accounts.find((row) => row.id === "reddit")?.handle || "";
    const { pullSocial } = await import("@/lib/lifeos/sync");
    const result = await pullSocial({ data: { facebook, youtube, youtubeHandle, reddit, x: data.keys.find((row) => row.name === "X")?.value || "", linkedin: data.keys.find((row) => row.name === "LinkedIn")?.value || "", tiktok: data.keys.find((row) => row.name === "TikTok")?.value || "" } });
    if (!result.rows.length) { setNote(result.note || "No account numbers came back."); return; }
    write((prev) => ({
      accounts: (prev.socialAccounts.length ? prev.socialAccounts : START).map((account) => {
        const live = result.rows.find((row) => row.id === account.id);
        if (!live) return account;
        const followers = live.followers || account.followers;
        return { ...account, handle: live.handle || account.handle, followers, following: live.following || account.following, likes: live.likes || account.likes, comments: live.comments || account.comments, views: live.views || account.views, connected: true, history: live.followers ? [...account.history, live.followers].slice(-12) : account.history };
      }),
    }));
    setNote(result.note || "Synced to the board.");
  }

  const platform = accounts.find((row) => row.id === selected) || accounts[0];
  const feed = posts.filter((row) => filter === "all" || row.platforms.includes(filter));
  const limit = Math.min(...chosen.map((id) => LIMITS[id]));

  async function onImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setNote("Choose an image."); return; }
    if (file.size > 8_000_000) { setNote("Image must be under 8 MB."); return; }
    setUploading(true);
    setNote("Uploading…");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("https://lifeos1-api.ceogps.workers.dev/api/upload?type=media", { method: "POST", body: form });
      const body = await response.json() as { url?: string; file_url?: string };
      const url = body.url || body.file_url || "";
      if (!response.ok || !/^https?:\/\//i.test(url)) { setNote("Upload did not return a link."); return; }
      setImage(url);
      setNote("Image ready.");
    } catch {
      setNote("Upload did not go through.");
    } finally {
      setUploading(false);
    }
  }

  async function post() {
    if (!text.trim() || !chosen.length) { setNote("Pick a platform and write the post."); return; }
    if (text.length > limit) { setNote(`Over the ${limit} character limit.`); return; }
    if (when) {
      const held: SocialPost = { id: newId(), text: text.trim(), platforms: chosen, at: new Date().toISOString(), scheduled: when, sent: "" };
      write((prev) => ({ accounts: prev.socialAccounts.length ? prev.socialAccounts : START, posts: [held, ...prev.socialPosts] }));
      setText("");
      setWhen("");
      setNote("Held on the board. Clear the time and post again to send it.");
      return;
    }
    setNote("Posting…");
    const { readOauth } = await import("@/lib/lifeos/oauth");
    const { publishSocial } = await import("@/lib/lifeos/sync");
    const result = await publishSocial({ data: {
      text: text.trim(),
      platforms: chosen,
      facebook: readOauth().find((row) => row.provider === "facebook")?.token || "",
      image,
      x: data.keys.find((row) => row.name === "X")?.value || "",
      linkedin: data.keys.find((row) => row.name === "LinkedIn")?.value || "",
      redditToken: data.keys.find((row) => row.name === "Reddit")?.value || "",
      subreddit,
      tiktok: data.keys.find((row) => row.name === "TikTok")?.value || "",
    } });
    const item: SocialPost = { id: newId(), text: text.trim(), platforms: chosen, at: new Date().toISOString(), scheduled: "", sent: result.sent.join(", ") };
    write((prev) => ({ accounts: prev.socialAccounts.length ? prev.socialAccounts : START, posts: [item, ...prev.socialPosts] }));
    setText("");
    setImage("");
    setNote(result.note);
  }

  function logMetric(key: "followers" | "following" | "likes" | "comments" | "views", value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    write((prev) => ({
      accounts: (prev.socialAccounts.length ? prev.socialAccounts : START).map((row) => row.id === selected ? { ...row, [key]: next, history: key === "followers" ? [...row.history, next].slice(-12) : row.history } : row),
    }));
  }

  function patch(change: Partial<SocialAccount>) {
    write((prev) => ({ accounts: (prev.socialAccounts.length ? prev.socialAccounts : START).map((row) => row.id === selected ? { ...row, ...change } : row) }));
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Social</h1>
          <p className="text-sm text-white/50">Feeds, composer, and analytics. Numbers stay on the board.</p>
        </div>
        <button type="button" className="bg-blue" onClick={() => void sync()}>Sync</button>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[15rem_1fr_18rem]">
        <aside className="module-card p-2">
          {accounts.map((row) => (
            <button key={row.id} type="button" className={`menu ${selected === row.id ? "is-on" : ""}`} onClick={() => setSelected(row.id)}>
              <span className="flex w-full items-center justify-between gap-2">
                <span>{row.name}<span className="block text-[10px] text-white/35">{row.connected ? "Synced" : row.handle}</span></span>
                <span className="text-right text-[11px]">{fmt(row.followers)}<Spark points={row.history} /></span>
              </span>
            </button>
          ))}
          <p className="mt-4 px-1 text-[10px] tracking-widest text-white/35">LINKS</p>
          {LINKS.map(([label, href]) => <a key={label} className="block truncate px-1 py-1 text-sm text-blue-2" href={href} target="_blank" rel="noreferrer">{label}</a>)}
          <p className="mt-3 px-1 text-[10px] tracking-widest text-white/35">GROUPS</p>
          {GROUPS.map(([label, href]) => <a key={label} className="block truncate px-1 py-1 text-sm text-blue-2" href={href} target="_blank" rel="noreferrer">{label}</a>)}
        </aside>
        <section className="grid gap-3">
          <div className="module-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg">{platform.name}</p>
                <p className="text-sm text-white/50">{platform.bio || platform.handle}</p>
              </div>
              <span className={platform.connected ? "text-green" : "text-white/40"}>{platform.connected ? "Synced" : "Not synced"}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(["followers", "following", "likes", "comments", "views"] as const).map((key) => (
                <label key={key} className="text-[10px] uppercase tracking-wider text-white/40">{key}
                  <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-2 text-sm normal-case" value={platform[key]} onChange={(event) => logMetric(key, event.target.value)} />
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={`quiet ${filter === "all" ? "is-on" : ""}`} onClick={() => setFilter("all")}>All</button>
            {accounts.map((row) => <button key={row.id} type="button" className={`quiet ${filter === row.id ? "is-on" : ""}`} onClick={() => setFilter(row.id)}>{row.name}</button>)}
          </div>
          <div className="module-card min-h-48 p-4">
            {!feed.length ? <p className="text-sm text-white/40">No posts on this board yet.</p> : null}
            {feed.map((row) => (
              <article key={row.id} className="border-b border-white/10 py-3">
                <p className="text-[11px] text-white/40">{row.platforms.join(", ")}{row.sent ? ` · sent ${row.sent}` : ""}{row.scheduled ? ` · scheduled ${row.scheduled}` : ""}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{row.text}</p>
              </article>
            ))}
          </div>
        </section>
        <aside className="module-card p-4">
          <p className="module-title">Composer</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {accounts.map((row) => <button key={row.id} type="button" className={`quiet ${chosen.includes(row.id) ? "is-on" : ""}`} onClick={() => setChosen((prev) => prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id])}>{row.name}</button>)}
          </div>
          <textarea className="mt-3 min-h-32 w-full rounded-2xl border border-line bg-black/40 px-3 py-2 text-sm" value={text} placeholder="Write the post" onChange={(event) => setText(event.target.value)} />
          <p className="mt-1 text-[11px] text-white/40">{text.length}/{limit || 0}</p>
          <div className="mt-2 flex flex-wrap gap-3">{TEMPLATES.map((row) => <button key={row.label} type="button" className="quiet" onClick={() => setText(row.text)}>{row.label}</button>)}</div>
          <div className="mt-2 flex flex-wrap gap-3">{TAGS.map((tag) => <button key={tag} type="button" className="quiet" onClick={() => setText((value) => `${value}${value.endsWith(" ") || !value ? "" : " "}${tag} `)}>{tag}</button>)}</div>
          <div className="mt-3 flex items-center gap-3">
            <label className="quiet">
              {uploading ? "Uploading" : "Upload"}
              <input className="hidden" type="file" accept="image/*" onChange={(event) => { void onImage(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            {image ? <img src={image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : null}
          </div>
          <input className="mt-2 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Image URL for Instagram or TikTok" value={image} onChange={(event) => setImage(event.target.value)} />
          <input className="mt-2 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" placeholder="Subreddit, no r/" value={subreddit} onChange={(event) => setSubreddit(event.target.value)} />
          <input className="mt-2 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
          <div className="mt-3 flex items-center gap-4">
            <button type="button" className="bg-blue" onClick={post}>Post</button>
            <button type="button" className="link-add" onClick={() => {
              setNote("Writing…");
              void import("@/lib/lifeos/sync").then(({ askNyx }) => askNyx({ data: { question: `Write a short social post. ${text || "CEO GPS update"}. No invented numbers.`, facts: "" } })).then((result) => { if (result.text) setText(result.text); setNote(result.text ? "" : "No draft came back."); });
            }}>Write</button>
          </div>
          <label className="mt-4 block text-[11px] text-white/40">Handle
            <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={platform.handle} onChange={(event) => patch({ handle: event.target.value })} />
          </label>
          <label className="mt-2 block text-[11px] text-white/40">Bio
            <input className="mt-1 h-8 w-full rounded-full border border-line bg-black/40 px-3 text-sm" value={platform.bio} onChange={(event) => patch({ bio: event.target.value })} />
          </label>
          {note ? <p className="mt-3 text-sm text-white/50">{note}</p> : null}
        </aside>
      </div>
    </div>
  );
}
