-- APLICADA no banco vivo em 26-jun-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (8ff54158b4ef8a2904a4f5b6d8b52cdb). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
CREATE SCHEMA IF NOT EXISTS "public";
ALTER SCHEMA "public" OWNER TO "pg_database_owner";
COMMENT ON SCHEMA "public" IS 'standard public schema';
CREATE TYPE "public"."gravidade_enum" AS ENUM (
    'estavel',
    'moderado',
    'grave',
    'critico',
    'obito'
);
ALTER TYPE "public"."gravidade_enum" OWNER TO "postgres";
CREATE TYPE "public"."status_leito_enum" AS ENUM (
    'ativo',
    'alta',
    'obito',
    'transferencia'
);
ALTER TYPE "public"."status_leito_enum" OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."fn_alert_hash"("p_paciente_id" "uuid", "p_tipo" "text", "p_payload" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_catalog'
    AS $$
begin
  return encode(
    extensions.digest(
      p_paciente_id::text
        || '|' || p_tipo
        || '|' || coalesce(p_payload::text, '')
        || '|' || to_char(now(), 'YYYY-MM-DD'),
      'sha256'
    ),
    'hex'
  );
end;
$$;
ALTER FUNCTION "public"."fn_alert_hash"("p_paciente_id" "uuid", "p_tipo" "text", "p_payload" "jsonb") OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."fn_invalidate_sofa_cache"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if (old.resp     is distinct from new.resp)     or
     (old.hemo     is distinct from new.hemo)     or
     (old.renal    is distinct from new.renal)    or
     (old.hemato   is distinct from new.hemato)   or
     (old.tgi      is distinct from new.tgi)      or
     (old.neuro    is distinct from new.neuro)    or
     (old.dvas     is distinct from new.dvas)     or
     (old.sedativos is distinct from new.sedativos) then
    new.sofa_snapshot = null;
    new.sofa_total = null;
  end if;
  return new;
end;
$$;
ALTER FUNCTION "public"."fn_invalidate_sofa_cache"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."fn_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;
ALTER FUNCTION "public"."fn_updated_at"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."match_memorias"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" bigint, "conteudo" "text", "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  select m.id, m.conteudo,
         1 - (m.embedding <=> query_embedding) as similarity
  from memorias m
  where 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
ALTER FUNCTION "public"."match_memorias"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;
ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION "public"."sync_severidade_visual"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if (new.gravidade is distinct from old.gravidade) and
     (new.severidade_visual is not distinct from old.severidade_visual) then
    new.severidade_visual := case new.gravidade
      when 'critico'  then 'red'::text
      when 'grave'    then 'red'::text
      when 'moderado' then 'yellow'::text
      else                 'green'::text
    end;
  end if;
  return new;
end;
$$;
ALTER FUNCTION "public"."sync_severidade_visual"() OWNER TO "postgres";
SET default_tablespace = '';
SET default_table_access_method = "heap";
CREATE TABLE IF NOT EXISTS "public"."alerts_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "evento_id" "uuid",
    "user_id" "uuid",
    "tipo" "text" NOT NULL,
    "severidade" "text" DEFAULT 'warning'::"text" NOT NULL,
    "mensagem" "text" NOT NULL,
    "payload" "jsonb",
    "hash_key" "text" NOT NULL,
    "acked" boolean DEFAULT false NOT NULL,
    "acked_at" timestamp with time zone,
    "acked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alerts_log_severidade_check" CHECK (("severidade" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"])))
);
ALTER TABLE "public"."alerts_log" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."antibiograma" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cultura_id" "uuid" NOT NULL,
    "antibiotico" "text" NOT NULL,
    "resultado" "text" NOT NULL,
    "cim" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "antibiograma_resultado_check" CHECK (("resultado" = ANY (ARRAY['S'::"text", 'I'::"text", 'R'::"text"])))
);
ALTER TABLE "public"."antibiograma" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."atbs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "droga" "text" NOT NULL,
    "dose" "text",
    "via" "text",
    "frequencia" "text",
    "data_inicio" "date" DEFAULT CURRENT_DATE NOT NULL,
    "data_fim" "date",
    "intencao" "text",
    "foco" "text",
    "agente_alvo" "text",
    "motivo_suspensao" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "atbs_intencao_check" CHECK (("intencao" = ANY (ARRAY['empirica'::"text", 'dirigida'::"text", 'profilatica'::"text"]))),
    CONSTRAINT "atbs_via_check" CHECK (("via" = ANY (ARRAY['EV'::"text", 'VO'::"text", 'IM'::"text", 'SC'::"text", 'SNE'::"text", 'SNG'::"text", 'IT'::"text", 'Tópico'::"text"]))),
    CONSTRAINT "chk_atb_datas_coerentes" CHECK ((("data_fim" IS NULL) OR ("data_fim" >= "data_inicio")))
);
ALTER TABLE "public"."atbs" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."culturas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "material" "text" NOT NULL,
    "coleta_ts" timestamp with time zone NOT NULL,
    "laudo_ts" timestamp with time zone,
    "crescimento" boolean DEFAULT false NOT NULL,
    "agente" "text",
    "ufc_por_ml" numeric,
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_cultura_laudo_apos_coleta" CHECK ((("laudo_ts" IS NULL) OR ("laudo_ts" >= "coleta_ts"))),
    CONSTRAINT "culturas_material_check" CHECK (("material" = ANY (ARRAY['hemocultura'::"text", 'urocultura'::"text", 'aspirado_traqueal'::"text", 'lavado_bal'::"text", 'lcr'::"text", 'secrecao_ferida'::"text", 'liquido_peritoneal'::"text", 'liquido_pleural'::"text", 'outro'::"text"])))
);
ALTER TABLE "public"."culturas" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."eventos_clinicos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "evolucao_id" "uuid",
    "user_id" "uuid",
    "ts" timestamp with time zone NOT NULL,
    "tipo" "text" NOT NULL,
    "valor_num" numeric,
    "valor_json" "jsonb",
    "unidade" "text",
    "fonte" "text" NOT NULL,
    "confidence" numeric(3,2),
    "source_text" "text",
    "requires_review" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_eventos_valor_not_empty" CHECK ((("valor_num" IS NOT NULL) OR ("valor_json" IS NOT NULL))),
    CONSTRAINT "eventos_clinicos_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "eventos_clinicos_fonte_check" CHECK (("fonte" = ANY (ARRAY['manual'::"text", 'gemini_ocr'::"text", 'claude_ocr'::"text", 'appsheet'::"text", 'auto_trigger'::"text", 'edge_function'::"text", 'api_import'::"text"]))),
    CONSTRAINT "eventos_clinicos_tipo_check" CHECK (("tipo" = ANY (ARRAY['sofa_total'::"text", 'sofa_resp'::"text", 'sofa_coag'::"text", 'sofa_liver'::"text", 'sofa_cardio'::"text", 'sofa_neuro'::"text", 'sofa_renal'::"text", 'pam'::"text", 'pam_min'::"text", 'pa_sys'::"text", 'pa_dia'::"text", 'pf_ratio'::"text", 'spo2'::"text", 'fr'::"text", 'fc'::"text", 'temp'::"text", 'lactato'::"text", 'ph'::"text", 'pco2'::"text", 'po2'::"text", 'hco3'::"text", 'be'::"text", 'diurese_h'::"text", 'bh_h'::"text", 'bh_acumulado'::"text", 'hb'::"text", 'ht'::"text", 'plaq'::"text", 'leuco'::"text", 'cr'::"text", 'ur'::"text", 'na'::"text", 'k'::"text", 'mg'::"text", 'ca'::"text", 'p'::"text", 'bb'::"text", 'inr'::"text", 'pcr'::"text", 'procalcitonina'::"text", 'nor_dose'::"text", 'adr_dose'::"text", 'vaso_dose'::"text", 'dobuta_dose'::"text", 'dopa_dose'::"text", 'fent_dose'::"text", 'midaz_dose'::"text", 'propofol_dose'::"text", 'precedex_dose'::"text", 'gcs'::"text", 'rass'::"text", 'cam_icu'::"text", 'bps'::"text", 'cpot'::"text", 'glicemia'::"text", 'custom'::"text"])))
);
ALTER TABLE "public"."eventos_clinicos" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."evolucoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "data_evolucao" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plantao" "text" DEFAULT 'manha'::"text" NOT NULL,
    "neuro" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "resp" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "hemo" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tgi" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "renal" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "hemato" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "infecto" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dvas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sedativos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "impressao" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "conduta" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "sofa_snapshot" "jsonb",
    "sofa_total" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prescricao" "jsonb" DEFAULT '{}'::"jsonb",
    "problemas_ativos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "condutas_sistemas" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "riscos" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "evolucoes_plantao_check" CHECK (("plantao" = ANY (ARRAY['manha'::"text", 'tarde'::"text", 'noite'::"text", 'plantao_24h'::"text"]))),
    CONSTRAINT "evolucoes_sofa_total_check" CHECK ((("sofa_total" >= 0) AND ("sofa_total" <= 24)))
);
ALTER TABLE "public"."evolucoes" OWNER TO "postgres";
COMMENT ON COLUMN "public"."evolucoes"."prescricao" IS 'Kardex/prescricao vigente estruturada por categoria (cardiovascular, snc, gastro_endocrino, infeccioso_resp, sintomaticos_sn, solucoes_diureticos, nutricao). Cada categoria e um array de strings com a prescricao.';
COMMENT ON COLUMN "public"."evolucoes"."problemas_ativos" IS 'SASI v2.0 — problemas ativos estruturados [{texto, sistema?, gravidade?}]';
COMMENT ON COLUMN "public"."evolucoes"."condutas_sistemas" IS 'SASI v2.0 — condutas por sistema [{sistema, texto, meta?, prazo?}]';
COMMENT ON COLUMN "public"."evolucoes"."riscos" IS 'SASI v2.0 — riscos clínicos [{texto, nivel?}]';
CREATE TABLE IF NOT EXISTS "public"."ingest_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "paciente_id" "uuid",
    "source_type" "text",
    "fonte" "text",
    "payload_raw" "jsonb",
    "response" "jsonb",
    "eventos_ids" "uuid"[],
    "warnings" "text"[],
    "ok" boolean NOT NULL,
    "error_msg" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."ingest_audit_log" OWNER TO "postgres";
