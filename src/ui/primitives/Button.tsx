import React, { forwardRef } from "react";
import { cn } from "@/platform/utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = "inline-flex items-center justify-center font-display tracking-widest uppercase transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed";
    
    const variantStyles = {
      primary: "bg-primary/20 border border-primary/30 text-primary-foreground hover:bg-primary/30 hover:glow-crimson-sm",
      secondary: "glass text-white/80 hover:text-white hover:bg-white/10",
      ghost: "text-white/50 hover:text-white hover:bg-white/10",
      danger: "bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30",
      outline: "border border-white/20 text-white/80 hover:border-primary/50 hover:text-primary hover:bg-primary/10",
    };
    
    const sizeStyles = {
      sm: "px-3 py-1.5 text-[9px] rounded-md",
      md: "px-4 py-2 text-[10px] rounded-lg",
      lg: "px-6 py-3 text-[11px] rounded-xl",
      icon: "p-2 text-[12px] rounded-lg",
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], fullWidth && "w-full", className)}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : leftIcon ? (
          <span className="mr-2 flex-shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon && <span className="ml-2 flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";