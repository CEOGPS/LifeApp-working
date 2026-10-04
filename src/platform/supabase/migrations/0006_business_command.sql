-- ============================================================================
-- LifeOS1 — Business Command Tables
-- Supports: Websites, Reviews, Analytics, Leads, Listings
-- ============================================================================

-- BUSINESS WEBSITES TABLE
CREATE TABLE IF NOT EXISTS business_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  platform TEXT, -- WordPress, GoDaddy, Brilliant Directories, Custom, etc.
  status TEXT DEFAULT 'connected',
  api_key TEXT,
  api_secret TEXT,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_websites_user ON business_websites (user_email, created_at DESC);
ALTER TABLE business_websites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_websites_all" ON business_websites;
CREATE POLICY "business_websites_all" ON business_websites FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON business_websites TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION business_websites_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_business_websites_updated_at ON business_websites;
CREATE TRIGGER trg_business_websites_updated_at BEFORE UPDATE ON business_websites FOR EACH ROW EXECUTE FUNCTION business_websites_touch_updated_at();

-- BUSINESS REVIEWS TABLE
CREATE TABLE IF NOT EXISTS business_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  platform TEXT NOT NULL, -- Google Reviews, Yelp, Facebook, YP.com, BBB, Brilliant Directories
  external_id TEXT, -- Platform's review ID
  author_name TEXT,
  rating INT, -- 1-5
  content TEXT,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  review_date TIMESTAMPTZ,
  status TEXT DEFAULT 'new', -- new, responded, flagged
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_reviews_user ON business_reviews (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_reviews_platform ON business_reviews (platform);
ALTER TABLE business_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_reviews_all" ON business_reviews;
CREATE POLICY "business_reviews_all" ON business_reviews FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON business_reviews TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION business_reviews_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_business_reviews_updated_at ON business_reviews;
CREATE TRIGGER trg_business_reviews_updated_at BEFORE UPDATE ON business_reviews FOR EACH ROW EXECUTE FUNCTION business_reviews_touch_updated_at();

-- BUSINESS LISTINGS TABLE
CREATE TABLE IF NOT EXISTS business_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  platform TEXT NOT NULL, -- Google Business, Yelp, YP.com, Alignable, ShowMeLocal, Nextdoor, Facebook, LinkedIn, Bing Places, Apple Maps, Yahoo Local, Angi
  listing_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, claimed, verified, syncing, error
  external_id TEXT,
  business_name TEXT,
  address TEXT,
  phone TEXT,
  website TEXT,
  hours JSONB, -- Opening hours per day
  last_verified TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_listings_user ON business_listings (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_listings_platform ON business_listings (platform);
ALTER TABLE business_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_listings_all" ON business_listings;
CREATE POLICY "business_listings_all" ON business_listings FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON business_listings TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION business_listings_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_business_listings_updated_at ON business_listings;
CREATE TRIGGER trg_business_listings_updated_at BEFORE UPDATE ON business_listings FOR EACH ROW EXECUTE FUNCTION business_listings_touch_updated_at();

-- BUSINESS ANALYTICS TABLE (aggregated metrics snapshots)
CREATE TABLE IF NOT EXISTS business_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  website_id UUID REFERENCES business_websites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  visitors INT DEFAULT 0,
  pageviews INT DEFAULT 0,
  leads INT DEFAULT 0,
  conversions INT DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2),
  avg_session_duration INT, -- seconds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(website_id, date)
);
CREATE INDEX IF NOT EXISTS idx_business_analytics_user_date ON business_analytics (user_email, date DESC);
ALTER TABLE business_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_analytics_all" ON business_analytics;
CREATE POLICY "business_analytics_all" ON business_analytics FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON business_analytics TO anon, authenticated, service_role;

-- BUSINESS LEADS TABLE (specific to business command panel)
CREATE TABLE IF NOT EXISTS business_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT, -- website, referral, organic, paid, social, listing
  status TEXT DEFAULT 'new', -- new, contacted, qualified, proposal, closed_won, closed_lost
  value DECIMAL(12,2),
  notes TEXT,
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_leads_user ON business_leads (user_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_leads_status ON business_leads (status);
ALTER TABLE business_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_leads_all" ON business_leads;
CREATE POLICY "business_leads_all" ON business_leads FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON business_leads TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION business_leads_touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_business_leads_updated_at ON business_leads;
CREATE TRIGGER trg_business_leads_updated_at BEFORE UPDATE ON business_leads FOR EACH ROW EXECUTE FUNCTION business_leads_touch_updated_at();