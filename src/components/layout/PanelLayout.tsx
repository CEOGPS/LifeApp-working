import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { DotGridBackground } from "./DotGridBackground";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export interface PanelLayoutProps {
  children: React.ReactNode;
  className?: string;
  sidebar?: React.ReactNode;
  sidebarCollapsed?: boolean;
  onSidebarToggle?: () => void;
  topbar?: React.ReactNode;
  banner?: React.ReactNode;
  /** Full-width strip rendered once below the topbar, above the scrolling main area. */
  headerBanner?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "none" | "screen" | "lg" | "xl" | "2xl";
  padding?: "none" | "sm" | "md" | "lg";
  gridBackground?: boolean;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PanelLayout: React.FC<PanelLayoutProps> = ({
  children,
  className,
  sidebar,
  sidebarCollapsed = false,
  onSidebarToggle,
  topbar,
  banner,
  headerBanner,
  footer,
  maxWidth = "2xl",
  padding = "md",
  gridBackground = true,
  title,
  subtitle,
  icon,
  actions,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const maxWidthStyles = {
    none: "max-w-none",
    screen: "max-w-screen-2xl",
    lg: "max-w-6xl",
    xl: "max-w-7xl",
    "2xl": "max-w-[96rem]",
  };

  const paddingStyles = {
    none: "p-0",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  // ai-banner-overlap: headerBanner now scrolls with the page (inside <main>) instead
  // of staying pinned above it, where it covered the top of tall modules (YouTube /
  // Music) as they scrolled up. These negative margins keep it full-bleed.
  const headerBannerBleed = {
    none: "",
    sm: "-mx-4 -mt-4 mb-4",
    md: "-mx-6 -mt-6 mb-6",
    lg: "-mx-8 -mt-8 mb-8",
  };

  const handleResize = () => {
    if (window.innerWidth >= 1024) {
      setSidebarOpen(false);
    }
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={cn("h-screen overflow-hidden bg-background flex", className)}
      style={sidebar ? ({ "--sidebar-width": `${sidebarCollapsed ? 64 : 256}px` } as React.CSSProperties) : undefined}
    >
      {gridBackground && <DotGridBackground density="low" />}

      {sidebar && (
        <>
          <motion.div
            initial={false}
            animate={{ opacity: sidebarOpen ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed inset-0 z-30 bg-black/50 backdrop-blur-sm",
              "md:hidden",
              sidebarOpen ? "block" : "hidden"
            )}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              "z-40 shrink-0 transition-[width] duration-300",
              sidebarCollapsed ? "w-16" : "w-64",
              "md:block"
            )}
            style={{ width: sidebarCollapsed ? 64 : 256 }}
          >
            {sidebar}
          </div>
        </>
      )}

      <div
        className={cn(
          "flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300",
          // Topbar is position:fixed and h-14 (56px); reserve its height so page
          // content (e.g. panel search bars) isn't hidden underneath it.
          // Only applies when this layout renders the topbar, so nested
          // PanelLayouts (no topbar prop) don't get double padding.
          topbar ? "pt-14" : undefined
        )}
      >
        {topbar && (
          <div
            className="transition-all duration-300"
            style={{
              left: sidebar && !sidebarCollapsed ? 256 : sidebar ? 64 : 0,
            }}
          >
            {topbar}
          </div>
        )}

        <main
          ref={contentRef}
          className={cn(
            "flex-1 flex flex-col min-h-0 overflow-y-auto",
            maxWidthStyles[maxWidth],
            "mx-auto w-full",
            paddingStyles[padding]
          )}
          role="main"
        >
          {headerBanner && (
            <div className={cn("shrink-0", headerBannerBleed[padding])}>{headerBanner}</div>
          )}
          {(title || subtitle || icon || actions) && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                {icon && <span className="text-2xl">{icon}</span>}
                <div>
                  {title && (
                    <h1 className="font-display text-xl tracking-[0.12em] text-white">{title}</h1>
                  )}
                  {subtitle && (
                    <p className="text-sm text-white/60 mt-1">{subtitle}</p>
                  )}
                </div>
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          )}
          {banner}
          <div className="flex-1 w-full min-h-0">{children}</div>
          {footer && (
            <footer className="mt-auto pt-6 border-t border-white/10">
              {footer}
            </footer>
          )}
        </main>
      </div>

      <button
        onClick={() => setSidebarOpen(true)}
        className={cn(
          "fixed bottom-6 left-6 z-50 p-3 rounded-xl glass",
          "text-white/50 hover:text-white hover:bg-white/10",
          "shadow-glow-crimson transition-all",
          "md:hidden"
        )}
        aria-label="Open menu"
        aria-expanded={sidebarOpen}
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </div>
  );
};

export interface ResizablePanelGroupProps {
  children: React.ReactNode;
  className?: string;
  direction?: "horizontal" | "vertical";
  storageKey?: string;
  defaultSizes?: number[];
  minSize?: number;
  maxSize?: number;
}

