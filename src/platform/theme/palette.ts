// Singleton palette for consistent color access across the app

export const PALETTE = {
  // Core
  black: "#000000",
  white: "#ffffff",
  
  // Crimson Phantom
  crimson: {
    50: "#fdf2f3",
    100: "#fce4e6",
    200: "#fad1d5",
    300: "#f6b3ba",
    400: "#f08492",
    500: "#e85d6e",
    600: "#dc364c",
    700: "#c0253a",
    800: "#9f2031",
    900: "#831e2b",
    950: "#450a0f",
    DEFAULT: "#dc143c",
    light: "#ff1a40",
    glow: "rgba(220, 20, 60, 0.4)",
    glowStrong: "rgba(220, 20, 60, 0.6)",
  },
  
  // Teal accent
  teal: {
    50: "#f0fdfa",
    100: "#ccfbf1",
    200: "#99f6e4",
    300: "#5eead4",
    400: "#2dd4bf",
    500: "#14b8a6",
    600: "#0d9488",
    700: "#0f766e",
    800: "#115e59",
    900: "#134e4a",
    950: "#042f2e",
    DEFAULT: "#0d9488",
    light: "#14b8a6",
    glow: "rgba(13, 148, 136, 0.4)",
    glowStrong: "rgba(13, 148, 136, 0.6)",
  },
  
  // Grays
  gray: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0a0a0a",
  },
  
  // Semantic
  success: {
    DEFAULT: "#10b981",
    light: "#34d399",
    glow: "rgba(16, 185, 129, 0.4)",
  },
  warning: {
    DEFAULT: "#f59e0b",
    light: "#fbbf24",
    glow: "rgba(245, 158, 11, 0.4)",
  },
  error: {
    DEFAULT: "#ef4444",
    light: "#f87171",
    glow: "rgba(239, 68, 68, 0.4)",
  },
  info: {
    DEFAULT: "#3b82f6",
    light: "#60a5fa",
    glow: "rgba(59, 130, 246, 0.4)",
  },
  
  // Glassmorphism
  glass: {
    light: "rgba(255, 255, 255, 0.08)",
    medium: "rgba(255, 255, 255, 0.12)",
    heavy: "rgba(255, 255, 255, 0.2)",
    crimson: "rgba(220, 20, 60, 0.15)",
    crimsonStrong: "rgba(220, 20, 60, 0.3)",
    teal: "rgba(13, 148, 136, 0.12)",
    tealStrong: "rgba(13, 148, 136, 0.25)",
  },
  
  // Status dots
  status: {
    connected: "#10b981",
    pending: "#f59e0b",
    error: "#ef4444",
    disconnected: "rgba(255, 255, 255, 0.3)",
    live: "#10b981",
  },
  
  // Chart colors
  charts: [
    "#dc143c", // crimson
    "#0d9488", // teal
    "#f59e0b", // amber
    "#3b82f6", // blue
    "#a855f7", // violet
    "#ec4899", // pink
    "#14b8a6", // teal light
    "#ef4444", // red
    "#84cc16", // lime
    "#f97316", // orange
  ],
  
  // Gradients
  gradients: {
    crimson: "linear-gradient(135deg, #dc143c, #ff1a40)",
    teal: "linear-gradient(135deg, #0d9488, #14b8a6)",
    gold: "linear-gradient(135deg, #f59e0b, #fbbf24)",
    violet: "linear-gradient(135deg, #8b5cf6, #a855f7)",
    mesh: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(220, 20, 60, 0.15), transparent), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(220, 20, 60, 0.08), transparent), radial-gradient(ellipse 40% 30% at 20% 80%, rgba(255, 26, 64, 0.05), transparent)",
  },
} as const;

export type Palette = typeof PALETTE;

export function getColor(path: string): string {
  const keys = path.split(".");
  let current: unknown = PALETTE;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return PALETTE.crimson.DEFAULT;
    }
  }
  return typeof current === "string" ? current : PALETTE.crimson.DEFAULT;
}