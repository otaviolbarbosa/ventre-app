-- Enum para tipos de plano
CREATE TYPE public.plan_type AS ENUM ('free', 'premium', 'enterprise');

-- Criar tabela de planos
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  type public.plan_type NOT NULL,
  description text,
  value BIGINT, -- valor em centavos
  benefits text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),

  CONSTRAINT plans_pkey PRIMARY KEY (id)
);

GRANT SELECT ON TABLE public.plans TO anon, authenticated, service_role;

-- Seed: planos baseados na tela de paywall
INSERT INTO public.plans (name, type, description, value, benefits) VALUES
(
  'Cuidado Básico',
  'free',
  'Para começar',
  0.00,
  ARRAY[
    'Gerenciamento de gestantes',
    'Controle de evolução da gestante',
    'Notificações em tempo real',
    'Cartão pré-natal'
  ]
),
(
  'Mais Cuidado',
  'premium',
  'Para profissionais dedicados',
  29.90,
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
  'enterprise',
  'Para clínicas e equipes',
  NULL,
  ARRAY[
    'Perfis de gestor e secretário',
    'Gerenciamento de múltiplas especialidades',
    'Gerenciamento de múltiplas agendas',
    'Relatórios qualitativos avançados'
  ]
);
