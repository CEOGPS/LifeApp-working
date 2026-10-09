import { readFile } from "node:fs/promises";

export async function machineKeys() {
  try {
    const raw = await readFile(".lifeos-keys.json", "utf8");
    const parsed = JSON.parse(raw) as { name?: string; value?: string }[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({ name: String(row?.name || "").trim().slice(0, 80), value: String(row?.value || "").trim().slice(0, 8000) }))
      .filter((row) => row.name && row.value);
  } catch {
    return [];
  }
}
