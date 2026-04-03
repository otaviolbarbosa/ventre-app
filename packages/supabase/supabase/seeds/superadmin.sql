-- Seed: superadmin
--
-- Pré-requisito: crie o usuário admin pelo Supabase Dashboard antes de rodar este seed.
--   Authentication → Users → Add user → Create new user
--   Email: admin@ventre.app
--   Senha: password123 (altere após o primeiro login)
--
-- Este seed apenas promove o usuário criado para user_type = 'admin'.

UPDATE public.users
SET user_type = 'admin'
WHERE email = 'admin@ventre.app'
  AND user_type != 'admin';
