// Ported from the standalone server.js — signed upload/download URLs for
// the `lifestor` bucket, folded into the Worker so there's one backend.
import type { Env } from "../index.ts";

export async function handleSignedUrl(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action"); // "upload" | "download"
  const path = url.searchParams.get("path");

  if (!action || !path) {
    return new Response(JSON.stringify({ error: "Missing action or path" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // TODO: call Supabase Storage REST API with the service-role key:
  //   POST {SUPABASE_URL}/storage/v1/object/sign/lifestor/{path}   (download)
  //   POST {SUPABASE_URL}/storage/v1/object/upload/sign/lifestor/{path} (upload)
  // using env.SUPABASE_URL + env.SUPABASE_SERVICE_ROLE_KEY, then return the
  // signed URL to the caller.
  return new Response(
    JSON.stringify({ error: `Signed URL (${action}) not yet wired for: ${path}` }),
    { status: 501, headers: { "Content-Type": "application/json" } },
  );
}
