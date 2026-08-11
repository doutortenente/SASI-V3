-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- ============================================================================
-- SASI V3 · P0 · Migration 001 — Enum de gravidade alinhado à prática
-- estavel | moderado | grave | critico | obito  →  estavel | watcher | instavel | critico
-- Decisão 10/08/26: migração automática (moderado→watcher, grave→instavel).
-- 'obito' sai do enum: desfecho vive em status_leito / internacoes.
-- ============================================================================

UPDATE public.pacientes
   SET status_leito = 'obito'
 WHERE gravidade::text = 'obito'
   AND status_leito <> 'obito';

CREATE TYPE public.gravidade_v3_enum AS ENUM ('estavel','watcher','instavel','critico');

DROP VIEW IF EXISTS public.vw_dashboard_uti;

ALTER TABLE public.pacientes ALTER COLUMN gravidade DROP DEFAULT;

ALTER TABLE public.pacientes
  ALTER COLUMN gravidade TYPE public.gravidade_v3_enum
  USING (CASE gravidade::text
           WHEN 'moderado' THEN 'watcher'
           WHEN 'grave'    THEN 'instavel'
           WHEN 'obito'    THEN 'critico'
           ELSE gravidade::text
         END)::public.gravidade_v3_enum;

DROP TYPE public.gravidade_enum;
ALTER TYPE public.gravidade_v3_enum RENAME TO gravidade_enum;

ALTER TABLE public.pacientes
  ALTER COLUMN gravidade SET DEFAULT 'estavel'::public.gravidade_enum;

CREATE OR REPLACE FUNCTION public.fn_set_severidade_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  new.severidade_visual := case new.gravidade
    when 'critico'  then 'red'
    when 'instavel' then 'red'
    when 'watcher'  then 'yellow'
    else                 'green' end;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION public.sync_severidade_visual()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if (new.gravidade is distinct from old.gravidade) and
     (new.severidade_visual is not distinct from old.severidade_visual) then
    new.severidade_visual := case new.gravidade
      when 'critico'  then 'red'::text
      when 'instavel' then 'red'::text
      when 'watcher'  then 'yellow'::text
      else                 'green'::text
    end;
  end if;
  return new;
end;
$function$;

UPDATE public.pacientes p
   SET severidade_visual = (case p.gravidade
                              when 'critico'  then 'red'
                              when 'instavel' then 'red'
                              when 'watcher'  then 'yellow'
                              else                 'green'
                            end)::public.severidade_visual_enum
 WHERE p.severidade_visual IS DISTINCT FROM
       (case p.gravidade
          when 'critico'  then 'red'
          when 'instavel' then 'red'
          when 'watcher'  then 'yellow'
          else                 'green'
        end)::public.severidade_visual_enum;

CREATE VIEW public.vw_dashboard_uti AS
 WITH ultima_evol AS (
         SELECT DISTINCT ON (e.paciente_id) e.paciente_id,
            e.id AS evolucao_id,
            e.data_evolucao AS ultima_evolucao,
            e.sofa_total,
            e.sofa_snapshot,
            e.dvas,
            e.sedativos
           FROM public.evolucoes e
          ORDER BY e.paciente_id, e.data_evolucao DESC
        ), sofa_24h_atras AS (
         SELECT DISTINCT ON (ec.paciente_id) ec.paciente_id,
            ec.valor_num AS sofa_total_24h
           FROM public.eventos_clinicos ec
          WHERE ec.tipo = 'sofa_total'::text AND ec.ts <= (now() - '24:00:00'::interval)
          ORDER BY ec.paciente_id, ec.ts DESC
        ), pend_abertas AS (
         SELECT pendencias.paciente_id,
            count(*)::integer AS pendencias_abertas
           FROM public.pendencias
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
   FROM public.pacientes p
     LEFT JOIN ultima_evol u ON u.paciente_id = p.id
     LEFT JOIN sofa_24h_atras s24 ON s24.paciente_id = p.id
     LEFT JOIN pend_abertas pa ON pa.paciente_id = p.id
  WHERE p.status_leito = 'ativo'::public.status_leito_enum;

COMMENT ON COLUMN public.pacientes.gravidade IS
  'Illness severity da prática: estavel | watcher | instavel | critico. Desfecho (obito/alta/transf) vive em status_leito e internacoes.desfecho. Migrado em 10/08/26 (moderado→watcher, grave→instavel).';
