-- Seed gerada em 2026-02-05T17:49:08.115Z
-- Senha padrão para todos os usuários: password123

-- Limpar dados existentes (exceto o usuário doula)
DELETE FROM public.team_members WHERE professional_id != '6e80c9bc-4fd5-4ac5-962f-508781843d06';
DELETE FROM public.patients;
DELETE FROM public.users WHERE id != '6e80c9bc-4fd5-4ac5-962f-508781843d06';
DELETE FROM auth.users WHERE id != '6e80c9bc-4fd5-4ac5-962f-508781843d06';

-- ==========================================
-- OBSTETRAS (10)
-- ==========================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'd38ef9e9-6acb-4c2c-9626-c192f94f56c3',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1001@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Aline Macedo", "professional_type": "obstetra", "phone": "(41) 15612-7803"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'bc0d5873-15c9-4760-9bc4-5cd2599ef2ee',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1002@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Maria Luiza Xavier", "professional_type": "obstetra", "phone": "(61) 61967-9856"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a6bf730a-d92e-4e1e-99dd-db6df8d85dd8',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1003@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Morgana Macedo", "professional_type": "obstetra", "phone": "(61) 21716-2181"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a82bc4bd-65f8-4d32-a119-82b366a858d1',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1004@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Lorraine Batista", "professional_type": "obstetra", "phone": "(81) 95625-5333"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '564fd105-aac4-44e8-a7b0-a6cdd539fd38',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1005@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Maria Júlia Reis", "professional_type": "obstetra", "phone": "(51) 53867-7106"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '4b2dc116-c938-4f31-9eb2-eddcde4bb0f4',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1006@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Maria Luiza Santos", "professional_type": "obstetra", "phone": "(31) 05273-7092"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '3f3ea351-a58e-487d-97ed-878a746a207a',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1007@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Célia Nogueira", "professional_type": "obstetra", "phone": "(81) 47111-3578"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '8fd85b40-2623-40f4-a602-0b4ab3361ff6',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1008@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Sophia Franco", "professional_type": "obstetra", "phone": "(31) 22138-3302"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '508adef3-f9ba-4cb6-ad6a-e39b0c794f44',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1009@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Márcia Saraiva", "professional_type": "obstetra", "phone": "(85) 15031-1786"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '921b81b3-6b4e-4cbd-9e60-d69233a3616e',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+mo1010@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Dra. Larissa Reis", "professional_type": "obstetra", "phone": "(31) 41781-2941"}',
  false,
  ''
);

-- ==========================================
-- ENFERMEIRAS OBSTÉTRICAS (10)
-- ==========================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '1aad4a63-ccab-4de3-b38f-4fcdeea0743c',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1001@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Isabela Xavier", "professional_type": "enfermeiro", "phone": "(81) 42122-2918"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '4f915cb9-42de-4a1a-8376-a06e5e8341fb',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1002@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Maria Clara Moraes", "professional_type": "enfermeiro", "phone": "(85) 72689-4181"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'b20d6d27-189a-446f-8acf-6e64c977f009',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1003@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Maria Saraiva", "professional_type": "enfermeiro", "phone": "(71) 44131-2133"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '60ab0ee5-b100-4437-bdcb-9579e30a884e',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1004@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Lorena Xavier", "professional_type": "enfermeiro", "phone": "(71) 05071-4934"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '89d59189-b26a-4607-9f63-9ff6fce57be7',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1005@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Ana Júlia Macedo", "professional_type": "enfermeiro", "phone": "(71) 41582-9434"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '048f3663-870a-4948-a811-d8ffebe56361',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1006@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Marcela Barros", "professional_type": "enfermeiro", "phone": "(51) 97599-1791"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'd7a48a7b-6bee-482b-97f3-9d12d112a1f0',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1007@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Paula Saraiva", "professional_type": "enfermeiro", "phone": "(41) 42442-1034"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '152ba2cd-42b6-4cdc-ab6e-6e361ce88e66',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1008@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Margarida Reis", "professional_type": "enfermeiro", "phone": "(51) 17886-4814"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '44aa13ce-02dd-481f-a95a-46c4291d7dad',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1009@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Janaína Batista", "professional_type": "enfermeiro", "phone": "(11) 01874-7372"}',
  false,
  ''
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '9e52130f-eb83-439c-a054-abd8970ecee3',
  'authenticated',
  'authenticated',
  'otavioblbarbosa+eo1010@gmail.com',
  '$2a$10$PwPOoWRZB1pN7FJIArtlf.3K5L2HIhuBK5j9oBXJ2YU8zv9YFqsHO',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '2026-02-05T17:49:08.115Z',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Enf. Melissa Souza", "professional_type": "enfermeiro", "phone": "(21) 98266-2840"}',
  false,
  ''
);

