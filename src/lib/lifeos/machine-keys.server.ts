import { readFile } from "node:fs/promises";
import { SERVICE_ENV } from "./sheet-keys";
import { envBag } from "./env-bag.server";

function rows(list: { name?: string; value?: string }[]) {
  return list
    .map((row) => ({ name: String(row?.name || "").trim().slice(0, 80), value: String(row?.value || "").trim().slice(0, 8000) }))
    .filter((row) => row.name && row.value);
}

export async function machineKeys() {
  let fromFile: { name: string; value: string }[] = [];
  try {
    const parsed = JSON.parse(await readFile(".lifeos-keys.json", "utf8")) as { name?: string; value?: string }[];
    if (Array.isArray(parsed)) fromFile = rows(parsed);
  } catch { /* .env can fill the cards instead */ }
  const bag = await envBag();
  const fromEnv = rows(Object.entries(SERVICE_ENV).map(([name, aliases]) => ({ name, value: aliases.map((alias) => bag[alias]?.trim()).find(Boolean) || "" })));
  const names = new Set(fromFile.map((row) => row.name));
  return [...fromFile, ...fromEnv.filter((row) => !names.has(row.name))];
}
