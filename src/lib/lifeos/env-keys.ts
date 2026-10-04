import { readFile } from "node:fs/promises";
import { createServerFn } from "@tanstack/react-start";

const SERVICE_ENV: Record<string, string[]> = {
  NVIDIA: ["NVIDIA_API_KEY", "NVAPI_KEY", "VITE_NVIDIA_API_KEY"],
  ElevenLabs: ["ELEVENLABS_API_KEY", "VITE_ELEVENLABS_API_KEY"],
  Stripe: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"],
  Luma: ["LUMA_API_KEY", "VITE_LUMA_API_KEY"],
  Nylas: ["NYLAS_API_KEY", "NYLAS_GRANT_KEY_CEOGPS", "NYLAS_GRANT_KEY_CAGEDNREALITY", "NYLAS_GRANT_KEY_CHRISGR33NINC"],
  YouTube: ["YOUTUBE_DATA_V3_API_KEY", "VITE_YOUTUBE_API_KEY", "YOUTUBE_API_KEY"],
  OpenAI: ["OPENAI_API_KEY", "VITE_OPENAI_API_KEY"],
  Anthropic: ["ANTHROPIC_API_KEY"],
  xAI: ["XAI_API_KEY", "GROK_API_KEY"],
  Telegram: ["TELEGRAM_BOT_TOKEN"],
  "Google Maps": ["GOOGLE_MAPS_API_KEY", "GOOGLE_API_KEY"],
  Supabase: ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
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
