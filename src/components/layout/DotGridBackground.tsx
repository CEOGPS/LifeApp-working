import React, { useMemo } from "react";
import { cn } from "@/platform/utils/cn";

interface DotGridBackgroundProps {
  className?: string;
  density?: "low" | "medium" | "high";
  color?: string;
  animated?: boolean;
}

export const DotGridBackground: React.FC<DotGridBackgroundProps> = ({
  className,
  density = "medium",
  color = "rgba(70, 180, 255, 0.15)",
  animated = false,
}) => {
  const spacing = useMemo(() => {
    switch (density) {
      case "low": return 48;
      case "high": return 24;
      default: return 36;
    }
  }, [density]);

  const style = useMemo(() => ({
    backgroundImage: `radial-gradient(circle, ${color} 1px, transparent 1px)`,
    backgroundSize: `${spacing}px ${spacing}px`,
    backgroundPosition: "0 0",
  }), [spacing, color]);

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        animated && "animate-pulse-slow",
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
};

export const GridLinesBackground: React.FC<{
  className?: string;
  color?: string;
  size?: number;
}> = ({ className, color = "rgba(255, 255, 255, 0.02)", size = 64 }) => {
  return (
    <div
      className={cn("absolute inset-0 pointer-events-none", className)}
      style={{
        backgroundImage: `
          linear-gradient(${color} 1px, transparent 1px),
          linear-gradient(90deg, ${color} 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
      }}
      aria-hidden="true"
    />
  );
};

export const GlowOrb: React.FC<{
  className?: string;
  x?: string;
  y?: string;
  color?: string;
  size?: number;
  blur?: number;
}> = ({
  className,
  x = "50%",
  y = "50%",
  color = "rgba(70, 180, 255, 0.3)",
  size = 400,
  blur = 120,
}) => {
  return (
    <div
      className={cn("absolute rounded-full pointer-events-none blur-[120px]", className)}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: color,
        transform: "translate(-50%, -50%)",
        filter: `blur(${blur}px)`,
      }}
      aria-hidden="true"
    />
  );
};