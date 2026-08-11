-- APLICADA no banco vivo em 26-jun-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (206637a3ba95fb631fa1ba803000ff75). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- alertas-producer — cria o PRODUTOR que faltava: trigger em eventos_clinicos -> alerts_log.
-- ENGENHARIA (Claude): tabela de config + motor (escolhe MAIOR severidade) + travas de seguranca.
-- MEDICINA (Vera Health + Dr.): os numeros vivem em alert_rules (col fonte = DOI da evidencia).
-- Mudar limiar = UPDATE numa linha. Nenhum codigo muda.

-- 1) Catalogo de regras (config clinica) — agora com coluna fonte (evidencia)
create table if not exists public.alert_rules (
  id          uuid primary key default gen_random_uuid(),
  ativo       boolean not null default true,
  tipo_evento text    not null,                          -- bate com eventos_clinicos.tipo
  comparador  text    not null check (comparador in ('lt','lte','gt','gte')),
  limiar      numeric not null,
  severidade  text    not null check (severidade in ('info','warning','critical')),
  rotulo      text    not null unique,                   -- id do alerta; chave natural p/ idempotencia
  mensagem    text    not null,                           -- template; {v} vira o valor medido
  fonte       text,                                       -- evidencia (DOI/guideline); null = default eng.
  ordem       int     not null default 100,
  created_at  timestamptz not null default now()
);
alter table public.alert_rules enable row level security;
drop policy if exists dev_bypass on public.alert_rules;
create policy dev_bypass on public.alert_rules for all using (true) with check (true);
-- 2) Motor: le alert_rules, escolhe a MAIOR severidade entre as regras que batem, insere em alerts_log.
--    (escolher por severidade — nao "primeira que bate" — evita warning mascarar critical)
create or replace function public.fn_eval_alert()
returns trigger
language plpgsql
volatile
set search_path to 'public', 'extensions', 'pg_catalog'
as $function$
declare
  r          record;
  best_rank  int := 0;
  v_rank     int;
  b_rotulo   text;
  b_sev      text;
  b_msg      text;
  b_fonte    text;
  b_id       uuid;
  b_ordem    int;
  v_hash     text;
begin
  -- TRAVA 1: nunca alarmar dado nao revisado ou de baixa confianca (ZERO ALUCINACAO)
  if new.requires_review is true or coalesce(new.confidence, 1) < 0.7 then
    return new;
  end if;
  if new.valor_num is null then
    return new;
  end if;

  for r in select * from alert_rules where ativo and tipo_evento = new.tipo loop
    if (case r.comparador
          when 'lt'  then new.valor_num <  r.limiar
          when 'lte' then new.valor_num <= r.limiar
          when 'gt'  then new.valor_num >  r.limiar
          when 'gte' then new.valor_num >= r.limiar
          else false
        end) then
      v_rank := case r.severidade when 'critical' then 3 when 'warning' then 2 else 1 end;
      if v_rank > best_rank or (v_rank = best_rank and (b_ordem is null or r.ordem < b_ordem)) then
        best_rank := v_rank;
        b_rotulo := r.rotulo; b_sev := r.severidade; b_msg := r.mensagem;
        b_fonte := r.fonte; b_id := r.id; b_ordem := r.ordem;
      end if;
    end if;
  end loop;

  if best_rank = 0 then
    return new;  -- nenhuma regra bateu
  end if;

  -- TRAVA 2: dedupe diario (fn_alert_hash inclui a data) + unique(hash_key)
  v_hash := fn_alert_hash(
    new.paciente_id, b_rotulo,
    jsonb_build_object('valor', new.valor_num, 'tipo_evento', new.tipo)
  );

  insert into alerts_log (paciente_id, evento_id, user_id, tipo, severidade, mensagem, payload, hash_key, acked)
  values (
    new.paciente_id, new.id, new.user_id, b_rotulo, b_sev,
    replace(b_msg, '{v}', new.valor_num::text),
    jsonb_build_object('valor', new.valor_num, 'tipo_evento', new.tipo, 'unidade', new.unidade, 'regra', b_id, 'fonte', b_fonte),
    v_hash, false
  )
  on conflict (hash_key) do nothing;

  return new;
end;
$function$;
drop trigger if exists trg_eval_alert on public.eventos_clinicos;
create trigger trg_eval_alert
  after insert on public.eventos_clinicos
  for each row execute function public.fn_eval_alert();
