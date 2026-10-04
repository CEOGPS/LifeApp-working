// ─── Hermes Chat Connector ──────────────────────────────────────────────
// Stub for build. Full implementation later.

export interface HermesMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface HermesChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

export interface HermesChatResponse {
  text: string;
}

export interface HermesHealth {
  hermes: boolean;
  ollama: boolean;
}

export async function hermesChat(
  messages: HermesMessage[],
  options: HermesChatOptions = {},
): Promise<HermesChatResponse> {
  console.warn("[hermesChat] Stub called with messages:", messages, options);
  return {
    text: "Hermes chat stub response. Connect to Ollama or gateway.",
  };
}

export async function hermesHealth(): Promise<HermesHealth> {
  return {
    hermes: false,
    ollama: false,
  };
}

export default {
  hermesChat,
  hermesHealth,
};