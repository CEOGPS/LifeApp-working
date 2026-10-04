# LifeOS1 / CEO GPS - Comprehensive Code Audit Report

**Generated:** 2026-09-26  
**Project:** D:/dev/LifeApp  
**Stack:** Vite + React 18 + TypeScript, Cloudflare Workers (BFF), Supabase PostgreSQL, Cloudflare Pages  
**Build Status:** ❌ FAILING (200+ TypeScript errors)

---

## EXECUTIVE SUMMARY

The codebase has **significant structural issues** preventing production deployment:
- **200+ TypeScript errors** blocking builds
- **Critical import path mismatches** (`.ts` vs `.tsx` extensions)
- **Route-component mismatches** - sidebar has routes that don't map to real components
- **Duplicate/conflicting auth systems** (Firebase + Supabase)
- **Missing `usePersistentState` hook** - imported from `@/lib/` but exists only in `src/hooks/`
- **Worker API routes not connected** - main worker entry point is minimal stub
- **Persistent storage issues** - mixed localStorage/Supabase with no unified strategy
- **OAuth flows incomplete** - missing provider credentials in worker env

---

## 1. BUILD BLOCKERS (Must Fix First)

### 1.1 TypeScript Configuration Issues
| File | Error | Fix |
|------|-------|-----|
| `src/main.tsx:4,7` | Import paths end with `.tsx` | Remove extensions or enable `allowImportingTsExtensions` |
| `src/lib/persist.ts:5` | Import path ends with `.ts` | Same |
| `src/lib/storage.ts:1` | Import path ends with `.ts` | Same |
| Multiple dashboard components | Cannot find `@/lib/usePersistentState.ts` | Move hook to `src/lib/usePersistentState.ts` or fix import path |

