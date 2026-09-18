create type public.document_template_category as enum (
  'prescricao',
  'exame',
  'cirurgia',
  'laudo',
  'atestado',
  'declaracao',
  'relatorio'
);

create table public.document_templates (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  scope text not null default 'personal' check (scope in ('personal', 'global')),
  category public.document_template_category not null,
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_templates_owner_scope_check check (
    (scope = 'personal' and owner_id is not null)
    or (scope = 'global' and owner_id is null)
  )
);

create index idx_document_templates_owner on public.document_templates (owner_id);
create index idx_document_templates_category on public.document_templates (category);

alter table public.document_templates enable row level security;

create policy "Users can view own and global templates"
  on public.document_templates for select
  using (scope = 'global' or owner_id = auth.uid());

create policy "Users can insert own personal templates"
  on public.document_templates for insert
  with check (scope = 'personal' and owner_id = auth.uid());

create policy "Users can update own personal templates"
  on public.document_templates for update
  using (scope = 'personal' and owner_id = auth.uid())
  with check (scope = 'personal' and owner_id = auth.uid());

create policy "Users can delete own personal templates"
  on public.document_templates for delete
  using (scope = 'personal' and owner_id = auth.uid());

create trigger set_updated_at
  before update on public.document_templates
  for each row execute function public.handle_updated_at();
