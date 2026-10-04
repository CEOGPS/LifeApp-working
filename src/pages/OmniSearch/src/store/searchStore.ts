import { create } from 'zustand'
import type { ChatMessage, SearchResult, SearchMode, SearchSession } from '../types'
import { PLATFORMS_FINAL } from '../data/platforms'
import { deduplicateResults, broadcastQuery } from '../lib/agent'

interface SearchStore {
  session: SearchSession
  messages: ChatMessage[]
  isSearching: boolean
  error: string | null
  activeTabPlatformId: string | null
  searchMode: SearchMode
  inputValue: string

  setSearchMode: (mode: SearchMode) => void
  setInputValue: (v: string) => void
  setActiveTabPlatformId: (id: string | null) => void
  executeSearch: (query: string) => Promise<void>
  clearSession: () => void
  clearError: () => void
}

const genId = () => Math.random().toString(36).slice(2, 11)

export const useSearchStore = create<SearchStore>((set, get) => ({
  session: {
    id: genId(),
    query: '',
    mode: 'text',
    startedAt: Date.now(),
    status: 'idle',
    results: [],
    activePlatformId: null,
  },
  messages: [
    {
      id: genId(),
      role: 'agent',
      content: 'Omni Search Agent initialized. I search across 100 platforms simultaneously — social media, dating sites, search engines, listing directories, and AI-powered search tools. Results are deduplicated and only unique findings are surfaced.\n\nWhat would you like to search for?',
      timestamp: Date.now(),
    },
  ],
  isSearching: false,
  error: null,
  activeTabPlatformId: null,
  searchMode: 'text',
  inputValue: '',

  setSearchMode: (mode) => set({ searchMode: mode }),
  setInputValue: (v) => set({ inputValue: v }),
  setActiveTabPlatformId: (id) => set({ activeTabPlatformId: id }),
  clearError: () => set({ error: null }),

  executeSearch: async (query: string) => {
    if (!query.trim() || get().isSearching) return

    const mode = get().searchMode
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: query,
      timestamp: Date.now(),
      mode,
    }

    const supportedPlatforms = PLATFORMS_FINAL.filter(p => p.supports.includes(mode))

    set((state) => ({
      messages: [...state.messages, userMsg],
      isSearching: true,
      error: null,
      session: {
        ...state.session,
        query,
        mode,
        status: 'broadcasting',
        startedAt: Date.now(),
        results: [],
      },
    }))

    try {
      // Phase 1: Broadcast to worker — real fetch, no simulation
      set((s) => ({ session: { ...s.session, status: 'broadcasting' } }))

      const rawResults = await broadcastQuery(query, mode, supportedPlatforms)

      // Phase 2: Deduplicate
      set((s) => ({ session: { ...s.session, status: 'deduplicating' } }))

      const deduped = deduplicateResults(rawResults)

      // Phase 3: Complete
      set((s) => ({
        session: { ...s.session, status: 'complete', results: deduped },
        isSearching: false,
        messages: [...s.messages, {
          id: genId(),
          role: 'agent',
          content: formatAgentResponse(query, mode, deduped, supportedPlatforms.length, rawResults.length),
          timestamp: Date.now(),
          results: deduped,
          query,
          mode,
        }],
      }))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed'
      set((s) => ({
        isSearching: false,
        error: errorMsg,
        session: { ...s.session, status: 'idle' },
        messages: [...s.messages, {
          id: genId(),
          role: 'agent',
          content: `Search failed: ${errorMsg}\n\nMake sure the Cloudflare Worker is running and VITE_WORKER_URL is set in your .env file.`,
          timestamp: Date.now(),
        }],
      }))
    }
  },

  clearSession: () => set({
    session: { id: genId(), query: '', mode: 'text', startedAt: Date.now(), status: 'idle', results: [], activePlatformId: null },
    messages: [{
      id: genId(),
      role: 'agent',
      content: 'Session cleared. What would you like to search for?',
      timestamp: Date.now(),
    }],
    isSearching: false,
    error: null,
    activeTabPlatformId: null,
    inputValue: '',
  }),
}))

function formatAgentResponse(query: string, mode: SearchMode, results: SearchResult[], platformsQueried: number, rawCount: number): string {
  const modeLabel = mode === 'email' ? 'reverse email' : mode === 'phone' ? 'reverse phone' : mode === 'image' ? 'reverse image' : 'text'
  const uniqueCount = results.filter(r => !r.duplicateOf).length
  const dupCount = rawCount - uniqueCount

  let msg = `**Search Complete** — ${modeLabel} query: "${query}"\n\n`
  msg += `Broadcast to ${platformsQueried} platforms\n`
  msg += `Collected ${rawCount} raw results\n`
  if (dupCount > 0) msg += `Filtered ${dupCount} duplicates\n`
  msg += `${uniqueCount} unique findings surfaced\n\n`

  if (results.length > 0) {
    msg += `**Top unique results:**\n`
    results.slice(0, 8).forEach((r, i) => {
      msg += `\n${i + 1}. **${r.platformName}** — ${r.title}\n   ${r.snippet}\n`
    })
    if (results.length > 8) {
      msg += `\n...and ${results.length - 8} more. Click any tab below to see that platform's raw results.`
    }
  } else {
    msg += `No results returned from the worker. Check that the worker is fetching platform pages correctly.`
  }

  return msg
}
