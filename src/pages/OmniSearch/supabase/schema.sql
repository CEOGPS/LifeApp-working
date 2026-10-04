-- LifeOS Omni Search Agent — Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Search Sessions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_search_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'text' CHECK (mode IN ('text', 'email', 'phone', 'image')),
  results_count INTEGER DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  platforms_queried INTEGER DEFAULT 0,
  duplicates_filtered INTEGER DEFAULT 0,
  status TEXT DEFAULT 'complete',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Search Results (normalized for querying) ───────────────────
CREATE TABLE IF NOT EXISTS omni_search_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES omni_search_sessions(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT,
  snippet TEXT,
  url TEXT,
  confidence REAL DEFAULT 0.5,
  is_duplicate BOOLEAN DEFAULT FALSE,
  duplicate_of UUID REFERENCES omni_search_results(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Platform Registry ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_search_platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('social', 'dating', 'search', 'listing', 'llm')),
  color TEXT,
  icon TEXT,
  search_url_template TEXT,
  supports_email BOOLEAN DEFAULT FALSE,
  supports_phone BOOLEAN DEFAULT FALSE,
  supports_image BOOLEAN DEFAULT FALSE,
  supports_text BOOLEAN DEFAULT TRUE,
  embeddable BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Agent Configurations ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ollama', 'cloudflare', 'free-llm', 'telegram')),
  model TEXT NOT NULL,
  endpoint TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── OAuth Tokens ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS omni_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_search_sessions_user ON omni_search_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_search_sessions_created ON omni_search_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_sessions_mode ON omni_search_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_search_results_session ON omni_search_results(session_id);
CREATE INDEX IF NOT EXISTS idx_search_results_platform ON omni_search_results(platform_id);
CREATE INDEX IF NOT EXISTS idx_search_platforms_category ON omni_search_platforms(category);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON omni_oauth_tokens(user_id, provider);

-- ── Row Level Security ─────────────────────────────────────────
ALTER TABLE omni_search_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Public read/write for platform registry
ALTER TABLE omni_search_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platforms are readable by all" ON omni_search_platforms FOR SELECT USING (true);

-- User-scoped policies
CREATE POLICY "Users can CRUD own sessions" ON omni_search_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own results" ON omni_search_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM omni_search_sessions
      WHERE id = session_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can CRUD own agent configs" ON omni_agent_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own OAuth tokens" ON omni_oauth_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Updated_at trigger ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_search_sessions_updated
  BEFORE UPDATE ON omni_search_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_agent_configs_updated
  BEFORE UPDATE ON omni_agent_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_oauth_tokens_updated
  BEFORE UPDATE ON omni_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
