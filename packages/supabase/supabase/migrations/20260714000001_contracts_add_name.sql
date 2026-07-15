-- Human-readable label for a base contract template, letting an owner
-- (professional or enterprise) distinguish between multiple saved templates.
ALTER TABLE public.contracts
  ADD COLUMN name text;