### 1.2 Unused Imports (100+ instances)
- `React` imported but unused in 15+ files (JSX transform doesn't require it)
- `useEffect`, `useState`, `lazy` imported but unused
- Lucide icons imported but never used (LegalPanel has 50+ unused icons)
- Type-only imports (`TriggerType`, `CooldownSettings`, `PresenceState`) declared but never used

### 1.3 Type Errors (Critical)
| File | Error |
|------|-------|
| `src/components/layout/Layout.tsx:72` | `Sidebar` props mismatch - `routes` not in `SidebarProps` |
| `src/components/layout/Layout.tsx:86` | `Topbar` props mismatch - `onMenuClick` not in `TopbarProps` |
| `src/lib/agents/kranos/Kranos.ts:506` | `think` method signature incompatible with `UnifiedAgent` base |
| `src/pages/simulators/*.tsx` | `invokeLLM` calls missing required `accessToken` parameter |
| `src/pages/vault/VaultPanel.tsx:14` | `PanelLayout` has no default export |

### 1.4 Missing Dependencies
| Missing | Referenced In |
|---------|---------------|
| `@radix-ui/react-slider` | `src/components/slider.tsx` |
| `@mediapipe/tasks-vision` FaceMesh export | `src/components/AvatarCanvas.tsx` |

---

## 2. ROUTE-COMPONENT MISMATCHES

### 2.1 Routes in AppRoutes.tsx WITHOUT Corresponding Page Components
| Route | Status |
|-------|--------|
| `/ai-dock` | ❌ Placeholder only (`AIDockPage = () => <div />`) |
| `/calendar` | ❌ Placeholder only |
| `/tasks` | ❌ Placeholder only |
| `/notes` | ❌ Placeholder only |
| `/leads` | ❌ Placeholder only |
| `/finance` | ❌ Placeholder only |
| `/analytics` | ❌ Placeholder only |
| `/marketing` | ❌ Placeholder only |
| `/social` | ❌ Placeholder only |
| `/veriton` | ❌ Placeholder only (has separate app in `src/pages/veriton/`) |
| `/creator` | ❌ Placeholder only |
| `/omni` | ❌ Placeholder only |
| `/browser` | ❌ Placeholder only |
| `/terminal` | ❌ Placeholder only |
| `/simulators` | ❌ Placeholder only |
| `/vault` | ❌ Placeholder only |
| `/integrations` | ❌ Placeholder only |
| `/agents` | ❌ Placeholder only |
| `/preferences` | ❌ Placeholder only |
| `/crm` | ❌ Placeholder only |
| `/journal` | ❌ Placeholder only |

### 2.2 Actual Page Components That Exist But Aren't Routed Properly
| Component | Location | Route Needed |
|-----------|----------|--------------|
| `Dashboard` | `src/pages/dashboard/Dashboard.tsx` | ✅ `/dashboard` |
| `CommunicationsPanel` | `src/pages/communications/CommunicationsPanel.tsx` | ❌ Missing |
| `ContactsPanel` | `src/pages/contacts/ContactsPanel.tsx` | ❌ Missing |
| `CRMPanel` | `src/pages/crm/CRMPanel.tsx` | ✅ `/crm` (placeholder) |
| `EmailPanel` | `src/pages/email/EmailPanel.tsx` | ❌ Missing |
| `IntegrationsPanel` | `src/pages/integrations/IntegrationsPanel.tsx` | ✅ `/integrations` (placeholder) |
| `JournalPanel` | `src/pages/journal/JournalPanel.tsx` | ✅ `/journal` (placeholder) |
| `LegalPanel` | `src/pages/legal/LegalPanel.tsx` | ❌ Missing |
| `MediaPanel` | `src/pages/media/MediaPanel.tsx` | ❌ Missing |
| `MusicPanel` | `src/pages/music/MusicPanel.tsx` | ❌ Missing |
| `OfficePanel` | `src/pages/office/OfficePanel.tsx` | ❌ Missing |
| `ProjectsPanel` | `src/pages/projects/ProjectsPanel.tsx` | ❌ Missing |
| `SocialPanel` | `src/pages/social/SocialPanel.tsx` | ❌ Missing |
| `TasksPanel` | `src/pages/tasks/TasksPanel.tsx` | ❌ Missing |
| `VaultPanel` | `src/pages/vault/VaultPanel.tsx` | ✅ `/vault` (placeholder) |
| Veriton App | `src/pages/veriton/` | ❌ Needs sub-app routing |
| OmniSearch | `src/pages/OmniSearch/` | ❌ Separate Vite project |

---

## 3. AUTHENTICATION SYSTEM - DUAL/CONFLICTING IMPLEMENTATIONS

### 3.1 Two Separate Auth Contexts
| Context | Location | Status |
|---------|----------|--------|
| `FirebaseAuthContext` | `src/contexts/FirebaseAuthContext.tsx` | ⚠️ Legacy, has type errors |
| `SupabaseAuthContext` | `src/lib/SupabaseAuthContext.tsx` | ✅ Primary (but not used in main.tsx) |
| `SupabaseProvider` | `src/lib/supabase.tsx` | ✅ Used in main.tsx |

### 3.2 Issues
- `main.tsx` uses `SupabaseProvider` from `src/lib/supabase.tsx` (minimal, no auth)
- `SupabaseAuthContext` has full OAuth flow but **not integrated into provider hierarchy**
- `FirebaseAuthContext` has type errors: `setUser` unused, provider value type mismatch
- No unified auth state - components use different auth hooks

### 3.3 OAuth Providers Configured (in `src/lib/oauth.ts` & worker)
| Provider | Frontend Support | Worker Route | Credentials Needed |
|----------|------------------|--------------|-------------------|
| Google | ✅ | `/api/oauth/google/*` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | ✅ | `/api/oauth/github/*` | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Microsoft | ✅ | `/api/oauth/microsoft/*` | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` |
| Slack | ✅ | `/api/oauth/slack/*` | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |
| Spotify | ✅ | `/api/oauth/spotify/*` | `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` |
| Facebook | ⚠️ | `/api/oauth/facebook/*` | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` |
| LinkedIn | ⚠️ | `/api/oauth/linkedin/*` | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Twitter/X | ⚠️ | `/api/oauth/twitter/*` | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` |
| Notion | ✅ | `/api/oauth/notion/*` | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` |
| Instagram | ⚠️ | Via Facebook | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |
| TikTok | ⚠️ | `/api/oauth/tiktok/*` | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| Dropbox | ⚠️ | `/api/oauth/dropbox/*` | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` |
| Stripe | ✅ | `/api/oauth/stripe/*` | `STRIPE_CLIENT_ID`, `STRIPE_CLIENT_SECRET` |
| Airtable | ⚠️ | `/api/oauth/airtable/*` | `AIRTABLE_CLIENT_ID`, `AIRTABLE_CLIENT_SECRET` |
| HubSpot | ⚠️ | `/api/oauth/hubspot/*` | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` |
| Monday.com | ⚠️ | `/api/oauth/monday/*` | `MONDAY_CLIENT_ID`, `MONDAY_CLIENT_SECRET` |
| ClickUp | ⚠️ | `/api/oauth/clickup/*` | `CLICKUP_CLIENT_ID`, `CLICKUP_CLIENT_SECRET` |
| Linear | ⚠️ | `/api/oauth/linear/*` | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` |
| Asana | ⚠️ | `/api/oauth/asana/*` | `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET` |
| Trello | ⚠️ | `/api/oauth/trello/*` | `TRELLO_API_KEY`, `TRELLO_API_SECRET` |
| Todoist | ⚠️ | `/api/oauth/todoist/*` | `TODOIST_CLIENT_ID`, `TODOIST_CLIENT_SECRET` |
| Calendly | ⚠️ | `/api/oauth/calendly/*` | `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET` |
| Plaid | ✅ | `/api/oauth/plaid/*` | `PLAID_CLIENT_ID`, `PLAID_SECRET` |
| Discord | ⚠️ | `/api/oauth/discord/*` | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| Reddit | ⚠️ | `/api/oauth/reddit/*` | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| Pinterest | ⚠️ | `/api/oauth/pinterest/*` | `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET` |
| Snapchat | ⚠️ | `/api/oauth/snapchat/*` | `SNAPCHAT_CLIENT_ID`, `SNAPCHAT_CLIENT_SECRET` |
| Apple | ⚠️ | `/api/oauth/apple/*` | `APPLE_SERVICES_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |
| Zoom | ⚠️ | `/api/oauth/zoom/*` | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` |
| Canva | ⚠️ | `/api/oauth/canva/*` | `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET` |

**Status:** ❌ **NO OAUTH CREDENTIALS CONFIGURED** in worker environment variables

---

## 4. WORKER API - ROUTES NOT CONNECTED

### 4.1 Current Worker Entry Point (`worker/src/index.ts`)
```typescript
// ONLY has /health and /test endpoints
// ALL /api/* routes are in working-worker.ts but NOT USED
```

### 4.2 Available Route Modules (worker/src/routes/*.ts) - 32 modules
| Route Module | Path Prefix | Status |
|--------------|-------------|--------|
| `oauth.ts` | `/api/oauth/*` | ✅ Complete |
| `llm.ts` | `/api/llm/*` | ✅ Complete |
| `integrations.ts` | `/api/integrations/*` | ✅ Complete |
| `activity.ts` | `/api/activity/*` | ✅ Complete |
| `kv.ts` | `/api/kv*` | ✅ Complete |
| `vault.ts` | `/api/vault/*` | ✅ Complete |
| `email.ts` | `/api/email/*` | ✅ Complete |
| `stripe.ts` | `/api/stripe/*` | ✅ Complete |
| `github.ts` | `/api/github/*` | ✅ Complete |
| `slack.ts` | `/api/slack/*` | ✅ Complete |
| `notion.ts` | `/api/notion/*` | ✅ Complete |
| `calendar.ts` | `/api/calendar/*` | ✅ Complete |
| `spotify.ts` | `/api/spotify/*` | ✅ Complete |
| `youtube.ts` | `/api/youtube/*` | ✅ Complete |
| `cloudflare.ts` | `/api/cloudflare/*` | ✅ Complete |
| `nylas.ts` | `/api/nylas/*` | ✅ Complete |
| `social.ts` | `/api/social/*` | ✅ Complete |
| `contacts.ts` | `/api/contacts/*` | ✅ Complete |
| `agents.ts` | `/api/agents/*` | ✅ Complete |
| `tasks.ts` | `/api/tasks*` | ✅ Complete |
| `finance.ts` | `/api/finance/*` | ✅ Complete |
| `projects.ts` | `/api/projects/*` | ✅ Complete |
| `browse.ts` | `/api/browse*` | ✅ Complete |
| `search.ts` | `/api/search*` | ✅ Complete |
| `upload.ts` | `/api/upload*` | ✅ Complete |
| `meta.ts` | `/api/meta/*` | ✅ Complete |
| `x.ts` | `/api/x/*` | ✅ Complete |
| `music.ts` | `/api/music/*` | ✅ Complete |
| `tags.ts` | `/api/tags*` | ✅ Complete |
| `config.ts` | `/api/config` | ✅ Complete |
| `signed-url.ts` | `/api/signed-url` | ✅ Complete |

### 4.3 Working Worker (`worker/src/working-worker.ts`) - FULLY WIRED
- Imports all 32 route modules
- Mounts them correctly with `router.use()`
- Has CORS handling
- **NOT DEPLOYED** - `wrangler.toml` points to `src/index.ts` (minimal stub)

---

## 5. PERSISTENT STORAGE ISSUES

### 5.1 Multiple Storage Strategies (No Unified Layer)

| Storage Type | Used By | Persistence | Cross-Browser | Cross-Platform |
|--------------|---------|-------------|---------------|----------------|
| `localStorage` | Dashboard modules (Tasks, Notes, QuickLinks, etc.) | ✅ Browser only | ❌ No | ❌ No |
| `usePersistentState` (hooks) | Dashboard modules, IntegrationsPanel | ✅ Browser only | ❌ No | ❌ No |
| `usePersistentState` (lib - missing) | Many components import but file doesn't exist | N/A | N/A | N/A |
| Supabase `integrations_credentials` | IntegrationsPanel, OAuth flow | ✅ Server | ✅ Yes | ✅ Yes |
| Supabase `user_settings` | Referenced but table may not exist | ✅ Server | ✅ Yes | ✅ Yes |
| Cloudflare KV | Worker routes (`kv.ts`) | ✅ Server | ✅ Yes | ✅ Yes |
| Cloudflare D1 | Worker binding configured | ✅ Server | ✅ Yes | ✅ Yes |
| Cloudflare R2 | Worker binding configured | ✅ Server | ✅ Yes | ✅ Yes |
| IndexedDB | Not used | - | - | - |

### 5.2 Specific Issues

| Issue | Impact |
|-------|--------|
| **No Supabase sync for dashboard data** | Tasks, notes, quick links, leads lost on browser clear / device switch |
| **`usePersistentState` hook missing from `@/lib/`** | 20+ components fail to compile |
| **Music tracks use `URL.createObjectURL()`** | Blob URLs revoked on logout/reload - **data loss** |
| **No conflict resolution** | localStorage vs Supabase - last write wins, no merge |
| **No offline queue** | Mutations fail silently when offline |
| **Vault encryption** | `vaultCrypto.ts` exists but not integrated with Supabase |

### 5.3 Supabase Tables Referenced (Need Verification)
| Table | Used By | RLS Status |
|-------|---------|------------|
| `integrations_credentials` | IntegrationsPanel, OAuth worker | ⚠️ Must allow anon key access |
| `user_settings` | Settings persistence | ⚠️ Must allow anon key access |
| `notifications` | NotificationsModule | Unknown |
| `notes` | NotesModule | Unknown |
| `tasks` | TasksModule | Unknown |
| `leads` | LeadsModule | Unknown |
| `contacts` | ContactsPanel, CRMPanel | Unknown |
| `vault_items` | VaultPanel | Unknown |
| `music_tracks` | MusicPanel | Unknown |

---

## 6. UNWIRED BUTTONS / TABS / FEATURES

### 6.1 Dashboard Modules (Non-Functional Placeholders)
| Module | Location | Status |
|--------|----------|--------|
| Notifications | `Dashboard.tsx:94-114` | Shows "No notifications" - no Supabase wiring |
| Quick Links | `Dashboard.tsx:116-121` | Works (localStorage only) |
| Browser | `Dashboard.tsx:123-130` | Shows "Browser unavailable" |
| Calendar | `Dashboard.tsx:132-137` | Shows "Calendar unavailable" - `CalendarModule.tsx` exists but not used |
| Music Player | `Dashboard.tsx:148-151` | Shows "Music player unavailable" - `MusicPlayer.tsx` exists but not used |
| AI Insights | `Dashboard.tsx:173-178` | Shows "AI insights unavailable" |
| Activity Feed | `Dashboard.tsx:182-196` | Shows "No recent activity" |

### 6.2 Buttons With No Handlers
| Component | Button | Expected Action |
|-----------|--------|-----------------|
| `ErebusDock` Settings | Clear conversation history | No `onClick` handler |
| `IntegrationsPanel` OAuth buttons | Many providers | Worker credentials missing |
| `IntegrationsPanel` Sync buttons | Live data sync | `SYNC_ROUTES` only has 11/200+ integrations |
| `LegalPanel` | Many toolbar buttons | No handlers connected |
| `VaultPanel` | Encrypt/Decrypt | Crypto exists but not wired |
| `MusicPanel` | Shuffle, Repeat, Volume | Icons imported but no handlers |

### 6.3 Tabs Without Content
| Component | Tabs | Status |
|-----------|------|--------|
| `CommunicationsPanel` | Email, SMS, WhatsApp, etc. | Only Email partially implemented |
| `ContactsPanel` | List, Import, Export | Import/Export buttons no handlers |
| `CRMPanel` | Leads, Deals, Pipeline | Pipeline view empty |
| `ProjectsPanel` | Board, List, Calendar | Calendar view empty |
| `TasksPanel` | My Tasks, All, Archive | Archive empty |

---

## 7. MISSING ENVIRONMENT VARIABLES

### 7.1 Frontend (Cloudflare Pages / `.env`)
| Variable | Required | Current Status |
|----------|----------|----------------|
| `VITE_SUPABASE_URL` | ✅ Yes | ❌ Not set on Pages |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Yes | ❌ Not set on Pages |
| `VITE_WORKER_URL` | ✅ Yes | ❌ Points to wrong worker (`lifeos1.ceogps.workers.dev` vs `lifeos1-api.ceogps.workers.dev`) |

### 7.2 Worker (Cloudflare Worker Dashboard)
| Variable | Required For | Status |
|----------|--------------|--------|
| `SUPABASE_URL` | All Supabase queries | ✅ In wrangler.toml |
| `SUPABASE_SERVICE_ROLE_KEY` | OAuth, credentials CRUD | ❌ Missing |
| `SUPABASE_PUBLISHABLE_KEY` | Config endpoint | ✅ In wrangler.worker.toml |
| `OAUTH_REDIRECT_URI` | OAuth callbacks | ✅ In wrangler.toml |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth | ❌ Missing |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth | ❌ Missing |
| `MICROSOFT_CLIENT_ID/SECRET` | Microsoft/Outlook OAuth | ❌ Missing |
| `SLACK_CLIENT_ID/SECRET` | Slack OAuth | ❌ Missing |
| `SPOTIFY_CLIENT_ID/SECRET` | Spotify OAuth | ❌ Missing |
| `NOTION_CLIENT_ID/SECRET` | Notion OAuth | ❌ Missing |
| `STRIPE_CLIENT_ID/SECRET` | Stripe OAuth | ❌ Missing |
| `PLAID_CLIENT_ID/SECRET` | Plaid OAuth | ❌ Missing |
| (20+ more providers) | Various OAuth | ❌ All missing |

### 7.3 KV / R2 / D1 Bindings
| Binding | ID | Status |
|---------|-----|--------|
| `LIFEOS_KV` | `c7e7fb2195cc4397af43f41a06be7efb` | ✅ Configured |
| `LIFEOS_STORAGE` (R2) | `lifeos-storage` | ✅ Configured |
| `LIFEOS_DB` (D1) | `9aa6e88b-bba8-43c8-8591-5fac48d5a200` | ✅ Configured |

---

## 8. SUB-APP INTEGRATION ISSUES

### 8.1 Veriton (src/pages/veriton/)
- **Separate Vite project** with own `package.json`, `vite.config.js`, `tailwind.config.js`
- Uses **Base44 SDK** (`@base44/sdk`, `@base44/vite-plugin`) - must be replaced with Supabase auth
- Has own routing (`VeritonDashboard.jsx`, `Create.jsx`, `Library.jsx`, etc.)
- **Not wired into main AppRoutes.tsx** - needs `<Route path="/veriton/*" element={<VeritonApp />} />`

### 8.2 OmniSearch (src/pages/OmniSearch/)
- **Separate Vite project** with own dependencies
- Not integrated into main app

### 8.3 Lucid Systems (referenced in tsconfig exclude)
- Referenced in `tsconfig.json` exclude but not found in `src/pages/`

---

## 9. MUSIC PLAYER PERSISTENCE BUG

**File:** `src/lib/music.ts` / `src/pages/music/MusicPanel.tsx` / `src/components/GlobalMusicPlayer.tsx`

**Issue:** Uses `URL.createObjectURL(file)` to create blob URLs for audio playback. These URLs are **revoked on page unload/logout**, causing all imported tracks to become unplayable.

**Fix Required:** Convert to base64 data URLs using `FileReader.readAsDataURL()` and store in localStorage/Supabase.

---

## 10. PRIORITY FIX PLAN

### Phase 1: Build Fixes (Immediate - Blocks Everything)
1. Fix `tsconfig.json` - add `allowImportingTsExtensions: true` or remove extensions from imports
2. Move `usePersistentState` from `src/hooks/` to `src/lib/usePersistentState.ts`
3. Fix `main.tsx` import paths (remove `.tsx` extensions)
4. Fix `Sidebar`/`Topbar` prop type mismatches in `Layout.tsx`
5. Fix `PanelLayout` export in `VaultPanel.tsx`
6. Remove unused imports causing TS6133 errors (or prefix with `_`)

### Phase 2: Auth Unification (Critical)
1. Remove `FirebaseAuthContext` entirely
2. Wire `SupabaseAuthContext` into `main.tsx` provider hierarchy
3. Update `AppRoutes.tsx` `useAuth` to use `SupabaseAuthContext`
4. Deploy worker with `SUPABASE_SERVICE_ROLE_KEY`

### Phase 3: Worker Deployment (Critical)
1. Deploy `worker/src/working-worker.ts` as main worker (rename to `index.ts`)
2. Set all OAuth credentials in Cloudflare Worker dashboard
3. Verify `/api/config` endpoint returns Supabase credentials

### Phase 4: Route-Component Wiring (High)
1. Create lazy-loaded page components for all 21 routes in `AppRoutes.tsx`
2. Wire existing panels (`CommunicationsPanel`, `ContactsPanel`, etc.) to routes
3. Integrate Veriton as sub-app at `/veriton/*`

### Phase 5: Persistent Storage Unification (High)
1. Create unified `useSyncedState` hook (localStorage + Supabase)
2. Migrate all dashboard modules to use it
3. Fix Music Player to use base64 data URLs
4. Add conflict resolution (last-write-wins with timestamp)

### Phase 6: Feature Completion (Medium)
1. Wire `SYNC_ROUTES` for all 200+ integrations in `IntegrationsPanel`
2. Connect all dashboard modules to Supabase
3. Implement Vault encryption/decryption UI
4. Add OAuth status polling for all providers

---

## 11. FILES REQUIRING IMMEDIATE ATTENTION

| Priority | File | Issue |
|----------|------|-------|
| 🔴 CRITICAL | `tsconfig.json` | `allowImportingTsExtensions` missing |
| 🔴 CRITICAL | `src/main.tsx` | Import extensions, missing AuthProvider |
| 🔴 CRITICAL | `src/lib/usePersistentState.ts` | **FILE MISSING** - create from hooks version |
| 🔴 CRITICAL | `worker/src/index.ts` | Replace with `working-worker.ts` |
| 🔴 CRITICAL | `src/AppRoutes.tsx` | 21 routes with placeholder components |
| 🟠 HIGH | `src/components/layout/Layout.tsx` | Sidebar/Topbar prop mismatches |
| 🟠 HIGH | `src/pages/vault/VaultPanel.tsx` | PanelLayout import error |
| 🟠 HIGH | `src/lib/SupabaseAuthContext.tsx` | Not integrated into provider tree |
| 🟡 MEDIUM | `src/lib/music.ts` | Blob URL persistence bug |
| 🟡 MEDIUM | `src/pages/integrations/IntegrationsPanel.tsx` | 189 integrations without sync routes |

---

## 12. DEPLOYMENT CHECKLIST

Before claiming any task complete:
- [ ] `pnpm run build` passes with 0 errors
- [ ] `npx wrangler pages deploy dist --project-name=lifeos1` succeeds
- [ ] Live verification at `https://lifeos1.pages.dev` (Ctrl+F5 cache bypass)
- [ ] Worker API responds at `https://lifeos1-api.ceogps.workers.dev/api/config`
- [ ] OAuth flow works for at least Google + GitHub
- [ ] Dashboard data persists across logout/login (Supabase sync verified)
- [ ] Music tracks play after reload (base64 storage verified)

---

## SUMMARY STATUS

| Area | Status | Blockers |
|------|--------|----------|
| **Build** | ❌ FAILING | 200+ TS errors |
| **Auth** | ⚠️ PARTIAL | Dual systems, not unified |
| **Routes** | ❌ BROKEN | 21/22 routes are placeholders |
| **Worker API** | ⚠️ CODE READY | Not deployed (wrong entry point) |
| **OAuth** | ⚠️ CODE READY | No credentials in worker env |
| **Persistent Storage** | ❌ FRAGMENTED | No unified layer, music bug |
| **Dashboard Modules** | ⚠️ PARTIAL | 8/15 modules non-functional |
| **Integrations** | ⚠️ UI ONLY | 11/200+ have live sync |
| **Sub-apps** | ❌ NOT WIRED | Veriton, OmniSearch isolated |
| **Deployment** | ❌ BLOCKED | Build fails, env vars missing |

---

**Next Action:** Start Phase 1 build fixes immediately. The codebase cannot be deployed or verified until TypeScript compiles cleanly.