// LifeOS1 persistent storage — Cloudflare Worker KV + R2
// CRITICAL: NO localStorage fallback. If KV fails, throw — don't silently
// pretend the save worked. Silent localStorage fallbacks are why your data
// disappears between sessions.

const BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? import.meta.env.VITE_WORKER_URL // Worker URL — Pages has no API routes
    : "http://localhost:8787"; // local wrangler dev

class StorageError extends Error {
  constructor(msg, status) {
    super(msg);
    this.name = "StorageError";
    this.status = status;
  }
}

async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new StorageError(
      `${opts.method || "GET"} ${path} → ${r.status} ${body.slice(0, 200)}`,
      r.status,
    );
  }
  return r;
}

// ── PROFILE ────────────────────────────────────────────────────────────────
export async function getProfile() {
  try {
    const r = await req(`/api/profile`);
    return await r.json();
  } catch (e) {
    console.warn("[storage] getProfile failed:", e.message);
    return {};
  }
}

export async function saveProfile(data) {
  try {
    await req(`/api/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { ok: true };
  } catch (e) {
    console.error(
      "[storage] saveProfile FAILED — data NOT persisted:",
      e.message,
    );
    return { ok: false, error: e.message };
  }
}

// ── SETTINGS (namespaced KV by key) ───────────────────────────────────────
export async function getSetting(key) {
  try {
    const r = await req(`/api/settings/${encodeURIComponent(key)}`);
    return await r.json();
  } catch (e) {
    console.warn(`[storage] getSetting(${key}) failed:`, e.message);
    return {};
  }
}

export async function saveSetting(key, data) {
  try {
    await req(`/api/settings/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { ok: true };
  } catch (e) {
    console.error(`[storage] saveSetting(${key}) FAILED:`, e.message);
    return { ok: false, error: e.message };
  }
}

// ── GENERIC KV (the main API every panel uses) ─────────────────────────────
const LS_PREFIX = "lifeos_kv2_";
function lsRead(key) {
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
function lsWrite(key, val) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
  } catch {}
}
function lsDel(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {}
}

// Returns null on miss, parsed JSON on hit. Falls back to localStorage if Worker is unreachable.
export async function kvGet(key) {
  try {
    const r = await req(`/api/kv/${encodeURIComponent(key)}`);
    const data = await r.json();
    if (data !== null) lsWrite(key, data); // mirror to localStorage on successful read
    return data;
  } catch (e) {
    console.warn(
      `[storage] kvGet(${key}) failed, using localStorage fallback:`,
      e.message,
    );
    return lsRead(key); // return local copy instead of null
  }
}

// Writes to localStorage immediately, then syncs to Worker KV in background.
export async function kvSet(key, value) {
  lsWrite(key, value); // instant local write — never loses data
  try {
    await req(`/api/kv/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    return { ok: true };
  } catch (e) {
    console.warn(
      `[storage] kvSet(${key}) Worker sync failed (local save OK):`,
      e.message,
    );
    return { ok: false, error: e.message };
  }
}

export async function kvDelete(key) {
  lsDel(key);
  try {
    await req(`/api/kv/${encodeURIComponent(key)}`, { method: "DELETE" });
    return { ok: true };
  } catch (e) {
    console.warn(
      `[storage] kvDelete(${key}) Worker sync failed (local deleted OK):`,
      e.message,
    );
    return { ok: false, error: e.message };
  }
}

// ── R2 FILE UPLOAD ─────────────────────────────────────────────────────────
// type: "music" | "media" | "avatar" | "journal" | "social" | "crm" | "community" | "email" | "messages" | "general"
export async function uploadToR2(file, type = "general") {
  const key = `${type}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("key", key);
  formData.append("type", type);
  try {
    const r = await req(`/api/upload`, { method: "POST", body: formData });
    const d = await r.json();
    return {
      url: d.url,
      key: d.key,
      name: file.name,
      size: file.size,
      type: file.type,
      ok: true,
    };
  } catch (e) {
    console.error(
      `[storage] uploadToR2 FAILED — file NOT persisted to R2:`,
      e.message,
    );
    // Session-only object URL so UI still shows the file, but flag it as not saved.
    return {
      url: URL.createObjectURL(file),
      key,
      name: file.name,
      size: file.size,
      type: file.type,
      local: true,
      ok: false,
      error: e.message,
    };
  }
}

// Legacy alias used by older code paths.
export async function uploadFile(file, type = "general") {
  const r = await uploadToR2(file, type);
  return r.url;
}

// ── FILE INDEX (KV list per type) ──────────────────────────────────────────
export async function listFiles(type) {
  return (await kvGet(`files_${type}`)) || [];
}

export async function indexFile(type, fileInfo) {
  const existing = (await listFiles(type)) || [];
  const updated = [fileInfo, ...existing].slice(0, 500);
  await kvSet(`files_${type}`, updated);
  return updated;
}
