-- ============================================================================
-- SASI v3 — SCHEMA DE PRODUÇÃO  (PostgreSQL 17 / Supabase)
-- ----------------------------------------------------------------------------
-- "Modelo de dados primeiro": formalização do schema VIVO do projeto Supabase
-- idswehsvvqczzkiatuzu, extraído do pg_catalog (estado real) + molde + doutrina.
--
-- O QUE MUDA vs. o banco vivo (tudo justificado no documento de arquitetura):
--   1. enums nativos p/ vocabulários estáveis (uti, gravidade, status, isolamento,
--      plantão, via, intenção, material, resultado, severidade, fonte, comparador,
--      modo de tendência). Elimina o descompasso "enum existe mas coluna é text+check".
--   2. eventos_clinicos.tipo vira FK p/ tabela-dimensão evento_tipo_ref (governa o
--      vocabulário como DADO: unidade padrão, faixa fisiológica p/ flags, slot LOINC).
--   3. RLS de produção: 4 policies separadas por comando (SELECT/INSERT/UPDATE/DELETE),
--      escopo dono. Sem dev_bypass, sem USING(true) — conforme .claude/rules/supabase.md.
--   4. memorias ganha user_id + policy (hoje tem RLS sem policy).
--   5. extensões fora do schema public (pg_trgm/vector no schema extensions).
--
-- Convenções (repo): SQL minúsculo; comentar comando destrutivo; idempotência.
-- Doutrina SASI: ZERO ALUCINAÇÃO — campo sem fonte = null; nunca valor "razoável".
-- Este arquivo cria o schema DO ZERO (banco novo / ambiente de teste). Para migrar
-- o banco VIVO com os 7 pacientes, ver 11_migracao_do_vivo.sql.
-- ============================================================================

-- ============================================================================
-- 0. EXTENSÕES  (no Supabase já existem; mantidas fora de public por segurança)
-- ============================================================================
create schema if not exists extensions;
create extension if not exists pgcrypto  with schema extensions;  -- digest() p/ hash de alerta
create extension if not exists pg_trgm   with schema extensions;  -- busca fuzzy de nome
create extension if not exists vector     with schema extensions;  -- memorias.embedding (RAG)

-- ============================================================================
-- 1. TIPOS ENUMERADOS  (vocabulários FECHADOS e estáveis — 1 fonte da verdade)
-- ============================================================================
do $$ begin
  create type public.uti_enum                   as enum ('UTI2','UTI3','UTI4');
  create type public.gravidade_enum             as enum ('estavel','moderado','grave','critico','obito');
  create type public.status_leito_enum          as enum ('ativo','alta','obito','transferencia');
  create type public.isolamento_enum            as enum ('none','contact','droplet','aerosol');
  create type public.severidade_visual_enum     as enum ('red','yellow','green');
  create type public.plantao_enum               as enum ('manha','tarde','noite','plantao_24h');
  create type public.via_atb_enum               as enum ('EV','VO','IM','SC','SNE','SNG','IT','Tópico');
  create type public.intencao_atb_enum          as enum ('empirica','dirigida','profilatica');
  create type public.material_cultura_enum      as enum ('hemocultura','urocultura','aspirado_traqueal','lavado_bal','lcr','secrecao_ferida','liquido_peritoneal','liquido_pleural','outro');
  create type public.antibiograma_resultado_enum as enum ('S','I','R');
  create type public.severidade_alerta_enum     as enum ('info','warning','critical');
  create type public.fonte_evento_enum          as enum ('manual','gemini_ocr','claude_ocr','appsheet','auto_trigger','edge_function','api_import');
  create type public.comparador_enum            as enum ('lt','lte','gt','gte');
  create type public.trend_modo_enum            as enum ('subida_abs','subida_rel','queda_abs');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 2. TABELA-DIMENSÃO  evento_tipo_ref  (governa o vocabulário de eventos_clinicos)
