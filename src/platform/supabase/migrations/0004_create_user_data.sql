-- ============================================================================
-- LifeOS1 — user_data persistence table
--
-- Backing table for usePersistedState hook (cross-browser sync).
-- The app uses Firebase Auth, not Supabase Auth. Browser talks to this
-- table with the Supabase "publishable/anon" key. RLS keyed to auth.uid()
-- would BLOCK every read/write. We enable RLS but grant full access to
-- anon/authenticated/service_role so the app works with Firebase auth.
-- ============================================================================

-- The exact shape usePersistedState expects:
--   id           uuid        primary key, default gen_random_uuid()
--   user_email   text        not null (Firebase user email)
--   data_key     text        not null (e.g. "lifeos_api_keys", "dashboard_accounts")
--   data_value   jsonb       not null (stores ANY app state)
--   created_at   timestamptz default now()
--   updated_at   timestamptz default now()
--   unique(user_email, data_key)
CREATE TABLE IF NOT EXISTS user_data (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   TEXT NOT NULL,
  data_key     TEXT NOT NULL,
  data_value   JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_email, data_key)
);

-- Fast lookup by user_email + data_key
CREATE INDEX IF NOT EXISTS idx_user_data_lookup ON user_data (user_email, data_key);

-- Auto-refresh updated_at on update
CREATE OR REPLACE FUNCTION user_data_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_data_touch_updated_at ON user_data;
CREATE TRIGGER trg_user_data_touch_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW
  EXECUTE FUNCTION user_data_touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- LifeOS1 authenticates with FIREBASE, not Supabase. The browser talks to this
-- table with the Supabase "publishable/anon" key, and that client has NO
-- Supabase JWT user, so RLS keyed to auth.uid()/auth.jwt() would BLOCK every
-- read/write. It is a single-user personal instance, so we enable RLS but grant
-- the app's roles full access. If you later add multiple tenants, replace this
-- with a per-user policy keyed to a real Supabase auth user.
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_data_anon_all" ON user_data;
CREATE POLICY "user_data_anon_all"
  ON user_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "user_data_authenticated_all" ON user_data;
CREATE POLICY "user_data_authenticated_all"
  ON user_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant table privileges to the roles used by the publishable/anon and secret keys
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_data TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_data TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_data TO service_role;