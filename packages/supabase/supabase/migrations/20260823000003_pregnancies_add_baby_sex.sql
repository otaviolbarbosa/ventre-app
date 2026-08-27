CREATE TYPE baby_sex AS ENUM ('masculino', 'feminino');

ALTER TABLE pregnancies
  ADD COLUMN baby_sex baby_sex NULL;
