/**
 * LifeOS Omni Search Agent — Cloudflare Worker
 * 
 * API Routes:
 *   POST /api/search/broadcast  — Fan out query to N platforms, fetch real results
 *   POST /api/search/proxy      — Fetch a URL server-side (bypasses CORS/X-Frame)
 *   GET  /api/search/history     — Get search history from Supabase
 *   POST /api/agent/chat         — AI agent conversation
 *   GET  /api/health             — Health check
 *   GET  /api/platforms          — List all 100 platforms
 */

export interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  OLLAMA_ENDPOINT: string
  SEARCH_CACHE: KVNamespace
  IMAGE_BUCKET: R2Bucket
  ENVIRONMENT: string
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    try {
      switch (path) {
        case '/api/health':
          return json({ status: 'ok', timestamp: Date.now() }, 200)

        case '/api/search/broadcast':
          if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
          return await handleBroadcast(request, env)

        case '/api/search/proxy':
          if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
          return await handleProxy(request, env)

        case '/api/search/history':
          return await handleHistory(request, env)

        case '/api/agent/chat':
          if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
          return await handleAgentChat(request, env)

        case '/api/oauth/callback':
          return await handleOAuthCallback(request, env)

        default:
          if (path.startsWith('/api/')) return json({ error: 'Not found', path }, 404)
          return new Response('LifeOS Omni Search Agent', { status: 200 })
      }
    } catch (err) {
      console.error('Worker error:', err)
      return json({ error: 'Internal server error', message: String(err) }, 500)
    }
  },
}

// ── Broadcast: fan out to all platforms and fetch real results ──

async function handleBroadcast(request: Request, env: Env): Promise<Response> {
  const { query, mode, platforms } = await request.json() as {
    query: string
    mode: string
    platforms: Array<{ id: string; name: string; category: string; searchUrl: string }>
  }

  if (!query || !platforms?.length) {
    return json({ error: 'Missing query or platforms' }, 400)
  }

  // Check cache
  const cacheKey = `search:${mode}:${encodeURIComponent(query)}`
  const cached = await env.SEARCH_CACHE?.get(cacheKey, 'json')
  if (cached) return json({ ...cached, cached: true }, 200)

  // Fan out — fetch all platform pages concurrently
  // Use Promise.allSettled so one failure doesn't kill the whole batch
  const BATCH_SIZE = 15 // Limit concurrency to avoid overwhelming
  const results: any[] = []

  for (let i = 0; i < platforms.length; i += BATCH_SIZE) {
    const batch = platforms.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(p => fetchPlatformResults(p, query))
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(...r.value)
    }
  }

  // Save to Supabase (non-blocking)
  saveToSupabase(env, { query, mode, results }).catch(err =>
    console.error('Supabase save failed:', err)
  )

  // Cache for 5 min
  if (env.SEARCH_CACHE) {
    env.SEARCH_CACHE.put(cacheKey, JSON.stringify({ query, mode, results }), {
      expirationTtl: 300,
    }).catch(() => {})
  }

  return json({ query, mode, results, count: results.length }, 200)
}

/**
 * Fetch a single platform's search page and extract structured results.
 */
async function fetchPlatformResults(
  platform: { id: string; name: string; category: string; searchUrl: string },
  query: string
): Promise<any[]> {
  try {
    const response = await fetch(platform.searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
      redirect: 'follow',
    })

    if (!response.ok) {
      return [{
        platformId: platform.id,
        platformName: platform.name,
        category: platform.category,
        status: response.status,
        url: platform.searchUrl,
        error: `HTTP ${response.status}`,
        timestamp: Date.now(),
      }]
    }

    const html = await response.text()
    const extracted = extractResults(html, platform.searchUrl, query)

    // If we couldn't extract structured results, return the page metadata
    if (extracted.length === 0) {
      const title = extractTitle(html)
      const description = extractMetaDescription(html)
      return [{
        platformId: platform.id,
        platformName: platform.name,
        category: platform.category,
        status: 200,
        url: platform.searchUrl,
        title: title || `${platform.name} — results for "${query}"`,
        snippet: description || `Search results page on ${platform.name}`,
        timestamp: Date.now(),
      }]
    }

    return extracted.map(e => ({
      ...e,
      platformId: platform.id,
      platformName: platform.name,
      category: platform.category,
      status: 200,
      timestamp: Date.now(),
    }))
  } catch (err) {
    return [{
      platformId: platform.id,
      platformName: platform.name,
      category: platform.category,
      status: 0,
      url: platform.searchUrl,
      error: String(err),
      timestamp: Date.now(),
    }]
  }
}

/**
 * Extract search results from HTML.
 * Tries common patterns: <a> tags with titles, meta descriptions, OG tags.
 */
