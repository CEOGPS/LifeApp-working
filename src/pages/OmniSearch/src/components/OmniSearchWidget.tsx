import { useState, useRef } from 'react'
import { Search, Mail, Phone, Image as ImageIcon, Type, Bot, Loader2, ChevronRight, Globe, Upload } from 'lucide-react'
import { useSearchStore } from '../store/searchStore'
import { getSupportedPlatforms } from '../data/platforms'
import clsx from 'clsx'
import type { SearchMode } from '../types'

const MODES: Array<{ mode: SearchMode; icon: typeof Search; label: string }> = [
  { mode: 'text', icon: Type, label: 'Text' },
  { mode: 'email', icon: Mail, label: 'Email' },
  { mode: 'phone', icon: Phone, label: 'Phone' },
  { mode: 'image', icon: ImageIcon, label: 'Image' },
]

interface OmniSearchWidgetProps {
  onExpand?: () => void
}

export function OmniSearchWidget({ onExpand }: OmniSearchWidgetProps) {
  const { searchMode, setSearchMode, inputValue, setInputValue, executeSearch, isSearching, session, messages } = useSearchStore()
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const supportedCount = getSupportedPlatforms(searchMode).length
  const lastAgentMsg = [...messages].reverse().find(m => m.role === 'agent' && m.results)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeSearch(inputValue)
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setInputValue(dataUrl)
      executeSearch(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="lo-panel overflow-hidden group">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center animate-agent-pulse"
            style={{ background: 'linear-gradient(135deg, #ff000d, #8c1020)' }}>
            <Bot size={12} className="text-white" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[#f0ede8]">Omni Search</h3>
            <p className="text-[9px] text-[#ff000d] opacity-70">{supportedCount} platforms ready</p>
          </div>
        </div>
        {onExpand && (
          <button onClick={onExpand}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)] transition-all">
            Full panel
            <ChevronRight size={10} />
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className="flex gap-0.5 p-1.5">
        {MODES.map(({ mode, icon: Icon, label }) => (
          <button key={mode} onClick={() => setSearchMode(mode)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all',
              searchMode === mode
                ? 'bg-[rgba(255,0,13,0.1)] text-[#ff000d]'
                : 'text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)]'
            )}>
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      {/* Search input / image upload */}
      <form onSubmit={handleSubmit} className="px-1.5 pb-1.5">
        <div className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all bg-[#141414]',
          focused ? 'border-[#ff000d]' : 'border-white/[0.06]'
        )}>
          <Search size={13} className={clsx(focused ? 'text-[#ff000d]' : 'text-[#4d4d4d]')} />
          <input ref={inputRef} type="text" value={searchMode === 'image' && inputValue.startsWith('data:') ? '' : inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            placeholder={searchMode === 'image' ? 'Image URL or upload...' : searchMode === 'email' ? 'Email lookup...' : searchMode === 'phone' ? 'Phone lookup...' : 'Search 100 platforms...'}
            className="flex-1 bg-transparent text-xs text-[#f0ede8] placeholder-[#4d4d4d] outline-none"
            disabled={isSearching} />
          {searchMode === 'image' && (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="p-0.5 rounded text-[#4d4d4d] hover:text-[#ff000d] transition-colors"
              title="Upload image">
              <Upload size={13} />
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          <button type="submit" disabled={isSearching || !inputValue.trim()}
            className="px-2 py-0.5 rounded text-[10px] font-medium text-white transition-all disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #ff000d, #8c1020)', boxShadow: '0 0 8px rgba(255,0,13,0.3)' }}>
            {isSearching ? <Loader2 size={11} className="animate-spin" /> : 'Go'}
          </button>
        </div>
        {searchMode === 'image' && inputValue.startsWith('data:') && (
          <div className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0a0a0a] border border-white/[0.06]">
            <img src={inputValue} alt="Selected" className="w-8 h-8 rounded object-cover" />
            <span className="text-[9px] text-[#7c7c7c]">Image loaded — click Go to search</span>
          </div>
        )}
      </form>

      {/* Results preview */}
      {isSearching ? (
        <div className="px-3 py-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin text-[#ff000d]" />
            <span className="text-[10px] text-[#a9a9a9] capitalize">{session.status}...</span>
          </div>
          <div className="space-y-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-6 rounded-md bg-[rgba(255,0,13,0.04)] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
      ) : lastAgentMsg?.results && lastAgentMsg.results.length > 0 ? (
        <div className="px-2.5 py-2 space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
          {lastAgentMsg.results.filter(r => !r.duplicateOf).slice(0, 4).map(r => (
            <div key={r.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[rgba(255,0,13,0.06)] transition-all group/item">
              <div className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: '#ff000d' }}>
                {r.platformName.substring(0, 2).toUpperCase()}
              </div>
              <p className="text-[10px] text-[#a9a9a9] truncate flex-1">{r.title}</p>
              <span className="text-[8px] text-[#4d4d4d] flex-shrink-0">{r.platformName}</span>
            </div>
          ))}
          {lastAgentMsg.results.length > 4 && (
            <button onClick={onExpand}
              className="w-full text-center text-[10px] text-[#7c7c7c] hover:text-[#ff000d] py-1 transition-colors">
              View all {lastAgentMsg.results.filter(r => !r.duplicateOf).length} results →
            </button>
          )}
        </div>
      ) : (
        <div className="px-3 py-3 flex items-center gap-2">
          <Globe size={14} className="text-[#4d4d4d]" />
          <p className="text-[10px] text-[#4d4d4d]">
            Broadcasts to 100 platforms, deduplicates with AI, surfaces only unique results.
          </p>
        </div>
      )}
    </div>
  )
}
