---
name: lifeos1-debugging
category: lifeos1
trigger: Use when debugging LifeOS1/CEO GPS build, deployment, or routing issues
description: Captures troubleshooting patterns, build fixes, and deployment resolutions for the LifeOS1/CEO GPS project
version: 1.0.0
---

# LifeOS1 Debugging Skill

## Overview

This skill captures troubleshooting patterns, build fixes, and deployment resolutions for the LifeOS1/CEO GPS project.

## When to Use

Use this skill when encountering:

- Build failures in Vite/React/TypeScript projects
- Type declaration conflicts between interfaces and context types
- Import/export mismatches between .tsx and .jsx files
- Supabase table creation and RLS policy issues
- Cloudflare Pages deployment configuration
- Erebus agent integration conflicts
- Sidebar route-to-page component mismatches

## Common Fixes

### Build Errors

- Remove conflicting imports (e.g., Erebus agent default export)
- Fix type declaration conflicts by removing local declarations
- Fix .tsx/.jsx import path mismatches in App.tsx

### Supabase Tables

- Run `supabase/RUN_THIS_FIX.sql` in Supabase SQL Editor
- Ensure all required tables have `user_email TEXT` schema
- Set RLS policies to `USING (true)` for anon key auth

### Deployment

- Set Cloudflare Pages env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_WORKER_URL`
- Redeploy with `npx wrangler pages deploy dist --project-name=lifeos1 --commit-dirty=true`

### Sidebar/Route Issues

- Verify 42 routes in App.tsx map to page components
- Check sidebar-items.ts for missing entries
- Ensure page files exist at expected paths

## Session Signals

This skill was authored based on session errors from September 4, 2026, including:

- Erebus agent default export conflict resolving build failures
- App.tsx route import extension fixes (.tsx → .jsx)
- CRM/Contacts type declaration conflict resolutions
- Sidebar route-to-page component mapping verifications
- Environment variable configuration for Cloudflare Pages

## References

- `supabase/RUN_THIS_FIX.sql` — Full table creation script
- `src/lib/supabase.js` — Supabase configuration with env var warnings
- `src/App.tsx` — Route-to-page mapping configuration
- `src/components/layout/sidebar-items.ts` — Sidebar navigation configuration

## Templates

None currently defined

## Scripts

None currently defined
"""