-- Add new user_type values for enterprise roles
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_type ADD VALUE IF NOT EXISTS 'secretary';

-- Create enterprises table
CREATE TABLE enterprises (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  legal_name text,
  cnpj text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  zipcode text,
  email text,
  phone text,
  whatsapp text,
  token char(5) NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Add enterprise_id foreign key to users
ALTER TABLE users ADD COLUMN enterprise_id uuid REFERENCES enterprises(id) ON DELETE SET NULL;

-- Enable RLS on enterprises
ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read enterprises (needed for token lookup during onboarding)
CREATE POLICY "authenticated_read_enterprises"
  ON enterprises
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can manage enterprises
CREATE POLICY "service_role_manage_enterprises"
  ON enterprises
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant table access
GRANT SELECT ON enterprises TO authenticated;
GRANT ALL ON enterprises TO service_role;
