# LifeOS1 — Copilot CLI Project Rules

You are working on **LifeOS1**, a personal/business operating system. This
file is authoritative. Read it before every session. When in doubt, ask
before acting.

## Repository

- Root: `D:\dev\LifeApp`
- Stack: React + Vite + TypeScript, React Router (BrowserRouter), TanStack Query,
  Supabase auth, Tailwind CSS v3
- Entry: `src/main.tsx` → `src/AppRoutes.tsx` → `src/ui/layout` (barrel)

## DO NOT CHANGE WITHOUT EXPLICIT REQUEST

These are load-bearing. A previous tool rewrote them without permission and
the user had to undo the work by hand. Do not repeat that.

### Theme
- `src/index.css` is authoritative
- Tailwind v3 syntax (`@tailwind base/components/utilities`), HSL color tokens,
  hardcoded hex for crimson (`#dc143c`) and teal (`#0d9488`)
- Fonts: `Inter` (body), `Space Grotesk` (display)
- Custom utilities: `glass`, `glass-crimson`, `glass-teal`, `glass-strong`,
  `glow-crimson-sm`, `glow-crimson-lg`, `crimson-gradient`,
  `crimson-text-gradient`, `teal-text-gradient`, `input-base`,
  `status-connected`, `status-pending`, `status-error`, `status-disconnected`
- The `.text-white-XX` utility classes **do not exist** in this theme. Use
  Tailwind opacity syntax: `text-white/90`, `text-white/70`, `text-white/40`,
  etc.
- Do not replace the file. Do not change Tailwind major versions. Do not
  swap HSL for OKLCH or vice versa. Do not rename utility classes.

### Router
- `src/AppRoutes.tsx` is authoritative
- Route paths, route names, and the `AppLayout` wrapper are locked
- Do not consolidate routes. Do not introduce `HashRouter`. Do not rename
  `/dashboard`, `/vault`, `/tasks`, `/notes`, `/leads`, `/finance`,
  `/analytics`, `/marketing`, `/social`, `/veriton`, `/creator`, `/omni`,
  `/browser`, `/terminal`, `/simulators`, `/integrations`, `/agents`,
  `/preferences`, `/ai-dock`, `/calendar`, `/login`, `/auth/callback`
- Every panel currently routed must stay routed. Do not remove `<Route>`
  entries. To add a route, add — do not replace.

### Provider hierarchy
- `src/main.tsx` is authoritative
- Nesting is locked:
  `QueryClientProvider > AuthProvider > MusicProvider > BrowserRouter > AppContent`

### Import paths
- `@/ui/layout` — barrel for layout + page re-exports
- `@/features/dashboard` — dashboard feature
- `@/pages/*` — page components
- `@/components/*` — shared components
- `@/lib/*` — utilities (`api`, `usePersistentState`, `invokeLLM`, `useUserEmail`)
- `@/platform/*` — platform integrations (`supabase/auth`, `audio/MusicContext`)
- Do not migrate between path prefixes. Do not introduce new aliases. Do not
  consolidate multiple imports into new barrels.

### Panel files
- Panels live under `src/pages/`
- Do not move, rename, or delete existing panel files
- To add a panel, create a new file — do not edit existing ones to make room

### Supabase
- Do not modify schemas, add tables, or change RLS policies without explicit
  request
- Do not run migrations
- Do not call `supabase.from(...)` on tables that don't exist

## DO CHANGE WHEN ASKED

- Individual panel implementations
- Bug fixes in specific files
- Adding features to existing panels
- Adding new panels (new files under `src/pages/`)
- Fixing TypeScript errors
- Fixing imports to match real file locations
- Replacing broken Tailwind class names (e.g. `text-white-90` → `text-white/90`)

## NEVER DO, EVEN IF IT SEEMS LIKE AN IMPROVEMENT

A previous tool did every one of these without permission. Each had to be
undone manually.

- Delete files that are not part of the requested change
- Rewrite a file that is not broken
- Replace a working pattern with a "cleaner" one
- Consolidate imports, routes, or providers into barrels
- Rename variables, functions, or files "for consistency"
- Reformat files without being asked
- Change file extensions (`.tsx` ↔ `.jsx`)
- Change export style (`default` ↔ named)
- Move components between directories
- Drop features from the route table
- Comment out code "for cleanup"
- Add TODO comments as placeholders for work you decided not to do
- Introduce new dependencies — the dependency set is fixed
- Change `PanelLayout` or `AppLayout` signatures

## HOW TO INTERACT

- Before editing a file, read it in full. Do not assume its shape.
- Before deleting a file, confirm with the user.
- If a request is ambiguous, ask a clarifying question. Do not guess.
- Make the smallest possible edit for the requested change.
- If the user asks for something in the "do not change" list, ask first and
  explain the conflict.

## PREFERENCES

- **Full-file rewrites when a file genuinely needs rewriting.** Provide the
  complete file in one code block. No `// rest unchanged`, no `....`
- **Honest code over polished code.** If something cannot be done, say so in
  a comment or a disabled state. Do not ship a fake that looks functional.
- **No "coming soon" buttons.** Buttons that don't work are disabled with a
  `title` attribute explaining why, or removed.
- **No fake data.** No mocked success paths. No hardcoded values presented as
  real. If the data source doesn't exist, the UI says so.

## WHEN YOU ARE UNSURE

Stop. Ask. The user has had to undo multiple rounds of unrequested
restructuring. They would rather answer a clarifying question than reverse
another silent rewrite.