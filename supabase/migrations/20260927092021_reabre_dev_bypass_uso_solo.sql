-- 27-set-2026: operador (uso solo) mandou reabrir o acesso do app sem login.
-- Devolve os grants padrão do Supabase aos 3 papéis e recoloca a dev_bypass
-- em toda tabela do public com RLS ligada. Desfaz o P0 de 30-ago.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
revoke execute on function public.rls_auto_enable() from anon, authenticated;

alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;

do $$
declare r record;
begin
  for r in select c.relname from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
  loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=r.relname and policyname='dev_bypass') then
      execute format('create policy dev_bypass on public.%I for all to public using (true) with check (true)', r.relname);
    end if;
  end loop;
end $$;
