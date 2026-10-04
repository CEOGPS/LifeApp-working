# LifeOS / LifeApp — Production Finish Strategic Plan

**Project:** LifeOS1 (package `lifeos1.agentzero`)  
**Repo:** `D:/dev/LifeApp`  
**Owner:** Chris Green  
**Plan date:** Mon Sep 28, 2026 (ET)  
**Status of this doc:** Working blueprint — grounded in a read-only scan of `src/pages`, `src/components/layout/sidebar-items.ts`, `src/AppRoutes.tsx`, `src/pages/aihub/*`, `src/lib/agents/*`, `src/components/{AgentDock,ErebusDock}.tsx`, `src/platform/*`, `worker/src/routes/*`, `AUDIT_REPORT.md`, and `LifeApp.md`.  
**Hard rule for executors:** **DO NOT remove existing panels, modules, routes, or sidebar entries without an explicit ask from Chris.** Prefer wire → fix → improve over delete/replace.

---

## Table of contents

1. [Executive strategy](#1-executive-strategy)
2. [Design system target](#2-design-system-target)
3. [Inventory: what exists vs missing](#3-inventory-what-exists-vs-missing)
4. [Pages & panels — full specs](#4-pages--panels--full-specs)
5. [Agents — deep dive](#5-agents--deep-dive)
6. [Dashboard homepage modules](#6-dashboard-homepage-modules)
7. [Phased roadmap & production readiness](#7-phased-roadmap--production-readiness)
8. [Regression risks & guardrails](#8-regression-risks--guardrails)
9. [Appendix](#9-appendix)

---

## 1. Executive strategy

### 1.1 North star

Ship a **production-ready LifeOS shell** where every sidebar destination either (a) works end-to-end with real persistence + honest empty states, or (b) is explicitly gated as “coming online” **without** deleting the route or nav entry. Agents (Erebus / Kranos / AgentZero team) are first-class, not bolt-ons. The visual language is **black + crimson grid + glass**, with uploadable branding.

### 1.2 Explicit non-regression rule

| Action | Allowed? |
|--------|----------|
| Add a panel / route / module | Yes |
| Fix / rewire existing panel | Yes |
| Hide a broken control behind feature flag | No fix broken control | 
| Remove a sidebar item, route, or module | No |
| Replace a working panel with a stub | No. That doesnt even make sense |
| “Clean up” by deleting simulator / sub-app folders | No. Wire them in. They dont have to be complete stand alone sub apps. You can modify them to fit the dashboard as long as they have the same functionality. |

### 1.3 Phased approach (finish without regressions)

| Phase | Name | Goal | Exit gate |
|-------|------|------|-----------|
| **P0** | Stabilize | Build green, auth single path, worker entry correct, no crash on navigate | `pnpm build` clean; every sidebar href loads without white screen |

| **P1** | Shell & theme | Topbar logo+banner, sidebar, crimson dot grid hover, glass modules, floating dock always present | Visual QA checklist pass on Dashboard + 3 panels |

| **P2** | Dashboard modules | Re-wire every home module to real data or honest empty; kill inline “unavailable” stubs that ignore existing `_components` you can replace not kill the modules | All modules in §6 have acceptance criteria met |

| **P3** | Panels one-by-one | For each wired panel: CRUD + persistence + empty/error honesty; for stubs: promote from placeholder without removing nav | Per-panel “done means” in §4 |

| **P4** | Integrations | OAuth connect/disconnect/status; sync routes for priority providers; Integrations hub truthful | Google + GitHub + 3 business OAuth live |

| **P5** | Agents | Erebus autonomy, Kranos orchestration, AgentZero CRUD, dock FaceTime UX, permissions, handoffs | Dock + AI Hub + Telegram bridge smoke tests | Cloudflare workers need to be able to take on tasks. 

| **P6** | New surfaces | Build missing brief panels ( Health, Opportunity, BCC, etc.) as **additions** | Nav entries exist + pages non-stub | Scratch family panel. Add a Relationship dropdown in contacts and I can use it for the same thing. 

| **P7** | Production harden | Security (RLS), observability, Electron/desktop, perf, deploy checklist | Live Pages + Worker + persistence proven |

### 1.4 Working principles

1. **Honest UI with zero mock data, stubs, place holders, or fake data.** Demand empty states and `configured: false` (Maps/Vault pattern) over DEMO numbers. Go ahead and add API Keys and Client IDs so data can be pulled on tests. 
   
2. **One storage truth.** Prefer `usePersistentState` (local mirror + Supabase `user_data` / domain tables) + Worker for secrets/uploads.

3. **Panels stay self-contained** where they already are (CRM/Email/Music style), but share primitives from `src/ui` and palette from `src/platform/theme`. They should be self contained but communicate CRM, Contacts, Marketing,should work with email and Communications panel. 

4. **Never invent sidebar stubs** that claim “real” — `sidebar-items.ts` already documents this; extend only when a page component exists or is being added in the same PR. DO NOT EVER ADD STUBS OR FAKE DATA ANYTHING
   
5. **Sub-apps (Veriton, Lucid, OmniSearch, SocialLink, Creator)** stay embedded via wrappers; unify theme tokens, do not rewrite them unless asked. You dont have to rewrite them but can modify them if its easier to integrate them into the dashboard as long as they have the same functions. 

6. **Agents never get silent tool access** Agent settings should be granular with no actions without permission tiers (§5).

### 1.5 Dependency order (critical path)

```
Build/TS → Auth (Supabase only) → Worker deploy (working-worker as entry)
  → Shell/theme → Dashboard module wiring
  → Core panels (Tasks/Notes/Calendar/Contacts/CRM/Email)
  → Finance + Leads + Analytics (currently AppRoutes placeholders)
  → Integrations OAuth
  → Agents (dock + hub + ErebusCore/Kranos)
  → Missing brief panels
  → Hardening / Electron / launch
```

---

## 2. Design system target

### 2.1 Color & surface

| Token | Target | Current repo |
|-------|--------|--------------|
| Background | `#000000` pure black | Palette has `black: #000000`; theme `crimson-phantom` uses `#050505` — **converge to `#000000`** for canvas; keep `#050505` only if needed for elevation contrast |
| Accent | Crimson `#dc143c` (+ light `#ff1a40`, glow) | Present in `PALETTE.crimson` |
| Neutrals | Gray scale + white | Present |
| Sparse others | Teal/success/warning only for status | Palette still has teal theme + multi-chart hues — **restrict chrome to crimson/gray/white**; keep semantic status dots |
| Glass | `rgba` white/crimson glass cards | `PALETTE.glass.*` + CSS `glass` / `glass-crimson` classes |

### 2.2 Crimson grid dots

- **Exists:** `DotGridBackground.tsx` — radial crimson dots, densities low/medium/high.
- **Gap:** No hover brighten (“hover light”). Grid is `pointer-events-none`.
- **Fix:** Add a CSS-only or canvas overlay layer that brightens nearest dots under cursor (or a soft radial follow-light using crimson), without stealing clicks from modules (`pointer-events-none` on grid; optional `pointer-events-auto` only on an invisible hit layer if needed).
- **Improve:** Respect `prefers-reduced-motion`; density setting in Preferences; pause animation when tab hidden.

### 2.3 Glassmorphic modules

- Dashboard uses `Module.tsx` + glass classes — keep as the canonical module chrome.
- Panels should use `PanelLayout` + shared `Card`/`Panel` from `src/ui/primitives`.
- **Improve:** One `GlassModule` API (title, icon, accent, headerRight, loading, error, empty) used by Dashboard and panel section cards.

### 2.4 Shell chrome

| Element | Target | Current | Fix |
|---------|--------|---------|-----|
| **Topbar** | Left: uploadable logo; title/breadcrumbs; notifications; user | `Topbar.tsx` exists (~13KB); logo upload not evident | Add logo slot: click → file picker → store data URL or R2 URL in `user_settings`; fallback CEO GPS / LifeOS mark from `/public/agents/ceogps.png` | Remove Dashboard | Dashboard links

| **Banner below topbar** | Full-width brand/status banner | `BannerArea.tsx` exists; not clearly mounted under topbar in all layouts: Banner only needs to be on the first page.  | Mount `BannerArea` in `PanelLayout`/`AppLayout` under Topbar; allow uploadable banner image + optional status pills (LIFEOS ONLINE) |

| **Sidebar** | Sectioned CORE / BUSINESS / CREATOR / TOOLS / SETTINGS | `sidebar-items.ts` + `Sidebar.tsx` — solid | Keep; add missing brief items only when pages land; badges for unread/agent jobs |

| **Floating AI dock** | FaceTime-like talking avatar, text/speech, upload, skins/voices | `AgentDock.tsx` (rich) + `ErebusDock.tsx` not simpler if anything more complex + `AvatarCanvas.tsx`; `/ai-dock` routes to `ErebusDock` | **Unify:** App shell always mounts `AgentDock` (or Erebus presence) floating all over pc; `/ai-dock` opens expanded mode; see §5 |

### 2.5 Typography & motion

- Display tracking wide uppercase for section titles (already in Dashboard welcome).
- Motion: `motion/react` — keep subtle; disable when reduced-motion.
- Icons: `lucide-react` only in shell (Use actual logos not icons).

### 2.6 Brand assets

- Portraits already in `public/agents/` (Aspyn, Inferno, Kranos, Nova, Viper, …).  
- 
- **Gap:** AgentDock defaults reference `/agents/Erebus.png`, `/agents/Breeze.png` — **not in the public list scanned**.
-  Fix by adding assets or remapping to existing files. External `media.base44.com` URLs for some avatars — **mirror to `/public/agents/`** for offline/Electron reliability. Remove all base44 references and connections

---

## 3. Inventory: what exists vs missing

### 3.1 Sidebar ↔ routes ↔ pages (as of scan)

| Sidebar id | Href | AppRoutes | Page component | Status |
|------------|------|-----------|----------------|--------|
| dashboard | `/dashboard` | yes | `pages/dashboard/Dashboard.tsx` | **Partial** — many modules stubbed inline despite `_components` existing |

| ai-dock | `/ai-dock` | yes | `ErebusDock` | **Exists** — thinner than `AgentDock` |

| calendar | `/calendar` | yes | `CalendarPanel.tsx` | **Wired, substantial** |

| tasks | `/tasks` | yes | `TasksPanel.tsx` | **Wired, substantial** |

| notes | `/notes` | yes | `NotesModule.tsx` (dashboard component as page) | Keep as module

| journal | `/journal` | yes | `JournalPanel.tsx` | **Wired**Add templates |

| contacts | `/contacts` | yes | `ContactsPanel.tsx` | **Wired, substantial** |

| crm | `/crm` | yes | `CRMPanel.tsx` | **Wired, substantial** |

| leads | `/leads` | yes | inline placeholder | **Stub route** | Add to community Panel

| email | `/email` | yes | `EmailPanel.tsx` | **Wired, substantial** |

| communications | `/communications` | yes | `CommunicationsPanel.tsx` | **Wired**Improve if possible |

| finance | `/finance` | yes | inline placeholder |  Wire everything to be real data. Credit scores are 632 and 639. That is real data added. Make the number editable. 

| analytics | `/analytics` | yes | inline placeholder | wire to real data |

| marketing | `/marketing` | yes | `MarketingPanel.tsx` + tabs | **Wired, substantial** |

| community | `/community` | yes | `CommunityPanel.tsx` | **Wired** |

| social | `/social` | yes | `SocialPanel.tsx` (+ SocialLink subfolder) | **Wired** |

| projects | `/projects` | yes | `ProjectsPanel.tsx` | **Wired** |

| office | `/office` | yes | `OfficePanel.tsx` | **Wired** |

| maps | `/maps` | yes | `MapsPanel.tsx` | **Wired** |

| legal | `/legal` | yes | `LegalPanel.tsx` | **Wired** |

| veriton | `/veriton` | yes | `VeritonWrapper` | modify the app to fit into the dashboard and still have same functionality |

| creator-os | `/creator` | yes | `CreatorWrapper` | modify the app to fit into the dashboard and still have same functionality |

| lucid | `/lucid` | yes | `LucidWrapper` | modify the app to fit into the dashboard and still have same functionality |

| omni-search | `/omni` | yes | `OmniSearchWrapper` | modify the app to fit into the dashboard and still have same functionality |

| media | `/media` | yes | `MediaPanel.tsx` | **Wired** |

| music | `/music` | yes | `MusicPanel.tsx` | **Wired, substantial** | Make sure persistent memory is in place and make sure files play more than once.

| browser | `/browser` | yes | inline placeholder | Can be wired into omnisearch |

| terminal | `/terminal` | yes | inline placeholder | Wire the terminals in for full functionality |

| simulators | `/simulators` | yes | only `AlternateLifeExplorer` | **Partial** — 6 other sims not routed as hub | wire in the current simulators dont worry about the ones that arent there

| vault | `/vault` | yes | `VaultPanel.tsx` | **Wired** | Make sure its secure

| integrations | `/integrations` | yes | `IntegrationsPanel.tsx` | **Wired UI; sync partial** | Complete the sync and connections

| agents | `/agents` | yes | `AIHubPage.tsx` | **Wired hub shell** | Wire and sync to Agent dock

| preferences | `/preferences` | yes | inline placeholder | **Stub** (Settings target) | Wire and implement preferences and settings

### 3.2 Brief items with little/no UI yet

| Brief item | Repo finding |
|------------|--------------|
| Family & Friends | **Missing** |
| Health | **Missing** |
| Opportunity Engine | **Missing** |
| Business Command Center | **SQL migration `0006_business_command.sql` exists**; no panel |
| Insight Engine | Only `AiInsights.tsx` dashboard widget |
| Life Audit / Pulse | **Missing** |
| Conflict Resolver | Overlaps Narrative Conflict simulator — no dedicated ops panel |
| Smart Browser Sentinel | Browser route is placeholder |
| Parallel Life Conductor | **Missing** (simulators adjacent) |
| Compliment Cannon | **Missing** |
| Life RPG | **Missing** |
| EchoPersona / Narrative Conflict / Shadow Budget | **Exist as simulators** — not sidebar first-class |
| AgentZero | Avatar/team in `AgentDock` + AI Hub Agents section; no standalone “AgentZero” page |
| Terminals | Placeholder |
| Finance (full panel) | Placeholder route |

### 3.3 Backend surface (ready vs not)

- **Worker route modules present** under `worker/src/routes/`: activity, agents, browse, calendar, cloudflare, config, contacts, email, finance, github, integrations, kv, llm, meta, music, notion, nylas, oauth, projects, search, slack, social, spotify, stripe, tags, tasks, upload, etc.
- **AUDIT_REPORT** claims wrong worker entry / incomplete deploy — treat **worker deployment verification** as P0.
- **Supabase migrations** for settings, contacts, credentials, user_data, dashboard modules, business_command — **RLS policies currently `USING (true)`** — production risk; harden in P7.
- **Platform layer** exists: theme, oauthConnector, llm client, storage helpers, supabase auth.

---

## 4. Pages & panels — full specs

For each: Purpose · UI · Features · Data · Status · Fix · Improve.

---

### 4.1 Dashboard home (`/dashboard`)

**Purpose:** Mission-control mosaic — time/weather, productivity, money, media, AI, social/marketing pulse, quick navigation.

**UI layout:** Welcome strip (“Cagednreality” / LIFEOS ONLINE) + responsive CSS grid of glass `Module`s + full-width Activity Feed + bottom spacer for dock.

**Features:** See §6 for each module. Grid should support drag-reorder / hide (future) without removing modules from codebase.

**Data:** Supabase domain tables (`tasks`, `notes`, `calendar_events`, `leads`, `budget_bills`, …), Worker finance/social, local `usePersistentState`, LLM for tips/insights.

**Status:** **Partial / regressive wiring.** `Dashboard.tsx` imports many `_components` but then overrides Music/Browser with local stubs and leaves Notifications/QuickLinks/Calendar/AI Insights/Activity as “unavailable” / empty — while richer implementations exist under `_components/`.

**Fix:**
1. Replace inline stubs with the existing `_components` implementations (`NotificationsModule`, `QuickLinks`, `CalendarModule`, `TasksModule`, `NotesModule`, `LeadsModule`, `MusicPlayer`, `BrowserArea`, `AiInsights`, `AiMoneyTips`, `LifeHacks`, `SocialAnalytics`, `MarketingAnalytics`, `AgentMonitor`, `ActivityFeedPanel`).
2. Ensure each module uses persistence hooks, not only in-memory demo.
3. Keep welcome strip + grid chrome; do not remove modules from the grid without ask — hide via Preferences if needed.

**Improve:** Module catalog in Preferences; per-module refresh; skeleton loaders; deep-link “Open in panel” affordances; layout presets (Founder / Creator / Ops).

---

### 4.2 Music (`/music`)

**Purpose:** Suno-shaped music hub — create, library, playlists, mini-player, streaming deep links.

**UI:** Tabs Create / Library / Playlists; persistent mini-player; bulk import.

**Features:** Track CRUD; AI lyric polish; Listen-on links (6 services); upload via Worker; play/pause/shuffle/repeat.

**Data:** Supabase music rows + Worker `/api/music/*` + `/api/upload`; IndexedDB/audio store patterns in platform.

**Status:** **Exists, substantial (~1100 lines).** Known historical bug: blob URL persistence (AUDIT). Dashboard mini-player currently stubbed separately.

**Fix:** Unify MusicPanel player with dashboard `MusicPlayer` via shared MusicContext; persist as base64 or R2 URLs not ephemeral blobs; wire Spotify OAuth when credentials present.

**Improve:** Waveform; queue across app; Erebus “play focus playlist”; offline Electron cache.

---

### 4.3 Contacts (`/contacts`)

**Purpose:** Personal/business contact graph — source of truth shared with CRM/Comms.

**UI:** List + detail + filters/tags; import/export.

**Features:** CRUD; tags; social/messaging handles; merge duplicates; search.

**Data:** Supabase `contacts` + Worker `/api/contacts`; CRM Path B already references contacts API.

**Status:** **Exists, substantial (~1660 lines).**

**Fix:** Ensure RLS/user_email scoping; dedupe with CRM contacts; CSV import/export via `downloadCsv` util.

**Improve:** Enrichment via LLM; map pin from Maps; “last contacted” from Email/Comms.

---

### 4.4 CRM HubSpot-style (`/crm`)

**Purpose:** Pipeline CRM over contacts/deals — stages, table/board, activities.

**UI:** Pipeline board + table toggle; deal/contact drawers; filters.

**Features:** Stage moves; CRUD deals/leads; activity logging; import; AI assist on next actions.

**Data:** `/api/contacts`, leads table, Supabase; upload helper.

**Status:** **Exists, substantial (~2500+ lines).** Path B pipeline view.

**Fix:** Align lead statuses with `/leads` placeholder (promote Leads to CRM sub-view or thin page that reuses CRM data); remove any DEMO aggregates.

**Improve:** HubSpot/Salesforce sync via Integrations; forecasting; Erebus deal coach; sequences handoff to Email/Marketing.

---

### 4.5 Email (`/email`)

**Purpose:** Inbox + campaigns + analytics + domain verification.

**UI:** Six tabs (Inbox, Campaigns, Analytics, Verification, … per file header).

**Features:** OAuth inbox when connected; campaign composer; AI subject/body; SPF/DKIM/DMARC checks; drafts/schedule.

**Data:** `email_accounts`, `email_campaigns`; Worker email/webhooks (SendGrid/Brevo/etc. in architecture).

**Status:** **Exists, substantial.** Honest “not connected” intended.

**Fix:** Complete at least one provider OAuth end-to-end; wire webhook events to Analytics; connect Composer to Contacts/CRM segments.

**Improve:** Shared inbox; templates library; deliverability score; Agent “draft reply” into dock.

---

### 4.6 Communications (`/communications`)

**Purpose:** Unified messaging — SMS/voice/chat bridges, threads, assignment to agents.

**UI:** Channel list + thread + composer; status of bridges.

**Features:** Multi-channel threads; link to Messaging bridges in AI Hub; templates.

**Data:** Worker slack/meta/nylas; AI Hub `MessagingBridge` (telegram, google-voice, messenger, instagram).

**Status:** **Exists (~1000 lines).**

**Fix:** Surface bridge connection status from AI Hub storage; don’t fake unread counts.

**Improve:** AgentZero auto-triage; SLA timers; call log + recordings in Vault.

---

### 4.7 Finance (`/finance`) — **currently stub route**

**Purpose:** Accounts, cash position, budgets, credit, ROI, AI money tips — full panel companion to dashboard money modules.

**UI (target):**  
- Header KPIs (liquid, debt, net)  
- Accounts table  
- Budget calendar  
- Credit meters  
- ROI / volume  
- Tips & alerts  
- Import (CSV/Plaid later)

**Features:** CRUD accounts/bills; mark paid; sync snapshot to dashboard via `financeDashSync`; Stripe route already in worker.

**Data:** Worker `/api/finance`, `/api/stripe`; Supabase `budget_bills`; replace stub `financeDashSync.ts`.

**Status:** **AppRoutes placeholder.** Dashboard modules + stub sync file exist. Migration support for bills.

**Fix:**
1. Create `pages/finance/FinancePanel.tsx` (do not delete route).
2. Implement real `financeDashSync` read/write.
3. Reuse `FinancialStats`, `BudgetExpenses`, `CreditScore`, `RoiAnalysis`, `AiMoneyTips` as sections or shared hooks.
4. Wire Worker finance routes; honest empty if no accounts.

**Improve:** Plaid/Teller; multi-currency; tax export; Shadow Budget Oracle cross-link; agent alerts on overspend.

---

### 4.8 CreatorOS1 (`/creator`)

**Purpose:** Content creation & publishing hub.

**UI:** Currently feature cards (Blog, Image, Video, Music, …) with “Ready” status labels.

**Features (target):** Drafts, asset library, schedule, publish to Social/Email, AI generate via Lucid/Omni.

**Data:** R2 uploads; social post API; local drafts in `user_data`. 

**Status:** **Wrapper shell, not full OS.** Lucid/Veriton/Omni are separate embeds.

**Fix:** Turn cards into real routes/sections; deep-link into Lucid/Veriton/Media; shared draft model.    

**Improve:** Content calendar sync with Marketing; brand kit; approval workflow with Kranos.

---

### 4.9 Community (`/community`)

**Purpose:** Audience/community management (forums, members, engagement).

**UI:** Members, posts, moderation tools (as implemented).

**Features:** CRUD members/posts; engagement metrics; link to Marketing.

**Data:** Supabase community tables or `user_data` JSON until migrated.

**Status:** **Exists (~800 lines).**

**Fix:** Persist for real; empty states; no fake member counts.

**Improve:** Discord/Slack import; AgentZero community moderator skin.


### 4.10 OmniSearchOS1 (`/omni`)

**Purpose:** Cross-platform search + live browser + agent chat for research.

**UI:** Embedded OmniSearch app — PlatformGrid, SearchModeSelector, LiveBrowser, AgentChat, ResultCard.

**Features:** Multi-platform search; image upload; live browse; agent-assisted research.

**Data:** Worker `/api/search`, `/api/browse`; provider keys via Integrations.

**Status:** **Embedded sub-app wired.** Theme isolation risk.

**Fix:** Pass LifeOS theme CSS variables into iframe/embed; auth token forward; error boundary in wrapper.

**Improve:** Save searches to Vault/Notes; handoff results to Opportunity Engine; Sentinel mode shared with Browser panel.

---

### 4.11 Social / SocialLinkOS1 (`/social`)

**Purpose:** Social publishing, inbox, analytics — SocialLink stack + LifeOS SocialPanel.

**UI:** `SocialPanel.tsx` + `SocialLink/` (Python server, kv-schema, SocialPanel.jsx).

**Features:** Connect networks; compose; schedule; analytics widgets.

**Data:** Worker `/api/social`, meta/x/youtube proxies; SocialLink backend (legacy).

**Status:** **Substantial panel + legacy SocialLink folder.** Dual stacks = confusion risk. Can be deleted if current setup works the same as the full app

**Fix:** Prefer Worker social routes; document SocialLink as optional/legacy; don’t delete folder without ask — feature-flag if unused.

**Improve:** Unified calendar with Marketing; Agent “Breeze” for replies; compliance vault for ads.

---

### 4.12 Calendar (`/calendar`)

**Purpose:** Personal/business calendar — day/week/month, event CRUD.

**UI:** Calendar views + event modal.

**Features:** CRUD events; types; sync with Google when OAuth connected.

**Data:** `calendar_events` + Worker `/api/calendar` + Google OAuth.

**Status:** **Exists (~770 lines).** Dashboard calendar module currently unused by Dashboard.tsx.

**Fix:** Share hook between CalendarPanel and `CalendarModule`; Google sync via Integrations.

**Improve:** Conflict Resolver integration; agent scheduling; travel time via Maps.

---

### 4.13 Projects (`/projects`)

**Purpose:** Project / kanban / deliverables tracker.

**UI:** Boards, lists, detail drawers.

**Features:** CRUD projects/tasks; statuses; assignees (agents or humans); files.

**Data:** Worker `/api/projects`, `/api/tasks`; Supabase.

**Status:** **Exists (~1350 lines).**

**Fix:** Link Tasks panel ↔ project tasks; avoid duplicate sources of truth. Combine the features into the Calendar

**Improve:** Gantt; GitHub issues sync (`/api/github`); Kranos execution hooks.

---

### 4.14 Agent Dock / AI Dock (`/ai-dock` + floating)

**Purpose:** Always-available FaceTime-like AI companion dock.

**UI target:** Floating avatar (talking), chat transcript, text/speech toggle, mic, file upload, skin/voice pickers, model picker, multi-agent switcher.

**Features:** See §5. STT/TTS, tools, drag position, persistence of selected agent.

**Data:** `lifeos_agents` localStorage + KV mirror; Worker LLM; ErebusCore/Kranos.

**Status:** **Two implementations** — rich `AgentDock.tsx` vs simpler `ErebusDock.tsx` (routed). `lib/agents/erebus/ui/ErebusDock.tsx` also exists (large). The Erebus Dock in lib/agents/erebus/ui is what we are using. 

**Fix:** Pick **AgentDock as canonical floating shell**; make `/ai-dock` render the same component in expanded mode; deprecate duplicate docks gradually **without deleting files** (re-export wrappers).

**Improve:** Picture-in-picture; screen share context; session memory panel; offline WebLLM path.

---

### 4.15 Erebus (AI Hub tab + core)

**Purpose:** Autonomous brain — initiation, emotion, personality, local-first tools.

**UI:** `ErebusSection` in AI Hub; `ErebusPanel.tsx` (very large); dock presence.

**Features:** InitiationEngine, EmotionManager, TriggerRegistry, PersonalityFilter; ErebusTools; local model path; memories.

**Data:** `lifeos_er_lt.facts` + agent record; Worker optional.

**Status:** **Core code exists** under `src/lib/agents/erebus/*` + hub section.

**Fix:** Health check in hub (runtime online); wire tools allowlist to permissions; ensure dock “erebus” id routes to ErebusCore not external LLM (as AgentDock comment states).

**Improve:** Do not Audit log of autonomous actions; kill switch in Topbar; No simulation mode.

---

### 4.16 Kranos (AI Hub tab + orchestrator)

**Purpose:** Execution orchestrator — plans, delegates to specialists, runs workflows.

**UI:** `KranosSection`; AgentDock avatar.

**Features:** Task graph; tool execution; handoff to AgentZero workers; browser/file workflows (as system prompt claims).

**Data:** `src/lib/agents/kranos/Kranos.ts`; Worker agents routes.

**Status:** **Code exists (~16KB Kranos.ts).** Needs production permission gates.

**Fix:** Explicit tool registry; confirm destructive tools; assignment monitor integration. Do not remove tools

**Improve:** Parallel Life Conductor uses Kranos to run scenario branches; Cloudflare Workers as executors.

---

### 4.17 AgentZero team (`/agents` → Agents / Hierarchy)

**Purpose:** Trainable multi-agent team — avatars, personalities, Cloudflare workers, Telegram bots, LLM attach.

**UI:** AgentsSection, AgentForm, HierarchySection, WorkersSection, MessagingSection, Assignments.

**Features:** CRUD agents; hierarchy (commander/primary/sub/skin); knowledge/memories/instructions; voice; messaging bridges; worker health probes; assignments.

**Data:** `lifeos_agents`, `lifeos1_aihub_*` KV/local; portraits in `/public/agents`.

**Status:** **Hub UI exists;** types well-specified; seed empty by design.

**Fix:** Seed Chris’s known roster (Zero, Inferno, Nova, Viper, Rage, Aurora, Breeze, …) from AgentDock defaults into hub storage on first run **without wiping user edits**; fix missing portrait files; Telegram bridge connect flow.

**Improve:** Training workshop UI (advanced_agent Python is largely empty stubs — either wire or quarantine); eval harness; per-agent tool permissions UI.

---

### 4.18 Marketing (`/marketing`)

**Purpose:** Campaigns, SEO, keywords, lead gen, content — growth OS.

**UI:** MarketingPanel + CampaignsTab, ContentTab, KeywordsTab, LeadGenTab, SeoTab.

**Features:** Campaign CRUD; SEO tooling; lead gen; content calendar; analytics.

**Data:** Supabase + Worker; dashboard MarketingAnalytics widget.

**Status:** **Very substantial (~2400 lines panel).**

**Fix:** Connect analytics to real sources; share leads with CRM; OAuth for ads platforms via Integrations.

**Improve:** Multi-channel attribution; Agent Inferno/Rage playbooks; budget pacing with Finance.

---

### 4.19 Family & Friends — **missing**

**Purpose:** Personal CRM for family/friends — birthdays, notes, care tasks, boundaries: PUT IN CONTACTS

**UI (target):** People grid; timeline; occasions; shared calendar; private vault links.

**Features:** CRUD people; relationship tags; reminder rules; optional private journaling links.

**Data:** New Supabase `family_people` / `family_events` or namespaced `user_data`; Add to contacts and use relationship dropdown. When famuly is selected, it will trigger a webhook for the compliment cannon. never mix into sales CRM without explicit link.

**Status:** **Missing.**

**Fix:** Add panel + route + sidebar under CORE; migration; empty state.

**Improve:** Compliment Cannon integration; Maps “visit”; no opt in.

---

### 4.20 Settings / Preferences (`/preferences`) — **stub**

**Purpose:** Theme, modules visibility, logo/banner uploads, notification prefs, AI defaults, danger zone.

**UI (target):** Sections: Profile, Appearance, Dashboard modules, Agents defaults, Privacy, Advanced.

**Features:** Theme select (constrain to crimson-phantom as default); logo/banner upload; reduced motion; data export/delete.

**Data:** `user_settings` migration already exists.

**Status:** **Placeholder page.** Migrations ready. Make it real not a placeholder

**Fix:** Build PreferencesPanel bound to `user_settings`; wire Topbar profile click (already navigates here).

**Improve:** Keyboard shortcuts map; feature flags; storage usage meter.

---

### 4.21 Terminals (`/terminal`) — **stub**

**Purpose:** In-app terminal(s) for ops — Worker logs, local commands (Electron), agent shell.

**UI (target):** Multi-tab terminal; connection selector (local/Electron/SSH later).

**Features:** xterm.js or similar; command history; agent-run output stream.

**Data:** Electron IPC when desktop; Worker log tail endpoints.

**Status:** **Placeholder.** Electron folder exists in repo.

**Fix:** Web: read-only log viewer first; Electron: real PTY. Keep route. How can this work without Electron?

**Improve:** Kranos command confirmations; session recording to Vault.

---

### 4.22 Health — **missing**

**Purpose:** Personal health tracking — vitals, meds, appointments, mood (careful, non-diagnostic).

**UI:** Dashboard widgets + full panel charts.

**Features:** CRUD metrics; reminders; export for clinician; **no medical advice framing**.

**Data:** Encrypted Vault-linked records preferred; Supabase with tight RLS.

**Status:** **Missing.**

**Fix:** New panel under CORE; store sensitive fields via Vault APIs.

**Improve:** Wearable import later; Family caregiver share links.

---

### 4.23 Integrations (`/integrations`)

**Purpose:** Catalog of LLMs, social, marketing, finance, comms, etc. — connect keys/OAuth.

**UI:** Category filters; search; status dots; credential forms.

**Features:** Save/delete credentials (Supabase); OAuth popup via `oauthConnector`; sync routes subset.

**Data:** `integrations_credentials`; Worker oauth/integrations; catalog in `integrationCatalog.ts`.

**Status:** **UI substantial;** AUDIT claims ~11/200+ live sync — treat as **UI-heavy / sync-light**.

**Fix:** Priority connect matrix (Google, GitHub, Slack, Meta, X, Spotify, Stripe, Nylas); status polling; never show “connected” without probe.

**Improve:** Per-integration permissions; secret rotation; Cloudflare tunnel status.

---

### 4.24 Office (`/office`)

**Purpose:** Docs/spreadsheets/presentations hub — TipTap already in deps.

**UI:** File list + editor panes.

**Features:** CRUD docs; export; templates; AI rewrite.

**Data:** Supabase/R2; TipTap JSON.

**Status:** **Exists (~1250 lines).**

**Fix:** Persistence verification; template gallery; link from Projects.

**Improve:** Realtime collab later; agent “draft report”.

---

### 4.25 Media (`/media`)

**Purpose:** Image/video/asset library.

**UI:** Grid + upload + tags + preview.

**Features:** Upload to R2; tag; search; send to Creator/Social.

**Data:** Worker upload/signed-url; asset metadata table.

**Status:** **Exists (~1240 lines).**

**Fix:** Signed URL flow; thumbnail generation; remove dead uploads.

**Improve:** Background removal (Runway/etc. via Integrations); brand kit.

---

### 4.26 Journal (`/journal`)

**Purpose:** Private journaling — mood, entries, streaks.

**UI:** Entry list + editor.

**Features:** CRUD; mood tags; search; optional AI reflection (opt-in).

**Data:** Supabase journal or `user_data`; encryption option via Vault.

**Status:** **Exists (~650 lines).**

**Fix:** Confirm persistence; privacy defaults locked.

**Improve:** Life Audit pulls themes; EchoPersona can train on opt-in entries only.

---

### 4.27 Legal (`/legal`)

**Purpose:** Contracts, policies, deadlines, entity docs.

**UI:** Matters list + document attachments + reminders.

**Features:** CRUD matters; deadlines → Calendar; file store in Vault.

**Data:** Supabase + Vault files.

**Status:** **Exists (~500 lines).**

**Fix:** Deadline sync to Calendar; file upload path.

**Improve:** E-sign later; agent clause summarize (non-advice disclaimer).

---

### 4.28 Opportunity Engine — **missing**

**Purpose:** Capture/score/pursue opportunities (deals, content ideas, partnerships) from OmniSearch, CRM, Social.

**UI:** Opportunity kanban; score; next actions; source links.

**Features:** CRUD; scoring model; promote to CRM deal; agent research jobs.

**Data:** New table `opportunities`; links to leads/contacts.

**Status:** **Missing.**

**Fix:** Add panel under BUSINESS; wire from OmniSearch “Save opportunity”.

**Improve:** Auto-ingest from email; Kranos chase sequences.

---

### 4.29 Business Command Center — **missing UI (DB ready)**

**Purpose:** Websites, reviews, listings, local SEO command — tables already in `0006_business_command.sql`.

**UI:** Tabs Websites / Reviews / Listings / Analytics; KPI strip.

**Features:** CRUD websites; import reviews; respond templates; listing claim status; sync timestamps.

**Data:** `business_websites`, `business_reviews`, `business_listings` (+ analytics if extended).

**Status:** **Migration exists; no panel found.**

**Fix:** Build `BusinessCommandPanel`; sidebar entry under BUSINESS; Worker CRUD routes; RLS harden.

**Improve:** Google Business API; review reply via Agent; Maps deep-link.

---

### 4.30 Insight Engine — **mostly missing**

**Purpose:** Cross-domain insights — life + business patterns, anomalies, recommendations.

**UI:** Insight feed; filters by domain; pin to Dashboard.

**Features:** Rule + LLM insights; links into source panels; dismiss/snooze.

**Data:** Activity feed + domain tables; `AiInsights` widget as v0.

**Status:** Dashboard widget exists; no full panel.

**Fix:** Promote to `/insights` panel; reuse widget; wire activity log.

**Improve:** Weekly brief email; Erebus narrative mode.

---

### 4.31 Privacy Vault (`/vault`)

**Purpose:** Encrypted secrets/files — unlock session, CRUD vault items.

**UI:** Locked gate; categories; reveal-in-memory only.

**Features:** Server-side crypto per panel header; upload; copy; never persist secrets client-side.

**Data:** Worker `/api/vault/*`.

**Status:** **Exists, Path B design (~1270 lines).**

**Fix:** Verify worker vault routes deployed; unlock UX; audit PanelLayout imports.

**Improve:** Hardware key later; secret sharing; Health/Legal attachments.

---

### 4.32 Simulators hub (`/simulators`)

**Purpose:** Sandbox life/business simulations.

**Existing sims (files):**
- AlternateLifeExplorer (currently routed)
- DarkCardGame
- DreamForgeSimulator
- EchoPersonaWeaver
- FantasyFriendSimulator
- NarrativeConflictEngine
- ShadowBudgetOracle

**Note:** Folder also contains `Firefox Installer.exe` and an `.xpi` — **quarantine/remove from app bundle in build** (ask before deleting from repo).

**UI (target):** Hub grid launching each sim; do not delete any sim file.

**Fix:** Hub index route listing all sims; nested routes; keep AlternateLifeExplorer as default.

**Improve:** Shared save slots; export scenario to Parallel Life Conductor.

---

### 4.33 EchoPersona (simulator)

**Purpose:** Weave persona echoes for creative/strategy roleplay.

**Status:** **Exists** as `EchoPersonaWeaver.tsx`.

**Fix:** List in hub; optional AgentZero skin import.

**Improve:** Export persona → AgentForm.

---

### 4.34 Narrative Conflict (simulator)

**Purpose:** Conflict narrative engine for stories/strategy stress tests.

**Status:** **Exists** as `NarrativeConflictEngine.tsx`.

**Fix:** Hub entry; separate “Conflict Resolver” ops panel can deep-link here for simulation mode.

---

### 4.35 Shadow Budget (simulator)

**Purpose:** Oracle-style budget stress scenarios.

**Status:** **Exists** as `ShadowBudgetOracle.tsx`.

**Fix:** Hub entry; “Send scenario to Finance” action.

**Improve:** Monte Carlo; link real budget_bills as baseline (opt-in).

---

### 4.36 Life Audit / Pulse — **missing**

**Purpose:** Periodic life/business audit — scores, gaps, weekly pulse.

**UI:** Scorecards; trends; recommended missions for agents.

**Features:** Manual + auto audit; history; export PDF via Office.

**Data:** Aggregates from Journal, Finance, CRM, Health, Tasks.

**Status:** **Missing.**

**Fix:** New panel; scheduled Worker cron (`worker` has cron route in architecture).

**Improve:** Erebus weekly briefing in dock.

---

### 4.37 Conflict Resolver — **missing (ops)**

**Purpose:** Real-world conflict tracker (people/deals/legal) with mediation notes — distinct from Narrative Conflict sim.

**UI:** Cases; parties; status; linked Legal/CRM.

**Status:** **Missing.**

**Fix:** New panel; don’t overwrite simulator.

**Improve:** Agent facilitator mode (human-in-loop).

---

### 4.38 Smart Browser Sentinel (`/browser`) — **stub**

**Purpose:** In-app browser with safety sentinel — phishing warnings, agent browse tools, research capture.

**UI:** URL bar; viewport; sentinel sidebar (risk, cookies, capture to Omni/Notes).

**Features:** Navigate via Worker `/api/browse` / agent-browser dep; blocklists; save clip.

**Status:** **Placeholder;** OmniSearch has `LiveBrowser`.

**Fix:** Embed shared LiveBrowser component; sentinel rules; keep route name Browser.

**Improve:** Parallel tabs; Kranos automation with confirm.

---

### 4.39 Parallel Life Conductor — **missing**

**Purpose:** Orchestrate multiple life/sim branches — compare outcomes, assign agents.

**UI:** Branch timeline; compare matrix; promote branch to real Tasks/Projects.

**Status:** **Missing.**

**Fix:** New TOOLS panel; consume simulator save slots + Kranos.

**Improve:** Visual graph; export to Insight Engine.

---

### 4.40 Life RPG — **missing**

**Purpose:** Gamified life progress — quests, XP, skills tied to real Tasks/Habits.

**UI:** Character sheet; quest log; rewards.

**Features:** Map tasks → XP; streaks; cosmetics for dock skins.

**Status:** **Missing.**

**Fix:** New panel; careful not to trivialize Health/Finance.

**Improve:** Party mode with Family; agent companions as RPG allies.

---

### 4.41 Compliment Cannon — **missing**

**Purpose:** Delight utility — send/schedule compliments to Family/Friends/Team.

**UI:** Compose; targets; schedule; history.

**Features:** Templates; Agent tone polish; delivery via Email/Comms/Telegram.

**Status:** **Missing.**

**Fix:** Lightweight panel under CORE or Community.

**Improve:** Random kindness reminders; dock one-tap.

---

### 4.42 Maps (`/maps`)

**Purpose:** Places, layers, geocode/route when API configured.

**UI:** Map canvas; saved places; search; layers.

**Features:** CRUD places; geocode/route with honest `configured:false`.

**Data:** Worker `/api/maps/*`; MAPS_API_KEY.

**Status:** **Exists (~1330 lines), Path B honest.**

**Fix:** Ensure key in worker env; dashboard quicklink to Maps.

**Improve:** CRM account locations; trip planner with Calendar.

---

### 4.43 Tasks (`/tasks`)

**Purpose:** Task list / priorities / completion.

**UI:** List, filters, priority.

**Features:** CRUD; done toggle; sync dashboard TasksModule.

**Data:** `tasks` table + Worker `/api/tasks`.

**Status:** **Exists.** Dashboard module not mounted in current Dashboard.tsx.

**Fix:** Shared hooks; mount module on home.

**Improve:** Recurrence; project link; agent assignment.

---

### 4.44 Notes (`/notes`)

**Purpose:** Quick notes capture.

**UI:** Currently reuses `NotesModule` as full page — OK short-term.

**Features:** CRUD notes; search.

**Data:** `notes` table.

**Status:** **Wired awkwardly.**

**Fix:** Promote to `NotesPanel` with Module embedded on Dashboard; keep `/notes` route.

**Improve:** TipTap; backlinks to Projects/Journal.

---

### 4.45 Leads (`/leads`) — **stub**

**Purpose:** Lead inbox before/alongside CRM.

**Fix:** Thin page wrapping CRM leads data or `LeadsModule` full-page; **do not leave forever as “Component not yet wired.”**

**Improve:** Inbound from Marketing leadgen; scoring → Opportunity Engine.

---

### 4.46 Analytics (`/analytics`) — **stub**

**Purpose:** Cross-app analytics (traffic, funnels, agent usage, finance KPIs).

**Fix:** Compose MarketingAnalytics + SocialAnalytics + finance + agent assignment metrics into `AnalyticsPanel`.

**Improve:** Custom report builder; export.

---

### 4.47 Veriton Music (`/veriton/*`)

**Purpose:** Full Veriton music sub-app embed.

**Status:** **Wrapper + nested app.**

**Fix:** Theme bridge; routing under AppLayout only (avoid duplicate Route blocks outside layout — AppRoutes currently duplicates veriton/lucid/omni/creator outside `AppLayout`).

**Improve:** Share library with Music panel.

---

### 4.48 Lucid (`/lucid/*`)

**Purpose:** Lucid Systems creative/AI sub-app.

**Status:** **Wrapper exists.**

**Fix:** Same as Veriton — single mount under layout; QueryClient conflict audit.

**Improve:** Output → Media/Creator.

---

### 4.49 AI Hub / Agents page (`/agents`)

**Purpose:** Control plane for all agent systems (see §5).

**Status:** **Exists** with 9 sections.

**Fix:** Ensure each section loads without crash boundaries firing; persist seeds; live worker probe.

**Improve:** Global kill switch; cost meter per model.

---

## 5. Agents — deep dive

### 5.1 Roles & types

| Agent | Type | Role |
|-------|------|------|
| **Erebus** | autonomous | Brain — local-first autonomy, initiation, emotion, long-term memory, tool use via ErebusTools |
| **Kranos** | autonomous / orchestrator | Plans & executes; delegates; workflows; “acts” with confirmation tiers |
| **AgentZero team** | worker / trainable | Specialists (Zero, Inferno, Nova, Viper, Rage, Aurora, Breeze, …) — personalities, avatars, LLM attach |
| **Hermes / Qwen** | model-backend | Model slots in hub until wired |
| **Cloudflare Workers** | infra | `/api/llm/invoke`, health, bridges |

`AgentType` in `aihub/types.ts`: `autonomous | worker | model-backend`.

### 5.2 Floating AI dock (FaceTime-like)

**Target UX:**
- Collapsed: circular avatar with speaking animation (`AvatarCanvas` / presence).
- Expanded: video-call-like stage, transcript, controls.
- Controls: text ↔ speech toggle, mic (STT), speaker (TTS / ElevenLabs id on agent), file upload (images/docs → context), skin picker, voice picker, model picker, agent switcher.
- Position: draggable; persist coords; Esc closes; never blocks critical CTAs (z-index discipline).

**Fix:** Unify on `AgentDock`; mount in `AppLayout` globally; `/ai-dock` = expanded. Fix missing `/agents/Erebus.png` etc. Mirror remote avatars locally.

**Improve:** Mute notifications; “push to talk”; multi-agent conference (Erebus + specialist).

### 5.3 Permissions model

| Tier | Examples | Gate |
|------|----------|------|
| **L0 Read** | Summarize dashboard, search notes | Always on if agent enabled |
| **L1 Draft** | Draft email/post/task | Always; user sends |
| **L2 Write app data** | Create task/contact | Confirm first time per session or always |
| **L3 External side effects** | Send email, social post, Telegram | Explicit confirm + Integration connected |
| **L4 Destructive** | Delete vault item, drop data, large spends | Modal confirm + typed acknowledge |
| **L5 System** | Terminal commands, browse auth’d sessions | Electron-only / disabled on web by default |

Store per-agent allowlist on `Agent` record (extend types carefully without breaking AgentDock readers).

### 5.4 Tools by agent

| Agent | Tools |
|-------|-------|
| Erebus | ErebusTools (parseAndRun), local model, memory R/W, initiation triggers, dock UI |
| Kranos | Planner, delegate to workers, browser (confirm), files, workflow runner, assignments API |
| Specialists | Domain prompts + subset: Inferno→CRM/Email drafts; Viper→analytics read; Breeze→social/comms drafts; Nova→architecture/docs; etc. |
| Worker agents | `POST /api/llm/invoke` only unless granted tools |

### 5.5 Handoff rules

1. **User → Erebus** by default for chat unless another agent selected in dock.
2. **Erebus → Kranos** when user asks to *execute* multi-step work (“run”, “deploy”, “build pipeline”).
3. **Kranos → specialist** when domain matches skills[]; pass assignment id; specialist returns artifact; Kranos reports to user.
4. **Specialist → Erebus** for memory consolidation / personality filter before final user speech.
5. **Never** specialist→external send without L3 confirm.
6. **Telegram/bridge inbound** → MessagingBridge.agentId handler → same permission tiers.
7. On failure, bubble to Erebus with error; AssignmentMonitor status `blocked`.

### 5.6 Erebus — fix + improve

**Fix:** Single core import path; dock routes autonomous; initiation UI reachable from hub; tool allowlist; tests for EmotionManager/Triggers; kill switch.

**Improve:** Presence orb on Dashboard; proactive Pulse suggestions; offline-first WebLLM.

### 5.7 Kranos — fix + improve

**Fix:** Wire AssignmentMonitor ↔ Kranos jobs; expose plan preview before L2+; worker health dependency.

**Improve:** Parallel branch runner for Conductor; retry policies; cost budgets.

### 5.8 AgentZero team — fix + improve

**Fix:** First-run seed from AVATARS defaults; AgentForm validation; hierarchy drag-drop persistence; Telegram bot token via Vault not plain localStorage; Cloudflare worker URL config.

**Improve:** Training eval sets; avatar generation pipeline; A/B personalities; shared team memory with ACL.

### 5.9 Messaging & Workers sections

**Fix:** Probe workers on interval; show lastProbe; connect Telegram with webhook to Worker; status `unknown` until probed.

**Improve:** Multi-bot; rate limits; transcript store in Vault.

### 5.10 Advanced agent Python tree

`src/lib/agents/advanced_agent/` contains many **empty** `.py` stubs and prompt JSON. **Do not delete.** Quarantine from production web build (exclude from Vite); document as research/workshop. Optional later Electron sidecar.

---

## 6. Dashboard homepage modules

Each module: intent · status · fix · improve.

| Module | Intent | Status (scan) | Fix | Improve |
|--------|--------|---------------|-----|---------|
| **Time / Weather** | Local time/date + weather | `_components/TimeDateWeather` exists; mounted | Verify geolocation/weather API key honesty | Multiple cities; calendar agenda strip |
| **Notes** | Quick notes | Component exists; **not mounted** on Dashboard | Mount `NotesModule`; sync `/notes` | Pin notes; markdown |
| **Tasks** | Today tasks | Component exists; **not mounted** | Mount `TasksModule` | Due soon badge in sidebar |
| **Leads** | Fresh leads | Component exists; **not mounted**; `/leads` stub | Mount + wire leads table | Hot lead alert → CRM |
| **Notifications** | Live alerts | Inline empty stub; component exists | Mount `NotificationsModule`; feed from activity | Per-channel mute |
| **AI task monitor** | Agent assignments live | `AgentMonitor.tsx` exists; **not mounted** | Mount; bind AI Hub assignments | Click-through to `/agents` |
| **YouTube** | Embedded player + persistence | Mounted via persistence wrapper | Verify persistence keys | Playlists; Watch Later via Google |
| **Music mini-player** | Global audio | **Local stub** “unavailable” | Use real `MusicPlayer` + MusicContext | Now-playing in Topbar |
| **Finance stats** | Balances/KPIs | Mounted `FinancialStats` | Bind to financeDashSync real data | Sparkline history |
| **ROI** | ROI & volume | Mounted `RoiAnalysis` | Remove DEMO; use marketing/finance | Segment ROI |
| **Credit meters** | Credit scores | Mounted `CreditScore` | Manual entry + Vault; no fake bureau pulls | Alerts on change |
| **Budget** | Bills/expenses | Mounted `BudgetExpenses` | CRUD → `budget_bills` | Shadow Budget link |
| **AI money tips** | LLM tips | Component exists; **not mounted** | Mount; cache tips daily | Tie to real budget gaps |
| **Insights** | AI insights | Inline unavailable; component exists | Mount `AiInsights` | Promote to Insight Engine |
| **Life hacks** | Tips feed | Component exists; **not mounted** | Mount | User-submitted hacks |
| **Social analytics** | Social KPIs | Component exists; **not mounted** | Mount; real or empty | Platform breakdown |
| **Marketing analytics** | Campaign KPIs | Component exists; **not mounted** | Mount | Compare periods |
| **7-day calendar** | Upcoming week | Inline unavailable; `CalendarModule` exists | Mount | Drag create event |
| **Browser / search** | Mini browse/search | Local stub unavailable; `BrowserArea` exists | Mount; share Omni browse | Sentinel warnings |
| **Quicklinks** | User links | Inline empty; component exists | Mount; persist links | Import bookmarks |
| **Activity feed** | Cross-app actions | Inline empty; `ActivityFeedPanel` exists | Mount panel; Worker `/api/activity` | Filter by module |

**Dashboard structural fix (single PR recommended):** Recompose `Dashboard.tsx` to import and render all `_components` modules again; keep grid layout; no removals.

---

## 7. Phased roadmap & production readiness

### Phase P0 — Stabilize (Week 1)

**Priorities:** Build, auth, worker entry, crash-free navigation.  
**Dependencies:** None.  
**Acceptance:**
- `pnpm build` / `type-check` pass (or known waived list documented).
- Single auth path (Supabase); Firebase remnants unused.
- Worker deployed from known-good entry; `/api/config` healthy.
- Every `SIDEBAR_ITEMS.href` loads without exception.

**Done means:** Chris can click every nav item on production/preview without white screens.

**Regression risks:** Auth swap logging users out — migrate sessions carefully.

### Phase P1 — Shell & theme (Week 1–2)

**Priorities:** Black canvas, crimson dots+hover light, glass, logo+banner upload, global AgentDock.  
**Dependencies:** P0.  
**Acceptance:** Visual QA checklist; logo persists; banner shows; dock on all AppLayout pages.

**Done means:** Brand-complete shell matches §2 on Dashboard + CRM + Agents.

### Phase P2 — Dashboard modules (Week 2)

**Priorities:** Re-wire all modules (§6).  
**Dependencies:** P0 storage hooks; partial P4 for live social/marketing numbers (empty OK).  
**Acceptance:** No “Music player unavailable” style stubs when components exist; persistence survives reload for notes/tasks/budget.

**Done means:** Home is useful offline/online with honest empties.

### Phase P3 — Panels one-by-one (Weeks 2–5)

**Order (priority):**
1. Preferences (unblocks logo/modules)
2. Finance, Leads, Analytics (replace placeholders)
3. Tasks/Notes/Calendar cohesion
4. Contacts → CRM → Email → Communications
5. Marketing → Social → Community
6. Projects → Office → Media → Music
7. Vault → Legal → Maps → Journal
8. Integrations deep pass
9. Simulators hub routing
10. Browser + Terminal MVP

**Acceptance per panel:** CRUD or documented read-only; empty/error honesty; no console spam; sidebar badge if applicable.

**Done means:** Zero “Component not yet wired” placeholders remain.

### Phase P4 — Integrations (parallel Weeks 3–5)

**Priority providers:** Google, GitHub, Slack, Meta, X, Spotify, Stripe, Nylas/email.  
**Acceptance:** Connect/disconnect/status for each priority; credentials not in localStorage plain text.

### Phase P5 — Agents (Weeks 4–6)

**Priorities:** Dock unify; Erebus/Kranos handoffs; AgentZero seed; messaging bridge; permissions.  
**Acceptance:** Smoke script: chat Erebus → delegate Kranos → assignment visible; Telegram optional.

### Phase P6 — Missing brief surfaces (Weeks 6–8)

Family & Friends, Health, Opportunity Engine, Business Command Center, Insight Engine, Life Audit/Pulse, Conflict Resolver, Parallel Life Conductor, Life RPG, Compliment Cannon — **add** nav entries only with pages.

### Phase P7 — Production harden (Week 8+)

- RLS policies by `auth.uid()` / user email  
- Secrets only in Worker/Vault  
- Observability (logs, error boundary reporting)  
- Electron packaging (`electron:*` scripts)  
- Remove binaries from `simulators/` in build artifacts (ask before repo delete)  
- Performance: route lazy already — audit giant panels  
- Deploy checklist from AUDIT §12  

**Production “done means” checklist:**
- [ ] Build green  
- [ ] Pages deploy + Worker deploy  
- [ ] Auth login/logout  
- [ ] Dashboard persistence verified  
- [ ] Music survives reload  
- [ ] OAuth ≥2 providers  
- [ ] Agents dock + hub functional  
- [ ] Vault unlock/create secret  
- [ ] No sidebar dead ends  
- [ ] RLS not open-to-world  
- [ ] Privacy policy / legal disclaimers where needed  

---

## 8. Regression risks & guardrails

| Risk | Mitigation |
|------|------------|
| Deleting panels during “cleanup” | **Forbidden without ask**; PR checklist item |
| Dashboard “simplification” removing modules | Hide via Preferences flags; keep code |
| Dual docks fighting z-index | One canonical mount |
| Duplicate routes outside AppLayout | Dedupe AppRoutes carefully; test Veriton/Lucid |
| Sub-app CSS breaking shell | Scope styles; don’t global-reset |
| Open RLS | P7 blocker for real PII |
| Blob URLs for audio | Base64/R2 only |
| Agent autonomous sends | L3+ confirms |
| Empty Python agent stubs imported by web | Exclude from Vite |
| Binary junk in simulators | Exclude from publish; ask before delete |
| Theme drift (`#050505` vs `#000`) | Token single source `PALETTE.black` |

**Test guardrails:** Vitest for storage/permissions; Playwright smoke for nav + dock; manual QA sheet per phase.

---

## 9. Appendix

### 9.1 Key file map

| Area | Paths |
|------|-------|
| Routes | `src/AppRoutes.tsx` |
| Sidebar | `src/components/layout/sidebar-items.ts` |
| Layout | `AppLayout.tsx`, `PanelLayout.tsx`, `Topbar.tsx`, `BannerArea.tsx`, `DotGridBackground.tsx` |
| Dashboard | `src/pages/dashboard/Dashboard.tsx`, `_components/*` |
| AI Hub | `src/pages/aihub/*` |
| Docks | `src/components/AgentDock.tsx`, `ErebusDock.tsx`, `AvatarCanvas.tsx` |
| Agent cores | `src/lib/agents/erebus/*`, `kranos/Kranos.ts`, `UnifiedAgentCore.ts` |
| Theme | `src/platform/theme/*` |
| Worker | `worker/src/routes/*` |
| Prior audit | `AUDIT_REPORT.md` |
| Architecture notes | `LifeApp.md` |

### 9.2 Counts (this blueprint)

- **Pages/panels specified:** 49 surface entries in §4 (including stubs/missing).  
- **Dashboard modules specified:** 21 rows in §6.  
- **Agent systems specified:** Erebus, Kranos, AgentZero team (+ Hermes/Qwen slots, Workers, Messaging) in §5.  
- **Simulator files recognized:** 7 TSX sims.  

### 9.3 Suggested next executor actions (after approval)

1. P0 build/auth/worker only.  
2. Dashboard recomposition PR (no removals).  
3. Preferences + logo/banner.  
4. Finance/Leads/Analytics placeholder replacements.  
5. AgentDock global mount + portrait asset fix.

---

*End of LIFEOS_FINISH_PLAN.md — living blueprint. Update status columns as phases complete; never delete panel inventory rows — mark DONE / DEFERRED.*
