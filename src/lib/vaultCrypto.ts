// Real client-side encryption for the LifeOS Secure Vault.
//
// Nothing here ever leaves the browser: the master password derives an
// AES-256 key via PBKDF2, which encrypts the vault's JSON payload with
// AES-GCM before it's written to localStorage. Only the encrypted blob
// (ciphertext + salt + iv, none of which are secret on their own) is ever
// persisted - the plaintext items only exist in memory while unlocked.
//
// This replaces a previous implementation that accepted any 8+ character
// string as a "master password" and stored everything as plain JSON.

const STORAGE_KEY = "vault_encrypted_v1";
const PBKDF2_ITERATIONS = 250_000;

export type EncryptedBlob = {
  salt: string;
  iv: string;
  data: string;
};

function toBase64(bytes: ArrayBuffer): string {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** True if an encrypted vault already exists in this browser. */
export function hasExistingVault(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/** Encrypts `items` under `password` and persists it, overwriting any prior vault. */
export async function saveVault(
  password: string,
  items: unknown[],
): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(items)),
  );
  const blob: EncryptedBlob = {
    salt: toBase64(salt.buffer as ArrayBuffer),
    iv: toBase64(iv.buffer as ArrayBuffer),
    data: toBase64(ciphertext),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
}

/**
 * Attempts to decrypt the stored vault with `password`.
 * Returns the decrypted items on success, or `null` if the password is
 * wrong or the stored data is corrupted/missing.
 */
export async function unlockVaultWithPassword(
  password: string,
): Promise<unknown[] | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const blob: EncryptedBlob = JSON.parse(raw);
    const salt = fromBase64(blob.salt);
    const iv = fromBase64(blob.iv);
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      fromBase64(blob.data) as BufferSource,
    );
    const text = new TextDecoder().decode(plaintext);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Wrong password (AES-GCM auth tag fails) or corrupted/legacy data.
    return null;
  }
}

/** Permanently destroys the encrypted vault. Cannot be undone. */
export function purgeVault(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Field-level encryption for individual secrets (e.g. API keys saved to the
// Supabase `public.keys` table). Same primitives as the vault above:
// PBKDF2-SHA256 (250k iterations) -> AES-256-GCM, with a fresh random salt and
// IV per value. The output is a self-describing string so encrypted values can
// always be told apart from legacy plaintext:
//   lifeos-enc:v1:<salt b64>:<iv b64>:<ciphertext b64>

export const ENCRYPTED_PREFIX = "lifeos-enc:v1:";

/** True if `value` is in the `lifeos-enc:v1:` encrypted format. */
export function isEncryptedValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

/** Encrypts `plaintext` under `password`. Never returns plaintext. */
export async function encryptString(
  password: string,
  plaintext: string,
): Promise<string> {
  if (!password) throw new Error("A master password is required to encrypt");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  return (
    ENCRYPTED_PREFIX +
    [
      toBase64(salt.buffer as ArrayBuffer),
      toBase64(iv.buffer as ArrayBuffer),
      toBase64(ciphertext),
    ].join(":")
  );
}

/**
 * Decrypts a value produced by `encryptString`. Returns `null` if the password
 * is wrong, the value is corrupted, or it isn't in the encrypted format.
 */
export async function decryptString(
  password: string,
  value: string,
): Promise<string | null> {
  if (!password || !isEncryptedValue(value)) return null;
  const parts = value.slice(ENCRYPTED_PREFIX.length).split(":");
  if (parts.length !== 3) return null;
  try {
    const [salt, iv, data] = parts.map(fromBase64);
    const key = await deriveKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      data as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
