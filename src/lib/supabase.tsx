import { createClient } from '@supabase/supabase-js';
import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

interface SupabaseContextType {
  supabase: typeof supabase;
}

const SupabaseContext = createContext<SupabaseContextType>({ supabase });

export function SupabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => useContext(SupabaseContext);

export type DbFetchOptions = {
  method?: string;
  body?: string;
  prefer?: string;
};

/** Minimal PostgREST helper used by MarketingPanel CRM sync. */
export async function dbFetch(path: string, opts: DbFetchOptions = {}): Promise<unknown> {
  const method = (opts.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    apikey: supabaseAnonKey ?? "",
    Authorization: `Bearer ${supabaseAnonKey ?? ""}`,
    "Content-Type": "application/json",
  };
  if (opts.prefer !== undefined && opts.prefer !== "") {
    headers["Prefer"] = opts.prefer;
  }

  // Prefer the user's access token when signed in so RLS applies.
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* keep anon key */
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers,
    body: opts.body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`dbFetch ${method} ${path} failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;

  const text = await res.text();
  if (!text) return null;
  const data = JSON.parse(text) as unknown;

  // PostgREST returns an array for Prefer: return=representation
  if (opts.prefer?.includes("return=representation") && Array.isArray(data)) {
    return data[0] ?? null;
  }
  return data;
}
