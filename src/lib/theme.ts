// Theme system — swaps the :root CSS design tokens (see src/index.css) so any
// component using var(--bg1)/var(--teal)/etc. re-themes live. Selection persists
// to localStorage and is re-applied on app load (see home.jsx).

export const THEMES = {
  "erebus-cyan": {
    name: "Erebus Cyan",
    swatch: ["#000000", "#3cc4ff", "#0b2a44"],
    tokens: {
      "--bg1": "#000000",
      "--bg2": "#0b1118",
      "--bg3": "#0b2a44", // deep blue
      "--b1": "rgba(255,255,255,0.08)",
      "--b2": "rgba(255,255,255,0.05)",
      "--t1": "#ffffff",
      "--t2": "rgba(255,255,255,0.58)",
      "--t3": "rgba(255,255,255,0.32)",
      "--crimson": "#3cc4ff", // accent (name kept for compatibility)
      "--crimson-dim": "#1470b8",
      "--crimson-glow": "rgba(60,196,255,0.45)",
      "--panel-top": "#0b2a44",
      "--panel-bot": "#000000",
      "--teal": "#3cc4ff",
      "--blue": "#7c8a99",
      "--accent": "#3cc4ff",
    },
  },
  "command-crimson": {
    name: "Command Crimson",
    swatch: ["#000000", "#ff000d", "#4b0f0f"],
    tokens: {
      "--bg1": "#000000", // Pure black
      "--bg2": "#141414", // Dark gray
      "--bg3": "#4b0f0f", // Crimson dark
      "--b1": "rgba(255,255,255,0.08)",
      "--b2": "rgba(255,255,255,0.05)",
      "--t1": "#ffffff", // White
      "--t2": "rgba(255,255,255,0.55)",
      "--t3": "rgba(255,255,255,0.30)",
      "--crimson": "#ff000d", // Primary red
      "--crimson-dim": "#800000", // Dark red
      "--crimson-glow": "rgba(255,0,13,0.45)",
      "--panel-top": "#4b0f0f", // Crimson dark
      "--panel-bot": "#000000", // Black
      "--teal": "#ff000d", // Using crimson as primary
      "--blue": "#7c7c7c", // Gray
      "--accent": "#ff000d", // Primary red
    },
  },
  "cyber-dark": {
    name: "Cyber Dark",
    swatch: ["#000000", "#ff000d", "#4b0f0f"],
    tokens: {
      "--bg1": "#000000",
      "--bg2": "#141414",
      "--bg3": "#4b0f0f",
      "--b1": "rgba(255,255,255,0.07)",
      "--b2": "rgba(255,255,255,0.04)",
      "--t1": "#ffffff",
      "--t2": "rgba(255,255,255,0.55)",
      "--t3": "rgba(255,255,255,0.28)",
      "--crimson": "#ff000d",
      "--crimson-dim": "#800000",
      "--crimson-glow": "rgba(255,0,13,0.4)",
      "--panel-top": "#4b0f0f",
      "--panel-bot": "#000000",
      "--teal": "#ff000d",
      "--blue": "#7c7c7c",
      "--accent": "#ff000d",
    },
  },
  "midnight-crimson": {
    name: "Midnight Crimson",
    swatch: ["#000000", "#800000", "#4b0f0f"],
    tokens: {
      "--bg1": "#000000",
      "--bg2": "#141414",
      "--bg3": "#4b0f0f",
      "--b1": "rgba(255,255,255,0.08)",
      "--b2": "rgba(255,255,255,0.05)",
      "--t1": "#ffffff",
      "--t2": "rgba(255,255,255,0.58)",
      "--t3": "rgba(255,255,255,0.3)",
      "--crimson": "#800000",
      "--crimson-dim": "#4b0f0f",
      "--crimson-glow": "rgba(128,0,0,0.4)",
      "--panel-top": "#4b0f0f",
      "--panel-bot": "#000000",
      "--teal": "#800000",
      "--blue": "#7c7c7c",
      "--accent": "#800000",
    },
  },
  obsidian: {
    name: "Obsidian",
    swatch: ["#000000", "#4d4d4d", "#7c7c7c"],
    tokens: {
      "--bg1": "#000000",
      "--bg2": "#141414",
      "--bg3": "#4d4d4d",
      "--b1": "rgba(255,255,255,0.06)",
      "--b2": "rgba(255,255,255,0.03)",
      "--t1": "#ffffff",
      "--t2": "rgba(255,255,255,0.52)",
      "--t3": "rgba(255,255,255,0.26)",
      "--crimson": "#4d4d4d",
      "--crimson-dim": "#141414",
      "--crimson-glow": "rgba(77,77,77,0.4)",
      "--panel-top": "#4d4d4d",
      "--panel-bot": "#000000",
      "--teal": "#4d4d4d",
      "--blue": "#7c7c7c",
      "--accent": "#4d4d4d",
    },
  },
};

export const DEFAULT_THEME = "erebus-cyan"; // blue-theme pass (was "command-crimson")
const STORAGE_KEY = "lifeos_theme";

/**
 * Get the active theme ID from localStorage
 * @returns {string} The active theme ID or DEFAULT_THEME
 */
export function getActiveTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || DEFAULT_THEME;
  } catch (error) {
    console.warn("[Theme] Failed to read theme from localStorage:", error);
    return DEFAULT_THEME;
  }
}

/**
 * Apply a theme by ID
 * @param {string} id - The theme ID to apply
 * @returns {string} The applied theme ID
 */
