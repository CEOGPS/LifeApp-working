// src/lib/llm.ts
// LLM utilities - unified interface for AI operations

import { supabase } from "@/lib/supabaseClient";
import { invokeLLMWithAuth as rawInvokeLLM, getPreferredModel } from "@/api/ceogpsclient";

// LLM response type
export interface LLMResponse {
  ok: boolean;
  text: string;
  content: string;
  detail: string;
  reason: string;
  error: string;
}

// Type assertion helper
const asLLMResponse = (obj: Partial<LLMResponse>): LLMResponse => 
  Object.assign(
    { ok: false, text: "", content: "", detail: "", reason: "", error: "" },
    obj
  ) as LLMResponse;

// Simplified invokeLLM that handles auth automatically
export async function invokeLLM(options: { 
  prompt: string | any[]; 
  systemPrompt?: string; 
  model?: string; 
  maxTokens?: number; 
  max_tokens?: number;
  temperature?: number;
  accessToken?: string;
}): Promise<LLMResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = options.accessToken || session?.access_token || "";
    const model = options.model || getPreferredModel() || "auto";
    
    const result = await rawInvokeLLM({
      prompt: options.prompt,
      systemPrompt: options.systemPrompt,
      model,
      accessToken,
    });
    
    if (typeof result === 'string') {
      if (result.includes('[Authentication') || result.includes('[AI router')) {
        return asLLMResponse({ 
          ok: false, 
          text: "", 
          content: result, 
          detail: result, 
          reason: result, 
          error: result 
        });
      }
      return asLLMResponse({ 
        ok: true, 
        text: result, 
        content: result, 
        detail: "", 
        reason: "", 
        error: "" 
      });
    }
    return asLLMResponse({ 
      ok: false, 
      text: "", 
      content: "Unexpected response", 
      detail: "Unexpected response", 
      reason: "Unexpected response", 
      error: "Unexpected response" 
    });
  } catch (e: any) {
    const msg = e?.message || "LLM error";
    return asLLMResponse({ 
      ok: false, 
      text: "", 
      content: msg, 
      detail: msg, 
      reason: msg, 
      error: msg 
    });
  }
}

// Enrich contact using LLM - implementation from LifeOSDataContext
export async function enrichContact(contact: any): Promise<any> {
  const prompt = `Analyze this contact and provide enrichment data:
Name: ${contact.firstName} ${contact.lastName}
Company: ${contact.company || 'Unknown'}
Title: ${contact.title || 'Unknown'}
Email: ${contact.emails?.[0]?.value || 'Unknown'}
Phone: ${contact.phones?.[0]?.value || 'Unknown'}

Return JSON with: industry, companySize, revenue, techStack, painPoints, decisionMakerScore (1-10), suggestedApproach`;

  try {
    const result = await invokeLLM({ prompt });
    if (result.ok) {
      return JSON.parse(result.text || "{}");
    }
  } catch (e) {
    console.error('Enrich contact failed:', e);
  }
  return {};
}

// Generic LLM invocation with automatic auth token handling
export async function callLLM(prompt: string, options?: { model?: string; maxTokens?: number; temperature?: number; systemPrompt?: string }): Promise<LLMResponse> {
  return invokeLLM({ prompt, ...options });
}

export { getPreferredModel };