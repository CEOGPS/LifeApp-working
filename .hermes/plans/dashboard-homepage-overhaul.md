# Dashboard Homepage Complete Overhaul Plan

## Current State Analysis

**DashboardPanel.jsx** (1658 lines) has:
- 20+ modules in a CSS grid layout
- Uses `usePersistentState` for 9 modules (notes, products, budget, finance, links, hacks, playlists, previous notes)
- Still uses raw `localStorage` `load()`/`save()` for calendar events (`WEEK_KEY`)
- Tasks, leads, social, activity, aiTips use `useState` (NOT persistent)
- YouTube Player searches but doesn't persist video ID
- Music Hub shows playlists but doesn't play
- Weather uses basic emoji icons
- AI tips generated once on mount, not daily
- Life hacks are hardcoded fallback
- Activity feed only loads 5 items from KV
- No activity logging for user actions
- Credit scores are hardcoded
- Browser area is just iframe with no search integration

## Phase 1: Persistence & Data Layer (All modules persistent)

### 1.1 Migrate ALL state to usePersistentState
- [ ] Calendar events (`lifeos_dash_week_events`)
- [ ] Tasks (`lifeos_dash_tasks`) - sync with `tasks_queue` KV
- [ ] Leads (`lifeos_dash_leads`) - sync with CRM panel
- [ ] Social stats (`lifeos_dash_social`) - from worker APIs
- [ ] Activity feed (`lifeos_dash_activity`) - append-only log
- [ ] AI tips (`lifeos_dash_ai_tips`) - with timestamp for daily refresh
- [ ] Life hacks (`lifeos_dash_hacks`) - already persistent but need daily refresh
- [ ] Credit scores (`lifeos_dash_credit`) - pull from credit panel
- [ ] YouTube video ID (`lifeos_dash_yt_video`) - persist current video
- [ ] Banner image (already in KV via banner_pic)

### 1.2 Create unified data fetchers
- [ ] `fetchFinanceData()` - from FinancePanel data
- [ ] `fetchSocialData()` - from worker APIs
- [ ] `fetchCalendarData()` - from CalendarPanel
- [ ] `fetchMusicData()` - from MusicHub
- [ ] `fetchAgentData()` - from AgentPanel

### 1.3 Activity logging system
- [ ] `logActivity(type, source, payload)` function
- [ ] Auto-log on: budget add/delete, note save, task add/complete, link add, lead add, playlist play, etc.
- [ ] Persist to `lifeos_dash_activity` with timestamps

## Phase 2: YouTube Player - Full Embedded Experience

### 2.1 Persistent YouTube Player
- [ ] Persist `videoId` to `lifeos_dash_yt_video`
- [ ] Persist search history to `lifeos_dash_yt_searches`
- [ ] Player only stops on manual stop button (not page navigation)
- [ ] Keep iframe alive across Suspense boundaries using ref

### 2.2 Search & Play Functions
- [ ] Real YouTube Data API v3 search
- [ ] Results in scrollable sidebar
- [ ] Click to play loads in same iframe
- [ ] Video info display (title, channel, duration)

## Phase 3: Music Player - Playlists from Music Hub

### 3.1 Music Hub Integration
- [ ] Fetch playlists from MusicHub panel data
- [ ] Persist current playlist + track index
- [ ] Play/pause/next/prev controls
- [ ] Volume control
- [ ] Track progress bar

## Phase 4: Visual Polish - Weather Icons & Typography

### 4.1 Weather Module
- [ ] Use real weather icons (SVG set: sunny, cloudy, rain, storm, snow, fog)
- [ ] Larger text (time 56px, date 16px, weather 16px)
- [ ] Lighter font weights for readability
- [ ] Better contrast ratios

### 4.2 Global Typography
- [ ] Increase base font sizes across all modules
- [ ] Better line-height (1.5)
- [ ] Clearer hierarchy: labels 11px, values 14-16px, headers 13px

## Phase 5: Calendar - Pull from CalendarPanel

