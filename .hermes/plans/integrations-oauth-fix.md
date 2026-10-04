# Integrations Panel & OAuth Fix Plan

## Problem Analysis

**Current State:**
- IntegrationsPanel.jsx uses localStorage (`lifeos1_accounts_v3`) for account storage
- OAuth flows in worker.js have provider configs but need env vars
- Worker.js has all OAuth handlers but missing KV namespace binding
- No multi-account support per provider (single `oauth_${provider}` key)
- Connection status checking uses live verification but may have token refresh issues

**Required Fixes:**
1. Migrate IntegrationsPanel to use `usePersistentState` for cross-device sync
2. Add multi-account support in worker KV (index per provider)
3. Configure all OAuth provider credentials in Cloudflare Workers secrets
4. Fix token refresh and validation flows
5. Deploy worker with proper KV namespace and R2 bucket bindings
6. Test all integrations end-to-end

## Tasks

### Task 1: Migrate IntegrationsPanel to usePersistentState
- [ ] Replace localStorage load/save with usePersistentState
- [ ] Add multi-account support per integration
- [ ] Update handler functions to use setValue

### Task 2: Fix Worker Multi-Account OAuth Storage
- [ ] Update worker to use indexed storage per provider per account
- [ ] Add oauth_index_${provider} for multi-account support
- [ ] Fix token refresh to work per-account

### Task 3: Configure Cloudflare Worker Secrets
- [ ] Set all OAuth client IDs/secrets as Worker secrets
- [ ] Set API keys for AI services
- [ ] Set Supabase service key
- [ ] Configure KV namespace binding
- [ ] Configure R2 bucket binding

### Task 4: Deploy Worker with Bindings
- [ ] Update wrangler.toml with KV namespace
- [ ] Add R2 bucket binding
- [ ] Deploy worker
- [ ] Verify all endpoints work

### Task 5: Test All Integrations End-to-End
- [ ] Test OAuth flows for each provider
- [ ] Test API key validation
- [ ] Test connection status accuracy
- [ ] Test multi-account switching
- [ ] Test data fetching (Stripe, Cloudflare, etc.)

### Task 6: Update Frontend to Use Worker APIs
- [ ] Update IntegrationsPanel to call worker for account storage
- [ ] Remove localStorage dependency
- [ ] Sync with worker KV on mount