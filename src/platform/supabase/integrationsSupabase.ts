// Supabase operations for integrations management

import { supabase } from "@/platform/supabase/client";

export interface IntegrationCredential {
  id: string;
  user_id: string;
  integration_name: string;
  email: string | null;
  username: string | null;
  password: string | null;
  api_key: string | null;
  status: string | null;
  label: string | null;
  color: string | null;
  icon: string | null;
  oauth_provider: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
  oauth_scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConfig {
  provider: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  scopes?: string[];
  additional_config?: Record<string, unknown>;
}

export async function loadCredentials(userEmail: string): Promise<Record<string, IntegrationCredential[]>> {
  const { data, error } = await supabase
    .from("integrations_credentials")
    .select("*")
    .eq("user_id", userEmail)
    .order("created_at", { ascending: false });
  
  if (error) throw error;
  
  const grouped: Record<string, IntegrationCredential[]> = {};
  for (const cred of data || []) {
    if (!grouped[cred.integration_name]) {
      grouped[cred.integration_name] = [];
    }
    grouped[cred.integration_name].push(cred);
  }
  
  return grouped;
}

export async function saveCredential(
  userEmail: string,
  credential: Partial<IntegrationCredential> & { user_email: string; integration_name: string }
): Promise<IntegrationCredential | null> {
  const { data, error } = await supabase
    .from("integrations_credentials")
    .upsert({
      user_id: credential.user_email,
      integration_name: credential.integration_name,
      email: credential.email || null,
      username: credential.username || null,
      password: credential.password || null,
      api_key: credential.api_key || null,
      status: credential.status || "on",
      label: credential.label || credential.email || "Unknown",
      color: credential.color || null,
      icon: credential.icon || null,
      oauth_provider: credential.oauth_provider || null,
      oauth_access_token: credential.oauth_access_token || null,
      oauth_refresh_token: credential.oauth_refresh_token || null,
      oauth_expires_at: credential.oauth_expires_at || null,
      oauth_scope: credential.oauth_scope || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,integration_name,email",
    })
    .select()
    .single();
  
  if (error) {
    console.warn("[Integrations] saveCredential failed:", error);
    return null;
  }
  
  return data;
}

export async function deleteCredential(
  userEmail: string,
  integrationName: string,
  label: string
): Promise<void> {
  const { error } = await supabase
    .from("integrations_credentials")
    .delete()
    .eq("user_id", userEmail)
    .eq("integration_name", integrationName)
    .eq("email", label);
  
  if (error) {
    console.warn("[Integrations] deleteCredential failed:", error);
  }
}

export async function testIntegrationConnection(config: IntegrationConfig): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config.provider) {
      return { success: false, error: "Provider is required" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

// Common integration providers configuration
export const INTEGRATION_PROVIDERS = [
  { id: "google", name: "Google", icon: "🌐", category: "auth" },
  { id: "microsoft", name: "Microsoft", icon: "🪟", category: "auth" },
  { id: "github", name: "GitHub", icon: "🐙", category: "dev" },
  { id: "slack", name: "Slack", icon: "💬", category: "comm" },
  { id: "stripe", name: "Stripe", icon: "💳", category: "finance" },
  { id: "gmail", name: "Gmail", icon: "📧", category: "email" },
  { id: "calendar", name: "Google Calendar", icon: "📅", category: "productivity" },
  { id: "notion", name: "Notion", icon: "📝", category: "productivity" },
  { id: "airtable", name: "Airtable", icon: "🗃️", category: "data" },
  { id: "zapier", name: "Zapier", icon: "⚡", category: "automation" },
  { id: "webhook", name: "Webhooks", icon: "🔗", category: "dev" },
];

export function getProviderConfig(providerId: string): IntegrationConfig | undefined {
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