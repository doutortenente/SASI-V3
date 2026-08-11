-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- ============================================================================
-- SASI V3 · P0 · Migration 002 — Episódios de internação (fim do modelo de episódio único)
-- Backfill: 1 internação por paciente a partir de pacientes.data_adm.
-- Zero-alucinação: int_origem_data fica NULL no backfill (não é conhecida).
-- ============================================================================

CREATE TYPE public.desfecho_internacao_enum AS ENUM
  ('alta_uti','alta_hospitalar','obito','transferencia');

CREATE TABLE public.internacoes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id           uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id),
  int_origem_data       date,
  int_uti_data          date NOT NULL,
  uti                   public.uti_enum,
  reinternacao          boolean NOT NULL DEFAULT false,
  internacao_prev_id    uuid REFERENCES public.internacoes(id),
  desfecho              public.desfecho_internacao_enum,
  desfecho_data         date,
  destino_setor         text,
  destino_especialidade text,
  observacoes           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internacoes_datas_chk CHECK (int_origem_data IS NULL OR int_origem_data <= int_uti_data),
  CONSTRAINT internacoes_desfecho_data_chk CHECK (desfecho_data IS NULL OR desfecho_data >= int_uti_data)
);

COMMENT ON TABLE public.internacoes IS
  'Episódio de internação (hospital + UTI). NULL em desfecho = em curso. Reinternações encadeiam via internacao_prev_id. Substitui o modelo de episódio único de pacientes.data_adm (mantida como legado).';

CREATE UNIQUE INDEX internacoes_uma_aberta_por_paciente
  ON public.internacoes (paciente_id) WHERE desfecho IS NULL;

CREATE INDEX internacoes_paciente_idx ON public.internacoes (paciente_id, int_uti_data DESC);

ALTER TABLE public.internacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY dev_bypass ON public.internacoes AS PERMISSIVE FOR ALL TO public
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_updated_at();

CREATE OR REPLACE FUNCTION public.fn_internacao_reinternacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_prev uuid;
begin
  if new.internacao_prev_id is null then
    select i.id into v_prev
      from public.internacoes i
     where i.paciente_id = new.paciente_id
       and i.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     order by i.int_uti_data desc, i.created_at desc
     limit 1;
    if v_prev is not null then
      new.internacao_prev_id := v_prev;
      new.reinternacao := true;
    end if;
  end if;
  return new;
end;
$function$;

CREATE TRIGGER trg_internacao_reinternacao BEFORE INSERT ON public.internacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_internacao_reinternacao();

INSERT INTO public.internacoes
  (paciente_id, user_id, int_origem_data, int_uti_data, uti, desfecho)
SELECT p.id,
       p.user_id,
       NULL,
       p.data_adm,
       p.uti,
       CASE p.status_leito
         WHEN 'ativo'         THEN NULL
         WHEN 'alta'          THEN 'alta_uti'::public.desfecho_internacao_enum
         WHEN 'obito'         THEN 'obito'::public.desfecho_internacao_enum
         WHEN 'transferencia' THEN 'transferencia'::public.desfecho_internacao_enum
       END
FROM public.pacientes p;

ALTER TABLE public.evolucoes        ADD COLUMN internacao_id uuid REFERENCES public.internacoes(id) ON DELETE SET NULL;
ALTER TABLE public.atbs             ADD COLUMN internacao_id uuid REFERENCES public.internacoes(id) ON DELETE SET NULL;
ALTER TABLE public.culturas         ADD COLUMN internacao_id uuid REFERENCES public.internacoes(id) ON DELETE SET NULL;
ALTER TABLE public.eventos_clinicos ADD COLUMN internacao_id uuid REFERENCES public.internacoes(id) ON DELETE SET NULL;
ALTER TABLE public.pendencias       ADD COLUMN internacao_id uuid REFERENCES public.internacoes(id) ON DELETE SET NULL;

