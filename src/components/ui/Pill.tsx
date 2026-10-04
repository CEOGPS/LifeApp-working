import React, { forwardRef } from "react";
import { cn } from "@/platform/utils/cn";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "warning" | "danger" | "info" | "ghost";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
  dotColor?: string;
  removable?: boolean;
  onRemove?: () => void;
}

export const Pill = forwardRef<HTMLSpanElement, PillProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      dot = false,
      dotColor,
      removable = false,
      onRemove,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = "inline-flex items-center font-display tracking-widest uppercase transition-all";
    
    const variantStyles = {
      default: "bg-white/10 text-white/70 border border-white/10",
      primary: "bg-primary/20 text-primary border border-primary/30",
      success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
      warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
      danger: "bg-red-500/20 text-red-400 border border-red-500/30",
      info: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
      ghost: "bg-transparent text-white/50 hover:text-white hover:bg-white/10",
    };
    
    const sizeStyles = {
      sm: "px-2 py-0.5 text-[8px] rounded gap-1",
      md: "px-2.5 py-1 text-[9px] rounded-md gap-1.5",
      lg: "px-3 py-1.5 text-[10px] rounded-lg gap-2",
    };

    const dotStyles = "w-1.5 h-1.5 rounded-full flex-shrink-0";

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(dotStyles, dotColor)}
            style={dotColor ? { backgroundColor: dotColor } : undefined}
            aria-hidden="true"
          />
        )}
        {children}
        {removable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors text-current opacity-60 hover:opacity-100"
            aria-label="Remove"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </span>
    );
  }
);

Pill.displayName = "Pill";