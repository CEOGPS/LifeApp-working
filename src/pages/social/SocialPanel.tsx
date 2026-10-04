// src/pages/social/SocialPanel.tsx
// LifeOS1 — Social Panel
// Live feeds, multi-platform composer, OAuth, analytics, media library.
// Consolidated from social_SocialPanel.jsx + SocialPanel.tsx.
// Uses canonical layer: @/lib/api for all Worker calls, @/lib/llm for AI.

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import {
  Share2, Download, Rss, Loader2, Check, AlertCircle, Sparkles, X,
} from "lucide-react";
import { api, lifeosApi } from "../../lib/api";
import { invokeLLM } from "../../lib/llm";

// No need for local invokeLLM helper, using centralized @/lib/invokeLLM

interface PanelLayoutProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Local fallback keeps this panel self-contained when the shared layout is unavailable. */
function PanelLayout({ title, subtitle, icon, actions, children }: PanelLayoutProps) {
  return (
    <section className="h-full min-h-0 flex flex-col bg-[#080910] text-white">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/8 shrink-0">
        {icon && <span className="text-teal-400">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold truncate">{title}</h1>
          {subtitle && <p className="text-[10px] text-white-40 truncate">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ CONFIG ░░
   ═══════════════════════════════════════════════════════════════════════════ */

const OAUTH_USER_ID = "chris-green";

const KV_IMAGES   = "social_saved_images";
const KV_POSTS    = "social_posts";
const KV_STATES   = "social_platform_states";
const KV_PROFILES = "social_profiles";
const KV_HISTORY  = "social_metrics_history";

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ TYPES ░░
   ═══════════════════════════════════════════════════════════════════════════ */

type PlatformId =
  | "instagram" | "facebook" | "x" | "tiktok"
  | "linkedin" | "reddit" | "snapchat" | "youtube";

interface Platform {
  id: PlatformId;
  brand: string;
  name: string;
  handle: string;
  color: string;
  followers: number;
  following: number;
  posts: number;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  connected: boolean;
  avatar?: string;
}

interface SocialPost {
  id: string;
  platform: PlatformId;
  text?: string;
  img?: string;
  time?: string;
  url?: string;
  permalink?: string;
  likes?: number;
  comments?: number;
  views?: number;
  shares?: number;
  real?: boolean;
  author?: string;
  avatar?: string;
  verified?: boolean;
}

interface LocalPost {
  id: number;
  text: string;
  platforms: PlatformId[];
  scheduled: string | null;
  media: string | null;
  status: "Posted" | "Scheduled";
  created: string;
  results?: Record<string, { error?: string; id?: string }>;
}

interface SavedImage {
  id: string;
  name: string;
  url: string;
  key?: string;
  uploadedAt: string;
}

interface ProfileOverride {
  name?: string;
  bio?: string;
  avatar?: string;
  banner?: string;
}

interface MetricsSnapshot {
  d: string;
  m: Record<string, { followers: number; following: number; likes: number; comments: number; views: number }>;
}

interface Toast { id: string; message: string; kind: "info" | "success" | "error" }

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ CONSTANTS ░░
   ═══════════════════════════════════════════════════════════════════════════ */

const INITIAL_PLATFORMS: Platform[] = [
  { id: "instagram", brand: "instagram", name: "Instagram", handle: "@yourhandle", color: "#e1306c", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
  { id: "facebook",  brand: "facebook",  name: "Facebook",  handle: "Your Handle", color: "#1877f2", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
  { id: "x",         brand: "x",         name: "X",         handle: "@yourhandle", color: "#1d9bf0", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
  { id: "tiktok",    brand: "tiktok",    name: "TikTok",    handle: "@yourhandle", color: "#ff2d55", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
  { id: "linkedin",  brand: "linkedin",  name: "LinkedIn",  handle: "Chris Green", color: "#0a66c2", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
  { id: "youtube",   brand: "youtube",   name: "YouTube",   handle: "Your Handle", color: "#ff0000", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
  { id: "reddit",    brand: "reddit",    name: "Reddit",    handle: "u/yourhandle", color: "#ff4500", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
  { id: "snapchat",  brand: "snapchat",  name: "Snapchat",  handle: "@yourhandle", color: "#fffc00", followers: 0, following: 0, posts: 0, likes: 0, comments: 0, views: 0, shares: 0, connected: false },
];

const CHAR_LIMITS: Record<PlatformId, number> = {
  instagram: 2200, facebook: 63206, linkedin: 3000, x: 280,
  tiktok: 2200, youtube: 5000, reddit: 40000, snapchat: 250,
};

const TEMPLATES = [
  { label: "🚀 Launch",   text: "🚀 Exciting news! We just launched [feature/product]. Here's what you need to know..." },
  { label: "💡 Pro Tip",  text: "💡 Pro tip: [Your insight here]. Save this for later! #ceogps #marketing" },
  { label: "📢 Announce", text: "📢 Big announcement! [What's happening] — drop a 🔥 if you're ready!" },
  { label: "🙏 Engage",   text: "🙏 Quick question for my community: [Question]? Let me know below 👇" },
  { label: "📈 Results",  text: "📈 Results don't lie. In the last 30 days we [achievement]. Here's how we did it..." },
];

const HASHTAG_SETS: Record<PlatformId, string[]> = {
  instagram: ["#yourbrand", "#entrepreneur", "#marketing", "#smallbusiness", "#digitalmarketing", "#growthhacking", "#leadgen", "#success"],
  facebook:  ["#yourbrand", "#marketing", "#business", "#smallbusiness", "#entrepreneur", "#sales"],
  linkedin:  ["#marketing", "#leadership", "#entrepreneur", "#business", "#sales", "#growthmindset", "#B2B"],
  x:         ["#marketing", "#entrepreneur", "#growthhacking", "#smallbusiness", "#AI"],
  tiktok:    ["#yourbrand", "#entrepreneur", "#marketing", "#fyp", "#smallbusiness", "#growthtips", "#businesstips"],
  youtube:   ["#entrepreneur", "#marketing", "#howto", "#tutorial", "#business"],
  reddit:    ["marketing", "entrepreneur", "digital marketing", "small business"],
  snapchat:  ["#yourbrand", "#entrepreneur", "#marketing", "#snaptips", "#fyp", "#businessgrowth"],
};

const QUICKLINKS: { brand: string; label: string; url: string }[] = [
  { brand: "facebook",  label: "FB Marketplace",       url: "https://facebook.com/marketplace" },
  { brand: "facebook",  label: "Meta Business Suite",  url: "https://business.facebook.com" },
  { brand: "facebook",  label: "FB Ads Manager",       url: "https://adsmanager.facebook.com" },
  { brand: "instagram", label: "IG Creator Studio",    url: "https://business.instagram.com" },
  { brand: "tiktok",    label: "TikTok Shop",          url: "https://shop.tiktok.com" },
  { brand: "tiktok",    label: "TikTok Creator Center", url: "https://www.tiktok.com/creator-center" },
  { brand: "linkedin",  label: "LinkedIn Campaign Mgr", url: "https://www.linkedin.com/campaignmanager" },
  { brand: "youtube",   label: "YouTube Studio",       url: "https://studio.youtube.com" },
  { brand: "youtube",   label: "YouTube Analytics",    url: "https://studio.youtube.com/channel/analytics" },
  { brand: "x",         label: "X Analytics",          url: "https://analytics.twitter.com" },
  { brand: "snapchat",  label: "Snap Creator Hub",     url: "https://forbusiness.snapchat.com/creator" },
];

const GROUP_LINKS: { brand: string; label: string; url: string }[] = [
  { brand: "facebook", label: "Facebook Groups",     url: "https://facebook.com/groups" },
  { brand: "linkedin", label: "LinkedIn Groups",     url: "https://linkedin.com/groups" },
  { brand: "reddit",   label: "Reddit Communities",  url: "https://reddit.com/subreddits" },
];

const METRIC_ROWS: (keyof Platform)[] = ["followers", "following", "likes", "comments", "views"];
const metricLabel = (m: string, pid: PlatformId): string =>
  m === "following" ? (pid === "facebook" ? "Friends" : "Following") : m[0].toUpperCase() + m.slice(1);

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ UTILS ░░
   ═══════════════════════════════════════════════════════════════════════════ */

const fmtN = (n: number): string =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" :
  n >= 1e3 ? (n / 1e3).toFixed(1) + "K" :
  String(n || 0);

const timeAgo = (d: string): string => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
};

function profileUrl(pid: PlatformId, handle: string): string {
  const h = (handle || "").replace(/^[@]|^u\//, "");
  switch (pid) {
    case "instagram": return `https://www.instagram.com/${h}`;
    case "x":         return `https://twitter.com/${h}`;
    case "tiktok":    return `https://www.tiktok.com/@${h}`;
    case "facebook":  return `https://www.facebook.com/${h}`;
    case "linkedin":  return `https://www.linkedin.com/in/${h}`;
    case "reddit":    return `https://www.reddit.com/user/${h}`;
    case "snapchat":  return `https://www.snapchat.com/add/${h}`;
    case "youtube":   return `https://www.youtube.com/@${h}`;
  }
}

// KV helpers — Worker is source of truth, no local cache.
async function kvLoad<T>(key: string, fallback: T): Promise<T> {
  try {
    const data = await lifeosApi<T>(`/api/kv/${encodeURIComponent(key)}`);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}
async function kvSave(key: string, value: unknown): Promise<void> {
  try {
    await lifeosApi(`/api/kv/${encodeURIComponent(key)}`, { method: "POST", body: JSON.stringify(value) });
  } catch (e) {
    console.warn(`[social] kvSave(${key}) failed:`, e);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ TOASTS ░░
   ═══════════════════════════════════════════════════════════════════════════ */

const toastListeners = new Set<(t: Toast) => void>();
let toastSeq = 0;
function toast(message: string, kind: Toast["kind"] = "info"): void {
  const t: Toast = { id: `t${++toastSeq}`, message, kind };
  toastListeners.forEach((l) => l(t));
}
function useToasts() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const push = (t: Toast) => {
      setItems((p) => [...p, t]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 4200);
    };
    toastListeners.add(push);
    return () => { toastListeners.delete(push); };
  }, []);
  const dismiss = useCallback((id: string) => setItems((p) => p.filter((x) => x.id !== id)), []);
  return { items, dismiss };
}

function Toasts() {
  const { items, dismiss } = useToasts();
  if (!items.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2 max-w-sm pointer-events-none">
      {items.map((t) => (
        <div key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg text-xs backdrop-blur-xl border
            ${t.kind === "success" ? "border-teal-400/40 text-teal-300 bg-black/85" :
              t.kind === "error" ? "border-red-400/50 text-red-300 bg-black/85" :
              "border-white/15 text-white-80 bg-black/85"}`}>
          {t.kind === "success" && <Check size={12} />}
          {t.kind === "error" && <AlertCircle size={12} />}
          {t.kind === "info" && <Sparkles size={12} />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100"><X size={10} /></button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ SPARKLINE ░░
   ═══════════════════════════════════════════════════════════════════════════ */

function Sparkline({ points, color, width = 58, height = 16 }: { points: number[]; color: string; width?: number; height?: number }) {
  if (!points || points.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2,3" />
      </svg>
    );
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pts = points.map((v, i) => `${(i / (points.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ SIDEBLOCK ░░
   ═══════════════════════════════════════════════════════════════════════════ */

function SideBlock({ title, icon, badge, defaultOpen = true, children }: {
  title: string; icon: string; badge?: string | number | null; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/5">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-transparent border-0 cursor-pointer text-white-55 hover:text-white-80 transition-colors">
        <span className="text-[11px]">{icon}</span>
        <span className="text-[9px] font-bold tracking-widest text-white-40 flex-1 text-left">{title}</span>
        {badge != null && (
          <span className="text-[9px] bg-teal-400/13 text-teal-400 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>
        )}
        <span className={`text-[8px] text-white-30 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ FEED CARD ░░
   ═══════════════════════════════════════════════════════════════════════════ */

function FeedCard({ post, platform, avatarOverride }: { post: SocialPost; platform: Platform; avatarOverride?: string }) {
  const isVideo = platform.id === "tiktok" || platform.id === "youtube";
  const [expanded, setExpanded] = useState(false);
  const displayName = post.author || platform.handle || platform.name;
  const initials = displayName.replace(/^@/, "").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const avatar = post.avatar || avatarOverride;
  const caption = post.text || "";
  const isLong = caption.length > 280;

  return (
    <article className="glass rounded-xl border border-white/8 overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <div className="relative shrink-0">
          {avatar ? (
            <img src={avatar} alt={displayName} className="w-9 h-9 rounded-full object-cover" style={{ border: `2px solid ${platform.color}44` }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: `linear-gradient(135deg,${platform.color}cc,${platform.color}55)`, border: `2px solid ${platform.color}44` }}>
              {initials}
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#0d0e17] flex items-center justify-center">
            <BrandIcon slug={platform.brand} size={10} color={platform.color} title={platform.name} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white-90 truncate">{displayName}</span>
            {post.verified && <span className="text-[9px]" style={{ color: platform.color }}>✓</span>}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white-40">
            <span>{platform.name}</span>
            <span>·</span>
            <span>{post.time ? (isNaN(new Date(post.time).getTime()) ? post.time : `${timeAgo(post.time)} ago`) : "just now"}</span>
          </div>
        </div>
        {post.real && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">● LIVE</span>}
        {(post.permalink || post.url) && (
          <a href={post.permalink || post.url} target="_blank" rel="noreferrer"
            className="text-[10px] text-white-40 no-underline px-2 py-0.5 rounded-full border border-white/12 bg-white/[0.03] whitespace-nowrap hover:text-white-80 transition-colors">
            Open ↗
          </a>
        )}
      </div>

      {caption && (
        <div className="px-3.5 pb-2.5">
          <div className="text-xs text-white-90 leading-relaxed">
            {isLong && !expanded ? caption.slice(0, 280) + "… " : caption}
            {isLong && (
              <button onClick={() => setExpanded((v) => !v)} className="bg-transparent border-0 cursor-pointer font-semibold text-[11px] p-0" style={{ color: platform.color }}>
                {expanded ? " less" : "more"}
              </button>
            )}
          </div>
        </div>
      )}

      {post.img && (
        <div className="relative">
          <img src={post.img} alt="" className="w-full block" style={{ maxHeight: isVideo ? 320 : 420, objectFit: "cover" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          {isVideo && (
            <a href={post.url || post.permalink || "#"} target="_blank" rel="noreferrer"
              className="absolute inset-0 flex items-center justify-center no-underline">
              <div className="w-12 h-12 rounded-full bg-black/65 backdrop-blur flex items-center justify-center text-white text-lg">▶</div>
            </a>
          )}
        </div>
      )}

      <div className="px-3.5 py-2 flex gap-4 items-center flex-wrap" style={{ borderTop: post.img ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
        <span className="text-[11px] text-pink-400">❤ {fmtN(post.likes ?? 0)}</span>
        <span className="text-[11px] text-teal-400">💬 {fmtN(post.comments ?? 0)}</span>
        {(post.views ?? 0) > 0 && <span className="text-[11px] text-purple-300">👁 {fmtN(post.views ?? 0)}</span>}
        {(post.shares ?? 0) > 0 && <span className="text-[11px] text-blue-400">↗ {fmtN(post.shares ?? 0)}</span>}
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ COMPOSER ░░
   ═══════════════════════════════════════════════════════════════════════════ */

function Composer({
  platforms, savedImages, onPost, onUploadImage,
}: {
  platforms: Platform[];
  savedImages: SavedImage[];
  onPost: (p: LocalPost) => void;
  onUploadImage: (f: File) => Promise<SavedImage | null>;
}) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<PlatformId[]>([]);
  const [scheduled, setScheduled] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<"generate" | "improve" | null>(null);
  const [error, setError] = useState("");
  const [showHashtags, setShowHashtags] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<Record<string, { error?: string; id?: string }> | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const overLimit = selected.some((id) => text.length > CHAR_LIMITS[id]);

  const suggestedTags = useMemo(() => {
    const pls = selected.length ? selected : (["instagram"] as PlatformId[]);
    const tags = new Set<string>();
    pls.forEach((id) => (HASHTAG_SETS[id] ?? []).forEach((t) => tags.add(t)));
    return [...tags].slice(0, 12);
  }, [selected]);

  const togglePlatform = (id: PlatformId) =>
    setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const addTag = (tag: string) => setText((t) => t + (t.endsWith(" ") || !t ? "" : " ") + tag + " ");

  const callAI = async (prompt: string, kind: "generate" | "improve") => {
    setAiLoading(kind);
    setError("");
    try {
      const res = await invokeLLM({ prompt });
      setText(res.text.trim());
    } catch (e) {
      setError(`AI failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setAiLoading(null);
  };

  const improveWithAI = () =>
    callAI(
      `Improve this social media caption${selected.length ? " for " + selected.map((id) => platforms.find((p) => p.id === id)?.name).filter(Boolean).join(" and ") : ""}. Make it punchy, engaging, include relevant emojis. Keep under ${selected.length === 1 ? CHAR_LIMITS[selected[0]] : 280} chars if possible. Return ONLY the improved caption:\n\n${text}`,
      "improve",
    );

  const generateCaption = () =>
    callAI(
      `Generate a high-engagement social media caption for a brand. Platforms: ${selected.join(", ") || "general"}. Include relevant hashtags. Return only the caption.`,
      "generate",
    );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const f of files) {
      const img = await onUploadImage(f);
      if (img) setMediaUrl(img.url);
    }
    e.target.value = "";
    setShowMedia(true);
  };

  const submit = async () => {
    if (!text.trim() || !selected.length) { setError("Add a caption and select at least one platform."); return; }
    if (overLimit) { setError("Caption exceeds a selected platform's limit."); return; }
    setError(""); setResults(null); setPosting(true);

    const payload: LocalPost = {
      id: Date.now(),
      text,
      platforms: selected,
      scheduled: scheduled || null,
      media: mediaUrl,
      status: scheduled ? "Scheduled" : "Posted",
      created: new Date().toLocaleString(),
    };

    try {
      if (scheduled) {
        await api.post("/api/social/schedule", {
          text,
          platforms: selected,
          image_url: mediaUrl,
          when: new Date(scheduled).toISOString(),
        });
        toast("Post scheduled.", "success");
      } else {
        const publishable = selected.filter((id) =>
          id === "facebook" || id === "instagram" || id === "linkedin"
        );
        if (publishable.length) {
          const r = await api.post<{ ok: boolean; results: Record<string, { error?: string; id?: string }> }>(
            "/api/social/post",
            { text, platforms: publishable, image_url: mediaUrl },
          );
          if (r?.results) {
            setResults(r.results);
            payload.results = r.results;
          }
        }
        toast("Post submitted.", "success");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`Publish failed: ${msg}`, "error");
    }

    onPost(payload);
    setText(""); setSelected([]); setScheduled(""); setMediaUrl(null);
    setPosting(false);
  };

  return (
    <div className="glass rounded-xl border border-white/8 p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-white-90">✍️ Create Post</span>
        <div className="flex gap-1.5">
          <button onClick={generateCaption} disabled={aiLoading !== null}
            className="px-2.5 py-0.5 rounded-full bg-teal-400/10 border border-teal-400/30 text-teal-400 text-[10px] cursor-pointer disabled:opacity-50 hover:bg-teal-400/20 transition-colors">
            {aiLoading === "generate" ? <Loader2 size={10} className="inline animate-spin" /> : "🤖"} Generate
          </button>
          <button onClick={improveWithAI} disabled={aiLoading !== null || !text.trim()}
            className="px-2.5 py-0.5 rounded-full bg-purple-400/15 border border-purple-400/40 text-purple-300 text-[10px] cursor-pointer disabled:opacity-40 hover:bg-purple-400/25 transition-colors">
            {aiLoading === "improve" ? <Loader2 size={10} className="inline animate-spin" /> : "✨"} Improve
          </button>
        </div>
      </div>

      {/* Platform selector */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setSelected(selected.length === platforms.length ? [] : platforms.map((p) => p.id))}
          className={`px-2.5 py-1 rounded-full text-[10px] cursor-pointer font-bold transition-colors border-[1.5px]
            ${selected.length === platforms.length ? "border-teal-400 bg-teal-400/15 text-teal-400" : "border-white/12 text-white-40 hover:border-teal-400/40"}`}>
          🌐 All
        </button>
        {platforms.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button key={p.id} onClick={() => togglePlatform(p.id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] cursor-pointer font-bold transition-colors border-[1.5px]"
              style={{
                borderColor: on ? p.color : "rgba(255,255,255,0.12)",
                background: on ? `${p.color}22` : "transparent",
                color: on ? p.color : "rgba(255,255,255,0.5)",
              }}>
              <BrandIcon slug={p.brand} size={11} color={on ? p.color : undefined} title={p.name} /> {p.name}
            </button>
          );
        })}
      </div>

      <textarea value={text} onChange={(e) => setText(e.target.value)}
        placeholder="What do you want to share? Or click Generate for AI inspiration…"
        className={`w-full px-3 py-2 rounded-lg bg-[#0d0e17] border text-xs text-white-90 placeholder:text-white-25 focus:outline-none resize-y min-h-[80px] leading-relaxed
          ${overLimit ? "border-red-400/60" : "border-white/12 focus:border-[#4ab3f4]/50"}`} />

      <div className="flex justify-between flex-wrap gap-1.5 items-center">
        <div className="flex gap-1.5 items-center">
          {TEMPLATES.map((t) => (
            <button key={t.label} onClick={() => setText(t.text)} title={t.text}
              className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-white-55 text-[10px] cursor-pointer hover:bg-white/8 hover:text-white-85 transition-colors">
              {t.label}
            </button>
          ))}
          <button onClick={() => setShowHashtags((v) => !v)} className="text-[10px] bg-transparent border-0 text-teal-400 cursor-pointer p-0">
            # tags {showHashtags ? "▲" : "▼"}
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {selected.map((id) => {
            const pl = platforms.find((p) => p.id === id);
            const lim = CHAR_LIMITS[id];
            return (
              <span key={id} className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: `${pl?.color ?? "#888"}22`, color: text.length > lim ? "#ff4f5e" : pl?.color }}>
                {pl?.name} {text.length}/{lim}
              </span>
            );
          })}
          {!selected.length && <span className="text-[9px] text-white-30">{text.length}/280</span>}
        </div>
      </div>

      {showHashtags && (
        <div className="flex gap-1 flex-wrap">
          {suggestedTags.map((t) => (
            <button key={t} onClick={() => addTag(t)}
              className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-teal-400 text-[10px] cursor-pointer hover:bg-white/8 transition-colors">
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Media + schedule + submit */}
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={() => fileRef.current?.click()}
          className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white-60 text-[11px] font-semibold cursor-pointer hover:bg-white/8 hover:text-white-85 transition-colors">
          🖼 Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleUpload} className="hidden" />
        {savedImages.length > 0 && (
          <button onClick={() => setShowMedia((v) => !v)}
            className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white-60 text-[11px] font-semibold cursor-pointer hover:bg-white/8 hover:text-white-85 transition-colors">
            📁 Library ({savedImages.length}) {showMedia ? "▲" : "▼"}
          </button>
        )}
        <input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)}
          className="px-2.5 py-1 rounded-lg bg-[#0d0e17] border border-white/12 text-[11px] text-white-70 focus:outline-none" />
        <button onClick={submit} disabled={posting || !text.trim() || !selected.length}
          className="ml-auto px-4 py-1.5 rounded-lg bg-teal-400 text-black text-xs font-bold cursor-pointer disabled:opacity-50 hover:brightness-110 transition-all flex items-center gap-1.5">
          {posting ? <><Loader2 size={11} className="animate-spin" /> Posting…</> : scheduled ? "📅 Schedule" : "🚀 Post Now"}
        </button>
      </div>

      {mediaUrl && (
        <div className="flex gap-2 items-center">
          <img src={mediaUrl} alt="" className="rounded-lg object-cover border-2 border-teal-400" style={{ width: 52, height: 52 }} />
          <span className="text-[10px] text-teal-400">✓ Attached</span>
          <button onClick={() => setMediaUrl(null)} className="bg-transparent border-0 text-white-40 cursor-pointer hover:text-red-400 transition-colors">✕</button>
        </div>
      )}

      {showMedia && savedImages.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {savedImages.slice(0, 12).map((img) => (
            <button key={img.id} onClick={() => setMediaUrl(mediaUrl === img.url ? null : img.url)}
              className="w-14 h-14 rounded-lg overflow-hidden cursor-pointer transition-all border-2"
              style={{ borderColor: mediaUrl === img.url ? "#00c896" : "transparent" }}>
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="text-[11px] text-red-400 px-2.5 py-1.5 rounded-lg bg-red-500/8 border border-red-500/30">
          {error}
        </div>
      )}
      {results && (
        <div className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
          {Object.entries(results).map(([pf, r]) => (
            <div key={pf} style={{ color: r?.error ? "#ff4f5e" : "#00c896" }}>
              {pf}: {r?.error ? "✗ " + r.error : "✓ published" + (r?.id ? " · " + r.id : "")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ ACCOUNTS MODAL ░░
   ═══════════════════════════════════════════════════════════════════════════ */

function AccountsModal({
  platforms, connectingId, onToggleConnect, onTokenSaved, onClose,
}: {
  platforms: Platform[];
  connectingId: PlatformId | null;
  onToggleConnect: (id: PlatformId) => void;
  onTokenSaved: () => void;
  onClose: () => void;
}) {
  const [tokenForm, setTokenForm] = useState<Record<string, Record<string, string>>>({});
  const [saving, setSaving] = useState<PlatformId | null>(null);
  const [messages, setMessages] = useState<Record<string, { ok: boolean; text: string } | undefined>>({});

  const saveToken = async (p: Platform) => {
    const tf = tokenForm[p.id] ?? {};
    setSaving(p.id);
    setMessages((prev) => ({ ...prev, [p.id]: undefined }));
    try {
      const body: Record<string, string> = { provider: p.id };
      if (p.id === "facebook" || p.id === "instagram") {
        body.access_token = tf.access_token ?? "";
        body.page_id = tf.page_id ?? "";
        body.ig_user_id = tf.ig_user_id ?? "";
      }
      if (p.id === "x") body.bearer_token = tf.bearer_token ?? "";
      if (p.id === "youtube") {
        body.channel_id = tf.channel_id ?? "";
        body.channel_handle = tf.channel_handle ?? "@ceogps";
      }
      const d = await lifeosApi<{ ok?: boolean; error?: string; name?: string; handle?: string }>(
        "/api/oauth/token/save", { method: "POST", body: JSON.stringify(body) },
      );
      if (d.ok) {
        setMessages((prev) => ({
          ...prev,
          [p.id]: { ok: true, text: `Saved${d.name ? " · " + d.name : d.handle ? " · @" + d.handle : ""} — reloading…` },
        }));
        onTokenSaved();
      } else {
        setMessages((prev) => ({ ...prev, [p.id]: { ok: false, text: d.error ?? "Save failed" } }));
      }
    } catch (e) {
      setMessages((prev) => ({ ...prev, [p.id]: { ok: false, text: e instanceof Error ? e.message : String(e) } }));
    } finally { setSaving(null); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[620px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0d0e17] border border-white/8">
        <div className="flex items-center px-4 py-3.5 border-b border-white/8 sticky top-0 bg-[#0d0e17] z-10">
          <div className="text-sm font-bold text-white-90 flex-1">⚙️ Platform Accounts</div>
          <button onClick={onClose} className="bg-transparent border-0 text-white-55 text-lg cursor-pointer leading-none hover:text-white-90 transition-colors">✕</button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="glass rounded-lg border border-[#4ab3f4]/25 bg-[#4ab3f4]/5 p-3 text-[11px] text-white-55 leading-relaxed">
            <span className="text-[#4ab3f4] font-bold">How to connect · </span>
            <strong>Meta (FB/IG)</strong>: paste a token from{" "}
            <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" className="text-teal-400">Graph Explorer ↗</a>{" "}
            (permissions: <code className="bg-white/5 px-1 rounded">pages_manage_posts, instagram_basic</code>).&nbsp;
            <strong>X</strong>: Bearer token from{" "}
            <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noreferrer" className="text-teal-400">X Dev Portal ↗</a>.
          </div>

          {platforms.map((p) => {
            const isMeta = p.id === "facebook" || p.id === "instagram";
            const isX = p.id === "x";
            const showTokenForm = isMeta || isX;
            const tf = tokenForm[p.id] ?? {};
            const msg = messages[p.id];
            const setTf = (field: string, value: string) =>
              setTokenForm((f) => ({ ...f, [p.id]: { ...tf, [field]: value } }));

            return (
              <div key={p.id} className="glass rounded-lg border border-white/8 p-3.5">
                <div className="flex items-center gap-3" style={{ marginBottom: showTokenForm ? 12 : 0 }}>
                  <BrandIcon slug={p.brand} size={24} color={p.color} title={p.name} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white-90">{p.name}</div>
                    <div className="text-[10px] text-white-40">{p.handle}</div>
                  </div>
                  <span className={`text-[11px] font-semibold ${p.connected ? "text-teal-400" : connectingId === p.id ? "text-amber-300" : "text-white-30"}`}>
                    {p.connected ? "● Connected" : connectingId === p.id ? "⏳…" : "○ Not Connected"}
                  </span>
                  {p.id !== "youtube" && (
                    <button onClick={() => connectingId !== p.id && onToggleConnect(p.id)} disabled={connectingId === p.id}
                      className={`px-3.5 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-colors border
                        ${p.connected ? "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20" : "bg-teal-400/12 border-teal-400/30 text-teal-400 hover:bg-teal-400/20"}`}>
                      {p.connected ? "Disconnect" : "OAuth Connect"}
                    </button>
                  )}
                </div>

                {showTokenForm && (
                  <div className="border-t border-white/5 pt-3 flex flex-col gap-2">
                    {isMeta && (
                      <>
                        <input placeholder="Page Access Token (from Graph Explorer)" value={tf.access_token ?? ""}
                          onChange={(e) => setTf("access_token", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-[10px] font-mono text-white-85 focus:outline-none focus:border-[#4ab3f4]/50" />
                        <div className="grid grid-cols-2 gap-2">
                          <input placeholder="Page ID (optional)" value={tf.page_id ?? ""} onChange={(e) => setTf("page_id", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-[10px] text-white-85 focus:outline-none focus:border-[#4ab3f4]/50" />
                          <input placeholder="Instagram User ID (optional)" value={tf.ig_user_id ?? ""} onChange={(e) => setTf("ig_user_id", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-[10px] text-white-85 focus:outline-none focus:border-[#4ab3f4]/50" />
                        </div>
                      </>
                    )}
                    {isX && (
                      <input placeholder="Bearer Token (App-only)" value={tf.bearer_token ?? ""} onChange={(e) => setTf("bearer_token", e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0d0e17] border border-white/12 text-[10px] font-mono text-white-85 focus:outline-none focus:border-[#4ab3f4]/50" />
                    )}
                    <div className="flex gap-2 items-center">
                      <button onClick={() => saveToken(p)} disabled={saving === p.id}
                        className="px-3.5 py-1.5 rounded-lg bg-teal-400 text-black text-[11px] font-bold cursor-pointer disabled:opacity-60 hover:brightness-110 transition-all">
                        {saving === p.id ? "⏳ Saving…" : "💾 Save Token"}
                      </button>
                      {msg && (
                        <span className={`text-[11px] font-semibold ${msg.ok ? "text-teal-400" : "text-red-400"}`}>
                          {msg.ok ? "✓ " : "✗ "}{msg.text}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ PROFILE HEADER ░░
   ═══════════════════════════════════════════════════════════════════════════ */

function ProfileHeader({
  platform, profile, onSaveProfile, onConnect, connecting, onOpenAccounts,
}: {
  platform: Platform;
  profile: ProfileOverride | undefined;
  onSaveProfile: (data: ProfileOverride) => void;
  onConnect: (id: PlatformId) => void;
  connecting: PlatformId | null;
  onOpenAccounts: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ name: string; bio: string }>({ name: "", bio: "" });
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const avatarRef = useRef<HTMLInputElement | null>(null);
  const bannerRef = useRef<HTMLInputElement | null>(null);

  const name = profile?.name || platform.handle;
  const bio = profile?.bio || "";
  const avatar = profile?.avatar || platform.avatar || "";
  const banner = profile?.banner || "";

  const startEdit = () => { setDraft({ name, bio }); setEditing(true); };
  const save = () => { onSaveProfile({ ...profile, name: draft.name, bio: draft.bio }); setEditing(false); };

  const uploadImg = async (e: React.ChangeEvent<HTMLInputElement>, field: "avatar" | "banner") => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(field);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("type", "social");
      const r = await api.post<{ ok: boolean; url: string; key: string }>("/api/upload", form);
      if (r?.url) {
        onSaveProfile({ ...profile, [field]: r.url });
        toast(`${field} uploaded.`, "success");
      } else {
        toast(`${field} upload returned no URL.`, "error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`${field} upload failed: ${msg}`, "error");
    }
    setUploading(null);
    e.target.value = "";
  };

  return (
    <div className="glass rounded-xl border border-white/8 overflow-hidden">
      <div className="h-28 relative"
        style={{ background: banner ? `url(${banner}) center/cover` : `linear-gradient(120deg, ${platform.color}33, #0d0e17 70%)` }}>
        <button onClick={() => bannerRef.current?.click()}
          className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/55 backdrop-blur text-white text-[10px] cursor-pointer border-0 hover:bg-black/75 transition-colors">
          {uploading === "banner" ? "⏳…" : "🖼 Banner"}
        </button>
        <input ref={bannerRef} type="file" accept="image/*" onChange={(e) => uploadImg(e, "banner")} className="hidden" />
      </div>

      <div className="px-4 pb-3.5 flex gap-3.5 items-end flex-wrap">
        <div className="relative -mt-8 shrink-0">
          {avatar ? (
            <img src={avatar} alt={name} className="rounded-full object-cover bg-white/8" style={{ width: 74, height: 74, border: "3px solid #13141f" }} />
          ) : (
            <div className="rounded-full flex items-center justify-center text-2xl font-extrabold text-white"
              style={{ width: 74, height: 74, background: `linear-gradient(135deg,${platform.color}cc,${platform.color}44)`, border: "3px solid #13141f" }}>
              {name.replace(/^[@u/]/, "").slice(0, 2).toUpperCase()}
            </div>
          )}
          <button onClick={() => avatarRef.current?.click()}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] cursor-pointer"
            style={{ background: "#00c896", border: "2px solid #13141f", color: "#000" }}>
            {uploading === "avatar" ? "⏳" : "✎"}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" onChange={(e) => uploadImg(e, "avatar")} className="hidden" />
          <div className="absolute top-0 -right-1 w-5 h-5 rounded-full bg-[#0d0e17] flex items-center justify-center">
            <BrandIcon slug={platform.brand} size={12} color={platform.color} title={platform.name} />
          </div>
        </div>

        <div className="flex-1 min-w-[200px] pt-2">
          {editing ? (
            <div className="flex flex-col gap-1.5">
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Display name"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d0e17] border border-white/12 text-xs font-bold text-white-90 focus:outline-none" />
              <textarea value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} placeholder="Bio…"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d0e17] border border-white/12 text-xs text-white-90 focus:outline-none resize-y min-h-[44px]" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-extrabold text-white-95">{name}</span>
                <a href={profileUrl(platform.id, platform.handle)} target="_blank" rel="noreferrer"
                  className="text-[10px] no-underline hover:underline" style={{ color: platform.color }}>
                  {platform.handle} ↗
                </a>
              </div>
              <div className="text-[11px] text-white-55 mt-1 leading-relaxed">
                {bio || <span className="text-white-30">No bio yet — click Edit to add one.</span>}
              </div>
              <div className="flex gap-3.5 mt-1.5 flex-wrap">
                {[
                  { label: "Followers", val: fmtN(platform.followers), c: "#4a9eff" },
                  { label: platform.id === "facebook" ? "Friends" : "Following", val: fmtN(platform.following), c: "#8b7fff" },
                  { label: "Posts", val: fmtN(platform.posts), c: "rgba(255,255,255,0.55)" },
                  { label: "Views", val: fmtN(platform.views), c: "#00c896" },
                ].map((s) => (
                  <span key={s.label} className="text-[11px]">
                    <span className="font-bold" style={{ color: s.c }}>{s.val}</span>
                    <span className="text-white-30 ml-1">{s.label}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-2 shrink-0">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white-55 text-xs cursor-pointer hover:bg-white/8 transition-colors">Cancel</button>
              <button onClick={save} className="px-3 py-1.5 rounded-lg bg-teal-400 text-black text-xs font-bold cursor-pointer hover:brightness-110 transition-all">Save</button>
            </>
          ) : (
            <>
              <button onClick={startEdit} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white-55 text-xs cursor-pointer hover:bg-white/8 transition-colors">✎ Edit Profile</button>
              <button onClick={() => connecting !== platform.id && onConnect(platform.id)} disabled={connecting === platform.id}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors border"
                style={{
                  background: platform.connected ? "rgba(0,200,150,0.15)" : "rgba(255,255,255,0.05)",
                  color: platform.connected ? "#00c896" : "rgba(255,255,255,0.55)",
                  borderColor: platform.connected ? "#00c896" : "rgba(255,255,255,0.12)",
                }}>
                {platform.connected ? "● Connected" : connecting === platform.id ? "⏳…" : "Connect"}
              </button>
              <button onClick={onOpenAccounts} title="Manage accounts"
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white-55 text-xs cursor-pointer hover:bg-white/8 transition-colors">
                ⚙️
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ░░ MAIN PANEL ░░
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SocialPanel() {
  const [platforms, setPlatforms] = useState<Platform[]>(INITIAL_PLATFORMS);
  const [selected, setSelected] = useState<PlatformId>("facebook");
  const [feedFilter, setFeedFilter] = useState<PlatformId[]>(INITIAL_PLATFORMS.map((p) => p.id));
  const [posts, setPosts] = useState<LocalPost[]>([]);
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileOverride>>({});
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [metaFeed, setMetaFeed] = useState<SocialPost[]>([]);
  const [igFeed, setIgFeed] = useState<SocialPost[]>([]);
  const [xTweets, setXTweets] = useState<SocialPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [connecting, setConnecting] = useState<PlatformId | null>(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const snapshotDone = useRef(false);

  const persistStates = useCallback((updated: Platform[]) => {
    const m: Record<string, boolean> = {};
    updated.forEach((p) => { m[p.id] = p.connected; });
    kvSave(KV_STATES, m);
  }, []);

  /* ── Mount: hydrate from Worker KV, then validate live ── */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [savedPosts, savedImgs, savedProfiles, savedHistory] = await Promise.all([
        kvLoad<LocalPost[]>(KV_POSTS, []),
        kvLoad<SavedImage[]>(KV_IMAGES, []),
        kvLoad<Record<string, ProfileOverride>>(KV_PROFILES, {}),
        kvLoad<MetricsSnapshot[]>(KV_HISTORY, []),
      ]);
      if (cancelled) return;
      if (Array.isArray(savedPosts)) setPosts(savedPosts);
      if (Array.isArray(savedImgs)) setSavedImages(savedImgs);
      if (savedProfiles && typeof savedProfiles === "object") setProfiles(savedProfiles);
      if (Array.isArray(savedHistory)) setHistory(savedHistory);
      setPlatforms((prev) => prev.map((p) => ({ ...p, connected: false })));
    })();

    // X — real user + timeline
    api.get<{ id?: string; handle?: string; followers?: number; following?: number; tweets?: number; avatar?: string; error?: string }>(
      "/api/x/user?handle=ceogps",
    ).then((u) => {
      if (cancelled || !u || u.error) return;
      setPlatforms((prev) => {
        const updated = prev.map((p) => p.id === "x"
          ? { ...p, connected: true, avatar: u.avatar ?? p.avatar, followers: u.followers ?? p.followers, following: u.following ?? p.following, posts: u.tweets ?? p.posts }
          : p);
        persistStates(updated); return updated;
      });
    }).catch(() => null);

    interface XTweet {
      id: string;
      text: string;
      likes: number;
      replies: number;
      impressions: number;
      retweets: number;
      createdAt: string;
      url: string;
    }
    api.get<{ tweets?: XTweet[] }>(
      "/api/x/timeline?handle=ceogps&max=10",
    ).then((data) => {
      if (cancelled || !data?.tweets?.length) return;
      setXTweets(data.tweets.map((t: XTweet) => ({
        id: t.id, platform: "x" as const, text: t.text,
        likes: t.likes, comments: t.replies, views: t.impressions, shares: t.retweets,
        time: t.createdAt, permalink: t.url, real: true,
      })));
    }).catch(() => null);

    // Meta — status + feed + IG media
    api.get<{ connected?: boolean; page?: { name?: string; followers?: number }; instagram?: { username?: string; followers?: number; posts?: number }; error?: string }>(
      "/api/meta/status",
    ).then((status) => {
      if (cancelled || !status?.connected) {
        setLoadingFeed(false);
        return;
      }
      setPlatforms((prev) => {
        const u = prev.map((p) => {
          if (p.id === "facebook") return { ...p, connected: true, handle: status.page?.name ?? p.handle, followers: status.page?.followers ?? p.followers };
          if (p.id === "instagram") return { ...p, connected: true, handle: status.instagram?.username ? "@" + status.instagram.username : p.handle, followers: status.instagram?.followers ?? p.followers, posts: status.instagram?.posts ?? p.posts };
          return p;
        });
        persistStates(u); return u;
      });

      interface MetaFeedItem {
        id: string;
        message?: string;
        likes?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
        created_time: string;
      }
      interface IgFeedItem {
        id: string;
        caption?: string;
        like_count?: number;
        comments_count?: number;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        timestamp: string;
      }
      Promise.all([
        api.get<{ data?: MetaFeedItem[] }>("/api/meta/feed?limit=8").catch(() => null),
        api.get<{ data?: IgFeedItem[] }>("/api/meta/instagram/feed?limit=10").catch(() => null),
      ]).then(([feed, igMedia]) => {
        if (cancelled) return;
        if (feed?.data) setMetaFeed(feed.data.map((p: MetaFeedItem) => ({
          id: p.id, platform: "facebook" as const, text: p.message ?? "",
          likes: p.likes?.summary?.total_count ?? 0, comments: p.comments?.summary?.total_count ?? 0,
          time: p.created_time, real: true,
        })));
        if (igMedia?.data) setIgFeed(igMedia.data.map((p: IgFeedItem) => ({
          id: p.id, platform: "instagram" as const, text: p.caption ?? "",
          likes: p.like_count ?? 0, comments: p.comments_count ?? 0,
          img: p.thumbnail_url ?? p.media_url, permalink: p.permalink,
          time: p.timestamp, real: true,
        })));
        setLoadingFeed(false);
      }).catch(() => setLoadingFeed(false));
    }).catch(() => setLoadingFeed(false));

    const t = setTimeout(() => !cancelled && setLoadingFeed(false), 8000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [persistStates]);

  /* ── Daily metrics snapshot ── */
  useEffect(() => {
    if (snapshotDone.current) return;
    if (!platforms.some((p) => p.connected && p.followers > 0)) return;
    const t = setTimeout(() => {
      snapshotDone.current = true;
      const today = new Date().toISOString().slice(0, 10);
      setHistory((prev) => {
        const m: MetricsSnapshot["m"] = {};
        platforms.forEach((p) => {
          if (p.connected) m[p.id] = {
            followers: p.followers, following: p.following, likes: p.likes, comments: p.comments, views: p.views,
          };
        });
        const u = [...prev.filter((h) => h.d !== today), { d: today, m }].sort((a, b) => a.d.localeCompare(b.d)).slice(-90);
        kvSave(KV_HISTORY, u);
        return u;
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [platforms]);

  /* ── OAuth message listener (from Worker popup postMessage) ── */
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const data = e.data as { type?: string; provider?: PlatformId } | null;
      if (!data || typeof data !== "object" || !data.type) return;
      if (data.type === "oauth_success" && data.provider) {
        const pid = data.provider;
        setConnecting(null);
        if (pid === "x") {
          api.get<{ tweets?: unknown[] }>("/api/x/timeline?handle=ceogps&max=1").then((d: { tweets?: unknown[] } | null) => {
            setPlatforms((prev) => {
              const u = prev.map((p) => p.id === "x" ? { ...p, connected: !!d?.tweets?.length } : p);
              persistStates(u); return u;
            });
          }).catch(() => null);
        } else if (pid === "facebook" || pid === "instagram") {
          api.get<{ data?: unknown[] }>("/api/meta/feed?limit=1").then((feed: { data?: unknown[] } | null) => {
            setPlatforms((prev) => {
              const has = !!feed?.data?.length;
              const u = prev.map((p) => p.id === pid ? { ...p, connected: has } : p);
              persistStates(u); return u;
            });
          }).catch(() => null);
        }
      } else if (data.type === "oauth_failure") {
        setConnecting(null);
        toast("OAuth failed — try again.", "error");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [persistStates]);

  /* ── Connect / disconnect ── */
  const toggleConnect = useCallback((id: PlatformId) => {
    const pl = platforms.find((p) => p.id === id);
    if (pl?.connected) {
      lifeosApi(`/api/oauth/disconnect?provider=${id}&user_id=${OAUTH_USER_ID}`, { method: "POST" })
        .catch(() => null)
        .finally(() => {
          setPlatforms((prev) => {
            const u = prev.map((p) => p.id === id ? { ...p, connected: false } : p);
            persistStates(u); return u;
          });
          toast(`Disconnected ${id}.`, "success");
        });
    } else {
      setConnecting(id);
      const state = `social:${id}:${Date.now()}`;
      const apiBase = ((import.meta as ImportMeta & {
        env?: { VITE_WORKER_URL?: string };
      }).env?.VITE_WORKER_URL)
        ?? "https://lifeos1-api.ceogps.workers.dev";
      const u = new URL(`${apiBase}/api/oauth/start`);
      u.searchParams.set("provider", id);
      u.searchParams.set("user_id", OAUTH_USER_ID);
      u.searchParams.set("state", state);
      const popup = window.open(u.toString(), `oauth-${id}`, "width=600,height=700,resizable=yes,scrollbars=yes");
      const poll = setInterval(() => {
        if (popup && popup.closed) { clearInterval(poll); setConnecting((prev) => (prev === id ? null : prev)); }
      }, 700);
    }
  }, [platforms, persistStates]);

  const toggleFeed = useCallback((id: PlatformId) => {
    setFeedFilter((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }, []);

  const handlePost = (payload: LocalPost) => {
    setPosts((prev) => {
      const u = [payload, ...prev].slice(0, 100);
      kvSave(KV_POSTS, u);
      return u;
    });
  };

  const deletePost = (id: number) => {
    setPosts((prev) => {
      const u = prev.filter((p) => p.id !== id);
      kvSave(KV_POSTS, u);
      return u;
    });
  };

  const uploadImage = async (f: File): Promise<SavedImage | null> => {
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("type", "social");
      const r = await lifeosApi<{ ok: boolean; url: string; key: string }>("/api/upload", {
        method: "POST",
        body: form,
      } as any);
      if (!r?.url) return null;
      const img: SavedImage = {
        id: Date.now() + "_" + f.name,
        name: f.name,
        url: r.url,
        key: r.key,
        uploadedAt: new Date().toLocaleString(),
      };
      setSavedImages((prev) => {
        const u = [img, ...prev].slice(0, 50);
        kvSave(KV_IMAGES, u);
        return u;
      });
      return img;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast(`Upload failed: ${msg}`, "error");
      return null;
    }
  };

  const saveProfile = (pid: PlatformId, data: ProfileOverride) => {
    setProfiles((prev) => {
      const u = { ...prev, [pid]: data };
      kvSave(KV_PROFILES, u);
      return u;
    });
  };

  /* ── Derived ── */
  const activePlatform = platforms.find((p) => p.id === selected) ?? platforms[0];

  const feedPosts = useMemo(() => {
    const all: SocialPost[] = [];
    if (feedFilter.includes("facebook")) all.push(...metaFeed);
    if (feedFilter.includes("instagram")) all.push(...igFeed);
    if (feedFilter.includes("x")) all.push(...xTweets);
    return all.sort((a, b) => (new Date(b.time ?? 0).getTime() || 0) - (new Date(a.time ?? 0).getTime() || 0));
  }, [feedFilter, metaFeed, igFeed, xTweets]);

  const myImages = useMemo(() => {
    const imgs = igFeed.filter((p) => p.img).map((p) => ({ id: "ig_" + p.id, url: p.img!, link: p.permalink, src: "instagram" as const }));
    return [...imgs, ...savedImages.map((i) => ({ ...i, link: i.url, src: "upload" as const }))].slice(0, 18);
  }, [igFeed, savedImages]);

  const sparkSeries = useCallback((pid: string, metric: string): number[] =>
    history.map((h) => h.m?.[pid]?.[metric as keyof MetricsSnapshot["m"][string]]).filter((v) => v != null) as number[],
  [history]);

  const pctChange = (pts: number[]): number | null => {
    if (!pts || pts.length < 2 || !pts[0]) return null;
    return ((pts[pts.length - 1] - pts[0]) / pts[0]) * 100;
  };

  const connectedPls = platforms.filter((p) => p.connected);

  const exportPosts = () => {
    const rows: string[][] = [["platform", "text", "time", "url"]];
    for (const p of feedPosts) rows.push([p.platform, (p.text ?? "").replace(/[\r\n]+/g, " "), p.time ?? "", p.permalink ?? p.url ?? ""]);
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `social-feed-${Date.now()}.csv`;
    a.click();
    toast(`Exported ${rows.length - 1} posts.`, "success");
  };

  return (
    <PanelLayout
      title="SocialLinkOS1"
      subtitle="All social accounts in one unified dashboard"
      icon={<Share2 size={18} />}
      actions={
        <button onClick={exportPosts} disabled={!feedPosts.length}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-white-60 hover:text-white-90 text-xs transition-colors disabled:opacity-40">
          <Download size={12} /> EXPORT
        </button>
      }
    >
      <Toasts />
      <div className="h-full flex overflow-hidden">
        {/* ══════════ MAIN COLUMN ══════════ */}
        <div className="flex-1 min-w-0 overflow-y-auto p-3.5 flex flex-col gap-3">
          {/* Platform chips */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {platforms.map((p) => {
              const on = selected === p.id;
              return (
                <button key={p.id} onClick={() => setSelected(p.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] cursor-pointer font-semibold border-[1.5px] transition-colors"
                  style={{
                    borderColor: on ? p.color : "rgba(255,255,255,0.1)",
                    background: on ? `${p.color}22` : "transparent",
                    color: on ? p.color : "rgba(255,255,255,0.5)",
                  }}>
                  <BrandIcon slug={p.brand} size={11} color={on ? p.color : undefined} title={p.name} />
                  {p.name}
                  {p.connected && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                </button>
              );
            })}
          </div>

          {/* Profile */}
          <ProfileHeader
            platform={activePlatform}
            profile={profiles[selected]}
            onSaveProfile={(data) => saveProfile(selected, data)}
            onConnect={toggleConnect}
            connecting={connecting}
            onOpenAccounts={() => setAccountsOpen(true)}
          />

          {/* Composer */}
          <Composer platforms={platforms} savedImages={savedImages} onPost={handlePost} onUploadImage={uploadImage} />

          {/* Not-connected banners */}
          {platforms.filter((p) => ["facebook", "instagram", "x"].includes(p.id) && !p.connected).map((p) => (
            <div key={p.id} className="glass rounded-lg border p-3 flex items-center gap-2.5"
              style={{ borderColor: `${p.color}33`, background: `${p.color}0A` }}>
              <span className="text-[13px]">🔑</span>
              <span className="text-[11px] font-semibold flex-1" style={{ color: p.color }}>
                {p.name} not connected
              </span>
              <button onClick={() => setAccountsOpen(true)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer"
                style={{ background: `${p.color}1A`, color: p.color, border: `1px solid ${p.color}44` }}>
                Set up
              </button>
            </div>
          ))}

          {/* Feed filter pills */}
          <div className="flex gap-1.5 items-center">
            <span className="text-[10px] font-bold text-white-30 tracking-wider">FEED</span>
            {platforms.map((p) => {
              const on = feedFilter.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggleFeed(p.id)} title={p.name}
                  className="rounded-full flex items-center justify-center cursor-pointer transition-all border-[1.5px]"
                  style={{ width: 26, height: 26, borderColor: on ? p.color : "rgba(255,255,255,0.12)", background: on ? `${p.color}22` : "transparent", opacity: on ? 1 : 0.45 }}>
                  <BrandIcon slug={p.brand} size={13} color={on ? p.color : undefined} title={p.name} />
                </button>
              );
            })}
            <span className="text-[10px] text-white-30 ml-auto">
              {feedPosts.length} live post{feedPosts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Feed */}
          {loadingFeed && (
            <div className="glass rounded-xl border border-white/8 p-5 text-center text-xs text-white-55">
              ⏳ Loading live feeds…
            </div>
          )}
          {feedPosts.map((post, i) => {
            const pl = platforms.find((p) => p.id === post.platform);
            if (!pl) return null;
            return <FeedCard key={post.id ?? i} post={post} platform={pl} avatarOverride={profiles[post.platform]?.avatar ?? pl.avatar} />;
          })}
          {!loadingFeed && feedPosts.length === 0 && (
            <div className="glass rounded-xl border border-white/8 p-10 text-center">
              <Rss size={36} className="mx-auto text-white-15 mb-2.5" />
              <div className="text-[13px] font-bold text-white-90 mb-1.5">No live posts yet</div>
              <div className="text-[11px] text-white-55 mb-3.5 leading-relaxed">
                Connect your platforms to pull in real feeds — Facebook, Instagram, and X load automatically once tokens are set.
              </div>
              <button onClick={() => setAccountsOpen(true)}
                className="px-4 py-2 rounded-lg bg-teal-400 text-black text-xs font-bold cursor-pointer hover:brightness-110 transition-all">
                ⚙️ Set Up Accounts
              </button>
            </div>
          )}

          {/* Your posts */}
          {posts.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-white-30 tracking-wider mt-1">YOUR POSTS ({posts.length})</div>
              {posts.map((post) => (
                <div key={post.id} className="glass rounded-xl border border-white/8 p-3.5">
                  <div className="flex gap-1.5 mb-2 items-center flex-wrap">
                    {post.platforms.map((id) => {
                      const pl = platforms.find((p) => p.id === id);
                      return pl ? <BrandIcon key={id} slug={pl.brand} size={12} color={pl.color} title={pl.name} /> : null;
                    })}
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${post.status === "Scheduled" ? "bg-amber-500/15 text-amber-300" : "bg-teal-400/10 text-teal-400"}`}>
                      {post.status}
                    </span>
                    {post.scheduled && <span className="text-[9px] text-white-30">📅 {new Date(post.scheduled).toLocaleString()}</span>}
                    <span className="text-[9px] text-white-30">{post.created}</span>
                    <button onClick={() => deletePost(post.id)} className="ml-auto bg-transparent border-0 text-white-40 cursor-pointer text-xs hover:text-red-400 transition-colors">✕</button>
                  </div>
                  {post.media && <img src={post.media} alt="" className="max-w-[200px] rounded-lg mb-2 block" />}
                  <div className="text-xs text-white-90 leading-relaxed">{post.text}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ══════════ RIGHT SIDEBAR ══════════ */}
        <aside className="w-[300px] shrink-0 border-l border-white/8 bg-[#0d0e17] overflow-y-auto">
          <SideBlock title="ANALYTICS" icon="📊" badge={connectedPls.length ? `${connectedPls.length} live` : null}>
            {connectedPls.length === 0 && (
              <div className="text-[10px] text-white-30 py-2">Connect platforms to see live analytics.</div>
            )}
            <div className="flex flex-col gap-2.5">
              {[...connectedPls, ...platforms.filter((p) => !p.connected)].map((p) => (
                <div key={p.id} className="glass rounded-lg border border-white/8 p-2.5" style={{ opacity: p.connected ? 1 : 0.5 }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <BrandIcon slug={p.brand} size={13} color={p.color} title={p.name} />
                    <span className="text-[11px] font-bold flex-1" style={{ color: p.color }}>{p.name}</span>
                    <span className={`text-[9px] ${p.connected ? "text-teal-400" : "text-white-30"}`}>
                      {p.connected ? "● live" : "offline"}
                    </span>
                  </div>
                  {p.connected && METRIC_ROWS.map((m) => {
                    const key = String(m);
                    const pts = sparkSeries(p.id, key);
                    const pct = pctChange(pts);
                    const value = p[m] as number;
                    return (
                      <div key={key} className="flex items-center gap-1.5 py-0.5">
                        <span className="text-[9px] text-white-30 w-14 shrink-0">{metricLabel(key, p.id)}</span>
                        <span className="text-[10px] font-bold text-white-90 w-10 text-right shrink-0">{fmtN(value || 0)}</span>
                        <Sparkline points={pts.length ? pts : [value || 0, value || 0]} color={pct != null && pct < 0 ? "#ff4f5e" : p.color} />
                        <span className={`text-[9px] font-bold w-10 text-right shrink-0 ${pct == null ? "text-white-30" : pct < 0 ? "text-red-400" : "text-teal-400"}`}>
                          {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${Math.abs(pct) < 10 ? pct.toFixed(1) : Math.round(pct)}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {connectedPls.length > 0 && history.length < 2 && (
              <div className="text-[9px] text-white-30 mt-2 leading-relaxed">
                📈 Growth graphs build daily — trends appear from day 2.
              </div>
            )}
          </SideBlock>

          <SideBlock title="MY IMAGES" icon="🖼" badge={myImages.length || null}>
            {myImages.length === 0 ? (
              <div className="text-[10px] text-white-30 py-1">Posted images and uploads appear here.</div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {myImages.map((img) => (
                  <a key={img.id} href={img.link || img.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-md overflow-hidden bg-white/5">
                    <img src={img.url} alt="" className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  </a>
                ))}
              </div>
            )}
          </SideBlock>

          <SideBlock title="PEOPLE" icon="👥">
            <div className="flex flex-col gap-1">
              {platforms.map((p) => (
                <a key={p.id} href={profileUrl(p.id, p.handle)} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg no-underline transition-colors hover:bg-white/8"
                  style={{ background: "rgba(255,255,255,0.03)", opacity: p.connected ? 1 : 0.5 }}>
                  <BrandIcon slug={p.brand} size={12} color={p.color} title={p.name} />
                  <span className="text-[10px] text-white-90 flex-1">{p.name}</span>
                  <span className="text-[10px] font-bold" style={{ color: p.color }}>
                    {p.connected ? fmtN(p.followers) : "—"}
                  </span>
                  <span className="text-[9px] text-white-30">↗</span>
                </a>
              ))}
            </div>
          </SideBlock>

          <SideBlock title="GROUPS" icon="👪" defaultOpen={false}>
            <div className="flex flex-col gap-1">
              {GROUP_LINKS.map((g) => (
                <a key={g.label} href={g.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg no-underline bg-white/[0.03] hover:bg-white/8 transition-colors">
                  <BrandIcon slug={g.brand} size={12} title={g.label} />
                  <span className="text-[10px] text-white-90 flex-1">{g.label}</span>
                  <span className="text-[9px] text-white-30">↗</span>
                </a>
              ))}
            </div>
          </SideBlock>

          <SideBlock title="QUICKLINKS" icon="🔗" defaultOpen={false}>
            <div className="flex flex-col gap-1">
              {QUICKLINKS.map((q) => (
                <a key={q.label} href={q.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg no-underline bg-white/[0.03] hover:bg-white/8 transition-colors">
                  <BrandIcon slug={q.brand} size={12} title={q.label} />
                  <span className="text-[10px] text-white-90 flex-1">{q.label}</span>
                  <span className="text-[9px] text-white-30">↗</span>
                </a>
              ))}
            </div>
          </SideBlock>
        </aside>
      </div>

      {accountsOpen && (
        <AccountsModal
          platforms={platforms}
          connectingId={connecting}
          onToggleConnect={toggleConnect}
          onTokenSaved={() => setTimeout(() => window.location.reload(), 900)}
          onClose={() => setAccountsOpen(false)}
        />
      )}
    </PanelLayout>
  );
}

/** Local fallback keeps social platform icons independent of the shared icon library. */
function BrandIcon({
  slug,
  size = 16,
  color = "currentColor",
  title,
}: {
  slug: string;
  size?: number;
  color?: string;
  title?: string;
}) {
  const labels: Record<string, string> = {
    instagram: "◎",
    facebook: "f",
    x: "𝕏",
    tiktok: "♪",
    linkedin: "in",
    reddit: "●",
    snapchat: "👻",
    youtube: "▶",
  };

  return (
    <span
      aria-label={title}
      title={title}
      role="img"
      style={{
        color,
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(9, size * 0.75),
        lineHeight: 1,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {labels[slug] ?? "•"}
    </span>
  );
}