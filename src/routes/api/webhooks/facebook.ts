import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";

function challenge(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = env("FACEBOOK_VERIFY_TOKEN");
  if (!expected) return new Response("Verify token is not set", { status: 503 });
  if (mode === "subscribe" && token === expected && challenge) return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export const Route = createFileRoute("/api/webhooks/facebook")({
  server: {
    handlers: {
      GET: ({ request }) => challenge(request),
      POST: async ({ request }) => {
        const raw = await request.text().catch(() => "");
        const secret = env("FACEBOOK_APP_SECRET") || env("FB_APP_SECRET");
        const signature = request.headers.get("x-hub-signature-256") || "";
        if (!secret) return Response.json({ ok: false, error: "Facebook app secret is not set." }, { status: 503 });
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
        const hex = [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
        if (signature !== `sha256=${hex}`) return new Response("Forbidden", { status: 403 });
        return Response.json({ ok: true });
      },
    },
  },
});
