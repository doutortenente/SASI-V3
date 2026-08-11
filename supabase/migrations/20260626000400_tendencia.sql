-- APLICADA no banco vivo em 26-jun-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (c7f51d88634c41fe2a172ed1976a8073). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- modulo de tendencia/Delta — alertas baseados na MUDANCA vs o valor anterior do mesmo
-- paciente+tipo (ex: AKI = creatinina subindo). Config-driven (trend_rules) + reusa alerts_log.
-- LIMITACAO conhecida: so dispara com >=2 valores do mesmo paciente/tipo (dado esparso, ~1 plantao/sem).

-- 1) Config das regras de tendencia (o medico/Vera define os numeros)
create table if not exists public.trend_rules (
  id               uuid primary key default gen_random_uuid(),
  ativo            boolean not null default true,
  tipo_evento      text    not null,                      -- bate com eventos_clinicos.tipo
  modo             text    not null check (modo in ('subida_abs','subida_rel','queda_abs')),
  limiar           numeric not null,                       -- subida_abs: delta>=lim; subida_rel: razao>=lim; queda_abs: queda>=lim
  janela_max_horas int,                                    -- so dispara se gap<=isso (null=qualquer)
  severidade       text    not null check (severidade in ('info','warning','critical')),
  rotulo           text    not null unique,
  mensagem         text    not null,                       -- {v}=novo, {prev}=anterior, {d}=delta
  fonte            text,
  ordem            int     not null default 100,
  created_at       timestamptz not null default now()
);
alter table public.trend_rules enable row level security;
drop policy if exists dev_bypass on public.trend_rules;
create policy dev_bypass on public.trend_rules for all using (true) with check (true);
-- 2) Seed (evidence-based Vera; o medico ajusta em DECISOES-CLINICAS.md)
insert into public.trend_rules (tipo_evento, modo, limiar, janela_max_horas, severidade, rotulo, mensagem, fonte, ordem) values
  ('cr', 'subida_abs', 0.3, 48,  'warning',  'aki_cr_abs', 'AKI: creatinina subiu {d} mg/dL (de {prev} para {v})', 'KDIGO / AKI-sepse doi:10.1038/s41581-023-00683-3', 10),
  ('cr', 'subida_rel', 1.5, 168, 'critical', 'aki_cr_rel', 'AKI: creatinina {v} = 1.5x o basal {prev}',            'KDIGO / AKI-sepse doi:10.1038/s41581-023-00683-3', 11),
  ('gcs','queda_abs',  2,   24,  'warning',  'gcs_queda',  'Queda de GCS: {prev} para {v}',                          'ERC/ESICM Post-Resus 2025 doi:10.1016/j.resuscitation.2025.110809', 20)
on conflict (rotulo) do nothing;
-- 3) Produtor de tendencia: compara o novo valor com o anterior confiavel e insere em alerts_log
create or replace function public.fn_eval_trend()
returns trigger
language plpgsql
volatile
set search_path to 'public', 'extensions', 'pg_catalog'
as $function$
declare
  prev_valor numeric;
  prev_ts    timestamptz;
  r          record;
  v_delta    numeric;
  v_ratio    numeric;
  v_gap_h    numeric;
  v_hit      boolean;
  best_rank  int := 0;
  v_rank     int;
  b_rotulo   text; b_sev text; b_msg text; b_fonte text; b_id uuid; b_ordem int;
  v_hash     text;
begin
  if new.requires_review is true or coalesce(new.confidence, 1) < 0.7 or new.valor_num is null then
    return new;
  end if;

  -- valor anterior CONFIAVEL do mesmo paciente+tipo
  select valor_num, ts into prev_valor, prev_ts
  from eventos_clinicos
  where paciente_id = new.paciente_id and tipo = new.tipo and id <> new.id
    and valor_num is not null and not requires_review and coalesce(confidence, 1) >= 0.7
    and ts < new.ts
  order by ts desc
  limit 1;

  if prev_valor is null then
    return new;  -- sem historico, sem tendencia
  end if;

  v_delta := new.valor_num - prev_valor;
  v_ratio := case when prev_valor <> 0 then new.valor_num / prev_valor else null end;
  v_gap_h := extract(epoch from (new.ts - prev_ts)) / 3600.0;

  for r in select * from trend_rules where ativo and tipo_evento = new.tipo loop
    v_hit := case r.modo
      when 'subida_abs' then v_delta >= r.limiar
      when 'subida_rel' then v_ratio is not null and v_ratio >= r.limiar
      when 'queda_abs'  then (-v_delta) >= r.limiar
      else false
    end;
    if v_hit and (r.janela_max_horas is null or v_gap_h <= r.janela_max_horas) then
      v_rank := case r.severidade when 'critical' then 3 when 'warning' then 2 else 1 end;
      if v_rank > best_rank or (v_rank = best_rank and (b_ordem is null or r.ordem < b_ordem)) then
        best_rank := v_rank; b_rotulo := r.rotulo; b_sev := r.severidade; b_msg := r.mensagem;
        b_fonte := r.fonte; b_id := r.id; b_ordem := r.ordem;
      end if;
    end if;
  end loop;

  if best_rank = 0 then
    return new;
  end if;

  v_hash := fn_alert_hash(new.paciente_id, b_rotulo,
    jsonb_build_object('valor', new.valor_num, 'prev', prev_valor, 'tipo_evento', new.tipo));
  insert into alerts_log (paciente_id, evento_id, user_id, tipo, severidade, mensagem, payload, hash_key, acked)
  values (
    new.paciente_id, new.id, new.user_id, b_rotulo, b_sev,
    replace(replace(replace(b_msg, '{v}', new.valor_num::text), '{prev}', prev_valor::text), '{d}', round(v_delta, 2)::text),
    jsonb_build_object('valor', new.valor_num, 'anterior', prev_valor, 'delta', v_delta,
                       'gap_horas', round(v_gap_h, 1), 'tipo_evento', new.tipo, 'regra', b_id, 'fonte', b_fonte),
    v_hash, false
  )
  on conflict (hash_key) do nothing;

  return new;
end;
$function$;
drop trigger if exists trg_eval_trend on public.eventos_clinicos;
create trigger trg_eval_trend
  after insert on public.eventos_clinicos
  for each row execute function public.fn_eval_trend();
-- 4) View de visibilidade: cada valor com seu anterior, delta e gap (por paciente+tipo)
create or replace view public.vw_eventos_tendencia
  with (security_invoker = true) as
  select
    e.paciente_id, e.tipo, e.ts, e.valor_num, e.unidade,
    lag(e.valor_num) over w as valor_anterior,
    e.valor_num - lag(e.valor_num) over w as delta,
    round(extract(epoch from (e.ts - lag(e.ts) over w)) / 3600.0, 1) as gap_horas
  from public.eventos_clinicos e
  where e.valor_num is not null and not e.requires_review and coalesce(e.confidence, 1) >= 0.7
  window w as (partition by e.paciente_id, e.tipo order by e.ts);
