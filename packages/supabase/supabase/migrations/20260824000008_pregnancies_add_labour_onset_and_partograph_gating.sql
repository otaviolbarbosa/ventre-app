CREATE TYPE birth_mode_labour_type AS ENUM ('espontaneo', 'induzido');

CREATE TYPE birth_mode_induction_type AS ENUM ('balao', 'misoprostol', 'ocitocina');

ALTER TABLE pregnancies
  ADD COLUMN birth_mode_labour_type birth_mode_labour_type NULL,
  ADD COLUMN birth_mode_induction_type birth_mode_induction_type NULL,
  ADD COLUMN labour_start_description text NULL,
  ADD COLUMN partograph_unlocked_at timestamptz NULL;
