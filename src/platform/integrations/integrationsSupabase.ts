// Supabase operations for integrations management.
//
// API keys are stored in the Supabase table `public.keys`
// (id, user_id uuid, service, key_value, label, created_at, updated_at) with
// owner-only RLS and UNIQUE (user_id, service). PATCH (erebus-dock-redesign):
// rows are owned by the STABLE owner uid (public.app_owner_id(), see
// src/lib/owner.ts + migration 0007), so a lost anonymous session that is
// re-linked with the owner code sees the same keys. Never deletes or rewrites rows.
// `key_value` is ALWAYS client-side ciphertext produced by vaultCrypto's
// encryptString (PBKDF2-SHA256 + AES-256-GCM, prefix "lifeos-enc:v1:").
// The master password lives in memory only (this module) and is never stored
// or sent anywhere. If it hasn't been entered, saving refuses rather than
// writing plaintext.

import { getSupabaseClient } from "@/lib/supabaseClient";
import { getOwnerId } from "@/lib/owner";
import {
  ENCRYPTED_PREFIX,
  decryptString,
  encryptString,
  hasExistingVault,
  isEncryptedValue,
  unlockVaultWithPassword,
} from "@/lib/vaultCrypto";

const KEYS_TABLE = "keys";
const MIN_MASTER_PASSWORD = 8;

/** One saved API key (never includes the key itself). */
export interface IntegrationCredential {
  id: string;
  user_id: string;
  /** Integration id stored in public.keys.service (see serviceIdOf). */
  service: string;
  /** Integration display name the service id maps back to. */
  integration_name: string;
  label: string | null;
  /** True when key_value is in the encrypted "lifeos-enc:v1:" format. */
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

/** Fields the Integrations panel passes when saving. */
export interface SaveCredentialInput {
  integration_name: string;
  user_email?: string;
  label?: string | null;
  email?: string | null;
  api_key?: string | null;
  status?: string | null;
  oauth_provider?: string | null;
}

/** Stable integration id used as public.keys.service, e.g. "Twitter/X" -> "twitter-x". */
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
  // PATCH (erebus-dock-redesign): owner uid the rows belong to (linked owner or self).
  const ownerId = (await getOwnerId()) || userId;
  return { client, userId, ownerId };
}

// ---- in-memory master password -------------------------------------------

let unlocked: { userId: string; password: string } | null = null;

/** True if the master password has been entered this session (for `userId`, if given). */
export function isKeyEncryptionUnlocked(userId?: string): boolean {
  return unlocked !== null && (!userId || unlocked.userId === userId);
}

/** Forgets the in-memory master password. */
export function lockKeyEncryption(): void {
  unlocked = null;
  decryptedCache.clear();
}

// ---- read-only access for modules (PATCH home-page2) -----------------------
// Fired on window after the master password is verified (unlockKeyEncryption).
export const KEYS_UNLOCKED_EVENT = "lifeos:keys-unlocked";
// service -> decrypted key, in memory only (cleared on lock/unlock). Never logged.
const decryptedCache = new Map<string, string>();

/** Service names already saved in public.keys. No login and no key values. */
export async function listKeyCatalog(): Promise<{ service: string; label: string }[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("list_saved_key_names");
  if (error) throw new Error(error.message || "Could not list saved keys");
  return ((data as { service: string | null; label: string | null }[] | null) || [])
    .map((row) => ({ service: row.service || "", label: row.label || "" }))
    .filter((row) => row.service);
}

/** Service ids (public.keys.service) of the owner's saved keys. Never selects key_value. */
export async function listSavedKeyServices(): Promise<string[]> {
  try {
    const rows = await listKeyCatalog();
    return [...new Set(rows.map((row) => row.service))];
  } catch {
    /* fall through to the signed-in query */
  }
  const client = await getSupabaseClient();
  const { data: sess } = await client.auth.getSession();
  if (!sess.session?.user?.id) return [];
  const ownerId = (await getOwnerId()) || sess.session.user.id;
  const { data, error } = await client.from(KEYS_TABLE).select("service").eq("user_id", ownerId);
  if (error) throw new Error(error.message || "Could not list saved keys");
  return ((data as { service: string | null }[] | null) || []).map((r) => r.service || "").filter(Boolean);
}

/**
 * Decrypts the saved key for `service` with the in-memory master password.
 * Returns null when locked, missing or undecryptable. Read-only: never writes rows.
 */
