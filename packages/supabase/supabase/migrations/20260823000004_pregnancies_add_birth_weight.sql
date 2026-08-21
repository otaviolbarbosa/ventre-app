ALTER TABLE pregnancies
  ADD COLUMN birth_weight_grams integer NULL
    CHECK (birth_weight_grams IS NULL OR birth_weight_grams > 0);