CREATE TABLE IF NOT EXISTS "public"."memorias" (
    "id" bigint NOT NULL,
    "conteudo" "text" NOT NULL,
    "metadata" "jsonb",
    "embedding" "public"."vector"(768),
    "created_at" timestamp with time zone DEFAULT "now"()
);
ALTER TABLE "public"."memorias" OWNER TO "postgres";
ALTER TABLE "public"."memorias" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."memorias_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
CREATE TABLE IF NOT EXISTS "public"."pacientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "leito" "text" NOT NULL,
    "uti" "text" NOT NULL,
    "nome" "text" NOT NULL,
    "idade" integer,
    "peso" numeric(5,2),
    "altura" numeric(5,2),
    "hd" "text",
    "data_adm" "date" DEFAULT CURRENT_DATE NOT NULL,
    "alergias" "text",
    "gravidade" "text" DEFAULT 'estavel'::"text" NOT NULL,
    "status_leito" "text" DEFAULT 'ativo'::"text" NOT NULL,
    "sofa_baseline" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dispositivos" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "isolation" "text" DEFAULT 'none'::"text" NOT NULL,
    "out_of_range_count" integer DEFAULT 0 NOT NULL,
    "severidade_visual" "text" DEFAULT 'green'::"text" NOT NULL,
    "patient_summary" "jsonb",
    "imc" numeric GENERATED ALWAYS AS ("round"(("peso" / (("altura" / (100)::numeric) * ("altura" / (100)::numeric))), 1)) STORED,
    CONSTRAINT "pacientes_altura_check" CHECK ((("altura" >= (30)::numeric) AND ("altura" <= (250)::numeric))),
    CONSTRAINT "pacientes_gravidade_check" CHECK (("gravidade" = ANY (ARRAY['estavel'::"text", 'moderado'::"text", 'grave'::"text", 'critico'::"text", 'obito'::"text"]))),
    CONSTRAINT "pacientes_idade_check" CHECK ((("idade" >= 0) AND ("idade" <= 130))),
    CONSTRAINT "pacientes_isolation_check" CHECK (("isolation" = ANY (ARRAY['none'::"text", 'contact'::"text", 'droplet'::"text", 'aerosol'::"text"]))),
    CONSTRAINT "pacientes_nome_check" CHECK ((("char_length"("nome") >= 1) AND ("char_length"("nome") <= 200))),
    CONSTRAINT "pacientes_peso_check" CHECK ((("peso" >= (1)::numeric) AND ("peso" <= (400)::numeric))),
    CONSTRAINT "pacientes_severidade_visual_check" CHECK (("severidade_visual" = ANY (ARRAY['red'::"text", 'yellow'::"text", 'green'::"text"]))),
    CONSTRAINT "pacientes_sofa_baseline_check" CHECK ((("sofa_baseline" >= 0) AND ("sofa_baseline" <= 24))),
    CONSTRAINT "pacientes_status_leito_check" CHECK (("status_leito" = ANY (ARRAY['ativo'::"text", 'alta'::"text", 'obito'::"text", 'transferencia'::"text"]))),
    CONSTRAINT "pacientes_uti_check" CHECK (("uti" = ANY (ARRAY['UTI2'::"text", 'UTI3'::"text", 'UTI4'::"text"])))
);
ALTER TABLE "public"."pacientes" OWNER TO "postgres";
COMMENT ON COLUMN "public"."pacientes"."dispositivos" IS 'Dispositivos em uso: {mv, dva, sed, atb, cvc, trr} — booleans';
COMMENT ON COLUMN "public"."pacientes"."isolation" IS 'Precaução de isolamento: none | contact | droplet | aerosol';
COMMENT ON COLUMN "public"."pacientes"."out_of_range_count" IS 'Nº de parâmetros fora do range clínico';
COMMENT ON COLUMN "public"."pacientes"."severidade_visual" IS 'Semáforo clínico: red | yellow | green';
COMMENT ON COLUMN "public"."pacientes"."patient_summary" IS 'Patient Summary (SASI) — resumo persistente da admissão com dispositivos, HPMA, plano terapêutico/metas. Atualizado a cada evolução pontual.';
COMMENT ON COLUMN "public"."pacientes"."imc" IS 'IMC calculado: peso / altura^2. Coluna gerada (STORED), atualiza sozinha.';
CREATE TABLE IF NOT EXISTS "public"."pendencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "paciente_id" "uuid" NOT NULL,
    "evolucao_id" "uuid",
    "user_id" "uuid",
    "tarefa" "text" NOT NULL,
    "prioridade" smallint DEFAULT 2 NOT NULL,
    "concluida" boolean DEFAULT false NOT NULL,
    "concluida_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pendencias_prioridade_check" CHECK ((("prioridade" >= 1) AND ("prioridade" <= 3))),
    CONSTRAINT "pendencias_tarefa_check" CHECK ((("char_length"("tarefa") >= 1) AND ("char_length"("tarefa") <= 500)))
);
ALTER TABLE "public"."pendencias" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."vw_alertas_abertos" WITH ("security_invoker"='true') AS
 SELECT "al"."paciente_id",
    "p"."uti",
    "p"."leito",
    "p"."nome",
    "count"(*) FILTER (WHERE ("al"."severidade" = 'critical'::"text")) AS "criticos",
    "count"(*) FILTER (WHERE ("al"."severidade" = 'warning'::"text")) AS "warnings",
    "count"(*) FILTER (WHERE ("al"."severidade" = 'info'::"text")) AS "infos",
    "count"(*) AS "total"
   FROM ("public"."alerts_log" "al"
     JOIN "public"."pacientes" "p" ON (("p"."id" = "al"."paciente_id")))
  WHERE ("al"."acked" = false)
  GROUP BY "al"."paciente_id", "p"."uti", "p"."leito", "p"."nome";
