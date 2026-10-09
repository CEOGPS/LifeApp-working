import { createFileRoute } from "@tanstack/react-router";
import { envBag } from "@/lib/lifeos/env-bag.server";

export const Route = createFileRoute("/api/oauth/exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({})) as { provider?: string; code?: string; redirect?: string };
        const provider = body.provider === "discord" ? "discord" : body.provider === "spotify" ? "spotify" : "";
        const code = String(body.code || "").slice(0, 2000);
        const redirect = String(body.redirect || "").slice(0, 300);
        if (!provider || !code || !redirect) return Response.json({ ok: false, text: "Missing the login code." }, { status: 400 });
        const bag = await envBag();
        try {
          if (provider === "spotify") {
            const id = bag.SPOTIFY_CLIENT_ID || "";
            const secret = bag.SPOTIFY_CLIENT_SECRET || "";
            const token = await fetch("https://accounts.spotify.com/api/token", {
              method: "POST",
              headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect }),
              signal: AbortSignal.timeout(12000),
            });
            const raw = await token.json() as { access_token?: string; refresh_token?: string; error_description?: string };
            if (!token.ok || !raw.access_token) return Response.json({ ok: false, text: raw.error_description || "Spotify refused the login." });
            const me = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${raw.access_token}` } });
            const profile = await me.json() as { display_name?: string; email?: string };
            return Response.json({ ok: true, provider, email: profile.email || "", name: profile.display_name || "Spotify", token: raw.access_token, refresh: raw.refresh_token || "" });
          }
          const id = bag.DISCORD_CLIENT_ID || "";
          const secret = bag.DISCORD_CLIENT_SECRET || "";
          const token = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "authorization_code", code, redirect_uri: redirect }),
            signal: AbortSignal.timeout(12000),
          });
          const raw = await token.json() as { access_token?: string; refresh_token?: string; error_description?: string };
          if (!token.ok || !raw.access_token) return Response.json({ ok: false, text: raw.error_description || "Discord refused the login." });
          const me = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: `Bearer ${raw.access_token}` } });
          const profile = await me.json() as { username?: string; email?: string };
          return Response.json({ ok: true, provider, email: profile.email || "", name: profile.username || "Discord", token: raw.access_token, refresh: raw.refresh_token || "" });
        } catch (error) {
          return Response.json({ ok: false, text: error instanceof Error ? error.message : "The login did not finish." });
        }
      },
    },
  },
});
