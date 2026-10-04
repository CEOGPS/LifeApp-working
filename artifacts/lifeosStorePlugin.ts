import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

const root = () => path.resolve(process.cwd(), ".lifeos");
const storeFile = () => path.join(root(), "store.json");
const mediaDir = () => path.join(root(), "media");

function readStore(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(storeFile(), "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, unknown>) {
  fs.mkdirSync(root(), { recursive: true });
  fs.writeFileSync(storeFile(), JSON.stringify(data));
}

export function lifeosComputerStore(): Plugin {
  return {
    name: "lifeos-computer-store",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        if (url.pathname === "/__lifeos/store") {
          if (req.method === "GET") {
            const key = url.searchParams.get("key");
            const all = readStore();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ value: key ? (all[key] ?? null) : all }));
            return;
          }
          if (req.method === "POST") {
            const chunks: Buffer[] = [];
            req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            req.on("end", () => {
              try {
                const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { key?: string; value?: unknown };
                const all = readStore();
                if (body.key) all[body.key] = body.value;
                writeStore(all);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false }));
              }
            });
            return;
          }
        }

        if (url.pathname === "/__lifeos/media" && req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          req.on("end", () => {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const name = (url.searchParams.get("name") || "file").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
            fs.mkdirSync(mediaDir(), { recursive: true });
            fs.writeFileSync(path.join(mediaDir(), `${id}-${name}`), Buffer.concat(chunks));
            const saved = `/__lifeos/media/${id}-${name}`;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ url: saved, file_url: saved }));
          });
          return;
        }

        if (url.pathname.startsWith("/__lifeos/media/") && req.method === "GET") {
          const name = path.basename(url.pathname);
          const file = path.join(mediaDir(), name);
          if (!file.startsWith(mediaDir()) || !fs.existsSync(file)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.end(fs.readFileSync(file));
          return;
        }

        next();
      });
    },
  };
}
