import React from "react";
import { cn } from "@/platform/utils/cn";
import { Button, Pill } from "@/ui/primitives";

export interface BannerAreaProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "hero" | "compact" | "status";
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  status?: {
    label: string;
    variant: "online" | "offline" | "warning" | "busy";
    pulse?: boolean;
  }[];
}

export const BannerArea: React.FC<BannerAreaProps> = ({
  children,
  className,
  variant = "default",
  title,
  subtitle,
  actions,
  status,
}) => {
  const variantStyles = {
    default: "py-6 px-6",
    hero: "py-10 px-6",
    compact: "py-3 px-6",
    status: "py-4 px-6",
  };

  const statusVariants = {
    online: "bg-emerald-500",
    offline: "bg-white/30",
    warning: "bg-amber-500",
    busy: "bg-red-500",
  };

  return (
    <div
      className={cn(
        "glass border-b border-white/10 relative overflow-hidden",
        variantStyles[variant],
        className
      )}
      role="region"
      aria-label={title || "Banner"}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-teal-500/5" aria-hidden="true" />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            {title && (
              <h1 className="font-display tracking-widest uppercase text-white text-xl md:text-2xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-white/50 text-sm mt-1 max-w-2xl">{subtitle}</p>
            )}
            {status && status.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {status.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 font-display tracking-widest uppercase text-[9px] text-white/70"
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        statusVariants[s.variant],
                        s.pulse && "animate-pulse"
                      )}
                      aria-hidden="true"
                    />
                    {s.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </div>
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
};

export interface StatusBannerProps {
  message: string;
  variant?: "info" | "success" | "warning" | "error";
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

const statusStyles = {
  info: "bg-cyan-500/20 border-cyan-500/30 text-cyan-400",
  success: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400",
  warning: "bg-amber-500/20 border-amber-500/30 text-amber-400",
  error: "bg-red-500/20 border-red-500/30 text-red-400",
};

const statusIcons = {
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

export const StatusBanner: React.FC<StatusBannerProps> = ({
  message,
  variant = "info",
  dismissible = true,
  onDismiss,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "glass border rounded-lg p-4 flex items-start gap-3",
        statusStyles[variant],
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 text-current mt-0.5">{statusIcons[variant]}</div>
      <div className="flex-1 text-sm">{message}</div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 ml-4 p-1 text-current/50 hover:text-current transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};