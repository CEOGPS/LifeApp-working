// src/pages/music/components/ErrorBanner.tsx
interface Props { message: string; onRetry?: () => void; }

export function ErrorBanner({ message, onRetry }: Props) {
  return (
    <div className="glass rounded-lg border border-crimson/30 bg-crimson/5 px-3 py-2 text-[11px] text-crimson flex items-center justify-between">
      <span className="truncate">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-crimson/70 hover:text-crimson underline shrink-0 ml-2">
          Retry
        </button>
      )}
    </div>
  );
}