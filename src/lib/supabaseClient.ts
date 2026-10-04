// src/lib/supabaseClient.ts
// Supabase client for browser - config fetched from worker at runtime

import { createClient } from "@supabase/supabase-js";

let supabaseInstance: ReturnType<typeof createClient> | null = null;
let configPromise: Promise<{ supabaseUrl: string; supabaseAnonKey: string }> | null = null;
let initPromise: Promise<ReturnType<typeof createClient>> | null = null;

async function fetchConfig(): Promise<{ supabaseUrl: string; supabaseAnonKey: string }> {
  if (configPromise) return configPromise;
  
  configPromise = (async () => {
    const workerUrl = import.meta.env.VITE_WORKER_URL || "https://lifeos1-api.ceogps.workers.dev";
    try {
      const res = await fetch(`${workerUrl}/api/config`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[Supabase] Failed to fetch config from worker:", e);
    }
    // Fallback to build-time env or defaults
    return {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "https://mhvcdstgkyplhzjptgfr.supabase.co",
      supabaseAnonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    };
  })();
  
  return configPromise;
}

async function initSupabase(): Promise<ReturnType<typeof createClient>> {
  if (supabaseInstance) return supabaseInstance;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    const { supabaseUrl, supabaseAnonKey } = await fetchConfig();
    
    if (!supabaseAnonKey) {
      throw new Error("Supabase anon key not configured. Set SUPABASE_ANON_KEY in worker environment.");
    }
    
    try {
      for (let i = window.localStorage.length - 1; i >= 0; i--) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith("sb-") && key.includes("auth-token")) {
          window.localStorage.removeItem(key);
        }
      }
    } catch {
      /* a dead saved login was making every CRM request return 401 */
    }

    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "lifeos-no-session",
      },
      global: {
        headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      },
    });

    return supabaseInstance;
  })();
  
  return initPromise;
}

// Create a proxy that initializes on first property access and handles nested access
function createSupabaseProxy() {
  // Create nested proxies for known namespaces (auth, storage, functions, etc.)
  const namespaceProxies: Record<string, any> = {};
  
  function getNamespaceProxy(namespace: string) {
    if (!namespaceProxies[namespace]) {
      namespaceProxies[namespace] = new Proxy({}, {
        get(target, prop, receiver) {
          return async (...args: any[]) => {
            const client = await initSupabase();
            return (client as any)[namespace][prop](...args);
          };
        },
      });
    }
    return namespaceProxies[namespace];
  }
  
  const knownNamespaces = ["auth", "storage", "functions", "realtime", "channel", "schema"];
  
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      // Initialize on first access
      if (!supabaseInstance && !initPromise) {
        initSupabase().catch(e => console.error("[Supabase] Init failed:", e));
      }
      
      // Handle known namespaces with their own proxies
      if (typeof prop === "string" && knownNamespaces.includes(prop)) {
        return getNamespaceProxy(prop);
      }
      
      // If still not ready, return a function that waits for init then delegates
      if (!supabaseInstance) {
        return async (...args: any[]) => {
          const client = await initSupabase();
          return (client as any)[prop](...args);
        };
      }
      
      // Return actual property from initialized client
      const value = (supabaseInstance as any)[prop];
      
      // If it's a function, bind it to the client
      if (typeof value === "function") {
        return value.bind(supabaseInstance);
      }
      
      return value;
    },
  };
  
  return new Proxy({}, handler);
}

export const supabase = createSupabaseProxy();

// Export async getter for explicit use
export async function getSupabaseClient() {
  return initSupabase();
}

// Helper to check connection
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const client = await initSupabase();
    const { error } = await client.from("user_settings").select("count", { count: "exact", head: true });
    return !error;
  } catch {
    return false;
  }
}