-- ==========================================
-- GESTANTES (25)
-- ==========================================

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '964beea0-7013-46f5-b81f-32f52ecb5525',
  'Rebeca Silva',
  'otavioblbarbosa+ge2501@gmail.com',
  '(81) 43187-2595',
  '2005-10-02',
  '2026-03-30',
  '2025-06-23',
  '2848 Rua Rafaela, Moraes de Nossa Senhora - AP',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '12c2d748-8452-4475-8ffb-ccaf181bc84b',
  'Célia Souza',
  'otavioblbarbosa+ge2502@gmail.com',
  '(41) 47864-1792',
  '2005-03-16',
  '2026-07-06',
  '2025-09-29',
  '14636 Rodovia Yuri, Júlio César do Norte - TO',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '55065b33-6c22-4c7b-aeeb-ffb75fd82942',
  'Melissa Macedo',
  'otavioblbarbosa+ge2503@gmail.com',
  '(81) 77777-8678',
  '1991-10-01',
  '2026-06-24',
  '2025-09-17',
  '21160 Travessa Gael, Xavier do Norte - PE',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  'f1764dfe-4f04-4aa3-be63-1129a7ebf972',
  'Larissa Nogueira',
  'otavioblbarbosa+ge2504@gmail.com',
  '(85) 72623-4733',
  '1990-05-13',
  '2026-09-27',
  '2025-12-21',
  '46099 Travessa Anthony, Matheus do Descoberto - PB',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  'a20672c2-fed0-42d8-ad54-02c483a24772',
  'Márcia Macedo',
  'otavioblbarbosa+ge2505@gmail.com',
  '(81) 55046-8762',
  '2004-05-03',
  '2026-03-26',
  '2025-06-19',
  '4575 Marginal Macedo, Souza do Norte - PA',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '48c99aae-e1ea-4739-8d81-aa3115cd36dd',
  'Fabrícia Pereira',
  'otavioblbarbosa+ge2506@gmail.com',
  '(51) 33472-0718',
  '2007-12-30',
  '2026-08-05',
  '2025-10-29',
  '47195 Avenida Pedro Henrique, Martins do Norte - MA',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '427d4d4d-6506-4d64-940c-ab6fb011a975',
  'Núbia Braga',
  'otavioblbarbosa+ge2507@gmail.com',
  '(71) 43569-5241',
  '2006-12-22',
  '2026-11-05',
  '2026-01-29',
  '694 Marginal Oliveira, Murilo do Sul - RO',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '464002ef-73b5-48b9-b280-06fc482c81e4',
  'Helena Batista',
  'otavioblbarbosa+ge2508@gmail.com',
  '(62) 72395-8744',
  '1994-12-13',
  '2026-09-12',
  '2025-12-06',
  '363 Alameda Morgana, Vitória do Norte - AM',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '3fb4b89d-80b4-4fef-8f61-015599e88003',
  'Marli Silva',
  'otavioblbarbosa+ge2509@gmail.com',
  '(41) 75587-9586',
  '2007-08-07',
  '2026-08-28',
  '2025-11-21',
  '302 Alameda Melissa, Warley do Descoberto - DF',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  'cdbdde77-e1a6-4106-8306-5fe9fad5ee67',
  'Lavínia Nogueira',
  'otavioblbarbosa+ge2510@gmail.com',
  '(51) 01772-7199',
  '1991-08-16',
  '2026-03-17',
  '2025-06-10',
  '6698 Alameda Noah, Leonardo do Norte - SP',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  'd6a22362-dc18-4970-993b-3322e2bccfe4',
  'Lara Saraiva',
  'otavioblbarbosa+ge2511@gmail.com',
  '(61) 62298-4395',
  '2003-08-14',
  '2026-06-16',
  '2025-09-09',
  '34180 Rodovia Frederico, Costa do Sul - SC',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '3013ed90-098b-4275-b086-4c38c41256e2',
  'Maria Alice Moreira',
  'otavioblbarbosa+ge2512@gmail.com',
  '(21) 04479-8044',
  '1993-07-07',
  '2026-04-11',
  '2025-07-05',
  '33699 Rodovia Silas, Santos do Sul - SC',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '231776f5-4c48-4d51-81ff-7e0a059b2993',
  'Marcela Barros',
  'otavioblbarbosa+ge2513@gmail.com',
  '(61) 34163-3116',
  '1998-03-24',
  '2026-09-13',
  '2025-12-07',
  '76487 Rua Batista, Souza do Sul - RS',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '5fc7391d-ae27-4bc5-86e9-38b49d49a9cd',
  'Lara Melo',
  'otavioblbarbosa+ge2514@gmail.com',
  '(11) 98094-2831',
  '2005-08-23',
  '2026-07-13',
  '2025-10-06',
  '9405 Alameda Moreira, Yango do Norte - PI',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '1adc42d1-a4b9-4add-a4ac-83ef5fd8062a',
  'Maria Luiza Batista',
  'otavioblbarbosa+ge2515@gmail.com',
  '(71) 36025-3228',
  '1989-01-16',
  '2026-08-24',
  '2025-11-17',
  '1255 Travessa Macedo, Guilherme do Norte - RS',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '169138c4-cef4-42db-9685-590202bacf93',
  'Maria Alice Costa',
  'otavioblbarbosa+ge2516@gmail.com',
  '(31) 98368-2691',
  '1997-11-30',
  '2026-09-27',
  '2025-12-21',
  '581 Avenida Morgana, Fábio do Norte - BA',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  'b17b477d-e462-4a5c-9bb4-c6dbbdd51407',
  'Maria Clara Carvalho',
  'otavioblbarbosa+ge2517@gmail.com',
  '(11) 50108-2730',
  '2003-07-15',
  '2026-05-29',
  '2025-08-22',
  '38347 Alameda Marina, Lívia do Descoberto - SE',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  'a9b00697-7326-4bf7-a0a7-eb47f838e061',
  'Sophia Melo',
  'otavioblbarbosa+ge2518@gmail.com',
  '(41) 49995-7802',
  '1988-01-06',
  '2026-08-16',
  '2025-11-09',
  '597 Avenida Macedo, Alice do Sul - MS',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  'bb8640b2-7ed7-49a0-8412-4c660cdc2176',
  'Larissa Moraes',
  'otavioblbarbosa+ge2519@gmail.com',
  '(85) 25296-6878',
  '2000-02-16',
  '2026-07-07',
  '2025-09-30',
  '25957 Rodovia Moraes, Barros do Descoberto - RR',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '1b923f5b-de59-4feb-bb49-406bf01603c0',
  'Lavínia Costa',
  'otavioblbarbosa+ge2520@gmail.com',
  '(11) 11185-8931',
  '1998-07-30',
  '2026-05-09',
  '2025-08-02',
  '52436 Alameda Pereira, Braga do Descoberto - SP',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '3e0b9d35-c985-47e0-8e58-9707af37d850',
  'Lorraine Costa',
  'otavioblbarbosa+ge2521@gmail.com',
  '(61) 52105-5022',
  '1991-09-28',
  '2026-08-12',
  '2025-11-05',
  '669 Marginal Margarida, Isis do Sul - RS',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '0f6f409e-d0ed-420e-9e66-33fa38e6887d',
  'Lorraine Oliveira',
  'otavioblbarbosa+ge2522@gmail.com',
  '(85) 15624-2262',
  '1989-04-20',
  '2026-05-19',
  '2025-08-12',
  '33795 Rodovia Pereira, Carvalho do Descoberto - RR',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '86965d11-63b6-41b3-92f4-d10804b84e5d',
  'Lorraine Carvalho',
  'otavioblbarbosa+ge2523@gmail.com',
  '(11) 76598-6091',
  '2007-08-06',
  '2026-05-13',
  '2025-08-06',
  '32875 Travessa Barros, Sarah de Nossa Senhora - MS',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '7a2a4188-681e-46d6-89e0-7103fbdddbce',
  'Bruna Santos',
  'otavioblbarbosa+ge2524@gmail.com',
  '(85) 31500-9839',
  '1993-12-14',
  '2026-10-11',
  '2026-01-04',
  '509 Marginal Cauã, Raul do Norte - SP',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

