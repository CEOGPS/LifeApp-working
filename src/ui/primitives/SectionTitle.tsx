import React from "react";
import { cn } from "@/platform/utils/cn";

export interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  divider?: boolean;
  count?: number;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  subtitle,
  action,
  className,
  divider = true,
  count,
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        divider ? "pb-3 border-b border-white/10 mb-4" : "mb-4",
        className
      )}
    >
      <div>
        <div className="flex items-center gap-3">
          <h2 className="font-display tracking-widest uppercase text-white text-[11px]">
            {title}
          </h2>
          {count !== undefined && (
            <span className="glass px-2 py-0.5 rounded-full text-[9px] font-display tracking-widest uppercase text-white/60">
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[10px] text-white/40 mt-1">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
};