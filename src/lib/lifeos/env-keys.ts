import { readFile } from "node:fs/promises";
import { createServerFn } from "@tanstack/react-start";

const SERVICE_ENV: Record<string, string[]> = {
  NVIDIA: ["NVIDIA_API_KEY", "NVAPI_KEY", "VITE_NVIDIA_API_KEY"],
  ElevenLabs: ["ELEVENLABS_API_KEY", "VITE_ELEVENLABS_API_KEY"],
  "Cloudflare Account": ["CF_ACCOUNT_ID", "CLOUDFLARE_ACCOUNT_ID"],
  "Cloudflare Token": ["CF_API_TOKEN", "CLOUDFLARE_API_TOKEN"],
  Luma: ["LUMA_API_KEY", "VITE_LUMA_API_KEY"],
  Nylas: ["NYLAS_API_KEY", "NYLAS_GRANT_KEY_CEOGPS", "NYLAS_GRANT_KEY_CAGEDNREALITY", "NYLAS_GRANT_KEY_CHRISGR33NINC"],
  Discord: ["DISCORD_CLIENT_SECRET"],
  Bing: ["BING_SEARCH_API_KEY", "BING_API_KEY"],
  Brave: ["BRAVE_SEARCH_API_KEY", "BRAVE_API_KEY"],
  Dogpile: ["DOGPILE_API_KEY"],
  Instagram: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_API_KEY"],
  LinkedIn: ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_API_KEY"],
  Snapchat: ["SNAPCHAT_API_KEY", "SNAPCHAT_ACCESS_TOKEN"],
  TikTok: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_API_KEY"],
  Yahoo: ["YAHOO_API_KEY", "YAHOO_CLIENT_SECRET"],
  Reddit: ["REDDIT_ACCESS_TOKEN", "REDDIT_API_KEY"],
  X: ["X_ACCESS_TOKEN", "TWITTER_ACCESS_TOKEN"],
  YouTube: ["YOUTUBE_DATA_V3_API_KEY", "VITE_YOUTUBE_API_KEY", "YOUTUBE_API_KEY"],
  OpenAI: ["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"],
  Anthropic: ["ANTHROPIC_API_KEY"],
  xAI: ["XAI_API_KEY", "GROK_API_KEY"],
  Telegram: ["TELEGRAM_BOT_TOKEN"],
  "Google Analytics": ["GA_PROPERTY_ID", "GOOGLE_ANALYTICS_PROPERTY"],
  "Search Console": ["SEARCH_CONSOLE_SITE", "GSC_SITE_URL"],
  "Brilliant Directories": ["BRILLIANT_API_KEY", "BD_API_KEY"],
  "Brilliant Site": ["BRILLIANT_SITE", "BD_SITE"],
  GoDaddy: ["GODADDY_API_KEY", "GODADDY_KEY"],
  "GoDaddy Secret": ["GODADDY_API_SECRET", "GODADDY_SECRET"],
  Supabase: ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  "Facebook App ID": ["FACEBOOK_APP_ID", "VITE_FACEBOOK_APP_ID"],
  SendGrid: ["SENDGRID_API_KEY"],
  Brevo: ["BREVO_API_KEY"],
  Spotify: ["SPOTIFY_CLIENT_SECRET", "SPOTIFY_CLIENT_ID"],
  Replicate: ["REPLICATE_API_TOKEN", "VITE_REPLICATE_API_KEY"],
};

function parseEnv(text: string, into: Record<string, string>) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (name && value && !into[name]) into[name] = value;
  }
}

async function envBag() {
  const bag: Record<string, string> = {};
  for (const path of [".env", ".env.local", ".dev.vars"]) {
    try { parseEnv(await readFile(path, "utf8"), bag); } catch { /* missing */ }
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (value && !bag[name]) bag[name] = value;
  }
  return bag;
}

export const loadEnvKeys = createServerFn({ method: "GET" }).handler(async () => {
  const bag = await envBag();
  const rows: { name: string; value: string }[] = [];
  for (const [name, aliases] of Object.entries(SERVICE_ENV)) {
    const value = aliases.map((alias) => bag[alias]?.trim() || "").find(Boolean);
    if (value) rows.push({ name, value: value.slice(0, 400) });
  }
  return rows;
});

