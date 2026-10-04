import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Plug,
  Search,
  Key,
  RefreshCw,
  Circle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { PanelLayout } from "../../components/layout/PanelLayout";
import { lifeosApi } from "../../lib/api";
import {
  listKeyCatalog,
  saveCredential,
  deleteCredential,
  unlockKeyEncryption,
  isKeyEncryptionUnlocked,
  lockKeyEncryption,
  needsKeyEncryptionSetup,
  getDecryptedKey,
  serviceIdOf,
  type IntegrationCredential,
} from "../../platform/integrations/integrationsSupabase";
import { useAuth } from "../../lib/SupabaseAuthContext";
import { getSupabaseClient } from "../../lib/supabaseClient";
import OwnerLinkBar from "../../components/OwnerLinkBar";
import { getOwnerId, OWNER_CHANGED_EVENT } from "../../lib/owner";

type Category =
  | "All"
  | "LLMs"
  | "Social"
  | "Marketing"
  | "Finance"
  | "Communications"
  | "Dev Tools"
  | "Business"
  | "AI Media"
  | "Productivity"
  | "Browsers"
  | "More";

type Integration = {
  name: string;
  category: Exclude<Category, "All">;
  icon: string;
  desc: string;
};

const INTEGRATIONS: Integration[] = [
  // LLMs
  { name: "OpenAI", category: "LLMs", icon: "🤖", desc: "GPT-4o, o1, and DALL·E via the OpenAI API." },
  { name: "Anthropic", category: "LLMs", icon: "🧠", desc: "Claude 3.5 Sonnet and Haiku models." },
  { name: "Google AI (Gemini)", category: "LLMs", icon: "✨", desc: "Gemini 1.5 Pro and Flash via Google AI Studio." },
  { name: "Hugging Face", category: "LLMs", icon: "🤗", desc: "Access thousands of open-source models." },
  { name: "Ollama (local)", category: "LLMs", icon: "🦙", desc: "Run LLMs locally on your own machine." },
  { name: "Groq", category: "LLMs", icon: "⚡", desc: "Ultra-fast inference with LPU hardware." },
  { name: "OpenRouter", category: "LLMs", icon: "🔀", desc: "Unified API gateway to 100+ models." },
  { name: "Grok (xAI)", category: "LLMs", icon: "𝕏", desc: "Grok-2 from xAI with real-time web access." },
  { name: "DeepSeek", category: "LLMs", icon: "🔍", desc: "DeepSeek-V3 and R1 reasoning models." },
  { name: "Mistral", category: "LLMs", icon: "🌬️", desc: "Mistral Large 2 and Mixtral series models." },
  { name: "Cohere", category: "LLMs", icon: "🌀", desc: "Command R+ for RAG and enterprise tasks." },
  { name: "Meta LLaMA", category: "LLMs", icon: "🦾", desc: "Llama 3.3 70B and 405B open models." },
  { name: "Gemma", category: "LLMs", icon: "💎", desc: "Google's lightweight open Gemma models." },
  { name: "Qwen", category: "LLMs", icon: "🐉", desc: "Alibaba's Qwen 2.5 multilingual models." },
  { name: "Hermes", category: "LLMs", icon: "🏛️", desc: "Nous Research Hermes fine-tuned models." },
  { name: "Anyscale", category: "LLMs", icon: "📡", desc: "Scalable OSS model endpoints via Anyscale." },
  { name: "NVIDIA NIM", category: "LLMs", icon: "🖥️", desc: "Deploy optimized models on NVIDIA NIM." },
  { name: "Copilot (Microsoft)", category: "LLMs", icon: "🪟", desc: "Microsoft Copilot Studio and Azure OpenAI." },
  { name: "Azure AI", category: "LLMs", icon: "☁️", desc: "Azure AI Foundry model deployments." },

  // Social
  { name: "Instagram", category: "Social", icon: "📸", desc: "Read/post to Instagram via Graph API." },
  { name: "Facebook", category: "Social", icon: "👥", desc: "Pages, groups, and feed management." },
  { name: "Twitter/X", category: "Social", icon: "🐦", desc: "Post tweets, read timelines, and analytics." },
  { name: "LinkedIn", category: "Social", icon: "💼", desc: "Profile data, posts, and company pages." },
  { name: "TikTok", category: "Social", icon: "🎵", desc: "Upload videos and pull TikTok analytics." },
  { name: "YouTube", category: "Social", icon: "▶️", desc: "Upload videos, manage playlists, analytics." },
  { name: "Reddit", category: "Social", icon: "🤖", desc: "Read subreddits, post, and track karma." },
  { name: "Snapchat", category: "Social", icon: "👻", desc: "Snap Kit login and story integrations." },
  { name: "Pinterest", category: "Social", icon: "📌", desc: "Create pins, boards, and track analytics." },
  { name: "Discord", category: "Social", icon: "🎮", desc: "Bot messages, webhooks, and server data." },
  { name: "Threads", category: "Social", icon: "🧵", desc: "Post and read Threads via Meta API." },
  { name: "CEO GPS", category: "Social", icon: "🗺️", desc: "Executive social presence tracking." },
  { name: "WhatsApp", category: "Social", icon: "💬", desc: "Business messaging via WhatsApp Cloud API." },
  { name: "Telegram", category: "Social", icon: "✈️", desc: "Bots, channels, and message automation." },
  { name: "Signal", category: "Social", icon: "🔒", desc: "Encrypted messaging via Signal Protocol." },
  { name: "Nextdoor", category: "Social", icon: "🏘️", desc: "Local community posts and business pages." },

  // Marketing
  { name: "Google Analytics", category: "Marketing", icon: "📊", desc: "GA4 events, audiences, and funnels." },
  { name: "Ahrefs", category: "Marketing", icon: "🔗", desc: "Backlinks, keywords, and SEO audits." },
  { name: "MOZ", category: "Marketing", icon: "🟣", desc: "Domain authority and keyword explorer." },
  { name: "Mailchimp", category: "Marketing", icon: "🐒", desc: "Email campaigns, audiences, and automations." },
  { name: "SendGrid", category: "Marketing", icon: "📧", desc: "Transactional email and marketing campaigns." },
  { name: "Brevo", category: "Marketing", icon: "💌", desc: "CRM, email, and SMS marketing platform." },
  { name: "Klaviyo", category: "Marketing", icon: "📣", desc: "E-commerce email & SMS automation." },
  { name: "HubSpot", category: "Marketing", icon: "🟠", desc: "CRM, marketing hub, and sales pipeline." },
  { name: "Monday.com", category: "Marketing", icon: "📅", desc: "Work OS for campaign and project tracking." },
  { name: "ClickUp", category: "Marketing", icon: "✅", desc: "Tasks, docs, goals, and time tracking." },
  { name: "Jotform", category: "Marketing", icon: "📋", desc: "Forms, surveys, and lead capture." },
  { name: "Postman", category: "Marketing", icon: "📮", desc: "API testing and team collaboration." },
  { name: "Canva", category: "Marketing", icon: "🎨", desc: "Design assets and brand templates." },

  // Finance
  { name: "Stripe", category: "Finance", icon: "💳", desc: "Payments, subscriptions, and billing." },
  { name: "Plaid", category: "Finance", icon: "🏦", desc: "Bank account linking and transaction data." },
  { name: "PayPal", category: "Finance", icon: "🅿️", desc: "Payments, invoices, and dispute management." },
  { name: "Venmo", category: "Finance", icon: "💸", desc: "Peer-to-peer payment tracking." },
  { name: "Cash App", category: "Finance", icon: "💵", desc: "Cash App business payments and payouts." },
  { name: "SoFi", category: "Finance", icon: "🏛️", desc: "SoFi banking and investment accounts." },
  { name: "Chase", category: "Finance", icon: "🔵", desc: "Chase bank data via Plaid integration." },
  { name: "Brex", category: "Finance", icon: "💼", desc: "Corporate cards, expenses, and budgets." },
  { name: "Digits", category: "Finance", icon: "🔢", desc: "Real-time financial analytics and AI CFO." },
  { name: "Crypto.com", category: "Finance", icon: "🪙", desc: "Crypto portfolio and exchange data." },
  { name: "Kraken", category: "Finance", icon: "🦑", desc: "Crypto trading and staking via Kraken API." },
  { name: "DraftKings", category: "Finance", icon: "🏆", desc: "Fantasy sports and betting account data." },
  { name: "Credit Karma", category: "Finance", icon: "📈", desc: "Credit score and financial health tracking." },
  { name: "Experian", category: "Finance", icon: "📉", desc: "Credit reports and identity monitoring." },
  { name: "MorningStar", category: "Finance", icon: "⭐", desc: "Investment research and portfolio ratings." },
  { name: "Mercury", category: "Finance", icon: "🪐", desc: "Mercury business bank accounts and cards." },

  // Communications
  { name: "Twilio", category: "Communications", icon: "📱", desc: "SMS, voice, and video programmable APIs." },
  { name: "Google Voice", category: "Communications", icon: "📞", desc: "Google Voice calls and SMS management." },
  { name: "Nylas", category: "Communications", icon: "✉️", desc: "Email, calendar, and contacts API layer." },
  { name: "Gmail (OAuth)", category: "Communications", icon: "📬", desc: "Read and send Gmail via Google OAuth." },
  { name: "Outlook", category: "Communications", icon: "📫", desc: "Microsoft Outlook email and contacts." },
  { name: "Apple iCloud", category: "Communications", icon: "🍎", desc: "iCloud Mail, contacts, and reminders." },
  { name: "Proton Mail", category: "Communications", icon: "🛡️", desc: "End-to-end encrypted email via Proton API." },
  { name: "Otter.ai", category: "Communications", icon: "🦦", desc: "Meeting transcription and AI summaries." },

  // Dev Tools
  { name: "Cloudflare", category: "Dev Tools", icon: "🌩️", desc: "DNS, CDN, Workers, and R2 storage." },
  { name: "AWS S3", category: "Dev Tools", icon: "🪣", desc: "Object storage and file management." },
  { name: "Azure Storage", category: "Dev Tools", icon: "🔷", desc: "Azure Blob, Queue, and Table storage." },
  { name: "GitHub", category: "Dev Tools", icon: "🐙", desc: "Repos, issues, PRs, and Actions." },
  { name: "GitLab", category: "Dev Tools", icon: "🦊", desc: "CI/CD pipelines and self-hosted repos." },
  { name: "Vercel", category: "Dev Tools", icon: "▲", desc: "Deploy and manage Vercel projects." },
  { name: "Supabase", category: "Dev Tools", icon: "⚡", desc: "Postgres, Auth, and Realtime backend." },
  { name: "Firebase", category: "Dev Tools", icon: "🔥", desc: "Firestore, Auth, and Cloud Functions." },
  { name: "PocketBase", category: "Dev Tools", icon: "🧳", desc: "Lightweight self-hosted backend and DB." },
  { name: "Prisma", category: "Dev Tools", icon: "🔺", desc: "Type-safe ORM and database migrations." },
  { name: "Docker", category: "Dev Tools", icon: "🐳", desc: "Container management and image builds." },
  { name: "VS Code", category: "Dev Tools", icon: "💻", desc: "VS Code settings sync and extensions." },
  { name: "Dropbox", category: "Dev Tools", icon: "📦", desc: "File sync, sharing, and Paper docs." },
  { name: "Browserbase", category: "Dev Tools", icon: "🌐", desc: "Headless browser automation in the cloud." },
  { name: "Replicate", category: "Dev Tools", icon: "🔁", desc: "Run and fine-tune ML models via API." },

  // Business
  { name: "Brilliant Directories", category: "Business", icon: "🗂️", desc: "Member directory and listing management." },
  { name: "WordPress", category: "Business", icon: "📝", desc: "Content management via WP REST API." },
  { name: "GoDaddy", category: "Business", icon: "🌍", desc: "Domain and website management." },
  { name: "Yelp", category: "Business", icon: "⭐", desc: "Business listings and review management." },
  { name: "YP.com", category: "Business", icon: "📖", desc: "Yellow Pages directory listing sync." },
  { name: "ShowMeLocal", category: "Business", icon: "📍", desc: "Local citation and listing management." },
  { name: "Alignable", category: "Business", icon: "🤝", desc: "Small business community networking." },
  { name: "Yahoo", category: "Business", icon: "🟣", desc: "Yahoo Finance and search integrations." },
  { name: "Airtable", category: "Business", icon: "🗃️", desc: "Databases, automations, and views." },
  { name: "Notion", category: "Business", icon: "📒", desc: "Docs, databases, and wikis via Notion API." },
  { name: "Zoominfo", category: "Business", icon: "🔭", desc: "B2B contact and company intelligence." },
  { name: "Linear", category: "Business", icon: "📐", desc: "Issue tracking and engineering workflows." },
  { name: "Plain", category: "Business", icon: "🎫", desc: "Customer support and ticketing platform." },
  { name: "Google Calendar", category: "Business", icon: "🗓️", desc: "Events, reminders, and scheduling." },
  { name: "Outlook Calendar", category: "Business", icon: "📆", desc: "Microsoft calendar events and meetings." },
  { name: "iCloud Calendar", category: "Business", icon: "🍏", desc: "Apple iCloud calendar sync." },

  // AI Media
  { name: "D-ID (avatar)", category: "AI Media", icon: "🧑‍💻", desc: "Realistic AI avatar video generation." },
  { name: "Suno (music)", category: "AI Media", icon: "🎸", desc: "AI-generated songs from text prompts." },
  { name: "ElevenLabs (voice)", category: "AI Media", icon: "🎙️", desc: "Ultra-realistic AI voice synthesis." },
  { name: "Stability AI", category: "AI Media", icon: "🖼️", desc: "Stable Diffusion image and video models." },
  { name: "Fish.Audio", category: "AI Media", icon: "🐟", desc: "Voice cloning and TTS synthesis." },
  { name: "Moondream2", category: "AI Media", icon: "🌙", desc: "Tiny vision-language model for edge." },
  { name: "Wan-AI", category: "AI Media", icon: "🌊", desc: "AI video generation via Wan 2.1." },
  { name: "Krea", category: "AI Media", icon: "🌈", desc: "Real-time AI image and video creation." },
  { name: "Blackforest Labs", category: "AI Media", icon: "🌲", desc: "FLUX image generation models." },
  { name: "Runwav", category: "AI Media", icon: "🎧", desc: "AI audio generation and sound effects." },
  { name: "Kling", category: "AI Media", icon: "🎬", desc: "Kling AI video generation from images." },
  { name: "Tenstrip", category: "AI Media", icon: "🎞️", desc: "AI-powered comic strip and storyboards." },

  // Browsers
  { name: "Opera", category: "Browsers", icon: "🔴", desc: "Opera browser automation and data sync." },
  { name: "Firefox", category: "Browsers", icon: "🦊", desc: "Firefox extension and bookmarks API." },
  { name: "Exa", category: "Browsers", icon: "🔎", desc: "Neural web search and content extraction." },
  { name: "Google Maps", category: "Browsers", icon: "🗺️", desc: "Places, geocoding, and directions API." },
  { name: "Apple Maps", category: "Browsers", icon: "🍎", desc: "MapKit JS and location services." },

  // Productivity (was empty)
  { name: "Todoist", category: "Productivity", icon: "✅", desc: "Tasks, projects, and productivity tracking." },
  { name: "Asana", category: "Productivity", icon: "📋", desc: "Work management and team coordination." },
  { name: "Trello", category: "Productivity", icon: "📌", desc: "Boards, cards, and Kanban workflows." },
  { name: "Calendly", category: "Productivity", icon: "📅", desc: "Scheduling and meeting automation." },

  // More
  { name: "Spotify", category: "More", icon: "🎵", desc: "Playback, playlists, and listening history." },
  { name: "Pandora", category: "More", icon: "📻", desc: "Pandora streaming and station data." },
  { name: "Vimeo", category: "More", icon: "🎥", desc: "Video hosting, analytics, and embedding." },
  { name: "Shutterstock", category: "More", icon: "📷", desc: "Stock photo and footage library search." },
  { name: "Genies", category: "More", icon: "🧞", desc: "Avatar and digital identity platform." },
  { name: "Ring", category: "More", icon: "🔔", desc: "Doorbell, camera, and alarm device API." },
  { name: "Temu", category: "More", icon: "🛍️", desc: "Temu marketplace product data and orders." },
  { name: "TikTok Shop", category: "More", icon: "🛒", desc: "TikTok Shop product listings and orders." },
  { name: "LunarCrush", category: "More", icon: "🌕", desc: "Social intelligence for crypto assets." },
  { name: "Malwarebytes", category: "More", icon: "🛡️", desc: "Threat detection and device security." },
  { name: "Trivago", category: "More", icon: "🏨", desc: "Hotel and travel price comparison." },
  { name: "Cron", category: "More", icon: "⏱️", desc: "Calendar and scheduling productivity app." },
  { name: "Alibaba", category: "More", icon: "🏪", desc: "Alibaba.com wholesale marketplace API." },
  { name: "Make (Integromat)", category: "More", icon: "⚙️", desc: "Visual automation workflows and scenarios." },
  { name: "Gumloop", category: "More", icon: "🔄", desc: "No-code AI workflow automation." },
  { name: "Antigravity", category: "More", icon: "🚀", desc: "AI-powered business growth platform." },
  { name: "Lumin", category: "More", icon: "💡", desc: "Document collaboration and PDF editing." },
  { name: "Luma", category: "More", icon: "🌟", desc: "NeRF and 3D scene capture platform." },
  { name: "Slack", category: "More", icon: "💬", desc: "Team messaging, bots, and workflows." },
  { name: "Hercules", category: "More", icon: "⚡", desc: "Hercules platform API and app services." },
  { name: "Base44", category: "More", icon: "🔧", desc: "No-code app builder and data platform." },
  { name: "QuarkAI", category: "More", icon: "⚛️", desc: "AI-native productivity and knowledge hub." },
];

