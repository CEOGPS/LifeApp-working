import { ExternalLink, Copy, AlertCircle } from 'lucide-react'
import type { SearchResult } from '../types'
import { CATEGORIES } from '../data/platforms'
import clsx from 'clsx'

interface ResultCardProps {
  result: SearchResult
  compact?: boolean
}

export function ResultCard({ result, compact }: ResultCardProps) {
  const category = CATEGORIES[result.category]

  const handleCopy = () => navigator.clipboard.writeText(result.url)

  return (
    <div className={clsx(
      'group glass rounded-lg hover:border-[rgba(255,0,13,0.2)] transition-all cursor-pointer',
      compact ? 'px-2.5 py-1.5' : 'p-3'
    )}>
      <div className="flex items-start gap-2">
        <div
          className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: category?.color || '#ff000d' }}
        >
          {result.platformName.substring(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#7c7c7c] font-medium">{result.platformName}</span>
            <span className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-[#7c7c7c]">{category?.label}</span>
            {!result.duplicateOf && (
              <span className="text-[9px] px-1 py-0.5 rounded font-medium"
                style={{ background: 'rgba(0,200,150,0.1)', color: '#00c896' }}>unique</span>
            )}
            {result.duplicateOf && (
              <span className="text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5"
                style={{ background: 'rgba(255,0,13,0.1)', color: '#ff000d' }}>
                <AlertCircle size={8} /> dup
              </span>
            )}
          </div>
          <p className={clsx('font-medium text-[#f0ede8] truncate', compact ? 'text-xs' : 'text-sm')}>{result.title}</p>
          {!compact && <p className="text-xs text-[#7c7c7c] mt-0.5 line-clamp-2">{result.snippet}</p>}
          {compact && <p className="text-[10px] text-[#7c7c7c] truncate">{result.snippet}</p>}

          {/* Confidence bar */}
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all',
                  result.confidence > 0.7 ? 'bg-[#00c896]' : result.confidence > 0.4 ? 'bg-[#f59e0b]' : 'bg-[#ff000d]')}
                style={{ width: `${result.confidence * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-[#4d4d4d]">{Math.round(result.confidence * 100)}%</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className="p-1 rounded hover:bg-white/5 text-[#4d4d4d] hover:text-[#a9a9a9]">
            <Copy size={12} />
          </button>
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-white/5 text-[#4d4d4d] hover:text-[#a9a9a9]">
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  )
}
