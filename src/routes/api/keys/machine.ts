import { createFileRoute } from "@tanstack/react-router";
import { machineKeys } from "@/lib/lifeos/machine-keys.server";

export const Route = createFileRoute("/api/keys/machine")({
  server: {
    handlers: {
      GET: async () => {
        const keys = await machineKeys();
        return Response.json(keys, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
