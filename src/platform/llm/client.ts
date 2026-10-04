import { supabase } from "@/platform/supabase/client";
import { api } from "@/platform/api/client";

const MODEL_PREF_KEY = "lifeos1_preferred_model";

export interface LLMResponse {
  ok: boolean;
  text: string;
  content: string;
  detail: string;
  reason: string;
  error: string;
  model_used?: string;
}

export interface LLMOptions {
  prompt: string | unknown[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

function getPreferredModel(): string {
  try {
    return localStorage.getItem(MODEL_PREF_KEY) || "auto";
  } catch {
    return "auto";
  }
}

function setPreferredModel(model: string): void {
  try {
    localStorage.setItem(MODEL_PREF_KEY, model.toLowerCase());
  } catch {}
}

// Discriminated union for model selection
export type ModelId = 
  | "auto"
  | "claude"
  | "gpt"
  | "gemini"
  | "deepseek"
  | "copilot"
  | "grok"
  | "ollama"
  | "huggingface"
  | "openrouter";

export const MODEL_OPTIONS: { id: ModelId; label: string; icon: string; desc: string }[] = [
  { id: "auto", label: "Auto", icon: "✦", desc: "Smart fallback" },
  { id: "claude", label: "Claude", icon: "🤍", desc: "Sonnet 4" },
  { id: "gpt", label: "GPT-4o", icon: "🔷", desc: "OpenAI" },
  { id: "gemini", label: "Gemini", icon: "💎", desc: "Free tier" },
  { id: "deepseek", label: "DeepSeek", icon: "🌊", desc: "R1 · cheap" },
  { id: "copilot", label: "CoPilot", icon: "🪟", desc: "Microsoft" },
  { id: "grok", label: "Grok", icon: "✦", desc: "xAI" },
  { id: "ollama", label: "Ollama", icon: "🦙", desc: "Local LLMs" },
  { id: "huggingface", label: "Hugging Face", icon: "🤗", desc: "Open models" },
  { id: "openrouter", label: "OpenRouter", icon: "🔀", desc: "100+ models" },
];

export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token || "";
    const model = options.model || getPreferredModel();
    
    if (!accessToken) {
      return {
        ok: false,
        text: "",
        content: "[Authentication required. Please log in again.]",
        detail: "No session",
        reason: "auth_required",
        error: "No active session",
      };
    }

    const sys = options.systemPrompt || "You are AgentZero, the AI core of LifeOS1. Be direct, strategic, actionable.";
    const messagesArg = Array.isArray(options.prompt) ? options.prompt : null;
    
    const result = await api.invokeLLM({
      prompt: options.prompt,
      systemPrompt: sys,
      model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
    }) as { text?: string; content?: string; model_used?: string };
    
    return {
      ok: true,
      text: result.text || result.content || "",
      content: result.text || result.content || "",
      detail: "",
      reason: "",
      error: "",
      model_used: result.model_used,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "LLM error";
    return {
      ok: false,
      text: "",
      content: msg,
      detail: msg,
      reason: msg,
      error: msg,
    };
  }
}

export function callLLM(prompt: string, options?: { model?: ModelId; maxTokens?: number; temperature?: number; systemPrompt?: string }): Promise<LLMResponse> {
  return invokeLLM({ prompt, ...options });
}

export { getPreferredModel, setPreferredModel, MODEL_PREF_KEY };