### 5.1 Calendar Data Sync
- [ ] Read events from CalendarPanel's data store
- [ ] Show events on weekly calendar
- [ ] Click event → navigate to CalendarPanel
- [ ] Two-way sync: add event on dashboard → appears in CalendarPanel

## Phase 6: Dynamic Content - Daily Refresh

### 6.1 AI Money Making Tips
- [ ] Store with `generated_at` timestamp
- [ ] Auto-refresh at midnight (check on mount)
- [ ] Context-aware prompts using real business data
- [ ] Fallback to cached if API fails

### 6.2 Life Hacks
- [ ] Store with `generated_at` timestamp  
- [ ] Daily rotation from curated list + AI generation
- [ ] User can save favorites

### 6.3 AI Insights
- [ ] Pull from InsightsPanel
- [ ] Show latest 3 insights
- [ ] Auto-refresh daily

## Phase 7: Activity Feed - Universal Logger

### 7.1 Activity Sources
- [ ] User actions (clicks, saves, creates, deletes)
- [ ] AI actions (tip generation, insight creation)
- [ ] System updates (data sync, OAuth connects)
- [ ] Finance changes (budget, balances, credit)
- [ ] Communications (emails, messages)
- [ ] Calendar events
- [ ] Leads/CRM changes

### 7.2 Activity Display
- [ ] Real-time prepend to feed
- [ ] Group by date
- [ ] Filter by source/type
- [ ] Persist last 100 activities

## Phase 8: AI Monitor - From Agent Panel

### 8.1 Agent Status Display
- [ ] Show active agents from AgentPanel
- [ ] Current task/status per agent
- [ ] Last action timestamp
- [ ] Connect to ErebusDock

## Phase 9: Finance Modules - Unified Data

### 9.1 Data Sources
- [ ] Budget → FinancePanel budget data
- [ ] ROI → FinancePanel revenue data
- [ ] Finance → FinancePanel institution balances
- [ ] Credit → CreditPanel scores

## Phase 10: Social Media Module - From SocialLinkPanel

### 10.1 Social Data
- [ ] Pull connected accounts from IntegrationsPanel
- [ ] Show live stats from worker APIs
- [ ] Navigate to SocialPanel for management

## Phase 11: Browser - OmniSearch Extension

### 11.1 Browser Integration
- [ ] Embedded iframe browser
- [ ] OmniSearch input in header
- [ ] Results in small popup window (400x600)
- [ ] Click result → opens in browser iframe

## Phase 12: Notifications - Universal Aggregator

### 12.1 Notification Sources
- [ ] Emails (from email integrations)
- [ ] Communications (Slack, Discord, etc.)
- [ ] Finance alerts (low balance, large transactions)
- [ ] Community (birthdays, events from CRM)
- [ ] Leads (new leads, stage changes)
- [ ] System (OAuth expires, API failures)

### 12.2 Notification Display
- [ ] Bell icon with count badge
- [ ] Dropdown with grouped notifications
- [ ] Mark as read / dismiss
- [ ] Persist to `lifeos_dash_notifications`

---

## Implementation Order

1. **Phase 1** - Persistence layer (foundation)
2. **Phase 4** - Typography/Weather (quick visual wins)
3. **Phase 2** - YouTube Player (high value)
4. **Phase 3** - Music Player
5. **Phase 5** - Calendar sync
6. **Phase 6** - Daily refresh content
7. **Phase 7** - Activity feed
8. **Phase 8** - AI Monitor
9. **Phase 9** - Finance unification
10. **Phase 10** - Social module
11. **Phase 11** - Browser/OmniSearch
12. **Phase 12** - Notifications

---

## Key Technical Decisions

1. **All state in usePersistentState** - single source of truth
2. **Activity log is append-only** - never loses history
3. **Daily refresh at midnight** - check `generated_at` on mount
4. **Worker APIs for external data** - no direct API calls from frontend
4. **Suspense boundaries** - keep YouTube/Music players alive
5. **CSS variables for theming** - no hardcoded colors