ALTER VIEW "public"."vw_alertas_abertos" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."vw_bh_acumulado" WITH ("security_invoker"='true') AS
 SELECT "paciente_id",
    "sum"(
        CASE
            WHEN ("ts" >= ("now"() - '24:00:00'::interval)) THEN "valor_num"
            ELSE (0)::numeric
        END) AS "bh_24h",
    "sum"(
        CASE
            WHEN ("ts" >= ("now"() - '48:00:00'::interval)) THEN "valor_num"
            ELSE (0)::numeric
        END) AS "bh_48h",
    "sum"(
        CASE
            WHEN ("ts" >= ("now"() - '72:00:00'::interval)) THEN "valor_num"
            ELSE (0)::numeric
        END) AS "bh_72h",
    "count"(*) FILTER (WHERE ("ts" >= ("now"() - '24:00:00'::interval))) AS "eventos_24h"
   FROM "public"."eventos_clinicos" "ec"
  WHERE ("tipo" = 'bh_h'::"text")
  GROUP BY "paciente_id";
ALTER VIEW "public"."vw_bh_acumulado" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."vw_dashboard_uti" AS
 WITH "ultima_evol" AS (
         SELECT DISTINCT ON ("e"."paciente_id") "e"."paciente_id",
            "e"."id" AS "evolucao_id",
            "e"."data_evolucao" AS "ultima_evolucao",
            "e"."sofa_total",
            "e"."sofa_snapshot",
            "e"."dvas",
            "e"."sedativos"
           FROM "public"."evolucoes" "e"
          ORDER BY "e"."paciente_id", "e"."data_evolucao" DESC
        ), "sofa_24h_atras" AS (
         SELECT DISTINCT ON ("ec"."paciente_id") "ec"."paciente_id",
            "ec"."valor_num" AS "sofa_total_24h"
           FROM "public"."eventos_clinicos" "ec"
          WHERE (("ec"."tipo" = 'sofa_total'::"text") AND ("ec"."ts" <= ("now"() - '24:00:00'::interval)))
          ORDER BY "ec"."paciente_id", "ec"."ts" DESC
        ), "pend_abertas" AS (
         SELECT "pendencias"."paciente_id",
            ("count"(*))::integer AS "pendencias_abertas"
           FROM "public"."pendencias"
          WHERE ("pendencias"."concluida" = false)
          GROUP BY "pendencias"."paciente_id"
        )
 SELECT "p"."id" AS "paciente_id",
    "p"."user_id",
    "p"."leito",
    "p"."uti",
    "p"."nome",
    "p"."idade",
    "p"."peso",
    "p"."hd",
    "p"."gravidade",
    "p"."status_leito",
    "p"."data_adm",
    (CURRENT_DATE - "p"."data_adm") AS "dias_internacao",
    "u"."evolucao_id",
    "u"."ultima_evolucao",
    "u"."sofa_total",
    "u"."sofa_snapshot",
    "u"."dvas",
    "u"."sedativos",
    ((("u"."sofa_total")::numeric - "s24"."sofa_total_24h"))::integer AS "delta_sofa_24h",
    COALESCE("pa"."pendencias_abertas", 0) AS "pendencias_abertas",
    "p"."dispositivos",
    "p"."isolation",
    "p"."out_of_range_count",
    "p"."severidade_visual"
   FROM ((("public"."pacientes" "p"
     LEFT JOIN "ultima_evol" "u" ON (("u"."paciente_id" = "p"."id")))
     LEFT JOIN "sofa_24h_atras" "s24" ON (("s24"."paciente_id" = "p"."id")))
     LEFT JOIN "pend_abertas" "pa" ON (("pa"."paciente_id" = "p"."id")))
  WHERE ("p"."status_leito" = 'ativo'::"text");