export const ResizablePanelGroup: React.FC<ResizablePanelGroupProps> = ({
  children,
  className,
  direction = "horizontal",
  storageKey,
  defaultSizes,
  minSize = 100,
  maxSize,
}) => {
  const [sizes, setSizes] = useState<number[]>(() => {
    if (storageKey && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`panel-sizes-${storageKey}`);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return defaultSizes || [];
  });

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const startPosRef = useRef<number>(0);
  const startSizesRef = useRef<number[]>([]);

  useEffect(() => {
    if (storageKey && sizes.length > 0) {
      localStorage.setItem(`panel-sizes-${storageKey}`, JSON.stringify(sizes));
    }
  }, [sizes, storageKey]);

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingIndex(index);
    startPosRef.current = direction === "horizontal" ? e.clientX : e.clientY;
    startSizesRef.current = [...sizes];
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIndex === null) return;

      const currentPos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;

      const newSizes = [...startSizesRef.current];
      const size1 = newSizes[draggingIndex];
      const size2 = newSizes[draggingIndex + 1];

      const newSize1 = Math.max(minSize, Math.min(maxSize || Infinity, size1 + delta));
      const newSize2 = Math.max(minSize, Math.min(maxSize || Infinity, size2 - delta));

      if (newSize1 + newSize2 === size1 + size2) {
        newSizes[draggingIndex] = newSize1;
        newSizes[draggingIndex + 1] = newSize2;
        setSizes(newSizes);
      }
    };

    const handleMouseUp = () => {
      setDraggingIndex(null);
    };

    if (draggingIndex !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingIndex, direction, minSize, maxSize, sizes]);

  return (
    <div
      className={cn(
        "flex",
        direction === "horizontal" ? "flex-row" : "flex-col",
        className
      )}
      role="group"
      aria-label="Resizable panels"
    >
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;

        const isLast = index === React.Children.count(children) - 1;

        return (
          <React.Fragment key={index}>
            <div
              className={cn(
                "flex-1 flex flex-col min-w-0 min-h-0",
                "transition-all duration-200",
                direction === "horizontal" ? "w-0" : "h-0"
              )}
              style={{
                flex: `${sizes[index] || 1} 1 0%`,
                minWidth: direction === "horizontal" ? minSize : undefined,
                minHeight: direction === "vertical" ? minSize : undefined,
                maxWidth: direction === "horizontal" && maxSize ? maxSize : undefined,
                maxHeight: direction === "vertical" && maxSize ? maxSize : undefined,
              }}
            >
              {child}
            </div>
            {!isLast && (
              <button
                onMouseDown={e => handleMouseDown(index, e)}
                className={cn(
                  "relative z-10 flex items-center justify-center",
                  "bg-transparent border-l border-white/10",
                  "hover:bg-white/5 transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  direction === "horizontal"
                    ? "w-1 cursor-col-resize hover:w-2"
                    : "h-1 cursor-row-resize hover:h-2"
                )}
                aria-label={`Resize panel ${index + 1}`}
                aria-valuenow={sizes[index]}
                aria-valuemin={minSize}
                aria-valuemax={maxSize}
                role="separator"
                tabIndex={0}
              >
                <div
                  className={cn(
                    "bg-white/10 rounded-full transition-opacity",
                    direction === "horizontal"
                      ? "w-0.5 h-8 opacity-0 hover:opacity-100 focus:opacity-100"
                      : "w-8 h-0.5 opacity-0 hover:opacity-100 focus:opacity-100"
                  )}
                />
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export interface PanelGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3 | 4 | "auto";
  gap?: "sm" | "md" | "lg";
  responsive?: boolean;
}

export const PanelGrid: React.FC<PanelGridProps> = ({
  children,
  className,
  columns = "auto",
  gap = "md",
  responsive = true,
}) => {
  const gapStyles = {
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6",
  };

  const columnsStyles = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    auto: "grid-cols-[repeat(auto-fill,minmax(320px,1fr))]",
  };

  return (
    <div
      className={cn(
        "grid",
        gapStyles[gap],
        responsive ? columnsStyles[columns] : columnsStyles[columns],
        className
      )}
      role="list"
    >
      {React.Children.map(children, (child, index) => (
        <div key={index} className="relative" role="listitem">
          {child}
        </div>
      ))}
    </div>
  );
};

export interface PlaceholderPanelProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "coming-soon" | "empty" | "error";
}

export const PlaceholderPanel: React.FC<PlaceholderPanelProps> = ({
  title,
  description,
  icon,
  action,
  className,
  variant = "default",
}) => {
  const variantStyles = {
    default: "",
    "coming-soon": "border-dashed border-primary/30",
    empty: "",
    error: "border-red-500/30",
  };

  const defaultIcons = {
    default: (
      <svg className="w-12 h-12 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </svg>
    ),
    "coming-soon": (
      <svg className="w-12 h-12 text-primary/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    empty: (
      <svg className="w-12 h-12 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    error: (
      <svg className="w-12 h-12 text-red-400/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03]",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex flex-col items-center justify-center text-center py-12">
        {icon || defaultIcons[variant]}
        <h3 className="font-display tracking-widest uppercase text-white text-[11px] mt-4">
          {title}
        </h3>
        {description && (
          <p className="text-white/40 text-sm mt-2 max-w-xs">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
};

PlaceholderPanel.displayName = "PlaceholderPanel";