export const pullWithKey = createServerFn({ method: "POST" })
  .validator((input: { name: string; key: string }) => ({
    name: String(input?.name || "").slice(0, 40),
    key: String(input?.key || "").trim().slice(0, 400),
  }))
  .handler(async ({ data }) => {
    if (!data.key) return { ok: false as const, text: "No key saved." };
    try {
      if (data.name === "Stripe") {
        const response = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${data.key}` } });
        const body = await response.json() as { available?: { amount: number; currency: string }[]; error?: { message?: string } };
        if (!response.ok) return { ok: false as const, text: body.error?.message || "Stripe refused the key." };
        const row = body.available?.[0];
        return { ok: true as const, text: row ? `${row.currency.toUpperCase()} ${(row.amount / 100).toFixed(2)} available` : "Stripe connected. No available balance.", balance: row ? row.amount / 100 : 0 };
      }
      if (data.name === "Nylas") {
        const grants = await fetch("https://api.us.nylas.com/v3/grants?limit=5", { headers: { Authorization: `Bearer ${data.key}`, Accept: "application/json" } });
        const body = await grants.json() as { data?: { id: string; email?: string }[]; error?: { message?: string } };
        if (!grants.ok) return { ok: false as const, text: body.error?.message || "Nylas refused the key." };
        const grant = body.data?.[0];
        if (!grant) return { ok: true as const, text: "Nylas key accepted. No grant is connected." };
        const messages = await fetch(`https://api.us.nylas.com/v3/grants/${grant.id}/messages?limit=5`, { headers: { Authorization: `Bearer ${data.key}`, Accept: "application/json" } });
        const mail = await messages.json() as { data?: { id: string; subject?: string; snippet?: string; date?: number }[] };
        return { ok: true as const, text: `${grant.email || "Grant"} · ${mail.data?.length || 0} recent messages`, messages: (mail.data || []).map((row) => ({ title: row.subject || "No subject", body: row.snippet || "", at: row.date ? new Date(row.date * 1000).toISOString() : new Date().toISOString() })) };
      }
      if (data.name === "YouTube") {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=atlanta&key=${encodeURIComponent(data.key)}`);
        const body = await response.json() as { items?: { id?: { videoId?: string }; snippet?: { title?: string } }[]; error?: { message?: string } };
        if (!response.ok) return { ok: false as const, text: body.error?.message || "YouTube refused the key." };
        return { ok: true as const, text: `${body.items?.length || 0} videos`, videos: (body.items || []).map((row) => ({ title: row.snippet?.title || "Video", href: `https://www.youtube.com/watch?v=${row.id?.videoId || ""}` })).filter((row) => row.href.includes("v=")) };
      }
      if (data.name === "ElevenLabs") {
        const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": data.key } });
        const body = await response.json() as { voices?: { name: string }[]; detail?: { message?: string } };
        if (!response.ok) return { ok: false as const, text: body.detail?.message || "ElevenLabs refused the key." };
        return { ok: true as const, text: (body.voices || []).slice(0, 6).map((row) => row.name).join(", ") || "No voices" };
      }
      return { ok: true as const, text: "Key is loaded. This service has no live pull yet." };
    } catch (error) {
      return { ok: false as const, text: error instanceof Error ? error.message : "Pull failed." };
    }
  });

export type MusicHit = { id: string; title: string; artist: string; album: string; url: string; preview: string; art: string };

function asTrack(row: { id?: string; name?: string; preview_url?: string; external_urls?: { spotify?: string }; artists?: { name?: string }[]; album?: { name?: string; images?: { url?: string }[] } }): MusicHit {
  return {
    id: row.id || "",
    title: row.name || "Track",
    artist: (row.artists || []).map((item) => item.name || "").filter(Boolean).join(", "),
    album: row.album?.name || "",
    url: row.external_urls?.spotify || "",
    preview: row.preview_url || "",
    art: row.album?.images?.[0]?.url || "",
  };
}

