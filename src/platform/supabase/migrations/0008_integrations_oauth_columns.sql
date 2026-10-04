-- Align integrations_credentials with the live LifeOS1 schema used by the OAuth worker.
-- Production already has these columns; this keeps local/docs in sync.
-- Sole local user: user_id stores the stable owner UUID (text).

ALTER TABLE integrations_credentials
  ALTER COLUMN user_id TYPE TEXT USING user_id::text;

ALTER TABLE integrations_credentials
  ADD COLUMN IF NOT EXISTS oauth_state TEXT,
  ADD COLUMN IF NOT EXISTS oauth_redirect_uri TEXT,
  ADD COLUMN IF NOT EXISTS oauth_code_verifier TEXT,
  ADD COLUMN IF NOT EXISTS oauth_id_token TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_integrations_credentials_oauth_state
  ON integrations_credentials (oauth_state)
  WHERE oauth_state IS NOT NULL;