--    Substitui o CHECK de 57 valores. Cada linha = 1 parâmetro medível.
--    Carrega: unidade padrão, faixa fisiológica plausível (flags de absurdo da
--    doutrina) e o slot LOINC (mapeamento FHIR Observation.code — fase 2).
-- ============================================================================
create table if not exists public.evento_tipo_ref (
  codigo        text        primary key,                 -- ex.: 'fc', 'lactato', 'sofa_total'
  categoria     text        not null,                     -- vital | gaso | lab | renal | hemato | infecto | droga | neuro | score | bh | outro
  rotulo        text        not null,                     -- nome legível
  unidade_padrao text,                                     -- ex.: 'bpm', 'mmHg', 'mg/dL'
  faixa_min     numeric,                                   -- < faixa_min => flag (revisar). null = sem flag
  faixa_max     numeric,                                   -- > faixa_max => flag (revisar). null = sem flag
  loinc_code    text,                                      -- FHIR Observation.code (http://loinc.org). null = a preencher (fase 2)
  ativo         boolean     not null default true,
  ordem         integer     not null default 100
);
comment on table public.evento_tipo_ref is
  'Dimensão que governa eventos_clinicos.tipo. faixa_min/max vêm da doutrina SASI (flags de absurdo fisiológico). loinc_code = mapeamento FHIR (só os 5 vitais verificados vêm preenchidos; o resto é fase 2, via servidores de terminologia — ZERO ALUCINAÇÃO).';

-- SEED do vocabulário (57 códigos do banco vivo).
-- LOINC preenchido SOMENTE nos 5 vitais verificados pela skill fhir-developer.
-- Faixas fisiológicas dos vitais vêm da doutrina _SASI_TEMPLATE_BASE_v2.md.
-- faixa_min/faixa_max = limite fisiológico "impossível" (hard flag), de
-- sasi-ingest-export/references/03-clinical-sanity-checks.md (fonte operacional).
-- A camada mais fina ("review") vive na skill de extração — o banco só marca o impossível.
-- LOINC preenchido só nos 5 vitais verificados pela skill fhir-developer (resto = fase 2).
insert into public.evento_tipo_ref (codigo, categoria, rotulo, unidade_padrao, faixa_min, faixa_max, loinc_code, ordem) values
  ('pa_sys','vital','PA sistólica','mmHg',40,280,'8480-6',10),
  ('pa_dia','vital','PA diastólica','mmHg',20,160,'8462-4',11),
  ('pam','vital','PA média','mmHg',30,180,null,12),
  ('pam_min','vital','PA média (mínima)','mmHg',30,180,null,13),
  ('fc','vital','Frequência cardíaca','bpm',20,250,'8867-4',14),
  ('fr','vital','Frequência respiratória','ipm',4,80,null,15),
  ('spo2','vital','Saturação O2','%',0,100,'2708-6',16),
  ('temp','vital','Temperatura','°C',32,42,'8310-5',17),
  ('glicemia','vital','Glicemia capilar (Dx)','mg/dL',20,800,null,18),
  ('pf_ratio','gaso','Relação PaO2/FiO2','',50,600,null,20),
  ('lactato','gaso','Lactato','mmol/L',0.5,25,null,21),
  ('ph','gaso','pH arterial','',6.80,7.80,null,22),
  ('pco2','gaso','pCO2','mmHg',10,150,null,23),
  ('po2','gaso','pO2','mmHg',20,600,null,24),
  ('hco3','gaso','Bicarbonato','mEq/L',4,50,null,25),
  ('be','gaso','Base excess','mEq/L',null,null,null,26),
  ('diurese_h','renal','Diurese horária','mL/h',null,null,null,30),
  ('bh_h','renal','Balanço hídrico horário','mL',null,null,null,31),
  ('bh_acumulado','renal','Balanço hídrico acumulado','mL',null,null,null,32),
  ('cr','renal','Creatinina','mg/dL',0.1,20,null,33),
  ('ur','renal','Ureia','mg/dL',5,400,null,34),
  ('na','renal','Sódio','mEq/L',110,180,null,35),
  ('k','renal','Potássio','mEq/L',1.5,9.5,null,36),
  ('mg','renal','Magnésio','mg/dL',null,null,null,37),
  ('ca','renal','Cálcio','mg/dL',null,null,null,38),
  ('p','renal','Fósforo','mg/dL',null,null,null,39),
  ('hb','hemato','Hemoglobina','g/dL',2,22,null,40),
  ('ht','hemato','Hematócrito','%',null,null,null,41),
  ('plaq','hemato','Plaquetas','×10³/µL',1,2000,null,42),
  ('leuco','hemato','Leucócitos','×10³/µL',0.1,100,null,43),
  ('inr','hemato','INR','',0.8,10,null,44),
  ('bb','infecto','Bilirrubina total','mg/dL',null,null,null,45),
  ('pcr','infecto','Proteína C reativa','mg/L',null,null,null,46),
  ('procalcitonina','infecto','Procalcitonina','ng/mL',null,null,null,47),
  -- doses de DVA: faixa = "dose absurda" (red flag de diluição errada)
  ('nor_dose','droga','Noradrenalina (dose)','mcg/kg/min',0.001,2.0,null,50),
  ('adr_dose','droga','Adrenalina (dose)','mcg/kg/min',0.001,2.0,null,51),
  ('vaso_dose','droga','Vasopressina (dose)','U/min',0.01,0.1,null,52),
  ('dobuta_dose','droga','Dobutamina (dose)','mcg/kg/min',0,30,null,53),
  ('dopa_dose','droga','Dopamina (dose)','mcg/kg/min',0,30,null,54),
  ('fent_dose','droga','Fentanil (dose)','mcg/h',null,null,null,55),
  ('midaz_dose','droga','Midazolam (dose)','mg/h',null,null,null,56),
  ('propofol_dose','droga','Propofol (dose)','mcg/kg/min',null,null,null,57),
  ('precedex_dose','droga','Dexmedetomidina (dose)','mcg/kg/h',null,null,null,58),
  ('gcs','neuro','Escala de coma de Glasgow','',3,15,null,60),
  ('rass','neuro','RASS','',-5,4,null,61),
  ('cam_icu','neuro','CAM-ICU','',null,null,null,62),
  ('bps','neuro','Behavioral Pain Scale','',null,null,null,63),
  ('cpot','neuro','CPOT','',null,null,null,64),
  ('sofa_total','score','SOFA total','',0,24,null,70),
  ('sofa_resp','score','SOFA respiratório','',0,4,null,71),
  ('sofa_coag','score','SOFA coagulação','',0,4,null,72),
  ('sofa_liver','score','SOFA hepático','',0,4,null,73),
  ('sofa_cardio','score','SOFA cardiovascular','',0,4,null,74),
  ('sofa_neuro','score','SOFA neurológico','',0,4,null,75),
  ('sofa_renal','score','SOFA renal','',0,4,null,76),
  -- 'custom' é a válvula de extensão: eco/hemodinâmica/imagem/cultura entram aqui
  ('custom','outro','Livre — eco/hemodinâmica/imagem/cultura via valor_json {dominio,subtipo,unidade}','',null,null,null,99)
on conflict (codigo) do nothing;

-- ============================================================================
-- 3. TABELAS CLÍNICAS
-- ============================================================================

-- ---- pacientes : registro mestre do leito/paciente --------------------------
create table if not exists public.pacientes (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users(id) on delete set null,
  leito              text not null,
  uti                public.uti_enum not null,
  nome               text not null,
  idade              integer,
  peso               numeric(5,2),
  altura             numeric(5,2),                          -- EM CENTÍMETROS (1,75 m => 175)
  hd                 text,                                  -- hipóteses/problemas ativos
  data_adm           date not null default current_date,
  alergias           text,
  gravidade          public.gravidade_enum        not null default 'estavel',
  status_leito       public.status_leito_enum     not null default 'ativo',
  sofa_baseline      integer,
  isolation          public.isolamento_enum       not null default 'none',
  out_of_range_count integer                      not null default 0,
  severidade_visual  public.severidade_visual_enum not null default 'green',
  dispositivos       jsonb not null default '{}'::jsonb,    -- {iot,cvc,pai,svd,sne,avp,picc,tqt,dreno,mpd,shilley,detalhe}
  riscos_flags       jsonb not null default '{}'::jsonb,    -- {pav,broncoaspiracao,upp,queda,diabetico}
  patient_summary    jsonb          default '{}'::jsonb,    -- ficha congelada (contrato do frontend; ver doc §JSONB)
  imc                numeric generated always as (round(peso / ((altura/100.0) * (altura/100.0)), 1)) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint pacientes_nome_check         check (char_length(nome) between 1 and 200),
  constraint pacientes_idade_check        check (idade between 0 and 130),
  constraint pacientes_peso_check         check (peso between 1 and 400),
  constraint pacientes_altura_check       check (altura between 30 and 250),
  constraint pacientes_sofa_baseline_check check (sofa_baseline between 0 and 24)
);
comment on column public.pacientes.altura          is 'EM CENTÍMETROS (30–250). 1,75 m => 175.';
comment on column public.pacientes.imc             is 'Coluna GERADA (stored): peso / (altura_m)^2. Atualiza sozinha.';
comment on column public.pacientes.patient_summary is 'Ficha persistente da admissão (contrato do frontend). Ver documento de arquitetura, seção Contratos JSONB.';

-- 1 paciente ATIVO por (uti, leito): impede dois pacientes no mesmo leito
create unique index if not exists uq_pacientes_leito_ativo on public.pacientes (uti, leito) where (status_leito = 'ativo');
create index if not exists idx_pacientes_status     on public.pacientes (status_leito, updated_at desc);
create index if not exists idx_pacientes_severidade on public.pacientes (severidade_visual);
create index if not exists idx_pacientes_isolation  on public.pacientes (isolation) where (isolation <> 'none');
create index if not exists idx_pacientes_user       on public.pacientes (user_id);
create index if not exists idx_pacientes_nome_trgm  on public.pacientes using gin (nome extensions.gin_trgm_ops);

-- ---- evolucoes : 1 retrato do plantão (sistemas em JSONB) -------------------
create table if not exists public.evolucoes (
  id                uuid primary key default gen_random_uuid(),
  paciente_id       uuid not null references public.pacientes(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  data_evolucao     timestamptz not null default now(),
  plantao           public.plantao_enum not null default 'manha',
  neuro             jsonb not null default '{}'::jsonb,
  resp              jsonb not null default '{}'::jsonb,
  hemo              jsonb not null default '{}'::jsonb,
  tgi               jsonb not null default '{}'::jsonb,
  renal             jsonb not null default '{}'::jsonb,
  hemato            jsonb not null default '{}'::jsonb,
  infecto           jsonb not null default '{}'::jsonb,
  dvas              jsonb not null default '[]'::jsonb,     -- [{droga,dose,unidade}]
  sedativos         jsonb not null default '[]'::jsonb,     -- [{droga,dose,unidade}]
  impressao         text[] not null default '{}',           -- 1 problema por item
  conduta           text[] not null default '{}',           -- 1 conduta por item (1:1 com impressao)
  problemas_ativos  jsonb not null default '[]'::jsonb,     -- [{texto,sistema?,gravidade?}]
  condutas_sistemas jsonb not null default '[]'::jsonb,     -- [{sistema,texto,meta?,prazo?}]
  riscos            jsonb not null default '[]'::jsonb,     -- [{texto,nivel?}]
  prescricao        jsonb          default '{}'::jsonb,     -- kardex por categoria
  sofa_snapshot     jsonb,
  sofa_total        integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint evolucoes_sofa_total_check check (sofa_total between 0 and 24)
);
create index if not exists idx_evolucoes_paciente_data on public.evolucoes (paciente_id, data_evolucao desc);
create index if not exists idx_evolucoes_user          on public.evolucoes (user_id);
create index if not exists idx_evolucoes_dvas_gin      on public.evolucoes using gin (dvas);
create index if not exists idx_evolucoes_infecto_gin   on public.evolucoes using gin (infecto);

-- ---- eventos_clinicos : SÉRIE TEMPORAL (1 linha = 1 medição) ----------------
create table if not exists public.eventos_clinicos (
  id              uuid primary key default gen_random_uuid(),
  paciente_id     uuid not null references public.pacientes(id) on delete cascade,
  evolucao_id     uuid references public.evolucoes(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  ts              timestamptz not null,
  tipo            text not null references public.evento_tipo_ref(codigo),  -- FK à dimensão (governa o vocabulário)
  valor_num       numeric,
  valor_json      jsonb,
  unidade         text,
  fonte           public.fonte_evento_enum not null,
  confidence      numeric(3,2),
  source_text     text,
  requires_review boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint chk_eventos_valor_not_empty   check (valor_num is not null or valor_json is not null),
  constraint eventos_confidence_check       check (confidence between 0 and 1)
);
create index if not exists idx_eventos_pac_ts      on public.eventos_clinicos (paciente_id, ts desc);
create index if not exists idx_eventos_pac_tipo_ts on public.eventos_clinicos (paciente_id, tipo, ts desc);
create index if not exists idx_eventos_tipo_ts     on public.eventos_clinicos (tipo, ts desc);
create index if not exists idx_eventos_evolucao    on public.eventos_clinicos (evolucao_id) where (evolucao_id is not null);
create index if not exists idx_eventos_review      on public.eventos_clinicos (requires_review, created_at desc) where (requires_review = true);
create index if not exists idx_eventos_user        on public.eventos_clinicos (user_id);
comment on column public.eventos_clinicos.tipo is 'FK -> evento_tipo_ref. Vocabulário novo = nova LINHA na dimensão, não mexe em código.';
comment on column public.eventos_clinicos.valor_json is 'Eventos compostos e extensões. Para tipo=custom: {dominio,subtipo,unidade,...} — ex. eco/hemodinâmica (indice_cardiaco, rvs, psap, vci_colapsabilidade, feve, tapse, delta_vpeak), imagem ({tipo_exame,achados,conclusao}), cultura ({material,agente,antibiograma[]}). pf_ratio carrega {suporte_vent}.';

-- ---- pendencias : tarefas/follow-up -----------------------------------------
create table if not exists public.pendencias (
  id           uuid primary key default gen_random_uuid(),
  paciente_id  uuid not null references public.pacientes(id) on delete cascade,
  evolucao_id  uuid references public.evolucoes(id) on delete set null,
  user_id      uuid references auth.users(id) on delete set null,
  tarefa       text not null,
  prioridade   smallint not null default 2,                 -- 1 alta .. 3 baixa
  concluida    boolean not null default false,
  concluida_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint pendencias_tarefa_check     check (char_length(tarefa) between 1 and 500),
  constraint pendencias_prioridade_check check (prioridade between 1 and 3)
);
create index if not exists idx_pendencias_pac_aberta  on public.pendencias (paciente_id) where (concluida = false);
create index if not exists idx_pendencias_prioridade  on public.pendencias (prioridade, created_at) where (concluida = false);
create index if not exists idx_pendencias_evolucao_id on public.pendencias (evolucao_id);
create index if not exists idx_pendencias_user_id     on public.pendencias (user_id);

-- ---- atbs : antimicrobianos em uso (stewardship) ----------------------------
create table if not exists public.atbs (
  id                     uuid primary key default gen_random_uuid(),
  paciente_id            uuid not null references public.pacientes(id) on delete cascade,
  user_id                uuid references auth.users(id) on delete set null,
  droga                  text not null,
  dose                   text,
  via                    public.via_atb_enum,
  frequencia             text,
  data_inicio            date not null default current_date,
  data_fim               date,
  intencao               public.intencao_atb_enum,
  foco                   text,
  agente_alvo            text,
  motivo_suspensao       text,
  duracao_planejada_dias integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint chk_atb_datas_coerentes check (data_fim is null or data_fim >= data_inicio)
);
create index if not exists idx_atbs_droga     on public.atbs (droga);
create index if not exists idx_atbs_pac_ativo  on public.atbs (paciente_id, data_inicio desc) where (data_fim is null);
create index if not exists idx_atbs_user_id    on public.atbs (user_id);

-- ---- culturas + antibiograma : microbiologia --------------------------------
create table if not exists public.culturas (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  material    public.material_cultura_enum not null,
  coleta_ts   timestamptz not null,
  laudo_ts    timestamptz,
  crescimento boolean not null default false,
  agente      text,
  ufc_por_ml  numeric,
  observacoes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint chk_cultura_laudo_apos_coleta check (laudo_ts is null or laudo_ts >= coleta_ts)
);
create index if not exists idx_culturas_pac_coleta on public.culturas (paciente_id, coleta_ts desc);
create index if not exists idx_culturas_agente     on public.culturas (agente) where (agente is not null);
create index if not exists idx_culturas_user_id    on public.culturas (user_id);

create table if not exists public.antibiograma (
  id          uuid primary key default gen_random_uuid(),
  cultura_id  uuid not null references public.culturas(id) on delete cascade,
  antibiotico text not null,
  resultado   public.antibiograma_resultado_enum not null,   -- S | I | R
  cim         numeric,
  created_at  timestamptz not null default now()
);
create index if not exists idx_antibiograma_cultura on public.antibiograma (cultura_id);
create unique index if not exists uq_antibiograma_cultura_atb on public.antibiograma (cultura_id, antibiotico);

-- ---- alerts_log : alertas disparados (dedup por hash) -----------------------
create table if not exists public.alerts_log (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  evento_id   uuid references public.eventos_clinicos(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  tipo        text not null,
  severidade  public.severidade_alerta_enum not null default 'warning',
  mensagem    text not null,
  payload     jsonb,
  hash_key    text not null,
  acked       boolean not null default false,
  acked_at    timestamptz,
  acked_by    uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_alerts_hash    on public.alerts_log (hash_key);
create index if not exists idx_alerts_pac_ack        on public.alerts_log (paciente_id, acked, created_at desc);
create index if not exists idx_alerts_severidade     on public.alerts_log (severidade, created_at desc) where (acked = false);
create index if not exists idx_alerts_log_evento_id  on public.alerts_log (evento_id);
create index if not exists idx_alerts_log_user_id    on public.alerts_log (user_id);
create index if not exists idx_alerts_log_acked_by   on public.alerts_log (acked_by);

-- ---- ingest_audit_log : auditoria de ingestão (OCR/API/batch) ---------------
create table if not exists public.ingest_audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  paciente_id uuid references public.pacientes(id) on delete set null,
  source_type text,
  fonte       text,
  payload_raw jsonb,
  response    jsonb,
  eventos_ids uuid[],
  warnings    text[],
  ok          boolean not null,
  error_msg   text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ingest_audit_pac    on public.ingest_audit_log (paciente_id, created_at desc);
create index if not exists idx_ingest_audit_falhas on public.ingest_audit_log (created_at desc) where (ok = false);
create index if not exists idx_ingest_audit_log_user_id on public.ingest_audit_log (user_id);

-- ---- memorias : store vetorial (RAG, pgvector 768d) -------------------------
create table if not exists public.memorias (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete cascade,   -- NOVO: escopo de dono p/ RLS
  conteudo   text not null,
  metadata   jsonb,
  embedding  extensions.vector(768),
  created_at timestamptz default now()
);
create index if not exists memorias_embedding_hnsw_idx on public.memorias using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists idx_memorias_user on public.memorias (user_id);

-- ---- alert_rules / trend_rules : CONFIG do motor de alertas -----------------
create table if not exists public.alert_rules (
  id          uuid primary key default gen_random_uuid(),
  ativo       boolean not null default true,
  tipo_evento text not null references public.evento_tipo_ref(codigo),
  comparador  public.comparador_enum not null,
  limiar      numeric not null,
  severidade  public.severidade_alerta_enum not null,
  rotulo      text not null unique,
  mensagem    text not null,
  fonte       text,
  ordem       integer not null default 100,
  created_at  timestamptz not null default now()
);

create table if not exists public.trend_rules (
  id               uuid primary key default gen_random_uuid(),
  ativo            boolean not null default true,
  tipo_evento      text not null references public.evento_tipo_ref(codigo),
  modo             public.trend_modo_enum not null,
  limiar           numeric not null,
  janela_max_horas integer,
  severidade       public.severidade_alerta_enum not null,
  rotulo           text not null unique,
  mensagem         text not null,
  fonte            text,
  ordem            integer not null default 100,
  created_at       timestamptz not null default now()
);

-- ============================================================================
-- 4. FUNÇÕES  (search_path fixado — boa prática de segurança)
-- ============================================================================
create or replace function public.fn_updated_at() returns trigger
  language plpgsql set search_path to 'public','pg_catalog' as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.fn_autoflag_lowconf() returns trigger
  language plpgsql set search_path to 'public','pg_catalog' as $$
begin
  if new.confidence is null or new.confidence < 0.7 then new.requires_review := true; end if;
  return new;
end; $$;

create or replace function public.fn_invalidate_sofa_cache() returns trigger
  language plpgsql set search_path to 'public','pg_catalog' as $$
begin
  if (old.resp is distinct from new.resp) or (old.hemo is distinct from new.hemo)
     or (old.renal is distinct from new.renal) or (old.hemato is distinct from new.hemato)
     or (old.tgi is distinct from new.tgi) or (old.neuro is distinct from new.neuro)
     or (old.dvas is distinct from new.dvas) or (old.sedativos is distinct from new.sedativos) then
    new.sofa_snapshot = null; new.sofa_total = null;
  end if;
  return new;
end; $$;

create or replace function public.sync_severidade_visual() returns trigger
  language plpgsql set search_path to 'public','pg_catalog' as $$
begin
  if (new.gravidade is distinct from old.gravidade)
     and (new.severidade_visual is not distinct from old.severidade_visual) then
    new.severidade_visual := case new.gravidade
      when 'critico' then 'red' when 'grave' then 'red'
      when 'moderado' then 'yellow' else 'green' end;
  end if;
  return new;
end; $$;

create or replace function public.fn_alert_hash(p_paciente_id uuid, p_tipo text, p_payload jsonb)
  returns text language plpgsql stable set search_path to 'public','extensions','pg_catalog' as $$
begin
  return encode(extensions.digest(
    p_paciente_id::text || '|' || p_tipo || '|' || coalesce(p_payload::text,'') || '|' || to_char(now(),'YYYY-MM-DD'),
    'sha256'), 'hex');
end; $$;

create or replace function public.fn_eval_alert() returns trigger
  language plpgsql set search_path to 'public','extensions','pg_catalog' as $$
declare r record; best_rank int := 0; v_rank int;
  b_rotulo text; b_sev text; b_msg text; b_fonte text; b_id uuid; b_ordem int; v_hash text;
begin
  if new.requires_review is true or coalesce(new.confidence,1) < 0.7 then return new; end if;  -- TRAVA: zero alucinação
  if new.valor_num is null then return new; end if;
  for r in select * from alert_rules where ativo and tipo_evento = new.tipo loop
    if (case r.comparador when 'lt' then new.valor_num < r.limiar when 'lte' then new.valor_num <= r.limiar
          when 'gt' then new.valor_num > r.limiar when 'gte' then new.valor_num >= r.limiar else false end) then
      v_rank := case r.severidade when 'critical' then 3 when 'warning' then 2 else 1 end;
      if v_rank > best_rank or (v_rank = best_rank and (b_ordem is null or r.ordem < b_ordem)) then
        best_rank := v_rank; b_rotulo := r.rotulo; b_sev := r.severidade; b_msg := r.mensagem;
        b_fonte := r.fonte; b_id := r.id; b_ordem := r.ordem;
      end if;
    end if;
  end loop;
  if best_rank = 0 then return new; end if;
  v_hash := fn_alert_hash(new.paciente_id, b_rotulo, jsonb_build_object('valor',new.valor_num,'tipo_evento',new.tipo));
  insert into alerts_log (paciente_id, evento_id, user_id, tipo, severidade, mensagem, payload, hash_key, acked)
  values (new.paciente_id, new.id, new.user_id, b_rotulo, b_sev::public.severidade_alerta_enum,
    replace(b_msg,'{v}',new.valor_num::text),
    jsonb_build_object('valor',new.valor_num,'tipo_evento',new.tipo,'unidade',new.unidade,'regra',b_id,'fonte',b_fonte),
    v_hash, false)
  on conflict (hash_key) do nothing;
  return new;
end; $$;

create or replace function public.fn_eval_trend() returns trigger
  language plpgsql set search_path to 'public','extensions','pg_catalog' as $$
declare prev_valor numeric; prev_ts timestamptz; r record; v_delta numeric; v_ratio numeric; v_gap_h numeric;
  v_hit boolean; best_rank int := 0; v_rank int;
  b_rotulo text; b_sev text; b_msg text; b_fonte text; b_id uuid; b_ordem int; v_hash text;
begin
  if new.requires_review is true or coalesce(new.confidence,1) < 0.7 or new.valor_num is null then return new; end if;
  select valor_num, ts into prev_valor, prev_ts from eventos_clinicos
   where paciente_id = new.paciente_id and tipo = new.tipo and id <> new.id
     and valor_num is not null and not requires_review and coalesce(confidence,1) >= 0.7 and ts < new.ts
   order by ts desc limit 1;
  if prev_valor is null then return new; end if;
  v_delta := new.valor_num - prev_valor;
  v_ratio := case when prev_valor <> 0 then new.valor_num / prev_valor else null end;
  v_gap_h := extract(epoch from (new.ts - prev_ts)) / 3600.0;
  for r in select * from trend_rules where ativo and tipo_evento = new.tipo loop
    v_hit := case r.modo when 'subida_abs' then v_delta >= r.limiar
      when 'subida_rel' then v_ratio is not null and v_ratio >= r.limiar
      when 'queda_abs' then (-v_delta) >= r.limiar else false end;
    if v_hit and (r.janela_max_horas is null or v_gap_h <= r.janela_max_horas) then
      v_rank := case r.severidade when 'critical' then 3 when 'warning' then 2 else 1 end;
      if v_rank > best_rank or (v_rank = best_rank and (b_ordem is null or r.ordem < b_ordem)) then
        best_rank := v_rank; b_rotulo := r.rotulo; b_sev := r.severidade; b_msg := r.mensagem;
        b_fonte := r.fonte; b_id := r.id; b_ordem := r.ordem;
      end if;
    end if;
  end loop;
  if best_rank = 0 then return new; end if;
  v_hash := fn_alert_hash(new.paciente_id, b_rotulo, jsonb_build_object('valor',new.valor_num,'prev',prev_valor,'tipo_evento',new.tipo));
  insert into alerts_log (paciente_id, evento_id, user_id, tipo, severidade, mensagem, payload, hash_key, acked)
  values (new.paciente_id, new.id, new.user_id, b_rotulo, b_sev::public.severidade_alerta_enum,
    replace(replace(replace(b_msg,'{v}',new.valor_num::text),'{prev}',prev_valor::text),'{d}',round(v_delta,2)::text),
    jsonb_build_object('valor',new.valor_num,'anterior',prev_valor,'delta',v_delta,'gap_horas',round(v_gap_h,1),'tipo_evento',new.tipo,'regra',b_id,'fonte',b_fonte),
    v_hash, false)
  on conflict (hash_key) do nothing;
  return new;
end; $$;

-- match_memorias : busca semântica (RAG) por similaridade de cosseno
create or replace function public.match_memorias(query_embedding extensions.vector, match_threshold double precision, match_count integer)
  returns table(id bigint, conteudo text, similarity double precision)
  language sql stable set search_path to 'public','extensions','pg_catalog' as $$
  select m.id, m.conteudo, 1 - (m.embedding <=> query_embedding) as similarity
  from memorias m
  where 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- save_ficha : GRAVAÇÃO ATÔMICA da ficha (contrato de escrita do frontend).
-- Versão de produção: SECURITY DEFINER + set user_id (para funcionar sob RLS real).
create or replace function public.save_ficha(
  p_paciente_id uuid, p_pac jsonb, p_evol jsonb, p_evolucao_id uuid, p_plantao text, p_pendencias jsonb default '[]'::jsonb)
  returns uuid language plpgsql security definer set search_path to 'public','pg_catalog' as $$
declare v_evol_id uuid; v_uid uuid := auth.uid(); pend jsonb;
begin
  update pacientes set
    nome = coalesce(p_pac->>'nome', nome), leito = coalesce(p_pac->>'leito', leito),
    hd = p_pac->>'hd', idade = nullif(p_pac->>'idade','')::int,
    peso = nullif(p_pac->>'peso','')::numeric, altura = nullif(p_pac->>'altura','')::numeric,
    alergias = p_pac->>'alergias', gravidade = coalesce((p_pac->>'gravidade')::public.gravidade_enum, gravidade),
    data_adm = coalesce(nullif(p_pac->>'data_adm','')::date, data_adm)
  where id = p_paciente_id and (user_id is null or user_id = v_uid);          -- guarda de dono
  if not found then raise exception 'paciente % nao encontrado ou sem permissao', p_paciente_id; end if;

  if p_evolucao_id is not null then
    update evolucoes set
      neuro=coalesce(p_evol->'neuro','{}'::jsonb), resp=coalesce(p_evol->'resp','{}'::jsonb),
      hemo=coalesce(p_evol->'hemo','{}'::jsonb), tgi=coalesce(p_evol->'tgi','{}'::jsonb),
      renal=coalesce(p_evol->'renal','{}'::jsonb), hemato=coalesce(p_evol->'hemato','{}'::jsonb),
      infecto=coalesce(p_evol->'infecto','{}'::jsonb), dvas=coalesce(p_evol->'dvas','[]'::jsonb),
      sedativos=coalesce(p_evol->'sedativos','[]'::jsonb),
      impressao=coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')),'{}'),
      conduta=coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')),'{}'),
      problemas_ativos=coalesce(p_evol->'problemas_ativos','[]'::jsonb),
      condutas_sistemas=coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      riscos=coalesce(p_evol->'riscos','[]'::jsonb)
    where id = p_evolucao_id returning id into v_evol_id;
    if v_evol_id is null then raise exception 'evolucao % nao encontrada', p_evolucao_id; end if;
  else
    insert into evolucoes (paciente_id, user_id, data_evolucao, plantao, neuro, resp, hemo, tgi, renal, hemato, infecto,
      dvas, sedativos, impressao, conduta, problemas_ativos, condutas_sistemas, riscos, sofa_snapshot)
    values (p_paciente_id, v_uid, now(), p_plantao::public.plantao_enum,
      coalesce(p_evol->'neuro','{}'::jsonb), coalesce(p_evol->'resp','{}'::jsonb), coalesce(p_evol->'hemo','{}'::jsonb),
      coalesce(p_evol->'tgi','{}'::jsonb), coalesce(p_evol->'renal','{}'::jsonb), coalesce(p_evol->'hemato','{}'::jsonb),
      coalesce(p_evol->'infecto','{}'::jsonb), coalesce(p_evol->'dvas','[]'::jsonb), coalesce(p_evol->'sedativos','[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')),'{}'),
      coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')),'{}'),
      coalesce(p_evol->'problemas_ativos','[]'::jsonb), coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      coalesce(p_evol->'riscos','[]'::jsonb), '{}'::jsonb)
    returning id into v_evol_id;
  end if;

  for pend in select * from jsonb_array_elements(coalesce(p_pendencias,'[]'::jsonb)) loop
    if coalesce(pend->>'id','') <> '' then
      update pendencias set tarefa=pend->>'tarefa', concluida=coalesce((pend->>'concluida')::boolean,false),
        concluida_at=case when (pend->>'concluida')::boolean then now() else null end
      where id = (pend->>'id')::uuid;
    elsif coalesce(pend->>'tarefa','') <> '' then
      insert into pendencias (paciente_id, user_id, tarefa, prioridade, concluida)
      values (p_paciente_id, v_uid, pend->>'tarefa', 2, coalesce((pend->>'concluida')::boolean,false));
    end if;
  end loop;
  return v_evol_id;
end; $$;

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================
create trigger trg_updated_at before update on public.pacientes for each row execute function public.fn_updated_at();
create trigger trg_updated_at before update on public.evolucoes  for each row execute function public.fn_updated_at();
create trigger trg_updated_at before update on public.atbs       for each row execute function public.fn_updated_at();
create trigger trg_updated_at before update on public.culturas   for each row execute function public.fn_updated_at();
create trigger trg_sync_severidade_visual  before update on public.pacientes for each row execute function public.sync_severidade_visual();
create trigger trg_sofa_cache_invalidate   before update on public.evolucoes for each row execute function public.fn_invalidate_sofa_cache();
create trigger trg_autoflag_lowconf before insert on public.eventos_clinicos for each row execute function public.fn_autoflag_lowconf();
create trigger trg_eval_alert       after  insert on public.eventos_clinicos for each row execute function public.fn_eval_alert();
create trigger trg_eval_trend       after  insert on public.eventos_clinicos for each row execute function public.fn_eval_trend();

-- ============================================================================
-- 6. RLS — SEGURANÇA POR LINHA  (produção: 4 policies por comando, escopo dono)
--    Sem dev_bypass, sem USING(true). Conforme .claude/rules/supabase.md.
--    Helper de posse evita repetir o JOIN em cada tabela-filha.
-- ============================================================================
create or replace function public.fn_owns_paciente(p_id uuid) returns boolean
  language sql stable security definer set search_path to 'public','pg_catalog' as $$
  select exists (select 1 from pacientes p where p.id = p_id and p.user_id = (select auth.uid()));
$$;

alter table public.pacientes        enable row level security;
alter table public.evolucoes        enable row level security;
alter table public.eventos_clinicos enable row level security;
alter table public.pendencias       enable row level security;
alter table public.atbs             enable row level security;
alter table public.culturas         enable row level security;
alter table public.antibiograma     enable row level security;
alter table public.alerts_log       enable row level security;
alter table public.ingest_audit_log enable row level security;
alter table public.memorias         enable row level security;
alter table public.alert_rules      enable row level security;
alter table public.trend_rules      enable row level security;
alter table public.evento_tipo_ref  enable row level security;

-- pacientes (dono direto)
create policy pacientes_select on public.pacientes for select to authenticated using ((select auth.uid()) = user_id);
create policy pacientes_insert on public.pacientes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy pacientes_update on public.pacientes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy pacientes_delete on public.pacientes for delete to authenticated using ((select auth.uid()) = user_id);

-- tabelas-filhas por paciente (posse via helper)
create policy evolucoes_select on public.evolucoes for select to authenticated using (public.fn_owns_paciente(paciente_id));
create policy evolucoes_insert on public.evolucoes for insert to authenticated with check (public.fn_owns_paciente(paciente_id));
create policy evolucoes_update on public.evolucoes for update to authenticated using (public.fn_owns_paciente(paciente_id)) with check (public.fn_owns_paciente(paciente_id));
create policy evolucoes_delete on public.evolucoes for delete to authenticated using (public.fn_owns_paciente(paciente_id));

create policy eventos_select on public.eventos_clinicos for select to authenticated using (public.fn_owns_paciente(paciente_id));
create policy eventos_insert on public.eventos_clinicos for insert to authenticated with check (public.fn_owns_paciente(paciente_id));
create policy eventos_update on public.eventos_clinicos for update to authenticated using (public.fn_owns_paciente(paciente_id)) with check (public.fn_owns_paciente(paciente_id));
create policy eventos_delete on public.eventos_clinicos for delete to authenticated using (public.fn_owns_paciente(paciente_id));

create policy pendencias_select on public.pendencias for select to authenticated using (public.fn_owns_paciente(paciente_id));
create policy pendencias_insert on public.pendencias for insert to authenticated with check (public.fn_owns_paciente(paciente_id));
create policy pendencias_update on public.pendencias for update to authenticated using (public.fn_owns_paciente(paciente_id)) with check (public.fn_owns_paciente(paciente_id));
create policy pendencias_delete on public.pendencias for delete to authenticated using (public.fn_owns_paciente(paciente_id));

create policy atbs_select on public.atbs for select to authenticated using (public.fn_owns_paciente(paciente_id));
create policy atbs_insert on public.atbs for insert to authenticated with check (public.fn_owns_paciente(paciente_id));
create policy atbs_update on public.atbs for update to authenticated using (public.fn_owns_paciente(paciente_id)) with check (public.fn_owns_paciente(paciente_id));
create policy atbs_delete on public.atbs for delete to authenticated using (public.fn_owns_paciente(paciente_id));

create policy culturas_select on public.culturas for select to authenticated using (public.fn_owns_paciente(paciente_id));
create policy culturas_insert on public.culturas for insert to authenticated with check (public.fn_owns_paciente(paciente_id));
create policy culturas_update on public.culturas for update to authenticated using (public.fn_owns_paciente(paciente_id)) with check (public.fn_owns_paciente(paciente_id));
create policy culturas_delete on public.culturas for delete to authenticated using (public.fn_owns_paciente(paciente_id));

-- antibiograma: posse via cultura -> paciente
create policy antibiograma_select on public.antibiograma for select to authenticated
  using (exists (select 1 from culturas c where c.id = cultura_id and public.fn_owns_paciente(c.paciente_id)));
create policy antibiograma_insert on public.antibiograma for insert to authenticated
  with check (exists (select 1 from culturas c where c.id = cultura_id and public.fn_owns_paciente(c.paciente_id)));
create policy antibiograma_update on public.antibiograma for update to authenticated
  using (exists (select 1 from culturas c where c.id = cultura_id and public.fn_owns_paciente(c.paciente_id)))
  with check (exists (select 1 from culturas c where c.id = cultura_id and public.fn_owns_paciente(c.paciente_id)));
create policy antibiograma_delete on public.antibiograma for delete to authenticated
  using (exists (select 1 from culturas c where c.id = cultura_id and public.fn_owns_paciente(c.paciente_id)));

create policy alerts_select on public.alerts_log for select to authenticated using (public.fn_owns_paciente(paciente_id));
create policy alerts_insert on public.alerts_log for insert to authenticated with check (public.fn_owns_paciente(paciente_id));
create policy alerts_update on public.alerts_log for update to authenticated using (public.fn_owns_paciente(paciente_id)) with check (public.fn_owns_paciente(paciente_id));
create policy alerts_delete on public.alerts_log for delete to authenticated using (public.fn_owns_paciente(paciente_id));

-- ingest_audit_log: dono direto (user_id)
create policy ingest_select on public.ingest_audit_log for select to authenticated using ((select auth.uid()) = user_id);
create policy ingest_insert on public.ingest_audit_log for insert to authenticated with check ((select auth.uid()) = user_id);

-- memorias: dono direto
create policy memorias_select on public.memorias for select to authenticated using ((select auth.uid()) = user_id);
create policy memorias_insert on public.memorias for insert to authenticated with check ((select auth.uid()) = user_id);
create policy memorias_update on public.memorias for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy memorias_delete on public.memorias for delete to authenticated using ((select auth.uid()) = user_id);

-- Config e dimensão: leitura p/ autenticados (não é PHI); escrita só service_role.
create policy alert_rules_read on public.alert_rules for select to authenticated using (true);
create policy trend_rules_read on public.trend_rules for select to authenticated using (true);
create policy evento_tipo_ref_read on public.evento_tipo_ref for select to authenticated using (true);

-- ============================================================================
-- 7. VIEWS  (security_invoker = respeita o RLS de quem consulta)
-- ============================================================================
create or replace view public.vw_dashboard_uti with (security_invoker = true) as
  with ultima_evol as (
    select distinct on (e.paciente_id) e.paciente_id, e.id as evolucao_id, e.data_evolucao as ultima_evolucao,
      e.sofa_total, e.sofa_snapshot, e.dvas, e.sedativos
    from evolucoes e order by e.paciente_id, e.data_evolucao desc),
  sofa_24h_atras as (
    select distinct on (ec.paciente_id) ec.paciente_id, ec.valor_num as sofa_total_24h
    from eventos_clinicos ec where ec.tipo='sofa_total' and ec.ts <= (now()-interval '24 hour')
    order by ec.paciente_id, ec.ts desc),
  pend_abertas as (
    select paciente_id, count(*)::int as pendencias_abertas from pendencias where concluida=false group by paciente_id)
  select p.id as paciente_id, p.user_id, p.leito, p.uti, p.nome, p.idade, p.peso, p.hd, p.gravidade, p.status_leito,
    p.data_adm, (current_date - p.data_adm) as dias_internacao, u.evolucao_id, u.ultima_evolucao, u.sofa_total,
    u.sofa_snapshot, u.dvas, u.sedativos, (u.sofa_total::numeric - s24.sofa_total_24h)::int as delta_sofa_24h,
    coalesce(pa.pendencias_abertas,0) as pendencias_abertas, p.dispositivos, p.isolation, p.out_of_range_count, p.severidade_visual
  from pacientes p
    left join ultima_evol u on u.paciente_id = p.id
    left join sofa_24h_atras s24 on s24.paciente_id = p.id
    left join pend_abertas pa on pa.paciente_id = p.id
  where p.status_leito = 'ativo';

create or replace view public.vw_alertas_abertos with (security_invoker = true) as
  select al.paciente_id, p.uti, p.leito, p.nome,
    count(*) filter (where al.severidade='critical') as criticos,
    count(*) filter (where al.severidade='warning')  as warnings,
    count(*) filter (where al.severidade='info')     as infos,
    count(*) as total
  from alerts_log al join pacientes p on p.id = al.paciente_id
  where al.acked = false group by al.paciente_id, p.uti, p.leito, p.nome;

create or replace view public.vw_bh_acumulado with (security_invoker = true) as
  select paciente_id,
    sum(case when ts >= now()-interval '24 hour' then valor_num else 0 end) as bh_24h,
    sum(case when ts >= now()-interval '48 hour' then valor_num else 0 end) as bh_48h,
    sum(case when ts >= now()-interval '72 hour' then valor_num else 0 end) as bh_72h,
    count(*) filter (where ts >= now()-interval '24 hour') as eventos_24h
  from eventos_clinicos where tipo='bh_h' group by paciente_id;

create or replace view public.vw_dias_atb_ativo with (security_invoker = true) as
  select paciente_id, id as atb_id, droga, via, frequencia, data_inicio, intencao, foco, agente_alvo,
    ((current_date - data_inicio) + 1) as dias_terapia,
    case when ((current_date - data_inicio)+1) >= 14 then 'critical'
         when ((current_date - data_inicio)+1) >= 7  then 'warning' else 'ok' end as stewardship_flag
  from atbs where data_fim is null;

create or replace view public.vw_eventos_pendentes_revisao with (security_invoker = true) as
  select id, paciente_id, evolucao_id, user_id, ts, tipo, valor_num, valor_json, unidade, fonte, confidence, source_text, requires_review, created_at
  from eventos_clinicos where requires_review or (coalesce(confidence,1) < 0.7);

create or replace view public.vw_eventos_tendencia with (security_invoker = true) as
  select paciente_id, tipo, ts, valor_num, unidade,
    lag(valor_num) over w as valor_anterior,
    (valor_num - lag(valor_num) over w) as delta,
    round((extract(epoch from (ts - lag(ts) over w))/3600.0),1) as gap_horas
  from eventos_clinicos
  where valor_num is not null and not requires_review and coalesce(confidence,1) >= 0.7
  window w as (partition by paciente_id, tipo order by ts);

create or replace view public.vw_sofa_trend_72h with (security_invoker = true) as
  select paciente_id, ts, valor_num as sofa_total
  from eventos_clinicos where tipo='sofa_total' and ts >= now()-interval '72 hour'
  order by paciente_id, ts;

-- (vw_sofa_diario: motor de SOFA/dia — mantido conforme banco vivo; ver doc.
--  Omitido aqui por depender de regras clínicas extensas; incluir no deploy real.)

-- ============================================================================
-- FIM — SASI v3 schema de produção
-- ============================================================================