export function applyTheme(id: string) {
  // Validate theme exists
  const theme = THEMES[id as keyof typeof THEMES];
  if (!theme) {
    console.warn(`[Theme] Theme "${id}" not found, falling back to default`);
    return applyTheme(DEFAULT_THEME);
  }

  const root = document.documentElement;
  const { tokens } = theme;

  // Apply all token values
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });

  // Persist to localStorage
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch (error) {
    // Private mode or storage full - just continue
    console.warn("[Theme] Failed to persist theme to localStorage:", error);
  }

  // Dispatch event for components that need to react to theme changes
  try {
    window.dispatchEvent(
      new CustomEvent("themeChanged", {
        detail: { themeId: id, themeName: theme.name },
      }),
    );
  } catch (error) {
    // Ignore event dispatch errors
  }

  return id;
}

/**
 * Apply the saved theme as early as possible on load.
 * @returns {string} The applied theme ID
 */
export function initTheme() {
  const activeTheme = getActiveTheme();
  return applyTheme(activeTheme);
}

/**
 * Get all available themes with their metadata
 * @returns {Array} Array of theme objects with id, name, and swatch
 */
export function getThemeList() {
  return Object.entries(THEMES).map(([id, theme]) => ({
    id,
    name: theme.name,
    swatch: theme.swatch,
  }));
}

/**
 * Get a specific theme by ID
 * @param {string} id - The theme ID
 * @returns {Object|null} The theme object or null if not found
 */
export function getTheme(id: string) {
  return THEMES[id as keyof typeof THEMES] || null;
}

/**
 * Get the current theme ID from the DOM
 * @returns {string} The current theme ID or DEFAULT_THEME
 */
export function getCurrentThemeId() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Check if a theme is valid
 * @param {string} id - The theme ID to check
 * @returns {boolean} Whether the theme exists
 */
export function isValidTheme(id: string) {
  return !!THEMES[id as keyof typeof THEMES];
}

/**
 * Reset theme to default
 * @returns {string} The applied default theme ID
 */
export function resetTheme() {
  return applyTheme(DEFAULT_THEME);
}

/**
 * Get CSS variables for a theme without applying it
 * @param {string} id - The theme ID
 * @returns {Object|null} The theme tokens or null if not found
 */
export function getThemeTokens(id: string) {
  const theme = THEMES[id as keyof typeof THEMES];
  return theme ? theme.tokens : null;
}

/**
 * Create a theme update listener
 * @param {Function} callback - Function called when theme changes
 * @returns {Function} Cleanup function
 */
export function onThemeChange(callback: (themeId: string, themeName: string) => void) {
  const handler = (event: CustomEvent) => {
    if (event.detail) {
      callback(event.detail.themeId, event.detail.themeName);
    }
  };

  window.addEventListener("themeChanged", handler as EventListener);

  return () => {
    window.removeEventListener("themeChanged", handler as EventListener);
  };
}

// Color palette exports for direct use in components
export const COLORS = {
  primary: "#ff000d",
  primaryDark: "#800000",
  primaryDarker: "#4b0f0f",
  black: "#000000",
  darkGray: "#141414",
  gray: "#4d4d4d",
  lightGray: "#7c7c7c",
  white: "#ffffff",
};

// Helper to create color variants with transparency
export function colorWithOpacity(color: string, opacity: number) {
  return `rgba(${color}, ${opacity})`;
}

// Pre-calculated transparent variants
export const TRANSPARENT = {
  primary10: "rgba(255,0,13,0.1)",
  primary20: "rgba(255,0,13,0.2)",
  primary30: "rgba(255,0,13,0.3)",
  primary40: "rgba(255,0,13,0.4)",
  primary50: "rgba(255,0,13,0.5)",
  primary60: "rgba(255,0,13,0.6)",
  primary70: "rgba(255,0,13,0.7)",
  primary80: "rgba(255,0,13,0.8)",
  primary90: "rgba(255,0,13,0.9)",
  darkRed10: "rgba(128,0,0,0.1)",
  darkRed20: "rgba(128,0,0,0.2)",
  darkRed30: "rgba(128,0,0,0.3)",
  darkRed40: "rgba(128,0,0,0.4)",
  darkRed50: "rgba(128,0,0,0.5)",
  darkRed60: "rgba(128,0,0,0.6)",
  black10: "rgba(0,0,0,0.1)",
  black20: "rgba(0,0,0,0.2)",
  black30: "rgba(0,0,0,0.3)",
  black40: "rgba(0,0,0,0.4)",
  black50: "rgba(0,0,0,0.5)",
  black60: "rgba(0,0,0,0.6)",
  black70: "rgba(0,0,0,0.7)",
  black80: "rgba(0,0,0,0.8)",
  black90: "rgba(0,0,0,0.9)",
  white10: "rgba(255,255,255,0.1)",
  white20: "rgba(255,255,255,0.2)",
  white30: "rgba(255,255,255,0.3)",
  white40: "rgba(255,255,255,0.4)",
  white50: "rgba(255,255,255,0.5)",
  white60: "rgba(255,255,255,0.6)",
  white70: "rgba(255,255,255,0.7)",
  white80: "rgba(255,255,255,0.8)",
  white90: "rgba(255,255,255,0.9)",
};

export default {
  THEMES,
  DEFAULT_THEME,
  COLORS,
  TRANSPARENT,
  colorWithOpacity,
  getActiveTheme,
  applyTheme,
  initTheme,
  getThemeList,
  getTheme,
  getCurrentThemeId,
  isValidTheme,
  resetTheme,
  getThemeTokens,
  onThemeChange,
};
