import React, { forwardRef } from "react";
import { cn } from "@/platform/utils/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined" | "glass";
  hover?: boolean;
  padded?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = "default",
      hover = false,
      padded = true,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      default: "glass",
      elevated: "glass-elevated shadow-glow-crimson",
      outlined: "bg-black/30 border border-white/10",
      glass: "glass",
    };

    const hoverStyles = hover
      ? "transition-all duration-300 hover:lift-tilt hover:shadow-glow-crimson-lg"
      : "";

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl",
          variantStyles[variant],
          padded ? "p-5" : "p-0",
          hoverStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  trend?: number[];
}

export const StatTile = forwardRef<HTMLDivElement, StatTileProps>(
  (
    {
      className,
      label,
      value,
      change,
      changeType = "neutral",
      icon,
      trend,
      children,
      ...props
    },
    ref
  ) => {
    const changeColors = {
      positive: "text-emerald-400",
      negative: "text-red-400",
      neutral: "text-white/40",
    };

    return (
      <Card
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-display tracking-widest uppercase text-[9px] text-white/50 mb-1">
              {label}
            </p>
            <p className="font-display text-2xl md:text-3xl text-white tabular-nums">
              {value}
            </p>
            {change && (
              <p className={cn("font-display tracking-widest uppercase text-[9px] mt-1", changeColors[changeType])}>
                {change}
              </p>
            )}
          </div>
          {icon && <div className="text-white/20 text-3xl flex-shrink-0 ml-4">{icon}</div>}
        </div>
        {trend && trend.length > 1 && (
          <div className="absolute bottom-0 right-0 w-24 h-12 opacity-30" aria-hidden="true">
            <svg viewBox="0 0 96 48" preserveAspectRatio="none">
              <path
                d={trend
                  .map((v, i) => {
                    const x = (i / (trend.length - 1)) * 96;
                    const y = 48 - (v / Math.max(...trend)) * 44;
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  })
                  .join(" ")}
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        {children}
      </Card>
    );
  }
);

StatTile.displayName = "StatTile";