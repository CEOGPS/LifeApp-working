-- LifeOS1 Complete Migration Script with 10 Additional Spots for Each Field Type
-- Run ALL of this in Supabase SQL Editor

-- ============================================================
-- 1. CONTACTS TABLE - Add all new columns including 10 additional spots
-- ============================================================
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS email2 TEXT,
ADD COLUMN IF NOT EXISTS phone2 TEXT,
-- 10 additional phone spots (formatted like primary: (###) ###-####)
ADD COLUMN IF NOT EXISTS phone3 TEXT,
ADD COLUMN IF NOT EXISTS phone4 TEXT,
ADD COLUMN IF NOT EXISTS phone5 TEXT,
ADD COLUMN IF NOT EXISTS phone6 TEXT,
ADD COLUMN IF NOT EXISTS phone7 TEXT,
ADD COLUMN IF NOT EXISTS phone8 TEXT,
ADD COLUMN IF NOT EXISTS phone9 TEXT,
ADD COLUMN IF NOT EXISTS phone10 TEXT,
ADD COLUMN IF NOT EXISTS phone11 TEXT,
ADD COLUMN IF NOT EXISTS phone12 TEXT,
-- 10 additional email spots
ADD COLUMN IF NOT EXISTS email3 TEXT,
ADD COLUMN IF NOT EXISTS email4 TEXT,
ADD COLUMN IF NOT EXISTS email5 TEXT,
ADD COLUMN IF NOT EXISTS email6 TEXT,
ADD COLUMN IF NOT EXISTS email7 TEXT,
ADD COLUMN IF NOT EXISTS email8 TEXT,
ADD COLUMN IF NOT EXISTS email9 TEXT,
ADD COLUMN IF NOT EXISTS email10 TEXT,
ADD COLUMN IF NOT EXISTS email11 TEXT,
ADD COLUMN IF NOT EXISTS email12 TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS birthday TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
-- 10 additional website spots
ADD COLUMN IF NOT EXISTS website2 TEXT,
ADD COLUMN IF NOT EXISTS website3 TEXT,
ADD COLUMN IF NOT EXISTS website4 TEXT,
ADD COLUMN IF NOT EXISTS website5 TEXT,
ADD COLUMN IF NOT EXISTS website6 TEXT,
ADD COLUMN IF NOT EXISTS website7 TEXT,
ADD COLUMN IF NOT EXISTS website8 TEXT,
ADD COLUMN IF NOT EXISTS website9 TEXT,
ADD COLUMN IF NOT EXISTS website10 TEXT,
ADD COLUMN IF NOT EXISTS website11 TEXT,
-- Social media: 10 spots per platform (Facebook, X/Twitter, Instagram, TikTok, Snapchat, WhatsApp, Telegram, Reddit, YouTube, LinkedIn)
-- Facebook (10)
ADD COLUMN IF NOT EXISTS facebook1 TEXT,
ADD COLUMN IF NOT EXISTS facebook2 TEXT,
ADD COLUMN IF NOT EXISTS facebook3 TEXT,
ADD COLUMN IF NOT EXISTS facebook4 TEXT,
ADD COLUMN IF NOT EXISTS facebook5 TEXT,
ADD COLUMN IF NOT EXISTS facebook6 TEXT,
ADD COLUMN IF NOT EXISTS facebook7 TEXT,
ADD COLUMN IF NOT EXISTS facebook8 TEXT,
ADD COLUMN IF NOT EXISTS facebook9 TEXT,
ADD COLUMN IF NOT EXISTS facebook10 TEXT,
-- X/Twitter (10)
ADD COLUMN IF NOT EXISTS twitter1 TEXT,
ADD COLUMN IF NOT EXISTS twitter2 TEXT,
ADD COLUMN IF NOT EXISTS twitter3 TEXT,
ADD COLUMN IF NOT EXISTS twitter4 TEXT,
ADD COLUMN IF NOT EXISTS twitter5 TEXT,
ADD COLUMN IF NOT EXISTS twitter6 TEXT,
ADD COLUMN IF NOT EXISTS twitter7 TEXT,
ADD COLUMN IF NOT EXISTS twitter8 TEXT,
ADD COLUMN IF NOT EXISTS twitter9 TEXT,
ADD COLUMN IF NOT EXISTS twitter10 TEXT,
-- Instagram (10)
ADD COLUMN IF NOT EXISTS instagram1 TEXT,
ADD COLUMN IF NOT EXISTS instagram2 TEXT,
ADD COLUMN IF NOT EXISTS instagram3 TEXT,
ADD COLUMN IF NOT EXISTS instagram4 TEXT,
ADD COLUMN IF NOT EXISTS instagram5 TEXT,
ADD COLUMN IF NOT EXISTS instagram6 TEXT,
ADD COLUMN IF NOT EXISTS instagram7 TEXT,
ADD COLUMN IF NOT EXISTS instagram8 TEXT,
ADD COLUMN IF NOT EXISTS instagram9 TEXT,
ADD COLUMN IF NOT EXISTS instagram10 TEXT,
-- TikTok (10)
ADD COLUMN IF NOT EXISTS tiktok1 TEXT,
ADD COLUMN IF NOT EXISTS tiktok2 TEXT,
ADD COLUMN IF NOT EXISTS tiktok3 TEXT,
ADD COLUMN IF NOT EXISTS tiktok4 TEXT,
ADD COLUMN IF NOT EXISTS tiktok5 TEXT,
ADD COLUMN IF NOT EXISTS tiktok6 TEXT,
ADD COLUMN IF NOT EXISTS tiktok7 TEXT,
ADD COLUMN IF NOT EXISTS tiktok8 TEXT,
ADD COLUMN IF NOT EXISTS tiktok9 TEXT,
ADD COLUMN IF NOT EXISTS tiktok10 TEXT,
-- Snapchat (10)
ADD COLUMN IF NOT EXISTS snapchat1 TEXT,
ADD COLUMN IF NOT EXISTS snapchat2 TEXT,
ADD COLUMN IF NOT EXISTS snapchat3 TEXT,
ADD COLUMN IF NOT EXISTS snapchat4 TEXT,
ADD COLUMN IF NOT EXISTS snapchat5 TEXT,
ADD COLUMN IF NOT EXISTS snapchat6 TEXT,
ADD COLUMN IF NOT EXISTS snapchat7 TEXT,
ADD COLUMN IF NOT EXISTS snapchat8 TEXT,
ADD COLUMN IF NOT EXISTS snapchat9 TEXT,
ADD COLUMN IF NOT EXISTS snapchat10 TEXT,
-- WhatsApp (10)
ADD COLUMN IF NOT EXISTS whatsapp1 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp2 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp3 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp4 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp5 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp6 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp7 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp8 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp9 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp10 TEXT,
-- Telegram (10)
ADD COLUMN IF NOT EXISTS telegram1 TEXT,
ADD COLUMN IF NOT EXISTS telegram2 TEXT,
ADD COLUMN IF NOT EXISTS telegram3 TEXT,
ADD COLUMN IF NOT EXISTS telegram4 TEXT,
ADD COLUMN IF NOT EXISTS telegram5 TEXT,
ADD COLUMN IF NOT EXISTS telegram6 TEXT,
ADD COLUMN IF NOT EXISTS telegram7 TEXT,
ADD COLUMN IF NOT EXISTS telegram8 TEXT,
ADD COLUMN IF NOT EXISTS telegram9 TEXT,
ADD COLUMN IF NOT EXISTS telegram10 TEXT,
-- Reddit (10)
ADD COLUMN IF NOT EXISTS reddit1 TEXT,
ADD COLUMN IF NOT EXISTS reddit2 TEXT,
ADD COLUMN IF NOT EXISTS reddit3 TEXT,
ADD COLUMN IF NOT EXISTS reddit4 TEXT,
ADD COLUMN IF NOT EXISTS reddit5 TEXT,
ADD COLUMN IF NOT EXISTS reddit6 TEXT,
ADD COLUMN IF NOT EXISTS reddit7 TEXT,
ADD COLUMN IF NOT EXISTS reddit8 TEXT,
ADD COLUMN IF NOT EXISTS reddit9 TEXT,
ADD COLUMN IF NOT EXISTS reddit10 TEXT,
-- YouTube (10)
ADD COLUMN IF NOT EXISTS youtube1 TEXT,
ADD COLUMN IF NOT EXISTS youtube2 TEXT,
ADD COLUMN IF NOT EXISTS youtube3 TEXT,
ADD COLUMN IF NOT EXISTS youtube4 TEXT,
ADD COLUMN IF NOT EXISTS youtube5 TEXT,
ADD COLUMN IF NOT EXISTS youtube6 TEXT,
ADD COLUMN IF NOT EXISTS youtube7 TEXT,
ADD COLUMN IF NOT EXISTS youtube8 TEXT,
ADD COLUMN IF NOT EXISTS youtube9 TEXT,
ADD COLUMN IF NOT EXISTS youtube10 TEXT,
-- LinkedIn (10)
ADD COLUMN IF NOT EXISTS linkedin1 TEXT,
ADD COLUMN IF NOT EXISTS linkedin2 TEXT,
ADD COLUMN IF NOT EXISTS linkedin3 TEXT,
ADD COLUMN IF NOT EXISTS linkedin4 TEXT,
ADD COLUMN IF NOT EXISTS linkedin5 TEXT,
ADD COLUMN IF NOT EXISTS linkedin6 TEXT,
ADD COLUMN IF NOT EXISTS linkedin7 TEXT,
ADD COLUMN IF NOT EXISTS linkedin8 TEXT,
ADD COLUMN IF NOT EXISTS linkedin9 TEXT,
ADD COLUMN IF NOT EXISTS linkedin10 TEXT,
-- Address fields
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS zip TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS note TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS photo TEXT,
ADD COLUMN IF NOT EXISTS socials JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS addresses JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_contact TEXT,
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS linkedin TEXT,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS location TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_email);
CREATE INDEX IF NOT EXISTS idx_contacts_first_name ON contacts(first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_last_name ON contacts(last_name);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- RLS: Permissive for anon key (since app uses anon key, not JWT)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON contacts;
CREATE POLICY "Allow all operations for anon" ON contacts
FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON contacts TO anon;
GRANT ALL ON contacts TO authenticated;

-- ============================================================
-- 2. CRM_CONTACTS TABLE - Add new columns with 10 additional spots
-- ============================================================
ALTER TABLE crm_contacts
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
-- 10 additional phone spots
ADD COLUMN IF NOT EXISTS phone3 TEXT,
ADD COLUMN IF NOT EXISTS phone4 TEXT,
ADD COLUMN IF NOT EXISTS phone5 TEXT,
ADD COLUMN IF NOT EXISTS phone6 TEXT,
ADD COLUMN IF NOT EXISTS phone7 TEXT,
ADD COLUMN IF NOT EXISTS phone8 TEXT,
ADD COLUMN IF NOT EXISTS phone9 TEXT,
ADD COLUMN IF NOT EXISTS phone10 TEXT,
ADD COLUMN IF NOT EXISTS phone11 TEXT,
ADD COLUMN IF NOT EXISTS phone12 TEXT,
-- 10 additional email spots
ADD COLUMN IF NOT EXISTS email3 TEXT,
ADD COLUMN IF NOT EXISTS email4 TEXT,
ADD COLUMN IF NOT EXISTS email5 TEXT,
ADD COLUMN IF NOT EXISTS email6 TEXT,
ADD COLUMN IF NOT EXISTS email7 TEXT,
ADD COLUMN IF NOT EXISTS email8 TEXT,
ADD COLUMN IF NOT EXISTS email9 TEXT,
ADD COLUMN IF NOT EXISTS email10 TEXT,
ADD COLUMN IF NOT EXISTS email11 TEXT,
ADD COLUMN IF NOT EXISTS email12 TEXT,
-- 10 additional website spots
ADD COLUMN IF NOT EXISTS website2 TEXT,
ADD COLUMN IF NOT EXISTS website3 TEXT,
ADD COLUMN IF NOT EXISTS website4 TEXT,
ADD COLUMN IF NOT EXISTS website5 TEXT,
ADD COLUMN IF NOT EXISTS website6 TEXT,
ADD COLUMN IF NOT EXISTS website7 TEXT,
ADD COLUMN IF NOT EXISTS website8 TEXT,
ADD COLUMN IF NOT EXISTS website9 TEXT,
ADD COLUMN IF NOT EXISTS website10 TEXT,
ADD COLUMN IF NOT EXISTS website11 TEXT,
-- Social media: 10 spots per platform
-- Facebook (10)
ADD COLUMN IF NOT EXISTS facebook1 TEXT,
ADD COLUMN IF NOT EXISTS facebook2 TEXT,
ADD COLUMN IF NOT EXISTS facebook3 TEXT,
ADD COLUMN IF NOT EXISTS facebook4 TEXT,
ADD COLUMN IF NOT EXISTS facebook5 TEXT,
ADD COLUMN IF NOT EXISTS facebook6 TEXT,
ADD COLUMN IF NOT EXISTS facebook7 TEXT,
ADD COLUMN IF NOT EXISTS facebook8 TEXT,
ADD COLUMN IF NOT EXISTS facebook9 TEXT,
ADD COLUMN IF NOT EXISTS facebook10 TEXT,
-- X/Twitter (10)
ADD COLUMN IF NOT EXISTS twitter1 TEXT,
ADD COLUMN IF NOT EXISTS twitter2 TEXT,
ADD COLUMN IF NOT EXISTS twitter3 TEXT,
ADD COLUMN IF NOT EXISTS twitter4 TEXT,
ADD COLUMN IF NOT EXISTS twitter5 TEXT,
ADD COLUMN IF NOT EXISTS twitter6 TEXT,
ADD COLUMN IF NOT EXISTS twitter7 TEXT,
ADD COLUMN IF NOT EXISTS twitter8 TEXT,
ADD COLUMN IF NOT EXISTS twitter9 TEXT,
ADD COLUMN IF NOT EXISTS twitter10 TEXT,
-- Instagram (10)
ADD COLUMN IF NOT EXISTS instagram1 TEXT,
ADD COLUMN IF NOT EXISTS instagram2 TEXT,
ADD COLUMN IF NOT EXISTS instagram3 TEXT,
ADD COLUMN IF NOT EXISTS instagram4 TEXT,
ADD COLUMN IF NOT EXISTS instagram5 TEXT,
ADD COLUMN IF NOT EXISTS instagram6 TEXT,
ADD COLUMN IF NOT EXISTS instagram7 TEXT,
ADD COLUMN IF NOT EXISTS instagram8 TEXT,
ADD COLUMN IF NOT EXISTS instagram9 TEXT,
ADD COLUMN IF NOT EXISTS instagram10 TEXT,
-- TikTok (10)
ADD COLUMN IF NOT EXISTS tiktok1 TEXT,
ADD COLUMN IF NOT EXISTS tiktok2 TEXT,
ADD COLUMN IF NOT EXISTS tiktok3 TEXT,
ADD COLUMN IF NOT EXISTS tiktok4 TEXT,
ADD COLUMN IF NOT EXISTS tiktok5 TEXT,
ADD COLUMN IF NOT EXISTS tiktok6 TEXT,
ADD COLUMN IF NOT EXISTS tiktok7 TEXT,
ADD COLUMN IF NOT EXISTS tiktok8 TEXT,
ADD COLUMN IF NOT EXISTS tiktok9 TEXT,
ADD COLUMN IF NOT EXISTS tiktok10 TEXT,
-- Snapchat (10)
ADD COLUMN IF NOT EXISTS snapchat1 TEXT,
ADD COLUMN IF NOT EXISTS snapchat2 TEXT,
ADD COLUMN IF NOT EXISTS snapchat3 TEXT,
ADD COLUMN IF NOT EXISTS snapchat4 TEXT,
ADD COLUMN IF NOT EXISTS snapchat5 TEXT,
ADD COLUMN IF NOT EXISTS snapchat6 TEXT,
ADD COLUMN IF NOT EXISTS snapchat7 TEXT,
ADD COLUMN IF NOT EXISTS snapchat8 TEXT,
ADD COLUMN IF NOT EXISTS snapchat9 TEXT,
ADD COLUMN IF NOT EXISTS snapchat10 TEXT,
-- WhatsApp (10)
ADD COLUMN IF NOT EXISTS whatsapp1 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp2 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp3 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp4 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp5 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp6 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp7 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp8 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp9 TEXT,
ADD COLUMN IF NOT EXISTS whatsapp10 TEXT,
-- Telegram (10)
ADD COLUMN IF NOT EXISTS telegram1 TEXT,
ADD COLUMN IF NOT EXISTS telegram2 TEXT,
ADD COLUMN IF NOT EXISTS telegram3 TEXT,
ADD COLUMN IF NOT EXISTS telegram4 TEXT,
ADD COLUMN IF NOT EXISTS telegram5 TEXT,
ADD COLUMN IF NOT EXISTS telegram6 TEXT,
ADD COLUMN IF NOT EXISTS telegram7 TEXT,
ADD COLUMN IF NOT EXISTS telegram8 TEXT,
ADD COLUMN IF NOT EXISTS telegram9 TEXT,
ADD COLUMN IF NOT EXISTS telegram10 TEXT,
-- Reddit (10)
ADD COLUMN IF NOT EXISTS reddit1 TEXT,
ADD COLUMN IF NOT EXISTS reddit2 TEXT,
ADD COLUMN IF NOT EXISTS reddit3 TEXT,
ADD COLUMN IF NOT EXISTS reddit4 TEXT,
ADD COLUMN IF NOT EXISTS reddit5 TEXT,
ADD COLUMN IF NOT EXISTS reddit6 TEXT,
ADD COLUMN IF NOT EXISTS reddit7 TEXT,
ADD COLUMN IF NOT EXISTS reddit8 TEXT,
ADD COLUMN IF NOT EXISTS reddit9 TEXT,
ADD COLUMN IF NOT EXISTS reddit10 TEXT,
-- YouTube (10)
ADD COLUMN IF NOT EXISTS youtube1 TEXT,
ADD COLUMN IF NOT EXISTS youtube2 TEXT,
ADD COLUMN IF NOT EXISTS youtube3 TEXT,
ADD COLUMN IF NOT EXISTS youtube4 TEXT,
ADD COLUMN IF NOT EXISTS youtube5 TEXT,
ADD COLUMN IF NOT EXISTS youtube6 TEXT,
ADD COLUMN IF NOT EXISTS youtube7 TEXT,
ADD COLUMN IF NOT EXISTS youtube8 TEXT,
ADD COLUMN IF NOT EXISTS youtube9 TEXT,
ADD COLUMN IF NOT EXISTS youtube10 TEXT,
-- LinkedIn (10)
ADD COLUMN IF NOT EXISTS linkedin1 TEXT,
ADD COLUMN IF NOT EXISTS linkedin2 TEXT,
ADD COLUMN IF NOT EXISTS linkedin3 TEXT,
ADD COLUMN IF NOT EXISTS linkedin4 TEXT,
ADD COLUMN IF NOT EXISTS linkedin5 TEXT,
ADD COLUMN IF NOT EXISTS linkedin6 TEXT,
ADD COLUMN IF NOT EXISTS linkedin7 TEXT,
ADD COLUMN IF NOT EXISTS linkedin8 TEXT,
ADD COLUMN IF NOT EXISTS linkedin9 TEXT,
ADD COLUMN IF NOT EXISTS linkedin10 TEXT,
ADD COLUMN IF NOT EXISTS extra_phones TEXT[],
ADD COLUMN IF NOT EXISTS extra_emails TEXT[],
ADD COLUMN IF NOT EXISTS birthday TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS last_contact TEXT,
ADD COLUMN IF NOT EXISTS socials JSONB DEFAULT '{}';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crm_user_email ON crm_contacts(user_email);
CREATE INDEX IF NOT EXISTS idx_crm_first_name ON crm_contacts(first_name);
CREATE INDEX IF NOT EXISTS idx_crm_last_name ON crm_contacts(last_name);
CREATE INDEX IF NOT EXISTS idx_crm_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_company ON crm_contacts(company);
CREATE INDEX IF NOT EXISTS idx_crm_stage ON crm_contacts(stage);
CREATE INDEX IF NOT EXISTS idx_crm_tag ON crm_contacts(tag);
CREATE INDEX IF NOT EXISTS idx_crm_created_at ON crm_contacts(created_at DESC);

-- RLS: Permissive for anon key
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON crm_contacts;
CREATE POLICY "Allow all operations for anon" ON crm_contacts
FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON crm_contacts TO anon;
GRANT ALL ON crm_contacts TO authenticated;

-- ============================================================
-- 3. USER_SETTINGS TABLE - For persistent memory
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, key)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON user_settings;
CREATE POLICY "Allow all operations for anon" ON user_settings
FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_user_settings_email ON user_settings(user_email);
GRANT ALL ON user_settings TO anon;
GRANT ALL ON user_settings TO authenticated;

-- ============================================================
-- 4. USER_DATA TABLE - Existing table fix
-- ============================================================
CREATE TABLE IF NOT EXISTS user_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  data_key TEXT NOT NULL,
  data_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, data_key)
);

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON user_data;
CREATE POLICY "Allow all operations for anon" ON user_data
FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_user_data_email ON user_data(user_email);
GRANT ALL ON user_data TO anon;
GRANT ALL ON user_data TO authenticated;

