CREATE TYPE delivery_method AS ENUM ('cesarean', 'vaginal');

ALTER TABLE pregnancies
  ADD COLUMN delivery_method delivery_method NULL;
