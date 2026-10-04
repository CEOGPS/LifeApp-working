/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_WORKER_URL: string
  readonly VITE_OLLAMA_ENDPOINT: string
  readonly VITE_OAUTH_GOOGLE_CLIENT_ID: string
  readonly VITE_OAUTH_GITHUB_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
