/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_WORKER_URL: string;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
    readonly VITE_API_TOKEN: string;
    [key: string]: string | undefined;
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export {};