-- Create contacts table to resolve foreign key dependencies in conversations
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  company TEXT,
  job_title TEXT,
  linkedin_url TEXT,
  tags TEXT[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own contacts"
  ON contacts FOR ALL
  USING (auth.uid() = user_id);
