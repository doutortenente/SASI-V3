-- 27-set-2026: fn_eval_alert e fn_eval_trend guardavam a severidade da regra numa variável TEXT
-- e a gravavam em alerts_log.severidade, que virou severidade_alerta_enum na adoção de enums
-- (f0, 08-ago). Desde então TODO evento que batia numa regra derrubava o INSERT inteiro com
-- "column severidade is of type severidade_alerta_enum but expression is of type text"
-- (reproduzido em 27/09 ao gravar glicemia 300 na L03). Correção mínima: a variável passa a
-- ser do tipo do enum. Lógica intocada.

create or replace function public.fn_eval_alert()
 returns trigger
 language plpgsql
 set search_path to 'public', 'extensions', 'pg_catalog'
as $function$
declare
  r          record;
  best_rank  int := 0;
  v_rank     int;
  b_rotulo   text;
  b_sev      public.severidade_alerta_enum;
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

create or replace function public.fn_eval_trend()
 returns trigger
 language plpgsql
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
  b_rotulo   text; b_sev public.severidade_alerta_enum; b_msg text; b_fonte text; b_id uuid; b_ordem int;
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
