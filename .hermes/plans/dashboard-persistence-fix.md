# Dashboard Persistence Fix Plan

## Problem Analysis

**Issues identified:**
1. Dashboard modules use local `load()`/`save()` functions that only persist to localStorage
2. Logo upload uses `usePersistentState` but may not be properly connected to user auth
3. Data doesn't survive cache clears, browser switches, or device changes

**Root cause:** Dashboard panels bypass the unified `usePersistentState` hook that provides cloud-first persistence with Supabase sync.

## Tasks

### Task 1: Audit all dashboard module state usage
- [ ] Scan dashboard_DashboardPanel.jsx for all `load()`/`save()` calls
- [ ] Identify each state key and its data type
- [ ] Map which modules need persistence migration

### Task 2: Create usePersistentState migration wrapper for dashboard
- [ ] Add `usePersistentState` import to dashboard_DashboardPanel.jsx
- [ ] Replace each `load(key, fallback)` / `save(key, value)` pair with `usePersistentState`
- [ ] Ensure proper typing for each persisted value

### Task 3: Migrate specific dashboard modules
- [ ] Financial Stats (accounts, products, budget items, finance institutions)
- [ ] Calendar/Events
- [ ] Notes
- [ ] Tasks
- [ ] Leads
- [ ] Quick Links
- [ ] AI Money Tips
- [ ] AI Insights
- [ ] Life Hacks
- [ ] Social Analytics
- [ ] Marketing Analytics
- [ ] Browser Area
- [ ] YouTube Player
- [ ] Music Player

### Task 4: Fix logo upload persistence
- [ ] Verify Topbar logo uses `usePersistentState` correctly
- [ ] Ensure logo persists per-user (not global)
- [ ] Test logo upload survives logout/login

### Task 5: Verify cross-device persistence
- [ ] Test localStorage fallback works when Supabase unavailable
- [ ] Test Supabase sync works when online
- [ ] Test data survives cache clear

### Task 6: Run build and deploy
- [ ] pnpm run build
- [ ] npx wrangler pages deploy
- [ ] Verify live at master.lifeos1.pages.dev