const CATEGORIES: Category[] = [
  "All", "LLMs", "Social", "Marketing", "Finance", "Communications",
  "Dev Tools", "Business", "AI Media", "Productivity", "Browsers", "More",
];

const TEAL_LABEL = "hsl(var(--teal))";

// ── Credential model ────────────────────────────────────────────────────────
type Credential = {
  id: string;
  label: string;
  type: "apikey" | "oauth";
  status: "connected" | "pending" | "disconnected" | "error";
  provider?: string;
  keyPreview?: string;
  addedAt: number;
  lastSyncedAt?: number;
  lastSync?: string;
  syncError?: string;
  oauthState?: string; // for CSRF + pending tracking
};

// Services that support OAuth (many are hybrid)
const OAUTH_SERVICES = new Set([
  "Gmail (OAuth)", "Outlook", "Outlook Calendar", "Apple iCloud", "iCloud Calendar",
  "Google Analytics", "Google Calendar", "Google Drive", "Google Sheets",
  "Google Search Console", "Google Ads", "Google AI (Gemini)",
  "LinkedIn", "Twitter/X", "Facebook", "Instagram", "TikTok", "TikTok Shop",
  "YouTube", "GitHub", "Slack", "Spotify", "Zoom", "ClickUp", "Airtable",
  "HubSpot", "Monday.com", "Notion", "Discord", "Twilio", "Plaid",
  "Pinterest", "Reddit", "Snapchat", "Threads", "Stripe", "Dropbox",
  "Canva", "Linear", "Asana", "Trello", "Todoist", "Calendly",
  "Microsoft", "Copilot (Microsoft)", "Azure AI",
]);