export const spotifyHub = createServerFn({ method: "POST" })
  .validator((input: { token?: string; action?: string; query?: string }) => ({
    token: String(input?.token || "").trim().slice(0, 4000),
    action: input?.action === "search" ? "search" : "home",
    query: String(input?.query || "").trim().slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const empty = { ok: false as const, error: "", tracks: [] as MusicHit[], playlists: [] as { id: string; name: string; url: string }[], now: "" };
    if (!data.token && data.action !== "search") return { ...empty, error: "Connect Spotify in Integrations." };
    let token = data.token;
    if (!token) {
      const bag = await envBag();
      const id = bag.SPOTIFY_CLIENT_ID || bag.VITE_SPOTIFY_CLIENT_ID || "";
      const secret = bag.SPOTIFY_CLIENT_SECRET || "";
      if (id && secret) {
        const issued = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: "grant_type=client_credentials",
        });
        const auth = await issued.json() as { access_token?: string };
        token = auth.access_token || "";
      }
    }
    if (!token && data.action === "search") {
      const found = await fetch(`https://itunes.apple.com/search?entity=song&limit=12&term=${encodeURIComponent(data.query || "music")}`);
      const body = await found.json() as { results?: { trackId?: number; trackName?: string; artistName?: string; collectionName?: string; previewUrl?: string; trackViewUrl?: string; artworkUrl100?: string }[] };
      return {
        ok: true as const,
        error: "Spotify search needs a connected account or Spotify client keys. Showing previews instead.",
        tracks: (body.results || []).map((row) => ({ id: String(row.trackId || ""), title: row.trackName || "Track", artist: row.artistName || "", album: row.collectionName || "", url: row.trackViewUrl || "", preview: row.previewUrl || "", art: row.artworkUrl100 || "" })),
        playlists: [],
        now: "",
      };
    }
    if (!token) return { ...empty, error: "Connect Spotify in Integrations." };
    const headers = { Authorization: `Bearer ${token}` };
    const pull = async (path: string) => {
      const response = await fetch(`https://api.spotify.com/v1${path}`, { headers });
      const body = await response.json() as { error?: { message?: string } };
      return { ok: response.ok, body };
    };
    if (data.action === "search") {
      const result = await pull(`/search?type=track,album&limit=12&market=US&q=${encodeURIComponent(data.query || "music")}`);
      if (!result.ok) return { ...empty, error: result.body.error?.message || "Spotify refused the search. Reconnect it in Integrations." };
      const body = result.body as { tracks?: { items?: Parameters<typeof asTrack>[0][] }; albums?: { items?: { id?: string; name?: string; external_urls?: { spotify?: string }; artists?: { name?: string }[]; images?: { url?: string }[] }[] } };
      const tracks = (body.tracks?.items || []).map(asTrack);
      const albums = (body.albums?.items || []).map((row) => ({ id: row.id || "", title: row.name || "Album", artist: (row.artists || []).map((item) => item.name || "").filter(Boolean).join(", "), album: "Album", url: row.external_urls?.spotify || "", preview: "", art: row.images?.[0]?.url || "" }));
      return { ok: true as const, error: tracks.length || albums.length ? "Spotify results" : "No Spotify matches.", tracks: [...tracks, ...albums], playlists: [], now: "" };
    }
    const [lists, top, recent, playing] = await Promise.all([
      pull("/me/playlists?limit=20"),
      pull("/me/top/tracks?limit=8"),
      pull("/me/player/recently-played?limit=8"),
      pull("/me/player/currently-playing"),
    ]);
    if (!lists.ok && !top.ok) return { ...empty, error: lists.body.error?.message || "Reconnect Spotify in Integrations so the library can load." };
    const playlists = ((lists.body as { items?: { id?: string; name?: string; external_urls?: { spotify?: string } }[] }).items || []).map((row) => ({ id: row.id || "", name: row.name || "Playlist", url: row.external_urls?.spotify || "" }));
    const topTracks = ((top.body as { items?: Parameters<typeof asTrack>[0][] }).items || []).map(asTrack);
    const recentTracks = ((recent.body as { items?: { track?: Parameters<typeof asTrack>[0] }[] }).items || []).map((row) => asTrack(row.track || {}));
    const current = (playing.body as { item?: Parameters<typeof asTrack>[0] }).item;
    const now = current ? `${current.name || "Track"} · ${(current.artists || []).map((item) => item.name).filter(Boolean).join(", ")}` : "";
    const seen = new Set<string>();
    const tracks = [...(current ? [asTrack(current)] : []), ...recentTracks, ...topTracks].filter((row) => {
      if (!row.title || seen.has(row.id || row.title)) return false;
      seen.add(row.id || row.title);
      return true;
    });
    return { ok: true as const, error: "", tracks, playlists, now };
  });

