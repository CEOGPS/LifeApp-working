import type { Memory } from "./memory";

export type LocalJob = { ok: boolean; who: "Hermes" | "Qwen"; text: string; url: string };

function saved(data: Memory, name: string) {
  return data.keys.find((row) => row.name === name)?.value.trim() || "";
}

function base(data: Memory, name: string, fallback: string) {
  return (saved(data, name) || fallback).replace(/\/$/, "");
}

async function readBody(response: Response) {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { text: raw.slice(0, 500) };
  }
}

function chatText(body: Record<string, unknown>) {
  const choices = body.choices as { message?: { content?: string } }[] | undefined;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  const data = body.data as { url?: string }[] | undefined;
  const url = typeof body.url === "string" ? body.url : data?.[0]?.url || "";
  const err = body.error;
  const error = typeof err === "string" ? err : err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message || "") : "";
  return url || error || (typeof body.text === "string" ? body.text : "");
}

export function routeJob(text: string, mode: string): "" | "hermes" | "qwen-image" | "qwen-video" {
  if (mode === "image") return "qwen-image";
  if (mode === "video") return "qwen-video";
  if (mode === "code") return "hermes";
  const q = text.toLowerCase();
  if (/\b(make|create|generate|render)\b/.test(q) && /\bvideo|clip|animate\b/.test(q)) return "qwen-video";
  if (/\b(make|create|generate|draw|render)\b/.test(q) && /\bimage|picture|photo\b/.test(q)) return "qwen-image";
  if (/\b(read|write|edit|open|browse|scrape|run)\b/.test(q) && /\b(file|folder|browser|page|site|terminal|command|repo)\b/.test(q)) return "hermes";
  return "";
}

async function viaCli(who: "hermes" | "qwen", prompt: string): Promise<LocalJob | null> {
  try {
    const { runCliAgent } = await import("@/lib/lifeos/cli-agents");
    const result = await runCliAgent({ data: { who, prompt } });
    if (/not installed on the computer/i.test(result.text)) return null;
    return { ok: result.ok, who: who === "hermes" ? "Hermes" : "Qwen", text: result.text, url: result.url || "" };
  } catch {
    return null;
  }
}

export async function askHermes(data: Memory, prompt: string): Promise<LocalJob> {
  const cli = await viaCli("hermes", prompt);
  if (cli) return cli;
  const root = base(data, "Hermes URL", "http://127.0.0.1:8642");
  const token = saved(data, "Hermes");
  try {
    const response = await fetch(`${root}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ model: "hermes-agent", messages: [{ role: "user", content: prompt }] }),
    });
    const body = await readBody(response);
    const text = chatText(body);
    if (!response.ok) return { ok: false, who: "Hermes", text: text || `Hermes answered HTTP ${response.status}.`, url: "" };
    return { ok: Boolean(text), who: "Hermes", text: text || "Hermes returned an empty reply.", url: "" };
  } catch {
    return { ok: false, who: "Hermes", text: "The hermes command is not on the computer running this app. It has to be on the PATH there. The gateway at 127.0.0.1:8642 also did not answer.", url: "" };
  }
}

export async function askQwen(data: Memory, prompt: string, kind: "image" | "video"): Promise<LocalJob> {
  const cli = await viaCli("qwen", `${kind === "image" ? "Create an image" : "Create a video"} and return the file URL.\n${prompt}`);
  if (cli) return cli;
  const root = base(data, "Qwen URL", "http://127.0.0.1:8000");
  const token = saved(data, "Qwen");
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const path = kind === "image" ? "/v1/images/generations" : "/v1/videos/generations";
  try {
    const direct = await fetch(`${root}${path}`, { method: "POST", headers, body: JSON.stringify({ model: kind === "image" ? "qwen-image" : "qwen-video", prompt }) });
    const made = await readBody(direct);
    const url = String(made.url || (made.data as { url?: string }[] | undefined)?.[0]?.url || "");
    if (direct.ok && url) return { ok: true, who: "Qwen", text: url, url };
    const response = await fetch(`${root}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "qwen",
        messages: [{ role: "user", content: `${kind === "image" ? "Create an image" : "Create a video"} and return the file URL only.\n${prompt}` }],
      }),
    });
    const body = await readBody(response);
    const text = chatText(body) || chatText(made);
    const found = text.match(/https?:\/\/\S+/)?.[0] || "";
    if (!response.ok && !direct.ok) return { ok: false, who: "Qwen", text: text || `Qwen answered HTTP ${response.status}.`, url: "" };
    return { ok: Boolean(text), who: "Qwen", text: text || "Qwen returned an empty reply.", url: found };
  } catch {
    return { ok: false, who: "Qwen", text: "The qwen command is not on the computer running this app. It has to be on the PATH there.", url: "" };
  }
}

export async function pingCli(who: "hermes" | "qwen") {
  try {
    const { runCliAgent } = await import("@/lib/lifeos/cli-agents");
    const result = await runCliAgent({ data: { who, check: true } });
    return result.text;
  } catch {
    return "The app could not start the command.";
  }
}