// Provider slug → Worker must know these
const OAUTH_SLUG: Record<string, string> = {
  "Gmail (OAuth)": "google",
  "Google Analytics": "google",
  "Google Ads": "google",
  "Google Calendar": "google",
  "Google Drive": "google",
  "Google Sheets": "google",
  "Google Search Console": "google",
  "Google AI (Gemini)": "google",
  "YouTube": "google",
  LinkedIn: "linkedin",
  "Twitter/X": "twitter",
  Facebook: "facebook",
  Instagram: "instagram",
  Threads: "instagram",
  TikTok: "tiktok",
  "TikTok Shop": "tiktok",
  GitHub: "github",
  Slack: "slack",
  Spotify: "spotify",
  Zoom: "zoom",
  ClickUp: "clickup",
  Airtable: "airtable",
  HubSpot: "hubspot",
  "Monday.com": "monday",
  Notion: "notion",
  Discord: "discord",
  Twilio: "twilio",
  Reddit: "reddit",
  Pinterest: "pinterest",
  Snapchat: "snapchat",
  Microsoft: "microsoft",
  Outlook: "microsoft",
  "Outlook Calendar": "microsoft",
  "Copilot (Microsoft)": "microsoft",
  "Azure AI": "microsoft",
  Stripe: "stripe",
  Dropbox: "dropbox",
  Canva: "canva",
  Linear: "linear",
  Asana: "asana",
  Trello: "trello",
  Todoist: "todoist",
  Calendly: "calendly",
  Plaid: "plaid",
  "Apple iCloud": "apple",
  "iCloud Calendar": "apple",
};

const workerEnv = (import.meta as ImportMeta & {
  env?: { VITE_WORKER_URL?: string };
}).env;
const WORKER_BASE =
  workerEnv?.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";
const WORKER_CONFIGURED = Boolean(workerEnv?.VITE_WORKER_URL);

// Providers that worker/src/routes/oauth.ts actually implements (it has both an
// authorize URL and a token URL for these). Other slugs would hit a made-up
// "https://<slug>.com/oauth/authorize" URL, so they are refused up front.
const WORKER_OAUTH_PROVIDERS = new Set([
  "google", "microsoft", "github", "slack", "facebook",
  "instagram", "twitter", "linkedin", "spotify", "notion",
]);

// Providers send the user back here; the worker's /api/oauth/callback exchanges
// the code for tokens. (The SPA has no /oauth/callback route, so the previous
// redirect_uri of <app origin>/oauth/callback could never complete.) This exact
// URL must be registered as an authorized redirect URI in each provider's app.
const OAUTH_CALLBACK_URI = `${WORKER_BASE.replace(/\/+$/, "")}/api/oauth/callback`;

// Sole local user: worker OAuth rows are keyed by the stable owner UUID
// (getOwnerId / session uid), NOT by a typed "connect as someone else" email.
// Optional account labels (e.g. which Google account) are stored separately as
// account_email. Remember a display label for convenience only.
const OAUTH_OWNER_EMAIL_KEY = "lifeos_oauth_owner_email";

