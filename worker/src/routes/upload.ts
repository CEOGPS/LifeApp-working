import { Router } from "itty-router";
import { corsHeaders } from "../utils/cors";

const router = Router();

type Env = {
  LIFEOS_STORAGE?: R2Bucket;
};

function json(data: unknown, status = 200, origin?: string | null) {
  return Response.json(data, {
    status,
    headers: corsHeaders(origin || "*"),
  });
}

function extFromFile(file: File): string {
  const fromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "";
  if (fromName) return fromName.slice(0, 12);
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "mp4";
  if (mime === "application/pdf") return "pdf";
  return "bin";
}

function userIdFromRequest(request: Request): string {
  const headerId = request.headers.get("X-User-Id");
  if (headerId && headerId.trim()) return headerId.trim().slice(0, 128);
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ") && auth.length > 20) {
    return `tok_${auth.slice(7, 23)}`;
  }
  return "anonymous";
}

// POST /api/upload?type=contacts|media|...
router.post("/", async (request: Request, env: Env) => {
  const origin = request.headers.get("Origin");
  const userId = userIdFromRequest(request);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Invalid multipart body" }, 400, origin);
  }

  const file = formData.get("file") as File | null;
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    return json({ error: "No file provided" }, 400, origin);
  }

  if (!env.LIFEOS_STORAGE) {
    return json(
      { error: "LIFEOS_STORAGE R2 binding is not configured on this worker" },
      503,
      origin,
    );
  }

  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || "files").replace(/[^a-z0-9_-]/gi, "") || "files";
  const id = crypto.randomUUID();
  const key = `${type}/${userId}/${id}.${extFromFile(file)}`;

  await env.LIFEOS_STORAGE.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
      contentDisposition: `inline; filename="${(file.name || "file").replace(/"/g, "")}"`,
    },
    customMetadata: {
      originalName: file.name || "",
      uploadedBy: userId,
      type,
    },
  });

  const publicUrl = new URL(request.url);
  publicUrl.pathname = `/api/upload/object/${key}`;
  publicUrl.search = "";

  return json(
    {
      url: publicUrl.toString(),
      file_url: publicUrl.toString(),
      id,
      key,
    },
    200,
    origin,
  );
});

// GET /api/upload/object/:key+  — stream object bytes from R2
router.get("/object/*", async (request: Request, env: Env) => {
  const origin = request.headers.get("Origin");
  if (!env.LIFEOS_STORAGE) {
    return json({ error: "LIFEOS_STORAGE R2 binding is not configured" }, 503, origin);
  }

  const url = new URL(request.url);
  const marker = "/object/";
  const idx = url.pathname.indexOf(marker);
  const key = idx >= 0 ? decodeURIComponent(url.pathname.slice(idx + marker.length)) : "";
  if (!key || key.includes("..")) {
    return json({ error: "Missing object key" }, 400, origin);
  }

  const obj = await env.LIFEOS_STORAGE.get(key);
  if (!obj) {
    return json({ error: "Not found" }, 404, origin);
  }

  const headers = new Headers(corsHeaders(origin || "*"));
  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  if (obj.httpMetadata?.contentDisposition) {
    headers.set("Content-Disposition", obj.httpMetadata.contentDisposition);
  }
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);

  return new Response(obj.body, { status: 200, headers });
});

// GET /api/upload — health / type echo (non-stub)
router.get("/", async (request: Request, env: Env) => {
  const origin = request.headers.get("Origin");
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  return json(
    {
      ok: true,
      storage: Boolean(env.LIFEOS_STORAGE),
      type: type || "files",
      usage: "POST multipart field `file` to /api/upload?type=<kind>",
    },
    200,
    origin,
  );
});

export { router as uploadRoutes };