-- 3) Seed
-- 3a) Regras EVIDENCE-BASED (Vera Health) — fonte = DOI
insert into public.alert_rules (tipo_evento, comparador, limiar, severidade, rotulo, mensagem, fonte, ordem) values
  ('pam_min','lt', 60,  'critical','hipotensao_critica_pam','PAM {v} < 60 mmHg',       'ACC Cardiogenic Shock 2025 doi:10.1016/j.jacc.2025.02.018', 1),
  ('pam_min','lt', 65,  'warning', 'hipotensao_pam',        'PAM {v} < 65 mmHg',       'ACC Cardiogenic Shock 2025 doi:10.1016/j.jacc.2025.02.018', 2),
  ('pas_min','lt', 90,  'critical','hipotensao_critica_pas','PAS {v} < 90 mmHg',       'ACC Cardiogenic Shock 2025 doi:10.1016/j.jacc.2025.02.018', 3),  -- DORMENTE
  ('fc',     'gt', 100, 'warning', 'taquicardia',           'FC {v} > 100 bpm',        'ACC Cardiogenic Shock 2025 doi:10.1016/j.jacc.2025.02.018', 4),
  ('fc',     'lt', 40,  'critical','bradicardia_grave',     'FC {v} < 40 bpm',         'JMIR doi:10.2196/56463', 5),
  ('fr',     'gt', 30,  'warning', 'taquipneia',            'FR {v} > 30 rpm',         'JMIR doi:10.2196/56463', 6),  -- DORMENTE
  ('fr',     'lt', 8,   'critical','bradipneia',            'FR {v} < 8 rpm',          'JMIR doi:10.2196/56463', 7),  -- DORMENTE
  ('spo2',   'lt', 85,  'critical','hipoxemia_critica',     'SpO2 {v} < 85%',          'Critical Care 2021 doi:10.1186/s13054-021-03766-4', 8),
  ('spo2',   'lt', 90,  'warning', 'hipoxemia',             'SpO2 {v} < 90%',          'JAMA Netw Open 2026 doi:10.1001/jamanetworkopen.2026.3290', 9),
  ('lactato','gt', 2.0, 'warning', 'hipoperfusao_lactato',  'Lactato {v} > 2.0 mmol/L','ACC Cardiogenic Shock 2025 doi:10.1016/j.jacc.2025.02.018', 10),
  ('lactato','gte',4.0, 'critical','lactato_muito_alto',    'Lactato {v} >= 4.0 mmol/L','Surviving Sepsis ICM 2017 doi:10.1007/s00134-017-4683-6', 11),
  ('gcs',    'lt', 9,   'critical','rebaixamento_grave_gcs','GCS {v} < 9',             'ERC/ESICM Post-Resus 2025 doi:10.1016/j.resuscitation.2025.110809', 13),
  ('gcs',    'lt', 12,  'warning', 'alteracao_consciencia_gcs','GCS {v} < 12',         'JBDS HHS 2022 doi:10.1111/dme.15005', 14),
  ('ht',     'gte',44,  'warning', 'hemoconcentracao_ht',   'HT {v} >= 44%',           'ACG Acute Pancreatitis 2024 doi:10.14309/ajg.0000000000002645', 15),
  ('ht',     'lt', 24,  'warning', 'anemia_importante_por_ht','HT {v} < 24%',          'ACG Acute Pancreatitis 2024 doi:10.14309/ajg.0000000000002645', 16),
  ('ht',     'lt', 21,  'critical','anemia_critica_por_ht', 'HT {v} < 21%',            'ACG Acute Pancreatitis 2024 doi:10.14309/ajg.0000000000002645', 17),
  ('ur',     'gte',70,  'warning', 'uremia_importante',     'UR {v} >= 70 mg/dL',      'ACG Acute Pancreatitis 2024 doi:10.14309/ajg.0000000000002645', 18),
  ('ur',     'gte',100, 'critical','uremia_grave',          'UR {v} >= 100 mg/dL',     'RRT timing meta Critical Care 2021 doi:10.1186/s13054-020-03451-y', 19)
on conflict (rotulo) do nothing;
-- NOTA: regra de oliguria (bh_h < 30) da Vera foi SEGURADA: bh_h e balanco hidrico (pode ser negativo),
-- NAO diurese. Precisa de um tipo 'diurese' no ingest antes de ativar. Ver DECISOES-CLINICAS.md.

-- 3b) Defaults de ENGENHARIA p/ parametros que a Vera ainda nao cobriu (fonte null = revisar com Vera)
insert into public.alert_rules (tipo_evento, comparador, limiar, severidade, rotulo, mensagem, fonte, ordem) values
  ('glicemia','gt', 250, 'warning', 'hiperglicemia', 'Glicemia {v} > 250 mg/dL', null, 60),
  ('glicemia','lt', 70,  'critical','hipoglicemia',  'Glicemia {v} < 70 mg/dL',  null, 61),
  ('k',       'gt', 6,   'critical','hipercalemia',  'K {v} > 6 mEq/L',          null, 70),
  ('k',       'lt', 3,   'warning', 'hipocalemia',   'K {v} < 3 mEq/L',          null, 71),
  ('na',      'gt', 150, 'warning', 'hipernatremia', 'Na {v} > 150 mEq/L',       null, 80),
  ('na',      'lt', 130, 'warning', 'hiponatremia',  'Na {v} < 130 mEq/L',       null, 81),
  ('temp',    'gte',38.3,'warning', 'febre',         'Tax {v} >= 38.3 C',        null, 90)
on conflict (rotulo) do nothing;
-- DROPADOS vs meu rascunho: hb<7 (Vera cobre anemia por ht<24/<21) e cr>4 (Vera move p/ modulo de tendencia/AKI).;
