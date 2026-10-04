// src/lib/integrationsSupabase.ts
// Supabase operations for integrations management

import { supabase } from "@/lib/supabaseClient";

export interface IntegrationCredential {
  id: string;
  user_id: string;
  provider: string;
  encrypted_data: string;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConfig {
  provider: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  scopes?: string[];
  additional_config?: Record<string, any>;
}

export async function getIntegrationCredentials(userId: string): Promise<IntegrationCredential[]> {
  const { data, error } = await supabase
    .from("integrations_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getIntegrationCredential(userId: string, provider: string): Promise<IntegrationCredential | null> {
  const { data, error } = await supabase
    .from("integrations_credentials")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("is_active", true)
    .single();
  
  if (error) return null;
  return data;
}

export async function saveIntegrationCredential(
  userId: string,
  provider: string,
  encryptedData: string,
  metadata: Record<string, any> = {}
): Promise<IntegrationCredential> {
  const { data, error } = await supabase
    .from("integrations_credentials")
    .upsert({
      user_id: userId,
      provider,
      encrypted_data: encryptedData,
      metadata,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,provider",
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteIntegrationCredential(userId: string, provider: string): Promise<void> {
  const { error } = await supabase
    .from("integrations_credentials")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);
  
  if (error) throw error;
}

export async function testIntegrationConnection(config: IntegrationConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // This would test the actual integration connection
    // For now, just validate the config structure
    if (!config.provider) {
      return { success: false, error: "Provider is required" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

// Common integration providers
export const INTEGRATION_PROVIDERS = [
  { id: "google", name: "Google", icon: "🌐", category: "auth" },
  { id: "microsoft", name: "Microsoft", icon: "🪟", category: "auth" },
  { id: "github", name: "GitHub", icon: "🐙", category: "dev" },
  { id: "slack", name: "Slack", icon: "💬", category: "comm" },
  { id: "stripe", name: "Stripe", icon: "💳", category: "finance" },
  { id: "gmail", name: "Gmail", icon: "📧", category: "email" },
  { id: "calendar", name: "Google Calendar", icon: "📅", category: "productivity" },
  { id: "github", name: "GitHub", icon: "🐙", category: "dev" },
  { id: "notion", name: "Notion", icon: "📝", category: "productivity" },
  { id: "airtable", name: "Airtable", icon: "🗃️", category: "data" },
  { id: "zapier", name: "Zapier", icon: "⚡", category: "automation" },
  { id: "webhook", name: "Webhooks", icon: "🔗", category: "dev" },
];

export function getProviderConfig(providerId: string): IntegrationConfig | undefined {
  // Return default config for known providers
  const configs: Record<string, IntegrationConfig> = {
    google: { provider: "google", scopes: ["email", "profile", "https://www.googleapis.com/auth/calendar"] },
    microsoft: { provider: "microsoft", scopes: ["User.Read", "Calendars.Read"] },
    github: { provider: "github", scopes: ["repo", "user:email"] },
    slack: { provider: "slack", scopes: ["channels:read", "chat:write"] },
    stripe: { provider: "stripe", additional_config: { account_type: "express" } },
    gmail: { provider: "gmail", scopes: ["https://www.googleapis.com/auth/gmail.readonly"] },
    calendar: { provider: "google", scopes: ["https://www.googleapis.com/auth/calendar"] },
  };
  return configs[providerId];
}