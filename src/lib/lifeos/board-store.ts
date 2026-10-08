import { ANON, SUPABASE } from "./oauth";

const headers = { apikey: ANON, Authorization: `Bearer ${ANON}` };

export async function pullCloud(device: string): Promise<{ doc: unknown; at: number } | null> {
  const response = await fetch(`${SUPABASE}/rest/v1/lifeos_board?device=eq.${encodeURIComponent(device)}&select=doc,updated_at`, { headers });
  if (!response.ok) return null;
  const rows = await response.json() as { doc?: unknown; updated_at?: string }[];
  const row = rows?.[0];
  if (!row?.doc) return null;
  return { doc: row.doc, at: row.updated_at ? new Date(row.updated_at).getTime() : 0 };
}

export async function pushCloud(device: string, doc: Record<string, unknown>) {
  const copy = { ...doc };
  delete copy.keys;
  delete copy.vault;
  let packed = JSON.stringify(copy);
  if (packed.length > 700_000) {
    delete copy.banner;
    delete copy.logo;
    packed = JSON.stringify(copy);
  }
  const response = await fetch(`${SUPABASE}/rest/v1/lifeos_board?on_conflict=device`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ device, doc: JSON.parse(packed), updated_at: new Date().toISOString() }),
  });
  return response.ok;
}

const BRAND = "lifeos-brand";

export async function pullBrand(): Promise<{ banner: string; logo: string } | null> {
  const row = await pullCloud(BRAND);
  const doc = row?.doc;
  if (!doc || typeof doc !== "object") return null;
  const brand = doc as { banner?: unknown; logo?: unknown };
  return { banner: String(brand.banner || ""), logo: String(brand.logo || "") };
}

export async function pushBrand(banner: string, logo: string) {
  const response = await fetch(`${SUPABASE}/rest/v1/lifeos_board?on_conflict=device`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ device: BRAND, doc: { banner, logo }, updated_at: new Date().toISOString() }),
  });
  return response.ok;
}

const KEYS = "lifeos-keys";

export async function pullKeys(): Promise<{ id: string; name: string; value: string }[]> {
  const row = await pullCloud(KEYS);
  const doc = row?.doc;
  if (!doc || typeof doc !== "object") return [];
  const keys = (doc as { keys?: unknown }).keys;
  if (!Array.isArray(keys)) return [];
  return keys.filter((item) => item && typeof item === "object" && "name" in item && "value" in item).map((item) => {
    const row = item as { id?: unknown; name?: unknown; value?: unknown };
    return { id: String(row.id || row.name || ""), name: String(row.name || ""), value: String(row.value || "") };
  }).filter((item) => item.name && item.value);
}

export async function pushKeys(keys: { id: string; name: string; value: string }[]) {
  const response = await fetch(`${SUPABASE}/rest/v1/lifeos_board?on_conflict=device`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ device: KEYS, doc: { keys }, updated_at: new Date().toISOString() }),
  });
  return response.ok;
}
