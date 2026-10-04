// Replace the fetch helpers in src/pages/aihub/remoteSync.ts.
// Worker contract is GET/POST /api/kv/:key with X-User-Id, not /api/kv/get.

const WORKER_BASE = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";

async function kvGet(key: string, userId: string): Promise<unknown | null> {
  const res = await fetch(`${WORKER_BASE}/api/kv/${encodeURIComponent(key)}`, {
    headers: { "X-User-Id": userId },
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.value ?? null;
}

async function kvSet(key: string, value: unknown, userId: string): Promise<void> {
  await fetch(`${WORKER_BASE}/api/kv/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body: JSON.stringify({ value }),
  });
}
