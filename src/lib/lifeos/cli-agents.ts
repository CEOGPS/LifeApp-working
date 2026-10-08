import { spawn } from "node:child_process";
import { createServerFn } from "@tanstack/react-start";

function run(command: string, args: string[]) {
  return new Promise<{ ok: boolean; text: string; url: string }>((resolve) => {
    const child = spawn(command, args, { windowsHide: true, env: { ...process.env, CI: "1" } });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, text: `${command} took too long and was stopped.`, url: "" });
    }, 120_000);
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
      if (out.length > 12_000) out = out.slice(-12_000);
    });
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
      if (err.length > 4_000) err = err.slice(-4_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      resolve({ ok: false, text: missing ? `${command} is not installed on the computer running this app.` : error.message, url: "" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = (out || err).trim().slice(0, 8000);
      const url = text.match(/https?:\/\/\S+/)?.[0] || "";
      resolve({ ok: code === 0 && Boolean(text), text: text || `${command} exited with no output.`, url });
    });
  });
}

export const runCliAgent = createServerFn({ method: "POST" })
  .validator((input: { who?: string; prompt?: string; check?: boolean }) => ({
    who: input?.who === "qwen" ? "qwen" as const : "hermes" as const,
    prompt: String(input?.prompt || "").slice(0, 4000),
    check: Boolean(input?.check),
  }))
  .handler(async ({ data }) => {
    if (data.check) {
      const result = await run(data.who, ["--version"]);
      return result.ok ? { ...result, text: `${data.who} ${result.text.split("\n")[0]}` } : result;
    }
    if (!data.prompt) return { ok: false, text: "Nothing to send.", url: "" };
    if (data.who === "qwen") return run("qwen", ["-p", data.prompt, "--output-format", "text"]);
    return run("hermes", ["chat", "-q", data.prompt]);
  });