ALTER VIEW "public"."vw_dashboard_uti" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."vw_dias_atb_ativo" WITH ("security_invoker"='true') AS
 SELECT "paciente_id",
    "id" AS "atb_id",
    "droga",
    "via",
    "frequencia",
    "data_inicio",
    "intencao",
    "foco",
    "agente_alvo",
    ((CURRENT_DATE - "data_inicio") + 1) AS "dias_terapia",
        CASE
            WHEN (((CURRENT_DATE - "data_inicio") + 1) >= 14) THEN 'critical'::"text"
            WHEN (((CURRENT_DATE - "data_inicio") + 1) >= 7) THEN 'warning'::"text"
            ELSE 'ok'::"text"
        END AS "stewardship_flag"
   FROM "public"."atbs" "a"
  WHERE ("data_fim" IS NULL);
ALTER VIEW "public"."vw_dias_atb_ativo" OWNER TO "postgres";
CREATE OR REPLACE VIEW "public"."vw_sofa_trend_72h" WITH ("security_invoker"='true') AS
 SELECT "paciente_id",
    "ts",
    "valor_num" AS "sofa_total"
   FROM "public"."eventos_clinicos" "ec"
  WHERE (("tipo" = 'sofa_total'::"text") AND ("ts" >= ("now"() - '72:00:00'::interval)))
  ORDER BY "paciente_id", "ts";
