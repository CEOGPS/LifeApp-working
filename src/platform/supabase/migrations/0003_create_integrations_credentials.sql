-- ============================================================================
-- INTEGRATIONS CREDENTIALS TABLE
-- Persistent storage for API keys, OAuth tokens, account configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS integrations_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_name TEXT NOT NULL,
  email TEXT,
  username TEXT,
  password TEXT,
  api_key TEXT,
  status TEXT DEFAULT 'off',
  label TEXT,
  color TEXT,
  icon TEXT,
  oauth_provider TEXT,
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMPTZ,
  oauth_scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_name, email)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_integrations_credentials_user
  ON integrations_credentials (user_id, integration_name);

CREATE INDEX IF NOT EXISTS idx_integrations_credentials_email
  ON integrations_credentials (user_id, email);

-- Enable Row Level Security
ALTER TABLE integrations_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies - LifeOS1 uses Firebase Auth, not Supabase Auth.
-- The browser talks to this table with the Supabase "publishable/anon" key,
-- and that client has NO Supabase JWT user, so RLS keyed to auth.uid()
-- would BLOCK every read/write. We enable RLS but grant full access to
-- anon/authenticated/service_role so the app works with Firebase auth.
DROP POLICY IF EXISTS "integrations_credentials_anon_all" ON integrations_credentials;
CREATE POLICY "integrations_credentials_anon_all"
  ON integrations_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "integrations_credentials_authenticated_all" ON integrations_credentials;
CREATE POLICY "integrations_credentials_authenticated_all"
  ON integrations_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant table privileges to the roles used by the publishable/anon and secret keys
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integrations_credentials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integrations_credentials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE integrations_credentials TO service_role;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_integrations_credentials_updated_at ON integrations_credentials;
CREATE TRIGGER update_integrations_credentials_updated_at
  BEFORE UPDATE ON integrations_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();