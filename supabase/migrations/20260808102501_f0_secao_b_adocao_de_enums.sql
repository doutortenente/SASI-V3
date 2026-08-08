-- F0 / Seção B do 11_migracao_do_vivo.sql — adoção de enums (texto -> enum).
-- Aplicada em 08-ago-2026 no projeto idswehsvvqczzkiatuzu.
--
-- Verificação B0 rodada antes: as 16 colunas voltaram ZERO valor fora da lista.
-- NÃO inclui a Seção C (RLS de produção / remoção de dev_bypass) — fora por
-- decisão do operador: uso solo, um usuário, sem login.
--
-- Duas coisas que o anexo não previa e foram necessárias:
--  1. Índices parciais com predicado sobre coluna convertida (uq_pacientes_leito_ativo
--     e idx_pacientes_isolation). O Postgres reconstrói o índice ao trocar o tipo e o
--     predicado `= 'ativo'::text` quebra. Derrubados e recriados na MESMA transação,
--     para a trava de "um paciente por leito" nunca ficar ausente.
--  2. save_ficha precisou de dois casts, senão a gravação da ficha quebraria no
--     instante da conversão.

drop view public.vw_dashboard_uti;
drop view public.vw_alertas_abertos;
drop view public.vw_dias_atb_ativo;
drop view public.vw_eventos_pendentes_revisao;

drop index public.uq_pacientes_leito_ativo;
drop index public.idx_pacientes_isolation;

alter table public.pacientes drop constraint pacientes_uti_check;
alter table public.pacientes alter column uti type public.uti_enum using uti::public.uti_enum;

alter table public.pacientes drop constraint pacientes_gravidade_check;
alter table public.pacientes alter column gravidade drop default;
alter table public.pacientes alter column gravidade type public.gravidade_enum using gravidade::public.gravidade_enum;
alter table public.pacientes alter column gravidade set default 'estavel';

alter table public.pacientes drop constraint pacientes_status_leito_check;
alter table public.pacientes alter column status_leito drop default;
alter table public.pacientes alter column status_leito type public.status_leito_enum using status_leito::public.status_leito_enum;
alter table public.pacientes alter column status_leito set default 'ativo';

alter table public.pacientes drop constraint pacientes_isolation_check;
alter table public.pacientes alter column isolation drop default;
alter table public.pacientes alter column isolation type public.isolamento_enum using isolation::public.isolamento_enum;
alter table public.pacientes alter column isolation set default 'none';

alter table public.pacientes drop constraint pacientes_severidade_visual_check;
alter table public.pacientes alter column severidade_visual drop default;
alter table public.pacientes alter column severidade_visual type public.severidade_visual_enum using severidade_visual::public.severidade_visual_enum;
alter table public.pacientes alter column severidade_visual set default 'green';

alter table public.evolucoes drop constraint evolucoes_plantao_check;
alter table public.evolucoes alter column plantao drop default;
alter table public.evolucoes alter column plantao type public.plantao_enum using plantao::public.plantao_enum;
alter table public.evolucoes alter column plantao set default 'manha';

alter table public.atbs drop constraint atbs_via_check;
alter table public.atbs alter column via type public.via_atb_enum using via::public.via_atb_enum;

alter table public.atbs drop constraint atbs_intencao_check;
alter table public.atbs alter column intencao type public.intencao_atb_enum using intencao::public.intencao_atb_enum;

alter table public.culturas drop constraint culturas_material_check;
alter table public.culturas alter column material type public.material_cultura_enum using material::public.material_cultura_enum;

alter table public.antibiograma drop constraint antibiograma_resultado_check;
alter table public.antibiograma alter column resultado type public.antibiograma_resultado_enum using resultado::public.antibiograma_resultado_enum;

alter table public.alerts_log drop constraint alerts_log_severidade_check;
alter table public.alerts_log alter column severidade drop default;
alter table public.alerts_log alter column severidade type public.severidade_alerta_enum using severidade::public.severidade_alerta_enum;
alter table public.alerts_log alter column severidade set default 'warning';

alter table public.eventos_clinicos drop constraint eventos_clinicos_fonte_check;
alter table public.eventos_clinicos alter column fonte type public.fonte_evento_enum using fonte::public.fonte_evento_enum;

alter table public.alert_rules drop constraint alert_rules_comparador_check;
alter table public.alert_rules alter column comparador type public.comparador_enum using comparador::public.comparador_enum;

alter table public.alert_rules drop constraint alert_rules_severidade_check;
alter table public.alert_rules alter column severidade type public.severidade_alerta_enum using severidade::public.severidade_alerta_enum;

alter table public.trend_rules drop constraint trend_rules_modo_check;
alter table public.trend_rules alter column modo type public.trend_modo_enum using modo::public.trend_modo_enum;

alter table public.trend_rules drop constraint trend_rules_severidade_check;
alter table public.trend_rules alter column severidade type public.severidade_alerta_enum using severidade::public.severidade_alerta_enum;

create unique index uq_pacientes_leito_ativo on public.pacientes using btree (uti, leito) where (status_leito = 'ativo');
create index idx_pacientes_isolation on public.pacientes using btree (isolation) where (isolation <> 'none');

create view public.vw_dashboard_uti with (security_invoker=true) as
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
  WHERE p.status_leito = 'ativo';

