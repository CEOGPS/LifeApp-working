Repo: D:\dev\LifeApp
Live: master.lifeos1.pages.dev

Task: Complete the integrations and OAuth system end to end, built
around Nexus Connect (the OAuth/credentials broker I already created
for this purpose).

Nexus Connect is the single place all integrations route through. Find
it in the repo first (search for "nexus" case-insensitive across src,
the Worker, and config). Report its location, its API surface, and
what's already implemented vs stubbed before touching anything.

Reference files:
- Nexus Connect — locate it, this is the entry point for everything below
- src/pages/integrations/ — integrations UI
- src/lib/oauth.ts, src/platform/integrations/oauthConnector.ts
- src/lib/integrationsSupabase.ts, src/platform/integrations/integrationsSupabase.ts
- supabase migration: integrations_credentials table
- Worker: wherever /api/* is served

Requirements:

1. Nexus Connect as the hub
- All OAuth and API-key flows go through Nexus Connect. No provider
  bypasses it.
- It owns: provider registry, client IDs/secrets, state + PKCE,
  token exchange, refresh, revoke, and credential read/write.
- UI panels never touch tokens directly — they ask Nexus Connect for
  data.

2. OAuth flow
- Click connect → Nexus Connect → provider consent → callback →
  tokens stored → status connected.
- Handle state param, PKCE, refresh, expiry, revoke/disconnect.
- Callback route reachable on the live domain.

3. API key flow
- Enter key → Nexus Connect validates against provider → stores
  encrypted → status connected.
- Encrypted at rest, never plaintext.

4. Credentials storage
- integrations_credentials table. Confirm Nexus Connect writes match
  the schema. Add missing columns via migration if needed.
- Scoped per user_email (Firebase auth, matching existing RLS pattern).

5. Provider coverage
- Wire every provider in the integrations panel through Nexus Connect.
- No "coming soon". If a provider can't be wired, remove it — don't
  fake it.

6. Token usage
- Panels pull provider data through Nexus Connect. Confirm at least one
  panel per category works end to end.

7. Disconnect
- Revokes at provider and deletes stored credential, through Nexus
  Connect.

Rules:
- Find Nexus Connect and report its current state before editing.
- Read and report before each step.
- One provider at a time. Confirm connected + data flows before next.
- No fake connect buttons. If it doesn't work, it's not done.
- Full-file rewrites over diffs.
- Do not change theme, router type, or import style.
- If a provider's OAuth needs a secret you don't have, stop and ask.