ALTER VIEW "public"."vw_sofa_trend_72h" OWNER TO "postgres";
ALTER TABLE ONLY "public"."alerts_log"
    ADD CONSTRAINT "alerts_log_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."antibiograma"
    ADD CONSTRAINT "antibiograma_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."atbs"
    ADD CONSTRAINT "atbs_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."culturas"
    ADD CONSTRAINT "culturas_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."eventos_clinicos"
    ADD CONSTRAINT "eventos_clinicos_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."evolucoes"
    ADD CONSTRAINT "evolucoes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."ingest_audit_log"
    ADD CONSTRAINT "ingest_audit_log_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."memorias"
    ADD CONSTRAINT "memorias_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "public"."pendencias"
    ADD CONSTRAINT "pendencias_pkey" PRIMARY KEY ("id");
CREATE INDEX "idx_alerts_pac_ack" ON "public"."alerts_log" USING "btree" ("paciente_id", "acked", "created_at" DESC);
CREATE INDEX "idx_alerts_severidade" ON "public"."alerts_log" USING "btree" ("severidade", "created_at" DESC) WHERE ("acked" = false);
CREATE INDEX "idx_antibiograma_cultura" ON "public"."antibiograma" USING "btree" ("cultura_id");
CREATE INDEX "idx_atbs_droga" ON "public"."atbs" USING "btree" ("droga");
CREATE INDEX "idx_atbs_pac_ativo" ON "public"."atbs" USING "btree" ("paciente_id", "data_inicio" DESC) WHERE ("data_fim" IS NULL);
CREATE INDEX "idx_culturas_agente" ON "public"."culturas" USING "btree" ("agente") WHERE ("agente" IS NOT NULL);
CREATE INDEX "idx_culturas_pac_coleta" ON "public"."culturas" USING "btree" ("paciente_id", "coleta_ts" DESC);
CREATE INDEX "idx_eventos_evolucao" ON "public"."eventos_clinicos" USING "btree" ("evolucao_id") WHERE ("evolucao_id" IS NOT NULL);
CREATE INDEX "idx_eventos_pac_tipo_ts" ON "public"."eventos_clinicos" USING "btree" ("paciente_id", "tipo", "ts" DESC);
CREATE INDEX "idx_eventos_pac_ts" ON "public"."eventos_clinicos" USING "btree" ("paciente_id", "ts" DESC);
CREATE INDEX "idx_eventos_review" ON "public"."eventos_clinicos" USING "btree" ("requires_review", "created_at" DESC) WHERE ("requires_review" = true);
CREATE INDEX "idx_eventos_tipo_ts" ON "public"."eventos_clinicos" USING "btree" ("tipo", "ts" DESC);
CREATE INDEX "idx_evolucoes_dvas_gin" ON "public"."evolucoes" USING "gin" ("dvas");
CREATE INDEX "idx_evolucoes_infecto_gin" ON "public"."evolucoes" USING "gin" ("infecto");
CREATE INDEX "idx_evolucoes_paciente_data" ON "public"."evolucoes" USING "btree" ("paciente_id", "data_evolucao" DESC);
CREATE INDEX "idx_evolucoes_user" ON "public"."evolucoes" USING "btree" ("user_id");
CREATE INDEX "idx_ingest_audit_falhas" ON "public"."ingest_audit_log" USING "btree" ("created_at" DESC) WHERE ("ok" = false);
CREATE INDEX "idx_ingest_audit_pac" ON "public"."ingest_audit_log" USING "btree" ("paciente_id", "created_at" DESC);
CREATE INDEX "idx_pacientes_isolation" ON "public"."pacientes" USING "btree" ("isolation") WHERE ("isolation" <> 'none'::"text");
CREATE INDEX "idx_pacientes_nome_trgm" ON "public"."pacientes" USING "gin" ("nome" "public"."gin_trgm_ops");
CREATE INDEX "idx_pacientes_severidade" ON "public"."pacientes" USING "btree" ("severidade_visual");
CREATE INDEX "idx_pacientes_status" ON "public"."pacientes" USING "btree" ("status_leito", "updated_at" DESC);
CREATE INDEX "idx_pacientes_user" ON "public"."pacientes" USING "btree" ("user_id");
CREATE INDEX "idx_pendencias_pac_aberta" ON "public"."pendencias" USING "btree" ("paciente_id") WHERE ("concluida" = false);
CREATE INDEX "idx_pendencias_prioridade" ON "public"."pendencias" USING "btree" ("prioridade", "created_at") WHERE ("concluida" = false);
CREATE INDEX "memorias_embedding_hnsw_idx" ON "public"."memorias" USING "hnsw" ("embedding" "public"."vector_cosine_ops");
CREATE UNIQUE INDEX "uq_alerts_hash" ON "public"."alerts_log" USING "btree" ("hash_key");
CREATE UNIQUE INDEX "uq_antibiograma_cultura_atb" ON "public"."antibiograma" USING "btree" ("cultura_id", "antibiotico");
CREATE UNIQUE INDEX "uq_pacientes_leito_ativo" ON "public"."pacientes" USING "btree" ("uti", "leito") WHERE ("status_leito" = 'ativo'::"text");
CREATE OR REPLACE TRIGGER "trg_sofa_cache_invalidate" BEFORE UPDATE ON "public"."evolucoes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_invalidate_sofa_cache"();
CREATE OR REPLACE TRIGGER "trg_sync_severidade_visual" BEFORE UPDATE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_severidade_visual"();
CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."atbs" FOR EACH ROW EXECUTE FUNCTION "public"."fn_updated_at"();
CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."culturas" FOR EACH ROW EXECUTE FUNCTION "public"."fn_updated_at"();
CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."evolucoes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_updated_at"();
CREATE OR REPLACE TRIGGER "trg_updated_at" BEFORE UPDATE ON "public"."pacientes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_updated_at"();
ALTER TABLE ONLY "public"."alerts_log"
    ADD CONSTRAINT "alerts_log_acked_by_fkey" FOREIGN KEY ("acked_by") REFERENCES "auth"."users"("id");
