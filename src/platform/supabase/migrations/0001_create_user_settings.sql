-- ============================================================================
-- LifeOS1 — contacts table (Firebase-compatible)
-- Migration 0002
--
-- Backing table for the Contacts panel + CRM panel.
--
-- IMPORTANT: LifeOS1 authenticates with FIREBASE, not Supabase Auth. The
-- browser talks to this table with the Supabase anon/publishable key, and that
-- client has NO Supabase JWT user. RLS keyed to auth.uid() would BLOCK every
-- read/write. We enable RLS but grant full access to anon/authenticated/
-- service_role. It is a single-user personal instance.
--
-- Idempotent: safe to re-run. Creates the table if missing and adds any
-- missing columns (including the 10-spot phone/email/website/social columns).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create table if missing (minimal shape; columns added below)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Add every column the app expects (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE contacts
  -- Identity
  ADD COLUMN IF NOT EXISTS full_name      TEXT,
  ADD COLUMN IF NOT EXISTS first_name     TEXT,
  ADD COLUMN IF NOT EXISTS last_name      TEXT,

  -- Core contact info
  ADD COLUMN IF NOT EXISTS email          TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS company        TEXT,
  ADD COLUMN IF NOT EXISTS job_title      TEXT,
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS role           TEXT,
  ADD COLUMN IF NOT EXISTS position       TEXT,

  -- Address
  ADD COLUMN IF NOT EXISTS address        TEXT,
  ADD COLUMN IF NOT EXISTS street         TEXT,
  ADD COLUMN IF NOT EXISTS city           TEXT,
  ADD COLUMN IF NOT EXISTS state          TEXT,
  ADD COLUMN IF NOT EXISTS zip            TEXT,
  ADD COLUMN IF NOT EXISTS location       TEXT,

  -- Dates
  ADD COLUMN IF NOT EXISTS birthday       TEXT,
  ADD COLUMN IF NOT EXISTS anniversary    TEXT,
  ADD COLUMN IF NOT EXISTS last_contact   TEXT,

  -- Notes / meta
  ADD COLUMN IF NOT EXISTS notes          TEXT,
  ADD COLUMN IF NOT EXISTS note           TEXT,
  ADD COLUMN IF NOT EXISTS relationship   TEXT,
  ADD COLUMN IF NOT EXISTS tags           TEXT[],
  ADD COLUMN IF NOT EXISTS color          TEXT,
  ADD COLUMN IF NOT EXISTS photo          TEXT,

  -- Business / enrichment
  ADD COLUMN IF NOT EXISTS industry       TEXT,
  ADD COLUMN IF NOT EXISTS revenue_range  TEXT,
  ADD COLUMN IF NOT EXISTS employee_count TEXT,
  ADD COLUMN IF NOT EXISTS enriched       BOOLEAN DEFAULT FALSE,

  -- JSONB blobs
  ADD COLUMN IF NOT EXISTS socials        JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS addresses      JSONB DEFAULT '{}',

  -- Email / phone extras (2–12)
  ADD COLUMN IF NOT EXISTS email2         TEXT,
  ADD COLUMN IF NOT EXISTS email3         TEXT,
  ADD COLUMN IF NOT EXISTS email4         TEXT,
  ADD COLUMN IF NOT EXISTS email5         TEXT,
  ADD COLUMN IF NOT EXISTS email6         TEXT,
  ADD COLUMN IF NOT EXISTS email7         TEXT,
  ADD COLUMN IF NOT EXISTS email8         TEXT,
  ADD COLUMN IF NOT EXISTS email9         TEXT,
  ADD COLUMN IF NOT EXISTS email10        TEXT,
  ADD COLUMN IF NOT EXISTS email11        TEXT,
  ADD COLUMN IF NOT EXISTS email12        TEXT,

  ADD COLUMN IF NOT EXISTS phone2         TEXT,
  ADD COLUMN IF NOT EXISTS phone3         TEXT,
  ADD COLUMN IF NOT EXISTS phone4         TEXT,
  ADD COLUMN IF NOT EXISTS phone5         TEXT,
  ADD COLUMN IF NOT EXISTS phone6         TEXT,
  ADD COLUMN IF NOT EXISTS phone7         TEXT,
  ADD COLUMN IF NOT EXISTS phone8         TEXT,
  ADD COLUMN IF NOT EXISTS phone9         TEXT,
  ADD COLUMN IF NOT EXISTS phone10        TEXT,
  ADD COLUMN IF NOT EXISTS phone11        TEXT,
  ADD COLUMN IF NOT EXISTS phone12        TEXT,

  -- Websites (1–11)
  ADD COLUMN IF NOT EXISTS website        TEXT,
  ADD COLUMN IF NOT EXISTS website2       TEXT,
  ADD COLUMN IF NOT EXISTS website3       TEXT,
  ADD COLUMN IF NOT EXISTS website4       TEXT,
  ADD COLUMN IF NOT EXISTS website5       TEXT,
  ADD COLUMN IF NOT EXISTS website6       TEXT,
  ADD COLUMN IF NOT EXISTS website7       TEXT,
  ADD COLUMN IF NOT EXISTS website8       TEXT,
  ADD COLUMN IF NOT EXISTS website9       TEXT,
  ADD COLUMN IF NOT EXISTS website10      TEXT,
  ADD COLUMN IF NOT EXISTS website11      TEXT,

  -- Legacy array columns (kept for compatibility with older code paths)
  ADD COLUMN IF NOT EXISTS extra_phones   TEXT[],
  ADD COLUMN IF NOT EXISTS extra_emails   TEXT[],
  ADD COLUMN IF NOT EXISTS extra_websites TEXT[],

  -- Social platforms (10 spots each)
  -- Facebook
  ADD COLUMN IF NOT EXISTS facebook1      TEXT,
  ADD COLUMN IF NOT EXISTS facebook2      TEXT,
  ADD COLUMN IF NOT EXISTS facebook3      TEXT,
  ADD COLUMN IF NOT EXISTS facebook4      TEXT,
  ADD COLUMN IF NOT EXISTS facebook5      TEXT,
  ADD COLUMN IF NOT EXISTS facebook6      TEXT,
  ADD COLUMN IF NOT EXISTS facebook7      TEXT,
  ADD COLUMN IF NOT EXISTS facebook8      TEXT,
  ADD COLUMN IF NOT EXISTS facebook9      TEXT,
  ADD COLUMN IF NOT EXISTS facebook10     TEXT,

  -- X / Twitter
  ADD COLUMN IF NOT EXISTS twitter1       TEXT,
  ADD COLUMN IF NOT EXISTS twitter2       TEXT,
  ADD COLUMN IF NOT EXISTS twitter3       TEXT,
  ADD COLUMN IF NOT EXISTS twitter4       TEXT,
  ADD COLUMN IF NOT EXISTS twitter5       TEXT,
  ADD COLUMN IF NOT EXISTS twitter6       TEXT,
  ADD COLUMN IF NOT EXISTS twitter7       TEXT,
  ADD COLUMN IF NOT EXISTS twitter8       TEXT,
  ADD COLUMN IF NOT EXISTS twitter9       TEXT,
  ADD COLUMN IF NOT EXISTS twitter10      TEXT,

  -- Instagram
  ADD COLUMN IF NOT EXISTS instagram1     TEXT,
  ADD COLUMN IF NOT EXISTS instagram2     TEXT,
  ADD COLUMN IF NOT EXISTS instagram3     TEXT,
  ADD COLUMN IF NOT EXISTS instagram4     TEXT,
  ADD COLUMN IF NOT EXISTS instagram5     TEXT,
  ADD COLUMN IF NOT EXISTS instagram6     TEXT,
  ADD COLUMN IF NOT EXISTS instagram7     TEXT,
  ADD COLUMN IF NOT EXISTS instagram8     TEXT,
  ADD COLUMN IF NOT EXISTS instagram9     TEXT,
  ADD COLUMN IF NOT EXISTS instagram10    TEXT,

  -- TikTok
  ADD COLUMN IF NOT EXISTS tiktok1        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok2        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok3        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok4        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok5        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok6        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok7        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok8        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok9        TEXT,
  ADD COLUMN IF NOT EXISTS tiktok10       TEXT,

  -- Snapchat
  ADD COLUMN IF NOT EXISTS snapchat1      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat2      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat3      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat4      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat5      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat6      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat7      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat8      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat9      TEXT,
  ADD COLUMN IF NOT EXISTS snapchat10     TEXT,

  -- WhatsApp
  ADD COLUMN IF NOT EXISTS whatsapp1      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp2      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp3      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp4      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp5      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp6      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp7      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp8      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp9      TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp10     TEXT,

  -- Telegram
  ADD COLUMN IF NOT EXISTS telegram1      TEXT,
  ADD COLUMN IF NOT EXISTS telegram2      TEXT,
  ADD COLUMN IF NOT EXISTS telegram3      TEXT,
  ADD COLUMN IF NOT EXISTS telegram4      TEXT,
  ADD COLUMN IF NOT EXISTS telegram5      TEXT,
  ADD COLUMN IF NOT EXISTS telegram6      TEXT,
  ADD COLUMN IF NOT EXISTS telegram7      TEXT,
  ADD COLUMN IF NOT EXISTS telegram8      TEXT,
  ADD COLUMN IF NOT EXISTS telegram9      TEXT,
  ADD COLUMN IF NOT EXISTS telegram10     TEXT,

  -- Reddit
  ADD COLUMN IF NOT EXISTS reddit1        TEXT,
  ADD COLUMN IF NOT EXISTS reddit2        TEXT,
  ADD COLUMN IF NOT EXISTS reddit3        TEXT,
  ADD COLUMN IF NOT EXISTS reddit4        TEXT,
  ADD COLUMN IF NOT EXISTS reddit5        TEXT,
  ADD COLUMN IF NOT EXISTS reddit6        TEXT,
  ADD COLUMN IF NOT EXISTS reddit7        TEXT,
  ADD COLUMN IF NOT EXISTS reddit8        TEXT,
  ADD COLUMN IF NOT EXISTS reddit9        TEXT,
  ADD COLUMN IF NOT EXISTS reddit10       TEXT,

  -- YouTube
  ADD COLUMN IF NOT EXISTS youtube1       TEXT,
  ADD COLUMN IF NOT EXISTS youtube2       TEXT,
  ADD COLUMN IF NOT EXISTS youtube3       TEXT,
  ADD COLUMN IF NOT EXISTS youtube4       TEXT,
  ADD COLUMN IF NOT EXISTS youtube5       TEXT,
  ADD COLUMN IF NOT EXISTS youtube6       TEXT,
  ADD COLUMN IF NOT EXISTS youtube7       TEXT,
  ADD COLUMN IF NOT EXISTS youtube8       TEXT,
  ADD COLUMN IF NOT EXISTS youtube9       TEXT,
  ADD COLUMN IF NOT EXISTS youtube10      TEXT,

  -- LinkedIn (1–10)
  ADD COLUMN IF NOT EXISTS linkedin1      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin2      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin3      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin4      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin5      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin6      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin7      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin8      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin9      TEXT,
  ADD COLUMN IF NOT EXISTS linkedin10     TEXT,

  -- Legacy single-column socials (kept for older code)
  ADD COLUMN IF NOT EXISTS linkedin       TEXT,
  ADD COLUMN IF NOT EXISTS twitter        TEXT,
  ADD COLUMN IF NOT EXISTS instagram      TEXT,
  ADD COLUMN IF NOT EXISTS facebook       TEXT;

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contacts_user_email     ON contacts (user_email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at     ON contacts (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_name           ON contacts (last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_full_name      ON contacts (full_name);
CREATE INDEX IF NOT EXISTS idx_contacts_email          ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_company        ON contacts (company);
CREATE INDEX IF NOT EXISTS idx_contacts_enriched       ON contacts (user_email, enriched);

-- ---------------------------------------------------------------------------
-- 4. Auto-refresh updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION contacts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION contacts_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS — permissive (Firebase auth, anon key)
-- ---------------------------------------------------------------------------
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_all" ON contacts;
CREATE POLICY "contacts_all"
  ON contacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations for anon" ON contacts;
CREATE POLICY "Allow all operations for anon"
  ON contacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contacts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contacts TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Verify
-- ---------------------------------------------------------------------------
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'contacts'
-- ORDER BY ordinal_position;