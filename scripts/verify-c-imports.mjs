#!/usr/bin/env node
/**
 * Fails the build if any source file uses C.<prop> without importing C from lifeosUi (or local const C).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "src");

const EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);
const C_DOT = /(?<![A-Za-z_])\bC\.(?![A-Za-z])/;

function hasCImport(text) {
  if (/^const C = \{/m.test(text)) return true;
  if (/^export const C = /m.test(text)) return true;
  if (/import\s*\{[^}]*\bC\b[^}]*\}\s*from\s*["']@\/lib\/lifeosUi["']/.test(text)) return true;
  if (text.includes('from "@/lib/ui"') || text.includes("from '@/lib/ui'")) return true;
  return false;
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(name))) out.push(p);
  }
  return out;
}

const bad = [];
for (const fp of walk(root)) {
  const text = fs.readFileSync(fp, "utf8");
  if (!C_DOT.test(text)) continue;
  if (!hasCImport(text)) bad.push(path.relative(path.join(__dirname, ".."), fp));
}

if (bad.length) {
  console.error("[verify-c-imports] Missing `import { C } from \"@/lib/lifeosUi\"` in:\n");
  bad.forEach((f) => console.error("  -", f));
  process.exit(1);
}
console.log("[verify-c-imports] OK");