export type SearchMode = 'text' | 'email' | 'phone' | 'image'
export type PlatformCategory = 'social' | 'dating' | 'search' | 'listing' | 'llm'

export interface Platform {
  id: string
  name: string
  category: PlatformCategory
  color: string          // brand color hex
  icon: string           // short label for fallback avatar
  searchUrl: (query: string, mode: SearchMode) => string
  supports: SearchMode[]
  embeddable: boolean    // whether iframe embedding is likely to work
  priority: number       // 1 = high, 3 = low
}

export interface SearchResult {
  id: string
  platformId: string
  platformName: string
  category: PlatformCategory
  title: string
  snippet: string
  url: string
  timestamp: number
  duplicateOf?: string   // id of the canonical result if this is a dup
  confidence: number     // 0-1, how unique/relevant
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  timestamp: number
  results?: SearchResult[]
  query?: string
  mode?: SearchMode
}

export interface SearchSession {
  id: string
  query: string
  mode: SearchMode
  startedAt: number
  status: 'idle' | 'broadcasting' | 'collecting' | 'deduplicating' | 'complete'
  results: SearchResult[]
  activePlatformId: string | null
}

export interface AgentConfig {
  provider: 'ollama' | 'cloudflare' | 'free-llm' | 'telegram'
  model: string
  endpoint: string
  apiKey?: string
}
