import React from "react";
import { cn } from "@/platform/utils/cn";

export interface EmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Empty: React.FC<EmptyProps> = ({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
}) => {
  const sizeStyles = {
    sm: "py-6 px-4",
    md: "py-12 px-6",
    lg: "py-16 px-8",
  };

  const iconSizes = {
    sm: "w-10 h-10",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center glass rounded-2xl",
        sizeStyles[size],
        className
      )}
    >
      {icon && (
        <div className={cn("text-white/20 mb-4 flex-shrink-0", iconSizes[size])}>
          {icon}
        </div>
      )}
      <h3 className="font-display tracking-widest uppercase text-white text-[11px] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-white/40 text-sm max-w-xs mx-auto mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};