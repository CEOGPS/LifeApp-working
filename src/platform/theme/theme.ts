export type ThemeMode = "dark" | "light" | "system";

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  card: string;
  cardForeground: string;
}

export const THEMES: Record<string, ThemeColors> = {
  "crimson-phantom": {
    background: "#050505",
    foreground: "#ffffff",
    primary: "#dc143c",
    primaryForeground: "#ffffff",
    secondary: "#1a1a2e",
    secondaryForeground: "#fafafa",
    muted: "#1a1a2e",
    mutedForeground: "#b3b3b3",
    accent: "#dc143c",
    accentForeground: "#ffffff",
    border: "rgba(255, 255, 255, 0.1)",
    card: "rgba(20, 20, 30, 0.6)",
    cardForeground: "#ffffff",
  },
  "midnight-teal": {
    background: "#020817",
    foreground: "#f8fafc",
    primary: "#0d9488",
    primaryForeground: "#ffffff",
    secondary: "#0f172a",
    secondaryForeground: "#f8fafc",
    muted: "#0f172a",
    mutedForeground: "#94a3b8",
    accent: "#14b8a6",
    accentForeground: "#ffffff",
    border: "rgba(20, 184, 166, 0.2)",
    card: "rgba(15, 23, 42, 0.6)",
    cardForeground: "#f8fafc",
  },
  "obsidian-gold": {
    background: "#0a0a0a",
    foreground: "#fafafa",
    primary: "#f59e0b",
    primaryForeground: "#0a0a0a",
    secondary: "#1a1a1a",
    secondaryForeground: "#fafafa",
    muted: "#1a1a1a",
    mutedForeground: "#a3a3a3",
    accent: "#fbbf24",
    accentForeground: "#0a0a0a",
    border: "rgba(245, 158, 11, 0.2)",
    card: "rgba(20, 20, 20, 0.6)",
    cardForeground: "#fafafa",
  },
  "deep-violet": {
    background: "#0d0517",
    foreground: "#f8fafc",
    primary: "#8b5cf6",
    primaryForeground: "#ffffff",
    secondary: "#1e1b2e",
    secondaryForeground: "#f8fafc",
    muted: "#1e1b2e",
    mutedForeground: "#a3a3b8",
    accent: "#a855f7",
    accentForeground: "#ffffff",
    border: "rgba(139, 92, 246, 0.2)",
    card: "rgba(20, 15, 30, 0.6)",
    cardForeground: "#f8fafc",
  },
  "system": {
    background: "var(--background)",
    foreground: "var(--foreground)",
    primary: "var(--primary)",
    primaryForeground: "var(--primary-foreground)",
    secondary: "var(--secondary)",
    secondaryForeground: "var(--secondary-foreground)",
    muted: "var(--muted)",
    mutedForeground: "var(--muted-foreground)",
    accent: "var(--accent)",
    accentForeground: "var(--accent-foreground)",
    border: "var(--border)",
    card: "var(--card)",
    cardForeground: "var(--card-foreground)",
  },
};

export function applyTheme(themeId: string): void {
  const theme = THEMES[themeId] || THEMES["crimson-phantom"];
  const root = document.documentElement;
  
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(`--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`, value);
  });
  
  localStorage.setItem("lifeos1_theme", themeId);
}

export function initTheme(): void {
  const saved = localStorage.getItem("lifeos1_theme") || "crimson-phantom";
  applyTheme(saved);
}

export function getCurrentTheme(): string {
  return localStorage.getItem("lifeos1_theme") || "crimson-phantom";
}

export function getThemeColors(themeId?: string): ThemeColors {
  const id = themeId || getCurrentTheme();
  return THEMES[id] || THEMES["crimson-phantom"];
}