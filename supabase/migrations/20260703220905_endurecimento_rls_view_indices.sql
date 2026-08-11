-- APLICADA no banco vivo em 03-jul-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (5e36c00d3aa8555e817b422384fcccbe). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- endurecimento de seguranca/performance, sem mudanca de acesso, comportamento ou dado.
-- (a) policies: auth.uid() "solta" -> (select auth.uid()) para o postgres avaliar 1x por query,
--     nao 1x por linha (auth_rls_initplan). expressao preservada, so a chamada auth.* muda.
--     dev_bypass NAO e tocada.
-- (b) vw_dashboard_uti: security_invoker=true para respeitar o rls de quem consulta
--     (era security definer implicito, ignorava rls). definicao select identica.
-- (c) indices em 9 colunas de chave estrangeira sem indice.

-- (a) policies

alter policy "alerts_all_own" on public.alerts_log
using (
  exists (
    select 1
    from pacientes p
    where p.id = alerts_log.paciente_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from pacientes p
    where p.id = alerts_log.paciente_id and p.user_id = (select auth.uid())
  )
);

alter policy "antibiograma_all_own" on public.antibiograma
using (
  exists (
    select 1
    from culturas c
    join pacientes p on p.id = c.paciente_id
    where c.id = antibiograma.cultura_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from culturas c
    join pacientes p on p.id = c.paciente_id
    where c.id = antibiograma.cultura_id and p.user_id = (select auth.uid())
  )
);

alter policy "atbs_all_own" on public.atbs
using (
  exists (
    select 1
    from pacientes p
    where p.id = atbs.paciente_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from pacientes p
    where p.id = atbs.paciente_id and p.user_id = (select auth.uid())
  )
);

alter policy "culturas_all_own" on public.culturas
using (
  exists (
    select 1
    from pacientes p
    where p.id = culturas.paciente_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from pacientes p
    where p.id = culturas.paciente_id and p.user_id = (select auth.uid())
  )
);

alter policy "eventos_all_own" on public.eventos_clinicos
using (
  exists (
    select 1
    from pacientes p
    where p.id = eventos_clinicos.paciente_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from pacientes p
    where p.id = eventos_clinicos.paciente_id and p.user_id = (select auth.uid())
  )
);

alter policy "evolucoes_all_own" on public.evolucoes
using (
  exists (
    select 1
    from pacientes p
    where p.id = evolucoes.paciente_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from pacientes p
    where p.id = evolucoes.paciente_id and p.user_id = (select auth.uid())
  )
);

alter policy "ingest_audit_own" on public.ingest_audit_log
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

alter policy "pacientes_delete_own" on public.pacientes
using ( (select auth.uid()) = user_id );

alter policy "pacientes_insert_own" on public.pacientes
with check ( (select auth.uid()) = user_id );

alter policy "pacientes_select_own" on public.pacientes
using ( (select auth.uid()) = user_id );

alter policy "pacientes_update_own" on public.pacientes
using ( (select auth.uid()) = user_id )
with check ( (select auth.uid()) = user_id );

alter policy "pendencias_all_own" on public.pendencias
using (
  exists (
    select 1
    from pacientes p
    where p.id = pendencias.paciente_id and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from pacientes p
    where p.id = pendencias.paciente_id and p.user_id = (select auth.uid())
  )
);

-- (b) view com security_invoker=true, definicao select identica a producao (pg_get_viewdef)

create or replace view public.vw_dashboard_uti with (security_invoker = true) as
 WITH ultima_evol AS (
         SELECT DISTINCT ON (e.paciente_id) e.paciente_id,
            e.id AS evolucao_id,
            e.data_evolucao AS ultima_evolucao,
            e.sofa_total,
            e.sofa_snapshot,
            e.dvas,
            e.sedativos
           FROM evolucoes e
          ORDER BY e.paciente_id, e.data_evolucao DESC
        ), sofa_24h_atras AS (
         SELECT DISTINCT ON (ec.paciente_id) ec.paciente_id,
            ec.valor_num AS sofa_total_24h
           FROM eventos_clinicos ec
          WHERE ec.tipo = 'sofa_total'::text AND ec.ts <= (now() - '24:00:00'::interval)
          ORDER BY ec.paciente_id, ec.ts DESC
        ), pend_abertas AS (
         SELECT pendencias.paciente_id,
            count(*)::integer AS pendencias_abertas
           FROM pendencias
          WHERE pendencias.concluida = false
          GROUP BY pendencias.paciente_id
        )
 SELECT p.id AS paciente_id,
    p.user_id,
    p.leito,
    p.uti,
    p.nome,
    p.idade,
    p.peso,
    p.hd,
    p.gravidade,
    p.status_leito,
    p.data_adm,
    CURRENT_DATE - p.data_adm AS dias_internacao,
    u.evolucao_id,
    u.ultima_evolucao,
    u.sofa_total,
    u.sofa_snapshot,
    u.dvas,
    u.sedativos,
    (u.sofa_total::numeric - s24.sofa_total_24h)::integer AS delta_sofa_24h,
    COALESCE(pa.pendencias_abertas, 0) AS pendencias_abertas,
    p.dispositivos,
    p.isolation,
    p.out_of_range_count,
    p.severidade_visual
   FROM pacientes p
     LEFT JOIN ultima_evol u ON u.paciente_id = p.id
     LEFT JOIN sofa_24h_atras s24 ON s24.paciente_id = p.id
     LEFT JOIN pend_abertas pa ON pa.paciente_id = p.id
  WHERE p.status_leito = 'ativo'::text;

-- (c) indices de fk (9)

create index if not exists idx_alerts_log_acked_by on public.alerts_log (acked_by);
create index if not exists idx_alerts_log_evento_id on public.alerts_log (evento_id);
create index if not exists idx_alerts_log_user_id on public.alerts_log (user_id);
create index if not exists idx_atbs_user_id on public.atbs (user_id);
create index if not exists idx_culturas_user_id on public.culturas (user_id);
create index if not exists idx_eventos_clinicos_user_id on public.eventos_clinicos (user_id);
create index if not exists idx_ingest_audit_log_user_id on public.ingest_audit_log (user_id);
create index if not exists idx_pendencias_evolucao_id on public.pendencias (evolucao_id);
create index if not exists idx_pendencias_user_id on public.pendencias (user_id);

