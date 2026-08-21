ALTER TABLE public.pregnancies REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.pregnancies;
