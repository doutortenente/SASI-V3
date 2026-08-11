-- APLICADA no banco vivo em 30-jul-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (6ac1760c67fd12ba74400a91a4e8ad47). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- SASI v3 · formalizacao (1/3) — enums + dimensao evento_tipo_ref (aditivo, idempotente)
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

create table if not exists public.evento_tipo_ref (
  codigo         text     primary key,
  categoria      text     not null,
  rotulo         text     not null,
  unidade_padrao text,
  faixa_min      numeric,
  faixa_max      numeric,
  loinc_code     text,
  ativo          boolean  not null default true,
  ordem          integer  not null default 100
);
comment on table public.evento_tipo_ref is 'Dimensao que governa eventos_clinicos.tipo. faixa_min/max = flags de absurdo fisiologico (doutrina/sanity-checks). loinc_code = mapeamento FHIR (so 5 vitais verificados; resto fase 2 — ZERO ALUCINACAO).';

insert into public.evento_tipo_ref (codigo, categoria, rotulo, unidade_padrao, faixa_min, faixa_max, loinc_code, ordem) values
  ('pa_sys','vital','PA sistolica','mmHg',40,280,'8480-6',10),
  ('pa_dia','vital','PA diastolica','mmHg',20,160,'8462-4',11),
  ('pam','vital','PA media','mmHg',30,180,null,12),
  ('pam_min','vital','PA media (minima)','mmHg',30,180,null,13),
  ('fc','vital','Frequencia cardiaca','bpm',20,250,'8867-4',14),
  ('fr','vital','Frequencia respiratoria','ipm',4,80,null,15),
  ('spo2','vital','Saturacao O2','%',0,100,'2708-6',16),
  ('temp','vital','Temperatura','C',32,42,'8310-5',17),
  ('glicemia','vital','Glicemia capilar (Dx)','mg/dL',20,800,null,18),
  ('pf_ratio','gaso','Relacao PaO2/FiO2','',50,600,null,20),
  ('lactato','gaso','Lactato','mmol/L',0.5,25,null,21),
  ('ph','gaso','pH arterial','',6.80,7.80,null,22),
  ('pco2','gaso','pCO2','mmHg',10,150,null,23),
  ('po2','gaso','pO2','mmHg',20,600,null,24),
  ('hco3','gaso','Bicarbonato','mEq/L',4,50,null,25),
  ('be','gaso','Base excess','mEq/L',null,null,null,26),
  ('diurese_h','renal','Diurese horaria','mL/h',null,null,null,30),
  ('bh_h','renal','Balanco hidrico horario','mL',null,null,null,31),
  ('bh_acumulado','renal','Balanco hidrico acumulado','mL',null,null,null,32),
  ('cr','renal','Creatinina','mg/dL',0.1,20,null,33),
  ('ur','renal','Ureia','mg/dL',5,400,null,34),
  ('na','renal','Sodio','mEq/L',110,180,null,35),
  ('k','renal','Potassio','mEq/L',1.5,9.5,null,36),
  ('mg','renal','Magnesio','mg/dL',null,null,null,37),
  ('ca','renal','Calcio','mg/dL',null,null,null,38),
  ('p','renal','Fosforo','mg/dL',null,null,null,39),
  ('hb','hemato','Hemoglobina','g/dL',2,22,null,40),
  ('ht','hemato','Hematocrito','%',null,null,null,41),
  ('plaq','hemato','Plaquetas','x10^3/uL',1,2000,null,42),
  ('leuco','hemato','Leucocitos','x10^3/uL',0.1,100,null,43),
  ('inr','hemato','INR','',0.8,10,null,44),
  ('bb','infecto','Bilirrubina total','mg/dL',null,null,null,45),
  ('pcr','infecto','Proteina C reativa','mg/L',null,null,null,46),
  ('procalcitonina','infecto','Procalcitonina','ng/mL',null,null,null,47),
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
  ('sofa_resp','score','SOFA respiratorio','',0,4,null,71),
  ('sofa_coag','score','SOFA coagulacao','',0,4,null,72),
  ('sofa_liver','score','SOFA hepatico','',0,4,null,73),
  ('sofa_cardio','score','SOFA cardiovascular','',0,4,null,74),
  ('sofa_neuro','score','SOFA neurologico','',0,4,null,75),
  ('sofa_renal','score','SOFA renal','',0,4,null,76),
  ('custom','outro','Livre — eco/hemodinamica/imagem/cultura via valor_json {dominio,subtipo,unidade}','',null,null,null,99)
on conflict (codigo) do nothing;

-- rede de seguranca: todo tipo ja usado no vivo entra na dimensao (garante a FK abaixo)
insert into public.evento_tipo_ref (codigo, categoria, rotulo)
select distinct tipo, 'outro', tipo from public.eventos_clinicos
on conflict (codigo) do nothing;

alter table public.evento_tipo_ref enable row level security;
do $$ begin
  create policy evento_tipo_ref_read on public.evento_tipo_ref for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- SASI v3 · formalizacao (2/3) — eventos_clinicos.tipo vira FK p/ evento_tipo_ref
do $$ begin
  if not exists (select 1 from pg_constraint where conname='eventos_tipo_fk' and conrelid='public.eventos_clinicos'::regclass) then
    alter table public.eventos_clinicos add constraint eventos_tipo_fk foreign key (tipo) references public.evento_tipo_ref(codigo) not valid;
  end if;
end $$;
alter table public.eventos_clinicos validate constraint eventos_tipo_fk;
-- destrutivo (substituido pela FK acima):
alter table public.eventos_clinicos drop constraint if exists eventos_clinicos_tipo_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='alert_rules_tipo_fk' and conrelid='public.alert_rules'::regclass) then
    alter table public.alert_rules add constraint alert_rules_tipo_fk foreign key (tipo_evento) references public.evento_tipo_ref(codigo) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='trend_rules_tipo_fk' and conrelid='public.trend_rules'::regclass) then
    alter table public.trend_rules add constraint trend_rules_tipo_fk foreign key (tipo_evento) references public.evento_tipo_ref(codigo) not valid;
  end if;
end $$;

-- SASI v3 · formalizacao (3/3) — memorias ganha dono + semaforo no cadastro (aditivo)
alter table public.memorias add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists idx_memorias_user on public.memorias (user_id);
do $$ begin
  create policy memorias_select on public.memorias for select to authenticated using ((select auth.uid()) = user_id);
  create policy memorias_insert on public.memorias for insert to authenticated with check ((select auth.uid()) = user_id);
  create policy memorias_update on public.memorias for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  create policy memorias_delete on public.memorias for delete to authenticated using ((select auth.uid()) = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.fn_set_severidade_on_insert() returns trigger
  language plpgsql set search_path to 'public','pg_catalog' as $fn$
begin
  new.severidade_visual := case new.gravidade
    when 'critico' then 'red' when 'grave' then 'red'
    when 'moderado' then 'yellow' else 'green' end;
  return new;
end; $fn$;
drop trigger if exists trg_severidade_on_insert on public.pacientes;
create trigger trg_severidade_on_insert before insert on public.pacientes
  for each row execute function public.fn_set_severidade_on_insert();