function extractResults(html: string, baseUrl: string, query: string): Array<{ title: string; snippet: string; url: string }> {
  const results: Array<{ title: string; snippet: string; url: string }> = []
  const baseOrigin = new URL(baseUrl).origin

  // Extract all anchor tags with href and text content
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  const seen = new Set<string>()

  while ((match = linkRegex.exec(html)) !== null && results.length < 10) {
    const rawHref = match[1]
    const innerText = stripTags(match[2]).trim()

    // Skip empty, javascript, anchor links
    if (!innerText || innerText.length < 10) continue
    if (rawHref.startsWith('#') || rawHref.startsWith('javascript:')) continue

    // Resolve relative URLs
    let fullUrl: string
    try {
      fullUrl = new URL(rawHref, baseUrl).href
    } catch {
      continue
    }

    // Skip same-page / nav links
    if (fullUrl === baseUrl || fullUrl === baseOrigin + '/') continue
    if (seen.has(fullUrl)) continue
    seen.add(fullUrl)

    // Extract snippet from nearby text
    const snippet = extractNearbySnippet(html, match.index, 200)

    results.push({
      title: innerText.substring(0, 200),
      snippet: snippet || `Result from ${new URL(fullUrl).hostname}`,
      url: fullUrl,
    })
  }

  return results
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? stripTags(match[1]) : null
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i)
  return match ? match[1] : null
}

function extractNearbySnippet(html: string, aroundIndex: number, radius: number): string {
  const start = Math.max(0, aroundIndex - radius)
  const end = Math.min(html.length, aroundIndex + radius)
  const chunk = html.substring(start, end)
  return stripTags(chunk).substring(0, 150).trim()
}

// ── Proxy: fetch URL server-side, return raw HTML ──────────────

async function handleProxy(request: Request, _env: Env): Promise<Response> {
  const { url } = await request.json() as { url: string }
  if (!url) return json({ error: 'Missing URL' }, 400)

  let targetUrl: URL
  try {
    targetUrl = new URL(url)
  } catch {
    return json({ error: 'Invalid URL' }, 400)
  }

  const response = await fetch(targetUrl.href, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cf: { cacheTtl: 60, cacheEverything: true },
  })

  const contentType = response.headers.get('Content-Type') || 'text/html'
  const body = await response.text()

  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': contentType,
      'X-Original-URL': targetUrl.href,
      ...CORS_HEADERS,
    },
  })
}

// ── History ─────────────────────────────────────────────────────

async function handleHistory(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const supabase = getSupabase(env)
  const { data, error } = await supabase.from('omni_search_sessions')
    .select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) return json({ error: error.message }, 500)
  return json({ history: data }, 200)
}

// ── Agent Chat ──────────────────────────────────────────────────

async function handleAgentChat(request: Request, env: Env): Promise<Response> {
  const { messages, query, mode, provider = 'ollama' } = await request.json() as {
    messages: Array<{ role: string; content: string }>
    query: string
    mode: string
    provider?: string
  }

  let response: string
  switch (provider) {
    case 'ollama':
      response = await callOllama(env, messages, query, mode)
      break
    case 'cloudflare-ai':
      response = await callCloudflareAI(env, messages, query, mode)
      break
    default:
      response = await callOllama(env, messages, query, mode)
  }

  return json({ response, provider }, 200)
}

async function callOllama(env: Env, messages: any[], query: string, mode: string): Promise<string> {
  const systemPrompt = `You are the LifeOS Omni Search Agent. You help users find information across 100 platforms. Current search mode: ${mode}. Query: "${query}". Provide a concise summary of what you found and suggest next steps.`
  try {
    const response = await fetch(`${env.OLLAMA_ENDPOINT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: false,
      }),
    })
    if (!response.ok) throw new Error(`Ollama error: ${response.status}`)
    const data = await response.json() as { message: { content: string } }
    return data.message.content
  } catch {
    return `Search for "${query}" (${mode}) completed. Review the platform tabs for detailed results.`
  }
}

async function callCloudflareAI(_env: Env, _messages: any[], _query: string, _mode: string): Promise<string> {
  // Implement with your Cloudflare Account ID + AI binding
  return 'Cloudflare AI not configured. Set up Workers AI binding in wrangler.toml.'
}

// ── OAuth ───────────────────────────────────────────────────────

async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code) return json({ error: 'Missing authorization code' }, 400)

  const stateData = await env.SEARCH_CACHE?.get(`oauth:${state}`, 'json') as any
  if (!stateData) return json({ error: 'Invalid or expired state' }, 400)

  return json({ status: 'oauth_callback', provider: stateData.provider }, 200)
}

// ── Supabase helper ─────────────────────────────────────────────

function getSupabase(env: Env) {
  const baseUrl = env.SUPABASE_URL
  const apiKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_ANON_KEY || ''
  return {
    from(table: string) {
      const tableUrl = `${baseUrl}/rest/v1/${table}`
      return {
        select: async (columns = '*') => {
          const res = await fetch(`${tableUrl}?select=${columns}`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` },
          })
          return { data: await res.json(), error: res.ok ? null : await res.json() }
        },
        insert: async (data: any) => {
          const res = await fetch(tableUrl, {
            method: 'POST',
            headers: {
              'apikey': apiKey, 'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json', 'Prefer': 'return=representation',
            },
            body: JSON.stringify(data),
          })
          return { data: await res.json(), error: res.ok ? null : await res.json() }
        },
        order: function() { return this },
        limit: function() { return this },
      }
    },
  }
}

async function saveToSupabase(env: Env, data: { query: string; mode: string; results: any[] }) {
  if (!env.SUPABASE_SERVICE_KEY && !env.SUPABASE_ANON_KEY) return
  const supabase = getSupabase(env)
  await supabase.from('omni_search_sessions').insert({
    query: data.query,
    mode: data.mode,
    results_count: data.results.length,
    results: data.results,
  })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
