-- APLICADA no banco vivo em 30-ago-2026. Nao editar.
-- P0: remove a policy dev_bypass (FOR ALL TO public USING true)
-- e o acesso do role anon aos dados clinicos. Backup em backup_20260830_p0.

-- 1. Dono dos registros orfaos: unica conta com login efetivo.
do $$
declare owner_uid uuid := 'edf28877-ed6d-40d5-82ec-17e1886b191d';
        t text;
begin
  foreach t in array array[
    'pacientes','evolucoes','eventos_clinicos','pendencias','internacoes',
    'atbs','culturas','alerts_log','ingest_audit_log','janelas_24h','dispositivo_episodios'
  ]
  loop
    execute format('update public.%I set user_id = %L where user_id is null', t, owner_uid);
  end loop;
end $$;

-- 2. Derruba a dev_bypass em todas as tabelas onde existe.
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_policies
           where schemaname = 'public' and policyname = 'dev_bypass'
  loop
    execute format('drop policy dev_bypass on %I.%I', r.schemaname, r.tablename);
  end loop;
end $$;

-- 3. Policies reais: dono do registro, apenas autenticado.
do $$
declare t text;
begin
  foreach t in array array[
    'pacientes','evolucoes','eventos_clinicos','pendencias','internacoes',
    'atbs','culturas','alerts_log','ingest_audit_log','janelas_24h','dispositivo_episodios'
  ]
  loop
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $f$, t || '_owner', t);
  end loop;
end $$;

-- 4. Tabelas de referencia/config (sem coluna user_id): autenticado, sem anon.
do $$
declare t text;
begin
  foreach t in array array['alert_rules','trend_rules','antibiograma','avisos_agentes']
  loop
    execute format($f$
      create policy %I on public.%I
        for all to authenticated using (true) with check (true)
    $f$, t || '_auth', t);
  end loop;
end $$;

-- 5. Corta o role anon do schema public inteiro (tabelas e views),
--    preservando a leitura publica deliberada do vocabulario de eventos.
revoke all on all tables in schema public from anon;
grant select on public.evento_tipo_ref to anon;

-- 6. authenticated fica com DML, sem TRUNCATE/REFERENCES/TRIGGER.
do $$
declare r record;
begin
  for r in select table_name from information_schema.tables
           where table_schema = 'public' and table_type in ('BASE TABLE','VIEW')
  loop
    execute format('revoke truncate, references, trigger on public.%I from authenticated', r.table_name);
  end loop;
end $$;

-- 7. Funcoes SECURITY DEFINER expostas no PostgREST.
revoke execute on function public.save_ficha(uuid, jsonb, jsonb, uuid, text, jsonb) from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 8. Higiene apontada pelo linter.
alter function public.fmt_num set search_path = public, pg_temp;
alter view repo_index.categorias set (security_invoker = true);

-- 9. Novas tabelas nao nascem mais liberadas para anon.
alter default privileges for role postgres in schema public revoke all on tables from anon;
