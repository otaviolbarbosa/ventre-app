-- Recriar tabela plans com slug no lugar de type
DROP TABLE public.plans;

CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  type public.plan_type NOT NULL,
  description text,
  value BIGINT,
  benefits text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),

  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

GRANT SELECT ON TABLE public.plans TO anon, authenticated, service_role;

-- Seed
INSERT INTO public.plans (name, slug, type, description, value, benefits) VALUES
(
  'Cuidado Básico',
  'basic-care',
  'free',
  'Para começar',
  0,
  ARRAY[
    'Gerenciamento de gestantes',
    'Controle de evolução da gestante',
    'Notificações em tempo real',
    'Cartão pré-natal'
  ]
),
(
  'Mais Cuidado',
  'plus-care-month',
  'premium',
  'Para profissionais dedicados',
  2990,
  ARRAY[
    'Gerenciamento de consultas e encontros',
    'Participação em equipes multidisciplinares',
    'Perfil completo da gestante',
    'Ferramentas de acompanhamento (sinais vitais, contador de contrações, diário da gestante e mais)',
    'Gestão financeira',
    'Compartilhamento de documentos',
    'Gerenciamento de contratos',
    'Relatórios detalhados'
  ]
),
(
  'Mais Cuidado',
  'plus-care-quarter',
  'premium',
  'Para profissionais dedicados',
  8500,
  ARRAY[
    'Gerenciamento de consultas e encontros',
    'Participação em equipes multidisciplinares',
    'Perfil completo da gestante',
    'Ferramentas de acompanhamento (sinais vitais, contador de contrações, diário da gestante e mais)',
    'Gestão financeira',
    'Compartilhamento de documentos',
    'Gerenciamento de contratos',
    'Relatórios detalhados'
  ]
),
(
  'Mais Cuidado',
  'plus-care-semester',
  'premium',
  'Para profissionais dedicados',
  16000,
  ARRAY[
    'Gerenciamento de consultas e encontros',
    'Participação em equipes multidisciplinares',
    'Perfil completo da gestante',
    'Ferramentas de acompanhamento (sinais vitais, contador de contrações, diário da gestante e mais)',
    'Gestão financeira',
    'Compartilhamento de documentos',
    'Gerenciamento de contratos',
    'Relatórios detalhados'
  ]
),
(
  'Mais Cuidado',
  'plus-care-year',
  'premium',
  'Para profissionais dedicados',
  29900,
  ARRAY[
    'Gerenciamento de consultas e encontros',
    'Participação em equipes multidisciplinares',
    'Perfil completo da gestante',
    'Ferramentas de acompanhamento (sinais vitais, contador de contrações, diário da gestante e mais)',
    'Gestão financeira',
    'Compartilhamento de documentos',
    'Gerenciamento de contratos',
    'Relatórios detalhados'
  ]
),
(
  'Cuidado Completo',
  'complete-care-month',
  'enterprise',
  'Para clínicas e equipes',
  24990,
  ARRAY[
    'Perfis de gestor e secretário',
    'Gerenciamento de múltiplas especialidades',
    'Gerenciamento de múltiplas agendas',
    'Relatórios qualitativos avançados'
  ]
),
(
  'Cuidado Completo',
  'complete-care-quarter',
  'enterprise',
  'Para clínicas e equipes',
  70000,
  ARRAY[
    'Perfis de gestor e secretário',
    'Gerenciamento de múltiplas especialidades',
    'Gerenciamento de múltiplas agendas',
    'Relatórios qualitativos avançados'
  ]
),
(
  'Cuidado Completo',
  'complete-care-semester',
  'enterprise',
  'Para clínicas e equipes',
  132000,
  ARRAY[
    'Perfis de gestor e secretário',
    'Gerenciamento de múltiplas especialidades',
    'Gerenciamento de múltiplas agendas',
    'Relatórios qualitativos avançados'
  ]
),
(
  'Cuidado Completo',
  'complete-care-year',
  'enterprise',
  'Para clínicas e equipes',
  249900,
  ARRAY[
    'Perfis de gestor e secretário',
    'Gerenciamento de múltiplas especialidades',
    'Gerenciamento de múltiplas agendas',
    'Relatórios qualitativos avançados'
  ]
);
