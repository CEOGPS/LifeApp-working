// Supabase operations for integrations management.
// API keys are stored in public.keys. No master password.

import { getSupabaseClient } from "@/lib/supabaseClient";
import { getOwnerId } from "@/lib/owner";
import {
  ENCRYPTED_PREFIX,
  decryptString,
  hasExistingVault,
  isEncryptedValue,
  unlockVaultWithPassword,
} from "@/lib/vaultCrypto";

const KEYS_TABLE = "keys";
const MIN_MASTER_PASSWORD = 8;

export interface IntegrationCredential {
  id: string;
  user_id: string;
  service: string;
  integration_name: string;
  label: string | null;
  encrypted: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface IntegrationConfig {
  provider: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  scopes?: string[];
  additional_config?: Record<string, unknown>;
}

export interface SaveCredentialInput {
  integration_name: string;
  user_email?: string;
  label?: string | null;
  email?: string | null;
  api_key?: string | null;
  status?: string | null;
  oauth_provider?: string | null;
}

export function serviceIdOf(integrationName: string): string {
  return integrationName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requireSession(expectedUserId?: string) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  const userId = data.session?.user?.id;
  if (error || !userId) throw new Error("Sign in to save API keys.");
  if (expectedUserId && expectedUserId !== userId) {
    throw new Error("The signed-in account changed. Reload the page and try again.");
  }
  const ownerId = (await getOwnerId()) || userId;
  return { client, userId, ownerId };
}

let unlocked: { userId: string; password: string } | null = null;

export function isKeyEncryptionUnlocked(userId?: string): boolean {
  return unlocked !== null && (!userId || unlocked.userId === userId);
}

export function lockKeyEncryption(): void {
  unlocked = null;
  decryptedCache.clear();
}

export const KEYS_UNLOCKED_EVENT = "lifeos:keys-unlocked";
const decryptedCache = new Map<string, string>();

export async function listSavedKeyServices(): Promise<string[]> {
  const client = await getSupabaseClient();
  const { data: sess } = await client.auth.getSession();
  if (!sess.session?.user?.id) return [];
  const ownerId = (await getOwnerId()) || sess.session.user.id;
  const { data, error } = await client.from(KEYS_TABLE).select("service").eq("user_id", ownerId);
  if (error) throw new Error(error.message || "Could not list saved keys");
  return ((data as { service: string | null }[] | null) || []).map((r) => r.service || "").filter(Boolean);
}

export async function getDecryptedKey(service: string): Promise<string | null> {
  const hit = decryptedCache.get(service);
  if (hit) return hit;
  const client = await getSupabaseClient();
  const { data: sess } = await client.auth.getSession();
  const sessionUid = sess.session?.user?.id;
  if (!sessionUid) return null;
  const ownerId = (await getOwnerId()) || sessionUid;
  const { data, error } = await client
    .from(KEYS_TABLE)
    .select("key_value")
    .eq("user_id", ownerId)
    .eq("service", service)
    .limit(1);
  if (error) return null;
  const value = (data as { key_value: string | null }[] | null)?.[0]?.key_value;
  if (!value) return null;
  if (!isEncryptedValue(value)) {
    decryptedCache.set(service, value);
    return value;
  }
  if (!unlocked) return null;
  const plain = await decryptString(unlocked.password, value);
  if (plain) decryptedCache.set(service, plain);
  return plain;
}

export async function currentSessionUid(): Promise<string | null> {
  const client = await getSupabaseClient();
  const { data } = await client.auth.getSession();
  return data.session?.user?.id ?? null;
}

async function findEncryptedSample(userId: string): Promise<string | null> {
  const { client, ownerId } = await requireSession(userId);
  const { data, error } = await client
    .from(KEYS_TABLE)
    .select("key_value")
    .eq("user_id", ownerId)
    .like("key_value", `${ENCRYPTED_PREFIX}%`)
    .limit(1);
  if (error) throw new Error(error.message || "Could not read saved keys");
  const sample = (data as { key_value: string | null }[] | null)?.[0]?.key_value;
  return sample && isEncryptedValue(sample) ? sample : null;
}

export async function needsKeyEncryptionSetup(userId: string): Promise<boolean> {
  if (hasExistingVault()) return false;
  return (await findEncryptedSample(userId)) === null;
}

export async function unlockKeyEncryption(
  userId: string,
  password: string,
  confirm?: string
): Promise<void> {
  if (password.length < MIN_MASTER_PASSWORD) {
    throw new Error(`Master password must be at least ${MIN_MASTER_PASSWORD} characters`);
  }
  const { userId: uid } = await requireSession(userId);
  const sample = await findEncryptedSample(uid);
  if (sample) {
    if ((await decryptString(password, sample)) === null) {
      throw new Error("Wrong master password");
    }
  } else if (hasExistingVault()) {
    if ((await unlockVaultWithPassword(password)) === null) {
      throw new Error("Wrong master password (it must match your Secure Vault password)");
    }
  } else if (confirm === undefined || confirm !== password) {
    throw new Error("Master passwords do not match");
  }
  unlocked = { userId: uid, password };
  decryptedCache.clear();
  try {
    window.dispatchEvent(new CustomEvent(KEYS_UNLOCKED_EVENT));
  } catch {
    /* ignore */
  }
}

type KeyRow = {
  id: string;
  user_id: string;
  service: string | null;
  key_value?: string | null;
  label: string | null;
  created_at: string;
  updated_at: string | null;
};

const DISPLAY_COLUMNS = "id,user_id,service,label,created_at,updated_at";

export async function loadCredentials(
  userId: string,
  integrationNames: string[] = []
): Promise<Record<string, IntegrationCredential[]>> {
  const { client, ownerId: uid } = await requireSession(userId);
  const byService = new Map(integrationNames.map((n) => [serviceIdOf(n), n]));

  const [rowsRes, encRes] = await Promise.all([
    client.from(KEYS_TABLE).select(DISPLAY_COLUMNS).eq("user_id", uid).order("created_at", { ascending: false }),
    client.from(KEYS_TABLE).select("id").eq("user_id", uid).like("key_value", `${ENCRYPTED_PREFIX}%`),
  ]);
  if (rowsRes.error) throw new Error(rowsRes.error.message || "Could not load saved keys");
  if (encRes.error) throw new Error(encRes.error.message || "Could not load saved keys");
  const encryptedIds = new Set(((encRes.data as { id: string }[] | null) || []).map((r) => r.id));

  const grouped: Record<string, IntegrationCredential[]> = {};
  for (const row of (rowsRes.data as KeyRow[] | null) || []) {
    if (!row.service) continue;
    const name = byService.get(row.service) || row.service;
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push({
      id: row.id,
      user_id: row.user_id,
      service: row.service,
      integration_name: name,
      label: row.label,
      encrypted: encryptedIds.has(row.id),
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  return grouped;
}

export async function saveCredential(
  userId: string,
  credential: SaveCredentialInput
): Promise<IntegrationCredential | null> {
  const apiKey = credential.api_key?.trim();
  if (!apiKey) return null;

  const { client, ownerId: uid } = await requireSession(userId);
  const service = serviceIdOf(credential.integration_name);
  const { data, error } = await client
    .from(KEYS_TABLE)
    .upsert(
      {
        user_id: uid,
        service,
        key_value: apiKey,
        label: credential.label || credential.email || null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,service" }
    )
    .select(DISPLAY_COLUMNS)
    .single();

  if (error) {
    console.warn("[Integrations] saveCredential failed:", error.message);
    throw new Error(error.message || "saveCredential failed");
  }
  const row = data as KeyRow;
  return {
    id: row.id,
    user_id: row.user_id,
    service,
    integration_name: credential.integration_name,
    label: row.label,
    encrypted: false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function deleteCredential(userId: string, integrationName: string): Promise<void> {
  const { client, ownerId: uid } = await requireSession(userId);
  const { error } = await client.from(KEYS_TABLE).delete().eq("user_id", uid).eq("service", serviceIdOf(integrationName));
  if (error) {
    console.warn("[Integrations] deleteCredential failed:", error.message);
    throw new Error(error.message || "deleteCredential failed");
  }
}

export async function testIntegrationConnection(config: IntegrationConfig): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config.provider) return { success: false, error: "Provider is required" };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

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