ALTER TABLE ONLY "public"."alerts_log"
    ADD CONSTRAINT "alerts_log_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "public"."eventos_clinicos"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."alerts_log"
    ADD CONSTRAINT "alerts_log_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."alerts_log"
    ADD CONSTRAINT "alerts_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."antibiograma"
    ADD CONSTRAINT "antibiograma_cultura_id_fkey" FOREIGN KEY ("cultura_id") REFERENCES "public"."culturas"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."atbs"
    ADD CONSTRAINT "atbs_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."atbs"
    ADD CONSTRAINT "atbs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."culturas"
    ADD CONSTRAINT "culturas_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."culturas"
    ADD CONSTRAINT "culturas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."eventos_clinicos"
    ADD CONSTRAINT "eventos_clinicos_evolucao_id_fkey" FOREIGN KEY ("evolucao_id") REFERENCES "public"."evolucoes"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."eventos_clinicos"
    ADD CONSTRAINT "eventos_clinicos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."eventos_clinicos"
    ADD CONSTRAINT "eventos_clinicos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."evolucoes"
    ADD CONSTRAINT "evolucoes_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."evolucoes"
    ADD CONSTRAINT "evolucoes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."ingest_audit_log"
    ADD CONSTRAINT "ingest_audit_log_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."ingest_audit_log"
    ADD CONSTRAINT "ingest_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."pacientes"
    ADD CONSTRAINT "pacientes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."pendencias"
    ADD CONSTRAINT "pendencias_evolucao_id_fkey" FOREIGN KEY ("evolucao_id") REFERENCES "public"."evolucoes"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."pendencias"
    ADD CONSTRAINT "pendencias_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "public"."pacientes"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."pendencias"
    ADD CONSTRAINT "pendencias_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;
