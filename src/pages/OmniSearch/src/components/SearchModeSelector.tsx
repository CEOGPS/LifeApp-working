import { useState } from 'react'
import { Search, Mail, Phone, Image as ImageIcon, Type } from 'lucide-react'
import type { SearchMode } from '../types'
import { useSearchStore } from '../store/searchStore'
import { ImageUploader } from './ImageUploader'
import clsx from 'clsx'

const MODES: Array<{ mode: SearchMode; label: string; icon: typeof Search; placeholder: string }> = [
  { mode: 'text', label: 'Text', icon: Type, placeholder: 'Search name, username, keyword...' },
  { mode: 'email', label: 'Email', icon: Mail, placeholder: 'Reverse email lookup...' },
  { mode: 'phone', label: 'Phone', icon: Phone, placeholder: 'Reverse phone lookup...' },
  { mode: 'image', label: 'Image', icon: ImageIcon, placeholder: 'Image URL for reverse search...' },
]

export function SearchModeSelector() {
  const { searchMode, setSearchMode, inputValue, setInputValue, executeSearch, isSearching } = useSearchStore()
  const [focused, setFocused] = useState(false)

  const currentMode = MODES.find(m => m.mode === searchMode)!

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeSearch(inputValue)
  }

  const handleImageSelected = (imageUrl: string) => {
    setInputValue(imageUrl)
    executeSearch(imageUrl)
  }

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-[#141414] border border-white/[0.06]">
        {MODES.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => setSearchMode(mode)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              searchMode === mode
                ? 'bg-[rgba(255,0,13,0.1)] text-[#ff000d] border-l-2 border-[#ff000d] crimson-border-glow'
                : 'text-[#a9a9a9] hover:text-[#ff000d] hover:bg-[rgba(255,0,13,0.06)]'
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Image uploader when image mode is active, otherwise text input */}
      {searchMode === 'image' ? (
        <ImageUploader onImageSelected={handleImageSelected} />
      ) : (
        <form onSubmit={handleSubmit} className="relative">
          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all bg-[#141414]',
            focused ? 'border-[#ff000d] shadow-[0_0_0_3px_rgba(255,0,13,0.1)]' : 'border-white/[0.06]'
          )}>
            <Search size={16} className={clsx('transition-colors', focused ? 'text-[#ff000d]' : 'text-[#4d4d4d]')} />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={currentMode.placeholder}
              className="flex-1 bg-transparent text-sm text-[#f0ede8] placeholder-[#4d4d4d] outline-none"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching || !inputValue.trim()}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #ff000d, #8c1020)',
                boxShadow: '0 0 10px rgba(255,0,13,0.3)',
                color: '#ffffff',
              }}
              onMouseEnter={(e) => {
                if (!isSearching && inputValue.trim()) e.currentTarget.style.boxShadow = '0 0 20px rgba(255,0,13,0.6)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 0 10px rgba(255,0,13,0.3)'
              }}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
