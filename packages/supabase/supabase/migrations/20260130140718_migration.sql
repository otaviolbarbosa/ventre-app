-- Make professional_type nullable in team_invites table
ALTER TABLE team_invites ALTER COLUMN professional_type DROP NOT NULL;