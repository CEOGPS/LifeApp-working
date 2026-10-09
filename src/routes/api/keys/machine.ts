import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/keys/machine")({
  server: {
    handlers: {
      GET: async () => Response.json({ error: "Keys stay on the worker." }, { status: 410, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
