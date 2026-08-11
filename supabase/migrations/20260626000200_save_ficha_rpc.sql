-- APLICADA no banco vivo em 26-jun-2026. Recuperada de supabase_migrations.schema_migrations
-- em 11-ago-2026, com md5 conferido (98ca442c2f59a755fb15dc843d2e234f). NAO EDITAR: migration aplicada nao se edita.
-- Ja consta como aplicada no banco, entao o `pnpm db:push` a pula.

-- save-transacional — grava paciente + evolucao + pendencias numa UNICA transacao.
-- Antes: FichaCompleta.handleSave fazia 3 escritas soltas; falha no meio = estado parcial.
-- Funcao PG e atomica: ou tudo grava, ou nada. security invoker -> respeita RLS (dev_bypass).

create or replace function public.save_ficha(
  p_paciente_id uuid,
  p_pac         jsonb,   -- campos de pacientes
  p_evol        jsonb,   -- campos de evolucoes (sistemas jsonb + arrays + sintese)
  p_evolucao_id uuid,    -- null = criar nova evolucao
  p_plantao     text,    -- usado so na criacao
  p_pendencias  jsonb default '[]'::jsonb  -- [{id?, tarefa, concluida}]
)
returns uuid             -- id da evolucao (criada ou atualizada)
language plpgsql
security invoker
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_evol_id uuid;
  pend      jsonb;
begin
  -- 1) paciente
  update pacientes set
    nome      = coalesce(p_pac->>'nome', nome),
    leito     = coalesce(p_pac->>'leito', leito),
    hd        = p_pac->>'hd',
    idade     = nullif(p_pac->>'idade','')::int,
    peso      = nullif(p_pac->>'peso','')::numeric,
    altura    = nullif(p_pac->>'altura','')::numeric,
    alergias  = p_pac->>'alergias',
    gravidade = coalesce(p_pac->>'gravidade', gravidade),
    data_adm  = coalesce(nullif(p_pac->>'data_adm','')::date, data_adm)
  where id = p_paciente_id;

  if not found then
    raise exception 'paciente % nao encontrado', p_paciente_id;
  end if;

  -- 2) evolucao (update se existe, senao insert). jsonb NOT NULL -> coalesce p/ vazio.
  if p_evolucao_id is not null then
    update evolucoes set
      neuro             = coalesce(p_evol->'neuro','{}'::jsonb),
      resp              = coalesce(p_evol->'resp','{}'::jsonb),
      hemo              = coalesce(p_evol->'hemo','{}'::jsonb),
      tgi               = coalesce(p_evol->'tgi','{}'::jsonb),
      renal             = coalesce(p_evol->'renal','{}'::jsonb),
      hemato            = coalesce(p_evol->'hemato','{}'::jsonb),
      infecto           = coalesce(p_evol->'infecto','{}'::jsonb),
      dvas              = coalesce(p_evol->'dvas','[]'::jsonb),
      sedativos         = coalesce(p_evol->'sedativos','[]'::jsonb),
      impressao         = coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')), '{}'),
      conduta           = coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')), '{}'),
      problemas_ativos  = coalesce(p_evol->'problemas_ativos','[]'::jsonb),
      condutas_sistemas = coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      riscos            = coalesce(p_evol->'riscos','[]'::jsonb)
    where id = p_evolucao_id
    returning id into v_evol_id;

    if v_evol_id is null then
      raise exception 'evolucao % nao encontrada', p_evolucao_id;
    end if;
  else
    insert into evolucoes (
      paciente_id, data_evolucao, plantao,
      neuro, resp, hemo, tgi, renal, hemato, infecto, dvas, sedativos,
      impressao, conduta, problemas_ativos, condutas_sistemas, riscos, sofa_snapshot
    ) values (
      p_paciente_id, now(), p_plantao,
      coalesce(p_evol->'neuro','{}'::jsonb), coalesce(p_evol->'resp','{}'::jsonb),
      coalesce(p_evol->'hemo','{}'::jsonb), coalesce(p_evol->'tgi','{}'::jsonb),
      coalesce(p_evol->'renal','{}'::jsonb), coalesce(p_evol->'hemato','{}'::jsonb),
      coalesce(p_evol->'infecto','{}'::jsonb), coalesce(p_evol->'dvas','[]'::jsonb),
      coalesce(p_evol->'sedativos','[]'::jsonb),
      coalesce(array(select jsonb_array_elements_text(p_evol->'impressao')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p_evol->'conduta')), '{}'),
      coalesce(p_evol->'problemas_ativos','[]'::jsonb),
      coalesce(p_evol->'condutas_sistemas','[]'::jsonb),
      coalesce(p_evol->'riscos','[]'::jsonb),
      '{}'::jsonb
    )
    returning id into v_evol_id;
  end if;

  -- 3) pendencias (upsert por item)
  for pend in select * from jsonb_array_elements(coalesce(p_pendencias,'[]'::jsonb)) loop
    if coalesce(pend->>'id','') <> '' then
      update pendencias set
        tarefa       = pend->>'tarefa',
        concluida    = coalesce((pend->>'concluida')::boolean, false),
        concluida_at = case when (pend->>'concluida')::boolean then now() else null end
      where id = (pend->>'id')::uuid;
    elsif coalesce(pend->>'tarefa','') <> '' then
      insert into pendencias (paciente_id, tarefa, prioridade, concluida)
      values (p_paciente_id, pend->>'tarefa', 2, coalesce((pend->>'concluida')::boolean, false));
    end if;
  end loop;

  return v_evol_id;
end;
$function$;
