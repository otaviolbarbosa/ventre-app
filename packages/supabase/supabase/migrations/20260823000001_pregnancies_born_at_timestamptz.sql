ALTER TABLE pregnancies
  ALTER COLUMN born_at TYPE timestamptz USING born_at::timestamptz;
