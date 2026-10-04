// src/lib/uploadFile.ts
// Durable media upload for Contacts / CRM / Media panels.
// Tries Worker (R2) first, then Supabase Storage, then data-URL for small images.

import { getSupabaseClient } from "./supabaseClient";

export type UploadKind = "contacts" | "media" | "crm" | "avatars" | "files" | "music";

export interface UploadResult {
  url: string;
  thumb_url?: string | null;
  file_url?: string;
  id?: string;
  source: "worker" | "supabase" | "data-url";
}

const STUB_HOST_RE = /uploads\.lifeos1\.com/i;
const MAX_DATA_URL_BYTES = 2 * 1024 * 1024;

function workerBase(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
  return (
    env.VITE_WORKER_URL ||
    env.VITE_CLOUDFLARE_WORKER_URL ||
    "https://lifeos1-api.ceogps.workers.dev"
  ).replace(/\/$/, "");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

async function tryWorkerUpload(file: File, type: UploadKind): Promise<UploadResult | null> {
  const form = new FormData();
  form.append("file", file);

  let authHeaders: Record<string, string> = { "X-User-Id": "local" };
  try {
    const client = await getSupabaseClient();
    const { data } = await client.auth.getSession();
    const session = data?.session;
    if (session?.access_token) {
      authHeaders = {
        Authorization: `Bearer ${session.access_token}`,
        "X-User-Id": session.user?.id || "local",
      };
    }
  } catch {
    // anonymous upload path
  }

  const bases = [workerBase(), ""];
  for (const base of bases) {
    const url = `${base}/api/upload?type=${encodeURIComponent(type)}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        body: form,
        headers: authHeaders,
      });
      if (!res.ok) continue;
      const data = (await res.json().catch(() => null)) as
        | { url?: string; file_url?: string; thumb_url?: string; id?: string; error?: string }
        | null;
      const out = data?.url || data?.file_url || "";
      if (!out || STUB_HOST_RE.test(out)) continue;
      return {
        url: out,
        file_url: data?.file_url || out,
        thumb_url: data?.thumb_url ?? null,
        id: data?.id,
        source: "worker",
      };
    } catch {
      // try next base
    }
  }
  return null;
}

async function trySupabaseUpload(file: File, type: UploadKind): Promise<UploadResult | null> {
  const buckets = ["lifestor", "media", "uploads", "avatars", "lifeos-storage"];
  const path = `${type}/${Date.now()}-${safeName(file.name)}`;

  try {
    const client = await getSupabaseClient();
    for (const bucket of buckets) {
      try {
        const { error } = await client.storage.from(bucket).upload(path, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });
        if (error) continue;
        const { data } = client.storage.from(bucket).getPublicUrl(path);
        const url = data?.publicUrl;
        if (!url) continue;
        return { url, file_url: url, source: "supabase", id: `${bucket}/${path}` };
      } catch {
        // try next bucket
      }
    }
  } catch {
    // supabase unavailable
  }
  return null;
}

/**
 * Upload a file and return a fetchable URL.
 * Never returns stub hosts like uploads.lifeos1.com.
 */
export async function uploadFile(file: File, type: UploadKind = "files"): Promise<UploadResult> {
  if (!file) throw new Error("No file provided");

  const worker = await tryWorkerUpload(file, type);
  if (worker) return worker;

  const supabase = await trySupabaseUpload(file, type);
  if (supabase) return supabase;

  if (
    file.size <= MAX_DATA_URL_BYTES &&
    (file.type.startsWith("image/") ||
      file.type.startsWith("audio/") ||
      file.type.startsWith("video/") ||
      file.type === "application/pdf" ||
      file.type.startsWith("text/"))
  ) {
    const url = await fileToDataUrl(file);
    if (!url) throw new Error("Upload returned no URL");
    return { url, file_url: url, source: "data-url" };
  }

  throw new Error(
    "Upload failed: worker storage unavailable, Supabase buckets unreachable, and file too large for inline fallback.",
  );
}
