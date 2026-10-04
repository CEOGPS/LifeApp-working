import React, { forwardRef } from "react";
import { cn } from "@/platform/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;

    return (
      <div className={cn("w-full", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[10px] font-display tracking-widest uppercase text-white/60 mb-1.5"
          >
            {label}
            {required && <span className="text-primary ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none flex-shrink-0">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full bg-black/50 border border-white/10 rounded-lg text-white placeholder:text-white/30",
              "focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "transition-all duration-200",
              leftIcon ? "pl-10" : "pl-4",
              rightIcon ? "pr-10" : "pr-4",
              "py-2.5 text-sm",
              error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
              className
            )}
            disabled={disabled}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={errorId || helperId}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none flex-shrink-0">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-[10px] text-red-400" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-[10px] text-white/40">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";