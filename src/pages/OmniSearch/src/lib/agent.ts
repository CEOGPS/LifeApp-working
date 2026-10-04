import type { SearchResult, Platform, SearchMode } from '../types'

const WORKER_URL = import.meta.env.VITE_WORKER_URL || ''

/**
 * Broadcast a query to all supported platforms via the Cloudflare Worker.
 * Returns real results fetched server-side. No simulation.
 */
export async function broadcastQuery(
  query: string,
  mode: SearchMode,
  platforms: Platform[]
): Promise<SearchResult[]> {
  if (!WORKER_URL) {
    throw new Error('Worker not configured. Set VITE_WORKER_URL in .env')
  }

  const payload = {
    query,
    mode,
    platforms: platforms.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      searchUrl: p.searchUrl(query, mode),
    })),
  }

  const res = await fetch(`${WORKER_URL}/api/search/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Worker responded ${res.status}`)
  }

  const data = await res.json() as {
    results: Array<{
      platformId: string
      platformName: string
      category: string
      title?: string
      snippet?: string
      url: string
      status: number
      error?: string
      timestamp: number
    }>
  }

  // Map worker response to SearchResult[]
  return data.results
    .filter(r => !r.error && r.status >= 200 && r.status < 400)
    .map(r => ({
      id: `${r.platformId}-${r.timestamp}-${Math.random().toString(36).slice(2, 7)}`,
      platformId: r.platformId,
      platformName: r.platformName,
      category: r.category as SearchResult['category'],
      title: r.title || `${r.platformName} — search results for "${query}"`,
      snippet: r.snippet || `View full results on ${r.platformName}`,
      url: r.url,
      timestamp: r.timestamp,
      confidence: 0.5,
    }))
}

/**
 * Fetch a URL through the worker proxy to bypass CORS / X-Frame-Options.
 * Returns HTML that can be rendered in an iframe via srcdoc.
 */
export async function proxyFetch(url: string): Promise<{ html: string; contentType: string } | null> {
  if (!WORKER_URL) return null

  try {
    const res = await fetch(`${WORKER_URL}/api/search/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!res.ok) return null

    const contentType = res.headers.get('Content-Type') || 'text/html'
    const html = await res.text()
    return { html, contentType }
  } catch {
    return null
  }
}

/**
 * Deduplicate search results across platforms.
 * Uses normalized title + URL comparison and content similarity.
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>()
  const duplicates: SearchResult[] = []

  for (const result of results) {
    const key = normalizeKey(result.title + result.url)
    const existing = seen.get(key)

    if (existing) {
      if (result.confidence > existing.confidence) {
        duplicates.push({ ...existing, duplicateOf: result.id })
        seen.set(key, result)
      } else {
        duplicates.push({ ...result, duplicateOf: existing.id })
      }
    } else {
      const fuzzyKey = fuzzyTitleKey(result.title)
      const fuzzyMatch = findFuzzyMatch(seen, fuzzyKey)
      if (fuzzyMatch) {
        if (result.confidence > fuzzyMatch.confidence) {
          duplicates.push({ ...fuzzyMatch, duplicateOf: result.id })
          seen.delete(normalizeKey(fuzzyMatch.title + fuzzyMatch.url))
          seen.set(key, result)
        } else {
          duplicates.push({ ...result, duplicateOf: fuzzyMatch.id })
        }
      } else {
        seen.set(key, result)
      }
    }
  }

  const unique = Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence)
  return [...unique, ...duplicates]
}

function normalizeKey(s: string): string {
  return s.toLowerCase()
    .replace(/https?:\/\/(www\.)?/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 80)
}

function fuzzyTitleKey(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .sort()
    .join(' ')
    .slice(0, 60)
}

function findFuzzyMatch(seen: Map<string, SearchResult>, fuzzyKey: string): SearchResult | null {
  for (const result of seen.values()) {
    if (fuzzyTitleKey(result.title) === fuzzyKey) return result
  }
  return null
}
