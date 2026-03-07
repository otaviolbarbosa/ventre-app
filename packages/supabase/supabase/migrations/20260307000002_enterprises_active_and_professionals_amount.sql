-- Add is_active and professionals_amount columns to enterprises table
ALTER TABLE enterprises
  ADD COLUMN is_active boolean NOT NULL DEFAULT false,
  ADD COLUMN professionals_amount integer NOT NULL DEFAULT 5;