export const pullProvider = createServerFn({ method: "POST" })
  .validator((input: { provider: string; token: string }) => ({
    provider: String(input?.provider || "").slice(0, 20),
    token: String(input?.token || "").trim().slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    if (!data.token) return { ok: false as const, text: "Not connected." };
    const headers = { Authorization: `Bearer ${data.token}` };
    try {
      if (data.provider === "google") {
        const [who, calendar] = await Promise.all([
          fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers }),
          fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(new Date().toISOString())}`, { headers }),
        ]);
        const profile = await who.json() as { email?: string; name?: string; error?: { message?: string } };
        const events = await calendar.json() as { items?: { summary?: string; start?: { dateTime?: string; date?: string } }[]; error?: { message?: string } };
        if (!who.ok) return { ok: false as const, text: profile.error?.message || "Google refused the session." };
        return {
          ok: true as const,
          text: `${profile.name || profile.email || "Google"} · ${events.items?.length || 0} upcoming events`,
          events: (events.items || []).map((item) => ({ title: item.summary || "Event", when: item.start?.dateTime || item.start?.date || "" })),
        };
      }
      if (data.provider === "discord") {
        const response = await fetch("https://discord.com/api/users/@me", { headers });
        const profile = await response.json() as { username?: string; global_name?: string; email?: string; message?: string };
        if (!response.ok) return { ok: false as const, text: profile.message || "Discord refused the session." };
        return { ok: true as const, text: [profile.global_name || profile.username, profile.email].filter(Boolean).join(" · ") || "Discord connected" };
      }
      if (data.provider === "facebook") {
        const response = await fetch("https://graph.facebook.com/me?fields=id,name,email", { headers });
        const profile = await response.json() as { name?: string; email?: string; error?: { message?: string } };
        if (!response.ok) return { ok: false as const, text: profile.error?.message || "Facebook refused the session." };
        return { ok: true as const, text: [profile.name, profile.email].filter(Boolean).join(" · ") || "Facebook connected" };
      }
      const [me, top] = await Promise.all([
        fetch("https://api.spotify.com/v1/me", { headers }),
        fetch("https://api.spotify.com/v1/me/top/tracks?limit=5", { headers }),
      ]);
      const profile = await me.json() as { display_name?: string; email?: string; error?: { message?: string } };
      const tracks = await top.json() as { items?: { name: string; external_urls?: { spotify?: string } }[] };
      if (!me.ok) return { ok: false as const, text: profile.error?.message || "Spotify refused the session." };
      return {
        ok: true as const,
        text: `${profile.display_name || profile.email || "Spotify"} · ${tracks.items?.length || 0} top tracks`,
        tracks: (tracks.items || []).map((item) => ({ title: item.name, url: item.external_urls?.spotify || "" })),
      };
    } catch (error) {
      return { ok: false as const, text: error instanceof Error ? error.message : "Pull failed." };
    }
  });

export const connectAccount = createServerFn({ method: "POST" })
  .validator((input: { service?: string; token?: string; key?: string; secret?: string; site?: string }) => ({
    service: String(input?.service || "").slice(0, 40),
    token: String(input?.token || "").slice(0, 4000),
    key: String(input?.key || "").trim().slice(0, 400),
    secret: String(input?.secret || "").trim().slice(0, 400),
    site: String(input?.site || "").trim().slice(0, 200),
  }))
  .handler(async ({ data }) => {
    try {
      if (data.service === "search-console") {
        if (!data.token) return { ok: false as const, text: "Connect Google first.", site: "" };
        const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${data.token}` }, signal: AbortSignal.timeout(10000) });
        const body = await response.json() as { siteEntry?: { siteUrl?: string }[]; error?: { message?: string } };
        if (!response.ok) return { ok: false as const, text: body.error?.message || "Search Console refused this Google login. Reconnect Google.", site: "" };
        const sites = (body.siteEntry || []).map((row) => row.siteUrl || "").filter(Boolean);
        const site = sites.find((row) => row.includes("ceogps.com")) || sites[0] || "";
        return { ok: true as const, text: sites.length ? sites.slice(0, 4).join(" · ") : "No Search Console sites are on this Google login.", site };
      }
      if (data.service === "google-analytics") {
        if (!data.token) return { ok: false as const, text: "Connect Google first.", site: "" };
        const response = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", { headers: { Authorization: `Bearer ${data.token}` }, signal: AbortSignal.timeout(10000) });
        const body = await response.json() as { accountSummaries?: { displayName?: string; propertySummaries?: { property?: string; displayName?: string }[] }[]; error?: { message?: string } };
        if (!response.ok) return { ok: false as const, text: body.error?.message || "Google Analytics refused this login. Reconnect Google.", site: "" };
        const properties = (body.accountSummaries || []).flatMap((account) => account.propertySummaries || []);
        const match = properties.find((row) => /ceogps|ceo gps/i.test(row.displayName || "")) || properties[0];
        const site = (match?.property || "").replace("properties/", "");
        return { ok: true as const, text: site ? `${match?.displayName || "Property"} · ${site}` : "No GA4 properties are on this Google login.", site };
      }
      if (data.service === "godaddy") {
        if (!data.key) return { ok: false as const, text: "Paste the GoDaddy key.", site: "" };
        const auth = data.secret ? `sso-key ${data.key}:${data.secret}` : `Bearer ${data.key}`;
        const response = await fetch("https://api.godaddy.com/v1/domains?statuses=ACTIVE&limit=20", { headers: { Authorization: auth, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
        const body = await response.json() as { domain?: string }[] | { message?: string };
        if (!response.ok || !Array.isArray(body)) return { ok: false as const, text: (body as { message?: string }).message || "GoDaddy refused the key.", site: "" };
        const names = body.map((row) => row.domain).filter(Boolean).slice(0, 3);
        return { ok: true as const, text: names.length ? `${body.length} domains · ${names.join(", ")}` : "GoDaddy connected. No active domains.", site: "" };
      }
      if (data.service === "brilliant") {
        if (!data.key || !data.site) return { ok: false as const, text: "Paste the site and the API key.", site: "" };
        const site = (/^https?:/i.test(data.site) ? data.site : `https://${data.site}`).replace(/\/$/, "");
        const response = await fetch(`${site}/api/v2/user/count`, { headers: { "X-Api-Key": data.key }, signal: AbortSignal.timeout(10000) });
        const body = await response.json() as { total?: number; count?: number; message?: string };
        if (!response.ok) return { ok: false as const, text: body.message || "Brilliant Directories refused the key.", site };
        return { ok: true as const, text: `${Number(body.total ?? body.count) || 0} members`, site };
      }
      return { ok: false as const, text: "Unknown account.", site: "" };
    } catch {
      return { ok: false as const, text: "That account did not answer.", site: "" };
    }
  });

