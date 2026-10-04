import { invokeLLM } from "@/lib/ai.js";

export interface LlmOptions {
  system?: string;
  json?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
}

export async function callLLM(prompt: string, opts: LlmOptions = {}): Promise<string> {
  const raw = await invokeLLM({
    prompt,
    systemPrompt: opts.system ?? (opts.json ? "Return only valid JSON, no prose, no markdown fences." : undefined),
    max_tokens: opts.maxTokens,
  } as never);
  return typeof raw === "string" ? raw : String(raw ?? "");
}

export function parseJsonArray<T>(raw: string): T[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error("No JSON found in LLM response");
  const opener = cleaned[start];
  const closer = opener === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closer);
  if (end === -1) throw new Error("Unterminated JSON");
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  return Array.isArray(parsed) ? (parsed as T[]) : ([parsed] as T[]);
}

export function parseJsonObject<T>(raw: string): T {
  return parseJsonArray<T>(raw)[0];
}