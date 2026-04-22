create extension if not exists pgcrypto;

create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'perfil_type') then
    create type public.perfil_type as enum ('financeiro', 'gestor', 'administrador');
  end if;

  if not exists (select 1 from pg_type where typname = 'recebedor_type') then
    create type public.recebedor_type as enum ('medico', 'empresa', 'fornecedor');
  end if;

  if not exists (select 1 from pg_type where typname = 'pagamento_status') then
    create type public.pagamento_status as enum (
      'pendente',
      'em_conferencia',
      'aprovado',
      'pago',
      'cancelado',
      'com_alerta'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'alerta_type') then
    create type public.alerta_type as enum (
      'duplicidade',
      'valor_suspeito',
      'campo_faltando',
      'vencimento_proximo',
      'cadastro_incompleto'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'analysis_status') then
    create type public.analysis_status as enum ('processing', 'completed', 'error');
  end if;

  if not exists (select 1 from pg_type where typname = 'prn_run_status') then
    create type public.prn_run_status as enum ('processing', 'success', 'error');
  end if;
end $$;

create or replace function private.touch_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated = timezone('utc', now());
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, perfil, ativo)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    'financeiro',
    true
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  perfil public.perfil_type not null default 'financeiro',
  ativo boolean not null default true,
  avatar_url text,
  created timestamptz not null default timezone('utc', now()),
  updated timestamptz not null default timezone('utc', now())
);

create table if not exists public.recebedores (
  id uuid primary key default gen_random_uuid(),
  nome_razao_social text not null,
  tipo public.recebedor_type not null,
  cpf_cnpj text,
  agencia text,
  conta text,
  tipo_conta text,
  chave_pix text,
  email text,
  telefone text,
  observacoes text,
  ativo boolean not null default true,
  created timestamptz not null default timezone('utc', now()),
  updated timestamptz not null default timezone('utc', now())
);

create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  recebedor_id uuid references public.recebedores(id) on delete restrict,
  descricao text not null,
  valor numeric(12, 2) not null,
  data_vencimento date not null,
  data_prevista_pagamento date,
  competencia_referencia text,
  categoria text,
  observacoes text,
  status public.pagamento_status not null default 'pendente',
  criado_por uuid references public.profiles(id) on delete set null,
  created timestamptz not null default timezone('utc', now()),
  updated timestamptz not null default timezone('utc', now())
);

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid references public.pagamentos(id) on delete cascade,
  tipo public.alerta_type not null,
  descricao text,
  revisado boolean not null default false,
  created timestamptz not null default timezone('utc', now()),
  updated timestamptz not null default timezone('utc', now())
);

create table if not exists public.historico_acoes (
  id uuid primary key default gen_random_uuid(),
  pagamento_id uuid references public.pagamentos(id) on delete cascade,
  usuario_id uuid references public.profiles(id) on delete set null,
  acao text not null,
  valor_anterior text,
  valor_novo text,
  created timestamptz not null default timezone('utc', now()),
  updated timestamptz not null default timezone('utc', now())
);

create table if not exists public.analises_duplicidade (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status public.analysis_status not null default 'processing',
  uploaded_by uuid references public.profiles(id) on delete set null,
  n8n_execution_id text,
  error_code text,
  error_message text,
  total_records integer not null default 0,
  analyzable_records integer not null default 0,
  duplicate_count integer not null default 0,
  manual_review_count integer not null default 0,
  name_repeat_manual_count integer not null default 0,
  group_count integer not null default 0,
  manual_group_count integer not null default 0,
  name_repeat_manual_group_count integer not null default 0,
  overall_manual_count integer not null default 0,
  overall_manual_group_count integer not null default 0,
  partial_structure_count integer not null default 0,
  result_json jsonb,
  created timestamptz not null default timezone('utc', now()),
  updated timestamptz not null default timezone('utc', now())
);