type InboxRow = {
  id: string;
  title: string;
  body: string;
  at: string;
  folder: "inbox" | "sent" | "drafts" | "spam" | "archive" | "trash";
  from: string;
  to: string;
  starred: boolean;
  account: string;
};

function nylasFolder(folders: string[]): InboxRow["folder"] {
  const names = folders.map((name) => name.toUpperCase());
  if (names.some((name) => name.includes("TRASH") || name.includes("DELETED"))) return "trash";
  if (names.some((name) => name.includes("SPAM") || name.includes("JUNK"))) return "spam";
  if (names.some((name) => name.includes("DRAFT"))) return "drafts";
  if (names.some((name) => name.includes("SENT"))) return "sent";
  if (names.some((name) => name === "INBOX" || name.endsWith("/INBOX"))) return "inbox";
  if (names.some((name) => name.includes("ARCHIVE"))) return "archive";
  return "inbox";
}

function gmailFolder(labels: string[]): { folder: InboxRow["folder"]; starred: boolean } {
  const starred = labels.includes("STARRED");
  if (labels.includes("TRASH")) return { folder: "trash", starred };
  if (labels.includes("SPAM")) return { folder: "spam", starred };
  if (labels.includes("DRAFT")) return { folder: "drafts", starred };
  if (labels.includes("SENT")) return { folder: "sent", starred };
  return { folder: "inbox", starred };
}

