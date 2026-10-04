import React, { forwardRef } from "react";
import { cn } from "@/platform/utils/cn";

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  elevated?: boolean;
  padded?: boolean;
  className?: string;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      className,
      title,
      subtitle,
      actions,
      icon,
      elevated = false,
      padded = true,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass",
          elevated && "glass-elevated shadow-glow-crimson",
          padded ? "p-5" : "p-0",
          "rounded-2xl",
          className
        )}
        {...props}
      >
        {(title || actions) && (
          <div className={cn("flex items-center justify-between mb-4", padded ? "" : "px-5 pt-5")}>
            <div className="flex items-center gap-3">
              {icon && <span className="text-primary">{icon}</span>}
              <div>
                {title && (
                  <h3 className="font-display tracking-widest uppercase text-white text-[11px]">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-[10px] text-white/40 mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}
        <div className={cn(padded ? "" : "p-5")}>{children}</div>
      </div>
    );
  }
);

Panel.displayName = "Panel";