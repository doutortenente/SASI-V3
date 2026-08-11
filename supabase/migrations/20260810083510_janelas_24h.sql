-- APLICADA no banco vivo em 10-ago-2026. Não editar.
-- ============================================================================
-- SASI V3 · P0 · Migration 006 — Agregados de janela (sinais vitais como JANELAS)
-- 'PAM 90-56 (4/12 <65)' = max-min + excursões numa janela de 24h.
-- Decisão 10/08/26: ingere-se SÓ o agregado (sem as 12 aferições brutas).
-- ============================================================================

CREATE TABLE public.janelas_24h (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  internacao_id  uuid REFERENCES public.internacoes(id) ON DELETE SET NULL,
  evolucao_id    uuid REFERENCES public.evolucoes(id) ON DELETE SET NULL,
  user_id        uuid REFERENCES auth.users(id),
  tipo           text NOT NULL REFERENCES public.evento_tipo_ref(codigo),
  janela_inicio  timestamptz NOT NULL,
  janela_fim     timestamptz NOT NULL,
  valor_max      numeric,
  valor_min      numeric,
  n_total        smallint NOT NULL DEFAULT 12,
  n_fora_alto    smallint,
  n_fora_baixo   smallint,
  limiar_alto    numeric,
  limiar_baixo   numeric,
  fonte          public.fonte_evento_enum NOT NULL DEFAULT 'manual',
  confidence     numeric CHECK (confidence >= 0 AND confidence <= 1),
  source_text    text,
  requires_review boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT janela_ordem_chk    CHECK (janela_fim > janela_inicio),
  CONSTRAINT janela_minmax_chk   CHECK (valor_max IS NULL OR valor_min IS NULL OR valor_max >= valor_min),
  CONSTRAINT janela_n_chk        CHECK (
        (n_fora_alto  IS NULL OR n_fora_alto  <= n_total)
    AND (n_fora_baixo IS NULL OR n_fora_baixo <= n_total)),
  CONSTRAINT janela_limiar_chk   CHECK (
        (n_fora_alto  IS NULL OR n_fora_alto  = 0 OR limiar_alto  IS NOT NULL)
    AND (n_fora_baixo IS NULL OR n_fora_baixo = 0 OR limiar_baixo IS NOT NULL)),
  CONSTRAINT janela_unica UNIQUE (paciente_id, tipo, janela_fim)
);

COMMENT ON TABLE public.janelas_24h IS
  'Agregado de janela de sinais vitais/glicemia: max-min + contagem de excursões. É a forma nativa da nota ("PAM 90-56 (4/12 <65)"). Decisão 10/08/26: só o agregado é ingerido, sem aferições brutas.';

CREATE INDEX janelas_paciente_idx ON public.janelas_24h (paciente_id, tipo, janela_fim DESC);
CREATE INDEX janelas_evolucao_idx ON public.janelas_24h (evolucao_id);

ALTER TABLE public.janelas_24h ENABLE ROW LEVEL SECURITY;
CREATE POLICY dev_bypass ON public.janelas_24h AS PERMISSIVE FOR ALL TO public
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_stamp_internacao BEFORE INSERT ON public.janelas_24h
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_internacao();

CREATE OR REPLACE FUNCTION public.fmt_num(n numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE WHEN n IS NULL THEN NULL
         ELSE regexp_replace(regexp_replace(n::text, '(\.[0-9]*[1-9])0+$', '\1'), '\.0*$', '')
         END;
$function$;

CREATE VIEW public.vw_janelas_24h_render AS
SELECT j.*,
       r.rotulo,
       r.unidade_padrao,
       (public.fmt_num(j.valor_max) || '-' || public.fmt_num(j.valor_min)) AS faixa_txt,
       NULLIF('(' ||
         concat_ws('; ',
           CASE WHEN coalesce(j.n_fora_baixo,0) > 0
                THEN j.n_fora_baixo || '/' || j.n_total || ' <' || public.fmt_num(j.limiar_baixo)
           END,
           CASE WHEN coalesce(j.n_fora_alto,0) > 0
                THEN j.n_fora_alto  || '/' || j.n_total || ' >' || public.fmt_num(j.limiar_alto)
           END)
         || ')', '()')                                                     AS excursoes_txt,
       concat_ws(' ',
         r.rotulo,
         public.fmt_num(j.valor_max) || '-' || public.fmt_num(j.valor_min),
         NULLIF('(' ||
           concat_ws('; ',
             CASE WHEN coalesce(j.n_fora_baixo,0) > 0
                  THEN j.n_fora_baixo || '/' || j.n_total || ' <' || public.fmt_num(j.limiar_baixo)
             END,
             CASE WHEN coalesce(j.n_fora_alto,0) > 0
                  THEN j.n_fora_alto  || '/' || j.n_total || ' >' || public.fmt_num(j.limiar_alto)
             END)
           || ')', '()'))                                                  AS render
  FROM public.janelas_24h j
  JOIN public.evento_tipo_ref r ON r.codigo = j.tipo;