export const pullInbox = createServerFn({ method: "POST" })
  .validator((input: { nylasKey?: string; googleToken?: string }) => ({
    nylasKey: String(input?.nylasKey || "").trim().slice(0, 400),
    googleToken: String(input?.googleToken || "").trim().slice(0, 4000),
  }))
  .handler(async ({ data }) => {
    const messages: InboxRow[] = [];
    const accounts: { email: string; name: string; provider: "gmail" | "imap" }[] = [];
    const notes: string[] = [];
    const bag = await envBag();
    const apiKey = (data.nylasKey.startsWith("nyk_") ? data.nylasKey : "") || bag.NYLAS_API_KEY || "";
    const grants = [...new Set([
      bag.NYLAS_GRANT_KEY_CEOGPS,
      bag.NYLAS_GRANT_KEY_CAGEDNREALITY,
      bag.NYLAS_GRANT_KEY_CHRISGR33NINC,
      data.nylasKey && !data.nylasKey.startsWith("nyk_") ? data.nylasKey : "",
    ].map((id) => String(id || "").trim()).filter(Boolean))];

    if (apiKey) {
      const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
      let ids = grants;
      if (!ids.length) {
        const listed = await fetch("https://api.us.nylas.com/v3/grants?limit=8", { headers });
        const body = await listed.json() as { data?: { id: string; email?: string }[]; error?: { message?: string } };
        if (!listed.ok) notes.push(body.error?.message || "Nylas refused the key.");
        else ids = (body.data || []).map((row) => row.id);
      }
      for (const id of ids.slice(0, 6)) {
        const response = await fetch(`https://api.us.nylas.com/v3/grants/${encodeURIComponent(id)}/messages?limit=20`, { headers });
        const body = await response.json() as {
          data?: { id?: string; subject?: string; snippet?: string; date?: number; folders?: string[]; from?: { name?: string; email?: string }[]; to?: { name?: string; email?: string }[] }[];
          error?: { message?: string };
        };
        if (!response.ok) { notes.push(body.error?.message || `Nylas grant ${id.slice(0, 8)} refused.`); continue; }
        const owner = (body.data || []).map((row) => (row.to || []).map((item) => item.email).find(Boolean) || "").find(Boolean) || "";
        if (owner) accounts.push({ email: owner, name: owner, provider: "imap" });
        for (const row of body.data || []) {
          const from = (row.from || []).map((item) => item.email || item.name || "").filter(Boolean).join(", ");
          const to = (row.to || []).map((item) => item.email || item.name || "").filter(Boolean).join(", ");
          messages.push({
            id: `nylas:${row.id || `${id}:${row.date || row.subject}`}`,
            title: row.subject || "No subject",
            body: row.snippet || "",
            at: row.date ? new Date(row.date * 1000).toISOString() : new Date().toISOString(),
            folder: nylasFolder(row.folders || []),
            from,
            to,
            starred: (row.folders || []).some((name) => name.toUpperCase().includes("STAR")),
            account: owner || to || from,
          });
        }
      }
      notes.push(ids.length ? `Nylas ${ids.length} mailbox${ids.length === 1 ? "" : "es"}.` : "Nylas key is set, but no grant is connected.");
    } else notes.push("Nylas key is not on the server.");

    if (data.googleToken) {
      const headers = { Authorization: `Bearer ${data.googleToken}` };
      const who = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers });
      const profile = await who.json() as { email?: string; name?: string; error?: { message?: string } };
      if (!who.ok) notes.push(profile.error?.message || "Google refused the session. Reconnect it in Integrations.");
      else {
        if ((profile.email || "").toLowerCase() !== "chrisgr33ninc@gmail.com") {
          notes.push(`Google is signed in as ${profile.email || "another account"}. Reconnect it as chrisgr33ninc@gmail.com.`);
        } else {
        if (profile.email) accounts.push({ email: profile.email, name: profile.name || profile.email, provider: "gmail" });
        const list = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20", { headers });
        const listed = await list.json() as { messages?: { id: string }[]; error?: { message?: string } };
        if (!list.ok) notes.push(listed.error?.message || "Gmail refused the session. Reconnect Google so mail can be read.");
        else {
          const rows = await Promise.all((listed.messages || []).map(async (item) => {
            const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To`, { headers });
            if (!response.ok) return null;
            const mail = await response.json() as { id?: string; snippet?: string; internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } };
            const header = (name: string) => mail.payload?.headers?.find((row) => row.name.toLowerCase() === name.toLowerCase())?.value || "";
            const place = gmailFolder(mail.labelIds || []);
            return {
              id: `gmail:${mail.id || item.id}`,
              title: header("Subject") || "No subject",
              body: mail.snippet || "",
              at: mail.internalDate ? new Date(Number(mail.internalDate)).toISOString() : new Date().toISOString(),
              folder: place.folder,
              from: header("From"),
              to: header("To") || profile.email || "",
              starred: place.starred,
              account: profile.email || "Gmail",
            } satisfies InboxRow;
          }));
          messages.push(...rows.filter((row): row is InboxRow => Boolean(row)));
          notes.push(`Gmail ${rows.filter(Boolean).length} messages.`);
        }
        }
      }
    } else notes.push("Google is not connected. Reconnect it in Integrations to pull Gmail.");

    return { ok: messages.length > 0, text: notes.join(" "), messages, accounts };
  });
