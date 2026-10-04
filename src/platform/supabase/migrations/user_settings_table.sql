-- LifeOS1 User Settings Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, key)
);

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Permissive policy for anon key
CREATE POLICY "Allow all operations for anon" ON user_settings
FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);

-- Grant permissions
GRANT ALL ON user_settings TO anon;
GRANT ALL ON user_settings TO authenticated;