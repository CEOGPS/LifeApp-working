// src/lib/accessToken.ts
// PATCH (worker-ai-route): Supabase access token for Cloudflare Worker calls.
// The app signs in anonymously (SupabaseAuthContext), so this works without a
// visible sign-in. It uses the SAME client as SupabaseAuthContext
// (src/lib/supabaseClient.ts) so no second GoTrue client refreshes the session.
import { getSupabaseClient } from "./supabaseClient";

export async function getAccessToken(): Promise<string | null> {
  try {
    const client = await getSupabaseClient();
    const { data } = await client.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

/** `{ Authorization: "Bearer <token>" }`, or `{}` when there is no session yet. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}