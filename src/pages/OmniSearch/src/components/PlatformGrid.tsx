import { useState, useMemo } from 'react'
import { Users, Heart, Search as SearchIcon, MapPin, Brain, LayoutGrid } from 'lucide-react'
import { PLATFORMS_FINAL, CATEGORIES, getSupportedPlatforms } from '../data/platforms'
import { useSearchStore } from '../store/searchStore'
import clsx from 'clsx'
import type { PlatformCategory } from '../types'

const CATEGORY_ICONS: Record<string, typeof Users> = {
  social: Users, dating: Heart, search: SearchIcon, listing: MapPin, llm: Brain,
}

export function PlatformGrid() {
  const { searchMode, activeTabPlatformId, setActiveTabPlatformId, isSearching, session } = useSearchStore()
  const [activeCategory, setActiveCategory] = useState<PlatformCategory | 'all'>('all')
  const [showUnsupported, setShowUnsupported] = useState(false)

  const platforms = useMemo(() => {
    let list = showUnsupported ? PLATFORMS_FINAL : getSupportedPlatforms(searchMode)
    if (activeCategory !== 'all') list = list.filter(p => p.category === activeCategory)
    return list
  }, [searchMode, activeCategory, showUnsupported])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of getSupportedPlatforms(searchMode)) counts[p.category] = (counts[p.category] || 0) + 1
    return counts
  }, [searchMode])

  const resultsByPlatform = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of session.results) map[r.platformId] = (map[r.platformId] || 0) + 1
    return map
  }, [session.results])

  return (
    <div className="flex flex-col h-full">
      {/* Category filter bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.06] overflow-x-auto scrollbar-thin">
        <button
          onClick={() => setActiveCategory('all')}
          className={clsx(
            'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all',
            activeCategory === 'all'
              ? 'bg-[rgba(255,0,13,0.1)] text-[#ff000d] border-l-2 border-[#ff000d]'
              : 'text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)]'
          )}
        >
          <LayoutGrid size={12} />
          All ({PLATFORMS_FINAL.filter(p => p.supports.includes(searchMode)).length})
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const Icon = CATEGORY_ICONS[key]
          const count = categoryCounts[key] || 0
          if (count === 0 && !showUnsupported) return null
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key as PlatformCategory)}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all',
                activeCategory === key ? 'border-l-2' : 'text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)]'
              )}
              style={activeCategory === key ? { backgroundColor: `${cat.color}15`, color: cat.color, borderColor: cat.color } : undefined}
            >
              <Icon size={12} style={{ color: cat.color }} />
              {cat.label} ({count})
            </button>
          )
        })}
        <button
          onClick={() => setShowUnsupported(!showUnsupported)}
          className={clsx(
            'ml-auto px-2 py-1 rounded-md text-[10px] whitespace-nowrap transition-colors',
            showUnsupported ? 'text-[#ff000d]' : 'text-[#4d4d4d] hover:text-[#a9a9a9]'
          )}
        >
          {showUnsupported ? 'Showing all 100' : 'Show unsupported'}
        </button>
      </div>

      {/* Tab grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-1.5">
          {platforms.map((platform) => {
            const isActive = activeTabPlatformId === platform.id
            const resultCount = resultsByPlatform[platform.id] || 0
            const cat = CATEGORIES[platform.category]
            const isUnsupported = !platform.supports.includes(searchMode)

            return (
              <button
                key={platform.id}
                onClick={() => setActiveTabPlatformId(isActive ? null : platform.id)}
                disabled={isSearching}
                className={clsx(
                  'group relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border transition-all',
                  isActive
                    ? 'border-[#ff000d] bg-[rgba(255,0,13,0.08)] crimson-border-glow'
                    : 'border-white/[0.06] bg-[rgba(20,20,20,0.4)] hover:border-[rgba(255,0,13,0.2)] hover:bg-[rgba(255,0,13,0.04)]',
                  isUnsupported && 'opacity-40'
                )}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: platform.color }}
                >
                  {platform.icon}
                </div>
                <span className={clsx('text-[10px] font-medium text-center truncate w-full', isActive ? 'text-[#ff000d]' : 'text-[#a9a9a9]')}>
                  {platform.name}
                </span>

                {resultCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#00c896] text-white text-[9px] font-bold flex items-center justify-center"
                    style={{ boxShadow: '0 0 8px rgba(0,200,150,0.5)' }}>
                    {resultCount}
                  </span>
                )}
                <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />

                {isSearching && (
                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(255,0,13,0.05)] to-transparent animate-scan" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
