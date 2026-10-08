import { readFile } from "node:fs/promises";

function parseEnv(text: string, into: Record<string, string>) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (name && value && !into[name]) into[name] = value;
  }
}

export async function envBag() {
  const bag: Record<string, string> = {};
  for (const path of [".env", ".env.local", ".dev.vars"]) {
    try { parseEnv(await readFile(path, "utf8"), bag); } catch { /* missing */ }
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (value && !bag[name]) bag[name] = value;
  }
  return bag;
}

export async function envValue(name: string) {
  const bag = await envBag();
  return bag[name]?.trim() || "";
}
