import { createFileRoute } from "@tanstack/react-router";
import { runAccount } from "@/lib/lifeos/env-keys";

export const Route = createFileRoute("/api/keys/account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({})) as { service?: string; token?: string; key?: string; secret?: string; site?: string };
        const result = await runAccount({
          service: String(body?.service || "").slice(0, 40),
          token: String(body?.token || "").slice(0, 4000),
          key: String(body?.key || "").trim().slice(0, 400),
          secret: String(body?.secret || "").trim().slice(0, 400),
          site: String(body?.site || "").trim().slice(0, 200),
        });
        return Response.json(result);
      },
    },
  },
});
