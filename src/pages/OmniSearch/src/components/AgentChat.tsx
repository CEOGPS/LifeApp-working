import { useEffect, useRef } from 'react'
import { Bot, User, Loader2 } from 'lucide-react'
import { useSearchStore } from '../store/searchStore'
import { SearchModeSelector } from './SearchModeSelector'
import { ResultCard } from './ResultCard'
import clsx from 'clsx'
import type { ChatMessage } from '../types'

export function AgentChat() {
  const { messages, isSearching, session } = useSearchStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, isSearching])

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-agent-pulse"
              style={{ background: 'linear-gradient(135deg, #ff000d, #8c1020)' }}>
              <Bot size={16} className="text-white" />
            </div>
            {isSearching && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00c896] border-2 border-[#000000] animate-pulse-glow" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#f0ede8]">Omni Search Agent</h3>
            <p className="text-[10px] text-[#7c7c7c]">
              {isSearching ? <span className="text-[#ff000d] capitalize">{session.status}</span> : '100-platform broadcast search'}
            </p>
          </div>
        </div>
        {isSearching && <StatusIndicator status={session.status} />}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isSearching && <ThinkingIndicator />}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06]">
        <SearchModeSelector />
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={clsx('flex gap-2 animate-slide-in', isUser && 'flex-row-reverse')}>
      <div className={clsx(
        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-[#1a1a1a] border border-white/[0.06]' : ''
      )}
      style={!isUser ? { background: 'linear-gradient(135deg, #ff000d, #8c1020)', boxShadow: '0 0 10px rgba(255,0,13,0.2)' } : undefined}>
        {isUser ? <User size={14} className="text-[#a9a9a9]" /> : <Bot size={14} className="text-white" />}
      </div>
      <div className={clsx('flex-1 min-w-0', isUser && 'flex justify-end')}>
        <div className={clsx(
          'inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-[rgba(255,0,13,0.08)] border border-[rgba(255,0,13,0.15)] text-[#f0ede8]'
            : 'glass text-[#c8c8d0]'
        )}>
          <FormattedContent content={message.content} />
        </div>
        {message.results && message.results.length > 0 && (
          <div className="mt-2 space-y-1.5 max-w-[90%]">
            {message.results.filter(r => !r.duplicateOf).slice(0, 5).map((result) => (
              <ResultCard key={result.id} result={result} compact />
            ))}
            {message.results.filter(r => r.duplicateOf).length > 0 && (
              <p className="text-[10px] text-[#ff000d] px-1">
                + {message.results.filter(r => r.duplicateOf).length} duplicates filtered
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**'))
          return <p key={i} className="font-semibold text-[#f0ede8]">{line.slice(2, -2)}</p>
        if (line.startsWith('**'))
          return <p key={i} className="font-semibold text-[#f0ede8]">{line.replace(/\*\*/g, '')}</p>
        if (line.match(/^\d+\./))
          return <p key={i} className="text-xs text-[#a9a9a9] pl-2">{line}</p>
        if (line.startsWith('   '))
          return <p key={i} className="text-xs text-[#7c7c7c] pl-4">{line.trim()}</p>
        if (line.trim() === '') return <div key={i} className="h-1" />
        const isStat = line.startsWith('📊') || line.startsWith('📡') || line.startsWith('📥') || line.startsWith('🔄') || line.startsWith('✨')
        return <p key={i} className={clsx(isStat ? 'text-xs text-[#a9a9a9]' : 'text-sm')}>{line}</p>
      })}
    </div>
  )
}

function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    broadcasting: 'text-[#ff000d]',
    collecting: 'text-[#f59e0b]',
    deduplicating: 'text-[#a9a9a9]',
    complete: 'text-[#00c896]',
    idle: 'text-[#4d4d4d]',
  }
  return (
    <div className="flex items-center gap-1.5">
      <Loader2 size={12} className={clsx('animate-spin', colors[status] || 'text-[#4d4d4d]')} />
      <span className={clsx('text-[10px] font-medium uppercase tracking-wide', colors[status])}>{status}</span>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-2 animate-slide-in">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center animate-agent-pulse"
        style={{ background: 'linear-gradient(135deg, #ff000d, #8c1020)' }}>
        <Bot size={14} className="text-white" />
      </div>
      <div className="glass rounded-lg px-3 py-2 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#ff000d] animate-dot-blink" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
      </div>
    </div>
  )
}
