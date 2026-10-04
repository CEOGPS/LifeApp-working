-- ============================================================================
-- LifeOS1 — Dashboard Module Tables
-- Supports: Tasks, Notes, Calendar Events, Leads, Budget/Expenses, Notifications, Activity Feed
-- ============================================================================

-- TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'mid',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks (user_email, created_at DESC);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_all" ON tasks;
CREATE POLICY "tasks_all" ON tasks FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION tasks_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION tasks_touch_updated_at();

-- NOTES TABLE
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes (user_email, created_at DESC);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_all" ON notes;
CREATE POLICY "notes_all" ON notes FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON notes TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION notes_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION notes_touch_updated_at();

-- CALENDAR EVENTS TABLE
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  type TEXT DEFAULT 'home',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events (user_email, date);
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar_events_all" ON calendar_events;
CREATE POLICY "calendar_events_all" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_events TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION calendar_events_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION calendar_events_touch_updated_at();

-- LEADS TABLE (shared with CRM)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT,
  company TEXT,
  status TEXT DEFAULT 'Lead',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_user ON leads (user_email, created_at DESC);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_all" ON leads;
CREATE POLICY "leads_all" ON leads FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION leads_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION leads_touch_updated_at();

-- BUDGET/BILLS TABLE
CREATE TABLE IF NOT EXISTS budget_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  due_date DATE,
  paid BOOLEAN DEFAULT FALSE,
  type TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budget_bills_user ON budget_bills (user_email, created_at DESC);
ALTER TABLE budget_bills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budget_bills_all" ON budget_bills;
CREATE POLICY "budget_bills_all" ON budget_bills FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON budget_bills TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION budget_bills_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_budget_bills_updated_at ON budget_bills;
CREATE TRIGGER trg_budget_bills_updated_at BEFORE UPDATE ON budget_bills FOR EACH ROW EXECUTE FUNCTION budget_bills_touch_updated_at();

-- NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_email, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_all" ON notifications;
CREATE POLICY "notifications_all" ON notifications FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO anon, authenticated, service_role;

-- ACTIVITY FEED TABLE
CREATE TABLE IF NOT EXISTS activity_events (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  source TEXT NOT NULL,
  type TEXT,
  title TEXT NOT NULL,
  body TEXT,
  time TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events (user_email, created_at DESC);
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_events_all" ON activity_events;
CREATE POLICY "activity_events_all" ON activity_events FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_events TO anon, authenticated, service_role;

-- QUICK LINKS TABLE
CREATE TABLE IF NOT EXISTS quick_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  category TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quick_links_user ON quick_links (user_email, order_index);
ALTER TABLE quick_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quick_links_all" ON quick_links;
CREATE POLICY "quick_links_all" ON quick_links FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON quick_links TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION quick_links_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_quick_links_updated_at ON quick_links;
CREATE TRIGGER trg_quick_links_updated_at BEFORE UPDATE ON quick_links FOR EACH ROW EXECUTE FUNCTION quick_links_touch_updated_at();

-- CONTACTS TABLE (shared with CRM/Leads)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  full_name TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  birthday TEXT,
  linkedin TEXT,
  twitter TEXT,
  website TEXT,
  industry TEXT,
  revenue_range TEXT,
  employee_count TEXT,
  enriched BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts (user_email, created_at DESC);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_all" ON contacts;
CREATE POLICY "contacts_all" ON contacts FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON contacts TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION contacts_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION contacts_touch_updated_at();