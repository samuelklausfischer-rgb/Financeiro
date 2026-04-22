create or replace function private.touch_updated()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated = timezone('utc', now());
  return new;
end;
$$;

create index if not exists idx_pagamentos_criado_por on public.pagamentos (criado_por);
create index if not exists idx_historico_usuario_id on public.historico_acoes (usuario_id);

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using ((select auth.role()) = 'authenticated');

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists recebedores_full_access on public.recebedores;
create policy recebedores_full_access
on public.recebedores
for all
to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

drop policy if exists pagamentos_full_access on public.pagamentos;
create policy pagamentos_full_access
on public.pagamentos
for all
to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

drop policy if exists alertas_full_access on public.alertas;
create policy alertas_full_access
on public.alertas
for all
to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

drop policy if exists historico_acoes_full_access on public.historico_acoes;
create policy historico_acoes_full_access
on public.historico_acoes
for all
to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

drop policy if exists analises_duplicidade_full_access on public.analises_duplicidade;
create policy analises_duplicidade_full_access
on public.analises_duplicidade
for all
to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');

drop policy if exists prn_report_runs_full_access on public.prn_report_runs;
create policy prn_report_runs_full_access
on public.prn_report_runs
for all
to authenticated
using ((select auth.role()) = 'authenticated')
with check ((select auth.role()) = 'authenticated');