function getStoredOAuthOwnerEmail(): string {
  try {
    return window.localStorage.getItem(OAUTH_OWNER_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

function rememberOAuthOwnerEmail(email: string): void {
  try {
    window.localStorage.setItem(OAUTH_OWNER_EMAIL_KEY, email);
  } catch {
    // Storage unavailable; the email is still used for this attempt.
  }
  // Best effort: keep it on the (anonymous) Supabase user too. Only metadata is
  // written; the auth email itself is not changed.
  void getSupabaseClient()
    .then((client) => client.auth.updateUser({ data: { oauth_owner_email: email } }))
    .then((res) => {
      if (res?.error) console.warn("[Integrations] could not save OAuth email to user metadata:", res.error.message);
    })
    .catch((e) => console.warn("[Integrations] could not save OAuth email to user metadata:", e));
}

// /api/oauth/status answers { connected: string[], statuses }: an empty array
// means NOT connected (an empty array is truthy, so check its length).
function isOAuthConnected(j: unknown): boolean {
  if (!j || typeof j !== "object") return false;
  const r = j as Record<string, unknown>;
  if (Array.isArray(r.connected)) return r.connected.length > 0;
  return !!(r.connected || r.ok || r.access_token || r.status === "connected");
}

// Confirms the worker answers before sending the user into a provider popup,
// so a missing/broken worker produces a visible error instead of nothing.
async function checkOAuthWorker(
  ownerId: string,
  provider: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `${WORKER_BASE}/api/oauth/status?provider=${encodeURIComponent(provider)}&user_id=${encodeURIComponent(ownerId)}`;
  const needs =
    "The lifeos1-api Cloudflare worker must be deployed with SUPABASE_SERVICE_ROLE_KEY and the " +
    `${provider.toUpperCase()}_CLIENT_ID / ${provider.toUpperCase()}_CLIENT_SECRET secrets before OAuth can connect.`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    const detail = body?.error || body?.message || res.statusText;
    return {
      ok: false,
      error: `The LifeOS worker (${WORKER_BASE}) answered HTTP ${res.status}${detail ? ` (${detail})` : ""}. ${needs}`,
    };
  } catch (e) {
    return {
      ok: false,
      error: `The LifeOS worker (${WORKER_BASE}) could not be reached (${e instanceof Error ? e.message : String(e)}). It is most likely not deployed. ${needs}`,
    };
  }
}

const SYNC_ROUTES: Record<string, { url: string; summarize: (d: unknown) => string }> = {
  "Gmail (OAuth)": { url: "/api/email/accounts", summarize: emailSummary },
  Outlook: { url: "/api/email/accounts", summarize: emailSummary },
  "Proton Mail": { url: "/api/email/accounts", summarize: emailSummary },
  Nylas: { url: "/api/nylas/accounts", summarize: flatSummary },
  Stripe: { url: "/api/stripe/summary", summarize: flatSummary },
  Cloudflare: { url: "/api/cloudflare/summary", summarize: flatSummary },
  YouTube: { url: "/api/youtube/channel", summarize: flatSummary },
  GitHub: { url: "/api/github/user", summarize: flatSummary },
  Slack: { url: "/api/slack/workspace", summarize: flatSummary },
  Notion: { url: "/api/notion/me", summarize: flatSummary },
  "Google Calendar": { url: "/api/calendar/events", summarize: flatSummary },
  Spotify: { url: "/api/spotify/me", summarize: flatSummary },
};

// PATCH (api-key-wiring): real per-integration status from the worker (GET /api/integrations/health,
// owner only). Each check is one cheap read-only call to the provider; reasons are sanitized
// server-side and never contain key values.
type HealthStatus = "connected" | "not_configured" | "auth_error" | "failing" | "no_check";
type Health = {
  id: string;
  kind?: "apikey" | "oauth" | "both";
  status: HealthStatus;
  reason: string;
  source: "worker-secret" | "saved-key" | null;
  secret?: string;
  oauth?: { provider: string; client_configured: boolean; accounts: number; expired: number };
};
const HEALTH_COLOR: Record<HealthStatus, string> = {
  connected: "oklch(0.72 0.18 145)",
  not_configured: "oklch(0.55 0 0 / 0.5)",
  auth_error: "oklch(0.65 0.22 25)",
  failing: "oklch(0.75 0.17 60)",
  no_check: "oklch(0.55 0 0 / 0.5)",
};
const HEALTH_LABEL: Record<HealthStatus, string> = {
  connected: "Connected",
  not_configured: "Not configured",
  auth_error: "Auth error",
  failing: "Failing",
  no_check: "No live check",
};

async function fetchHealth(ids: string[], force = false): Promise<Record<string, Health>> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 10) batches.push(ids.slice(i, i + 10));
  const out: Record<string, Health> = {};
  const results = await Promise.all(
    batches.map((b) =>
      lifeosApi.get<{ integrations?: Health[] }>(
        `/api/integrations/health?ids=${encodeURIComponent(b.join(","))}${force ? "&force=1" : ""}`
      )
    )
  );
  for (const r of results) for (const h of r?.integrations || []) out[h.id] = h;
  return out;
}

/** Live-tests a key with the provider through the worker (never stored there). null = no check exists. */
async function validateKey(service: string, key: string): Promise<Health | null> {
  try {
    return await lifeosApi.post<Health>("/api/integrations/validate", { service, key });
  } catch (e) {
    if (/No live check/.test(e instanceof Error ? e.message : "")) return null;
    throw e;
  }
}

function emailSummary(d: unknown): string {
  if (Array.isArray(d)) return `${d.length} email account(s) connected`;
  return flatSummary(d);
}

function flatSummary(d: unknown): string {
  try {
    const s = JSON.stringify(d);
    if (!s || s.length < 4) return "empty";
    return s.length > 90 ? s.slice(0, 90) + "…" : s;
  } catch {
    return "n/a";
  }
}

function slugOf(name: string): string {
  return OAUTH_SLUG[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function generateState(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initialValue : (JSON.parse(stored) as T);
    } catch {
      return initialValue;
    }
  });

  const setPersistentValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === "function"
            ? (next as (previous: T) => T)(previous)
            : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage may be unavailable or full; retain the in-memory value.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setPersistentValue] as const;
}

function useIntegrationAuth() {
  // Real Supabase session from AuthProvider. API keys: public.keys.user_id =
  // owner UUID. OAuth worker rows: same owner UUID as user_id (sole local user).
  const { user } = useAuth();
  const id = user?.id || undefined;
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (!id) {
      setOwnerId(undefined);
      return;
    }
    const refresh = () => {
      void getOwnerId().then((oid) => {
        if (alive) setOwnerId(oid || id);
      });
    };
    refresh();
    const onOwner = () => refresh();
    window.addEventListener(OWNER_CHANGED_EVENT, onOwner);
    return () => {
      alive = false;
      window.removeEventListener(OWNER_CHANGED_EVENT, onOwner);
    };
  }, [id]);

  const displayLabel =
    user?.email ||
    (typeof user?.user_metadata?.oauth_owner_email === "string"
      ? user.user_metadata.oauth_owner_email
      : "") ||
    getStoredOAuthOwnerEmail() ||
    "me";

  return {
    user: id ? { id, email: user?.email || "" } : undefined,
    /** Stable sole-user id sent to worker OAuth as user_id (UUID). */
    oauthUserId: ownerId || id || "",
    /** Optional account label / account_email (defaults to you). */
    defaultAccountLabel: displayLabel,
    isAuthenticated: Boolean(id),
  };
}

// Merge API-key rows from Supabase public.keys into local UI state. OAuth
// cards stay local (their tokens live in the worker). The masked preview comes
// from the local cache because the key itself is only stored encrypted.
function mergeServerKeys(
  prev: Record<string, Credential[]>,
  server: Record<string, IntegrationCredential[]>
): Record<string, Credential[]> {
  const next: Record<string, Credential[]> = {};
  const names = new Set([...Object.keys(prev), ...Object.keys(server)]);
  for (const name of names) {
    const local = prev[name] || [];
    const rows = server[name] || [];
    const localKeys = local.filter((c) => c.type === "apikey");
    const fromServer: Credential[] = rows.map((row) => {
      const match =
        localKeys.find((c) => c.id === row.id) ||
        localKeys.find((c) => c.label === row.label) ||
        localKeys[0];
      return {
        id: row.id,
        label: row.label || match?.label || "API key",
        type: "apikey" as const,
        status: "connected" as const,
        keyPreview: match?.keyPreview || (row.encrypted ? "encrypted key" : "stored key"),
        addedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        lastSyncedAt: match?.lastSyncedAt,
        lastSync: match?.lastSync,
        syncError: row.encrypted ? match?.syncError : "Stored without encryption - re-save this key",
      };
    });
    // Key cards that never reached Supabase stay visible, but honestly labelled.
    const unsaved: Credential[] =
      rows.length > 0
        ? []
        : localKeys.map((c) => ({
            ...c,
            status: "disconnected" as const,
            syncError: "Not saved to Supabase - re-enter the key",
          }));
    const merged = [...fromServer, ...unsaved, ...local.filter((c) => c.type !== "apikey")];
    if (merged.length) next[name] = merged;
  }
  return next;
}