INSERT INTO public.patients (
  id, name, email, phone, date_of_birth, due_date, dum, address, created_by
) VALUES (
  '82303d98-65e7-4d09-9c08-c4edd4975e7e',
  'Vitória Xavier',
  'otavioblbarbosa+ge2525@gmail.com',
  '(41) 12391-7927',
  '1999-08-14',
  '2026-05-18',
  '2025-08-11',
  '1977 Rua Moraes, Barros do Sul - PI',
  '6e80c9bc-4fd5-4ac5-962f-508781843d06'
);

-- ==========================================
-- ASSOCIAR TODAS AS GESTANTES À DOULA
-- ==========================================

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('964beea0-7013-46f5-b81f-32f52ecb5525', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('12c2d748-8452-4475-8ffb-ccaf181bc84b', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('55065b33-6c22-4c7b-aeeb-ffb75fd82942', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('f1764dfe-4f04-4aa3-be63-1129a7ebf972', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('a20672c2-fed0-42d8-ad54-02c483a24772', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('48c99aae-e1ea-4739-8d81-aa3115cd36dd', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('427d4d4d-6506-4d64-940c-ab6fb011a975', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('464002ef-73b5-48b9-b280-06fc482c81e4', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('3fb4b89d-80b4-4fef-8f61-015599e88003', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('cdbdde77-e1a6-4106-8306-5fe9fad5ee67', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('d6a22362-dc18-4970-993b-3322e2bccfe4', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('3013ed90-098b-4275-b086-4c38c41256e2', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('231776f5-4c48-4d51-81ff-7e0a059b2993', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('5fc7391d-ae27-4bc5-86e9-38b49d49a9cd', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('1adc42d1-a4b9-4add-a4ac-83ef5fd8062a', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('169138c4-cef4-42db-9685-590202bacf93', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('b17b477d-e462-4a5c-9bb4-c6dbbdd51407', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('a9b00697-7326-4bf7-a0a7-eb47f838e061', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('bb8640b2-7ed7-49a0-8412-4c660cdc2176', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('1b923f5b-de59-4feb-bb49-406bf01603c0', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('3e0b9d35-c985-47e0-8e58-9707af37d850', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('0f6f409e-d0ed-420e-9e66-33fa38e6887d', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('86965d11-63b6-41b3-92f4-d10804b84e5d', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('7a2a4188-681e-46d6-89e0-7103fbdddbce', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('82303d98-65e7-4d09-9c08-c4edd4975e7e', '6e80c9bc-4fd5-4ac5-962f-508781843d06', 'doula');

-- ==========================================
-- ASSOCIAR 10 GESTANTES A OBSTETRAS
-- ==========================================

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('f1764dfe-4f04-4aa3-be63-1129a7ebf972', 'd38ef9e9-6acb-4c2c-9626-c192f94f56c3', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('3fb4b89d-80b4-4fef-8f61-015599e88003', 'bc0d5873-15c9-4760-9bc4-5cd2599ef2ee', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('d6a22362-dc18-4970-993b-3322e2bccfe4', 'a6bf730a-d92e-4e1e-99dd-db6df8d85dd8', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('a9b00697-7326-4bf7-a0a7-eb47f838e061', 'a82bc4bd-65f8-4d32-a119-82b366a858d1', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('464002ef-73b5-48b9-b280-06fc482c81e4', '564fd105-aac4-44e8-a7b0-a6cdd539fd38', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('cdbdde77-e1a6-4106-8306-5fe9fad5ee67', '4b2dc116-c938-4f31-9eb2-eddcde4bb0f4', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('1b923f5b-de59-4feb-bb49-406bf01603c0', '3f3ea351-a58e-487d-97ed-878a746a207a', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('86965d11-63b6-41b3-92f4-d10804b84e5d', '8fd85b40-2623-40f4-a602-0b4ab3361ff6', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('82303d98-65e7-4d09-9c08-c4edd4975e7e', '508adef3-f9ba-4cb6-ad6a-e39b0c794f44', 'obstetra');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('964beea0-7013-46f5-b81f-32f52ecb5525', '921b81b3-6b4e-4cbd-9e60-d69233a3616e', 'obstetra');

-- ==========================================
-- ASSOCIAR 10 GESTANTES A ENFERMEIRAS OBSTÉTRICAS
-- ==========================================

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('a9b00697-7326-4bf7-a0a7-eb47f838e061', '1aad4a63-ccab-4de3-b38f-4fcdeea0743c', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('f1764dfe-4f04-4aa3-be63-1129a7ebf972', '4f915cb9-42de-4a1a-8376-a06e5e8341fb', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('12c2d748-8452-4475-8ffb-ccaf181bc84b', 'b20d6d27-189a-446f-8acf-6e64c977f009', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('bb8640b2-7ed7-49a0-8412-4c660cdc2176', '60ab0ee5-b100-4437-bdcb-9579e30a884e', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('86965d11-63b6-41b3-92f4-d10804b84e5d', '89d59189-b26a-4607-9f63-9ff6fce57be7', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('427d4d4d-6506-4d64-940c-ab6fb011a975', '048f3663-870a-4948-a811-d8ffebe56361', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('7a2a4188-681e-46d6-89e0-7103fbdddbce', 'd7a48a7b-6bee-482b-97f3-9d12d112a1f0', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('169138c4-cef4-42db-9685-590202bacf93', '152ba2cd-42b6-4cdc-ab6e-6e361ce88e66', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('82303d98-65e7-4d09-9c08-c4edd4975e7e', '44aa13ce-02dd-481f-a95a-46c4291d7dad', 'enfermeiro');

INSERT INTO public.team_members (patient_id, professional_id, professional_type)
VALUES ('d6a22362-dc18-4970-993b-3322e2bccfe4', '9e52130f-eb83-439c-a054-abd8970ecee3', 'enfermeiro');