CREATE POLICY "alerts_all_own" ON "public"."alerts_log" USING ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "alerts_log"."paciente_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "alerts_log"."paciente_id") AND ("p"."user_id" = "auth"."uid"())))));
ALTER TABLE "public"."alerts_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."antibiograma" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "antibiograma_all_own" ON "public"."antibiograma" USING ((EXISTS ( SELECT 1
   FROM ("public"."culturas" "c"
     JOIN "public"."pacientes" "p" ON (("p"."id" = "c"."paciente_id")))
  WHERE (("c"."id" = "antibiograma"."cultura_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."culturas" "c"
     JOIN "public"."pacientes" "p" ON (("p"."id" = "c"."paciente_id")))
  WHERE (("c"."id" = "antibiograma"."cultura_id") AND ("p"."user_id" = "auth"."uid"())))));
ALTER TABLE "public"."atbs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atbs_all_own" ON "public"."atbs" USING ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "atbs"."paciente_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "atbs"."paciente_id") AND ("p"."user_id" = "auth"."uid"())))));
ALTER TABLE "public"."culturas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "culturas_all_own" ON "public"."culturas" USING ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "culturas"."paciente_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "culturas"."paciente_id") AND ("p"."user_id" = "auth"."uid"())))));
CREATE POLICY "dev_bypass" ON "public"."alerts_log" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."antibiograma" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."atbs" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."culturas" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."eventos_clinicos" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."evolucoes" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."ingest_audit_log" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."pacientes" USING (true) WITH CHECK (true);
CREATE POLICY "dev_bypass" ON "public"."pendencias" USING (true) WITH CHECK (true);
CREATE POLICY "eventos_all_own" ON "public"."eventos_clinicos" USING ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "eventos_clinicos"."paciente_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "eventos_clinicos"."paciente_id") AND ("p"."user_id" = "auth"."uid"())))));
ALTER TABLE "public"."eventos_clinicos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."evolucoes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evolucoes_all_own" ON "public"."evolucoes" USING ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "evolucoes"."paciente_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "evolucoes"."paciente_id") AND ("p"."user_id" = "auth"."uid"())))));
ALTER TABLE "public"."ingest_audit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ingest_audit_own" ON "public"."ingest_audit_log" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."memorias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pacientes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacientes_delete_own" ON "public"."pacientes" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "pacientes_insert_own" ON "public"."pacientes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "pacientes_select_own" ON "public"."pacientes" FOR SELECT USING (("auth"."uid"() = "user_id"));
CREATE POLICY "pacientes_update_own" ON "public"."pacientes" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
ALTER TABLE "public"."pendencias" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pendencias_all_own" ON "public"."pendencias" USING ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "pendencias"."paciente_id") AND ("p"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pacientes" "p"
  WHERE (("p"."id" = "pendencias"."paciente_id") AND ("p"."user_id" = "auth"."uid"())))));
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_alert_hash"("p_paciente_id" "uuid", "p_tipo" "text", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_alert_hash"("p_paciente_id" "uuid", "p_tipo" "text", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_alert_hash"("p_paciente_id" "uuid", "p_tipo" "text", "p_payload" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_invalidate_sofa_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_invalidate_sofa_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_invalidate_sofa_cache"() TO "service_role";
GRANT ALL ON FUNCTION "public"."fn_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."match_memorias"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."match_memorias"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."match_memorias"("query_embedding" "public"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";
REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";
GRANT ALL ON FUNCTION "public"."sync_severidade_visual"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_severidade_visual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_severidade_visual"() TO "service_role";
GRANT ALL ON TABLE "public"."alerts_log" TO "anon";
GRANT ALL ON TABLE "public"."alerts_log" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts_log" TO "service_role";
GRANT ALL ON TABLE "public"."antibiograma" TO "anon";
GRANT ALL ON TABLE "public"."antibiograma" TO "authenticated";
GRANT ALL ON TABLE "public"."antibiograma" TO "service_role";
GRANT ALL ON TABLE "public"."atbs" TO "anon";
GRANT ALL ON TABLE "public"."atbs" TO "authenticated";
GRANT ALL ON TABLE "public"."atbs" TO "service_role";
GRANT ALL ON TABLE "public"."culturas" TO "anon";
GRANT ALL ON TABLE "public"."culturas" TO "authenticated";
GRANT ALL ON TABLE "public"."culturas" TO "service_role";
GRANT ALL ON TABLE "public"."eventos_clinicos" TO "anon";
GRANT ALL ON TABLE "public"."eventos_clinicos" TO "authenticated";
GRANT ALL ON TABLE "public"."eventos_clinicos" TO "service_role";
GRANT ALL ON TABLE "public"."evolucoes" TO "anon";
GRANT ALL ON TABLE "public"."evolucoes" TO "authenticated";
GRANT ALL ON TABLE "public"."evolucoes" TO "service_role";
GRANT ALL ON TABLE "public"."ingest_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."ingest_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ingest_audit_log" TO "service_role";
GRANT ALL ON TABLE "public"."memorias" TO "anon";
GRANT ALL ON TABLE "public"."memorias" TO "authenticated";
GRANT ALL ON TABLE "public"."memorias" TO "service_role";
GRANT ALL ON SEQUENCE "public"."memorias_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."memorias_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."memorias_id_seq" TO "service_role";
GRANT ALL ON TABLE "public"."pacientes" TO "anon";
GRANT ALL ON TABLE "public"."pacientes" TO "authenticated";
GRANT ALL ON TABLE "public"."pacientes" TO "service_role";
GRANT ALL ON TABLE "public"."pendencias" TO "anon";
GRANT ALL ON TABLE "public"."pendencias" TO "authenticated";
GRANT ALL ON TABLE "public"."pendencias" TO "service_role";
GRANT ALL ON TABLE "public"."vw_alertas_abertos" TO "anon";
GRANT ALL ON TABLE "public"."vw_alertas_abertos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_alertas_abertos" TO "service_role";
GRANT ALL ON TABLE "public"."vw_bh_acumulado" TO "anon";
GRANT ALL ON TABLE "public"."vw_bh_acumulado" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_bh_acumulado" TO "service_role";
GRANT ALL ON TABLE "public"."vw_dashboard_uti" TO "anon";
GRANT ALL ON TABLE "public"."vw_dashboard_uti" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_dashboard_uti" TO "service_role";
GRANT ALL ON TABLE "public"."vw_dias_atb_ativo" TO "anon";
GRANT ALL ON TABLE "public"."vw_dias_atb_ativo" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_dias_atb_ativo" TO "service_role";
GRANT ALL ON TABLE "public"."vw_sofa_trend_72h" TO "anon";
GRANT ALL ON TABLE "public"."vw_sofa_trend_72h" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_sofa_trend_72h" TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
