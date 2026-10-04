import { useMemo, useState, useEffect } from 'react'
import { Maximize2, RotateCcw, Zap } from 'lucide-react'
import { AgentChat } from './AgentChat'
import { PlatformGrid } from './PlatformGrid'
import { LiveBrowser } from './LiveBrowser'
import { useSearchStore } from '../store/searchStore'
import { PLATFORMS_FINAL, getSupportedPlatforms } from '../data/platforms'
import clsx from 'clsx'

interface OmniSearchPanelProps {
  onExpand?: () => void
}

export function OmniSearchPanel({ onExpand }: OmniSearchPanelProps) {
  const { isSearching, session, searchMode, activeTabPlatformId, clearSession } = useSearchStore()

  const stats = useMemo(() => {
    const supported = getSupportedPlatforms(searchMode)
    return { total: PLATFORMS_FINAL.length, supported: supported.length }
  }, [searchMode])

  const uniqueCount = session.results.filter(r => !r.duplicateOf).length
  const dupCount = session.results.filter(r => r.duplicateOf).length

  return (
    <div className="flex flex-col h-full lo-panel overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ff000d, #8c1020)', boxShadow: '0 0 16px rgba(255,0,13,0.4)' }}>
              <Zap size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f0ede8]">Omni Search Agent</h2>
              <p className="text-[10px] text-[#ff000d] opacity-70 tracking-wide">100-platform broadcast · AI-deduplicated</p>
            </div>
          </div>

          {/* Worker connection status */}
          <WorkerStatusBadge />

          {/* Live stats */}
          <div className="hidden md:flex items-center gap-3 ml-2 pl-3 border-l border-white/[0.06]">
            <Stat label="Platforms" value={stats.total} />
            {session.status !== 'idle' && (
              <>
                <Stat label="Queried" value={stats.supported} />
                <Stat label="Unique" value={uniqueCount} color="text-[#00c896]" />
                {dupCount > 0 && <Stat label="Filtered" value={dupCount} color="text-[#ff000d]" />}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={clearSession}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)] transition-all"
          >
            <RotateCcw size={11} />
            Reset
          </button>
          {onExpand && (
            <button
              onClick={onExpand}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)] transition-all"
            >
              <Maximize2 size={11} />
              Expand
            </button>
          )}
        </div>
      </div>

      {/* Three-pane layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr_1fr] min-h-0">
        <div className={clsx('border-r border-white/[0.06] min-h-0', activeTabPlatformId ? 'hidden lg:flex' : 'flex')}>
          <AgentChat />
        </div>
        <div className={clsx('border-r border-white/[0.06] min-h-0', activeTabPlatformId ? 'hidden lg:flex' : 'flex')}>
          <PlatformGrid />
        </div>
        <div className={clsx('min-h-0', activeTabPlatformId ? 'flex' : 'hidden lg:flex')}>
          <LiveBrowser />
        </div>
      </div>

      {/* Status bar */}
      {isSearching && (
        <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-[#080808] border-t border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#ff000d] animate-pulse-glow" />
          <span className="text-[10px] text-[#a9a9a9]">
            {session.status === 'broadcasting' && `Broadcasting to ${stats.supported} platforms...`}
            {session.status === 'collecting' && 'Collecting results...'}
            {session.status === 'deduplicating' && 'Deduplicating findings...'}
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={clsx('text-xs font-semibold', color || 'text-[#f0ede8]')}>{value}</span>
      <span className="text-[10px] text-[#7c7c7c]">{label}</span>
    </div>
  )
}

function WorkerStatusBadge() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const workerUrl = import.meta.env.VITE_WORKER_URL || ''

  useEffect(() => {
    if (!workerUrl) {
      setStatus('disconnected')
      return
    }
    fetch(`${workerUrl}/api/health`)
      .then(r => r.ok ? setStatus('connected') : setStatus('disconnected'))
      .catch(() => setStatus('disconnected'))
  }, [workerUrl])

  const config = {
    checking: { color: '#f59e0b', label: 'Checking worker...', dot: 'animate-pulse' },
    connected: { color: '#00c896', label: 'Worker connected', dot: '' },
    disconnected: { color: '#ff000d', label: workerUrl ? 'Worker offline' : 'Set VITE_WORKER_URL', dot: 'animate-pulse' },
  }[status]

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[rgba(255,255,255,0.03)] border border-white/[0.06]">
      <div className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} style={{ backgroundColor: config.color, boxShadow: `0 0 6px ${config.color}` }} />
      <span className="text-[9px] font-medium" style={{ color: config.color }}>{config.label}</span>
    </div>
  )
}