export default function IntegrationsPage() {
  const { user, isAuthenticated, oauthUserId, defaultAccountLabel } = useIntegrationAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [data, setData] = usePersistentState<Record<string, Credential[]>>(
    "integrations_data",
    {}
  );
  const [modalFor, setModalFor] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"apikey" | "oauth">("apikey");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  // PATCH (erebus-dock-redesign): bumps after "Link this browser" so keys reload.
  const [ownerRev, setOwnerRev] = useState(0);
  // Master password for key encryption is held in memory only (integrationsSupabase.ts).
  const [encUnlocked, setEncUnlocked] = useState<boolean>(() => isKeyEncryptionUnlocked());
  const [encSetupNeeded, setEncSetupNeeded] = useState(false);

  // Forget the in-memory master password when the user signs out.
  useEffect(() => {
    if (!user?.id) {
      lockKeyEncryption();
      setEncUnlocked(false);
    }
  }, [user?.id]);

  // Load every saved API key. The values stay encrypted. No login required.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingCreds(true);
      try {
        const rows = await listKeyCatalog();
        if (cancelled) return;
        const byName: Record<string, IntegrationCredential[]> = {};
        for (const item of INTEGRATIONS) {
          const service = serviceIdOf(item.name);
          const hits = rows.filter((row) => row.service === service);
          if (!hits.length) continue;
          byName[item.name] = hits.map((hit, index) => ({
            id: `${service}-${index}`,
            user_id: "",
            service,
            integration_name: item.name,
            label: hit.label || null,
            encrypted: true,
            created_at: new Date().toISOString(),
            updated_at: null,
          }));
        }
        setData((prev) => mergeServerKeys(prev ?? {}, byName));
        setLoadError(null);
      } catch (e) {
        console.warn("[Integrations] Failed to load credentials:", e);
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoadingCreds(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [setData, ownerRev]);

  // Auto-poll pending OAuth credentials every 8s
  useEffect(() => {
    if (!isAuthenticated || !oauthUserId) return;

    const poll = async () => {
      const pending: { name: string; cred: Credential }[] = [];
      for (const [name, creds] of Object.entries(data || {})) {
        for (const c of creds) {
          if (c.type === "oauth" && c.status === "pending" && c.provider) {
            pending.push({ name, cred: c });
          }
        }
      }
      if (pending.length === 0) return;

      await Promise.all(
        pending.map(async ({ name, cred }) => {
          try {
            const res = await fetch(
              `${WORKER_BASE}/api/oauth/status?provider=${encodeURIComponent(cred.provider!)}&user_id=${encodeURIComponent(oauthUserId)}&account_email=${encodeURIComponent(cred.label || "")}&state=${encodeURIComponent(cred.oauthState || "")}`
            );
            const j = await res.json().catch(() => null);
            if (!res.ok) {
              const msg = `Worker error HTTP ${res.status}${j?.error || j?.message ? `: ${j.error || j.message}` : ""}`;
              if (cred.syncError !== msg) {
                updateCreds(name, (c) => c.map((x) => (x.id === cred.id ? { ...x, syncError: msg } : x)));
              }
              return;
            }
            const ok = isOAuthConnected(j);
            if (ok) {
              updateCreds(name, (c) =>
                c.map((x) =>
                  x.id === cred.id
                    ? {
                        ...x,
                        status: "connected" as const,
                        lastSync: "OAuth connected",
                        lastSyncedAt: Date.now(),
                        syncError: undefined,
                      }
                    : x
                )
              );
              // Persist success
              if (user?.id) {
                await saveCredential(user.id, {
                  user_email: defaultAccountLabel,
                  integration_name: name,
                  email: cred.label,
                  status: "on",
                  label: cred.label,
                  oauth_provider: cred.provider,
                }).catch(() => {});
              }
            } else if (j?.error || j?.message) {
              updateCreds(name, (c) =>
                c.map((x) =>
                  x.id === cred.id
                    ? { ...x, syncError: j.message || j.error || "Still pending" }
                    : x
                )
              );
            }
          } catch (e) {
            // Show the failure on the card instead of polling silently forever.
            const msg = `Worker unreachable: ${e instanceof Error ? e.message : String(e)}`;
            if (cred.syncError !== msg) {
              updateCreds(name, (c) => c.map((x) => (x.id === cred.id ? { ...x, syncError: msg } : x)));
            }
          }
        })
      );
    };

    pollRef.current = setInterval(poll, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data, isAuthenticated, oauthUserId, defaultAccountLabel, user?.id]);

  const totalConnected = Object.values(data || {}).reduce(
    (n, creds) => n + creds.filter((c) => c.status === "connected").length,
    0
  );

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((item) => {
      const matchesCategory =
        activeCategory === "All" || item.category === activeCategory;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [search, activeCategory]);

  const updateCreds = useCallback(
    (name: string, updater: (c: Credential[]) => Credential[]) =>
      setData((prev) => ({ ...(prev ?? {}), [name]: updater(prev?.[name] || []) })),
    [setData]
  );

  // PATCH (api-key-wiring): live status per integration + verification of saved (encrypted) keys.
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [healthError, setHealthError] = useState<string | null>(null);
  const refreshHealth = useCallback(async (ids?: string[], force = false) => {
    try {
      const next = await fetchHealth(ids || INTEGRATIONS.map((i) => serviceIdOf(i.name)), force);
      setHealth((prev) => ({ ...prev, ...next }));
      setHealthError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Sole local: before worker redeploy, health may 403 "not linked". Do not
      // paint that as a permanent error next to "Connected as you".
      if (/not linked to the LifeOS owner/i.test(msg) || /\b403\b/.test(msg)) {
        setHealthError(null);
        return;
      }
      setHealthError(msg);
    }
  }, []);
  useEffect(() => {
    if (isAuthenticated) void refreshHealth();
  }, [isAuthenticated, ownerRev, refreshHealth]);

  const verifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!encUnlocked) return;
    for (const [name, creds] of Object.entries(data || {})) {
      const cred = creds.find((c) => c.type === "apikey" && c.status === "connected");
      const service = serviceIdOf(name);
      if (!cred || verifiedRef.current.has(service)) continue;
      verifiedRef.current.add(service);
      void (async () => {
        const key = await getDecryptedKey(service).catch(() => null);
        if (!key) return;
        try {
          const v = await validateKey(service, key);
          if (!v) return;
          const ok = v.status === "connected";
          updateCreds(name, (c) =>
            c.map((x) =>
              x.id === cred.id
                ? {
                    ...x,
                    status: ok ? ("connected" as const) : ("error" as const),
                    lastSync: ok ? `verified: ${v.reason}` : x.lastSync,
                    lastSyncedAt: Date.now(),
                    syncError: ok ? undefined : `${HEALTH_LABEL[v.status]}: ${v.reason}`,
                  }
                : x
            )
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          updateCreds(name, (c) => c.map((x) => (x.id === cred.id ? { ...x, syncError: `not verified: ${msg}` } : x)));
        }
      })();
    }
  }, [encUnlocked, data, updateCreds]);

  // API key flow. The key is encrypted in the browser (vaultCrypto, AES-256-GCM)
  // before it is written to Supabase public.keys; one key per integration.
  const addApiKey = async (
    name: string,
    label: string,
    key: string,
    passphrase?: string,
    confirmPassphrase?: string
  ): Promise<boolean> => {
    const accountLabel = (label.trim() || defaultAccountLabel || "me").trim();
    if (!key.trim()) return false;
    // PATCH (api-key-wiring): validate against the real provider before saving.
    let verified: Health | null = null;
    let verifyNote: string | undefined;
    try {
      verified = await validateKey(serviceIdOf(name), key.trim());
    } catch (e) {
      verifyNote = `saved, not verified (${e instanceof Error ? e.message : String(e)})`;
    }
    if (verified && verified.status !== "connected") {
      alert(`Key not saved: ${name} rejected it (${HEALTH_LABEL[verified.status]}: ${verified.reason})`);
      return false;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cred: Credential = {
      id,
      label: accountLabel,
      type: "apikey",
      status: "connected",
      keyPreview: key.replace(/^(.{4}).*(.{2})$/, "$1····$2") || "key",
      addedAt: Date.now(),
      lastSync: verified ? `verified: ${verified.reason}` : undefined,
      lastSyncedAt: verified ? Date.now() : undefined,
      syncError: verifyNote,
    };
    // public.keys holds one key per integration, so a new key replaces the old card.
    const previousKeys = (data?.[name] || []).filter((x) => x.type === "apikey");
    updateCreds(name, (c) => [cred, ...c.filter((x) => x.type !== "apikey")]);

    try {
      const saved = await saveCredential(user?.id || "owner", {
        user_email: user?.email,
        integration_name: name,
        email: accountLabel,
        api_key: key,
        status: "on",
        label: accountLabel,
      });
      if (saved?.id) {
        updateCreds(name, (c) => c.map((x) => (x.id === id ? { ...x, id: saved.id } : x)));
      }
      void refreshHealth([serviceIdOf(name)], true); // PATCH (api-key-wiring)
      return true;
    } catch (e) {
      console.warn("[Integrations] saveCredential failed", e);
      // Roll back the optimistic "connected" card and tell the user it failed.
      updateCreds(name, (c) => [...previousKeys, ...c.filter((x) => x.id !== id)]);
      alert(`Could not save the ${name} API key: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  };

  // OAuth start: popup + state. The worker (lifeos1-api) performs the provider
  // handoff and stores the tokens, so this can only succeed once that worker is
  // deployed and configured. Every failure is shown to the user (no silent return).
  const startOAuth = async (name: string, label: string) => {
    const account = (label.trim() || defaultAccountLabel || "me").trim();
    const provider = slugOf(name);
    if (!WORKER_OAUTH_PROVIDERS.has(provider)) {
      alert(
        `OAuth for ${name} is not available: the LifeOS worker has no "${provider}" OAuth provider implemented. Use an API key for this service instead.`
      );
      return;
    }
    // Sole local user: worker keys OAuth by owner UUID, not a typed third-party email.
    const ownerId = oauthUserId || user?.id || "";
    if (!ownerId) {
      alert("No local session yet. Reload the app and try again.");
      return;
    }
    if (account && account.includes("@")) rememberOAuthOwnerEmail(account);

    // Open the popup now, while the click still counts as a user gesture. (The
    // old "noopener" feature made window.open return null even on success, which
    // also sent this tab to the worker URL.)
    const popup = window.open("", `oauth_${provider}`, "width=600,height=700");

    const preflight = await checkOAuthWorker(ownerId, provider);
    if (!preflight.ok) {
      popup?.close();
      alert(`Could not start ${name} OAuth.\n\n${preflight.error}\n\nNothing was connected.`);
      return;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const state = generateState();

    updateCreds(name, (c) => [
      {
        id,
        label: account,
        type: "oauth",
        status: "pending",
        provider,
        addedAt: Date.now(),
        oauthState: state,
      },
      ...c,
    ]);
    setModalFor(null);

    const startUrl = `${WORKER_BASE}/api/oauth/start?provider=${encodeURIComponent(
      provider
    )}&account_email=${encodeURIComponent(account)}&user_id=${encodeURIComponent(
      ownerId
    )}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(OAUTH_CALLBACK_URI)}`;

    if (popup && !popup.closed) {
      popup.location.href = startUrl;
    } else {
      // Popup blocked: continue in this tab. The pending card is already saved.
      window.location.href = startUrl;
      return;
    }

    // The worker's /api/oauth/callback page posts
    // { type: "oauth-complete", provider, success, state, error } to this window.
    let workerOrigin = "";
    try {
      workerOrigin = new URL(WORKER_BASE).origin;
    } catch {
      // WORKER_BASE is always a full URL; ignore.
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== workerOrigin && event.origin !== window.location.origin) return;
      const msg = event.data as { type?: string; provider?: string; success?: boolean; state?: string; error?: string } | null;
      if (!msg || msg.type !== "oauth-complete") return;
      if (msg.state ? msg.state !== state : msg.provider !== provider) return;
      updateCreds(name, (c) =>
        c.map((x) =>
          x.id === id
            ? msg.success
              ? { ...x, status: "connected" as const, lastSync: "OAuth connected", lastSyncedAt: Date.now(), syncError: undefined }
              : { ...x, syncError: `OAuth failed: ${msg.error || "unknown error"}` }
            : x
        )
      );
      window.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);

    // Safety: clean up listener after 5 min
    setTimeout(() => window.removeEventListener("message", onMessage), 5 * 60 * 1000);
  };

  // Manual status check
    const checkOAuth = async (name: string, cred: Credential) => {
      if (!cred.provider) return;
      if (!oauthUserId) {
        updateCreds(name, (c) =>
          c.map((x) => (x.id === cred.id ? { ...x, syncError: "No local owner id - reload and reconnect" } : x))
        );
        return;
      }
      try {
        const res = await lifeosApi(`/api/oauth/status?provider=${encodeURIComponent(
          cred.provider
        )}&user_id=${encodeURIComponent(oauthUserId)}&account_email=${encodeURIComponent(
          cred.label
        )}&state=${encodeURIComponent(cred.oauthState || "")}`, { method: "GET" });
        const resData = res as Record<string, unknown>;
        const ok = isOAuthConnected(resData);
        updateCreds(name, (c) =>
          c.map((x) =>
            x.id === cred.id
              ? {
                  ...x,
                  status: ok ? "connected" : "pending",
                  lastSync: ok ? "OAuth connected" : x.lastSync,
                  lastSyncedAt: ok ? Date.now() : x.lastSyncedAt,
                  syncError: ok ? undefined : (resData && ((resData.message as string) || (resData.error as string))) || "Not connected yet",
                }
              : x
          )
        );
    } catch (e) {
      updateCreds(name, (c) =>
        c.map((x) =>
          x.id === cred.id
            ? { ...x, syncError: `Worker unreachable: ${e instanceof Error ? e.message : String(e)}` }
            : x
        )
      );
    }
  };

  // Live sync
  const syncCred = async (name: string, cred: Credential) => {
    const route = SYNC_ROUTES[name];
    if (!route) {
      updateCreds(name, (c) =>
        c.map((x) =>
          x.id === cred.id ? { ...x, syncError: "No live endpoint wired yet" } : x
        )
      );
      return;
    }
    setSyncingId(cred.id);
        try {
          const res = await lifeosApi(route.url, {
            headers: { "X-User-Id": oauthUserId },
          });
          const resData = res as Record<string, unknown>;
          updateCreds(name, (c) =>
            c.map((x) =>
              x.id === cred.id
                ? {
                    ...x,
                    lastSync: route.summarize(resData),
                    lastSyncedAt: Date.now(),
                    syncError: undefined,
                  }
                : x
            )
          );
    } catch (e) {
      updateCreds(name, (c) =>
        c.map((x) =>
          x.id === cred.id
            ? { ...x, syncError: e instanceof Error ? e.message : "Sync failed" }
            : x
        )
      );
    } finally {
      setSyncingId(null);
    }
  };

  const removeCred = async (name: string, id: string) => {
    const cred = data?.[name]?.find((c) => c.id === id);
    updateCreds(name, (c) => c.filter((x) => x.id !== id));
    // Only API-key cards map to a public.keys row; OAuth cards live locally + in the worker.
    if (cred && cred.type === "apikey") {
      try {
        await deleteCredential(user.id, name);
      } catch (e) {
        updateCreds(name, (c) => [cred, ...c]);
        alert(`Could not delete the ${name} API key: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  const openModal = (name: string, mode: "apikey" | "oauth") => {
    setModalMode(mode);
    setModalFor(name);
    if (mode === "apikey" && user?.id && !isKeyEncryptionUnlocked(user.id)) {
      needsKeyEncryptionSetup(user.id)
        .then(setEncSetupNeeded)
        .catch(() => setEncSetupNeeded(false));
    }
  };

  return (
    <PanelLayout>
      {/* Toolbar */}
      <div className="shrink-0 flex flex-col gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: "oklch(0.12 0.04 20 / 60%)",
            border: "1px solid oklch(0.55 0.22 20 / 25%)",
          }}
        >
          <Search size={14} className="text-white/40 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations…"
            className="bg-transparent outline-none text-white/80 placeholder:text-white/30 text-xs w-full font-display tracking-wide"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="shrink-0 px-3 py-1 rounded-md text-[10px] font-display tracking-widest uppercase transition-all cursor-pointer"
                style={{
                  background: isActive ? "oklch(0.55 0.22 20 / 30%)" : "oklch(0.12 0.04 20 / 40%)",
                  border: isActive ? "1px solid oklch(0.55 0.22 20 / 60%)" : "1px solid oklch(0.55 0.22 20 / 15%)",
                  color: isActive ? "oklch(0.75 0.22 20)" : "oklch(0.6 0.05 20)",
                  boxShadow: isActive ? "0 0 8px oklch(0.55 0.22 20 / 30%)" : "none",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 text-[10px] font-display tracking-widest" style={{ color: TEAL_LABEL }}>
        {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        {activeCategory !== "All" && ` in ${activeCategory}`}
        {search && ` for "${search}"`}
        {loadError && ` - could not load saved keys: ${loadError}`}
        {healthError && !/not linked/i.test(healthError) && ` - live status unavailable: ${healthError}`}
        {loadingCreds && " · loading credentials…"}
      </div>

      <OwnerLinkBar onLinked={() => setOwnerRev((n) => n + 1)} />
      {isAuthenticated && oauthUserId ? (
        <div className="shrink-0 text-[10px] font-display tracking-widest text-emerald-400/70" title={oauthUserId}>
          Connected as you - owner {oauthUserId.slice(0, 8)}...
        </div>
      ) : (
        <div className="shrink-0 text-[10px] font-display tracking-widest text-white/40">
          Waiting for local session…
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/30 text-xs font-display tracking-widest">
            No integrations found
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((integration) => (
              <IntegrationCard
                key={integration.name}
                integration={integration}
                creds={data?.[integration.name] || []}
                syncingId={syncingId}
                onOpenApiKey={() => openModal(integration.name, "apikey")}
                onOpenOAuth={() => openModal(integration.name, "oauth")}
                onRemove={(id) => removeCred(integration.name, id)}
                onSync={(c) => syncCred(integration.name, c)}
                onCheckOAuth={(c) => checkOAuth(integration.name, c)}
                health={health[serviceIdOf(integration.name)]}
                onAddConnector={() => {
                  const h = health[serviceIdOf(integration.name)];
                  const oauthable = OAUTH_SERVICES.has(integration.name) && WORKER_OAUTH_PROVIDERS.has(slugOf(integration.name));
                  openModal(integration.name, oauthable && !h?.secret ? "oauth" : "apikey");
                }}
              />
            ))}
          </div>
        )}
      </div>

      {modalFor && (
        <ConnectModal
          name={modalFor}
          canOAuth={OAUTH_SERVICES.has(modalFor)}
          mode={modalMode}
          defaultLabel={defaultAccountLabel}
          onClose={() => setModalFor(null)}
          needsPassphrase={false}
          needsConfirm={encSetupNeeded}
          onSaveKey={(label, key, passphrase, confirmPassphrase) =>
            addApiKey(modalFor, label, key, passphrase, confirmPassphrase)
          }
          onStartOAuth={async (label) => startOAuth(modalFor, label)}
        />
      )}
    </PanelLayout>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
type IntegrationCardProps = {
  integration: Integration;
  creds: Credential[];
  syncingId: string | null;
  onOpenApiKey: () => void;
  onOpenOAuth: () => void;
  onRemove: (id: string) => void;
  onSync: (c: Credential) => void;
  onCheckOAuth: (c: Credential) => void;
  health?: Health;
  onAddConnector: () => void;
};

function IntegrationCard({
  integration,
  creds,
  syncingId,
  onOpenApiKey,
  onOpenOAuth,
  onRemove,
  onSync,
  onCheckOAuth,
  health,
  onAddConnector,
}: IntegrationCardProps) {
  const canApikey = true; // most services accept API keys; OAuth is additive
  const canOAuth = OAUTH_SERVICES.has(integration.name);
  const connectedCount = creds.filter((c) => c.status === "connected").length;
  const live = health?.status === "connected";
  const broken = health?.status === "auth_error" || health?.status === "failing";

  return (
    <div
      className="glass-crimson rounded-xl p-3 flex flex-col gap-2.5 group transition-all duration-200 hover:scale-[1.01]"
      style={{
        background: "oklch(0.1 0.04 20 / 55%)",
        border: "1px solid oklch(0.55 0.22 20 / 20%)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{integration.icon}</span>
          <div>
            <p className="text-white/80 text-xs font-display tracking-wide leading-tight">
              {integration.name}
            </p>
            <span className="text-[9px] font-display tracking-widest uppercase" style={{ color: "hsl(var(--teal))" }}>
              {integration.category}
            </span>
          </div>
        </div>
        <span
          className="mt-0.5 shrink-0 flex items-center gap-1 text-[9px] font-display tracking-widest"
          style={{ color: connectedCount > 0 || live ? "oklch(0.72 0.18 145)" : broken ? HEALTH_COLOR.auth_error : "oklch(0.55 0 0 / 0.4)" }}
        >
          {broken && connectedCount === 0 ? (
            <AlertTriangle size={13} style={{ color: HEALTH_COLOR.auth_error }} />
          ) : connectedCount > 0 || live ? (
            <CheckCircle2 size={13} style={{ color: "oklch(0.72 0.18 145)", filter: "drop-shadow(0 0 4px oklch(0.72 0.18 145 / 70%))" }} />
          ) : (
            <Circle size={13} className="text-white/20" />
          )}
          {connectedCount > 0 ? `${connectedCount}●` : ""}
        </span>
      </div>

      <p className="text-white/50 text-[10px] leading-relaxed font-display tracking-wide line-clamp-2">
        {integration.desc}
      </p>

      {health && health.status !== "no_check" && health.status !== "not_configured" && (
        <div className="flex items-start gap-1.5 text-[8px] leading-snug" title={health.reason} data-testid="integration-health">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[3px]" style={{ background: HEALTH_COLOR[health.status] }} />
          <span className="text-white/45 min-w-0 break-words line-clamp-3">
            <span style={{ color: HEALTH_COLOR[health.status] }}>{HEALTH_LABEL[health.status]}</span>
            {health.secret ? ` · worker secret ${health.secret} ••••••••` : ""}
            {health.oauth
              ? ` · OAuth ${health.oauth.accounts ? `${health.oauth.accounts} account(s)` : health.oauth.client_configured ? "ready" : "client not set"}`
              : ""}
            {health.reason ? ` · ${health.reason}` : ""}
          </span>
        </div>
      )}

      {creds.length > 0 && (
        <div className="flex flex-col gap-1">
          {creds.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 px-2 py-1 rounded-md"
              style={{ background: "oklch(1 0 0 / 3%)", border: "1px solid oklch(0.55 0.22 20 / 12%)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background:
                    c.status === "connected"
                      ? "oklch(0.72 0.18 145)"
                      : c.status === "pending"
                        ? "oklch(0.8 0.15 80)"
                        : "oklch(0.55 0.2 25 / 0.5)",
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-white/70 truncate font-display">{c.label}</div>
                <div className="text-[8px] text-white/30 truncate">
                  {c.type === "apikey" ? c.keyPreview : c.status}
                  {c.syncError && ` · ${c.syncError}`}
                </div>
              </div>
              {c.type === "oauth" && c.status === "pending" && (
                <button onClick={() => onCheckOAuth(c)} title="Check connection status" className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
                  <RefreshCw size={9} />
                </button>
              )}
              {(c.type === "apikey" || c.status === "connected") && SYNC_ROUTES[integration.name] && (
                <button onClick={() => onSync(c)} title="Pull live data" className="text-white/30 hover:text-white/70 transition-colors cursor-pointer">
                  {syncingId === c.id ? <Loader2 size={10} className="animate-spin" /> : <span className="text-base leading-none">🔄</span>}
                </button>
              )}
              <button onClick={() => onRemove(c.id)} title="Remove account" className="text-white/25 hover:text-primary transition-colors cursor-pointer">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 mt-auto">
        {/* PATCH (api-key-wiring): OAuth redirect for OAuth providers, else validate-then-save */}
        <button
          onClick={onAddConnector}
          title="Connect and verify"
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-display tracking-widest uppercase transition-all cursor-pointer hover:brightness-110 active:scale-95"
          style={{ background: "oklch(0.72 0.18 145 / 12%)", border: "1px solid oklch(0.72 0.18 145 / 32%)", color: "oklch(0.8 0.15 145)" }}
        >
          <Plug size={9} />
          ADD CONNECTOR
        </button>
        {canApikey && (
          <button
            onClick={onOpenApiKey}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-display tracking-widest uppercase transition-all cursor-pointer hover:brightness-110 active:scale-95"
            style={{ background: "oklch(0.55 0.22 20 / 18%)", border: "1px solid oklch(0.55 0.22 20 / 35%)", color: "oklch(0.78 0.18 20)" }}
          >
            <Key size={9} />
            API KEY
          </button>
        )}
        {canOAuth && (
          <button
            onClick={onOpenOAuth}
            disabled={!WORKER_CONFIGURED}
            title={!WORKER_CONFIGURED ? "Set VITE_WORKER_URL in .env" : "Connect via OAuth"}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-display tracking-widest uppercase transition-all cursor-pointer hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "hsl(var(--teal) / 0.12)", border: "1px solid hsl(var(--teal) / 0.30)", color: "hsl(var(--teal))" }}
          >
            <RefreshCw size={9} />
            OAUTH
          </button>
        )}
      </div>
    </div>
  );
}

// ── Connect modal ───────────────────────────────────────────────────────────
type ConnectModalProps = {
  name: string;
  canOAuth: boolean;
  mode: "apikey" | "oauth";
  /** Prefill for sole local user (you). */
  defaultLabel?: string;
  onClose: () => void;
  needsPassphrase: boolean;
  needsConfirm: boolean;
  onSaveKey: (
    label: string,
    key: string,
    passphrase?: string,
    confirmPassphrase?: string
  ) => Promise<boolean>;
  onStartOAuth: (label: string) => Promise<void>;
};

function ConnectModal({
  name,
  canOAuth,
  mode,
  defaultLabel = "me",
  needsPassphrase,
  needsConfirm,
  onClose,
  onSaveKey,
  onStartOAuth,
}: ConnectModalProps) {
  const [label, setLabel] = useState(defaultLabel || "me");
  const [key, setKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [starting, setStarting] = useState(false);

  const submit = () => {
    if (mode === "apikey") {
      setStarting(true);
      onSaveKey(
        label.trim() || defaultLabel || "me",
        key,
        needsPassphrase ? passphrase : undefined,
        needsPassphrase && needsConfirm ? confirmPassphrase : undefined
      )
        .then((ok) => {
          setStarting(false);
          if (ok) onClose();
        })
        .catch(() => setStarting(false));
    } else {
      setStarting(true);
      onStartOAuth(label.trim() || defaultLabel || "me").finally(() => setStarting(false));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: "oklch(0 0 0 / 80%)" }} onClick={onClose}>
      <div className="glass rounded-2xl border w-full max-w-md overflow-hidden flex flex-col" style={{ borderColor: "oklch(0.55 0.22 20 / 25%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "oklch(0.55 0.22 20 / 15%)" }}>
          <span className="font-display text-sm tracking-wider" style={{ color: "oklch(0.62 0.22 20)" }}>
            CONNECT · {name.toUpperCase()}
          </span>
          <button onClick={onClose} className="text-white/30 hover:text-primary transition-colors">✕</button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto">
          <p className="text-[10px] text-white/30 leading-relaxed">
            {canOAuth
              ? "Connect this service to your LifeOS account (you). Optional label is only for which of your accounts - not another person."
              : "Save an API key for your account. Label defaults to you."}
          </p>

          <div>
            <label className="text-[9px] font-display tracking-wider block mb-1" style={{ color: "hsl(var(--teal))" }}>
              YOUR LABEL (OPTIONAL)
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="me"
              className="w-full h-8 px-3 text-xs rounded-lg text-white/85 placeholder:text-white/20 focus:outline-none"
              style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
            />
          </div>

          {mode === "apikey" && (
            <div>
              <label className="text-[9px] font-display tracking-wider block mb-1" style={{ color: "hsl(var(--teal))" }}>
                API KEY
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-…"
                className="w-full h-8 px-3 text-xs rounded-lg text-white/85 placeholder:text-white/20 focus:outline-none"
                style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
              />
            </div>
          )}

          {mode === "apikey" && needsPassphrase && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] leading-relaxed" style={{ color: "oklch(0.8 0.15 80)" }}>
                {needsConfirm
                  ? "Create a master password. API keys are encrypted in your browser (AES-256-GCM) before they are saved, and this password is never stored or sent anywhere, so it cannot be recovered."
                  : "Key encryption is locked. Enter your master password to encrypt this key before it is saved. It is kept in memory only until you reload or sign out."}
              </p>
              <div>
                <label className="text-[9px] font-display tracking-wider block mb-1" style={{ color: "hsl(var(--teal))" }}>
                  MASTER PASSWORD
                </label>
                <input
                  type="password"
                  autoComplete={needsConfirm ? "new-password" : "current-password"}
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full h-8 px-3 text-xs rounded-lg text-white/85 placeholder:text-white/20 focus:outline-none"
                  style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
                />
              </div>
              {needsConfirm && (
                <div>
                  <label className="text-[9px] font-display tracking-wider block mb-1" style={{ color: "hsl(var(--teal))" }}>
                    CONFIRM MASTER PASSWORD
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    className="w-full h-8 px-3 text-xs rounded-lg text-white/85 placeholder:text-white/20 focus:outline-none"
                    style={{ background: "oklch(1 0 0 / 4%)", border: "1px solid oklch(0.55 0.22 20 / 15%)" }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: "oklch(0.55 0.22 20 / 15%)" }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg glass text-white/50 text-xs font-display hover:text-white/80 transition-all">
            CANCEL
          </button>
          <button
            onClick={submit}
            disabled={
              mode === "apikey"
                ? !key.trim() ||
                  starting ||
                  (needsPassphrase && (passphrase.length < 8 || (needsConfirm && !confirmPassphrase)))
                : starting
            }
            className="px-4 py-2 rounded-lg glass-crimson text-primary text-xs font-display hover:glow-crimson-sm transition-all disabled:opacity-40"
          >
            {mode === "apikey" ? (starting ? "SAVING..." : "SAVE KEY") : starting ? "STARTING…" : "CONNECT"}
          </button>
        </div>
      </div>
    </div>
  );
}