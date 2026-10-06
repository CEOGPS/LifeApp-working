import { createFileRoute } from "@tanstack/react-router";
import { env } from "@/lib/env.server";

function challenge(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = env("FACEBOOK_VERIFY_TOKEN") || "ceogps-fb-9f3c1a7e4b26";
  if (mode === "subscribe" && token === expected && challenge) return new Response(challenge, { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

export const Route = createFileRoute("/api/webhooks/facebook")({
  server: {
    handlers: {
      GET: ({ request }) => challenge(request),
      POST: async ({ request }) => {
        await request.text().catch(() => "");
        return Response.json({ ok: true });
      },
    },
  },
});
