// src/lib/invokeLLM.ts
// Simplified LLM wrapper that delegates to the authorized AI router

import { invokeLLMWithAuth } from "./api";
import { supabase } from "./supabaseClient";

export async function invokeLLM({
  prompt,
  systemPrompt,
  model,
  signal,
}: {
  prompt: string | any[];
  systemPrompt?: string;
  model?: string;
  signal?: AbortSignal;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || "";

  // Note: the Worker API doesn't currently support AbortSignal in the fetch,
  // but we pass it as part of the request context if needed.

  const res = await invokeLLMWithAuth({
    prompt,
    systemPrompt,
    model,
    accessToken,
  });

  // The AI router returns a string directly.
  // We wrap it in an object to match the expected shape { text: string }
  return {
    text: res,
    content: res,
  };
}