-- ============================================================
-- 5. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON notifications;
CREATE POLICY "Allow all operations for anon" ON notifications
FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(user_email);
GRANT ALL ON notifications TO anon;
GRANT ALL ON notifications TO authenticated;

-- ============================================================
-- 6. TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  completed BOOLEAN DEFAULT FALSE,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON tasks;
CREATE POLICY "Allow all operations for anon" ON tasks
FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_tasks_email ON tasks(user_email);
GRANT ALL ON tasks TO anon;
GRANT ALL ON tasks TO authenticated;

-- ============================================================
-- 7. EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT FALSE,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON events;
CREATE POLICY "Allow all operations for anon" ON events
FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_events_email ON events(user_email);
GRANT ALL ON events TO anon;
GRANT ALL ON events TO authenticated;

-- ============================================================
-- 8. NOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT[],
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON notes;
CREATE POLICY "Allow all operations for anon" ON notes
FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_notes_email ON notes(user_email);
GRANT ALL ON notes TO anon;
GRANT ALL ON notes TO authenticated;

-- ============================================================
-- 9. LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT,
  status TEXT DEFAULT 'new',
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for anon" ON leads;
CREATE POLICY "Allow all operations for anon" ON leads
FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(user_email);
GRANT ALL ON leads TO anon;
GRANT ALL ON leads TO authenticated;

-- ============================================================
-- DONE - Verify tables exist
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('contacts', 'crm_contacts', 'user_settings', 'user_data', 'notifications', 'tasks', 'events', 'notes', 'leads')
ORDER BY table_name;