create table if not exists public.prn_report_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  data_referencia date,
  daily_filename text not null,
  historical_filename text not null,
  status public.prn_run_status not null default 'processing',
  webhook_url text,
  webhook_http_status integer,
  webhook_content_type text,
  duration_ms integer,
  response_html text,
  result_json jsonb,
  error_code text,
  error_message text,
  meta jsonb,
  created timestamptz not null default timezone('utc', now()),
  updated timestamptz not null default timezone('utc', now())
);

create index if not exists idx_recebedores_nome on public.recebedores (nome_razao_social);
create index if not exists idx_pagamentos_status on public.pagamentos (status);
create index if not exists idx_pagamentos_recebedor_id on public.pagamentos (recebedor_id);
create index if not exists idx_pagamentos_created on public.pagamentos (created desc);
create index if not exists idx_alertas_pagamento_id on public.alertas (pagamento_id);
create index if not exists idx_alertas_created on public.alertas (created desc);
create index if not exists idx_historico_pagamento_id on public.historico_acoes (pagamento_id);
create index if not exists idx_analises_status on public.analises_duplicidade (status);
create index if not exists idx_analises_uploaded_by on public.analises_duplicidade (uploaded_by);
create index if not exists idx_analises_created on public.analises_duplicidade (created desc);
create index if not exists idx_prn_runs_status on public.prn_report_runs (status);
create index if not exists idx_prn_runs_user_id on public.prn_report_runs (user_id);
create index if not exists idx_prn_runs_created on public.prn_report_runs (created desc);

drop trigger if exists set_profiles_updated on public.profiles;
create trigger set_profiles_updated
before update on public.profiles
for each row
execute function private.touch_updated();

drop trigger if exists set_recebedores_updated on public.recebedores;
create trigger set_recebedores_updated
before update on public.recebedores
for each row
execute function private.touch_updated();

drop trigger if exists set_pagamentos_updated on public.pagamentos;
create trigger set_pagamentos_updated
before update on public.pagamentos
for each row
execute function private.touch_updated();

drop trigger if exists set_alertas_updated on public.alertas;
create trigger set_alertas_updated
before update on public.alertas
for each row
execute function private.touch_updated();

drop trigger if exists set_historico_updated on public.historico_acoes;
create trigger set_historico_updated
before update on public.historico_acoes
for each row
execute function private.touch_updated();

drop trigger if exists set_analises_updated on public.analises_duplicidade;
create trigger set_analises_updated
before update on public.analises_duplicidade
for each row
execute function private.touch_updated();

drop trigger if exists set_prn_runs_updated on public.prn_report_runs;
create trigger set_prn_runs_updated
before update on public.prn_report_runs
for each row
execute function private.touch_updated();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.recebedores enable row level security;
alter table public.pagamentos enable row level security;
alter table public.alertas enable row level security;
alter table public.historico_acoes enable row level security;
alter table public.analises_duplicidade enable row level security;
alter table public.prn_report_runs enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists recebedores_full_access on public.recebedores;
create policy recebedores_full_access
on public.recebedores
for all
to authenticated
using (true)
with check (true);

drop policy if exists pagamentos_full_access on public.pagamentos;
create policy pagamentos_full_access
on public.pagamentos
for all
to authenticated
using (true)
with check (true);

drop policy if exists alertas_full_access on public.alertas;
create policy alertas_full_access
on public.alertas
for all
to authenticated
using (true)
with check (true);

drop policy if exists historico_acoes_full_access on public.historico_acoes;
create policy historico_acoes_full_access
on public.historico_acoes
for all
to authenticated
using (true)
with check (true);

drop policy if exists analises_duplicidade_full_access on public.analises_duplicidade;
create policy analises_duplicidade_full_access
on public.analises_duplicidade
for all
to authenticated
using (true)
with check (true);

drop policy if exists prn_report_runs_full_access on public.prn_report_runs;
create policy prn_report_runs_full_access
on public.prn_report_runs
for all
to authenticated
using (true)
with check (true);

do $$
declare
  realtime_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach realtime_table in array array[
      'recebedores',
      'pagamentos',
      'alertas',
      'analises_duplicidade',
      'prn_report_runs'
    ]
    loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = realtime_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', realtime_table);
      end if;
    end loop;
  end if;
end $$;
