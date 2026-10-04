import { useState, useEffect, useRef } from 'react'
import { ExternalLink, RefreshCw, AlertTriangle, ArrowLeft, Globe, Loader2 } from 'lucide-react'
import { getPlatformById, CATEGORIES } from '../data/platforms'
import { useSearchStore } from '../store/searchStore'
import { proxyFetch } from '../lib/agent'

export function LiveBrowser() {
  const { activeTabPlatformId, session, searchMode } = useSearchStore()
  const platform = activeTabPlatformId ? getPlatformById(activeTabPlatformId) : null
  const [iframeKey, setIframeKey] = useState(0)
  const [proxyHtml, setProxyHtml] = useState<string | null>(null)
  const [loadingProxy, setLoadingProxy] = useState(false)
  const [proxyFailed, setProxyFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const searchUrl = platform ? platform.searchUrl(session.query || '', searchMode) : ''

  useEffect(() => {
    setProxyHtml(null)
    setProxyFailed(false)
    setIframeKey(k => k + 1)

    if (platform && !platform.embeddable && searchUrl) {
      setLoadingProxy(true)
      proxyFetch(searchUrl).then(result => {
        if (result && result.html) {
          const baseUrl = new URL(searchUrl).origin
          const rewritten = result.html
            .replace(/href="\/?(?!https?:)/gi, `href="${baseUrl}/`)
            .replace(/src="\/?(?!https?:)/gi, `src="${baseUrl}/`)
          setProxyHtml(rewritten)
        } else {
          setProxyFailed(true)
        }
        setLoadingProxy(false)
      })
    }
  }, [activeTabPlatformId, searchUrl, platform, session.query])

  if (!platform) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-white/[0.06] flex items-center justify-center mb-4">
          <Globe size={28} className="text-[#4d4d4d]" />
        </div>
        <h3 className="text-sm font-medium text-[#a9a9a9]">No platform selected</h3>
        <p className="text-xs text-[#4d4d4d] mt-1 max-w-xs">
          Click any tab in the grid to view that platform's live search results here.
        </p>
      </div>
    )
  }

  const cat = CATEGORIES[platform.category]
  const platformResults = session.results.filter(r => r.platformId === platform.id)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-[#080808]">
        <button
          onClick={() => useSearchStore.getState().setActiveTabPlatformId(null)}
          className="p-1 rounded hover:bg-white/5 text-[#4d4d4d] hover:text-[#ff000d] transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white"
            style={{ backgroundColor: platform.color }}>
            {platform.icon}
          </div>
          <span className="text-xs font-medium text-[#f0ede8]">{platform.name}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${cat.color}20`, color: cat.color }}>
            {cat.label}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141414] border border-white/[0.06]">
          <Globe size={11} className="text-[#4d4d4d] flex-shrink-0" />
          <input type="text" value={searchUrl} readOnly
            className="flex-1 bg-transparent text-[11px] text-[#7c7c7c] outline-none truncate font-mono" />
        </div>
        <button onClick={() => { setIframeKey(k => k + 1); setProxyHtml(null); setProxyFailed(false) }}
          className="p-1 rounded hover:bg-white/5 text-[#4d4d4d] hover:text-[#ff000d] transition-colors" title="Reload">
          <RefreshCw size={14} />
        </button>
        <a href={searchUrl} target="_blank" rel="noopener noreferrer"
          className="p-1 rounded hover:bg-white/5 text-[#4d4d4d] hover:text-[#ff000d] transition-colors" title="Open in new tab">
          <ExternalLink size={14} />
        </a>
      </div>

      {platformResults.length > 0 && (
        <div className="px-3 py-1.5 border-b border-white/[0.06] bg-[#080808]/50">
          <p className="text-[10px] text-[#7c7c7c]">
            <span className="text-[#00c896]">{platformResults.filter(r => !r.duplicateOf).length} unique</span>
            {' · '}
            <span className="text-[#ff000d]">{platformResults.filter(r => r.duplicateOf).length} duplicates</span>
          </p>
        </div>
      )}

      <div className="flex-1 relative bg-white">
        {loadingProxy ? (
          <div className="flex flex-col items-center justify-center h-full bg-[#000000]">
            <Loader2 size={24} className="animate-spin text-[#ff000d] mb-2" />
            <p className="text-[10px] text-[#7c7c7c]">Fetching through worker proxy...</p>
          </div>
        ) : proxyHtml ? (
          <iframe
            key={`proxy-${iframeKey}`}
            srcDoc={proxyHtml}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-forms allow-popups"
            title={`${platform.name} results (proxied)`}
          />
        ) : platform.embeddable ? (
          <iframe
            key={`direct-${iframeKey}`}
            ref={iframeRef}
            src={searchUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={`${platform.name} results`}
          />
        ) : (
          <FallbackView platform={platform} searchUrl={searchUrl} results={platformResults} proxyFailed={proxyFailed} />
        )}
      </div>
    </div>
  )
}

function FallbackView({ platform, searchUrl, results, proxyFailed }: {
  platform: ReturnType<typeof getPlatformById>
  searchUrl: string
  results: Array<{ id: string; title: string; snippet: string; url: string; duplicateOf?: string }>
  proxyFailed: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#000000] p-6 text-center">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
        style={{ backgroundColor: `${platform?.color}20` }}>
        <AlertTriangle size={24} style={{ color: platform?.color }} />
      </div>
      <h3 className="text-sm font-semibold text-[#a9a9a9]">
        {proxyFailed ? 'Worker proxy unavailable' : 'Embedded view unavailable'}
      </h3>
      <p className="text-xs text-[#4d4d4d] mt-1 max-w-sm">
        {proxyFailed
          ? `${platform?.name} blocks framing and the worker proxy couldn't fetch it. Ensure the worker is running.`
          : `${platform?.name} blocks iframe embedding. Open in a new tab to view live results.`}
      </p>
      <a href={searchUrl} target="_blank" rel="noopener noreferrer"
        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white transition-all"
        style={{ background: 'linear-gradient(135deg, #ff000d, #8c1020)', boxShadow: '0 0 12px rgba(255,0,13,0.3)' }}>
        <ExternalLink size={12} />
        Open {platform?.name} in new tab
      </a>
      {results.length > 0 && (
        <div className="w-full max-w-md mt-6 space-y-2">
          <p className="text-[10px] text-[#ff000d] uppercase tracking-wide font-bold">Agent findings from {platform?.name}</p>
          {results.map(r => (
            <div key={r.id} className="glass rounded-lg p-2.5 text-left">
              <p className="text-xs font-medium text-[#f0ede8]">{r.title}</p>
              <p className="text-[10px] text-[#7c7c7c] mt-0.5">{r.snippet}</p>
              {r.duplicateOf && <span className="text-[9px] text-[#ff000d]">duplicate</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
