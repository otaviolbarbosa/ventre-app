-- Migration: convert ultrasounds.amniotic_fluid_index from numeric to enum
-- Classification based on standard AFI (Amniotic Fluid Index) clinical ranges

CREATE TYPE amniotic_fluid_index AS ENUM (
  'severe_oligohydramnios', -- < 2 cm
  'oligohydramnios',        -- 2–5 cm
  'normal',                 -- 5–25 cm
  'polyhydramnios'          -- > 25 cm
);

ALTER TABLE ultrasounds DROP COLUMN amniotic_fluid_index;

ALTER TABLE ultrasounds ADD COLUMN amniotic_fluid_index public.amniotic_fluid_index;