UPDATE public.evolucoes        t SET internacao_id = i.id FROM public.internacoes i WHERE i.paciente_id = t.paciente_id AND t.internacao_id IS NULL;
UPDATE public.atbs             t SET internacao_id = i.id FROM public.internacoes i WHERE i.paciente_id = t.paciente_id AND t.internacao_id IS NULL;
UPDATE public.culturas         t SET internacao_id = i.id FROM public.internacoes i WHERE i.paciente_id = t.paciente_id AND t.internacao_id IS NULL;
UPDATE public.eventos_clinicos t SET internacao_id = i.id FROM public.internacoes i WHERE i.paciente_id = t.paciente_id AND t.internacao_id IS NULL;
UPDATE public.pendencias       t SET internacao_id = i.id FROM public.internacoes i WHERE i.paciente_id = t.paciente_id AND t.internacao_id IS NULL;

CREATE INDEX evolucoes_internacao_idx        ON public.evolucoes (internacao_id);
CREATE INDEX atbs_internacao_idx             ON public.atbs (internacao_id);
CREATE INDEX culturas_internacao_idx         ON public.culturas (internacao_id);
CREATE INDEX eventos_clinicos_internacao_idx ON public.eventos_clinicos (internacao_id);
CREATE INDEX pendencias_internacao_idx       ON public.pendencias (internacao_id);

CREATE OR REPLACE FUNCTION public.fn_internacao_atual(p_paciente uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select i.id from public.internacoes i
   where i.paciente_id = p_paciente and i.desfecho is null
   order by i.int_uti_data desc, i.created_at desc
   limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.fn_stamp_internacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if new.internacao_id is null and new.paciente_id is not null then
    new.internacao_id := public.fn_internacao_atual(new.paciente_id);
  end if;
  return new;
end;
$function$;

CREATE TRIGGER trg_stamp_internacao BEFORE INSERT ON public.evolucoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_internacao();
CREATE TRIGGER trg_stamp_internacao BEFORE INSERT ON public.atbs
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_internacao();
CREATE TRIGGER trg_stamp_internacao BEFORE INSERT ON public.culturas
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_internacao();
CREATE TRIGGER trg_stamp_internacao BEFORE INSERT ON public.eventos_clinicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_internacao();
CREATE TRIGGER trg_stamp_internacao BEFORE INSERT ON public.pendencias
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_internacao();

CREATE OR REPLACE FUNCTION public.fn_paciente_internacao_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
begin
  if tg_op = 'INSERT' then
    insert into public.internacoes (paciente_id, user_id, int_uti_data, uti, desfecho)
    values (new.id, new.user_id, coalesce(new.data_adm, current_date), new.uti,
            case new.status_leito
              when 'ativo'         then null
              when 'alta'          then 'alta_uti'::public.desfecho_internacao_enum
              when 'obito'         then 'obito'::public.desfecho_internacao_enum
              when 'transferencia' then 'transferencia'::public.desfecho_internacao_enum
            end);
  elsif tg_op = 'UPDATE' then
    if old.status_leito = 'ativo' and new.status_leito <> 'ativo' then
      update public.internacoes
         set desfecho = case new.status_leito
                          when 'alta'          then 'alta_uti'::public.desfecho_internacao_enum
                          when 'obito'         then 'obito'::public.desfecho_internacao_enum
                          when 'transferencia' then 'transferencia'::public.desfecho_internacao_enum
                        end,
             desfecho_data = current_date
       where paciente_id = new.id and desfecho is null;
    elsif old.status_leito <> 'ativo' and new.status_leito = 'ativo'
          and public.fn_internacao_atual(new.id) is null then
      insert into public.internacoes (paciente_id, user_id, int_uti_data, uti)
      values (new.id, new.user_id, current_date, new.uti);
    end if;
  end if;
  return new;
end;
$function$;

CREATE TRIGGER trg_paciente_internacao_ins AFTER INSERT ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_paciente_internacao_sync();

CREATE TRIGGER trg_paciente_internacao_upd AFTER UPDATE ON public.pacientes
  FOR EACH ROW WHEN (old.status_leito IS DISTINCT FROM new.status_leito)
  EXECUTE FUNCTION public.fn_paciente_internacao_sync();

COMMENT ON COLUMN public.pacientes.data_adm IS
  'LEGADO: data de admissão do episódio único. Fonte da verdade agora é internacoes (int_origem_data / int_uti_data). Mantida para compatibilidade do app.';