create view public.vw_alertas_abertos with (security_invoker=true) as
 SELECT al.paciente_id,
    p.uti,
    p.leito,
    p.nome,
    count(*) FILTER (WHERE al.severidade = 'critical') AS criticos,
    count(*) FILTER (WHERE al.severidade = 'warning') AS warnings,
    count(*) FILTER (WHERE al.severidade = 'info') AS infos,
    count(*) AS total
   FROM alerts_log al
     JOIN pacientes p ON p.id = al.paciente_id
  WHERE al.acked = false
  GROUP BY al.paciente_id, p.uti, p.leito, p.nome;

create view public.vw_dias_atb_ativo with (security_invoker=true) as
 SELECT paciente_id,
    id AS atb_id,
    droga,
    via,
    frequencia,
    data_inicio,
    intencao,
    foco,
    agente_alvo,
    CURRENT_DATE - data_inicio + 1 AS dias_terapia,
        CASE
            WHEN (CURRENT_DATE - data_inicio + 1) >= 14 THEN 'critical'::text
            WHEN (CURRENT_DATE - data_inicio + 1) >= 7 THEN 'warning'::text
            ELSE 'ok'::text
        END AS stewardship_flag
   FROM atbs a
  WHERE data_fim IS NULL;

create view public.vw_eventos_pendentes_revisao with (security_invoker=true) as
 SELECT id,
    paciente_id,
    evolucao_id,
    user_id,
    ts,
    tipo,
    valor_num,
    valor_json,
    unidade,
    fonte,
    confidence,
    source_text,
    requires_review,
    created_at
   FROM eventos_clinicos
  WHERE requires_review OR COALESCE(confidence, 1::numeric) < 0.7;

CREATE OR REPLACE FUNCTION public.save_ficha(p_paciente_id uuid, p_pac jsonb, p_evol jsonb, p_evolucao_id uuid, p_plantao text, p_pendencias jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_evol_id uuid;
  pend      jsonb;
begin
  update pacientes set
    nome      = coalesce(p_pac->>'nome', nome),
    leito     = coalesce(p_pac->>'leito', leito),
    hd        = p_pac->>'hd',
    idade     = nullif(p_pac->>'idade','')::int,
    peso      = nullif(p_pac->>'peso','')::numeric,
    altura    = nullif(p_pac->>'altura','')::numeric,
    alergias  = p_pac->>'alergias',
    gravidade = coalesce(nullif(p_pac->>'gravidade','')::public.gravidade_enum, gravidade),
    data_adm  = coalesce(nullif(p_pac->>'data_adm','')::date, data_adm)
  where id = p_paciente_id;

  if not found then
    raise exception 'paciente % nao encontrado', p_paciente_id;
  end if;

  if p_evolucao_id is not null then
    update evolucoes set
      neuro             = coalesce(p_evol->'neuro','{}'::jsonb),
      resp              = coalesce(p_evol->'resp','{}'::jsonb),
      hemo              = coalesce(p_evol->'hemo','{}'::jsonb),
      tgi               = coalesce(p_evol->'tgi','{}'::jsonb),
      renal             = coalesce(p_evol->'renal','{}'::jsonb),
      hemato            = coalesce(p_evol->'hemato','{}'::jsonb),
      infecto           = coalesce(p_evol->'infecto','{}'::jsonb),
      dvas              = coalesce(p_evol->'dvas','[]'::jsonb),
      sedativos         = coalesce(p_evol->'sedativos','[]'::jsonb),
      impressao         = coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')), '{}'),
      conduta           = coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')), '{}'),
      problemas_ativos  = coalesce(p_evol->'problemas_ativos','[]'::jsonb),
      condutas_sistemas = coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      riscos            = coalesce(p_evol->'riscos','[]'::jsonb)
    where id = p_evolucao_id
    returning id into v_evol_id;

    if v_evol_id is null then
      raise exception 'evolucao % nao encontrada', p_evolucao_id;
    end if;
  else
    insert into evolucoes (
      paciente_id, data_evolucao, plantao,
      neuro, resp, hemo, tgi, renal, hemato, infecto, dvas, sedativos,
      impressao, conduta, problemas_ativos, condutas_sistemas, riscos, sofa_snapshot
    ) values (
      p_paciente_id, now(), p_plantao::public.plantao_enum,
      coalesce(p_evol->'neuro','{}'::jsonb), coalesce(p_evol->'resp','{}'::jsonb),
      coalesce(p_evol->'hemo','{}'::jsonb), coalesce(p_evol->'tgi','{}'::jsonb),
      coalesce(p_evol->'renal','{}'::jsonb), coalesce(p_evol->'hemato','{}'::jsonb),
      coalesce(p_evol->'infecto','{}'::jsonb), coalesce(p_evol->'dvas','[]'::jsonb),
      coalesce(p_evol->'sedativos','[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')), '{}'),
      coalesce(p_evol->'problemas_ativos','[]'::jsonb),
      coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      coalesce(p_evol->'riscos','[]'::jsonb),
      '{}'::jsonb
    )
    returning id into v_evol_id;
  end if;

  for pend in select * from jsonb_array_elements(coalesce(p_pendencias,'[]'::jsonb)) loop
    if coalesce(pend->>'id','') <> '' then
      update pendencias set
        tarefa       = pend->>'tarefa',
        concluida    = coalesce((pend->>'concluida')::boolean, false),
        concluida_at = case when (pend->>'concluida')::boolean then now() else null end
      where id = (pend->>'id')::uuid;
    elsif coalesce(pend->>'tarefa','') <> '' then
      insert into pendencias (paciente_id, tarefa, prioridade, concluida)
      values (p_paciente_id, pend->>'tarefa', 2, coalesce((pend->>'concluida')::boolean, false));
    end if;
  end loop;

  return v_evol_id;
end;
$function$;
