CREATE TYPE public.birth_pain_intensity AS ENUM ('fraca', 'fraca_media', 'media', 'media_forte', 'forte');

ALTER TABLE public.birth_contractions
  ADD COLUMN pain_intensity public.birth_pain_intensity;
