import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn/ui-style Progress bar (used by the embedded Lucid pages).
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  max?: number;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, ...props }, ref) => {
    const pct = Math.max(0, Math.min(100, ((value ?? 0) / (max || 100)) * 100));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - pct}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
