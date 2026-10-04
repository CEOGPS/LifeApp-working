import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

function uid(request: Request): string | null {
  const id = request.headers.get("X-User-Id")?.trim();
  if (!id || id === "anonymous") return null;
  return id.slice(0, 128);
}

function ns(env: { LIFEOS_KV?: KVNamespace }): KVNamespace | null {
  return env.LIFEOS_KV ?? null;
}

function storageKey(userId: string, key: string): string {
  return `${userId}:${decodeURIComponent(key)}`;
}

router.get("/kv", async (request, env) => {
  const userId = uid(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  const kv = ns(env);
  if (!kv) return Response.json({ error: "LIFEOS_KV not bound" }, { status: 503, headers: corsHeaders() });
  const prefix = new URL(request.url).searchParams.get("prefix") || "";
  const listed = await kv.list({ prefix: `${userId}:${prefix}` });
  return Response.json(
    { keys: listed.keys.map((k) => k.name.slice(userId.length + 1)) },
    { headers: corsHeaders() },
  );
});

router.get("/kv/:key", async (request, env) => {
  const userId = uid(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  const kv = ns(env);
  if (!kv) return Response.json({ error: "LIFEOS_KV not bound" }, { status: 503, headers: corsHeaders() });
  const raw = await kv.get(storageKey(userId, request.params.key), "json");
  return Response.json({ value: raw ?? null }, { headers: corsHeaders() });
});

router.post("/kv/:key", async (request, env) => {
  const userId = uid(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  const kv = ns(env);
  if (!kv) return Response.json({ error: "LIFEOS_KV not bound" }, { status: 503, headers: corsHeaders() });
  const body = await request.json().catch(() => ({}));
  await kv.put(storageKey(userId, request.params.key), JSON.stringify(body.value ?? null));
  return Response.json({ success: true }, { headers: corsHeaders() });
});

router.delete("/kv/:key", async (request, env) => {
  const userId = uid(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders() });
  const kv = ns(env);
  if (!kv) return Response.json({ error: "LIFEOS_KV not bound" }, { status: 503, headers: corsHeaders() });
  await kv.delete(storageKey(userId, request.params.key));
  return Response.json({ success: true }, { headers: corsHeaders() });
});

export { router as kvRoutes };