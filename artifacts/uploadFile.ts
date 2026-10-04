import { getSupabaseClient } from "./supabaseClient";

export type UploadKind = "contacts" | "media" | "crm" | "avatars" | "files" | "music";

export interface UploadResult {
  url: string;
  thumb_url?: string | null;
  file_url?: string;
  id?: string;
  source: "computer" | "worker" | "supabase" | "data-url";
}

const STUB_HOST_RE = /uploads\.lifeos1\.com/i;
const MAX_DATA_URL_BYTES = 2 * 1024 * 1024;

function workerBase(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};
  return (env.VITE_WORKER_URL || env.VITE_CLOUDFLARE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev").replace(/\/$/, "");
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "file";
}

async function tryComputerUpload(file: File): Promise<UploadResult | null> {
  try {
    const res = await fetch(`/__lifeos/media?name=${encodeURIComponent(safeName(file.name))}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    if (!data.url) return null;
    return { url: data.url, file_url: data.url, source: "computer" };
  } catch {
    return null;
  }
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
      authHeaders = { Authorization: `Bearer ${session.access_token}`, "X-User-Id": session.user?.id || "local" };
    }
  } catch { /* local */ }
  for (const base of [workerBase(), ""]) {
    try {
      const res = await fetch(`${base}/api/upload?type=${encodeURIComponent(type)}`, { method: "POST", body: form, headers: authHeaders });
      if (!res.ok) continue;
      const data = (await res.json().catch(() => null)) as { url?: string; file_url?: string; thumb_url?: string; id?: string } | null;
      const out = data?.url || data?.file_url || "";
      if (!out || STUB_HOST_RE.test(out)) continue;
      return { url: out, file_url: data?.file_url || out, thumb_url: data?.thumb_url ?? null, id: data?.id, source: "worker" };
    } catch { /* next */ }
  }
  return null;
}

async function trySupabaseUpload(file: File, type: UploadKind): Promise<UploadResult | null> {
  const buckets = ["lifestor", "media", "uploads", "avatars", "lifeos-storage"];
  const objectPath = `${type}/${Date.now()}-${safeName(file.name)}`;
  try {
    const client = await getSupabaseClient();
    for (const bucket of buckets) {
      try {
        const { error } = await client.storage.from(bucket).upload(objectPath, file, { upsert: true, contentType: file.type || "application/octet-stream" });
        if (error) continue;
        const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
        if (!data?.publicUrl) continue;
        return { url: data.publicUrl, file_url: data.publicUrl, source: "supabase", id: `${bucket}/${objectPath}` };
      } catch { /* next */ }
    }
  } catch { /* unavailable */ }
  return null;
}

export async function uploadFile(file: File, type: UploadKind = "files"): Promise<UploadResult> {
  if (!file) throw new Error("No file provided");
  const onThisComputer = await tryComputerUpload(file);
  if (onThisComputer) return onThisComputer;
  const worker = await tryWorkerUpload(file, type);
  if (worker) return worker;
  const supabase = await trySupabaseUpload(file, type);
  if (supabase) return supabase;
  if (file.size <= MAX_DATA_URL_BYTES) {
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
    if (url) return { url, file_url: url, source: "data-url" };
  }
  throw new Error("Upload failed. The file was not saved on this computer.");
}
