// ── Global palette (singleton) ───────────────────────────────────────────────
// Every panel imports { C } and reads C.<key> at render time. The theme switcher
// (lib/theme.js) fires "themeChanged"; LifeOSShell then calls refreshPalette()
// which MUTATES this same object in place and re-renders the tree, so all panels
// restyle live without touching a single usage site.
//
// Accent values are 6-digit hex on purpose: hundreds of styles append alpha like
// `${C.teal}20`, which only works on hex. Text/border keys are rgba (never
// alpha-appended). The dominant crimson-family keys follow the active theme's
// --accent so switching themes visibly re-skins everything; a small set of
// secondary accents + the "hint of green" stay fixed to keep the palette on-brand
// (crimson · gray · white · black · red · hint of green).

// theme.ts is a TypeScript module with generated TypeScript declarations.
import { THEMES, DEFAULT_THEME, getActiveTheme } from "./theme";

interface ThemeTokens {
  [token: string]: string;
}

interface Theme {
  name: string;
  swatch: string[];
  tokens: ThemeTokens;
}

interface Palette {
  bg: string;
  bg1: string;
  bg2: string;
  bg3: string;
  card: string;
  card2: string;
  black: string;
  text: string;
  white: string;
  t2: string;
  muted: string;
  t3: string;
  dim: string;
  border: string;
  primary: string;
  primaryDark: string;
  accent: string;
  crimson: string;
  teal: string;
  cyan: string;
  e: string;
  eHi: string;
  eDim: string;
  erebus: string;
  glow: string;
  red: string;
  blue: string;
  purple: string;
  pink: string;
  orange: string;
  gold: string;
  amber: string;
  green: string;
}

function buildPalette(themeId: string): Palette {
  const theme = THEMES[themeId as keyof typeof THEMES] || THEMES[DEFAULT_THEME];
  const t = theme.tokens;
  const accent = t["--accent"];        // dominant color (hex)
  const dim    = t["--crimson-dim"];   // dark variant (hex)
  const blue   = t["--blue"];          // gray in every theme

  return {
    // surfaces
    bg:     t["--bg1"],
    bg1:    t["--bg1"],
    bg2:    t["--bg2"],
    bg3:    t["--bg3"],
    card:   t["--bg2"],
    card2:  t["--bg3"],
    black:  "#000000",

    // text
    text:   t["--t1"],
    white:  t["--t1"],
    t2:     t["--t2"],
    muted:  t["--t2"],
    t3:     t["--t3"],
    dim:    t["--t3"],

    // borders
    border: t["--b1"],

    // dominant crimson family — follows the active theme
    primary:     accent,
    primaryDark: dim,
    accent:      accent,
    crimson:     accent,
    teal:        accent,   // legacy key (was green) → now theme accent
    cyan:        accent,
    e:           accent,   // Erebus
    eHi:         accent,
    eDim:        dim,
    erebus:      accent,
    glow:        t["--crimson-glow"],

    // secondary accents — fixed (blue/cyan theme; red stays semantic) + gray + hint green
    red:    "#ff3b3b",
    blue:   blue,
    purple: "#5b7cff",   // blue-theme pass: was crimson #b3223c
    pink:   "#ff5c78",
    orange: "#e0552f",
    gold:   "#d98b3a",
    amber:  "#e0a13a",
    green:  "#22c55e",   // the single "hint of green" (success / online / positive)
  };
}

// Live singleton — mutated in place by refreshPalette().
export const C: Palette = buildPalette(getActiveTheme());

export function refreshPalette(themeId?: string): Palette {
  Object.assign(C, buildPalette(themeId || getActiveTheme()));
  return C;
}

export default C;