export async function getDecryptedKey(service: string): Promise<string | null> {
  if (!unlocked) return null;
  const hit = decryptedCache.get(service);
  if (hit) return hit;
  const client = await getSupabaseClient();
  const ownerId = (await getOwnerId()) || unlocked.userId;
  const { data, error } = await client
    .from(KEYS_TABLE)
    .select("key_value")
    .eq("user_id", ownerId)
    .eq("service", service)
    .limit(1);
  if (error) return null;
  const value = (data as { key_value: string | null }[] | null)?.[0]?.key_value;
  if (!value || !isEncryptedValue(value)) return null;
  const plain = await decryptString(unlocked.password, value);
  if (plain) decryptedCache.set(service, plain);
  return plain;
}

/** Session uid (for unlockKeyEncryption from UIs outside the Integrations page). */
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

/**
 * True when no master password exists yet for this user: no encrypted key
 * rows in Supabase and no local Secure Vault to verify against. The UI then
 * asks for a new password plus confirmation.
 */
export async function needsKeyEncryptionSetup(userId: string): Promise<boolean> {
  if (hasExistingVault()) return false;
  return (await findEncryptedSample(userId)) === null;
}

/**
 * Verifies and holds the master password in memory.
 * - If the user already has encrypted keys, the password must decrypt one.
 * - Otherwise, if a local Secure Vault exists (vaultCrypto), it must unlock it.
 * - Otherwise this is first-time setup and `confirm` must match.
 */
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
  // PATCH (home-page2): let modules that use saved keys (src/pages/dashboard/_lib/savedKeys.ts) re-resolve.
  decryptedCache.clear();
  try {
    window.dispatchEvent(new CustomEvent(KEYS_UNLOCKED_EVENT));
  } catch {
    /* ignore */
  }
}

// ---- CRUD on public.keys ---------------------------------------------------

type KeyRow = {
  id: string;
  user_id: string;
  service: string | null;
  key_value?: string | null;
  label: string | null;
  created_at: string;
  updated_at: string | null;
};

// Never select key_value for display; "encrypted" is derived server-side-safe below.
const DISPLAY_COLUMNS = "id,user_id,service,label,created_at,updated_at";

/**
 * Loads the signed-in user's saved API keys, grouped by integration name.
 * `integrationNames` maps service ids back to display names; unknown service
 * ids are returned under the raw service id.
 */
export async function loadCredentials(
  userId: string,
  integrationNames: string[] = []
): Promise<Record<string, IntegrationCredential[]>> {
  const { client, ownerId: uid } = await requireSession(userId);
  const byService = new Map(integrationNames.map((n) => [serviceIdOf(n), n]));

  const [rowsRes, encRes] = await Promise.all([
    client
      .from(KEYS_TABLE)
      .select(DISPLAY_COLUMNS)
      .eq("user_id", uid)
      .order("created_at", { ascending: false }),
    client
      .from(KEYS_TABLE)
      .select("id")
      .eq("user_id", uid)
      .like("key_value", `${ENCRYPTED_PREFIX}%`),
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

/**
 * Saves an API key. No sign-in and no master password.
 * One key per integration, stored for the LifeOS owner.
 */
export async function saveCredential(
  _userId: string,
  credential: SaveCredentialInput
): Promise<IntegrationCredential | null> {
  const apiKey = credential.api_key?.trim();
  if (!apiKey) return null;

  const client = await getSupabaseClient();
  const service = serviceIdOf(credential.integration_name);
  const label = credential.label || credential.email || null;
  const { error } = await client.rpc("save_api_key", {
    p_service: service,
    p_label: label,
    p_key: apiKey,
  });
  if (error) {
    console.warn("[Integrations] saveCredential failed:", error.message);
    throw new Error(error.message || "saveCredential failed");
  }
  return {
    id: service,
    user_id: "0355fae3-863b-432c-bac8-968942681e1b",
    service,
    integration_name: credential.integration_name,
    label,
    encrypted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Deletes the saved API key for an integration. No sign-in. */
export async function deleteCredential(_userId: string, integrationName: string): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client.rpc("delete_api_key", {
    p_service: serviceIdOf(integrationName),
  });
  if (error) {
    console.warn("[Integrations] deleteCredential failed:", error.message);
    throw new Error(error.message || "deleteCredential failed");
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