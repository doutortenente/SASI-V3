-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- ============================================================================
-- SASI V3 · P0 · Migration 004 — Os dois relógios da nota + identidade clínica
-- data do PLANTÃO ≠ timestamp do sistema; turno Diurna/Noturna (12h);
-- tipo de nota; autor com CRM; illness severity POR NOTA.
-- ============================================================================

CREATE TYPE public.tipo_nota_enum AS ENUM ('admissao','seriada','alta','andar');
CREATE TYPE public.turno_enum     AS ENUM ('diurna','noturna');

ALTER TABLE public.evolucoes
  ADD COLUMN tipo_nota        public.tipo_nota_enum NOT NULL DEFAULT 'seriada',
  ADD COLUMN data_plantao     date,
  ADD COLUMN turno            public.turno_enum,
  ADD COLUMN autor_crm        text,
  ADD COLUMN autor_nome       text,
  ADD COLUMN illness_severity public.gravidade_enum,
  ADD COLUMN finalizada_em    timestamptz;

COMMENT ON COLUMN public.evolucoes.data_plantao IS
  'Data do PLANTÃO (título da nota), não do registro. Noturna iniciada de madrugada pertence ao dia anterior.';
COMMENT ON COLUMN public.evolucoes.turno IS
  'Turno real de 12h: diurna (07-19h) | noturna (19-07h). Substitui plantao (manha/tarde/noite/24h), mantido como legado.';
COMMENT ON COLUMN public.evolucoes.illness_severity IS
  'Illness severity DESTA nota (a de pacientes.gravidade é o estado corrente do leito).';
COMMENT ON COLUMN public.evolucoes.finalizada_em IS
  'Fechamento da nota (corpus: rascunho fica aberto de minutos a 24h). data_evolucao/created_at = abertura.';

UPDATE public.evolucoes e
   SET turno = CASE WHEN e.plantao = 'noite' THEN 'noturna'::public.turno_enum
                    ELSE 'diurna'::public.turno_enum END,
       data_plantao =
         CASE
           WHEN e.plantao = 'noite'
                AND extract(hour from (e.data_evolucao AT TIME ZONE 'America/Sao_Paulo')) < 7
             THEN ((e.data_evolucao AT TIME ZONE 'America/Sao_Paulo')::date - 1)
           ELSE (e.data_evolucao AT TIME ZONE 'America/Sao_Paulo')::date
         END
 WHERE e.data_plantao IS NULL;

ALTER TABLE public.evolucoes
  ALTER COLUMN data_plantao SET NOT NULL,
  ALTER COLUMN turno        SET NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_evolucao_relogios()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_local timestamp;
  v_hora  int;
begin
  v_local := coalesce(new.data_evolucao, now()) AT TIME ZONE 'America/Sao_Paulo';
  v_hora  := extract(hour from v_local);

  if new.turno is null then
    if new.plantao = 'noite' then
      new.turno := 'noturna';
    elsif new.plantao in ('manha','tarde','plantao_24h') then
      new.turno := 'diurna';
    else
      new.turno := case when v_hora >= 7 and v_hora < 19 then 'diurna' else 'noturna' end;
    end if;
  end if;

  if new.data_plantao is null then
    new.data_plantao := case
      when new.turno = 'noturna' and v_hora < 7 then v_local::date - 1
      else v_local::date
    end;
  end if;

  return new;
end;
$function$;

CREATE TRIGGER trg_evolucao_relogios BEFORE INSERT ON public.evolucoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_evolucao_relogios();

CREATE INDEX evolucoes_plantao_idx ON public.evolucoes (paciente_id, data_plantao DESC, turno);

COMMENT ON COLUMN public.evolucoes.plantao IS
  'LEGADO: manha/tarde/noite/plantao_24h. Fonte da verdade agora é turno + data_plantao.';
