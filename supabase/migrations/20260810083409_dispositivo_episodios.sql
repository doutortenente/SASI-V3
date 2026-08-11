-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- ============================================================================
-- SASI V3 · P0 · Migration 003 — Dispositivos como episódios com janela
-- Decisão 10/08/26: as chavinhas de pacientes.dispositivos ACENDEM SOZINHAS —
-- derivadas de episódios + atbs + DVAs/sedativos da última evolução.
-- ============================================================================

CREATE TYPE public.dispositivo_tipo_enum AS ENUM
  ('iot','traqueo','cvc','picc','arterial','svd','sne','sng','dreno','gtt','trr','marca_passo','outro');

CREATE TYPE public.dispositivo_motivo_fim_enum AS ENUM
  ('eletivo','infeccao','troca','disfuncao','alta','obito','outro');

CREATE TABLE public.dispositivo_episodios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  internacao_id uuid REFERENCES public.internacoes(id) ON DELETE SET NULL,
  user_id       uuid REFERENCES auth.users(id),
  tipo          public.dispositivo_tipo_enum NOT NULL,
  sitio         text,
  data_inicio   date NOT NULL,
  data_fim      date,
  motivo_fim    public.dispositivo_motivo_fim_enum,
  observacoes   text,
  source_text   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispositivo_janela_chk CHECK (data_fim IS NULL OR data_fim >= data_inicio),
  CONSTRAINT dispositivo_motivo_chk CHECK (motivo_fim IS NULL OR data_fim IS NOT NULL)
);

COMMENT ON TABLE public.dispositivo_episodios IS
  'Um registro por dispositivo por janela de uso. Render: aberto = "sim (dd/mm)", fechado = "não (dd/mm a dd/mm)". Dias de uso = hoje − data_inicio (nunca digitado).';

CREATE INDEX dispositivo_epis_paciente_idx ON public.dispositivo_episodios (paciente_id, tipo);
CREATE INDEX dispositivo_epis_abertos_idx  ON public.dispositivo_episodios (paciente_id) WHERE data_fim IS NULL;

ALTER TABLE public.dispositivo_episodios ENABLE ROW LEVEL SECURITY;
CREATE POLICY dev_bypass ON public.dispositivo_episodios AS PERMISSIVE FOR ALL TO public
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.dispositivo_episodios
  FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE TRIGGER trg_stamp_internacao BEFORE INSERT ON public.dispositivo_episodios
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_internacao();

CREATE VIEW public.vw_dispositivos_ativos AS
SELECT de.paciente_id,
       de.internacao_id,
       de.id AS episodio_id,
       de.tipo,
       de.sitio,
       de.data_inicio,
       (CURRENT_DATE - de.data_inicio) + 1 AS dias_em_uso
  FROM public.dispositivo_episodios de
 WHERE de.data_fim IS NULL;

CREATE OR REPLACE FUNCTION public.fn_refresh_dispositivos(p_paciente uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_dva boolean;
  v_sed boolean;
begin
  select coalesce(jsonb_array_length(e.dvas), 0) > 0,
         coalesce(jsonb_array_length(e.sedativos), 0) > 0
    into v_dva, v_sed
    from public.evolucoes e
   where e.paciente_id = p_paciente
   order by e.data_evolucao desc
   limit 1;

  update public.pacientes p
     set dispositivos = jsonb_build_object(
           'mv',  exists (select 1 from public.dispositivo_episodios d
                           where d.paciente_id = p_paciente and d.data_fim is null
                             and d.tipo in ('iot','traqueo')),
           'cvc', exists (select 1 from public.dispositivo_episodios d
                           where d.paciente_id = p_paciente and d.data_fim is null
                             and d.tipo in ('cvc','picc')),
           'trr', exists (select 1 from public.dispositivo_episodios d
                           where d.paciente_id = p_paciente and d.data_fim is null
                             and d.tipo = 'trr'),
           'atb', exists (select 1 from public.atbs a
                           where a.paciente_id = p_paciente and a.data_fim is null),
           'dva', coalesce(v_dva, false),
           'sed', coalesce(v_sed, false),
           'picc',     exists (select 1 from public.dispositivo_episodios d
                                where d.paciente_id = p_paciente and d.data_fim is null and d.tipo = 'picc'),
           'arterial', exists (select 1 from public.dispositivo_episodios d
                                where d.paciente_id = p_paciente and d.data_fim is null and d.tipo = 'arterial'),
           'svd',      exists (select 1 from public.dispositivo_episodios d
                                where d.paciente_id = p_paciente and d.data_fim is null and d.tipo = 'svd'),
           'sne_sng',  exists (select 1 from public.dispositivo_episodios d
                                where d.paciente_id = p_paciente and d.data_fim is null and d.tipo in ('sne','sng')),
           'dreno',    exists (select 1 from public.dispositivo_episodios d
                                where d.paciente_id = p_paciente and d.data_fim is null and d.tipo = 'dreno'),
           'gtt',      exists (select 1 from public.dispositivo_episodios d
                                where d.paciente_id = p_paciente and d.data_fim is null and d.tipo = 'gtt')
         ),
         updated_at = now()
   where p.id = p_paciente;
end;
$function$;

CREATE OR REPLACE FUNCTION public.fn_trg_refresh_dispositivos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  perform public.fn_refresh_dispositivos(coalesce(new.paciente_id, old.paciente_id));
  if tg_op = 'UPDATE' and new.paciente_id is distinct from old.paciente_id then
    perform public.fn_refresh_dispositivos(old.paciente_id);
  end if;
  return coalesce(new, old);
end;
$function$;

CREATE TRIGGER trg_refresh_dispositivos AFTER INSERT OR UPDATE OR DELETE
  ON public.dispositivo_episodios
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_refresh_dispositivos();

CREATE TRIGGER trg_refresh_dispositivos_atb AFTER INSERT OR UPDATE OR DELETE
  ON public.atbs
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_refresh_dispositivos();

CREATE TRIGGER trg_refresh_dispositivos_evol AFTER INSERT OR UPDATE
  ON public.evolucoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_trg_refresh_dispositivos();

COMMENT ON COLUMN public.pacientes.dispositivos IS
  'DERIVADO (não editar à mão — decisão 10/08/26): recalculado por fn_refresh_dispositivos a partir de dispositivo_episodios + atbs ativos + dvas/sedativos da última evolução. Chaves legadas {mv,dva,sed,atb,cvc,trr} + novas {picc,arterial,svd,sne_sng,dreno,gtt}.';
